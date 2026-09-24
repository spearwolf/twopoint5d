# Paket 3 — Stylesheets und Renderer-Ressourcen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: MEM-017 (medium), SEC-002 (low), MEM-019 (low), ASYNC-006 (info), READ-020 (low), DOC-031 (info)
- Dazu (aus dem Plan übergeben, kein eigenes Finding): die Randbemerkung aus READ-001 zu `Display#styleSheetRoot`
- Ziel: Stylesheets überstehen nicht eingehängte ShadowRoots und Reconnects über Constructable Stylesheets, nehmen nur validierte Werte an, und Renderer-Init/-Freigabe hinterlässt weder Listener noch ein unbegrenztes Warten.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/display/Stylesheets.ts`
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/types.ts` (nur TSDoc von `DisplayParameters.styleSheetRoot`)
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d/src/controls/PanControl2D.ts`
  - `packages/twopoint5d/docs/resource-lifecycle.md` (§1)
  - `docs/architecture.md` (Absatz um Zeile 272)
  - `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]`)
  - `packages/twopoint5d-testing/test/stylesheets.test.js`
  - `packages/twopoint5d-testing/test/pan-control-cursor.test.js`
  - `packages/twopoint5d-testing/test/display-constructor.test.js`
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d-testing/test/display-stylesheets.test.js` (neu)
- Verify: `pnpm run ci`
- Commit: `fix(display,controls): keep the rules of Stylesheets in a constructed stylesheet adopted by the document or shadow root, so they reach a shadow root before its host is in the document and survive a move of the host, build that stylesheet from the window of its document so a root in an iframe works as well, escape the class name in the selector, refuse a cursorPanStyle that is not a cursor value and give a cursor rule back to the root it was retained for, let a write to Display#styleSheetRoot take the rules of the display along, tear down what the Display constructor has built when it fails after the renderer, bound the wait for the GPU queue on release, take the webglcontextlost listener of a failed WebGL init off the canvas, and leave no empty style attribute on a canvas handed back in Chromium`
- Verlauf:
  - 2026-09-24 Zug 0: Detailplan steht · MEM-017 unverändert (`Stylesheets.ts:61-73`, `Display.ts:779`) · SEC-002 unverändert (`PanControl2D.ts:253-280`, `Stylesheets.ts:45`) · MEM-019 verschoben nach `Display.ts:1343-1347` · ASYNC-006 unverändert (`Display.ts:55-64`) · READ-020 unverändert (`Display.ts:93-97`) · DOC-031 verschoben nach `Stylesheets.ts:143-151` · Randbemerkung READ-001 aufgenommen (Vorgehen 4) · Folge aus Paket 2 (`data-engine` bei `dispose()` in der Init) gegenstandslos, Absicherungstest in Vorgehen 8 · keine Nebenbefunde aus »Offene Befunde« übernommen
  - 2026-09-24 Zug 1: Implementierer beauftragt, opus (stärkste Stufe), effort high, Session `remediate-twopoint5d-p3-impl-1`, Report nach `paket-3.impl-1.json`
  - 2026-09-24 Zug 2: FERTIG_MIT_VORBEHALT · 13 Dateien (Stylesheets.ts, Display.ts, types.ts, Display.spec.ts, PanControl2D.ts, resource-lifecycle.md, architecture.md, CHANGELOG.md, stylesheets/pan-control-cursor/display-constructor/display-dispose.test.js, neu display-stylesheets.test.js) · Arbeitsbaum schmutzig · rote Läufe: Spec 3 failed/24 passed, stylesheets 6/10, pan-control-cursor 3/8, display-stylesheets 5/0, display-constructor 2/3, display-dispose 1/26 · Abweichungen: `restoreCanvasState()` liest `style` vor `removeAttribute` (Chromium-`style=""`), data-engine-Absicherung über `getContext()` statt `render()` (Firefox-GPUInternalError), Absicherung adoptedStyleSheets war vor dem Fix rot · Verify eigener Lauf `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 → `paket-3.verify.log`
  - 2026-09-24 Zug 3: Reviewer beauftragt, opus, effort high, Session `remediate-twopoint5d-p3-review-1`, Diff `paket-3.diff` (13 Dateien, +869/−174), Report nach `paket-3.review-1.json`
  - 2026-09-24 Zug 3 Urteil: alle 6 Findings und Randbemerkung READ-001 behoben · kritisch 0 · wichtig 1 (Constructable Sheet im Modul-Realm → `NotAllowedError` bei iframe-Root) · klein 6 · Report `paket-3.review-1.json`
  - 2026-09-24 Zug 4 Runde 1: offen wichtig 1 + klein 2–5 (Test Feldreihenfolge PanControl2D, TSDoc Scope-Grenze bei releaseRule, Testtitel pan-control-stylesheet-root, Umbruch Kommentarblöcke display-dispose) → Resume Implementierer (`paket-3.impl-2.json`); Commit-Message-Halbsatz übernimmt der Runner
  - 2026-09-24 Zug 4 Runde 1 zurück: FERTIG · Sheet aus dem Fenster des Scope-Dokuments (`newSheetFor`), PanControl2D merkt den Root des Retains (`#cursorPanRuleRoot`, `pinnedRootOf`), TSDoc-Grenze an retain/releaseRule, 2 iframe-Tests (vorher rot 2/16), 2 PanControl-Tests (Rückbau rot 2/11), Titel und Umbruch · CHANGELOG-Eintrag Stylesheets um zwei Sätze ergänzt · Commit-Message um den `style=""`-Halbsatz ergänzt (Runner) · Verify nach `paket-3.verify-2.log`
  - 2026-09-24 Zug 4 Runde 1 verifiziert: `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 → `paket-3.verify-2.log` · Diff `paket-3.diff-2`, Änderung gegen Runde 0 `paket-3.diff-1-to-2.txt` · Reviewer Runde 2 (opus, high, `paket-3.review-2.json`): alle 6 offenen Befunde erledigt · neu nur klein 3 (Kommentar in `newSheetFor()` verspricht einen Fallback, der wirft; CHANGELOG `:248` »no longer«; Commit-Message ohne iframe- und Retain-Root-Halbsatz — vom Runner ergänzt) · keine weitere Runde
  - 2026-09-24 Zug 5: committet e9c29c0b (14 Dateien, +1006/−192) auf Basis `paket-3.verify-2.log` exit=0 · Folgen `Display.ts:1386` (Firefox/WebGPU, Folge von Paket 2) und `Stylesheets.ts:22-24`, `getGlobalSheet()`-Name im Plan unter Paket 3 · Nebenbefund `CHANGELOG.md:248` in die Queue

## Urteil des Reviewers (Runde 1 und 2)

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| MEM-017 | behoben | `Stylesheets.ts:14` `scopeOf()`, `:25` `newSheetFor()`, `getGlobalSheet()` legt ein Constructable Stylesheet an und adoptiert es bei jedem Aufruf neu; `Display.ts` Aufräum-`try` im Konstruktor mit `dispose()` im `catch` |
| SEC-002 | behoben | `PanControl2D.ts` Setter `cursorPanStyle` (`CSS.supports('cursor', …)`, Felder erst nach `retainRule()`), Konstruktor-Fallback `'none'`; `Stylesheets.ts` Selektor mit `CSS.escape()` |
| MEM-019 | behoben | `Display.ts:110` `dropContextLostListener()`, aufgerufen im Rejection-Zweig von `#releaseRenderer()` |
| ASYNC-006 | behoben | `Display.ts:61` `SUBMITTED_WORK_TIMEOUT_MS`, `drainSubmittedWork()` mit `Promise.race` aus Queue, `device.lost` und Frist, `clearTimeout` im `finally` |
| READ-020 | behoben | Beschreibung von `lostContexts` in `Display.ts` (um `:145-153`) nennt das Fenster nach einem verspäteten Restore |
| DOC-031 | behoben | TSDoc von `addRule()` in `Stylesheets.ts` mit `@param element`, ohne »uniq-number« |
| Randbemerkung READ-001 | behoben | `Display.ts:643` Accessor-Paar `styleSheetRoot`, `:1102` `#installRules()`, TSDoc `types.ts:92-101` |

