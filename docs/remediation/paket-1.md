# Paket 1 — ESLint auf die Skripte in `.astro`-Dateien ausdehnen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: CONS-034 (low), CONS-033 (info)
- Ziel: Die `no-console`-Regel erreicht die Lookbook-Demos, und die
  Debug-Ausgabe der Crosses-Demo verschwindet samt der doppelten `body`-Regel.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `package.json` (Root, `devDependencies`)
  - `pnpm-lock.yaml`
  - `eslint.config.mjs`
  - `apps/lookbook/src/pages/demos/crosses.astro`
  - `apps/lookbook/src/pages/index.astro`
  - `apps/lookbook/src/components/Card.astro`
  - `apps/lookbook/src/components/TagCloudFilter.astro`
  - `apps/lookbook/src/pages/demos/display-multi.astro`
  - `apps/lookbook/src/pages/demos/animated-billboards.astro`
  - `apps/lookbook/src/pages/demos/animated-sprites.astro`
  - `apps/lookbook/src/pages/demos/display-minimal.astro`
  - `apps/lookbook/src/pages/demos/instanced-quads.astro`
  - `apps/lookbook/src/pages/demos/map2d-cam-visi.astro`
  - `apps/lookbook/src/pages/demos/textured-quads.astro`
  - `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro`
  - `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro`
  - `apps/lookbook/src/pages/demos/textured-quads-po2image-loader.astro`
  - `apps/lookbook/src/pages/demos/textured-sprites.astro`

## Was der Lint-Lauf aufdeckt

Zug 0 hat die Ausdehnung auf Kopien der 35 `.astro`-Dateien durchgemessen
(ESLint 10.9.1, `eslint-plugin-astro` 3.2.1, Projekt-Config plus dem einen
Spread aus Schritt 2). Ergebnis: **34 Befunde**, vollständig aufgezählt.

| Regel | Zahl | Wo |
| --- | --- | --- |
| `no-console` | 21 | 11 Demo-Seiten, Liste in Schritt 5 |
| `@typescript-eslint/consistent-type-imports` | 9 | 6 Dateien, autofixbar |
| `no-restricted-syntax` (`.ts`-Suffix) | 2 | `Card.astro:46`, `TagCloudFilter.astro:108` |
| `prefer-const` | 1 | `display-multi.astro:87`, autofixbar |
| `astro/no-unused-define-vars-in-style` | 1 | `index.astro:39` |

Die Rohausgabe des Messlaufs samt der dabei benutzten Config liegt im
Arbeitsverzeichnis: `paket-1.zug0-lint-messung.txt` und
`paket-1.zug0-probe-config.mjs`.

Diese Zahl ist die Kontrollsumme des Pakets: nach Schritt 7 meldet
`pnpm exec eslint .` null Befunde, und zwischendurch sinkt sie monoton. Findet
der Lauf mehr als 34, ist etwas anders als gemessen — das gehört in den Report,
nicht in eine zusätzliche Ausnahme.

## Vorgehen

1. **`eslint-plugin-astro` aufnehmen.** In die `devDependencies` der
   Root-`package.json`, alphabetisch zwischen `eslint-config-prettier` und
   `globals`:

       "eslint-plugin-astro": "^3.2.1",

   Nicht in den `catalog:`-Block von `pnpm-workspace.yaml` — der trägt die
   Versionen, die sich mehrere `package.json` teilen, und dieses Paket wird nur
   an einer Stelle gebraucht. Danach `pnpm install`; `pnpm-lock.yaml` gehört
   mit in den Commit. Den Parser `astro-eslint-parser` bringt das Plugin als
   eigene Dependency mit, er wird nicht einzeln aufgenommen. Die Peers
   `typescript-eslint`, `@typescript-eslint/parser`, `eslint-plugin-jsx-a11y`
   und `eslint-plugin-jsx-a11y-x` sind sämtlich als optional deklariert; eine
   pnpm-Warnung dazu ist kein Fehler.

