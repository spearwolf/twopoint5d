# Paket 5 — Projektions-API: getViewRect als Objekt, getZoom aufgeteilt, Kamerapfade

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: API-005 (medium), API-056 (low), DOC-072 (info), DOC-050 (info),
  DOC-044 (low), TEST-029 (info) · dazu die Folge aus Paket 4 (Doku von
  `Canvas2DStage#dispose()` zu den Texturen, Nachtragspaket hier zusammengelegt)
- Ziel: `IProjection` gibt die View als benanntes Objekt zurück und trennt die
  beiden Zoom-Bedeutungen unter eigenen Namen; die Kamerapfade der Stage sind
  präzise dokumentiert, getestet und melden Fehlkonfiguration mit Klasse und
  Methode.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/IProjection.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts` samt `ParallaxProjection.spec.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts` samt `OrthographicProjection.spec.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts` (Aufruf `:243`, TSDoc `camera` `:157-161`)
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts` (nur TSDoc von `dispose()`) samt `Canvas2DStage.spec.ts` (ein neuer Test)
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts` (ein neuer Test; `StageRenderer.ts` bleibt unberührt)
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]`, samt Migration Guide)
- Verify: `pnpm run ci`
- Commit: `feat!: let IProjection#getViewRect() answer a named object, split getZoom() into IProjection#getScaleFactor() and ParallaxProjection#getParallaxFactor(), let a projection without a projection plane refuse createCamera() and updateCamera() with an error that names the class, the method and the field to set, let the stage docs say which calls place the camera of a stage and that a new projection keeps an assigned camera, and let the docs of Canvas2DStage#dispose() name the textures it releases`

## Rahmen für den Implementierer

Die beiden API-Brüche sind vom Nutzer entschieden (»Entscheidungen« im Plan,
2026-09-29) und hier auf Signatur, Semantik und Randfälle festgelegt. Nichts
davon ist neu zu entwerfen. Es gibt genau zwei Implementierungen von
`IProjection` im Repository (`ParallaxProjection`, `OrthographicProjection`)
und genau einen Aufrufer von `getViewRect()` außerhalb der Specs
(`Stage2D.ts:243`); `getZoom()` ruft außerhalb der beiden Specs niemand. Map2d,
Lookbook, Browser-Tests (`packages/twopoint5d-testing/test/*.test.js`) und die
`ts check`-Blöcke der Doku rufen keins von beiden (per `git grep` geprüft).

Kein Rendering- oder GPU-Code ändert sich: die Kamerawerte bleiben Bit für Bit,
was sie sind. Ein Browser-Test ist deshalb nicht nötig; die Vitest-Specs tragen
das Paket.

`IProjection.ts` wird per `export type * from './IProjection.js'` aus
`src/stage/public-api.ts` exportiert; ein neuer Typ dort ist damit öffentlich
und benennbar, `public-api.ts` bleibt unberührt.

## Vorgehen

Zeilenangaben gegen `abf84d48`.

1. **Neuer Typ `ProjectionViewRect`** in `packages/twopoint5d/src/stage/IProjection.ts`,
   vor `IProjection`:

   ```ts
   /** The view a projection fits into its container, as {@link IProjection.getViewRect} answers it. */
   export interface ProjectionViewRect {
     /** The width of the view, in view units. */
     width: number;
     /** The height of the view, in view units. */
     height: number;
     /** Container pixels per view unit, horizontally: the container width divided by {@link width}. */
     pixelRatioX: number;
     /** Container pixels per view unit, vertically: the container height divided by {@link height}. */
     pixelRatioY: number;
   }
   ```

   Die Feldbedeutungen folgen dem Code: `#pixelRatio.set(width, height).divide(this.#viewRect)`
   (`ParallaxProjection.ts:89`, `OrthographicProjection.ts:88`).

2. **`IProjection` neu geschnitten** (`IProjection.ts:4-13`):
   - `getViewRect(): ProjectionViewRect;` statt des Tuples. TSDoc: »The view of the last
     `updateViewRect()` that gave one with an area, as a new object on every call — a write to it
     leaves the projection as it is. `{width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0}`
     until then.«
   - `getZoom(distanceToCamera: number): number;` entfällt.
   - Neu `getScaleFactor(distanceToCamera: number): number;` an derselben Stelle. TSDoc, die die
     Bedeutung für jede Implementierung festschreibt: »How many times larger something sitting
     `distanceToCamera` in front of the camera appears than the same thing on the projection plane:
     `1` on the projection plane, above `1` in front of it, below `1` behind it. An orthographic
     projection answers `1` for every distance.« Dazu `@param distanceToCamera - How far the thing
     sits from the camera, along the direction the camera looks.`
   - Die übrigen Member (`updateViewRect`, `projectionPlane`, `createCamera`, `updateCamera`)
     bleiben unverändert.

