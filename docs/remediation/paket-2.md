# Paket 2 — map2d: Tile-Ermittlung, Bezugssystem und Visibilitor-Wechsel korrigieren

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-070 (high), BUG-071 (medium), BUG-072 (medium)
- Ziel: Map2D liefert für jede Kamera- und Visibilitor-Lage die richtigen Tiles an der richtigen Weltposition.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts` + `RepeatingTilesProvider.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` + `Map2DTileStreamer.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2D.ts` + `Map2D.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` + `CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts` (nur TSDoc an `add()`)
  - `packages/twopoint5d/src/map2d/types.ts` (nur TSDoc)
  - `packages/twopoint5d-testing/test/map2d-placement.test.js` (neu)
  - `packages/twopoint5d/CHANGELOG.md`
  - bleibt unverändert: `RectangularVisibilityArea.ts` — füllt `translate` weiter, der Wert ist ab jetzt informativ (Schritt 3)
- Verify: `pnpm run ci`
- Commit: `fix(map2d): draw and cull a moved map in its own space, fill a vertical pattern from any left edge and rebuild the tiles when the visibilitor changes`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · BUG-070 unverändert (`RepeatingTilesProvider.ts:137-150`; `getTileIdsWithin(1, 0, 3, 1)` auf `[1,2,3,4]`/`'vertical'` wirft `RangeError: offset is out of bounds`, nachgestellt) · BUG-071 unverändert (`Map2D.ts:107-113`, `Map2DTileStreamer.ts:113-119`, `RectangularVisibilityArea.ts:155`, `CameraBasedVisibility.ts:448-454, 594-597, 604-608`; nachgestellt: Map bei x=1000 → Renderer-Knoten Welt-x 1872 statt 872; Map+Kamera bei x=5000 → 15 statt 437 Tiles, `centerWorld` von Tile 0,0 bei x=10000 statt 5000) · BUG-072 unverändert (`Map2D.ts:48-52`, `Map2DTileStreamer.ts:20`, Cache-Pfade `CameraBasedVisibility.ts:314-322`, `RectangularVisibilityArea.ts:92-98`; nachgestellt: A→B→A hält 16 statt 4 Tiles) · Fix-Skizze gegen eine Scratch-Kopie gerechnet: alle drei nachgestellten Fälle richtig, 410 bestehende map2d-Specs grün · Folgen aus Paket 1 (`StageRenderer.ts:737-751`, `IStage.ts:8-11`) → Nachtragspaket 8 geschnitten · »Offene Befunde«: keiner teilt die Ursache, alle bleiben liegen; neu `Map2DTileCoordsUtil.ts:45-53` → Audit · Restplan: Paket 8 hinter Paket 2 eingefügt, sonst unverändert
  - 2026-09-19 Zug 1: Implementierer beauftragt (claude -p, opus, effort medium, `remediate-p2-impl-1`), Report nach `paket-2.impl-1.json`
  - 2026-09-19 Zug 2: Report FERTIG · 11 Dateien geändert (`RepeatingTilesProvider`, `Map2DTileStreamer`, `Map2D`, `CameraBasedVisibility` je + spec, `CameraBasedVisibilityHelpers.ts`, `types.ts`, `CHANGELOG.md`), neu `packages/twopoint5d-testing/test/map2d-placement.test.js` · rote Läufe: RepeatingTilesProvider 3 failed/40, map2d 6 failed/428, Visibilitor-Specs 5 rot, Browsertest 15 statt 437 · Abweichungen: CHANGELOG zusätzlich `### Changed` + Migration Guide, Browsertest mit eigener Kamera je Map · 4 Nebenbefunde gemeldet · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (opus, medium, `paket-2.review-1.json`) · BUG-070, BUG-071, BUG-072 behoben · 0 kritisch, 0 wichtig, 2 klein · Diff `paket-2.diff`
  - 2026-09-19 Zug 4: keine Runde nötig (OFFEN: 0)
  - 2026-09-19 Zug 5: `pnpm run ci` exit=0 (`paket-2.verify.log`) · Commit f499ca2 · 4 Nebenbefunde in »Offene Befunde« · Folgen: keine

## Vorgehen

Drei unabhängige Schritte, in dieser Reihenfolge. Für jeden Korrektheitsfehler
zuerst den Regressionstest schreiben und rot laufen sehen
(`pnpm nx test twopoint5d -- src/map2d/<datei>.spec.ts`), dann beheben; die
roten Läufe gehören in den Report. Code, Kommentare, TSDoc und CHANGELOG auf
Englisch; keine Finding-IDs. In Code, Kommentaren und TSDoc kein Satz über den
Vorzustand (»previously«, »no longer«, »now«, »anymore«); im CHANGELOG gilt der
Test aus »Konventionen« im Plan. Die Kommentartexte unten sind Vorschläge im
Ton des Moduls — Inhalt verbindlich, Wortlaut darf sich dem Nachbarcode
anpassen. Bevor du eine geänderte Datei verlässt, liest du sie ganz.

