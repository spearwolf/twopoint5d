# Paket 25 — Drain 3: Prosa der Markdown-Doku — Umbrüche, Wortlaut, fehlende Angaben

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (26 »klein«-Befunde der Reviewer und Abweichungen aus den committeten Paketen,
  überführt in der Drain-Runde 3, Entscheidung »Drain-Runde 3« im Plan; Wortlaut und Abgleich
  unten). Dazu aus Zug 0: eine falsche Aussage über Mip-Stufen (Folge von Paket 19) und alle
  übrigen Prosazeilen der Doku, die ihren Umbruch sprengen (gleiche Ursache, Begründung unten)
- Folge von: Paket 19 (nur der Teil »Mip-Stufen einer `nearest`-Textur«; die Reviewer-Befunde nicht)
- Ziel: Jede Prosazeile der Markdown-Doku, die den Umbruch ihrer Datei sprengt — die genannten
  Stellen der Reviewer, die übrigen aus diesem Lauf und die vorbestehenden, die Zug 0 gemessen
  hat —, steht im Umbruch ihrer Datei (90 bzw. 100 Spalten), und die genannten Sätze sagen genau,
  was der Code tut: die Blattgrenze von `subdivide()`, ±Infinity im CHANGELOG, `generateMipmaps`
  und das Lesen der Mip-Stufen in `textures.md` und `MothChapel.ts`, die Ownership des Pickers,
  »renders« statt »starts a renderer«, der Audit-Satz in §5 und »the first four«.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `AGENTS.md`, `docs/architecture.md`
  - `packages/twopoint5d/docs/`: `architecture.md`, `display.md`, `map2d.md`,
    `resource-lifecycle.md`, `sprites.md`, `stages.md`, `text.md`, `textures.md`
  - `packages/twopoint5d/docs/proposals/`: `animation-playback-and-aseprite.md`,
    `display-fullscreen.md`, `gpu-picking.md`, `pipeline-stages-and-grid-base.md`,
    `sprite-visibility.md`, `stage-masks.md`, `wave-and-segment-sprites.md`
  - `packages/twopoint5d/CHANGELOG.md` (nur Zeile `:62` unter `## [Unreleased]`)
  - `apps/lookbook/assets-src/README.md`
  - drei Code-Kommentare: `packages/twopoint5d-testing/web-test-runner.config.js:213-214`,
    `packages/twopoint5d-testing/test/helpers/fixtures.js:39-40`,
    `apps/lookbook/src/demos/stage-masks/MothChapel.ts:146-148`
  - sonst nichts: kein Library-Code, keine Specs, keine Überschrift, kein Anker, kein Codeblock,
    kein `ts check`-Block, keine Tabelle, kein neuer CHANGELOG-Eintrag
- Verify: `pnpm run ci`
- Commit: `docs: reflow the prose that runs past the width of its file and say which leaf of a quad tree keeps more chunks, which refused numbers read anew, what a picker owns and that a texture with two nearest filters reads level 0 alone`

## Regeln für jede Zeile

- Englisch, im Ton des umgebenden Textes. Keine Finding-IDs, keine Paketnummern, kein Rückblick
  (»no longer«, »now«, »used to«).
- **Breite.** `AGENTS.md`, `docs/architecture.md` und `packages/twopoint5d/docs/resource-lifecycle.md`
  umbrechen bei **90** Spalten, jede andere Markdown-Datei dieses Pakets bei **100**. Ein
  Listenpunkt behält seinen Einzug (zwei Leerzeichen, drei unter einer Ziffer). Länger darf eine
  Zeile nur sein, wenn ein einzelnes Stück ohne Leerzeichen es erzwingt (ein Link-Ziel, ein
  Code-Span ohne Leerzeichen); Linktext und Alt-Text eines Bildes dürfen an einem Leerzeichen
  umbrechen, ein Link-Ziel nie.
- **Neu umbrechen** heißt: von der ersten Zeile der genannten Stelle an die Zeilen bis zur Breite
  füllen, und zwar bis der neue Umbruch wieder auf einen bestehenden Zeilenumbruch trifft oder der
  Absatz bzw. Listenpunkt endet. Kein Absatz endet mit einer Kurzzeile mitten im Text; eine kurze
  letzte Zeile am Absatzende ist in Ordnung. Wo ein Absatz Links oder Pfade bewusst einzeln je
  Zeile führt (`resource-lifecycle.md:17-24`, `docs/architecture.md:530-533`), bleibt diese Liste
  stehen und nur der Fließtext davor und danach wird umbrochen.
