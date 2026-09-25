# Paket 1 — Sprite-Materialien: Billboards, Tint, Parameter, Teardown — mit Pixel-Tests

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-116 (medium), IMPL-013 (medium), API-027 (medium), PERF-023 (low), TEST-009 (low)
- Ziel: Die Sprite-Materialien rendern transformierte Billboards und den Instanz-Tint korrekt, reichen three.js-Parameter durch und bauen beim dispose() nichts mehr neu — abgesichert durch Browser-Tests, die Pixel zurücklesen.
- Modell: stärkste Stufe — TSL-Mathematik über lokalen Raum und Weltraum, vier Fixes in zwei Materialien, die sich eine Effektkette teilen, und Pixel-Tests, die in Chromium (WebGPU) und Firefox halten müssen; ein roter GPU-Test dort will diagnostiziert werden, nicht abgeschrieben
- Effort: medium — Signaturen, Werte und Code stehen unten; `high` erhöhte nur die Neigung, über den Plan hinaus zu verbessern. Die eine öffentliche Typänderung (Schritt 6) ist exakt vorgegeben
- Dateien:
  - `packages/twopoint5d/src/sprites/node-utils.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.spec.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts` (nur TSDoc)
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`
  - `packages/twopoint5d/docs/resource-lifecycle.md` (§4)
  - `packages/twopoint5d/docs/proposals/sprite-features.md` (zwei Sätze, die nach dem Paket falsch wären)
  - `packages/twopoint5d/CHANGELOG.md`
  - `packages/twopoint5d-testing/test/helpers/fixtures.js`
  - `packages/twopoint5d-testing/test/sprites-rotation.test.js` (nur: Helfer kommen aus den Fixtures)
  - `packages/twopoint5d-testing/test/sprites-billboard.test.js` (neu)
  - `packages/twopoint5d-testing/test/sprites-textured-material.test.js` (neu)
  - `packages/twopoint5d-testing/test/sprites-animated-material.test.js` (neu)
  - nicht anfassen: `apps/lookbook` (die Demos geben nur `depthTest: true`/`depthWrite: true` mit, beides three-Defaults — keine sichtbare Änderung), `src/map2d/**` (siehe »Offene Befunde« im Plan), `AnimatedSprite.ts` (bekommt **kein** `color`-Attribut, siehe Entscheidung zu IMPL-013)
- Vorgehen: siehe Abschnitt »Vorgehen« unten — erst die Tests, rot sehen, dann die Fixes
- Verify: `pnpm run ci`
- Commit: `fix(sprites): turn billboards of a moved or turned mesh to the camera, tint each sprite by its color, apply the three.js parameters the material options carry, and stop the material effects before dispose() clears their inputs, with browser tests that read the rendered pixels back`, dazu der Footer `BREAKING CHANGE: TexturedSpritesMaterialParameters and AnimatedSpritesMaterialParameters take no positionNode and no colorNode.` (Konvention des `git log` für Typ-Brüche, vom Reviewer in Zug 3 verlangt)
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · BUG-116 unverändert (`node-utils.ts:47-56`) · IMPL-013 verschoben: Deskriptor-Attribut jetzt `TexturedSprite.ts:69` (Audit `:65`), `setColorValues` bei `:32-33`, Farb-Effekt unverändert `TexturedSpritesMaterial.ts:148-159` · API-027 unverändert (`TexturedSpritesMaterial.ts:12-16`, `:115-124`; `AnimatedSpritesMaterial.ts:49-50`) · PERF-023 unverändert (`TexturedSpritesMaterial.ts:168-176`, `AnimatedSpritesMaterial.ts:112-118`) · TEST-009 umgeformt: `sprites-rotation.test.js:90-112` rendert `TexturedSprites` ohne colorMap und liest Pixel zurück, offen bleiben colorMap-Pfad, AnimatedSprites und ein Farbvergleich · keine `Folgen:` im Plan (Paket 1 ist das erste) · »Offene Befunde« war leer, zwei neue Einträge → Audit (Rest von TEST-009 in der Stage-Domain; `TileSpritesMaterial.dispose()` mit derselben Ursache wie PERF-023 in map2d) · Restplan: Paket 2 bleibt hinter 1, Schnitt unverändert; was es von hier wissen muss, geht über `Schnittstellen:` (Abschnitt »Für Zug 5«)
  - 2026-09-25 Zug 1: Implementierer beauftragt · opus (stärkste Stufe), Effort medium · Brief `paket-1.impl-1.brief.txt`, Report `paket-1.impl-1.json` im Arbeitsverzeichnis
  - 2026-09-25 Zug 2: Report FERTIG_MIT_VORBEHALT (Chromium lief lokal über den WebGL2-Fallback, WebGPU-Backend nicht belegt) · 11 Dateien geändert, 3 neu (`sprites-billboard.test.js`, `sprites-textured-material.test.js`, `sprites-animated-material.test.js`) · roter Lauf belegt: 5 Browser-Tests, 6 Specs · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-1.verify.log`)
  - 2026-09-25 Zug 3: Reviewer beauftragt · opus, Effort medium · Diff `paket-1.diff` (1295 Zeilen), Report `paket-1.review-1.json`
  - 2026-09-25 Zug 3: Urteil — alle fünf Findings behoben · kritisch 0, wichtig 2 (Commit-Message ohne `BREAKING CHANGE:`-Footer; Rückblick »draws as it did« in `CHANGELOG.md:230`), klein 3 · Diff `paket-1.diff`
  - 2026-09-25 Zug 4 Runde 1: offen die zwei wichtigen Befunde · Footer in der Commit-Zeile oben ergänzt (Runner, keine Codezeile) · CHANGELOG-Satz plus die zwei kleinen Doku-Befunde (256-Byte-Kommentar in `fixtures.js`, alphaTest im TSDoc des Parametertyps) per Resume an denselben Implementierer (opus, medium)
  - 2026-09-25 Zug 4 Runde 1 zurück: FERTIG · `CHANGELOG.md` (Satz im Präsens), `fixtures.js` (Kommentar zur 256-Byte-Ausrichtung), `TexturedSpritesMaterial.ts` (TSDoc zu alphaTest) · Verify exit=0 (`paket-1.verify-2.log`) · Diff `paket-1.r1.diff`, gezielter Review `paket-1.review-2.json`
  - 2026-09-25 Zug 4 Runde 1 Review (sonnet, `paket-1.review-2.json`): alle vier Befunde erledigt, neu nur klein 2
  - 2026-09-25 Zug 5: Commit `deeddeea` · 14 Dateien · Verify `paket-1.verify-2.log` exit=0 · Trailer `Remediation-Run: 2026-09-25`

## Abgleich

| Finding | Stand | Fundstelle jetzt |
| --- | --- | --- |
| BUG-116 | unverändert | `node-utils.ts:47` `look = normalize(sub(cameraPosition, billboardPosition))` — `cameraPosition` ist Weltraum, `billboardPosition` (Attribut `instancePosition`) lokaler Raum des Meshes; `:49-53` `cameraUp` aus den Zeilen der `modelViewMatrix` |
| IMPL-013 | verschoben | `TexturedSprite.ts:69` (`color: {components: ['r','g','b','a'], setter: 'setColorValues', getter: false}`), `:37-39` `[voInitialize]` setzt Weiß, `:32-33` Überladungen von `setColorValues`, `:54-56` `setColor()`; `TexturedSpritesMaterial.ts:148-159` baut den `colorNode` nur aus dem Textur-Sample bzw. `vec4(0.5, 0.5, 0.5, 1)` |
| API-027 | unverändert | `TexturedSpritesMaterial.ts:116` `super()` ohne Argumente, `:118-124` liest nur `name`, `renderAsBillboards`, `colorMap`; kein `setValues()`. `AnimatedSpritesMaterial.ts:49-54` reicht `options` samt `animsMap`/`time` an `super(options)` |
| PERF-023 | unverändert | `TexturedSpritesMaterial.ts:168-176` setzt `#colorMap`/`#texCoordsNode` auf `undefined`, während beide Effekte leben; `AnimatedSpritesMaterial.ts:112-118` setzt vorher `#animsMap` auf `undefined` und stößt damit den anims-Effekt und über `texCoordsNode` den Farb-Effekt an |
| TEST-009 | umgeformt | `packages/twopoint5d-testing/test/sprites-rotation.test.js:90-112`: drei Tests rendern `TexturedSprites` **ohne** colorMap in ein `RenderTarget` und messen die bedeckte Fläche. Offen: kein Test kompiliert den colorMap-Pfad (`colorFromTextureByTexCoords`), keiner baut `AnimatedSprites`/`AnimatedSpritesMaterial`, keiner vergleicht ein Pixel mit einer Texturfarbe. `Canvas2DStage` und `OrthographicProjection` aus der Beschreibung liegen in der Stage-Domain, außerhalb der Scope-Regel → »Offene Befunde« im Plan, `→ Audit` |

## Entscheidungen in Zug 0

Alles hier ist aus dem Code begründet und ohne Rückfrage entschieden.

1. **IMPL-013 über `vertexColor()`, nicht über das nackte `attribute('color')`.** Die Entscheidung im Plan (Textur-Sample × Instanzfarbe, für TexturedSprites und AnimatedSprites, nicht breaking, weil der Default Weiß ist) gilt unverändert; nur der TSL-Zugriff ist der sichere. Grund, nachgelesen in three 0.185.1: `AttributeNode.generate()` (`src/nodes/core/AttributeNode.js:127-131`) antwortet für ein Attribut, das die Geometrie nicht trägt, mit `builder.generateConst(nodeType)` — `vec4(0)`. `AnimatedSpriteDescriptor` hat kein `color`; jedes AnimatedSprite bekäme Alpha 0 und fiele durch den Alpha-Test `0.001` — unsichtbar, also breaking. `vertexColor()` (`VertexColorNode.generate()`, `src/nodes/accessors/VertexColorNode.js:59-77`) liest dasselbe Attribut `color` und antwortet ohne es mit `vec4(1, 1, 1, 1)`. `AnimatedSprite` bekommt kein `color`-Attribut: die Asymmetrie beider Sprite-Typen ist im Audit als API-004 »wont fix« akzeptiert.
2. **Der Tint gilt auch für den Grau-Default** ohne colorMap (`vec4(0.5, 0.5, 0.5, 1)` × Farbe) — derselbe Effekt, eine Regel. `sprites-rotation.test.js` bleibt grün: Weiß × Grau ist Grau.
3. **API-027: `positionNode` und `colorNode` fallen aus dem Parametertyp.** Beide baut das Material in seinen Effekten selbst und überschreibt einen übergebenen Knoten, bevor er je rendert — nach dem Fix wären sie die zwei letzten Parameter, die kompilieren und nichts tun. `TexturedSpritesMaterialParameters extends Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'>`. Breaking auf Typebene für einen Aufrufer, der sie übergibt: `### Changed` plus Prüfung des Migration Guide (Skill `updating-changelog`). Eigene Aufrufer übergeben keinen (geprüft: `apps/lookbook`, `packages/twopoint5d-testing`, Doku).
4. **API-027: ein `alphaTest` oder `alphaTestNode` des Aufrufers ersetzt den Default-Alpha-Test.** `NodeMaterial.setupDiffuseColor()` (`src/materials/nodes/NodeMaterial.js:869-873`) nimmt `alphaTestNode`, sobald er nicht `null` ist, und ignoriert dann `alphaTest`. Das Material setzt `alphaTestNode = float(0.001)` deshalb nur, wenn die Parameter weder `alphaTest` noch `alphaTestNode` tragen — sonst wäre `alphaTest: 0.5` wieder ein Parameter ohne Wirkung.
5. **API-027: `AnimatedSpritesMaterial` nimmt `animsMap` und `time` heraus, bevor es `super()` ruft.** Sonst erreichte `setValues()` im Basiskonstruktor die Accessoren `animsMap` und `time`, deren private Felder (`#animsMap`, `#timeUniform`) erst nach `super()` existieren — `TypeError`.
6. **PERF-023 über die Effekt-Handles**, nicht über ein `#disposing`-Flag: `createEffect()` gibt ein `Effect` mit `destroy()` zurück (`@spearwolf/signalize` 1.0.0, `lib/Effect.d.ts:14`, exportiert aus `lib/index.d.ts:5`). Jede Klasse zerstört ihre eigenen Effekte zuerst, dann leert sie die Signale, dann `SignalGroup.delete(this)` — die Reihenfolge aus `docs/resource-lifecycle.md` bleibt, ein Schritt kommt davor.
7. **BUG-116: Kameraposition in den lokalen Raum holen** (erste Option der Empfehlung), nicht die Rechnung in den View-Space verlegen. Ein `positionNode` liefert lokale Koordinaten; der View-Space-Weg bräuchte einen `vertexNode` in Clip-Space und änderte die Billboard-Art (bildebenen- statt kamerapunktorientiert). `cameraUp` aus der `modelViewMatrix` bleibt: die zweite Zeile ihrer 3×3-Rotation ist die Up-Achse der Kamera im lokalen Raum, exakt für verschobene, gedrehte und gleichmäßig skalierte Meshes. Ungleichmäßige Skalierung verzerrt die Quads; das steht im TSDoc, nicht im Fix.
8. **TEST-009: eine Smoke-Datei pro Materialfamilie mit `DataTexture` statt Lookbook-Assets.** Eine 2×2- bzw. 2×1-`DataTexture` aus reinen Primärfarben (0/255) sampelt mit `NearestFilter` ohne Mipmaps und übersteht jede Farbraumkonvertierung unverändert; ein PNG aus der Lookbook gäbe keine exakte Erwartung für den Mittelpixel.
9. **PERF-023 bekommt keinen CHANGELOG-Eintrag** — keine Änderung an der öffentlichen Oberfläche. Das neue Verhalten (die Knoten bleiben) steht im TSDoc von `dispose()`.

## Vorgehen

Reihenfolge: erst Fixtures und alle Tests, rot sehen und den roten Lauf in den Report, dann die Fixes. Innere Schleife:

- Specs: `pnpm nx test twopoint5d -- src/sprites`
- Browser (läuft gegen die gebaute Library): `pnpm build:twopoint5d && pnpm --dir packages/twopoint5d-testing exec web-test-runner --files "test/sprites-*.test.js"`
- Die Browser-Tests werden von `pnpm typecheck` mit `checkJs` gegen die gebaute Library geprüft (`packages/twopoint5d-testing/tsconfig.json`: `noImplicitAny` und `strictNullChecks` aus) — JSDoc-Typen sauber halten.

### 1. Fixtures: `packages/twopoint5d-testing/test/helpers/fixtures.js`

Die Sprite-Tests teilen ihre Helfer über diese Datei (AGENTS.md: ein Helfer, den eine zweite Testdatei braucht, gehört hierher).

- Import ergänzen: `import {DataTexture} from 'three/webgpu';` (unter dem bestehenden Import aus `@spearwolf/twopoint5d`).
- Neuer Abschnitt am Dateiende, Überschrift im Stil der anderen: `// --- sprites and pixels ---`. Darin genau diese fünf Exporte:

```js
/**
 * A texture of the given texels, row by row from the first, each an `[r, g, b, a]` of 0 … 255.
 * A `DataTexture` samples with `NearestFilter` and builds no mipmaps, so a texel comes out of the
 * shader as it went in.
 *
 * @param {number[][]} texels
 * @param {number} [width]
 * @param {number} [height]
 */
