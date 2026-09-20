# Paket 8 — stage: Projektionen und Canvas2DStage in den Gleichschritt bringen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: CONS-025 (low), CONS-026 (low), CONS-043 (info)
- Ziel: `updateCamera()` wendet dieselben Specs an wie `createCamera()`, und die
  Canvas2DStage hält Stage- und Renderer-Größe zusammen.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.spec.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts`
  - `packages/twopoint5d/src/stage/OrthographicProjection.spec.ts`
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts`
  - `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(stage): let a projection place the camera it updates, and size the canvas stage through its renderer`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · CONS-025 unverändert, alle drei
    Fundstellen gewandert (`ParallaxProjection.ts:127-131`,
    `OrthographicProjection.ts:129-137`, Aufrufpunkt `Stage2D.ts:206-212` — Paket 2
    hat `Stage2D` verlängert) · CONS-026 unverändert an
    `Canvas2DStage.ts:149-153`, Renderaufruf `:184` · CONS-043 unverändert, beide
    Zeilen nachgemessen: 108 Zeichen gegen 87–99 im Rest des Blocks · kein
    Nebenbefund aus der Queue kommt herein · die einzige offene `Folgen:`-Zeile
    des Laufs (Paket 7) triagiert und nicht verteilt · Restplan unverändert,
    Paket 9 bleibt, wie es steht
  - 2026-09-20 Zug 1: Implementierer beauftragt · `claude -p`, Modell mittlere
    Stufe (sonnet), Effort medium · Brief
    `<arbeitsdir>/paket-8.impl-1.brief.txt`, Report nach
    `<arbeitsdir>/paket-8.impl-1.json`
  - 2026-09-20 Zug 2: Report `FERTIG_MIT_VORBEHALT` · sieben Dateien geändert,
    keine neue (`ParallaxProjection.ts` + Spec, `OrthographicProjection.ts` +
    Spec, `Canvas2DStage.ts` + Spec, `packages/twopoint5d/CHANGELOG.md`) ·
    Arbeitsbaum jetzt schmutzig, genau diese sieben · roter Lauf vor dem Fix
    `pnpm nx test twopoint5d -- src/stage/`: 8 failed | 260 passed · eigener
    Verify-Lauf `pnpm run ci` exit=0, alle elf Ziele grün, Log
    `<arbeitsdir>/paket-8.verify.log`
  - 2026-09-20 Zug 3: Reviewer beauftragt · Diff
    `<arbeitsdir>/paket-8.diff` (565 Zeilen, 7 Dateien), Modell mittlere Stufe
    (sonnet), Effort medium, Report nach `<arbeitsdir>/paket-8.review-1.json` ·
    Urteil: alle drei Findings behoben, kein kritischer und kein wichtiger
    Befund, zwei kleine, Fazit »freigeben«
  - 2026-09-20 Zug 4: keine Runde · der Reviewer hat weder ein unerfülltes
    Finding noch einen kritischen oder wichtigen Befund gemeldet; die beiden
    kleinen stehen unter »Anmerkungen des Reviewers« und bleiben stehen
  - 2026-09-20 Zug 5: committet als `d5dcd2ab` · sieben Dateien, 225 Zeilen dazu,
    34 weg · kein zweiter Verify-Lauf nötig: der Lauf aus Zug 2
    (`<arbeitsdir>/paket-8.verify.log`, exit=0, 13:06) ist jünger als jede
    Codeänderung (spätestens 13:03), und zwischen ihm und dem Commit lag keine
    Runde und kein eigener Griff in eine Datei · Arbeitsbaum danach sauber, nur
    die ungetrackten Lauf-Dateien

## Abgleich

**CONS-025 — unverändert, Fundstellen gewandert.** `ParallaxProjection#updateCamera()`
liegt heute auf `ParallaxProjection.ts:127-131` und setzt `fov`, `aspect` und
`updateProjectionMatrix()` — `near`, `far`, Rotation und Position bleiben, wie sie
sind. `OrthographicProjection#updateCamera()` liegt auf
`OrthographicProjection.ts:129-137` und setzt Frustum plus `near`/`far`, aber
weder Rotation noch Position. Beide verengen ihren Parameter (`PerspectiveCamera`
bzw. `OrthographicCamera`), während `IProjection#updateCamera()` in
`IProjection.ts:12` `Camera` sagt; der Aufruf in `Stage2D.ts:207` reicht `Camera`
hinein und compiliert allein über die Methoden-Bivarianz von TypeScript.

