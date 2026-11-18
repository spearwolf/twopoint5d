# Paket 2 — Browser-Test-Harness und Allocation-Specs

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TEST-001 (low), TEST-002 (low), TEST-003 (low), TEST-004 (low), TEST-005 (low), TYPE-003 (low), TEST-006 (info)
- Ziel: Die Browser-Tests räumen auch im Fehlschlag auf, prüfen ihre Annahmen zur Laufzeit, schlagen bei zu vielen Skips fehl und sind typgeprüft, und die Reihenfolgeabhängigkeit der Allocation-Specs ist sichtbar.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d-testing/test/helpers/fixtures.js`
  - `packages/twopoint5d-testing/web-test-runner.config.js`
  - `packages/twopoint5d-testing/tsconfig.json`, neu `packages/twopoint5d-testing/tsconfig.helpers.json`
  - `packages/twopoint5d-testing/package.json` (Skript `typecheck`), `packages/twopoint5d-testing/project.json` (Inputs von `typecheck`)
  - neu `packages/twopoint5d-testing/test/harness-pixels.test.js`
  - `packages/twopoint5d-testing/test/renderer-backend.test.js`
  - `packages/twopoint5d-testing/test/stage-camera-rig.test.js`, `test/stage-post-process.test.js`
  - die direkten Readbacks und Kommentare in `test/stage-canvas2d.test.js`, `test/stage-masks.test.js`, `test/sprites-glow.test.js`, `test/stage-post-process.test.js`, `test/stage-pipeline.test.js`, `test/stage-transitions.test.js`, `test/vertex-objects-gpu-upload.test.js`, `test/stage-pixel-snap.test.js`
  - `packages/twopoint5d/src/stage/hot-path-allocations.camera-rig.spec.ts` (nur Kommentar)
  - `AGENTS.md`, `docs/architecture.md` (§3 und §6)
- Verify: `pnpm run ci`
- Commit: `test(browser): release the probe of readsTopDown() and the stage renderers when a test fails half way, refuse a read-back that is not packed tightly, fail the run on a skip it does not expect, check the fixtures with noImplicitAny and say that an allocation spec reproduces only as a whole file`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · TEST-001 unverändert (`fixtures.js:746-747`) · TEST-002 unverändert (`stage-camera-rig.test.js:36/42/47, 109/115/119, 225/228/263`), dieselbe Ursache in `stage-post-process.test.js:59/67/72` aufgenommen · TEST-003 unverändert (`web-test-runner.config.js:151-153`; Playwright 1.65.0 bringt WebKit 27.2, ohne `navigator.gpu`) · TEST-004 umgeformt: three 0.187.0 liefert den Readback schon ohne Zeilen-Padding, die 64-px-Grenze in JSDoc und 9 Testkommentaren ist falsch, die Laufzeitprüfung bleibt und deckt auch die 20 direkten Readbacks · TEST-005 unverändert (`web-test-runner.config.js:184-222`), `process.exitCode` allein wirkt nicht · TYPE-003 unverändert (`tsconfig.json:13-14`, `fixtures.js:384/599/762`) · TEST-006 unverändert (`hot-path-allocations.camera-rig.spec.ts:48-50`) · keine Folgen und keine offenen Befunde zu verteilen · Restplan unverändert
  - 2026-11-18 Zug 1: Implementierer beauftragt (Runde 0, sonnet, effort medium), Report nach `paket-2.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG_MIT_VORBEHALT (Position in `RENDERER_FREE_FILES`, ein Cast in `readBack()`) · 18 Dateien geändert, neu `test/harness-pixels.test.js`, `tsconfig.helpers.json` · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-2.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (sonnet, medium) gibt frei, alle sieben Findings behoben, 4 × klein, Diff `paket-2.diff`, Report `paket-2.review-0.json`
  - 2026-11-18 Zug 4: entfällt, keine Runde (0 Runden)
  - 2026-11-18 Zug 5: committet als d3ac1326 auf Verify-Lauf `paket-2.verify.log` (exit=0, keine Änderung seither)

## Vorgehen

Code, Kommentare und Doku auf Englisch, im Ton der umgebenden Datei (AGENTS.md).
Keine Finding-ID und kein Satz über den Vorzustand in Code, Kommentar, Doku oder
Commit-Message (Abschnitt »Konventionen« im Plan). Kein CHANGELOG-Eintrag: das
Paket ändert nichts an der öffentlichen API von `@spearwolf/twopoint5d` — das
Testpaket ist `private`, AGENTS.md und `docs/architecture.md` sind Repo-Doku, der
Spec bekommt nur einen Kommentar.

Reihenfolge: Schritt 1 (Regressionstests, rot sehen) vor den Schritten 2 und 3.

### 1. Regressionstests zuerst: `test/harness-pixels.test.js` (neu)

Ein Harness-Test wie `test/harness-rejections.test.js`: er prüft die Fixtures
selbst, rendert nichts und kommt deshalb in `RENDERER_FREE_FILES` in
`web-test-runner.config.js` (alphabetisch, nach `test/harness-rejections.test.js`).
Kopfkommentar in zwei, drei Sätzen: was die Datei prüft (dass die Pixel-Helfer der
Fixtures aufräumen, wenn ein Rendern wirft, und einen Readback ablehnen, den sie
falsch lesen würden), mit Stub-Renderern statt echten.

