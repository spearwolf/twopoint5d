# Backlog: `StageRenderer` & `IStage`

> Analyse + Verbesserungsvorschläge für `packages/twopoint5d/src/stage/`.
> Stand: 2026-05-12, Branch `main`.
> Audience: Entwickler:innen, die mit `twopoint5d` arbeiten. Ziel ist ein
> einfacher, konsistenter Renderer-Stack mit optionalem Post-Pass.
>
> **Status:** §3.1–§3.8, §4 und §5 sind umgesetzt (siehe `[Unreleased]` im
> `packages/twopoint5d/CHANGELOG.md` und `packages/twopoint5d/src/stage/README.md`).
> §6 (RenderPipeline / Post-Pass) steht noch offen — siehe §9 für den
> verbleibenden Backlog.

---

## 1. Kurzfassung (TL;DR)

Der heutige `StageRenderer` macht **drei Dinge gleichzeitig**:

1. Er ist ein **Container** für mehrere `IStage`-Instanzen (`add` / `remove` /
   `renderOrder`).
2. Er ist ein **Adapter zum `Display`** (Resize + Frame-Loop-Hookup) und
   gleichzeitig wieder ein `IStage` für rekursive Verschachtelung.
3. Er ist eine **kleine Clear/Render-Policy** (Clear-Color, Buffer-Flags,
   `autoClear=false` für die Stages).

Diese Verantwortungen sind sauber getrennt, aber an einigen Stellen
inkonsistent verdrahtet. Konkret:

- `Stage2D` hat **eigene** `clearColor`, `clearAlpha`, `autoClear`-Properties —
  **die `StageRenderer` ignoriert**. Das ist toter Code und führt User in die
  Irre.
- Die Clear-Logik im `StageRenderer` koppelt "soll ich clearen?" implizit an
  "ist `clearColor` gesetzt?". Das ist subtil und schwer zu lesen.
- `IStage` schreibt `scene?` / `camera?` als optional vor — was nur Sinn ergibt,
  weil `StageRenderer` selbst ein `IStage` ist. Damit ist `IStage` weder ein
  ehrliches "ich bin eine Scene" Interface noch ein ehrliches
  "ich bin ein Render-Knoten" Interface.
- `OnStageAdded` / `OnStageRemoved` werden nur am Parent emittiert,
  `OnRemoveFromParent` nur am Child — asymmetrisch.
- `name` dient zugleich als **Anzeigename** und als **Sortier-Key** in
  `renderOrder`. Default ist `'Stage2D'` (aus `scene.name`), also nicht
  eindeutig.
- Die `StageRendererParentType = Display | StageRenderer` ist hart verdrahtet.

Für die geplante Ergänzung "**RenderPipeline / Post-Pass je StageRenderer,
auch verschachtelt**" reicht die heutige API noch nicht — die
Render-Strategie muss steckbar werden.

---

## 2. Aktuelle Implementierung im Detail

### 2.1 `IStage` (`packages/twopoint5d/src/stage/IStage.ts`)

```ts
interface IStage {
  name: string;
  scene?: Scene;
  camera?: Camera;
  resize(width: number, height: number): void;
  updateFrame(now: number, deltaTime: number, frameNo: number): void;
}
```

Beobachtungen:

- `scene` / `camera` sind **optional**. Das wird ausschließlich von
  `StageRenderer` ausgenutzt, der selbst `IStage` implementiert, aber keine
  Scene/Camera hat.
- Es gibt **kein `renderFrame()`** im Interface. Das Rendering liegt komplett
  beim Container (`StageRenderer.renderStage()`), der per `isStageRenderer`-Check
  zwischen "Container" und "echte Stage mit Scene+Camera" unterscheidet.
- `name` hat zwei Rollen: Anzeige + Sortier-ID (siehe `renderOrder`).

### 2.2 `Stage2D` (`packages/twopoint5d/src/stage/Stage2D.ts`)

- Hat `scene: Scene` (immer gesetzt — nicht-optional, im Gegensatz zur
  Interface-Deklaration).
- `camera` wird aus der `IProjection` erzeugt, beim ersten `resize()` oder
  vom User überschrieben.
- Hält **`clearColor: Color`, `clearAlpha: number`, `autoClear: boolean`** —
  diese Properties werden vom `StageRenderer` **nicht** ausgewertet.
