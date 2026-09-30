# Paket 8 — Library- und Repo-Dokumentation

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des Laufs, hier die
Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DOC-025 (medium), IMPL-001 (low), DOC-060 (low), DOC-034 (low), DOC-067 (low),
  READ-025 (info), DOC-059 (info), DOC-070 (info), DOC-076 (info)
- Dazu (Plan, verteilt in Zug 0 Paket 2): `packages/twopoint5d/README.md:60` — Peers des
  Pakets unvollständig (Queue-Eintrag und Folge aus Paket 1)
- Dazu (Folgen aus Paket 4, verteilt in Zug 0 Paket 5): `docs/architecture.md:69` (Bezug
  »any of them«), `docs/architecture.md:373–380` (§6-Absatz ausgefranst)
- Dazu (Folgen aus Paket 10, verteilt in Zug 0 Paket 8): `packages/twopoint5d/src/stage/README.md:628–636`
  (»Resource lifecycle«, `dispose()`-Punkt ohne werfende Host-Abmeldung),
  `packages/twopoint5d/src/stage/StageRenderer.ts:1165–1178` (`add()`-TSDoc-Absatz ausgefranst)
- Dazu (Queue, gleiche Ursache wie DOC-070): `apps/lookbook/README.md:9` — 91 Zeichen
- Dazu (Nebenbefunde aus Zug 0, gleiche Ursache): `packages/twopoint5d/package.json:3`
  (`description` sagt »with WebGL and three.js«, wie DOC-025) · Zeilen über 88 in
  `packages/twopoint5d/docs/architecture.md` außerhalb des READ-025-Absatzes, in `AGENTS.md`,
  im Root-README und im Library-README (wie DOC-067 / READ-025)
- Ziel: README zeigt Konsumenten die ersten fünf Minuten, Architektur-Doku und
  resource-lifecycle.md stimmen mit dem WebGPU/NodeMaterial-Code überein, und AGENTS.md sowie
  die Docs sind sauber umbrochen und eindeutig.
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `README.md`, `packages/twopoint5d/README.md`, `packages/twopoint5d/README-pkg.md`,
  `packages/twopoint5d/package.json` (nur `description`),
  `packages/twopoint5d/docs/architecture.md`, `packages/twopoint5d/docs/resource-lifecycle.md`,
  `AGENTS.md`, `docs/architecture.md`, `apps/lookbook/README.md`,
  `packages/twopoint5d/src/stage/README.md`, `packages/twopoint5d/src/stage/StageRenderer.ts`
  (nur ein TSDoc-Absatz). Kein Code ändert sich, kein CHANGELOG-Eintrag: das Paket bewegt keine
  öffentliche API (Paket 9 glättet den CHANGELOG).
- Regressionstest: keiner — kein Finding ist ein Laufzeitfehler. Belege sind Verify, die zwei
  Proben unten und die Mutationsprobe am neuen `ts check`-Block.
- Verify: `pnpm run ci`
- Commit: `docs: show consumers how to install the library and draw a first sprite with it, say
  in the READMEs, the package description and the library architecture that it renders
  through the WebGPURenderer of three.js with WebGL 2 as fallback and builds its sprite
  materials with TSL, draw utils/ at the bottom of the layer stack, point the resource
  lifecycle rules at their own sections, say that the browser test package is private, tie
  the expose-gc sentence of AGENTS.md and the marked-block sentence of the monorepo docs to
  what they mean, let the stage docs count a throwing unsubscribe of the host among the errors
  of dispose(), and rewrap the docs that outgrew their width` (eine Zeile, ohne die
  Zeilenumbrüche dieses Plans)
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · DOC-025 unverändert (`README.md` ohne
    Konsumenten-Install, WebGL-Sätze jetzt `:32–38`; npm-README ist `README-pkg.md`, 9 Zeilen)
    · IMPL-001 unverändert, nach `architecture.md:31–41` und `:142` gewandert · DOC-060
    umgeformt: Architektur `:123–125` und `:142` unverändert, die README-Hälfte nennt eventize
    inzwischen, verschweigt aber signalize und `@types/three` (= Queue/Folge Paket 1) · DOC-034
    unverändert `:5–6`, `:79` · DOC-067 gewachsen: 21 Zeilen über 88 (12 Prosa, 9 Code) ·
    READ-025 unverändert `:93` · DOC-059 unverändert · DOC-070 zur Hälfte in 5a413417 erledigt,
    Rest nach `apps/lookbook/README.md:64` gewandert · DOC-076 nach `AGENTS.md:122` gewandert ·
    Folgen aus Paket 10 (beide) hierher, Queue `apps/lookbook/README.md:9` hierher, neuer
    Queue-Eintrag `packages/twopoint5d/README.md:35` (Tippfehler) · Restplan geprüft: Paket 9 bleibt,
    wie es ist (dieses Paket schreibt keinen CHANGELOG, die TSDoc hinter CONS-047 liegt in
    `Stage2D.ts`, nicht in `StageRenderer.ts`)
  - 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, effort medium) · Report nach
    `paket-8.impl-0.json`
  - 2026-09-30 Zug 2: Report FERTIG_MIT_VORBEHALT · 11 Dateien geändert (die elf aus
    »Dateien«), Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0
    (`paket-8.verify.log`), 19 Blöcke in 4 Dateien, 0 errors · Mutationsprobe rot (TS2551) ·
    Probe 1 wie erwartet plus `resource-lifecycle.md:68` (129) und `:290` (96): Links mit
    Codespan, nach der Umbruchregel untrennbar, beide schon vorher über 88 · Probe 2 leer
    für Lookbook-README und `StageRenderer.ts`, keine Finding-ID im Diff
  - 2026-09-30 Zug 3: Reviewer beauftragt (sonnet, effort medium) · Diff `paket-8.diff` ·
    alle Findings und Zusatzposten behoben · zwei klein: (1) `docs/architecture.md:44`
    »each of them takes its helpers from there« stimmt nicht (`display/`, `sprites/`
    importieren nichts aus `utils/`) — vom Orchestrator als `wichtig` eingestuft (eigene
    Doku, die lügt), Zieltext 6a in dieser Datei auf »any of them may take« korrigiert;
    (2) Library-README `:44`/`:50` noch Shader/WebGL-Wortlaut → Queue
  - 2026-09-30 Zug 4 Runde 1: Befund (1) an denselben Implementierer (`--resume`, sonnet,
    medium) · Report nach `paket-8.impl-1.json`
  - 2026-09-30 Zug 4 Runde 1: Report FERTIG, nur `packages/twopoint5d/docs/architecture.md`
    geändert (Satz + Absatz `:44–46` neu gefüllt) · Verify exit=0 (`paket-8.verify-1.log`) ·
    Diff `paket-8-1.diff` · Nachreviewer (sonnet, medium, `paket-8.review-1.json`): Befund
    erledigt, keine neuen · Fortschritt: 1 von 1 offenen Befunden erledigt
  - 2026-09-30 Zug 5: committet als d05f0422 (11 Dateien, Trailer `Remediation-Run:
    2026-09-30`) · Plan auf `[x]`, zwei Queue-Einträge abgehakt, vier neue in die Queue

