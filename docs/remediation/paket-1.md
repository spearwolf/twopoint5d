# Paket 1 — Verschachteltes Kind-RT leeren, Pan-Tasten bei Fokusverlust und Eingaben zähmen, getForward als Richtung

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-113 (high), BUG-121 (high), BUG-122 (medium), BUG-115 (medium),
  TEST-042 (medium, Teil: Zwei-Frame-Test verschachteltes Plain-Kind, verlorenes
  `keyup`), TEST-004 (low, Teil: `PanControl2D.spec.ts`)
- Ziel: Ein verschachtelter StageRenderer ohne Pipeline zeigt pro Frame nur den
  aktuellen Inhalt, PanControl2D bewegt die Ansicht nur mit tatsächlich
  gehaltenen Tasten außerhalb von Eingabefeldern, und
  `ProjectionPlane.getForward()` liefert für jede Ebene die Richtung — jeweils
  mit Tests, die ohne den Fix rot sind.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/src/stage/ProjectionPlane.ts`
  - `packages/twopoint5d/src/stage/ProjectionPlane.spec.ts`
  - `packages/twopoint5d/src/controls/PanControl2D.ts`
  - `packages/twopoint5d/src/controls/PanControl2D.spec.ts` (neu)
  - `packages/twopoint5d-testing/test/stage-pipeline.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
  - Ungecacht dauert der Lauf mehrere Minuten (Coverage, dazu die Browser-Suite
    in Chromium und Firefox). Droht er die Frist des Bash-Werkzeugs zu reißen,
    mit `setsid` abkoppeln, Ausgabe und Exit-Code in Dateien, und in Blöcken
    unter der Frist warten — wie beim Implementierer-Prozess.
  - Schnelle Zwischenläufe für den Implementierer:
    `pnpm nx test twopoint5d -- src/controls/PanControl2D.spec.ts`,
    `pnpm nx test twopoint5d -- src/stage/StageRenderer.spec.ts src/stage/ProjectionPlane.spec.ts`,
    `pnpm test:browser` (baut die Bibliothek vorher; die Browser-Tests laufen
    gegen `dist/`).