### Schritt 1 — `RepeatingTilesProvider#getTileIdsWithin()` mit `'vertical'` für jede linke Kante

Der `'vertical'`-Zweig (`RepeatingTilesProvider.ts:132-152`) rechnet nur mit
`left <= 0`. Für `0 < left < cols` wird `leftOffset = -left` negativ, der
`slice` beginnt bei Musterspalte 0, und `target.set(tiles, -1)` wirft in der
ersten Zeile.

**Regressionstests** in `RepeatingTilesProvider.spec.ts`:

1. Unter `describe('getTileIdsWithin()')` → `describe('vertical')` zwei Tests:
   - `test('starts at the pattern column of a left edge inside the pattern', …)`:
     `new RepeatingTilesProvider([1, 2, 3, 4], 'vertical')`;
     `Array.from(p.getTileIdsWithin(1, 0, 3, 1))` → `[2, 3, 4]`;
     `Array.from(p.getTileIdsWithin(2, 0, 2, 1))` → `[3, 4]`.
   - `test('fills with 0 past the right edge of the pattern for a left edge inside it', …)`:
     `new RepeatingTilesProvider([[1, 2, 3, 4], [5, 6, 7, 8]], 'vertical')`;
     `getTileIdsWithin(1, 0, 3, 2)` → `[2, 3, 4, 6, 7, 8]`;
     `getTileIdsWithin(2, 1, 4, 2)` → `[7, 8, 0, 0, 3, 4, 0, 0]`.
2. Direkt unter `describe('getTileIdsWithin()')` ein
   `describe('agrees with getTileIdAt()')` mit `test.each(['vertical', 'horizontal', 'none'] as const)('%s', …)`:
   für jedes Muster aus `[[1, 2, 3, 4], [5, 6, 7, 8]]`, `[[1, 2, 3]]`,
   `[[1], [2], [3]]`, `[[9]]` und jedes `left` in `-6..6`, `top` in `-4..4`,
   `width` in `1..9`, `height` in `1..4` muss Zelle `j * width + i` gleich
   `getTileIdAt(left + i, top + j)` sein. Nicht 17 000 `expect`s: Abweichungen
   und Throws als Strings (`pattern, left, top, width, height`, erste
   abweichende Zelle bzw. Fehlermeldung) in ein Array sammeln und
   `expect(mismatches).toEqual([])`. Nachgerechnet: vor dem Fix `'vertical'`
   1620 Throws, `'horizontal'` und `'none'` 0 Abweichungen; nach dem Fix alle
   drei 0.

**Fix** — in `RepeatingTilesProvider.ts` den Block `// === inside ===` des
`'vertical'`-Zweigs (heute Zeilen 137-150) ersetzen:

```ts
          // === inside ===
          // the columns the rectangle shares with the pattern — left and right of them the
          // pattern does not repeat along this axis, and there is nothing but 0
          const overlapStart = Math.max(left, 0);
          const overlapEnd = Math.min(right, this.#cols - 1);
          const targetStart = overlapStart - left;
          const targetEnd = targetStart + overlapEnd - overlapStart + 1;
          let patternRow = top < 0 ? top + Math.ceil(-top / this.#rows) * this.#rows : top;
          for (let y = 0; y < height; y++) {
            const row = this.#tileIds[patternRow++ % this.#rows]!;
            const rowOffset = y * width;
            target.fill(0, rowOffset, rowOffset + targetStart);
            target.set(row.slice(overlapStart, overlapEnd + 1), rowOffset + targetStart);
            target.fill(0, rowOffset + targetEnd, rowOffset + width);
          }
```

Die Außen-Prüfung davor (`right < 0 || left >= this.#cols`) bleibt, sie
garantiert `overlapStart <= overlapEnd`. `fill` mit gleichem Start und Ende ist
ein No-op, ein Sonderfall für `targetStart === 0` ist unnötig.

### Schritt 2 — ein Visibilitor-Wechsel baut die Tiles neu

Beide Visibilitoren antworten bei unveränderten Abhängigkeiten aus ihrem Cache
und sehen `previousTiles` dabei nicht an; das trägt nur, solange
`previousTiles` ihre eigene letzte Liste ist. Ein Wechsel A → B → A bei
stehender Kamera lässt Bs Tiles im Renderer. Dazu hält `Map2D` in
`#visibilitor` eine zweite Wahrheit neben `Map2DTileStreamer#visibilitor`,
und der Early-Return im Map2D-Setter vergleicht gegen die veraltete Kopie.

**Regressionstests:**