## Vorgehen

Alle Texte in der Doku sind Englisch. Wo unten ein Zieltext steht, wird er wörtlich
übernommen und nur nach der Umbruchregel umbrochen. Die Konventionen im Kopf von
`./remediation-plan.md` gelten für jede Zeile — kein Satz über einen Vorzustand, keine
Finding-ID. `AGENTS.md` vor der ersten Änderung lesen.

### Umbruchregel (gilt für jeden Schritt)

Umbrechen heißt: dieselben Wörter in derselben Reihenfolge, jede Zeile so voll, wie es unter
der Grenze geht, und keine endet früher, als das nächste Wort es erzwingt. Gezählt wird in
Zeichen, nicht in Bytes (`perl -CSD`; macOS-`awk` zählt Bytes und hält `—` für drei). Ein
Codespan (`` `…` ``) und ein Link-Ziel `(…)` werden nie getrennt, ein HTML-Entity wie
`&#x2011;` auch nicht. Listenpunkte setzen mit zwei Leerzeichen fort, nummerierte mit drei,
Blockzitate mit `> `. Überschriften, Tabellenzeilen und Leerzeilen bleiben, wie sie sind.

| Datei | Grenze | Umfang |
| --- | --- | --- |
| `README.md` | 88 | alles ab `:24`; der HTML-Kopf `:1–22` bleibt unberührt |
| `packages/twopoint5d/README.md` | 88 | ganze Datei |
| `packages/twopoint5d/README-pkg.md` | 88 | ganze Datei; die Bildzeile `:5` bleibt, wie sie ist |
| `packages/twopoint5d/docs/architecture.md` | 88 | ganze Datei, Codeblock eingeschlossen |
| `packages/twopoint5d/docs/resource-lifecycle.md` | 88 | ganze Datei, Codeblöcke eingeschlossen |
| `AGENTS.md` | 88 | ganze Datei außer den Tabellenzeilen `:15`, `:16`, `:18` |
| `apps/lookbook/README.md` | 90 | die Absätze `:8–12` und `:63–67` |
| `docs/architecture.md` | 90 | die Absätze, die Schritt 9 anfasst (Paket 4 hält die Prosa dort bei ≤ 90) |
| `packages/twopoint5d/src/stage/README.md` | 90 | der eine Punkt `:628–636` |
| `packages/twopoint5d/src/stage/StageRenderer.ts` | 78 samt `   * ` | der eine Absatz `:1165–1178` |

88 ist die Breite, auf der die Library-Doku, `AGENTS.md` und DOC-067 stehen; 90 die der
Lookbook-README (DOC-070 empfiehlt »rund 90«) und die Regel, die Paket 4 für
`docs/architecture.md` gesetzt hat; 78 die des `add()`-TSDoc-Blocks. Die Grenzen der
READMEs sind eine Entscheidung dieses Zugs: Root- und Library-README stehen heute als ein
Absatz pro Zeile, und ein neuer, nach Konvention umbrochener Usage-Abschnitt daneben ergäbe
genau die gemischte Datei, die DOC-070 und READ-025 bemängeln. GitHub und npm rendern
weich umbrochene Absätze gleich.

### 1. Root-README: Usage-Abschnitt (DOC-025)

In `README.md` einen neuen Abschnitt `## Usage` zwischen »What's in this repository 👀«
(`:50–54`) und »📖 Documentation« (`:56`) einfügen, mit genau diesem Inhalt (die inneren
Codeblöcke hier mit `~~~` gezeigt, im README mit drei Backticks):

~~~markdown
## Usage