Klein offen (nach Runde 2):
- `Stylesheets.ts:22-24` — Kommentar verspricht einen Fallback für ein Dokument ohne Fenster, der immer `NotAllowedError` wirft; das Sheet bleibt im Cache (als Folge im Plan).
- `CHANGELOG.md:248` — »The sheet no longer grows …«, Rückblick aus 1813d635 (als Nebenbefund in der Queue, `→ Scope`: betrifft den CHANGELOG-Eintrag zu `src/display/Stylesheets.ts`).
- `Stylesheets.ts:2` — `globalStylesID` toter Export ohne Hinweis; Entfernen in Paket 4 (API-065).
- Behoben in Runde 1, hier nur vermerkt: Titel `pan-control-stylesheet-root.test.js:43`, Umbruch der Kommentarblöcke in `display-dispose.test.js`, Test zur Feldreihenfolge in PanControl2D, TSDoc-Grenze an `retainRule()`/`releaseRule()`.

## Abgleich gegen a33a6961

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| MEM-017 | unverändert | `Stylesheets.getGlobalSheet()` `Stylesheets.ts:61-73` hängt ein `<style>` an den Root und liest `styleEl.sheet` über `expectDefined` (`:70`) — ein nicht eingehängter ShadowRoot liefert `null`, `expectDefined` wirft; der Cache `sheets` (`:8`) hält nach einem Umhängen das alte, abgehängte Sheet. Im Display läuft `Stylesheets.addRule(canvas, …)` (`Display.ts:779-784`) nach `renderer.init()` (`:771-774`) und außerhalb des `try` um `makeRenderer` (`:735-750`). PanControl2D: `:265`. |
| SEC-002 | unverändert | Setter `cursorPanStyle` `PanControl2D.ts:253-280`: `#cursorPanStyle` und `#cursorPanRuleName` werden `:261-264` überschrieben, bevor `Stylesheets.retainRule()` `:265` den Wert ungeprüft als `cursor: ${cursor}` interpoliert. Zweite Fundstelle `Stylesheets.ts:45`: `insertRule(\`.${classNameOf(name)} {${css}}\`)` interpoliert auch den Klassennamen ungeschützt in den Selektor. |
| MEM-019 | verschoben | Rejection-Zweig von `#releaseRenderer()` jetzt `Display.ts:1343-1347`, Kommentar wörtlich unverändert. three 0.185.1: `WebGLBackend.init()` legt den Listener an (`node_modules/three/src/renderers/webgl-fallback/WebGLBackend.js:245-247`, Build `three.webgpu.js:71327`), bevor `new WebGLState(this)` (`:257`, Build `:71339`) scheitern kann; `WebGLBackend.dispose()` nimmt ihn ab (`:2836`), aber `Renderer.dispose()` ruft `backend.dispose()` nur bei `_initialized === true`, und das Display ruft für ein gescheitertes Init ohnehin kein `renderer.dispose()`. |
| ASYNC-006 | unverändert | `drainSubmittedWork()` `Display.ts:55-64`, Aufruf `:1334`; `canvasReleases` `:91`, Eintrag `:1354-1361`, gewartet in `takeOverCanvas()` `:183-184`. |
| READ-020 | unverändert | Beschreibung von `lostContexts` `Display.ts:93-97`; herausgenommen wird der Eintrag nur in `takeOverCanvas()` `:192-194`. |
| DOC-031 | verschoben | TSDoc von `addRule()` `Stylesheets.ts:143-150`, Methode `:151`; `@param element` fehlt, »uniq-number« `:145`. |

**Randbemerkung aus READ-001** (vom Plan an Paket 3 übergeben): `Display#styleSheetRoot`
ist ein schreibbares Feld (`Display.ts:575`). Der Konstruktor installiert Container- und
Canvas-Regel darin (`:707-714`, `:779-784`), die Fullscreen-Regel landet beim ersten
Fullscreen-`resize()` in dem Root, der dann im Feld steht (`:1008-1012`). Eine spätere
Zuweisung erreicht keine bereits installierte Regel. Entschieden: das Feld wird ein
Accessor-Paar, dessen Setter die Regeln des Displays im neuen Root installiert
(Vorgehen 4). Warum nicht nur TSDoc: ein schreibbares Feld, dessen Schreiben nichts
bewirkt, ist eine Falle; warum nicht `readonly`: das wäre eine Typ-Änderung der
öffentlichen API, die keine Zeile in »Entscheidungen« deckt (API-065 nennt `renderer`,
`frameLoop`, `frameNo`). Ein Setter ist nicht brechend.

**Folge aus Paket 2** (`data-engine` bei `dispose()` während der WebGPU-Init) —
gegenstandslos. three schreibt `data-engine` an genau zwei Stellen: im
Renderer-Konstruktor über `Backend.getDomElement()` (`Backend.js:707`, Build
`three.webgpu.js:66794`, aufgerufen nur aus dem Konstruktor `Renderer.js:291`), und beim
ersten Zugriff auf den Getter `WebGPUBackend#context` (`WebGPUBackend.js:325-365`, Schreibzeile
`:347`, Build `:84059`). Den Getter lesen nur `beginRender()` (`:478`, `:482`),
`copyFramebufferToTexture()` (`:2762`) und `getContext()` (`:419`) — nichts davon läuft in
`WebGPUBackend.init()` (`:197-297`; `updateSize()` `:2606` löscht nur die Canvas-Daten), in
der WebGL-Fallback-Init oder in `renderer.dispose()`. Die Behauptung aus Paket 2 beruht auf
einer Schreibstelle, die nicht in der Init liegt. Ein Absicherungstest (Vorgehen 8) hält das
im Browser fest.