**CONS-026 — unverändert.** `Canvas2DStage#setContainerSize()` steht auf
`Canvas2DStage.ts:149-153` und ruft `this.stage.resize(width, height)` direkt.
`this.stageRenderer.width`/`.height` bleiben damit auf ihrem Initialwert 0
(`StageRenderer.ts:87-88`), obwohl `render()` auf `:184` über
`stageRenderer.renderTo()` geht. Paket 2 hat die Datei angefasst, aber nur am
`dispose()`-Ende; die Zeilennummern der Fundstelle stimmen noch.

**CONS-043 — unverändert, nachgemessen.** `ParallaxProjection.ts:71` und
`OrthographicProjection.ts:69` sind je 108 Zeichen lang, die übrigen Zeilen
desselben TSDoc-Blocks liegen bei 87 bis 99. Prettier bricht Kommentartext nicht
um (`printWidth: 130` greift hier nicht), das ist Handarbeit.

## Was Zug 0 entschieden hat

**`#applyToCamera()` wendet das volle Setup an, Position eingeschlossen.** Die
Empfehlung des Audits nennt Rotation und Position ausdrücklich, und der Kern des
Findings hängt daran: ändert jemand `viewSpecs.distanceToProjectionPlane` und
setzt `stage.needsUpdate = true`, wandert heute der `fov` der Parallax-Kamera,
ohne dass die Kamera mitgeht — die Projektionsebene bildet danach nicht mehr 1:1
auf View-Einheiten ab. Das lässt sich nur durch Verschieben beheben. Der Preis
ist sichtbar: eine vom Aufrufer an `stage.camera` gehängte Kamera wird ab jetzt
von jedem Resize an die Projektionsebene zurückgeholt. Das ist gewollt — eine
Stage mit Projektion führt ihre Kamera, und `Stage2D.ts:206-207` ruft
`updateCamera()` auf der Override-Kamera genauso wie auf der eigenen. Wer eine
Kamera selbst steuern will, gibt der Stage keine Projektion. Der
Migrationsabschnitt im CHANGELOG hält den Handgriff fest.

**`applyRotation()` ist relativ, das Setup muss absolut werden.** Das ist die
Falle dieses Pakets. `ProjectionPlane#applyRotation()` (`ProjectionPlane.ts:53-59`)
geht über `Object3D#applyQuaternion()`, und das multipliziert auf die Orientierung,
die das Objekt schon trägt. In `createCamera()` fällt das nicht auf, weil eine
frische Kamera die Identität trägt. In `updateCamera()` würde jeder Aufruf die
Kamera ein weiteres Mal drehen. `#applyToCamera()` setzt die Quaternion deshalb
zuerst auf die Identität zurück; `ProjectionPlane` selbst bleibt unangetastet, ein
neues öffentliches Symbol dort wäre für diesen einen Aufrufer zu viel.

**Der Guard wirft, und zwar in `updateCamera()`, nicht in `#applyToCamera()`.**
Die Zeile in »Entscheidungen« verlangt einen Error mit Namen des Aufrufs und des
Zustands. `createCamera()` baut seine Kamera selbst und kann den falschen Typ
nicht erreichen, also steht der Check an der einen Stelle, an der er greifen kann
— dann stimmt auch der Aufrufname in der Meldung immer. `TypeError` statt `Error`:
es geht um einen Typ, und `assertPositiveFinite` hat für den Wertebereich
`RangeError` etabliert.