```sh
npm install @spearwolf/twopoint5d three @spearwolf/eventize @spearwolf/signalize
```

`three`, `@spearwolf/eventize` and `@spearwolf/signalize` are peer dependencies: the
application installs them next to the library. `three` has to lie in the peer range of the
installed release, which `npm view @spearwolf/twopoint5d peerDependencies` prints — the
library follows the 0.x minors of three.js one at a time, and a `three` outside that range
is a peer conflict. A TypeScript project adds `@types/three` from the same range as a
development dependency; it is the one optional peer.

The library renders through the `WebGPURenderer` of three.js, which falls back to WebGL 2
where the browser has no WebGPU; a `WebGLRenderer` is not supported. Import three.js from
`three/webgpu` and its shader nodes (TSL) from `three/tsl`, as the library itself does.

One textured sprite, drawn by a `Display` with a scene and a camera of its own:

```ts check
import {Display, TextureFactory, TexturedSprites} from '@spearwolf/twopoint5d';
import {PerspectiveCamera, Scene} from 'three/webgpu';

// the display owns the renderer and drives the frame loop
const display = new Display(document.getElementById('canvas')!);

const scene = new Scene();
const camera = new PerspectiveCamera(60);
camera.position.z = 400;

display.onResize(({width, height}) => {
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});

display.onInit(async ({renderer}) => {
  const texture = await new TextureFactory(renderer).loadAsync('sprite.png');

  // a mesh with room for one sprite, drawn with the texture
  const sprites = new TexturedSprites(1, texture);

  const sprite = sprites.createSprite()!;
  sprite.setSize(256, 256);
  // s, t, u, v: the whole image
  sprite.setTexCoords(0, 0, 1, 1);

  // upload what the sprite wrote into the buffers of the mesh
  sprites.update();
  scene.add(sprites);

  display.onDispose(() => {
    // the mesh releases the material it built around the texture; the texture is yours
    sprites.dispose();
    texture.dispose();
  });
});

display.onRenderFrame(({renderer}) => renderer.render(scene, camera));

display.start();
```

`#canvas` is a `<canvas>` on the page, or an element the display puts a canvas into. The
same sprite, with a frame of a texture atlas in place of the whole image, is the first demo
of the [lookbook](apps/lookbook/) — [its source](apps/lookbook/src/pages/demos/first-sprite.astro);
in a clone of this repository, `pnpm lookbook` serves it at
<http://localhost:4321/lookbook/demos/first-sprite>. From there:

- [Stage layer cheat-sheet](packages/twopoint5d/src/stage/README.md) — projections,
  several stages in one frame, post-processing
- [Vertex objects](packages/twopoint5d/src/vertex-objects/README.md) — what a vertex
  object description declares, for sprites of your own
- [Resource lifecycle](packages/twopoint5d/docs/resource-lifecycle.md) — what `dispose()`
  releases and what stays yours
~~~

Der Codeblock ist in Zug 0 gegen den gebauten Stand von 6861f3d0 kompiliert worden
(`node ../../scripts/checkDocSnippets.mjs <datei>` aus `packages/twopoint5d-testing`:
0 errors), er ist dem Lookbook-Demo `first-sprite.astro` nachgebaut, das Paket 7 im Browser
geprüft hat — nur die Textur kommt aus `TextureFactory#loadAsync()` statt aus einem
`TextureStore`, und `setTexCoords(0, 0, 1, 1)` nimmt das ganze Bild. Der Block ist länger als
die 15 Zeilen der Audit-Empfehlung, weil Resize und Dispose zu einem korrekten
Minimalprogramm gehören (`resource-lifecycle.md`: eine übergebene Textur bleibt beim Aufrufer).
Die Install-Zeile nennt `three` ohne Version und sagt dafür, wo der Bereich steht — eine
Versionsangabe im README veraltete mit jedem three-Bump.

### 2. Root-README: Introduction auffrischen (DOC-025)

In `README.md` genau diese Stellen ersetzen, der Rest der Sätze bleibt Wort für Wort
(einschließlich der klein begonnenen Sätze des Autors):

- `:32` »the actual data ends up in internal buffers that are efficiently rendered in batches
  by three.js/webgl, usually via instanced rendering.« → »the actual data ends up in internal
  buffers that three.js renders efficiently in batches, usually via instanced rendering —
  through its `WebGPURenderer`, which falls back to WebGL 2 where WebGPU is missing.«
- `:34` »ensures that webgl can render the current sprite pool« → »ensures that the GPU can
  render the current sprite pool«; »the cumbersome handling of webgl buffers« → »the
  cumbersome handling of GPU buffers«
- `:36` »a freeform polygon with special properties used in a custom vertex shader is
  completely up to the creator of the vertex object description and the associated shaders
  that use those properties.« → »a freeform polygon with special properties read by a custom
  material is completely up to the creator of the vertex object description and of the
  material that uses those properties — a three.js `NodeMaterial` whose shader is written in
  TSL (`three/tsl`).«
- `:38` »the boring details of the WebGL API.« → »the boring details of WebGPU and WebGL.«
  (die zwei Leerzeichen am Zeilenende fallen weg)

Die historischen Sätze in `:28` (»a custom webgl renderer« der zweiten Iteration) bleiben:
sie erzählen, woher die Library kommt. `:40` und `:42` (»sprite shaders«) bleiben ebenfalls.

### 3. Root-README: umbrechen