2. **`eslint.config.mjs`: zwei Zeilen.** Der Import, alphabetisch unter die
   bestehenden:

       import astro from 'eslint-plugin-astro';

   und der Spread unmittelbar nach `...tseslint.configs.recommended,`:

       ...astro.configs['flat/recommended'],

   Mehr nicht. Grund, und das ist der Kern dieses Pakets: Der Processor
   `astro/astro` zerlegt jede `.astro`-Datei in virtuelle Skriptdateien mit
   Pfaden der Form `crosses.astro/0.ts`. Die bestehenden Blöcke `files:
   ['**/*.{js,ts}']` und `files: ['**/*.ts']` matchen diese Pfade von selbst —
   die Projektregeln greifen also ohne einen einzigen neuen Regelblock, und
   `no-console` erreicht die Demos. Ein zusätzlicher Block auf `'**/*.astro'`
   wäre wirkungslos: dort landet nur das Frontmatter, nicht der `<script>`-Teil.
   `flat/recommended` bringt neben Parser und Processor neun Astro-Regeln mit,
   von denen genau eine anschlägt (Schritt 6).

   Der Eintrag `'**/.astro'` in `ignores` bleibt unangetastet: er meint das von
   `astro sync` erzeugte Verzeichnis `apps/lookbook/.astro`, nicht die
   Dateiendung. Wer ihn für ein Endungs-Pattern hält und streicht, lintet
   generierte Typdeklarationen.

3. **Autofix, danach zwingend Prettier.** `pnpm exec eslint . --fix` erledigt
   die 9 `consistent-type-imports` und das eine `prefer-const` und fasst dabei
   diese sieben Dateien an: `crosses.astro`, `display-multi.astro`,
   `instanced-quads.astro`, `textured-quads.astro`,
   `textured-quads-from-texture-atlas.astro`,
   `textured-quads-from-tileset.astro`, `textured-quads-po2image-loader.astro`.

   Der Autofix schreibt durch den Processor zurück und **verliert dabei die
   Einrückung des Script-Blocks** — die sieben Dateien fallen anschließend bei
   `prettier --check` durch. Das ist gemessen, nicht befürchtet. Deshalb direkt
   im Anschluss:

       pnpm exec prettier --write "apps/lookbook/src/**/*.astro"

   Danach ist `prettier --check` grün und der Diff enthält genau die
   Import-Umstellungen. Den Diff trotzdem lesen: Prettier zieht dabei
   mehrzeilige Import-Listen auf eine Zeile zusammen, wenn sie unter 130
   Zeichen passen. Das ist erwünscht, aber es soll niemanden überraschen.

4. **Den `.ts`-Suffix aus zwei Typ-Importen nehmen.** Beide Stellen lauten
   `import type {…} from './types.ts';`:

   - `apps/lookbook/src/components/Card.astro:46`
   - `apps/lookbook/src/components/TagCloudFilter.astro:108`

   Der Suffix fällt **ersatzlos** weg — `from './types'` —, er wird nicht durch
   `.js` ersetzt. Das Lookbook läuft unter `moduleResolution: "Bundler"` (aus
   dem Root-`tsconfig.json`), und seine eigenen `.ts`-Dateien importieren im
   selben Verzeichnis bereits suffixlos, etwa
   `import type {LookBookShowDemosEventDetail} from './types';` in
   `apps/lookbook/src/demos/`. Die Regel verbietet allein den `.ts`-Suffix; die
   suffixlose Form erfüllt sie und passt zum Nachbarcode.