- **Ausgenommen**, bleiben wie sie sind: Überschriften, Tabellenzeilen, Codeblöcke, HTML, und eine
  Zeile, die nur einen zitierten Meldungstext oder eine Formel in einem Code-Span trägt (auch mit
  `>`, Listeneinzug oder Satzzeichen davor und danach) — so zitiert die Doku Meldungen, eine je
  Zeile. Ebenso eine Zeile, die nur aus einem Link besteht (`resource-lifecycle.md:81`).
- **Reiner Umbruch ändert kein Wort.** Nach der Arbeit muss
  `git diff --word-diff=porcelain -- '*.md' | grep '^[-+][^-+]'` genau die Wortänderungen
  zeigen, die unten unter »Wortlaut« stehen, und keine weitere.
- **Messung danach.** Diese Schleife muss nur noch ausgenommene Zeilen melden (Meldungs-,
  Formel- und Linkzeilen; die Nummern verschieben sich mit dem Umbruch):

  ```bash
  scan() { w=$1; shift; for f in "$@"; do awk -v f="$f" -v w="$w" '/^ *(```|~~~)/{c=!c; next} c{next} /^ *\|/||/^#/||/^ *</{next} /^    [^-*0-9 ]/{next} length($0)>w {print f":"NR" ("length($0)")"}' "$f"; done; }
  scan 95 AGENTS.md docs/architecture.md packages/twopoint5d/docs/resource-lifecycle.md
  scan 105 $(git ls-files 'packages/twopoint5d/docs/*.md' 'packages/twopoint5d/docs/**/*.md' | grep -v resource-lifecycle) apps/lookbook/assets-src/README.md
  ```

  Heute meldet sie 67 Zeilen; danach genau die 30 ausgenommenen: `resource-lifecycle.md:81`,
  `proposals/atlas-frame-sampling.md:142`, `proposals/display-fullscreen.md:448` (ein Code-Span
  aus CSS), `proposals/dynamic-atlas-and-bitmap-text.md:150`, `:218`, `:220`, `:244`, `:247`,
  `:416`, `:595`, `:598`, `proposals/flip-anchor-nine-slice.md:280`, `:283`, `:291`, `:340`,
  `:343`, `:346`, `:355`, `proposals/growing-capacity.md:109`, `:116`, `:133`,
  `proposals/pipeline-stages-and-grid-base.md:276` (Rest einer zitierten Meldung), `:443`,
  `proposals/pool-sorting.md:78`, `:92`, `:233`, `proposals/table-frames-and-palette-swap.md:222`,
  `:332`, `proposals/wave-and-segment-sprites.md:276`, `sprites.md:1005`. Zusätzlich hält jeder
  Absatz, den dieses Paket anfasst, die Breite 90 bzw. 100 genau ein — auch die Zeilen zwischen
  91 und 105, die die Schleife nicht meldet.

## Vorgehen

Zeilenangaben gegen den Stand von `dddfd7fd`. Wo »Wortlaut« steht, ist der neue Text vorgegeben —
genau so übernehmen und danach neu umbrechen; sonst nur neu umbrechen.

### `AGENTS.md` (Breite 90)

1. `:59-72` (Punkt `pnpm test:scripts`; `:60` hat 119 Zeichen, `:64` 32): neu umbrechen.
2. `:118-148` (Regel »Error and warning messages«; `:130` 58, `:133` 93, `:137` 73, `:144` 12,
   `:145` 50 Zeichen): den ganzen Listenpunkt neu umbrechen. »A three.js object refused for its
   class is named by its `type` …« läuft im Absatz weiter und beginnt keine eigene Zeile, wenn der
   Umbruch es nicht so ergibt.
3. `:197-200` (Punkt »Two test surfaces«; `:198` 101, `:200` 109): neu umbrechen.
4. `:266-272` (Punkt »The guides of the library«; `:270` 127): neu umbrechen; die Links dürfen am
   Leerzeichen ihres Linktextes brechen, wie `:267-268` es schon tun.

### `docs/architecture.md` (Breite 90)

5. `:173-189` (Punkt `test:scripts`; `:179` 119): neu umbrechen.
6. `:247-263` (§3, die Browser-Suite; `:247` 109). **Wortlaut:** »The browser suite runs every
   test file that starts a renderer in four browsers« → »The browser suite runs every test file
   that renders in four browsers«. Grund: eine Datei in `RENDERER_FREE_FILES` startet ihren
   Renderer auch (`renderer.init()` im Konstruktor von `Display`, `web-test-runner.config.js:84-88`),
   rendert aber nicht. Dann neu umbrechen.
7. `:380-386` (`:384` 127): neu umbrechen.
8. `:463-469`. **Wortlaut:** »In the library the four first are `peerDependencies`« → »In the
   library the first four are `peerDependencies`«. Danach `:467-469` neu umbrechen, falls nötig.
9. `:481-495` (Dependabot und Overrides; `:483` 96, `:484` 40, `:491-495` 91–94): neu umbrechen.
   **Wortlaut** des letzten Satzes `:494-495`: »`pnpm audit` leaves it out, and with it the audit
   step of CI (§3) and the audit filter of the deploy (§4).« → »`pnpm audit` leaves it out, and so
   do the audit step of CI (§3) and the audit filter of the deploy (§4); both act on a `high` or
   `critical` advisory alone, so an entry of lower severity quiets a plain `pnpm audit` and changes
   nothing there.« Beleg: `.github/workflows/ci.yml:99` (`pnpm audit --audit-level=high`, Warnung
   nur bei Exit ≠ 0), `docs/architecture.md:434-435` (der Deploy hält bei high oder critical).
10. `:506-508` (Schritt 3 der three-Hebung; `:507` 93): vor der Klammer `` (`git grep …`) ``
    umbrechen, sodass keine Zeile über 90 läuft; der Code-Span bleibt ganz.
11. `:526-529` (»The repo runs two TypeScripts.«; `:527` 145): neu umbrechen bis »so the scripts
    that need one —«; die vier Pfade `:530-533` bleiben je eine Zeile.
12. `:569-576` (Punkt `@web/test-runner`; `:572` 151): neu umbrechen.

### `packages/twopoint5d/docs/resource-lifecycle.md` (Breite 90)

13. `:25-36` (`:31` 137): neu umbrechen; die Linkliste `:17-24` bleibt.

### `packages/twopoint5d/docs/` — Guides (Breite 100)

14. `architecture.md:7-10` (`:9` 113): neu umbrechen.
15. `display.md:9-11` (Alt-Text des Bildes; `:11` 109): den Alt-Text so umbrechen, dass die Zeile
    mit `](images/display/display-setups-on-a-phone.svg)` höchstens 100 Zeichen hat.
16. `display.md:513-518` (`:515` 101): neu umbrechen.
17. `display.md:600-607` (das Video auf dem Ziel; `:605` 75, das holprige »—,«). **Wortlaut** des
    Mittelteils, von »Once it is left« bis »and `dispose()` leaves it.«:
    »Once it is left, the fullscreen is the display's again, as before: `exitOnPortrait` acts on
    the next turn, and `dispose()` leaves it. A `request()` the page calls while the video lies on
    top makes the fullscreen the page's, and a turn upright keeps it, as it keeps one of
    `onLandscape` the page has called `request()` on (see "Fullscreen when the phone turns
    sideways").« Der Satz »A turn while the video lies on top is not caught up afterwards: …« folgt
    unverändert. Beleg: `src/display/DisplayFullscreen.ts:646-649` (`#entered` wird `'request'`),
    `:586-588` (`dispose()` verlässt einen Fullscreen mit gesetztem `#entered`, solange das Ziel oben
    liegt), Guide `:516-517`. Dann neu
    umbrechen.