3. **`getViewRect()` in beiden Implementierungen** (`ParallaxProjection.ts:111-113`,
   `OrthographicProjection.ts:106-108`): Rückgabetyp `ProjectionViewRect` (per `import type`
   aus `./IProjection.js`, zusammen mit `IProjection`), Rückgabe
   `{width: this.#viewRect.width, height: this.#viewRect.height, pixelRatioX: this.#pixelRatio.x, pixelRatioY: this.#pixelRatio.y}`
   — ein frisches Objekt je Aufruf, kein gecachtes: der einzige Aufrufer (`Stage2D#updateProjection`)
   läuft nur bei Resize, `needsUpdate` und `updateProjection(true)`, nicht pro Frame, und ein
   geteiltes Objekt könnte ein Aufrufer beschreiben. Die TSDoc von `updateViewRect()`
   (`ParallaxProjection.ts:70-71`, `OrthographicProjection.ts:68-69`) sagt statt
   »`getViewRect()` reports `[0, 0, 0, 0]`« jetzt
   »`getViewRect()` reports `{width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0}`«.

4. **`Stage2D.ts:243`**: `const {width: w, height: h} = this.projection!.getViewRect();` — die
   Namen `w`/`h` bleiben, der Rest der Methode liest sie unverändert.

5. **`getZoom()` aufteilen** (Entscheidung vom 2026-09-29, Namen vom Nutzer gewählt):
   - `ParallaxProjection#getZoom()` (`ParallaxProjection.ts:153-169`) wird zu
     `getParallaxFactor(distanceToCamera: number): number`. **Rumpf unverändert**, auch der
     Sonderfall `distanceToCamera === 0 → 1`: die Werte bleiben Bit für Bit, was `getZoom()`
     lieferte. Die TSDoc bleibt inhaltlich, wie sie ist (»The factor a plane sitting
     `distanceToCamera` in front of the camera is carried along with, measured against the
     projection plane … `1 - distanceToCamera / D` …«), und bekommt einen Satz dazu: »Not part
     of {@link IProjection}: an orthographic projection carries nothing along. For how large
     something appears at that distance, see {@link getScaleFactor}.« Die Methode steht nur auf
     `ParallaxProjection`, nicht im Interface.
   - Neu `ParallaxProjection#getScaleFactor(distanceToCamera: number): number` direkt vor
     `getParallaxFactor()`: `return this.#distanceToProjectionPlane / distanceToCamera;` — ohne
     Sonderfälle. TSDoc: »`D / distanceToCamera`, with `D` the distance at which this projection
     puts the camera from its projection plane (`distanceToProjectionPlane` of the specs, `300`
     by default): `1` on the projection plane, `2` halfway between it and the camera. `Infinity`
     at the camera itself, negative behind it. `NaN` until the first `updateViewRect()` that
     gives a view with an area, since `D` is taken from the specs there.« Dazu
     `@param distanceToCamera - How far the thing sits from the camera.`
   - `OrthographicProjection#getZoom()` (`OrthographicProjection.ts:152-155`) wird zu
     `getScaleFactor(_distanceToCamera: number): number { return 1; }`. Der Kommentar im Rumpf
     entfällt; TSDoc statt dessen: »Always `1`: an orthographic projection shows everything at
     the size it has on the projection plane, whatever its distance to the camera.«
   - `getZoom` verschwindet vollständig — kein Alias, kein `@deprecated` (harter Break nach der
     Entscheidung).

6. **Fehlendes `projectionPlane` mit Klasse, Methode und Feld** (DOC-072) — in beiden
   Projektionen gleich gebaut:
   - Neue private Methode `#requireProjectionPlane(method: 'createCamera()' | 'updateCamera()'): ProjectionPlane`,
     die `this.projectionPlane` zurückgibt oder wirft:

     ```ts
     throw new Error(
       `ParallaxProjection#${method} has no projectionPlane to aim the camera at: ` +
         'set ParallaxProjection#projectionPlane or hand one to the constructor',
     );
     ```

     (in `OrthographicProjection` mit `OrthographicProjection` an beiden Stellen). Das Muster ist
     `TileSpritesFactory#createTile()` (`src/map2d/TileSprites/TileSpritesFactory.ts:55-58`).
   - `#applyToCamera(camera, projectionPlane: ProjectionPlane)` bekommt die Ebene als zweiten
     Parameter und ruft `expectDefined` nicht mehr; der Import von `expectDefined` entfällt in
     beiden Dateien, sofern nichts anderes ihn braucht (heute nichts).
   - `createCamera()`: zuerst `const projectionPlane = this.#requireProjectionPlane('createCamera()');`,
     dann die Kamera bauen und `#applyToCamera(camera, projectionPlane)` — eine Projektion ohne
     Ebene baut keine Kamera mehr, bevor sie wirft.
   - `updateCamera(camera)`: zuerst die bestehende Typprüfung mit `TypeError` (unverändert,
     `ParallaxProjection.ts:129-131`, `OrthographicProjection.ts:124-128`), dann
     `this.#requireProjectionPlane('updateCamera()')`, dann `#applyToCamera`. Die Kamera bleibt
     bei beiden Würfen unberührt.
   - TSDoc: `updateCamera()` bekommt neben dem bestehenden `@throws {TypeError}` die Zeile
     `@throws {Error} if the projection has no {@link projectionPlane}.`; `createCamera()`
     (heute ohne TSDoc) bekommt »Builds a camera with the setup of the last
     {@link updateViewRect}, aimed at the projection plane and placed at its distance.« und
     dieselbe `@throws {Error}`-Zeile.