export function makeColorTexture(texels, width = texels.length, height = 1) {
  const texture = new DataTexture(new Uint8Array(texels.flat()), width, height);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Renders `scene` through `camera` into `target` on an opaque black background and reads the
 * target back: four bytes per pixel, red, green, blue, alpha.
 */
export async function renderToPixels(renderer, scene, camera, target) {
  renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(target);
  try {
    renderer.render(scene, camera);
  } finally {
    renderer.setRenderTarget(null);
  }
  return renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
}

/** The `[r, g, b]` of the pixel at `x`, `y` of a read-back target `size` pixels wide. */
export function rgbAt(pixels, size, x, y) {
  const i = (y * size + x) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2]];
}

/** Whether every channel of `rgb` lies within `tolerance` of the one in `expected`. */
export function isNearColor(rgb, expected, tolerance = 2) {
  return rgb.every((value, i) => Math.abs(value - expected[i]) <= tolerance);
}
```

- `coveredBox(pixels, size)` wandert unverändert (Doc-Kommentar und Rumpf) aus `sprites-rotation.test.js:10-29` in diesen Abschnitt und wird exportiert. Der Kommentar in seiner Schleife (»the sprite has no color map and draws in flat grey; the clear color is black«) wird allgemein: `// the clear color is black, and every sprite these tests measure draws brighter than that`.

