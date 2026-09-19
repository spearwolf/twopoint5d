# Paket 12 — stage: Projektionen und fitIntoRectangle weisen eine Fläche ohne Ausdehnung und pixelZoom 0 ab

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (zwei Nebenbefunde aus der Queue, Drain-Runde 1; kein Audit-Finding)
- Ziel: Projektionen und `fitIntoRectangle` liefern für eine View ohne Höhe oder Breite und für `pixelZoom: 0` keine `NaN`- oder `Infinity`-Werte.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - neu: `packages/twopoint5d/src/utils/isPositiveFinite.ts` (intern, **nicht** in `utils/public-api.ts`)
  - `packages/twopoint5d/src/stage/fitIntoRectangle.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts`
  - `packages/twopoint5d/src/stage/Stage2D.ts`
  - `packages/twopoint5d/src/stage/fitIntoRectangle.spec.ts`, `OrthographicProjection.spec.ts`, `ParallaxProjection.spec.ts`, `Stage2D.spec.ts`
  - `packages/twopoint5d/src/stage/README.md` (ein Satz unter »Common pitfalls«)
  - `packages/twopoint5d/CHANGELOG.md` (`Unreleased`)
- Verify: `pnpm run ci`
- Commit: `fix(stage): let fitIntoRectangle use only spec numbers that are finite and above 0, let a projection keep its view while the container or its specs give none, build no camera from a projection without a view and let a composing renderer draw nothing while a Stage2D it composes has no camera` (in Zug 5 um den Composed-Guard aus Runde 1 ergänzt)
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · Nebenbefund Projektionen unverändert (`OrthographicProjection.ts:42-54`, `ParallaxProjection.ts:44-59`), in Node gegen `dist` nachgestellt: `updateViewRect(0, 600)` → `getViewRect()` `[0, 600, NaN, 1]`, Parallax-Kamera `aspect` 0 · Nebenbefund `pixelZoom: 0` unverändert (`fitIntoRectangle.ts:194-200`), nachgestellt: `[Infinity, Infinity]` · beide vorbestehend seit `e352b56` (`git show e352b56:…`) · mitgenommen, gleiche Ursache: Clamps und Seiten derselben Rechnung (`fitIntoRectangle.ts:217-218`, `:244-248`) sowie die Kamera, die `Stage2D` aus einer Projektion ohne View baut (`Stage2D.ts:163-178`) · offene Folgen im Plan: keine · ein neuer Nebenbefund in die Queue (`ParallaxProjection.ts:54`, `:58`, `distanceToProjectionPlane`) · Restplan unverändert
  - 2026-09-19 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief `paket-12.impl-1.brief.txt`, Report nach `paket-12.impl-1.json`
  - 2026-09-19 Zug 2: FERTIG_MIT_VORBEHALT · 1 neue Datei (`utils/isPositiveFinite.ts`), 10 geänderte (`stage/` vier Quellen, vier Specs, `README.md`, `CHANGELOG.md` samt Migration-Guide-Satz) · roter Lauf 30 rot (`paket-12.red.log`) · `pnpm run ci` Exit 0 laut Report · gemeldete Folgen: `StageRenderer.ts:507-508` (Composed-Pfad wirft für eine Stage ohne Kamera), `Stage2D.ts:87-90`/`:161-165` (Größe nach Projektionswechsel) · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer beauftragt (sonnet, effort medium), Diff `paket-12.diff`
  - 2026-09-19 Zug 3: Review 1 (`paket-12.review-1.json`): alle vier Befunde behoben · 0 kritisch, 1 wichtig (`StageRenderer.ts:508`, Composed-Pfad wirft für eine Stage2D ohne Kamera), 5 klein · offen: 1
  - 2026-09-19 Zug 4 Runde 1: offen 1 wichtig · an denselben Implementierer (sonnet, medium, `--resume`), Weg vorgegeben: 0×0-Guard in `#renderPipelineComposed` um »eine Stage2D ohne Kamera« erweitern, dazu 3 der kleinen (Wortlaut »as they are«, Umbruch Feldkommentar, Umbruch Migration Guide) · Brief `paket-12.impl-2.brief.txt`
  - 2026-09-19 Zug 4 Runde 1 zurück: FERTIG · `StageRenderer.ts` Guard `isStage2DWithoutCamera` (Flag `isStage2D`, `import type`), Regressionstest `a composing renderer draws nothing while a Stage2D of the composition has no camera` vor dem Fix rot (`paket-12.impl-2.red.log`), 3 kleine behoben, `pnpm run ci` Exit 0 laut Report · Reviewer 2 beauftragt (sonnet, medium), Diff `paket-12.diff-2`
  - 2026-09-19 Zug 4 Runde 1 Review 2 (`paket-12.review-2.json`): offener Befund behoben (`StageRenderer.ts:517`), 3 kleine behoben · 0 kritisch, 0 wichtig, 1 klein · offen: 1 → 0
  - 2026-09-19 Zug 5: `pnpm run ci` Exit 0 (`paket-12.verify.log`) · Commit `69e27081`, 13 Pfade · Queue-Zeilen nachgezogen (`Stage2D.ts:179`, `ParallaxProjection.ts:102`, `:72`/`:76`) · zwei kleine Folgen unter das Paket im Plan