18. `map2d.md:176-179`. **Wortlaut:** »`subdivide(maxChunkNodes)` leaves up to that many chunks in a
    leaf, 2 unless given, and splits a row or a column of chunks as well as a block of them.« →
    »`subdivide(maxChunkNodes)` splits a leaf that holds more than that many chunks, 2 unless given,
    as long as an axis separates them, and splits a row or a column of chunks as well as a block of
    them. Chunks that no axis separates stay in one leaf however many they are, and a chunk that
    crosses an axis stays at the node of that axis.« Beleg: `ChunkQuadTreeNode.ts:259` (Abbruch bei
    `length <= maxChunkNodes`), `:264` (keine Achse → Blatt bleibt), `:274-300` (Straddler bleiben
    am Knoten). Dann neu umbrechen.
19. `map2d.md:255` (Tabelle, nur die dritte Zelle). **Wortlaut:** »the most chunks a leaf keeps;
    a query tests …« → »the most chunks a leaf keeps while an axis separates them — chunks that none
    separates stay in one leaf; a query tests …«; der Rest der Zelle unverändert. Die Tabellenzeile
    wird nicht umbrochen.
20. `map2d.md:351-353` (`:352` 115): neu umbrechen.
21. `sprites.md:484-488` (`:486` 108), `:586-591` (`:589` 154), `:1204-1212` (`:1211` 52),
    `:1609-1613` (`:1613` 145), `:1804-1810` (`:1807` 130), `:1951-1955` (`:1954` 127): neu
    umbrechen.
22. `sprites.md:1181-1187` (»Uploads«; `:1182` 101). **Wortlaut** der ersten beiden Sätze: »A mesh
    draws none of its sprites before its first `update()`, and `update()` sets how many it draws.
    `update()` of the mesh uploads what the sprite pool marked.« → »A mesh draws none of its sprites
    before its first `update()`. Each `update()` of the mesh uploads what the sprite pool marked and
    sets how many sprites it draws.« Dann neu umbrechen.
