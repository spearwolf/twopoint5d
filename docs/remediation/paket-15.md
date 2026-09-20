# Paket 15 — Aufräumrunde: HelpersManager, tote Lookbook-Regeln und die halb geschriebene Resize-Transaktion

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — 8 Einträge aus »Offene Befunde« (2 low, 6 info),
  im Volltext unten
- Ziel: Ein Resize, das an einer Stage scheitert, lässt den Renderer nicht mit
  Maßen zurück, die keine Stage je gesehen hat.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/HelpersManager.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts` — nur TSDoc
  - `packages/twopoint5d/src/stage/IProjection.ts` — ein Parametername
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts` — ein Parametername + TSDoc
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts` — ein Parametername
  - `apps/lookbook/src/demos/map2d-rect-visi.ts`
  - `apps/lookbook/src/pages/demos/display-multi.astro` — nur `<style>`
  - `apps/lookbook/src/pages/demos/textured-sprites.astro` — nur `<style>`
  - `packages/twopoint5d/CHANGELOG.md`
  - zum Gegenlesen, unangetastet:
    `packages/twopoint5d/src/stage/Stage2D.ts:170-250` (die Vorlage für Schritt 1),
    `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`,
    `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts`,
    `packages/twopoint5d/src/display/Display.ts` (`dispose()` und `OnDisplayDispose`),
    `packages/twopoint5d/docs/resource-lifecycle.md` §1
- Verify: `pnpm run ci`
- Commit: `fix(stage,map2d,lookbook): leave a renderer the size its stages took, keep a foreign scene from taking the helper nodes down, and clear out rules and doc lines that describe nothing`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · alle acht Queue-Einträge stehen an ihrer
    Fundstelle, keiner gegenstandslos · zwei Zeilenangaben gewandert
    (`Canvas2DStage.ts` 212-214 → die Aufzählung steht in 212-215,
    `map2d-rect-visi.ts` 67-68 → der Block, um den es geht, ist 66-68) · sechs
    Fundstellen zeilengenau unverändert · keine offene `Folgen:`-Zeile im Plan:
    Paket 1, 7, 8 und 11 sind über die Pakete 10 und 14 abgearbeitet, Pakete 12,
    13 und 14 melden »Folgen: keine« · in »Offene Befunde« liegt nach diesem Paket
    nur noch der `getZoom()`-Semantik-Eintrag mit Urteil `→ Audit`, der nicht
    hierher gehört · kein neuer Nebenbefund in Zug 0 · Restplan unverändert, dies
    ist das letzte Paket
  - 2026-09-20 Zug 1: Implementierer beauftragt, stärkste Stufe, Effort medium ·
    Session `1ead25de-132a-475d-b357-3c501ee93d45` · Report
    `paket-15.impl-1.json`
  - 2026-09-20 Zug 2: Report `FERTIG` · geändert: `StageRenderer.ts` (+ Spec),
    `HelpersManager.ts` (+ Spec), `Canvas2DStage.ts`, `IProjection.ts`,
    `ParallaxProjection.ts`, `OrthographicProjection.ts`,
    `map2d-rect-visi.ts`, `display-multi.astro`, `textured-sprites.astro`,
    `packages/twopoint5d/CHANGELOG.md` — zwölf Dateien, Arbeitsbaum schmutzig ·
    rote Läufe belegt: zwei in `StageRenderer.spec.ts`, einer in
    `HelpersManager.spec.ts` · eigener Verify-Lauf `pnpm run ci` exit=0,
    Log `paket-15.verify.log`
  - 2026-09-20 Zug 3: Reviewer (stärkste Stufe, Effort medium) · alle acht
    Einträge erfüllt, je mit Fundstelle · ein Befund `wichtig` (CHANGELOG und
    TSDoc versprechen ein Rollback der Stage-Item-Maße, das es nicht gibt),
    fünf `klein` · Diff `paket-15.diff` (526 Zeilen), Report
    `paket-15.review-1.json`
  - 2026-09-20 Zug 4, Runde 1: offen war der eine `wichtig`-Befund · derselbe
    Implementierer per Resume (Session `1ead25de`), Report
    `paket-15.impl-2.json` · zurück kam: nur Sätze, kein Codepfad — CHANGELOG
    260 und 261, TSDoc von `resize()` und der Inline-Kommentar im
    Rollback-Zweig · eigener Verify-Lauf `pnpm run ci` exit=0, Log
    `paket-15.verify-2.log` · gezielter Nachreview
    `paket-15.review-2-versuch-2.json`: Befund behoben an allen vier Stellen,
    kein neuer · offene Befunde 1 → 0, Kette beendet
  - 2026-09-20 Zug 5: committet als `6073b0a2`, zwölf Dateien,
    165 Einfügungen / 29 Löschungen · Verify-Beleg `paket-15.verify-2.log`
    (exit=0), jünger als die letzte Codeänderung · Arbeitsbaum danach sauber

## Vorgehen

Acht Einträge über drei Flächen. Schritt 1 und 2 sind Korrektheit und bekommen
je zuerst einen fehlschlagenden Test; 3 bis 6 sind Doku und toter Stil; 7 gibt
einer Demo den Aufräumpfad, der ihr fehlt; 8 zieht das CHANGELOG nach.

### 1. `StageRenderer#resize()` und `#resizeStage()` — die Transaktion zu Ende schreiben