## Ursache

Die Stage-Schicht dividiert durch Zahlen, die sie nie prüft: `fitIntoRectangle`
durch `pixelZoom`, `minPixelZoom`, `maxPixelZoom` und rechnet mit `width`/`height`
der Specs; die Projektionen dividieren die Containergröße durch die View
(`#pixelRatio`) und die View-Breite durch die View-Höhe (`#aspect`). `Stage2D`
fängt einen Container ohne Fläche ab (`Stage2D.ts:159`), die Projektion selbst
nicht, und aus einer Projektion ohne View baut `Stage2D` trotzdem eine Kamera.
Die Regel dieses Pakets, auf jeder Ebene dieselbe: **eine Größe oder ein
Zoomfaktor, der keine endliche Zahl über 0 ist, erzeugt keine View.**

Nachgestellt (Node, `dist` von HEAD `0e7db162`, Rechteck 800×600 bzw. 640×400):

| Eingabe | Ergebnis heute |
| --- | --- |
| `fitIntoRectangle(rect, {pixelZoom: 0})` | `[Infinity, Infinity]` |
| `{pixelZoom: -2}` / `NaN` / `Infinity` | `[-400, -300]` / `[NaN, NaN]` / `[0, 0]` |
| `{fit: 'contain', width: 100, maxPixelZoom: 0}` | `[Infinity, Infinity]` |
| `{fit: 'contain', width: 100, minPixelZoom: Infinity}` | `[0, 0]` |
| `{fit: 'contain', width: -640}` / `NaN` / `Infinity` | `[-640, -480]` / `NaN` / `Infinity` |
| `new OrthographicProjection('xy\|bottom-left')`, `updateViewRect(0, 600)` | `getViewRect()` `[0, 600, NaN, 1]`, Kamera `left === right === 0` |
| dieselbe mit `{fit: 'contain', width: 640}` nach `updateViewRect(800, 600)`, dann `(0, 600)` | `[0, 0, NaN, NaN]` — die gute View ist weg |
| `new …Projection('xy\|bottom-left', {})`, `updateViewRect(800, 600)` | `[0, 0, Infinity, Infinity]` |

## Entscheidungen dieses Pakets (mit Grund)