7. **Kamerapfad in der TSDoc von `Stage2D#camera`** (DOC-050, `Stage2D.ts:157-161`). Der Absatz
   »A projection places a camera assigned here as it places its own: every `updateProjection()`
   — and every `resize()` …« wird ersetzt durch (Umbruch nach Prettier):

   > A projection places a camera assigned here as it places its own, in every call that
   > computes the view anew: a `resize()` that brings a new container size, `updateProjection(true)`,
   > an assignment to `projection`, and `updateProjection()` or `updateFrame()` while
   > {@link needsUpdate} is set. Each gives the camera the frustum or the field of view of the
   > specs, their `near` and `far`, the direction of the projection plane and the position at its
   > `distanceToProjectionPlane`, as long as container and specs give a view with an area. The
   > assignment itself leaves the camera where it is; the next of these calls places it. A stage
   > whose camera you place yourself gets no projection.

   Belege im Code: `set camera` ruft `updateProjection(true)` nur, wenn danach keine Kamera da
   ist (`Stage2D.ts:174`); `updateProjection()` ohne Argument rechnet nur bei `needsUpdate`
   (`:228`); `set projection` ruft `updateProjection(true)` (`:141`); `updateFrame()` ruft
   `updateProjection()` (`:302`). Der Spec-Kommentar `Stage2D.spec.ts:304-305` sagt dasselbe
   (»the assignment goes through by itself, the next resize() is where the projection says no«).
   Die übrigen Absätze der TSDoc bleiben.

8. **Projektionswechsel im README** (DOC-044, `packages/twopoint5d/src/stage/README.md:575-578`).
   Der Satz »Until then its `width` and `height` are 0, and assigning another `projection` — or
   `undefined` — puts them back to 0 with the camera until the new projection gives a view.«
   wird zu:

   > Until then its `width` and `height` are 0, and assigning another `projection` — or
   > `undefined` — puts them back to 0 until the new projection gives a view. The camera the
   > previous projection created goes with them; a camera you assigned to `stage.camera` stays,
   > and the new projection places it once it gives a view.

   Beleg: `set projection` setzt nur `#cameraFromProjection` zurück (`Stage2D.ts:138-140`),
   `camera` liest `#cameraUserOverride ?? #cameraFromProjection` (`:166`).

9. **Folge aus Paket 4 — was `Canvas2DStage#dispose()` an Texturen freigibt.** Seit Paket 4 baut
   `updateTexture()` bei jedem Größenwechsel eine neue Textur und gibt die vorige frei
   (`Canvas2DStage.ts:156-167`); `dispose()` gibt Material, Platzhalter und die aktuelle Textur
   frei (`:297-300`). Drei Stellen sagen »both textures that ever sat behind it«:
   - TSDoc `Canvas2DStage.ts:256-259`: der erste Absatz wird zu »Release the three.js resources
     this stage built for itself: the sprite material, the blank texture the material starts out
     with, the texture the stage built last from the canvas — each earlier one was released when
     its successor took its place —, the {@link StageRenderer} and the {@link Stage2D} behind
     {@link stage}. The sprite leaves the scene before its material goes, so no frame reaches a
     sprite without one.« Der Satz »The stage releases the textures it built.« entfällt ersatzlos.
   - `README.md:545-547`: »releases the sprite material, both textures that ever sat behind it —
     the placeholder and the one the stage built — its `StageRenderer` …« wird zu »releases the
     sprite material, the blank texture the material starts out with and the texture the stage
     built last from the canvas — each earlier one was released when its successor took its
     place —, its `StageRenderer` …«; der Rest des Punkts bleibt.
   - `CHANGELOG.md:26`: »the stage releases the sprite material, both textures that ever sat
     behind it, and the `StageRenderer` …« wird zu »the stage releases the sprite material, the
     blank texture the material starts out with, the texture it built last from the canvas, and
     the `StageRenderer` …«; der Rest des Eintrags bleibt.
   - Der Testname `Canvas2DStage.spec.ts:227` (»disposes the material, both textures and the
     stage renderer it created itself«) bleibt: in seinem Szenario sind es genau zwei.

