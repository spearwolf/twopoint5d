# Paket 19 — stage: ParallaxProjection weist eine ungültige distanceToProjectionPlane ab

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nebenbefund aus der Befund-Queue, Drain-Runde 2; kein Audit-Finding)
- Ziel: `ParallaxProjection` und `OrthographicProjection` nehmen eine Kamera-Spec
  (`distanceToProjectionPlane`, `near`, `far`), aus der keine Kamera abbilden kann, als nicht
  angegeben: die Parallax-Distanz und den Parallax-`near` nur als endliche Zahl über 0, die
  orthografische Distanz und den orthografischen `near` als endliche Zahl, `far` als endliche Zahl
  über dem geltenden `near`.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - neu `packages/twopoint5d/src/utils/isFiniteNumber.ts` (intern, nicht in `public-api.ts`)
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.spec.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten — Tests zuerst, rot sehen, dann der Fix.
- Verify: `pnpm run ci` (Root des Repos); für den roten Lauf vorab
  `pnpm --dir packages/twopoint5d vitest --run src/stage/ParallaxProjection.spec.ts src/stage/OrthographicProjection.spec.ts`
- Commit: `fix(stage): let both projections take a distance to the plane, a near and a far no camera can be built from as not given`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · Queue-Eintrag `ParallaxProjection.ts:72`, `:76`
    unverändert (HEAD `e90de130`, Datei seit `69e27081` unberührt), vorbestehend seit `e352b56`
    (dort `:47`, `:51`), in Node gegen `dist` nachgestellt: Distanz 0 → `fov` 180, −300 → `fov`
    −90 und Kamera hinter der Ebene, `NaN` → `fov` und Position `NaN`, `Infinity` → `fov` 0 und
    Position `NaN`/`Infinity`, `getZoom(100)` bei Distanz 0 → −5,4·10¹⁵ · mitgenommen, gleiche
    Ursache: `near`/`far` beider Projektionen und die nicht endliche Distanz der orthografischen
    (nachgestellt: `near` 0 → Projektionsmatrix `NaN`, `far` = `near` → −`Infinity`, `far` <
    `near` oder `near` 200000 ohne `far` → umgedrehte Tiefe, `far` `Infinity` → `NaN`; orthografisch
    Distanz `NaN` → Position `NaN`), alle so schon in `e352b56` · offene Folgen unter erledigten
    Paketen: keine · Queue: kein weiterer Eintrag gleicher Ursache · Restplan: kein weiteres offenes
    Paket, nichts umzusortieren

  - 2026-09-19 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), effort low
  - 2026-09-19 Zug 2: FERTIG · 6 Dateien (neu `utils/isFiniteNumber.ts`, beide Projektionen samt Specs, CHANGELOG) · rot 28 von 62, danach 62 grün, `pnpm run ci` grün · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (sonnet, medium): alle Ziel-Punkte behoben, 0 kritisch, 0 wichtig, 5 klein · Diff `paket-19.diff` im Arbeitsverzeichnis
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: `pnpm run ci` exit=0 (`paket-19.verify.log`) · Commit 160b26ad

## Urteil des Reviewers

- Parallax-Distanz: behoben, `ParallaxProjection.ts:101-103`, Tests `ParallaxProjection.spec.ts:234-242`
- Parallax `near`/`far`: behoben, `ParallaxProjection.ts:94-99`, Tests `:251-276`
- Orthografische Distanz: behoben, `OrthographicProjection.ts:195-197`, Tests `OrthographicProjection.spec.ts:53-63`
- Orthografisch `near`/`far`: behoben, `OrthographicProjection.ts:187-192`, Tests `:65-88`
- `updateCamera`: wie geplant, Tests `OrthographicProjection.spec.ts:90-100`, `ParallaxProjection.spec.ts:278-288`
- CHANGELOG: behoben, `CHANGELOG.md:16`