`README.md` ab `:24` nach der Umbruchregel auf 88. Die Kommentarzeile im Codeblock `:91`
wird zu Kommentarzeilen über dem Befehl, Wörter unverändert:

```sh
# clean, lint, build, type-check, check the package types and that every published
# type can be named, lint the manifest, then the script tests, the Vitest suite with
# coverage and the browser tests
$ pnpm cbt
```

### 4. npm-README und Paketbeschreibung (DOC-025, Nebenbefund)

`packages/twopoint5d/README-pkg.md` ist das README, das auf npm erscheint
(`scripts/publishNpmPkg/releaseFiles.mjs:14`). Zwischen der Bildzeile `:5` und »please see
…« (`:7`) einfügen:

~~~markdown
```sh
npm install @spearwolf/twopoint5d three @spearwolf/eventize @spearwolf/signalize
```

three.js, `@spearwolf/eventize` and `@spearwolf/signalize` are peer dependencies; a
TypeScript project adds `@types/three` as well. The library renders through the
`WebGPURenderer` of three.js (`three/webgpu`), with WebGL 2 as its fallback. The peer
ranges, a first sprite and the docs are under
[Usage](https://github.com/spearwolf/twopoint5d#usage).
~~~

Die Zeile »please see :octocat: …« auf 88 umbrechen; das Link-Ziel bleibt ganz. Der Link
auf den Usage-Abschnitt ist absolut, weil npm relative Links nicht auf GitHub auflöst — wie
die Bildzeile.

In `packages/twopoint5d/package.json:3` wird `description` zu `"Create 2.5D realtime
graphics and pixelart with three.js and WebGPU"`. Sonst ändert sich in der Datei nichts.

### 5. Library-README (DOC-060, Queue `:60`, Umbruch)

In `packages/twopoint5d/README.md` wird `:60` zu:

```markdown
- imports nothing but three.js and `@spearwolf/eventize`; the peer dependencies of the
  package are listed under [Usage](../../README.md#usage)
```

Der Satz über `display/` stimmt (das Modul importiert nur `three`, `three/webgpu` und
`@spearwolf/eventize`), nur »both peer dependencies of the package« las sich als die
vollständige Peer-Liste; die steht jetzt an einer Stelle. Danach die ganze Datei auf 88
umbrechen — die Absätze `:35–45` und die Listenpunkte `:47`, `:58`, `:61`, `:65`.
`event&#x2011;loop` in `:58` bleibt eine Einheit. Den Tippfehler »primtives« und das »etc..«
in `:35` **nicht** anfassen: sie stehen als eigener Eintrag in »Offene Befunde«.

### 6. Library-Architektur (IMPL-001, DOC-060, READ-025)

In `packages/twopoint5d/docs/architecture.md`:

a) Das Schichtbild `:33–41` wird zu (utils/ unten, alles andere in der Reihenfolge, in der
es importiert — in Zug 0 gegen die Imports aller Nicht-Spec-Dateien geprüft: `utils/`
importiert kein Modul, `vertex-objects/` und `texture/` nur `utils/`, `display/` nur
`src/events.ts`, `sprites/` `texture/` und `vertex-objects/`, `stage/` `display/`,
`texture/` und `utils/`, `map2d/` `sprites/`, `texture/`, `vertex-objects/` und `utils/`,
`controls/` `display/` und `utils/`):

~~~markdown
```
controls/         input: the pan control
map2d/            Tiled-style streaming maps
sprites/          ready-made sprite meshes
stage/            scenes, projections, render pipeline
display/          canvas, renderer, frame loop
texture/          atlases, tile sets, resource cache
vertex-objects/   the buffer core everything else stands on
utils/            helpers without rendering state
```

`utils/` lies under every other layer: any of them may take its helpers from there, and it
imports no other module of the library. `src/events.ts` stands beside the stack: it names
the events of `display/`, `stage/` and `controls/` and types their payloads against those
modules through `import type` alone.
~~~

b) `:118–119` »the timing data the animated sprite shaders read« → »the timing data the
animated sprite material reads«.

c) `:123–125` »`Display` owns the three.js renderer (WebGL or WebGPU — `isWebGLRenderer` /
`isWebGPURenderer` discriminate) and its canvas, unless the canvas was handed to the
constructor, and drives the frame loop.« wird zu:

> `Display` owns the three.js `WebGPURenderer` and its canvas, unless the canvas was
> handed to the constructor, and drives the frame loop. The renderer draws through
> WebGPU, or through its WebGL 2 fallback where the browser has no WebGPU —
> `Display#isWebGLBackend` tells which. A `WebGLRenderer` handed to the constructor is
> refused with a `TypeError`; `isWebGLRenderer` and `isWebGPURenderer` tell the two
> renderer classes apart.

(Beleg: `Display.ts:1016–1023` wirft den `TypeError`, `isWebGLBackend` steht an
`Display.ts:936–941`, beide Prädikate exportiert `display/public-api.ts`.)

d) `:142` »Ready-made vertex-object descriptions plus their geometry and `ShaderMaterial`:«
→ »Ready-made vertex-object descriptions plus their geometry and a `NodeMaterial` whose
shader is built with TSL (`three/tsl`):« (`TexturedSpritesMaterial` und
`TileSpritesMaterial` erben von `NodeMaterial`, `AnimatedSpritesMaterial` von
`TexturedSpritesMaterial`; `ShaderMaterial` kommt im Quelltext nicht mehr vor.)

