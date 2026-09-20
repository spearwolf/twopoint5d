# Paket 2 — Stage2D: PassNode freigeben und der Klasse ein `dispose()` geben

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: MEM-005 (medium), CONS-031 (info), CONS-041 (info)
- Ziel: Ein Stage2D gibt das RenderTarget frei, das es selbst allokiert hat,
  statt bei jedem Rebuild ein neues zu sammeln.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/stage/Stage2D.ts`
  - `packages/twopoint5d/src/stage/Stage2D.spec.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts`
  - `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - `packages/twopoint5d/CHANGELOG.md`

## Was der Abgleich ergeben hat

| Finding | Stand | Fundstelle jetzt |
| --- | --- | --- |
| MEM-005 | unverändert, Stelle gewandert | `Stage2D.ts:257-262` (im Audit `:225-230`); `StageRenderer.ts:534-539` ruft sie (im Audit `:482-486`) |
| CONS-031 | unverändert, Zeile stimmt | `StageRenderer.ts:697` |
| CONS-041 | unverändert, Zeile stimmt | `Stage2D.ts:174` |

Die Verschiebung in `Stage2D.ts` kommt aus `160b26ad` und `121a8fa9`, die vor
diesem Lauf die Projektionen und den Größen-Pfad umgebaut haben. Der
Sachverhalt ist derselbe: `asPassNode()` ruft `pass(this.scene, this.camera)`
bei jedem Aufruf neu, `Stage2D` hat kein `dispose()`, und niemand ruft je
`PassNode.dispose()`.

Drei Dinge, die der Abgleich zusätzlich belegt hat und die im Vorgehen
stehen — nachgeschlagen, nicht vermutet:

1. **`pass()` gibt eine echte `PassNode`-Instanz zurück**, keinen
   TSL-Proxy: `three/src/nodes/display/PassNode.js:1024` lautet
   `export const pass = (scene, camera, options) => new PassNode(PassNode.COLOR, scene, camera, options)`.
   `PassNode#dispose()` (`:989`) gibt `this.renderTarget` frei. Der Typ ist in
   `@types/three` als `PassNode` deklariert und über `three/webgpu`
   importierbar (`Three.WebGPU.d.ts` → `nodes/Nodes.js`).
2. **`off(this)` räumt den `retain`-Puffer mit ab.** Die eventize-6-Doku zu
   `off`: »`off(ε)` … wipes every listener and every retained value on the
   emitter«. Für die im Finding genannten First-Frame-Props samt `stage: this`
   braucht es also kein zusätzliches `unretain()`.
3. **Ein gecachter `PassNode` resized sich selbst.** `PassNode#updateBefore()`
   ruft `this.setSize()` aus der Zeichenpuffergröße des Renderers
   (`PassNode.js:805`). Der Cache braucht keinen Resize-Pfad.

**Dritte Fundstelle zu CONS-041, im Paket.** `StageRenderer.ts:517`
(`if (this.width === 0 || this.height === 0) return;` in
`#renderPipelineComposed`) stellt dieselbe Frage nach der Fläche wie
`Stage2D.ts:174` und beantwortet sie nach derselben zweiten Regel. Das Finding
nennt sie nicht, sie teilt aber seine Ursache — zwei Regeln für dieselbe
Frage —, und sie steht in einer Datei, die dieses Paket wegen CONS-031 ohnehin
öffnet. Ohne sie bliebe die Ursache halb behoben. Ein `grep` über das
Stage-Modul belegt, dass es die einzige weitere ist (siehe »Was nicht zu
diesem Paket gehört«).

**Mitzug in `Canvas2DStage`.** `Canvas2DStage` baut sich in seinem Konstruktor
selbst ein `Stage2D` (`Canvas2DStage.ts:114`) und hält es in seinem
`readonly stage`. Sobald `Stage2D` ein `dispose()` hat, verlangt §1 des
Lifecycle-Dokuments, dass `Canvas2DStage.dispose()` es ruft — die Instanz hat
es erzeugt. Das ist kein Nebenbefund, sondern was die eigene Änderung
umwirft: vor diesem Paket gab es nichts zu rufen.