Datei: `packages/twopoint5d/src/stage/StageRenderer.ts`, Zeilen 285-305.
`width` und `height` sind öffentliche Felder (Zeile 87-88), `stages` ist
`readonly stages: StageItem[]` (Zeile 149), `StageItem` trägt `stage`, `width`
und `height` (Zeile 38-43).

**Zuerst der rote Lauf.** Zwei Tests in `StageRenderer.spec.ts`, direkt hinter
`it('propagates resize() to stages')` (Zeile 396-403). Der Helfer `fakeStage(name)`
(Zeile 61-68) gibt eine Stage mit `resize: vi.fn()`; wirft sie, wird
`stage.resize.mockImplementation(() => { throw new Error('...') })` gesetzt —
dasselbe Muster wie `it('restores autoClear when a stage throws')` (Zeile 238-249).

- `it('leaves the renderer the size it had when a stage refuses it')`: zwei Stages,
  die zweite wirft. Nach `expect(() => sr.resize(320, 240)).toThrow(...)` sind
  `sr.width` und `sr.height` beide `0`. Dann die werfende Stage wieder gutmütig
  machen (`stage2.resize.mockImplementation(() => {})`) und `sr.resize(320, 240)`
  ein zweites Mal rufen: der Aufruf geht durch, `stage2.resize` wurde mit
  `(320, 240)` gerufen, `sr.width` ist `320` und `sr.height` ist `240`.
- `it('asks every stage for its size even when one of them refuses')`: drei Stages,
  die mittlere wirft. Nach dem Wurf haben `stage1.resize` und `stage3.resize` je
  `(320, 240)` gesehen.

Beide Tests sind vor der Änderung rot: heute bleiben `width`/`height` auf
`320`/`240` stehen, der zweite `resize()` fällt aus dem Guard in Zeile 286, und die
Schleife bricht vor der dritten Stage ab. Der rote Lauf gehört in den Report —
Kommando `pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts`.

**Dann der Fix.** `resize()` sammelt, was die Stages werfen, statt beim ersten
Wurf abzubrechen, und gibt die Maße zurück, wenn etwas geworfen hat:

```ts
resize(width: number, height: number): void {
  if (this.width === width && this.height === height) return;

  const prevWidth = this.width;
  const prevHeight = this.height;

  this.width = width;
  this.height = height;

  const refused: unknown[] = [];

  try {
    if (this.#internalRT) this.#resizeRenderTarget(this.#internalRT);
    if (this.#asPassNodeRT) this.#resizeRenderTarget(this.#asPassNodeRT);
  } catch (error) {
    refused.push(error);
  }

  // a stage that refuses the size does not keep the others from theirs: each one is asked,
  // and what they threw comes out together once every stage has had the call
  for (const stage of this.stages) {
    try {
      this.resizeStage(stage, width, height);
    } catch (error) {
      refused.push(error);
    }
  }

  if (refused.length > 0) {
    // the size of this renderer is the size its stages took: while one of them refuses it, the
    // renderer keeps the one they all had, and the very same call goes through again as soon as
    // that stage fits — written through, it would fall out of the size guard above
    this.width = prevWidth;
    this.height = prevHeight;
    throw refused.length === 1
      ? refused[0]
      : new AggregateError(refused, `StageRenderer#resize(): ${refused.length} of ${this.stages.length} stages refused the size ${width}x${height}`);
  }
}
```

Genau ein Fehler wird unverändert durchgereicht — der `TypeError` einer Projektion
kommt beim Aufrufer als `TypeError` an, wie er es über `Stage2D#resize()` tut.
Mehrere werden zu einem `AggregateError`; `lib` steht auf `ES2022`
(`tsconfig.json:19`), der Typ ist also da.

