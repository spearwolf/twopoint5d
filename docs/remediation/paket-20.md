# Paket 20 — Drain: Eingabeprüfung in Map2D und Sprite-Passes

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — 8 Nebenbefunde aus »Offene Befunde« (alle low, `→ Scope`), dazu Stellen gleicher Ursache aus Zug 0 (unten, »Abgleich«)
- Ziel: Die Map2D-Sichtbarkeit und die Sprite-Passes weisen jede ungültige Eingabe mit Subjekt ab — auch nach `dispose()`, wie `docs/resource-lifecycle.md` §3 es verlangt — und der Cache-Pfad der Sichtbarkeit hält, was seine TSDoc sagt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts` samt `RectangularVisibilityArea.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` samt `CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/types.ts` (nur TSDoc von `IMap2DVisibilitor#computeVisibleTiles()`), `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` (nur der Kommentar Z. 262–264; `Map2DTileStreamer.spec.ts` nur, falls ein Fall das alte Verhalten nach `clearTiles()` prüft)
  - `packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts` samt `Map2DTileCoordsUtil.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts` samt `CameraBasedVisibilityHelpers.spec.ts`
  - `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts` samt `RectangularVisibilityAreaHelpers.spec.ts`
  - `packages/twopoint5d/src/sprites/passes/passFeatures.ts`, `packages/twopoint5d/src/sprites/passes/definePass.ts` samt `definePass.spec.ts` (oder `pass-features.spec.ts`, wo die Abweisungen von `checkPass()` schon stehen)
  - `packages/twopoint5d/src/sprites/features/TableFrame.ts`, `PaletteSwap.ts`, `AxisBillboardPlacement.ts`, `FlatPlacement.ts`, `SegmentPlacement.ts` samt `TableFrame.spec.ts`, `PaletteSwap.spec.ts`, `placement.spec.ts`, `segments.spec.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts` samt `FeatureSprites.spec.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSpritesMaterial.ts` (nur die Prüfung im `placement`-Setter wird eine Modulfunktion, Verhalten unverändert) — `FeatureSpritesMaterial.spec.ts` muss unverändert grün bleiben
  - Doku: `packages/twopoint5d/docs/sprites.md` (Z. 1201, 1379, 1485–1486, 1671–1675, 2212–2245, 2557–2569), `packages/twopoint5d/docs/proposals/sprite-features.md` (Z. 762–767), `packages/twopoint5d/docs/proposals/sprite-uniform-bindings.md` (Z. 165–167), `packages/twopoint5d/docs/proposals/table-frames-and-palette-swap.md` (Z. 220–221, 255)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`, drei Einträge unter `### Changed`, einer unter `### Fixed`, siehe Schritt 14)