Die Queue »Offene Befunde« im Plan trägt acht Einträge, sämtlich aus dem
Lookbook (CSS, ein Klassenname, gemischte Import-Stile, eine Engine-Range).
Keiner teilt eine Ursache mit diesem Paket; alle bleiben liegen, ihre Urteile
stehen unverändert. Die `Folgen:`-Zeile von Paket 1 ist erledigt
(»Nichts offen«), es war nichts zu verteilen.

## Vorgehen

### 1. `Stage2D`: den PassNode cachen

Neue Felder, unmittelbar über `asPassNode()`:

```ts
#passNode?: PassNode;
#passNodeScene?: Scene;
#passNodeCamera?: Camera;
```

`PassNode` kommt als `import type` aus `three/webgpu` in den bestehenden
Import-Block. `asPassNode()` wird zu:

```ts
asPassNode(_renderer: WebGPURenderer): Node {
  if (this.#disposed) {
    throw disposedError('asPassNode()');
  }

  const {scene, camera} = this;

  if (!scene || !camera) {
    throw new Error('Stage2D.asPassNode(): no scene or camera yet — call resize() first');
  }

  // the node renders one scene through one camera; either of them moving makes a node
  // built for the pair before it useless, and it takes its render target with it
  if (this.#passNode != null && this.#passNodeScene === scene && this.#passNodeCamera === camera) {
    return this.#passNode;
  }

  this.#disposePassNode();

  this.#passNode = pass(scene, camera);
  this.#passNodeScene = scene;
  this.#passNodeCamera = camera;

  return this.#passNode;
}
```

Dazu die private Freigabe, die `asPassNode()` und `dispose()` teilen:

```ts
#disposePassNode(): void {
  this.#passNode?.dispose();
  this.#passNode = undefined;
  this.#passNodeScene = undefined;
  this.#passNodeCamera = undefined;
}
```

Der Vergleich steht **am Abrufpunkt** und nicht als Invalidierung im
Kamera-Setter: `scene` ist ein öffentliches, beschreibbares Feld, ein Wechsel
dort läuft durch keinen Setter, und der Vergleich fängt beide Fälle mit einer
Regel. Das ist die Abweichung von der Empfehlung des Audits (»bei Kamerawechsel
`dispose()` + neu bauen«) — sie deckt den Szenenwechsel nicht ab, der das
gleiche Loch reißt.

Die TSDoc über `asPassNode()` sagt danach, was der Aufrufer wissen muss:
dass derselbe Knoten zurückkommt, solange Szene und Kamera stehen, dass
ein Wechsel den vorigen freigibt, und dass eine Stage in zwei
`StageRenderer`n beiden denselben Knoten gibt — ein Knoten, der seine Szene
einmal pro Frame rendert und dessen Ergebnis beide lesen.

### 2. `Stage2D`: `dispose()` und `isDisposed`

Die Vorlage steht im selben Verzeichnis: `Canvas2DStage.dispose()`
(`Canvas2DStage.ts:198-233`). Reihenfolge und Ton von dort übernehmen.

Am Kopf der Datei, neben den bestehenden Modul-Konstanten:

```ts
// one message for every member that refuses to answer once the stage is gone, so the class
// and the state are always in the text a caller reads out of a foreign stack
function disposedError(member: string): Error {
  return new Error(`Stage2D#${member} is not available: this stage has been disposed`);
}
```

Das ist die Hausform, wörtlich wie `StageRenderer.ts:31-35`, `Display.ts:47`
und `VOBufferPool.ts:8`.

```ts
#disposed = false;

/** `true` once {@link dispose} has run. */
get isDisposed(): boolean {
  return this.#disposed;
}