Kleine Befunde:
1. `ParallaxProjection.ts:90-91` — Kommentar verlangt für alle drei Werte »a finite number above 0«; für `far` gilt »above near« (Wortlaut aus dem Detailplan).
2. `ParallaxProjection.ts:70-72`, `OrthographicProjection.ts:160-162` — angefügter TSDoc-Satz bricht bei ~108 statt ~100 Zeichen um.
3. Testlücken: `{far: 0.05}` gegen den Default-`near` in beiden Specs; orthografisch `{far: -Infinity}`.
4. Testnamen drucken bei `{far: NaN}` »a near of undefined«.
5. `isFiniteNumber` ohne eigenes Spec (wie `isPositiveFinite`).

## Abgleich

- **Queue-Eintrag `ParallaxProjection.ts:72`, `:76` — unverändert.** Zeile 72:
  `this.#distanceToProjectionPlane = this.viewSpecs.distanceToProjectionPlane ?? 300;`, Zeile 76:
  `this.#fovy = (2 * Math.atan(this.#halfHeight / this.#distanceToProjectionPlane) * 180) / Math.PI;`.
  Kein Commit seit `69e27081` hat die Datei angefasst. Nachgestellt in Node gegen
  `packages/twopoint5d/dist/lib/index.js` mit `{fit: 'fill'}` auf 800×600 (Script
  `paket-19.zug0-repro.mjs` im Arbeitsverzeichnis des Laufs; läuft nur aus einem Verzeichnis, in
  dem `three/webgpu` auflösbar ist, etwa als Kopie unter `packages/twopoint5d/`): siehe
  Verlaufszeile. `getZoom()` (`:103-108`) rechnet mit derselben
  Distanz und liefert bei 0 Unsinn; mit einer gültigen Distanz ist es richtig und bleibt unberührt.
- **Mitgenommen 1 — `near`/`far` der `ParallaxProjection` (`:69-70`).** `?? 0.1` bzw. `?? 100000`,
  sonst ungeprüft in `new PerspectiveCamera(fov, aspect, near, far)` (`:84`). three baut daraus die
  Matrix mit `2·near/(right−left)` und `(far+near)/(far−near)`: `near` 0 ergibt 0/0, `far` gleich
  `near` eine Division durch 0, `far` unter `near` (auch `near: 200000` ohne `far`, gegen den
  Default 100000) eine umgedrehte Tiefe, in der nichts sichtbar ist; `far: Infinity` ergibt
  `Infinity/Infinity`. Vorbestehend (`e352b56:44-45`).
- **Mitgenommen 2 — `near`/`far` und Distanz der `OrthographicProjection` (`:68-71`).** Dieselbe
  Zeilengruppe, dieselben `?? default`-Übernahmen. Eine orthografische Kamera verträgt einen `near`
  von 0 oder darunter und eine Distanz von 0 oder darunter (sie zeigt dann, was hinter ihrer
  Position liegt, sofern `near` weit genug unter 0 liegt); was sie nicht verträgt, ist ein nicht
  endlicher Wert (`NaN`, ±`Infinity`: Matrix bzw. Position `NaN`) und ein `far`, der nicht über
  `near` liegt. Vorbestehend (`e352b56:43-46`).

### Warum die Mitgenommenen ins Paket gehören

Ursache des Queue-Eintrags: `updateViewRect()` übernimmt eine Kamera-Spec mit `?? default`, ohne zu
prüfen, ob die Kamera mit dem Wert abbilden kann. `near` und `far` stehen in derselben Zeilengruppe,
gehen in dieselbe Kamera und enden in derselben entarteten Projektionsmatrix; die orthografische
Projektion ist die Geschwisterklasse mit identischem Muster. Paket 12 hat für `fitIntoRectangle`
genauso geschnitten (neben `pixelZoom` auch Seiten und Clamps derselben Rechnung). Ohne sie hieße
es: dieselbe Ursache, eine Stelle behoben, die Nachbarzeile offen — und die Drain-Runde schnitte
ein Paket 20 für dieselben fünf Zeilen.

### Bewusst nicht im Paket

