# Paket 3 — Map2D, Sprites, Vertex Objects: Atomarer Streamer-Setter und Feinschliff

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-128 (low), DOC-077 (low), DOC-075 (info), PERF-033 (info), PERF-034 (info), READ-024 (info), READ-026 (info), READ-027 (info)
- Ziel: `Map2D#tileStreamer` wechselt atomar, JSDoc und Kommentare stimmen mit dem Verhalten überein, und die Kleinst-Befunde in Sprites und Vertex Objects sind erledigt.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/Map2D.ts`, `packages/twopoint5d/src/map2d/Map2D.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`, `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/sprites/textureShapeKey.ts`, `packages/twopoint5d/src/sprites/textureShapeKey.spec.ts`
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`
  - `packages/twopoint5d/src/sprites/hot-path-allocations.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`
  - `packages/twopoint5d/CHANGELOG.md` (nur `## [Unreleased]`)
- Verify: `pnpm run ci` (Zwischenläufe gezielt, z. B. `pnpm nx test twopoint5d -- src/map2d/Map2D.spec.ts`)
- Commit: `fix: keep a map and every tile renderer on the streamer it has when a clearTiles() throws while Map2D#tileStreamer switches, let the CameraBasedVisibility search compare squared distances against a stop distance it works out only when the furthest kept tile changes, key the sample count of a render target only for a depth texture, and let the docs and comments of map2d, sprites and vertex objects say what the code does`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · alle acht Findings unverändert an ihrer Fundstelle (`Map2D.ts:24–58` und `:170`, `CameraBasedVisibility.ts:1180–1219`, `textureShapeKey.ts:76`, `VertexObjectDescriptor.ts:13–18`, `AnimatedSpritesMaterial.spec.ts:106/110`, `hot-path-allocations.spec.ts:44–45`); Paket 1 hat in `src/sprites/` nur Typen berührt (`hot-path-allocations.spec.ts:25`), Paket 2 nichts in `src/map2d/`, `src/sprites/`, `src/vertex-objects/` · Folgen aus Paket 1 und 2: keine · Offene Befunde: keiner teilt eine Ursache mit Paket 3, alle bleiben in der Queue · neu in der Queue: `texture/TextureAtlasLoader.spec.ts:164` (info, → Scope) · Restplan: Paket 3 ist das letzte, keine Umstellung
  - 2026-09-29 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-3.impl-0.json`
  - 2026-09-29 Zug 2: Report FERTIG · 10 Dateien geändert (`Map2D.ts`/`.spec.ts`, `CameraBasedVisibility.ts`/`.spec.ts`, `textureShapeKey.ts`/`.spec.ts`, `AnimatedSpritesMaterial.spec.ts`, `hot-path-allocations.spec.ts`, `VertexObjectDescriptor.ts`, `CHANGELOG.md`) · rote Läufe für 1a und 5a belegt · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`)
  - 2026-09-29 Zug 3: Reviewer beauftragt (opus, effort medium) auf `paket-3.diff`, Report nach `paket-3.review-0.json`
  - 2026-09-29 Zug 3: Urteil alle acht Findings behoben, keine Befunde · Diff `paket-3.diff`
  - 2026-09-29 Zug 4: keine Runde nötig
  - 2026-09-29 Zug 5: Commit `fc40b690` (10 Dateien), Verify `pnpm run ci` exit=0 aus Zug 2 (keine Änderung seither)

## Vorgehen

Allgemein für jede Zeile: Konventionen aus dem Kopf von `./remediation-plan.md`
(keine Finding-IDs, kein Rückblick auf den Vorzustand — auch nicht im
CHANGELOG —, Code/Kommentare/Doku auf Englisch). Kommentare im Stil der Datei:
ganze Sätze in Kleinschreibung am Zeilenanfang, sie sagen *warum*. Jedes `!`
auf einem Indexzugriff bekommt, wie im Rest von `CameraBasedVisibility.ts`,
eine Zeile Begründung davor (`noUncheckedIndexedAccess` ist an).
CHANGELOG-Einträge nach dem Skill `updating-changelog`; es wird nur
`## [Unreleased]` angefasst.

### 1. `Map2D#tileStreamer` atomar (BUG-128) — Bugfix, Regressionstest zuerst

Ursache: `Map2D.ts:29–31` nimmt die Renderer einzeln vom bisherigen Streamer
ab. `Map2DTileStreamer#removeTileRenderer()` ruft `renderer.clearTiles()`;
wirft das, bricht der Setter ab, `#tileStreamer` bleibt der bisherige, aber die
davor abgenommenen Renderer hängen an keinem Streamer mehr. Alles hinter der
Schleife (`centerX/Y`, `visibilitor`, `addTileRenderer`, `clearTiles()`) wirft
nicht — es sind Feldzuweisungen, `Set#add` und ein Flag —, der Wurf kann also
nur in der Schleife entstehen.