Zwei `describe`-Blöcke:

- `describe('readsTopDown()')`, Test: *releases its probe sprites when the render
  throws*. Ein Stub-Renderer, dessen `render()` einen eigenen `Error` wirft
  (`setClearColor()`, `setRenderTarget()` als No-ops,
  `readRenderTargetPixelsAsync()` darf nie erreicht werden). Für die Dauer des
  Tests `FeatureSprites.prototype.dispose` umhüllen (die Methode liegt am Prototyp,
  `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:744`) und die
  Aufrufe zählen; im `finally` des Tests das Original zurücksetzen. Erwartet:
  `readsTopDown(stub, {width: 64, height: 64})` verwirft mit genau dem geworfenen
  Fehler, und `dispose()` lief genau einmal. Das Stub-Objekt geht mit einem
  doppelten JSDoc-Cast durch (`/** @type {WebGPURenderer} */ (/** @type {unknown} */ (stub))`),
  ebenso das Ziel als `RenderTarget`.
- `describe('readTargetPixels()')`, zwei Tests:
  - *refuses a read-back whose rows a backend has padded*: Stub liefert für ein
    Ziel `{width: 50, height: 50}` ein `new Uint8Array(256 * 50)` → verwirft mit
    der Meldung aus Schritt 2 (auf den Anfang `readTargetPixels(): ` und die Zahlen
    prüfen).
  - *refuses a read-back of another format*: Stub liefert `new Uint16Array(64 * 64 * 4)`
    für 64 × 64 → verwirft.
  - *hands on a read-back packed tightly*: `new Uint8Array(64 * 64 * 4)` für 64 × 64
    kommt als dasselbe Objekt zurück.

Den `readsTopDown()`-Test **vor** Schritt 3 laufen lassen und rot sehen (`dispose`
lief 0-mal); die Ausgabe des roten Laufs gehört in den Report. Die drei
`readTargetPixels()`-Tests sind neu wie die Funktion selbst; ein roter Lauf vorher
zeigt nur den fehlenden Export und ist keine Pflicht. Einzeln laufen lassen geht
vermutlich mit `pnpm --filter @spearwolf/twopoint5d-testing exec web-test-runner --files test/harness-pixels.test.js`
(ungeprüft — die Config definiert Gruppen; klappt es nicht, den kleinsten Lauf
nehmen, der die Datei enthält, notfalls `pnpm test:browser`).

### 2. Readback mit Laufzeitprüfung (TEST-004)

**Abweichung von der Empfehlung, mit Grund:** Das Audit nimmt an, WebGPU liefere
bei einer Breite, die kein Vielfaches von 64 ist, gepaddete Zeilen. Unter three
0.187.0 stimmt das nicht: `copyTextureToBuffer()` in
`node_modules/.pnpm/three@0.187.0/node_modules/three/src/renderers/webgpu/utils/WebGPUTextureUtils.js:858-869`
(gleichlautend in `build/three.webgpu.js`) entfernt das Padding und gibt
`width × height × bytesPerTexel` dicht gepackt zurück; das WebGL-Backend liest
mit `readPixels()` ohnehin dicht. Die Prüfung bleibt richtig — sie fängt ein Ziel
anderen Formats und ein three, das wieder gepaddet liefert —, aber die Aussage
»nur 64 px breit« in JSDoc und Testkommentaren ist falsch und fällt. Die Prüfung
sitzt nicht nur in `renderToPixels()`, sondern in einem eigenen Readback-Helfer,
den auch die 20 direkten Readbacks nehmen: sie füttern `rgbAt()` genauso und
blieben sonst ungeprüft (dieselbe Ursache).

a. In `fixtures.js` direkt über `renderToPixels()` (heute Zeile 595) neu:

```js
/**
 * Reads all of `target` back: four bytes per pixel — red, green, blue, alpha —, row after row
 * with nothing between them, which is what rgbAt() and the other pixel helpers read. A read-back
 * that holds anything else — a target of another format, rows a backend has padded — throws,
 * so that a helper fails instead of reading the wrong pixel.
 *
 * @param {WebGPURenderer} renderer
 * @param {RenderTarget} target
 * @returns {Promise<Uint8Array>}
 */
export async function readTargetPixels(renderer, target) {
  const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
  const bytes = target.width * target.height * 4;
  if (!(pixels instanceof Uint8Array) || pixels.length !== bytes) {
    throw new Error(
      `readTargetPixels(): the read-back of a target of ${target.width} × ${target.height} is a ${pixels.constructor.name} of ${pixels.length}, not the ${bytes} bytes of rows packed tightly at four bytes per pixel`,
    );
  }
  return pixels;
}
```

`RenderTarget` als Typ-Import in den `@import`-Kopf (Zeile 2) aufnehmen. Passt der
Rückgabetyp von `readRenderTargetPixelsAsync()` in `@types/three` nicht zu
`instanceof`, den Typ über die Prüfung verengen, nicht casten.