e) Danach die ganze Datei auf 88 umbrechen; READ-025 ist der Absatz `:78–102` (die
Zeile `:93` endet nach 62 Zeichen), aber auch die Regeln `:57–71`, `:112–118`, `:146–156`
stehen über 88.

### 7. resource-lifecycle.md (DOC-034, DOC-067)

In `packages/twopoint5d/docs/resource-lifecycle.md`:

- `:5–6` »Section 7 is the checklist, section 8 the tests to ship with it.« → »Section 6 is
  the checklist, section 7 the tests to ship with it.« (§6 »Checklist for a new
  `dispose()`« `:301`, §7 »The dispose test pattern« `:317`)
- `:79` »Assertion (f) in section 8 tests it.« → »Assertion (f) in section 7 tests it.«
- Die übrigen Abschnittsverweise (`:305` §1, `:306` §2, `:309` §5, `:311` §3, `:315` §7,
  `:327` §3, `:423` §1) stimmen und bleiben.
- Die ganze Datei auf 88: die Prosa nach der Umbruchregel, in den `ts`-Codeblöcken die
  Kommentare neu umbrochen und die zwei langen Anweisungen so getrennt, wie Prettier es bei
  dieser Breite täte — `:52`:

  ```ts
  this.pool =
    source instanceof VOBufferPool ? source : new VOBufferPool(source, capacity);
  ```

  und `:234–236`:

  ```ts
      throw new AggregateError(
        errors,
        'Display#dispose(): a listener of pause threw, and a listener of dispose threw',
        {cause: errors[1]},
      );
  ```

  Die Blöcke sind Auszüge (kein `ts check`); ihre Zeichenketten bleiben unverändert.

### 8. AGENTS.md (DOC-076, Umbruch)

- DOC-076: Der Satz »The Vitest config starts its workers with `--expose-gc` for it, and
  `src/testing/` never reaches `dist/`.« (`:122–123`) zieht direkt hinter den Satz, der
  `measureSettledBytes()` und `measureAllocatedBytes()` einführt (endet `:110` mit »… which
  empties only the young generation before its rounds.«), und lautet dort: »The Vitest
  config starts its workers with `--expose-gc` for these two helpers, and `src/testing/`
  never reaches `dist/`.« (Beide rufen `gc()`: `measureSettledBytes.ts:30`,
  `measureAllocatedBytes.ts:35–47`, das zweite wirft ohne.)
- Dann die ganze Datei auf 88 außer den Tabellenzeilen `:15`, `:16`, `:18`. Heute stehen
  `:30`, `:33`, `:49`, `:50`, `:52`, `:61`, `:96`, `:111–113`, `:120`, `:127`, `:133`,
  `:152–154` darüber; umbrochen wird jeweils der ganze Punkt bzw. Absatz. Die Zeilenstruktur
  des Punkts »Two test surfaces« (jeder Gedanke beginnt eine neue Quellzeile) bleibt, nur die
  Zeilen innerhalb eines Gedankens werden neu gefüllt.

### 9. Monorepo-Architektur (DOC-059, Folgen aus Paket 4)

In `docs/architecture.md`, Grenze 90:

- `:69–70` »every Markdown file git tracks: a marked block can sit in any of them, and one
  that stops compiling has to turn the target red.« → »every Markdown file git tracks: a
  marked block can sit in any tracked Markdown file, and one that stops compiling has to
  turn the target red.« Den Absatz `:63–74` neu umbrechen.
- `:373–380` (»Four specs start a script itself …«) neu umbrechen, Wörter unverändert.
- DOC-059: an den Punkt `:342–347` (`@web/test-runner` … `packages/twopoint5d-testing`)
  anhängen: »The package is `"private": true`: it is a test harness, never a release, so npm
  refuses to publish it and `pnpm publish -r` passes it by.« Den Punkt neu umbrechen.

### 10. Lookbook-README (DOC-070, Queue `:9`)

In `apps/lookbook/README.md`, Grenze 90, Wörter unverändert: den Absatz »Running it«
`:8–12` (die Zeile `:9` hat 91 Zeichen) und den Absatz »Checks« `:63–67` (»lookbook and«
steht allein auf `:64`) neu umbrechen.

### 11. Stage-Doku (Folgen aus Paket 10)

- `packages/twopoint5d/src/stage/README.md`, Punkt `StageRenderer.dispose()` im Abschnitt
  »Resource lifecycle« (`:628–636`): der Schlusssatz »A listener of `OnStageRemoved`,
  `OnRemoveFromParent` or `OnStageDispose` that throws holds up none of this; its error
  reaches the caller once the renderer is down.« wird zu »A listener of `OnStageRemoved`,
  `OnRemoveFromParent` or `OnStageDispose` that throws holds up none of this, and neither
  does an unsubscribe of the host that throws — the renderer gives up its other
  subscription there all the same; the errors reach the caller once the renderer is
  down.« Den Punkt auf 90 umbrechen. (Quelle: die `dispose()`-TSDoc
  `StageRenderer.ts:1036–1046`; der Abschnitt »Custom host« `:605–610` sagt es für den
  Umzug schon.)
- `packages/twopoint5d/src/stage/StageRenderer.ts`, TSDoc von `add()`: den Absatz »A
  listener that throws does not cut the call short — … and has left its previous holder.«
  (`:1165–1178`, die Zeile `:1174` endet nach 55 Zeichen) auf 78 Zeichen samt `   * `
  neu umbrechen, Wörter unverändert. Sonst nichts in der Datei.

