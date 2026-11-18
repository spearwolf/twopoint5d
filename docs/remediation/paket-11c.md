# Paket 11c — Orthographic- und ParallaxProjection teilen ihren Code

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: READ-005 (low)
- Ziel: Beide Projektionen teilen Kamera-Defaults, die Berechnung des View-Rect, `getViewRect()`, die Pflichtprüfung der Projektionsebene und die Typprüfung der Kamera über ein internes Hilfsmodul, bei unveränderter öffentlicher API und unverändertem Verhalten.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/stage/planeProjection.ts` (neu), `packages/twopoint5d/src/stage/OrthographicProjection.ts`, `packages/twopoint5d/src/stage/ParallaxProjection.ts`, `packages/twopoint5d/docs/architecture.md` (ein Satz). Nicht anfassen: `wholeUnitOffset.ts`, `fitIntoRectangle.ts`, `IProjection.ts`, `public-api.ts`, jede Spec, `CHANGELOG.md`.
- Vorgehen: siehe Abschnitt »Vorgehen« unten
- Verify (aus dem Repo-Root, in bash; `ARBEITSDIR=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/25b68af0-a25d-4ede-b583-3d06a691b428/scratchpad`):
  ```bash
  pnpm run ci \
    && diff <(grep -v '^import ' "$ARBEITSDIR/paket-11c.base.OrthographicProjection.d.ts") <(grep -v '^import ' packages/twopoint5d/dist/lib/stage/OrthographicProjection.d.ts) \
    && diff <(grep -v '^import ' "$ARBEITSDIR/paket-11c.base.ParallaxProjection.d.ts") <(grep -v '^import ' packages/twopoint5d/dist/lib/stage/ParallaxProjection.d.ts) \
    && git diff --quiet -- 'packages/twopoint5d/src/**/*.spec.ts' packages/twopoint5d/CHANGELOG.md
  ```
  Die beiden `paket-11c.base.*.d.ts` hat Zug 0 aus `packages/twopoint5d/dist/lib/stage/` gesichert (gebaut 2026-11-18 16:18 vom Gate von Paket 12; beide Quellen seit ab9147be 12:35 unberührt). Erwartet: außer `import`-Zeilen byte-gleich, kein Spec und kein CHANGELOG geändert.
- Commit: `refactor(twopoint5d): let OrthographicProjection and ParallaxProjection fit their view, take the near and the far of their camera and check their plane and their camera through one internal module`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · READ-005 unverändert, verschoben um +20/+21 Zeilen (Paket 7 ab9147be, TSDoc): `updateViewRect()` `OrthographicProjection.ts:130` / `ParallaxProjection.ts:138` (Audit `:110`/`:117`), `getViewRect()` `:175`/`:183` (Audit `:155`/`:162`), Typprüfung `updateCamera()` `:207`/`:217`, `#requireProjectionPlane()` `:217`/`:227` (Audit `:197`/`:206`), `DEFAULT_NEAR`/`DEFAULT_FAR` je `:14–15` · offene Folgen: keine (11 → Paket 12 dcf9512c erledigt, 11b → in Zug 0 von 12 als kein Befund eingeordnet, alle übrigen `Folgen: keine`) · »Offene Befunde«: kein Eintrag gleicher Ursache · Basis-d.ts nach `$ARBEITSDIR/paket-11c.base.{Orthographic,Parallax}Projection.d.ts` gesichert
  - 2026-11-18 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort low, Report nach `paket-11c.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG (nur Schlusssatz im `result`, Nebenbefunde/Folgen nicht übermittelt) · neu `stage/planeProjection.ts`, geändert `OrthographicProjection.ts`, `ParallaxProjection.ts`, `docs/architecture.md` · Baum schmutzig · Verify exit=0 (`paket-11c.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (sonnet, medium) FREIGABE, keine kritischen/wichtigen Befunde · Diff `paket-11c.diff` · Report `paket-11c.review-0.json`
  - 2026-11-18 Zug 4: entfällt, keine Runde
  - 2026-11-18 Zug 5: Commit 2867d92f, Verify aus Zug 2 (exit=0, keine Änderung seither)