1. `Map2DTileStreamer.spec.ts`: `makeRecordingRenderer()` bekommt ein Feld
   `held: Set<string>` — das bisher lokale `known` wird dieses Feld (ins
   Interface `RecordingRenderer` aufnehmen, Verhalten sonst gleich). Unter
   `describe('update()')`:
   - `test('a visibilitor that takes over from another one gets the tiles built again', …)`:
     `a = makeCachingVisibilitor([tileA])`, `b = makeCachingVisibilitor([tileA, tileB])`;
     `streamer.visibilitor = a; update; streamer.visibilitor = b; update; streamer.visibilitor = a; update`;
     `expect([...renderer.held]).toEqual(['0,0'])` (vor dem Fix `['0,0', '1,0']`).
   - `test('assigning the visibilitor it already holds costs nothing', …)`:
     `streamer.visibilitor = a; update; streamer.visibilitor = a; update` →
     `renderer.cleared` ist 0, `renderer.added.map((t) => t.id)` ist `['0,0']`.
2. `Map2D.spec.ts`, neues `describe('visibilitor')`, mit einem Renderer, der
   die gehaltenen Tile-IDs in einem `Set` führt (add/reuse fügen hinzu, remove
   nimmt heraus, clear leert):
   - `test('a visibilitor switched away and back leaves only its own tiles in the renderers', …)`:
     `map.tileWidth = 100; map.tileHeight = 100`; `a = new RectangularVisibilityArea(100, 100)`,
     `b = new RectangularVisibilityArea(300, 300)`; `map.visibilitor = a; map.update()` →
     Set merken (`['-1,-1', '-1,0', '0,-1', '0,0']`); `b`, update; `a`, update →
     das Set ist wieder genau das gemerkte (vor dem Fix 16 IDs).
   - `test('answers with the visibilitor its tile streamer holds', …)`:
     `map.tileStreamer.visibilitor = b` → `map.visibilitor` ist `b` (vor dem Fix `undefined`).
   - `test('hands a visibilitor to a streamer that was given another one directly', …)`:
     `map.visibilitor = a; map.tileStreamer.visibilitor = b; map.visibilitor = a` →
     `map.tileStreamer.visibilitor` ist `a` (vor dem Fix `b`).
   - `test('hands its visibilitor to the streamer that takes over', …)`:
     `map.visibilitor = a; map.tileStreamer = new Map2DTileStreamer()` → Streamer
     und Map antworten mit `a`.
   - `test('keeps the visibilitor a streamer brings along when the map has none', …)`:
     `const s = new Map2DTileStreamer(); s.visibilitor = b; map.tileStreamer = s` →
     `map.visibilitor` ist `b` (vor dem Fix `undefined`).
   Der bestehende Test `builds the tiles again when another streamer takes over`
   (erwartet genau ein `clearTiles`) bleibt grün — nachgerechnet.

**Fix:**

1. `Map2DTileStreamer.ts`: das öffentliche Feld `visibilitor?: IMap2DVisibilitor;`
   (Zeile 20) wird ein Accessor-Paar über einem privaten Feld:

   ```ts
   #visibilitor?: IMap2DVisibilitor;

   /**
    * The visibilitor that decides which tiles are visible.
    *
    * A visibilitor answers from the state of its own last call and holds the tile list it is
    * handed against that state — the tiles another visibilitor laid out are no ground for its
    * answer. Replacing a visibilitor, with another one or with `undefined`, therefore clears the
    * tiles as a change of the tile grid does: the next {@link update} empties every renderer and
    * the visibilitor then in place lays out the whole set. The first visibilitor, and the one
    * already held, cost nothing.
    */
   get visibilitor(): IMap2DVisibilitor | undefined {
     return this.#visibilitor;
   }

   set visibilitor(visibilitor: IMap2DVisibilitor | undefined) {
     if (this.#visibilitor === visibilitor) return;
     const previous = this.#visibilitor;
     this.#visibilitor = visibilitor;
     if (previous != null) this.clearTiles();
   }
   ```

   Geklärt wird nur beim Ersetzen, nicht beim ersten Zuweisen: drei bestehende
   Specs zählen `renderer.cleared` nach der ersten Zuweisung (0 bzw. 1) und
   blieben sonst nicht grün, und ohne Vorgänger gibt es keine fremde Liste.
   In `update()` den Visibilitor einmal in eine lokale Konstante lesen und die
   benutzen.