### 2. `sprites-rotation.test.js` auf die Fixtures umstellen

- Die lokale Funktion `coveredBox` (`:10-29`) entfällt; Import aus `./helpers/fixtures.js` um `coveredBox` und `renderToPixels` erweitern.
- In `renderSprite()` ersetzen die Zeilen `:77-83` (`const {renderer} = display;` bis `readRenderTargetPixelsAsync`) durch `const pixels = await renderToPixels(display.renderer, scene, camera, target);`.
- Die drei Tests, ihre Namen und Erwartungen bleiben unverändert. `TARGET_SIZE` bleibt `64` — in allen Sprite-Tests dieses Pakets: 64 Pixel × 4 Byte ergeben genau die 256 Byte, auf die WebGPU Zeilen beim Zurückkopieren ausrichtet; bei anderen Breiten stimmte die Indexrechnung in `rgbAt`/`coveredBox` womöglich nicht.

### 3. Neu: `sprites-billboard.test.js` — Regressionstest für BUG-116

Gerüst wie `sprites-rotation.test.js` (Imports von `@esm-bundle/chai`, `Display`/`TexturedSprites` aus `@spearwolf/twopoint5d`, `Group`/`OrthographicCamera`/`RenderTarget`/`Scene` aus `three/webgpu`; `this.timeout(20000)` mit dem Kommentar zum kalten WebGPU-Start; `beforeEach`/`afterEach` mit `makeContainer`, `new Display(host)`, `await display.start()`, `new RenderTarget(64, 64)`, Abbau über `disposeDisplay` exakt wie dort). `TARGET_SIZE = 64`, `PIXELS_PER_UNIT = 8`.

- `describe('sprites — billboards on a moved and turned mesh', …)`
- Helfer im `describe`:

```js
/**
 * Draws one billboard of `width` × `height` units at the local origin of a mesh that `place`
 * puts into the scene, looks at it from straight in front of the world point (2, 0, 0), and
 * measures what it covers.
 */
async function renderBillboard({width, height, place}) {
  const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
  const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
  camera.position.set(2, 0, 10);

  const sprites = new TexturedSprites(1, {renderAsBillboards: true});
  sprites.frustumCulled = false;
  const sprite = sprites.createSprite();
  sprite.setSize(width, height);
  sprite.setPosition(0, 0, 0);

  const scene = new Scene();
  place(scene, sprites);
  sprites.update();

  const pixels = await renderToPixels(display.renderer, scene, camera, target);

  sprites.dispose();

  return coveredBox(pixels, TARGET_SIZE);
}
```

- Drei Tests, jeder erwartet `{width: 4 * PIXELS_PER_UNIT, height: 1 * PIXELS_PER_UNIT}` (32 × 8), mit der Assertion-Message `'a billboard that faces the camera, not one turned with its mesh'`:
  1. `'a billboard on a mesh moved and turned by a quarter faces the camera'` — `width: 4, height: 1`, `place`: `mesh.position.set(2, 0, 0); mesh.rotation.y = Math.PI / 2; scene.add(mesh);`
  2. `'a billboard on a mesh whose parent is moved and turned by a quarter faces the camera'` — `width: 4, height: 1`, `place`: `const group = new Group(); group.position.set(2, 0, 0); group.rotation.y = Math.PI / 2; group.add(mesh); scene.add(group);`
  3. `'a billboard on a mesh scaled by 2 grows with it and faces the camera'` — `width: 2, height: 0.5`, `place`: wie Test 1 plus `mesh.scale.setScalar(2);`
- Vor dem Fix rot (nachgerechnet: der Look-Vektor zeigt lokal nach +z, nach der Vierteldrehung um Y steht das Quad fast hochkant, bedeckte Breite ≈ 6 px statt 32). Die drei Tests aus `sprites-rotation.test.js` (Mesh im Ursprung, Weltmatrix = Einheit) bleiben vor und nach dem Fix grün.

### 4. Neu: `sprites-textured-material.test.js` — TEST-009 (Familie TexturedSprites) und Regressionstest für IMPL-013

