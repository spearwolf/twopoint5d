# Paket 26 — Drain 3: TSDoc und Kommentare im Library-Code, Import-Reihenfolge

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (17 »klein«-Befunde der Reviewer und Abweichungen aus den committeten Paketen,
  überführt in der Drain-Runde 3, Entscheidung »Drain-Runde 3« im Plan; Wortlaut und Abgleich
  unten). Dazu aus Zug 0: sieben Testtexte mit dem alten Namen `restoreCursor` und ein Spec-Titel
  mit »integer of 0 or more« (Symptome der Pakete 10 und 11), eine laufbedingte Kurzzeile in
  `VOBufferPool.ts` (Paket 10) und acht vorbestehende Absätze derselben Ursache (Begründung unter
  »Entscheidungen im Zug 0«)
- Ziel: Jedes genannte TSDoc und jeder genannte Kommentar ist eindeutig, wiederholt sich nicht,
  nennt die Events mit ihren heutigen Namen und ist wie seine Nachbarn umbrochen; Imports und
  Leerzeilen folgen der Umgebung. Dazu: jeder Kommentarabsatz der Library, in dem eine Zeile ihre
  Nachbarn um 10 Spalten und mehr überragt und über 110 liegt, ist auf höchstens 100 Spalten
  umbrochen, und kein Testtext nennt ein Event der Pan-Control mit seinem alten Kurznamen.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/`:
    - `controls/PanControl2D.ts`, `controls/PanControl2D.spec.ts`
    - `display/DisplayFullscreen.ts`, `display/DisplayFullscreen.spec.ts`
    - `map2d/CameraBasedVisibility.ts`, `map2d/RectangularVisibilityArea.ts`,
      `map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts`
    - `sprites/FeatureSprites/FeatureSprites.ts`, `sprites/features/SegmentPlacement.ts`
    - `stage/matte.spec.ts`
    - `text/writeText.ts`
    - `texture/AsepriteJson.ts`, `texture/DynamicAtlas.ts`, `texture/FrameBasedAnimations.ts`,
      `texture/TextureFactory.ts`, `texture/TextureStore.ts`, `texture/TileSet.ts`
    - `vertex-objects/InstancedVOBufferGeometry.ts`, `vertex-objects/VOBufferPool.ts`,
      `vertex-objects/VertexObjectBuffer.ts`, `vertex-objects/VertexObjectBuffer.spec.ts`,
      `vertex-objects/VertexObjectDescriptor.ts`, `vertex-objects/VertexObjectGeometry.ts`,
      `vertex-objects/VertexObjectPool.ts`, `vertex-objects/types.ts`
  - `packages/twopoint5d-testing/test/`: `vertex-objects-heap.test.js`, `stage-masks.test.js`,
    `pan-control-cursor.test.js`, `pan-control-input.test.js`, `pan-control-switch-off.test.js`
  - sonst nichts: keine Zeile Verhalten, keine Fehlermeldung, kein Markdown, kein CHANGELOG, kein
    Guide. Geändert werden nur Kommentare (`//`, `/** … */`), drei Import-Anweisungen, eine
    Leerzeile, Titel von `describe`/`it`/`test`, Beschriftungen von `expect(…, '<label>')` und die
    Meldungstexte zweier Test-Fehlerobjekte, die ein Spec selbst wirft
- Verify: `pnpm run ci`
- Commit: `docs: reflow the comments a sentence was added to, name the cursor events of the pan control by their constants, call a capacity or offset of 0 or more a whole number and say once and exactly what the heap test, the visibility area, writeText and the fullscreen checks do`

## Regeln für jede Zeile

- Englisch, im Ton des umgebenden Textes. Keine Finding-IDs, keine Paketnummern, kein Rückblick
  (»no longer«, »now«, »used to«, »renamed«).
- **Breite.** Jede Kommentarzeile, die dieses Paket schreibt oder umbricht, hält höchstens
  **100 Spalten**, gezählt samt Einzug und `*` bzw. `//`. Länger nur, wenn ein einzelnes Stück ohne
  Leerzeichen es erzwingt (ein Link-Ziel, ein Code-Span ohne Leerzeichen). Fortsetzungszeilen
  behalten den Einzug, den der Absatz schon hat (`@throws`/`@param`: zwei Leerzeichen nach `*`;
  Listenpunkt `2.`: drei Leerzeichen).