1. **`pixelZoom`, der keine endliche Zahl über 0 ist, zoomt mit 1** — die View
   ist der Container. Nicht werfen, nicht auf `fit` durchfallen.
   Grund: `Display#pixelZoom` gibt der 0 genau diese Bedeutung (»The pixelZoom
   factor is 0 by default and is therefore not used«, `Display.ts:208`, genutzt
   nur bei `pixelZoom > 0`, `Display.ts:600`, `:748`); wer
   `{pixelZoom: display.pixelZoom}` schreibt, bekommt so die 1:1-View, die er
   meint. Der Arm `{fit?: 'fill'; pixelZoom: number}` der Union ist ein
   Fill-Arm, Zoom 1 ist `fill`. Werfen fiele in den Resize-Pfad und träfe jeden
   Frame, der die Größe ändert. Der Vorrang bleibt: ein vorhandener `pixelZoom`
   (`!= null`) entscheidet vor `fit`, wie heute.
2. **Eine Seite (`width`/`height` bei `contain`/`cover`), die keine endliche
   Zahl über 0 ist, ist eine Seite, die der Aufrufer nicht vorgibt** — die
   bestehende Regel für `0` (TSDoc `fitIntoRectangle.ts:178-179`, Kommentar
   `:216`) wird auf negative, `NaN` und `Infinity` erweitert. Grund: dieselbe
   Rechnung, dieselbe Funktion; nur `pixelZoom` zu reparieren ließe
   `width: -640` eine gespiegelte View bauen.
3. **`minPixelZoom`/`maxPixelZoom`, die keine endliche Zahl über 0 sind,
   greifen nicht.** Grund: dieselbe Division `target.copy(rect).divideScalar(…)`
   wie beim `pixelZoom`; `maxPixelZoom: 0` ergibt heute dieselbe unendliche View.
4. **Eine Projektion behält ihre View, ihr Pixel-Ratio und ihre Kamerawerte,
   wenn Container oder Specs keine View mit Fläche ergeben.** Grund: das ist
   die Regel, die `Stage2D` für seinen Container schon befolgt (»the stage
   keeps the camera and the size it has«, `Stage2D.ts:157-159`); eine Kamera
   aus einer View ohne Fläche hat `left === right` bzw. `aspect` 0/`Infinity`
   und damit eine entartete Projektionsmatrix — es gibt keinen endlichen Wert,
   der dort richtig wäre. Eine Projektion, die noch nie eine View hatte,
   meldet `getViewRect()` → `[0, 0, 0, 0]` (die Startwerte ihrer `Vector2`).
5. **`Stage2D` baut keine Kamera aus einer Projektion ohne View.** Grund: mit
   Entscheidung 4 bleibt eine frische Projektion, deren Specs keine View
   ergeben (`{}`, `{fit: 'contain'}` ohne Seite, nach Entscheidung 2 auch
   `{fit: 'contain', width: -640}`), ohne gesetzte Felder — `createCamera()`
   lieferte dann eine `NaN`-Kamera. Heute entsteht dort eine Kamera mit
   `Infinity`-Matrix (vorbestehend für `{}`), nach Entscheidung 2 träfe es neue
   Eingaben: was die Änderung umwirft, gehört zu ihr.
6. **Ein interner Helfer `isPositiveFinite`** in `src/utils/`, nicht öffentlich
   — wie `utils/expectDefined.ts`, das `OrthographicProjection` schon
   importiert. Grund: sieben Prüfungen in drei Dateien; `fitIntoRectangle.ts`
   wird per `export *` veröffentlicht und darf den Helfer deshalb nicht selbst
   exportieren.
7. **Kein Browsertest.** Grund: geändert wird reine Arithmetik (View-Rechteck,
   Pixel-Ratio, Aspect) und die Bedingung, unter der `Stage2D` eine Kamera
   anlegt — kein Shader, kein Draw-Pfad, kein GPU-Buffer. Alle Fälle sind in
   Vitest ohne GPU vollständig beobachtbar.
8. **Keine Migration-Guide-Sektion.** Keine Signatur, kein Export, kein Typ
   ändert sich; anders verhalten sich nur Eingaben, die heute eine unbrauchbare
   View ergeben.

## Vorgehen