## Proben für Zug 2 (zusätzlich zu `pnpm run ci`)

Probe 1 — Breite. Aus dem Repo-Root:

```bash
for f in README.md packages/twopoint5d/README.md packages/twopoint5d/README-pkg.md \
  packages/twopoint5d/docs/architecture.md packages/twopoint5d/docs/resource-lifecycle.md AGENTS.md; do
  perl -CSD -ne 'print "$ARGV:$.: ", length($_)-1, "\n" if length($_)-1 > 88' "$f"; done
for f in apps/lookbook/README.md docs/architecture.md; do
  perl -CSD -ne 'print "$ARGV:$.: ", length($_)-1, "\n" if length($_)-1 > 90' "$f"; done
```

Erwartet genau: `README.md` `:3`, `:12`, `:19`, `:20` (HTML-Kopf) · `README-pkg.md:5`
(Bild) · `AGENTS.md` `:15`, `:16`, `:18` (Tabelle) · `docs/architecture.md` `:15`, `:17`
(Tabelle) und die Codezeile »clean → lint → build → …« in §3 (heute `:85`, nach Schritt 9
vielleicht eine Zeile weiter). Nichts aus `apps/lookbook/README.md`.

Probe 2 — nur umbrochen, nichts umformuliert. Aus dem Repo-Root:

```bash
git diff --word-diff=porcelain --word-diff-regex='[^[:space:]*>]+' -- <datei> \
  | grep -E '^[-+]' | grep -vE '^(---|\+\+\+) '
```

Leer für `apps/lookbook/README.md` und `packages/twopoint5d/src/stage/StageRenderer.ts`.
In den übrigen Dateien zeigt sie genau die Ersetzungen und Einfügungen der Schritte 1–11
(die umgestellten Codezeilen aus Schritt 3 und 7 eingeschlossen), sonst nichts.

Mutationsprobe — der neue Block wird wirklich geprüft: im README-Block `sprite.setTexCoords`
zu `sprite.setTexCoord` ändern, `pnpm nx run twopoint5d-testing:typecheck` muss rot werden
(TS2551), zurückändern. Der grüne Lauf danach meldet `19 blocks marked "ts check" in 4
files, 0 errors` (vor dem Paket 18 in 3).

## Für Zug 5

- In »Offene Befunde« abhaken: `packages/twopoint5d/README.md:60` und
  `apps/lookbook/README.md:9`, je mit »erledigt in <hash>«.
- `Schnittstellen:` — `README.md` hat den Abschnitt `## Usage` (Anker `#usage`), auf den
  `packages/twopoint5d/README-pkg.md` (absolut) und `packages/twopoint5d/README.md`
  (relativ) verweisen; sein `ts check`-Block ist einer der 19 · Root- und Library-README,
  `README-pkg.md`, `packages/twopoint5d/docs/*.md` und `AGENTS.md` bei ≤ 88 Zeichen
  (Tabellenzeilen, HTML-Kopf und Bildzeile ausgenommen) — gilt für jede spätere Änderung
  dort · `description` im Library-Manifest: »… with three.js and WebGPU«.

## Entscheidungen dieses Zugs

- **Folgen aus Paket 10 hierher statt Nachtragspaket.** Beide sind Doku um den Code von
  6861f3d0, der steht (Reviewer-Urteil in `paket-10.md`); offen ist nur die Prosa daneben —
  ein README-Satz, der die werfende Host-Abmeldung bei `dispose()` nicht nennt, und ein
  ausgefranster TSDoc-Absatz. Paket 8 bringt die Library-Doku auf den Code-Stand und bricht
  um, trägt also dieselbe Ursache; so ist Zug 0 Paket 5 mit den Doku-Folgen aus Paket 4
  verfahren. Ein Nachtragspaket für zwei Doku-Zeilen wäre die dritte Generation der Kette
  6 → 10, ohne dass der Weg von Paket 6 oder 10 in Frage stünde.
- **Queue `apps/lookbook/README.md:9` hierher.** Dieselbe Ursache wie DOC-070 (ein Absatz,
  der nach einer Änderung nicht neu umbrochen wurde), dieselbe Datei; der Absatz `:8–12`
  wird mit dem Umbruch ohnehin neu gefüllt.
- **`description` im Manifest hierher.** Dieselbe Ursache wie DOC-025: konsumentenseitiger
  Text, der eine WebGL-Library beschreibt; »with WebGL and three.js« liest ein Konsument als
  Einladung zum `WebGLRenderer`, den `Display` mit einem `TypeError` abweist.
- **Umbruch aller berührten Docs auf 88** statt nur der Finding-Zeilen: die Zeilen über 88 in
  Library-Architektur, `AGENTS.md` und den READMEs haben dieselbe Ursache wie DOC-067 und
  READ-025 (Absätze, die nach Änderungen nicht neu umbrochen wurden); Paket 4 hat die
  `AGENTS.md`-Zeilen ausdrücklich hierher verwiesen.
- **Tippfehler `packages/twopoint5d/README.md:35` in die Queue**, nicht ins Paket: eigene
  Ursache (Rechtschreibung), `→ Scope`.