2. `Map2D.ts`: das Feld `#visibilitor` entfällt; `Map2D` führt den Visibilitor
   wie `centerX`, `tileWidth` und die übrigen Eigenschaften durch den Streamer:

   ```ts
   /**
    * The visibilitor of the tile streamer underneath. Assigning one hands it to the streamer,
    * which has the tiles built again when it replaces another one.
    */
   get visibilitor(): IMap2DVisibilitor | undefined {
     return this.#tileStreamer.visibilitor;
   }

   set visibilitor(v: IMap2DVisibilitor) {
     this.#tileStreamer.visibilitor = v;
   }
   ```

   Die Signaturen bleiben (Getter `IMap2DVisibilitor | undefined`, Setter
   `IMap2DVisibilitor`). Im `tileStreamer`-Setter wird aus
   `if (this.#visibilitor) { streamer.visibilitor = this.#visibilitor; }`:

   ```ts
   // the visibilitor goes with the map as the view center does; a streamer taking over from one
   // that had none keeps the visibilitor it brings along
   const visibilitor = previous.visibilitor;
   if (visibilitor) {
     streamer.visibilitor = visibilitor;
   }
   ```

   Das abschließende `streamer.clearTiles()` im Setter bleibt.

Den robusteren zweiten Weg der Audit-Empfehlung — den Cache-Pfad in beiden
Visibilitoren nur bei `previousTiles === this.#visibleTiles?.tiles` nehmen —
nicht umsetzen; Begründung unten.

### Schritt 3 — ein bewegter Map-Knoten: ein Bezugssystem, eine Anwendung von `matrixWorld`

`Map2D` hängt die Renderer-Knoten als Kinder an sich (`Map2D.ts:111`),
`Map2DTileStreamer#update()` schreibt ihnen aber die Weltposition des
Map-Knotens (`translate`) zusätzlich in die lokale `position`
(`Map2DTileStreamer.ts:113-119`). Eine Map bei `(t, 0, 0)` zeichnet ihre Tiles
bei `2t`. `CameraBasedVisibility` baut `#tileBoxMatrix` mit demselben
`translate` (`CameraBasedVisibility.ts:448-454`) und wendet danach
`matrixWorld` an (`594-597`, `604-608`) — Culling-Boxen und `centerWorld`
liegen ebenso um `t` daneben, während die Probe-Strahlen die Ebene richtig
treffen (`convertToPlaneCoords2D` rechnet über `#matrixWorldInverse` korrekt in
lokale Koordinaten zurück; die Subtraktion von `planeOrigin` verschiebt nur
die lokale y-Komponente, die verworfen wird).

Das Bezugssystem ist der lokale Raum des Map-Knotens: dort platziert der
Streamer die Renderer-Knoten, dort liegen `TileBox#box` und die Tile-Box-Helper
(`CameraBasedVisibilityHelpers` hängt sie in die an `add()` übergebene Szene,
Browsertest und Lookbook übergeben `map2d`). `matrixWorld` wird genau einmal
angewendet, und nur wo Weltraum gebraucht wird: Ebene, `frustumBox`,
`centerWorld`.

**Regressionstests:**

1. `Map2DTileStreamer.spec.ts`, unter `describe('update()')`:
   `test('places the renderers at the offset of the visibilitor, in the space of the node it is handed', …)` —
   Visibilitor-Stub, der
   `{tiles: [tileA], createTiles: [tileA], offset: new Vector2(-60, -45), translate: new Vector3(7, 3, 11)}`
   liefert; nach `update(new Object3D())` ist
   `renderer.positions[0].toArray()` gleich `[-60, 0, -45]` (vor dem Fix `[-53, 3, -34]`).
2. `Map2D.spec.ts`, neues `describe('update()')`, mit einem Renderer, dessen
   `beginUpdatingTiles(position)` `this.node.position.copy(position)` ausführt:
   - `test('places the renderer node in the local space of a moved map', …)`:
     `tileWidth`/`tileHeight` 256, `xOffset`/`yOffset` -128,
     `map.position.set(1000, 0, 0)`, `map.visibilitor = new RectangularVisibilityArea(640, 480)`,
     `map.update()` → `renderer.node.position.toArray()` ist `[-128, 0, -128]`;
     nach `map.updateMatrixWorld(true)` liefert
     `renderer.node.getWorldPosition(new Vector3()).toArray()` `[872, 0, -128]`
     (vor dem Fix `[1872, 0, -128]`).
   - `test('places the renderer node through the whole transform of a turned parent', …)`:
     `parent = new Group()`, `parent.position.set(0, 0, 500)`,
     `parent.rotation.y = Math.PI / 2`, `parent.add(map)`, `map.position.set(1000, 0, 0)`,
     sonst wie oben; nach `update()` und `parent.updateMatrixWorld(true)` liegt
     die Weltposition des Renderer-Knotens bei
     `new Vector3(-128, 0, -128).applyMatrix4(map.matrixWorld)` (`distanceTo < 1e-6`).
