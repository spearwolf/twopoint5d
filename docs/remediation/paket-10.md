# Paket 10 — Nachzug: die Kamera-Umstellung zu Ende dokumentieren und den Auto-Namen erst nach der Prüfung vergeben

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine — vier Symptome aus den `Folgen:`-Zeilen der Pakete 7 und 8,
  triagiert in Zug 0 von Paket 9. Volltext unten.
- Folge von: Paket 7, Paket 8
- Ziel: Was die beiden Umbauten an Doku und Reihenfolge umgeworfen haben, sagt
  wieder, was der Code tut.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/Stage2D.ts` — TSDoc des `camera`-Accessors
  - `packages/twopoint5d/src/stage/Stage2D.spec.ts` — ein Test, der die neue
    TSDoc-Aussage festhält
  - `packages/twopoint5d/CHANGELOG.md` — zwei bestehende `[Unreleased]`-Einträge
    und der Migrationsabschnitt werden um je einen Satz verlängert
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts` — Reihenfolge in
    `add()`, dazu ein Satz TSDoc
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts` — ein
    Regressionstest
- Verify: `pnpm run ci`
- Commit: `fix: hand out an animation name only once the animation can be built, and say what a projection does to a camera it is given`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · alle vier Symptome an der Fundstelle
    bestätigt, zwei Zeilennummern gewandert (`#applyToCamera()` mit dem
    `expectDefined` jetzt `ParallaxProjection.ts:136` und
    `OrthographicProjection.ts:133`, die `camera`-TSDoc `Stage2D.ts:118-128`) ·
    `Stage2D.spec.ts` dazugenommen · kein Nebenbefund aus »Offene Befunde«
    aufgenommen · keine neue Folge, keine `Folgen:`-Zeile eines erledigten
    Pakets bleibt unverteilt · Restplan unverändert: Paket 10 ist das letzte,
    danach folgt nur die Drain-Runde des Abschlusses
  - 2026-09-20 Zug 1: Implementierer beauftragt, mittlere Stufe, Effort medium
    (`paket-10.impl-1.json`, Session `b9ad6328-edd6-476a-870b-6343c0c684b5`)
  - 2026-09-20 Zug 2: Report FERTIG · geändert
    `packages/twopoint5d/src/stage/Stage2D.ts`,
    `packages/twopoint5d/src/stage/Stage2D.spec.ts`,
    `packages/twopoint5d/CHANGELOG.md`,
    `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`,
    `packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts` · roter Lauf
    des Regressionstests `an add that throws spends no name of the counter` im
    Report belegt (`animId('anim_0')` warf) · Arbeitsbaum jetzt schmutzig ·
    eigener `pnpm run ci` exit=0 (`paket-10.verify.log`)
  - 2026-09-20 Zug 3: Reviewer (mittlere Stufe, Effort medium) auf
    `paket-10.diff` · alle fünf Schritte erfüllt, kein kritischer und kein
    wichtiger Befund, vier kleine · `paket-10.review-1.json`
  - 2026-09-20 Zug 4: keine Runde — es blieb nichts offen
  - 2026-09-20 Zug 5: committet als `d7cea23c`, Verify aus Zug 2 unverändert
    gültig (seither keine Codeänderung)

## Vorgehen

Fünf Schritte, zwei Ursachen. Schritte 1–3 gehören zur Kamera-Umstellung aus
Paket 8, Schritte 4–5 zur Namensvergabe aus Paket 7. Sie sind voneinander
unabhängig; die Reihenfolge ist nur die billigste.

### 1. `Stage2D`: die TSDoc des `camera`-Accessors sagt, was die Projektion tut

`packages/twopoint5d/src/stage/Stage2D.ts`, TSDoc über `get camera()`
(derzeit Zeilen 118–128). Der zweite Absatz lautet heute:

```
   * A camera assigned here takes precedence over the projection's. Assigning `undefined` hands
   * back to the projection's camera, created on the spot if the container already has an area.
```

Dahinter kommt ein **neuer Absatz** (also eine Zeile `   *` davor), Wortlaut:

```
   * A projection places a camera assigned here as it places its own: every `updateProjection()`
   * — and every `resize()` that brings a new container size — gives it the frustum or the field
   * of view of the specs, their `near` and `far`, the direction of the projection plane and the
   * position at its `distanceToProjectionPlane`, as long as container and specs give a view with
   * an area. A stage whose camera you place yourself gets no projection.
```

Der Absatz `Every change of the camera emits …` bleibt der letzte. Sonst wird in
der Datei nichts geändert: `#updateProjection()` verhält sich richtig, nur die
TSDoc schwieg darüber.

Belegt ist die Aussage in `Stage2D.ts:205-212`: `#updateProjection()` ruft
`this.projection!.updateCamera(this.camera)`, sobald `this.camera != null` —
und `this.camera` liefert `#cameraUserOverride ?? #cameraFromProjection`, also
auch die zugewiesene Kamera. Die beiden frühen `return` in derselben Methode
(Container ohne Fläche, Specs ohne Sichtfläche) sind der Grund für den
`as long as`-Nachsatz.

### 2. `Stage2D.spec.ts`: ein Test hält die Aussage fest

Neuer Test in `packages/twopoint5d/src/stage/Stage2D.spec.ts`, direkt hinter
`it('hands back to the projection camera when the assigned one is cleared', …)`
(endet derzeit auf Zeile 165). `OrthographicProjection` und
`OrthographicCamera` sind in der Datei bereits importiert:

```ts
  it('lets the projection place a camera it was given', () => {
    const stage = new Stage2D(
      new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640, near: 1, far: 4000, distanceToProjectionPlane: 300}),
    );
    const custom = new OrthographicCamera();
    custom.position.set(11, 22, 33);
    stage.camera = custom;

    stage.resize(800, 600);

    expect(stage.camera, 'the stage renders with the camera it was given').toBe(custom);
    expect([custom.near, custom.far], 'near and far of the specs').toEqual([1, 4000]);
    expect(custom.right - custom.left, 'the frustum of the projection').toBe(640);
    expect(custom.position.z, 'the distance to the projection plane').toBe(300);
  });
```

Warum überhaupt ein Test in einem Doku-Paket: dieses Paket existiert, weil eine
TSDoc-Aussage still falsch geworden ist. Eine neue Aussage, die nichts absichert,
wird auf demselben Weg wieder falsch. Der Test ist grün, bevor die TSDoc-Zeilen
geschrieben sind — das ist hier keine Lücke, sondern der Zweck: er hält fest, was
schon gilt.

Nachgerechnet: Der Container 800×600 mit `{fit: 'contain', width: 640}` gibt die
Sichtfläche 640×480 (dieselbe Rechnung steht in `Stage2D.spec.ts:197`), also
`left = -320`, `right = 320`. `near` und `far` werden von `updateViewRect()`
übernommen, weil `4000 > 1`. Die Ebene `'xy|bottom-left'` hat die Normale
`(0, 0, 1)` durch den Ursprung, `getPointByDistance(300)` ist damit
`(0, 0, 300)`. Die Zuweisung `stage.camera = custom` löst selbst noch kein
`updateProjection()` aus (der Setter tut das nur für `camera == null`), der
`resize()` danach schon.

### 3. CHANGELOG: die beiden Sätze, die den Paket-8-Einträgen fehlen

`packages/twopoint5d/CHANGELOG.md`, ausschließlich im Abschnitt
`## [Unreleased]`. Es kommt **kein neuer Aufzählungspunkt** hinzu: beide
Sachverhalte sind Folgen genau der Änderungen, die dort schon je einen Punkt
haben, und ein zweiter Punkt zum selben Aufruf schickt den Leser zwischen zwei
Zeilen hin und her. Beide Punkte sind in diesem Lauf entstanden (Commit
`d5dcd2ab`, nachzusehen mit
`git show d5dcd2ab -- packages/twopoint5d/CHANGELOG.md`) — wer sie verlängert,
schreibt an seinem eigenen Text weiter, nicht am Text des Maintainers.