- **Neu umbrechen** heißt: von der ersten Zeile der genannten Stelle an die Zeilen bis zur Breite
  füllen, und zwar bis der neue Umbruch wieder auf einen bestehenden Zeilenumbruch trifft oder der
  Absatz (im TSDoc: bis zur nächsten Zeile ` *` oder dem nächsten `@`-Tag; im `//`-Block: bis zur
  nächsten Codezeile) endet. Kein Absatz endet mit einer Kurzzeile mitten im Text; eine kurze
  letzte Zeile am Absatzende ist in Ordnung.
- **Reiner Umbruch ändert kein Wort.** Wo ein Schritt nicht ausdrücklich einen neuen Wortlaut
  vorgibt, bleibt jedes Wort und jedes Satzzeichen, auch ein `—,`, das einem nicht gefällt.
- **Nicht angefasst**: einzeilige Kommentare (`/** … */` auf einer Zeile, ein einzelnes `//`),
  auch wenn sie über 100 liegen — sie folgen der Codebreite 130 von `biome.jsonc`; Codezeilen;
  alles, was kein Schritt nennt.
- **Prüfung danach**, beide Ausgaben gehören in den Report:

  ```bash
  # 1. keine geschriebene oder umbrochene Kommentarzeile über 100 Spalten (das + zählt mit)
  git diff -U0 -- packages/twopoint5d/src packages/twopoint5d-testing/test \
    | grep -E '^\+\s*(\*|//)' | awk 'length($0) > 101'
  # 2. die Wortänderungen
  git diff --word-diff=porcelain -- packages/twopoint5d/src packages/twopoint5d-testing/test \
    | grep -E '^[-+][^-+]'
  ```

  Die erste muss leer sein (Ausnahme nur ein Stück ohne Leerzeichen über 100, dann im Report
  benennen). Die zweite darf genau die Wortänderungen zeigen, die die Schritte unten vorgeben —
  dazu die verschobenen Import-Zeilen der Schritte 2 und 13 —, und keine weitere.
- Zusätzlich müssen danach leer sein:

  ```bash
  git grep -n -E "\b(restoreCursor|hideCursor)\b" -- packages/twopoint5d/src packages/twopoint5d-testing/test \
    | grep -v -E "on(Restore|Hide)Cursor|#(restore|hide)Cursor"
  git grep -n "integer of 0 or" -- packages/twopoint5d/src
  git grep -n "Expects the search to have kept it" -- packages/twopoint5d/src
  ```

## Vorgehen

Zeilennummern gelten für `5edbc74f`. Die Schritte 1–17 folgen der Reihenfolge der Stellen unter
»Abgleich«, 18–26 sind die Zusätze aus Zug 0.

1. **`packages/twopoint5d-testing/test/vertex-objects-heap.test.js:28-32`** — im Satz
   »Disposing the material every 20 rounds leaves about 2.5 KB per round (1.8 % over 100 rounds,
   measured as above).« die Klammer zu `(1.8 % over 100 rounds under WebGL2 and 1.9 % under
   WebGPU, measured as above)` erweitern (gemessen 1,82 % WebGL2 / 1,93 % WebGPU auf Chromium 156
   mit three 0.187.0, Report von Paket 1). Den Absatz `:28-32` neu umbrechen. `MAX_HEAP_GROWTH`
   und jeder andere Satz bleiben.
2. **`packages/twopoint5d-testing/test/stage-masks.test.js:16-26`** — in der Import-Liste aus
   `./helpers/fixtures.js` steht `countNodeBuilds,` hinter `disposeDisplay,`; `countNodeBuilds,`
   vor `disposeDisplay,` setzen. Danach ist die Liste alphabetisch: `countNodeBuilds`,
   `disposeDisplay`, `disposeKept`, `isNearColor`, `keep`, `makeContainer`, `makeFilledStage`,
   `readsTopDown`, `rgbAt`.
3. **`packages/twopoint5d/src/texture/AsepriteJson.ts:330-346`** (TSDoc von `parse()`, Absatz
   »Refused, with the tag named: …«) — `:334` hat 114 Spalten. Ab `:334` neu umbrechen, kein Wort
   ändern. **`packages/twopoint5d/src/texture/FrameBasedAnimations.ts:408-415`** (TSDoc von
   `add()`, Absatz »What picks the frames is refused as well …«) — `:410` endet nach 68 Spalten
   mitten im Satz (»a `tileCount` that is no«). Ab `:410` neu umbrechen, kein Wort ändern.