- Emittiert: `OnStageResize`, `OnStageFirstFrame`, `OnStageUpdateFrame`,
  `OnStageAfterCameraChanged`.
- `updateFrame()` macht **kein Rendering**, sondern dispatcht nur Events.
  Rendering passiert ausschließlich im `StageRenderer`.

### 2.3 `StageRenderer` (`packages/twopoint5d/src/stage/StageRenderer.ts`)

Public surface (zusammengefasst):

```ts
class StageRenderer implements IStage {
  readonly isStageRenderer = true;
  name = 'StageRenderer';
  width: number; height: number;

  clearColor?: Color;          // undefined = "nicht clearen"
  clearAlpha: number = 1;      // greift nur, wenn clearColor gesetzt ODER
                               //   clearAlpha === 0 (versteckte Sonderregel)
  clearColorBuffer = true;
  clearDepthBuffer = true;
  clearStencilBuffer = true;
  setClearColor(color: Color | null | undefined, alpha?: number): void;

  readonly stages: StageItem[];
  renderOrder: string;         // z.B. "ui,*,debug"
  readonly orderedStages: StageItem[];

  get parent(): Display | StageRenderer | undefined;
  set parent(p);
  attach(p), detach();

  add(stage: IStage): void;
  remove(stage: IStage): void;
  hasStage(stage): boolean;

  resize(w, h): void;
  updateFrame(now, dt, frameNo): void;
  renderFrame(renderer: WebGPURenderer): void;
}
```

Render-Logik in `renderFrame()`:

```ts
const wasPreviouslyAutoClear = renderer.autoClear;
const oldClearAlpha = renderer.getClearAlpha();

let shouldClear = false;
if (clearColor != null) {
  renderer.getClearColor(this.#oldClearColor);
  renderer.setClearColor(clearColor, this.clearAlpha);
  shouldClear = true;
}
if (shouldClear || this.clearAlpha === 0) {
  renderer.setClearAlpha(this.clearAlpha);
  shouldClear = true;
}
if (shouldClear) renderer.clear(buf, depth, stencil);

renderer.autoClear = false;
for (const stageItem of this.orderedStages) this.renderStage(stageItem, renderer);

renderer.autoClear = wasPreviouslyAutoClear;
if (clearColor != null) renderer.setClearColor(this.#oldClearColor, oldClearAlpha);
renderer.setClearAlpha(oldClearAlpha);
```

`renderStage()`:

```ts
if (isStageRenderer(stage)) {
  stage.renderFrame(renderer);                         // rekursiv
} else if (stage.scene && stage.camera) {
  renderer.render(stage.scene, stage.camera);           // normalfall
}
// sonst: still ignorieren
```

Parent-Bindung an `Display`:

- Beim Setzen von `parent = display` werden **zwei** Subscriptions auf den
  Display registriert (`onResize`, `onRenderFrame`).
- Im `onRenderFrame`-Handler ruft der `StageRenderer` **selbst** `updateFrame`
  + `renderFrame` auf — der User muss nichts mehr machen (Fall in
  `display-minimal.astro`).
- In `display-multi.astro` macht der User es **selbst manuell** in seinem
  eigenen `OnDisplayRenderFrame`-Handler. Das funktioniert, aber dadurch
  laufen `updateFrame` / `renderFrame` **doppelt**, sobald sowohl `parent` als
  auch der manuelle Handler gesetzt sind. Das ist eine Falle.

### 2.4 `Canvas2DStage` (`packages/twopoint5d/src/stage/Canvas2DStage.ts`)

- Hält intern einen **eigenen** `StageRenderer` + `Stage2D` und rendert
  in einen `HTMLCanvasElement`-Sprite. Bemerkenswert: Es geht völlig **ohne
  `Display`** — der `WebGPURenderer` wird von außen reingereicht. Das
  zeigt, dass der `StageRenderer` als reine "Rendering-Unit" nutzbar ist,
  aber die API dafür gibt es nirgendwo offiziell ("rendere diese Stage einmal
  mit diesem Renderer" gibt es nur als Pfad über `StageRenderer.add` +
  `renderFrame`).

---

## 3. Inkonsistenzen & Verbesserungspotenzial