Zuerst alle Tests aus Schritt 1 schreiben und rot sehen
(`pnpm nx test twopoint5d -- src/stage`), Ausgabe des roten Laufs in den Report
— je Zeile der `it.each`-Tabellen, welche rot war. Dann Schritt 2 ff.

### 1. Regressionstests (vor dem Fix)

`packages/twopoint5d/src/stage/fitIntoRectangle.spec.ts` — auf oberster Ebene
unter die bestehenden losen `it(...)` (ab Zeile 194):

- `it.each([0, -2, NaN, Infinity, -Infinity])('a pixelZoom of %s gives the container as the view', …)`
  — `fitIntoRectangle(new Vector2(800, 600), {pixelZoom: v}, new Vector2())` →
  `[target.width, target.height]` `toEqual([800, 600])`. Heute alle rot.
- `it.each([-640, NaN, Infinity])('a contain width of %s is a side the caller does not constrain', …)`
  — `target = new Vector2(11, 22)`, `fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', width: v}, target)`
  → `[11, 22]` (keine Seite, kein Clamp: das Ziel bleibt, wie es ist). Heute alle rot.
- `it.each([-480, NaN, Infinity])('a cover height of %s is a side the caller does not constrain', …)`
  — dasselbe mit `{fit: 'cover', height: v}` → `[11, 22]`. Heute alle rot.
- `it('a contain spec takes the side that is a finite number above 0 when the other is not')`
  — `fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', width: NaN, height: 100}, target)` → `[160, 100]`. Heute rot (`[NaN, 100]`).
- `it.each([0, -2, NaN, Infinity, -Infinity])('a maxPixelZoom of %s does not apply', …)`
  — `fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', width: 100, maxPixelZoom: v}, new Vector2())` → `[100, 62.5]`. Rot heute: `0`, `-2`, `-Infinity`; `NaN`, `Infinity` sind Wächter.
- `it.each([0, -2, NaN, Infinity])('a minPixelZoom of %s does not apply', …)`
  — dasselbe mit `minPixelZoom: v` → `[100, 62.5]`. Rot heute: `Infinity`; die übrigen sind Wächter.

`OrthographicProjection.spec.ts` und `ParallaxProjection.spec.ts` — je dieselben
vier Tests, `P` ist die Klasse der Datei, Ebene `'xy|bottom-left'`:

- `it('keeps its view while the container has no area')` — `new P('xy|bottom-left', {fit: 'contain', width: 640})`,
  `updateViewRect(800, 600)`, `const camera = projection.createCamera()`,
  `getViewRect()` ist `[640, 480, 1.25, 1.25]`; Parallax merkt sich `const fov = camera.fov`.
  Dann für jedes `[w, h]` aus `[0, 600]`, `[800, 0]`, `[0, 0]`, `[-800, 600]`, `[NaN, 600]`, `[800, Infinity]`:
  `updateViewRect(w, h)`, `getViewRect()` weiter `toEqual([640, 480, 1.25, 1.25])` (Meldung mit `w×h`),
  `projection.updateCamera(camera)`, danach Ortho `[camera.left, camera.right, camera.top, camera.bottom]`
  `toEqual([-320, 320, 240, -240])`, Parallax `camera.aspect` `toBeCloseTo(640 / 480)` und `camera.fov` `toBe(fov)`.
  Heute rot.
- `it('has no view before a container with area')` — `new P('xy|bottom-left')`,
  `updateViewRect(0, 600)` → `getViewRect()` `toEqual([0, 0, 0, 0])`; danach
  `updateViewRect(800, 600)` → `[800, 600, 1, 1]`. Heute rot (`[0, 600, NaN, 1]`).