Gerüst wie in Schritt 3 (Imports: `Display`, `TexturedSprites`; `OrthographicCamera`, `RenderTarget`, `Scene`; aus den Fixtures `disposeDisplay`, `isNearColor`, `makeColorTexture`, `makeContainer`, `renderToPixels`, `rgbAt`). Konstanten: `TARGET_SIZE = 64`, `PIXELS_PER_UNIT = 8`, `CENTER = TARGET_SIZE / 2`, `WHITE = [255, 255, 255, 255]`, `GREEN = [0, 255, 0, 255]`.

- `describe('sprites — TexturedSpritesMaterial draws its color map', …)`
- Helfer:

```js
/**
 * Draws one sprite of 4 × 4 units over the middle of the target, with the whole of `colorMap`
 * on it and, when given, `color` as its color, and answers the color of the middle pixel.
 */
async function renderSprite({colorMap, color}) {
  const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
  const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
  camera.position.z = 10;

  const sprites = new TexturedSprites(1, colorMap);
  sprites.frustumCulled = false;
  const sprite = sprites.createSprite();
  sprite.setSize(4, 4);
  sprite.setPosition(0, 0, 0);
  sprite.setTexCoords(0, 0, 1, 1);
  if (color) sprite.setColorValues(...color);

  const scene = new Scene();
  scene.add(sprites);
  sprites.update();

  const pixels = await renderToPixels(display.renderer, scene, camera, target);

  // the mesh releases the material it built around the texture; the texture stays the caller's
  sprites.dispose();
  colorMap.dispose();

  return rgbAt(pixels, TARGET_SIZE, CENTER, CENTER);
}
```

- Drei Tests; jede Farbe wird mit `expect(rgb, '<message>').to.satisfy((c) => isNearColor(c, <erwartet>))` geprüft, damit die Meldung das gelesene Pixel zeigt:
  1. `'draws the color of its color map'` — `colorMap: makeColorTexture([GREEN, GREEN, GREEN, GREEN], 2, 2)`, ohne `color` → `[0, 255, 0]`, Message `'the green of the color map'`. Vor dem Fix schon grün (Smoke-Test, kein Regressionstest).
  2. `'tints the color map by the color of the sprite'` — weiße 2×2-Textur, `color: [1, 0, 0, 1]` → `[255, 0, 0]`, Message `'white tinted red'`. Vor dem Fix rot (Weiß).
  3. `'does not draw a sprite whose color has an alpha of 0'` — weiße 2×2-Textur, `color: [1, 1, 1, 0]` → `[0, 0, 0]` (die Clear-Farbe), Message `'the clear color, the sprite fell through the alpha test'`. Vor dem Fix rot (Weiß).

### 5. Neu: `sprites-animated-material.test.js` — TEST-009 (Familie AnimatedSprites)

Gerüst wie in Schritt 3 (Imports: `AnimatedSprites`, `AnimatedSpritesGeometry`, `AnimatedSpritesMaterial`, `Display`, `FrameBasedAnimations`, `TextureCoords` aus `@spearwolf/twopoint5d`; `OrthographicCamera`, `RenderTarget`, `Scene`; Fixtures wie in Schritt 4). Konstanten wie dort, dazu `RED = [255, 0, 0, 255]`.

- `describe('sprites — AnimatedSpritesMaterial draws the frame the time points at', …)`
- Helfer:

```js
/**
 * One animation of two frames over one second, on a color map of two texels: the left one red,
 * the right one green. Draws one sprite of 4 × 4 units over the middle of the target at `time`
 * and answers the color of the middle pixel.
 */
async function renderAt(time) {
  const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
  const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
  camera.position.z = 10;

  const colorMap = makeColorTexture([RED, GREEN]);
  const frames = new TextureCoords(0, 0, 2, 1);
  const anims = new FrameBasedAnimations();
  anims.add('blink', 1, [new TextureCoords(frames, 0, 0, 1, 1), new TextureCoords(frames, 1, 0, 1, 1)]);
  const animsMap = anims.bakeDataTexture();

  const geometry = new AnimatedSpritesGeometry(1);
  const material = new AnimatedSpritesMaterial({colorMap, animsMap, time});
  const sprites = new AnimatedSprites(geometry, material);
  sprites.frustumCulled = false;

  const sprite = geometry.instancedPool.createVO();
  sprite.setSize(4, 4);
  sprite.setPosition(0, 0, 0);
  sprite.animId = anims.animId('blink');
  sprite.animOffset = 0;

  const scene = new Scene();
  scene.add(sprites);
  sprites.update();

  const pixels = await renderToPixels(display.renderer, scene, camera, target);

  // the mesh gives geometry and material up; both, like the two textures, are the caller's
  sprites.dispose();
  geometry.dispose();
  material.dispose();
  colorMap.dispose();
  animsMap.dispose();

  return rgbAt(pixels, TARGET_SIZE, CENTER, CENTER);
}
```

- Zwei Tests:
  1. `'shows the first frame at the start of the animation'` — `renderAt(0)` → `[255, 0, 0]`, Message `'the red of the first frame'`.
  2. `'shows the second frame three quarters into the animation'` — `renderAt(0.75)` → `[0, 255, 0]`, Message `'the green of the second frame'`. (Nicht `0.5`: dort liegt `floor(time / duration * frameCount)` genau auf der Frame-Grenze.)
- Beide sind vor dem Fix grün (Smoke-Tests). Nach Schritt 8 sichern sie zugleich, dass ein AnimatedSprite ohne `color`-Attribut nicht schwarz wird — der Grund für `vertexColor()`.
- Rechenweg zur Kontrolle: Frame 0 hat `s=0, t=0, u=0.5, v=1`, Frame 1 `s=0.5`; der Mittelpunkt des Sprites (uv 0.5/0.5) sampelt bei x = 0.25 bzw. 0.75 → Texel 0 (rot) bzw. 1 (grün). `bakeDataTexture()` liefert eine `FloatType`-Textur von 4 × 1 Texeln (1 Animation + 2 Frames, auf 4 aufgerundet).

### 6. Specs für API-027 und PERF-023 (rot vor dem Fix)

In `TexturedSpritesMaterial.spec.ts` (Import `AdditiveBlending` aus `three/webgpu` ergänzen):

- Neues `describe('parameters', …)` vor `describe('dispose()', …)`:
  - `'applies the three.js material parameters it is given'` — `new TexturedSpritesMaterial({transparent: true, depthWrite: false, blending: AdditiveBlending})` → `transparent` ist `true`, `depthWrite` `false`, `blending` `AdditiveBlending`. Rot vor dem Fix.
  - `'keeps its own options apart from them'` — `const warn = sandbox.spy(console, 'warn');` dann `new TexturedSpritesMaterial({name: 'sprites', colorMap, renderAsBillboards: true, transparent: true})` → `name` ist `'sprites'`, `colorMap` die übergebene Textur, `renderAsBillboards` `true`, `transparent` `true`, `warn.called` `false` (three meldet über `console.warn` jeden Schlüssel, den `setValues()` nicht kennt oder der `undefined` ist).
  - `'drops fully transparent texels by default'` — ohne Optionen ist `alphaTestNode` nicht `null`.
  - `'leaves the alpha test to an alphaTest it is given'` — `{alphaTest: 0.5}` → `alphaTest` ist `0.5`, `alphaTestNode` ist `null`. Rot vor dem Fix.