> **Status §3.1–§3.8: ✅ alle umgesetzt** (CHANGELOG `[Unreleased]`, Tests in
> `packages/twopoint5d/src/stage/StageRenderer.spec.ts` und
> `packages/twopoint5d-testing/test/stage-renderer.test.js`).

### 3.1 Tote / nicht respektierte Properties auf `Stage2D` ✅ ERLEDIGT

`Stage2D` deklariert:

```ts
autoClear = true;
clearColor = new Color(0x000000);
clearAlpha = 0;
```

Diese werden vom `StageRenderer` **nirgendwo gelesen**. User, die das
sehen, gehen davon aus, dass sie pro Stage einen eigenen Clear setzen können —
das tut aber nichts.

**Empfehlung:** entfernen. Die Clear-Verantwortung gehört zum Render-Target /
Renderer, nicht zur Scene-Beschreibung. Falls jemand wirklich
"Stage-individuelle" Hintergrundfarben braucht, ist `Scene.background` der
richtige three.js-Weg (das funktioniert heute schon).

### 3.2 Implizite Clear-Semantik im `StageRenderer` ✅ ERLEDIGT

```ts
if (clearColor != null) shouldClear = true;
if (shouldClear || this.clearAlpha === 0) shouldClear = true;
```

Aktuell:

- `clearColor=undefined`, `clearAlpha=1` (Default) → kein Clear.
- `clearColor=red`, `clearAlpha=1` → Clear mit rot.
- `clearColor=undefined`, `clearAlpha=0` → Clear, **aber mit der vom
  `WebGPURenderer` zuletzt gesetzten Farbe** (weil wir die Farbe nicht
  anfassen, nur das Alpha). Das ist ein versteckter Side-Effect.

Das ist nicht falsch, aber schwer zu erklären. Die Bedeutung "ich will
clearen" sollte explizit sein.

**Empfehlung:** ein eigenes Flag, das die Intention transportiert:

```ts
clear: boolean = false;                  // an: clear vor dem Rendering der Stages
clearColor: Color = new Color(0x000000); // default schwarz
clearAlpha: number = 0;                  // default transparent
clearColorBuffer = true;
clearDepthBuffer = true;
clearStencilBuffer = true;

setClearColor(color: Color, alpha = 1): this {
  this.clearColor.copy(color);
  this.clearAlpha = alpha;
  this.clear = true;
  return this;
}
```

Damit:

- "Stage rendern ohne Clear" → `new StageRenderer(display)` (Default).
- "Mit Hintergrundfarbe rendern" → `.setClearColor(new Color('#90b0d0'))` —
  EIN Aufruf reicht, identisch zum heutigen
  `stageRenderer.clearColor = new Color(...)`-Pfad, aber **explizit**.
- "Transparent clearen" → `.setClearColor(black, 0)` oder direkt
  `clear=true; clearAlpha=0`.
- "Mehrere Stages übereinander auf ein gemeinsames Target" → äußerer
  StageRenderer cleart einmal, innere Stages haben `clear=false`. Das ist
  schon heute der Idiom, wird mit dem expliziten Flag aber **als
  Idiom sichtbar**.

### 3.3 `IStage` als Mischinterface ✅ ERLEDIGT

Heute beschreibt `IStage` zugleich:

- "Eine Sache, die eine `scene`+`camera` hat" (Stage2D), und
- "Eine Sache, die per `updateFrame`/`renderFrame` rekursiv gerendert wird"
  (StageRenderer).

Der Detect-Pfad `isStageRenderer` ist ein Hack, der diese Mischung verbirgt.

**Empfehlung:**

```ts
// Was eine Stage ist (Inhalt + Größe + Per-Frame-Update):
interface IStage {
  name: string;
  resize(width: number, height: number): void;
  updateFrame(now: number, dt: number, frameNo: number): void;
}

// Was die Stage konkret rendert, ist eine eigene Verantwortung:
interface IRenderable {
  renderTo(renderer: WebGPURenderer): void;
}
```

Stage2D wäre dann `class Stage2D implements IStage, IRenderable`,
und auch StageRenderer wäre `IStage & IRenderable`. Im `renderStage()` ruft
der Container schlicht `stage.renderTo(renderer)` auf — der `isStageRenderer`-
Check verschwindet, ebenso der `scene && camera`-Guard (der zieht nach innen).

