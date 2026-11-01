# Paket 1 — three.js 0.187 übernehmen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUILD-002 (info)
- Ziel: three und @types/three stehen auf 0.187, jede API-Folge in Library, Tests und Lookbook ist nachgezogen, und die Bindung des Releases an die three-Minor ist dokumentiert.
- Modell: stärkste Stufe — der Blast Radius einer three-Minor über zwei GPU-Backends und vier Browser ist vorab nur zum Teil absehbar, und eine Folge (Schritt 2) berührt den dokumentierten Vertrag von `Display#pause`.
- Effort: high — dieselbe Begründung; der Auftrag ist kein Transkript, ein Teil der Folgen zeigt erst das Gate.
- Dateien:
  - `pnpm-workspace.yaml`, `pnpm-lock.yaml`
  - `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/src/display/Display.spec.ts`, `packages/twopoint5d/src/display/FrameLoop.ts` (nur Kommentare prüfen)
  - `packages/twopoint5d-testing/test/display-lifecycle.test.js`, `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`, `packages/twopoint5d-testing/test/sprites-picking.test.js`
  - die Versionsstempel aus Schritt 4
  - `packages/twopoint5d/CHANGELOG.md`, `docs/architecture.md` (§5), `AGENTS.md`
  - dazu jede Datei, die das Gate nach der Hebung rot meldet (Schritt 5)

## Abgleich gegen den Code (Zug 0, 2026-10-31)

- **BUILD-002 — unverändert.** `pnpm-workspace.yaml:10` `'@types/three': ~0.186.0`,
  `:11` `three: ~0.186.1`; `packages/twopoint5d/package.json:62-65` nimmt alle vier
  Peers als `catalog:`. `pnpm view` am 2026-10-31: three `0.187.0` (veröffentlicht
  2026-10-30 08:09 UTC), @types/three `0.187.0` (2026-10-30 18:05 UTC) — beide älter als
  die 1440 Minuten von `minimumReleaseAge`, das Install geht durch.
- Die Bindung an die Minor ist schon an drei Stellen beschrieben, der **Ablauf einer
  Hebung fehlt**: `AGENTS.md:134-140` (Tilde, »every `three` bump is a release«),
  `docs/architecture.md:441-444` (§5, der Katalog-Bereich landet wörtlich im Manifest),
  `README.md:91-96` (für Nutzer: die Library folgt den 0.x-Minors einzeln). Nirgends steht,
  welche Schritte eine Hebung umfasst und was danach den Release auslöst.
- **Typ-Probe, kein Projektcode angefasst:** `tsc` (TypeScript 7) mit `paths` auf die
  Typen von @types/three 0.187.0 über `packages/twopoint5d/src` samt Specs,
  `packages/twopoint5d-testing/test` (checkJs) und `apps/lookbook/src/**/*.ts`: jeweils
  0 Fehler, gegen 0.186.0 ebenso. Die `.astro`-Dateien (33 importieren three) prüft nur
  `astro check` im Gate. Ein Bruch an der typisierten Oberfläche ist damit unwahrscheinlich;
  die Folgen liegen im Laufzeitverhalten.
- **Laufzeit-Folge, gefunden im Quelltext von three 0.187.0** (`src/renderers/common/`):
  `Renderer#init()` startet den internen Animation-Loop nicht mehr (0.186.1 tat es in
  `init()`, `Renderer.js:842`). Er startet erst mit `render()` (`Renderer.js:1827`),
  `compute()` (`:3246`) und `setAnimationLoop(callback)` mit einem Callback (`:2393`,
  `if ( callback !== null ) this._animation.start();`) — und **jeder dieser Aufrufe startet
  ihn neu, nachdem jemand ihn gestoppt hat**. `Animation#start()` fragt jetzt, ob er schon
  läuft (`Animation.js:71`, `if ( this._requestId !== null ) return;`), und läuft den ersten
  Tick synchron samt `info.reset()` und `nodeFrame.update()`. Das trifft
  `Display#pause` (Schritt 2).