5. **Die Konsolenausgaben.**

   Die eine Stelle aus dem Finding verschwindet: in
   `apps/lookbook/src/pages/demos/crosses.astro` die Zeile `console.dir(demo);`
   samt der Leerzeile darüber, sodass `demo.start();` die letzte Anweisung des
   Script-Blocks ist.

   Die übrigen 20 Stellen bleiben stehen und bekommen je ein
   `// eslint-disable-next-line no-console` unmittelbar darüber, in der
   Einrückung der Zeile, für die es gilt. Sie legen Demo-Objekte in die
   Browserkonsole, damit man sie in den DevTools greifen kann — mehrfach
   gepaart mit `Object.assign(globalThis, {demo})` oder
   `(window as any).map2d = map2d`. Das ist gewollte Entwicklerhilfe, kein
   Debug-Rest, und das Repo kennt dafür genau dieses Muster: in
   `packages/twopoint5d/src/display/Display.ts`, `stage/StageRenderer.ts`,
   `stage/Stage2D.ts`, in `apps/lookbook/src/demos/quadtree-playground/`
   `QuadTreeVisualization.ts` und — durch den Processor hindurch bereits
   wirksam — in `animated-sprites.astro` selbst.

   Bewusst **nicht** gewählt: ein datei-weites `/* eslint-disable no-console */`
   am Kopf des Script-Blocks, wie es die drei `.ts`-Demos unter
   `apps/lookbook/src/demos/` tragen. Es schaltet die Regel für die ganze Datei
   ab, und dann ändert dieses Paket nichts an der Lage, die es beheben soll: die
   nächste hinzugefügte `console`-Zeile fiele wieder niemandem auf. Die
   Ausnahme je Stelle hält das Gate für alles Neue scharf.

   Die 21 gemeldeten Stellen, Zeilennummern im Stand vor Schritt 3 — der
   Lint-Lauf ist die maßgebliche Quelle, die Schritte 3 und 4 verschieben
   einzelne Zeilen um wenige Positionen:

   | Datei unter `apps/lookbook/src/pages/demos/` | Zeilen |
   | --- | --- |
   | `animated-billboards.astro` | 99, 116 |
   | `animated-sprites.astro` | 90, 124, 125 |
   | `crosses.astro` | 73 — **gestrichen**, kein Disable |
   | `display-minimal.astro` | 43, 44 |
   | `instanced-quads.astro` | 190 |
   | `map2d-cam-visi.astro` | 54, 57 |
   | `textured-quads.astro` | 137, 149 |
   | `textured-quads-from-texture-atlas.astro` | 103, 110 |
   | `textured-quads-from-tileset.astro` | 131, 141 |
   | `textured-quads-po2image-loader.astro` | 96, 115 |
   | `textured-sprites.astro` | 111, 112 |

   `animated-sprites.astro:85` (`console.error` im `error`-Handler des
   TextureStore) trägt sein `eslint-disable-next-line` bereits und wird nicht
   angefasst — es ist zugleich der Beweis, dass die Kommentare den Processor
   überstehen.

6. **Die tote Style-Variable in `apps/lookbook/src/pages/index.astro`.**
   `define:vars` in Zeile 39 definiert `'page-gradient-back'`, und
   `var(--page-gradient-back)` steht ausschließlich in auskommentierten
   CSS-Zeilen. Es fallen weg:

   - der Schlüssel `'page-gradient-back': \`url(${gradientBack})\`` aus dem
     `define:vars`-Objekt, sodass dort nur noch
     `'page-background-pattern'` steht;
   - der Frontmatter-Import
     `import gradientBack from '../images/so-mi-gradient-back-gr.webp?url';`
     (Zeile 8), der danach nirgends mehr gelesen wird;
   - die auskommentierten CSS-Zeilen in `.back-pattern`, die auf die Variable
     zeigen: `/* background-image: var(--page-background-pattern),
     var(--page-gradient-back); */` sowie der Viererblock
     `/* background-image: var(--page-gradient-back); */`,
     `/* background-repeat: no-repeat; */`, `/* background-size: contain; */`,
     `/* background-position: top center; */`.

   Die aktiven Regeln der Klasse `.back-pattern` bleiben unverändert. Die
   Bilddatei `apps/lookbook/src/images/so-mi-gradient-back-gr.webp` bleibt
   liegen; dass sie danach von nichts mehr referenziert wird, steht als
   Nebenbefund in der Queue des Plans und wird **nicht** in diesem Paket
   entschieden.