**Die Parametertypen werden geweitet, nicht verengt gelassen.** `updateCamera()`
nimmt in beiden Klassen ab jetzt `Camera` — denselben Typ, den `IProjection`
nennt. Die Verengung war das Loch, durch das eine `OrthographicCamera` auf einer
`ParallaxProjection` stumm `fov` und `aspect` bekam. Eine Lockerung des
Parametertyps bricht keinen Aufrufer. `createCamera()` behält seinen verengten
Rückgabetyp.

**`Stage2D.ts` bleibt unangetastet.** Der Aufruf auf `:207` ist richtig, wie er
ist; der Guard sitzt in der Projektion. Dass der Wurf von dort durch
`Stage2D#resize()` und `StageRenderer#resizeStage()` nach oben reist, ist der
Zweck: ein lauter Fehler statt einer stumm falsch gestellten Kamera.

**Keine neue Browser-Testfläche.** Die Konvention verlangt beide Testflächen für
eine Änderung an Rendering- oder GPU-Buffer-Code. Die Kamerarechnung ist keiner:
sie ist reine Mathematik, und die bestehenden Specs prüfen die Projektionsmatrix
schon auf endliche Werte. Bei CONS-026 ist die geänderte Zeile Verdrahtung — sie
ruft `StageRenderer#resize()`, dessen RenderTarget-Pfad an echter GPU bereits von
`packages/twopoint5d-testing/test/stage-renderer.test.js:171` (»sizes its pass
target in device pixels, before and after a resize«) gedeckt ist. Was dieses
Paket neu macht, ist nur, wer diesen Pfad antreibt, und das sieht Vitest.

**Kein Nebenbefund aus der Queue kommt herein.** Der einzige Eintrag in `stage/`
ist die `dispose()`-TSDoc in `Canvas2DStage.ts:211`, die `stageRenderer` unter den
Feldern führt, die »ihre Werte behalten« — wahr für das Feld, irreführend für die
Instanz darin. Die Ursache dort ist eine Ownership-Halbwahrheit, die Ursache hier
sind Größenlogik und Kamera-Specs; die Aussage »`setContainerSize()` does nothing«
bleibt nach diesem Paket wörtlich richtig, weil der `#disposed`-Guard stehen
bleibt. Bloße Nachbarschaft im Diff ist kein Grund, ihn mitzunehmen. Paket 6 hat
denselben Eintrag aus demselben Grund liegen lassen; die Drain-Runde des
Abschlusses schneidet ihn mit allen Befunden vor Augen.

**Die Folgen aus Paket 7 bleiben liegen, und zwar begründet.** Es ist die einzige
`Folgen:`-Zeile des Laufs, unter der noch etwas steht; Paket 1 vermerkt »Nichts
offen«, die Pakete 2 bis 6 »keine«. Beide Einträge liegen in
`FrameBasedAnimations.ts:161-167`, also in `texture/` und damit weder in der
Diff-Fläche dieses Pakets noch in seiner Ursache. Der vorgerückte Zähler nach
einem Wurf kostet nichts, weil der Auto-Name nur eindeutig sein muss und
`#nextAnonymousName()` Lücken überspringt; der leere String als »kein Name« ist
eine Entwurfsentscheidung aus der Paketdatei von Paket 7, kein Versehen. Keiner
der beiden wird ein Paket, keiner wandert in die Queue — die ist für
Nebenbefunde, und das hier sind Folgen ohne Handlungsbedarf.

**Der Restplan bleibt, wie er steht.** Paket 9 arbeitet in
`packages/twopoint5d/src/vertex-objects/` und berührt weder eine Datei noch eine
Signatur dieses Pakets; keine der hier gewanderten Fundstellen trifft es, und die
Reihenfolge der beiden bleibt beliebig. Nach diesem Paket ist Paket 9 das letzte
vor der Drain-Runde.

## Vorgehen

### 1. `ParallaxProjection`: gemeinsames Kamera-Setup

`Camera` zusätzlich aus `three/webgpu` importieren (`import type`, die Suffixregel
gilt für relative Importe).

Ein privates `#applyToCamera(camera: PerspectiveCamera): void` aufnehmen, das den
heutigen Rumpf von `createCamera()` (`:114-125`) trägt, ohne das `new`:

```ts
#applyToCamera(camera: PerspectiveCamera): void {
  const projectionPlane = expectDefined(this.projectionPlane, 'the projection plane of this projection');

  camera.fov = this.#fovy;
  camera.aspect = this.#aspect;
  camera.near = this.#near;
  camera.far = this.#far;

  // applyRotation() multiplies onto the orientation the camera already carries: without this
  // reset a camera updated a second time would turn a second time
  camera.quaternion.identity();
  projectionPlane.applyRotation(camera);

  camera.position.copy(projectionPlane.getPointByDistance(this.#distanceToProjectionPlane));

  camera.updateProjectionMatrix();
}
```

`createCamera()` wird damit zu `const camera = new PerspectiveCamera();
this.#applyToCamera(camera); return camera;` — der Konstruktor mit vier Argumenten
setzt genau `fov`, `aspect`, `near` und `far` und ruft `updateProjectionMatrix()`,
die Zuweisungen oben leisten dasselbe.

`updateCamera()` bekommt den geweiteten Parameter und den Guard:

```ts
updateCamera(camera: Camera): void {
  if ((camera as PerspectiveCamera)?.isPerspectiveCamera !== true) {
    throw new TypeError(
      `ParallaxProjection: updateCamera() needs a PerspectiveCamera, got ${camera?.type ?? String(camera)}`,
    );
  }
  this.#applyToCamera(camera as PerspectiveCamera);
}
```

TSDoc an `updateCamera()` — bisher hat die Methode keine. Sie sagt in zwei, drei
Sätzen: die Kamera bekommt dasselbe Setup wie eine frisch erzeugte, Blickrichtung
und Position der Projektionsebene eingeschlossen; sie ist danach auf dem Stand der
letzten `updateViewRect()`; ein Wurf bei einer Kamera, die keine
`PerspectiveCamera` ist, mit `@throws`. Kein Rückblick auf den Vorzustand — die
Konventionen im Plan gelten für jede Zeile.

### 2. `OrthographicProjection`: dasselbe Setup

Gleicher Umbau, gleiche Reihenfolge. `#applyToCamera(camera: OrthographicCamera)`
setzt `left`/`right`/`top`/`bottom` aus `#halfWidth`/`#halfHeight`, dann `near`
und `far`, dann Identität, Rotation und Position, zuletzt
`updateProjectionMatrix()`. Der Guard fragt `isOrthographicCamera`:

```ts
throw new TypeError(
  `OrthographicProjection: updateCamera() needs an OrthographicCamera, got ${camera?.type ?? String(camera)}`,
);
```

TSDoc an `updateCamera()` wie in Schritt 1.

### 3. `Canvas2DStage`: die Größe über den Renderer treiben

`setContainerSize()` (`:149-153`) führt ab jetzt über den öffentlichen Renderer:

```ts
setContainerSize(width: number, height: number) {
  if (this.#disposed) return;

  // the renderer hands the size on to every stage it holds, this one included: its own
  // width and height then answer the container, and a render target built behind a pipeline
  // set on it gets that size instead of the 1×1 minimum
  this.stageRenderer.resize(width, height);
}
```

`StageRenderer#resize()` (`StageRenderer.ts:285-297`) schreibt `width`/`height`,
zieht bestehende RenderTargets nach und ruft `resizeStage()` für jede Stage, das
seinerseits `stage.resize(width, height)` weiterreicht. Der `#disposed`-Guard
bleibt vorn stehen; die Aussage der `dispose()`-TSDoc, dass `setContainerSize()`
nach dem Dispose nichts tut, bleibt damit wahr.

### 4. CONS-043: den TSDoc-Absatz neu umbrechen

In `ParallaxProjection.ts` die Zeilen 70-72 und in `OrthographicProjection.ts` die
Zeilen 68-70 neu umbrechen, sodass keine Zeile des Blocks über ~100 Zeichen geht —
den Wortlaut nicht ändern, nur den Umbruch. Beide Blöcke sind bis auf den
Typnamen am Ende identisch und bleiben es.

### 5. Specs

