# Paket 4 — map2d: Den Visibility-Helfern ein `dispose()` geben

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: MEM-004 (low), CONS-036 (info), CONS-022 (low)
- Ziel: Wer eine Helpers-Instanz fallen lässt, hinterlässt keine GPU-Geometrie,
  auf die nichts mehr zeigt.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/types.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts` (+ `.spec.ts`)
  - `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit:

  ```
  fix(map2d): let the visibility helpers give up the nodes they built

  Both IMap2DVisibilitorHelpers implementations take a dispose(): it hands the
  helper set to its HelpersManager, which takes every node out of the scene
  graph and releases the geometry and the material behind it, and it gives up
  the scene the set was handed. A disposed instance stays down — show, add(),
  remove() and update() do nothing, isDisposed says so, and a second dispose()
  releases nothing a second time.

  The visibility, the visibility area and the scene were handed in and stay
  the caller's.

  BREAKING CHANGE: IMap2DVisibilitorHelpers declares dispose(); an
  implementation of your own has to bring one, an empty body where there is
  nothing to release.
  ```

- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · MEM-004 unverändert, Fundstellen jetzt
    `types.ts:173-197` (Interface, durch TSDoc-Zuwachs verschoben),
    `CameraBasedVisibilityHelpers.ts:97-106`, `RectangularVisibilityAreaHelpers.ts:26-33`,
    `HelpersManager.ts:8-12` — alle drei letzten unverändert · CONS-036
    unverändert an `CameraBasedVisibilityHelpers.ts:249-254`, die drei Aufrufe
    stehen an `:140,142,143` und geben je einen `Vector2` · CONS-022
    unverändert an `CameraBasedVisibilityHelpers.spec.ts:62` · keine offenen
    `Folgen:` im Plan zu triagieren (Paket 1, 2 und 3 melden je »keine« bzw.
    »Nichts offen«) · von den elf Einträgen in »Offene Befunde« teilt keiner
    die Ursache dieses Pakets, alle bleiben liegen · ein neuer Nebenbefund
    gefunden und in die Queue gelegt (`RectangularVisibilityAreaHelpers#update()`
    ohne `show`-Gate) · Restplan unverändert
  - 2026-09-20 Zug 1: Implementierer beauftragt, Modell opus, Effort medium,
    Report `paket-4.impl-1.json`, session_id
    `8b75882d-672d-4537-9fa3-2837d76a81ff`
  - 2026-09-20 Zug 2: Report FERTIG · geändert:
    `packages/twopoint5d/src/map2d/types.ts`,
    `CameraBasedVisibilityHelpers.ts` (+ `.spec.ts`),
    `RectangularVisibilityAreaHelpers.ts` (+ `.spec.ts`),
    `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`,
    `packages/twopoint5d/CHANGELOG.md`; keine neuen Dateien · Arbeitsbaum
    schmutzig · eigener Verify-Lauf `pnpm run ci` exit=0
    (`paket-4.verify.log`)
  - 2026-09-20 Zug 3: Reviewer (opus, medium), Diff `paket-4.diff` (718 Zeilen),
    Report `paket-4.review-1.json` · alle drei Findings erfüllt · zwei
    `wichtig` (CHANGELOG-Eintrag schrieb `isDisposed` dem Interface zu;
    Commit-Message ohne `BREAKING CHANGE:`-Footer), drei `klein`
  - 2026-09-20 Zug 4, Runde 1: offen waren zwei `wichtig`. Der CHANGELOG-Befund
    ging per `--resume` an denselben Implementierer (Report
    `paket-4.impl-2.json`), der Commit-Message-Befund an mich — die
    Commit-Message steht in dieser Paketdatei und ist kein Projektcode. Zurück
    kam FERTIG; der `klein`-Befund zum Migration Guide lief zur Formulierung
    mit. Verify erneut `pnpm run ci` exit=0 (`paket-4.verify-2.log`), neuer Diff
    `paket-4.diff-2`, Reviewer Runde 1 (`paket-4.review-2.json`): beide
    `wichtig` erledigt, alle drei Findings weiter erfüllt, kein neuer
    `kritisch` oder `wichtig`. Offene Befunde 2 → 0, Kette beendet.
  - 2026-09-20 Zug 5: committet als `51ab0388`