10. **Tests** — Specs zuerst ändern, rot sehen (der Typcheck bzw. Vitest scheitert an
    `getScaleFactor`/`getParallaxFactor`/dem Objekt/der Meldung), dann umsetzen:
    - `ParallaxProjection.spec.ts` und `OrthographicProjection.spec.ts`: jede Tuple-Erwartung von
      `getViewRect()` wird zum Objekt, z. B. `toEqual([640, 480, 1.25, 1.25])` →
      `toEqual({width: 640, height: 480, pixelRatioX: 1.25, pixelRatioY: 1.25})` und
      `[0, 0, 0, 0]` → `{width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0}`. Stellen Parallax
      `:28`, `:44`, `:77`, `:89`, `:166`, `:169`, `:177`, `:184`; Ortho `:28`, `:44`, `:74`,
      `:86`, `:149`, `:152`, `:160`, `:167`.
    - Je Projektion neu `it('getViewRect() hands out a new object on every call', …)`: zwei
      Aufrufe nach `updateViewRect(800, 600)` sind `not.toBe` einander; ein Schreiben
      `rect.width = 1` ändert den nächsten `getViewRect().width` nicht.
    - `ParallaxProjection.spec.ts:47-62` `it('getZoom')` → `it('getParallaxFactor')`, alle
      Zusicherungen wörtlich übernommen, nur der Methodenname getauscht. Daneben neu
      `it('getScaleFactor')` mit derselben Projektion (`distanceToProjectionPlane: 300`, nach
      `updateViewRect(800, 600)`): `getScaleFactor(300)` `toBe(1)`, `(150)` `toBe(2)`, `(600)`
      `toBe(0.5)`, `(0)` `toBe(Infinity)`, `(-300)` `toBe(-1)`; und eine frische Projektion ohne
      `updateViewRect()` liefert `Number.isNaN(getScaleFactor(150)) === true`.
    - `ParallaxProjection.spec.ts:203`: `getZoom(150)` → `getParallaxFactor(150)` auf beiden
      Seiten; dazu eine Zeile `expect(projection.getScaleFactor(150)).toBe(reference.projection.getScaleFactor(150));`.
    - `OrthographicProjection.spec.ts:47-59` `it('getZoom')` → `it('getScaleFactor')`, dieselben
      vier Werte (`666`, `300`, `23`, `0`) `toEqual(1)` mit `getScaleFactor`.
    - Je Projektion neu `describe('without a projection plane')` (TEST-029, erste Hälfte; DOC-072):
      eine Projektion `new ParallaxProjection(undefined, {fit: 'contain', width: 640})` bzw.
      `new OrthographicProjection(undefined, {fit: 'contain', width: 640})`, `updateViewRect(800, 600)`;
      - `createCamera()` wirft `toThrow('ParallaxProjection#createCamera() has no projectionPlane to aim the camera at: set ParallaxProjection#projectionPlane or hand one to the constructor')`
        (Ortho entsprechend);
      - `updateCamera(camera)` mit einer passenden Kamera (Parallax `PerspectiveCamera`, Ortho
        `OrthographicCamera`), deren `position` vorher auf `(1, 2, 3)` und deren `near` auf `7`
        gesetzt wurde, wirft die `updateCamera()`-Meldung wörtlich und lässt `position` und
        `near` stehen;
      - eine Kamera des falschen Typs bekommt weiterhin zuerst den `TypeError`
        (`toThrow(TypeError)`), auch ohne Ebene.
    - `Canvas2DStage.spec.ts` (TEST-029, zweite Hälfte), neben `'drives the stage renderer when
      the container size is set'` (`:90`): neu `test('a container size the stage renderer already
      carries reaches no stage again', …)` — `setContainerSize(320, 240)`, dann
      `sandbox.spy(stage.stage, 'resize')` und ein `on(stage.stage, OnStageResize, …)`-Listener
      (`OnStageResize` aus `../events.js`), dann ein zweites `setContainerSize(320, 240)`: der
      Spy ist nicht aufgerufen, der Listener nicht, und `stageRenderer.width/height` sind weiter
      `[320, 240]`.
    - `StageRenderer.spec.ts`, im `describe` der internen Render-Targets bei
      `'the internal target keeps its device-pixel size when resize() moves it'` (`:1265`): neu
      `it('a resize() to the size the renderer and its stages already carry leaves the internal target and the stages alone', …)`
      — Aufbau wie `:1265` (`sr.resize(100, 50)`, `fakeStage('s')`, `makePipelineMock()`, das
      Target im `renderTo`-Mock abgreifen), dann `vi.spyOn(rt, 'setSize')` und
      `stage.resize.mockClear()`, dann `sr.resize(100, 50)`: `setSize` und `stage.resize` sind
      nicht aufgerufen. Das ist die Zusage aus `CHANGELOG.md:452` (»leaves the render target and
      the stages that carry it alone«); `StageRenderer.ts` selbst wird nicht angefasst.
    - Der rote Lauf vor dem Fix gehört in den Report (für die beiden Tests zur gleichen Größe
      ist ein grüner erster Lauf erwartbar: sie halten bestehendes Verhalten fest — das so
      vermerken, nicht künstlich rot machen).