7. **Die doppelte `body`-Regel in `crosses.astro`.** Der `<style>`-Block trägt
   zwei getrennte `body`-Regeln (Zeilen 12 und 16). Sie werden zu einer
   zusammengezogen, in der Reihenfolge der bisherigen Deklarationen:

       body {
         height: 100vh;
         overflow-y: hidden;
         background: radial-gradient(circle, rgb(77, 141, 81) 0%, rgb(113, 19, 114) 100%);
       }

   Werte unverändert, kein Umsortieren, keine zweite Idee.

## Was nicht zu diesem Paket gehört

- Die drei `.ts`-Demos mit datei-weitem `/* eslint-disable no-console */`
  (`apps/lookbook/src/demos/map2d-cam-visi.ts`, `map2d-rect-visi.ts`,
  `map2d-tile-sprites.ts`) bleiben, wie sie sind. Sie verletzen keine Regel.
- Keine Regel wird abgeschaltet, keine Datei aus dem Lint genommen, kein
  `ignores`-Eintrag ergänzt. Fällt ein Befund an, der sich so nicht beheben
  lässt, geht er als Folge in den Report — nicht in eine Ausnahme.
- Die generierten Coverage-Artefakte unter `packages/twopoint5d/coverage/`
  bleiben unberührt; sie sind nicht versioniert.

## Verify

`pnpm run ci`

Während der Arbeit reicht `pnpm exec eslint .` für die Befundzahl und
`pnpm exec prettier --check "apps/lookbook/src/**/*.astro"` für die
Formatierung. Der Typecheck des Lookbooks (`astro check`) läuft in `pnpm run
ci` mit und ist die Probe auf Schritt 4.

## Commit

    chore(lint): extend eslint to the scripts in astro files

    The astro processor hands each <script> block to ESLint as a virtual .ts
    file, so the existing rule blocks reach the lookbook demos: no-console,
    consistent-type-imports and the import suffix rule now apply there.

    Console output that exists to hand a demo object to the devtools keeps a
    named exception per line; the crosses demo loses a leftover console.dir.

## Verlauf

- 2026-09-20 Zug 0: Detailplan steht · CONS-034 unverändert
  (`crosses.astro:73`, `console.dir(demo)`) · CONS-033 unverändert
  (`crosses.astro:12` und `:16`, zwei `body`-Regeln) · »Offene Befunde« war
  leer, nichts zu triagieren · Ausdehnung auf Kopien durchgemessen: 34 Befunde,
  Aufstellung oben · ein Nebenbefund in die Queue des Plans (verwaistes Asset
  `so-mi-gradient-back-gr.webp`) · Restplan unverändert
- 2026-09-20 Zug 1: Implementierer beauftragt, mittlere Stufe, Effort medium ·
  Brief `paket-1.impl-1.brief.txt`, Report `paket-1.impl-1.json`
- 2026-09-20 Zug 2: Report FERTIG · 19 Dateien geändert (`package.json`,
  `pnpm-lock.yaml`, `eslint.config.mjs`, 15 Dateien unter `apps/lookbook/src/`,
  dazu `docs/architecture.md` als mitgezogene Folge) · Lint-Befundzahl 34 → 0,
  Zwischenstände 34/24/1/0 · Regressionstest entfällt (kein Korrektheitsfehler,
  das Gate ist der Lint-Lauf) · keine Abweichungen · Arbeitsbaum schmutzig
- 2026-09-20 Zug 3: Reviewer mittlere Stufe, Effort medium · beide Findings als
  behoben bestätigt, keine kritischen und keine wichtigen Befunde, vier kleine ·
  Diff `paket-1.diff`, Report `paket-1.review-1.json`
- 2026-09-20 Zug 4: entfällt — keine Runde ausgelöst, 1 Runde insgesamt
- 2026-09-20 Zug 5: `pnpm run ci` selbst gefahren, exit=0
  (`paket-1.verify.log`) · Commit `e7a112b3`, 19 Dateien, +139/−36 ·
  Arbeitsbaum danach sauber bis auf Plan und Paketdatei

## Urteil des Reviewers