b. `renderToPixels()` endet mit `return readTargetPixels(renderer, target);`
(statt des direkten `readRenderTargetPixelsAsync()`); ihr JSDoc sagt, dass sie
über `readTargetPixels()` zurückliest.

c. JSDoc richtigstellen, ohne Rückblick:
   - `rgbAt()` (Zeilen 610-617): die Pixel werden mit einer Zeilenlänge von
     `size * 4` Bytes gelesen, so dicht gepackt, wie `readTargetPixels()` sie
     prüft; `size` ist die Breite des Ziels. Der Satz über WebGPU und 256 Bytes
     und »Keep the targets of these tests at 64« fallen.
   - `readsTopDown()` (732-733), `compareWithModel()` (808-809), `coveredBox()`
     (848-849): der Satz »needs a target 64 pixels wide, or a multiple of it — see
     rgbAt« wird zu: braucht ein quadratisches Ziel, `size` Pixel je Seite (das ist
     die tatsächliche Annahme: diese drei und `cellColors()` rechnen Zeilen über
     `size`).

d. Die 20 direkten Readbacks gehen über `readTargetPixels(<renderer>, <target>)`;
jeder liest heute das ganze Ziel ab `(0, 0)` (abgeglichen):
   - `stage-canvas2d.test.js:63, 117`
   - `stage-masks.test.js:56, 263`
   - `sprites-glow.test.js:72`
   - `stage-post-process.test.js:107`
   - `stage-pipeline.test.js:143, 426, 430, 452, 466, 540, 631, 705, 706, 756, 786, 790`
   - `stage-transitions.test.js:61, 116`

   Vor jeder Ersetzung prüfen, dass die gelesene Breite und Höhe die des Ziels
   sind; wo nicht, stehen lassen und im Report melden. Import jeweils ergänzen.

e. Testkommentare, die eine Breite von 64 für den Readback verlangen, verlieren
diese Behauptung; was sie darüber hinaus sagen, bleibt:
   - `stage-masks.test.js:28`, `stage-transitions.test.js:30`,
     `stage-post-process.test.js:21`, `stage-canvas2d.test.js:42`,
     `stage-pipeline.test.js:404, 443`, `vertex-objects-gpu-upload.test.js:118`:
     »64 pixels wide: rgbAt() reads the rows at that length« bzw. »a width of 64
     pixels keeps the rows rgbAt() reads unpadded« ersatzlos streichen (die
     Konstante erklärt sich selbst) oder, wo der Block sonst unverständlich wird,
     durch das ersetzen, was stimmt.
   - `stage-pipeline.test.js:113-114`: »— a multiple of 64, so that rgbAt() reads
     its rows at that length —« fällt.
   - `stage-pixel-snap.test.js:6`: »64 pixels wide, as the read-back needs (see
     rgbAt() in the fixtures), and an odd 63 high« → »64 pixels wide and an odd 63
     high«.
   - `stage-canvas2d.test.js:94` (»the target stays 64 pixels wide«) stimmt und
     bleibt.

### 3. `readsTopDown()` räumt im Fehlschlag auf (TEST-001)

In `fixtures.js:735-754` die Probe in `try`/`finally`: alles vom Anlegen des
Sprites bis einschließlich `await renderToPixels(…)` im `try`, `sprites.dispose()`
im `finally`. Nicht über `keep()` — der Helfer verwaltet seine Probe selbst und
soll nicht davon abhängen, dass der Aufrufer `disposeKept()` im `afterEach` hat.
Danach muss der Test aus Schritt 1 grün sein.

### 4. Teardown gegen eine nicht angelegte Liste (TEST-002)

In `stage-camera-rig.test.js`, allen drei `describe`-Blöcken, und in
`stage-post-process.test.js` (dieselbe Ursache, im Abgleich gefunden):

- Deklaration `let renderers;` (`stage-camera-rig.test.js:36, 109, 225`,
  `stage-post-process.test.js:59`) wird `const renderers = [];`, die
  `@type`-Zeile darüber bleibt.
- Die Zuweisungen `renderers = [];` nach `await display.start()` fallen
  (`stage-camera-rig.test.js:42, 115, 263`, `stage-post-process.test.js:67`).
- Im `afterEach` `for (const sr of renderers.splice(0)) sr.dispose();`
  (`stage-camera-rig.test.js:47, 119, 228`, `stage-post-process.test.js:72`):
  die Liste ist danach leer, ein späterer Test entsorgt nie die Renderer eines
  früheren.

Kein eigener Regressionstest: der Fehler sitzt in den Hooks der Datei selbst, ein
Test müsste `display.start()` im `beforeEach` genau dieser Datei scheitern lassen.
Das im Report so begründen.

### 5. WebKit ohne WebGPU zur Laufzeit prüfen (TEST-003)