3. `CameraBasedVisibility.spec.ts`, neues `describe('a map away from the origin')`.
   Kamera wie `makeTiltedCamera()`, aber mit Position und Blickziel aus der
   jeweiligen Matrix: `camera.position.copy(new Vector3(0, 350, 500).applyMatrix4(M))`,
   `camera.lookAt(new Vector3(0, 0, 0).applyMatrix4(M))`, dann
   `updateMatrixWorld()` und `updateProjectionMatrix()`. Raster
   `new Map2DTileCoordsUtil(256, 256, -128, -128)`.
   - `test('puts every visible tile where the map draws it', …)`:
     `M = new Matrix4().makeTranslation(5000, 0, 0)`, Mittelpunkt `[100, 50]`;
     für jedes `tile` in `visibility.visibles` mit
     `local = new Vector3(tile.x * 256 + 128 - 128 - 100, 0, tile.y * 256 + 128 - 128 - 50)`:
     `tile.centerWorld` liegt bei `local.clone().applyMatrix4(M)`,
     `tile.box.getCenter(v)` hat x/z von `local` (y 0), und
     `tile.frustumBox.containsPoint(tile.centerWorld)` ist `true`
     (`distanceTo < 1e-6`; vor dem Fix `centerWorld` um 5000 in x daneben).
   - `test('finds the same tiles for a map and a camera moved together', …)`:
     Referenz `M = new Matrix4()`, Vergleich `makeTranslation(5000, 0, 0)` →
     sortierte `tiles`-IDs gleich (nachgerechnet: 437 und 437; vor dem Fix 437 und 15).
   - `test('finds the same tiles for a map and a camera moved and turned together', …)`:
     Vergleich `new Matrix4().makeTranslation(5000, 0, 300).multiply(new Matrix4().makeRotationY(Math.PI / 2))`
     → gleiche sortierte IDs. Kommentar im Test: eine Vierteldrehung um Y,
     weil die Welt-AABB einer so gedrehten Box exakt ist — bei anderen Winkeln
     wächst sie, und der Frustum-Test lässt am Rand mehr Tiles durch.
   Die bestehenden Tests zu `translate`
   (`returns offset and translate vectors…`, `respects matrixWorld translation in the returned translate vector`)
   bleiben unverändert grün: `translate` wird weiter gefüllt.
4. Browsertest `packages/twopoint5d-testing/test/map2d-placement.test.js` (neu),
   Fixture wie `map2d-tile-upload.test.js` (`makeContainer`, `disposeDisplay`,
   `Display` in `beforeEach`, `PerspectiveCamera(75, 1.6, 0.1, 4000)`, `makeMap`
   mit `TileSet`/`RepeatingTilesProvider([[1, 2], [3, 4]])`/`TileSprites`/
   `TileSpritesFactory`/`Map2DTileRenderer`, `CameraBasedVisibility`; `makeMap`
   gibt zusätzlich den `tileRenderer` zurück):
   - `it('a moved map draws as many tiles as the same map at the origin', …)`:
     erst Map und Kamera am Ursprung (Kamera `(0, 350, 500)` → `(0, 0, 0)`),
     zwei Frames (`map2d.update()`, `display.renderer.render(scene, camera)`,
     `await display.nextFrame()`), `usedCount` merken (> 0); dann eine zweite
     Map in einer neuen `Scene` bei `position.x = 4096` mit der Kamera bei
     `(4096, 350, 500)` → `(4096, 0, 0)`, zwei Frames: gleicher `usedCount`, und
     `tileRenderer.node.getWorldPosition(v)` liegt bei `(4096 - 128, 0, -128)`.
   Die Browsertests laufen gegen `dist`: für den roten Lauf vor dem Fix
   `pnpm build:twopoint5d`, dann `pnpm test:browser`. Lässt er sich nicht rot
   sehen, im Report sagen, warum.

**Fix:**

1. `Map2DTileStreamer.ts`, `update()` (Zeilen 113-119):

   ```ts
   // the renderer nodes are children of `node` — Map2D adds them to itself — so they are placed
   // in its local space, and its own world matrix carries them into the world
   const offset = visible.offset;
   const position = this.#position.set(offset?.x ?? 0, 0, offset?.y ?? 0);
   ```

   `visible.translate` wird hier nicht mehr gelesen. TSDoc an
   `update(node: Object3D)`: `node` is the node the tile renderer nodes are
   children of — `Map2D` hands itself over. Its world matrix goes to the
   visibilitor, and the renderer nodes are placed in its local space.

2. `CameraBasedVisibility.ts`, `findVisibleTiles()` (Zeilen 448-454):

   ```ts
   // the tile boxes are built in the local space of the map node, where the renderers draw the
   // tiles; `matrixWorld` takes them into world space once, where the frustum is tested
   this.#tileBoxMatrix.makeTranslation(
     this.map2dTileCoords.xOffset - this.#centerPoint2D.x,
     0,
     this.map2dTileCoords.yOffset - this.#centerPoint2D.y,
   );
   ```

   `const translate = this.#scratchTranslate.setFromMatrixPosition(this.matrixWorld);`
   bleibt und geht weiter als `translate` in das Ergebnis. `prepareTile()` und
   `acceptTile()` bleiben, wie sie sind (erst `#tileBoxMatrix`, dann
   `matrixWorld` für `frustumBox` und `centerWorld`; nur `#tileBoxMatrix` für
   `box`).