**3a.** Der Punkt unter `### Changed`, der mit
``- `ParallaxProjection#updateCamera()` and `OrthographicProjection#updateCamera()` apply the whole camera setup``
beginnt (derzeit Zeile 154), endet heute auf
`… since the stage calls updateCamera() on it as it does on its own`. Daran
anschließen, im selben Aufzählungspunkt, mit einem Satzpunkt davor:

```
 A projection that has no projection plane refuses the call with an `Error` naming what is missing, as `createCamera()` does: the direction and the position `updateCamera()` writes are read off that plane.
```

**3b.** Der Punkt unter `### Fixed`, der mit
``- fix `Canvas2DStage#setContainerSize()`: the size goes through the public `stageRenderer``` beginnt
(derzeit Zeile 253), endet heute auf `… rather than the 1×1 minimum`. Daran
anschließen, im selben Aufzählungspunkt, mit einem Satzpunkt davor:

```
 The size the renderer already carries is what decides whether anything moves: a call with that size reaches neither a render target nor a stage, so a `Stage2D` that was resized from somewhere else in between keeps the size it was given.
```

**3c.** Im Abschnitt `### Migration Guide`, unter
`#### A projection places the camera it updates`: der Absatz endet heute auf
`A camera of the wrong type is refused with a TypeError instead of being written to.`
Ein Satz dahinter, im selben Absatz:

```
 A projection that was never given a projection plane refuses `updateCamera()` outright, where before it wrote the values it could compute without one.
```

Dazu je eine Zeile in die beiden Codeblöcke desselben Abschnitts, jeweils als
letzte Zeile des Blocks, durch eine Leerzeile von der Zeile darüber getrennt:

**Before** (hinter `new ParallaxProjection('xy|bottom-left').updateCamera(new OrthographicCamera()); // → writes fov and aspect to a camera that has neither`):

```ts
new ParallaxProjection().updateCamera(new PerspectiveCamera()); // → writes fov and aspect, and nothing else
```

**After** (hinter den zwei Zeilen zum `TypeError`):

```ts
new ParallaxProjection().updateCamera(new PerspectiveCamera());
// → Error: expected the projection plane of this projection to be defined
```

Der Wortlaut der Fehlermeldung ist der von
`packages/twopoint5d/src/utils/expectDefined.ts:11` mit dem `what` aus
`ParallaxProjection.ts:136` — nicht umformulieren. Der Rückblick im
Migrationsabschnitt (`where before it wrote …`) ist dort erwünscht: ein
Migrationsabschnitt richtet sich an jemanden, der von der vorigen Version
kommt. In TSDoc, Code-Kommentar und in den Punkten unter `Changed` und `Fixed`
bleibt er weg.

### 4. `FrameBasedAnimations#add()`: der Zähler rückt erst vor, wenn die Animation steht

`packages/twopoint5d/src/texture/FrameBasedAnimations.ts`. Heute stehen die
Zeilen 165–173 so:

```ts
    let [name] = args;

    if (name) {
      if (this.#animations.has(name)) {
        throw new Error(`name='${name.toString()}' must be unique!`);
      }
    } else {
      name = this.#nextAnonymousName();
    }
```

Daraus wird — die Prüfung des übergebenen Namens bleibt vorn, die Vergabe des
Auto-Namens wandert nach hinten:

```ts
    let [name] = args;

    if (name && this.#animations.has(name)) {
      throw new Error(`name='${name.toString()}' must be unique!`);
    }
```

Und am Ende der Methode, zwischen `const duration = …` (derzeit Zeile 217) und
`this.#names.push(name)` (derzeit Zeile 219):

```ts
    // the counter hands out a name only once the animation can be built: an add() that throws
    // spends none, and the names follow the animations that were registered
    if (!name) {
      name = this.#nextAnonymousName();
    }
```

Zwei Dinge bleiben, wie sie sind, und zwar mit Absicht:

- Die Prüfung `if (name && …)` ist die Wahrheitsprüfung von heute, nur ohne die
  überflüssige Verschachtelung. Der leere String gilt weiter als »kein Name«
  und bekommt damit einen Auto-Namen. Der Plan hält diese Hälfte der Folge
  ausdrücklich für gewollt — nicht anfassen, keinen `!= null`-Vergleich daraus
  machen.
- Die Eindeutigkeitsprüfung für einen übergebenen Namen bleibt vorn. Sie ist
  eine Argumentprüfung und soll früh scheitern; sie vergibt nichts und lässt
  nichts zurück.

Was danach dazwischen liegt und werfen kann, ist genau der Grund für die
Verschiebung: die drei Zweige der Frames-Auflösung samt
`throw new Error('add(): the third argument must be …')` (Zeile 212),
`tileSet.frame(tileId)` und `resolveDuration()`, das bei einer `frameRate` ≤ 0
und bei einem Timing ohne beide Werte wirft.

Dazu ein Satz TSDoc über `add()`. Der Absatz endet heute auf
`… so it is reachable through animId() like any other.` Daran anschließen:

```
 The counter moves for an animation that was registered: an `add()` that throws spends no name.
```

### 5. `FrameBasedAnimations.spec.ts`: der Regressionstest

Das ist ein Korrektheitsfehler, also gilt die Reihenfolge: Test schreiben, rot
laufen lassen, roten Lauf in den Report, dann Schritt 4. Neuer Test in
`packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts`, im Block
`describe('add with TextureCoords array', …)`, direkt hinter
`test('a name the caller already took is stepped over, not overwritten', …)`
(endet derzeit auf Zeile 61):

```ts
    test('an add that throws spends no name of the counter', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      expect(() => animations.add(undefined, {frameRate: 0}, frames)).toThrow();

      const id = animations.add(undefined, 1.0, frames);

      expect(id).toBe(0);
      expect(animations.animId('anim_0')).toBe(id);
    });
```

Vor Schritt 4 ist er rot, und zwar an der letzten Zeile: der abgewiesene
`add()` hat `anim_0` bereits verbraucht, die zweite Animation heißt `anim_1`,
und `animId('anim_0')` wirft
`FrameBasedAnimations: there is no animation named "anim_0"`. Einzellauf:
`pnpm nx test twopoint5d -- src/texture/FrameBasedAnimations.spec.ts`

## Was dieses Paket nicht anfasst

Steht hier, damit es nicht doch jemand mitnimmt:

- **Kein Eingriff in den Code-Pfad von `Canvas2DStage#setContainerSize()`.** Die
  Größe durch den `stageRenderer` zu treiben, ist die freigegebene Lösung aus
  Paket 8; dieses Paket dokumentiert ihre Folge, es verhandelt sie nicht neu.
- **Kein `RangeError`, kein neuer Guard in `ParallaxProjection` oder
  `OrthographicProjection`.** Der Wurf ohne Projektionsebene ist gewollt und
  bekommt nur seine CHANGELOG-Zeile.
- **`// TODO add jsdoc` an `ParallaxProjection#getZoom()` (Zeile 153) bleibt
  stehen.** Er steht in »Offene Befunde« und hat eine andere Ursache als dieses
  Paket; die Drain-Runde des Abschlusses nimmt ihn.
- **Die `dispose()`-TSDoc in `Canvas2DStage.ts:211` bleibt stehen.** Ebenfalls in
  »Offene Befunde«, ebenfalls andere Ursache (sie stammt vom `dispose()` aus
  Paket 2, nicht von der Größen-Umstellung).
- **Keine Browser-Testfläche.** Es bewegt sich kein Buffer und kein Pixel: die
  Änderung an `FrameBasedAnimations` betrifft die Namensbuchhaltung, das Layout
  der Datentextur bleibt Zeichen für Zeichen dasselbe, und die beiden
  Stage-Änderungen sind Text.
- **Keine `public-api.ts`.** Kein neues öffentliches Symbol.

## Warum Modell und Effort so stehen