- **Zweite absehbare Folge:** three 0.187 legt den Datensatz eines Attributs im
  WebGL-Backend unter dem Buffer-Attribut ab (`webgl-fallback/utils/WebGLAttributeUtils.js`,
  `backend.set( bufferAttribute, attributeData )`; three-PR #34690 »Unify handling of
  interleaved attributes«). Genau den Fehler umgeht `readBackInterleaved()` in
  `vertex-objects-gpu-upload.test.js:24-37` (Schritt 3).
- Unverändert in 0.187.0 und weiter gültig: `Camera#_reversedDepth` samt Getter
  (`cameras/Camera.js:66/76`) und sein Schreiber `Renderer#_updateCamera()` (`Renderer.js:3789`);
  `WebGLBackend#_onContextLost` (`WebGLBackend.js:244`, `canvasHandover.ts:121`);
  `Renderer#_animation` mit `start()`/`stop()` (`Display.ts:145-151`);
  `WebGPUAttributeUtils#createAttribute(attribute, usage)` (`:104`) und
  `#_getVertexFormat()` (`:599`) für `threeVertexLayout.spec.ts`.
- Aus den Migrationshinweisen r186 → r187 (three-Wiki »Migration Guide«) trifft nichts
  die typisierte Nutzung: kein Aufruf von `setViewport()`/`setScissor()`, kein PMREM,
  kein `pixelationPass()`, kein `renderer.library.addLight()`, kein Struct-Storage-Buffer,
  kein `iridescenceThicknessRange`, kein `ProxyNodeMaterial` in `packages/` und
  `apps/lookbook/src` (geprüft per grep).

## Triage

- »Offene Befunde« ist leer, unter keinem Paket steht eine `Folgen:`-Zeile — erstes Paket
  des Laufs, nichts zu verteilen.

## Vorgehen

Code, Kommentare und Doku auf Englisch; Fehlermeldungen nach AGENTS.md; keine
Finding-ID und kein Satz über den Vorzustand in Code, Kommentar, Test oder Doku
(Konventionen im Plan-Kopf). Ein Kommentar über three nennt die Version, gegen die er
geprüft ist (`three 0.187.0`), und beschreibt, was three *jetzt* tut.

1. **Katalog heben.** In `pnpm-workspace.yaml` genau zwei Zeilen:
   `'@types/three': ~0.187.0` und `three: ~0.187.0`. Kein `package.json` eines
   Workspace-Pakets ändert eine Version (AGENTS.md, »Shared dependency versions«). Dann
   `pnpm install` vom Repo-Root; `pnpm-lock.yaml` ändert sich mit, sonst nichts. Probe:
   `pnpm outdated -r` listet three und @types/three nicht mehr.