a. `web-test-runner.config.js`:
   - `backendLauncher()` übergibt dem Init-Script `{product, backend}` statt
     `backend` (`addInitScript(pinBackend, {product, backend})`, Zeile 22).
   - `pinBackend({product, backend})` (Zeile 40) legt wie bisher
     `twopoint5dTestBackend` an und zusätzlich, **vor** dem `delete`,
     `globalThis.twopoint5dTestBrowser` als eingefrorenes
     `{product, offersWebGPU: 'gpu' in Navigator.prototype}` — ob die Seite
     `navigator.gpu` hatte, bevor der Pin es nahm. JSDoc von `pinBackend()`
     nachziehen: den neuen Parameter und wer `twopoint5dTestBrowser` liest.
   - Kommentar Zeilen 151-152 versionslos: WebKit, die Engine von Safari; das
     WebKit, das Playwright mitbringt, bietet kein `navigator.gpu`, also rendert es
     unter WebGL 2 und braucht keine Flags; `renderer-backend.test.js` schlägt fehl,
     sobald ein Playwright-Release das ändert. Keine Versionsnummer.
b. `fixtures.js`, neben `expectedBackend()`: `testBrowser()` liest
   `twopoint5dTestBrowser` über `Reflect.get(globalThis, …)` und gibt
   `{product: 'chromium' | 'firefox' | 'webkit', offersWebGPU: boolean}` zurück;
   fehlt der Wert, wirft sie wie `expectedBackend()`:
   ``no browser recorded for this run (got ${…}) — see web-test-runner.config.js``.
c. `renderer-backend.test.js`: ein zweiter Test im bestehenden `describe`, etwa
   *finds no WebGPU in WebKit, which runs under WebGL 2 alone for that reason*:
   `const {product, offersWebGPU} = testBrowser();` und
   `expect(product === 'webkit' && offersWebGPU, '<Meldung>').to.equal(false)`.
   Meldung sinngemäß: WebKit bietet WebGPU an — es braucht einen WebKit-Launcher
   unter WebGPU in `web-test-runner.config.js`. Kein `this.skip()` (Schritt 6
   zählt jeden Skip).
d. `docs/architecture.md`, Absatz zu `test/renderer-backend.test.js`
   (Zeilen 271-276): ein Satz, dass dieselbe Datei festhält, dass WebKit kein
   WebGPU anbietet, und ein Playwright-Update, das das ändert, dort auffällt.

Abgleich: Playwright 1.65.0 bringt WebKit 27.2
(`node_modules/.pnpm/…/playwright-core/browsers.json`); eine Probe auf dieser
Maschine ergab `'gpu' in Navigator.prototype === false`. Der neue Test ist heute
grün.

### 6. Unerwartete Skips machen den Lauf rot (TEST-005)

**Abweichung von der Empfehlung, mit Grund:** `process.exitCode = 1` im Reporter
wirkt nicht. @web/test-runner 1.0.0 ruft nach den Reportern
`process.exit(passed ? 0 : 1)`
(`node_modules/.pnpm/@web+test-runner@1.0.0/node_modules/@web/test-runner/dist/startTestRunner.js:39-42`,
ausgelöst über `TestRunnerCli.reportEnd()` → `runner.stop()` → `'stopped'`), und
ein explizites `process.exit(0)` überschreibt einen vorher gesetzten Exit-Code.
Probe unter Node 24.21.0: `process.exitCode = 1; process.exit(0)` endet mit 0, ein
`'exit'`-Listener, der `process.exitCode = 1` setzt, mit 1. Die Biome-Regel
`noSkippedTests` passt nicht: alle Skips sind bedingte `this.skip()` zur Laufzeit,
mit Absicht.

a. In `web-test-runner.config.js`, nach den Launchern (die Schlüssel kommen aus
ihren Namen): `EXPECTED_SKIPS`, ein Objekt mit berechneten Schlüsseln
`[chromiumWebGPU.name]`, `[chromiumWebGL2.name]`, `[firefoxWebGL2.name]`,
`[webkitWebGL2.name]`, je ein Array der Tests im Format des Reporters
(`file › suite › … › test`). Kommentar davor: die Tests, die absichtlich skippen,
weil ihr Gegenstand unter diesem Launcher nicht existiert; der Reporter vergleicht
den Lauf damit und lässt ihn bei jeder Abweichung scheitern; ein neuer
`this.skip()` gehört hierher.

   Erwartet sind nach dem Code 10 Einträge — die exakten Namen aus dem Block
   `Skipped tests:` eines Laufs übernehmen und gegen diese Tabelle halten:

   | Stelle | skippt unter |
   | --- | --- |
   | `display-dispose.test.js:215` (nur WebGPU hat eine Queue) | Chromium WebGL2, Firefox WebGL2, WebKit WebGL2 |
   | `display-dispose.test.js:370, 412, 464` (nur ein WebGL-Kontext geht verloren) | Chromium WebGPU |
   | `sprites-picking.test.js:320` (kein `gc()`) | Firefox WebGL2, WebKit WebGL2 |
   | `vertex-objects-heap.test.js:59` (`before`, 1 Test; kein `performance.memory`/`gc()`) | Firefox WebGL2, WebKit WebGL2 |

   Weicht der Lauf davon ab, ist genau das der Fall, den das Paket fangen soll:
   nicht stillschweigend übernehmen, sondern im Report melden.