Mittlere Stufe, `medium`: ein lokaler Korrektheitsfix mit Regressionstest ist
genau die Zeile in der Modelltabelle, und aus Prosa gearbeitet wird hier auch —
vier Sätze müssen in die Stimme einer bestehenden Datei passen. Höher braucht es
nicht: keine Modulgrenze wird überschritten, keine Nebenläufigkeit, keine
Signatur bewegt sich. Niedriger nicht, weil zwei Tests zu komponieren sind und
`pnpm run ci` über Lint und Prettier mitläuft.

## Die Folgen im Volltext

Alle vier stammen aus den `Folgen:`-Zeilen der Pakete 7 und 8 im
`./remediation-plan.md` und sind dort in Zug 0 von Paket 9 als Symptome
derselben zwei Umstellungen triagiert worden.

**Aus Paket 8 · `packages/twopoint5d/src/stage/Stage2D.ts:124`** — die TSDoc des
Setters `camera` sagt »A camera assigned here takes precedence over the
projection's«; das stimmt für den Vorrang, verschweigt aber, dass die Projektion
diese Kamera ab jetzt bei jedem `updateProjection()` und jedem Resize an die
Projektionsebene zurücksetzt. Der Hinweis steht in CHANGELOG und
Migrationsabschnitt, nicht dort, wo ein Konsument beim Zuweisen nachliest.

*Abgleich 2026-09-20:* unverändert, Fundstelle gewandert — die TSDoc ist ein
Block über `get camera()` und deckt Getter und Setter ab, derzeit Zeilen
118–128. Der betreffende Satz steht auf Zeile 124.

**Aus Paket 8 · `packages/twopoint5d/src/stage/ParallaxProjection.ts:139` und
`OrthographicProjection.ts:135`** — `#applyToCamera()` ruft
`expectDefined(this.projectionPlane, …)`, also wirft `updateCamera()` ab jetzt
auf einer Projektion ohne Plane; `createCamera()` warf dort schon vorher, und im
Repo gibt es außer `Stage2D.ts:207` keinen Aufrufer, der Fall steht aber in
keinem CHANGELOG-Eintrag eigens.

*Abgleich 2026-09-20:* unverändert, Zeilen gewandert — das `expectDefined` steht
auf `ParallaxProjection.ts:136` und `OrthographicProjection.ts:133`. Beide
Klassen führen `projectionPlane: ProjectionPlane | undefined` als öffentliches
Feld und nehmen im Konstruktor keine Ebene entgegen, der Fall ist also von außen
erreichbar. `Stage2D.ts:207` bleibt der einzige Aufrufer im Repository
(gegengeprüft über `packages`, `apps`, Specs und `twopoint5d-testing`); alle
Specs bauen ihre Projektionen mit Ebene. Vor Paket 8 setzte `updateCamera()`
nur `fov`, `aspect` und die Projektionsmatrix und konnte deshalb nicht werfen
(`git show d5dcd2ab^:packages/twopoint5d/src/stage/ParallaxProjection.ts`).

**Aus Paket 8 · `packages/twopoint5d/src/stage/Canvas2DStage.ts:149-156`** —
`StageRenderer#resize()` (`StageRenderer.ts:285`) kehrt bei unveränderter Größe
früh zurück, also reicht `setContainerSize()` mit der Größe, die der Renderer
schon trägt, kein `stage.resize()` mehr durch; unschädlich, weil
`setCanvasSize()` die Stage über `updateProjection(true)` selbst treibt, aber
eine Verhaltensänderung ohne CHANGELOG-Zeile.

*Abgleich 2026-09-20:* unverändert an beiden Stellen. `setContainerSize()` steht
auf `Canvas2DStage.ts:149-156` und ruft `this.stageRenderer.resize(width,
height)`; die frühe Rückkehr steht auf `StageRenderer.ts:286`. Vor Paket 8 stand
dort `this.stage.resize(width, height)` (`git show d5dcd2ab --
packages/twopoint5d/src/stage/Canvas2DStage.ts`).