- `it.each([{}, {fit: 'contain'}, {fit: 'contain', width: -640}] as const)('has no view from the specs %j', …)`
  — `new P('xy|bottom-left', specs)`, `updateViewRect(800, 600)` → `[0, 0, 0, 0]`.
  Heute rot (`[0, 0, Infinity, Infinity]` bzw. negative View). Ist ein Element
  der Tabelle nicht als `Partial<…Specs>` typisierbar, die Tabelle über
  `satisfies Partial<OrthographicProjectionSpecs>[]` bzw. `ParallaxProjectionSpecs`
  typisieren, kein `as any`.
- `it('takes a pixelZoom of 0 as the container')` — `new P('xy|bottom-left', {pixelZoom: 0})`,
  `updateViewRect(800, 600)` → `[800, 600, 1, 1]`. Heute rot.

`Stage2D.spec.ts` (Importe `OrthographicProjection` aus `./OrthographicProjection.js`,
`OrthographicCamera` aus `three/webgpu` ergänzen):

- `it('creates no camera from specs that give no view')` — für
  `new ParallaxProjection('xy|bottom-left', {})` und
  `new OrthographicProjection('xy|bottom-left', {fit: 'contain'})` je eine
  Stage; `OnStageResize` und `OnStageAfterCameraChanged` mit `vi.fn()`
  abonnieren, `stage.resize(800, 600)`; dann `stage.camera` `toBeUndefined()`,
  `[stage.width, stage.height]` `toEqual([0, 0])`, beide Spies
  `not.toHaveBeenCalled()`. Heute rot (Kamera wird gebaut und angekündigt).
- `it('fills the container for a pixelZoom of 0')` —
  `new Stage2D(new OrthographicProjection('xy|bottom-left', {pixelZoom: 0}))`,
  `resize(800, 600)` → `[stage.width, stage.height]` `[800, 600]`, `stage.camera`
  ist `OrthographicCamera` mit `right - left === 800`. Heute rot.

### 2. `src/utils/isPositiveFinite.ts` (neu, intern)

```ts
/**
 * Whether `value` is a finite number above 0 — a size or a zoom factor that can be divided by.
 */
export function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
```

Nicht in `src/utils/public-api.ts` eintragen. Keine eigene Spec — die Aufrufer
decken ihn ab, wie `expectDefined`.

### 3. `src/stage/fitIntoRectangle.ts`

Import `import {isPositiveFinite} from '../utils/isPositiveFinite.js';`

- Zeile 200, `pixelZoom`-Zweig: `target.copy(rect).divideScalar(isPositiveFinite(pixelZoom) ? pixelZoom : 1);`
  mit Kommentar darüber, sinngemäß: `// a pixelZoom that is not a finite number above 0 zooms by 1, as a Display#pixelZoom of 0 does`.
  Zeile 194 (`pixelZoom != null`-Ermittlung) bleibt — `undefined`/`null` heißen weiter »kein `pixelZoom`«, `fit` entscheidet.
- Zeilen 216-218: `const width = 'width' in specs && isPositiveFinite(specs.width) ? specs.width : 0;`,
  ebenso `height`. Kommentar Zeile 216 wird: `// a side that is missing, or not a finite number above 0, is a side the caller does not constrain`.
  Die Vergleiche `width !== 0` usw. darunter bleiben unverändert.
- Zeilen 244-248: `if (isPositiveFinite(specs.minPixelZoom) && rect.width / target.width < specs.minPixelZoom)` bzw.
  `else if (isPositiveFinite(specs.maxPixelZoom) && rect.width / target.width > specs.maxPixelZoom)`.
- TSDoc (Zeilen 178-186): »a side that is missing or set to `0`« wird »a side
  that is missing, or not a finite number above 0,«. Danach einen Satz
  anfügen: »A `pixelZoom` that is not a finite number above 0 zooms by 1 — the
  view is the container, as with a `Display#pixelZoom` of 0 —, and a
  `minPixelZoom` or `maxPixelZoom` that is not a finite number above 0 does not
  apply.« Der Rest des Absatzes (leere Spec, frischer `Vector2`, 0×0 bei
  `contain`/`cover`) bleibt wahr und bleibt stehen.