11. **CHANGELOG `[Unreleased]`** (`packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog`):
    - `### Added`: ein Eintrag »add `IProjection#getScaleFactor(distanceToCamera)` and both
      implementations: how many times larger something at that distance from the camera appears
      than on the projection plane — `D / distanceToCamera` for `ParallaxProjection`, with `D` its
      `distanceToProjectionPlane`, and `1` for `OrthographicProjection`. Add
      `ParallaxProjection#getParallaxFactor(distanceToCamera)`: `1 - distanceToCamera / D`, `1` at
      the camera and `0` on the projection plane — the factor a plane at that distance is carried
      along with; it is not part of `IProjection`. See the Migration Guide«. Ein zweiter
      Eintrag: »export the `ProjectionViewRect` type, what `IProjection#getViewRect()` answers«.
    - `### Changed`: »`IProjection#getViewRect()`, and with it `ParallaxProjection#getViewRect()`
      and `OrthographicProjection#getViewRect()`, answers a `ProjectionViewRect`
      `{width, height, pixelRatioX, pixelRatioY}`, a new object on every call. See the Migration
      Guide«.
    - `### Changed`, bestehender Eintrag `:227`: der Schlusssatz »A projection that has no
      projection plane refuses the call with an `Error` naming what is missing, as
      `createCamera()` does« wird zu »A projection that has no projection plane refuses the call
      with an `Error` that names the class, the method and the field to set, as `createCamera()`
      does«.
    - `### Changed`, bestehender Eintrag `:100` (Parameter von `IProjection#getZoom()` heißt
      `distanceToCamera`) **entfällt**: die Methode ist in derselben Version entfernt, der
      Eintrag spräche von etwas, das es im Release nicht gibt.
    - `### Fixed`, bestehender Eintrag `:381`: »`getViewRect()` reports `[0, 0, 0, 0]`« →
      »`getViewRect()` reports `{width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0}`«.
    - `### Removed`: »remove `IProjection#getZoom()`, `ParallaxProjection#getZoom()` and
      `OrthographicProjection#getZoom()`: the name answered two different questions.
      `getScaleFactor()` answers how large something appears, `ParallaxProjection#getParallaxFactor()`
      what the parallax value of `ParallaxProjection#getZoom()` answered. See the Migration Guide«.
    - Migration Guide, Abschnitt »A projection places the camera it updates« (`:726-756`): die
      Zeile `// → Error: expected the projection plane of this projection to be defined` (`:753`)
      wird zu `// → Error: ParallaxProjection#updateCamera() has no projectionPlane to aim the camera at: set ParallaxProjection#projectionPlane or hand one to the constructor`.
    - Migration Guide, zwei neue Abschnitte am Ende der `[Unreleased]`-Migration, nach
      »`Canvas2DStage#texture` is read-only« und vor `## [0.21.2]` (`:3475`):
      - `#### IProjection#getViewRect() answers an object` — was sich ändert (benannte Felder,
        `pixelRatioX`/`pixelRatioY` statt Position 3 und 4, frisches Objekt), dass eine eigene
        Klasse, die `IProjection` implementiert, das Objekt liefern muss; **Before** als
        schlichter `ts`-Block (`const [width, height] = projection.getViewRect();`), **After**
        als `ts check`-Block, der alles importiert, was er nennt
        (`import {ParallaxProjection} from '@spearwolf/twopoint5d';`, Projektion bauen,
        `updateViewRect(800, 600)`, `const {width, height, pixelRatioX, pixelRatioY} = projection.getViewRect();`).
      - `#### getZoom() gives way to getScaleFactor() and getParallaxFactor()` — die beiden
        Bedeutungen: wer `ParallaxProjection#getZoom(d)` rief, bekommt denselben Wert von
        `getParallaxFactor(d)`; wer `OrthographicProjection#getZoom(d)` rief, bekommt dieselbe `1`
        von `getScaleFactor(d)`; wer gegen `IProjection` programmierte, ruft `getScaleFactor(d)`
        und bekommt für beide Projektionen dieselbe Frage beantwortet; eine eigene Klasse, die
        `IProjection` implementiert, braucht `getScaleFactor()` statt `getZoom()`. **Before**
        schlichter `ts`-Block mit beiden `getZoom()`-Aufrufen, **After** `ts check`-Block mit
        `ParallaxProjection` und `OrthographicProjection` (beide aus `@spearwolf/twopoint5d`),
        `getParallaxFactor(150)` und `getScaleFactor(150)`.
    - Kein Satz über den Vorzustand außerhalb der »Before«-Blöcke des Migration Guide
      (Konventionen im Plan).

## Abgleich (Zug 0, gegen `abf84d48`)

- **API-005** — unverändert. `IProjection.ts:6` trägt das Tuple, die Implementierungen
  `ParallaxProjection.ts:111`, `OrthographicProjection.ts:106`, der einzige Aufrufer außerhalb
  der Specs ist `Stage2D.ts:243` (`const [w, h] = …`). Der Grobplan nannte Aufrufer in map2d,
  Lookbook, Browser-Tests und Doku: `git grep` findet dort keinen; Doku-Nennungen nur die TSDoc
  von `updateViewRect()` (beide Projektionen) und `CHANGELOG.md:381`.
- **API-056** — unverändert. `ParallaxProjection.ts:164` (`1 - d/D` über
  `tan(fovy/2)·(D−d)/halfHeight`, da `tan(fovy/2) = halfHeight/D`), `OrthographicProjection.ts:152`
  (konstant `1`), `IProjection.ts:9`. Aufrufer nur die beiden Specs. `CHANGELOG.md:100`
  (`[Unreleased]`) nennt die Umbenennung des Parameters.
- **DOC-072** — unverändert. `OrthographicProjection.ts:133`, `ParallaxProjection.ts:136`,
  beide `expectDefined(this.projectionPlane, 'the projection plane of this projection')`. Die
  Meldung steht zitiert im Migration Guide `CHANGELOG.md:753`.