**Aus Paket 7 · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:161-167`**
— `add()` vergibt den Auto-Namen, bevor es `frames` und `duration` prüft, also
bleibt der Zähler nach einem Wurf vorgerückt und die nächste anonyme Animation
heißt `anim_1`, obwohl `anim_0` nie registriert wurde; harmlos, weil der Name
nur eindeutig sein muss und `#nextAnonymousName()` Lücken ohnehin überspringt.
Dieselbe Stelle: `if (name)` behandelt den leeren String als »kein Name«, der
damit jetzt `anim_N` bekommt statt eines Symbols — von der Paketdatei von Paket 7
so gewollt, der Zweig bleibt unangetastet.

*Abgleich 2026-09-20:* unverändert, Zeilen gewandert — die Vergabe steht auf
`FrameBasedAnimations.ts:165-173`, `this.#names.push(name)` auf Zeile 219. Die
zweite Hälfte (leerer String) bleibt außerhalb des Scopes dieses Pakets.

## Kein Nebenbefund aus »Offene Befunde« kommt herein

Die Queue trägt 17 Einträge. Drei liegen in Dateien, die dieses Paket berührt
oder zitiert, keiner teilt seine Ursache:

- `Canvas2DStage.ts:211` (`dispose()`-TSDoc nennt `stageRenderer` unter den
  Feldern, die ihre Werte behalten) — Ursache ist das `dispose()` aus Paket 2,
  nicht die Größen-Umstellung aus Paket 8. Schon Paket 8 hat so geurteilt.
- `ParallaxProjection.ts:153` (`// TODO add jsdoc` an `getZoom()`) — vorbestehend
  und ohne Bezug zur Kamerasetzung; dieses Paket ändert in der Datei keine Zeile,
  also gibt es nicht einmal einen Diff, in dem der TODO nebenbei fiele.
- `TextureAtlasLoader.ts:74-80` und `:88-91` (Texture-Leak im Fehlerpfad, leerer
  Progress-Callback) — dasselbe Modul wie Schritt 4, aber der Atlas-Loader, nicht
  die Animationsbuchhaltung.

Die übrigen vierzehn liegen im Lookbook-CSS, in `map2d` und in `package.json`.
Alle bleiben für die Drain-Runde des Abschlusses liegen, die sie mit allen
Befunden vor Augen schneidet.

## Urteil des Reviewers je Schritt

Alle fünf Schritte erfüllt, Fundstellen im Stand von `d7cea23c`:

1. TSDoc des `camera`-Accessors — `Stage2D.ts:146-150`, eigener Absatz vor
   `Every change …`, Wortlaut wie im Detailplan
2. Test `lets the projection place a camera it was given` —
   `Stage2D.spec.ts:99-119`, prüft Kamera-Identität, `near`/`far`,
   Frustumbreite 640 und `position.z` 300
3. CHANGELOG — der `Changed`-Punkt und der `Fixed`-Punkt je um einen Satz
   verlängert, kein neuer Aufzählungspunkt; Migrationsabschnitt um den Satz und
   je eine Zeile in Before- und After-Block. Die zitierte Fehlermeldung deckt
   sich mit `expectDefined.ts:11` und dem `what` aus `ParallaxProjection.ts:136`
4. Namensvergabe nach der Prüfung — `FrameBasedAnimations.ts:167-169` (die
   Eindeutigkeitsprüfung bleibt vorn) und `:216-220` (die Vergabe hinter
   `resolveDuration()`), TSDoc-Satz auf `:215-216`
5. Regressionstest `an add that throws spends no name of the counter` —
   `FrameBasedAnimations.spec.ts:177-187`. Der Reviewer hat gegengerechnet, dass
   er vor Schritt 4 rot gewesen wäre: die Vergabe lag vor dem Wurf, `anim_0` war
   verbraucht, und `frameRate: 0` löst den Wurf über
   `calculateDurationFromFrameRate` (Zeile 44) zuverlässig aus.