## Vorgehen

MEM-004 ist ein Ressourcenfehler, also gilt die Reihenfolge: **erst die Tests,
rot sehen, die Ausgabe des roten Laufs in den Report, dann der Code.** Rot
sieht hier so aus: `TypeError: helpers.dispose is not a function`. Ein
einzelner Vitest-Lauf während der Arbeit geht über
`pnpm nx test twopoint5d -- src/map2d/<datei>.spec.ts`.

CONS-036 und CONS-022 sind toter Code ohne Laufzeitwirkung — für sie gibt es
keinen roten Lauf und es wird auch keiner gebaut. Ihr Gate ist `pnpm run ci`.

### Schritt 1 — die Vitest-Specs, bevor es etwas zu testen gibt

In `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts` ein
neues `describe('dispose()')` ans Ende des bestehenden
`describe('CameraBasedVisibilityHelpers')`. Die Datei spiont seit jeher über
den vorhandenen Helfer `spyOnReleases()` mit `vi.spyOn`; die neuen Tests
benutzen denselben Helfer, statt eine zweite Spy-Bibliothek in dieselbe Datei
zu ziehen. Das widerspricht §7 des Lifecycle-Dokuments nicht: die
Sandbox-Regel dort gilt Spies auf dem Objekt unter Test, und hier werden
Geometrie und Material von three.js-Knoten beobachtet.

Vier Tests, die Buchstaben sind die Assertionen aus §7:

- (a) `'releases the geometry and the material of every node it built'` —
  `add(scene)`, `show = true`, `spyOnReleases(scene)`, `dispose()`. Danach:
  `scene.children` ist leer, und für jeden beobachteten Knoten wurde
  `geometry.dispose` und `material.dispose` genau einmal gerufen.
- (b) `'leaves the scene it was handed and the visibility it reads alone'` —
  ein eigener `Object3D` wird der Szene vor dem `dispose()` hinzugefügt, also
  ein Knoten, den die Helfer nie gebaut haben. Nach `dispose()` steht genau
  dieser eine Knoten noch in `scene.children`, und die Szene selbst ist
  weiterhin brauchbar. Dazu: das Objekt aus `makeVisibility()` ist nach dem
  `dispose()` unverändert — `helpers.cameraBasedVisibility` zeigt noch darauf.
- (c) `'stays down after dispose()'` — nach `dispose()` gilt:
  `helpers.isDisposed === true`, `helpers.show === false`; ein `show = true`,
  ein `add(new Object3D())`, ein `remove(scene)` und ein `update()` werfen
  nicht und bauen nichts: `scene.children` bleibt leer und die neue Szene
  bleibt leer.
- (d) `'a second dispose() releases nothing a second time'` — `spyOnReleases()`
  vor dem ersten `dispose()`, dann zweimal `dispose()`; jeder Spy steht bei
  genau eins, und der zweite Aufruf wirft nicht.

In `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.spec.ts`
dieselben vier Tests in der Form, die diese Klasse hergibt. Die Datei hat noch
keinen `spyOnReleases()`; er wird dort in derselben Gestalt angelegt wie im
Nachbarmodul (Rückgabe pro Knoten: `geometry`- und `material`-Spy, **kein**
`type`-Feld — siehe Schritt 5). Der Aufbau je Test:
`const scene = new Object3D(); const helpers = new RectangularVisibilityAreaHelpers(makeArea()); helpers.add(scene); helpers.show = true;`
— mit `show = true` baut die Klasse über ihren eigenen Setter einen
`Box3Helper`, das ist der Knoten, dessen Freigabe (a) prüft.

### Schritt 2 — das Interface bekommt `dispose()`

In `packages/twopoint5d/src/map2d/types.ts`, in `IMap2DVisibilitorHelpers`,
direkt nach `update()` und vor `show`:

```ts
  /**
   * Takes the helper nodes down for good and releases what they hold. The nodes of a helper
   * set are geometry and material on the gpu, and they hang on nothing but this instance —
   * whoever drops it without this call leaves them behind.
   *
   * It may be called any number of times. Afterwards the set stays down: `show`, {@link add},
   * {@link remove} and {@link update} do nothing.
   *
   * Whatever was handed in — the scene of {@link add} and the visibilitor the set reads — is
   * the caller's and is left as it is.
   */
  dispose(): void;
```

`show` bleibt, wie es ist: das Feld schaltet die Anzeige, `dispose()` beendet
sie. Beide Implementierungen im Repository sind die beiden unten; ein
`dispose()` in `HelpersManager` entsteht **nicht** — der Manager besitzt keine
eigene Ressource, und `scene = undefined` nimmt seinen ganzen Satz herunter
und disposed dabei jeden Knoten, den er hereinbekommen hat.

### Schritt 3 — `CameraBasedVisibilityHelpers`

Neues privates Feld neben `#show`:

```ts
  #disposed = false;
```

Der Getter dazu, mit TSDoc (»`true` once {@link dispose} has run«):

```ts
  get isDisposed(): boolean {
    return this.#disposed;
  }
```

Er kommt mit, obwohl §2 des Lifecycle-Dokuments ihn nicht auf jeder Klasse
sehen will: `show === false` ist hier zweideutig — ausgeschaltet oder tot —,
und genau darauf muss ein Aufrufer verzweigen, der eine Instanz übernimmt.
Dieselbe Form tragen `Stage2D`, `Canvas2DStage`, `StageRenderer` und `Display`.

`dispose()` ans Ende der Klasse, hinter `update()`:

```ts
  /**
   * Takes the whole set down for good and gives up the scene it was handed. The manager
   * disposes every node it takes down, so geometry and material of the helper nodes go with
   * this call; the visibility this instance reads was handed in and is left as it is.
   *
   * Afterwards {@link isDisposed} is `true` and {@link show} answers `false`, while a write to
   * `show`, {@link add}, {@link remove}, {@link update} and a second {@link dispose} do
   * nothing. The public fields of this class still take values, and none of them has an effect
   * any more.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#show = false;
    // the manager takes every node out of the scene and the root above it and disposes it
    this.#helpers.scene = undefined;
    this.releasePools();
  }
```

`#show` wird direkt geschrieben und nicht über den Setter: der würde dieselbe
Arbeit ein zweites Mal anstoßen, und nach dem Guard aus dem nächsten Absatz
täte er gar nichts mehr.

Die Guards, je als erste Zeile:

- `set show(show: boolean)`: `if (this.#disposed) return;`
- `add(scene: Object3D)`: `if (this.#disposed) return;`
- `remove(scene: Object3D)`: `if (this.#disposed) return;`
- `update()`: `if (this.#disposed) return;`

Alle vier explizit, auch wo die vorhandene Logik nach dem `dispose()` ohnehin
leer liefe: die TSDoc-Zusage »tut nichts« soll an der Methode selbst ablesbar
sein und nicht aus dem Zustand eines Nachbarfelds folgen.

Die TSDoc der vier Member bekommt je einen Satz zum Zustand nach `dispose()`
(Checkliste §6 Punkt 6). `cameraBasedVisibility` behält seinen Wert und wird
nicht disposed — das steht im TSDoc von `dispose()` und braucht am Feld keine
zweite Zeile.

Was **nicht** entsteht: kein `dispose`-Event und kein `off(this)` (die Klasse
führt keine Events), kein `SignalGroup.delete()` (keine Signals; `Dependencies`
ist eine gewöhnliche Klasse), kein `super.dispose()` (keine Basisklasse), keine
Promise-Ablehnung (die Klasse hält keine).

### Schritt 4 — `RectangularVisibilityAreaHelpers`

Dieselbe Form, an die kleinere Klasse angepasst:

```ts
  #disposed = false;
```

```ts
  get isDisposed(): boolean {
    return this.#disposed;
  }
```

```ts
  /**
   * Takes the helper down for good and gives up the scene it was handed. The manager disposes
   * the node it takes down, so geometry and material go with this call; the visibility area
   * this instance reads was handed in and is left as it is.
   *
   * Afterwards {@link isDisposed} is `true` and {@link show} answers `false`, while a write to
   * `show`, {@link add}, {@link remove}, {@link update} and a second {@link dispose} do
   * nothing.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#show = false;
    // the manager takes the node out of the scene and disposes it
    this.#helpers.scene = undefined;
    this.#viewRect = undefined;
  }
```