- Den 0×0-Zweig für `contain`/`cover` (Zeilen 210-214) nicht anfassen.

### 4. `src/stage/OrthographicProjection.ts` und `src/stage/ParallaxProjection.ts`

Beide gleich, Import `import {isPositiveFinite} from '../utils/isPositiveFinite.js';`.
`updateViewRect(width, height)` beginnt so; alles ab der Zuweisung von
`#halfWidth` (Ortho) bzw. `#halfHeight` (Parallax) bleibt, wie es ist:

```ts
  updateViewRect(width: number, height: number): void {
    // a container without area has no aspect ratio to fit a view into, and a view without area
    // none to build a camera from: the projection keeps the view, the pixel ratio and the camera
    // values it has, the same rule Stage2D follows for its container
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;

    // specs that match no shape leave the target as it is, so it starts out as the current view
    const viewRect = fitIntoRectangle(new Vector2(width, height), this.viewSpecs, this.#viewRect.clone());
    if (!isPositiveFinite(viewRect.width) || !isPositiveFinite(viewRect.height)) return;

    this.#viewRect.copy(viewRect);
    …
```

- TSDoc an `updateViewRect()` in beiden Klassen: »Fits the view into a
  container of `width` × `height`. A width or a height that is not a finite
  number above 0, and specs that give a view without area, leave the projection
  as it is. Until the first call that gives a view with an area,
  `getViewRect()` reports `[0, 0, 0, 0]`.«
- Kommentar über den `!`-Feldern (Ortho Zeile 21, Parallax Zeile 21) wird:
  `// The fields below are assigned by the first updateViewRect() that gives a view with an area; a camera built before that carries NaN.`
- `createCamera()`, `updateCamera()`, `getZoom()` und der `// TODO add jsdoc`
  an `getZoom()` bleiben unangetastet (Letzteres liegt als DOC in der Queue).

### 5. `src/stage/Stage2D.ts`

- In `#updateProjection` direkt nach `const [w, h] = this.projection!.getViewRect();` (Zeile 164):

  ```ts
      // specs that give no view with an area leave the projection without one: there is nothing to
      // build a camera from, so the stage keeps the camera and the size it has
      if (!isPositiveFinite(w) || !isPositiveFinite(h)) return;
  ```

  Import `import {isPositiveFinite} from '../utils/isPositiveFinite.js';`.
  `this.needsUpdate = false` (Zeile 161) bleibt, wo es ist.
- TSDoc des `camera`-Getters (Zeilen 97-99): »The projection creates one on the
  first `resize()` whose width and height are both above 0« wird »… both above
  0 and for which its specs give a view with an area«.
- Warnung in `updateFrame()` (Zeile 203): »the projection creates one on the
  first resize() with a width and a height above 0, or assign …« wird »… with a
  width and a height above 0 for which its specs give a view with an area, or
  assign …«. Der Test `warns once when it runs without a camera` prüft nur die
  Anzahl der Aufrufe.

### 6. Doku

- `src/stage/README.md:464-467` (»Stage with no camera yet«): »until the first
  `resize()` with a width and a height above 0 creates the camera« wird »until
  the first `resize()` with a width and a height above 0, for which the
  projection's specs give a view with an area, creates the camera«.