> Minimal-Variante (falls die obige API-Spaltung zu invasiv ist):
> Mache `renderFrame(renderer)` zum Pflichtteil von `IStage`. Damit
> verschwindet ebenfalls der `isStageRenderer`-Check. `scene`/`camera`
> bleiben optional, sind aber nur noch "convenience"-Properties.

### 3.4 Asymmetrische Events ✅ ERLEDIGT

- `OnStageAdded` / `OnStageRemoved` werden am **Parent** emittiert.
- `OnRemoveFromParent` wird am **Child** emittiert.
- Es gibt **kein** `OnAddToParent` am Child.

**Empfehlung:** beide Events am Child anbieten (`OnAddToParent`,
`OnRemoveFromParent`). Konsumenten von "Lifecycle eines Stages" haben dann
einen einzigen Anlauf-Punkt am Stage selbst.

### 3.5 `name` als Sortier-Key ✅ ERLEDIGT (JSDoc + Warning; renderOrder-Argumenttypen bewusst nicht angefasst)

`renderOrder = "ui,*,debug"` referenziert Stages über `IStage#name`. Defaults
sind aber nicht eindeutig (Stage2D ⇒ `'Stage2D'`). Wer mehrere Stages
hinzufügt und sortieren will, **muss** Namen vergeben — sonst rennt er stumpf
ins Leere.

**Empfehlung:** keine API-Änderung nötig, aber:

- In der Doku eine deutliche Note: "der Name muss eindeutig sein, wenn du
  `renderOrder` verwenden willst".
- Optional: warnen, wenn `add()` einen Stage mit bereits vorhandenem Namen
  hinzufügt **und** der Renderer ein `renderOrder ≠ "*"` hat.
- `renderOrder` zusätzlich als `string[]` akzeptieren (heute nur `string`).

### 3.6 Doppelter Frame-Tick bei manuellem Setup ✅ ERLEDIGT (Class-JSDoc + Demo `display-multi.astro` aufgeräumt)

Wenn `parent = display` gesetzt ist, übernimmt `StageRenderer` das
`updateFrame`+`renderFrame`-Aufrufen automatisch. Wer trotzdem (z.B. wie
`display-multi.astro`) selbst `OnDisplayRenderFrame` abonniert und
`updateFrame`+`renderFrame` aufruft, ruft alles **doppelt**.

**Empfehlung:** explizite "Modus"-Wahl. Variante A — zwei Konstruktoren /
Helper-Methoden:

```ts
new StageRenderer();                  // manuell, kein parent
new StageRenderer(display);           // auto, hängt sich an display
stageRenderer.attach(display);        // auto-mode aktivieren
stageRenderer.detach();               // wieder lösen
```

Heute existiert das schon — die Konfusion entsteht aus dem Beispielcode in
`display-multi.astro`, der **gleichzeitig** auto- und manuell-Setup verwendet.
Fix: das Demo aufräumen + im JSDoc von `StageRenderer` warnen.

### 3.7 Hart kodierter Parent-Typ ✅ ERLEDIGT

```ts
export type StageRendererParentType = Display | StageRenderer;
```

Schließt User aus, die einen eigenen Renderer- oder Composition-Container
bauen.

**Empfehlung:** ein kleines Interface extrahieren:

```ts
interface IStageRendererHost {
  onResize(handler): unsubscribe;
  onRenderFrame(handler): unsubscribe;
}
```

`Display` implementiert das bereits faktisch; ein nested `StageRenderer`
fängt das heute über den `parent.add(this)`-Pfad ab. Mit einem expliziten
Host-Interface ist es zumindest dokumentiert.

### 3.8 Kleinkram ✅ ERLEDIGT (Color-Signatur, `setClearAlpha`-Restore in `if`-Zweig; `isWebGLRenderer`-Import bleibt bis zum nächsten Major)

- `Color | null | undefined` in `setClearColor` lockern (`Color | null` reicht).
- `#oldClearColor` wird angelegt, auch wenn nie ein Clear stattfindet — ist OK,
  aber der zweite "always-restore"-Block (`renderer.setClearAlpha(oldClearAlpha)`)
  am Ende von `renderFrame()` läuft **immer**, auch ohne Clear, und kann
  damit den Renderer-Zustand ohne Anlass anfassen. → in den
  `if (shouldClear)`-Zweig ziehen.