## Urteil des Reviewers

- READ-005: behoben — `planeProjection.ts`: `PlaneProjectionView.fit()`, `getViewRect()`, `takeNearAndFar()`, `requireProjectionPlane()`, `assertCameraKind()`; je Klasse bleiben nur `near`-Prüfung, Default-Distanz, `pixelSnap`-Anwendung, `fovy`. Meldungen wortgleich, Reihenfolge Typ vor Ebene gewahrt.
- klein: Kommentar vor `#near`/`#far` in `planeProjection.ts` ~130 Zeichen, auf zwei Zeilen umbrechen.
- klein: Absatz im Abschnitt `stage/` von `docs/architecture.md` nicht neu umbrochen, wie der Detailplan verlangte.
- klein: Zeilenkommentar zu den Kamerawerten steht vor dem TSDoc von `DEFAULT_NEAR`, leicht ungeordnet.

## Entscheidungen aus Zug 0

- **Hilfsmodul statt Basisklasse** (Empfehlung des Audits nennt beides): `stage/public-api.ts` re-exportiert beide Dateien mit `export *`; eine gemeinsame Basisklasse stünde in der öffentlichen Klassenhierarchie und im `.d.ts` (`extends …`). Das Modul `planeProjection.ts` steht nicht in `public-api.ts` und taucht in keinem `.d.ts` der beiden Klassen auf (`#private`).
- **Name `planeProjection`**: es sind die beiden Projektionen mit `ProjectionPlane`; `CameraProjection` hat keine und bleibt draußen (eigene Meldungen, eigene Kameratypen, kein `fitIntoRectangle`). Dateiname in lowerCamel wie `directorSlots.ts` und `cameraRigState.ts`, weil das Modul eine Klasse neben Funktionen und einer Konstante hält.
- **Near und Far liegen in der View-Klasse, die Prüfung von `near` bleibt je Klasse.** Der Hinweis aus Zug 0 von Paket 11 im Plan legt fest, was je Klasse bleibt: die Prüfung von `near` (`isFiniteNumber` gegen `isPositiveFinite`) und `distanceToProjectionPlane` samt Default (100 gegen 300). Gemeinsam und wortgleich sind nur `DEFAULT_NEAR`, `DEFAULT_FAR` und die Regel »`far` keine endliche Zahl → `DEFAULT_FAR`; `far` nicht über `near` → beide auf ihre Defaults«. Die Klasse übergibt deshalb das `near`, das sie genommen hat, und `takeNearAndFar()` wendet die Far-Regel an. Ein Tupel als Rückgabe (`[near, far]`) wäre die Alternative; verworfen, weil es je `updateViewRect()` ein Array mehr anlegt und die Felder trotzdem irgendwo stehen müssen.
- **`wholeUnitOffset.ts` bleibt eigenes Modul**, unverändert. Sein TSDoc nennt beide Projektionen und stimmt weiter; Importeur ist danach nur `planeProjection.ts`. Zusammenlegen wäre Churn ohne Gewinn.
- **Kein neuer Spec.** Jeder Zweig des Moduls läuft durch die bestehenden Specs beider Klassen (`OrthographicProjection.spec.ts` 408, `ParallaxProjection.spec.ts` 470 Zeilen): Container ohne Fläche (`keeps its view while the container has no area`, `has no view before a container with area`), `pixelSnap` an/aus (`describe('pixelSnap')`), Near/Far samt Rücksprung (`describe('camera values from the specs')`, `takes a near of $near and a far of $far as 0.1 and 100000`), Kameratyp mit wortgleicher Meldung (`names a refused camera %s as it is: got %s`), fehlende Ebene mit wortgleicher Meldung und Reihenfolge Typ vor Ebene (`describe('without a projection plane')`), `getViewRect() hands out a new object on every call`. Ein geänderter Spec wäre ein Zeichen für geändertes Verhalten; der Verify prüft, dass keiner geändert ist.
- **Kein CHANGELOG**: keine öffentliche Änderung (wie 11 und 11b). **Ein Satz in `docs/architecture.md`**: 10, 11 und 11b nennen ihre neuen internen Klassen dort; dieselbe Machart.