3. TSDoc am Interface `TileBox` (`CameraBasedVisibility.ts:11-31`), je ein Satz:
   - `box`: the box of the tile in the local space of the map node, where the
     tile renderers draw it.
   - `frustumBox`: the box the view frustum is tested against, in world space,
     scaled by `frustumBoxScale`.
   - `centerWorld`: the center of the tile in world space.

4. `CameraBasedVisibilityHelpers#add()` bekommt TSDoc: the scene named here is
   the map node — the tile boxes are in its local space; the plane, the points
   and the frustum boxes are in world space and go into the root above it.

5. `types.ts`:
   - `IMap2DVisibleTiles#offset`: vor den bestehenden Absatz ein Satz — where
     the origin of the tile grid lies in the local space of the map node, on
     its XZ plane: `x` along X, `y` along Z. `Map2DTileStreamer` places the
     tile renderer nodes there.
   - `IMap2DVisibleTiles#translate`: vor den bestehenden Absatz — the world
     position of the map node, the translation of the `matrixWorld` the
     visibilitor was given. It is informational: the tile renderer nodes are
     children of the map node and take on its whole transform, so nothing adds
     it to their position.
   - `IMap2DTileRenderer#beginUpdatingTiles`: in den ersten Absatz — `position`
     is in the local space of the map node, the parent of {@link node}.

### CHANGELOG

Skill `updating-changelog` laden. Unter `## [Unreleased]` → `### Fixed` drei
Einträge im Ton der Nachbarn (Inhalt verbindlich, Wortlaut frei):

- `RepeatingTilesProvider#getTileIdsWithin()` mit `'vertical'` für eine linke
  Kante innerhalb des Musters: die Zeile beginnt an der Musterspalte dieser
  Kante, rechts vom Muster steht 0 — dieselben Werte, die `getTileIdAt()` für
  diese Zellen liefert; der Aufruf warf einen `RangeError`. Der bestehende
  Eintrag zum `'horizontal'`/`'none'`-Fix bleibt, wie er ist.
- ein `Map2D` außerhalb des Weltursprungs bzw. unter einem bewegten Elternknoten:
  Tiles werden im lokalen Raum der Map gezeichnet und gecullt, ihre
  Welttransformation gilt einmal. Die Renderer-Knoten wurden um die
  Weltposition der Map ein zweites Mal verschoben (Map bei `(t, 0, 0)` →
  Tiles bei `2t`), und `CameraBasedVisibility` testete ebenso verschobene
  Boxen gegen das Frustum. `Map2DTileStreamer` gibt den Renderern das `offset`
  des Visibilitors als Position; `IMap2DVisibleTiles#translate` wird weiter
  gefüllt und nennt die Weltposition des Map-Knotens, fließt aber in keine
  Position ein. `TileBox#box` liegt im lokalen Raum der Map — die
  Tile-Box-Helper von `CameraBasedVisibilityHelpers` gehören deshalb in den
  Map-Knoten (`helpers.add(map2d)`).
- `Map2D#visibilitor` und `Map2DTileStreamer#visibilitor`: ein Visibilitor, der
  einen anderen ersetzt, lässt die Tiles neu bauen; nach A → B → A blieben
  Bs Tiles gezeichnet in den Renderern. `Map2D#visibilitor` liest und schreibt
  den Visibilitor seines Streamers. `Map2DTileStreamer#visibilitor` ist ein
  Getter/Setter-Paar auf dem Prototyp.

Der Skill entscheidet, ob das Accessor-Paar zusätzlich unter `### Changed`
oder in den Migration Guide gehört (eine Unterklasse, die `visibilitor` als
Feld redeklariert, kompiliert nicht mehr — TS2610).

## Entscheidungen in diesem Paket

- **BUG-070 folgt der Empfehlung** (Überlapp einmal berechnen, links und
  rechts Nullen, `slice(overlapStart, overlapEnd + 1)` bei
  `rowOffset + (overlapStart - left)`). Der Konsistenztest über alle drei
  Achsen kostet nichts und bindet `getTileIdsWithin()` an `getTileIdAt()` —
  nachgerechnet grün für `'horizontal'` und `'none'` schon heute, rot für
  `'vertical'` nur durch die Throws; einen stillen Fehlwert gibt es über die
  öffentliche Methode nicht, weil Zeile 0 immer zuerst wirft.