Gewählter Weg (die zweite Variante der Audit-Empfehlung): bei einem Wurf die
schon abgenommenen Renderer wieder an den bisherigen Streamer hängen und den
Fehler unverändert weiterwerfen. Die erste Variante — erst am neuen Streamer
anmelden, dann abnehmen — ließe den werfenden Renderer an beiden Streamern
hängen und verfehlt die Prüfbedingung »jeder Renderer an genau einem
Streamer«. Der Rückweg passt zum Muster, das `Map2D#removeTileRenderer()` und
`Map2DTileStreamer#removeTileRenderer()` schon dokumentieren: ein Wurf lässt
den alten Zustand stehen, ein zweiter Aufruf setzt fort.

Warum der Rückweg die Renderer wieder korrekt bestückt: die zurückgehängten
Renderer sind durch `clearTiles()` leer und haben am bisherigen Streamer kein
`#laidOutSerials`-Eintrag mehr (`Map2DTileStreamer.ts:142`); das nächste
`update()` schickt sie deshalb durch den Zyklus, auch wenn der Visibilitor sein
gecachtes Ergebnis zurückgibt — dessen `reuseTiles` ist dann die ganze Liste
(`RectangularVisibilityArea.ts:159`), und `Map2DTileRenderer#reuseTile()` legt
ein unbekanntes Tile per `addTile()` an. Dass der Renderer danach am Ende der
`Set`-Reihenfolge von `previous.renderers` steht, ist ohne Belang: die
Reihenfolge bestimmt nur, wer im `update()` zuerst drankommt.

1a. Regressionstest in `Map2D.spec.ts`, `describe('tileStreamer')`, **vor dem
Fix schreiben und rot sehen** (rot, weil `first` nach dem Wurf an keinem
Streamer hängt). Name:
`leaves the map and every renderer on the streamer it has when a clearTiles() throws, and moves them with the next assignment`

```ts
const map = new Map2D();
map.tileWidth = 100;
map.tileHeight = 100;
const first = makeHoldingTileRenderer();
const throwing = makeHoldingTileRenderer();
const last = makeHoldingTileRenderer();
const clearTiles = throwing.clearTiles;
let threw = false;
throwing.clearTiles = function () {
  if (!threw) {
    threw = true;
    throw new Error('the tile set is gone');
  }
  clearTiles.call(this);
};
map.addTileRenderer(first);
map.addTileRenderer(throwing);
map.addTileRenderer(last);
const visibilitor = new RectangularVisibilityArea(100, 100);
map.visibilitor = visibilitor;
map.update();
const tilesOfTheView = [...last.held].sort();
expect(tilesOfTheView.length, 'tiles before the switch').toBeGreaterThan(0);

const leaving = map.tileStreamer;
const taking = new Map2DTileStreamer(100, 100);

expect(() => (map.tileStreamer = taking)).toThrow('the tile set is gone');
expect(map.tileStreamer, 'the streamer of the map after the throw').toBe(leaving);
expect(map.visibilitor, 'the visibilitor of the map after the throw').toBe(visibilitor);
expect(taking.visibilitor, 'the streamer that was to take over').toBeUndefined();
for (const [name, renderer] of [['first', first], ['throwing', throwing], ['last', last]] as const) {
  expect(leaving.renderers.has(renderer), `${name} on the streamer the map has`).toBe(true);
  expect(taking.renderers.has(renderer), `${name} on the streamer that was to take over`).toBe(false);
}

map.update();
for (const renderer of [first, throwing, last]) {
  expect([...renderer.held].sort(), 'tiles after the next update').toEqual(tilesOfTheView);
}

map.tileStreamer = taking;
expect(map.tileStreamer).toBe(taking);
expect(leaving.renderers.size, 'renderers left on the streamer that left').toBe(0);
for (const renderer of [first, throwing, last]) expect(taking.renderers.has(renderer)).toBe(true);

map.update();
for (const renderer of [first, throwing, last]) {
  expect([...renderer.held].sort(), 'tiles after the move').toEqual(tilesOfTheView);
}
```

Die Beschriftungen der `expect`s dürfen im Wortlaut abweichen; die Prüfungen
nicht. Der rote Lauf gehört in den Report.

1b. Fix in `Map2D.ts`, Setter `tileStreamer`, nur die Schleife Zeile 29–31
wird ersetzt; alles danach bleibt Zeile für Zeile, wie es ist:

```ts
const previous = this.#tileStreamer;

// every renderer comes off the streamer that leaves before anything else moves. When the
// clearTiles() of one throws, the renderers taken off before it go back onto that streamer and
// the error goes on: the map stays where it was, every renderer on exactly one streamer, and the
// next assignment takes the move up. The renderer that threw is still on the streamer, as
// Map2DTileStreamer#removeTileRenderer() leaves it
const takenOff: IMap2DTileRenderer[] = [];
try {
  for (const renderer of this.#renderers) {
    // `renderers` of a streamer is a public set: a renderer taken out of it directly is not
    // put back onto it
    if (!previous.renderers.has(renderer)) continue;
    previous.removeTileRenderer(renderer);
    takenOff.push(renderer);
  }
} catch (error) {
  for (const renderer of takenOff) previous.addTileRenderer(renderer);
  throw error;
}
```

Der Kommentar darf umformuliert werden, sein Inhalt bleibt: warum die Schleife
zuerst läuft, was bei einem Wurf passiert, warum nur die selbst abgenommenen
zurückgehen. Der bestehende Kommentar über der Zeile `streamer.clearTiles()`
(»the renderers came off the streamer that left empty …«) bleibt.

1c. JSDoc des Getters `tileStreamer` (`Map2D.ts:9–19`): hinter dem
bestehenden Absatz einen zweiten, sinngemäß:
»When the `clearTiles()` of a renderer throws as it comes off the streamer that
leaves, the map stays on that streamer with every renderer on it — those taken
off before the throw go back onto it empty, and the next {@link update} lays
out the whole tile set in them again — and the error goes on unchanged.
Assigning the streamer again takes the move up.«

1d. `CHANGELOG.md`, `## [Unreleased]` → `### Fixed`: ein neuer Eintrag direkt
hinter dem Eintrag »fix `Map2DTileStreamer#removeTileRenderer()`, and with it
`Map2D#removeTileRenderer()` …« (derzeit Zeile 456), sinngemäß:
»fix `Map2D#tileStreamer` when the `clearTiles()` of a tile renderer throws as
it comes off the streamer that leaves: the map stays on that streamer with
every one of its renderers — those taken off before the throw go back onto it
empty, and the next `update()` lays out the whole tile set in them again — and
the error goes on unchanged, so that every renderer stays on exactly one
streamer. Assigning the streamer again takes the move up«. Kein »Before, …«.

### 2. `Map2D#dispose()` — die Zusage zum zweiten Aufruf (DOC-077)

Verhalten bleibt, wie es ist (vom Vorlauf so entschieden: ein werfendes
`clearTiles()` lässt den Renderer an Karte und Streamer, ein zweiter Aufruf
setzt fort). `dispose()` bricht beim ersten werfenden Renderer ab; dieser und
alle, die die Schleife noch nicht erreicht hat, bleiben an der Karte. Nur die
Doku wird ehrlich — kein Sammeln der Fehler, kein Weiterlaufen hinter dem Wurf.

2a. JSDoc `Map2D.ts:163–171`: den Satz »A second call does nothing.« ersetzen,
sinngemäß: »When the `clearTiles()` of a renderer throws, the error goes on,
and that renderer and those not reached yet stay on the map; a second call
takes off what is left. Otherwise a second call does nothing.«

2b. `CHANGELOG.md`, `## [Unreleased]` → `### Changed`, der Eintrag
»`Map2D#dispose()` releases nothing …« (derzeit Zeile 150): das Satzende »and
a second call does nothing« auf dieselbe Aussage einschränken wie 2a.

2c. Test in `Map2D.spec.ts`, `describe('dispose()')`, hinter `is safe to call
twice`, Name:
`a second call after a clearTiles() that threw takes off the renderers that are left`
— Karte in einer `Group`, zwei Renderer (`makeHoldingTileRenderer()`), der
zuerst hinzugefügte wirft beim ersten `clearTiles()` (Muster wie in 1a).
Erwartet: der erste `dispose()` wirft `'the tile set is gone'`, `map.parent`
ist `null`, beide `renderer.node.parent` sind `map`, beide stehen in
`map.tileStreamer.renderers`; der zweite `dispose()` wirft nicht, danach sind
beide `node.parent` `null` und `map.tileStreamer.renderers.size` ist 0. Der
Test ist schon vor der Änderung grün (Doku-Fix, kein Bugfix) — er hält die neue
Zusage fest; ein roter Lauf wird hier nicht verlangt.

### 3. `searchCanStop()`: Stoppdistanz im Quadrat, einmal je Wechsel des fernsten Tiles (PERF-033)

Heute rechnet `searchCanStop(next, furthest)` (`CameraBasedVisibility.ts:1205–1219`)
bei jedem Pop am Limit Höhe, Footprint-Diagonale und drei `sqrt`. Höhe der
Kamera über der Ebene und Footprint-Diagonale sind für eine ganze
Neuberechnung dieselben (Kamera, `planeWorld` und Größe der Frustum-Boxen
ändern sich während der Suche nicht); die Stoppdistanz hängt nur an
`kept[0].distanceToCamera`, und `kept[0]` wechselt genau an zwei Stellen: in
`heapifyKept()` (Zeile 861) und in `siftDownKept(0, tile)` in der Suchschleife
(Zeile 865). Statt einen Cache über Wertvergleich zu führen, werden die Werte
an genau diesen beiden Ereignissen geschrieben — dann kann auch kein Wert einer
früheren Neuberechnung stehen bleiben, denn jede Neuberechnung, die das Limit
erreicht, läuft durch `heapifyKept()`.