- **Eine gültige Distanz außerhalb von `[near, far]`** (Parallax `distanceToProjectionPlane: 50`
  mit `near: 100`; orthografisch Distanz 0 mit Default-`near` 0.1): die Projektionsebene fällt aus
  dem Tiefenbereich, die Kamera bleibt aber endlich und zeigt, was zwischen `near` und `far`
  liegt. Das ist eine Kombination, die der Aufrufer so eingestellt hat, keine Kamera, die nichts
  abbilden kann; die Defaults (300 bzw. 100 in `[0.1, 100000]`) halten die Ebene im Bereich. Kein
  Defekt, kein Queue-Eintrag.
- **`updateCamera()` wendet nicht alle Specs an** (Parallax setzt `near`/`far` nicht, keine der
  beiden verschiebt die Kamera bei geänderter Distanz): Audit-Finding CONS-025, außerhalb der
  BUG-Serie. Bleibt offen und wird nicht gebucht.
- **`getZoom()` ohne TSDoc, `=== 0`-Guard, Defaults als unbenannte Literale**: Audit-Findings
  DOC-020 und IMPL-001, dazu der Queue-Eintrag `ParallaxProjection.ts:102` (`→ Audit`). Die
  modulprivaten Konstanten dieses Pakets (siehe Vorgehen) sind nicht geteilt und nicht öffentlich;
  DOC-020 bleibt offen und wird nicht gebucht. `// TODO add jsdoc` über `getZoom()` bleibt stehen.
- **Queue-Eintrag `Stage2D.ts:179` (`→ Rückfrage`)**: eigene Ursache (ob die Projektion eine vom
  Nutzer gesetzte Kamera nachführt), nicht berührt.

## Entscheidungen dieses Pakets

- **Ungültig heißt »nicht angegeben«, kein Throw, keine Warnung.** Die Specs sind ein lebendes
  Objekt des Aufrufers und werden bei jedem `updateViewRect()` gelesen, also mitten in
  `Stage2D#resize()` und damit im Resize-Pfad des `Display`; ein Throw dort bräche die Darstellung
  ab. Paket 12 hat für die Spec-Zahlen von `fitIntoRectangle` dieselbe Regel gesetzt (»a side that
  is … not a finite number above 0 means the caller does not constrain that side«, ohne Warnung) —
  die Projektionen folgen ihr.
- **Die Regel je Wert richtet sich nach der Kamera, nicht nach Symmetrie.** Parallax: Distanz und
  `near` müssen über 0 liegen (der `fov` teilt durch die Distanz, die Perspektivmatrix durch
  `near`). Orthografisch: jede endliche Zahl, weil eine orthografische Kamera 0 und negative Werte
  für `near` und Distanz korrekt abbildet. `far`: bei beiden eine endliche Zahl.
- **`far` nicht über `near` → beide auf ihre Defaults.** Nur `far` zurückzusetzen reicht nicht:
  `near: 200000` ohne `far` läge dann weiter über dem Default-`far` 100000. Beide zurück ist eine
  Regel ohne Kaskade und in einem Satz dokumentierbar.
- **Neuer interner Helfer `isFiniteNumber`** neben `isPositiveFinite` (Paket 12): die
  orthografische Projektion prüft drei Werte auf Endlichkeit, die Parallax-Projektion einen; ein
  Type Guard erspart ein `!` und hält beide Klassen gleich lesbar. Nicht öffentlich, wie
  `isPositiveFinite`.
- **Modulprivate Konstanten `DEFAULT_NEAR`, `DEFAULT_FAR`, `DEFAULT_DISTANCE_TO_PROJECTION_PLANE`**
  je Datei: die Defaults stehen nach dem Fix zweimal (Einzelwert und Paar-Rücksetzung); Stil wie
  `DEFAULT_KEYS` in `controls/PanControl2D.ts:59`. Nicht exportiert, nicht zwischen den Dateien
  geteilt — das wäre DOC-020.
- **Kein Browsertest.** Die Änderung ist Arithmetik in `updateViewRect()` über Spec-Zahlen; die
  Vitest-Specs prüfen die Kamerawerte direkt. Der GPU-Pfad (Kamera → Pass-Node) ändert sich nicht.
  Paket 12 hat für dieselben Funktionen genauso entschieden.