`resizeStage()` schreibt die Maße des Items erst, wenn die Stage sie angenommen hat:

```ts
protected resizeStage(stageItem: StageItem, width: number, height: number): void {
  if (stageItem.width !== width || stageItem.height !== height) {
    // the size a stage refuses is not the size it shows: the item keeps the one it had, so the
    // next resize() asks that stage again instead of taking it for done
    stageItem.stage.resize(width, height);
    stageItem.width = width;
    stageItem.height = height;
  }
}
```

Die TSDoc von `resize()` fehlt heute ganz; sie kommt dazu und sagt in zwei Sätzen,
was oben im Kommentar steht (ohne Rückblick auf einen Vorzustand). `resizeStage()`
ist `protected` und behält Signatur und Sichtbarkeit.

### 2. `HelpersManager` — die fremde Szene und die fehlende TSDoc

Datei: `packages/twopoint5d/src/map2d/HelpersManager.ts`.

**Zuerst der rote Lauf**, in `HelpersManager.spec.ts` (drei Tests, Stil ist
`test('...', () => {})`):

- `test('a scene this manager was never given keeps the nodes in the root')`:
  `root` mit `scene` darin, Manager auf `scene`, je ein Knoten über `add(node)` und
  `add(rootNode, true)`. Dann `manager.removeFromScene(new Object3D())` — eine
  Szene, die der Manager nie gesehen hat. Danach steckt `node` noch in `scene` und
  `rootNode` noch in `root`. Heute ist der Test rot: `rootNode` fällt aus `root`
  und bekommt sein `dispose()`.
- `test('remove() takes the nodes out of the scene and out of the root above it')`:
  derselbe Aufbau, dann `manager.remove()`; danach sind `scene.children` und
  `root.children` beide leer. Der Test hält das Verhalten fest, das bleibt.

Kommando für den roten Lauf:
`pnpm nx test twopoint5d -- src/map2d/HelpersManager.spec.ts`.

**Dann der Fix.** In `removeFromScene()` (Zeile 68-82) wird das Nachziehen der
Wurzel an die eigene Szene gebunden:

```ts
if (scene === this.#scene && this.root != null && scene !== this.root) {
  this.removeFromScene(this.root);
}
```

Der rekursive Aufruf trägt `this.root` als `scene` und läuft damit selbst nicht
weiter. Der zweite Absatz der TSDoc über der Methode (Zeile 65-66, »Besides the
scene handed over, {@link root} is always cleared as well …«) wird auf diese Regel
umgeschrieben: die Knoten dieses Managers sitzen in der Szene, die er bekommen hat,
und in der Wurzel darüber, und nur für diese Szene kommen beide zusammen herunter;
eine andere Szene wird auf ihre eigenen Knoten durchsucht und sonst in Ruhe
gelassen. Kein Rückblick auf einen Vorzustand.

`remove()` (Zeile 55) bekommt `: void` und eine TSDoc: sie nimmt die Knoten dieses
Managers aus der Szene heraus, die er hält, und aus der Wurzel darüber, und ohne
Szene tut sie nichts. Ein Verweis auf `{@link removeFromScene}` für das, was dabei
mit einem Knoten geschieht.

### 3. `Canvas2DStage#dispose()` — die TSDoc über `width` und `height` geraderücken