**`ParallaxProjection.spec.ts`**, ein neuer `describe('updateCamera()')`. Alle vier
gegen eine Projektion mit Plane `'xy|bottom-left'`, wie der Rest der Datei:

- `carries the near and the far of the specs onto a camera it updates` — Kamera aus
  `createCamera()`, dann `specs.near`/`specs.far` auf andere gültige Werte setzen,
  `updateViewRect(800, 600)`, `updateCamera(camera)`; `[camera.near, camera.far]`
  trägt die neuen Werte. **Vor dem Fix rot.**
- `moves a camera it updates to the distance the specs now name` —
  `specs.distanceToProjectionPlane` ändern, `updateViewRect()`, `updateCamera()`;
  `camera.position` gleicht `ProjectionPlane.get('xy|bottom-left').getPointByDistance(<neue Distanz>)`.
  **Vor dem Fix rot.**
- `aims a camera it updates at the projection plane` — eine nackte
  `new PerspectiveCamera()` hineingeben; ihre `quaternion` gleicht danach der einer
  Kamera aus `createCamera()`. **Vor dem Fix rot.**
- `leaves the orientation where it is when it updates the same camera twice` —
  Kamera aus `createCamera()`, zweimal `updateCamera()`; die `quaternion` ist
  dieselbe wie nach dem ersten Aufruf. Vor dem Fix grün und danach grün: der Test
  hält die Doppelrotation aus Schritt 1 fest, nicht den Fehler, den das Paket
  behebt. Im Report als solcher benennen.
- `refuses a camera that is no PerspectiveCamera` — eine `OrthographicCamera`
  hineingeben, `expect(() => …).toThrow(TypeError)`. **Vor dem Fix rot.**

**`OrthographicProjection.spec.ts`**, derselbe Block. `near` und `far` sind dort
schon durch »gives a camera it updates 0.1 and 100000 once its specs hold a far
below the near« (`:164-174`) abgedeckt, also nur:

- `moves a camera it updates to the distance the specs now name` — **rot.**
- `aims a camera it updates at the projection plane` — **rot.**
- `leaves the orientation where it is when it updates the same camera twice` — grün
  vorher wie nachher.
- `refuses a camera that is no OrthographicCamera` — mit einer `PerspectiveCamera`,
  **rot.**

**`Canvas2DStage.spec.ts`**, ein Test neben den bestehenden, vor dem
`describe('dispose()')`:

- `drives the stage renderer when the container size is set` —
  `stage.setContainerSize(320, 240)`; danach tragen
  `[stage.stageRenderer.width, stage.stageRenderer.height]` und
  `[stage.stage.containerWidth, stage.stage.containerHeight]` je `[320, 240]`.
  **Vor dem Fix rot**, weil der Renderer auf `[0, 0]` stehen bleibt.

Die Fixtures der Datei (`makeRenderer()`, `makeCanvas()`, `makeStage()`) tragen
das; `StageRenderer#resize()` fasst ohne vorheriges Rendern kein RenderTarget an,
der Test läuft also unter Node ohne GPU durch.

Die bestehenden Aufrufe von `updateCamera()` in beiden Projektionsspecs
(`ParallaxProjection.spec.ts:91,182`, `OrthographicProjection.spec.ts:88,171`)
übergeben je eine Kamera aus `createCamera()` und laufen weiter. Der Test
`keeps the field of view of a camera it updates once its specs hold a distance of 0`
bleibt gültig: eine Distanz von 0 zählt in den Specs als nicht gegeben und fällt
auf den Default zurück, der `fov` ändert sich also auch mit dem vollen Setup nicht.

### 6. CHANGELOG

In die `Unreleased`-Sektion von `packages/twopoint5d/CHANGELOG.md`:

- Unter **Changed** ein Eintrag zu `updateCamera()`: beide Projektionen wenden das
  vollständige Kamera-Setup an — Frustum bzw. `fov`/`aspect`, `near`, `far`, die
  Ausrichtung auf die Projektionsebene und die Position in ihrer Distanz —, und
  eine Kamera des falschen Typs wird mit einem `TypeError` abgewiesen, der Klasse,
  Aufruf und erhaltenen Typ nennt. Dazu der Satz, dass eine an `Stage2D#camera`
  gehängte Kamera damit von jedem Resize an die Projektionsebene zurückgeholt wird.