- **Kein README-Eintrag.** `stage/README.md` beschreibt die Spec-Felder nirgends; die Doku ist die
  TSDoc an den Spec-Typen, die in der `d.ts` landet.
- **CHANGELOG unter `### Fixed`, kein Migration Guide.** Das Verhalten ist so in 0.21.2
  ausgeliefert (vorbestehend seit `e352b56`); keine Signatur ändert sich, nur Werte, aus denen
  keine Kamera abbilden konnte, ergeben jetzt die Default-Kamera.

## Vorgehen

Konventionen aus `./remediation-plan.md` gelten (Englisch in Code, Kommentaren, Tests und
CHANGELOG; `.js`-Suffix in relativen Imports; kein Rückblick auf den Vorzustand; keine
Finding-IDs). Formatierung: `printWidth` 130, danach
`pnpm exec prettier --write <die geänderten Dateien>`.

### 1. Regressionstests schreiben und rot sehen

**`packages/twopoint5d/src/stage/ParallaxProjection.spec.ts`** — am Ende des äußeren
`describe('ParallaxProjection', …)` einen Block anfügen. `Vector3` wird nicht gebraucht;
`ProjectionPlane` ist schon importiert.

```ts
  describe('camera values from the specs', () => {
    const plane = 'xy|bottom-left';
    const view = {fit: 'contain', width: 640} as const;

    const cameraFor = (specs: Partial<ParallaxProjectionSpecs>) => {
      const projection = new ParallaxProjection(plane, specs);
      projection.updateViewRect(800, 600);
      return {projection, camera: projection.createCamera()};
    };

    it.each([0, -300, NaN, Infinity, -Infinity])('takes a distanceToProjectionPlane of %s as not given', (distance) => {
      const reference = cameraFor(view);
      const {projection, camera} = cameraFor({...view, distanceToProjectionPlane: distance});

      expect(camera.fov).toBe(reference.camera.fov);
      expect(camera.position).toEqual(reference.camera.position);
      expect(projection.getZoom(150)).toBe(reference.projection.getZoom(150));
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    });

    it('keeps a distanceToProjectionPlane above 0', () => {
      const {camera} = cameraFor({...view, distanceToProjectionPlane: 150});

      expect(camera.fov).toBeCloseTo((2 * Math.atan(240 / 150) * 180) / Math.PI);
      expect(camera.position).toEqual(ProjectionPlane.get(plane).getPointByDistance(150));
    });

    it.each([
      {near: 0},
      {near: -1},
      {near: NaN},
      {near: Infinity},
      {far: NaN},
      {far: Infinity},
      {far: -Infinity},
      {near: 0.1, far: 0.1},
      {near: 10, far: 5},
      {near: 200000},
    ])('takes a near of $near and a far of $far as 0.1 and 100000', (values) => {
      const {camera} = cameraFor({...view, ...values});

      expect([camera.near, camera.far]).toEqual([0.1, 100000]);
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    });

    it.each([{near: 1, far: 5000}, {far: 50}, {near: 2}])('keeps a near of $near and a far of $far', (values) => {
      const {camera} = cameraFor({...view, ...values});

      expect([camera.near, camera.far]).toEqual([values.near ?? 0.1, values.far ?? 100000]);
    });

    it('keeps the field of view of a camera it updates once its specs hold a distance of 0', () => {
      const specs: Partial<ParallaxProjectionSpecs> = {...view};
      const {projection, camera} = cameraFor(specs);
      const fov = camera.fov;

      specs.distanceToProjectionPlane = 0;
      projection.updateViewRect(800, 600);
      projection.updateCamera(camera);

      expect(camera.fov).toBe(fov);
    });
  });
```

**`packages/twopoint5d/src/stage/OrthographicProjection.spec.ts`** — am Ende des äußeren
`describe('OrthographicProjection', …)` einen Block anfügen:

```ts
  describe('camera values from the specs', () => {
    const plane = 'xy|bottom-left';
    const view = {fit: 'contain', width: 640} as const;

    const cameraFor = (specs: Partial<OrthographicProjectionSpecs>) => {
      const projection = new OrthographicProjection(plane, specs);
      projection.updateViewRect(800, 600);
      return {projection, camera: projection.createCamera()};
    };

    it.each([NaN, Infinity, -Infinity])('takes a distanceToProjectionPlane of %s as not given', (distance) => {
      const {camera} = cameraFor({...view, distanceToProjectionPlane: distance});

      expect(camera.position).toEqual(ProjectionPlane.get(plane).getPointByDistance(100));
    });

    it.each([0, -100, 300])('keeps a distanceToProjectionPlane of %s', (distance) => {
      const {camera} = cameraFor({...view, distanceToProjectionPlane: distance});

      expect(camera.position).toEqual(ProjectionPlane.get(plane).getPointByDistance(distance));
    });

    it.each([
      {near: NaN},
      {near: Infinity},
      {near: -Infinity},
      {far: NaN},
      {far: Infinity},
      {near: 10, far: 10},
      {near: 10, far: 5},
      {near: 200000},
    ])('takes a near of $near and a far of $far as 0.1 and 100000', (values) => {
      const {camera} = cameraFor({...view, ...values});

      expect([camera.near, camera.far]).toEqual([0.1, 100000]);
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    });

    it.each([{near: 0, far: 1000}, {near: -1000, far: 1000}, {far: 50}])('keeps a near of $near and a far of $far', (values) => {
      const {camera} = cameraFor({...view, ...values});

      expect([camera.near, camera.far]).toEqual([values.near ?? 0.1, values.far ?? 100000]);
    });

    it('gives a camera it updates 0.1 and 100000 once its specs hold a far below the near', () => {
      const specs: Partial<OrthographicProjectionSpecs> = {...view, near: 1, far: 5000};
      const {projection, camera} = cameraFor(specs);
      expect([camera.near, camera.far]).toEqual([1, 5000]);

      specs.far = 0.5;
      projection.updateViewRect(800, 600);
      projection.updateCamera(camera);

      expect([camera.near, camera.far]).toEqual([0.1, 100000]);
    });
  });
```

`ProjectionPlane` ist in beiden Specs schon importiert. Wenn TypeScript eine der
`it.each`-Tabellen mit gemischten Objektformen nicht als Parameter annimmt, die Tabelle als
`Partial<ParallaxProjectionSpecs>[]` bzw. `Partial<OrthographicProjectionSpecs>[]` typisieren
(`satisfies` wie im bestehenden Test `has no view from the specs %j` reicht nicht, weil
`values.near` gelesen wird) — die Fälle selbst bleiben unverändert.

Roter Lauf, **vor** jeder Änderung am Produktionscode:

```bash
pnpm --dir packages/twopoint5d vitest --run src/stage/ParallaxProjection.spec.ts src/stage/OrthographicProjection.spec.ts
```

Erwartet rot: jeder Fall von `takes a distanceToProjectionPlane of %s as not given` (Parallax 5,
orthografisch 3), jeder Fall von `takes a near of $near and a far of $far as 0.1 and 100000`
(Parallax 10, orthografisch 8), `keeps the field of view of a camera it updates once its specs hold
a distance of 0` und `gives a camera it updates 0.1 and 100000 once its specs hold a far below the
near` — zusammen 28. Grün schon vor dem Fix (Wächter): `keeps a distanceToProjectionPlane above 0`,
`keeps a distanceToProjectionPlane of %s` (3), beide `keeps a near of $near and a far of $far`
(je 3). Weicht die Zahl ab, im Report sagen, welcher Fall anders lief und warum. Die Ausgabe des
roten Laufs (Zusammenfassung plus Namen der roten Fälle) gehört in den Report.

### 2. Helfer `isFiniteNumber`

Neue Datei `packages/twopoint5d/src/utils/isFiniteNumber.ts`, nicht in `utils/public-api.ts`
eintragen:

```ts
/**
 * Whether `value` is a finite number — neither `NaN` nor infinite, of any sign.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
```

### 3. `ParallaxProjection.ts`