## Vorgehen

### 1. Neues Modul `packages/twopoint5d/src/stage/planeProjection.ts`

Kopfkommentar (Zeilenkommentar, Stil von `StageRendererHostLink.ts`), sinngemäß: was `OrthographicProjection` und `ParallaxProjection` gleich tun — die View in den Container einpassen, Near und Far ihrer Kamera nehmen, eine fehlende Ebene und eine Kamera der falschen Art ablehnen —; dieses Modul steht nicht in `public-api.ts`, nur die beiden Projektionen erreichen es. Jedes Export trägt `@internal` (wie in `DirectorMasks.ts`, `Stage2DCamera.ts`).

Imports: `import type {Camera, OrthographicCamera, PerspectiveCamera} from 'three/webgpu';`, `import {Vector2} from 'three/webgpu';`, `describeThreeValue` (`../utils/describeThreeValue.js`), `isFiniteNumber` (`../utils/isFiniteNumber.js`), `isPositiveFinite` (`../utils/isPositiveFinite.js`), `import type {ProjectionViewRect} from './IProjection.js';`, `import type {ProjectionPlane} from './ProjectionPlane.js';`, `fitIntoRectangle` und `type ProjectionFitSpecs` (`./fitIntoRectangle.js`), `wholeUnitOffset` (`./wholeUnitOffset.js`).

Inhalt, in dieser Reihenfolge (Konstanten vor der Klasse, die sie liest):

a) Konstanten, mit dem bisherigen Kommentar `// the camera values for specs that leave one out or give one no camera can be built from`:
   - `export const DEFAULT_NEAR = 0.1;` (`/** @internal */`)
   - `const DEFAULT_FAR = 100000;` (nicht exportiert, nur `takeNearAndFar()` liest es)

b) `/** The classes this module serves, as the subject of their messages. @internal */ export type PlaneProjectionSubject = 'OrthographicProjection' | 'ParallaxProjection';`

c) Die Kameraarten, an einer Stelle mit ihrem Wort für die Meldung verbunden:
   ```ts
   type CameraKinds = {isOrthographicCamera: OrthographicCamera; isPerspectiveCamera: PerspectiveCamera};
   const CAMERA_NAMES: Readonly<Record<keyof CameraKinds, string>> = {
     isOrthographicCamera: 'an OrthographicCamera',
     isPerspectiveCamera: 'a PerspectiveCamera',
   };
   ```

d) `export function assertCameraKind<K extends keyof CameraKinds>(subject: PlaneProjectionSubject, camera: Camera, kind: K): asserts camera is CameraKinds[K]` — wirft, wenn `(camera as Partial<Record<K, unknown>> | null | undefined)?.[kind] !== true`:
   `` new TypeError(`${subject}: updateCamera() needs ${CAMERA_NAMES[kind]}, got ${describeThreeValue(camera, 'isObject3D')}`) ``.
   Der optionale Zugriff `?.` bleibt: die Specs reichen `undefined`, `{}`, `'cam'` herein. Meldung damit wortgleich zu heute (`OrthographicProjection: updateCamera() needs an OrthographicCamera, got …`, `ParallaxProjection: updateCamera() needs a PerspectiveCamera, got …`). TSDoc ein Satz.

e) `export function requireProjectionPlane(subject: PlaneProjectionSubject, method: 'createCamera()' | 'updateCamera()', projectionPlane: ProjectionPlane | undefined): ProjectionPlane` — wirft bei `projectionPlane == null`:
   `` new Error(`${subject}#${method} has no projectionPlane to aim the camera at: ` + `set ${subject}#projectionPlane or hand one to the constructor`) ``, sonst gibt es die Ebene zurück. Wortgleich zu heute. `subject` und `method` sind Namen von Exporten und Methoden der Library, also Text der Meldung, kein `describeValue()` (AGENTS.md, »Error and warning messages«).