- In `describe('dispose()', …)` ein Test hinter (e), mit eigenem Kommentar `// the teardown builds no node: the effects are gone before dispose() clears what they read`:
  - `'builds no node on the way out'` — `new TexturedSpritesMaterial({colorMap: new Texture(), renderAsBillboards: true})`, vorher `version`, `colorNode`, `positionNode` festhalten, `dispose()`, dann `version` unverändert, `colorNode` und `positionNode` identisch (`toBe`). Rot vor dem Fix.

In `AnimatedSpritesMaterial.spec.ts` (Import `AdditiveBlending` aus `three/webgpu` ergänzen):

- Neues `describe('parameters', …)`:
  - `'applies the three.js material parameters it is given, beside its own'` — `const warn = sandbox.spy(console, 'warn');`, `const animsMap = makeAnimsMap();`, `new AnimatedSpritesMaterial({animsMap, time: 2, transparent: true, depthWrite: false, blending: AdditiveBlending})` → `transparent` `true`, `depthWrite` `false`, `blending` `AdditiveBlending`, `animsMap` die übergebene Textur, `time` `2`, `warn.called` `false`. Rot vor dem Fix.
- In `describe('dispose()', …)` mit demselben Kommentar wie oben:
  - `'builds no node on the way out'` — `new AnimatedSpritesMaterial({colorMap: new Texture(), animsMap: makeAnimsMap()})`, `version` und `colorNode` festhalten, `dispose()`, `version` unverändert, `colorNode` identisch. Rot vor dem Fix (nachvollzogen: drei Effektläufe, drei `version++`).

Roter Lauf der Regressionstests in den Report, mit Kommando und Ausgabe: die drei aus Schritt 3, Test 2 und 3 aus Schritt 4 und die als »rot vor dem Fix« markierten Specs aus Schritt 6. Test 1 aus Schritt 4 und beide aus Schritt 5 sind Smoke-Tests und schon vorher grün.

### 7. BUG-116: `node-utils.ts`

- Import aus `three/tsl` um `modelWorldMatrixInverse` und `vec4` erweitern (alphabetisch einsortiert wie die bestehende Liste).
- In `billboardVertexByInstancePosition` ersetzt diese Rechnung die Zeile `:47`:

```ts
// the instance position lives in the local space of the mesh, the camera position in world
// space; the look vector needs both ends in one space
const cameraPositionLocal = mul(modelWorldMatrixInverse, vec4(cameraPosition, 1)).xyz;
const look = normalize(sub(cameraPositionLocal, billboardPosition));
```

  Typt `@types/three@0.185.4` das Produkt nicht als `vec4` (so dass `.xyz` nicht kompiliert), zuerst `modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz` versuchen; hilft auch das nicht, ein eng begrenzter Cast mit Begründung wie in `matrixColumn.ts` — kein `any`.
- Über `const cameraUp = vec3(…)` (`:49`) ein Kommentar: die zweite Zeile der Model-View-Rotation ist die Up-Achse der Kamera, ausgedrückt im lokalen Raum des Meshes — exakt, solange das Mesh auf allen Achsen gleich skaliert ist.
- TSDoc über `billboardVertexByInstancePosition` (hat bisher keinen): baut die Position eines Vertex eines Quads, das sich um seine Instanzposition zur Kameraposition dreht; das Ergebnis liegt im lokalen Raum des Meshes, wie ein `positionNode` es verlangt, die Kameraposition wird über die inverse Weltmatrix dorthin geholt; richtig für ein Mesh — samt Eltern —, das verschoben, gedreht und auf allen Achsen gleich skaliert ist; eine Skalierung, die je Achse verschieden ist, verzerrt die Quads. Englisch, eigene Worte.
- Danach: die drei Tests aus Schritt 3 grün, `sprites-rotation.test.js` weiter grün.

### 8. IMPL-013: `TexturedSpritesMaterial.ts`, Farb-Effekt (`:148-159`)

- Import aus `three/tsl` um `vertexColor` erweitern.
- Der Effekt multipliziert beide Zweige mit der Sprite-Farbe:

```ts
createEffect(
  () => {
    // every sprite is tinted by its color attribute, alpha included; vertexColor() answers
    // white for a geometry without that attribute, so sprites that carry none draw as they are
    const spriteColor = vertexColor();

    if (this.colorMap) {
      this.colorNode = mul(colorFromTextureByTexCoords(this.colorMap, {texCoords: this.texCoordsNode}), spriteColor);
    } else {
      this.colorNode = mul(vec4(0.5, 0.5, 0.5, 1), spriteColor); // Default color if no texture is provided
    }

    this.needsUpdate = true;
  },
  {attach: this},
);
```

  (Die Zuweisung an ein Effekt-Handle kommt in Schritt 10 dazu.) `NodeMaterial.vertexColors` bleibt `false` — sonst multipliziert three im `setupDiffuseColor()` ein zweites Mal.
- TSDoc an `TexturedSprite#setColor()` (`TexturedSprite.ts:54`): die Farbe tönt das Sprite — die Sprite-Materialien multiplizieren, was sie zeichnen, mit ihr, Alpha eingeschlossen; Weiß, mit dem jedes Sprite beginnt, lässt es, wie es ist; ein Alpha zwischen 0 und 1 blendet nur auf einem Material mit `transparent: true`, und beim Default-Alpha-Test wird ein Sprite mit Alpha 0 nicht gezeichnet. Englisch, eigene Worte. An der ersten Überladung von `setColorValues` im Interface (`:32`) ein Einzeiler, der auf `setColor()` verweist.
- Danach: Tests 2 und 3 aus Schritt 4 grün, Schritt 5 weiter grün.

### 9. API-027: Konstruktoren

`TexturedSpritesMaterial.ts`:

- Das Interface (`:12-16`) wird zu `export interface TexturedSpritesMaterialParameters extends Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'>` mit denselben drei eigenen Schlüsseln und einem TSDoc: jeder three.js-Materialparameter erreicht das Material über `setValues()`; `positionNode` und `colorNode` gehören nicht dazu, weil das Material beide selbst baut.
- Konstruktor-Anfang (`:115-124`) in dieser Reihenfolge; die Effekte folgen unverändert danach:

```ts
constructor(options?: TexturedSpritesMaterialParameters) {
  super();

  const {name, colorMap, renderAsBillboards, ...materialParameters} = options ?? {};

  this.name = name ?? 'twopoint5d.TexturedSpritesMaterial';

  this.renderAsBillboards = renderAsBillboards ?? this.#renderAsBillboards.value;

  if (materialParameters.alphaTest == null && materialParameters.alphaTestNode == null) {
    this.alphaTestNode = float(0.001);
  }

  this.setValues(materialParameters);

  this.colorMap = colorMap;
  // … createEffect(…) × 2 wie gehabt
}
```

  Zwei Warum-Kommentare, in eigenen Worten: (a) an der Destrukturierung — die eigenen Optionen bleiben aus `setValues()` heraus, denn `Material.setValues()` überspringt mit Warnung jeden Schlüssel, dessen aktueller Wert `undefined` ist (`colorMap` vor der ersten Zuweisung), und `name`/`renderAsBillboards` haben eigene Defaults; (b) am `if` — der Default-Alpha-Test wirft die voll transparenten Texel einer colorMap weg, und ein `alphaTest` oder `alphaTestNode` der Parameter tritt an seine Stelle, weil three `alphaTest` nicht mehr ansieht, sobald ein `alphaTestNode` gesetzt ist.

`AnimatedSpritesMaterial.ts` (`:49-54`):

```ts
constructor(options?: AnimatedSpritesMaterialParameters) {
  const {animsMap, time, ...texturedSpritesOptions} = options ?? {};

  super(texturedSpritesOptions);

  if (time != null) this.time = time;

  this.animsMap = animsMap;
  // … createEffect(…) wie gehabt
}
```

  Warum-Kommentar über der Destrukturierung: `animsMap` und `time` gehören dieser Klasse; in den Optionen der Basisklasse erreichten sie über `setValues()` die Accessoren unten, bevor deren private Felder existieren. (TypeScript 5.9 erlaubt Code vor `super()`, der `this` nicht berührt.)

- `TexturedSprites` braucht keine Änderung: sein Konstruktor reicht Parameter schon an `new TexturedSpritesMaterial(material)` durch.
- Danach: die Parameter-Specs aus Schritt 6 grün; Schritt 5 grün (dort geht `time` durch den neuen Pfad).

### 10. PERF-023: Effekt-Handles und `dispose()`

`TexturedSpritesMaterial.ts`:

- Import `createEffect, createSignal, type Effect, SignalGroup` aus `@spearwolf/signalize`.
- Zwei Felder, deklariert bei den anderen privaten Feldern: `readonly #positionEffect: Effect;` und `readonly #colorEffect: Effect;`. Im Konstruktor `this.#positionEffect = createEffect(…)` (der Effekt, der `positionNode` baut) und `this.#colorEffect = createEffect(…)` (der aus Schritt 8). `{attach: this}` bleibt an beiden.
- `dispose()` (`:168-176`):

```ts
override dispose() {
  // the effects go first: a write to a signal runs every effect that reads it on the spot, and
  // clearing the two references below would build nodes for a material on its way out
  this.#positionEffect.destroy();
  this.#colorEffect.destroy();

  // both references are given up while their signals are still live — a write after
  // SignalGroup.delete() would land in a destroyed signal and notify nobody
  this.#colorMap.set(undefined);
  this.#texCoordsNode.set(undefined);

  SignalGroup.delete(this);
  super.dispose();
}
```

- TSDoc von `dispose()` (`:162-167`): den Satz »The node accessors keep their last node.« erweitern — `colorNode` und `positionNode` behalten ebenso ihre Knoten, `dispose()` baut keinen neuen.

`AnimatedSpritesMaterial.ts`:

- Import `createEffect, createSignal, type Effect` aus `@spearwolf/signalize`.
- Feld `readonly #texCoordsEffect: Effect;`, im Konstruktor `this.#texCoordsEffect = createEffect(…)`.
- `dispose()` (`:112-118`): als erste Zeile `this.#texCoordsEffect.destroy();` mit dem Kommentar, dass der eigene Effekt vor dem Schreiben unten geht, das ihn sonst liefe und über `texCoordsNode` den Farb-Effekt der Basisklasse gleich mit. Der bestehende Kommentar und `this.#animsMap.set(undefined); super.dispose();` bleiben.
- Idempotenz: ein zweiter `dispose()`-Aufruf ruft `destroy()` auf einem zerstörten Effekt — laut `Effect.d.ts` ist ein zerstörter Effekt tot, `run()` ein No-op. Die bestehenden Tests (d) `'is safe to call twice'` und (e) `'does not leak signals or effects'` in beiden Specs beweisen es; bleiben sie grün, ist nichts weiter zu tun.
- Danach: die Specs `'builds no node on the way out'` grün, alle bisherigen Specs in `src/sprites` grün.

### 11. Doku

- `packages/twopoint5d/docs/resource-lifecycle.md` §4 (`:136-162`):
  - erster Code-Block (`:141-147`): `createEffect(() => {` wird zu `this.#colorEffect = createEffect(() => {`.
  - zweiter Code-Block (`:149-158`): durch genau das `dispose()` aus Schritt 10 ersetzen (dieselben Kommentare).
  - Nach dem zweiten Block, vor »`SignalGroup.delete(this)` is the entire teardown …«, ein Absatz in eigenen Worten: ein Effekt, der aus den Werten, die `dispose()` leert, etwas baut, wird zerstört, bevor sie geleert werden — ein Write lässt jeden lesenden Effekt sofort laufen; `SignalGroup.delete(this)` räumt danach den Rest ab.
  - Die Checkliste in §6 bleibt unverändert.
- `packages/twopoint5d/docs/proposals/sprite-features.md`:
  - Der Spiegelstrich `:58-60` (»**`TexturedSprite` writes a `color` attribute that no shader reads.** …«) ist nach dem Paket falsch. Neu, im Präsens und ohne Rückblick: die Tönung verteilt sich auf zwei Dateien — `TexturedSprite` deklariert `color` und `[voInitialize]` füllt es mit Weiß, `TexturedSpritesMaterial` multipliziert in seinem Farb-Effekt mit `vertexColor()`, das für eine Geometrie ohne das Attribut Weiß liefert; Deskriptor und Material sind sich nur über den Namen `color` einig, und ein `Tint`-Feature hielte beide Hälften an einer Stelle.
  - Frage 5 in §8, `:376-377`: der Satz »No shader reads `color` today, so a rename only breaks callers that `touch('color')` by hand.« wird zu: `TexturedSpritesMaterial` liest `color` über `vertexColor()`, eine Umbenennung bricht also dieses Material, eigene Materialien, die das Attribut lesen, und Aufrufer, die `touch('color')` von Hand rufen.
  - Frage 3 in §8 und der Rest der Datei bleiben unverändert.