b. `skippedTestsReporter()` vergleicht je Session (Launcher × Datei), deren
`testResults` vorliegen: die gefundenen Skips dieser Datei gegen die Einträge von
`EXPECTED_SKIPS[launcher]`, die mit `${file} › ` beginnen. Eine Datei, die nicht
lief (`--files`, eine andere Gruppe), wird nicht verglichen; eine Datei, die nicht
geladen hat, auch nicht (die macht den Lauf ohnehin rot). Zwei Richtungen:
   - ein Skip, der nicht in der Liste steht;
   - ein Eintrag der Liste, der in seiner Datei lief oder nicht mehr existiert.

   Der Block `Skipped tests:` bleibt wie er ist. Bei Abweichungen danach je eine
   Zeile pro Fall unter dem Launcher, dann eine Zeile, die sagt, dass der Lauf
   deshalb scheitert, über `console.error` (mit derselben `biome-ignore`-Begründung
   wie das `console.log`), und
   `process.on('exit', () => { process.exitCode = 1; });` — mit einem Kommentar,
   warum ein `exit`-Listener und nicht `process.exitCode` direkt (der Runner endet
   nach den Reportern mit `process.exit(passed ? 0 : 1)`, der Listener läuft
   danach, und sein Exit-Code ist der, mit dem der Prozess endet).

c. JSDoc von `skippedTestsReporter()` nachziehen. `docs/architecture.md:287-292`
nachziehen: der Block listet weiter je Launcher, und ein Skip, der nicht in
`EXPECTED_SKIPS` steht, oder ein Eintrag, der lief, lässt den Lauf scheitern; ein
neuer `this.skip()` braucht seinen Eintrag. Den Satz »A test that skips where it
ought to run shows in the log of a green run« entsprechend ersetzen.

d. Einmal belegen, dass der Reporter rot macht: einen Eintrag vorübergehend
entfernen, einen Lauf mit der betroffenen Datei starten, Exit-Code ≠ 0 und die
Meldung in den Report, Eintrag zurück. Nicht zwei Läufe parallel im selben Baum.

### 7. Fixtures mit `noImplicitAny` (TYPE-003)

a. Neu `packages/twopoint5d-testing/tsconfig.helpers.json`, mit Kommentar im Stil
von `tsconfig.json`:

```jsonc
// The fixtures every test file shares are checked once more, with noImplicitAny on: each helper
// names the types of its parameters, so an argument out of its place fails the check. The test
// files stay at the strictness of tsconfig.json.
{
  "extends": "./tsconfig.json",
  "compilerOptions": {"noImplicitAny": true},
  "include": ["test/helpers"]
}
```

   Nur `noImplicitAny`, wie empfohlen; `strictNullChecks` bleibt aus (die
   Begründung in `docs/architecture.md` §6 gilt für die Fixtures genauso).

b. `package.json`: `"typecheck": "pnpm tsc -p tsconfig.json && pnpm tsc -p tsconfig.helpers.json && node ../../scripts/checkDocSnippets.mjs"`.
`project.json`: in den Inputs von `typecheck` `"{projectRoot}/tsconfig.helpers.json"`
ergänzen (`sharedTsconfigs` in `nx.json` deckt nur `{projectRoot}/tsconfig.json`
ab). `scripts/checkDocSnippets/typecheckInputs.test.mjs` hält die
Markdown-Inputs gegen git — ein JSON-Input sollte ihn nicht stören; läuft er rot,
ist das eine Folge dieses Pakets und wird mitgezogen.

c. `pnpm tsc -p tsconfig.helpers.json` laufen lassen und jeden gemeldeten
Parameter in `fixtures.js` mit `@param` typisieren — mit dem Typ seiner
tatsächlichen Verwendung: `WebGPURenderer`, `Scene`, `Camera`, `RenderTarget`,
`BufferAttribute | InterleavedBufferAttribute`, `ArrayLike<number>` bzw.
`number[]` für Pixel und Farben, der Visibilitor-Typ der Library für `makeMap()`.
Kein `any`, kein `@ts-ignore`/`@ts-expect-error`, `unknown` nur, wo ein Helfer
wirklich alles nimmt. Auch die inneren Arrow-Funktionen ohne Kontexttyp
(`put` in `makeTrimmedSheet()`, `viewAt` in `compareWithModel()`) und
`teardownErrors` (Zeile 98, `/** @type {unknown[]} */`). Laufzeitverhalten
unverändert.

d. Die Testdateien sehen danach die typisierten Signaturen. Meldet
`pnpm tsc -p tsconfig.json` dort neue Fehler: ist die Signatur zu eng, auf die
tatsächlich angenommene Menge weiten; ist der Aufruf falsch, ist das ein
Nebenbefund — melden, nicht im Testfall umbauen.