- Unter **Fixed** ein Eintrag zu `Canvas2DStage#setContainerSize()`: die Größe geht
  über den öffentlichen `stageRenderer`, dessen `width` und `height` damit den
  Container tragen statt 0 zu bleiben — eine auf diesem Renderer gesetzte
  `pipeline` bekommt ein Internal-Target in Containergröße statt des 1×1-Minimums.
- Unter **Migration Guide** ein Abschnitt in der Form, die dort steht (`####`,
  **Before**, **After**, je ein `ts`-Block): eine eigene Kamera an einer `Stage2D`
  mit Projektion wird jetzt von der Projektion geführt; wer sie selbst steuern
  will, gibt der Stage keine Projektion. Dazu der Wurf beim falschen Kameratyp.

CONS-043 bekommt keinen CHANGELOG-Eintrag — ein Zeilenumbruch in einem
Kommentarblock ändert nichts, was ein Konsument sehen kann.

## Findings im Volltext

**CONS-025 · low · Konsistenz · effort M ·
`packages/twopoint5d/src/stage/ParallaxProjection.ts:58-75; OrthographicProjection.ts:53-81; Stage2D.ts:160-162`**
— updateCamera() dieselben Specs anwenden lassen wie createCamera()

`updateViewRect()` liest `viewSpecs.near/far/distanceToProjectionPlane` jedes Mal
neu, `updateCamera()` wendet aber nur fov/aspect (Parallax) bzw. Frustum+near/far
(Ortho) an; keine bewegt die Kamera. `stage.needsUpdate = true` nach dem Ändern von
`viewSpecs.distanceToProjectionPlane` ändert also den Parallax-fov, ohne die Kamera
zu verschieben — die Projektionsebene bildet nicht mehr 1:1 auf View-Einheiten ab
—, und near/far-Änderungen erreichen eine bestehende Parallax-Kamera nie. Die
Parameterverengung (`PerspectiveCamera`, wo `IProjection` `Camera` sagt) geht durch
Methoden-Bivarianz durch, eine vom Nutzer gesetzte `OrthographicCamera` auf einer
`ParallaxProjection` bekommt stumm `fov`/`aspect` geschrieben.

Empfehlung: Das Kamera-Setup in ein `#applyToCamera(camera)` ziehen, das beide
Methoden nutzen (fov/aspect bzw. Frustum, near/far, Rotation, Position); per
`camera.isPerspectiveCamera`/`isOrthographicCamera` guarden und sonst klar werfen.
`updateCamera()` beider Projektionen speccen — derzeit ungetestet.

**CONS-026 · low · Konsistenz · effort S ·
`packages/twopoint5d/src/stage/Canvas2DStage.ts:149-153, 184`**
— stageRenderer.resize() aus Canvas2DStage.setContainerSize() treiben

Die Stage wird direkt resized, am öffentlichen `readonly stageRenderer` vorbei,
dessen `width`/`height` auf 0 bleiben. `render()` ruft `stageRenderer.renderTo()`,
eine an diesem öffentlichen Renderer gesetzte `pipeline` bekäme also ein
1×1-Internal-Target (`#renderTargetSize()` klemmt auf 1), bis jemand
`stageRenderer.resize()` von Hand ruft.

Empfehlung: `this.stageRenderer.resize(width, height)` rufen; es leitet über
`resizeStage()` an die Stage weiter und hält beide Größen im Gleichschritt.

**CONS-043 · info · Konsistenz · effort S ·
`packages/twopoint5d/src/stage/ParallaxProjection.ts:71; OrthographicProjection.ts:69`**
— Den angefügten Satz im TSDoc von updateViewRect() beider Projektionen neu umbrechen

Der angefügte TSDoc-Satz bricht bei ~108 statt ~100 Zeichen um, abweichend vom Rest
des Blocks. Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: Den Absatz neu umbrechen.

## Urteil des Reviewers je Finding