Datei: `packages/twopoint5d/src/stage/Canvas2DStage.ts`, TSDoc-Zeilen 212-215.
Die Aufzählung »`canvas`, `renderer`, `projection`, `scene`, `sprite`, `width`,
`height` und `needsUpdate` keep the values the stage was left with« stimmt für
`width` und `height` nicht: beide Getter lesen `canvas.width` und `canvas.height`
(Zeile 41-47), und der Canvas gehört dem Aufrufer. Also `width` und `height` aus
dieser Aufzählung streichen und einen Satz ergänzen, der sie an den Canvas bindet —
sie antworten weiter mit dem, was am Canvas steht, und folgen damit dem, was der
Aufrufer dort später einstellt. Der Satz zwei Absätze höher (»the canvas keeps the
size and the content it had«) bleibt, wie er ist. Nur TSDoc, keine Codezeile.

### 4. `getZoom()` — den Parameter nach dem benennen, was er misst

Der Parameter heißt `distanceToProjectionPlane` und trägt die Distanz zur **Kamera**;
das gleichnamige Feld der Projektion meint die Distanz von der Kamera zur
Projektionsebene. Neuer Name an allen drei Stellen: **`distanceToCamera`**.

- `packages/twopoint5d/src/stage/IProjection.ts:9` — `getZoom(distanceToCamera: number): number;`
- `packages/twopoint5d/src/stage/ParallaxProjection.ts:164-169` — Parameter und
  beide Verwendungen im Rumpf (Zeile 165, 167). Die TSDoc darüber (Zeile 153-163)
  zieht mit: der einleitende Satz, der Term `1 - distanceToProjectionPlane / D` und
  die `@param`-Zeile. Das Feld `#distanceToProjectionPlane` (Zeile 49) behält seinen
  Namen — es benennt weiterhin die Distanz zur Projektionsebene.
- `packages/twopoint5d/src/stage/OrthographicProjection.ts:152` —
  `getZoom(_distanceToCamera: number): number`, Unterstrich bleibt.

Die widersprüchliche **Semantik** der beiden `getZoom()` ist ausdrücklich nicht Teil
dieses Pakets: der Eintrag dazu steht in »Offene Befunde« mit dem Urteil `→ Audit`.
Hier wird nur der Parametername richtiggestellt, kein Rückgabewert, kein Interface.

### 5. `display-multi.astro` — den Selektor entfernen, der nie trifft

Datei: `apps/lookbook/src/pages/demos/display-multi.astro`, Zeile 184. Aus

```css
.gridCell.canvasContainer:hover,
.gridCell:hover .canvasContainer {
  outline: 1px solid #f06;
}
```

fällt die erste Selektorzeile weg; kein Element der Seite trägt beide Klassen, und
wirksam ist allein der zweite Zweig. Die Regel selbst bleibt unverändert.

### 6. `textured-sprites.astro` — die `em`-Regel entfernen

Datei: `apps/lookbook/src/pages/demos/textured-sprites.astro`, Zeile 26-29. Der
Block `em { font-size: 84.615384%; color: #ddd; }` fällt ersatzlos. Geprüft: das
Template hat kein `<em>`, die Beschreibung aus `_textured-sprites.json` ist reiner
Text ohne Markup, und im ganzen `apps/lookbook/src` steht kein einziges `<em>`.
Astro scoped die Regel auf dieses Template, sie kann also nichts anderes treffen.

### 7. `map2d-rect-visi.ts` — der Demo den Aufräumpfad geben, der ihr fehlt

Datei: `apps/lookbook/src/demos/map2d-rect-visi.ts`. Die Demo baut Helfer, `Map2D`,
Tile-Renderer, Geometrie, Material, Textur und ein `PanControl2D` und gibt nichts
davon je frei. Sie hängt ihr Aufräumen an das Ende des Displays, das ohnehin die
Lebensdauer aller Demo-Objekte trägt — dasselbe Muster, mit dem sich `FixedFrameLoop`
an ein `Display` hängt (`packages/twopoint5d/src/display/FixedFrameLoop.ts:210`):