e. Doku:
   - `tsconfig.json`, Kopfkommentar: ein Satz, dass `test/helpers/` zusätzlich
     unter `tsconfig.helpers.json` mit `noImplicitAny` geprüft wird.
   - `docs/architecture.md` §6, nach »a fixture that needs a type gets it from
     JSDoc — vertex object interfaces, descriptions.«: die Fixtures in
     `test/helpers/` werden ein zweites Mal mit `noImplicitAny` geprüft
     (`tsconfig.helpers.json`), jeder Helfer nennt die Typen seiner Parameter.
   - `AGENTS.md:218-220` (»The browser tests share their fixtures through …«):
     ergänzen, dass ein Helfer dort JSDoc-Typen für seine Parameter trägt, weil
     `tsconfig.helpers.json` das Verzeichnis mit `noImplicitAny` prüft, und dass
     ein Test ein Ziel über `readTargetPixels()` zurückliest.

### 8. Reihenfolgeabhängigkeit der Allocation-Specs (TEST-006)

a. `packages/twopoint5d/src/stage/hot-path-allocations.camera-rig.spec.ts:48-50`:
den Kommentar um einen Satz ergänzen — ein Fehlschlag wird mit der ganzen Datei
reproduziert (`pnpm test:allocations`), nie mit `-t` oder dem Case allein.
b. `AGENTS.md:49-53`, Eintrag `pnpm test:allocations`: ein Satz, dass ein Case
unter dem V8-Feedback der Cases vor ihm in seiner Datei misst, und ein
Fehlschlag deshalb mit der ganzen Datei reproduziert wird, nicht mit `-t`.

### 9. Report

Zusätzlich zu den Pflichtfeldern: der rote Lauf aus Schritt 1, die Liste
`EXPECTED_SKIPS` mit Abgleich gegen die Tabelle in Schritt 6, der rote
Belegslauf aus Schritt 6d, die Zahl der in Schritt 7 typisierten Helfer, und jede
Stelle aus 2d/2e, die anders aussah als hier beschrieben.

## Für Zug 5 — Schnittstellen nach dem Commit

Diese Punkte gehören nach dem Commit in die `Schnittstellen:`-Zeile im Plan, weil
spätere Pakete Browser-Tests anfassen:

- `readTargetPixels(renderer, target)` in `test/helpers/fixtures.js` liest ein
  ganzes Ziel zurück und wirft bei allem außer dicht gepackten 4 Bytes je Pixel;
  ein Test liest darüber zurück, nicht über `readRenderTargetPixelsAsync()`.
- `testBrowser()` in den Fixtures, `globalThis.twopoint5dTestBrowser` aus
  `pinBackend()`.
- `EXPECTED_SKIPS` in `web-test-runner.config.js`: ein neuer `this.skip()` braucht
  dort seinen Eintrag, ein entfernter verliert ihn, sonst ist `pnpm test:browser`
  rot.
- `tsconfig.helpers.json`: ein neuer Helfer in `test/helpers/` braucht
  JSDoc-Typen für jeden Parameter, sonst ist `pnpm typecheck` rot.

## Abgleich im Einzelnen (Zug 0, 2026-11-18)

Basis ist der Audit-Commit `2e3f585b`; seitdem nur `a964bd90` (Paket 1), das weder
`packages/twopoint5d-testing/` noch die Allocation-Specs berührt
(`git diff --stat 2e3f585b HEAD` auf beide Pfade leer).

- **TEST-001** unverändert: `fixtures.js:746-747`, `sprites.dispose()` nach dem
  awaiteten `renderToPixels()`.
- **TEST-002** unverändert: `stage-camera-rig.test.js` Deklaration 36/109/225,
  Zuweisung nach `await display.start()` 42/115/263, Schleife im `afterEach`
  47/119/228. Dieselbe Ursache in `stage-post-process.test.js:59/67/72`
  (vorbestehend: Datei seit `2e3f585b` unverändert) — ins Paket aufgenommen.
- **TEST-003** unverändert: `web-test-runner.config.js:151-153` nennt Playwright
  1.63.0/WebKit 26.6; installiert ist Playwright 1.65.0 mit WebKit 27.2. Probe:
  WebKit 27.2 bietet hier kein `navigator.gpu`.
- **TEST-004** umgeformt: Die Fundstellen `fixtures.js:618, 735, 822, 851` stehen
  unverändert, aber die Prämisse trägt nicht — three 0.187.0 (Catalog `~0.187.0`,
  damals wie heute) packt den Readback dicht. Was bleibt: ein ungeprüfter Readback
  und falsche Doku in `fixtures.js:613-616, 732-733, 808-809, 848-849` sowie in
  neun Testkommentaren. Dieselbe Ursache, im Abgleich gefunden und aufgenommen: 20
  direkte `readRenderTargetPixelsAsync()`-Aufrufe in sechs Testdateien, die
  `rgbAt()` ohne Prüfung füttern. Für den Abschluss: die Beschreibung von TEST-004
  im Audit ist für three 0.187.0 sachlich falsch; die Laufzeitprüfung ist trotzdem
  sinnvoll.
- **TEST-005** unverändert: `skippedTestsReporter()` in
  `web-test-runner.config.js:184-222` setzt keinen Exit-Code. Die empfohlene
  Mechanik (`process.exitCode`) greift nicht, siehe Schritt 6.