- **DOC-050** — verschoben. Audit `Stage2D.ts:127`, heute die TSDoc von `camera` bei
  `Stage2D.ts:157-161` (Paket 2 hat `scene` zum Accessor gemacht); der Satz »every
  `updateProjection()`« steht wörtlich.
- **DOC-044** — verschoben. Audit `README.md:491`, heute `README.md:575-578`; »puts them back to
  0 with the camera« steht wörtlich.
- **TEST-029** — unverändert. Die Projektions-Specs prüfen nur den `TypeError` des falschen
  Kameratyps (`ParallaxProjection.spec.ts:159`, `OrthographicProjection.spec.ts:142`), keinen Wurf
  ohne Ebene. Für `setContainerSize()` mit der Größe, die der Renderer schon trägt
  (Frühausstieg `StageRenderer.ts:363-373`, Weg über `Canvas2DStage.ts:170-177`), gibt es keinen
  Test; `CHANGELOG.md:227` und `:452` sagen beides zu.

## Triage (Zug 0)

- **Folge aus Paket 4** (Doku von `Canvas2DStage#dispose()` zu den Texturen,
  `Canvas2DStage.ts:256-259`, `README.md:545-547`, `CHANGELOG.md:26`) — unverändert an allen drei
  Stellen. Symptom von Paket 4: wäre die Doku beim Umbau von `updateTexture()` mitgezogen worden,
  gäbe es den Eintrag nicht. Paket 4 ist committet → Nachtragspaket, hier zusammengelegt
  (Schritt 9): reine Doku in `README.md` und `CHANGELOG.md`, die Paket 5 ohnehin anfasst; ein
  eigenes Paket kostete drei Kaltstarts für drei Sätze. Den Testnamen `Canvas2DStage.spec.ts:227`
  nicht mitgezählt: im Szenario des Tests sind es genau zwei Texturen.
- **Offene Befunde** — keiner teilt die Ursache dieses Pakets, alle bleiben in der Queue:
  - `Stage2D.ts:29-41` (Klassen-TSDoc über der mergenden `interface`): Ursache ist die Stellung
    des Kommentars, nicht der Wortlaut der Kamerapfade, den DOC-050 behebt; geht an die
    Drain-Runde.
  - TEST-042: vom Abschluss als behoben zu buchen, unberührt.
  - API-063 (`→ Rückfrage`): Event-Konstanten, keine Projektion; unberührt.

## Entscheidungen in Zug 0

- `ProjectionViewRect` als Name des neuen Typs: benennt, wem die View gehört, kollidiert mit
  nichts im Repository (`git grep -w`), und `export type *` macht ihn ohne Änderung an
  `public-api.ts` benennbar.
- `getViewRect()` gibt ein frisches Objekt je Aufruf statt eines gecachten: kein Aufruf im
  Frame-Pfad (nur Resize, `needsUpdate`, `updateProjection(true)`), und das Tuple war ebenfalls
  frisch — kein Aliasing, das ein Aufrufer durch Schreiben verbiegen könnte.
- `getScaleFactor()` ohne Sonderfälle (`D / d`, also `Infinity` bei `0`, negativ hinter der
  Kamera, `NaN` vor der ersten View): die Entscheidung legt `D/d` fest, jeder Sonderfall wäre
  eine erfundene Semantik; die TSDoc nennt die Randwerte.
- `getParallaxFactor()` mit unverändertem Rumpf statt vereinfacht auf `1 - d/D`: die Werte
  bleiben Bit für Bit, was `getZoom()` lieferte, und der Migrationshinweis »denselben Wert«
  stimmt wörtlich.
- DOC-072: die Meldung nennt die öffentliche Methode (`createCamera()`/`updateCamera()`), nicht
  `#applyToCamera`; darum prüft jede öffentliche Methode selbst, und `createCamera()` prüft vor
  dem Bau der Kamera. Der `TypeError` des falschen Kameratyps bleibt der erste Wurf von
  `updateCamera()`, damit sich an seiner Reihenfolge nichts ändert.
- TEST-029, zweite Hälfte: ein Test je Oberfläche — `Canvas2DStage` (die Empfehlung nennt
  `setContainerSize()`) und `StageRenderer` (die Zusage in `CHANGELOG.md:452` nennt das
  Render-Target, das nur dort greifbar ist).
- Kein Browser-Test: keine Kamera- oder Renderwerte ändern sich.
- Modell stärkste Stufe: das Paket schneidet eine öffentliche Schnittstelle neu und schreibt
  zwei Migration-Guide-Abschnitte mit `ts check`-Blöcken in der Prosa dieses Projekts. Effort
  `medium` statt `high`: Signaturen, Semantik, Randfälle, Meldungen und alle Fundstellen stehen
  in diesem Plan; hoher Effort lüde nur zum Verbessern jenseits davon ein.

## Findings im Volltext