- **BUG-071: der saubere Weg der Empfehlung** — Renderer-Knoten bleiben Kinder,
  `translate` fällt aus Position und `#tileBoxMatrix`. Der Gegenweg
  (Renderer-Knoten nicht als Kinder) hat keinen Ort: `Map2D` kennt keine
  Szene außer sich selbst, und nur der lokale Raum trägt Drehung und
  Skalierung mit. `translate` bleibt im Interface und wird weiter gefüllt,
  dokumentiert als informativ: Entfernen wäre ein Breaking Change, und nach
  »Entscheidungen« im Plan gilt dann der zweite Weg der Empfehlung.
  Verhaltensänderung, bewusst: wer `Map2DTileStreamer` ohne `Map2D` benutzt,
  seine Renderer-Knoten nicht unter den an `update()` übergebenen Knoten
  hängt und diesen verschiebt, bekam bisher bei reiner Translation eine
  zufällig richtige Position. Kein Aufrufer im Repo tut das; der Vertrag
  (`update(node)`: Renderer-Knoten sind Kinder von `node`) steht danach in
  der TSDoc.
- **BUG-072: der erste Weg der Empfehlung, eine Schicht tiefer.** Das Leeren
  sitzt im Accessor von `Map2DTileStreamer#visibilitor` statt im Map2D-Setter
  — dort liegt der Zustand, und der Streamer ist öffentlich und ohne `Map2D`
  benutzbar. Map2D delegiert wie bei seinen übrigen Eigenschaften; das
  beseitigt die zweite Wahrheit, die das Finding nennt. Der »robustere« Weg
  (Cache-Pfad an `previousTiles === #visibleTiles.tiles` binden) wird nicht
  umgesetzt: laut »Entscheidungen« gilt der erste Weg, und der
  `IMap2DVisibilitor`-Vertrag (`types.ts`: eine Instanz dient genau einem
  Streamer) deckt den direkten Aufruf mit fremder Liste bereits als
  Vertragsbruch ab.
- **Modell stärkste Stufe, Effort medium:** die Signaturen stehen hier fest,
  die Typen der öffentlichen Oberfläche bleiben; subtil sind die
  Geometrie-Tests (Frame, Vierteldrehung), und ein schwächeres Modell, das
  daran mehrere Runden dreht, kostet mehr.
- TEST-015 (Testlücken um den Visibilitor-Wechsel und den Datenprovider) wird
  durch die Specs dieses Pakets teilweise berührt; es liegt außerhalb des
  Scopes (kein BUG) und bleibt im Audit, wie es ist.

## Urteil des Reviewers

- BUG-070 behoben — `RepeatingTilesProvider.ts:138-152` (Überlapp einmal berechnet, Nullen links und rechts); Tests `RepeatingTilesProvider.spec.ts:196-239`, `:409-438`
- BUG-071 behoben — `Map2DTileStreamer.ts:139-142` (Position nur aus `offset`), `CameraBasedVisibility.ts:453-459` (`#tileBoxMatrix` ohne `translate`), `:601-613` (`matrixWorld` nur für `frustumBox`/`centerWorld`), `types.ts:123-127` (`translate` informativ); Tests `Map2DTileStreamer.spec.ts:229-245`, `Map2D.spec.ts` `update()`, `CameraBasedVisibility.spec.ts:596-654`, `map2d-placement.test.js:102-125`
- BUG-072 behoben — `Map2DTileStreamer.ts:20-41` (Accessor leert beim Ersetzen), `Map2D.ts:46-56` (delegiert), `Map2D.ts:29-34` (`tileStreamer`-Setter); Tests `Map2DTileStreamer.spec.ts:247-283`, `Map2D.spec.ts` `visibilitor`

Kleine Befunde:
- `Map2D.ts:29-34` — bringt ein neuer Streamer Visibilitor B mit und hielt der alte A, überschreibt A still B, und beide Streamer halten dieselbe A-Instanz (formal gegen »eine Instanz dient genau einem Streamer«); Verhalten wie vor dem Paket, im Kommentar benannt
- `Map2DTileStreamer.ts:131` — `computeVisibleTiles(...)`-Aufruf vom Formatter auf eine sehr lange Zeile gezogen

Begründung der Urteile an den Nebenbefunden: `document`-Zugriff in `CameraBasedVisibilityHelpers` und fehlender `default` in `getTileIdsWithin()` sind Korrektheitsdefekte (Throw bzw. widersprüchliche Ergebnisse) → Scope; der `lookAtCenter`-Default ist reine Doku → Audit; ob `computeVisibleTiles()` die Kamera des Aufrufers nachführen darf, ist eine Vertragsfrage ohne Festlegung → Rückfrage.

## Findings im Volltext