```ts
once(demo, OnDisplayDispose, () => {
  // in this order: the renderer gives its tile slots back to the factory, the map lets the
  // renderer go, and only then do the geometry and the material behind those slots fall
  rectVisiAreaHelpers.dispose();
  tileRenderer.dispose();
  map2d.dispose();
  tileSprites.geometry?.dispose();
  tileSprites.material?.dispose();
  texture.dispose();
  panControl.dispose();
});
```

`once` kommt aus `@spearwolf/eventize`, `OnDisplayDispose` aus
`@spearwolf/twopoint5d` (exportiert in `packages/twopoint5d/src/events.ts:16`).
Der Block steht am Ende des `demo.start()`-Callbacks, hinter der Registrierung von
`demo.onRenderFrame(...)`, wo jedes der genannten Objekte existiert. Die Imports der
Demo-Datei wachsen um `once` und `OnDisplayDispose`.

`dispose()` gibt es an allen genannten Stellen:
`RectangularVisibilityAreaHelpers#dispose()`, `Map2DTileRenderer#dispose()`,
`Map2D#dispose()`, `PanControl2D#dispose()`, und Geometrie wie Material erben es von
three.js. `TileSprites` selbst ist ein Mesh und hat keines.

**Bewusst nicht dabei:** ein `pagehide`-Handler, der `demo.dispose()` ruft. Die
Lebensdauer des Displays gehört der Seite und nicht der Demo; das Dokument räumt
den GPU-Kontext beim Entladen selbst ab, und ein Display, das sich beim Verlassen
der Seite selbst tötet, kommt aus dem bfcache als totes Canvas zurück. Was der Demo
fehlt, ist die Verbindung vom Ende des Displays zu ihren eigenen Objekten — genau
die bekommt sie hier, und jede Demo, die sie als Vorlage nimmt, erbt sie mit. Der
Eintrag in »Offene Befunde« nennt daneben das Verlassen der Seite; diese Abweichung
ist bewusst und steht hier.

### 8. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `[Unreleased]`:

- **`### Fixed`** (Abschnitt ab Zeile 168), eine neue Zeile zu
  `StageRenderer#resize()`: ein Resize, den eine Stage abweist, lässt `width` und
  `height` des Renderers und die Maße jedes Stage-Items so, wie sie waren; jede
  übrige Stage bekommt die Größe trotzdem zu sehen, und derselbe Aufruf greift
  erneut, sobald die abweisende Stage sie annimmt. Weisen mehrere ab, kommt ein
  `AggregateError` mit allen heraus, bei einer einzigen ihr eigener Fehler.
- **`### Fixed`**, eine neue Zeile zu `HelpersManager#removeFromScene(scene)`: eine
  Szene, die der Manager nie gehalten hat, wird auf ihre eigenen Knoten durchsucht
  und lässt die Wurzel über der gehaltenen Szene stehen. `remove()` und der
  `scene`-Setter nehmen Szene und Wurzel weiterhin zusammen herunter.
- **Zeile 259** (`fix Stage2D#resize() for a projection that refuses the camera …`):
  der letzte Satz sagt heute, über einen `StageRenderer` komme diese Erholung nicht
  an. Mit Schritt 1 kommt sie an; der Satz wird darauf umgeschrieben, statt stehen
  zu bleiben oder ersatzlos zu fallen — ein Leser, der die Zeile kennt, braucht die
  Auflösung.
- **`### Changed`** (Abschnitt ab Zeile 36), eine Zeile zum Parameternamen:
  `IProjection#getZoom()` und beide Implementierungen nennen ihren Parameter
  `distanceToCamera`, weil er die Distanz zur Kamera trägt. Aufrufer sind nicht
  betroffen — JavaScript kennt keine benannten Argumente —, ein Typ, der die
  Signatur abschreibt, sieht den neuen Namen.

Kein Migrationsabschnitt: keine dieser Änderungen zwingt einen Konsumenten zu einer
Anpassung.

## Testflächen

Vitest genügt. Die Konvention »eine Änderung an Rendering- oder GPU-Buffer-Code
braucht beide Testflächen« greift hier nicht: Schritt 1 ändert ausschließlich den
Fehlerpfad, wenn eine Stage ihre Größe abweist, und Schritt 2 die Frage, welche
Szene einen Knoten herunternehmen darf. Beides ist mit einer Fake-Stage und einem
`Object3D` vollständig beobachtbar; an echter GPU käme keine Aussage dazu, die der
Vitest-Lauf nicht schon trägt. Die übrigen sechs Schritte sind TSDoc, CSS, ein
Parametername und eine Demo-Datei.