23. `stages.md` (alle neu umbrechen): `:184-187` (`:187` 110; der Linktext darf brechen),
    `:514-515` (`:514` 106), `:532-534` (`:532` 111), `:675-679` (`:678` 114), `:797-804` (`:802`
    149), `:806-812` (`:811` 102), `:1414-1418` (`:1417` 126; der Linktext darf brechen),
    `:1478-1483` (`:1482` 106, `:1483` 111).
24. `text.md:174-180` (`:177` 107): neu umbrechen.
25. `textures.md:88-91`. **Wortlaut** des ganzen Punktes:
    »- A texture of data — ids, a palette, a lookup table — names `nearest` and `no-mipmaps`. With
    both filters `NearestFilter`, three.js reads level 0 alone, under WebGPU and under WebGL 2, so
    the mip levels it builds for every texture unless told otherwise only take memory; under WebGPU
    a texture that three.js samples with a linear filter reads them when drawn smaller, even with a
    `minFilter` that names no mip levels (the sampler takes its `mipmapFilter` from `minFilter`).
    Without mip levels every texture reads level 0.«
    Beleg in three 0.187.0 (`node_modules/.pnpm/three@0.187.0/node_modules/three/src/`):
    `renderers/webgpu/nodes/WGSLNodeBuilder.js:857-865` (`isUnfilterable()`: beide Filter
    `NearestFilter` → ungefiltert), `:878-890` (`generateTexture()` liest eine ungefilterte Textur
    mit `textureLoad` auf Level `0`, ohne Sampler), `:915` (`generateTextureGrad()` ebenso);
    `renderers/webgpu/utils/WebGPUTextureUtils.js:176` und `:1304-1314` (`mipmapFilter` aus
    `minFilter`, `'nearest'` für jeden Filter ohne `MipmapLinear`); unter WebGL 2 bleibt
    `NearestFilter` `gl.NEAREST` (`renderers/webgl-fallback/utils/WebGLTextureUtils.js:98`, `:359`).
    Dann neu umbrechen.
26. `textures.md:101-103` (»What is left alone.«). **Wortlaut:** »An option that no class names
    keeps the value of the texture: `update()` without a wrap class leaves `wrapS` and `wrapT` as
    they are, and a new texture keeps the `ClampToEdgeWrapping` of three.js.« → »An option that no
    class names keeps the value of the texture: `update()` without a wrap class leaves `wrapS` and
    `wrapT` as they are, and one without a mipmap class leaves `generateMipmaps`; a new texture keeps
    the `ClampToEdgeWrapping` and the `generateMipmaps = true` of three.js.« Beleg:
    `src/texture/TextureFactory.ts:46-48`. Dann neu umbrechen.
27. `textures.md:217-219` (`:217` 124), `:564-570` (`:568` 101): neu umbrechen.

### `packages/twopoint5d/docs/proposals/` (Breite 100)

28. `animation-playback-and-aseprite.md:419-424` (`:422` 102): neu umbrechen; der Code-Span der
    Meldung `:421-422` läuft schon über zwei Zeilen und darf an einem seiner Leerzeichen brechen.
29. `display-fullscreen.md:373-377` (`:374` 50, »happened« am Anfang von `:375`): neu umbrechen.
30. `display-fullscreen.md:385-412` (§6.3, alle drei Punkte; `:392` 157, `:393` 102, `:395` 101,
    `:406` 150, `:410` 39). **Wortlaut** in »The user leaves«, `:404-407`: »For an `exit()` of the
    page the screen at the call decides, not the screen once the browser answers — also for one that
    joins the exit of the turn to portrait or a pending request — of the turn, of the armed tap or of
    the page: called in landscape it holds off the arming, whatever the browser answers; called in
    portrait it does not, however quickly the screen turns back.« → »For an `exit()` of the page the
    screen at the call decides, not the screen once the browser answers, also for an exit that joins
    the exit of the turn to portrait or a pending request of the turn, of the armed tap or of the
    page. Called in landscape it holds off the arming, whatever the browser answers; called in
    portrait it does not, however quickly the screen turns back.« Dann alle drei Punkte neu
    umbrechen.