- `CHANGELOG.md`, `## [Unreleased]` — Skill `updating-changelog` laden:
  - `### Changed`, bestehender Eintrag Zeile 126 (»`Stage2D` creates its camera
    on the first `resize()` whose width and height are both above 0 …«): nach
    »both above 0« einfügen »and for which the projection's specs give a view
    with an area«. Der Abschnitt ist unveröffentlicht und darf geändert werden.
  - `### Fixed`, direkt hinter dem Eintrag »fix
    `OrthographicProjection#updateViewRect()` for a projection built without
    specs …« (Zeile 173), zwei Einträge, Zielwortlaut:
    - »fix `fitIntoRectangle()` for spec numbers that are not finite or not
      above 0: such a `pixelZoom` zooms by 1, so the view is the container, the
      same as a `Display#pixelZoom` of 0; such a `width` or `height` is a side
      `contain` and `cover` do not constrain, as `0` is; such a `minPixelZoom`
      or `maxPixelZoom` does not apply. None of them turns the container into
      a view that is infinite, negative or `NaN`«
    - »fix `OrthographicProjection#updateViewRect()` and
      `ParallaxProjection#updateViewRect()` for a container or a view without
      area: a width or a height that is not a finite number above 0, and specs
      that give a view without area, leave the view, the pixel ratio and the
      camera values of the projection as they are. Until the first call that
      gives a view with an area, `getViewRect()` reports `[0, 0, 0, 0]`«
  - Keine Migration-Guide-Sektion (Entscheidung 8).
- `docs/architecture.md` bleibt (nennt `fitIntoRectangle` nur als Geometrie-Lieferant).

### 7. Nicht anfassen

- `Stage2D.ts:173` — `updateCamera()` auf einer vom Nutzer gesetzten Kamera
  (Queue, `→ Rückfrage`) und `CONS-025` (`updateCamera()` vs. `createCamera()`).
- `distanceToProjectionPlane`, `near`, `far` — nicht Teil dieser Rechnung; der
  Befund zu `distanceToProjectionPlane` liegt in der Queue.
- `Display#pixelZoom` und `calculateAnchorOffset()`.

### Hinweis für Zug 5

Der Einschub in `Stage2D.ts` und die neuen Zeilen in `ParallaxProjection.ts`
verschieben die Zeilennummern dreier Queue-Einträge: `Stage2D.ts:173`
(`#updateProjection` → `updateCamera`), `ParallaxProjection.ts:84` (`// TODO add
jsdoc`) und `ParallaxProjection.ts:54`, `:58` (`distanceToProjectionPlane`). Nach
dem Commit in »Offene Befunde« auf die neuen Zeilen setzen.

## Restplan

Unverändert. Die Pakete 13–17 fassen weder `stage/` noch `utils/` an
(`map2d/`, `texture/`, `vertex-objects/`, `display/`+`controls/`, `scripts/`)
und hängen nicht von Paket 12 ab; Paket 16 prüft Zahlen in `FixedFrameLoop`
inline (`FixedFrameLoop.ts:119`, `:134`) und braucht den neuen Helfer nicht.
Kein Paket rückt, keines wird geteilt.

## Nebenbefunde im Volltext

**Aus der Queue (aus Paket 1) · low · `packages/twopoint5d/src/stage/OrthographicProjection.ts:48`, `ParallaxProjection.ts:49`**
— ein direkter `updateViewRect(0, h)` ohne `Stage2D` liefert `NaN`/`Infinity`
in Pixel-Ratio und (Parallax) Aspect; `Stage2D` fängt 0×0 ab, die Projektion
selbst nicht.
Abgleich: unverändert, jetzt `OrthographicProjection.ts:48` (`#pixelRatio.set(width, height).divide(this.#viewRect)`)
und `ParallaxProjection.ts:49` bzw. `:56` (`#aspect`). Urteil beim Schneiden:
Rechenfehler (Division durch 0) → BUG-Serie, `→ Scope`.

**Aus der Queue (aus Paket 1) · low · `packages/twopoint5d/src/stage/fitIntoRectangle.ts:196`**
— `{pixelZoom: 0}` teilt durch 0 und ergibt eine unendlich große View.
Abgleich: unverändert, die Division steht jetzt in Zeile 200
(`target.copy(rect).divideScalar(pixelZoom)`), die Bedingung in Zeile 196.