4. **`packages/twopoint5d/src/sprites/features/SegmentPlacement.ts:61-65`** (TSDoc von
   `segmentPlacement()`) — `:64` endet nach »So is a kind with `NineSlice`,« mitten im Satz. Ab
   `:64` neu umbrechen, kein Wort ändern. Die `@throws`-Zeilen `:67-68` desselben Blocks gehören
   zu Schritt 18.
5. **`packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:335-345`** (`@throws` des
   Konstruktors) — `:340` hat 118 Spalten. Ab `:340` neu umbrechen (Fortsetzungseinzug zwei
   Leerzeichen), kein Wort ändern.
6. **Cursor-Events der Pan-Control mit ihren heutigen Namen.** Kommentare nennen die Konstanten
   (wie die TSDocs `PanControl2D.ts:462`, `:502`, `:820`), Specs der Library nennen die
   Abonnier-Methode (wie die Titel `PanControl2D.spec.ts:568`, `:642`, `:658`):
   - `packages/twopoint5d/src/controls/PanControl2D.ts:686-690` — »… the class went onto the
     target and a hideCursor went out.« → »… the class went onto the target and
     `OnPanControl2DHideCursor` went out.« Den Kommentar `:686-690` neu umbrechen.
   - `PanControl2D.ts:831` — »the restoreCursor that goes out on the way still reaches them« →
     »the `OnPanControl2DRestoreCursor` that goes out on the way still reaches them«; den
     Kommentar `:829-831` neu umbrechen.
   - `PanControl2D.ts:834` — »runs also behind a restoreCursor listener that threw« → »runs also
     behind a listener of `OnPanControl2DRestoreCursor` that threw«; `:834-835` neu umbrechen.
   - `PanControl2D.ts:846` — »last: the restoreCursor above still has to reach the listeners that
     act on it« → »last: the `OnPanControl2DRestoreCursor` above still has to reach the listeners
     that act on it«; über 100 Spalten auf zwei Zeilen.
   - `packages/twopoint5d/src/controls/PanControl2D.spec.ts:585` — Titel »a restoreCursor listener
     that throws does not stop dispose(): …« → »an onRestoreCursor() listener that throws does not
     stop dispose(): …« (Rest unverändert); `:606` »pointerDisabled = true with a restoreCursor
     listener that throws: …« → »pointerDisabled = true with an onRestoreCursor() listener that
     throws: …«; `:587` und `:608` `new Error('restoreCursor listener fails on purpose')` →
     `new Error('onRestoreCursor() listener fails on purpose')` (beide Tests vergleichen über das
     Objekt `error`, kein Erwartungstext ändert sich).
   - Testing-Paket (Zusatz aus Zug 0, gleiche Ursache): `pan-control-cursor.test.js:95`
     `'restoreCursor events once the pan button is up'` und `:104` `'restoreCursor events after the
     last button is up'`; `pan-control-input.test.js:274` `it('reports restoreCursor only for a
     cursor it hid', …)`, `:289` `'restoreCursor events without a drag'`, `:298` `'restoreCursor
     events after a drag that hid the cursor'`; `pan-control-switch-off.test.js:57`
     `'restoreCursor events'` — jeweils `restoreCursor` → `OnPanControl2DRestoreCursor` (diese
     Tests abonnieren über `on(control, OnPanControl2DRestoreCursor, …)`), sonst kein Wort.
7. **`packages/twopoint5d/src/vertex-objects/VertexObjectGeometry.ts:26-27`, `:33`** — derselbe
   Halbsatz steht zweimal. `:26-27` wird zu
   `// super() only ever sees a pool and cannot tell that it was built here, so the pool built`
   / `// above is disposed here`; `:33` wird zu `// the pool built above belongs to this geometry`.
8. **`packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:251-253`** — »at most
   `maxVisibleTiles` bytes« gilt nicht, sobald `maxVisibleTiles` nach einer großen Fläche gesenkt
   wird (der Setter `:141-147` lässt `#tileCreated` stehen), und nicht für `Infinity`. Neuer
   Wortlaut, umbrochen:

   ```ts
   // Only the cells of this call are cleared, so the cost follows the area of this call. The array
   // stays at the largest area it has covered, one byte per tile, because shrinking it would
   // allocate anew on every switch of an area that swings between two sizes.
   ```