- **Abweichung von der Audit-Empfehlung zu DOC-025:** das Beispiel hat rund 40 statt 15
  Zeilen (Resize und Dispose gehören dazu), und `README-pkg.md` bekommt die Install-Zeile
  mit, weil Konsumenten die ersten fünf Minuten auf npm verbringen, wo das Root-README nicht
  erscheint.
- **Abweichung zu DOC-060:** die README-Stelle `:60` nennt eventize schon; offen war nur die
  Peer-Liste. Statt sie in `display/` zu wiederholen, verweist der Punkt auf Usage.

## Findings im Volltext

**DOC-025 · medium · README.md:28-38** — Die ersten fünf Minuten des Konsumenten ins README
schreiben
Das einzige `install` im README ist das `pnpm install` des Contributors. Es gibt kein
`npm i @spearwolf/twopoint5d three @spearwolf/eventize @spearwolf/signalize` (drei Peers, die
der Konsument selbst installieren muss), kein Import-Snippet, keinen Hinweis auf
`three/webgpu` / TSL, obwohl jede Demo daraus importiert, und die Prosa beschreibt weiter eine
WebGL/GLSL-Bibliothek (»custom vertex shader«, »WebGL API«), während die Paket-Keywords
`webgpu` sagen. Das npm-README ist neun Zeilen, die hierher zurückverweisen. Scripts und
Befehle in README und AGENTS.md sind korrekt (gegen package.json geprüft).
Empfehlung: Ein »Usage«-Abschnitt: Install-Zeile mit Peers, ein 15-Zeilen-Beispiel `Display`
+ `TexturedSprites`, ein Satz zu WebGPURenderer mit WebGL-Fallback, Link auf die Lookbook und
`src/stage/README.md`; die zwei WebGL-Sätze auffrischen.

**IMPL-001 · low · packages/twopoint5d/docs/architecture.md:34** (auch `:116`) —
Schichtbild und Material-Angabe in der Library-Architektur-Doku an den Code angleichen
Das Schichtbild in §2 zeichnet `utils/` in die oberste Reihe und sagt dazu »A lower layer
never imports from a higher one«. Im Code ist `utils/` die unterste Schicht:
`vertex-objects`, `texture`, `stage`, `map2d` und `controls` importieren daraus (z. B.
`vertex-objects/initializeAttributes.ts` → `../utils/expectDefined.js`), `utils/` selbst
importiert nichts. Wer das Bild wörtlich nimmt, hält jeden dieser Imports für einen
Schichtbruch. Dazu nennt der Abschnitt `sprites/` die Materialien `ShaderMaterial`, während
`TexturedSpritesMaterial` und `TileSpritesMaterial` von `NodeMaterial` erben und im
Quelltext kein `ShaderMaterial` mehr vorkommt.
Beleg: `controls/  utils/          (input, helpers — no rendering state)` über
`vertex-objects/   the buffer core everything else stands on`
Empfehlung: `utils/` im Schichtbild unter `vertex-objects/` setzen (oder als querliegende
Basis kennzeichnen) und in §2 `sprites/` »`NodeMaterial` (TSL)« statt `ShaderMaterial`
schreiben.

**DOC-060 · low · packages/twopoint5d/docs/architecture.md:87-88** (auch `:105`,
`packages/twopoint5d/README.md:60`) — Architektur-Doku und Library-README auf den WebGPU- und
NodeMaterial-Stand bringen
Die Doku nennt »WebGL or WebGPU«, `Display` weist einen `WebGLRenderer` aber ab. Sie spricht
von `ShaderMaterial`, die Sprite-Materialien erben jedoch von `NodeMaterial`. Laut README hat
display »no other dependency than the three.js package«, tatsächlich importiert es
`@spearwolf/eventize` an sechs Stellen.
Empfehlung: Die drei Stellen korrigieren.

**DOC-034 · low · packages/twopoint5d/docs/resource-lifecycle.md:5-6** — Die
Abschnittsverweise in resource-lifecycle.md richtigstellen
Die Einleitung nennt »section 7 the checklist, section 8 the tests«, Zeile 55 »Assertion (f)
in section 8«. Das Dokument hat nur §1–§7: die Checkliste ist §6, das Testmuster §7. Die
Datei ist die verbindliche Regel für jedes neue `dispose()` (AGENTS.md verweist darauf).
Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: »Section 6 is the checklist, section 7 the tests«; »Assertion (f) in section 7«.

**DOC-067 · low · packages/twopoint5d/docs/resource-lifecycle.md** — resource-lifecycle.md
hat 11 Zeilen über der Zeilenlänge von 88 Zeichen
Aufgefallen im Remediation-Lauf vom 2026-09-21. 11 Zeilen sind länger als 88 Zeichen
(`awk 'length>88'`). Die übrigen Architektur-Dokumente sind auf 88 Spalten umbrochen.
Empfehlung: Die Datei auf 88 Spalten umbrechen.

**READ-025 · info · packages/twopoint5d/docs/architecture.md:93** — Vorzeitiger
Zeilenumbruch im Absatz zu geteilten Descriptoren in architecture.md
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Die Zeile endet nach 62
Zeichen, die Nachbarzeilen bei rund 95 — kosmetischer Umbruch im Markdown-Quelltext.
Empfehlung: Den Absatz neu umbrechen.