- `WebGLRenderer`-Branch in `renderFrame()` wirft jetzt — gut. Den
  zugehörigen `import {isWebGLRenderer}` kann man nach dem nächsten Major
  fallen lassen, sobald sicher ist, dass kein User mehr WebGL einsetzt.

---

## 4. Vorschlag: vereinfachte Standard-Verwendung ✅ ERLEDIGT

Ziel: "Stage + StageRenderer + Display" in **drei** Zeilen.

```ts
const display = new Display(canvas);
const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain'}));

new StageRenderer(display)
  .setClearColor(new Color('#90b0d0'))
  .add(stage);

display.start();
```

Änderungen gegenüber heute, die das hergeben:

- `add(stage)` und `setClearColor(...)` geben `this` zurück (fluent).
- `clear` wird durch `setClearColor` implizit aktiviert (ein einzelner
  Property-Write `clearColor = ...` reicht aber weiterhin).

---

## 5. Vorschlag: Mehrere Stages "übereinander" in dasselbe Target ✅ ERLEDIGT

> Fluent-Idiom + Layering nutzt heute jeder `StageRenderer`; `ClearStage`
> ist als public `class ClearStage implements IStage, IRenderable` ausgeliefert
> (`packages/twopoint5d/src/stage/ClearStage.ts`), `renderOrder` wie gewohnt.
> Cheat-Sheet in `packages/twopoint5d/src/stage/README.md`.

Das funktioniert heute schon — wir machen es nur explizit:

```ts
const root = new StageRenderer(display)
  .setClearColor(new Color('#000000'));   // EIN Clear, einmal pro Frame

root.add(background);   // Stage2D, kein eigenes Clear
root.add(world);        // Stage2D
root.add(ui);           // Stage2D, on top
```

Da `StageRenderer` für die Stages den Renderer auf `autoClear = false`
zwingt, werden die Stages **additiv** in dasselbe Render-Target gezeichnet.
Mit dem expliziten `clear`-Flag (siehe §3.2) und der Doku ist das sofort
ersichtlich.

Wenn man **zwischendurch** doch clearen will (z.B. nur die Tiefenpuffer
wegblasen, bevor die UI gezeichnet wird), kann ein "Marker"-Stage helfen:

```ts
class ClearStage implements IStage {
  name = 'clear';
  constructor(private opts: {color?: boolean; depth?: boolean; stencil?: boolean} = {}) {}
  resize() {}
  updateFrame() {}
  renderTo(r: WebGPURenderer) {
    r.clear(this.opts.color ?? false, this.opts.depth ?? true, this.opts.stencil ?? false);
  }
}

root.add(world);
root.add(new ClearStage({depth: true}));
root.add(ui);
```

Voraussetzung: `IStage` bekommt `renderTo()` (siehe §3.3). Damit fällt das
Pattern für User von ganz alleine an.

---

## 6. Neues Feature: `RenderPipeline` / Post-Pass pro `StageRenderer`

### 6.1 Hintergrund (three.js r183+)

three.js liefert `RenderPipeline` (vorher `PostProcessing`):

```ts
import {RenderPipeline} from 'three/webgpu';
import {pass} from 'three/tsl';

const scenePass = pass(scene, camera);
const pipeline = new RenderPipeline(renderer);
pipeline.outputNode = somePostNode(scenePass);

// im Frameloop:
pipeline.render();   // NICHT renderer.render(scene, camera)
```

Wichtige Konsequenz: **Wer `RenderPipeline.render()` benutzt, ruft nicht
mehr `renderer.render(scene, camera)`**. Eine Pipeline kann mehrere
`pass(...)`-Knoten kombinieren — das ist genau, was wir für "mehrere Stages,
ein gemeinsamer Post-Pass" brauchen.

### 6.2 Design-Idee — `pipeline` als optionale Render-Strategie

```ts
class StageRenderer {
  // ...
  pipeline?: RenderPipeline;                 // Owner: User. Default: undefined.
  buildOutputNode?: (passes: PassNode[]) => Node;
}
```

Verhalten in `renderFrame(renderer)`:

