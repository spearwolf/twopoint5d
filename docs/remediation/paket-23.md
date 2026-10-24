# Paket 23 — Nachlese: Doku, CHANGELOG und TSDoc aus den Reviewer-Urteilen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Folgen dieses Laufs: kleine Befunde der Reviewer, dazu sieben Stellen gleicher
  Ursache aus diesem Zug 0; low)
- Ziel: Doku, CHANGELOG und TSDoc, die dieser Lauf geschrieben hat, sind sauber umbrochen,
  grammatisch richtig und sagen genau, was der Code tut.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - Wurzel: `docs/architecture.md`, `AGENTS.md`, `README.md`
  - `packages/twopoint5d/docs/`: `sprites.md`, `text.md`, `display.md`, `resource-lifecycle.md`;
    Proposals `sprite-features.md`, `animation-playback-and-aseprite.md`, `gpu-picking.md`,
    `wave-and-segment-sprites.md`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/CHANGELOG.md` (nur `## [Unreleased]`)
  - TSDoc und Kommentare in `packages/twopoint5d/src/`: `display/Display.ts`,
    `display/AdaptiveResolution.ts`, `stage/Stage2D.ts`, `stage/StageRenderer.ts`,
    `stage/Canvas2DStage.ts`, `map2d/Map2DTileCoordsUtil.ts`,
    `vertex-objects/InstancedVertexObjectGeometry.ts`, `texture/TileSet.ts`,
    `utils/Dependencies.ts`, `texture/AsepriteJson.ts`, `texture/TexturePackerJson.ts`,
    `texture/TextureStore.ts`, `text/readBitmapFontSource.ts`, `sprites/passes/passFeatures.ts`,
    `sprites/passes/definePass.ts`, `sprites/runCheckKind.ts`
  - Kommentare in Tests: `packages/twopoint5d-testing/test/harness-rejections.test.js`,
    `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
- Vorgehen: siehe Abschnitt »Vorgehen« unten — Regeln R1–R4, dann die Schritte 1–7, je mit
  Fundstelle und, wo Wortlaut zählt, dem Text vorher und nachher.
- Verify: `pnpm run ci`
- Commit: `docs: wrap the paragraphs and comment blocks this run left past the width of their file, say what Stage2D#updateFrame(), StageRenderer#resize(), Canvas2DStage#dispose(), Map2DTileCoordsUtil and the InstancedVertexObjectGeometry constructor do where their docs fell short, mark the change of Chronometer#update() breaking with a migration guide, give the migration guides of getGlobalSheet(), the catalog check and tableFrame() blocks a caller can copy, and fix the grammar of the changelog, the guides and the TileSet docs`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · Abgleich: 46 Doku-/TSDoc-Stellen aus den Urteilen von
    Paket 1–7, 9–15, 18–22 gegen HEAD 73af32b4 geprüft — 41 offen (Zeilen verschoben),
    `FeatureSprites.ts:307` erledigt (Paket 21, ccf8754f), `FeatureSprites.ts:541` erledigt
    (Paket 20, 898cf144), Lookbook-`private` und Arbeitsplan
    `docs/superpowers/plans/2026-10-08-sprite-uniform-bindings.md` gegenstandslos, eine Stelle
    kein Befund (Paket 1, Audit-Timeout) · Folgen: sieben ungenannte Stellen gleicher Ursache
    ins Paket (README.md:167, `animation-playback-and-aseprite.md` 301/313/316,
    `gpu-picking.md:106`, `resource-lifecycle.md` 49/114/296–298, `runCheckKind.ts:4`), dazu
    zwei vorbestehende Zeilen in `sprites.md` (1181, 2012) als Nebenbefund gleicher Ursache ·
    elf Code-/Test-Befunde aus den Urteilen von Paket 2, 5, 6, 11, 14, 15 an Paket 24
    (Plan, Zeile »Umfang«) · Restplan: 23 vor 24 unverändert

  - 2026-10-24 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-23.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG · 31 Dateien geändert (Doku, CHANGELOG, TSDoc, zwei Testkommentare) · Arbeitsbaum schmutzig · Verify läuft nach `paket-23.verify.log`
  - 2026-10-24 Zug 2: Verify `pnpm run ci` exit=0 (`paket-23.verify.log`)
  - 2026-10-24 Zug 3: Reviewer (opus, low) — alle Schritte erfüllt, kritisch 0, wichtig 0, klein 2 · Diff `paket-23.diff`
  - 2026-10-24 Zug 4: keine Runde
  - 2026-10-24 Zug 5: Commit ff7d5422 · Arbeitsbaum sauber
## Was dieses Paket nicht tut

- Keine Zeile Code, keine Meldung, kein Test-Verhalten. Was nach Code aussieht (Reihenfolge
  der Prüfungen, Meldungstexte, fehlende Tests), gehört Paket 24.
- Keine Umbrüche außerhalb der hier genannten Stellen. Zeilen über der Breite, die ein Link,
  eine URL oder ein zitierter Meldungstext in Backticks allein so lang macht, bleiben stehen
  (z. B. `sprite-features.md:42`, `:358`, `:531`, `sprites.md:936`,
  `table-frames-and-palette-swap.md:222`).
- Kein neuer CHANGELOG-Eintrag für die Doku selbst. Im CHANGELOG werden nur bestehende Einträge
  unter `[Unreleased]` berichtigt, und der Migration Guide bekommt einen Abschnitt (Schritt 5.9).
  Freigegebene Abschnitte (`## [0.23.0]` und älter) bleiben unberührt.

## Vorgehen

Vor der ersten Zeile: `AGENTS.md` im Repo-Root und den Abschnitt »Konventionen« im Kopf von
`./remediation-plan.md` lesen. Für das CHANGELOG den Skill `updating-changelog` laden
(`.claude/skills/updating-changelog/SKILL.md`).

### Regeln