- **TYPE-003** unverändert: `tsconfig.json:13-14` (`noImplicitAny: false`),
  `readBack()` 384, `renderToPixels()` 599, `cellColors()` 762 ohne `@param`.
- **TEST-006** unverändert: `hot-path-allocations.camera-rig.spec.ts:48-50`.

Triage: Unter Paket 1 stehen `Folgen: keine` und `Nebenbefunde: keine`, »Offene
Befunde« ist leer — nichts zu verteilen. Die im Abgleich gefundenen Stellen
(`stage-post-process.test.js`, die 20 Readbacks, die neun Kommentare) teilen die
Ursache eines Findings dieses Pakets und gehen deshalb hier mit, nicht in die
Queue.

Restplan: Reihenfolge und Schnitt der Pakete 3-11 bleiben. Sie erben nach diesem
Commit die vier Schnittstellen oben; ein Paket, das einen Browser-Test mit
`this.skip()` anlegt oder einen Helfer in die Fixtures stellt, muss
`EXPECTED_SKIPS` bzw. die JSDoc-Typen mitziehen.

## Findings im Volltext

**TEST-001 · low · packages/twopoint5d-testing/test/helpers/fixtures.js:735** — Aufräumen der Probe in readsTopDown() auch bei Fehlschlag sichern
readsTopDown() baut FeatureSprites und ruft sprites.dispose() erst nach dem awaited renderToPixels(); wirft das Rendern, bleibt das Sprite-Objekt undisposed. Alle anderen Helfer der Datei nutzen keep()/try-finally, genau damit ein Fehler mitten im Test nichts hinterlässt (siehe Kommentar zu keep()).
Beleg: `const pixels = await renderToPixels(renderer, scene, camera, target); sprites.dispose();`
Empfehlung: sprites über keep() ablegen oder dispose() in ein finally setzen.

**TEST-002 · low · packages/twopoint5d-testing/test/stage-camera-rig.test.js:224** (auch :36, :109) — Test-Teardown gegen nicht initialisierte renderers-Liste absichern
Die renderers-Liste wird in beforeEach/makeFrameStage erst nach `await display.start()` angelegt. Scheitert start() (kalter Renderer-Start unter SwiftShader ist laut Config der bekannte Fehlerfall), läuft afterEach trotzdem: im CameraProjection-Block ist renderers dann undefined und `for (const sr of renderers)` wirft einen TypeError, der den eigentlichen Fehler überdeckt; in den anderen Blöcken steht noch die Liste des Vortests darin und deren schon entsorgte Renderer werden ein zweites Mal disposed.
Beleg: `let renderers;` (Z. 224) und `renderers = [];` erst nach `await display.start();` (Z. 262-263)
Empfehlung: renderers bei der Deklaration mit [] initialisieren und im afterEach leeren (`renderers.splice(0)`), oder die Liste vor start() anlegen.

**TEST-003 · low · packages/twopoint5d-testing/web-test-runner.config.js:151** — Stale Playwright-Version im Kommentar der WebKit-Konfiguration nachführen
Der Kommentar nennt Playwright 1.63.0 mit WebKit 26.6 als gemessenen Stand; der Catalog verlangt ^1.65.0. Die Aussage, WebKit habe kein navigator.gpu, ist an einer alten Version belegt und wird bei einem Playwright-Bump nicht mitgeprüft. Die Konfiguration pinnt WebKit trotzdem auf WebGL2, ohne zu prüfen, ob navigator.gpu doch da ist.
Beleg: `// WebKit, the engine of Safari. Playwright 1.63.0 ships WebKit 26.6` gegen `playwright: ^1.65.0` (pnpm-workspace.yaml:15)
Empfehlung: Kommentar auf die tatsächliche Version bringen oder versionslos formulieren; optional in pinBackend für WebKit prüfen, dass navigator.gpu fehlt, damit ein Playwright-Bump mit WebGPU-WebKit auffällt (renderer-backend.test.js deckt es teilweise ab).

**TEST-004 · low · packages/twopoint5d-testing/test/helpers/fixtures.js:618** (auch :735, :822, :851) — Zeilenbreiten-Annahme der Pixel-Helfer (64 px) zur Laufzeit prüfen
rgbAt(), readsTopDown(), compareWithModel() und coveredBox() lesen mit Zeilenlänge size*4 und sind nur für Ziele mit Breite 64 oder einem Vielfachen korrekt; bei anderer Breite liefert WebGPU gepaddete Zeilen und die Helfer lesen 'wortlos' das falsche Pixel. Die Einschränkung steht nur im JSDoc.
Beleg: `The pixels are read at a row length of size * 4 bytes ... at another width the rows come back padded and this reads the wrong pixel without a word.`
Empfehlung: In renderToPixels() (oder rgbAt) assertieren, dass pixels.length === width*height*4, so dass ein falsches Zielformat laut scheitert statt falsch zu lesen.