- `packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`, mit dem Skill `updating-changelog`; veröffentlichte Abschnitte (ab `## [0.21.2]`, `:2348`) nicht anfassen. Jeder Eintrag eine Zeile, Stil der Nachbarn (»fix …«):
  - `### Fixed` (ab `:214`, bei den anderen Sprite-Fixes um `:227`), drei Einträge:
    - `billboardVertexByInstancePosition()`, und mit ihr `TexturedSpritesMaterial` und `AnimatedSpritesMaterial` mit `renderAsBillboards`: ein Billboard schaut zur Kameraposition, auch wenn sein Mesh oder ein Elternteil verschoben, gedreht oder auf allen Achsen gleich skaliert ist.
    - die Farbe eines `TexturedSprite`: `TexturedSpritesMaterial` multipliziert, was es zeichnet, mit ihr, Alpha eingeschlossen — `setColor()` und `setColorValues()` tönen das Sprite; Weiß, der Startwert, lässt es, wie es ist. `AnimatedSpritesMaterial` tut dasselbe für eine Geometrie mit `color`-Attribut; `AnimatedSprite` hat keins und zeichnet wie gehabt.
    - `TexturedSpritesMaterial` und `AnimatedSpritesMaterial` wenden jeden three.js-Materialparameter ihrer Optionen an — `transparent`, `blending`, `depthWrite` und die übrigen —, ebenso `TexturedSprites` für Optionen als Material-Argument; ein `alphaTest` oder `alphaTestNode` darunter ersetzt den Default-Alpha-Test bei `0.001`.
  - `### Changed` (ab `:44`), ein Eintrag: `TexturedSpritesMaterialParameters`, und mit ihm `AnimatedSpritesMaterialParameters`, nimmt `positionNode` und `colorNode` nicht mehr — beide Materialien bauen diese Knoten selbst.
  - `### Migration Guide` (ab `:340`): Prüfung nach dem Skill; ein Abschnitt nur, wenn der Skill ihn für die Typänderung verlangt.
  - Konvention des Plans: die Einträge beschreiben das Verhalten, das jetzt gilt; kein »früher«, kein »statt bisher«, keine Finding-ID.

### 12. Abschluss des Implementierers

- `pnpm run ci` grün.
- Report nach dem Vertrag aus dem Brief, mit dem roten Lauf aus Schritt 6 und den Browser-Tests aus 3 und 4.

## Für Zug 5

Die Zeile `Schnittstellen:` unter Paket 1 im Plan trägt mindestens das hier — Paket 2 (TEST-005) schreibt Material-Specs gegen genau diese Verdrahtung:

- `TexturedSpritesMaterialParameters extends Omit<NodeMaterialParameters, 'positionNode' | 'colorNode'>`; die Konstruktoren wenden den Rest per `setValues()` an; `AnimatedSpritesMaterial` nimmt `animsMap`/`time` vorher heraus.
- `TexturedSpritesMaterial#colorNode` ist `mul(<Sample der colorMap | vec4(0.5, 0.5, 0.5, 1)>, vertexColor())` — kein nackter `TextureNode` mehr. Empfehlung (3) von TEST-005 (»`colorMap` macht den `colorNode` zu einem `TextureNode`«) muss Paket 2 anders assertieren.
- `dispose()` beider Materialien zerstört zuerst die eigenen Effekte; `version`, `colorNode` und `positionNode` ändern sich durch `dispose()` nicht.
- `billboardVertexByInstancePosition()` liest `modelWorldMatrixInverse`.
- `packages/twopoint5d-testing/test/helpers/fixtures.js` exportiert `coveredBox`, `renderToPixels`, `makeColorTexture`, `rgbAt`, `isNearColor`.

## Findings im Volltext

**BUG-116 · medium · packages/twopoint5d/src/sprites/node-utils.ts:47-56** — Billboard-Rechnung in einem Raum führen, damit transformierte Meshes korrekt drehen
`look = normalize(cameraPosition - billboardPosition)` zieht eine Weltposition von einer Modellposition ab, `cameraUp` stammt aus der `modelViewMatrix`. Das stimmt nur mit einer Identitäts-Weltmatrix. Wird ein Sprite-Mesh mit `renderAsBillboards` verschoben, gedreht oder skaliert, zeigen die Billboards auf den falschen Punkt und stehen schief. Der Browser-Test prüft nur ein Mesh im Ursprung.
Empfehlung: Kameraposition per `modelWorldMatrixInverse` in den Modellraum holen oder die Rechnung konsequent im View-Space führen. Dazu ein Browser-Test mit verschobenem Mesh.

**IMPL-013 · medium · packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts:65** (weitere: `TexturedSprite.ts:33-35`, `TexturedSpritesMaterial.ts:148-159`) — Das Instanzattribut color von TexturedSprite im Shader auswerten oder entfernen
Der Deskriptor legt pro Instanz vier Floats `r,g,b,a` an, `voInitialize` setzt sie auf Weiß, und die API bietet `setColor()`/`setColorValues()` an. Der `colorNode` des Materials besteht aber nur aus dem Textur-Sample, kein Shader liest `color`. Tint und Alpha wirken nicht, und jedes Sprite lädt 16 Byte umsonst hoch.
Empfehlung: Im Farb-Effect mit `attribute('color')` multiplizieren oder Attribut und Methoden als Breaking Change entfernen.
Entscheidung im Plan (2026-09-25): im Shader auswerten, Textur-Sample × Instanzfarbe, für TexturedSprites und AnimatedSprites; Attribut und Methoden bleiben. Umsetzung über `vertexColor()`, Begründung oben unter »Entscheidungen in Zug 0«, Punkt 1.

**API-027 · medium · packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:115-124** (weitere: `TexturedSpritesMaterial.ts:12-16`, `AnimatedSpritesMaterial.ts:49-50`) — Die three.js-Materialparameter weiterreichen, die die Sprite-Materialien deklarieren
Der Parameter-Typ erweitert `NodeMaterialParameters`, der Konstruktor ruft aber `super()` ohne Argumente auf, liest nur `name`, `colorMap` und `renderAsBillboards` und ruft kein `setValues()` auf. `new AnimatedSpritesMaterial({transparent: true, blending: AdditiveBlending, depthWrite: false})` kompiliert und hat keine Wirkung.
Empfehlung: Die eigenen Keys herausnehmen, den Rest per `this.setValues(rest)` anwenden und mit einem Spec prüfen, etwa auf `transparent` und `depthWrite`.

**PERF-023 · low · packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:168** — Die Material-Effekte stoppen, bevor dispose() ihre Eingaben leert
signalize-Effekte laufen synchron bei einem Write auf ein Signal, das sie lesen. `AnimatedSpritesMaterial.dispose()` mit gesetzter colorMap nachvollzogen: `#animsMap.set(undefined)` lässt den anims-Effekt erneut laufen (baut `vec4`, setzt `texCoordsNode`, `needsUpdate = true`), der den colorNode-Effekt erneut laufen lässt (baut einen neuen `texture()`-Node), dann lässt `#colorMap.set(undefined)` den colorNode-Effekt noch einmal laufen. Drei Effekt-Läufe, zwei frische TSL-Teilgraphen und drei `version++` auf einem Material, das gerade weggeworfen wird — direkt bevor `SignalGroup.delete(this)` die Effekte ohnehin entfernt hätte. Für die Korrektheit harmlos, aber vergeudete Arbeit bei jedem Teardown.
Empfehlung: Die Handles aus `createEffect()` behalten und deren `destroy()` am Anfang von `dispose()` rufen (oder die Effekt-Rümpfe mit einem `#disposing`-Flag guarden), dann die Signale leeren, damit die Getter `undefined` antworten, dann `SignalGroup.delete(this)`. Das hält die dokumentierte »release before delete«-Reihenfolge.