- **R1 — Umbrechen heißt: nur Zeilenumbrüche ändern sich.** Wörter, Satzzeichen, Backticks und
  ihre Reihenfolge bleiben exakt. Greedy füllen bis zur Breite der Datei (R2), letzte Zeile
  eines Absatzes darf kurz sein. Listenmarker und der Einzug der Fortsetzungszeilen bleiben wie
  im Absatz (`- ` plus zwei Leerzeichen in Markdown; ` * ` bzw. ` *   ` in TSDoc). Codeblöcke
  (```), Tabellenzeilen und Überschriften werden nie umbrochen. Ein Code-Span oder ein Link, der
  allein nicht in die Zeile passt, darf die Zeile überlaufen; im Fließtext darf ein Code-Span
  über ein Zeilenende laufen, wie die Dateien es schon tun (`text.md:210–211`).
  Selbstkontrolle je Datei mit reinen Umbrüchen:
  `git diff --word-diff=porcelain -- <datei> | grep -E '^[-+][^-+]'` zeigt nichts außer den
  Wortänderungen, die dieser Plan ausdrücklich verlangt.
- **R2 — Breiten.** `docs/architecture.md`, `AGENTS.md`, `README.md`,
  `packages/twopoint5d/docs/resource-lifecycle.md` und `packages/twopoint5d/src/stage/README.md`:
  90 Zeichen. `packages/twopoint5d/docs/*.md` sonst und alle Proposals: 100 Zeichen.
  TSDoc und Kommentare in `src/` und in Tests: 100 Zeichen einschließlich Einzug.
  Das CHANGELOG ist nicht umbrochen (ein Eintrag, eine Zeile) und bleibt so.
- **R3 — Einzeilige TSDoc-Blöcke über der Breite** werden zu mehrzeiligen Blöcken:
  ```ts
  /**
   * <Text, umbrochen nach R1/R2>
   */
  ```
  mit dem Einzug des Members. Text unverändert.
- **R4 — Ersetzungen mit Wortlaut.** Wo unten »vorher → nachher« steht, gilt der Wortlaut
  wörtlich; danach den betroffenen Absatz nach R1/R2 umbrechen.

### Schritt 1 — Wurzel-Doku (Breite 90)

1. `docs/architecture.md`
   1. Z. 141, Bullet `checkNameableTypes`: zwei Leerzeichen zwischen `-` und
      `` `checkNameableTypes` `` → eines, wie bei allen anderen Bullets.
   2. Z. 259–260, Absatz »The runner puts a logger into every page …« (Z. 256–264):
      vorher `which waits for the browser to report every rejection before it — hands it to`
      → nachher `which waits until the browser has reported every rejection that went
      unhandled before it was called — hands it to`; Absatz umbrechen.
   3. Umbrechen (R1): die Absätze bzw. Listenpunkte mit den Zeilen 195 (§3 »In CI«, erster
      Absatz), 220 (Absatz »The step `Audit dependencies` …«), 233 (Absatz »The browser suite
      runs every test file in four browsers …«), 269 (Absatz »Only the job of the browser tests
      installs Playwright …«), 439 (§5, Absatz mit »`playwright` stays out of the group as
      well«) und 495–499 (Listenpunkt »`@web/test-runner` with Playwright Chromium, Firefox and
      WebKit …«). Z. 105 steht in einem Codeblock und bleibt.
2. `AGENTS.md`: die Listenpunkte bzw. Absätze mit den Zeilen 59 (»preview generator
   (`scripts/**/*.test.mjs`) …«), 75–85 (Listenpunkt `pnpm lookbook` samt Fortsetzung bis zum
   Absatz über die Assets), 143 (»peer range ends at 6 ([monorepo architecture §5]…«), 225 und
   229 (Doku-Liste am Ende) umbrechen. Die Tabellenzeilen 15–18 bleiben.
3. `README.md` (Repo-Root): der Listenpunkt »the guides for users of the library — …«
   (Z. 165–167, Z. 167 hat 91 Zeichen) umbrechen.

### Schritt 2 — Guides der Library

1. `packages/twopoint5d/docs/sprites.md` (Breite 100)
   1. Umbrechen (R1) die Absätze bzw. Listenpunkte mit den Zeilen 369 und 376 (»Aseprite sheets«;
      Z. 376 ist ein Absatz in einer Zeile von 342 Zeichen), 440 (»An item that names an adapter
      the store does not know …«), 1673–1683 (Absatz »**Refusals.** A `TypeError` instead of a
      mismatch …«, Z. 1681 hat 134 Zeichen), 2031–2037 (Listenpunkt »**`uniforms`** — start
      values by name …«), 2079–2082 (Absatz »A field of the wrong type …«, endet mit der Kurzzeile
      »swap hold a feature that« und »never passed through `defineFeature()` …«), dazu die
      vorbestehenden Zeilen 1181 (»The placement of the kind always comes back …«, 124 Zeichen)
      und 2012 (Listenpunkt »**`attributes`** — …«, 113 Zeichen).
   2. Z. 2232–2234, Listenpunkt »**The shape.**«, Grammatik — vorher:
      `` `definePass()` refuses a pass that is no object with a `TypeError`, and so does it `features` that are no list, a `without` that is no list of names, `uniformNames` or `material` that are no objects; a `renderOrder` that is no finite number throws a `RangeError`. ``
      nachher:
      `` `definePass()` refuses with a `TypeError` a pass that is no object, `features` that are no list, a `without` that is no list of names, and `uniformNames` or `material` that are no objects; a `renderOrder` that is no finite number throws a `RangeError`. ``
      Der Rest des Punkts (»The sprites check the same …«) bleibt; Punkt umbrechen.
2. `packages/twopoint5d/docs/text.md` Z. 205–206 — `layoutText()` kennt kein `z`. Vorher:
   `` `layoutText()` refuses its options and a text that is no string as `writeText()` does, with the same error classes. ``
   nachher:
   `` `layoutText()` refuses the options it shares with `writeText()` — all but `z` — and a text that is no string as `writeText()` does, with the same error classes. ``
   (`TextLayoutOptions` in `src/text/layoutText.ts` hat kein `z`, `WriteTextOptions` in
   `src/text/writeText.ts:18` erst.)
3. `packages/twopoint5d/docs/display.md` Z. 248–249 — `isRunning` ist auch vor dem ersten
   `start()` `false`. Vorher:
   `` - A frame that a paused display renders (a `renderFrame()` of your own) has no interval between ``
   `` animation frames: `frame-pacing` judges none of them, `gpu-time` measures it like any other. ``
   nachher (umbrochen nach R1):
   `` - A frame that a display renders while it is not running — paused, or not started yet: a `renderFrame()` of your own — has no interval between animation frames: `frame-pacing` judges none of them, `gpu-time` measures it like any other. ``
4. `packages/twopoint5d/docs/resource-lifecycle.md` (Breite 90)
   1. Z. 50 — der Konstruktor von `InstancedVOBufferGeometry` baut Pools auch aus einer
      `VertexObjectDescription`: `the same for the pools they build from a descriptor:` →
      `the same for the pools they build from a descriptor or a description:`; den Absatz
      Z. 43–51 (»… A `Display` constructor that throws …«, Z. 49 hat 92 Zeichen) umbrechen.
   2. Umbrechen: den Absatz mit Z. 114 (SpritePicker, »whether a later pick lists it or not: …«)
      und den Absatz mit Z. 296–298 (»What an instance has hung on the DOM, on the window …«).
5. `packages/twopoint5d/src/stage/README.md` (Breite 90) — hinter dem Absatz »A listener of
   `OnStageAfterCameraChanged`, `OnStageAfterSceneChanged`, `OnStageResize` or
   `OnStageFirstFrame` that throws …« (Z. ~613–618, endet mit »ends the frame for the
   listeners behind it.«) einen Absatz einfügen:

   ```markdown
   Under a `StageRenderer` an error out of `Stage2D#resize()` counts as the stage refusing the
   size, also when the stage took the size and only a listener threw: the renderer and the
   `StageItem` of that stage keep the size they had, and the next `resize()` with that size
   hands it to the stage again. A pending `needsUpdate` that `updateFrame()` applies sends
   `OnStageAfterCameraChanged` and `OnStageResize` as well; a listener that throws there ends
   the frame before `OnStageFirstFrame` and `OnStageUpdateFrame`, and the error reaches the
   caller of `updateFrame()`.
   ```

   Belegt in `StageRenderer.ts:494–524` (`resize()` nimmt die Größe des Renderers zurück, sobald
   ein `resizeStage()` wirft; `resizeStage()` schreibt das Item erst nach `stage.resize()`) und
   `Stage2D.ts:271–281`, `:367–371` (`updateFrame()` ruft `updateProjection()`, das
   `throwCollected()` wirft, bevor ein Frame-Event hinausgeht).

### Schritt 3 — Proposals (Breite 100)

1. `packages/twopoint5d/docs/proposals/sprite-features.md`: den Listenpunkt
   »**`SpriteResources`** — the uniforms and textures a set of features declares …« (Z. ~625–637,
   Z. 635 hat 112 Zeichen) und den Absatz »`definePass()` checks what a pass can be checked for
   on its own …« (Z. ~780–789, Z. 782 und Z. 788 mit 101 und 186 Zeichen) umbrechen.
2. `packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md`: die Listenpunkte mit
   Z. 301 (»… a tag whose `repeat` plays more than `FrameBasedAnimations.MaxFramesWithDurations`
   (8191)«, 135 Zeichen) und Z. 313–316 (»A json, `frames` or `meta` that is no object …«)
   umbrechen.
3. `packages/twopoint5d/docs/proposals/gpu-picking.md` Z. 106 (»One per listed mesh, built at its
   first pick …«, 156 Zeichen) umbrechen.
4. `packages/twopoint5d/docs/proposals/wave-and-segment-sprites.md` Z. 336, Codeauszug §4.2: in
   `readonly wrap: readonly [AtlasFrameWrap, AtlasFrameWrap]` die Labels des Codes
   (`src/texture/sampleFrameAt.ts:18`) einsetzen →
   `readonly wrap: readonly [u: AtlasFrameWrap, v: AtlasFrameWrap]`. Sonst nichts am Auszug; die
   Zeile steht im Codeblock und darf lang bleiben.

### Schritt 4 — TSDoc und Kommentare in `src/` (Breite 100)

1. `display/Display.ts` Z. ~1749–1765, TSDoc von `dispose()`: der zweite Absatz (»Before it
   returns, `dispose()` stops the frame loop …«, Z. 1752 hat 111 Zeichen) umbrechen.
2. `display/AdaptiveResolution.ts` Z. 426–427, Kommentar im `else if (this.display.isRunning)`:
   vorher
   ```ts
   // a frame a paused display renders lies between no two animation frames of the page: its
   // rawDeltaTime is 0 and says nothing about the pace
   ```
   nachher
   ```ts
   // a frame a display renders while it is not running — paused, or not started yet — lies
   // between no two animation frames of the page and says nothing about the pace; paused, its
   // rawDeltaTime is 0
   ```
3. `stage/Stage2D.ts`, TSDoc von `updateFrame()` (Z. ~356–366): hinter dem ersten Absatz
   (endet »Does nothing on a disposed stage.«) einen Absatz einfügen:
   ```ts
   * A listener of `OnStageAfterCameraChanged` or `OnStageResize` that throws while that pending
   * update runs ends the frame: the camera and the size stand, the error reaches the caller —
   * one unchanged, several as an `AggregateError` — and neither `OnStageFirstFrame` nor
   * `OnStageUpdateFrame` goes out in it; the first frame comes with the next call.
   ```
   (eine Leerzeile ` *` davor und danach wie zwischen den übrigen Absätzen).
4. `stage/StageRenderer.ts`, TSDoc von `resize()` (Z. ~439–461): ans Ende des zweiten Absatzes
   (»While a stage refuses the size, …«, endet »… reaches the stages that moved past it.«) den
   Satz anhängen und den Absatz umbrechen:
   ```ts
   * A stage counts as refusing whenever its `resize()` throws — a {@link Stage2D} also throws
   * once it has taken the size, when a listener of its camera change or resize threw.
   ```
5. `stage/Canvas2DStage.ts`, TSDoc von `dispose()` (Z. ~306–311) — `setContainerSize()` steht
   unter »do nothing«, der Folgesatz schränkt ein. Vorher:
   ```ts
   * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, and `render()`,
   * `setCanvasSize()`, `setContainerSize()`, a write to `fit` and a further `dispose()` do nothing;
   * `setCanvasSize()` still refuses a size that is no finite number of 1 or more,
   * `setContainerSize()` one that is no finite number, and a write to `fit` one that is neither
   * `'contain'` nor `'cover'`.
   ```
   nachher (umbrochen nach R1, der Rest des Absatzes ab »`canvas`, `renderer`, …« bleibt):
   ```ts
   * Afterwards `isDisposed` is `true`, `texture` answers `undefined`, `render()` and a further
   * `dispose()` do nothing, and `setCanvasSize()`, `setContainerSize()` and a write to `fit`
   * change nothing — they still refuse what they refuse on a live stage: a size that is no finite
   * number of 1 or more, one that is no finite number, and a fit that is neither `'contain'` nor
   * `'cover'`.
   ```
6. `map2d/Map2DTileCoordsUtil.ts` — die Accessoren `xOffset`/`yOffset` (seit Paket 9) sind für
   Spread und `Object.keys()` unsichtbar, und `copy()`/`equals()` lesen die privaten Felder (am
   Laufbeginn lasen sie die öffentlichen Getter, `git show 7341059f:…Map2DTileCoordsUtil.ts`
   Z. 126–144); keine TSDoc sagt das.
   1. TSDoc von `xOffset` (Z. ~110–118): hinter »… is `-tileWidth / 2`.« diesen Satz einfügen,
      Absatz umbrechen:
      ```ts
      * Like {@link tileWidth}, {@link tileHeight} and {@link yOffset} it is an accessor: a spread
      * or `Object.keys()` of an instance does not list it.
      ```
   2. Über `copy()` (Z. ~159–162, unter dem bestehenden `//`-Kommentar, der bleibt):
      ```ts
      /**
       * Takes the tile size and the offsets of `source`. `source` is an instance of this class as
       * this copy of the library defines it; one of another copy throws a `TypeError`.
       */
      ```
   3. Über `equals()` (Z. ~174):
      ```ts
      /**
       * Whether `other` describes the same grid: the same tile size and the same offsets. `other`
       * is an instance of this class as this copy of the library defines it; one of another copy
       * throws a `TypeError`.
       */
      ```
7. `vertex-objects/InstancedVertexObjectGeometry.ts` Z. ~22, Konstruktor ohne TSDoc — darüber:
   ```ts
   /**
    * Builds the instanced pool and the base from a pool, a descriptor or a description each, or
    * takes the base from a `BufferGeometry`, as {@link InstancedVOBufferGeometry} does.
    *
    * @throws what the constructor of {@link InstancedVOBufferGeometry} throws. Whatever this
    *   constructor throws, a pool it built from a descriptor or description is disposed, and a
    *   pool handed in is left as it was.
    */
   ```
8. `texture/TileSet.ts`
   1. `@throws` des Konstruktors (Z. ~126–132), Grammatik — nachher:
      ```ts
      * @throws {RangeError} if `tileWidth` or `tileHeight` is not a finite number above 0, if `margin`,
      * `padding` or `spacing` is not a finite number of 0 or more, if `tileCount` is not a whole number
      * of 1 or more, if `firstId` is not a whole number, if the width or height of the `baseCoords` is
      * not finite, if the first tile does not fit into the `baseCoords` with its `margin` and
      * `padding`, if the tiles of a `tileCount` do not all fit into the `baseCoords`, if a `tileCount`
      * lies above {@link TileSet.MaxTiles}, or if more than `MaxTiles` tiles fit without a
      * `tileCount`; the atlas handed in is then left as it was.
      ```
   2. Kommentar über `static #cellsAlong()` (Z. ~233–238) — »the caller refuses both« gilt nur
      ohne `tileCount`. Vorher der Satz
      `A count past 2^53 is far over MaxTiles, and so is Infinity, which a tile of a denormal width yields: neither is corrected, and the caller refuses both.`
      nachher
      `A count past 2^53 is far over MaxTiles, and so is Infinity, which a tile of a denormal width yields: neither is corrected. Without a tileCount the caller refuses both; with one, the tiles of that count all fit into the first row, and the caller lays them there.`
      Kommentar umbrechen. (Belegt: `TileSet.ts:303–321` — die erste `assertFits()` greift nur
      ohne `tileCount`, die zweite lässt `tileCountLimit <= Infinity` durch, `i % columns` ist
      dann `i`.)
   3. R3 auf die einzeiligen Blöcke über 100 Zeichen: `TileSetOptions` (Z. 32, 142 Zeichen),
      `tileWidth` (Z. 149), `tileHeight` (Z. 154), `margin` (Z. 188), `padding` (Z. 193),
      `spacing` (Z. 198), `randomFrameId()` (Z. 216). Die `@throws`-Zeilen von `frameId()` und
      `frame()` (Z. 204, 222) und der Kommentar Z. 225 standen vor dem Lauf so und bleiben.
9. `utils/Dependencies.ts` Z. 14, `clone?` in `DependencyCallbacks`: R3.
10. `texture/AsepriteJson.ts`, TSDoc von `parse()`, Absatz »Refused, with the tag named: …«
    (Z. ~287–301, endet mit der Kurzzeile »with an `Error`. Every check runs before the« und
    »first frame is added …«): umbrechen.
11. `texture/TexturePackerJson.ts` Z. ~64–71, die drei `@throws` von `parse()` (Z. 64 hat 173
    Zeichen): umbrechen, Fortsetzungszeilen mit ` * ` wie heute.
12. `texture/TextureStore.ts`
    1. Listenpunkt »`Error`: fires with a {@link TextureStoreErrorEvent}, …« in der Klassen-TSDoc
       (Z. ~106–117, Z. 106 und 114 mit je 114 Zeichen): umbrechen, Fortsetzungseinzug ` *   `.
    2. TSDoc von `parse()`, Absatz »… Nor does a subscriber of a resource …« (Z. ~878–885,
       Z. 883 hat 131 Zeichen): umbrechen.
13. `text/readBitmapFontSource.ts` Z. ~87–90, Kommentar über `decodeEntities` — sagt zweimal
    »stays as it is written«. Nachher:
    ```ts
    // A numeric entity that is no char — beyond U+10FFFF, a surrogate, or too large for a number —
    // and a named entity outside the five of XML — `&constructor;` as well — stay as they are
    // written. An entity stands only in a text attribute (`face`, `charset`, `file`); in a number
    // field `BitmapFont` refuses the string anyway, naming the field
    ```
14. `sprites/passes/passFeatures.ts` Z. 37–38, `@throws` von `checkPass()` (134 Zeichen, über der
    `lineWidth` 130 von Biome, die Kommentare nicht umbricht): umbrechen.
15. `sprites/passes/definePass.ts` Z. ~47, `@throws` von `definePass()`: im Halbsatz
    »a RangeError for a `renderOrder` that is no finite number« `RangeError` in Backticks setzen,
    wie den `TypeError` darüber.
16. `sprites/runCheckKind.ts` Z. 4, TSDoc von `thrownMessage` (133 Zeichen): R3, `@internal`
    bleibt am Ende des Textes.

### Schritt 5 — `packages/twopoint5d/CHANGELOG.md`, nur `## [Unreleased]`

1. Z. 21 (`### Added`, `AsepriteJson.parse()`): `; so is a frame without a duration above 0` →
   `; so are a frame without a duration above 0` (das Subjekt ist eine Aufzählung).
2. Z. 115 (`### Changed`, `Chronometer#update()`) — ganzer Eintrag nachher:
   `` - `Chronometer#update()` on a stopped chronometer sets `deltaTime` and `rawDeltaTime` to `0`: no active phase elapses in a pause. `stop()` leaves both as they are until the next `update()` (**BREAKING**). See the Migration Guide ``
   (der Satz »Code that still needs …« zieht in den Abschnitt aus 5.9).
3. Z. 130 (`### Changed`, Offsets von `Map2D`/`Map2DTileStreamer`) — ans Ende des Eintrags
   (ohne Schlusspunkt, wie die Einträge enden) anhängen:
   ``. `xOffset` and `yOffset` of `Map2DTileCoordsUtil` are accessors, as `tileWidth` and `tileHeight` are: a spread, `Object.keys()` or a comparison field by field of an instance lists none of the four, and `copy()` and `equals()` take only an instance of the class this copy of the library defines — one of another copy throws a `TypeError` ``
   Kein **BREAKING**: der Spread einer Klasseninstanz ist keine zugesagte Schnittstelle.
4. Z. 146 (`TextureAtlas#randomFrameIds()` …) — Nachsatz ohne Vorgeschichte. Vorher
   `` (**BREAKING**): a fractional `count` returned entries, `NaN` and a negative one `[]`, and `Infinity` ran until memory was full. See the Migration Guide ``
   nachher
   `` (**BREAKING** for a fractional `count`, `NaN` and a negative one). See the Migration Guide ``
5. Z. 219 (`### Fixed`, `attachInstancedPool()`): `a pool handed in is no longer counted as
   attached` → `a pool handed in is left unattached`. (Der Kommentar
   `InstancedVOBufferGeometry.ts:194–195` mit »no longer« bleibt: dort ist der Bezug der `catch`.)
6. Migration Guide, Abschnitt »`Stylesheets.getGlobalSheet()`« (Z. ~569–588):
   - den Einleitungssatz ergänzen →
     `` There is one sheet per document or shadow root. `Stylesheets.getSheet()` takes the same `root`, so `getSheet(shadowRoot)` replaces `getGlobalSheet(shadowRoot)` one for one. ``
   - **After** nachher:
     ````markdown
     ```ts check
     import {Stylesheets} from '@spearwolf/twopoint5d';

     declare const shadowRoot: ShadowRoot;

     const sheet = Stylesheets.getSheet(shadowRoot);

     export {sheet};
     ```
     ````
     (`Stylesheets.getSheet(root: HTMLElement | ShadowRoot = document.head)`,
     `src/display/Stylesheets.ts:108`.)
7. Migration Guide `#### A catalog item with a field its type does not read` (Z. ~633–656),
   **After**: `const store = TextureStore.loadAsync('catalog.json');` →
   `const store = await TextureStore.loadAsync('catalog.json');` und
   `const loaded = lenient.loadAsync('catalog.json');` →
   `const loaded = await lenient.loadAsync('catalog.json');` — wie im **Before**; geprüfte
   Blöcke erlauben Top-Level-`await` (`docs/sprites.md` tut es, z. B. Z. ~1015).
8. Migration Guide `#### More than 64 views in tableFrame()` (Z. ~865–887) — der **After**-Block
   zeigt nur ein Gerüst (`const feature = TableFrame;`, `view` ohne Herkunft). Nachher, nach dem
   Muster von `docs/sprites.md:549–583`:
   ````markdown
   ```ts check
   import {
     defineSprite,
     FeatureSprites,
     FlatPlacement,
     FrameTable,
     InstancePosition,
     QuadBase,
     QuadSize,
     TableFrame,
     type TextureAtlas,
     TextureColor,
   } from '@spearwolf/twopoint5d';
   import type {Texture} from 'three/webgpu';

   declare const atlas: TextureAtlas; // ship_000 … ship_<n>, 128 views a frame, frame by frame
   declare const colorMap: Texture;

   const VIEWS = 128;
   const Ship = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TableFrame, TextureColor]});
   const frameTable = FrameTable.fromAtlas(atlas, /^ship_/).bakeDataTexture(); // the caller's
   const ships = new FeatureSprites(Ship, {
     capacity: 16,
     attributeUsage: {dynamic: ['frameIndex']},
     textures: {colorMap, frameTable},
   });

   const ship = ships.createSprite()!;
   ship.setSize(64, 64);

   // every frame: the entry of frame `frame` in the view the game picks from the camera, 0 to 127
   export function show(frame: number, view: number) {
     ship.frameIndex = frame * VIEWS + view;
   }
   ```
   ````
   Typcheckt der Block nicht, nur so weit anpassen, dass er es tut, und die Abweichung in den
   Report schreiben; der Inhalt bleibt: eine Art mit `TableFrame` ohne `views`, eine gebackene
   Frame-Tabelle, `frameIndex = frame * VIEWS + view`.
9. Neuer Abschnitt am Ende von `### Migration Guide` (nach `#### A sprite kind that did not come
   from defineSprite()`, Z. ~1039–1060, vor `## [0.23.0]`):
   ````markdown
   #### The deltas of a stopped Chronometer

   An `update()` of a stopped `Chronometer` sets `deltaTime` and `rawDeltaTime` to `0`, and so does a `renderFrame()` of a paused `Display` for the props it hands out. Code that needs the delta of the last running frame reads it before that `update()`.

   **Before**

   ```ts
   chronometer.stop();
   chronometer.update();
   const last = chronometer.deltaTime; // the delta of the last running frame
   ```

   **After**

   ```ts check
   import {Chronometer} from '@spearwolf/twopoint5d';

   const chronometer = new Chronometer();
   // read before the update() of the pause, which sets it to 0
   const last = chronometer.deltaTime;
   chronometer.stop();
   chronometer.update();

   export {last};
   ```
   ````
   Grund: jeder andere **BREAKING**-Eintrag unter `[Unreleased]` verweist auf einen Abschnitt
   des Migration Guide, und der Skill `updating-changelog` verlangt ihn für eine geänderte
   Semantik öffentlicher API (`Chronometer` ist über `src/display/public-api.ts:4` exportiert).

### Schritt 6 — Kommentare in Tests

1. `packages/twopoint5d-testing/test/harness-rejections.test.js` Z. 6, letzter Satz des
   Kopfkommentars — vorher
   `// init script of web-test-runner.config.js that takes the control off the page to each other.`
   (mit dem Satzanfang »This file holds the helper and the« aus Z. 5); nachher der Satz
   `This file checks that the helper and the init script of web-test-runner.config.js that takes the control off the page work together.`
   — Kopfkommentar bei 100 Zeichen umbrechen.
2. `packages/twopoint5d/src/vertex-objects/vertex-buffers-geometry-updates.spec.ts`
   Z. ~1809–1813, Kommentar über `describe('the arrays three gets are the arrays of the pool')`
   (Z. 1812 hat 132 Zeichen): umbrechen.

### Schritt 7 — Gate

`pnpm run ci` (prüft die `ts check`-Blöcke des CHANGELOG über `checkDocSnippets`, Lint und
Typen). Rot ist ein Befund dieses Pakets.

## Abgleich

Gegen HEAD 73af32b4, Arbeitsbaum sauber (nur Plan und Paketdateien ungetrackt). Zeilen sind die
von heute; in Klammern die Zeile aus dem Urteil des Reviewers, wo sie abweicht.

**Offen, unverändert oder nur verschoben** (je Schritt oben):

- Paket 1: `docs/architecture.md` §3 (184–186 → 195), (210–211 → 220), §5 (440–442 → 439).
- Paket 2: `docs/architecture.md` (224/251/408/464/468 → 233, 269, 439, 495, 499).
- Paket 3: `docs/architecture.md:141` Doppel-Leerzeichen.
- Paket 4: `AdaptiveResolution.ts:426` und `docs/display.md:248` »paused«; CHANGELOG Z. 115 ohne
  **BREAKING**; Migration Guide `getGlobalSheet()` ohne den Satz; `Display.ts:1752` (111).
- Paket 5: TSDoc `Stage2D#updateFrame()` — der Pfad »Kamera-/Resize-Listener wirft beim
  ausstehenden `needsUpdate`« fehlt (den First-Frame-Fall hat Paket 18 beschrieben);
  `StageRenderer#resize()`/README — Listener-Fehler als Weigerung unbeschrieben.
- Paket 6: TSDoc `TextureStore.ts` (96 → 106/114), (857 → 883); `docs/sprites.md` (418 → 440);
  CHANGELOG Migration Guide »A catalog item …« ohne `await` (588 → 650–655).
- Paket 7: CHANGELOG Z. 21 »so is«; Proposal `wave-and-segment-sprites.md:336` ohne Labels.
- Paket 9: `Map2DTileCoordsUtil` — Accessoren und `copy()`/`equals()` in CHANGELOG und TSDoc
  ungenannt.
- Paket 10: CHANGELOG `ts check`-Block »More than 64 views« (830–848 → 865–887) als Gerüst.
- Paket 11: `readBitmapFontSource.ts` (89–91 → 87–90) »stays as it is written« zweimal.
- Paket 12: CHANGELOG (45 → 219) »no longer counted as attached«; `resource-lifecycle.md`
  (111–114 → 50); `InstancedVertexObjectGeometry.ts:22` ohne TSDoc;
  `vertex-buffers-geometry-updates.spec.ts` (1803–1805 → 1809–1813).
- Paket 13: `TileSet.ts` `@throws` (118–123 → 126–132), `#cellsAlong()` (217 → 233–238).
- Paket 14: `docs/architecture.md` §3 »before it« (Z. 260); `harness-rejections.test.js:6`.
- Paket 15: TSDoc `Canvas2DStage#dispose()` — von Paket 18 umgeschrieben, nennt
  `setContainerSize()` weiter unter »do nothing«.
- Paket 18: `AGENTS.md:59`; `docs/text.md:205` (`z`).
- Paket 19: `AsepriteJson.ts` (301–302 → 300–301); `TexturePackerJson.ts:64`; `docs/sprites.md:376`;
  `TileSet.ts` Einzeiler (Kopf und sechs Member, Z. 32/149/154/188/193/198/216);
  `Dependencies.ts:14`; CHANGELOG (142 → 146).
- Paket 20: `docs/sprites.md` (2219–2220 → 2232–2234); `sprite-features.md` (769 → 788);
  `definePass.ts` (46 → 47).
- Paket 21: `docs/sprites.md` (1677–1681 → 1673–1683).
- Paket 22: `passFeatures.ts:37`; `sprite-features.md` Absatz `SpriteResources` (Z. 635) und
  `docs/sprites.md` (2077–2082 → 2079–2082, dazu 2032 im selben Zusatz »finite«).

**Erledigt durch ein späteres Paket**

- Paket 20 → `FeatureSprites.ts:307` (`@throws` des Konstruktors nicht umbrochen): Paket 21
  (ccf8754f) hat den Block neu geschrieben, `FeatureSprites.ts:333–343` liegt bei höchstens 102
  Zeichen im Block der Datei.
- Paket 10 → `FeatureSprites.ts:541–542` (`checkFeature()` hinter `if (this.#material == null)
  return;`): Paket 20 (898cf144), heute `FeatureSprites.ts:588–595` — `checkFeature()` und
  `checkPlacementStandIn()` laufen vor der Rückkehr.

**Gegenstandslos**

- Paket 9 → `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:72`
  (`private renderChunkFrame(`): die Regel »Private members« in `AGENTS.md` gilt
  `packages/twopoint5d/src`, nicht dem Lookbook; der Reviewer hat das selbst vermerkt.
- Paket 10 → `docs/superpowers/plans/2026-10-08-sprite-uniform-bindings.md:1288–1365`: ein
  datierter Arbeitsplan, kein Vertrag; er beschreibt, was am 2026-10-08 geplant war. Der
  Vertrag ist `docs/proposals/sprite-uniform-bindings.md`, den Paket 10 nachgezogen hat. Ein
  nachträglich umgeschriebener Plan fälschte die Aufzeichnung.
- Paket 1 → `docs/architecture.md:210` / `ci.yml:101` (Audit-Timeout): laut Reviewer stimmen
  Text und Verhalten (»an audit that times out leaves the job green«) — kein Befund.

**Nicht hier, sondern in Paket 24** (Code, Tests, Meldungen; im Plan unter »Umfang« von 24
nachgetragen): Paket 2 `sprites-picking.test.js:84–85` (doppelte Freigabe über `keep()`),
Paket 5 `Canvas2DStage.ts` `render()` (Größenwechsel in einem `OnCanvas2DStageRender`-Listener
einen Frame zu spät), Paket 6 `TextureStore.ts` `#writeItems()` (`catch` um Schleife und
Flush), `#getOnce()` (99 Zeilen), ungetestete Kante `#refusalsWithoutResource`, Paket 11
`planeOf.ts:20–25` (`isPlane` ohne `normal`), `bindings.spec.ts:263–268` (zweites
`test.each`), `isObject3D` doppelt in `lightOf.ts`/`planeOf.ts`, Paket 14
`harness-rejections.test.js` (Logs nach Timeout), Paket 15 `Canvas2DStage.spec.ts`
(Disposed-Zweig prüft nur die Breite).

## Triage der offenen Folgen und Befunde

- **Folgen ohne Reviewer-Nennung, gleiche Ursache** (Absätze, die dieser Lauf geschrieben und
  nicht umbrochen hat; gefunden mit einem Abgleich aller `.md`-Dateien gegen
  `git show 7341059f:<pfad>` — neue Prosazeilen über der Breite der Datei — und aller
  Kommentarzeilen in `src/` über 130 Spalten): `README.md:167`,
  `animation-playback-and-aseprite.md:301/313/316`, `gpu-picking.md:106`,
  `resource-lifecycle.md:49/114/296–298`, `runCheckKind.ts:4`. Symptome derselben Ursache wie
  die Reviewer-Befunde, also in dieses offene Paket, nicht in ein eigenes.
- **Nebenbefund, vorbestehend, gleiche Ursache:** `docs/sprites.md:1181` (124) und `:2012` (113)
  standen am Laufbeginn so (`git show 7341059f:…sprites.md`, Z. 1151 und 1970); dieselbe Datei,
  derselbe Handgriff wie Schritt 2.1 — mitgenommen wie die vorbestehenden Zeilen von `AGENTS.md`,
  die der Plan schon einschließt. Kein Eintrag in »Offene Befunde«.
- **Kommentarzeilen in `src/` zwischen 101 und 130 Spalten**, die kein Reviewer genannt hat
  (z. B. `FeatureSpritesMaterial.ts:107`, `cameraNodes.ts:26`, `DynamicAtlas.ts:31`): bleiben.
  Die Library hatte am Laufbeginn rund 20 Kommentarzeilen über 110 Spalten; die Breite der
  Kommentare ist keine Regel des Projekts, Biome hält `lineWidth` 130. Die Grenze dieses Pakets:
  was ein Reviewer genannt hat, und was über 130 steht.
- **»Offene Befunde« im Plan:** beide offenen Einträge (Meldungen der Sprite-Schicht ohne Wert,
  `spriteDeclarations.ts:102` ohne »finite«) sind Code und stehen schon bei Paket 24.
- **Generationsregel:** Paket 23 hängt an Paket 14, 15 und 22, die selbst `Folge von:` tragen
  (2, 5, 10). Paket 22 ist damit die erste Generation der Kette ab Paket 10, Paket 23 die
  zweite — die dritte, an der `runner.md` anhalten lässt, wäre erst eine Folge von Paket 23, und
  die Entscheidung vom 2026-10-24 schickt, was die Nachlese liefert, ins Audit. Auch der Sache
  nach greift die Regel nicht: was aus 14, 15 und 22 kommt, sind Umbrüche, ein schiefer Satz
  und eine Aufzählung in einer TSDoc — kein Defekt, den der Weg von Paket 2, 5 oder 10
  nachproduziert.

## Restplan

Unverändert: 23 vor 24. Paket 24 bekommt die elf Code- und Testbefunde oben in seine Zeile
»Umfang« — sie lagen in denselben Reviewer-Urteilen wie seine übrigen Punkte. Beide Pakete
berühren nacheinander `TileSet.ts`, `AsepriteJson.ts`, `TexturePackerJson.ts`,
`passes/passFeatures.ts` und `CHANGELOG.md` (23 nur TSDoc und bestehende Einträge, 24 Code);
Zug 0 von 24 plant gegen den Stand nach diesem Commit.

## Befunde im Volltext

Die kleinen Befunde der Reviewer, wie sie in `docs/remediation/paket-<N>.md` stehen (nur die,
die dieses Paket behebt oder abgleicht).

**Paket 1** (`paket-1.md`, »Urteil des Reviewers (Zug 3)«)
- `docs/architecture.md:184-186` (§3 »In CI«) — Zeile deutlich länger als der ~90-Zeichen-Umbruch
  der Datei, Absatz gehört neu umbrochen.
- `docs/architecture.md:210-211` (§3, Absatz zum Audit-Schritt) — dasselbe.
- `docs/architecture.md:440-442` (§5) — kurz geratener Umbruch, unkritisch.
- `docs/architecture.md:210` / `ci.yml:101` — die Warnung greift nur bei einem Registry-Fehler mit
  Exit ≠ 0; ein Timeout bricht den Schritt vor der `if`-Verzweigung ab und meldet nichts. Die
  Doku sagt das (»an audit that times out leaves the job green«), Text und Verhalten stimmen also.

**Paket 2**
- `docs/architecture.md:224, 251, 408, 464, 468` — fünf Zeilen aus den WebKit-Ergänzungen mit
  92–98 Zeichen, die Datei bricht sonst bei etwa 90 um

**Paket 3**
- `docs/architecture.md:141`: zwei Leerzeichen hinter dem Listenmarker des Bullets
  `checkNameableTypes`, alle anderen Bullets haben eines (aus dem Neuumbruch in Runde 2;
  Rendering identisch).

**Paket 4**
- `AdaptiveResolution.ts:422`: `isRunning` ist auch vor dem ersten `start()` `false`; TSDoc und
  `docs/display.md` sprechen nur vom pausierten Display — »not running (paused, or not started
  yet)« wäre genauer.
- `CHANGELOG.md` `Changed`-Eintrag zu `Chronometer#update()`: Verhaltensänderung öffentlicher API
  ohne **BREAKING**-Marke; Migrationssatz steht inline.
- `CHANGELOG.md` Migration Guide `Stylesheets.getGlobalSheet()`: **Before** zeigt `shadowRoot`,
  **After** `document.head` (wegen `ts check`); ein Satz, dass `getSheet(shadowRoot)` eins zu
  eins ersetzt, fehlt.
- `Display.ts` TSDoc von `dispose()`: eine Zeile mit ~110 Zeichen bricht den Umbruch des Absatzes.

**Paket 5**
- `packages/twopoint5d/src/stage/Stage2D.ts:356–359` — TSDoc von `updateFrame()` nennt nur Fehler
  der Projektion aus dem ausstehenden `needsUpdate`; ein werfender Kamera- oder Resize-Listener
  in diesem Schritt beendet den Frame ohne `OnStageFirstFrame`/`OnStageUpdateFrame`, ein
  werfender First-Frame-Listener lässt ihn weiterlaufen — so geplant, aber nirgends beschrieben.
- `packages/twopoint5d/src/stage/StageRenderer.ts:534` — ein Listener-Fehler der Stage nach
  angenommener Größe zählt in `resizeStage()` als Weigerung; Renderer und `StageItem` bleiben bis
  zum nächsten `resize()` auf der alten Größe. Im Detailplan hingenommen, in TSDoc und README
  nicht genannt.

**Paket 6**
- `TextureStore.ts:96` und `:857` — TSDoc nach dem Einfügen nicht neu umbrochen (114 bzw. 131
  Zeichen, Rest des Blocks bei etwa 100).
- `packages/twopoint5d/docs/sprites.md:418` — derselbe Umbruchfehler im Fließtext (121 Zeichen).
- `packages/twopoint5d/CHANGELOG.md:588` — im »After«-Block des Migration Guide ist `store` ein
  `Promise<TextureStore>`, das `await` aus »Before« fehlt; geprüfte Blöcke erlauben
  Top-Level-`await` (`docs/sprites.md:992`).

**Paket 7**
- `packages/twopoint5d/CHANGELOG.md:21` — »so is« vor einer Aufzählung im Plural, richtig »so are«.
- `packages/twopoint5d/docs/proposals/wave-and-segment-sprites.md` (Codeauszug §4.2) — `wrap` ohne
  die Labels `[u:, v:]` des Codes; Auszug, kosmetisch.

**Paket 9**
- `Map2DTileCoordsUtil.ts:118–143, 161–181` — `xOffset`/`yOffset` sind Accessoren auf dem
  Prototyp: Spread, `Object.keys()` oder `toEqual()` beim Konsumenten sehen die Offsets nicht
  mehr; `copy()`/`equals()` werfen für eine Instanz aus einer anderen Kopie der Library einen
  `TypeError`. Beides folgt aus Entscheidung 5 und dem Vorgehen (»`copy()`/`equals()` über die
  privaten Felder«); CHANGELOG und TSDoc nennen es nicht.
- `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:72` — `private
  renderChunkFrame(` bleibt; die Regel gilt nach Entscheidung 1 nur `packages/twopoint5d/src`.

**Paket 10**
- `FeatureSprites.ts:541–542` — `checkFeature()` läuft nach `if (this.#material == null)
  return;`, ein kaputtes Feature wird auf einer disposten Instanz still geschluckt; Reihenfolge
  nach Detailplan, dasselbe Muster wie `bindUniform()` (vorbestehend, als Nebenbefund in »Offene
  Befunde«)
- `CHANGELOG.md:830–848` — der `ts check`-Block unter »More than 64 views« typcheckt, zeigt aber
  nur ein Gerüst (`const feature = TableFrame;`, `show()` ohne Herkunft von `view`)
- `docs/superpowers/plans/2026-10-08-sprite-uniform-bindings.md:1288–1365` (Arbeitsablage, kein
  Vertrag) beschreibt noch die parallelen Arrays der Bindungen (Meldung des Implementierers)

**Paket 11**
- `readBitmapFontSource.ts:89–91` — der ergänzte Kommentar über `decodeEntities()` sagt zweimal
  »stays as it is written«.

**Paket 12**
- `packages/twopoint5d/CHANGELOG.md:45` — »a pool handed in is no longer counted as attached«
  liest sich als Vergleich mit der alten Version; besser »is left unattached« (dasselbe »no
  longer« im Kommentar `InstancedVOBufferGeometry.ts:194–195`, dort aus dem `catch` heraus
  eindeutig)
- `packages/twopoint5d/docs/resource-lifecycle.md:111–114` — »the pools they build from a
  descriptor«; der Konstruktor von `InstancedVOBufferGeometry` baut auch aus einer
  `VertexObjectDescription`
- `InstancedVertexObjectGeometry.ts:22` — Konstruktor ohne eigene TSDoc, die Zusage zum Wurf
  steht nur an `InstancedVOBufferGeometry`
- `vertex-buffers-geometry-updates.spec.ts:1803–1805` — geänderter Kommentar nicht neu umbrochen

**Paket 13**
- `TileSet.ts:217` — der Kommentar von `#cellsAlong()` sagt »the caller refuses both« (Zahl über
  2^53, `Infinity`); das gilt nur ohne `tileCount`, mit `tileCount` nimmt der Aufrufer
  `fitting = Infinity` an und legt alle Tiles in die erste Zeile (Verhalten richtig, Kommentar
  ungenau).
- `TileSet.ts:118–123` — den neuen Gliedern der `@throws`-Aufzählung fehlen »if« und vor dem
  letzten Glied »or«; Inhalt stimmt, Satz grammatisch kaputt.

**Paket 14**
- `harness-rejections.test.js:6` — »… takes the control off the page to each other« grammatisch
  schief.
- `docs/architecture.md` §3, neuer Absatz — »waits for the browser to report every rejection
  before it«, Bezug von »it« holprig.

**Paket 15**
- Die `dispose()`-TSDoc zählt `setContainerSize()` noch unter »do nothing« auf, der Folgesatz
  schränkt ein (Wortlaut war vorgegeben).

**Paket 18**
- `AGENTS.md:59` — umbrochene Zeile mit 91 Zeichen (die Datei hat 17 weitere solche).
- `docs/text.md:205` — »`layoutText()` refuses its options … as `writeText()` does«;
  `layoutText()` kennt kein `z`.

**Paket 19**
- `src/texture/AsepriteJson.ts:301–302` — »Refused«-Absatz der TSDoc bricht holprig um
- `src/texture/TexturePackerJson.ts:64` — `@throws {TypeError}`-Zeile weit über ~100 Spalten
- `docs/sprites.md:376` — neuer Absatz als eine Zeile von ~330 Zeichen
- `src/texture/TileSet.ts` (Kopf `TileSetOptions`, `tileWidth`, `tileHeight`, `margin`, `padding`,
  `spacing`, `randomFrameId`) und `src/utils/Dependencies.ts:14` — einzeilige TSDoc-Blöcke über
  110–140 Zeichen
- `CHANGELOG.md:142` — Nachsatz zum Bruch beschreibt den Vorzustand ausführlicher als geplant

**Paket 20**
- `docs/sprites.md:2219–2220`: »and so does it `features` that are no list, …« ist grammatisch
  schief.
- `docs/proposals/sprite-features.md:769`: Zeile nicht umbrochen.
- `FeatureSprites.ts:307`: `@throws`-Zeile des Konstruktors nicht umbrochen.
- `definePass.ts:46`: `RangeError` ohne Backticks, `TypeError` darüber mit.

**Paket 21**
- Umbruch des Absatzes `docs/sprites.md:1677–1681` ungleichmäßig (Runde 1, offen gelassen)

**Paket 22**
- `passes/passFeatures.ts:37` — die `@throws`-Zeile ist mit etwa 135 Zeichen länger als
  `lineWidth` 130, Lint merkt es nicht.
- `docs/proposals/sprite-features.md` (Absatz `defineFeature()` und `SpriteResources`) und
  `docs/sprites.md` Z. ~2077–2082 — unregelmäßige Umbrüche nach den Zusätzen (eine Kurzzeile,
  eine überlange).


## Urteil des Reviewers

- Schritt 1 (Wurzel-Doku): erfüllt — `docs/architecture.md` Doppel-Leerzeichen weg, Satz zu unbehandelten Rejections wörtlich, Absätze ≤ 90; `AGENTS.md`, `README.md` reine Umbrüche.
- Schritt 2 (Guides): erfüllt — `sprites.md` inkl. 1181/2012 und »The shape.«; `text.md` »all but `z`«; `display.md` »not running — paused, or not started yet«; `resource-lifecycle.md` »descriptor or a description«; `stage/README.md` neuer Absatz, gegen `StageRenderer.ts:509–513` geprüft.
- Schritt 3 (Proposals): erfüllt.
- Schritt 4 (TSDoc `src/`): erfüllt (4.1–4.16).
- Schritt 5 (CHANGELOG `[Unreleased]`): erfüllt (5.1–5.9), freigegebene Abschnitte unberührt.
- Schritt 6 (Testkommentare): erfüllt.
- Schritt 7 (Gate): `pnpm run ci` exit=0.

Kleine Befunde:
1. `CHANGELOG.md:~1088ff`, Migration Guide »The deltas of a stopped Chronometer«, After-Block liest `deltaTime` an einem frischen `Chronometer` ohne `update()` — Wortlaut stammt aus dieser Paketdatei; als `Folgen:` im Plan für Paket 24.
2. Ebendort »and so does a `renderFrame()` of a paused `Display`« nur oberflächlich gegen `Display.ts` geprüft, passt zum Eintrag aus Paket 4.

Nebenbefund des Implementierers: `Map2DTileCoordsUtil.ts:172` 125 Zeichen Code — vorbestehend, Code, deshalb nicht hier; Queue mit → Scope (Paket 24).