a) Import ergänzen, alphabetisch zwischen `expectDefined` und `isPositiveFinite`:
`import {isFiniteNumber} from '../utils/isFiniteNumber.js';`

b) Direkt nach den Imports, vor `export type ParallaxProjectionSpecs`:

```ts
// the camera values for specs that leave one out or give one no camera can be built from
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100000;
const DEFAULT_DISTANCE_TO_PROJECTION_PLANE = 300;
```

c) Den Spec-Typ mit TSDoc an den drei Feldern:

```ts
export type ParallaxProjectionSpecs = FitIntoRectangleSpecs & {
  /**
   * How far the camera sits from the projection plane. The field of view follows from it, so that
   * the plane shows the height of the view. Defaults to `300`; a value that is not a finite number
   * above 0 counts as not given.
   */
  distanceToProjectionPlane?: number;
  /**
   * The near plane of the camera. Defaults to `0.1`; a value that is not a finite number above 0
   * counts as not given.
   */
  near?: number;
  /**
   * The far plane of the camera. Defaults to `100000`; a value that is not a finite number counts
   * as not given. A `far` that is not above the `near` in effect sends both back to their defaults.
   */
  far?: number;
};
```

d) TSDoc von `updateViewRect()` (`:46-52`): nach dem Satz, der mit »Until the first call that gives
a view with an area, `getViewRect()` reports `[0, 0, 0, 0]`.« endet, anfügen:
»A call that gives a view with an area also takes `near`, `far` and `distanceToProjectionPlane`
from the specs; a value no camera can be built from counts as not given, as
`ParallaxProjectionSpecs` describes.«

e) In `updateViewRect()` die Zeilen `:69-72` (`this.#near = …`, `this.#far = …`, Leerzeile,
`this.#distanceToProjectionPlane = …`) ersetzen durch:

```ts
    // a perspective camera divides by its near, by the depth from near to far and, for the field of
    // view below, by the distance: each needs a finite number above 0
    const {near, far, distanceToProjectionPlane} = this.viewSpecs;

    this.#near = isPositiveFinite(near) ? near : DEFAULT_NEAR;
    this.#far = isFiniteNumber(far) ? far : DEFAULT_FAR;
    if (this.#far <= this.#near) {
      this.#near = DEFAULT_NEAR;
      this.#far = DEFAULT_FAR;
    }

    this.#distanceToProjectionPlane = isPositiveFinite(distanceToProjectionPlane)
      ? distanceToProjectionPlane
      : DEFAULT_DISTANCE_TO_PROJECTION_PLANE;
```

Die Zeilen davor (Early Returns, View, Pixel-Ratio) und danach (`#aspect`, `#fovy`) bleiben, wie
sie sind. `createCamera()`, `updateCamera()` und `getZoom()` samt `// TODO add jsdoc` nicht
anfassen.

### 4. `OrthographicProjection.ts`

a) Import wie oben: `import {isFiniteNumber} from '../utils/isFiniteNumber.js';` zwischen
`expectDefined` und `isPositiveFinite`.

b) Direkt nach den Imports, vor `export type OrthographicProjectionSpecs`:

```ts
// the camera values for specs that leave one out or give one no camera can be built from
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100000;
const DEFAULT_DISTANCE_TO_PROJECTION_PLANE = 100;
```

c) Spec-Typ:

```ts
export type OrthographicProjectionSpecs = FitIntoRectangleSpecs & {
  /**
   * How far the camera sits from the projection plane. Defaults to `100`; a value that is not a
   * finite number counts as not given. 0 and negative values are kept.
   */
  distanceToProjectionPlane?: number;
  /**
   * The near plane of the camera. Defaults to `0.1`; a value that is not a finite number counts as
   * not given. 0 and negative values are kept: an orthographic camera also shows what lies behind
   * its position.
   */
  near?: number;
  /**
   * The far plane of the camera. Defaults to `100000`; a value that is not a finite number counts
   * as not given. A `far` that is not above the `near` in effect sends both back to their defaults.
   */
  far?: number;
};
```