Guards als erste Zeile in `set show`, `add()`, `remove()` und `update()`,
dazu je ein Satz in der TSDoc. Die Klasse hat bislang keine TSDoc an ihren
Membern; sie bekommt sie an genau diesen vieren, nicht an den öffentlichen
Feldern.

Die Klasse deklariert `implements IMap2DVisibilitorHelpers` bereits — mit
Schritt 2 erzwingt der Typecheck das neue Mitglied hier und im Nachbarmodul.

### Schritt 5 — CONS-022: das tote Feld im Testhelfer

`packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts:62`: die
Zeile `type: node.type,` aus dem Rückgabeobjekt von `spyOnReleases()`
entfernen. Kein Test liest das Feld; die Konsumenten des Rückgabewerts lesen
`geometry` und `material` (`:104-109`, `:125-128`, `:151-154`, `:263`, `:274`,
`:303`, `:321`). `node.type` wird an den anderen Stellen der Datei weiter
benutzt und bleibt dort unberührt.

### Schritt 6 — CONS-036: der optionale Parameter, den nie jemand weglässt

`packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:249-254`:

```ts
  private makePointOnPlane(point: Vector2): Vector3 {
    return new Vector3(
      this.cameraBasedVisibility.map2dTileCoords.xOffset + point.x,
      0,
      this.cameraBasedVisibility.map2dTileCoords.yOffset + point.y,
    ).applyMatrix4(this.cameraBasedVisibility.matrixWorld);
  }
```

Die drei Aufrufe an `:140`, `:142` und `:143` geben je einen `Vector2` und
bleiben, wie sie sind. Die Methode ist `private`, die öffentliche Oberfläche
bewegt sich dadurch nicht.

### Schritt 7 — der Browser-Test auf echter GPU

`packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js` bekommt
einen vierten Fall, in der Machart der drei vorhandenen (`makeMap(camera)`,
`scene.add(map2d)`, zwei Aufwärmframes über `frame(map2d, helpers)`):

```js
  it('dispose() takes the whole set down and releases what it built', async function () {
    const {map2d, visibility} = makeMap(camera);
    scene.add(map2d);

    const helpers = new CameraBasedVisibilityHelpers(visibility);
    helpers.add(map2d);
    helpers.show = true;

    await frame(map2d, helpers);
    await frame(map2d, helpers);

    const before = helperNodes(scene, map2d);
    expect(before.length, 'helper nodes after the warm-up frames').to.be.greaterThan(0);

    // three.js announces a release through the dispose event of the geometry itself, which is
    // what a renderer listens to before it drops the buffers behind it
    const withGeometry = before.filter((node) => node.geometry != null);
    const released = new Set();
    for (const node of withGeometry) {
      node.geometry.addEventListener('dispose', () => released.add(node.geometry));
    }

    helpers.dispose();

    expect(helperNodes(scene, map2d).length, 'no helper node is left in the scene graph').to.equal(0);
    expect(released.size, 'every geometry of the set was released').to.equal(withGeometry.length);

    // the map goes on without them, and nothing builds a second set
    map2d.centerX = 1024;
    await frame(map2d, helpers);

    expect(helperNodes(scene, map2d).length, 'and none came back').to.equal(0);
  });
```

Der Lauf nach dem `dispose()` ist der eigentliche Beleg: er rendert mit einem
Renderer, dessen Buffer gerade freigegeben wurden, und muss durchlaufen.
Kommando: `pnpm run test:browser` (steckt in `pnpm run ci`).

### Schritt 8 — CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`.

Unter `### Added`, in der Machart der Nachbarzeilen (ein Absatz, der die
Zusage ganz aufschreibt):