**Offene Befunde:** keiner teilt die Ursache dieses Pakets. `display-dispose.test.js:28`
und ab `:248` (doppelte Backend-Unterscheidung, Paket 1b) liegt in einer Datei, die dieses
Paket ändert — die neuen Tests dort benutzen die vorhandenen Helfer `whenReleased()` und
`expectLiveBackend()` und legen **keine dritte** Kopie der Typannotation an; den Befund selbst
behebt dieses Paket nicht.

## Vorgehen

Reihenfolge: erst alle Regressionstests aus Schritt 1 schreiben und den roten Lauf sichern,
dann Schritte 2–7, dann Schritt 8 (Absicherung) und Verify. Code, Kommentare und Doku auf
Englisch. Die Konventionen aus `./remediation-plan.md` gelten für jede Zeile: keine
Finding-IDs, kein Rückblick auf den Vorzustand (kein »no longer«, kein »now«, kein »instead
of the old …« — auch nicht im CHANGELOG; Paket 2 hat dafür eine Review-Runde gebraucht).

### 1. Regressionstests zuerst — rot sehen

Rot vor dem Fix ist Pflicht für alles, was nicht als »Absicherung« markiert ist. Den roten
Lauf (Kommando und Zusammenfassung failed/passed je Datei) in den Report.

Schnell iterieren mit `pnpm nx test twopoint5d -- src/display/Display.spec.ts` und
`pnpm test:browser` (bzw. dem Einzelaufruf der Browser-Suite, den `packages/twopoint5d-testing`
anbietet). Browser-Tests laufen gegen die gebaute Bibliothek: vor jedem Browser-Lauf
`pnpm build:twopoint5d`.

**`packages/twopoint5d-testing/test/stylesheets.test.js`** — neue Fälle im bestehenden
`describe('Stylesheets')`, mit den vorhandenen Helfern `uniqueName`, `ruleCount`, `findRule`,
`makeShadowRoot`:

- `installs a rule in a shadow root whose host is not in the document yet` — Host per
  `document.createElement('div')`, **nicht** eingehängt, `attachShadow({mode: 'open'})`;
  `Stylesheets.installRule(name, 'cursor: pointer;', shadowRoot)` darf nicht werfen; ein
  `<div>` mit der Klasse in den ShadowRoot, Host in `document.body` (in `hosts` eintragen,
  damit `afterEach` ihn entfernt); `getComputedStyle(div).cursor === 'pointer'`.
- `keeps its rules when the shadow host moves to another place in the document` — Host
  eingehängt, Regel im ShadowRoot, `<div>` mit der Klasse darin; zweites Element `other` in
  `document.body`, `other.appendChild(host)`; danach `getComputedStyle(div).cursor ===
  'pointer'`. Aufräumen: `other` mit entfernen. Nach der HTML-Spec rot vor dem Fix (ein
  umgehängtes `<style>` baut sein Sheet aus dem leeren `textContent` neu). Ist er in einem
  Browser vor dem Fix grün, in den Report schreiben — kein Blocker, der Test bleibt.
- `puts a rule installed after the shadow host moved where its elements see it` — wie
  eben, aber die Regel wird erst **nach** dem Umhängen installiert (vorher eine andere Regel
  im selben Root, damit das Sheet schon existiert); `getComputedStyle(div).cursor ===
  'pointer'`.
- `an element stands for the document or shadow root it sits in` —
  `Stylesheets.getGlobalSheet(elementInShadowRoot) === Stylesheets.getGlobalSheet(shadowRoot)`,
  `Stylesheets.getGlobalSheet(document.body) === Stylesheets.getGlobalSheet()`,
  `shadowRoot.adoptedStyleSheets` enthält das Sheet, `document.adoptedStyleSheets` enthält
  das Sheet von `getGlobalSheet()`.
- `escapes the class name in the selector of its rule` — Root ist ein ShadowRoot mit einem
  `<div>` darin; `Stylesheets.installRule(\`${uniqueName('x')}, div, y\`, 'cursor: wait;', root)`;
  `getComputedStyle(div).cursor` ist **nicht** `'wait'`. Vor dem Fix trifft die Selektorliste
  jedes `div` im Root.
- Absicherung (vor dem Fix grün): `adopts its sheet again into a root whose
  adoptedStyleSheets were replaced` — Regel A installieren, `shadowRoot.adoptedStyleSheets =
  []`, Regel B installieren; das Sheet steht wieder in `shadowRoot.adoptedStyleSheets`, und
  ein Element mit Klasse A trägt deren Stil.
- Bestehender Fall `a release without a retain changes nothing`: die Zeile
  `expect(untouchedRoot.querySelector('style'), …).to.equal(null)` wird zu
  `expect(untouchedRoot.adoptedStyleSheets, 'the sheets of a root nothing was written to').to.have.length(0)`.

**`packages/twopoint5d-testing/test/pan-control-cursor.test.js`** — neue Fälle im
`describe`-Block, der `makeRoot()`, `makeControl(root, cursorPanStyle)` und
`cursorRules(root)` hat. `console.warn` jeweils mit einer Stub-Funktion ersetzen, die die
Aufrufe sammelt, und im `finally` zurücksetzen:

- `refuses a cursor value that carries a further declaration, keeps its own and warns` —
  Control mit `'grab'`, dann `control.cursorPanStyle = 'pointer; display: none'`: Getter
  bleibt `'grab'`, `cursorRules(root).length === 1`, keine Regel in
  `Stylesheets.getGlobalSheet(root).cssRules` mit `style.display === 'none'`, genau ein
  `console.warn`.
- `a value the stylesheet cannot take leaves the control on the rule it holds` — Control
  mit `'grab'`, `control.cursorPanStyle = 'pointer } div { display: none'` wirft nicht,
  Getter bleibt `'grab'`; nach `control.dispose()` ist `cursorRules(root).length === 0`.
- `falls back to none for a cursorPanStyle option that is not a cursor value` —
  `makeControl(root, 'pointer; display: none')`: `control.cursorPanStyle === 'none'`, eine
  Regel mit `style.cursor === 'none'`.
- Absicherung (vor dem Fix grün): `takes a cursor with a data URL and a fallback keyword` —
  `'url("data:image/png;base64,iVBORw0KGgo="), auto'` wird angenommen (Getter gibt ihn
  zurück, kein `console.warn`). Hält die Prüfung davon ab, an `;` zu scheitern.