**API-005 · medium · packages/twopoint5d/src/stage/IProjection.ts:6** — IProjection.getViewRect() gibt ein anonymes Tuple zurück
`getViewRect(): [width, height, pixelRatioHorizontal, pixelRatioVertical]`. Tuple-Rückgaben sind
in IDEs schwer lesbar; am Aufrufort in `Stage2D` steht `const [w, h] = …`, die beiden übrigen
Werte sind unsichtbar. Re-Check: unverändert.
Empfehlung: Auf `{width, height, pixelRatioX, pixelRatioY}` umstellen. Breaking Change, aber ein
kleiner — Projection-Implementierungen sind praktisch intern.

**API-056 · low · packages/twopoint5d/src/stage/ParallaxProjection.ts:164** — getZoom() beantwortet unter einem Namen zwei verschiedene Fragen
Beide Implementierungen von `IProjection#getZoom()` liefern Unvergleichbares: die parallaktische
rechnet `1 - d/D` — 1 an der Kamera, 0 auf der Projektionsebene, negativ dahinter —, die
orthografische gibt konstant `1` mit der Begründung, der Zoomfaktor sei bei orthografischer Sicht
immer derselbe. Wer gegen das Interface programmiert, bekommt von der einen einen Parallax-Faktor
und von der anderen einen Skalierungsfaktor. Außerhalb der beiden Specs ruft die Methode im
Repository niemand. Aufgefallen im Remediation-Lauf vom 2026-09-20, dort bewusst nicht behoben:
der Fix ändert entweder den Rückgabewert einer veröffentlichten Interface-Methode oder schneidet
`IProjection` neu — die Entscheidung gehört vor einen Lauf, nicht in einen.
Empfehlung: Erst entscheiden, was `getZoom()` auf dem Interface bedeuten soll: entweder eine
Semantik für beide (und die orthografische Implementierung zieht nach), oder zwei getrennt
benannte Methoden. Danach TSDoc an `IProjection`, die die gewählte Bedeutung festschreibt.
(Entschieden 2026-09-29, siehe »Entscheidungen« im Plan: `IProjection#getScaleFactor()` und
`ParallaxProjection#getParallaxFactor()`.)

**DOC-072 · info · packages/twopoint5d/src/stage/OrthographicProjection.ts:133** (auch `ParallaxProjection.ts:136`) — Ein fehlendes projectionPlane meldet sich ohne Klasse und Methode
Aufgefallen im Remediation-Lauf vom 2026-09-26. `expectDefined(this.projectionPlane, …)` meldet
`expected the projection plane of this projection to be defined`: die Meldung nennt weder Klasse
noch Methode, und `projectionPlane` ist ein optionales öffentliches Feld des Aufrufers, keine
Invariante, für die `expectDefined()` laut TSDoc gedacht ist. `TileSpritesFactory#createTile()`
löst dasselbe Muster mit einem `Error`, der Methode, Feld und Wert nennt.
Empfehlung: Einen `Error` werfen, der Klasse, Methode und das zu setzende Feld nennt, wie
`TileSpritesFactory#createTile()`; die Meldung im Test festhalten.

**DOC-050 · info · packages/twopoint5d/src/stage/Stage2D.ts:127** (heute `:157-161`) — Die TSDoc des camera-Setters fasst »every updateProjection()« zu weit
Ohne Argument tut der Aufruf nur etwas, wenn `needsUpdate` gesetzt ist (`Stage2D.ts:186`, heute
`:228`). Für einen Konsumenten, der die Kamera zuweist, ist der Satz in der Sache richtig, im
Wortlaut aber zu weit.
Empfehlung: Den Satz auf den Fall einschränken, in dem die Projektion tatsächlich neu rechnet.

**DOC-044 · low · packages/twopoint5d/src/stage/README.md:491** (heute `:575-578`) — Im Stage-README nicht behaupten, ein Projektionswechsel nehme die Nutzerkamera mit
»puts them back to 0 with the camera«: bei einer vom Nutzer gesetzten Kamera bleibt die Kamera,
nur `width`/`height` gehen auf 0. Die TSDoc von `width` ist genau, das README nicht. Aufgefallen
im Remediation-Lauf vom 2026-09-19.
Empfehlung: »with the camera« streichen oder »with the projection camera« schreiben.

**TEST-029 · info · packages/twopoint5d/src/stage/ParallaxProjection.ts:136** — Zwei zugesagte Verhaltensweisen der Stage-Kamerapfade haben keinen Test
Der Wurf von `updateCamera()` auf einer Projektion ohne Projektionsebene und der Frühausstieg von
`setContainerSize()` bei unveränderter Größe stehen beide im CHANGELOG, aber in keiner Spec.
Empfehlung: Je einen Test ergänzen: eine Projektion ohne Plane, und ein `setContainerSize()` mit
der Größe, die der Renderer schon trägt.

**Folge aus Paket 4 · info** — `packages/twopoint5d/src/stage/Canvas2DStage.ts:255-256`,
`packages/twopoint5d/src/stage/README.md:545`, `packages/twopoint5d/CHANGELOG.md:26`
TSDoc von `Canvas2DStage#dispose()`, README und CHANGELOG sagen, `dispose()` gebe »both textures
that ever sat behind it« frei und hängen »The stage releases the textures it built.« an — doppelt
und ungenau: seit Paket 4 sitzen nach Größenwechseln beliebig viele Texturen nacheinander hinter
dem Material, die früheren gibt `updateTexture()` frei; `dispose()` gibt Material, Platzhalter
und die aktuelle Textur frei (Symptom von Paket 4, reine Doku).