- Vorgehen:
  1. **Cache-Pfad von `RectangularVisibilityArea#computeVisibleTiles()`** (`RectangularVisibilityArea.ts` Z. 212–218). Die Bedingung wird
     `if (!depsChanged && !this.needsUpdate && this.#visibleTiles != null && previousTiles === this.#visibleTiles.tiles)`.
     Jede andere Liste läuft durch die Neuberechnung darunter und wird gegen sie gehalten — die Snapshots des Gates sind
     zu diesem Zeitpunkt schon fortgeschrieben, das ist richtig so. Kurzer Kommentar über der Bedingung, *warum*: das
     Ergebnis steht nur für die Liste, die es selbst als `tiles` ausgegeben hat; eine andere kann Tiles halten, die
     herausfallen, oder Tiles nicht halten, die es ausweist. In die TSDoc von `computeVisibleTiles()` (Z. 157–169) ein
     Absatz: „While nothing the result depends on has changed and `previousTiles` is the `tiles` list of the last result
     — the list `Map2DTileStreamer` hands back —, the call hands that result back as it stands, `serial` included: every
     tile reused, none to create or to remove. Any other list is held against a computation of its own.“ (Wortlaut frei,
     Inhalt genau so.)
  2. **Cache-Pfad von `CameraBasedVisibility#computeVisibleTiles()`** (`CameraBasedVisibility.ts` Z. 639–647). Der Zweig
     hinter `if (!this.#dependenciesChanged(matrixWorld))` gibt das letzte Ergebnis nur noch zurück, wenn
     `this.#visibleTiles === undefined ? previousTiles.length === 0 : previousTiles === this.#visibleTiles.tiles`; sonst
     fällt der Aufruf in die Neuberechnung darunter (`this.#serial += 1` und folgende). Grund für den zweiten Arm: die TSDoc
     (Z. 594–596) erlaubt `undefined` nur, wenn das Frustum kein Tile trifft *und* `previousTiles` leer ist — eine volle
     Liste nach einem `undefined` muss in `removeTiles` hinaus. Derselbe Absatz wie in Schritt 1 in die TSDoc (Z. 590–606).
  3. **Vertrag und Streamer.** In die TSDoc von `IMap2DVisibilitor#computeVisibleTiles()` (`types.ts` Z. 231–249) ein Satz:
     ein Visibilitor gibt sein letztes Ergebnis unverändert nur für die `tiles`-Liste genau dieses Ergebnisses zurück, jede
     andere Liste hält er gegen eine Berechnung. Der Kommentar `Map2DTileStreamer.ts` Z. 262–264 sagt heute, der
     Cache-Pfad gebe das Ergebnis »untouched by previousTiles« zurück — umschreiben: die neue Liste (nicht `length = 0`)
     bleibt nötig, weil der Visibilitor genau dieses Array als `tiles` seines letzten Ergebnisses hält; eine eigene Liste
     lässt ihn die ganze Menge neu berechnen. Code des Streamers bleibt unverändert.
  4. **Regressionstests zu 1–3, zuerst rot sehen.** In `RectangularVisibilityArea.spec.ts` und `CameraBasedVisibility.spec.ts`
     je ein `describe` neben den bestehenden Cache-Fällen (»hands back the same result, marked unchanged, while nothing
     moves« bzw. »caches the previous result when dependencies have not changed«), bei stehendem Zentrum, Gitter und
     Kamera nach einem ersten Ergebnis `first`:
     - `[]` statt `first.tiles` → `createTiles` hält jedes Tile von `first.tiles` (gleiche Koordinaten), `reuseTiles` ist
       leer, `serial` ist gestiegen — der Fall des Streamers nach `clearTiles()`;
     - eine Liste mit einem Tile außerhalb des Bereichs (`new Map2DTileCoords(999, 999, …)` o. ä.) plus `...first.tiles` →
       dieses Tile steht in `removeTiles`, die übrigen in `reuseTiles`;
     - `[...first.tiles]` (dieselben Tiles, eine andere Liste) → alle in `reuseTiles`, `createTiles` und `removeTiles` leer;
     - nur `CameraBasedVisibility`: eine Kamera, die an der Ebene vorbeischaut (wie im bestehenden Fall, der
       `visibles` leer erwartet), erstes Ergebnis `undefined`; derselbe Aufruf mit einer Liste aus einem Tile → ein
       Ergebnis, dessen `removeTiles` dieses Tile hält.
     Vorschlag für die Namen: `hands its last result back only for the tiles list of that result` mit den Fällen
     `an empty list gets every tile to create`, `a tile that falls out comes back in removeTiles`,
     `another list of the same tiles reuses every one`, `a list after an undefined answer goes out in removeTiles`.
     Die bestehenden Cache-Fälle übergeben `first.tiles` und bleiben grün. Fällt ein Fall in `Map2DTileStreamer.spec.ts` um,
     der nach `clearTiles()` `reuseTile()`-Aufrufe zählt, prüft er das alte Verhalten: auf `addTile()` umstellen.
     `pnpm test:allocations` muss grün bleiben (der Vergleich ist eine Referenzprüfung, er allokiert nichts).
  5. **`Map2DTileCoordsUtil#getTileCoords()` (Z. 209) und `#computeTilesWithinCoords()` (Z. 237)** weisen eine
     Auswahl ab, die keine endliche Fläche ist: `left`, `top` endliche Zahlen; `width`, `height` endliche Zahlen ab 0
     (0 bleibt zulässig, die Randmatrix in `Map2DTileCoordsUtil.spec.ts` Z. 132ff. prüft `width = 0`). Beide Methoden liegen
     auf dem Frame-Pfad (`hot-path-allocations.spec.ts` › `Map2DTileCoordsUtil on the hot path`, Grenze in Bytes je Aufruf):
     die Bedingung steht deshalb **inline** in jeder Methode —
     `if (!(Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && width >= 0 && Number.isFinite(height) && height >= 0))`
     —, kein Aufruf von `assertFinite()` mit den Doubles auf dem Gutweg (ein Double an einen nicht inlinierten Aufruf wird
     geboxt, vgl. den Kommentar in `RectangularVisibilityArea.ts` Z. 179–180). Nur im Fehlerfall ruft die Methode ein
     neues `static #refuseSelection(where: string, left: number, top: number, width: number, height: number): never`, das
     das erste falsche Feld nennt und wirft: `RangeError` mit
     `Map2DTileCoordsUtil#getTileCoords(): left must be a finite number, got NaN` bzw.
     `Map2DTileCoordsUtil#computeTilesWithinCoords(): width must be a finite number of 0 or more, got -1` (Wert über
     `describeValue()`). Vor jedem Schreiben in `target`: ein abgewiesener Aufruf lässt `target` stehen. TSDoc beider
     Methoden bekommt `@throws a RangeError for a left or a top that is no finite number and a width or a height that is
     no finite number of 0 or more; target stays as it was`. Specs in `Map2DTileCoordsUtil.spec.ts` (zuerst rot):
     `test.each` über `NaN`, `Infinity`, `-Infinity`, `'3'` für `left`/`top` und `-1`, `NaN`, `Infinity` für
     `width`/`height`, für beide Methoden, mit exakter Meldung und unverändertem `target`.
  6. **`CameraBasedVisibilityHelpers`** (Z. 58, 60, 61): `maxDebugHelpers`, `tileBoxHelperExpand`,
     `frustumBoxHelperExpand` werden Accessoren über `#maxDebugHelpers = 9`, `#tileBoxHelperExpand = -0.01`,
     `#frustumBoxHelperExpand = 0`. Setter:
     - `maxDebugHelpers`: ganze Zahl ab 0 oder `Infinity`, sonst `RangeError`
       `CameraBasedVisibilityHelpers: maxDebugHelpers must be a whole number of 0 or more, or Infinity, got 2.5`
       (`describeValue()`), der Wert bleibt.
     - `tileBoxHelperExpand`, `frustumBoxHelperExpand`: `assertFinite(value, 'CameraBasedVisibilityHelpers', '<name>')`
       (`RangeError`, `… must be a finite number, got NaN`), der Wert bleibt; jedes Vorzeichen zulässig.
     - Auch nach `dispose()` prüfen und speichern (Regel 3 und »A member over plain values keeps working« in
       `docs/resource-lifecycle.md` §3).
     Die Lesestellen der Klasse (Z. 215, 263, 366–373) lesen die `#`-Felder direkt, nie die Getter: ein Getter, den der
     Compiler nicht inliniert, boxt das Double, das er liefert, und `hot-path-allocations.spec.ts` ›
     `CameraBasedVisibilityHelpers on the hot path` misst `update()`. TSDoc für alle drei Accessoren; die beiden
     Expand-Felder haben heute keine — sie sind ein **Faktor der Boxgröße** (Z. 261–268: `size *= expand`,
     `expandByVector(size)`), um den jede Box auf jeder Seite wächst, negativ schrumpft sie; `-0.01` hält die Tile-Boxen
     benachbarter Tiles auseinander. Den Satz der `dispose()`-TSDoc (Z. 389–391) »The public fields of this class still take
     values, and none of them has an effect any more« so fassen, dass sie Werte nehmen, ungültige weiter abweisen und keine
     Wirkung mehr haben. Specs in `CameraBasedVisibilityHelpers.spec.ts`: Abweisung je Feld (`NaN`, `Infinity` bei den
     Expand-Feldern, `-1`, `2.5`, `NaN` bei `maxDebugHelpers`), Wert bleibt, `Infinity` für `maxDebugHelpers` zulässig, auch
     nach `dispose()`.
  7. **`RectangularVisibilityAreaHelpers#viewRectHelperHeight`** (Z. 10) — gleiche Ursache wie Schritt 6: Accessor über
     `#viewRectHelperHeight = 20`, Setter verlangt eine endliche Zahl ab 0, sonst `RangeError`
     `RectangularVisibilityAreaHelpers: viewRectHelperHeight must be a finite number of 0 or more, got -1`, Wert bleibt,
     auch nach `dispose()`. Die Lesestelle Z. 112 liest das `#`-Feld. TSDoc: die Höhe der Box, die den sichtbaren
     Rechteckbereich zeigt, in Welteinheiten. Spec in `RectangularVisibilityAreaHelpers.spec.ts`.
  8. **`checkPass()`** (`passFeatures.ts` Z. 17–77) prüft die Form des Passes, Signatur
     `checkPass(pass: unknown, where: string): asserts pass is SpritePass` (wie `checkFeature()`). Reihenfolge und
     Meldungen (`TypeError`, Werte über `describeValue()`):
     1. kein Objekt oder ein Array → `${where}: a pass is an object with a name and features, got ${describeValue(pass)}`;
     2. `name`, `visible` wie heute;
     3. `features` kein Array → `${where}: the features of pass "${name}" are no list of features, got …` — ein Array, kein
        beliebiges Iterable: `placementOfPass()` (Z. 15) und `passFeatures()` (Z. 113) rufen `.find`/`.map`/`.filter`;
     4. die Feature-Schleife und die Placement-Prüfung wie heute;
     5. `without` (wenn `!= null`) keine Liste von Strings → `${where}: the without of pass "${name}" is no list of feature names, got …`, dann die Doppelprüfung wie heute;
     6. `uniformNames` (wenn `!= null`) kein Objekt oder ein Array → `${where}: the uniformNames of pass "${name}" are no record of uniform names, got …`, dann die Umbenennungsprüfungen wie heute;
     7. `material` (wenn `!= null`) kein Objekt oder ein Array → `${where}: the material of pass "${name}" is no record of material parameters, got …`;
     8. `renderOrder` (wenn `!= null`) über `assertFinite(renderOrder, where, \`the renderOrder of pass "${name}"\`)` →
        `RangeError` `definePass: the renderOrder of pass "x" must be a finite number, got NaN`.
     `null` gilt bei 5–8 als nicht mitgebracht (die Regel von `checkFeature()`, Z. 29). `isObject()` aus
     `src/utils/isObject.ts`; ein `isRecord`/`isStringList` wie in `checkFeature.ts` Z. 8–11 steht lokal in `passFeatures.ts`
     (intern, `checkFeature.ts` bleibt unverändert). Die TSDoc von `checkPass()` (Z. 17–24) zählt auf, was sie
     prüft. Specs (zuerst rot) in `definePass.spec.ts` bzw. dort, wo die übrigen Abweisungen von `checkPass()` stehen: je
     Zeile oben ein Fall über `definePass()`, dazu einer über `new FeatureSprites(kind, {passes: [<kaputter Pass>]})`
     mit Subjekt `FeatureSprites`.
  9. **TSDoc von `definePass()`** (`definePass.ts` Z. 34–41) neu fassen: ein Objekt mit Namen; `features` eine Liste mit
     Features eindeutiger Namen, jedes geprüft wie von `defineFeature()`, ohne Daten — keine Attribute, Methoden,
     `initialize`, Usage-Aliase — und **höchstens ein** Placement darunter (heute steht dort »or placement«, falsch:
     `checkPass()` weist erst das zweite ab); `without` eine Liste von Namen ohne Doppelung; `visible` eine Funktion;
     `uniformNames` und `material` Objekte; `renderOrder` eine endliche Zahl. Eingefroren werden Kopien von `features`,
     `without`, `material` **und `uniformNames`** (Z. 50 kopiert es schon, die TSDoc nennt es nicht). Dazu
     `@throws a TypeError …, a RangeError for a renderOrder that is no finite number`.
  10. **Optionen der Feature-Fabriken** — `tableFrame()` (`TableFrame.ts` Z. 86–87) und, gleiche Ursache,
      `paletteSwap()` (`PaletteSwap.ts` Z. 55–56), `axisBillboardPlacement()` (`AxisBillboardPlacement.ts` Z. 32–33),
      `flatPlacement()` (`FlatPlacement.ts` Z. 54–56), `segmentPlacement()` (`SegmentPlacement.ts` Z. 65–66): als erste
      Zeile `if (options !== undefined && !isObject(options)) throw new TypeError(\`<name>: the options must be an object, {<felder>?}, got ${describeValue(options)}\`)`
      — die Regel und der Wortlaut von `planeOf()` (`src/sprites/bindings/planeOf.ts` Z. 62–63): `undefined` zulässig,
      `null` und jeder Nicht-Objekt-Wert abgewiesen. Feldlisten: `{views?}`, `{colors?}`, `{axis?}`,
      `{plane?, orientation?}`, `{facing?, plane?}`. Das `@throws` jeder Fabrik nennt dazu »options that are no object«.
      Je ein Fall (zuerst rot) mit `5`, `'x'`, `null` in der Spec, die die übrigen Abweisungen der Fabrik schon hält
      (`TableFrame.spec.ts`, `PaletteSwap.spec.ts`, `placement.spec.ts`, `segments.spec.ts`).
  11. **Optionen von `new FeatureSprites()`** (`resolveParts()`, `FeatureSprites.ts` Z. 158–194): vor dem Destrukturieren
      Z. 159 `if (!isObject(options) || Array.isArray(options)) throw new TypeError(\`${WHERE}: the options must be an object, got ${describeValue(options)}\`)`
      (der Default `= {}` des Konstruktors Z. 300 greift nur für `undefined`; `null` und `5` werden abgewiesen). Nach dem
      Destrukturieren `if (!Array.isArray(passes)) throw new TypeError(\`${WHERE}: passes is a list of passes, got ${describeValue(passes)}\`)`
      — ein Array, weil Z. 179 `passes.length` und Z. 205 `passes.flatMap` lesen; `undefined` bleibt über den Default `[]`
      zulässig, `null` wird abgewiesen (wie `grow` Z. 161). In der Pass-Schleife Z. 188 als erste Zeile
      `checkPass(pass, WHERE)` (aus `passFeatures.ts` importieren), damit Z. 189 `pass.name` nicht roh an einem
      `null`-Eintrag wirft; `passFeatures()` prüft danach noch einmal, das ist billig. `@throws` des Konstruktors
      (Z. 295–298) nennt Optionen ohne Objekt und `passes` ohne Liste. Specs in `FeatureSprites.spec.ts` (zuerst rot):
      `new FeatureSprites(kind, null)`, `(kind, 5)`, `{passes: 5}`, `{passes: 'ab'}`, `{passes: [null]}`, je mit exakter
      Meldung, und es ist nichts gebaut (wie die bestehenden Fälle »leaves nothing built«).
  12. **`placement`-Setter von `FeatureSprites`** (Z. 531–550) — prüft auch nach `dispose()`. Dafür wird die Prüfung im
      Setter von `FeatureSpritesMaterial` (Z. 407–438, alles zwischen `checkFeature()` und `this.#placement.set(feature)`)
      eine exportierte Modulfunktion in `FeatureSpritesMaterial.ts`, intern, in keiner `public-api.ts`:
      `checkPlacementStandIn(kind: SpriteKind, start: SpriteFeature, current: SpriteFeature, feature: SpriteFeature, where: string): void`
      mit TSDoc und `@internal` — `start` ist die Placement, mit der der Graph beginnt (im Material
      `this.#pipeline.placement!`, sie ist von den Regeln ausgenommen), `current` die, deren Namen die Meldung nennt
      (`this.#placement.value`), `PLACEMENT_ONLY` zieht mit. Der Material-Setter ruft sie mit seinen Werten und `WHERE`
      auf — Verhalten und Meldungen unverändert, `FeatureSpritesMaterial.spec.ts` bleibt grün. Der Setter von
      `FeatureSprites` wird:
      ```ts
      set placement(feature: SpriteFeature) {
        checkFeature(feature, WHERE);
        const kindPlacement = this.kind.pipeline.placement!;
        checkPlacementStandIn(this.kind, kindPlacement, this.#material?.placement ?? kindPlacement, feature, WHERE);
        if (this.#material == null) return;
        // … Pass-Prüfungen und Zuweisungen wie heute (Z. 543–549)
      }
      ```
      Kommentare dazu, *warum*: die Regeln des Ersatzes hängen allein an der Art, die `dispose()` stehen lässt — also weist
      der Setter auch danach ab —; und das Material prüft danach noch einmal, weil es eine öffentliche Klasse mit eigenem
      Setter ist. Folge, gewollt: eine Placement, die nicht einspringen kann, wird über `sprites.placement = …` jetzt mit
      Subjekt `FeatureSprites:` abgewiesen, vor den Pass-Prüfungen — wie die Formprüfung und die Pass-Prüfungen desselben
      Setters schon (Fehlermeldungsregel in `AGENTS.md`: das Subjekt ist der Aufruf). Der `checkKind` einer Placement läuft
      dabei zweimal, einmal je Prüfer; der Setter liegt auf keinem Frame-Pfad. TSDoc des Setters (Z. 531–539): statt »Does
      nothing once disposed« — nach `dispose()` weist er weiter ab, was er sonst abweist (ein missgebildetes Feature, eines,
      das nicht für die Placement der Art einspringen kann), und ändert nichts; `@throws` nennt die Ersatzregeln als
      `TypeError` (beide Features genannt) bzw. `Error` (`checkKind`) mit Verweis auf `FeatureSpritesMaterial.placement`.
      Specs in `FeatureSprites.spec.ts` (zuerst rot): nach `dispose()` wirft `sprites.placement = Tint` einen `TypeError`
      `FeatureSprites: feature "tint" contributes no placement stage and cannot stand in for "<placement der Art>"` und
      `sprites.placement = {name: 'odd', placement: 5}` den Formfehler; `sprites.placement = BillboardPlacement` nach
      `dispose()` wirft weiter nicht (der bestehende Fall Z. 277–296 bleibt). Der Fall »lets a placement the material of the
      sprites refuses reach no pass« (Z. 517ff.) bleibt grün; sein Name darf zu »… a placement that cannot stand in …«
      werden.
  13. **`bindUniform()` von `FeatureSprites`** (Z. 575–580): die Prüfung der Quelle (Z. 578–580) rückt vor die Rückkehr
      Z. 577. Name und Typ des Uniforms werden nach `dispose()` nicht beurteilt — die Uniforms sind mit dem Material
      gegangen —, das sagt ein Kommentar an der Rückkehr. TSDoc (Z. 565–574): nach `dispose()` weist es etwas ab, das keine
      Quelle ist, und bindet nichts. Spec (zuerst rot): `sprites.dispose(); expect(() => sprites.bindUniform('x', {} as never)).toThrow(new TypeError('FeatureSprites: bindUniform("x") takes a source with a type of vec3 or vec4 and a write()'))`.
      Die `dispose()`-TSDoc (Z. 676–680) nennt danach `bindUniform()` und den `placement`-Setter nicht mehr unter »do
      nothing«, sondern sagt, was sie weiter abweisen. Die übrigen Member eines disposten `FeatureSprites` bleiben, wie sie
      sind (Gründe im Abgleich).
  14. **CHANGELOG** `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, kein **BREAKING** (abgewiesen wird nur, was
      keinen Sinn ergab), kein Migration Guide:
      - `### Changed`: `Map2DTileCoordsUtil#getTileCoords()` und `#computeTilesWithinCoords()` weisen eine Auswahl ab, die
        keine endliche Fläche ist (`RangeError`, nennt Aufruf und Feld, `target` bleibt); die Felder `maxDebugHelpers`,
        `tileBoxHelperExpand`, `frustumBoxHelperExpand` von `CameraBasedVisibilityHelpers` und `viewRectHelperHeight` von
        `RectangularVisibilityAreaHelpers` weisen Werte ab, mit denen sich nicht zeichnen lässt, auch nach `dispose()`.
      - `### Changed`: `definePass()` — und jede Stelle, die einen Pass nimmt — weist einen Pass ab, der kein Objekt ist
        oder dessen `features`, `without`, `uniformNames`, `material` oder `renderOrder` es nicht lesen kann;
        `tableFrame()`, `paletteSwap()`, `axisBillboardPlacement()`, `flatPlacement()`, `segmentPlacement()` und
        `new FeatureSprites()` weisen Optionen ab, die kein Objekt sind, `new FeatureSprites()` dazu `passes` ohne Liste.
      - `### Changed`: der `placement`-Setter von `FeatureSprites` weist eine Placement, die nicht einspringen kann, im
        eigenen Namen ab, bevor ein Pass oder Material sie sieht, und weist nach `dispose()` weiter ab, was er sonst
        abweist; `bindUniform()` eines disposten `FeatureSprites` weist weiter ab, was keine Quelle ist.
      - `### Fixed`: `RectangularVisibilityArea` und `CameraBasedVisibility` geben ihr letztes Ergebnis unverändert nur für
        die `tiles`-Liste dieses Ergebnisses zurück; jede andere `previousTiles` wird gegen eine Berechnung gehalten, ihre
        herausfallenden Tiles kommen in `removeTiles`, und `CameraBasedVisibility` antwortet `undefined` nur für eine leere.
      Englisch, im Ton der Nachbareinträge, ohne Rückblick auf den Vorzustand (Konventionen).
  15. **Doku nachziehen** (Skill `project-harness-dev-docs`; `ts check`-Blöcke müssen weiter typchecken):
      - `docs/sprites.md` Z. 1671–1675 (»After `dispose()`«): `bindUniform()` und der `placement`-Setter weisen weiter ab,
        was sie sonst abweisen (keine Quelle; ein missgebildetes Feature oder eines, das nicht einspringen kann), und
        ändern nichts.
      - `docs/sprites.md` Z. 2567–2569 (Regeln von `bindUniform()`, »Ownership«): nach `dispose()` weist `bindUniform()`
        etwas ab, das keine Quelle ist, und bindet nichts; `unbindUniform()` tut nichts.
      - `docs/sprites.md` »The rules« der Passes (Z. 2212ff.): ein Satz oder Punkt zur Form — `definePass()` und die
        Sprites (für einen Pass, der nie durch `definePass()` lief) weisen mit `TypeError` einen Pass ab, der kein Objekt
        ist, `features` ohne Liste, `without` ohne Liste von Namen, `uniformNames` oder `material` ohne Objekt, mit
        `RangeError` ein `renderOrder`, das keine endliche Zahl ist.
      - `docs/sprites.md` Z. 1201, 1379, 1485–1486: die Abweisungen von `flatPlacement()`, `axisBillboardPlacement()`,
        `segmentPlacement()` nennen dazu Optionen, die kein Objekt sind.
      - `docs/proposals/sprite-features.md` Z. 762–767: was `definePass()` prüft, um die Form ergänzen (Objekt,
        `features` als Liste, `without` als Liste von Namen, `uniformNames`/`material` als Objekte, `renderOrder` endlich).
      - `docs/proposals/sprite-uniform-bindings.md` Z. 165–167 (»Lifecycle«): wie der Guide Z. 2567–2569.
      - `docs/proposals/table-frames-and-palette-swap.md` Z. 220–221 und Z. 255: Optionen, die kein Objekt sind, werden
        mit `TypeError` abgewiesen.