## Findings im Volltext

Acht Einträge aus »Offene Befunde« des Plans, wörtlich; die Fundstellen sind in
Zug 0 nachgesehen und stehen alle noch.

**1 · low · `packages/twopoint5d/src/map2d/HelpersManager.ts:79-81`** —
`removeFromScene(scene)` räumt neben der übergebenen Szene immer auch `root` ab, und
`root` ist die Wurzel über der eigenen Szene. Ein Aufruf mit einer fremden Szene
reißt damit den eigenen Satz herunter und disposed ihn. Die Methode ist öffentlich,
ihr TSDoc beschreibt das Verhalten korrekt — ein Fallstrick bleibt es trotzdem:
beide mitgelieferten Helfer schirmen ihn seit Paket 12 ab, jede fremde
`IMap2DVisibilitorHelpers`-Implementierung, die `removeFromScene()` direkt ruft,
tritt weiter hinein. Vorbestehend aus `f8d255e3`. Aus Paket 12, Zug 2.

**2 · info · `packages/twopoint5d/src/map2d/HelpersManager.ts:55`** — `remove()`
trägt weder Rückgabetyp noch TSDoc, als einzige Methode der Klasse. Vorbestehend aus
`f8d255e3`. Aus Paket 12, Zug 2.

**3 · info · `apps/lookbook/src/demos/map2d-rect-visi.ts:67-68`** — die Demo baut
Helfer und `Map2D` auf und disposed nichts davon, auch nicht beim Verlassen der
Seite. Für eine Lookbook-Demo vertretbar, aber jede andere Demo derselben Art erbt
dasselbe Muster. Aus Paket 12, Zug 2.

**4 · info · `apps/lookbook/src/pages/demos/display-multi.astro:184`** — der
Selektor `.gridCell.canvasContainer:hover` trifft nie, weil kein Element beide
Klassen trägt; wirksam ist allein der Zweig `.gridCell:hover .canvasContainer`.
Aus Paket 11, Zug 2.

**5 · info · `apps/lookbook/src/pages/demos/textured-sprites.astro:26`** — die Regel
`em { … }` ist toter Code: die Seite hat kein `<em>` im Markup, und Astro scoped die
Regel auf das eigene Template. Aus Paket 11, Zug 2.

**6 · low · `packages/twopoint5d/src/stage/StageRenderer.ts:285-305`** — dieselbe
halb geschriebene Transaktion eine Ebene über `Stage2D`: `resize()` schreibt `width`
und `height` vor der Schleife über die Stages, `resizeStage()` schreibt
`stageItem.width`/`height` vor `stage.resize()`, und wirft eine Stage, bleibt beides
stehen. Der Guard in Zeile 286 macht den zweiten Aufruf mit denselben Zahlen zum
No-op, und die Schleife bricht ab, bevor die übrigen Stages ihre Größe gesehen
haben — die Erholung, die `Stage2D` seit Paket 13 zusagt, kommt über diesen Weg
nicht an. Vorbestehend, geprüft in `e7a112b3^`. Aus Paket 13, Zug 4.

**7 · info · `packages/twopoint5d/src/stage/Canvas2DStage.ts:212-214`** — dieselbe
Halbwahrheit, die Paket 2 für `stage` und Paket 13 für `stageRenderer` ausgeräumt
hat, steckt noch in `width` und `height`: die TSDoc von `dispose()` führt beide unter
den Feldern, die »keep the values the stage was left with«, aber beide Getter lesen
`canvas.width`/`canvas.height` (Zeile 41-47). Der Canvas gehört dem Aufrufer, die
beiden antworten nach einem `dispose()` also mit dem, was er später an seinem Canvas
einstellt. Vorbestehend, die Zeile stand so in `e7a112b3^`. Aus Paket 13, Zug 2.