- Commit: `fix: let a composing StageRenderer clear the pass target of a nested renderer to transparent black before it renders the child into it, let PanControl2D let go of every held key when the window loses focus or the page is hidden and pan by no key pressed with Ctrl, Meta or Alt or typed into an editable element, and let ProjectionPlane#getForward() answer the direction opposite the plane normal for a plane off the origin as well`
- Modellwahl: sechs Findings über zwei Module und beide Testflächen in einem
  Paket, dazu ein DOM-Stub-Harness unter Node und ein WebGPU-Pixel-Readback,
  die beide leicht danebengehen — ein Lauf auf der stärksten Stufe ist
  billiger als drei auf der mittleren. Effort bleibt `medium`: der Plan nennt
  Namen, Werte und Schritte, mehr Effort hieße mehr Hang zu Verbesserungen
  außerhalb davon.
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · BUG-113 unverändert (Zeile 588 → 590/592) · BUG-121, BUG-122, BUG-115 unverändert · TEST-042 (Teil) und TEST-004 (Teil) unverändert · keine offenen Folgen · 2 Nebenbefunde ins Paket (`PanControl2D.ts:649–651`, `stage/README.md:283`), 1 in »Offene Befunde« (`StageRenderer.ts:560`, → Audit) · Modell stärkste Stufe, Effort medium
  - 2026-09-29 Zug 1: Implementierer beauftragt (Runde 0, opus, Effort medium) · Brief `paket-1.impl-0.brief.txt`, Report nach `paket-1.impl-0.json`
  - 2026-09-29 Zug 2: Report `paket-1.impl-0.json` leer (Zug endete während CI im Hintergrund), gleiche Session fortgesetzt → `paket-1.impl-0-versuch-2.json` · FERTIG_MIT_VORBEHALT (eigener CI-Lauf unvollständig) · rote Läufe für A (Vitest 2 rot, Browser rot), B/C (12 rot), E (2 rot) · 8 Dateien geändert, 1 neu (`PanControl2D.spec.ts`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-1.verify.log`)
  - 2026-09-29 Zug 3: Reviewer (opus, Effort medium) `paket-1.review-0.json` · alle 6 Findings erfüllt · kritisch 0, wichtig 0, klein 2 · Diff `paket-1.diff`
  - 2026-09-29 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-29 Zug 5: Commit `e2026856` (9 Dateien, +545/−17), Trailer `Remediation-Run: 2026-09-29` · Verify aus Zug 2 trägt, keine Änderung seither · 1 Nebenbefund in »Offene Befunde« (→ Audit)

## Vorgehen

Reihenfolge je Fix: erst der Regressionstest, rot sehen (Ausgabe in den
Report), dann der Fix. Code, Kommentare und Doku auf Englisch, im Ton der
umgebenden Dateien; keine Finding-IDs, kein Satz über den Vorzustand (siehe
»Konventionen« im Plan-Kopf).

### A. Verschachtelter StageRenderer: Pass-Target pro Frame leeren

1. **Regressionstest (Vitest)** in `StageRenderer.spec.ts`, im
   `describe('asPassNode + buildOutputNode (§6.2 / §6.3)')`, direkt nach dem
   Test »nested StageRenderer is pre-rendered into its asPassNode-RT before
   parent pipeline runs« (heute Zeile 1011). Aufbau wie dort: `parent` mit
   `resize(100, 100)`, Pipeline-Mock und `buildOutputNode = (nodes) => nodes[0]`,
   `child` ohne Pipeline, `clear` auf dem Default `false`, darin
   `inner = fakeStage('inner')`. Eine gemeinsame Liste `log` protokolliert in
   Aufrufreihenfolge:
   - `renderer.clear.mockImplementation((...args) => log.push({kind: 'clear', target: renderer.__renderTarget, color: renderer.__clearColor.getHex(), alpha: renderer.__clearAlpha, args}))`
   - `inner.renderTo.mockImplementation(() => log.push({kind: 'draw', target: renderer.__renderTarget}))`

   `parent.renderTo(renderer)` **zweimal** aufrufen. Erwartet, je Frame: vor dem
   `draw` des Frames genau ein `clear` mit `target` gleich dem Ziel des `draw`
   (das asPassNode-RT des Kindes), `args` `[true, true, false]`, `color`
   `0x000000`, `alpha` `0`. Nach jedem Frame stehen `renderer.__clearColor`
   und `renderer.__clearAlpha` wieder auf den Werten des Mocks (`0x111111`,
   `0.5`). Vor dem Fix gibt es keinen `clear` auf dem Kind-RT → rot.
2. **Zweiter Test (Wächter)** gleich daneben: das Kind mit
   `child.setClearColor(new Color(0x123456), 0.25)`. Erwartet auf dem Kind-RT
   vor dem `draw` in dieser Reihenfolge: der transparent-schwarze Clear
   (`0x000000`, `0`, `[true, true, false]`), dann der Clear des Kindes
   (`0x123456`, `0.25`, `[true, true, true]`). Dieser Test ist vor dem Fix
   nicht rot (dort fehlt nur der erste Clear, der zweite steht); er hält fest,
   dass die eigene Farbe des Kindes zuletzt gilt.
3. **Fix** in `StageRenderer.ts`:
   - Eine Modulkonstante `const TRANSPARENT_BLACK = new Color(0x000000);`
     (nie beschrieben — `setClearColor()` kopiert sie).
   - Eine private Methode `#clearToTransparentBlack(renderer: WebGPURenderer): void`:
     alte Clear-Alpha merken (`renderer.getClearAlpha()`), alte Clear-Farbe in
     `this.#oldClearColor` holen (`renderer.getClearColor(this.#oldClearColor)`),
     `renderer.setClearColor(TRANSPARENT_BLACK, 0)`,
     `renderer.clear(true, true, false)`, danach
     `renderer.setClearColor(this.#oldClearColor, oldClearAlpha)`. Farbe **und**
     Alpha explizit setzen: bei `renderer.alpha === false` behält ein
     WebGPU-Clear das RGB der Clear-Farbe auch bei Alpha 0
     (`WebGPUBackend#getClearColor()` multipliziert nur bei `alpha === true`
     vor), und eine additive Komposition (`RootRenderPipeline`) würde diese
     Tönung pro Kind aufaddieren.
   - In `#renderPipelineComposed()`, in der Schleife über die Kinder (heute
     Zeile 585–595): unmittelbar nach `renderer.setRenderTarget(childRT);`, im
     `try` und **vor** `stage.#renderToCurrentTarget(renderer)`, der Aufruf
     `this.#clearToTransparentBlack(renderer);` — **immer**, unabhängig von
     `stage.clear` und davon, ob das Kind eine Pipeline hat. Ein Kommentar
     sagt, warum: das Pass-Target des Kindes gehört niemandem sonst, der es
     leert; ein Kind ohne `clear` zeichnet seine Stages direkt hinein, und ein
     Kind mit `clear`, aber `clearColorBuffer`/`clearDepthBuffer` auf `false`,
     leert es nur zum Teil — ohne diesen Clear stünde der Vorframe darunter.
   - `#clearForInternalRT()` (Mode C) bleibt **unverändert** — siehe
     »Abgleich und Triage«, Punkt 3.
4. **Doku** mitziehen, alle drei Stellen in `StageRenderer.ts` bzw. `README.md`:
   - Klassen-TSDoc von `StageRenderer`, Abschnitt `## Clearing`: ein Satz dazu,
     dass ein Renderer, den ein Parent über `asPassNode()` komponiert, in ein
     Pass-Target zeichnet, das der Parent zu Beginn jedes Frames zu
     transparentem Schwarz leert (Farbe und Depth); ein eigenes `clear` des
     Kindes wirkt danach obendrauf.
   - TSDoc von `asPassNode()`: der Satz »`StageRenderer` does that
     automatically for nested `StageRenderer` children« sagt, dass der Parent
     das Target erst zu transparentem Schwarz leert und das Kind dann
     hineinrendert.
   - `src/stage/README.md`:
     - Abschnitt »Clear policy in one table«, nach dem Absatz »When the
       renderer has a `pipeline`, the **internal pass-target** is always
       cleared …«: ein eigener Absatz für das Pass-Target eines verschachtelten
       `StageRenderer` (vom Parent jedes Frame zu transparentem Schwarz
       geleert, Farbe und Depth, gleich was `clear` des Kindes sagt; ein Kind
       mit `clear = true` leert es danach mit der eigenen Farbe). Den
       vorhandenen Satz über Mode C **nicht** anfassen.
     - Aufzählung unter »Composing post-effects« (heute Zeile 283–285): »A
       nested `StageRenderer.asPassNode()` returns `texture(internalRT.texture)`;
       the parent automatically pre-renders the child into that RT before the
       pipeline runs.« neu fassen: der Knoten sampelt das eigene Pass-Target
       des Kindes (nicht `internalRT` — das ist das Target von Mode C), und vor
       dem Lauf der Pipeline leert der Parent dieses Target und rendert das
       Kind hinein.
     - Mode E (heute Zeile 339–341): »the root pre-renders the child into that
       RT before its own pipeline runs« → »the root clears that RT and
       pre-renders the child into it …«.
5. **Browser-Test mit Pixel-Readback** in
   `packages/twopoint5d-testing/test/stage-pipeline.test.js`, als weiteres
   `it` im vorhandenen `describe('StageRenderer — pipeline integration')`,
   Aufbau wie die Nachbarn (`makeContainer()`, `new Display(host)`,
   `await display.start()`; Aufräumen über das vorhandene `afterEach`).
   Ablauf, manuell getrieben (kein Host an den StageRenderern):
   - `target = new RenderTarget(64, 64)` — 64 wegen der Zeilenausrichtung, die
     `rgbAt()` in `helpers/fixtures.js` voraussetzt.
   - `stage = new Stage2D(new OrthographicProjection('xy|bottom-left'))` — ohne
     Specs `fit: 'fill'`, also 64 × 64 Einheiten auf 64 × 64 Pixel, Kamera
     symmetrisch um den Ursprung.
   - `mesh = new Mesh(new PlaneGeometry(16, 16), new MeshBasicMaterial({color: new Color('#0f0')}))`,
     `mesh.position.x = -16`, in `stage.scene`.
   - `child = new StageRenderer().add(stage)` (keine Pipeline, `clear` bleibt
     `false`), `root = new StageRenderer().add(child)`,
     `root.pipeline = new RootRenderPipeline(display.renderer)`,
     `root.outputRenderTarget = target`, `root.resize(64, 64)`.
   - Frame 1: `root.renderTo(display.renderer)`, dann
     `first = await display.renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64)`.
   - `mesh.position.x = 16`, Frame 2 genauso → `second`.
   - Erwartet mit `rgbAt()`/`isNearColor()` aus den Fixtures: in `first` ist
     Pixel `(16, 32)` grün `[0, 255, 0]`; in `second` ist `(16, 32)` schwarz
     `[0, 0, 0]` (Meldung: wo der Inhalt einen Frame vorher stand) und
     `(48, 32)` grün. Vor dem Fix bleibt `(16, 32)` in `second` grün → rot.
     Reines Grün und Schwarz, damit die Farbkodierung der Pipeline das
     Ergebnis nicht verschiebt.
   - Am Ende des Tests: `root.dispose()`, `child.dispose()`, `stage.dispose()`,
     Pipeline, `target`, Geometrie und Material freigeben — die Pipeline
     gehört dem Test, der Renderer lässt sie vorher los (siehe die
     vorhandenen Tests am Dateiende).
   - Neue Imports: `OrthographicProjection`, `RootRenderPipeline` aus
     `@spearwolf/twopoint5d`, `RenderTarget` aus `three/webgpu`, `isNearColor`,
     `rgbAt` aus `./helpers/fixtures.js`.

### B. PanControl2D: gehaltene Tasten bei Fokusverlust freigeben

Datei `packages/twopoint5d/src/controls/PanControl2D.ts`.

1. Konstanten neben `KEYUP`/`KEYDOWN`: `const BLUR = 'blur';` und
   `const VISIBILITYCHANGE = 'visibilitychange';`.
2. Ein Handler `#onKeyboardLost = (): void => { this.#releaseKeyedSpeeds(); };`
   für beide Ereignisse, mit Kommentar: ein Fenster ohne Fokus oder eine
   verborgene Seite schickt das `keyup` einer losgelassenen Taste woanders hin
   (Fensterwechsel, Tab-Wechsel, ein Dialog, den ein Shortcut geöffnet hat).
   Keine Prüfung auf `document.visibilityState`: auch das Umschalten auf
   `visible` darf freigeben, denn während die Seite verborgen war, kam kein
   `keydown` an, und eine weiter gehaltene Taste setzt ihr Feld mit dem
   nächsten wiederholten `keydown` wieder.
3. Im Setter `keyboardDisabled`: bei `false` zusätzlich
   `this.addEventListener(window, BLUR, this.#onKeyboardLost)` und
   `this.addEventListener(document, VISIBILITYCHANGE, this.#onKeyboardLost)`,
   bei `true` beide mit `removeEventListener` wieder abnehmen (vor dem
   vorhandenen `#releaseKeyedSpeeds()`). `unsubscribe()`, `subscribe()` und
   `dispose()` erfassen sie damit über die Liste der Basisklasse von selbst.
4. TSDoc mitziehen:
   - `unsubscribe()`: »Take every listener off `document`« → off `document`
     and `window`.
   - `dispose()`: derselbe erste Satz. Dazu der Satz in Zeile 649–651, der
     heute grammatisch zerfallen ist (»… and by a key that was still held down
     when `dispose()` ran gives its field back …«): so neu fassen, dass er
     sagt, was der Code tut — `update()` bewegt `panView` weiter um die
     Speed-Felder, die ein Aufrufer von Hand setzt; eine Taste, die beim
     `dispose()` noch gehalten war, hat ihr Feld zurückgegeben; was nicht mehr
     geliefert wird, ist der Pan eines Drags von vor dem Aufruf.

### C. PanControl2D: Tasten für Shortcuts und Eingabefelder ignorieren

Entscheidung vom 2026-09-29 (Plan, »Entscheidungen«): immer, ohne Option;
`keyup` gibt weiterhin jede passende Taste frei.

1. Modul-Helfer über der Klasse, per Eigenschaft statt `instanceof` (wie
   `pinnedRootOf()` es für Shadow Roots tut, damit ein Element eines anderen
   Realms durchgeht):

   ```ts
   const isEditableTarget = (target: EventTarget | null | undefined): boolean => {
     if (target == null) return false;
     if ('isContentEditable' in target && target.isContentEditable === true) return true;
     if (!('localName' in target)) return false;
     const {localName} = target;
     return localName === 'input' || localName === 'textarea' || localName === 'select';
   };
   ```

   Die `in`-Prüfungen verengen den Typ ohne Cast; ein `as Partial<HTMLElement>`
   auf ein `EventTarget` fällt je nach Compiler-Laune unter »neither type
   sufficiently overlaps«.

2. In `#onKeyDown`, vor `#speedFieldFor()`:
   - `if (event.ctrlKey || event.metaKey || event.altKey) return;`
   - `if (isEditableTarget(event.composedPath()[0] ?? event.target)) return;`
     — `composedPath()[0]`, weil der Listener auf `document` sitzt und der
     Browser `event.target` dort auf den Shadow Host umlenkt; ein `<input>` in
     einem offenen Shadow Root wäre sonst unsichtbar. Das passt zur Klasse, die
     Shadow Roots schon für Cursor und Koordinaten bedient.
   - Kommentar zum Warum: ein Tastendruck mit Ctrl, Meta oder Alt gilt einem
     Shortcut des Browsers oder der App, einer in ein Eingabefeld dem Feld.
   - Shift bleibt **ungefiltert** (die Entscheidung nennt Ctrl/Meta/Alt).
3. `#onKeyUp` bleibt, wie es ist.
4. TSDoc von `PanControl2DOptions.keys`: ein Absatz dazu — ein Tastendruck
   mit Ctrl, Meta oder Alt und einer, der in ein `input`, `textarea`, `select`
   oder ein Element mit `contenteditable` geht (auch in einem offenen Shadow
   Root), pant nicht; sein `keyup` gibt eine vorher gehaltene Taste trotzdem
   frei. Und: verliert das Fenster den Fokus oder wird die Seite verborgen,
   lässt der Control jede gehaltene Taste los. `PanControl2D#keys` verweist
   schon per `@see` hierher.

### D. `PanControl2D.spec.ts` (neu, Vitest)

Der Vitest-Lauf hat kein DOM (Umgebung `node`, kein jsdom/happy-dom). Muster
wie `src/display/Display.spec.ts`: Globals in `beforeEach` mit
`vi.stubGlobal()`, in `afterEach` `vi.unstubAllGlobals()` (die Konfiguration
stellt Spies zurück, keine Globals) und jede Control mit `dispose()`.

- `vi.mock('../display/Stylesheets.js', () => ({Stylesheets: {retainRule: vi.fn(() => 'pan-cursor'), releaseRule: vi.fn()}}))`.
- `document`: ein echtes `EventTarget` (damit `addEventListener`/`dispatchEvent`
  wirken), per `Object.assign` ergänzt um `head` (antwortet auf
  `getRootNode()` mit dem Dokument-Stub und trägt `ownerDocument` mit genau
  diesem `head` — das braucht `pinnedRootOf()`) und `body` (mit
  `classList.add/remove` und `getBoundingClientRect()` →
  `{left: 0, top: 0}`).
- `window`: ein eigenes `new EventTarget()`.
- `CSS`: `{supports: () => true}`.
- Tastatur- und Pointer-Ereignisse: `KeyboardEvent`/`PointerEvent` gibt es in
  Node nicht. Ein Helfer baut `new Event(type)` und setzt die Felder mit
  `Object.defineProperties` (`code`, `keyCode`, `ctrlKey`, `metaKey`,
  `altKey`, `shiftKey`; für Pointer `pointerId`, `isPrimary`, `pointerType`,
  `buttons`, `clientX`, `clientY`) sowie `composedPath` als Funktion, die
  `[origin]` liefert, wenn ein Ursprung angegeben ist, sonst `[]`. Gesendet
  wird über `document.dispatchEvent(event)`.
- Controls mit `state: {x: 0, y: 0, pixelRatio: 1}`.

Tests, gruppiert:

1. **Tasten, die die Seite verliert** (vor Fix B rot, bis auf den Wächter):
   - `keydown` `KeyW`, dann `window` `blur` → `speedNorth === 0`, und
     `update(1)` lässt `panView.y` stehen.
   - `keydown` `KeyD`, dann `visibilitychange` auf `document` →
     `speedEast === 0`, `update(1)` bewegt nichts.
   - Wächter: ein von Hand gesetztes `speedWest = 50` übersteht `blur`.
   - Nach `keyboardDisabled = true` und wieder `false` greift `blur` weiterhin;
     nach `dispose()` sind `blur` auf `window` und `visibilitychange` auf
     `document` abgenommen (Spy auf `removeEventListener` beider Stubs, mit
     demselben Handler, der angemeldet wurde).
2. **Tasten für etwas anderes** (vor Fix C rot, bis auf die Gegenproben):
   - `keydown` `KeyW` mit `ctrlKey`, mit `metaKey`, mit `altKey` (`it.each`)
     → `speedNorth === 0`.
   - `keydown` `KeyW` mit Ursprung `{localName: 'input'}`, `'textarea'`,
     `'select'` und `{localName: 'div', isContentEditable: true}` (`it.each`)
     → `speedNorth === 0`.
   - `keydown` `KeyW`, dessen `composedPath()[0]` ein `{localName: 'input'}`
     ist, während `event.target` der Dokument-Stub bleibt (Eingabefeld in
     einem offenen Shadow Root) → `speedNorth === 0`.
   - Gegenprobe: `keydown` `KeyW` mit `shiftKey` pant; `keydown` `KeyW` mit
     Ursprung `{localName: 'canvas'}` pant.
   - `keyup` gibt frei, woher es auch kommt: `keydown` `KeyW` ohne alles
     (pant), dann `keyup` `KeyW` mit Ursprung `{localName: 'input'}` und
     `ctrlKey` → `speedNorth === 0`.
3. **Optionen** (Abdeckung, nicht rot vor dem Fix):
   - `speed: 40`: `pixelsPerSecond === 40`; `keydown` `KeyS`, `update(0.5)` →
     `panView.y === 20`.
   - `keys` mit den Pfeiltasten: `ArrowLeft` setzt `speedWest`, `KeyA` nicht.
   - `keyCodes: [38, 40, 37, 39]` bei Default-`keys`: `keyCode` 38 setzt
     `speedNorth`, `KeyW`/87 nicht; mit `keys` und `keyCodes` zusammen gewinnt
     `keys`.
   - `disableKeyboard: true`: `keydown` bewegt nichts; `keyboardDisabled =
     false` danach schaltet sie ein.
   - `mouseButton: 2`: `pointerdown` mit `buttons: 1` sammelt keinen Pan,
     mit `buttons: 2` und einem `pointermove` um `+10` in x bewegt `update(0)`
     `panView.x` um `-10`.
   - `disablePointer: true`: derselbe Drag bewegt nichts.
   - `state`: das übergebene Objekt ist `panView` und wird beschrieben; das
     erste `update()` sendet `update` auch ohne Bewegung (Listener über
     `on(control, 'update', …)` aus `@spearwolf/eventize`).

Zwei Controls in einer Root, Touch, Zwei-Pointer und `pointercancel` gehören
**nicht** in dieses Paket (Entscheidung 2026-09-29; bleiben mit TEST-004
offen).

### E. `ProjectionPlane.getForward()` als Richtung

1. **Regressionstests** in `ProjectionPlane.spec.ts`, im vorhandenen Stil
   (`.equals(new Vector3(…))` mit `toBeTruthy()` — `toEqual` unterscheidet
   `-0` von `0` und stolpert über das `negate()`):
   - Eigene Ebene `new THREE_Plane(new Vector3(0, 0, 1), 1)` mit `up`
     `(0, 1, 0)`: `getForward()` ist `(0, 0, -1)` (vorher Nullvektor → rot),
     `getRight()` ist `(1, 0, 0)`, `getPoint(5, 4)` ist `(5, 4, -1)`.
   - Dasselbe mit `constant` `5`: `getForward()` `(0, 0, -1)` (vorher
     `(0, 0, 4)` → rot), `getRight()` `(1, 0, 0)`, `getPoint(5, 4)`
     `(5, 4, -5)`.
   - `getForward(target)` gibt `target` selbst zurück und schreibt hinein.
2. **Fix** in `ProjectionPlane.ts`:
   `getForward(target?: Vector3): Vector3 { return (target ?? new Vector3()).copy(this.plane.normal).negate(); }`
3. Kurzes TSDoc an `getForward()` (die Richtung, in die eine Kamera vor der
   Ebene auf sie schaut: die negierte Normale, gleich lang wie sie) und an
   `getRight()` (`getForward()` × `up`, die x-Achse auf der Ebene).
   `applyRotation()`, `getPointByDistance()` und `getOrigin()` bleiben, wie
   sie sind. Aufrufer außerhalb der Datei gibt es nicht (geprüft per grep
   über `packages/`, `apps/`, `docs/`).

### F. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`, nach dem
Skill `updating-changelog`:

- `### Changed`: `PanControl2D` pant nicht mehr um einen Tastendruck mit Ctrl,
  Meta oder Alt und nicht um einen, der in ein `input`, `textarea`, `select`
  oder `contenteditable`-Element geht, auch in einem offenen Shadow Root; das
  `keyup` einer vorher gehaltenen Taste gibt sie weiterhin frei, woher es auch
  kommt. Ohne Option (so entschieden).
- `### Fixed`, drei Einträge:
  - ein `StageRenderer`, den ein Parent über `asPassNode()` komponiert, zeigt
    pro Frame nur den aktuellen Inhalt: der Parent leert sein Pass-Target vor
    jedem Vorab-Rendern zu transparentem Schwarz, Farbe und Depth.
  - `PanControl2D` lässt jede gehaltene Taste los, wenn das Fenster den Fokus
    verliert oder die Seite verborgen wird.
  - `ProjectionPlane#getForward()` liefert für jede Ebene die negierte
    Normale; `getRight()` und `getPoint()` stimmen damit auch für eine Ebene,
    die nicht durch den Ursprung geht.
- Kein Eintrag im »Migration Guide«: keine Signatur ändert sich, und für das
  neue Tastenverhalten gibt es keinen Schalter, auf den man migrieren könnte.

## Abgleich und Triage (Zug 0, 2026-09-29)

Basis: `77211843` (HEAD, noch kein Commit dieses Laufs). Alles unten ist
damit vorbestehend.

- **BUG-113 — unverändert**, zwei Zeilen gewandert:
  `StageRenderer.ts:590` `renderer.setRenderTarget(childRT)`, `:592`
  `stage.#renderToCurrentTarget(renderer)` ohne vorheriges `clear`;
  `#renderStagesInline()` `:512` leert nur bei `this.clear`;
  `#clearForInternalRT()` `:560` ist das Gegenstück von Mode C.
- **BUG-121 — unverändert**: `PanControl2D.ts:624` `#onKeyDown`, `:357`
  Setter `keyboardDisabled` meldet nur `keydown`/`keyup` an, `:406`
  `unsubscribe()` ruft `#releaseKeyedSpeeds()`. Kein `blur`- oder
  `visibilitychange`-Listener in `src/controls/`.
- **BUG-122 — unverändert**: `PanControl2D.ts:606` `#speedFieldFor()` liest
  nur `code`/`keyCode`; `#onKeyDown` `:624` schaut weder auf `event.target`
  noch auf Modifier.
- **BUG-115 — unverändert**: `ProjectionPlane.ts:69–71`
  `return this.getPointByDistance(1, target).negate();`, `getRight()` `:73`,
  `getPoint()` `:77`. `ProjectionPlane.spec.ts` prüft `getForward`/`getRight`/
  `getPoint` nur an Presets.
- **TEST-042 (Teil) — unverändert**: `stage-pipeline.test.js` hat keinen
  Pixel-Readback und keinen Fall mit verschachteltem Plain-Kind;
  `pan-control-keys.test.js` hat keinen Test für ein verlorenes `keyup`.
- **TEST-004 (Teil) — unverändert**: `src/controls/` hat nur
  `InputControlBase.spec.ts`, keine `PanControl2D.spec.ts`.
- **Offene Folgen**: keine — es gibt noch kein erledigtes Paket.
- **Offene Befunde**: die Queue war leer.

Beim Abgleich aufgefallen:

1. `PanControl2D.ts:649–651`, TSDoc von `dispose()`: der Satz über eine beim
   `dispose()` gehaltene Taste ist grammatisch zerfallen. **Ins Paket**
   (Schritt B.4): derselbe Absatz muss für den neuen `window`-Listener ohnehin
   neu gefasst werden, und der Satz handelt vom Freigeben gehaltener Tasten —
   dem Gegenstand von BUG-121.
2. `README.md:283` (stage) nennt für den Knoten eines verschachtelten
   `StageRenderer` `texture(internalRT.texture)`; der Knoten sampelt aber
   `#asPassNodeRT`. **Ins Paket** (Schritt A.4): der Satz beschreibt das
   Vorab-Rendern, das Fix A ändert, und wird deshalb ohnehin neu gefasst.
3. `StageRenderer.ts:560–569`, `#clearForInternalRT()`: Mode C leert sein
   internes RT mit der aktuellen Clear-Farbe des Renderers bei Alpha 0, nicht
   zu transparentem Schwarz, wie `README.md:204–206` es sagt; bei
   `renderer.alpha === false` bleibt deren RGB stehen. **Nicht ins Paket**:
   für ein einzelnes Mode-C-Target zeigt sich die Farbe als Hintergrund,
   was Aufrufer, die `renderer.setClearColor()` setzen, erwarten dürften —
   den Code zu ändern wäre eine sichtbare Verhaltensänderung außerhalb der
   Ursache dieses Pakets, und welche Seite (Code oder README) nachgibt, ist
   eine eigene Frage. Geschätzt `low` (Doku weicht vom Code ab, sichtbar nur
   bei nicht-schwarzer Renderer-Clear-Farbe) → »Offene Befunde« mit
   `→ Audit`. Der neue Clear des verschachtelten Pass-Targets (Fix A) setzt
   deshalb Farbe und Alpha selbst, statt `#clearForInternalRT()`
   wiederzuverwenden.

## Abweichungen von der Empfehlung des Audits

- **BUG-113**: Das Audit empfiehlt, das Kind-RT »wie in
  `#clearForInternalRT()`« zu leeren, mit der Farbe des Kindes bei
  `child.clear`. Umgesetzt wird stattdessen ein Clear zu echtem transparentem
  Schwarz, immer, und die eigene Farbe des Kindes kommt über dessen eigenen
  Clear danach. Gründe: (a) `#clearForInternalRT()` lässt das RGB der
  Renderer-Clear-Farbe stehen (Befund 3 oben), und `RootRenderPipeline`
  addiert die Pass-Knoten — die Tönung käme pro Kind hinzu; (b) ein Kind mit
  `clear = true`, aber `clearColorBuffer = false` würde sein Target sonst nur
  teilweise leeren, und die Schlieren blieben. Der Preis ist ein zweiter Clear
  pro Frame für ein Kind mit eigenem `clear`.

## Restplan

Paket 1 ist das einzige Paket des Laufs. Keine verschobenen oder weggefallenen
Findings, keine verteilten Folgen — Reihenfolge und Schnitt bleiben.

## Urteil des Reviewers (Zug 3, `paket-1.review-0.json`)

- **BUG-113 — behoben**: `StageRenderer.ts:602` Clear nach `setRenderTarget(childRT)`, im `try`, vor `#renderToCurrentTarget()`; `#clearToTransparentBlack()` `:627–634`, `TRANSPARENT_BLACK` `:31`; Doku `StageRenderer.ts:80–82`, `:1031–1034`, `README.md:208–211`, `:287–290`, `:345–347`.
- **BUG-121 — behoben**: `PanControl2D.ts:51–52` Konstanten, Setter `keyboardDisabled` `:378–379`/`:383–384`, `#onKeyboardLost` `:666–672`, TSDoc `:419–420`, `:675–689`.
- **BUG-122 — behoben**: `isEditableTarget` `PanControl2D.ts:94–100`, Filter in `#onKeyDown` `:646–651`, TSDoc `keys` `:157–160`; Shift ungefiltert, `#onKeyUp` unverändert.
- **BUG-115 — behoben**: `ProjectionPlane.ts:72–74`; Tests für `constant` 1 und 5 und `getForward(target)` in `ProjectionPlane.spec.ts`.
- **TEST-042 (Teil) — erfüllt**: `stage-pipeline.test.js:243–285` (Zwei-Frame-Pixel-Readback), `PanControl2D.spec.ts:103–163` (verlorenes `keyup`), `StageRenderer.spec.ts:1043–1111`.
- **TEST-004 (Teil) — erfüllt**: `PanControl2D.spec.ts` neu (Fokusverlust, Tastenfilter, Optionen `speed`, `keys`, `keyCodes`, `disableKeyboard`, `mouseButton`, `disablePointer`, `state`).

Kleine Befunde (lösen keine Runde aus, nicht behoben):

- `packages/twopoint5d/src/controls/PanControl2D.ts:429` — Inline-Kommentar in `unsubscribe()` sagt noch »with the listeners off document«; richtig wäre »off document and window« wie die TSDoc darüber.
- `packages/twopoint5d/src/controls/PanControl2D.spec.ts:184–196` — der Shadow-Root-Test baut dasselbe Ereignis wie der `input`-Fall des `it.each` darüber und fängt keine zusätzliche Regression; nur die Assertion `target === doc` macht die Retargeting-Annahme sichtbar.

Anmerkungen:

- Implementierer-Abweichung: der Wächtertest aus A.2 ist vor dem Fix doch rot (er verlangt beide Clears in Reihenfolge); die Aussage in A.2 stimmte nicht, der Test ist wie spezifiziert.
- Nebenbefund `StageRenderer.ts:567–576` (Mode C, `clear = true` mit abgeschaltetem `clearColorBuffer`/`clearDepthBuffer` leert nur teilweise): vorbestehend (`git show 77211843`), gleiche Funktion wie der Eintrag aus Zug 0. Urteil `low`: tritt nur auf, wenn ein Aufrufer einen Buffer-Clear ausdrücklich abschaltet — dort kann Akkumulation sogar gewollt sein; der Widerspruch liegt vor allem in der README-Zusage. → Audit.

## Findings im Volltext

**BUG-113 · high · packages/twopoint5d/src/stage/StageRenderer.ts:588** —
Verschachtelten StageRenderer ohne eigene Pipeline vor dem Vorab-Rendern in
sein asPassNode-RenderTarget leeren

Im komponierten Modus (`pipeline` mit `buildOutputNode` oder
`RootRenderPipeline`) rendert der Parent jedes Kind-`StageRenderer` pro Frame
in dessen `#asPassNodeRT`: `setRenderTarget(childRT)` und dann direkt
`stage.#renderToCurrentTarget(renderer)` (Zeile 588–595). Hat das Kind keine
eigene Pipeline, landet das in `#renderStagesInline()`, das nur bei
`clear === true` löscht und sonst `autoClear = false` setzt (Zeile 514–516).
Mit dem Default `clear = false` wird das RenderTarget also nie gelöscht: Farbe
und Depth des Vorframes bleiben stehen, bewegte Sprites ziehen Schlieren, und
die Depth-Werte des Vorframes verdecken neue Geometrie. Modus C schützt sein
internes RT genau dagegen mit `#clearForInternalRT()` (Zeile 560–569, README:
»so frame content does not accumulate«); der Pfad für verschachtelte Kinder
hat kein Gegenstück. Aufrufpfad: Display.onRenderFrame → Parent.renderTo →
#renderToCurrentTarget → #renderPipelineComposed →
child.#renderToCurrentTarget → #renderStagesInline. Der Test »nested
StageRenderer is pre-rendered into its asPassNode-RT« in
StageRenderer.spec.ts:1011 prüft nur das Ziel, nicht das Löschen.

Beleg: `renderer.setRenderTarget(childRT); try { stage.#renderToCurrentTarget(renderer);`
— ohne vorheriges `clear`

Empfehlung: Vor dem Vorab-Rendern das `childRT` pro Frame löschen wie in
`#clearForInternalRT()` (mit `child.clear` die Farbe/Alpha des Kindes, sonst
transparentes Schwarz inklusive Depth). Einen Test ergänzen, der zwei Frames
mit bewegtem Inhalt rendert und `renderer.clear` auf dem Kind-RT erwartet.

**BUG-121 · high · packages/twopoint5d/src/controls/PanControl2D.ts:624** —
Gehaltene Pan-Tasten bei Fokusverlust des Fensters freigeben

`#onKeyDown` setzt das Speed-Feld auf `pixelsPerSecond`, nur `#onKeyUp` nimmt
es zurück. Hält der Nutzer W/A/S/D und wechselt per Alt-Tab, Tab-Wechsel oder
einen Browser-Shortcut (Strg+S, Strg+D öffnen Dialoge) den Fokus, erreicht das
`keyup` das Dokument nie. `update()` verschiebt `panView` dann in jedem Frame
weiter, bis dieselbe Taste erneut gedrückt und losgelassen wird. Die Klasse
kennt das Problem — `unsubscribe()` und `keyboardDisabled` rufen
`#releaseKeyedSpeeds()` genau aus diesem Grund (Kommentar Zeile 401–403: »the
view would keep moving by a key nobody is pressing«) —, es fehlt aber ein
Listener auf `window` `blur` bzw. `document` `visibilitychange`.

Beleg: `#onKeyDown = (event) => { … this[field] = this.pixelsPerSecond; this.#keyedSpeeds.add(field); }`
— kein blur-Handler in src/controls

Empfehlung: Über `addEventListener()` der Basisklasse einen `blur`-Listener
auf `window` und einen `visibilitychange`-Listener auf `document` registrieren
(nur solange die Tastatur aktiv ist), die `#releaseKeyedSpeeds()` aufrufen.
Test: keydown, dann blur, dann `update(1)` bewegt nichts mehr.

**BUG-122 · medium · packages/twopoint5d/src/controls/PanControl2D.ts:606** —
Tastatur-Panning bei Eingabe in editierbare Elemente und bei
Modifier-Kombinationen überspringen

Die Key-Listener hängen an `document` und prüfen nur
`event.code`/`event.keyCode` (`#speedFieldFor`, Zeile 606–615). Tippt der
Nutzer in ein `<input>`, `<textarea>` oder `contenteditable` derselben Seite
ein »w« oder »a«, pant die Ansicht mit; ebenso Strg+S/Strg+D/Strg+A, die
zusätzlich den Fokus-Fall aus dem blur-Befund auslösen können.

Beleg: `holdsDefault(this.keys, DEFAULT_KEYS) && … ? this.keyCodes.indexOf(event.keyCode) : this.keys.indexOf(event.code)`
— kein Blick auf `event.target`, `ctrlKey`, `metaKey`, `altKey`

Empfehlung: In `#onKeyDown` Ereignisse mit `ctrlKey`/`metaKey`/`altKey` und
solche, deren `event.target` editierbar ist (`isContentEditable`, `input`,
`textarea`, `select`), ignorieren; optional als Option abschaltbar.
`#onKeyUp` weiter jede passende Taste freigeben lassen. (Option entfällt nach
der Entscheidung vom 2026-09-29.)

**BUG-115 · medium · packages/twopoint5d/src/stage/ProjectionPlane.ts:69** —
`ProjectionPlane.getForward()` als Richtung aus der Normalen berechnen statt
aus einem Punkt

`getForward()` gibt `getPointByDistance(1).negate()` zurück, also
`-(origin + normal)` — einen negierten Punkt, keine Richtung. Das stimmt nur
für Ebenen durch den Ursprung (`constant === 0`), was für die vier Presets
gilt. Der Konstruktor nimmt aber ausdrücklich eigene `THREE.Plane` an (Zeile
29–36). Mit `constant = c` ist `coplanarPoint = -c·normal`, `getForward()`
liefert `(c − 1)·normal`: bei `c = 1` den Nullvektor, bei `c > 1` die
umgekehrte Richtung. `getRight()` (Kreuzprodukt damit) wird dann null bzw.
gespiegelt, und `getPoint(x, y)` ignoriert bei `c = 1` den x-Anteil
(setLength auf einem Nullvektor) und spiegelt ihn bei `c > 1`.
`applyRotation()` ist nicht betroffen, weil es die Differenz zweier Punkte
nutzt. ProjectionPlane.spec.ts testet diese Methoden nur mit den Presets.

Beleg: `getForward(target?: Vector3): Vector3 { return this.getPointByDistance(1, target).negate(); }`

Empfehlung: `getForward(target)` als
`(target ?? new Vector3()).copy(this.plane.normal).negate()` schreiben; Tests
für eine eigene Ebene mit `constant` 1 und 5 ergänzen, die Richtung und Länge
von `getForward`, `getRight` und `getPoint` prüfen.

**TEST-042 · medium · packages/twopoint5d-testing/test/stage-pipeline.test.js**
(weitere Fundstelle: `pan-control-keys.test.js`) — Die riskantesten GPU-Pfade
der Stage und das verlorene keyup von PanControl2D mit Tests absichern

Der Display-Anteil (start/stop-Race, Chronometer, Dispose während Init,
Device-Pixel-Clamp bei dpr > 1) ist im Remediation-Lauf vom 2026-09-24
abgedeckt (`6a4bcacf`, `a33a6961`), der Sprites-Anteil (Billboards an einem
verschobenen Mesh, `texCoordsFromIndex` mit einer zweiten Zeile, die
Frame-Index-Formel samt `animOffset`, Zeit über der Dauer, zweiter Animation
und Dauer 0) im Lauf vom 2026-09-26 (`324ab4a1`). Offen bleiben die Pfade der
Stage, wo Vitest-Mocks nichts sehen: kein Pixel-Readback für Mode E und für ein
verschachteltes Plain-Kind über zwei Frames; dazu kein Test für ein verlorenes
`keyup`, und `PanControl2D` hat keine `*.spec.ts`.

Empfehlung: Für Mode E und das verschachtelte Plain-Kind je einen Browser-Test
mit Pixel-Readback ergänzen; für das verlorene `keyup` genügt eine
Vitest-Spec. **In diesem Paket nur**: der Zwei-Frame-Test für das
verschachtelte Plain-Kind und der Test für das verlorene `keyup`; der
Mode-E-Test bleibt mit BUG-114 offen (Entscheidung 2026-09-29).

**TEST-004 · low · packages/twopoint5d-testing/test/pan-control-input.test.js**
— Die Testlücken um Touch-Eingabe und PanControl2D schließen; controls steht
bei 15 % Vitest-Coverage

Der Display-Anteil (Pause/Restart, `stop()`, `visibilitychange`, `maxFps`,
`resizePollIntervalMs`, Init/Start-Reihenfolge, Rejection bei gescheitertem
Init) ist mit `Display.spec.ts` und `display-lifecycle.test.js` abgedeckt
(Remediation-Lauf vom 2026-09-24, `6a4bcacf`), `styleUtils` hat inzwischen
eine Spec. Offen bleibt `PanControl2D`: die Tests nutzen nur Maus mit
`pointerId: 1` — kein Touch, kein zweiter Pointer, kein `pointercancel`, keine
`mouseButton`/`keyCodes`-Optionen, keine zwei Controls in einer Root.
`PanControl2D.ts` steht bei 0 % Vitest-Coverage.

Empfehlung: `pan-control-input.test.js` um einen Touch-Pointer, einen
Zwei-Pointer-Merge und einen `pointercancel`-Fall erweitern; eine
`PanControl2D.spec.ts` für Optionen und zwei Controls in einer Root. **In
diesem Paket nur** die `PanControl2D.spec.ts` mit Optionen, Fokusverlust und
Tastenfilter (Entscheidung 2026-09-29).