Aus `<arbeitsdir>/paket-8.review-1.json`, Runde 1, Modell mittlere Stufe:

- **CONS-025 — behoben.** Das gemeinsame Setup steht als `#applyToCamera()` in
  `ParallaxProjection.ts:139-153` und `OrthographicProjection.ts:135-152` und
  setzt `fov`/`aspect` bzw. das Frustum, `near`, `far`, den Identitäts-Reset,
  `applyRotation()` und die Position. `createCamera()`
  (`ParallaxProjection.ts:113-117`, `OrthographicProjection.ts:113-117`) und
  `updateCamera()` gehen beide hindurch. Der Guard wirft den `TypeError` in
  `updateCamera()` (`ParallaxProjection.ts:128-133`,
  `OrthographicProjection.ts:123-129`) und nennt Klasse, Aufruf und erhaltenen
  Typ; der Parametertyp deckt sich mit `IProjection.ts:12`. Beide Methoden
  tragen TSDoc mit `@throws`. Specs in `ParallaxProjection.spec.ts:97-160` und
  `OrthographicProjection.spec.ts:90-140`.
- **CONS-026 — behoben.** `Canvas2DStage.ts:149-156` ruft
  `this.stageRenderer.resize(width, height)`, der `#disposed`-Guard steht davor.
  Test in `Canvas2DStage.spec.ts:92-99`.
- **CONS-043 — behoben.** Der Absatz ist in `ParallaxProjection.ts:64-66` und
  `OrthographicProjection.ts:64-66` neu umbrochen, Wortlaut unverändert, alle
  Zeilen des Blocks unter 100 Zeichen.

Die Abweichung des Implementierers hat der Reviewer eigens geprüft und getragen:
auf `'xy|bottom-left'` ist `lookAt(eye (0,0,1), target 0, up (0,1,0))` die
Identität, der Orientierungstest wäre dort auch vor dem Fix grün gewesen und der
Doppel-Update-Test hätte den Reset nicht festgehalten. `'xz|top-left'` liefert
eine echte Rotation (-90° um X), was zu den roten Werten
`[-0.7071…, 0, 0, …]` passt. Die Distanz- und die `near`/`far`-Tests stehen
weiter auf `'xy|bottom-left'`, wie die Paketdatei es verlangt.

## Anmerkungen des Reviewers

Zwei kleine Befunde, beide bleiben stehen:

- `packages/twopoint5d/src/stage/Stage2D.ts:124` — die TSDoc des Setters
  `camera` sagt nicht mehr die ganze Wahrheit, seit die Projektion die
  zugewiesene Kamera bei jedem Resize zurücksetzt. Das ist eine Folge dieses
  Pakets und steht als solche im Plan: ohne dieses Paket war der Satz
  vollständig wahr. Zug 0 hat `Stage2D.ts` bewusst ausgeklammert, und der
  Reviewer nennt den Satz selbst keinen Blocker.
- `packages/twopoint5d/CHANGELOG.md`, `Fixed`-Eintrag zu
  `Canvas2DStage#setContainerSize()` — »instead of staying `0`« benennt den
  Vorzustand. Er bleibt: eine `Fixed`-Zeile sagt dem Konsumenten, was sich für
  ihn ändert, und genau so sind die bestehenden Einträge dieses CHANGELOGs
  geschrieben (etwa der zu `TileSpritesFactory#createTile()`: »A factory without
  a tile set threw after the slot was gone«). Die Konventionszeile zielt auf den
  Rückblick auf die eigene Codegeschichte (»früher«, »statt bisher«, »im Zuge
  des Audits umgestellt«), nicht auf die Gattung der Changelog-Zeile.

Ein dritter Hinweis des Implementierers ohne Handlungsbedarf in diesem Paket:
`ParallaxProjection.ts:153` trägt an `getZoom()` ein `// TODO add jsdoc`. Als
vorbestehend geprüft (`git show f8d255e3:…` zeigt es auf `:133`,
`OrthographicProjection.ts` hat keines) und als Nebenbefund in »Offene Befunde«
geschrieben, Urteil `→ Scope (info)`.