**8 · info · `packages/twopoint5d/src/stage/ParallaxProjection.ts:164`** — der
Parameter von `getZoom()` heißt `distanceToProjectionPlane` und ist gerade nicht die
Distanz zur Projektionsebene, sondern die zur Kamera; das gleichnamige Feld der
Projektion steht daneben und meint etwas anderes. Die TSDoc aus Paket 13 beschreibt
das, umbenannt wurde nichts — ein öffentlicher Parametername kippt mehr als ein
Paket. Verwandt mit dem `getZoom()`-Eintrag in »Offene Befunde«, aber eine eigene
Sache. Vorbestehend aus `e7a112b3^:134`. Aus Paket 13, Zug 2.

## Abgleich (Zug 0, 2026-09-20)

| Nr | Fundstelle laut Plan | Heute | Urteil |
| --- | --- | --- | --- |
| 1 | `HelpersManager.ts:79-81` | 79-81, `if (this.root && scene !== this.root)` | unverändert |
| 2 | `HelpersManager.ts:55` | 55, `remove() {` ohne Rückgabetyp und ohne TSDoc | unverändert |
| 3 | `map2d-rect-visi.ts:67-68` | 66-68 (Helfer, `add()`, `show`), kein `dispose()` in der Datei | unverändert, Fundstelle um eine Zeile verschoben |
| 4 | `display-multi.astro:184` | 184 | unverändert |
| 5 | `textured-sprites.astro:26` | 26-29 | unverändert |
| 6 | `StageRenderer.ts:285-305` | 285-305 | unverändert |
| 7 | `Canvas2DStage.ts:212-214` | Aufzählung in 212-215, Getter in 41-47 | unverändert, Zeile gewandert |
| 8 | `ParallaxProjection.ts:164` | 164, dazu TSDoc 153-163, `IProjection.ts:9`, `OrthographicProjection.ts:152` | unverändert |

Keiner der acht Einträge ist gegenstandslos, keiner hat seine Ursache verändert.

Triage der offenen Folgen: keine offen. Die `Folgen:`-Zeilen der Pakete 1, 7, 8 und
11 sind über die Pakete 10 und 14 abgearbeitet und im Plan als solche vermerkt; die
Pakete 12, 13 und 14 melden »Folgen: keine«. Aus »Offene Befunde« nimmt dieses Paket
die acht ihm zugewiesenen Einträge; der neunte (die widersprüchliche
`getZoom()`-Semantik der beiden Projektionen) trägt das Urteil `→ Audit` und bleibt
liegen — er ist in der `./audit.html` vom 19.09. noch nicht eingetragen, das holt
der Abschluss nach.

## Urteil des Reviewers je Eintrag

Alle acht Einträge behoben, je mit Fundstelle im committeten Stand:

| Nr | Gegenstand | Fundstelle |
| --- | --- | --- |
| 1 | fremde Szene reißt den eigenen Satz herunter | `HelpersManager.ts:82`, Test `HelpersManager.spec.ts:44` |
| 2 | `remove()` ohne Rückgabetyp und TSDoc | `HelpersManager.ts:54-62` |
| 3 | Demo disposed nichts | `map2d-rect-visi.ts:120-131` |
| 4 | toter Selektor | `display-multi.astro:184` |
| 5 | tote `em`-Regel | `textured-sprites.astro` |
| 6 | halb geschriebene Resize-Transaktion | `StageRenderer.ts:295-346`, Tests `StageRenderer.spec.ts:404` und `:429` |
| 7 | `Canvas2DStage#dispose()`-TSDoc | `Canvas2DStage.ts:213-217` |
| 8 | Parametername `distanceToCamera` | `IProjection.ts:9`, `ParallaxProjection.ts:164`, `OrthographicProjection.ts:152` |

## Kleine Befunde des Reviewers

Gemeldet, nicht behoben — sie lösen keine Runde aus. Die ersten beiden zieht
die Änderung dieses Pakets nach sich und stehen deshalb zusätzlich in der
`Folgen:`-Zeile des Plans; die übrigen sind Anmerkungen zum Zuschnitt.