d) TSDoc von `updateViewRect()` (`:44-50`): denselben Satz anfügen wie bei der Parallax-Projektion,
mit `OrthographicProjectionSpecs` statt `ParallaxProjectionSpecs`.

e) In `updateViewRect()` die Zeilen `:68-71` ersetzen durch:

```ts
    // an orthographic camera divides by the depth from near to far; its near and the distance may be
    // 0 or below, but none of the three may be infinite or NaN
    const {near, far, distanceToProjectionPlane} = this.viewSpecs;

    this.#near = isFiniteNumber(near) ? near : DEFAULT_NEAR;
    this.#far = isFiniteNumber(far) ? far : DEFAULT_FAR;
    if (this.#far <= this.#near) {
      this.#near = DEFAULT_NEAR;
      this.#far = DEFAULT_FAR;
    }

    this.#distanceToProjectionPlane = isFiniteNumber(distanceToProjectionPlane)
      ? distanceToProjectionPlane
      : DEFAULT_DISTANCE_TO_PROJECTION_PLANE;
```

`createCamera()`, `updateCamera()` und `getZoom()` nicht anfassen.

### 5. Grün sehen

Dasselbe Vitest-Kommando wie in Schritt 1: alle Fälle grün, auch die bestehenden Tests beider
Specs (`getZoom` mit Distanz 300, `keeps its view while the container has no area` u. a.).

### 6. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]` → `### Fixed`: direkt nach dem
Eintrag, der mit »- fix `OrthographicProjection#updateViewRect()` and
`ParallaxProjection#updateViewRect()` for a container or a view without area« beginnt, eine neue
Zeile:

```markdown
- fix `ParallaxProjection` and `OrthographicProjection` for camera values in their specs that no camera can be built from: a `distanceToProjectionPlane`, `near` or `far` that is not a finite number counts as not given, and so does a `distanceToProjectionPlane` or `near` of 0 or below on a `ParallaxProjection`, whose field of view follows from that distance. A `far` that is not above the `near` in effect sends both back to their defaults, `0.1` and `100000`
```

Keinen Eintrag unter `### Changed`, keinen Migration Guide.

### 7. Verify

`pnpm run ci` im Root des Repos, Exit 0.

## Findings im Volltext

Kein Audit-Finding. Der Queue-Eintrag aus `./remediation-plan.md`, »Offene Befunde«, im Wortlaut:

**Nebenbefund · low · `packages/twopoint5d/src/stage/ParallaxProjection.ts:72`, `:76` (Stand
`69e27081`)** — `distanceToProjectionPlane` aus den Specs geht ungeprüft in
`#fovy = 2 · atan(#halfHeight / distance)`: `0` ergibt einen `fov` von 180°, ein negativer Wert
einen negativen `fov`; `getZoom()` rechnet mit demselben Wert · aus Paket 12 (Zug 0, vorbestehend
seit e352b56) · → Scope → Paket 19

**Mitgenommen · low · `packages/twopoint5d/src/stage/ParallaxProjection.ts:69-70`** (Zug 0 dieses
Pakets, vorbestehend seit `e352b56:44-45`) — `near` und `far` gehen ungeprüft in die
`PerspectiveCamera`: `near` 0 oder `NaN`, `far` `NaN` oder unendlich ergeben eine Projektionsmatrix
mit `NaN`/`Infinity`, `far` gleich `near` eine Division durch 0, `far` unter `near` (auch `near`
über dem Default-`far` 100000) eine umgedrehte Tiefe, in der nichts sichtbar ist.

**Mitgenommen · low · `packages/twopoint5d/src/stage/OrthographicProjection.ts:68-71`** (Zug 0
dieses Pakets, vorbestehend seit `e352b56:43-46`) — `near`, `far` und `distanceToProjectionPlane`
gehen ungeprüft in die `OrthographicCamera`: ein nicht endlicher Wert ergibt eine Matrix bzw.
Position mit `NaN`/`Infinity`, `far` gleich `near` eine Division durch 0, `far` unter `near` eine
umgedrehte Tiefe. 0 und negative Werte für `near` und die Distanz sind für eine orthografische
Kamera gültig und bleiben erlaubt.