**TEST-005 · low · packages/twopoint5d-testing/web-test-runner.config.js:184** — Übersprungene Browser-Tests über eine Obergrenze zum Fehlschlag machen
skippedTestsReporter() listet übersprungene Tests am Ende, ändert aber den Exit-Code nie. Ein Test, der unter einem Launcher unerwartet skippt (der Kommentar nennt genau diesen Fall), lässt die CI grün; man sieht ihn nur, wenn jemand das Log liest.
Beleg: `stop({sessions}) { … console.log(lines.join('\n')); }` ohne Vergleich mit einer Erwartung
Empfehlung: Eine Liste erlaubter Skips (pro Launcher) in der Config führen und im Reporter bei Abweichung process.exitCode = 1 setzen; oder skippende Tests im Quelltext verbieten (Biome-Regel noSkippedTests ist verfügbar, sofern in 2.6.6 vorhanden — ungeprüft).

**TYPE-003 · low · packages/twopoint5d-testing/tsconfig.json:13** (auch fixtures.js:384, :599, :762) — Fixtures der Browser-Tests mit JSDoc-Typen versehen oder strictere Prüfung stufenweise aktivieren
Das Browser-Testpaket prüft JavaScript mit noImplicitAny und strictNullChecks aus (dokumentiert, mit Verweis auf docs/architecture.md §6). Folge: Helfer wie readBack(), renderToPixels(), cellColors(), compareWithModel() tragen keine Parametertypen, ein falsch gereihtes Argument (renderer, scene, camera, target) fällt dem Check nicht auf. Die Helfer in fixtures.js sind der Teil, den alle Testdateien teilen und der sich am ehesten typisieren lässt.
Beleg: `export async function renderToPixels(renderer, scene, camera, target)` ohne @param; `export function cellColors(pixels, size, pixelsPerUnit, topDown, x, y, columns, rows)`
Empfehlung: fixtures.js mit @param-Typen versehen und die Datei (oder ein eigenes tsconfig nur für helpers/) mit noImplicitAny prüfen; die Testdateien bleiben auf dem laxen Niveau.

**TEST-006 · info · packages/twopoint5d/src/stage/hot-path-allocations.camera-rig.spec.ts:48** — Reihenfolgeabhängigkeit der Allocation-Specs sichtbar machen
Die Allokationsmessungen hängen laut Kommentar vom V8-Feedback früherer Cases ab ('the order matters'). Ein einzelner Case, ein Filter mit -t oder ein vorgezogener Case kann anders ausgehen als der volle Lauf. Das ist dokumentiert, aber ein Fehlschlag lässt sich nicht isoliert reproduzieren, und ein neuer Case in der Mitte kann den nächsten kippen.
Beleg: `// The cases run in the order they are written, and the order matters`
Empfehlung: Im Spec-Kopf oder in AGENTS.md vermerken, dass eine Allokations-Regression immer mit dem ganzen File reproduziert wird (`pnpm test:allocations`), nicht mit `-t`.

## Review (Zug 3, 2026-11-18)

Urteil je Finding:
- TEST-001 behoben — `fixtures.js:832-850`, `sprites.dispose()` im `finally` (846); Test `harness-pixels.test.js:203-236`
- TEST-002 behoben — `stage-camera-rig.test.js:36, 108, 223`, `stage-post-process.test.js:59`: `const renderers = []`, `splice(0)` im `afterEach`
- TEST-003 behoben — `web-test-runner.config.js:46` (`twopoint5dTestBrowser`), `fixtures.js:60` (`testBrowser()`), `renderer-backend.test.js:36`; Config-Kommentar versionslos
- TEST-004 behoben (umgeformt) — `readTargetPixels()` `fixtures.js:645`, alle direkten Readbacks ersetzt, 64-px-Aussagen entfernt; Tests `harness-pixels.test.js:239-280`
- TEST-005 behoben — `EXPECTED_SKIPS` `web-test-runner.config.js:189` (10 Einträge), Reporter prüft beide Richtungen, `exit`-Listener Zeile 280
- TYPE-003 behoben — `tsconfig.helpers.json`, `typecheck`-Skript, `project.json`-Input, Helfer in `fixtures.js` typisiert
- TEST-006 behoben — `hot-path-allocations.camera-rig.spec.ts:51-52`, `AGENTS.md:49`

Kleine Befunde (keine Runde):
- `docs/architecture.md:292`: der neue `EXPECTED_SKIPS`-Satz ist nicht umbrochen (151 Zeichen).
- `docs/architecture.md:269`: Messstand Playwright 1.63.0 / WebKit 26.6 — als Nebenbefund in »Offene Befunde« (vorbestehend, gleiche Ursache wie TEST-003, aber datierte Messung außerhalb des Detailplans).
- `fixtures.js:403`: `bufferOf()` prüft `'isInterleavedBufferAttribute' in attr` für die Typverengung; unter three 0.187.0 gleichwertig.
- `fixtures.js:428`: ein kommentierter Cast auf `BufferAttribute` in `readBack()`, weil three `getArrayBufferAsync()` nur so typisiert.

Abweichungen des Implementierers: `harness-pixels.test.js` steht in `RENDERER_FREE_FILES` vor `harness-rejections` (alphabetisch richtig); `readBack()` nimmt `BufferAttribute | InterleavedBufferAttribute`.