f) `export class PlaneProjectionView` (`/** … @internal */`, ein Satz: die View, die das letzte `fit()` mit Fläche ergab, mit Pixel Ratio, Versatz unter `pixelSnap` und Near/Far der Kamera):
   - Felder: `#viewRect = new Vector2();`, `#pixelRatio = new Vector2();`, `#offset = new Vector2();`, `#pixelSnap = false;`, dann mit Kommentar `// assigned by the first fit() that gives a view with an area, through takeNearAndFar(); a camera built before that carries none` die Felder `#near!: number;` und `#far!: number;` — **nicht** mit einer Zahl vorbelegen: eine Kamera vor der ersten View bekommt heute `undefined`, und das bleibt so.
   - Getter, je mit einzeiligem TSDoc: `width` und `height` (aus `#viewRect`, `0` bis zum ersten `fit()` mit Fläche), `offsetX` und `offsetY` (aus `#offset`; wie weit die Mitte der View rechts von bzw. über dem Punkt liegt, auf den die Kamera blickt; `0` ohne `pixelSnap`), `pixelSnap`, `near`, `far`.
   - `fit(width: number, height: number, pixelRatio: number, specs: Partial<ProjectionFitSpecs>): boolean` — der Kopf von `updateViewRect()` beider Klassen, Schritt für Schritt wie heute, mit den bisherigen Kommentaren:
     1. `if (!isPositiveFinite(width) || !isPositiveFinite(height)) return false;` (Kommentar »a container without area has no aspect ratio …« hierher, auf `false` angepasst: die Projektion behält dann View, Pixel Ratio und Kamerawerte)
     2. `const viewRect = fitIntoRectangle(new Vector2(width, height), specs, this.#viewRect.clone(), pixelRatio);` (Kommentar »specs that match no shape leave the target as it is …« mit)
     3. `if (!isPositiveFinite(viewRect.width) || !isPositiveFinite(viewRect.height)) return false;`
     4. `this.#viewRect.copy(viewRect);`
     5. `this.#pixelSnap = 'pixelSnap' in specs && specs.pixelSnap === true;` dann `#offset` auf `wholeUnitOffset(width der View)`, `wholeUnitOffset(height der View)` unter `pixelSnap`, sonst `(0, 0)`
     6. `this.#pixelRatio.set(width, height).divide(this.#viewRect);`
     7. `return true;`
     TSDoc: antwortet, ob die Specs eine View mit Fläche ergaben; bei `false` bleibt alles, wie es war. Nimmt der Typ `Partial<ProjectionFitSpecs>` das `viewSpecs` einer Klasse nicht an, dann den Parametertyp von `fitIntoRectangle()` (`Partial<FitIntoRectangleSpecs>`) — **kein Cast**.
   - `takeNearAndFar(near: number, far: number | undefined): void` — `#near = near; #far = isFiniteNumber(far) ? far : DEFAULT_FAR; if (#far <= #near) { #near = DEFAULT_NEAR; #far = DEFAULT_FAR; }`. TSDoc: `near` so, wie die Projektion es aus ihren Specs genommen hat; ein `far`, das keine endliche Zahl ist, zählt als nicht gegeben, und ein `far` nicht über `near` schickt beide auf ihre Defaults.
   - `getViewRect(): ProjectionViewRect` — gibt wie heute ein **neues** Objekt `{width, height, pixelRatioX, pixelRatioY, offsetX, offsetY}` aus `#viewRect`, `#pixelRatio`, `#offset` zurück.

### 2. `OrthographicProjection.ts`