Die Regel der Datei zu Doubles (Kommentar über `createTileSlot`, Zeile 72–77)
gilt: kein Double kreuzt einen Aufruf. Die neuen Methoden nehmen nichts und
geben nichts zurück bzw. nehmen ein Tile und geben ein `boolean`; die Werte
liegen in einem `Float64Array`.

3a. Modulkonstanten direkt unter `SEEN_MAX_VISIBLE_TILES` (Zeile 178):

```ts
// where `CameraBasedVisibility` keeps what the search compares against at the limit, see
// `searchCanStop()`
const SEARCH_STOP_HEIGHT_SQ = 0;
const SEARCH_STOP_FOOTPRINT_DIAGONAL = 1;
const SEARCH_STOP_DISTANCE_SQ = 2;
```

3b. Feld direkt unter `readonly #kept: PooledTileBox[] = [];` (Zeile 442):

```ts
// What `searchCanStop()` compares against, at the `SEARCH_STOP_…` indices: the height of the
// camera above the plane squared and the diagonal of the footprint of a frustum box — the same
// for every tile of one recomputation, written once the search holds `maxVisibleTiles` tiles —
// and the stop distance squared, written again each time another tile becomes the furthest kept
// one. A typed array for the reason `#seenScalars` is one.
readonly #searchStop = new Float64Array(3);
```

3c. Suchschleife (Zeile 851–869) — nur diese drei Stellen ändern sich:

```ts
while (this.#frontier.length > 0) {
  if (kept.length >= limit && this.searchCanStop(this.#frontier[0]!)) break;
  // … unverändert bis …
  if (kept.length < limit) {
    kept.push(tile);
    if (kept.length === limit) {
      this.heapifyKept();
      this.beginSearchStop();
    }
  } else {
    // a visible tile goes: this one, or the furthest kept one it takes the place of
    capped = true;
    if (tile.distanceToCamera < kept[0]!.distanceToCamera) {
      this.siftDownKept(0, tile);
      this.updateSearchStop();
    }
  }
  // … unverändert
}
```

3d. Zwei neue private Methoden direkt vor `searchCanStop()`:

```ts
/**
 * Writes what stays the same for the rest of the recomputation once the search holds
 * `maxVisibleTiles` tiles — the height of the camera above the plane and the diagonal of the
 * footprint of a frustum box — and then the stop distance for the furthest kept tile. Expects the
 * kept tiles to be a heap.
 */
private beginSearchStop(): void {
  const stop = this.#searchStop;
  // `planeWorld.distanceToPoint()` written out — see the note on doubles at the top of the module
  const {normal, constant} = this.planeWorld;
  const camera = this.#cameraWorldPosition;
  const height = normal.x * camera.x + normal.y * camera.y + normal.z * camera.z + constant;
  stop[SEARCH_STOP_HEIGHT_SQ] = height * height;
  // the frustum boxes of all tiles have the same size. The search calls this once it holds
  // maxVisibleTiles tiles, at least one
  const {min, max} = this.#kept[0]!.frustumBox;
  const dx = max.x - min.x;
  const dz = max.z - min.z;
  stop[SEARCH_STOP_FOOTPRINT_DIAGONAL] = Math.sqrt(dx * dx + dz * dz);
  this.updateSearchStop();
}

/** Writes the stop distance squared for the furthest kept tile, the top of the heap. */
private updateSearchStop(): void {
  const stop = this.#searchStop;
  // fixed indices of an array of three, and a heap of at least one tile
  const heightSq = stop[SEARCH_STOP_HEIGHT_SQ]!;
  const furthestKept = this.#kept[0]!.distanceToCamera;
  const rho = Math.sqrt(Math.max(furthestKept * furthestKept - heightSq, 0)) + stop[SEARCH_STOP_FOOTPRINT_DIAGONAL]!;
  stop[SEARCH_STOP_DISTANCE_SQ] = heightSq + rho * rho;
}
```

3e. `searchCanStop()` bekommt die Signatur `private searchCanStop(next: PooledTileBox): boolean`
und vergleicht ohne Wurzel:

```ts
private searchCanStop(next: PooledTileBox): boolean {
  const distance = next.distanceToCamera;
  // both sides squared: both are at least 0, so the order stays, and no square root is taken.
  // A fixed index of an array of three
  return distance * distance > this.#searchStop[SEARCH_STOP_DISTANCE_SQ]!;
}
```

Der Beweis in seiner JSDoc (Zeile 1179–1203) bleibt inhaltlich stehen; ändern
sich: die Einleitung (statt »`furthest` is the furthest of them« heißt es »the
furthest kept tile, the top of the heap«, und die Distanz wird in
`beginSearchStop()`/`updateSearchStop()` ausgerechnet), der Schlusssatz (statt
»Tiles in and a boolean out: the distances stay in here« sinngemäß »A tile in
and a boolean out: the distance it is held against lies in `#searchStop`, see
the note on doubles at the top of the module«) und der Zusatz aus Schritt 4.

Keine Rundungssorge: `a > √b` und `a² > b` sind für `a, b ≥ 0` gleichwertig;
eine Abweichung um ein ulp an der Grenze betrifft ein Tile genau auf der
Stoppdistanz, die ohnehin eine obere Schranke mit einer Footprint-Diagonale
Rand ist.

3f. Test in `CameraBasedVisibility.spec.ts`, `describe('maxVisibleTiles')`,
hinter `keeps the nearest tiles under a small limit, also where the nearest
tile is none of the seeds`. Name:
`keeps the nearest tiles of each view when one visibility follows a camera that moves and climbs`
Vorbereitung: die Typen `Vec3` und `Scene` sowie die Helfer `horizon` und
`makeCamera` aus dem Nachbartest eine Ebene höher in den Block
`describe('maxVisibleTiles')` ziehen, unverändert im Wortlaut; die Liste
`scenes` bleibt im Nachbartest. Der neue Test:
- eine einzige `CameraBasedVisibility`, `maxVisibleTiles = 12`;
- drei Szenen nacheinander, in dieser Reihenfolge:
  `horizon([0, 40, 0], [0, 0, -300])`,
  `{fov: 46, far: 800, position: [-5, 108, -1], target: [-388, 0, 123], center: [-12, -3]}`,
  `horizon([-11, 52, 3], [-200, 0, -230])` — tief, hoch, wieder tief, jedes Mal
  in eine andere Richtung;
- je Szene (leere `previousTiles`, weil `expectTheNearest()` prüft, dass
  `createTiles` `limit` Tiles hält):

  ```ts
  visibility.camera = makeCamera(scene);
  const result = visibility.computeVisibleTiles([], scene.center, horizonTileCoords(), new Matrix4())!;
  const reference = unlimitedVisibles(makeCamera(scene), horizonTileCoords(), scene.center);
  expectTheNearest(visibility, result, reference, 12, `camera at ${scene.position} to ${scene.target}`);
  ```

- `console.warn` stummschalten wie im Nachbartest.

Der Test hält fest, dass keine Stoppdistanz einer früheren Neuberechnung
stehen bleibt; er ist vor und nach der Änderung grün (Performance-Änderung,
kein Bugfix) — kein roter Lauf verlangt.

Wächter der Änderung, die grün bleiben müssen: die vier Tests in
`describe('maxVisibleTiles')` (insbesondere die rund 135 Fälle des
Small-Limit-Tests) und `a recomputation the limit cuts allocates nothing per
tile` in `hot-path-allocations.tilted-view.spec.ts`.

### 4. Beweis in `searchCanStop()` einschränken (DOC-075)

In die JSDoc von `searchCanStop()` hinter den Satz, der mit »So `ρ` of every
tile on the way is at most …« endet, sinngemäß:
»The argument holds for every tile whose frustum box meets the frustum.
`Frustum#intersectsBox()` tests a box against the six planes one by one and
also takes a box that passes by an edge or a corner of the frustum without
meeting it; such a tile, taken as visible and nearer than the furthest kept
one, can in rare cases be left out for a tile further away.«

Die öffentliche JSDoc von `maxVisibleTiles` (Zeile 255–269) und die Klassendoku
(Zeile 210–214) bleiben unverändert: ein Tile, das der Test nur konservativ
annimmt, hat eine Frustum-Box außerhalb des Frustums, und das Tile darin ist
kleiner als seine Box — es liegt außerhalb des Bildes, ob es gehalten wird,
sieht niemand. Die Zusage »the ones nearest to the camera« stimmt für alles,
was auf dem Schirm landet.

### 5. Samples-Bit nur für Tiefentexturen (PERF-034)

Belegt an three 0.185.1: `WebGPUUtils#getTextureSampleData()`
(`node_modules/.pnpm/three@0.185.1/node_modules/three/src/renderers/webgpu/utils/WebGPUUtils.js:104–131`)
setzt `isMSAA` für jede Textur eines Render-Targets mit mehr als einer Probe,
außer Tiefen- und Framebuffer-Texturen, und gibt dafür `primarySamples = 1`;
`WGSLNodeBuilder.js:2091–2095` und `WebGPUBindingUtils.js:501–505` binden nur
bei `primarySamples > 1` multisampled. Die Farbtextur eines MSAA-Targets wird
also als die einfach gesampelte Textur gebunden, in die aufgelöst wird; nur die
Tiefentextur eines solchen Targets bindet multisampled.

Grenze bleibt `samples > 1`, nicht `>= 4` (was `getSampleCount()` in
WebGPU tatsächlich macht): ein zu weites Bit kostet höchstens einen
Graph-Neubau, ein zu enges zeichnet falsch, und das WebGL2-Fallback zählt
Proben anders.

5a. Tests in `textureShapeKey.spec.ts`, **vor dem Fix schreiben**:
- den Test `answers another key for the texture of a multisampled render
  target` (Zeile 76–84) ersetzen durch `answers another key for the depth
  texture of a multisampled render target`: `new RenderTarget(4, 4, {samples:
  4, depthTexture: new DepthTexture(4, 4)})` gegen `new RenderTarget(4, 4,
  {depthTexture: new DepthTexture(4, 4)})`, verglichen werden die beiden
  `.depthTexture`; beide Targets am Ende `dispose()`n. (Der `depthTexture`-Setter
  von `RenderTarget` setzt `renderTarget` der Tiefentextur,
  `core/RenderTarget.js:265–272`.)
- neu `answers the same key for the color textures of a multisampled and a
  single-sampled render target`: `new RenderTarget(4, 4, {samples: 4})` gegen
  `new RenderTarget(4, 4)`, verglichen werden die beiden `.texture` mit
  `toBe`. **Vor dem Fix rot**; der rote Lauf gehört in den Report.

5b. Fix `textureShapeKey.ts:76`:

```ts
flags += bit(texture.isDepthTexture === true && (texture.renderTarget?.samples ?? 0) > 1);
```

Falls `isDepthTexture` am Typ `Texture` nicht existiert, dieselbe Lesart wie
in der Schleife darüber (`(texture as {isDepthTexture?: unknown}).isDepthTexture === true`).

5c. JSDoc derselben Datei, Zeile 53–54: den Punkt sinngemäß fassen als
»whether the render target of a depth texture takes more than one sample, which
makes its binding multisampled; the color texture of such a target binds as
the single-sampled texture it resolves into«.

5d. `CHANGELOG.md`, `## [Unreleased]` → `### Changed`, Eintrag »perf a
`colorMap` of the same kind as the one set takes its place …« (derzeit Zeile
268): »and in `compareFunction` and the samples of its render target« wird zu
»in `compareFunction`, and, for a depth texture, in the samples of its render
target«. Kein eigener Eintrag — `textureShapeKey()` ist `@internal`, der
Eintrag beschreibt die Wirkung nach außen.

### 6. Kommentarblock über den Vertex-Formaten neu umbrechen (READ-024)

`VertexObjectDescriptor.ts:13–18`: den Kommentarblock mit unverändertem
Wortlaut so neu umbrechen, dass keine Zeile länger als 100 Zeichen ist und die
Zeilen gleichmäßig lang laufen (wie die Blöcke darunter, Zeile 24–27). Der
Verweis `three 0.185.1` und alle Zeilenangaben bleiben stehen.

### 7. »an AnimatedSpritesMaterial« (READ-026)

`AnimatedSpritesMaterial.spec.ts:106` und `:110`: »a AnimatedSpritesMaterial«
→ »an AnimatedSpritesMaterial«. Sonst nichts; eine Suche über `src/sprites/`,
`src/map2d/`, `src/vertex-objects/` hat keine weitere Stelle dieser Art
gefunden.

### 8. Spy-Tests beim Namen nennen (READ-027)

`src/sprites/hot-path-allocations.spec.ts:44–45`: der Satz »That the setters
hand the values of their caller on in one array is checked by the two tests
after the allocation tests of the setters« nennt stattdessen die beiden Tests
beim Namen: `a textured sprite hands the values of setSize(), setPosition() and
setColor() on in one array` und `an animated sprite hands the values of
setSize() and setPosition() on in one array` (beide Namen stehen so in Zeile
141 und 166). Den Kommentar dabei auf die Breite des übrigen Blocks umbrechen.

## Abgleich

| Finding | Urteil | Fundstelle jetzt |
| --- | --- | --- |
| BUG-128 | unverändert | `Map2D.ts:29–31` — Schleife `previous.removeTileRenderer(renderer)` ohne Rückweg |
| DOC-077 | unverändert | `Map2D.ts:170` — »A second call does nothing.«; dieselbe Zusage in `CHANGELOG.md:150` |
| DOC-075 | unverändert | `CameraBasedVisibility.ts:1179–1203` — Beweis nimmt einen Punkt der Frustum-Box im Frustum an |
| PERF-033 | unverändert | `CameraBasedVisibility.ts:1205–1219` — Höhe, Diagonale, drei `sqrt` je Aufruf |
| PERF-034 | unverändert | `textureShapeKey.ts:76` — `bit((texture.renderTarget?.samples ?? 0) > 1)` für jede Textur; Test `textureShapeKey.spec.ts:76–84` hält das weite Verhalten fest, CHANGELOG `:268` beschreibt es |
| READ-024 | unverändert | `VertexObjectDescriptor.ts:13` — 104 Zeichen, danach 87/99/100/85/48 |
| READ-026 | unverändert | `AnimatedSpritesMaterial.spec.ts:106`, `:110` |
| READ-027 | unverändert | `hot-path-allocations.spec.ts:44–45` (im Audit `:45`) — Paket 1 hat die Datei nur in Zeile 25 berührt |

## Triage

- Folgen aus Paket 1 und Paket 2: keine (`Folgen: —` bei beiden).
- Offene Befunde: die fünf Einträge liegen in `src/texture/` (3) und
  `src/display/` (2); keiner teilt eine Ursache mit einem Finding dieses
  Pakets. Sie bleiben für die Drain-Runde des Abschlusses in der Queue.
- Neu beim Abgleich aufgefallen, vorbestehend (`git blame`: `ff393ae74`,
  2026-09-20, vor dem ersten Commit dieses Laufs):
  `packages/twopoint5d/src/texture/TextureAtlasLoader.spec.ts:164` — der
  Kommentar »the same microtask boundary as the test above« verweist per
  Position auf einen Nachbartest. Dieselbe Art wie READ-027, aber eine andere
  Stelle in einem anderen Feature, keine gemeinsame Ursache → nicht in dieses
  Paket, sondern in »Offene Befunde« (info, `src/texture/` liegt in der
  Scope-Regel → Scope).

## Findings im Volltext

**BUG-128 · low · packages/twopoint5d/src/map2d/Map2D.ts:29** (auch `:31`) — Setter Map2D#tileStreamer nicht atomar, wenn ein clearTiles() beim Abnehmen der Renderer wirft
Aufgefallen in Remediation-Lauf vom 2026-09-28. Der Setter `tileStreamer` nimmt die Renderer der Karte in einer Schleife einzeln vom bisherigen Streamer ab (`previous.removeTileRenderer(renderer)`, Zeile 29–31). `Map2DTileStreamer#removeTileRenderer()` ruft dabei `clearTiles()` des Renderers; wirft das (ein `destroyTile()` der Factory), bricht der Setter ab: `#tileStreamer` bleibt der bisherige, die davor abgenommenen Renderer hängen aber an keinem Streamer mehr, stehen weiter in `#renderers` der Karte und bekommen keine Tiles, bis der Setter erneut gerufen wird. Vorbestehend, so schon in `e7767c6d` Zeile 29–31.
Empfehlung: Den Wechsel so ordnen, dass ein Wurf einen konsistenten Zustand hinterlässt — etwa alle Renderer erst am neuen Streamer anmelden bzw. bei einem Wurf die schon abgenommenen Renderer wieder an den bisherigen hängen, bevor der Fehler weitergeht — und einen Test mit werfender Factory ergänzen, der danach jeden Renderer an genau einem Streamer findet.

**DOC-077 · low · packages/twopoint5d/src/map2d/Map2D.ts:170** — JSDoc von Map2D#dispose() sagt »A second call does nothing«, obwohl ein zweiter Aufruf nach werfendem clearTiles() fortsetzt
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Wirft das `clearTiles()` eines Renderers während `dispose()`, bleibt dieser Renderer an Streamer und Karte, und ein zweiter `dispose()` setzt dort fort — die Zusage »A second call does nothing« gilt dann nicht. Galt auch vor dem Lauf schon nicht (damals blieb der Renderer in `#renderers`).
Empfehlung: Den Satz einschränken, etwa: »A second call does nothing, unless a `clearTiles()` threw in the first — then it takes off what is left.«

**DOC-075 · info · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:1187** — Beweis im JSDoc von searchCanStop() setzt einen Punkt im Frustum voraus, Frustum#intersectsBox() ist aber konservativ
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Der Beweis der Haltedistanz nimmt für jedes sichtbare Tile einen Punkt seiner Frustum-Box im Frustum an. `Frustum#intersectsBox()` prüft nur gegen die sechs Ebenen und nimmt Boxen auch an, die das Frustum knapp verfehlen; ein nur konservativ angenommenes Tile kann in seltenen Fällen einem ferneren weichen (in ~4 700 Probefällen nicht beobachtet).
Empfehlung: Einen einschränkenden Satz ergänzen: der Beweis gilt streng für Tiles, deren Box das Frustum wirklich schneidet.

**PERF-033 · info · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:1205** — searchCanStop() rechnet Höhe, Footprint-Diagonale und drei sqrt bei jedem Frontier-Pop am Limit neu
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Sobald `maxVisibleTiles` Tiles gehalten werden, ruft die Suche `searchCanStop()` bei jedem Pop; Höhe der Kamera, Diagonale des Footprints und die Stoppdistanz ändern sich aber nur, wenn `kept[0]` wechselt.
Empfehlung: Die Stoppdistanz im Quadrat in einem `Float64Array`-Scratch halten und nur neu rechnen, wenn das fernste gehaltene Tile wechselt; der Vergleich dann ohne `sqrt` über `distanceToCamera²`.

**PERF-034 · info · packages/twopoint5d/src/sprites/textureShapeKey.ts:76** — Samples-Bit in textureShapeKey() weiter als nötig
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Das Bit gilt für jede Textur mit `renderTarget.samples > 1`; three r185 bindet aber nur Tiefentexturen multisampled (`WebGPUUtils.js:126-127`). Folge höchstens ein überflüssiger Graph-Neubau beim Wechsel zwischen der Farbtextur eines MSAA-Targets und einer ohne; falsch gezeichnet wird nichts.
Empfehlung: Das Bit auf Tiefentexturen beschränken (`isDepthTexture && samples > 1`).

**READ-024 · info · packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:13** — Kommentarblock über den Vertex-Formaten ungleich umbrochen
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Nach dem Einschub der three-Version ist die erste Zeile des Kommentarblocks 104 Zeichen lang, die folgenden brechen bei 85–100 um.
Empfehlung: Den Block einheitlich neu umbrechen.

**READ-026 · info · packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts:106** (auch `:110`) — »a AnimatedSpritesMaterial« in den @ts-expect-error-Kommentaren der Spec
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Zwei Kommentare schreiben »a AnimatedSpritesMaterial«.
Empfehlung: »an AnimatedSpritesMaterial« schreiben.

**READ-027 · info · packages/twopoint5d/src/sprites/hot-path-allocations.spec.ts:45** — Kommentar der Sprite-Allokations-Spec verweist per Position statt per Testname
Kleiner Befund des Reviewers im Remediation-Lauf vom 2026-09-28. Der Kommentar im ersten Test verweist auf »the two tests after the allocation tests of the setters«; eine Umordnung der Spec macht den Verweis falsch, ohne dass es auffällt.
Empfehlung: Die beiden Spy-Tests beim Namen nennen (`a textured sprite hands the values of setSize(), setPosition() and setColor() on in one array`, `an animated sprite hands the values of setSize() and setPosition() on in one array`).

## Review

Reviewer-Urteil (opus, `paket-3.review-0.json`), Stand des Commits `fc40b690`:

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-128 | behoben | `Map2D.ts:39–51` (Rückweg `takenOff`), JSDoc `:20–23`, CHANGELOG `:457`, Test `Map2D.spec.ts:425–482` |
| DOC-077 | behoben | JSDoc `Map2D.ts:188–190`, CHANGELOG `:150`, Test `Map2D.spec.ts:504–533` |
| DOC-075 | behoben | `CameraBasedVisibility.ts:1248–1252` |
| PERF-033 | behoben | Konstanten `CameraBasedVisibility.ts:183–186`, `#searchStop` `:455`, `beginSearchStop()`/`updateSearchStop()` `:1203–1227`, Aufrufe `:873–884`, `searchCanStop(next)` `:1279–1284`, Test `CameraBasedVisibility.spec.ts:1398–1417` |
| PERF-034 | behoben | `textureShapeKey.ts:79`, JSDoc `:53–55`, Tests `textureShapeKey.spec.ts:76–96`, CHANGELOG `:268` |
| READ-024 | behoben | `VertexObjectDescriptor.ts:13–14` |
| READ-026 | behoben | `AnimatedSpritesMaterial.spec.ts:106`, `:110` |
| READ-027 | behoben | `hot-path-allocations.spec.ts:44–47` |

Kleine Befunde: keine.

Abweichungen des Implementierers vom Detailplan (vom Reviewer gebilligt): im Test 1a wird der Wurf erst nach dem ersten `map.update()` scharf, weil schon das erste `update()` jeden Renderer leert (`Map2DTileStreamer.ts:170–172`); `isDepthTexture` über die Lesart `(texture as {isDepthTexture?: unknown})`, weil es am Typ `Texture` fehlt.

## Nebenbefunde

- `VertexObjectDescriptor.ts:92–99` (low) und `:250–251` (info) → »Offene Befunde«, → Scope: beide liegen in `src/vertex-objects/`, die Scope-Regel greift; keine Ursache mit einem Finding dieses Pakets geteilt.
- Nicht aufgenommen: `hot-path-allocations.spec.ts:24–27` mit Zeilen über 100 Zeichen — `printWidth` des Projekts ist 130, kein Befund. `CHANGELOG.md:456` (»A renderer taken off and added again held tiles …«) — ein `### Fixed`-Eintrag beschreibt den behobenen Fehler, das ist sein Zweck; vorbestehend aus `c152bab6`, vor diesem Lauf.
