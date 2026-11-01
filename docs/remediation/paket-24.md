# Paket 24 — Drain 2: Namen in Meldungen einheitlich über describeValue()

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nebenbefund aus Paket 19, Zug 0; in der Drain-Runde 2 überführt, Entscheidung
  »Drain-Runde 2: Jeder Name in einer Fehler- oder Warnmeldung geht über `describeValue()`« im Plan)
- Ziel: Jeder Name in einer Fehler- oder Warnmeldung der Library geht über `describeValue()`, auch
  jeder einer Liste der bekannten Namen, die Regel »Error and warning messages« in `AGENTS.md`
  kennt keine Handform mehr, und die Specs prüfen die Meldungen mit dem Wortlaut, den
  `describeValue()` für gewöhnliche Namen schreibt (identisch zur Handform, solange kein `"`, `\`
  oder Zeilenumbruch im Namen steht; eine Liste bekannter Namen zitiert jetzt jeden Namen).
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - die 43 Dateien der Inventur unten (alle unter `packages/twopoint5d/src/`, ohne Specs)
  - `packages/twopoint5d/src/display/DisplayFullscreen.ts` (`:49`, einfache Anführungszeichen)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`,
    `src/sprites/FeatureSprites/FeatureSpritesGeometry.ts`, `src/sprites/FeatureSprites/SpriteResources.ts`,
    `src/texture/AsepriteJson.ts`, `src/sprites/features/frameSlices.ts`, `src/texture/TextureStore.ts`
    (blanke Namenslisten, Schritt 4 — alle sechs stehen auch in der Inventur)
  - Specs: `src/texture/AsepriteJson.spec.ts`, `src/texture/TexturePackerJson.spec.ts`,
    `src/texture/TextureStore.spec.ts`, `src/texture/TextureResource.spec.ts`,
    `src/sprites/defineSprite.spec.ts`, `src/sprites/FeatureSprites/FeatureSpritesGeometry.spec.ts`,
    `src/sprites/FeatureSprites/SpriteResources.spec.ts`, `src/sprites/features/Anchor.spec.ts`,
    `src/sprites/features/NineSlice.spec.ts`, `src/stage/StageRenderer.spec.ts`,
    `src/text/BitmapFont.spec.ts`, `src/vertex-objects/VertexObjectDescriptor.spec.ts`,
    `src/vertex-objects/VertexObjectPool.sortBy.spec.ts`, `src/display/DisplayFullscreen.spec.ts`
  - `AGENTS.md` (Regel »Error and warning messages«, `:130-139`)
  - `packages/twopoint5d/CHANGELOG.md` (nur `## [Unreleased]`, `### Fixed`, Zeile `:91`)
  - `packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md:422`,
    `docs/proposals/flip-anchor-nine-slice.md:208`/`:213`, `docs/proposals/pool-sorting.md:78`
  - kein Code unter `apps/`, nichts unter `packages/twopoint5d-testing/`, kein Guide

- Vorgehen:
  1. **Regressionstests zuerst, rot sehen.** Neben dem genannten Nachbarn je ein Test, der einen
     Namen mit einem Zeichen gibt, das `describeValue()` escaped, und die escapte Meldung erwartet.
     Im TypeScript-Quelltext steht der erwartete Backslash doppelt (`'… "a\\"b" …'`). Vor dem
     Umbau schreibt die Library `"a"b"` — jeder dieser Tests muss rot laufen; der rote Lauf gehört
     in den Report.
     - `src/texture/AsepriteJson.spec.ts`, neben `:604`: `escapes a quote in the name two slices
       share` — zwei Slices namens `a"b` → `two slices are named "a\"b" — rename one of them in Aseprite`
     - `src/texture/TexturePackerJson.spec.ts`, neben `:165` (gleiches Json-Format wie dort):
       `escapes a line break in a frame name that appears twice` — Frame-Name `dup\n.png` zweimal →
       `TexturePackerJson: the frame name "dup\n.png" appears more than once in the json` (in der
       Meldung `\` + `n`, kein Zeilenumbruch)
     - `src/texture/TextureStore.spec.ts`, neben `:1274`: `escapes a quote in the id of a resource
       it does not hold` — `getAsync()` (Aufbau wie `acquireAsync()` dort) der Id `mis"sing` → `TextureStore: no resource with id
       "mis\"sing" — check your TextureStoreData.items keys.`
     - `src/sprites/defineSprite.spec.ts`, neben `:186`: `escapes a quote in the name two features
       share` — zwei Features namens `qu"iet` → `defineSprite: two features are named "qu\"iet"`
     - `src/sprites/defineSprite.spec.ts`, neben `:264` (`two features whose attributes name one
       buffer and disagree on its usage`): `names the attributes of features that do not fit, a
       quote in their names escaped` — wie der Nachbar, Attribute `o"ne` und `t"wo` →
       `/^defineSprite: the features do not fit into one sprite — attribute "o\\"ne" of feature "a",
       attribute "t\\"wo" of feature "b": VertexObjectDescriptor: buffer "shared"/` (Regex). Der
       Test hält zugleich die Paarung aus Schritt 3a: `checkLayout()` findet die Attribute in der
       Meldung des Descriptors nur, solange beide Seiten gleich zitieren.
     - `src/stage/StageRenderer.spec.ts`, neben `:1837`: `escapes a quote in the name of a stage it
       cannot take` — Stage `a"b`, die den Renderer hält → `StageRenderer#add() cannot take the
       stage "a\"b": that stage holds this renderer`
     - `src/text/BitmapFont.spec.ts`, neben `:433`: `escapes a quote in the face of a font of more
       than one page` — Face `ti"ny` → `BitmapFont: the font "ti\"ny" has 2 pages — …` (Rest wie dort)
     - `src/vertex-objects/VertexObjectDescriptor.spec.ts`, neben `:315`: `escapes a line break in
       the name of an attribute without a size` — Attribut `p\nos` → `VertexObjectDescriptor:
       attribute "p\nos" declares neither a size nor components`

     Dazu die **bestehenden** Erwartungen, deren Wortlaut sich ändert (rot vor Schritt 4 bzw. 3d,
     grün danach) — jeder Name der Liste in doppelten Anführungszeichen, `(none)` und `…` bleiben
     blank:
     - `FeatureSpritesGeometry.spec.ts:117` (`it knows "…", "…"`)
     - `SpriteResources.spec.ts:77`/`:80`/`:84`/`:86`/`:213`/`:344`/`:348` (`declared: "time",
       "light"`, `declared: "colorMap"`, `declared: "animsMap", "colorMap"`)
     - `AsepriteJson.spec.ts:425`, `TextureResource.spec.ts:3516`, `TextureStore.spec.ts:4226`
       (`its tags are: "idle"` bzw. `"blink"`)
     - `TextureStore.spec.ts:4125` (`known: "texturepacker", "aseprite";`)
     - `Anchor.spec.ts:162`/`:184`, `NineSlice.spec.ts:468`/`:471`/`:477` (`its slices are:
       "pivot", "hitbox"` usw.); `Anchor.spec.ts:164`/`:167` (`its slices are: (none)`) bleiben
     - `VertexObjectPool.sortBy.spec.ts:167` (`name one of "x", "y", "z", "rotation", "r", "g", "b",
       "layer", "h0", "h1", "weight", or hand in`) und `:180` (`name one of "c00", "c01", …,
       "c23", …, or hand in` — die zwölf Namen zitiert, das letzte `…` blank)
     - `DisplayFullscreen.spec.ts:1365` → `orientationLock "portrait" and onLandscape cannot work together`

     Was das Gate sonst rot zeigt, wird nach dem neuen Wortlaut nachgezogen, nicht umgangen — auch
     ein Name oder eine Url über 120 UTF-16-Einheiten, die `describeValue()` mit `…` schneidet.
  2. **Mechanischer Umbau.** In jeder Datei der Inventur wird jedes `"${expr}"` zu
     `${describeValue(expr)}` (alle 294 Vorkommen sind einfach: kein `}` und kein Backtick im
     Ausdruck). Wo eine Vorlage nur aus dem Zitat besteht — `` (x) => `"${x}"` `` in einem `.map()`
     —, steht danach der Aufruf allein: `.map(describeValue)` bzw. `.map((feature) =>
     describeValue(feature.name))` (`spritePipeline.ts:31`, `SegmentPlacement.ts:34`,
     `passFeatures.ts:68`, `frameSlices.ts:46`, `atlasAdapters.ts:46`,
     `InstancedVOBufferGeometry.ts:324`, `defineSprite.ts:233` bleibt eine Vorlage, Schritt 3a).
     `TexturePackerJson.ts:129`: der Cast `as string` entfällt, `describeValue()` nimmt `unknown`.
     Den Import `import {describeValue} from '<relativ>/utils/describeValue.js';` brauchen die 17
     Dateien, die ihn nicht haben: `sprites/features/frameSlices.ts`,
     `sprites/features/segmentChecks.ts`, `sprites/passes/refuseSegments.ts`,
     `sprites/spritePipeline.ts`, `stage/StageRenderer.ts`, `texture/PowerOf2ImageLoader.ts`,
     `texture/TextureAtlasLoader.ts`, `texture/atlasAdapters.ts`,
     `vertex-objects/GeometryAttributeSlots.ts`, `vertex-objects/GeometryRoutes.ts`,
     `vertex-objects/InstancedVOBufferGeometry.ts`, `vertex-objects/VertexObjectPool.ts`,
     `vertex-objects/attributeNamesOf.ts`, `vertex-objects/checkBufferArray.ts`,
     `vertex-objects/createVertexObjectPrototype.ts`, `vertex-objects/initializeAttributes.ts`,
     `vertex-objects/vertexObjectPropertyNames.ts` — dazu `display/DisplayFullscreen.ts` (Schritt 3d).
     Statischer Text in Anführungszeichen ohne Interpolation (`"JSON Array"`, `an "atlas" resource`
     in `derivedImageUrlError()`, `"imageUrl"`, `"overrideImageUrl"`, `'loop', 'once' or
     'pingpong'`) bleibt, wie er ist: das ist Text der Meldung, kein Name.
  3. **Stellen, an denen die Umstellung mehr ist als Suchen und Ersetzen:**
     a. `src/sprites/defineSprite.ts:232` liest die Meldung des Descriptors:
        `message.includes(`"${attribute}"`)` wird `message.includes(describeValue(attribute))`;
        `:233` wird `` `attribute ${describeValue(attribute)} of feature ${describeValue(feature)}` ``.
        Beide Seiten müssen gleich zitieren, sonst findet `checkLayout()` die Attribute nicht mehr.
     b. `src/vertex-objects/InstancedVOBufferGeometry.ts:286`/`:313`/`:328` schreiben das Argument
        eines Aufrufs aus: `attachInstancedPool(${describeValue(name)})`. Ebenso
        `FeatureSprites.ts:634` `bindUniform(${describeValue(name)})` und `frameSlices.ts:46`
        `${where}(frame, ${describeValue(holders[0])})`.
     c. `src/texture/TextureStore.ts:217` `: ${describeValue(hrefOf(what))}`, `:224`
        `: ${describeValue(url)}` — eine Url ist ein Name im Sinn der Regel.
     d. `src/display/DisplayFullscreen.ts:49` setzt einen Wert von Hand in einfache Anführungszeichen:
        `orientationLock '${type}'` wird `orientationLock ${describeValue(type)}`, Import dazu.
     e. Eager gebaute Labels (`initializeAttributes.ts:54`/`:74`/`:82`/`:85`,
        `attributeNamesOf.ts:17`/`:22`, `GeometryAttributeSlots.ts:101`/`:110`/`:140`,
        `vertexObjectPropertyNames.ts:24`, `defineSprite.ts:112`/`:296`,
        `FeatureSpritesMaterial.ts:120`/`:209`/`:345`, `FeatureSprites.ts:85`,
        `passFeatures.ts:118`/`:195`, `TextureStore.ts:1132`, `AsepriteJson.ts:247`/`:248`/`:410`,
        `TexturePackerJson.ts:154`) werden wie alle umgestellt. Sie liegen auf Bau-, Attach- und
        Detach-Pfaden, nicht in einer gemessenen Runde (`vertex-objects/hot-path-allocations.spec.ts:380-395`
        misst `update()`, `attachInstancedPool()` steht im Setup). Meldet `pnpm test:allocations`
        dennoch eine Stelle, bekommt genau diese die faule Form, die das TSDoc von
        `undefinedValueError()` beschreibt: `const x = map.get(k); if (x == null) throw
        undefinedValueError(`… ${describeValue(k)}`);`.
  4. **Blanke Listen von Namen** gehen Name für Name durch `describeValue()` (gleiche Ursache:
     ein Name steht roh in der Meldung, ein `, ` im Namen macht die Liste mehrdeutig):
     - `src/sprites/FeatureSprites/FeatureSpritesGeometry.ts:81` `it knows ${known.map(describeValue).join(', ')}`
     - `src/sprites/FeatureSprites/SpriteResources.ts:183` `declared: ${[...declarations.textures.keys()].map(describeValue).join(', ')}`,
       `:253` `${[...this.#uniformSizes.keys()].map(describeValue).join(', ')}`,
       `:276` `${this.textureNames.map(describeValue).join(', ')}`
     - `src/texture/AsepriteJson.ts:488` `its tags are: ${[...tagNames].map(describeValue).join(', ') || '(none)'}`
     - `src/sprites/features/frameSlices.ts:39` `namesOf = (slices) => Object.keys(slices).map(describeValue).join(', ') || '(none)'`
     - `src/texture/TextureStore.ts:1049` `const known = this.#atlasAdapters.map(({name}) => describeValue(name)).join(', ');`
     - `src/vertex-objects/VertexObjectPool.ts:44-45`
       `const listed = names.slice(0, LISTED_VALUE_PROPERTIES).map(describeValue);` — das `'…'`
       wird danach angehängt und bleibt blank.

     **Blank bleibt** das eigene Vokabular der Library — Schlüssel ihrer Optionen, Untertypen,
     Feld- und Exportnamen, Wahlmöglichkeiten aus einer Konstante; kein Name, den ein Aufrufer
     oder eine Datei vergibt: `FeatureSprites.ts:216` (`given`, Schlüssel der Material-Optionen),
     `FeatureSpritesMaterial.ts:104` (`extra`, Schlüssel eines Features), `writeText.ts:57`
     (`missing`, Exportnamen), `SegmentPlacement.ts:35` (`exports`), `TextureStore.ts:237`/`:1368`
     (`byType`/`never`, Untertypen), `:1064` (`leftOut`, Item-Felder), `:1024`/`:1038` (Sätze),
     `sampleAtlasFrame.ts:89-101` (`ORIGINS`, `WRAPS`, `TRIMS`).
  5. **`AGENTS.md`**, Regel »Error and warning messages«: in `:135` ab »A name that may« bis zum
     Ende von `:139` (»… `describeValue()` escapes.«) ersetzen durch diesen Text, umbrochen wie die
     Nachbarzeilen (zwei Leerzeichen Einzug, ≈ 90 Spalten):

     > Every name a message writes goes through it as well, typed as a string or a symbol — of a
     > feature, a stage, a frame, a resource, a url —: the one that tells instances apart
     > (`FeatureSprites "hud": …`), the one a look-up did not find, and each of a list of the
     > names that are known (`its tags are: "idle", "run"`); and so does each argument of a call
     > a message writes out (`getAsync("hero", ["atlas", "texture"])`). A message quotes no
     > interpolation by hand: a `"${name}"` would leave a quote, a backslash or a line break in
     > the name unescaped. The words of the library's own vocabulary — the keys of its options,
     > the choices it lists from a constant, the names of its exports — are text of the message,
     > not names.

     Der Satz »A quoted name may follow the subject where it tells instances apart (`FeatureSprites
     "hud": …`)« in `:121-122` bleibt.
  6. **`packages/twopoint5d/CHANGELOG.md:91`** (`## [Unreleased]` → `### Fixed`, unveröffentlicht,
     darf umgeschrieben werden) ersetzen durch:

     > - a refused string and every name an error or warning message writes — of a feature, an
     >   attribute, a stage, a frame, a resource, a url — are quoted with their quotes,
     >   backslashes, control chars, line and paragraph separators and lone surrogates escaped as
     >   in a JSON string, so each stays on one line and ends at its closing quote; a list of the
     >   names that are known quotes each of them (`its tags are: "idle", "run"`)

     als eine Zeile wie die Nachbarn (kein Umbruch im Listenpunkt). Kein weiterer Eintrag, nichts
     **BREAKING**: der Wortlaut einer Meldung ist keine API.
  7. **Proposals**, die eine der Listen-Meldungen wörtlich zitieren, nachziehen (nur das Zitat,
     kein Eintrag in der Abweichungsliste — die Änderung folgt der Regel in `AGENTS.md`, nicht
     einem Entwurf des Features):
     - `docs/proposals/animation-playback-and-aseprite.md:422` `known: "texturepacker", "aseprite";`
     - `docs/proposals/flip-anchor-nine-slice.md:208` `its slices are: "pivot", "hitbox"`,
       `:213` `its slices are: "hitbox";`
     - `docs/proposals/pool-sorting.md:78` `name one of "x", "y", "z", "rotation", or hand in …`
  8. `pnpm format`, danach `git status`: geändert sind nur die Dateien dieses Pakets.
  9. Vollständigkeit, beide Aufrufe ohne Treffer:
     `git grep -n -F '"${' -- 'packages/twopoint5d/src/*.ts' ':!*.spec.ts' ':!packages/twopoint5d/src/utils/describeValue.ts'`
     und `git grep -n -F "'\${" -- 'packages/twopoint5d/src/*.ts' ':!*.spec.ts'`.

- Verify: `pnpm run ci` (darin lint, typecheck, test:coverage, test:allocations), dazu die beiden
  `git grep` aus Schritt 9 ohne Treffer
- Commit: `fix(twopoint5d): quote every name an error or warning message writes through describeValue(), each one of a list of known names as well, so a quote, a backslash or a line break in a name stays escaped`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · Nebenbefund besteht: 232 Zeilen, 294 Vorkommen `"${…}"`
    in 43 Dateien (`describeValue.ts` selbst ausgenommen; Plan nannte 233), `AsepriteJson.ts:231`
    unverändert, `:383` → `:389`, `TexturePackerJson.ts:129`/`:139` unverändert, Regel jetzt
    `AGENTS.md:135-139` · aufgenommen (vorbestehend an d9b648bf, gleiche Ursache): acht blanke
    Namenslisten in sechs Dateien (Schritt 4) und `DisplayFullscreen.ts:49` (`'${type}'`) · keine offene Folge im
    Plan, »Offene Befunde« ohne weiteren offenen Eintrag · Restplan: 24 ist das letzte Paket
  - 2026-11-01 Zug 1: Implementierer beauftragt (mittlere Stufe, sonnet, effort medium), Report nach `paket-24.impl-0.json`
  - 2026-11-01 Zug 2: Report `FERTIG_MIT_VORBEHALT` (Ergebnisfeld von `paket-24.impl-0.json` enthielt nur einen Nachsatz, Report per Resume derselben Session in `paket-24.impl-0-versuch-2.json`; Vorbehalt: geänderte Dateien nicht ganz gelesen) · 63 Dateien geändert (59 unter `packages/twopoint5d/src/`, `AGENTS.md`, `CHANGELOG.md`, drei Proposals) · acht neue Tests vor dem Umbau rot (`8 failed | 749 passed`) · Arbeitsbaum schmutzig · eigener Verify-Lauf `paket-24.verify.log` gestartet
  - 2026-11-01 Zug 2: eigener Verify `pnpm run ci` + beide `git grep` → exit=0 (`paket-24.verify.log`)
  - 2026-11-01 Zug 3: Reviewer (sonnet, medium) `paket-24.review-0.json`, Diff `paket-24.diff` · Erfüllung (a)–(h) behoben · wichtig: `docs/proposals/animation-playback-and-aseprite.md:297` zitiert `its tags are: idle, walk, kick` blank · klein: `TexturePackerJson.ts:129` Cast `as string` nicht entfernt
  - 2026-11-01 Zug 4 Runde 1: beide Befunde per Resume an den Implementierer aus Runde 0 (sonnet, medium), Report nach `paket-24.impl-1.json`
  - 2026-11-01 Zug 4 Runde 1: Report `FERTIG` — `animation-playback-and-aseprite.md:297` zitiert, Cast `TexturePackerJson.ts:129` entfernt, Suche nach weiteren blanken Zitaten ohne Treffer · eigener Verify `paket-24.verify-1.log` exit=0 · Diff `paket-24.diff-1` · Reviewer per Resume `paket-24.review-1.json`: beide behoben, nichts Neues
  - 2026-11-01 Zug 5: Commit dddfd7fd (63 Dateien), Trailer `Remediation-Run: 2026-10-31`, getragen von `paket-24.verify-1.log`

## Abgleich

- **Nebenbefund »233 handgesetzte `"${…}"` in 43 Dateien«** — besteht, leicht verschoben:
  `git grep -n '"\${' -- 'packages/twopoint5d/src/*.ts' ':!*.spec.ts' ':!…/describeValue.ts'`
  zählt am 2026-11-01 auf f02c7d86 232 Zeilen mit 294 Vorkommen in 43 Dateien. Die Beispiele des
  Eintrags: `AsepriteJson.ts:231` (»two slices are named "${name}"«) unverändert, `:383` jetzt
  `:389` (»the frame "${name}" is …«), `TexturePackerJson.ts:129`/`:139` unverändert. Die Regel
  steht jetzt in `AGENTS.md:135-139` (der Eintrag nannte `:136-138`). Vorbestehend (an d9b648bf
  dieselbe Handform), nicht durch den Lauf entstanden.

Inventur (Zeilen mit `"${` je Datei, unter `packages/twopoint5d/src/`):

| Zeilen | Datei |
| --- | --- |
| 26 | `stage/StageDirector.ts` |
| 20 | `sprites/passes/passFeatures.ts` |
| 18 | `texture/TextureStore.ts`, `sprites/defineSprite.ts`, `sprites/checkFeature.ts` |
| 17 | `texture/AsepriteJson.ts` |
| 11 | `sprites/FeatureSprites/FeatureSpritesMaterial.ts` |
| 10 | `texture/TextureResource.ts` |
| 9 | `sprites/FeatureSprites/FeatureSprites.ts` |
| 8 | `vertex-objects/VertexObjectDescriptor.ts`, `stage/StageRenderer.ts`, `sprites/FeatureSprites/SpriteResources.ts` |
| 6 | `vertex-objects/VertexObjectBuffer.ts` |
| 5 | `texture/TexturePackerJson.ts` |
| 4 | `vertex-objects/InstancedVOBufferGeometry.ts`, `vertex-objects/initializeAttributes.ts`, `sprites/spriteDeclarations.ts` |
| 3 | `vertex-objects/GeometryAttributeSlots.ts`, `texture/PowerOf2ImageLoader.ts`, `stage/StageMask.ts`, `sprites/features/frameSlices.ts` |
| 2 | `vertex-objects/VertexObjectPool.ts`, `vertex-objects/checkBufferArray.ts`, `vertex-objects/attributeNamesOf.ts`, `texture/TextureAtlasLoader.ts` |
| 1 | `vertex-objects/vertexObjectPropertyNames.ts`, `vertex-objects/GeometryRoutes.ts`, `vertex-objects/createVertexObjectPrototype.ts`, `texture/FrameBasedAnimations.ts`, `texture/fetchAtlasJson.ts`, `texture/checkTextureStoreData.ts`, `texture/atlasAdapters.ts`, `text/layoutText.ts`, `text/BitmapFont.ts`, `stage/transitionEffects.ts`, `stage/StageRenderOrder.ts`, `sprites/spritePipeline.ts`, `sprites/SpritePicker.ts`, `sprites/passes/refuseSegments.ts`, `sprites/features/SegmentPlacement.ts`, `sprites/features/segmentChecks.ts`, `sprites/FeatureSprites/FeatureSpritesGeometry.ts`, `sprites/features/NineSlice.ts` |

Summe 232. `src/testing/` und `*.bench.ts` haben keine Fundstelle.

## Entscheidungen im Zug 0

- **Ein Paket, ein Commit.** Der Diff ist mechanisch: ≈ 232 Zeilen Umstellung, 18 Imports, acht
  Listen, ≈ 30 Spec-Zeilen, acht neue Tests, je ein Absatz in `AGENTS.md` und `CHANGELOG.md`, vier
  Proposal-Zeilen — ein Reviewer hält das in einem Durchgang. Der im Plan offengelassene Schnitt
  je Modul entfällt.
- **Blanke Namenslisten gehören dazu** (Nebenbefund gleicher Ursache, vorbestehend an d9b648bf:
  `frameSlices.ts` 2×, `SpriteResources.ts` 3×, `AsepriteJson.ts`, `TextureStore.ts`,
  `VertexObjectPool.ts`, `FeatureSpritesGeometry.ts`). Grund: die Entscheidung im Plan sagt
  »Jeder Name in einer Fehler- oder Warnmeldung«; eine blanke Liste schreibt Namen ebenso roh wie
  die Handform, ein Name mit `, ` macht sie mehrdeutig. Bliebe sie, widerspräche der neue Text in
  `AGENTS.md` dem Code am Tag des Commits.
- **`DisplayFullscreen.ts:49` gehört dazu**: ein Wert in eigenen (einfachen) Anführungszeichen,
  schon gegen die heutige Regel (»never … an interpolation, bare or in quotes of its own«);
  vorbestehend an d9b648bf. `src/display/` ist seit f02c7d86 nicht mehr in Arbeit (Paket 23 fertig).
- **Vokabular bleibt blank**: Schlüssel, Untertypen, Feld- und Exportnamen und Wahlmöglichkeiten
  aus Konstanten der Library (Liste in Schritt 4) sind keine Namen eines Aufrufers oder einer
  Datei und tragen kein Zeichen, das `describeValue()` escaped. Ein interpoliertes Vokabelwort in
  Anführungszeichen (`"${resource.type}"`, `"${property}"`) geht dennoch über `describeValue()`:
  die Regel kennt keine Interpolation in handgesetzten Anführungszeichen, Ausgabe identisch. Die
  verschiedenen Schreibweisen der Wahlmöglichkeiten (`'loop', 'once' or 'pingpong'` neben
  `forward, reverse, pingpong`) sind kein Befund: keine Regel schreibt eine vor, kein Fall
  mehrdeutig.
- **Kein Wächter im Gate** (etwa ein `node --test`, der `"${` in `src/` verbietet): keine andere
  Meldungsregel in `AGENTS.md` hat einen, und ein Test unter `scripts/` zöge die lange Liste in
  `AGENTS.md:59-72` nach. Die Vollständigkeit belegt der `git grep` im Verify dieses Pakets.
- **Specs bleiben bei ihrem Wortlaut** und bauen ihre Erwartungen weiter von Hand (Ausgabe für
  gewöhnliche Namen identisch). Neue Tests nur für die escapte Form, je Modul mit Namen aus Daten
  oder vom Aufrufer (texture, sprites, stage, text, vertex-objects); display über die geänderte
  Erwartung `:1365`.
- **Abschneiden über 120 Einheiten** nimmt das Paket in Kauf: `describeValue()` schneidet lange
  Strings mit `…`, eine Url über 120 Einheiten in einer Lade-Meldung erscheint gekürzt. Dieselbe
  Grenze gilt seit Paket 19 für jedes ausgeschriebene Aufruf-Argument (`loadAsync(…)`,
  `fetch(…)`); zwei Grenzen für Urls in derselben Datei wären die zweite Form, die die
  Entscheidung beseitigt.
- **Proposals**: nur die vier wörtlichen Zitate der Listen-Meldungen; Zitate mit gewöhnlichen
  Namen in Anführungszeichen stimmen weiter. Kein Abweichungseintrag (`docs/proposals/README.md`,
  »Reading an implemented proposal«: die Liste nennt, wo der Bau den Entwurf verließ — hier folgt
  eine spätere Änderung des Wortlauts einer Regel des Repos).
- **CHANGELOG**: die bestehende `Fixed`-Zeile aus Paket 19 (`:91`, unveröffentlicht) wird
  erweitert statt eine zweite daneben zu stellen; Commit-Typ `fix`.
- **Modell mittlere Stufe, Effort medium**: 43 Dateien aus Prosa und Tabelle, Regressionstests und
  Spec-Anpassungen; kein Nebenläufigkeits- oder API-Risiko.

## Findings im Volltext

**Nebenbefund · info · `packages/twopoint5d/src/` (aus Paket 19, Zug 0)** — 233 handgesetzte
`"${…}"` in 43 Dateien ohne Specs, z. B. `src/texture/AsepriteJson.ts:231`/`:383`/`:397`,
`src/texture/TexturePackerJson.ts:129`/`:139`. Namen vom Typ `string`, die eine Meldung nach der
Regel »Error and warning messages« (`AGENTS.md:136-138`) von Hand in Anführungszeichen setzt,
stehen dort roh: ein Frame-, Slice- oder Tag-Name aus einem Json mit `"`, `\` oder Zeilenumbruch
macht die Meldung mehrdeutig oder mehrzeilig; nach Paket 19 escaped `describeValue()` diese
Zeichen, die Handform nicht, und AGENTS.md sagt das; vorbestehend (die Handform an d9b648bf
ebenso). Urteil in Paket 19: `→ Rückfrage` (ein Fix kippt die Regel »quoted by hand« in AGENTS.md
und berührt 233 Stellen in 43 Dateien); in der Drain-Runde 2 vom Orchestrator entschieden
(Entscheidung »Jeder Name in einer Fehler- oder Warnmeldung geht über `describeValue()`«,
2026-11-01) und in Paket 24 überführt.

Empfehlung: Jeden Namen über `describeValue()` zitieren, die Ausnahme »quoted by hand« in
`AGENTS.md` streichen; die Specs prüfen den Wortlaut, den `describeValue()` für gewöhnliche Namen
schreibt.

## Urteil des Reviewers

Review 0 (`paket-24.review-0.json`), nach Runde 1 bestätigt (`paket-24.review-1.json`):

- (a) handgesetzte `"${…}"` in den 43 Dateien der Inventur — behoben; beide `git grep` aus Schritt 9 ohne Treffer, die 44 geänderten Nicht-Spec-Dateien unter `src/` decken sich mit Inventur plus `DisplayFullscreen.ts`
- (b) acht blanke Namenslisten — behoben: `FeatureSpritesGeometry.ts:81`, `SpriteResources.ts` (3×), `AsepriteJson.ts:488`, `frameSlices.ts:39`, `TextureStore.ts` (`known`), `VertexObjectPool.ts:44`
- (c) `DisplayFullscreen.ts:49` — behoben, `orientationLock ${describeValue(type)}`
- (d) `defineSprite.ts:232`/`:233` — behoben, beide Seiten über `describeValue()`; gehalten von `defineSprite.spec.ts:276`
- (e) `AGENTS.md:135-144` — behoben, wortgleich zum Detailplan
- (f) `CHANGELOG.md:91` — behoben
- (g) Proposal-Zitate — behoben: `animation-playback-and-aseprite.md:297` (Runde 1) und `:422`, `flip-anchor-nine-slice.md:208`/`:213`, `pool-sorting.md:78`
- (h) acht Regressionstests — vorhanden und vor dem Umbau rot: `AsepriteJson.spec.ts:586`, `TexturePackerJson.spec.ts:170`, `TextureStore.spec.ts:1268`, `defineSprite.spec.ts:190`/`:276`, `StageRenderer.spec.ts:1846`, `BitmapFont.spec.ts:437`, `VertexObjectDescriptor.spec.ts:319`

Kleine Befunde: `TexturePackerJson.ts:129` Cast `as string` — in Runde 1 behoben. Offen: keiner.

Vorbehalt des Implementierers (Runde 0): die geänderten Dateien wurden nicht ganz gelesen, nur Diffs, Fundstellen und eine gezielte Suche nach blanken `join(', ')`; übrig blieben nur Vokabular-Listen, die der Detailplan blank lässt (`FeatureSprites.ts:216`, `FeatureSpritesMaterial.ts:104`, `TextureStore.ts:239`/`:1068`/`:1372`). Nebenbefunde in den 43 Dateien sind damit nicht ausgeschlossen.