- Konstanten: `DEFAULT_NEAR`/`DEFAULT_FAR` entfallen; `const DEFAULT_DISTANCE_TO_PROJECTION_PLANE = 100;` bleibt, Kommentar darüber: `// the distance of the camera for specs that leave it out or give one no camera can be placed at`.
- Felder: `#viewRect`, `#pixelRatio`, `#offset`, `#near`, `#far` entfallen; neu `readonly #view = new PlaneProjectionView();`. `#left`, `#right`, `#top`, `#bottom`, `#distanceToProjectionPlane` bleiben samt dem Kommentar »The fields below are assigned by the first `updateViewRect()` …«.
- `updateViewRect()` (TSDoc unverändert):
  1. `if (!this.#view.fit(width, height, pixelRatio, this.viewSpecs)) return;`
  2. Frustum wie heute aus `const {width: viewWidth, height: viewHeight} = this.#view;`, der Zweig liest `this.#view.pixelSnap` statt der eigenen `'pixelSnap' in …`-Prüfung; `#offset.set(…)` entfällt hier (macht `fit()`). Kommentar »under pixelSnap the left and the bottom edge lie on a whole unit …« bleibt.
  3. Near/Far: `const {near, far, distanceToProjectionPlane} = this.viewSpecs;` dann `this.#view.takeNearAndFar(isFiniteNumber(near) ? near : DEFAULT_NEAR, far);` — Kommentar »an orthographic camera divides by the depth from near to far; its near and the distance may be 0 or below …« bleibt davor.
  4. `#distanceToProjectionPlane` wie heute.
- `getViewRect()`: `return this.#view.getViewRect();` (kein TSDoc, wie heute).
- `createCamera()`: `const projectionPlane = requireProjectionPlane('OrthographicProjection', 'createCamera()', this.projectionPlane);`.
- `updateCamera()`: erst `assertCameraKind('OrthographicProjection', camera, 'isOrthographicCamera');`, dann `requireProjectionPlane('OrthographicProjection', 'updateCamera()', this.projectionPlane)`, dann `this.#applyToCamera(camera, projectionPlane)` ohne Cast. Reihenfolge Typ vor Ebene bleibt (Spec `refuses a camera that is no OrthographicCamera with a TypeError first`).
- `#requireProjectionPlane()` entfällt.
- `#applyToCamera()`: `camera.near = this.#view.near; camera.far = this.#view.far;`, sonst unverändert.
- Imports danach: `import type {Box3, Camera} from 'three/webgpu';`, `import {OrthographicCamera} from 'three/webgpu';`, `isFiniteNumber`, `type IProjection, ProjectionViewRect`, `ProjectionPlane, type ProjectionPlaneDescription`, `import type {ProjectionFitSpecs} from './fitIntoRectangle.js';`, `type FramingOptions, framingSetup`, `{assertCameraKind, DEFAULT_NEAR, PlaneProjectionView, requireProjectionPlane}` aus `./planeProjection.js`. Entfallen: `Vector2`, `describeThreeValue`, `isPositiveFinite`, `fitIntoRectangle` (Wert), `wholeUnitOffset`. Reihenfolge so, wie Biome sie sortiert.

### 3. `ParallaxProjection.ts`

- Konstanten wie in Schritt 2, `DEFAULT_DISTANCE_TO_PROJECTION_PLANE = 300` bleibt mit demselben Kommentar.
- Felder: `#viewRect`, `#pixelRatio`, `#offset`, `#pixelSnap`, `#near`, `#far` entfallen; neu `readonly #view = new PlaneProjectionView();`. `#offsetCameras` samt Kommentar bleibt, ebenso `#halfHeight`, `#distanceToProjectionPlane`, `#aspect`, `#fovy` unter dem Kommentar »The fields below are assigned …«.
- `updateViewRect()` (TSDoc unverändert):
  1. `if (!this.#view.fit(width, height, pixelRatio, this.viewSpecs)) return;`
  2. `this.#halfHeight = this.#view.height / 2;`
  3. Near/Far: Kommentar »a perspective camera divides by its near …« bleibt; `this.#view.takeNearAndFar(isPositiveFinite(near) ? near : DEFAULT_NEAR, far);`
  4. `#distanceToProjectionPlane` wie heute (`isPositiveFinite`, Default 300), dann `this.#aspect = this.#view.width / this.#view.height;` und `#fovy` wie heute.