**DOC-059 · info · packages/twopoint5d-testing/package.json:11** — Dass das
Browser-Testpaket private ist, steht in keiner Doku
Aufgefallen im Remediation-Lauf vom 2026-09-21, kleiner Befund des Reviewers.
`"private": true` schützt das reine Testpaket vor einem versehentlichen Publish; weder
`AGENTS.md` noch `docs/architecture.md` noch das README nennen das.
Empfehlung: Einen Satz in `docs/architecture.md` (Abschnitt zum Testpaket oder zum Publish)
ergänzen.

**DOC-070 · info · AGENTS.md:45** (auch `apps/lookbook/README.md:56`) — Zwei neu umbrochene
Absätze lassen ein einzelnes Wort auf einer eigenen Zeile stehen
Aufgefallen im Remediation-Lauf vom 2026-09-25. Nach dem Umbruch langer Zeilen steht in
`AGENTS.md` das Wort `whether` und in `apps/lookbook/README.md` `lookbook and` allein auf
einer Zeile vor der unveränderten Nachbarzeile. Reine Optik, Lint ist grün.
Empfehlung: Beide Absätze durchgehend bei rund 90 Zeichen neu umbrechen.
(Die `AGENTS.md`-Hälfte ist in 5a413417 erledigt; hier bleibt die Lookbook-README.)

**DOC-076 · info · AGENTS.md:114** — »for it« in AGENTS.md verliert seinen Bezug
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Der eingefügte Absatz zu
Bruchwerten in Messrunden steht zwischen dem Satz zu `measureSettledBytes()` und »The Vitest
config starts its workers with `--expose-gc` for it«; »for it« bezieht sich jetzt auf den
eingefügten Satz statt auf `measureSettledBytes()`.
Empfehlung: Den Satz hinter »never reaches `dist/`« setzen oder »for it« ausschreiben (»for
`measureSettledBytes()`«).

## Reviewer-Urteil (Zug 3 und Runde 1)

Erfüllung, je mit Fundstelle im Stand d05f0422:

- DOC-025 behoben — `README.md` Abschnitt `## Usage` (`:83–137`, Zieltext wörtlich, `ts
  check`-Block kompiliert, Mutationsprobe rot); Introduction `:32`, `:34`, `:36`, `:38`
  ersetzt; `packages/twopoint5d/README-pkg.md:7–15` Install-Zeile, Peers, absoluter Link;
  `packages/twopoint5d/package.json:3` »with three.js and WebGPU«
- IMPL-001 behoben — `packages/twopoint5d/docs/architecture.md:33–47` utils/ unten,
  Reihenfolge gegen die Imports geprüft; `NodeMaterial`/TSL statt `ShaderMaterial`
- DOC-060 behoben — Display-Absatz in `packages/twopoint5d/docs/architecture.md` (Schritt c);
  `packages/twopoint5d/README.md` Punkt zu `display/` verweist auf `../../README.md#usage`
- DOC-034 behoben — `resource-lifecycle.md` »Section 6 … section 7«, »Assertion (f) in
  section 7«
- DOC-067 behoben — `resource-lifecycle.md` auf 88; über 88 nur `:68` (129) und `:290` (96),
  Markdown-Links mit Codespan, nach der Umbruchregel untrennbar
- READ-025 behoben — Absatz zu geteilten Descriptoren und die Regeln neu gefüllt
- DOC-059 behoben — `docs/architecture.md:348–350` Satz zu `"private": true`
- DOC-070 behoben — `apps/lookbook/README.md` `:8–12` und `:63–67` auf 90, »lookbook and«
  nicht mehr allein
- DOC-076 behoben — `AGENTS.md:142–143` direkt hinter `measureAllocatedBytes()`, »for these
  two helpers«
- Zusatzposten: Queue `packages/twopoint5d/README.md:60` behoben · Folgen aus Paket 4
  (`docs/architecture.md` »any tracked Markdown file«, §6-Absatz) behoben · Folgen aus
  Paket 10 (Stage-README `dispose()`-Punkt, `add()`-TSDoc auf 78) behoben · Queue
  `apps/lookbook/README.md:9` behoben · `description` behoben · Umbruch aller berührten Docs
  behoben

Kleine Befunde:

- `packages/twopoint5d/docs/architecture.md:44` »each of them takes its helpers from there«
  war falsch (Zieltext aus Zug 0) — vom Orchestrator als `wichtig` eingestuft, weil es eigene
  Doku ist, die über den Code lügt; in Runde 1 behoben (»any of them may take«)
- Library-README `:44`/`:50` Shader/WebGL-Wortlaut — vorbestehend, in die Queue (low → Scope)

Nebenbefunde des Implementierers, Urteile: Library-README `:44`/`:50` → Queue (dieselbe wie
oben); »browser/WebGL« in `AGENTS.md:16`, `:107`, `docs/architecture.md:15` → Queue (info;
beschreibt die Testumgebung ungenau); `docs/architecture.md:52–55` ausgefranst → Queue
(info); Stage-README Prosa über 90 ab `:556` → Queue (info). Nicht in die Queue:
`StageRenderer.ts:1134` u. a. (TSDoc und Kommentare über 78) — die Datei hält ihre
TSDoc-Blöcke bei bis zu 100 Zeichen (so auch die Regel in Paket 10), die gemeldeten Zeilen
liegen darunter oder sind Code, den Prettier formatiert; kein Befund.
Abweichung vom Detailplan: Probe 1 meldet zusätzlich `resource-lifecycle.md:68`, `:290`
(untrennbare Links, schon vorher über 88) — die Umbruchregel geht vor, der Reviewer
bestätigt.