- **Die Guard-Ecke an der Item-Grenze.** `StageRenderer.ts:296`: Weist Stage 2
  die Größe `320x240` ab, fällt der Renderer auf `0x0` zurück, Stage 1 steht
  aber auf `320x240`. Ruft der Host danach `resize(0, 0)`, greift die
  Größenschranke und die Methode kehrt sofort um — Stage 1 behält eine Größe,
  die der Renderer nicht mehr führt, bis eine dritte Zahl kommt. Die
  Transaktion ist an der Renderer-Grenze zu Ende geschrieben, an der
  Item-Grenze nicht.
- **Die `AggregateError`-Meldung zählt falsch.** `StageRenderer.ts:333` bildet
  `${refused.length} of ${this.stages.length} stages refused`; in `refused`
  kann aber auch der Fehler aus dem Render-Target-`try` (`:305-310`) liegen,
  der aus keiner Stage kommt. Der Nachreview stuft die Lage als theoretisch
  ein, weil `rt.setSize()` praktisch nicht wirft. `CHANGELOG.md:261` übernimmt
  dieselbe Zählweise.
- **Testlücke am `AggregateError`.** Beide neuen Tests decken den Einzelfehler
  ab; dass mehrere ablehnende Stages zu einem `AggregateError` zusammenlaufen,
  steht nur in TSDoc und CHANGELOG. Ebenso ungetestet: welche Maße die
  Stage-Items nach dem Wurf tragen.
- **Die Demo nimmt den Rohweg statt der API.** `map2d-rect-visi.ts:121` hängt
  sich mit `once(demo, OnDisplayDispose, …)` ein; `Display#onDispose(listener)`
  (`Display.ts:974`) kapselt genau dieses `once` und erspart der Demo den
  Import von `@spearwolf/eventize`. Die Paketdatei hatte das Muster aus
  `FixedFrameLoop.ts:210` vorgegeben — Bibliotheks-internes Coding, während die
  Demo ausdrücklich Vorlage für weitere Demos sein soll.
- **Die Commit-Message lässt die Umbenennung aus.** Der öffentlich sichtbare
  Parametername `distanceToCamera` fällt unter keinen der drei Teilsätze. Die
  Message ist im vorgegebenen Wortlaut committet worden; der Reviewer hätte
  einen vierten Halbsatz gesetzt.

## Abweichungen des Implementierers

- `HelpersManager.spec.ts:64`: Die Paketdatei verlangte in Schritt 2
  `scene.children` **und** `root.children` beide leer. Das ist im vorgesehenen
  Aufbau unerreichbar — `root.add(scene)` macht die Szene selbst zu einem Kind
  der Wurzel. Assertion deshalb auf `toEqual([scene])`; die Aussage, dass beide
  Helfer-Knoten weg sind, bleibt dieselbe. Vom Reviewer ausdrücklich gebilligt.
- Der Aufräum-Block in `map2d-rect-visi.ts` steht am tatsächlichen Ende des
  `demo.start()`-Callbacks, hinter den `window`/`console.log`-Zeilen, nicht
  unmittelbar hinter `demo.onRenderFrame(...)`.
- Schritt 8 gab für die drei CHANGELOG- und TSDoc-Sätze einen Wortlaut vor, der
  ein Rollback über alle Stage-Items versprach, das der Code nicht leistet. In
  Runde 1 sind diese Sätze auf das tatsächliche Verhalten umgeschrieben; die
  Korrektheit des Satzes hatte Vorrang vor dem vorgegebenen Wortlaut.

## Eine gemeldete Folge, die keine ist

Der Implementierer meldete den Fehlerpfad aus `StageRenderer#add()`: wirft
`resizeStage()` dort, steckt die Stage bereits in `stages`, und ihr `StageItem`
trägt jetzt `0/0` statt der abgewiesenen Größe. Nicht in die `Folgen:`-Zeile des
Plans übernommen — der Reviewer hat genau diese Stelle nachgesehen
(`StageRenderer.ts:856`) und die Richtung als Gewinn eingeordnet: ein Item,
dessen Stage beim Hinzufügen wirft, bleibt auf `0x0` und wird beim nächsten
`resize()` erneut gefragt, statt als erledigt zu gelten. Dass `add()` überhaupt
einen Fehlerpfad hat, ist vorbestehend und von diesem Paket unberührt.