```ts
if (this.pipeline) {
  if (this.#passesNeedRebuild) {
    const passes = this.orderedStages.map((s) => {
      if (isStageRenderer(s.stage)) return s.stage.asPassNode(renderer);   // siehe §6.3
      return pass(s.stage.scene!, s.stage.camera!);
    });
    const out = this.buildOutputNode
      ? this.buildOutputNode(passes)
      : passes.reduce((acc, p) => acc.add(p));   // schlichte Addition als Default
    this.pipeline.outputNode = out;
    this.pipeline.needsUpdate = true;
  }
  this.#applyClear(renderer);
  this.pipeline.render();
} else {
  // heutiger Pfad: renderer.render(scene, camera) je Stage
}
```

Praxis:

```ts
import {bloom} from 'three-tsl-bloom';   // o.ä.

const root = new StageRenderer(display);
root.add(world);
root.add(ui);

root.pipeline = new RenderPipeline(display.renderer);
root.buildOutputNode = ([worldPass, uiPass]) => bloom(worldPass).add(uiPass);
```

`buildOutputNode` ist der **eine** Hook, an dem der User seinen Effekt-Stack
formuliert. Default ist `passes.reduce(add)`, also "übereinander legen".

### 6.3 Verschachtelte StageRenderer mit eigener Pipeline

Hier wird es interessant: ein **inner** `StageRenderer` mit eigener
`pipeline` muss sein Ergebnis als Knoten in den **äußeren** Graphen
einspeisen. Vorschlag: jeder `StageRenderer` kann einen `PassNode`-artigen
Knoten anbieten:

```ts
class StageRenderer {
  // Liefert einen TSL-Knoten, der das Ergebnis dieses Renderers repräsentiert.
  // - ohne pipeline: gibt einen kombinierten Knoten der inneren Stages zurück
  //   (faktisch das, was buildOutputNode() berechnen würde)
  // - mit pipeline:  gibt den Output der Pipeline zurück (gerendert in ein
  //                  internes RenderTarget; der Knoten ist die Sampling-Textur
  //                  dieses Targets, z.B. via texture(this.#postTarget.texture))
  asPassNode(renderer: WebGPURenderer): Node;
}
```

Dadurch wird das Verschachtelungs-Verhalten konsistent:

- **Äußerer Renderer hat eine Pipeline** → er fragt jeden inneren
  Renderer per `asPassNode()` ab, kombiniert die Knoten via
  `buildOutputNode`, und rendert das via seiner Pipeline aus.
- **Innerer Renderer hat selbst eine Pipeline** → `asPassNode()` triggert
  intern einen Render-Pass in ein eigenes `RenderTarget` und liefert die
  Textur dieses Targets als Knoten zurück. Damit "gewinnt" der Post-Pass des
  inneren Renderers für seine eigenen Stages, und der äußere Renderer sieht
  nur noch das fertige Bild.
- **Kein Renderer hat eine Pipeline** → es bleibt beim heutigen Pfad
  (`renderer.render(scene, camera)`-pro-Stage). `asPassNode` wäre dann nicht
  nötig; nur Renderer mit Pipeline rufen es auf.

Skizze des Datenflusses:

```
display ── root.StageRenderer (pipeline = bloom + ui)
              ├── world.Stage2D                  → pass(world)
              └── uiRenderer.StageRenderer (pipeline = sharpen)
                    ├── hudStage.Stage2D         → internal RT rendern,
                    └── overlayStage.Stage2D       sharpen anwenden,
                                                   resultierende Textur als
                                                   Knoten zurückreichen
```

### 6.4 Minimal-invasive Variante (Fallback, ohne TSL-Komposition)

Falls "ein TSL-Graph für alle Stages zusammen" zu komplex erscheint, geht
auch das simpelste Schema:

```ts
class StageRenderer {
  outputRenderTarget?: WebGPURenderTarget;   // wenn gesetzt: hier rein rendern
  pipeline?: RenderPipeline;                  // wenn gesetzt: pipeline.render()
                                              //   benutzt outputRenderTarget als Input
}
```

Rendering:

1. Falls `outputRenderTarget` gesetzt: `renderer.setRenderTarget(rt)` →
   alle Stages rein rendern → `setRenderTarget(null)`.
2. Falls `pipeline` gesetzt:
   `pipeline.outputNode = texture(rt.texture)` (oder ein User-Hook),
   dann `pipeline.render()`.