**Mitgenommen (Zug 0, vorbestehend seit `e352b56`) · low · `fitIntoRectangle.ts:217-218`, `:244-248`**
— `width`/`height` von `contain`/`cover` und `minPixelZoom`/`maxPixelZoom`
gehen ungeprüft in dieselbe Rechnung: `maxPixelZoom: 0` → unendliche View,
`minPixelZoom: Infinity` → 0×0, `width: -640` → gespiegelte View, `NaN` →
`NaN`. Gleiche Ursache wie der `pixelZoom`-Befund.

**Mitgenommen (Zug 0, vorbestehend seit `e352b56` für `{}`) · low · `Stage2D.ts:163-178`**
— `Stage2D` baut eine Kamera, auch wenn die Projektion aus den Specs keine View
mit Fläche gewinnt (`{}`, `{fit: 'contain'}` ohne Seite): heute mit
`Infinity`-Matrix, nach Schritt 4 wäre es eine `NaN`-Kamera. Gleiche Ursache,
und Schritt 2 erweitert die Menge solcher Specs.

**Neu in der Queue (Zug 0, vorbestehend seit `e352b56`, nicht Teil dieses Pakets) · low · `ParallaxProjection.ts:54`, `:58`**
— `distanceToProjectionPlane` aus den Specs geht ungeprüft in
`#fovy = 2 · atan(#halfHeight / distance)`: `0` ergibt 180°, ein negativer Wert
einen negativen `fov`; `getZoom()` rechnet mit demselben Wert. Urteil
`→ Scope` (Korrektheitsdefekt, wie `pixelZoom: 0`). Nicht in dieses Paket:
eine Kameragröße, keine View-Rechnung — die Frage, was ein Abstand von 0
bedeuten soll (werfen, Default, Mindestabstand), gehört zu den Kamerawerten,
die `CONS-025` neu schneiden will.

## Reviewer-Urteil

Review 1 (`paket-12.review-1.json`) auf `paket-12.diff`, Review 2 (`paket-12.review-2.json`) auf `paket-12.diff-2`, Stand vor dem Commit `69e27081`:

- Projektionen bei Container ohne Fläche (Queue, aus Paket 1): **behoben** — `OrthographicProjection.ts:52`/`:56`, `ParallaxProjection.ts:54`/`:58` (Stand Review 1)
- `pixelZoom: 0` (Queue, aus Paket 1): **behoben** — `fitIntoRectangle.ts:205`
- Mitgenommen, Seiten und Clamps: **behoben** — `fitIntoRectangle.ts:222-223`, `:249`, `:251`
- Mitgenommen, `Stage2D` ohne Kamera aus Projektion ohne View: **behoben** — `Stage2D.ts:170`
- Folge der eigenen Änderung, Composed-Pfad warf (Review 1, wichtig): **behoben in Runde 1** — `StageRenderer.ts:517`, Test `StageRenderer.spec.ts:745`

Kleine Befunde (lösen keine Runde aus):

- `StageRenderer.ts:363-364` — TSDoc von `buildOutputNode` nennt den neuen Fall »eine `Stage2D` ohne Kamera« nicht (Review 2) → als Folge im Plan
- `Stage2D.ts:82` — nach Wechsel auf eine Projektion ohne View behält die Stage `width`/`height` der vorigen (Review 1) → als Folge im Plan
- `Stage2D.ts:160` — Stage2D prüft den Container auf `=== 0`, die Projektionen auf »endliche Zahl über 0«; folgenlos, weil die Projektion selbst abfängt (Review 1)
- in Runde 1 behoben: Wortlaut »as they are« in TSDoc und CHANGELOG, Umbruch der Feldkommentare, Umbruch des Migration-Guide-Absatzes (Review 1)

Anmerkung des Implementierers zu Runde 1: eine einzelne `Stage2D` ohne View lässt die ganze Komposition leer; Hinweis gibt nur die Warnung aus `Stage2D#updateFrame` nach 100 Frames, die `StageRenderer#updateFrame` unabhängig vom Modus auslöst (Review 2 bestätigt).