> add `dispose()` and `isDisposed` to `IMap2DVisibilitorHelpers` and both
> implementations, `CameraBasedVisibilityHelpers` and
> `RectangularVisibilityAreaHelpers`: `dispose()` takes the helper set out of
> the scene graph and releases the geometry and the material of every node it
> built — the only things a helper set owns. The scene it was handed, the
> visibility and the visibility area it reads belong to the caller and are left
> as they are. Afterwards `isDisposed` is `true`, `show` answers `false`, and a
> write to `show`, `add()`, `remove()`, `update()` and a second `dispose()` do
> nothing. The rules behind this are written down in
> [docs/resource-lifecycle.md](https://github.com/spearwolf/twopoint5d/blob/main/packages/twopoint5d/docs/resource-lifecycle.md)

Unter `### Migration Guide` ein `#### `-Abschnitt in der Form der beiden dort
stehenden (Satz, **Before**, **After**): ein eigener `IMap2DVisibilitorHelpers`
braucht ab jetzt ein `dispose()`, weil das Mitglied pflichtig ist; wer nichts
zu geben hat, schreibt einen leeren Rumpf. Beide mitgelieferten
Implementierungen bringen es mit, ein Aufrufer ändert nichts.

## Nebenbefunde und Entscheidungen dieses Zugs

- **Neu in die Queue gelegt:** `RectangularVisibilityAreaHelpers#update()`
  (`:44-60`) prüft `show` nicht und baut bei jedem Aufruf einen neuen
  `Box3Helper` samt Geometrie, während der vorige über `#helpers.remove()`
  fällt. `apps/lookbook/src/demos/map2d-rect-visi.ts:111` geht diesen Pfad in
  jedem Frame, ohne `show` je auf `true` zu setzen: die Demo zeigt Knoten, die
  laut `show` gar nicht da sind, und allokiert eine Geometrie pro Frame. Das
  Schwestermodul gated seinen `update()` mit `if (!this.#show) return;`. Als
  vorbestehend belegt: `git show 3b673f63:packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts`
  zeigt denselben Rumpf. Eigene Ursache — mein Paket behebt »es gibt keinen
  Weg, eine Instanz freizugeben«, nicht »`update()` ignoriert `show`« —, also
  kein Fall für dieses Paket, sondern für die Drain-Runde.
- **Kein `dispose()` für `HelpersManager`.** Er hält nur `#scene` und `#root`,
  zwei hereingereichte Referenzen, und gibt über `scene = undefined` alles her,
  was er je aufgenommen hat. Eine eigene Methode dort hätte nichts zu tun und
  eine dritte Klasse in den Diff gezogen.
- **`isDisposed` kommt mit**, obwohl §2 des Lifecycle-Dokuments ihn nicht als
  Pflichtteil sieht. Grund oben in Schritt 3.
- **Kein Regressionstest für CONS-036 und CONS-022.** Beide sind toter Code
  ohne Laufzeitverhalten; ein Test darauf würde nur festschreiben, dass nichts
  passiert. Typecheck und Lint sind ihr Gate.

## Findings im Volltext

**MEM-004 · low · packages/twopoint5d/src/map2d/types.ts:170-189;
CameraBasedVisibilityHelpers.ts:97-106; RectangularVisibilityAreaHelpers.ts:26-33;
HelpersManager.ts:8-12** — Den Visibility-Helfer-Klassen ein `dispose()` geben,
damit ihre GPU-Geometrien nicht an `show = false` hängen

Beide Helfer-Klassen erzeugen `BoxGeometry`/`MeshBasicMaterial` (PointHelper)
sowie `Box3Helper`/`PlaneHelper`-Knoten mit eigener Geometrie und eigenem
Material. Die einzigen Freigabepfade sind `show = false` oder `remove(scene)`.
`resource-lifecycle.md` bindet jede Klasse mit `dispose()`; diese haben keins,
und wer eine Helpers-Instanz (oder die Map2D, die ihre Knoten hostet) fallen
lässt, ohne `show` umzulegen, lässt GPU-Buffer zurück, auf die nichts mehr
zeigt.

Empfehlung: `dispose()` in `IMap2DVisibilitorHelpers` und beiden
Implementierungen: `dispose() { this.show = false; this.#helpers.scene = undefined; }`.
Assertions (a), (c), (d) aus §7 des Lifecycle-Dokuments mitliefern.

**CONS-036 · info · packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:249-254**
— Den optionalen Parameter von `makePointOnPlane()` pflichtig machen

`makePointOnPlane(point?: Vector2)` bekommt bei allen Aufrufen (Zeile 140-143)
einen `Vector2`; der optionale Parameter und `point?.x ?? 0` sind toter Zweig.
Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: `point: Vector2`, `point.x`/`point.y` direkt.

**CONS-022 · low · packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts:62**
— Ein totes Feld in einem Testhelfer

`spyOnReleases()` legt `type: node.type` in sein Rückgabeobjekt, und kein Test
liest das Feld je. Re-Check: unverändert.

Empfehlung: Zeile entfernen.

## Abweichungen von der Empfehlung des Audits

Die Empfehlung zu MEM-004 nennt den Rumpf
`dispose() { this.show = false; this.#helpers.scene = undefined; }`. Umgesetzt
wird eine strengere Fassung, aus zwei Gründen:

1. `this.show = false` läuft über den Setter und tut nichts, wenn `show` schon
   `false` war — und beide Klassen können in diesem Zustand Knoten stehen
   haben: `CameraBasedVisibilityHelpers` nach einem `add()` auf eine zweite
   Szene, `RectangularVisibilityAreaHelpers` nach jedem `update()`, das die
   Demo in jedem Frame ruft. `dispose()` schreibt `#show` deshalb direkt und
   räumt über den Manager, nicht über den Setter.
2. Ohne Flag bliebe die Instanz wiederbelebbar: ein `add(scene)` nach dem
   `dispose()` nähme eine neue Szene an und der nächste `update()` baute den
   Satz erneut. §3 des Lifecycle-Dokuments verlangt für jedes öffentliche
   Mitglied ein festgelegtes Verhalten nach `dispose()`; hier ist es für alle
   vier der stille No-Op.

Assertion (b) aus §7 kommt zu den drei genannten dazu: beide Klassen bekommen
ihre Szene und ihren Visibilitor hereingereicht, und dass `dispose()` beide in
Ruhe lässt, ist die eine Zusage, die ein Aufrufer sonst nur glauben kann.

## Urteil des Reviewers

Zwei Reviewer-Prozesse, beide opus/medium. Je Finding-ID, im Stand des Commits
`51ab0388`:

- **MEM-004 — behoben.** `dispose(): void` im Interface
  `IMap2DVisibilitorHelpers` (`packages/twopoint5d/src/map2d/types.ts:195-206`),
  `#disposed` samt Getter `isDisposed` und `dispose()` in
  `CameraBasedVisibilityHelpers.ts:36`, `:95`, `:346-355` und in
  `RectangularVisibilityAreaHelpers.ts:16`, `:24`, `:104-113`. Guards als je
  erste Zeile in `set show`, `add()`, `remove()`, `update()`
  (`CameraBasedVisibilityHelpers.ts:110,278,297,312`;
  `RectangularVisibilityAreaHelpers.ts:39,54,64,75`). Der Freigabepfad ist
  nachgegangen: `#helpers.scene = undefined` läuft über
  `HelpersManager.removeFromScene()` (`HelpersManager.ts:64-81`), das jeden
  markierten Knoten aus Szene **und** Root nimmt und sein `dispose()` ruft;
  `PointHelper.dispose()` (`CameraBasedVisibilityHelpers.ts:24-31`) gibt
  Geometrie und Material her, `Box3Helper`/`PlaneHelper` bringen das von
  three.js mit. Kein gepoolter Knoten bleibt außerhalb des Szenengraphen
  zurück — jeder Pool-Eintrag wird bei seiner Entstehung sofort an den Manager
  übergeben (`:203`, `:229`). Assertionen (a)–(d) in
  `CameraBasedVisibilityHelpers.spec.ts:326-420` und
  `RectangularVisibilityAreaHelpers.spec.ts:40-138`, GPU-Beleg als vierter Fall
  in `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js:217-250`.
- **CONS-036 — behoben.** `CameraBasedVisibilityHelpers.ts:262-268`:
  `private makePointOnPlane(point: Vector2): Vector3`, Rumpf liest `point.x`
  und `point.y` direkt, kein `?? 0`. Die drei Aufrufe an `:153`, `:155`, `:156`
  geben unverändert je einen `Vector2`.
- **CONS-022 — behoben.** `CameraBasedVisibilityHelpers.spec.ts:57-65`:
  `spyOnReleases()` gibt nur noch `{geometry, material}` zurück. `node.type`
  wird an `:40`, `:95`, `:147`, `:168` weiter benutzt und ist unberührt; der
  neue Zwilling in `RectangularVisibilityAreaHelpers.spec.ts:13-22` hat das
  Feld gar nicht erst.

## Kleine Befunde, stehengelassen

- `packages/twopoint5d/src/map2d/types.ts:200` gegen
  `packages/twopoint5d/CHANGELOG.md:253`: die TSDoc des Interfaces verlangt
  streng »Afterwards the set stays down: `show`, add, remove and update do
  nothing«, das Beispiel im Migration Guide zeigt `show = false` als schlichtes
  Feld und einen leeren `dispose()`-Rumpf. Runde 1 hat dem Guide einen Halbsatz
  gegeben (»whoever owns nothing has nothing to take down, and `show` stays what
  the caller writes«) — damit steht die lockere Lesart ausgesprochen neben der
  strengen, statt dass eine von beiden gewinnt. Auflösbar in einer Zeile: die
  Interface-TSDoc um »an implementation that holds nothing has nothing to keep
  down« erweitern. Kein Auftrag an dieses Paket, weil beide mitgelieferten
  Klassen die strenge Fassung erfüllen und niemand sonst das Interface
  implementiert.
- `packages/twopoint5d/src/map2d/types.ts:177-210`: `isDisposed` steht nicht im
  Interface. Wer eine `IMap2DVisibilitorHelpers` übernimmt, ohne die konkrete
  Klasse zu kennen, kann »ausgeschaltet« und »tot« nicht auseinanderhalten.
  Entschärft dadurch, dass nach `dispose()` alle vier Member stille No-Ops sind
  und `dispose()` idempotent ist: eine Verzweigung ist nirgends nötig, sie wäre
  nur informativ. Schritt 2 des Detailplans nimmt bewusst nur `dispose()` ins
  Interface; das anders zu entscheiden hieße, die öffentliche Oberfläche weiter
  zu bewegen, als das Paket freigegeben ist.
- `apps/lookbook/src/demos/map2d-rect-visi.ts:66-67`: der einzige Aufrufer im
  Repository ruft kein `dispose()`. Die Demo hält ihre Helfer-Instanz für die
  Lebensdauer der Seite und hat keinen Teardown-Hook, an den der Aufruf gehörte;
  nichts bricht, und der Umbau musste hier nichts mitnehmen.

Dazu eine Notiz ohne Auftrag: der `vi.spyOn`-Helfer, den
`RectangularVisibilityAreaHelpers.spec.ts` neu mitbringt, weicht von der
Sinon-Sandbox aus §7 des Lifecycle-Dokuments ab. Gedeckt durch die Begründung
in Schritt 1; jeder Spy sitzt auf einem testlokalen three.js-Knoten, es leakt
nichts über den Test hinaus, und die Form deckt sich mit dem Nachbarmodul.

## Nebenbefunde dieses Pakets

Beide an
`git show 3b673f63:packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts`
als vorbestehend belegt, beide in »Offene Befunde« des Plans eingetragen:

- `:52-60` — `set show` ruft `update()`, bevor es `#show` schreibt. Der
  Basisstand zeigt denselben Rumpf. Eigene Ursache: mein Paket behebt »es gibt
  keinen Weg, eine Instanz freizugeben«, nicht »der Setter schreibt in der
  falschen Reihenfolge«. Hängt am Queue-Eintrag zum fehlenden `show`-Gate in
  `update()` und muss mit ihm zusammen gefixt werden — wer nur das Gate
  einbaut, bricht `show = true`.
- `:75` — `remove(scene)` prüft die Szene nicht gegen die gehandelte. Der
  Basisstand zeigt denselben Rumpf. Vom Interface-TSDoc formal freigestellt,
  deshalb Urteil `info`, aber eine Asymmetrie zum Schwestermodul.