Das deckt 80 % der Fälle (klassische "Scene → Post → Screen"-Kette) und ist
verschachtelbar — ein Child kann selbst ein eigenes RT + Pipeline halten,
und der Parent benutzt dann nur noch das Ergebnis. Die TSL-Variante (§6.2/6.3)
ist die "richtige", performantere Lösung; die RT-Variante ist die kleinere.

**Vorschlag:** Erst §6.4 implementieren (klein, klar, kein TSL-Wissen
nötig), §6.2/6.3 als optionales Upgrade für ambitionierte User.

---

## 7. Konkrete API-Anpassungen (zusammengefasst)

### 7.1 `IStage`

```diff
 interface IStage {
   name: string;
-  scene?: Scene;
-  camera?: Camera;
   resize(width: number, height: number): void;
   updateFrame(now: number, dt: number, frameNo: number): void;
+  renderTo(renderer: WebGPURenderer): void;
 }
```

Optional zusätzlich für Pipeline-Konsumenten:

```ts
interface IPassProvider {
  asPassNode(renderer: WebGPURenderer): Node;
}
```

### 7.2 `Stage2D`

- `clearColor`, `clearAlpha`, `autoClear` **entfernen** (Migration:
  `Scene.background` benutzen, Clear-Verhalten gehört zum `StageRenderer`).
- `renderTo(renderer)` implementieren:
  ```ts
  renderTo(renderer: WebGPURenderer) {
    if (this.scene && this.camera) renderer.render(this.scene, this.camera);
  }
  ```
- Optional: `asPassNode()` (für §6.3).

### 7.3 `StageRenderer`

- Neue Properties: `clear: boolean`, defaults für `clearColor`/`clearAlpha`
  in dokumentierten Werten.
- `setClearColor(color, alpha?)` aktiviert `clear=true` als Convenience.
- `add()` / `remove()` / `setClearColor()` geben `this` zurück (fluent).
- Optional: `pipeline?: RenderPipeline`, `buildOutputNode?: (...)=>Node`,
  `outputRenderTarget?: WebGPURenderTarget`.
- `renderTo(renderer)` ist das alte `renderFrame(renderer)`. (Method
  kann unter beiden Namen erhalten bleiben; siehe Kompatibilität.)
- Im inneren Render-Loop statt `isStageRenderer`-Check schlicht
  `stage.renderTo(renderer)` aufrufen.
- `OnAddToParent` zusätzlich zu `OnRemoveFromParent` emittieren.

### 7.4 Events

- `OnAddToParent` ergänzen (Symmetrie zu `OnRemoveFromParent`).
- Doku: `OnStageAdded` ist am Parent, `OnAddToParent` am Child.

### 7.5 Demos

- `display-multi.astro` aufräumen: `new StageRenderer(display)` registriert
  bereits den Frame-Loop — den **zusätzlichen** manuellen
  `on(display, OnDisplayRenderFrame, ...)`-Handler entfernen, sonst läuft
  alles doppelt.

---

## 8. Migrations-Skizze (für ein zukünftiges Major-Release)

1. **Stage2D**: `clearColor`/`clearAlpha`/`autoClear` als deprecated
   markieren, im nächsten Major entfernen. Warnung im Setter, der heute
   ohnehin niemand auswertet.
2. **IStage**: `renderTo(renderer)` als **optional** einführen
   (`renderTo?: (...) => void`), so dass externe Implementierer Zeit zum
   Nachziehen haben. Sobald das durch ist, optional zu required machen.
3. **StageRenderer**: neue Methoden additiv (`pipeline`, `setClearColor`
   fluent return, `clear`-Flag). `clearColor=Color`-Setter weiter
   unterstützen — der bestehende implizite Clear-Trigger bleibt
   abwärtskompatibel.
4. **Public API**: `IPassProvider`, ggf. `IStageRendererHost` über
   `stage/public-api.ts` exportieren (siehe `AGENTS.md`-Hinweis im Repo:
   alles Öffentliche **muss** dort re-exportiert sein).
5. **CHANGELOG**: laut `updating-changelog`-Konventionen unter `## [Unreleased]`
   `### Changed`/`### Deprecated`/`### Added` mit Migration-Notes für die
   public-API-Brüche.

---

## 9. Checkliste / Backlog

### Erledigt (Iteration 1: Konsistenz & API-Aufräumung, §3.1–§3.8 + §4 + §5)