9. **`packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts:146-147`** — zwischen
   `  });` (`:146`) und `  describe('readDataIdAt() at a fractional point', () => {` (`:147`) eine
   Leerzeile einfügen.
10. **»integer of 0 or more« → »whole number of 0 or more«** — die Prüfung dahinter ist
    `assertWholeNumber(…, 0)`, deren Meldung »must be a whole number of 0 or more« lautet:
    - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:176` »has to be an integer of 0
      or more« → »has to be a whole number of 0 or more« (Artikel `an` → `a`), Absatz `:176-181`
      neu umbrechen;
    - `VertexObjectBuffer.ts:191`, `:409`, `:508`, `:583` und
      `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:140` — »is no integer of 0 or
      more« → »is no whole number of 0 or more«; jeden betroffenen `@throws`-Absatz neu umbrechen
      (`:190-191`, `:409-412`, `:508-510`, `:583-585`, `Pool:140`);
    - `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.spec.ts:1116`
      `describe('a capacity that is no integer of 0 or more', …)` → `describe('a capacity that is no
      whole number of 0 or more', …)` (Zusatz aus Zug 0, gleiche Ursache).
    Nicht angefasst: `VertexObjectBuffer.ts:541-543` und `:633` (»is no integer«) — sie beschreiben
    `copyWithin()`/`toAttributeArrays()`, deren Meldungen »must be integers with 0 ≤ …« lauten.
11. **`packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:1013-1014`** — den zweiten Satz
    streichen. Im Block `/** … */` bleibt eine Zeile, Einzug wie bisher: »Places a tile the search
    kept, and sorts it into `reuseTiles` or `createTiles`.«
12. **`packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:116-117`** — Punkt 2 der
    Liste wird zu (Fortsetzung mit drei Leerzeichen Einzug wie die Nachbarpunkte):

    ```ts
       * 2. every attribute declares a `size` or `components`, and its size is a whole number of 1 or
       *    more: the `size` it declares or, without one, the number of its `components` (`RangeError`)
    ```
    Die Meldung `:170` und ihre Specs bleiben (Begründung unter »Entscheidungen im Zug 0«).
13. **`packages/twopoint5d/src/display/DisplayFullscreen.spec.ts:2-6`** — die Zeile
    `import {type EventTargetStub, makeEventTarget} from '../testing/eventTargetStub.js';` (`:4`)
    vor `import type {Display} from './Display.js';` (`:2`) setzen, wie in `Display.spec.ts:15`
    (erst `../`, dann `./`). Sonst keine Zeile.
14. **`packages/twopoint5d/src/text/writeText.ts:28-30`** — der Kommentar über `REQUIRED` trennt
    nicht, welcher Name wofür steht (`prepare()` `:52-54` prüft über `feature.name`, die Meldung
    nennt den Exportnamen). Neuer Wortlaut, umbrochen:

    ```ts
    // the features writeText() and rewriteText() write, each beside the name it is exported under,
    // which a refusal names. A kind holds one when one of its features carries the same `name`, as
    // `requires` and the segment placement judge it: a copy such as `defineFeature({...QuadSize})`
    // carries the same API
    ```
15. **`packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:126-128`** — drei Gedankenstriche in
    einem Satz. Neuer Wortlaut, umbrochen (`:129-136` bleiben):

    ```ts
       * Takes every whole number, clamped to `0` … {@link capacity}; `Infinity` and `-Infinity` are
       * clamped the same way. Throws a `RangeError` for `NaN`, for a fraction and for a value that is
       * no number, such as `undefined` or a string: none of them names a slot. It throws on a
       * disposed pool as well.
    ```
16. **`packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:609-612`** (TSDoc von
    `update()`) — `:610` hat 133 Spalten. Ab `:609` neu umbrechen, kein Wort ändern.
17. **`packages/twopoint5d/src/display/DisplayFullscreen.ts:993`** — »#fullscreenHolds() counts the
    fullscreens of other elements on top of it« liest sich als »auf dem Ziel gestapelt«, den Fall
    deckt `#holdsTarget()` selbst; gemeint ist der fremde Fullscreen von `#foreignFullscreen()`
    `:998-1005`. Neuer Wortlaut, zwei Zeilen:

    ```ts
      // #fullscreenHolds() adds what this leaves out: another element in fullscreen while the
      // target is not in the stack
    ```

Zusätze aus Zug 0 — reiner Umbruch, außer wo ein Wortlaut genannt ist:

18. `packages/twopoint5d/src/sprites/features/SegmentPlacement.ts:67-68` — `@throws` mit 122
    Spalten; neu umbrechen (Fortsetzungseinzug zwei Leerzeichen).
19. `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:205-214` (TSDoc von `dispose()`) —
    `:211` trägt nur `{@link createFromAttributes},` (34 Spalten). Ab `:211` neu umbrechen, bis der
    Absatz endet (`:214`).
20. `packages/twopoint5d/src/stage/matte.spec.ts:52-55` — `:54` hat 144 Spalten, `:55` 65. Ab
    `:54` neu umbrechen.
21. `packages/twopoint5d/src/texture/DynamicAtlas.ts:526-531` (TSDoc von `dispose()`) — `:527`
    (60), `:529` (116), `:530` (105). Ab `:526` neu umbrechen.
22. `packages/twopoint5d/src/texture/TextureFactory.ts:164-166` — `:165` hat 121 Spalten. Ab
    `:165` neu umbrechen.
23. `packages/twopoint5d/src/texture/TextureStore.ts:889-896` (TSDoc von `parse()`, Absatz »A
    single item that cannot be read …«) — `:893` hat 168 Spalten, `:894` 67. Ab `:893` neu
    umbrechen.
24. `packages/twopoint5d/src/texture/TileSet.ts:82` — der Block `:79-82` führt einen Satz je
    Zeile; nur `:82` (125) an einem Leerzeichen auf zwei Zeilen umbrechen, `:79-81` bleiben. Dabei
    »goes without gaps to up to« → »goes without gaps up to« (doppelte Präposition).
25. `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:257-258` — `@param pool`
    mit 120 Spalten, Fortsetzung 49. Neu umbrechen (Fortsetzungseinzug zwei Leerzeichen).
26. `packages/twopoint5d/src/vertex-objects/types.ts:22-24` (TSDoc von `VertexAttributeDataType`)
    — `:24` hat 128 Spalten. Ab `:23` neu umbrechen.
27. Die beiden Prüfungen und die drei `git grep` unter »Regeln« laufen lassen, Ausgaben in den
    Report.
28. `pnpm run ci`.

Kein Regressionstest: das Paket ändert keine Zeile Verhalten — Kommentare, Testtexte, eine
Import-Reihenfolge und eine Leerzeile.

- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · alle 17 Stellen bestehen (12 unverändert, 4 verschoben
    um bis zu 8 Zeilen, Stelle 11 ohne Zeilenangabe jetzt `:1013-1014`; Stand je Stelle unter
    »Abgleich«), keine gegenstandslos; Stelle 6 zählt
    `PanControl2D.spec.ts:587`/`:608` dazu · dazu: sieben Testtexte `restoreCursor` in drei
    `pan-control-*.test.js` (Symptom Paket 10), Spec-Titel `VertexObjectBuffer.spec.ts:1116`
    (Symptom Paket 11), Kurzzeile `VOBufferPool.ts:211` (laufbedingt, `b3de20ef`), acht
    vorbestehende Absätze gleicher Ursache, ein Wortfehler `TileSet.ts:82` · offene Folgen: keine
    unverteilten (alle `Folgen:`-Zeilen der Pakete 1–25 verteilt oder »keine«), »Offene Befunde«:
    ein Eintrag aus Paket 25 (Markdown, → Audit), andere Ursache, bleibt · Restplan 27–28
    unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt (sonnet, effort low), `paket-26.impl-0.json`
  - 2026-11-01 Zug 2: Report ohne Inhalt im Ergebnisfeld (nur Nachsatz, Exit 0) · 30 Dateien geändert, Arbeitsbaum schmutzig · Prüfungen 1 und 3 leer · Verify `pnpm run ci` exit=0 (`paket-26.verify.log`)
  - 2026-11-01 Zug 3: Reviewer (sonnet, low) — Schritte 1–26 erfüllt, keine kritischen/wichtigen Befunde, zwei kleine · Diff `paket-26.diff`, Report `paket-26.review-0.json`
  - 2026-11-01 Zug 4: keine Runde nötig
  - 2026-11-01 Zug 5: Commit `9f119a6d`, Verify `paket-26.verify.log` exit=0

## Abgleich

Die 17 Stellen aus dem Plan, im Wortlaut der Überführung, mit ihrem Stand an `5edbc74f`:

1. `vertex-objects-heap.test.js:29` — Heap-Kommentar nennt nur die WebGL2-Zahl (1,8 %), gemessen
   1,82 % WebGL2 / 1,93 % WebGPU. (aus Paket 1) → besteht, `:28-29`. Schritt 1.
2. `stage-masks.test.js:18` — `countNodeBuilds` im Import nicht alphabetisch. (aus Paket 3) →
   besteht unverändert. Schritt 2.
3. `AsepriteJson.ts:336; FrameBasedAnimations.ts:409-410` — TSDoc-Absätze nach dem Einfügen nicht
   neu umbrochen (114 Zeichen). (aus Paket 8) → besteht: `AsepriteJson.ts:334` (114, aus
   `fd239a63`), `FrameBasedAnimations.ts:410` (68, aus `fd239a63`). Schritt 3.
4. `SegmentPlacement.ts:63-65` — JSDoc bricht nach »So is a kind with NineSlice,« mitten im Satz
   um. (aus Paket 9) → besteht, `:64` (49, aus `e2bf6480`). Schritt 4.
5. `FeatureSprites.ts:340` — `@throws`-Zeile deutlich länger als ihre Nachbarn. (aus Paket 9) →
   besteht unverändert (118). Schritt 5.
6. `PanControl2D.ts:687, :831, :834, :846; PanControl2D.spec.ts:585/606` — Kommentare und
   Testnamen nennen Events mit den alten Kurznamen. (aus Paket 10) → besteht unverändert an allen
   sechs Stellen; dazu die Fehlertexte `PanControl2D.spec.ts:587`, `:608` derselben Tests.
   Schritt 6.
7. `VertexObjectGeometry.ts:26-27, :33` — zweimal fast derselbe Kommentar. (aus Paket 10) →
   besteht unverändert. Schritt 7.
8. `RectangularVisibilityArea.ts:252` — »at most maxVisibleTiles bytes« stimmt nicht, wenn
   `maxVisibleTiles` nach einer großen Fläche gesenkt wird. (aus Paket 11) → besteht unverändert;
   Setter `:141-147` lässt `#tileCreated` stehen, `Infinity` ist erlaubt (`:142`). Schritt 8.
9. `DataIdsChunk2D.spec.ts:147` — Leerzeile vor dem neuen `describe` fehlt. (aus Paket 11) →
   besteht unverändert. Schritt 9.
10. `VertexObjectPool.ts:139; VertexObjectBuffer.ts:168, :183, :401, :500, :575` — TSDocs sagen
    »integer of 0 or more« statt »whole number«. (aus Paket 11) → besteht, verschoben:
    `VertexObjectPool.ts:140`, `VertexObjectBuffer.ts:176`, `:191`, `:409`, `:508`, `:583`.
    Schritt 10.
11. `CameraBasedVisibility.ts` (TSDoc `#placeTile()`) — wiederholt sich (»Expects the search to
    have kept it.«). (aus Paket 11b) → besteht, `:1013-1014`. Schritt 11.
12. `VertexObjectDescriptor.ts:115-117` — Punkt 2 sagt »a positive integer size« neben »a whole
    number of 1 or more« in Punkt 1. (aus Paket 16) → besteht unverändert. Schritt 12.
13. `DisplayFullscreen.spec.ts:4` — Import `../testing/eventTargetStub.js` zwischen den
    `./`-Imports. (aus Paket 18) → besteht unverändert. Schritt 13.
14. `writeText.ts:28-30` — Kommentar vermischt »the names they are exported under« und »the name
    of the feature«. (aus Paket 19) → besteht unverändert. Schritt 14.
15. `VOBufferPool.ts:127-128` — drei Gedankenstriche in einem TSDoc-Satz. (aus Paket 20) →
    besteht, `:126-128`. Schritt 15.
16. `InstancedVOBufferGeometry.ts:608-609` — TSDoc von `update()` bricht unregelmäßig um (eine
    Zeile ≈ 140 Zeichen). (aus Paket 21) → besteht, `:609-612` (`:610` 133, aus `ba93887b`).
    Schritt 16.
17. `DisplayFullscreen.ts:992` — Kommentar »#fullscreenHolds() counts the fullscreens of other
    elements on top of it« mehrdeutig. (aus Paket 23) → besteht, jetzt `:993`. Schritt 17.

## Entscheidungen im Zug 0

- **Gemessen, nicht geschätzt.** Zug 0 hat jede Kommentarzeile unter `packages/twopoint5d/src/`
  (18 550) über 104 Spalten und unter `packages/twopoint5d-testing/test/` über 105 per `git blame` gegen
  `d9b648bf` gehalten. Laufbedingt über 110 sind 14 Zeilen: drei sind Stellen 3, 5, 16; die
  übrigen elf sind einzeilige Kommentare (`/** … */` auf einer Zeile oder ein einzelnes `//`,
  z. B. `StageDirector.ts:225`, `:2269`, `PowerOf2ImageLoader.ts:87`, `VOBufferPool.ts:139`) im
  Stil der Library, die einzeilige Kommentare bis zur Codebreite 130 führt — kein Umbruchfehler.
  Laufbedingt 105–110 liegen nur Zeilen in der Streuung ihrer Nachbarn (`writeText.ts:135-136`,
  `StageDirector.ts:1782` u. a.); im Testing-Paket nur zwei einzeilige (`fixtures.js:636`,
  `sprites-picking.test.js:134`). Kurzzeilen mitten im Absatz (unter 70, vor einer Zeile ab 88),
  laufbedingt: nur `FrameBasedAnimations.ts:410` (Stelle 3) und `VOBufferPool.ts:211` (Schritt 19);
  dazu `SegmentPlacement.ts:64` (Stelle 4), deren Folgezeile kürzer ist.
- **Vorbestehende Absätze gleicher Ursache kommen dazu** (Schritte 18, 20–26), wie in Paket 25
  bei der Markdown-Doku: in einem mehrzeiligen Absatz steht eine Zeile über 110, die ihre
  Nachbarn um 10 Spalten und mehr überragt — ein Satz wurde angehängt, ohne den Absatz neu zu
  umbrechen. Das sind `SegmentPlacement.ts:67`, `matte.spec.ts:54`, `DynamicAtlas.ts:529`,
  `TextureFactory.ts:165`, `TextureStore.ts:893`, `TileSet.ts:82`,
  `InstancedVOBufferGeometry.ts:257`, `vertex-objects/types.ts:24`. Zwei davon liegen im selben
  Block wie eine genannte Stelle (`SegmentPlacement.ts`, `InstancedVOBufferGeometry.ts`). Eine
  Rückgabe ins Audit wäre ein neues Finding für den Mechanismus, den dieses Paket ohnehin an 17
  Stellen behebt.
- **Nicht aufgenommen, kein Befund:** vorbestehende Absätze aus einem einzigen Satz auf einer
  Zeile (`HelpersManager.ts:6`, `Map2DTileStreamer.ts:9`, `map2d/types.ts:15`, `:35`,
  `layoutText.ts:276`, `InstancedVOBufferGeometry.ts:252`, `TileSet.ts:228`, `:249`,
  `TexturePackerJson.ts:43`, `ProjectionPlane.ts:8` mit einem Link) — so ist der ältere Code
  geschrieben, eine Breitenregel für Kommentare gibt es weder in `AGENTS.md` noch in
  `biome.jsonc`; gleichmäßig breit umbrochene Absätze (`DynamicAtlas.ts:378-382`,
  `TextureCoords.ts:47-48`, `:233-234`, `AtlasFrame.ts:75-77`, `PaletteSwap.ts:47-52`,
  `TexturePackerJson.ts:16-17`, `VOBufferPool.ts:298`), die keinen Nachbarn überragen.
- **Testtexte mit `restoreCursor`** (Schritt 6, Testing-Paket): an `d9b648bf` abonnierten diese
  Tests `on(control, 'restoreCursor', …)`; Paket 10 hat das Literal auf die Konstante umgestellt,
  die Beschriftungen nicht. Symptom von Paket 10, gleiche Ursache wie Stelle 6, deshalb hier.
  Nicht angefasst: `'update events …'` in `pan-control-input.test.js:193-271` — »update« ist dort
  gewöhnliches Englisch für die Events, die `update()` auslöst, kein camelCase-Literal; ebenso
  `init`/`start`/`pause`/`restart listener` in `Display.spec.ts` und
  `DisplayStateMachine.spec.ts` (Phasen des Zustandsautomaten, dessen Werte `'init'`, `'start'`
  … weiter so heißen) und »resize listener« (das DOM-Event `resize`).
- **Spec-Titel `VertexObjectBuffer.spec.ts:1116`**: derselbe Wortlaut wie Stelle 10, Paket 11 hat
  die Meldung auf »whole number« gestellt, den Titel nicht. Symptom, hier.
- **Stelle 12 nur im TSDoc.** Die Meldung `VertexObjectDescriptor.ts:170` (»a positive integer
  size or at least one component«) bleibt: Paket 16 hat sie in Zug 0 bewusst als eigene
  Meldungsklasse mit Hinweis stehen lassen, in einer Reihe mit der Index-Meldung `:189` und den
  Bereichsmeldungen von `copyWithin()`/`toAttributeArrays()` (»must be integers with 0 ≤ …«), die
  Paket 11 ausdrücklich ausgenommen hat. Sie hier zu ändern, zöge diese Klasse mit, ändert
  sichtbaren Wortlaut samt CHANGELOG und gehört nicht in ein Kommentar-Paket. Das TSDoc
  beschreibt die Regel, es zitiert keine Meldung (Punkt 1 tut es auch nicht); mit »a whole number
  of 1 or more« spricht Punkt 2 das Vokabular von Punkt 1 und liest sich nicht mehr als Rest.
- **Stelle 6:** Kommentare nennen die Konstanten, Specs der Library die Abonnier-Methode
  `onRestoreCursor()`, Browser-Tests die Konstante — jeweils so, wie die Nachbarn derselben Datei
  es tun. Gesucht wurde nach jedem alten camelCase-Literal (`renderFrame`, `fullscreenChange`,
  `hideCursor`, `restoreCursor`) in Kommentaren und Testtexten; außerhalb der Pan-Control nennt
  es nur Methoden (`renderFrame()`).
- **Wortfehler `TileSet.ts:82`** (»to up to«): steht in einer Zeile, die Schritt 24 ohnehin
  umbricht — nicht wegsehen.
- **Modell und Effort:** mittlere Stufe, weil das Paket aus Prosa arbeitet; `low`, weil jeder neue
  Wortlaut vorgegeben ist und der Rest reiner Umbruch — ein höherer Effort lädt zum Verbessern von
  Sätzen ein, die das Paket nicht nennt. Die Wortdiff-Probe hält das fest.
- **Restplan:** 27 ändert `AsepriteJson.ts` am Rat zu `repeat` (`:464-469`) und gegebenenfalls
  den Halbsatz »a repeat no data texture holds« im Absatz, den Schritt 3 umbricht — 27 läuft
  danach und plant gegen den umbrochenen Text; `DisplayFullscreen.ts` (27: `:358`) und
  `VertexObjectPool.spec.ts` (27) berühren keine Zeile dieses Pakets. 28 arbeitet außerhalb von
  `packages/`. Reihenfolge und Schnitt bleiben.

## Findings im Volltext

Keine Audit-Findings. Der Wortlaut der 17 überführten Stellen steht unter »Abgleich«, die Belege
zu jeder Wortänderung beim Schritt.

## Urteil des Reviewers

Alle Schritte 1–26 erfüllt (Fundstellen im Report `paket-26.review-0.json`); Wortdiff-Probe zeigt nur
die vorgegebenen Wortänderungen und die verschobenen Imports der Schritte 2 und 13.

Kleine Befunde:
- `PanControl2D.ts`, Kommentar im `finally` von `dispose()`: das Wort `it` steht allein auf der
  Folgezeile (regelkonform).
- `FeatureSprites.ts:464-466`: Umbruch trennt die Code-Spans `` `new FeatureSpritesMaterial()` `` und
  `` `new SpriteResources()` `` am Leerzeichen (regelkonform).
- Zählung in der Paketprosa: sechs, nicht sieben Testtexte im Testing-Paket.