**BUG-070 · high · packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:133-150** — Den vertical-Zweig von RepeatingTilesProvider.getTileIdsWithin() für 0 < left < cols reparieren
Der Zweig modelliert nur `left <= 0`. Für ein positives `left` innerhalb des Musters (Muster `[1,2,3,4]`, `'vertical'`, `getTileIdsWithin(1, 0, 3, 1)`) wird `leftOffset = -1`, der `slice` beginnt bei Musterspalte 0 statt 1, und `target.set(tiles, -1)` wirft in der ersten Zeile einen `RangeError`; ab `y >= 1` überschreibt der negative Offset stumm die letzte Zelle der Vorzeile. `getTileIdAt()` behandelt dieselben Koordinaten korrekt (Zeile 72-76), die beiden Methoden desselben Providers widersprechen sich. Der Fix des Remediation-Laufs (`72d2893`) hat nur den horizontal-Zweig über `#writePatternRow` geführt; die Spec deckt `left ∈ {-3,-2,-1,0}` und 3 (außerhalb) ab — genau deshalb blieb es unbemerkt.
Empfehlung: Den vertical-Zweig symmetrisch zum horizontal-Zweig umschreiben: den Überlapp `[max(left,0), min(right, cols-1)]` einmal berechnen, links und rechts davon Nullen füllen und `row.slice(overlapStart, overlapEnd+1)` bei `rowOffset + (overlapStart - left)` kopieren. Spec-Fälle für `left = 1, 2` und eine Breite über `cols` hinaus mit `left > 0`.

**BUG-071 · medium · packages/twopoint5d/src/map2d/Map2D.ts:107-112; Map2DTileStreamer.ts:115-122; RectangularVisibilityArea.ts:155; CameraBasedVisibility.ts:448-454, 595-597** — Die Welt-Translation der Map2D nicht zweimal auf Renderer-Knoten und Frustum-Boxen anwenden
`translate` ist die Weltposition aus `matrixWorld` der Map2D-Gruppe und wird in die *lokale* Position eines Kindes genau dieser Gruppe geschrieben (`this.add(renderer.node)`), sodass die Elterntransformation sie ein zweites Mal addiert: Für eine Map bei `(t, 0, 0)` landen die Kacheln bei Welt-x `2t + view.left`. Die Culling-Boxen tragen dieselbe Verdopplung (`tileBoxMatrix` enthält bereits `translate`, dann kommt `matrixWorld` obendrauf), Culling und Rendering stimmen also miteinander überein, sind aber beide um `t` gegen die Stelle verschoben, an der die Probe-Strahlen die Ebene trafen. Jeder Aufrufer im Repo hält die Map2D am Ursprung — deshalb fällt es nicht auf; der erste Nutzer, der die Map bewegt oder parentet, bekommt eine Map, die der Kamera davonläuft.
Empfehlung: Ein Bezugssystem festlegen und die andere Anwendung streichen. Am saubersten: Renderer-Knoten bleiben Kinder, `translate` entfällt — der Streamer setzt `position = (offset.x, 0, offset.y)`, `CameraBasedVisibility` baut `tileBoxMatrix` nur aus `xOffset`/`yOffset`/`centerPoint` (`matrixWorld` bringt die Box ohnehin in den Weltraum). `translate` aus `IMap2DVisibleTiles` entfernen oder als informell dokumentieren. Unit-Test mit translatierter (und einer rotierten) `matrixWorld`.

**BUG-072 · medium · packages/twopoint5d/src/map2d/Map2D.ts:48-52; CameraBasedVisibility.ts:314-322; RectangularVisibilityArea.ts:92-98; Map2DTileStreamer.ts:20** — Beim Wechsel von Map2D.visibilitor die Tiles des Streamers leeren, oder den Cache-Pfad previousTiles beachten lassen
Beide Visibilitoren antworten aus dem Cache, ohne `previousTiles` anzusehen; der Streamer verlässt sich darauf (Kommentar Map2DTileStreamer.ts:95-96), und das trägt, solange `previousTiles` die eigene letzte Liste des Visibilitors ist. `Map2D.set visibilitor` bricht die Invariante: Nach A → B → A bei unbewegter Kamera liefert A sein gecachtes Set (`reuse = A.tiles`, `removeTiles = undefined`), während der Streamer B's Tiles hält. Tiles, die B hinzufügte und A nie listete, werden nie entfernt — sie bleiben im Renderer (gezeichnet, Slot gehalten), bis jemand `clearTiles()` ruft. Der `tileStreamer`-Setter (Zeile 38-41) leert für die analoge Gefahr ausdrücklich; der Visibilitor-Setter nicht. `Map2DTileStreamer.visibilitor` ist zudem ein nacktes öffentliches Feld, Map2Ds `#visibilitor` und das Streamer-Feld sind zwei Wahrheiten.
Empfehlung: In `Map2D.set visibilitor` nach der Zuweisung `this.#tileStreamer.clearTiles()` rufen (Spiegel des tileStreamer-Setters). Robuster: in beiden Visibilitoren den Cache-Pfad nur nehmen, wenn `previousTiles === this.#visibleTiles?.tiles || previousTiles.length === 0`. `Map2DTileStreamer.visibilitor` zu einem Accessor machen, der bei Wechsel leert. Spec A→B→A.