**`packages/twopoint5d-testing/test/display-stylesheets.test.js`** (neu) —
`describe('Display — where the rules of a display live', function () { this.timeout(20000); … })`,
Fixtures aus `./helpers/fixtures.js` (`makeContainer`, `disposeDisplay`), Teardown wie in
den anderen Display-Dateien (nur `disposeDisplay`, Hosts entfernen). Der Canvas-Stil wird
über `getComputedStyle(canvas).touchAction` gelesen — das Attribut `touch-action="none"` ist
kein CSS und zählt nicht:

- `builds on a canvas in a shadow root whose host is not in the document yet` — Host
  per `createElement`, nicht eingehängt, ShadowRoot, Canvas darin; `new Display(canvas,
  {styleSheetRoot: shadowRoot})` wirft nicht; Host einhängen, `await display.start()`,
  `await display.nextFrame()`; `touchAction === 'none'`.
- `keeps the rule of its canvas when the shadow host moves` — Host eingehängt, Display im
  ShadowRoot, gestartet, ein Frame; Host in ein anderes Element umhängen, ein Frame;
  `touchAction === 'none'`. Zur Spec-Frage gilt dasselbe wie oben.
- `installs its rules in a styleSheetRoot written after construction` — Canvas in einem
  Container im Dokument, `new Display(canvas)`; zweiter Host mit ShadowRoot, Canvas dorthin
  umhängen, `display.styleSheetRoot = shadowRoot`; `touchAction === 'none'` und
  `display.styleSheetRoot === shadowRoot`.
- `takes the fullscreen rule along to a styleSheetRoot written after the first fullscreen frame` —
  Canvas mit `resize-to="window"`, starten, ein Frame (Fullscreen-Regel jetzt im Dokument);
  Canvas in einen ShadowRoot umhängen, `display.styleSheetRoot = shadowRoot`, ein Frame;
  `getComputedStyle(canvas).position === 'fixed'`.
- `a write to styleSheetRoot after dispose() changes nothing` — `display.dispose()`, dann
  `display.styleSheetRoot = shadowRoot`; Getter antwortet weiter mit dem alten Root,
  `shadowRoot.adoptedStyleSheets.length === 0`.

**`packages/twopoint5d-testing/test/display-constructor.test.js`** — neben
`takes the container it built back out of the host when the renderer cannot be built`:

- `takes the container it built out of the host and releases the renderer when the constructor fails after building it` —
  `new Display(host, {resizeTo: () => { throw failure; }, createRenderer})` mit einem
  `createRenderer`, der einen echten `WebGPURenderer({...params})` baut, ihn in einer
  Variable festhält und seinen `dispose()` so umwickelt, dass ein Promise auflöst (Muster wie
  `whenReleased()` in `display-dispose.test.js`); der Konstruktor wirft genau `failure`;
  `host.children.length === 0`; das Release-Promise löst auf (eine Freigabe, die nie kommt,
  läuft in das Timeout der Suite).
- `gives a canvas that was handed in back as it found it when the constructor fails after building the renderer` —
  nackter Canvas in einem Container, derselbe werfende `resizeTo`; danach
  `canvas.getAttribute('class') === null`, `canvas.hasAttribute('touch-action') === false`,
  `canvas.hasAttribute('data-engine') === false`, `canvas.getAttribute('style') === null`.

**`packages/twopoint5d-testing/test/display-dispose.test.js`**:

- `takes the webglcontextlost listener of a failed WebGL init off the canvas` — `new
  Display(host, {createRenderer})`, wobei `createRenderer` einen `new WebGPURenderer({...params,
  forceWebGL: true})` baut und dessen `renderer.backend.init` so umwickelt, dass zuerst das
  echte `init` läuft (es hängt three's Listener an) und danach ein Fehler geworfen wird —
  das stellt den Fall nach, dass `new WebGLState` hinter dem Listener scheitert, mit three's
  echtem Listener und Feld. `const canvas = display.canvas`; auf `display.onError` warten;
  `display.dispose()`; einen Macrotask warten (`setTimeout(…, 0)`); dann
  `const event = new Event('webglcontextlost', {cancelable: true}); canvas.dispatchEvent(event)`;
  `event.defaultPrevented === false` (three's Handler ruft `preventDefault()`). Vor dem Fix
  rot. Den `console.error`, den three's `onDeviceLost` im roten Lauf schreibt, nicht
  unterdrücken.
- Die Kommentarblöcke »Assertion (a)« und »Assertion (b)« am Kopf des `describe` zählen die
  Fälle auf; die neuen Fälle (dieser und die zwei aus Schritt 8) dort einordnen, Zählwörter
  (»the three cases after …«, »The six cases after those …«) anpassen.

**`packages/twopoint5d/src/display/Display.spec.ts`** — `makeDisplay()` bekommt einen
optionalen dritten Parameter `backend?: object`, der als `renderer.backend` gesetzt wird.
Neuer Block `describe('release', …)`:

- `releases the renderer after a bounded wait when the queue never answers, with one warning` —
  `backend = {device: {queue: {onSubmittedWorkDone: () => new Promise(() => {})}, lost: new Promise(() => {})}}`;
  `vi.useFakeTimers()` (im `finally` `vi.useRealTimers()`), `console.warn` per `vi.spyOn`
  stummschalten; `display.dispose()`; `await vi.advanceTimersByTimeAsync(1999)` →
  `renderer.dispose` nicht aufgerufen; `await vi.advanceTimersByTimeAsync(1)` → einmal
  aufgerufen, `console.warn` einmal. Vor dem Fix rot.
- `releases the renderer once the device reports itself lost, without waiting for the queue` —
  `lost: Promise.resolve({reason: 'unknown'})`, Queue antwortet nie; `display.dispose()`,
  `await settle()` → `renderer.dispose` einmal aufgerufen, kein `console.warn`. Vor dem Fix rot.
- Absicherung: `leaves no timer behind once the queue has run dry` — Queue antwortet sofort
  (`() => Promise.resolve()`), `lost` hängt; mit Fake-Timern nach `dispose()` und
  `await vi.advanceTimersByTimeAsync(0)`: `renderer.dispose` aufgerufen und
  `vi.getTimerCount() === 0`.

Neuer Block `describe('constructor', …)`:

- `releases a renderer it has taken over when the constructor fails after taking it` —
  den Renderer-Stub wie in `makeDisplay()` bauen (ohne `makeDisplay`, weil der Konstruktor
  wirft), `new Display(renderer, {resizeTo: () => { throw failure; }})` wirft `failure`;
  `await settle()` → `renderer.dispose` einmal aufgerufen. Vor dem Fix rot.

### 2. `Stylesheets.ts` — Constructable Stylesheets

- Import von `expectDefined` entfernen (danach unbenutzt).
- Neue modulinterne Funktion, die zu einem Root den Ort der Regeln liefert:

  ```ts
  function scopeOf(root: HTMLElement | ShadowRoot): Document | ShadowRoot
  ```

  `const node = root.getRootNode()` — ein ShadowRoot antwortet mit sich selbst, ein Element
  mit dem Dokument oder dem ShadowRoot, in dem es steht (auch in einem ShadowRoot, dessen Host
  noch nicht eingehängt ist). Hat `node` die Eigenschaft `adoptedStyleSheets` (Prüfung per
  `'adoptedStyleSheets' in node`, nicht per `instanceof` — realm-unabhängig), ist es der
  Scope; sonst (ein Element, das noch nirgends eingehängt ist) `root.ownerDocument`.
  Kommentar: warum ein Element für seinen Root-Knoten steht, und warum ein freies Element auf
  das Dokument fällt (der Default des Moduls ist das Dokument; wer in einen ShadowRoot will,
  nennt ihn).
- `sheets` wird `WeakMap<Document | ShadowRoot, CSSStyleSheet>`, Schlüssel ist der Scope.
- `getGlobalSheet(root = document.head)`: Scope bestimmen; fehlt ein Sheet, `new
  CSSStyleSheet()` anlegen und merken; steht das Sheet nicht in `scope.adoptedStyleSheets`
  (`includes`), per `scope.adoptedStyleSheets = [...scope.adoptedStyleSheets, sheet]`
  anhängen. Diese Prüfung läuft bei **jedem** Aufruf — sie adoptiert das Sheet neu, wenn
  jemand `adoptedStyleSheets` des Roots ersetzt hat. Kein `<style>`-Element mehr.
- `releaseRule()`: `sheets.get(scopeOf(root))` statt `sheets.get(root)`; der Kommentar
  »not getGlobalSheet(): a release is no reason to create a sheet« bleibt sinngemäß (und
  auch kein Grund, es neu zu adoptieren).
- `putRule()` Zeile 45: der Selektor wird `` `.${CSS.escape(classNameOf(name))}` ``. Für
  alle Namen, die das Paket selbst vergibt (`twopoint5d-…`, `PanControl2D-…` mit
  `_<hex>_`-Kodierung), ist das Ergebnis zeichengleich; `findRule()` in den Tests vergleicht
  `selectorText` weiter mit `.${className}`.
- `globalStylesID` wird im Modul nicht mehr benutzt. **Stehen lassen** — es ist ein
  öffentlicher Export, und ihn zu entfernen ist Sache von Paket 4 (Entscheidung zu
  API-065). `postFixID` bleibt in Benutzung (`classNameOf`).
- TSDoc neu schreiben, wo sie vom `<style>`-Element oder einem »global stylesheet« spricht:
  - Klasse: die Regeln stehen in einem Constructable Stylesheet je Dokument oder ShadowRoot,
    das das Modul in dessen `adoptedStyleSheets` einträgt. Ein ShadowRoot trägt seine
    Regeln, bevor sein Host im Dokument steht, und behält sie, wenn der Host umgehängt wird.
    Adoptierte Sheets folgen in der Kaskade den eigenen Sheets des Dokuments: eine Regel der
    Seite mit gleicher Spezifität wie diese Klassenregeln setzt sich nicht dadurch durch,
    dass sie später kommt. Wer `adoptedStyleSheets` eines Roots ersetzt, nimmt das Sheet
    heraus; der nächste Aufruf für diesen Root trägt es wieder ein.
  - `getGlobalSheet()`: was es zurückgibt (das adoptierte Sheet des Scopes), wann es entsteht,
    dass es bei jedem Aufruf wieder eingetragen wird, falls es fehlt.
  - `@param root` an allen vier Methoden gleichlautend: »`document.head` by default, which
    stands for the document. A shadow root carries a sheet of its own; an element stands
    for the document or shadow root it sits in, and one that sits in neither for its
    document.«
  - `installRule`/`retainRule`: `@param name` ist die Basis des Klassennamens; `@param css`
    ist eine Deklarationsliste (»the declarations of the rule, as in a style attribute«).
  - `addRule()` (DOC-031): erster Satz »Install a rule like {@link Stylesheets.installRule}
    does and add its class to `element`.«; `@param element The element that gets the class`;
    »The class name carries the postfix of this module, a random hexadecimal number that is
    the same for every name« statt »uniq-number«; `@param name`, `@param css`, `@param root`
    wie oben, `@returns The postfixed class name`.

### 3. `PanControl2D.ts` — nur Cursor-Werte

- Setter `cursorPanStyle` (`:253-280`), Ablauf:
  1. `if (this.isDisposed) return;` wie bisher; `if (this.#cursorPanStyle === value) return;`
  2. `const cursor = value || 'auto';`
  3. `if (!CSS.supports('cursor', cursor))` → `console.warn(\`[PanControl2D] cursorPanStyle "${value}" is not a value of the CSS property cursor in this browser; the write is refused\`)`
     (mit `// eslint-disable-next-line no-console` wie im Display) und `return`. Kein
     `typeof CSS`-Guard: der Konstruktor braucht ohnehin `document`.
  4. `const ruleName = cursorRuleName(cursor);`
     `const cursorPanClass = Stylesheets.retainRule(ruleName, \`cursor: ${cursor}\`, this.#styleSheetRoot);`
  5. **erst jetzt** `prevClass`/`prevRuleName` lesen und `#cursorPanStyle`,
     `#cursorPanRuleName`, `#cursorPanClass` zuweisen — ein `retainRule()`, das wirft, lässt
     das Control auf der Regel, die es hält. Kommentar mit genau diesem Grund.
  6. Klassentausch am Target und `releaseRule(prevRuleName, …)` unverändert.
- Konstruktor (`:224`): `this.cursorPanStyle = readOption(options, 'cursorPanStyle', 'none');`
  danach `if (this.#cursorPanClass == null) this.cursorPanStyle = 'none';` mit Kommentar: eine
  Option, die der Setter ablehnt, lässt den Default stehen.
- Warum `CSS.supports` und kein Zeichenfilter: ein Filter auf `;{}` lehnte `url("data:…;base64,…")`
  ab, einen gültigen Cursor. `CSS.supports` nimmt genau das an, was der Browser als Wert von
  `cursor` versteht; Wert-Injektion (`pointer; display:none`) und Regelbruch (`}`) sind damit
  ausgeschlossen. Warum Warnung statt Wurf: dasselbe Muster wie der ungültige `resize-to`-Selektor
  im Display und der abgelehnte Schreibzugriff auf ein disposed Control im selben Setter; ein
  Wert, den nur ein anderer Browser kennt, soll die App nicht abbrechen.
- TSDoc: `PanControl2DOptions.cursorPanStyle` und Setter-TSDoc bekommen je einen Satz: ein
  Wert, den der Browser nicht als Wert von `cursor` versteht, wird mit einer Warnung auf der
  Konsole abgelehnt, der Getter behält seinen Wert; als Konstruktor-Option greift dann
  `'none'`.

### 4. `Display.ts` — wo die Regeln eines Displays liegen

- Modulkonstanten neben den anderen oben in der Datei:
  `CONTAINER_RULE_CSS = 'display:block;width:100%;height:100%;margin:0;padding:0;border:0;line-height:0;font-size:0;'`
  (der Kommentar über den zusätzlichen Container-Div `:710-711` wandert mit),
  `CANVAS_RULE_CSS = 'touch-action: none;'`, `FULLSCREEN_RULE_CSS = 'position:fixed;top:0;left:0;'`.
  Konstruktor und `#applyFullscreenClass()` benutzen sie.
- `styleSheetRoot: HTMLElement | ShadowRoot;` (`:575`) wird privat `#styleSheetRoot` plus
  Accessor-Paar:
  - `get styleSheetRoot(): HTMLElement | ShadowRoot` → `#styleSheetRoot`.
  - `set styleSheetRoot(root: HTMLElement | ShadowRoot)`: nach `dispose()` nichts; derselbe
    Root nichts; sonst `#styleSheetRoot = root` und `this.#installRules(root)`.
  - `#installRules(root)`: `Stylesheets.installRule(Display.CssRulesPrefixContainer, CONTAINER_RULE_CSS, root)`
    nur wenn `#ownContainer != null`; immer `Stylesheets.installRule(Display.CssRulesPrefixDisplay, CANVAS_RULE_CSS, root)`;
    `Stylesheets.installRule(Display.CssRulesPrefixFullscreen, FULLSCREEN_RULE_CSS, root)` nur
    wenn `#fullscreenClassName != null`. Kommentar: die Klassennamen hängen nicht vom Root
    ab, die Elemente behalten ihre Klassen; die Regeln im alten Root bleiben (andere Displays
    teilen sie, `installRule` pinnt).
  - Der Konstruktor setzt `#styleSheetRoot` direkt (`:683`), nicht über den Setter.
    `#applyFullscreenClass()` liest `#styleSheetRoot`.
  - TSDoc am Accessor: der Root, in dem das Display seine CSS-Regeln installiert, siehe
    `DisplayParameters.styleSheetRoot`; ein Schreiben installiert sie im neuen Root, unter
    denselben Klassennamen — ein Canvas, der in einen anderen ShadowRoot umzieht, behält so
    seine Regeln; die Regeln im vorigen Root bleiben stehen; nach `dispose()` ändert ein
    Schreiben nichts.
- `types.ts`, TSDoc von `DisplayParameters.styleSheetRoot` (`:92-102`): die Regeln liegen in
  einem adoptierten Stylesheet des Dokuments oder des ShadowRoots; ein ShadowRoot darf
  übergeben werden, bevor sein Host im Dokument steht; ein Element steht für den Root, in dem
  es sitzt; später änderbar über `Display#styleSheetRoot`. Den Großbuchstaben-»WHERE«-Stil
  dabei nicht übernehmen.

### 5. `Display.ts` — der Konstruktor räumt auf, wenn er nach dem Renderer scheitert

- Reihenfolge nach dem `if/else` um die Renderer-Beschaffung (`:694-762`) bleibt:
  `#callersCanvasBefore` (`:754-756`), `#waitForRenderer` (`:769-774`), `this.frameLoop =
  new FrameLoop(…)` (`:776`). **Danach** beginnt ein `try`, das alles bis zum Ende des
  Konstruktors umfasst — `Stylesheets.addRule(canvas, …)`, `setAttribute('touch-action', …)`,
  `resizeToElement`/`resizeToAttributeEl`, `this.resize()`, `on(this.#stateMachine, …)`, den
  `visibilitychange`-Listener, den `IntersectionObserver` und `this.#waitForRenderer.catch(…)`.
- `catch (error) { this.dispose(); throw error; }` — `dispose()` braucht `#waitForRenderer`
  und `frameLoop`, deshalb stehen beide vor dem `try`; Kommentar mit genau diesem Grund.
  `dispose()` gibt einen übergebenen Canvas zurück (samt der Klasse aus `addRule`, weil
  `#canvasClassName` erst nach einem erfolgreichen `addRule` gesetzt ist, und samt
  `data-engine`), gibt den Renderer nach seiner Init frei (auch einen übernommenen — der
  Konstruktor-TSDoc sagt »adopted, not borrowed«), nimmt den eigenen Container heraus und
  entfernt über die `once(this, OnDisplayDispose, …)`-Handler Listener und Observer, soweit
  sie schon standen. Eine abgelehnte Init landet im Rejection-Zweig von `#releaseRenderer()`
  und entkommt nicht.
- Das bestehende `try` um `makeRenderer` (`:735-750`) bleibt, wie es ist: vor dem Renderer gibt
  es nichts freizugeben außer dem Container.
- Konstruktor-TSDoc (`:646-662`): ein Absatz dazu — wirft der Konstruktor, nachdem er den
  Renderer gebaut oder übernommen hat (etwa aus einem `resizeTo`-Callback), gibt er alles
  zurück, wie `dispose()` es täte: Renderer freigegeben, übergebener Canvas wie vorgefunden,
  eigener Container aus dem Host.
- `packages/twopoint5d/docs/resource-lifecycle.md` §1: am Ende des Absatzes über den
  übergebenen Canvas (endet `:31` mit »…gets the lost context.«) ein Satz: A `Display`
  constructor that throws after it has built or taken over its renderer leaves nothing
  behind — it releases the renderer, gives a canvas handed in back and takes its own
  container out, as `dispose()` would.

### 6. `Display.ts` — die Freigabe wartet begrenzt und nimmt den Listener ab

- Neben `CONTEXT_RESTORE_TIMEOUT_MS` eine Konstante `SUBMITTED_WORK_TIMEOUT_MS = 2000` mit
  Kommentar: eine GPU, die ihre eingereichte Arbeit nach so langer Zeit nicht fertig meldet,
  tut es nicht mehr; die Freigabe geht weiter, statt jedes spätere Display auf dem Canvas
  festzuhalten. 2000 wie `CONTEXT_RESTORE_TIMEOUT_MS`: großzügig gegen den Firefox-Grund des
  Wartens (`:51-54`), kurz gegen einen Remount.
- `drainSubmittedWork()` (`:55-64`): Typ des Device um `lost?: Promise<unknown>` erweitern.
  Gewartet wird auf das erste von drei Ereignissen: `onSubmittedWorkDone()` erfüllt oder
  abgelehnt (abgelehnt wie bisher: nichts mehr zu warten), `device.lost` erfüllt (fehlt es,
  zählt es nicht), oder `SUBMITTED_WORK_TIMEOUT_MS` abgelaufen. Nur im dritten Fall
  `console.warn(\`Display#dispose(): the GPU did not report the work submitted to it done within ${SUBMITTED_WORK_TIMEOUT_MS} ms; the renderer is released anyway\`)`
  (mit `// eslint-disable-next-line no-console`). Der Timer wird in jedem Fall per
  `clearTimeout` abgeräumt (`finally`). Kopfkommentar der Funktion um die Grenze ergänzen.
- Neue modulinterne Funktion `dropContextLostListener(renderer: WebGPURenderer): void` über
  `#releaseRenderer` bzw. bei den anderen Modulfunktionen: liest
  `renderer.backend as {isWebGLBackend?: boolean; _onContextLost?: EventListener} | undefined`;
  ist es ein WebGL-Backend mit gesetztem `_onContextLost`, dann
  `renderer.domElement.removeEventListener('webglcontextlost', backend._onContextLost)`.
  Kommentar: `WebGLBackend.init()` hängt den Listener an, bevor der Teil laufen kann, der
  scheitert; `renderer.dispose()` nähme ihn ab, gibt aber nur einen initialisierten Renderer
  frei; three macht ihn nur über dieses per Konvention private Feld erreichbar.
- Rejection-Zweig in `#releaseRenderer()` (`:1343-1347`): ruft `dropContextLostListener(renderer)`.
  Kommentar neu, ohne Rückblick: ein gescheitertes Init hat nichts gebaut, was
  `renderer.dispose()` freigäbe, außer dem Listener, den three vor dem Scheitern an den
  Canvas gehängt hat — der geht hier ab; `renderer.dispose()` selbst wird nicht gerufen, weil
  sein `setAnimationLoop(null)` erneut auf die abgelehnte Init wartete (der bestehende
  Halbsatz dazu bleibt sinngemäß).
- READ-020 — nur die Beschreibung von `lostContexts` (`:93-97`), keine Logik: die Map hält den
  Kontext, solange er verloren ist, und in einem Fall darüber hinaus — bringt der Browser ihn
  erst zurück, nachdem das Warten abgelaufen ist, bleibt der Eintrag mit lebendem Kontext
  stehen, bis das nächste Display auf dem Canvas ihn lebend vorfindet und herausnimmt
  (`restoreContext()` antwortet dann sofort). Warum Kommentar statt Listener auf
  `webglcontextrestored`: der Eintrag ist in diesem Fenster harmlos, und ein dauerhafter
  Listener auf dem Canvas des Aufrufers wäre genau die Sorte Rückstand, die dieses Paket an
  anderer Stelle abbaut.
- TSDoc, die jetzt lügt, mitziehen — die Freigabe wartet auf die GPU »or for two seconds at
  most, and goes on with a warning on the console after that«:
  - Klassen-TSDoc »Lifecycle«, Punkt 3 (`:296-297`),
  - Konstruktor-TSDoc (`:656-657`),
  - `dispose()`-TSDoc (`:1258-1259`); dort außerdem der Satz »An init that fails has built
    nothing to release, and its rejection does not escape.« (`:1277-1278`) →
    sinngemäß: an init that fails leaves nothing to release but the `webglcontextlost`
    listener three has put on the canvas, which the release takes off, and its rejection
    does not escape.
  - `docs/architecture.md:272-275` (»releases the renderer only once the GPU has run the work
    submitted to it«): um die Grenze von zwei Sekunden ergänzen.

### 7. CHANGELOG (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`)

Skill `updating-changelog` laden und befolgen. Einträge in Gegenwartsform, ohne Rückblick:

- `### Changed`: `Stylesheets` keeps its rules in a constructed stylesheet per document or
  shadow root and adopts it through `adoptedStyleSheets`; it puts no `<style>` element into the
  DOM. A shadow root carries its rules before its host is in the document and keeps them when
  the host moves. An element passed as root stands for the document or shadow root it sits
  in. Adopted sheets come after the document's own sheets in the cascade. The selector of a
  rule carries the class name through `CSS.escape()`.
- `### Changed`: a write to `Display#styleSheetRoot` installs the rules of the display in the
  new root, under the same class names; a write after `dispose()` does nothing.
- `### Fixed`: `PanControl2D#cursorPanStyle` and the `cursorPanStyle` option take only a value
  the browser accepts for the CSS property `cursor` (`CSS.supports()`); any other value is
  refused with a console warning, the control keeps its cursor style, and the option falls
  back to `'none'`.
- `### Fixed`: a `Display` constructor that throws after it has built or taken over its
  renderer releases the renderer, gives a canvas handed in back as it found it and takes its
  own container out of the host.
- `### Fixed`: the release of a renderer whose WebGL init failed takes the `webglcontextlost`
  listener of three off the canvas.
- Den bestehenden `[Unreleased]`-Eintrag »fix `Display#dispose()` for a renderer that is still
  initializing or still has work on the GPU« (`CHANGELOG.md:248`) um die Grenze ergänzen —
  kein neuer Eintrag, der ihm widerspricht: the renderer is released once its init is through
  and the GPU has run the work submitted to it, or once the device reports itself lost, or
  after two seconds with a warning on the console.
- Die bestehenden `[Unreleased]`-Einträge zu `Stylesheets` (`:34` retainRule/releaseRule, `:246`
  installRule) auf »global stylesheet«/`<style>`-Wortlaut prüfen und an »the stylesheet of the
  root« angleichen, wo nötig.
- Kein Migration-Guide-Eintrag: keine Signatur ändert sich (`styleSheetRoot` bleibt lesbar
  und schreibbar); der Skill prüft das.

### 8. Absicherung: kein spätes `data-engine` nach der Freigabe

In `display-dispose.test.js`, mit `whenReleased()`; beide vor und nach dem Paket grün, kein
Regressionstest:

- `leaves no data-engine on a canvas that was handed in once the release is through` —
  nackter Canvas in einem Container, `new Display(canvas)`, `await display.start()`, ein
  Frame, dann `display.renderer.render(new Scene(), new PerspectiveCamera())` (unter WebGPU
  liest das den Kontext, der Getter schreibt `data-engine`); `const released =
  whenReleased(display.renderer)`, `display.dispose()`, `await released`;
  `canvas.hasAttribute('data-engine') === false`.
- `leaves no data-engine on a canvas that was handed in once the release is through, also when dispose() lands in the init` —
  frischer Canvas, `new Display(canvas)`, sofort `whenReleased(…)` und `dispose()`,
  `await released`; `canvas.hasAttribute('data-engine') === false`.

Ist einer davon rot, schreibt three `data-engine` doch in der Freigabe neu: **nicht beheben**,
im Report unter »Folgen« mit Browser, Backend und dem Stack der Schreibstelle melden (ein
`MutationObserver` auf das Attribut mit `new Error().stack` im Callback zeigt sie).

### 9. Verify

`pnpm run ci` (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg,
test:scripts, test:coverage, test:browser). `pnpm lint` schließt `prettier --check` ein —
`pnpm format` vor dem Lauf. Die Coverage-Schwellen in `packages/twopoint5d/vite.config.ts`
müssen halten.

## Findings im Volltext

**MEM-017 · medium · `packages/twopoint5d/src/display/Stylesheets.ts:61-73`** (weitere
Fundstellen `Display.ts:473`, `PanControl2D.ts:265`) — Stylesheets auf Constructable
Stylesheets umstellen, damit Regeln Reconnects überstehen
`Stylesheets` merkt sich pro Root das CSSOM-Sheet eines `<style>`-Elements. Das existiert
nur, solange das Element im Dokument hängt. Ein ShadowRoot, der noch nicht eingehängt ist
(Web Component, die im Konstruktor baut), liefert `sheet === null`, und `expectDefined`
wirft. Im Display passiert das erst, nachdem der Renderer gebaut und `init()` gestartet ist,
außerhalb des Aufräum-`try`. Wird ein Host verschoben, baut der Browser das Sheet aus dem
leeren `textContent` neu, und alle per `insertRule` gesetzten Regeln sind weg. Dieser zweite
Fall folgt aus der HTML-Spec und ist nicht im Browser reproduziert.
Empfehlung: `new CSSStyleSheet()` mit `adoptedStyleSheets` verwenden und im
Display-Konstruktor alles nach `makeRenderer` ins Aufräum-`try` nehmen.

**SEC-002 · low · `packages/twopoint5d/src/controls/PanControl2D.ts:261-265`** (weitere
Fundstelle `Stylesheets.ts:45`) — Cursor-Wert validieren, bevor er das Stylesheet erreicht
`cursorPanStyle` wird ungeprüft in eine CSS-Regel interpoliert. `"pointer; display:none"`
fügt dem Cursor-Target (Default `document.body`) beliebige Deklarationen hinzu. Ein `}` lässt
`insertRule` werfen, nachdem `#cursorPanStyle` und `#cursorPanRuleName` schon überschrieben
sind. Die vorherige Regel wird dann nie freigegeben. Die Quelle ist Entwicklercode.
Empfehlung: Nur einen Deklarationswert erlauben (`;{}` ablehnen oder `CSS.supports('cursor', v)`)
und die Felder erst nach einem erfolgreichen `retainRule` zuweisen.

**MEM-019 · low · `packages/twopoint5d/src/display/Display.ts:1125`** — Ein gescheitertes
WebGL-Init auf einem übergebenen Canvas hinterlässt den webglcontextlost-Listener von three
Aufgefallen im Remediation-Lauf vom 2026-09-21. three hängt in `WebGLBackend.init` einen
`webglcontextlost`-Listener an den Canvas, bevor `new WebGLState` scheitern kann (three
0.185.1 `three.webgpu.js:71329`/`:71339`). Scheitert das Init, bleibt der Listener hängen. Er
hält den gescheiterten Renderer erreichbar und meldet bei jedem späteren Kontextverlust des
Canvas `WebGL Device Lost`. Der Kommentar »a failed init has built nothing that
renderer.dispose() would release« trifft dafür nicht zu. Das betrifft jedes gescheiterte Init
auf einem Canvas mit verlorenem Kontext.
Empfehlung: Im Rejection-Zweig von `#releaseRenderer()` den Listener abbauen, soweit three
ihn erreichbar macht, sonst den Fall im Kommentar benennen und bei three melden.

**ASYNC-006 · info · `packages/twopoint5d/src/display/Display.ts:55-64`** (weitere
Fundstellen `:1112-1115`, `:183-184`, `:640-643`) — drainSubmittedWork() wartet ohne Frist auf
onSubmittedWorkDone()
Aufgefallen im Remediation-Lauf vom 2026-09-22. `drainSubmittedWork()` wartet unbegrenzt auf
`device.queue.onSubmittedWorkDone()`. Löst eine Implementierung dieses Promise nach einem
Device-Verlust nie auf, wartet die Freigabe des Renderers ohne Ende, und über
`canvasReleases` auch jedes spätere Display auf demselben übergebenen Canvas. Die
WebGPU-Spec verlangt, dass ausstehende `onSubmittedWorkDone()` bei Device-Verlust auflösen.
Das Risiko liegt deshalb nur bei abweichenden Implementierungen.
Empfehlung: Das Warten per `Promise.race` mit einer kurzen Frist begrenzen oder zusätzlich
auf `device.lost` reagieren und bei Ablauf mit einer Warnung weitermachen.

**READ-020 · low · `packages/twopoint5d/src/display/Display.ts:97`** — Die Beschreibung der
Map lostContexts stimmt nach einem verspäteten Kontext-Restore nur ungefähr
Aufgefallen im Remediation-Lauf vom 2026-09-21. Kommt der WebGL-Kontext erst nach dem
Timeout zurück, während ein Display auf dem toten Kontext läuft, bleibt der
`lostContexts`-Eintrag mit lebendem Kontext stehen, bis der nächste Display ihn herausnimmt.
Das ist harmlos, aber die Beschreibung der Map (»for as long as it stays lost«) stimmt in
diesem Fenster nicht.
Empfehlung: Den Eintrag bei `webglcontextrestored` entfernen oder die Beschreibung der Map
anpassen.

**DOC-031 · info · `packages/twopoint5d/src/display/Stylesheets.ts:143`** — TSDoc von
Stylesheets.addRule() vervollständigen
Dem TSDoc von `addRule()` fehlt `@param element`, und es schreibt »uniq-number« statt
»unique number«. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: `@param element` ergänzen (das Element, das die Klasse bekommt), Tippfehler
korrigieren.

## Abweichungen von den Empfehlungen, mit Grund

- MEM-017: beide Teile wie empfohlen. Zusätzlich die Neu-Adoption bei jedem
  `getGlobalSheet()` — ohne sie nähme ein Framework, das `adoptedStyleSheets` eines
  ShadowRoots ersetzt, die Regeln für immer heraus, und »überstehen« hieße nichts.
- SEC-002: `CSS.supports` statt `;{}`-Filter (Data-URL-Cursor, siehe Vorgehen 3); Warnung
  und Ablehnung statt Wurf. Die zweite Fundstelle `Stylesheets.ts:45` bekommt `CSS.escape()`
  für den Klassennamen — `css` bleibt eine Deklarationsliste, das ist sein Vertrag.
- READ-020: die zweite Option der Empfehlung (Beschreibung anpassen), Grund in Vorgehen 6.
- ASYNC-006: beides aus der Empfehlung, Frist **und** `device.lost`.
- MEM-019: Abbau über `backend._onContextLost`; das Melden bei three entfällt, weil three
  den Listener erreichbar macht.