2. **`Display#pause` hält den Loop von three auch unter 0.187 still.** Der Vertrag
   im TSDoc von `pause` (`Display.ts:1255-1272`) bleibt, wie er ist: in der Pause steht der
   Animation-Loop des Renderers, und ein Callback, der danach auf den Renderer gesetzt
   wird, bekommt keinen Frame, solange er steht. Unter 0.187 bricht ihn jeder Draw in der
   Pause — ein eigenes `renderFrame()` (`docs/display.md:808` nennt den Fall), ein
   `SpritePicker#pick()`, ein `StageDirector#precompile()` — und jedes
   `renderer.setAnimationLoop(cb)`, weil three dabei `_animation.start()` ruft.

   a. **Zuerst die Regressionstests, nach Schritt 1 und vor dem Fix, rot sehen:**
      - Browser, `packages/twopoint5d-testing/test/display-lifecycle.test.js`, direkt nach
        dem Test in Zeile 118: `it('a paused display keeps the animation loop of three
        standing through a draw and through a callback set on the renderer', …)`. Ablauf:
        `start()`, `nextFrame()`, `pause = true`, `pausedAt = info.frame`; dann
        `display.renderer.render(new Scene(), new PerspectiveCamera())` (`Scene` und
        `PerspectiveCamera` aus `three/webgpu`) und
        `display.renderer.setAnimationLoop(() => ++called)`; `await animationFrames(5)`;
        erwartet `info.frame === pausedAt` und `called === 0`. Danach
        `renderer.setAnimationLoop(null)`, `pause = false`, `nextFrame()` und dieselbe
        Zählung wie im Test darüber: `ticks > 0` und `ticks < 15`.
      - Vitest, `packages/twopoint5d/src/display/Display.spec.ts`, neben dem Spec
        »stops the animation loop of three as the display goes into the pause, and
        starts it again once as it runs« (Zeile ~632, Fake-`_animation` per
        `Object.assign`): ein `animation.start()` während der Pause — so ruft three es
        aus `render()` und `setAnimationLoop()` — erreicht den `start` des Fakes nicht;
        `pause = false` ruft ihn genau einmal; danach ist `animation.start` wieder
        dieselbe Funktion wie vor der Pause (`toBe(originalStart)`); ein `dispose()` in
        der Pause stellt `start` ebenfalls zurück, ohne ihn zu rufen.
      Beide roten Läufe gehören in den Report.

   b. **Fix in `Display.ts`:** `#stopAnimationOfThree()` (Zeile 2076) hält den Loop nach
      `animation.stop()` fest, indem es `start` auf der Instanz mit einer eigenen
      No-op-Property überdeckt. Vorher merkt es sich
      `Object.getOwnPropertyDescriptor(animation, 'start')` — `undefined` für three's
      `Animation`, deren `start()` am Prototyp hängt; der Fake der Specs trägt `start` als
      eigene Property. Gespeichert wird beides im Feld (aus `#stoppedAnimationOfThree?:
      AnimationOfThree` wird z. B. `#heldAnimationOfThree?: {animation: AnimationOfThree;
      ownStart: PropertyDescriptor | undefined}`; Name frei, `#private`).
      `#startAnimationOfThree()` (Zeile 2091) stellt zuerst zurück — `Object.defineProperty`
      mit dem gemerkten Deskriptor, sonst `delete` der Überdeckung — und ruft dann
      `animation.start()`. Gibt das Display seinen Renderer frei (`#releaseRenderer()`,
      Zeile 2053, bzw. der Dispose-Pfad davor), während es den Loop hält, stellt es
      zurück, ohne zu starten, und leert das Feld. Die Früh-Returns von
      `#stopAnimationOfThree()` bleiben: kein Renderer, schon gehalten, kein `_animation`
      in passender Form, ein Callback noch auf dem Loop (`renderer.getAnimationLoop() !=
      null`) — dann hält es nichts fest.

   c. **Kommentare und TSDoc auf 0.187 bringen:** `Display.ts:135-139` (wann three den
      Loop startet, dass jeder dieser Aufrufe ihn nach einem Stopp wieder startet, und
      warum das Display deshalb `start` überdeckt); `:402-405` (`start()` fragt in 0.187,
      ob der Loop läuft — die Begründung »a second call would run a second rAF chain«
      entfällt; das Feld bleibt das Einzige, was das Display wieder startet); das TSDoc von
      `pause` `:1255-1268` (»three runs that loop from `renderer.init()` on« stimmt nicht
      mehr: ab dem ersten `render()`, `compute()` oder `setAnimationLoop()` mit Callback;
      »three 0.187 offers no public way …«; ein Draw oder ein Callback in der Pause startet
      den Loop nicht, er läuft mit dem nächsten Start des Displays). `Display.spec.ts:639`
      (»three has started its loop in init() already«) passend umformulieren.
      `FrameLoop.ts:105-107` lesen: der Guard gegen den Tick ohne Zeitstempel bleibt
      (`animation.start()` aus `#startAnimationOfThree()` läuft weiterhin einen solchen
      Tick, ebenso das Ende einer XR-Session); nur ändern, falls der Satz etwas Falsches
      behauptet. `docs/display.md` beschreibt den Loop von three nicht (grep) und bleibt.