- Verify: `pnpm run ci` (exit 0). Zur Fehlersuche einzeln: `pnpm nx test twopoint5d -- src/map2d/RectangularVisibilityArea.spec.ts` (ebenso `CameraBasedVisibility.spec.ts`, `Map2DTileCoordsUtil.spec.ts`, `CameraBasedVisibilityHelpers.spec.ts`, `RectangularVisibilityAreaHelpers.spec.ts`, `Map2DTileStreamer.spec.ts`, `src/sprites/passes/definePass.spec.ts`, `src/sprites/features/TableFrame.spec.ts`, `src/sprites/FeatureSprites/FeatureSprites.spec.ts`, `src/sprites/FeatureSprites/FeatureSpritesMaterial.spec.ts`), `pnpm test:allocations`, `pnpm typecheck`, `pnpm lint`
- Commit: `fix(twopoint5d): let RectangularVisibilityArea and CameraBasedVisibility hand their last result back only for the tiles list of that result, refuse a selection of Map2DTileCoordsUtil that is no finite area and a number field of the visibility helpers they cannot draw with, refuse a pass that is no object or whose features, without, uniformNames, material or renderOrder definePass() cannot read, options of tableFrame(), paletteSwap(), axisBillboardPlacement(), flatPlacement(), segmentPlacement() and new FeatureSprites() that are no object and passes that are no list, let the placement setter of FeatureSprites refuse a placement that cannot stand in in its own name and go on refusing it and bindUniform() what is no source once the sprites are disposed, and say what definePass() checks and copies`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · `RectangularVisibilityArea.ts` Cache-Pfad nach Z. 212–218 gewandert (vorher 204–210), `CameraBasedVisibility.ts` Z. 639–647 unverändert · `CameraBasedVisibilityHelpers.ts:58/60/61` unverändert · `Map2DTileCoordsUtil.ts:209/237` unverändert · `definePass.ts` TSDoc Z. 34–41 unverändert · `passFeatures.ts:25–31` unverändert · `TableFrame.ts:86–87` unverändert · `FeatureSprites.ts:159`, `:541`, `:577` unverändert; `resource-lifecycle.md` Regel 3 jetzt Z. 163–170 · Dazu (Zug 0): vier Fabriken (`paletteSwap`, `axisBillboardPlacement`, `flatPlacement`, `segmentPlacement`), Pass-Felder `without`/`uniformNames`/`material`/`renderOrder`, `options` von `new FeatureSprites()`, `RectangularVisibilityAreaHelpers#viewRectHelperHeight`, Vertrag in `types.ts`, Kommentar `Map2DTileStreamer.ts:262–264` · neu in »Offene Befunde«: `kind` und Optionen der Konstruktoren von `FeatureSprites`/`FeatureSpritesGeometry`/`FeatureSpritesMaterial` (→ Scope) · Folgen: keine offen · Restplan unverändert
  - 2026-10-24 Zug 1: Implementierer Runde 0 beauftragt · Modell sonnet (mittlere Stufe), Effort medium · Brief `paket-20.impl-0.brief.txt`
  - 2026-10-24 Zug 2: Report FERTIG (nachgefordert per Resume als `paket-20.impl-0-versuch-2.json`, die erste Rückgabe trug nur einen Nachsatz) · 32 Dateien geändert (Map2D-Sichtbarkeit, Helpers, Map2DTileCoordsUtil, passFeatures/definePass, fünf Feature-Fabriken, FeatureSprites, FeatureSpritesMaterial `checkPlacementStandIn`, CHANGELOG, sprites.md, drei Proposals) · rote Läufe belegt · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-20.verify.log`)
  - 2026-10-24 Zug 3: Reviewer (opus, medium) beauftragt · Diff `paket-20.diff` (2545 Zeilen) · Brief `paket-20.review-0.brief.txt`
  - 2026-10-24 Zug 3: Urteil `paket-20.review-0.json` · Annehmen, alle acht Nebenbefunde und alle »Dazu«-Stellen behoben, kritisch/wichtig keine, klein sieben
  - 2026-10-24 Zug 4: keine Runde (keine offenen Findings, keine kritischen oder wichtigen Befunde)
  - 2026-10-24 Zug 5: Commit 898cf144 (32 Dateien) mit Trailer `Remediation-Run: 2026-10-23`; Commit-Message nach dem kleinen Befund des Reviewers geschärft (»bindUniform() what is no source once the sprites are disposed«) · Verify `paket-20.verify.log` exit=0, seither keine Codeänderung · Arbeitsbaum sauber

## Abgleich

Jede Fundstelle gegen den Stand nach Paket 19 (`24f78f5b`) gelesen.

| Queue-Eintrag | Befund jetzt | Einordnung |
| --- | --- | --- |
| `RectangularVisibilityArea.ts:204–210` und `CameraBasedVisibility.ts:639–647` — Cache-Pfad ignoriert `previousTiles` | `RectangularVisibilityArea.ts` Z. 212–218: `if (!depsChanged && !this.needsUpdate && this.#visibleTiles != null)` setzt `reuseTiles = tiles`, `createTiles`/`removeTiles` `undefined`, ohne `previousTiles` anzusehen; `CameraBasedVisibility.ts` Z. 639–647 ebenso hinter `#dependenciesChanged()` und gibt nach einem `undefined` wieder `undefined`, auch für eine volle Liste (TSDoc Z. 594–596 erlaubt `undefined` nur bei leerer). Der Streamer hängt nicht am alten Verhalten: nach `clearTiles()` reicht er eine neue leere Liste (`Map2DTileStreamer.ts` Z. 262–265), und `Map2DTileRenderer#reuseTile()` (Z. 160–178) legt ein unbekanntes Tile über `addTile()` an — mit der Korrektur kommt es als `createTiles`, dasselbe Ergebnis | RVA verschoben, CBV unverändert |
| `CameraBasedVisibilityHelpers.ts:58–61` — Zahlenfelder ungeprüft | unverändert: `maxDebugHelpers = 9` (Z. 58), `tileBoxHelperExpand = -0.01` (Z. 60), `frustumBoxHelperExpand = 0` (Z. 61) als öffentliche Felder; gelesen Z. 215, 263, 366–373. Die beiden Expand-Felder sind ein Faktor der Boxgröße (Z. 261–268) und ohne TSDoc. `update()` liegt unter `hot-path-allocations.spec.ts` › `CameraBasedVisibilityHelpers on the hot path` | unverändert |
| `Map2DTileCoordsUtil.ts:209/237` — `getTileCoords()`/`computeTilesWithinCoords()` ungeprüft | unverändert: beide reichen `left`, `top`, `width`, `height` ungeprüft an `computeTilesWithinArea()` (Z. 257); beide unter `hot-path-allocations.spec.ts` › `Map2DTileCoordsUtil on the hot path` (Z. 372–386), mit gebrochenen Konstanten | unverändert |
| `definePass.ts:35–38` — TSDoc zu `placement` und `uniformNames` | unverändert: Z. 36–37 »no attributes, methods, `initialize`, usage aliases or placement«, Z. 37–38 »freezes copies of `features`, `without` and `material`«; Z. 50 kopiert `uniformNames`, `checkPass()` Z. 43–47 weist erst das zweite Placement ab. Das Proposal `sprite-features.md` Z. 762–767 stimmt schon | unverändert |
| `passFeatures.ts:25–31` — `checkPass()` ohne Formprüfung | unverändert: Z. 26 liest `pass.name` ungeprüft, Z. 31 `for (const feature of pass.features)` ungeprüft; `placementOfPass()` Z. 15 und `passFeatures()` Z. 113 rufen `.find`/`.map` — ein Iterable, das kein Array ist, bricht dort roh | unverändert |
| `TableFrame.ts:86–87` — `options` ungeprüft | unverändert: `options?.views` — `tableFrame(5)`, `tableFrame('x')` und `tableFrame(null)` antworten `TableFrame` | unverändert |
| `FeatureSprites.ts:159` — `passes` ungeprüft | unverändert: Destrukturierung Z. 159 mit `passes = []`; `passes.length` Z. 179, `for…of` Z. 188, `passes.flatMap` Z. 205 — eine Zahl wirft roh im `for…of`, ein String iteriert Zeichen | unverändert |
| `FeatureSprites.ts:541/577` — Rückkehr vor der Prüfung nach `dispose()` | unverändert: Setter `placement` Z. 541 `if (this.#material == null) return;` vor `checkFeature()` Z. 542; `bindUniform()` Z. 577 vor der Quellenprüfung Z. 578. `docs/resource-lifecycle.md` §3 Regel 3 steht jetzt Z. 163–170 (»Invalid input is still turned away«, Z. 167–168) | unverändert |

**Dazu (Zug 0), Stellen gleicher Ursache** — vorbestehend, geprüft mit
`git show 7341059f:<pfad>` (Stand vor dem ersten Commit des Laufs):

- `paletteSwap()` (`PaletteSwap.ts` Z. 55–56), `axisBillboardPlacement()` (Z. 32–33), `flatPlacement()`
  (Z. 54–56), `segmentPlacement()` (Z. 65–66) lesen ihre Optionen wie `tableFrame()` über `options?.…` und
  antworten auf `5` oder `'x'` still mit dem Default-Feature. Dieselbe Ursache wie der Eintrag zu
  `tableFrame()`; `wave()` und `gridBase()` (Pflichtoptionen) prüfen schon, `planeOf()` hat für optionale
  Optionen die Regel und den Wortlaut, denen Schritt 10 folgt.
- `checkPass()` liest auch `without`, `uniformNames`, `material` ungeprüft (`for … of pass.without`,
  `Object.entries(pass.uniformNames)` antwortet für `5` still `[]`, `{...material}` macht aus `5` ein `{}`), und
  `renderOrder` geht ungeprüft in `FeatureSpritesPass` (`FeatureSprites.ts` Z. 71). Dieselbe Ursache wie der
  Eintrag zu `checkPass()`: die Form des Passes wird nicht geprüft. `checkFeature()` prüft seit Paket 10 jedes
  Feld eines Features — der Pass bekommt dasselbe.
- `new FeatureSprites(kind, options)`: `options` selbst ohne Formprüfung — `null` wirft roh in der
  Destrukturierung Z. 159, `5` baut still mit Defaults. Dieselbe Stelle und Ursache wie der `passes`-Eintrag:
  `resolveParts()` »validates the options« (Z. 155), prüft aber ihre Form nicht.
- `RectangularVisibilityAreaHelpers#viewRectHelperHeight` (Z. 10), öffentliches Zahlenfeld ohne Prüfung und
  ohne TSDoc, gelesen Z. 112 — dieselbe Ursache wie der Eintrag zu `CameraBasedVisibilityHelpers`.
- Zum Eintrag `FeatureSprites.ts:541`: nach `dispose()` genügt die Formprüfung nicht. `sprites.placement = Tint`
  (wohlgeformt, aber ohne Placement-Stage) wiese der lebende Setter über das Material ab; die Ersatzregeln
  hängen allein an der Art, die `dispose()` stehen lässt — deshalb Schritt 12 mit der herausgezogenen
  Prüfung. `FeatureSpritesMaterial` prüft in seinem Setter auch nach dem eigenen `dispose()` vollständig
  (`docs/resource-lifecycle.md` §3, »the setter checks what it is handed«).
- Zum Cache-Eintrag: der Vertrag `IMap2DVisibilitor#computeVisibleTiles()` (`types.ts` Z. 231–249) sagt »held
  against `previousTiles`« ohne Ausnahme für einen Cache; ein Satz für Autoren eigener Visibilitors gehört dazu.
  Der Kommentar `Map2DTileStreamer.ts` Z. 262–264 beschreibt das alte Verhalten und wird sonst falsch.

**Geprüft und nicht aufgenommen:**

- Die übrigen Member eines disposten `FeatureSprites` — `setUniform()`, `setTexture()`, `touchTexture()`,
  `freeSprite()`, `sortBy()`, `sortByViewDepth()` — kehren zurück, bevor sie ihre Eingabe prüfen. Ihre Prüfung
  hängt an dem, was `dispose()` freigibt: Uniform- und Texturnamen an den Ressourcen des Materials
  (`SpriteResources#setUniform()` Z. 236–239, `#slot()`), der Sortierschlüssel an den Layouts des Pools
  (`VertexObjectPool#sortBy()`, `unknownSortKeyError`). Nichts davon lässt sich ohne die freigegebenen Teile
  beurteilen; `docs/resource-lifecycle.md` §3 Regel 3 nennt `FeatureSprites#setTexture()` selbst als Beispiel
  der stillen Rückkehr. Keine Stelle gleicher Ursache. Dasselbe gilt für Name und Typ in `bindUniform()`
  (Schritt 13).
- Die Konstruktoren von `FeatureSprites`, `FeatureSpritesGeometry` und `FeatureSpritesMaterial` prüfen nicht,
  dass `kind` aus `defineSprite()` kommt, und Geometrie und Material nicht die Form ihrer Optionen. Eigene
  Ursache — keine Klasse der Sprite-Schicht prüft ihre Art —, drei Konstruktoren und ihre Specs; das sprengte
  das Paket. Als Nebenbefund in »Offene Befunde« (→ Scope, low), für die Drain-Runde des Abschlusses.

**Entscheidungen in Zug 0** (ohne Rückfrage, Grund je dabei):

- Cache-Pfad: Code statt Doku. Die Queue erlaubt beides (»die TSDoc sagt das nicht«); der Vertrag in `types.ts`
  verlangt »held against `previousTiles`«, und eine Referenzprüfung kostet auf dem Frame-Pfad nichts. Eine
  Inhaltsprüfung (gleiche Tiles in anderer Liste) wäre O(n) je Frame für einen hypothetischen Aufrufer; die
  andere Liste bekommt stattdessen eine korrekte Neuberechnung.
- `width`/`height` von `getTileCoords()` ab 0, nicht über 0: die Randmatrix prüft `width = 0` als gültig.
  Negative Breiten weisen ab — sie ergeben heute Spalten ≤ 0.
- Debug-Felder als `#`-Felder hinter Accessoren statt eines Typed Arrays: geschrieben wird nur im Setter (vom
  Nutzer), gelesen in `update()` direkt über das `#`-Feld, ohne Getteraufruf — das boxt nicht. Die
  Allokations-Spec der Helpers hält das fest.
- Optionen der Fabriken nach `planeOf()` (Arrays gehen durch, `null` nicht): das ist die Regel, die der Lauf für
  optionale Optionen schon hat (Paket 11); `defineSprite()` und `resolveParts()` nehmen Pflicht- bzw.
  Konstruktoroptionen und weisen Arrays ab wie `checkFeature()` (`isRecord`).
- `passes` und `features` als Array, nicht als Iterable: der Code darunter ruft Array-Methoden.
- Ersatzregeln der Placement in `FeatureSprites` vor den Pass-Prüfungen, im eigenen Namen, auf beiden Wegen —
  statt nur nach `dispose()` mit anderem Subjekt als der lebende Weg. Gleiche Eingabe, gleiche Meldung; der
  doppelte Lauf von `checkKind` liegt auf keinem Frame-Pfad.
- Kein **BREAKING**: abgewiesen wird `NaN`, Negatives, Nicht-Objekte — nichts, womit ein Aufrufer sinnvoll
  rechnen konnte. Die Accessoren der Helpers bleiben für TypeScript `number`.
- Modell mittlere Stufe, Effort medium: viele lokale Prüfungen mit Regressionstests nach genauen Vorgaben,
  zwei Frame-Pfade unter bestehenden Allokations-Specs; Paket 19 gleichen Zuschnitts lief mit 0 Runden.

## Urteil des Reviewers (Zug 3, `paket-20.review-0.json`)

Erfüllung:
1. Cache-Pfad ignoriert `previousTiles` — behoben: `RectangularVisibilityArea.ts:219` (Referenzvergleich, TSDoc ab :162), `CameraBasedVisibility.ts:645–650` (zweiter Arm `undefined ⇒ previousTiles.length === 0`, TSDoc ab :603); Specs `RectangularVisibilityArea.spec.ts:58ff.`, `CameraBasedVisibility.spec.ts:396ff.`
2. Zahlenfelder von `CameraBasedVisibilityHelpers` — behoben: Accessoren `CameraBasedVisibilityHelpers.ts:54–113`, Lesestellen :267, :315, :420–425 über `#`-Felder, `dispose()`-TSDoc :442
3. `Map2DTileCoordsUtil#getTileCoords()`/`#computeTilesWithinCoords()` — behoben: :219–232, :263–276, `static #refuseSelection` :320, `@throws` in beiden TSDocs
4. TSDoc `definePass()` — behoben: `definePass.ts:35–48`
5. `checkPass()` ohne Formprüfung — behoben: `passFeatures.ts:40–91`; Specs `definePass.spec.ts:97ff.`
6. `tableFrame()` Optionen — behoben: `TableFrame.ts:88`, Spec `TableFrame.spec.ts:76ff.`
7. `resolveParts()` `passes` — behoben: `FeatureSprites.ts:161–168`, `checkPass()` in der Schleife :198; Specs `FeatureSprites.spec.ts:465ff.`
8. Setter `placement`/`bindUniform()` nach `dispose()` — behoben: `FeatureSprites.ts:553–560` mit `checkPlacementStandIn` (`FeatureSpritesMaterial.ts:81`, `@internal`), `bindUniform()` :594ff.; Specs `FeatureSprites.spec.ts:298ff.`

»Dazu«-Stellen: Optionen von `paletteSwap` (`PaletteSwap.ts:57`), `axisBillboardPlacement` (`AxisBillboardPlacement.ts:34`), `flatPlacement` (`FlatPlacement.ts:56`), `segmentPlacement` (`SegmentPlacement.ts:67`) — behoben; Pass-Felder `without`/`uniformNames`/`material`/`renderOrder` — behoben (`passFeatures.ts:71–91`); `options` von `new FeatureSprites()` — behoben (`FeatureSprites.ts:161`); `RectangularVisibilityAreaHelpers#viewRectHelperHeight` — behoben (`RectangularVisibilityAreaHelpers.ts:30–47`); Ersatzregeln der Placement nach `dispose()` — behoben; Vertrag `types.ts:247–248` — behoben; Kommentar `Map2DTileStreamer.ts:262–263` — behoben.

Kleine Befunde (lösen keine Runde aus):
- `passFeatures.ts:91–93`: die Umbenennungsprüfungen von `uniformNames` laufen nach den Prüfungen von `material` und `renderOrder`, Schritt 8 setzt sie direkt hinter die Formprüfung von `uniformNames`; bei zwei Fehlern wird ein anderer zuerst gemeldet, abgewiesen werden beide.
- `docs/sprites.md:2219–2220`: »and so does it `features` that are no list, …« ist grammatisch schief.
- `docs/proposals/sprite-features.md:769`: Zeile nicht umbrochen.
- `FeatureSprites.ts:307`: `@throws`-Zeile des Konstruktors nicht umbrochen.
- `definePass.ts:46`: `RangeError` ohne Backticks, `TypeError` darüber mit.
- Commit-Message: »bindUniform() a source it cannot bind« sagte mehr, als der Code tut — vor dem Commit übernommen.
- Factory-Specs und `definePass.spec.ts:166` prüfen die Meldung per `toThrow(string)` als Teilstring; die Klasse wird getrennt geprüft.

Abweichungen laut Implementierer: `isObject(options as unknown)` in den fünf Fabriken und `resolveParts()` (sonst TS4111 über die verengte Index-Signatur); Fälle zur Pass-Form in `definePass.spec.ts`; `Map2DTileStreamer.spec.ts` unverändert (kein Fall prüfte das alte Verhalten nach `clearTiles()`).

## Findings im Volltext

Keine Audit-Findings. Die Nebenbefunde im Wortlaut der Queue:

**`RectangularVisibilityArea.ts:204–210` · low · Paket 8** — (Cache-Pfad von `computeVisibleTiles()`) ignoriert
`previousTiles`: wer eine andere Liste übergibt als die `tiles` des letzten Ergebnisses, bekommt
`reuseTiles = tiles` und kein `removeTiles`; die TSDoc sagt das nicht. Dasselbe im Cache-Zweig von
`CameraBasedVisibility#computeVisibleTiles()` (`CameraBasedVisibility.ts:691–699`, am Laufbeginn schon so, Zug 0
von Paket 9; nach Paket 9 `CameraBasedVisibility.ts:639–647`, der Zweig hinter `#dependenciesChanged()`).

**`CameraBasedVisibilityHelpers.ts:58–61` · low · Paket 9** — die öffentlichen Zahlenfelder `maxDebugHelpers`,
`tileBoxHelperExpand`, `frustumBoxHelperExpand` sind ungeprüft; ein `NaN` in einem Expand-Feld macht die Box
jedes Helpers zu `NaN`.

**`Map2DTileCoordsUtil.ts:209` `getTileCoords()` und `:237` `computeTilesWithinCoords()` · low · Paket 9** —
nehmen `left`/`top`/`width`/`height` ungeprüft; `NaN` ergibt `NaN` als Tile-Koordinate und als Spalten- und
Zeilenzahl, ohne Meldung.

**`definePass.ts:35–38` (TSDoc) · low · Paket 10** — sagt, ein Pass-Feature bringe keine `placement`; ein Pass
darf eine mitbringen, `checkPass()` weist erst die zweite ab; `uniformNames` fehlt unter den eingefrorenen
Kopien, obwohl Z. 50 sie kopiert.

**`passFeatures.ts:25–31` `checkPass()` · low · Paket 10** — prüft weder, dass `pass` ein Objekt ist, noch dass
`pass.features` iterierbar ist: ein Pass ohne `definePass()` mit `features: undefined` wirft einen rohen
`TypeError` ohne Subjekt, in `definePass()`, `passFeatures()` und `new FeatureSprites({passes})`.

**`TableFrame.ts:86–87` `tableFrame()` · low · Paket 10** — `options` ohne Formprüfung: `tableFrame(5)` oder
`tableFrame('x')` antwortet still mit `TableFrame`.

**`FeatureSprites.ts:159` `resolveParts()` · low · Paket 10** — `passes` wird nicht als Liste geprüft, ein
Nicht-Iterable wirft roh im `for…of`.

**`FeatureSprites.ts:541` (Setter `placement`) und `:577` (`bindUniform()`) · low · Paket 10** — auf einer
disposten Instanz kehren beide vor jeder Eingabeprüfung zurück und schlucken eine ungültige Eingabe still;
`docs/resource-lifecycle.md:162–163` (§3, Regel 3; nach Paket 11 Z. 164–165) verlangt »Invalid input is still
turned away«. Am Laufbeginn schon so (`git show 2ad669ff:…FeatureSprites.ts`, Z. 505), die Feature-Prüfung aus
Paket 10 steht nach Detailplan hinter derselben Rückkehr.