Konventionen eingehalten: keine Finding-IDs, kein Rückblick auf den Vorzustand
in TSDoc, Code-Kommentar oder unter `Changed` und `Fixed` — nur im
Migrationsabschnitt, wo er hingehört. Kein Aufrufer mit alter Signatur und kein
Test gegen altes Verhalten war mitzuziehen: `add()` behält Signatur und
Rückgabe, und `updateCamera()` hat außerhalb von `Stage2D` keinen Aufrufer.

## Kleine Befunde aus dem Review

Keiner löst eine Runde aus; sie stehen hier, damit sie nicht spurlos verfallen.

- `Stage2D.ts:146` — die neue TSDoc sagt »every `updateProjection()`«. Ohne
  Argument tut der Aufruf nur etwas, wenn `needsUpdate` gesetzt ist
  (`Stage2D.ts:186`). Die Ungenauigkeit ist aus dem Detailplan geerbt und in der
  Sache harmlos: für einen Konsumenten, der die Kamera zuweist, ist der Satz
  richtig.
- Testlücke: Für den Wurf ohne Projektionsebene und für den Frühausstieg von
  `setContainerSize()` bei unveränderter Größe gibt es keinen Test, obwohl beides
  jetzt im CHANGELOG steht. Der Detailplan schließt beides ausdrücklich aus
  (»Was dieses Paket nicht anfasst«).
- `FrameBasedAnimations.spec.ts:183` — das nackte `toThrow()` prüft nicht, dass
  der Wurf von `frameRate` kommt. Die Zeile `animId('anim_0')` fängt das meiste
  davon ab.
- Die Commit-Message trägt keinen Scope, während die Nachbarcommits einen haben.
  Vertretbar, weil die Änderung `stage` und `texture` zugleich berührt — ein
  Scope müsste eine der beiden Ursachen unterschlagen.

## Nebenbefunde des Implementierers

Vier, alle in den geänderten Dateien gelesen, alle vorbestehend, keiner behoben.
Sie stehen mit Urteil in »Offene Befunde« im Plan; hier die Begründung des
Urteils:

- `Stage2D.ts:207` — eine zugewiesene Kamera falschen Typs lässt `resize()` mit
  dem `TypeError` aus `updateCamera()` abbrechen, nachdem `#containerWidth`/
  `-Height` und `#width`/`#height` schon geschrieben sind und bevor
  `OnStageResize` heraus ist. Ein zweites `resize()` mit derselben Größe ist ein
  No-op, die Stage meldet also eine Sicht, die nie angekündigt wurde. `→ Scope
  (low)`: die Scope-Regel nimmt jede Severity, und der halb geschriebene Zustand
  ist ein echter Fehler. Nicht in dieses Paket: die Ursache ist die
  Reihenfolge in `resize()`, nicht die schweigende TSDoc.
- `Stage2D.ts:361` — eine Zeile der `dispose()`-TSDoc ist etwa doppelt so lang
  wie ihre Nachbarn, der Umbruch fehlt. `→ Scope (info)`.
- `FrameBasedAnimations.ts:~192` — der Filter
  `(name) => typeof name === 'string'` im Atlas-Zweig überschattet das äußere
  `name`. Harmlos, aber seit Schritt 4 verwirrender, weil das äußere `name` jetzt
  weiter unten neu zugewiesen wird. `→ Scope (info)`. Die Verschachtelung war
  schon vorher da; dieses Paket hat sie nur sichtbarer gemacht.
- `FrameBasedAnimations.ts`, Atlas-Zweig — ein Atlas oder eine `frameNameQuery`
  ohne Treffer registriert eine Animation mit null Frames ohne Fehler, und
  `duration` wird nicht gegen negative Werte oder `NaN` geprüft. Die Datentextur
  bekommt in beiden Fällen Einträge, mit denen ein Shader nichts anfangen kann.
  `→ Scope (low)`: die Entscheidung des Laufs, dass Fehlkonfigurationen werfen
  statt stumm weiterzulaufen, deckt genau diesen Fall — sie nennt aber die
  Setter, `updateCamera()` und den `FixedFrameLoop`, nicht den Atlas-Zweig, also
  ist es ein eigener Befund und kein Rest eines erledigten Pakets.