dispose(): void {
  if (this.#disposed) return;
  this.#disposed = true;

  // the listeners are still attached here: this event is what tells them to let go
  emit(this, 'dispose', this);
  off(this);

  this.#disposePassNode();
}
```

`emit(this, 'dispose', this)` mit dem nackten Ereignisnamen, wie
`Canvas2DStage` ihn benutzt; **keine neue Ereigniskonstante** in `events.ts`.
`off` kommt zu den Importen aus `@spearwolf/eventize` dazu.

Freigegeben wird genau der PassNode. Nicht freigegeben wird:

- **die Szene.** `THREE.Scene` hat kein `dispose()`, und was in ihr hängt, hat
  der Aufrufer hineingelegt.
- **die Kamera.** Kameras haben kein `dispose()`; die aus der Projektion
  ebensowenig wie eine zugewiesene.
- **die Projektion.** Durch den Konstruktor oder den Setter hereingereicht,
  also die des Aufrufers.

### 3. `Stage2D`: das Verhalten nach `dispose()`

Nach §3 des Lifecycle-Dokuments, und in derselben Linie wie
`StageRenderer.dispose()`: was nichts hält, behält seinen Wert.

| Member | Nach `dispose()` | Regel |
| --- | --- | --- |
| `isDisposed` | `true` | — |
| `asPassNode()` | wirft `disposedError('asPassNode()')` | §3.2 — der Rückgabetyp `Node` behauptet Präsenz |
| `renderTo()` | stiller No-Op, zeichnet nichts | §3.3 |
| `updateFrame()` | stiller No-Op, kein Event, keine Warnung | §3.3 |
| `resize()` | stiller No-Op | §3.3 |
| `updateProjection()` | stiller No-Op | §3.3 |
| Setter `projection` | stiller No-Op | §3.3 |
| Setter `camera` | stiller No-Op | §3.3 |
| Setter `name`, `needsUpdate` | schreiben weiter, treiben nichts | wie `StageRenderer#name` |
| `scene`, `camera`, `projection`, `width`, `height`, `name` | behalten ihre Werte | nichts davon wurde freigegeben |

Die vier Guards sind je ein `if (this.#disposed) return;` als erste Zeile.
Für `renderTo()` genügt die Erweiterung der bestehenden Bedingung nicht — die
Zeile bekommt einen eigenen Guard, damit der Grund lesbar bleibt.

Die TSDoc von `dispose()` zählt das auf, nach dem Muster von
`Canvas2DStage.ts:198-213` und `StageRenderer.ts:632-656`: was freigegeben
wird, was dem Aufrufer gehört und bleibt, was danach `true` ist, was wirft,
was nichts tut, und dass ein `dispose`-Ereignis an jeden Abonnenten geht,
bevor die Stage aufhört zuzuhören.

### 4. `Stage2D`: den Container nach einer Regel prüfen (CONS-041)

`Stage2D.ts:174` wird zu:

```ts
if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;
```

`isPositiveFinite` ist in der Datei bereits importiert (Zeile 13) und steht
neun Zeilen tiefer für die Sicht der Projektion. Der Kommentar darüber
(Zeilen 172-173) nennt danach die Regel, die tatsächlich gilt: ein Container,
dessen Breite oder Höhe keine endliche Zahl über 0 ist, hat kein
Seitenverhältnis, in das eine Sicht passt.

Vier Texte sagen heute »above 0« und meinen künftig »eine endliche Zahl über
0«. Alle vier werden mitgezogen:

- die TSDoc von `width`, `Stage2D.ts:68-75` (»A `resize()` to a width or a
  height of 0 keeps the size, as it keeps the camera«);
- die TSDoc von `camera`, `Stage2D.ts:110-120`;
- die Warnung ohne Kamera, `Stage2D.ts:221-223`;
- der Punkt »Stage with no camera yet« in
  `packages/twopoint5d/src/stage/README.md:465-472`.

### 5. `StageRenderer`: die dritte Fundstelle und der tote Vergleich

**Zeile 517** in `#renderPipelineComposed()` wird zu:

```ts
if (!isPositiveFinite(this.width) || !isPositiveFinite(this.height)) return;
```

`isPositiveFinite` ist dort noch nicht importiert und kommt als
`import {isPositiveFinite} from '../utils/isPositiveFinite.js';` zu den
Importen. Der Kommentar darüber (Zeilen 512-516) bleibt inhaltlich stehen und
nennt in seiner ersten Zeile die Fläche statt der Null.

**Zeile 697** verliert den toten Vergleich (CONS-031):

```ts
if (renderOrder.length === 0 || (renderOrder.length === 1 && renderOrder[0] === '*')) {
```

Beleg, dass der Zweig tot ist: `renderOrderArray`
(`StageRenderer.ts:186-194`) schließt mit `.filter(Boolean)`, ein leerer
Eintrag kommt also nie durch. Kein Kommentar an dieser Stelle — es bleibt eine
Bedingung, die für sich spricht.

### 6. `Canvas2DStage`: die selbstgebaute Stage freigeben

In `Canvas2DStage.dispose()` kommt hinter `this.stageRenderer.dispose()`:

```ts
// the stage was built in the constructor of this class, and the renderer above has let go of it
this.stage.dispose();
```

Die Reihenfolge ist nicht beliebig: `StageRenderer.dispose()` ruft für jede
Stage `remove(stage)` und meldet dabei seine Kamera-Listener ab. Läuft die
Stage zuerst, hat ihr `off(this)` diese Abmeldung schon vorweggenommen.

Die TSDoc von `Canvas2DStage.dispose()` (Zeile 198-213) nennt danach die
Stage unter dem, was freigegeben wird, und streicht sie aus der Aufzählung der
Felder, die ihren Wert behalten — den Wert behält das Feld, aber die Instanz
darin ist disposed, und die Zeile zählt auf, was noch zu gebrauchen ist.

### 7. Tests — Regression zuerst, beide Testflächen

MEM-005 ist ein Ressourcenleck, also gilt die Reihenfolge: Test schreiben, rot
sehen, den roten Lauf in den Report, dann beheben.

**Vitest, `Stage2D.spec.ts`**, ein neuer Block `describe('dispose()')` plus
zwei Tests zum Cache. Die Datei arbeitet heute ohne `sinon`; für die
Dispose-Assertionen kommt `createSandbox()` dazu, wie §7 des
Lifecycle-Dokuments es vorschreibt. Ein `{} as WebGPURenderer` genügt als
Argument — `asPassNode()` benutzt es nicht, und `StageRenderer.spec.ts:672-678`
ruft die Methode bereits so.

Assertionen, ausgeschrieben:

1. *derselbe Knoten, solange Szene und Kamera stehen* — nach
   `resize(320, 200)` ist `stage.asPassNode(r)` zweimal dieselbe Instanz. Vor
   dem Fix rot.
2. *ein neuer Knoten nach einem Kamerawechsel, der alte freigegeben* — Knoten
   holen, `dispose` darauf spionieren, `stage.camera = new PerspectiveCamera()`
   zuweisen, erneut holen: andere Instanz, Spion genau einmal gerufen. Vor dem
   Fix rot.
3. *ein neuer Knoten nach einem Szenenwechsel* — dasselbe mit
   `stage.scene = new Scene()`.
4. §7 (a) — `dispose()` gibt den Knoten frei, den die Stage selbst gebaut hat:
   Spion auf dessen `dispose`, genau einmal.
5. §7 (b) — eine hereingereichte Szene wird nicht angefasst:
   `new Stage2D(projection, scene)`, nach `dispose()` ist `stage.scene` noch
   dieselbe Instanz und ihre Kinder sind unberührt.
6. §7 (c) — jedes öffentliche Member verhält sich wie seine TSDoc sagt: die
   Tabelle aus Schritt 3, Zeile für Zeile.
7. §7 (d) — zweimal `dispose()` wirft nicht und gibt nichts zweimal frei.
8. §7 (e) — `getSignalsCount()`/`getEffectsCount()` vor und nach der Instanz:
   `Stage2D` benutzt heute keine Signale; der Test hält das fest, statt es
   vorauszusetzen. Steht der Zähler schon vor `dispose()` unverändert, gehört
   das als Zeile in den Test statt als stille Auslassung.
9. *der Container ohne Fläche* — der bestehende Test »keeps its camera and size
   while the container has no area« (`Stage2D.spec.ts:82-97`) bekommt die
   Wertepaare `[-1, 600]`, `[800, -1]`, `[NaN, 600]`, `[800, NaN]`,
   `[Infinity, 600]` in seine Schleife. Vor dem Fix rot.

**Browser, `packages/twopoint5d-testing/test/stage-pipeline.test.js`.** Zwei
Tests im bestehenden `describe`, im Stil der Nachbarn (`display.start()`,
`display.nextFrame()`, `afterEach` räumt das Display ab):

1. *Mode D, ein Rebuild ohne Kamerawechsel hält den Knoten* — Aufbau wie der
   Test in Zeile 94-122, aber statt der Projektion wird
   `sr.invalidateOutputNode()` gerufen: `buildCalls` steigt auf 2,
   `lastPasses[0]` ist dieselbe Instanz wie zuvor, und
   `lastPasses[0].renderTarget` ist dasselbe RenderTarget. Das ist der
   Kern von MEM-005 an echter GPU.
2. *`stage.dispose()` gibt das RenderTarget frei und schließt die Stage* —
   nach einem gerenderten Frame auf `passNode.renderTarget.dispose`
   spionieren, `stage.dispose()`, Spion genau einmal, und
   `stage.asPassNode(display.renderer)` wirft danach.

**Vitest, `Canvas2DStage.spec.ts`** — ein Test für Schritt 6: `dispose()` ruft
`dispose()` auf der Stage, die der Konstruktor gebaut hat, genau einmal.

### 8. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`. Der Skill
`updating-changelog` gilt; veröffentlichte Abschnitte bleiben unberührt.

Unter `### Added` ein Eintrag zu `Stage2D#dispose()` und
`Stage2D#isDisposed`, im Ton und Umfang des Eintrags zu
`Canvas2DStage#dispose()`, der ein paar Zeilen höher steht: was freigegeben
wird, was dem Aufrufer gehört und bleibt, was danach wirft und was nichts
tut, mit dem Verweis auf `docs/resource-lifecycle.md`.

Unter `### Changed` zwei Einträge:

- `Stage2D#asPassNode()` gibt denselben Knoten zurück, solange Szene und
  Kamera stehen, und gibt den vorigen frei, wenn eines von beiden wechselt;
- ein `resize()`, dessen Breite oder Höhe keine endliche Zahl über 0 ist,
  lässt Sicht und Kamera stehen — dieselbe Regel, nach der die Projektionen
  eine Sicht beurteilen. Negative Werte und `NaN` bauen keine Kamera mehr.

Kein Eintrag für den toten Vergleich in `orderedStages`: er ändert kein
beobachtbares Verhalten.

## Was nicht zu diesem Paket gehört

- **`fitIntoRectangle.ts:215-233`.** Die `=== 0`-Vergleiche dort beurteilen die
  *Specs* einer Projektion und wählen zwischen Fit-Modi; die Projektionen
  filtern den Container davor bereits mit `isPositiveFinite`
  (`ParallaxProjection.ts:78`, `OrthographicProjection.ts:76`). Andere Frage,
  andere Antwort — bleibt unberührt.
- **`ParallaxProjection.ts:135`** (`distanceToProjectionPlane === 0`) und
  **`RootRenderPipeline.ts:27`** (`passes.length === 0`): weder Container noch
  Fläche. Bleiben unberührt.
- **`IStage` bekommt kein `dispose()`.** Das Interface beschreibt den
  Frame-Vertrag einer Stage; `StageRenderer` würde sonst anfangen, fremde
  Stages freizugeben, und genau das schließt seine TSDoc aus. Wer eine Stage
  gebaut hat, disposed sie.
- **`StageRenderer.add()` weist keine disposete Stage ab.** §3 des
  Lifecycle-Dokuments verlangt das für Konstruktoren und Methoden, die eine
  Instanz entgegennehmen — aber `add()` nimmt `IStage`, und das kennt kein
  `isDisposed`. Der Guard käme nur über ein Interface-Wachstum, das hier nicht
  zur Debatte steht. Als Nebenbefund melden, nicht bauen.
- **Die Demos im Lookbook** (`display-multi.astro`, `display-minimal.astro`,
  `stage-nested-pipelines.astro`, `stage-postprocessing.astro`) bauen
  `Stage2D`-Instanzen und disposen sie nicht. Sie leben bis zum Seitenwechsel;
  kein Aufrufer wird durch dieses Paket falsch.
- **Paket 8** fasst `Canvas2DStage.ts` ebenfalls an (Stage- und
  Renderergröße) und hängt bereits von diesem hier ab. Der `dispose()`-Mitzug
  aus Schritt 6 ist eine andere Stelle derselben Datei; an der Größe wird
  nichts geändert.

## Verify

`pnpm run ci`

Während der Arbeit: `pnpm nx test twopoint5d -- src/stage/Stage2D.spec.ts`
für die Specs, `pnpm test:browser` für die Browserfläche. Der rote Lauf für
MEM-005 und CONS-041 gehört in den Report, bevor irgendetwas behoben ist.

## Commit

    fix(stage): let a Stage2D keep the pass node it built and give it up again

    A Stage2D built a new pass node on every call, and with it a new render
    target with a half-float color and a depth texture. Nothing released the
    previous one, so a UI switching stages at runtime collected GPU render
    targets until the browser's GC reached them.

    The node is now kept for as long as the scene and the camera it renders
    stay the same, and a stage that is done with it releases it: dispose()
    gives up the pass node, sends a dispose event and stops listening, and
    isDisposed answers afterwards for a caller holding a stage it did not
    build. Afterwards asPassNode() throws, and renderTo(), updateFrame(),
    resize(), updateProjection() and the projection and camera setters do
    nothing.

    A container whose width or height is not a finite number above 0 leaves
    the view and the camera as they are — the rule the projections already
    judged a view by, now in the two places that ask about the container.

    A Canvas2DStage disposes the Stage2D its constructor built.

    StageRenderer.orderedStages drops its comparison against an empty render
    order entry: renderOrderArray filters empty entries out, so none ever
    reached it.

## Verlauf

- 2026-09-20 Zug 0: Detailplan steht · MEM-005 unverändert, Fundstelle von
  `Stage2D.ts:225-230` nach `:257-262` gewandert (aus `160b26ad`, `121a8fa9`),
  Aufruferseite von `StageRenderer.ts:482-486` nach `:534-539` · CONS-031
  unverändert (`StageRenderer.ts:697`, `.filter(Boolean)` in `:186-194` belegt
  den toten Zweig) · CONS-041 unverändert (`Stage2D.ts:174`) · dritte
  Fundstelle derselben Ursache aufgenommen: `StageRenderer.ts:517` · Mitzug
  `Canvas2DStage.dispose()` (baut selbst ein `Stage2D` in `:114`) · »Offene
  Befunde« geprüft, acht Einträge, keiner mit gemeinsamer Ursache, alle bleiben
  liegen · `Folgen:` von Paket 1 war erledigt · Restplan: `Bereich` dieses
  Pakets um `Canvas2DStage.ts` erweitert, Anmerkung bei Paket 8 um den
  Berührungspunkt ergänzt, Reihenfolge unverändert

- 2026-09-20 Zug 1: Implementierer beauftragt, Modell `opus`, Effort `high`,
  Brief in `paket-2.impl-1.brief.txt`, Report in `paket-2.impl-1.json`
- 2026-09-20 Zug 2: Status FERTIG · geändert: `Stage2D.ts`, `Stage2D.spec.ts`,
  `StageRenderer.ts`, `Canvas2DStage.ts`, `Canvas2DStage.spec.ts`,
  `README.md`, `packages/twopoint5d-testing/test/stage-pipeline.test.js`,
  `packages/twopoint5d/CHANGELOG.md` · roter Lauf vor dem Fix: 9 von 29 Tests
  in `Stage2D.spec.ts` rot (3× Pass-Node-Cache, 6× fehlendes `dispose()`) ·
  Browser-Test gegen den gefixten Code geschrieben, Gegenprobe mit invertierter
  Assertion rot · 7 Abweichungen gemeldet, 3 Nebenbefunde, keine offenen Folgen
  · Arbeitsbaum schmutzig

- 2026-09-20 Zug 3: Reviewer (opus, high) · Erfüllung: MEM-005, CONS-031 und
  CONS-041 je behoben, mit Fundstelle bestätigt (`Stage2D.ts:273-355`,
  `StageRenderer.ts:698`, `Stage2D.ts:189` + `StageRenderer.ts:518`) ·
  Qualität: 3× wichtig (CHANGELOG hält an drei Stellen die alte
  Container-Regel fest; der `Canvas2DStage`-Eintrag steht unter `Changed`
  statt im `Added`-Eintrag derselben Methode; weder TSDoc noch README sagen,
  dass eine Stage vor dem `dispose()` aus jedem `StageRenderer` entfernt sein
  muss), 5× klein · Diff:
  `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ecdab9e-7f9f-4c42-ae2e-2cfd00b2febc/scratchpad/paket-2.diff`

- 2026-09-20 Zug 4, Runde 1: offen waren 3 wichtige und 5 kleine Befunde ·
  derselbe Auftrag an einen frischen Implementierer (opus, high),
  `paket-2.impl-2.json` · zurück kam: alle acht behoben, Verify grün · Review 2
  (opus, high, `paket-2.review-2.json`) bestätigt alle acht als erledigt, die
  drei Findings weiterhin behoben, und meldet 0 kritische, 0 wichtige und
  8 kleine Befunde
- 2026-09-20 Zug 4, Runde 2: sieben der acht kleinen Befunde sind
  Doku-Symptome dieses Pakets — die Änderung hat TSDoc, README, CHANGELOG und
  eine Assertion halb mitgezogen. Sie gehen an einen Implementierer (sonnet,
  medium), statt über eine `Folgen:`-Zeile einen eigenen Runner zu kosten; die
  Dateien liegen ohnehin offen. Der achte (`Canvas2DStage.ts:211`) ist
  vorbestehend und geht als Nebenbefund in die Queue.

- 2026-09-20 Zug 4, Runde 2 (Ergebnis): Implementierer sonnet/medium
  (`paket-2.impl-3.json`) hat alle sieben behoben · Review 3 (opus, medium,
  `paket-2.review-3.json`) bestätigt sie und die drei Findings, meldet
  0 kritische, 0 wichtige, 4 kleine — darunter das `IPassProvider`-Beispiel in
  `README.md:393`, das pro Aufruf einen neuen Knoten baute und damit der
  frisch dazugeschriebenen Ownership-Ansage widersprach
- 2026-09-20 Zug 4, Runde 3: die vier an einen Implementierer (sonnet,
  medium, `paket-2.impl-4.json`), weil eine Vorlage, die Anwender abschreiben,
  nicht gegen das Paket stehen darf · alle vier behoben · Review 4 (sonnet,
  medium, `paket-2.review-4.json`): kein kritischer, kein wichtiger Befund,
  der Commit kann raus; vier kleine protokolliert und stehengelassen
- 2026-09-20 Zug 5: `pnpm run ci` selbst gefahren, exit=0, alle zehn Ziele
  grün, Log `paket-2.verify.log` · committet als `6369ae7f`, neun Dateien,
  504 Einfügungen, 46 Löschungen · Arbeitsbaum danach sauber bis auf die
  ungetrackten Lauf-Dateien

## Urteil der Reviewer je Finding

Stand nach Review 4, alle vier Reviewer stimmen überein:

| Finding | Urteil | Fundstelle im Commit `6369ae7f` |
| --- | --- | --- |
| MEM-005 | behoben | `Stage2D.ts:277-303` (Cache samt Vergleich am Abrufpunkt), `:315-320` (`#disposePassNode()`), `:356-364` (`dispose()`: Event, `off(this)`, Freigabe); Mitzug `Canvas2DStage.ts:233`; Tests `Stage2D.spec.ts` (Blöcke `asPassNode (IPassProvider)` und `dispose()`), `Canvas2DStage.spec.ts`, Browser `stage-pipeline.test.js` |
| CONS-031 | behoben | `StageRenderer.ts:698` |
| CONS-041 | behoben | `Stage2D.ts:189` und die dritte Fundstelle `StageRenderer.ts:518`, beide über `isPositiveFinite`; die vier Folgetexte und der README-Punkt mitgezogen |

## Kleine Befunde, stehengelassen

Aus Review 4, nicht behoben, keiner davon fasst Code an:

- `Stage2D.ts` um `:355` — eine Zeile der `dispose()`-TSDoc ist beim Einfügen
  von `name` nicht neu umbrochen worden und steht deutlich über die
  Spaltenbreite ihrer Nachbarn hinaus. Kosmetisch.
- `Stage2D.ts:350-353` und gleichlautend `CHANGELOG.md:33` — `scene` und
  `name` stehen im selben Satz sowohl unter »keep the values the stage was
  left with« als auch unter »still take new ones«. Gemeint ist: `dispose()`
  setzt sie nicht zurück, und sie bleiben beschreibbar. Lesbar, aber nicht
  trennscharf.
- `README.md` (das `IPassProvider`-Beispiel) — `MyStage#asPassNode()` baut
  nach dem eigenen `dispose()` wieder einen Knoten, statt zu werfen wie
  `Stage2D`. Für eine Vorlage vertretbar; wer die Semantik von `Stage2D` will,
  ergänzt den Guard selbst.
- Das Beispiel ist nirgends compiliert. Review 3 hat es gegen
  `@types/three/src/nodes/display/PassNode.d.ts:107` geprüft: `pass()` liefert
  direkt eine `PassNode`, `import type {PassNode}`, Feld und Rückgabetyp
  stimmen.

Nicht als Befund gewertet, geprüft und verworfen: »as it always does« in
`Stage2D.ts:354` ist kein Rückblick auf den Vorzustand der Klasse, sondern
sagt, dass `name` in jedem Zustand nach `scene.name` durchschreibt. Wer den
Vorzustand nie gesehen hat, versteht den Satz genauso.

## Findings im Volltext

**MEM-005 · medium · Memory Leaks & Ressourcen · code · Aufwand M ·
`packages/twopoint5d/src/stage/Stage2D.ts:225-230; StageRenderer.ts:482-486`** —
Den vorigen PassNode disposen, wenn `Stage2D.asPassNode()` einen neuen baut —
und `Stage2D` ein `dispose()` geben

Jeder Rebuild (jedes `add()`, `remove()`, `renderOrder`-Write,
`invalidateOutputNode()`) ruft `pass()` erneut, das einen neuen `PassNode` mit
eigenem `RenderTarget` (HalfFloat-Farbe + Depth-Textur, `PassNode.js:246`)
allokiert. Der vorige Node wird nur per Referenz fallen gelassen;
`PassNode.dispose()` (das das RenderTarget freigibt) ruft weder `Stage2D` noch
`StageRenderer`. resource-lifecycle.md §1: Eine Instanz gibt frei, was sie
erzeugt hat — `Stage2D` erzeugt diese und hat gar kein `dispose()`;
`retain(this, OnStageFirstFrame)` hält zudem die First-Frame-Props samt
`stage: this` für die Lebensdauer des Objekts. Eine UI, die Stages zur Laufzeit
umschaltet, sammelt GPU-Render-Targets, bis der GC des Browsers sie erreicht.

Empfehlung: Den `PassNode` in der `Stage2D` cachen (`#passNode`), die gecachte
Instanz zurückgeben, solange Szene und Kamera unverändert sind, und bei
Kamerawechsel `dispose()` + neu bauen; `Stage2D` ein `dispose()` nach der
Checkliste in resource-lifecycle.md §6 geben (PassNode freigeben, `off(this)`).

**CONS-031 · info · Konsistenz · code · Aufwand S ·
`packages/twopoint5d/src/stage/StageRenderer.ts:697`** — Den toten Vergleich
mit dem leeren String in `orderedStages` streichen

`renderOrder[0] === ''` kann nie wahr sein: `renderOrderArray` filtert leere
Einträge schon heraus. Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: Die Bedingung auf
`renderOrder.length === 0 || (renderOrder.length === 1 && renderOrder[0] === '*')`
kürzen.

**CONS-041 · info · Konsistenz · code · Aufwand S ·
`packages/twopoint5d/src/stage/Stage2D.ts:174`** — `Stage2D` und die
Projektionen einen Container ohne Fläche nach derselben Regel erkennen lassen

`Stage2D` prüft den Container auf `=== 0`, die Projektionen auf »endliche Zahl
über 0« (`isPositiveFinite`). Folgenlos, weil die Projektion selbst abfängt,
aber zwei Regeln für dieselbe Frage. Aufgefallen im Remediation-Lauf vom
2026-09-19.

Empfehlung: `!isPositiveFinite(width) || !isPositiveFinite(height)` auch in
`Stage2D`.