**TEST-009 · low · packages/twopoint5d-testing/test/sprites-rotation.test.js:91-108** — Die Browser-Suite kompiliert kein einziges Sprite-Material und liest nie ein Pixel zurück
Was die 20 Browser-Testdateien (3374 Zeilen, beide Browser fahren jede Datei) prüfen, sind Verträge und Buchführung: Buffer-Versionen, Update-Ranges, `renderer.info.memory`, DOM-Nebenwirkungen, Dispose-Semantik — gut, und sie lesen GPU-Buffer zurück. Was sie nie tun: `TexturedSprites`, `AnimatedSprites`, ihre Materialien, `Canvas2DStage`, `OrthographicProjection` oder die TSL-Helfer `vertexByInstancePosition`/`colorFromTextureByTexCoords` instanziieren; nur `TileSpritesMaterial` wird kompiliert, ohne Textur. Kein Test liest ein gerendertes Pixel. Ein kaputter TSL-Graph in einem Sprite-Material passiert das volle Gate und wird nur von einem Menschen gefunden, der die Lookbook öffnet. Der Vorlauf führte daneben das Verhältnis 62 Specs zu 20 Browsertests als eigenen Punkt (TEST-003); die Zahl ist nicht das Problem, die Lücke ist es.
Empfehlung: Eine Smoke-Datei pro Materialfamilie: Mesh mit 2×2-DataTexture bauen, einen Frame in ein `RenderTarget` rendern, `renderer.readRenderTargetPixelsAsync` und den Mittelpixel gegen die Texturfarbe assertieren. Die Assertion ist backend-agnostisch. Die Lookbook-Assets wiederverwenden, wie `texture-store-on.test.js` es schon tut.
Umfang in diesem Paket: die Sprite-Materialfamilien (Plan-Kopf: »TEST-009 (Browser-Suite, betrifft die Sprite-Materialien)«). Der Stage-Teil steht in »Offene Befunde« des Plans, `→ Audit`.

## Nebenbefunde aus Zug 0 — Begründung der Urteile

- `packages/twopoint5d-testing/test/` — kein Browser-Test baut `Canvas2DStage` oder `OrthographicProjection` und liest ein Pixel zurück (`grep` über `test/*.js`: keiner nennt eine der beiden Klassen). Vorbestehend (Stand `c7cbb6d8`, vor dem ersten Commit des Laufs). Beide liegen in `src/stage/`, nicht in »Sprites« oder »Vertex Objects« → Scope-Regel greift nicht → `→ Audit`, low wie TEST-009; verwandt mit dem offenen Audit-Finding TEST-022 (»ungetestete öffentliche Verhalten der stage-Schicht«), dem der Abschluss es zuschlagen kann.
- `packages/twopoint5d/src/map2d/TileSprites/TileSpritesMaterial.ts:105-112` — `dispose()` setzt `#colorMap` auf `undefined`, während der Farb-Effekt (`:83`) lebt und `colorMap` liest: ein Effektlauf, ein neuer `colorNode`, ein `version++` direkt vor `SignalGroup.delete(this)`. Dieselbe Ursache wie PERF-023, vorbestehend (Stand `c7cbb6d8`), aber Domain map2d → `→ Audit`, low. Nicht in dieses Paket: die Regel »gehört er in den Lauf« verneint ihn, und die Doku-Änderung in §4 macht keine Aussage, die `TileSpritesMaterial` verletzte (die Checkliste in §6 bleibt unverändert).

## Urteil des Reviewers

Erster Review `paket-1.review-1.json` (opus), Nachprüfung `paket-1.review-2.json` (sonnet), beide im Arbeitsverzeichnis.

- BUG-116 — behoben: `packages/twopoint5d/src/sprites/node-utils.ts:60` holt die Kameraposition über `modelWorldMatrixInverse` in den lokalen Raum, TSDoc ab `:41`; Regressionstests `sprites-billboard.test.js:66`, `:83`, `:102`.
- IMPL-013 — behoben: `TexturedSpritesMaterial.ts:169-181` multipliziert beide Zweige mit `vertexColor()`; Tests `sprites-textured-material.test.js:82`, `:88`; TSDoc `TexturedSprite.ts:32`, `:56`.
- API-027 — behoben: `TexturedSpritesMaterial.ts:17` (`Omit<…>`), `:139-143` (Alpha-Test-Default, `setValues()`), `AnimatedSpritesMaterial.ts:54-56`; Specs `describe('parameters')` in `TexturedSpritesMaterial.spec.ts:14`, `AnimatedSpritesMaterial.spec.ts:56`.
- PERF-023 — behoben: Effekt-Handles `TexturedSpritesMaterial.ts:147`, `:169`, `dispose()` ab `:197`; `AnimatedSpritesMaterial.ts:121`; Specs `TexturedSpritesMaterial.spec.ts:139`, `AnimatedSpritesMaterial.spec.ts:151`; Doku `docs/resource-lifecycle.md:166`.
- TEST-009 — behoben im Umfang des Pakets: `sprites-textured-material.test.js:76`, `sprites-animated-material.test.js:93`, `:99`; Stage-Teil in »Offene Befunde« des Plans.

Kleine Befunde (ohne Runde):
- Verify-Lücke: die Pixel-Tests liefen lokal in Chromium über den WebGL2-Fallback und in Firefox; ein echtes WebGPU-Backend ist nicht belegt (Risiko gering, `instancePosition` nimmt denselben Attributpfad wie `vertexColor()`).
- `AnimatedSpritesMaterialParameters` (`AnimatedSpritesMaterial.ts:7`) trägt den alphaTest-Hinweis nur über den geerbten Typ, nicht im eigenen TSDoc.
- Der Kommentar zur 256-Byte-Ausrichtung steht als Block am Abschnittsanfang von `fixtures.js:176-179`, nicht an `rgbAt`/`coveredBox`; er nennt beide beim Namen.
- In Runde 1 erledigt, der Vollständigkeit halber: 256-Byte-Kommentar und alphaTest im TSDoc des Parametertyps (beide ursprünglich klein), CHANGELOG-Satz im Präsens und `BREAKING CHANGE:`-Footer (beide wichtig).

## Nebenbefunde aus Zug 2 — Begründung der Urteile

- `TexturedSpritesMaterial.ts:34`, `:78` — `vertexPositionNode` mit dem Alias `TAttributeNodeInstancePosition`: vorbestehend (der Implementierer hat die Zeilen nicht angefasst), liegt in `src/sprites/**` → Scope-Regel greift → `→ Scope`, low.
- `docs/proposals/sprite-features.md:50-56` — Rückblick im Proposal: vorbestehend, liegt nicht unter `src/sprites/**` oder den Tests der Domain; die Regel »kein Rückblick« ist eine Konvention dieses Laufs für eigene Zeilen, kein Projektfehler → `→ Audit`, low.