- `getViewRect()`, `createCamera()`, `updateCamera()` wie in Schritt 2, mit `'ParallaxProjection'` und `'isPerspectiveCamera'`.
- `#requireProjectionPlane()` entfällt.
- `#applyToCamera()`: `camera.near = this.#view.near; camera.far = this.#view.far;`; der `pixelSnap`-Zweig liest `this.#view.pixelSnap`, `this.#view.width`/`height` und `this.#view.offsetX`/`offsetY` und ruft `camera.setViewOffset(width, height, offsetX, -offsetY, width, height)` wie heute; Kommentar zum Versatz bleibt. Der `else if (this.#offsetCameras.delete(camera))`-Zweig unverändert.
- Imports danach: `Box3`, `Camera` als Typ, `PerspectiveCamera` als Wert, `isPositiveFinite`, `IProjection`/`ProjectionViewRect`, `ProjectionPlane`/`ProjectionPlaneDescription`, `import type {ProjectionFitSpecs}`, `FramingOptions`/`framingSetup`, `{assertCameraKind, DEFAULT_NEAR, PlaneProjectionView, requireProjectionPlane}`. Entfallen: `Vector2`, `describeThreeValue`, `isFiniteNumber`, `fitIntoRectangle` (Wert), `wholeUnitOffset`.

### 4. `packages/twopoint5d/docs/architecture.md`, Abschnitt `### \`stage/\``

Im ersten Absatz nach dem Satz, der mit »… its plane in the face of the box (`framing.ts`).« endet, einfügen:
»The two fit their view, take the near and the far plane of their camera and refuse a missing plane or a camera of the other kind through the internal `PlaneProjectionView` and the checks beside it in `src/stage/planeProjection.ts`.«
Den Absatz danach neu umbrechen, Breite wie der umgebende Text.

### Was gleich bleiben muss

- Öffentliches TSDoc beider Klassen und ihrer Specs-Typen: kein Wort geändert. Der Verify hält die `.d.ts` außer den `import`-Zeilen gegen die gesicherte Basis; erwartet ist allein `import { type ProjectionFitSpecs } from './fitIntoRectangle.js';` → `import type { ProjectionFitSpecs } from './fitIntoRectangle.js';`.
- Keine Allokation mehr als heute in `createCamera()`, `updateCamera()`, `#applyToCamera()` (Getter lesen, kein Hilfsobjekt). `updateViewRect()` legt wie heute genau die beiden `Vector2` in `fit()` an; `getViewRect()` antwortet wie heute ein neues Objekt. Die Allocation-Specs (`hot-path-allocations.camera-rig.spec.ts`, `.post-process.spec.ts`) laufen im Gate.
- Meldungen wortgleich; kein Spec ändert sich.
- Konventionen des Plans: keine Finding-ID, kein Rückblick in Kommentaren (»moved from«, »formerly«, »shared now«); ECMAScript-`#private`; `.js`-Suffix; `import type` für Typen.

## Findings im Volltext

**READ-005 · low · packages/twopoint5d/src/stage/OrthographicProjection.ts:110** (weitere: `ParallaxProjection.ts:117`, `OrthographicProjection.ts:155`, `ParallaxProjection.ts:162`, `OrthographicProjection.ts:197`, `ParallaxProjection.ts:206`; Stand Audit 2e3f585b) — Gemeinsamen Code von OrthographicProjection und ParallaxProjection zusammenführen

Beide Projektionen kopieren dieselben Konstanten (`DEFAULT_NEAR`, `DEFAULT_FAR`), den Kopf von `updateViewRect()` (Container-Prüfung, `fitIntoRectangle`, View-Rect-Übernahme, `#pixelRatio`), `getViewRect()`, `#requireProjectionPlane()` und den Typ-Check in `updateCamera()`. Die Unterschiede (pixelSnap per Frustum vs. `setViewOffset`, near-Validierung, fovy) sind klein. Jede Korrektur muss zweimal gemacht werden.

Empfehlung: Eine kleine Basisklasse oder ein internes Hilfsmodul (View-Rect-Berechnung, Kamera-Defaults, Plane-Pflichtprüfung) für beide Projektionen.

Aufwand laut Audit: M · Komponente: stage