31. `display-fullscreen.md:600-607` (`:606` 102): neu umbrechen.
32. `gpu-picking.md:19-20` (`:19` 101): neu umbrechen.
33. `gpu-picking.md:286-288` (»Ownership«). **Wortlaut:** »The picker owns its target, its scene,
    its camera, its pick meshes and pick materials. A pick material borrows the resources of its
    mesh and does not release them.« → »The picker owns its target, its scene and its camera, and
    for every mesh it has drawn a pick mesh, its pick material, the `Group` the pick mesh lies in and
    a mirror of each `ClippingGroup` above the sprites (§3.2). A pick material borrows the resources
    of its mesh and does not release them; the group and the mirrors have nothing to release and
    leave the scene of the pick with their pick mesh.« Beleg: `src/sprites/SpritePicker.ts:101-120`
    (`PickEntry` mit `holder` und `clipping`), `:446-455` (`#release()` nimmt die Kette aus der
    Szene, `dispose()` von Mesh und Material). Dann neu umbrechen.
34. `pipeline-stages-and-grid-base.md:176-185` (`:184` 50, »Frozen all the way down, its
    description and the«): neu umbrechen.
35. `sprite-visibility.md:189-192` (`:190` 115): neu umbrechen.
36. `stage-masks.md:5` (123): zwischen den beiden Links umbrechen; `:183-185` (`:184` 124),
    `:276-278` (`:276` 108), `:285-289` (`:287` 125): neu umbrechen.
37. `wave-and-segment-sprites.md:411-419` (§4.3, Punkt »Mipmaps«; `:412` 78, `:417` 75, `:419`
    24). **Wortlaut:** »It reads the one filter test the key holds — both filters `NearestFilter`,
    which read level 0 alone, so that gradients change nothing there — and takes gradients for every
    other texture.« → »It reads the one filter test the key holds, whether both filters are
    `NearestFilter`, and takes gradients for every texture that fails it; a texture that passes
    reads level 0 alone, so gradients would change nothing there.« Dann den Punkt neu umbrechen.

### `packages/twopoint5d/CHANGELOG.md`

38. `:62` (unter `## [Unreleased]`, `### Changed`, der Eintrag »the `RangeError` of a refused number
    reads alike …«). **Wortlaut:** »and for `NaN` or a value that is no number at the measures of a
    frame« → »and for a value that is no finite number — `NaN`, `Infinity`, `-Infinity` or no number
    at all — at the measures of a frame«. Grund: `assertFinite()` meldete »must be a finite number«
    für jeden nicht endlichen Wert, `assertFiniteAtLeast()` meldet »a finite number of 0 or more«
    (`src/utils/assertFinite.ts`, `src/utils/assertFiniteAtLeast.ts`), also ändert sich die Meldung
    auch für ±Infinity. Der Eintrag bleibt eine Zeile — die CHANGELOG-Einträge werden nicht umbrochen.

### `apps/lookbook/assets-src/README.md` (Breite 100)

39. `:164-169` (Absatz »`kick`, `flying-kick` and `hit` are one-shots«; `:165` 133): neu umbrechen.
40. `:614-626` (Crawlspace; `:620` 25, `:625` 103): neu umbrechen.

### Code-Kommentare

41. `packages/twopoint5d-testing/web-test-runner.config.js:213`. **Wortlaut:** »// Every test file
    that starts a renderer runs under all four launchers;« → »// Every test file that renders runs
    under all four launchers;«; die Kommentarzeilen `:213-218` danach neu umbrechen, keine über 100.
42. `packages/twopoint5d-testing/test/helpers/fixtures.js:40`. **Wortlaut:** »and a test file that
    starts a renderer runs under every one of them.« → »and a test file that renders runs under
    every one of them.«
43. `apps/lookbook/src/demos/stage-masks/MothChapel.ts:146-148`. **Wortlaut** des Kommentars:
    ```ts
        // the ids of the panes are numbers, not colours: never blended, and without an anisotropy
        // class the texture has none. With both filters NearestFilter three reads level 0 alone, so
        // mip levels of the ids would only take memory
    ```
    Die Zeile `panes: {imageUrl: 'panes.png', texture: ['nearest', 'no-mipmaps']},` bleibt. Grund:
    der Kommentar begründete `no-mipmaps` mit einem Sampler, der unter WebGPU Mip-Stufen läse —
    three liest eine Textur mit zwei `NearestFilter` ohne Sampler auf Level 0 (Beleg wie Schritt 25).

### Zum Schluss

44. Die Messung aus »Regeln« laufen lassen und gegen die Liste der 30 Ausnahmen halten;
    `git diff --word-diff=porcelain` gegen »Wortlaut« halten. Beide Ausgaben gehören in den Report.
45. `pnpm run ci`.

Kein Regressionstest: das Paket ändert keine Zeile Verhalten — Doku, CHANGELOG-Wortlaut und drei
Kommentare.

- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · 25 der 26 Stellen bestehen (15 unverändert, 10 verschoben,
    Stand je Stelle unter »Abgleich«), `display.md:507` gegenstandslos (Paket 23 hat den Absatz
    neu umbrochen, jetzt ≤ 99) · dazu: `textures.md:88-91` und `MothChapel.ts:146-148` als Symptom
    von Paket 19 (falsche Begründung für `no-mipmaps`), 9 weitere laufbedingte Stellen und 20
    vorbestehende Zeilen derselben Ursache · offene Folgen: keine unverteilten (alle `Folgen:`-Zeilen der
    Pakete 1–24 verteilt oder »keine«), »Offene Befunde« leer · Restplan 26–28 unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt (sonnet, effort low), Report `paket-25.impl-0.json`
  - 2026-11-01 Zug 2: FERTIG · 22 Dateien geändert · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-25.verify.log`)
  - 2026-11-01 Zug 3: Reviewer (sonnet, low): alle Schritte erfüllt, kritisch/wichtig keine, klein: Kurzzeilen am Absatzende nur stichprobenartig geprüft; »no longer exists« in `+`-Zeile ist zitierter externer Fehlertext, kein Rückblick · Diff `paket-25.diff`
  - 2026-11-01 Zug 4: keine Runde nötig
  - 2026-11-01 Zug 5: committet 5edbc74f · Nebenbefund (Überlängen außerhalb der berührten Absätze, 9 Zeilen) → Offene Befunde, Urteil → Audit

## Abgleich

Die 26 Stellen aus dem Plan, im Wortlaut der Überführung, mit ihrem Stand an `dddfd7fd`:

1. `AGENTS.md:60, :63-64; docs/architecture.md:179, :368` — Absätze nach der Änderung nicht neu
   umbrochen (119/127 Zeichen statt ~90). (aus Paket 2) → besteht: `AGENTS.md:60` (119), `:64` (32);
   `architecture.md:179` (119); `:368` nach `:384` gewandert (127). Schritte 1, 5, 7.
2. `docs/architecture.md:247; web-test-runner.config.js:213; fixtures.js:40` — »every test file that
   starts a renderer« passt nicht zum Kriterium von `RENDERER_FREE_FILES`, genauer wäre »that
   renders«. (aus Paket 3) → besteht unverändert an allen drei Stellen. Schritte 6, 41, 42.
3. `docs/architecture.md:468` — »the four first« statt »the first four«. (aus Paket 3) → besteht
   unverändert. Schritt 8.
4. `docs/architecture.md:247, 483-484, 516-517, 567-568; AGENTS.md:186-188` — Zeilenumbruch der
   Umgebung gebrochen. (aus Paket 3) → besteht: `:247` (109), `:483-484` (96/40) unverändert;
   `516-517` ist der Absatz »two TypeScripts«, jetzt `:527` (145, an `a01acfd1` `:523`); `567-568`
   jetzt `:572` (151); `AGENTS.md:186-188` jetzt `:198-200`. Schritte 3, 6, 9, 11, 12.
5. `packages/twopoint5d/docs/stages.md:796` — ergänzter Satz nicht neu umbrochen (~150 Zeichen).
   (aus Paket 6) → besteht, jetzt `:802` (149, aus `6d041d1f`). Schritt 23.
6. `packages/twopoint5d/docs/resource-lifecycle.md:31` — Zeile nach dem DynamicAtlas-Satz zu lang.
   (aus Paket 6) → besteht unverändert (137). Schritt 13.
7. `packages/twopoint5d/docs/proposals/pipeline-stages-and-grid-base.md:184` — Zeilenrest »Frozen
   all the way down, its description and the« nicht neu umbrochen. (aus Paket 9) → besteht
   unverändert (50). Schritt 34.
8. `packages/twopoint5d/CHANGELOG.md:60` — »for NaN or a value that is no number« unterschlägt
   ±Infinity. (aus Paket 11) → besteht, jetzt `:62`; nachgeprüft am Diff von `b91ab441`
   (`assertFinite` → `assertFiniteAtLeast` in `TexturePackerJson.ts`, `AsepriteJson.ts`,
   `BitmapFont.ts`). Schritt 38.
9. `packages/twopoint5d/docs/map2d.md:255, :177` — »the most chunks a leaf keeps« / »leaves up to
   that many chunks in a leaf« sagt zu viel zu. (aus Paket 11) → besteht unverändert;
   `ChunkQuadTreeNode.ts:264` lässt ein Blatt ohne trennende Achse stehen. Schritte 18, 19.
10. `packages/twopoint5d/docs/map2d.md:352` — Prosazeile mit 115 Zeichen. (aus Paket 11) → besteht
    unverändert. Schritt 20.
11. `apps/lookbook/assets-src/README.md:620` — kurze Zeile nach »atlas upright. The art is«. (aus
    Paket 13b) → besteht unverändert (25). Schritt 40.
12. `wave-and-segment-sprites.md` §4.3 — Umbruch ragged. (aus Paket 14) → besteht, Punkt
    »Mipmaps« `:411-419`. Schritt 37.
13. `wave-and-segment-sprites.md` §4.3 — »which read level 0 alone« bezieht sich grammatisch auf die
    Filter. (aus Paket 14) → besteht, `:416`; die Aussage selbst stimmt für three 0.187.0 (Beleg
    Schritt 25). Schritt 37.
14. `display-fullscreen.md` §6.3 — nach der Einfügung nicht neu umbrochen. (aus Paket 15) →
    besteht, `:385-412` (`:392` 157 aus `11f2b368`). Schritt 30.
15. `display.md:596-601` — Absatz »Which element goes fullscreen« nicht neu umbrochen. (aus
    Paket 15) → besteht, jetzt `:600-607` (`:605` 75). Schritt 17.
16. `display.md:601` — »—,« liest sich holprig. (aus Paket 15) → besteht, jetzt `:605`. Schritt 17.
17. `docs/architecture.md` §5 — »and with it the audit step of CI (§3)«: der CI-Schritt meldet mit
    `--audit-level=high` nur, die Ausnahme ändert dort praktisch nichts. (aus Paket 17) → besteht,
    `:494-495`. Schritt 9.
18. `display.md:507` — neu umbrochene Zeile mit 105 Zeichen. (aus Paket 18) → **gegenstandslos**:
    `f02c7d86` (Paket 23) hat `:507-511` neu geschrieben, der Absatz `:503-511` hält jetzt höchstens
    99 Zeichen (an `1a8ec51e` `:507` 105).
19. `gpu-picking.md:279-281` — »Ownership« nennt Holder-Group und ClippingGroup-Spiegel nicht. (aus
    Paket 19) → besteht, jetzt `:286-288`. Schritt 33.
20. `textures.md:101-103` — »What is left alone« nennt nur die Wrap-Werte, nicht `generateMipmaps`.
    (aus Paket 19) → besteht unverändert. Schritt 26.
21. `AGENTS.md:140` — »A three.js object refused for its class is named« als halbe Zeile mitten im
    Absatz. (aus Paket 19) → besteht, jetzt `:145` (50; Paket 24 hat den Absatz umgebaut, dazu
    `:130` 58, `:137` 73, `:144` 12). Schritt 2.
22. `stages.md:798-805` — eine Zeile deutlich länger als die Nachbarn. (aus Paket 21) → besteht:
    `:811` (102, aus `ba93887b`) im Absatz `:806-812`; der Nachbarabsatz `:797-804` ist Stelle 5.
    Schritt 23.
23. `sprites.md:1174-1175` — der neue Satz vor »update() of the mesh uploads …« liest sich holprig.
    (aus Paket 21) → besteht, jetzt `:1181-1182`. Schritt 22.
24. `display-fullscreen.md:406` — ~150 Zeichen, Einschub »— of the turn, of the armed tap or of the
    page« liest sich als Klammer ohne Ende. (aus Paket 23) → besteht unverändert (150). Schritt 30.
25. `display-fullscreen.md:373-375` — `:374` bricht nach ~45 Zeichen, »happened« allein am Anfang von
    `:375`. (aus Paket 23) → besteht unverändert. Schritt 29.
26. `display.md:515` — 101 Zeichen. (aus Paket 23) → besteht unverändert. Schritt 16.

## Entscheidungen im Zug 0

- **Die Begründung von `no-mipmaps` ist falsch und kommt dazu.** `textures.md:88-91` (aus
  `82fe9ab0`) sagt, three lese unter WebGPU eine `nearest`-Textur verkleinert aus ihren
  Mip-Stufen; `MothChapel.ts:146-148` begründet `no-mipmaps` ebenso (die Prämisse stammt aus
  `e68e11b7`, Paket 19 hat sie in den Guide getragen). three 0.187.0 liest eine Textur mit zwei
  `NearestFilter` unter WebGPU mit `textureLoad` auf Level 0 und bindet keinen Sampler (Belege in
  Schritt 25); das gilt nur für eine Textur, die durch einen Sampler geht. Eingeordnet als
  **Symptom von Paket 19** (dessen Mip-Abschnitt in `textures.md` sagt nicht, was three tut) und
  hier aufgenommen statt in einem eigenen Nachtragspaket: Stelle 20 überarbeitet denselben
  Abschnitt derselben Datei, der Kommentar ist eine Zeile. `wave-and-segment-sprites.md:416` und
  `RepeatingTextureColor.ts:62-66` sagen das Richtige (Paket 14), der Code bleibt; `no-mipmaps`
  bleibt die richtige Empfehlung für eine Datentextur — nur ihr Grund ändert sich.
- **Die übrigen Zeilen, die ihren Umbruch sprengen, kommen dazu.** Ursache aller 26 Stellen: ein
  Satz wurde eingefügt oder angehängt, ohne den Absatz neu zu umbrechen. Zug 0 hat die Doku
  vollständig gemessen (Schleife unter »Regeln«: über 95 Spalten in den 90er-Dateien, über 105 in
  den 100er-Dateien, ohne Überschriften, Tabellen, Code, HTML) und jede Zeile per `git blame` gegen
  `d9b648bf` gehalten:
  - laufbedingt, von keinem Reviewer genannt (Folgen dieses Laufs, gleiche Ursache), neun eigene
    Stellen: `docs/architecture.md:507`; `display-fullscreen.md:606`;
    `animation-playback-and-aseprite.md:422`; `gpu-picking.md:19`; `sprites.md:1211`, `:1613`,
    `:1807`; `text.md:177`; `textures.md:568` — dazu Zeilen in den Absätzen genannter Stellen:
    `AGENTS.md:133` (Stelle 21), `docs/architecture.md:491-495` (Stellen 4 und 17),
    `display-fullscreen.md:393`, `:395`, `:410` (Stelle 14), `stages.md:811` (Stelle 22),
    `sprites.md:1182` (Stelle 23);
  - vorbestehend an `d9b648bf`, gleiche Ursache (ein Satz an eine umbrochene Zeile gehängt):
    `AGENTS.md:270`; `docs/architecture.md:9` (Library); `display.md:11`; `sprite-visibility.md:190`;
    `stage-masks.md:5`, `:184`, `:276`, `:287`; `sprites.md:486`, `:589`, `:1954`;
    `stages.md:187`, `:514`, `:532`, `:678`, `:1417`, `:1482`, `:1483`; `textures.md:217`;
    `assets-src/README.md:165`.
  Danach meldet die Messung nur noch die 30 ausgenommenen Zeilen, und der Befund kommt in keiner
  weiteren Runde wieder. Eine
  Rückgabe ins Audit wäre ein neues offenes Finding für denselben Mechanismus, den dieses Paket
  ohnehin an 25 Stellen behebt.
- **Nicht aufgenommen:** Zeilen, die nur eine zitierte Meldung oder Formel in einem Code-Span tragen
  (30 Zeilen, Liste unter »Regeln«) — so zitiert die Doku Meldungen, eine je Zeile, das ist kein
  Umbruchfehler; `resource-lifecycle.md:81` (eine Zeile, die nur ein Link ist); Zeilen zwischen 101
  und 105 in vorbestehenden Absätzen (`stages.md:1633-1638` u. a.), die in der Streuung ihrer
  Nachbarn liegen; der CHANGELOG, dessen Einträge je eine Zeile sind. Kurze Zeilen sind nur auf
  laufbedingte geprüft (alle acht stehen in den Schritten); die vorbestehenden Kurzzeilen sind
  überwiegend gewollte Umbrüche vor einem Code-Span oder Link und kein Befund.
- **Modell und Effort:** mittlere Stufe, weil das Paket aus Prosa arbeitet; `low`, weil jeder neue
  Wortlaut vorgegeben ist und der Rest reiner Umbruch — ein höherer Effort lädt zum Verbessern
  von Sätzen ein, die das Paket nicht nennt. Die Wortdiff-Probe hält das fest.
- **Restplan:** 26 (TSDoc und Kommentare unter `packages/twopoint5d/src/**` und
  `packages/twopoint5d-testing/test/`) berührt keine Datei dieses Pakets — `fixtures.js` und
  `web-test-runner.config.js` stehen nicht in seiner Liste. 27 ändert `CHANGELOG.md` an anderen
  Einträgen. 28 arbeitet im Lookbook, nicht in `MothChapel.ts`; fallen dort die
  `auditConfig.ignoreGhsas`-Einträge, bleibt die Regel in `docs/architecture.md` §5, die
  Schritt 9 umformuliert, als Regel gültig. Reihenfolge und Schnitt bleiben.

## Findings im Volltext

Keine Audit-Findings. Der Wortlaut der 26 überführten Stellen steht unter »Abgleich«, die
Belege zu jeder Wortänderung beim Schritt.

## Urteil des Reviewers

Alle Stellen des Abgleichs und alle Schritte des Vorgehens erfüllt (Stelle 18 gegenstandslos); Messschleife meldet nur die 30 ausgenommenen Zeilen; Wortdiff zeigt nur die vorgegebenen Wortlaute. Kleine Befunde: Kurzzeilen am Absatzende nur in Stichproben (`AGENTS.md:143-147`, `gpu-picking.md:286-290`, `textures.md:101-105`) geprüft, dort in Ordnung; »no longer exists« ist zitierter Fehlertext. Report: `paket-25.review-0.json`.