- [x] `display-multi.astro`: doppeltes Frame-Driving entfernt (auto-driven mit
      fluent setClearColor + add).
- [x] `Stage2D.clearColor`/`clearAlpha`/`autoClear` **entfernt** (nicht nur
      deprecated — sie waren unbenutzt, also direkt raus).
- [x] `StageRenderer`: fluent return (`this`) für `add`, `remove`,
      `setClearColor`, `attach`, `detach`.
- [x] `StageRenderer.clear: boolean` als explizites Opt-in-Flag; alte
      `clearColor!=null`-Heuristik wird vom Setter intern aktiviert
      (Rückwärtskompatibilität).
- [x] `OnAddToParent`-Event zusätzlich zu `OnRemoveFromParent`.
- [x] Warnung bei Namens-Kollisionen (`add()` + non-default `renderOrder`).
      `renderOrder`-Argument bleibt `string` (bewusst, siehe Aufgabe).
- [x] `IStage` aufgespalten: `IStage` (Lifecycle) + neuer `IRenderable`
      (`renderTo`). `Stage2D` + `StageRenderer` implementieren beide.
      `isStageRenderer`-Check entfernt.
- [x] `IStageRendererHost`-Interface extrahiert; `StageRenderer.parent` ist
      jetzt `IStageRendererHost | StageRenderer`.
- [x] `setClearColor(color, alpha?)` Signatur gelockert auf `Color | null`,
      `setClearAlpha`-Restore liegt im `if (shouldClear)`-Zweig.
- [x] Tests: neue Vitest-Suite `StageRenderer.spec.ts` (21 Cases) +
      erweiterte `Stage2D.spec.ts`; Browser-Test
      `stage-renderer.test.js` in `@spearwolf/twopoint5d-testing`
      (Display-Integration, Multi-Stage, Nesting, `detach()`).
- [x] CHANGELOG `[Unreleased]` inkl. Migration Guides.
- [x] Lookbook-Demo `display-multi.astro` aktualisiert; `display-minimal.astro`
      auf das §4-Fluent-Idiom umgestellt; `quadtree-playground` auf
      explizites `setClearColor(null, 0)` migriert.
- [x] §4 (vereinfachte Standard-Verwendung): fluent `setClearColor`/`add`-Kette
      funktioniert, durch JSDoc + README dokumentiert.
- [x] §5 (Stages "übereinander"): `ClearStage` als public Marker-Stage
      ausgeliefert; Idiom + Cheat-Sheet in `src/stage/README.md`.

### Noch offen (Iteration 2: RenderPipeline / Post-Pass — siehe §6)

- [ ] `StageRenderer.outputRenderTarget?: WebGPURenderTarget` (Minimal-RT-Variante,
      §6.4).
- [ ] `StageRenderer.pipeline?: RenderPipeline` + Default-Render-Strategie
      (Pipeline läuft, sampelt internes RT).
- [ ] TSL-Komposition: `asPassNode()`, `buildOutputNode()`, verschachtelte
      Pipelines (§6.2 / §6.3).
- [ ] Browser-Tests für die Pipeline-Variante in `packages/twopoint5d-testing/`.

---

## 10. Anhang: betroffene Dateien

- `packages/twopoint5d/src/stage/IStage.ts`
- `packages/twopoint5d/src/stage/IRenderable.ts` (neu)
- `packages/twopoint5d/src/stage/IStageRendererHost.ts` (neu)
- `packages/twopoint5d/src/stage/Stage2D.ts`
- `packages/twopoint5d/src/stage/StageRenderer.ts`
- `packages/twopoint5d/src/stage/Canvas2DStage.ts`
- `packages/twopoint5d/src/stage/ClearStage.ts` (neu)
- `packages/twopoint5d/src/stage/public-api.ts`
- `packages/twopoint5d/src/stage/README.md` (neu, Cheat-Sheet)
- `packages/twopoint5d/src/events.ts`
- `apps/lookbook/src/pages/demos/display-multi.astro`
- `apps/lookbook/src/pages/demos/display-minimal.astro`
- `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts`
- Unit-Tests: `StageRenderer.spec.ts`, `Stage2D.spec.ts`, `ClearStage.spec.ts`
- Browser-Test in `packages/twopoint5d-testing/test/stage-renderer.test.js`