3. **Interleaved-Readback im WebGL-Backend.** Ist nach Schritt 1 der Test »three still
   reads an interleaved attribute back as an empty buffer on the WebGL backend« in
   `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js` rot, entfallen er
   und der Helfer `readBackInterleaved()` (Zeilen 24-37), wie dessen Doc-Kommentar es
   vorschreibt; jeder Aufrufer liest dann über den gewöhnlichen Weg zurück, den der Helfer
   für WebGPU schon nimmt. Ist er grün, bleibt beides, und der Stempel in Zeile 31 wird
   nach Schritt 4 behandelt.

4. **Versionsstempel.** Jede Aussage über three mit Versionsangabe gegen den Quelltext
   von three 0.187.0 (`node_modules/.pnpm/three@0.187.0/node_modules/three/src/…`) bzw.
   @types/three 0.187.0 prüfen. Hält sie, wird der Stempel `0.187.0` (`r186` → `r187`,
   `@types/three@0.186.0` → `@types/three@0.187.0`, eine genannte Zeilennummer neu
   ermittelt). Hält sie nicht, ändern sich Code und Kommentar, und die Abweichung steht im
   Report.
   - `packages/twopoint5d/src/testing/threeInternals.ts:1-3` und `:24` —
     `threeInternals.spec.ts` meldet ein verschobenes Internum selbst.
   - `packages/twopoint5d/src/sprites/SpritePicker.ts:69` (Projektion für den
     reversed depth buffer, `Matrix4#makePerspective()`/`#makeOrthographic()`; `Matrix4.js`
     hat sich in 0.187 geändert) und `:416` (kein Readback eines Integer-Targets unter
     WebGL 2).
   - `packages/twopoint5d/src/sprites/matrixColumn.ts:5-6` (`ModelNode.d.ts` und seine
     Zeile).
   - `packages/twopoint5d/src/texture/sampleAtlasFrame.ts:118-120`: der
     `WGSLNodeBuilder` von 0.187 bringt einen Texel-Lookup für Texturen ohne
     Sampler-Binding (»Unfilterable textures have no sampler binding …«). Prüfen, ob ein
     `grad()` auf einer NearestFilter-Textur unter WebGPU noch scheitert. Scheitert es
     nicht mehr, bleibt der Code (Gradienten zählen nur, wo ein Mip-Level gewählt wird),
     und der Kommentar trägt nur noch diesen Grund.
   - `packages/twopoint5d/src/display/Display.ts:1259` — in Schritt 2c erledigt.
   - `packages/twopoint5d-testing/test/sprites-picking.test.js:134` (WebGL 2 ohne
     `EXT_clip_control`), `vertex-objects-gpu-upload.test.js:31` (falls nach Schritt 3
     noch da). `vertex-objects-heap.test.js:14-23` beschreibt, was three ab einer Version
     tut (»from three 0.186 on«); das bleibt stehen, solange 0.187 es weiter so tut.
   - **Nicht anfassen:** `packages/twopoint5d/docs/proposals/*.md` und
     `docs/superpowers/plans/*.md` (halten die Grundlage fest, gegen die sie gebaut
     wurden), die Fixture-Strings `'~0.185.1'` in `scripts/**/*.test.mjs` (Testdaten, an
     keine echte Version gebunden), freigegebene Abschnitte im CHANGELOG.

5. **Gate laufen lassen und jede rote Stelle nachziehen.** `pnpm run ci` (genau ein Gate
   im Checkout, nie parallel zu einem Build). Was nach der Hebung rot wird und es vorher
   nicht war, ist eine Folge dieses Pakets und wird hier behoben — in Library,
   Browser-Tests oder Lookbook (`astro check` deckt die `.astro`-Dateien ab). Ist es ein
   Korrektheitsfehler der Library unter 0.187: erst der Regressionstest, rot, dann der Fix.
   Kandidaten aus den Release-Notes r187, falls etwas fällt: three-PR #34368 (WeakRef /
   `FinalizationRegistry` in den Renderern, Dispose-Listener an Texturen —
   `vertex-objects-heap.test.js`, Dispose-Specs), #34970 und #35204 (Render-Target-Texturen —
   Pass-Targets von `StageRenderer`, `Stage2D#releasePassNodeMemory()`, `StageMask`-`scale`),
   #34552 und #34450 (Uniforms — `pnpm test:allocations`), #35168 (`compileAsync()` mit der
   Render-Konfiguration — `StageDirector#precompile()`), #34690 und #35227 (interleaved
   Attribute im WebGL-Backend — Vertex Objects), Änderungen an `BloomNode`
   (`outputNodeBuilders.ts`). Jede gefundene Folge mit Datei, Zeile und dem Verhalten von
   0.187 in den Report.

6. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog`),
   unter `## [Unreleased]`:
   - `### Changed`: ein Eintrag »upgrade the `three` peer dependency to `~0.187.0` and
     `@types/three` to `~0.187.0`«, danach in einem Satz je Verhalten, das ein Nutzer
     unter 0.187 anders sieht und das Schritt 5 gefunden hat. Schritt 2 hält den Vertrag
     von `pause`; er bekommt keinen Eintrag, solange er sich nach außen nicht ändert. Kein
     »(was …)«: den alten Bereich trägt der Before-Block des Migration Guide
     (Konvention »kein Rückblick«).
   - `### Migration Guide`: ein Abschnitt `#### The \`three\` peer dependency range` nach
     dem Muster von 0.23.0 (`CHANGELOG.md:1306-1328`): **Before** `"three": "~0.186.1"`,
     **After** `"three": "~0.187.0"`, beide als `json`-Block; `@types/three` steht als
     devDependency im selben Block (`"~0.186.0"` → `"~0.187.0"`), wie das Kapitel »Usage«
     des Repo-README es empfiehlt. Folgt aus Schritt 5 etwas, das ein Nutzer anpassen muss,
     kommt es als Absatz darunter.

7. **Release-Bindung dokumentieren (schließt BUILD-002, Entscheidung vom 2026-10-31).**
   - `docs/architecture.md` §5: nach dem Absatz zu Dependabot (endet Zeile 449) ein neuer
     Absatz zur Hebung von `three`. Inhalt: Der Katalog-Bereich von `three` und
     `@types/three` landet wörtlich als Peer-Range im Manifest; er bleibt eine Tilde auf
     genau einer Minor, weil eine 0.x-Minor von three bricht und das Gate nur gegen diese
     eine läuft — eine Spanne über zwei Minors versicherte eine, gegen die nie ein Gate lief.
     Deshalb ist jede Hebung ein Release, und ein Nutzer auf der neueren Minor sieht bis zu
     dessen Veröffentlichung einen Peer-Konflikt. Die Schritte einer Hebung: beide Einträge
     zusammen im `catalog:` von `pnpm-workspace.yaml` heben; `pnpm install`;
     `src/testing/threeInternals.ts` und jede Stelle prüfen, die eine three-Version nennt
     (`git grep -nE "three 0\.[0-9]+|r1[0-9]{2}|@types/three@" -- packages`);
     `pnpm run ci`; der Eintrag unter `### Changed` und der Abschnitt »The `three` peer
     dependency range« im Migration Guide des CHANGELOG. Den Release löst eine neue
     `version` in `packages/twopoint5d/package.json` auf `main` aus: `deploy.yml`
     veröffentlicht nach dem CI-Lauf, sobald npm die Version nicht kennt und sie nicht auf
     `-dev` endet (§4). Kein Satz über frühere Hebungen.
   - `AGENTS.md`, Punkt »Shared dependency versions« (Zeile 134-140): ein Satz am Ende,
     der auf die Schritte zeigt — »The steps of a bump are in [monorepo architecture
     §5](docs/architecture.md#5-shared-dependency-versions).«
   - Die `version` in `packages/twopoint5d/package.json` bleibt `0.24.0`: der Release
     selbst ist nicht Teil dieses Laufs (Entscheidung vom 2026-10-31).

- Verify: `pnpm run ci`
- Commit: `build(deps): upgrade three to 0.187.0 and keep the animation loop of a paused display standing`
  — der Body zählt jede Folge der Hebung in eigenen Worten auf, wie der Commit der Hebung
  auf 0.186.1 (05dfbd19); keine Finding-ID; Trailer nach Zug 5.
- Verlauf:
  - 2026-10-31 Zug 0: Detailplan steht · BUILD-002 unverändert (`pnpm-workspace.yaml:10-11`,
    Ablauf einer Hebung nirgends beschrieben) · Typ-Probe gegen @types/three 0.187.0:
    Library samt Specs, Browser-Tests, Lookbook-`.ts` je 0 Fehler · Laufzeitfolgen aus dem
    Quelltext: Animation-Loop (`Display#pause`), interleaved Readback im WebGL-Backend ·
    keine offenen Folgen oder Nebenbefunde zu verteilen · Restplan unverändert
  - 2026-10-31 Zug 1: Implementierer beauftragt (Runde 0, Modell opus, Effort high, Session `remediate-twopoint5d-p1-impl-0`, Report `paket-1.impl-0.json`)
  - 2026-10-31 Zug 2: Report FERTIG_MIT_VORBEHALT · 23 Dateien geändert, keine neu (Display.ts/.spec, FrameLoop.ts, canvasHandover.ts/.spec, SpritePicker.ts, matrixColumn.ts, node-utils.spec, typed-stages.spec, preset-graphs.json, spriteGraph.ts, threeInternals.ts, sampleAtlasFrame.ts, threeVertexLayout.spec, display-lifecycle/-dispose/sprites-picking/vertex-objects-gpu-upload tests, CHANGELOG, sprites.md, resource-lifecycle.md, architecture.md, AGENTS.md, Workspace+Lock) · rot vor Fix belegt: Browser-Test pause (expected 8 to equal 2), zwei Display-Specs, zwei canvasHandover-Specs · Schritt 3: Helfer entfallen · zusätzliche Folge: WebGLBackend#dispose() gibt fremdes Canvas nicht mehr auf → Display ruft loseContext() selbst · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-1.verify.log`)
  - 2026-10-31 Zug 3: Reviewer beauftragt (opus, high, `paket-1.review-0.json`), Diff `paket-1.diff` (1693 Zeilen)
  - 2026-10-31 Zug 3 Urteil: BUILD-002 behoben, Schritte 1–7 umgesetzt, 0 kritisch, 0 wichtig, 4 klein (canvasHandover.ts:175, SpritePicker.ts:417-418, display-dispose.test.js:119-121, Commit-Body) · freigabefähig
  - 2026-10-31 Zug 4 Runde 1: offen die vom Implementierer gemeldete Folge `vertex-objects-heap.test.js:30-35` (vaoCache-Aussage unter 0.187 falsch) plus die 4 kleinen; an denselben Implementierer per Resume (opus, high, `paket-1.impl-1.json`)
  - 2026-10-31 Zug 4 Runde 1 zurück: FERTIG · geändert vertex-objects-heap.test.js (Kommentar gegen 0.187.0 geprüft, Zahlen auf Chromium 156 neu gemessen: 7,87 % WebGL2 / 7,98 % WebGPU, MAX_HEAP_GROWTH bleibt 0.15), canvasHandover.ts, SpritePicker.ts, display-dispose.test.js · Commit-Body geliefert (`paket-1.commit-body.txt`) · Verify `pnpm run ci` exit=0 (`paket-1.verify-1.log`), Diff `paket-1.diff-1`
  - 2026-10-31 Zug 4 Runde 1 Review (Resume, `paket-1.review-1.json`): alle offenen Befunde erledigt, 0 kritisch, 0 wichtig, 3 klein (2 im Commit-Body, beim Commit nachgezogen) · freigabefähig
  - 2026-10-31 Zug 5: Commit 726f020f, 26 Dateien, Trailer `Remediation-Run: 2026-10-31`, Verify-Beleg `paket-1.verify-1.log` (exit=0)

## Findings im Volltext

**BUILD-002 · info · pnpm-workspace.yaml:11** (auch `packages/twopoint5d/package.json:65`) —
Peer-Range three ~0.186.1 bindet jeden Release an eine three-Minor

Das catalog-Eintrag `three: ~0.186.1` wird zur Peer-Range des veröffentlichten Pakets
(package.json:65). Konsumenten mit three 0.187 bekommen eine Peer-Warnung/-Fehler, bis ein
neuer Release erscheint; `pnpm outdated` zeigt 0.187.0 bereits als aktuell. Bei three ohne
SemVer ist das konsequent, aber ein Release-Zwang bei jeder Minor.

Empfehlung: Bewusst festhalten (Release-Prozess dokumentieren) oder die Peer-Range auf eine
Spanne (>=0.186.1 <0.188) weiten, sobald 0.187 getestet ist.

Umsetzung nach der Entscheidung vom 2026-10-31: die erste Option — festhalten und den
Ablauf dokumentieren (Schritt 7); die Tilde bleibt.

## Anmerkungen

- Abweichung von der Empfehlung: keine. Die Spanne als zweite Option ist durch die
  Entscheidung vom 2026-10-31 ausgeschlossen; der Grund dafür steht künftig in §5.
- Schritt 2 nimmt den Weg, der den dokumentierten Vertrag von `pause` hält, statt ihn an
  0.187 anzupassen: der Vertrag steht im veröffentlichten TSDoc, `docs/display.md:808`
  nennt das eigene `renderFrame()` in der Pause als Anwendungsfall, und ein laufender
  rAF-Takt ohne Callback ist genau das, was die Pause abstellt. Die Überdeckung von
  `start` greift so tief in three wie das schon genutzte `_animation` und nicht tiefer.

## Urteil des Reviewers (Runde 0 und 1)

- **BUILD-002 — behoben.** `pnpm-workspace.yaml:10-11` (`~0.187.0` für beide), Lock zieht mit;
  Release-Bindung und Schritte einer Hebung in `docs/architecture.md:444-462` (§5), Verweis in
  `AGENTS.md:140-141`. Schritte 1–7 je umgesetzt (Fundstellen im Report `paket-1.review-0.json`).
- Die Haltemechanik in `Display.ts` gegen jeden `_animation.start()`-Aufrufer von three 0.187.0
  geprüft (`Renderer.js:1827/2393/3246`, `XRManager.js:1365/1648`); Dispose-Reihenfolge stimmt.
- Heap-Kommentar `vertex-objects-heap.test.js:11-35` Aussage für Aussage gegen 0.187.0 belegt.

## Kleine Befunde

- `packages/twopoint5d-testing/test/vertex-objects-heap.test.js` (Satz »Disposing the material
  every 20 rounds leaves about 2.5 KB per round (1.8 % over 100 rounds …)«): nennt nur die
  WebGL2-Zahl; gemessen 1,82 % WebGL2 / 1,93 % WebGPU — offen, Wortlaut.
- Commit-Body: »a display hands its renderer a canvas« übertrieb, und Doku/Browser-Test zum
  Kontextverlust fehlten — beim Commit nachgezogen.
- Aus Runde 0, in Runde 1 erledigt: `canvasHandover.ts:175`, `SpritePicker.ts:417-418`,
  `display-dispose.test.js:119-121`.

## Anmerkungen aus der Umsetzung

- `SpritePicker.ts:416`: die Stempel-Aussage hielt unter 0.187 nicht (Integer-Readback unter
  WebGL 2 geht jetzt als `RGBAIntegerFormat`). Der Code bleibt beim Float-Target — korrekt, und
  ein Wechsel änderte `MAX_SPRITES_PER_MESH`, Fehlermeldung, Specs und Guide (Feature, keine
  Folge der Hebung). Kommentar und `docs/sprites.md` sind nachgezogen.
- `grad()` auf NearestFilter-Textur scheitert unter 0.187 nicht mehr (Probe unter WebGPU:
  0.186.1 `unresolved value 'nodeUniform0_sampler'`, 0.187.0 korrekt) — Code bleibt, Kommentar
  nennt nur den Mip-Grund.
- Verify-Läufe des Runners trafen für build und test:browser den Nx-Cache des letzten
  Implementierer-Gates auf identischen Inputs.