## Verlauf

- 2026-09-29 Zug 0: Detailplan steht · API-005 unverändert (`IProjection.ts:6`, einziger
  Aufrufer `Stage2D.ts:243`, keine in map2d/Lookbook/Browser-Tests/Doku) · API-056 unverändert
  (`ParallaxProjection.ts:164`, `OrthographicProjection.ts:152`) · DOC-072 unverändert
  (`OrthographicProjection.ts:133`, `ParallaxProjection.ts:136`) · DOC-050 nach
  `Stage2D.ts:157-161` gewandert · DOC-044 nach `README.md:575-578` gewandert · TEST-029
  unverändert · Folge aus Paket 4 als Nachtragspaket hier zusammengelegt (Schritt 9) · offene
  Befunde: keiner übernommen
- 2026-09-29 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-5.impl-0.json`
- 2026-09-29 Zug 2: Report FERTIG (session `747f85bf-ffa1-481f-9c07-88f9f2efcd85`) · 11 Dateien geändert (`IProjection.ts`, `ParallaxProjection.ts`/`.spec.ts`, `OrthographicProjection.ts`/`.spec.ts`, `Stage2D.ts`, `Canvas2DStage.ts`/`.spec.ts`, `StageRenderer.spec.ts`, `README.md`, `CHANGELOG.md`) · roter Lauf belegt (30 Tests rot vor der Umsetzung) · Arbeitsbaum schmutzig
- 2026-09-29 Zug 2: Verify `pnpm run ci` exit=0 (`paket-5.verify.log`)
- 2026-09-29 Zug 3: Reviewer (opus, effort medium) · alle sieben Punkte behoben, keine kritischen oder wichtigen Befunde, zwei kleine · Diff `paket-5.diff`, Report `paket-5.review-0.json`
- 2026-09-29 Zug 4: keine Runde nötig (nur kleine Befunde)
- 2026-09-29 Zug 5: Commit `fa412714` auf `main`, getragen vom Verify-Lauf aus Zug 2 (`paket-5.verify.log`, exit=0, keine Codeänderung seither) · Trailer `Remediation-Run: 2026-09-29`

## Urteil des Reviewers

- API-005 — behoben: `IProjection.ts:2-12` (Typ `ProjectionViewRect`), `:15-20` (Signatur), Implementierungen in `ParallaxProjection.ts` und `OrthographicProjection.ts` mit frischem Objekt je Aufruf, Aufrufer `Stage2D.ts:246`, Tests »hands out a new object« in beiden Specs
- API-056 — behoben: `IProjection#getScaleFactor` mit TSDoc, `ParallaxProjection#getScaleFactor` (`D / d`) und `#getParallaxFactor`, `OrthographicProjection#getScaleFactor` (`1`); `getZoom` außerhalb von Removed-Eintrag und Migration Guide nicht mehr im Repo
- DOC-072 — behoben: `#requireProjectionPlane` in beiden Projektionen, `createCamera()` prüft vor dem Bau, `updateCamera()` wirft zuerst den `TypeError`; Specs `without a projection plane`, Migration Guide in `CHANGELOG.md`
- DOC-050 — behoben: `Stage2D.ts:157-164`, gegen den Code geprüft (`set projection` → `updateProjection(true)`, `set camera` nur ohne Kamera, `updateFrame()` nur bei `needsUpdate`)
- DOC-044 — behoben: `README.md:578-580`
- TEST-029 — behoben: beide Projektions-Specs, `Canvas2DStage.spec.ts:~92`, `StageRenderer.spec.ts:1285`
- Folge aus Paket 4 (Texturen in der Doku von `Canvas2DStage#dispose()`) — behoben: `Canvas2DStage.ts:249-253`, `README.md:545-547`, `CHANGELOG.md:26`

Kleine Befunde (lösen keine Runde aus):
- `ParallaxProjection.ts:70`, `OrthographicProjection.ts:68` — TSDoc-Zeile von `updateViewRect()` mit `{width: 0, …}` rund 132 Zeichen, nicht neu umbrochen
- `README.md:547` — Zeile mit dem Texturen-Satz rund 140 Zeichen, nicht neu umbrochen

Anmerkung des Implementierers: Removed-Eintrag und Prosa der Migrationsabschnitte nennen den Vorzustand, wie der Detailplan es verlangt; der Reviewer hält das dort für richtig platziert.

Nebenbefunde (Urteile): `IProjection.ts` ohne TSDoc an vier Membern und `Stage2D.ts:309` tote `null`-Prüfung — beide vorbestehend (Stand `5ff01ea2`), unter `src/stage/**`, info → Scope. `Stage2D.ts:29-41` stand schon in der Queue. `Canvas2DStage.ts:6` (Import aus `texture/internals.js`) ist nicht vorbestehend, sondern von Paket 4 eingeführt → als Folge unter Paket 5 im Plan, für Zug 0 von Paket 6.