- **CONS-034 · behoben.** `apps/lookbook/src/pages/demos/crosses.astro` — die
  Zeile `console.dir(demo);` ist weg, `demo.start();` schließt den
  Script-Block. `eslint.config.mjs` spreadet `astro.configs['flat/recommended']`
  nach `tseslint.configs.recommended`, damit greift `no-console` in den
  `<script>`-Blöcken; `pnpm exec eslint .` meldet null Befunde. Die 20
  verbleibenden Konsolenstellen tragen je ein `eslint-disable-next-line`.
- **CONS-033 · behoben.** `apps/lookbook/src/pages/demos/crosses.astro` — eine
  einzige `body`-Regel mit `height`, `overflow-y`, `background` in der
  bisherigen Reihenfolge, Werte unverändert.

Kleine Befunde, keine Runde ausgelöst:

1. `apps/lookbook/src/pages/demos/instanced-quads.astro:23` — die Datei mischt
   zwei Import-Stile: `VertexObjectPool` steht im `import type`-Block, `VO`
   bleibt als Inline-`type` im Value-Import. Der Lint akzeptiert beides.
2. `package.json:9` — `eslint-plugin-astro` verlangt
   `node ^22.22.3 || ^24.16.0 || >=26.3.0`, die Root-`engines` sagen `>=24`.
   Ohne `engine-strict` nur eine Warnung auf Node 24.0–24.15; CI und lokaler
   Rechner liegen darüber.
3. Die Commit-Message nennt die Ausdehnung und die gestrichene `console.dir`,
   nicht aber die tote `define:vars`-Variable, den `body`-Merge und den
   `.ts`-Suffix. Sie kam so aus dem Detailplan und wurde unverändert benutzt.
4. Der Reviewer erinnert daran, dass Plan und Paketdatei ungetrackt bleiben
   müssen — sie tragen die Finding-IDs und gehören in keinen Feature-Commit.
   Eingehalten: der Commit enthält nur die 19 Projektdateien.

Nicht selbst nachgeprüft hat der Reviewer `pnpm run ci`; das ist Zug 5 und
liegt als `paket-1.verify.log` mit `exit=0` im Arbeitsverzeichnis.

## Begründung der Urteile an den Nebenbefunden

Alle sechs Nebenbefunde des Implementierers liegen in Dateien, die dieses Paket
angefasst hat, und waren auch ohne es falsch. Die Scope-Regel des Laufs nimmt
alles auf, was im Lauf auffällt — deshalb tragen alle `→ Scope`. Ein eigenes
Paket schneidet dieses hier nicht: das tut die Drain-Runde des Abschlusses mit
allen Befunden vor Augen. Gemeinsame Ursache mit Paket 1 hat keiner von ihnen;
es sind CSS-Fehler und ein Tippfehler, die der Lint-Ausdehnung nur deshalb
begegnet sind, weil jemand die Dateien gelesen hat. Der Lint sieht CSS nicht.

## Findings im Volltext

**CONS-034 · low · Konsistenz · code · Aufwand S ·
`apps/lookbook/src/pages/demos/crosses.astro:73`** — console.dir aus der
Crosses-Demo entfernen und no-console auf .astro ausdehnen

`console.dir(demo)` bleibt als Debug-Ausgabe in einer ausgelieferten Demo
stehen; die ESLint-Regel `no-console` erfasst `.astro`-Dateien nicht, deshalb
sieht es kein Gate. Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: Die Zeile streichen; die Lint-Konfiguration auf die Skripte in
`.astro`-Dateien ausdehnen oder die Lücke dokumentieren.

**CONS-033 · info · Konsistenz · code · Aufwand S ·
`apps/lookbook/src/pages/demos/crosses.astro:12, 16`** — Die beiden
body-Regeln der Crosses-Demo zusammenlegen

Zwei getrennte `body`-Regeln im selben `<style>`-Block. Aufgefallen im
Remediation-Lauf vom 2026-09-19.

Empfehlung: Zu einer Regel zusammenfassen.
