# Paket 6 — Drain: Browser-Suite auf Firefox 155/WebGPU und Test-Kommentare

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — vier Nebenbefunde aus der Queue: Firefox-155-Hänger der
  WebGPU-Browsertests (medium), `waitUntil`-Doc-Kommentar (info), Rückblick-Kommentar in
  `display-resize.test.js` (info), maschinengebundener Rückblick-Kommentar in
  `vertex-objects-heap.test.js` (info)
- Ziel: Die Browser-Suite ist auf dem Firefox der aktuellen Playwright-Version grün oder der
  Hänger ist als Ursache benannt und isoliert, und die Test-Kommentare beschreiben das
  Verhalten, das sie festhalten.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `package.json` (Root, `playwright`), `pnpm-lock.yaml`
  - `packages/twopoint5d-testing/test/support/stopAndDrain.js` (neu)
  - 16 Testdateien unter `packages/twopoint5d-testing/test/`: `display-adopt-renderer`,
    `display-constructor`, `display-dispose`, `display-resize`, `hello-twopoint5d-canvas`,
    `map2d-placement`, `map2d-tile-upload`, `map2d-visibility-helpers`, `renderer-backend`,
    `sprites-rotation`, `stage-pipeline`, `stage-renderer`, `vertex-objects-buffers-data`,
    `vertex-objects-dispose`, `vertex-objects-gpu-upload`, `vertex-objects-heap` (je `.test.js`)
  - `packages/twopoint5d-testing/test/texture-store-on.test.js` (nur der Kommentar)
  - `docs/architecture.md` (§4, §5, §6)
  - unverändert bleiben: `packages/twopoint5d/src/**`, `web-test-runner.config.js`,
    `.github/dependabot.yml`, `AGENTS.md`, `nx.json`, `project.json`
- Vorgehen: siehe Abschnitt »Vorgehen im Einzelnen« unten — Schritte 1 bis 8 in dieser
  Reihenfolge; der rote Lauf in Schritt 2 kommt vor jeder Änderung an den Tests.
- Verify: `pnpm exec playwright install chromium firefox && pnpm install --frozen-lockfile && pnpm run ci`
  — dazu im Log: genau eine Zeile `[renderer-backend] WebGPU on Firefox/155.0` und eine
  `[renderer-backend] WebGL2 on Chrome/153.…`, kein `GPUInternalError`, kein `Timeout of`,
  keine `did not finish`
- Commit: `test: stop each display and let its GPU queue run dry before a browser test disposes it, which keeps Firefox 155 drawing frames for the tests after it, move playwright to 1.63 and let three test comments describe what they hold`
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · Firefox-155-Hänger unverändert reproduziert
    (Playwright 1.63.0 ist weiter `latest`), umgeformt: 14 Tests in 4 Dateien plus
    `vertex-objects-dispose` als ganze Datei über `testsFinishTimeout` · Ursache isoliert:
    `device.destroy()` bei laufender Arbeit, Umgehung im Teardown belegt (3/3 grün, beide
    Browser) · drei Kommentare unverändert an `texture-store-on.test.js:32`,
    `display-resize.test.js:467-470`, `vertex-objects-heap.test.js:73-75` · keine offenen
    Folgen zu verteilen · neuer Nebenbefund `Display.dispose()` → Offene Befunde, `→ Audit` ·
    Restplan: Paket 7 unberührt, Reihenfolge bleibt
  - 2026-09-21 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach paket-6.impl-1.json
  - 2026-09-21 Zug 2: Report FERTIG · 21 Dateien (20 geändert, neu `test/support/stopAndDrain.js`) · Arbeitsbaum schmutzig · roter Lauf `paket-6.red.log` exit=1 · Verify `paket-6.verify.log` exit=0
  - 2026-09-21 Zug 3: Review (sonnet, low) — alle vier Befunde erfüllt, kein kritischer, ein wichtiger (Verify-Log belegt die Backend-Zeilen nicht, weil Nx den Output unterdrückt), zwei kleine · Diff `paket-6.diff`, Report `paket-6.review-1.json`
  - 2026-09-21 Zug 4: der wichtige Befund betraf den Beleg, nicht den Code — direkter Lauf `pnpm web-test-runner` → `paket-6.verify-browser.log` exit=0, je eine Zeile `WebGPU on Firefox/155.0` und `WebGL2 on Chrome/153`, 0 Treffer auf `GPUInternalError|Timeout of|did not finish`, Heap 11,79 % · keine Implementierer-Runde
  - 2026-09-21 Zug 5: Commit 9f6897b8, Verify `paket-6.verify.log` exit=0

## Urteil des Reviewers

- Firefox-155-Hänger: behoben — `package.json:52` (`^1.63.0`), `test/support/stopAndDrain.js:17-25` in allen 16 Display-Testdateien, roter Lauf `paket-6.red.log`
- `waitUntil`-Kommentar: behoben — `texture-store-on.test.js:32`
- `display-resize`-Kommentar: behoben — `display-resize.test.js:~467`
- `vertex-objects-heap`-Kommentar: behoben — `vertex-objects-heap.test.js` (Kommentar ohne Maschinenbezug), Messwert Zeilen 14-16 auf 11,8 % / Chromium 153

Kleine Befunde:
- `test/support/stopAndDrain.js:24` — kein Timeout auf `onSubmittedWorkDone()`; bei verlorenem Device hängt der Teardown bis zum Mocha-Timeout.
- `disposeDisplay` in den elf Dateien mit eigenem Helfer (z. B. `sprites-rotation.test.js:24-27`) — `await stopAndDrain(display)` steht vor dem `try`; rejected es, bleibt die Fixture stehen (so vom Detailplan festgelegt; Meldung des Implementierers).
- `display-resize.test.js:~468` — »still« liest sich knapp am Rückblick, meint »trotzdem«.

## Abgleich (Zug 0, 2026-09-21, gegen 9974fdb5)

**Firefox-155-Hänger** — besteht, umgeformt. Playwright `latest` ist weiterhin 1.63.0
(Chromium 153.0.8010.12, Firefox 155.0); `next` 1.64.0-alpha bringt Firefox 156. Probe in einer
Kopie von HEAD (`git archive`, Scratchpad, Projektbaum unberührt), `playwright` auf 1.63.0,
`pnpm install`: Lockfile +10/−20 (nur `playwright`/`playwright-core` 1.62.1 → 1.63.0, `fsevents@2.3.2`
fällt als optionale Dependency von Playwright weg), keine `missing peer`-Warnung — die
`@emnapi`-Peers aus Paket 5 halten. Firefox allein, alle 25 Dateien: Exit 1 nach 331 s,
14 Tests in 4 Dateien laufen in den Mocha-Timeout (`map2d-tile-upload` 1, `map2d-visibility-helpers` 4,
`stage-pipeline` 6, `stage-renderer` 3), `vertex-objects-dispose` reißt als ganze Datei die
`testsFinishTimeout` von 120 s. Paket 2 hatte 13 Tests in 4 Dateien gezählt; die Ursache ist
dieselbe. Logs: `paket-6.zug0-ff155-tile-upload.log`, `paket-6.zug0-ff155-full.log` im
Arbeitsverzeichnis.

**`waitUntil`-Kommentar** — unverändert, `packages/twopoint5d-testing/test/texture-store-on.test.js:32`:
`/** Resolve when \`cb\` returns a truthy value or the deadline elapses. */`; die Funktion
rejected bei Fristablauf (`:45-46`) und wenn `cb` wirft (`:40-42`).

**Rückblick in `display-resize.test.js`** — unverändert, der Kommentar steht bei `:467-470`
(Fundstelle der Queue `:469` ist seine dritte Zeile) und endet mit »this used to trigger a
double emit on frame 1«.

**Rückblick in `vertex-objects-heap.test.js`** — unverändert, `:73-75`: »on this machine it gets
no GL context at all« und »stays exactly where it was before this file existed«.

## Ursache des Hängers (in Zug 0 belegt)

Instrumentierte Probe (GPU-API-Prototypen in der Probe-Kopie umwickelt, nicht im Projekt):

1. Test 1 einer Datei läuft grün. Sein `afterEach` ruft `display.dispose()` →
   `renderer.dispose()` → three `WebGPUBackend.dispose()` (`three/src/renderers/webgpu/WebGPUBackend.js:2905`)
   → `device.destroy()`, während die zuletzt eingereichte Arbeit noch läuft.
2. Danach meldet Firefox 155 auf dem **zerstörten** Device 1 `GPUInternalError: Buffer with ''
   label has been destroyed` — kein Puffer der Tests, kein Aufruf auf einem zerstörten Puffer
   aus three oder der Bibliothek (keine der umwickelten Stellen schlägt an); der Puffer ohne
   Label gehört Firefox selbst.
3. Ab da ruft die Seite keinen `requestAnimationFrame`-Callback mehr auf (gezählt: 0 in 3 s),
   auch nicht den eines frischen Device 2 im nächsten Test. `display.nextFrame()` wartet bis
   zum Timeout; jede weitere Datei-Seite ist nicht betroffen.

Gegenproben, je Firefox 155:

| Teardown-Variante | Ergebnis |
| --- | --- |
| unverändert | 14 Timeouts + 1 Datei über der Frist |
| `context.unconfigure()` vor `dispose()` | Hänger bleibt |
| zwei `requestAnimationFrame` warten vor `dispose()` | Hänger bleibt |
| `await device.queue.onSubmittedWorkDone()` vor `dispose()` | `map2d-tile-upload` grün |
| Shim: `device.destroy()` erst nach `onSubmittedWorkDone()` (global) | alle 25 Dateien grün, 24 s |
| Drain am Anfang jedes `afterEach` | 3 Dateien geheilt, `stage-pipeline`/`stage-renderer` hängen weiter: ihr `disposeDisplay` ruft danach `await display.start()`, der angehängte `StageRenderer` reicht wieder Arbeit ein |
| `stop()` + Drain unmittelbar vor jedem Teardown-`dispose()` (= dieser Plan) | beide Browser grün, 3 von 3 Läufen, 28–29 s, kein `GPUInternalError` |

Logs: `paket-6.zug0-ff155-drain-shim.log`, `paket-6.zug0-pw163-both-drain-shim.log`,
`paket-6.zug0-pw163-both-afterEach-drain.log`, `paket-6.zug0-pw163-both-settle.log`,
`-settle-2.log`, `-settle-3.log`. Im grünen Lauf: `[renderer-backend] WebGL2 on
Chrome/153.0.8010.12`, `WebGPU on Firefox/155.0`, three meldet auf Chromium 153 weiter
`WebGPU is not available, running under WebGL2 backend`, Heap-Zuwachs 11,78–11,79 % (Grenze 0,15).

Cache: in der Probe lief `twopoint5d-testing:test` nach einem reinen Playwright-Wechsel
(1.63.0 → 1.62.1, sonst nichts geändert) wirklich (`Firefox/153.0` im Log), kein Cache-Treffer —
ein Playwright-Bump invalidiert die Browsertests, `project.json` braucht keinen Input. Mit Drain
ist die Suite auch auf 1.62.1/Firefox 153 grün.

## Entscheidungen in Zug 0 (mit Grund)

- **Harness-Fix, die »Grenze« des Plans greift nicht.** Die Ursache sitzt in Firefox 155: ein
  `device.destroy()` bei laufender Arbeit ist nach WebGPU-Spezifikation zulässig, Fehler auf
  einem zerstörten Device dürfen nicht mehr gemeldet werden, und ein Stillstand von
  `requestAnimationFrame` für die ganze Seite folgt aus keinem Aufruf der Bibliothek. Der Weg
  dorthin führt durch three (`WebGPUBackend.dispose()` zerstört ohne Drain) und durch
  `Display.dispose()`, aber keine Zeile unter `packages/twopoint5d/src/` ist falsch in dem
  Sinn, den die Grenze meint. Die Tests prüfen kein Teardown-Verhalten von Firefox; ihr
  Teardown hört auf, den Browserfehler auszulösen. Was Apps auf Firefox 155 davon trifft, geht
  als eigener Nebenbefund ins Audit (Plan, »Offene Befunde«) — so bleibt es sichtbar, statt
  unter einem grünen Lauf zu verschwinden. Playwright geht deshalb auf 1.63.
- **Kein globaler Shim im Runner-HTML.** Ein umgewickeltes `GPUDevice.prototype.destroy` in
  `testRunnerHtml` heilt alles in einer Zeile, verschiebt aber jedes Zerstören auf später —
  ein Use-after-dispose der Bibliothek liefe in diesem Fenster durch, genau die Klasse, die
  `display-dispose` und `vertex-objects-dispose` bewachen.
- **WebGPU in Firefox bleibt an.** `dom.webgpu.enabled: false` wäre auch grün (Paket 2), nähme
  der Suite aber ihr einziges WebGPU-Backend: Chromium 153 läuft auf WebGL2.
- **Ein gemeinsamer Helfer statt 16 Kopien.** Die Testdateien sind sonst selbsttragend
  (`makeContainer` je Datei); die Umgehung eines Browserfehlers braucht aber genau eine Stelle
  mit Begründung und Wegfallbedingung. `test/support/` liegt außerhalb von
  `files: 'test/**/*.test.js'` und innerhalb von `include: ["test"]` der tsconfig sowie der
  Nx-Inputs (`{projectRoot}/**/*` für `test`, `{projectRoot}/test/**/*.js` für `typecheck`).
- **Alle 16 Teardowns, nicht nur die fünf roten Dateien.** Dieselbe Ursache steckt in jedem
  Teardown, das ein Display mit eingereichter Arbeit abbaut; dass die übrigen elf heute grün
  sind, hängt an Reihenfolge und Zeitpunkt, und der nächste Test in so einer Datei träfe es.
- **Dispose-Aufrufe im Testkörper bleiben unverändert** (`display-dispose.test.js`, 14 Stellen;
  `display-adopt-renderer.test.js:65`): dort ist `dispose()` der Gegenstand des Tests. Sie
  laufen auf Firefox 155 grün.
- **`playwright` mit `^1.63.0`, nicht mit Tilde.** Die Tilde war der Halt; vor Paket 2 stand
  `^1.62.1`, alle anderen devDependencies tragen Caret. Welche Version läuft, bestimmt das
  Lockfile.
- **`playwright` bleibt aus der Dependabot-Gruppe `toolchain`.** Der Kommentar in
  `.github/dependabot.yml:3-5` begründet das schon ohne den Halt (»playwright moves the browsers
  the test suite runs on«), und dieses Paket ist der Beleg dafür; die Datei bleibt unverändert,
  nur der Satz in `docs/architecture.md` §5 verliert den Halt.
- **`AGENTS.md` bleibt unverändert.** Die Regel steht am Helfer und in `docs/architecture.md` §6;
  wer einen neuen Browsertest schreibt, kopiert ein bestehendes `afterEach` und bekommt den
  Aufruf mit.
- **Kein Upstream-Report aus dem Lauf.** Ein Bug bei Mozilla ist ein Schritt nach außen; das
  Material dafür steht in diesem Abschnitt und im Audit-Eintrag.

## Nebenbefund aus Zug 0

`packages/twopoint5d/src/display/Display.ts:887` — Urteil `→ Audit`: Bibliothekscode, die
Scope-Regel (CI, Build, Cache, Test-Harness, Gates, Dependencies, Publish) greift nicht.
Vorbestehend: `git show 42a88429^:packages/twopoint5d/src/display/Display.ts` trägt dasselbe
`dispose()` (Zeilen 877–893). Severity geschätzt **medium**, nicht high: die Ursache ist ein
Fehler in Firefox 155, belegt nur headless mit Software-Rendering (Playwright-Firefox, der
Puffer ohne Label gehört vermutlich dem Readback-Pfad der Canvas-Präsentation); ob Firefox auf
echter Hardware ebenso stehen bleibt, ist offen. Trifft es dort zu, friert eine App, die ein
Display abbaut, jede `requestAnimationFrame`-Animation der Seite ein — dann ist beim Einbuchen
ins Audit auf high zu prüfen.

## Vorgehen im Einzelnen

Arbeitsverzeichnis für Logs: `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad`
(unten `$ARBEITSDIR`). Kein Log ins Projekt.

### 1. Playwright auf 1.63

- `package.json` (Root), Zeile 52: `"playwright": "~1.62.1",` → `"playwright": "^1.63.0",`
- `pnpm install`, dann `pnpm exec playwright install chromium firefox`.
- Erwartung: `pnpm why playwright -r` zeigt für Root und `@web/test-runner-playwright` nur
  `playwright 1.63.0`; `pnpm exec playwright --version` → `Version 1.63.0`; das Install-Log
  enthält keine `missing peer`-Warnung.
- Lockfile-Diff (`git diff --stat pnpm-lock.yaml`): nur `specifier`/`version` von `playwright`
  im Importer `.`, `playwright`/`playwright-core` 1.62.1 → 1.63.0 in `packages:` und
  `snapshots:`, die Snapshot-Zeile unter `@web/test-runner-playwright@1.0.0`, und
  `fsevents@2.3.2` fällt in `packages:` und `snapshots:` weg (`fsevents@2.3.3` bleibt). In der
  Probe +10/−20. Jede andere Zeile ist ein Befund: nicht von Hand glätten, im Report melden.
- Danach sind `pnpm install --frozen-lockfile` und `pnpm install --lockfile-only --offline`
  Fixpunkt (`git diff --exit-code pnpm-lock.yaml` nach beiden).

### 2. Roter Lauf vor dem Fix

`pnpm build:twopoint5d`, dann aus `packages/twopoint5d-testing`:

```bash
timeout 300 pnpm web-test-runner test/map2d-tile-upload.test.js test/stage-renderer.test.js > "$ARBEITSDIR/paket-6.red.log" 2>&1; echo "exit=$?" >> "$ARBEITSDIR/paket-6.red.log"
```

Erwartung: Exit ungleich 0, auf Firefox `Timeout of 20000ms exceeded` (tile-upload) bzw.
`Timeout of 10000ms` (stage-renderer) und `THREE.WebGPURenderer: Uncaptured WebGPU
GPUInternalError: Buffer with '' label has been destroyed`; Chromium grün. Die Zeilen gehören
in den Report. Bleibt der Lauf grün, anhalten und `BLOCKIERT` melden — dann trägt dieser Plan
nicht.

### 3. Neuer Helfer `packages/twopoint5d-testing/test/support/stopAndDrain.js`

Genau dieser Inhalt (Prettier darf umbrechen):

```js
/** @import {Display} from '@spearwolf/twopoint5d' */

/**
 * Stops a display and resolves once the GPU has run everything submitted to it so far.
 *
 * A teardown calls this right before it disposes a display. On Firefox 155 under WebGPU, a
 * `dispose()` that destroys the device while submitted work is still in flight reports a
 * `GPUInternalError` on the destroyed device, and the page gets no `requestAnimationFrame`
 * callback after that — every later test in the file waits for a frame until it times out.
 * Stopping first keeps the display's own frame loop from submitting more work while the queue
 * drains. Once Firefox takes such a device down without stalling, the calls can go: remove
 * them and run `pnpm test:browser`.
 *
 * @param {Display | undefined} display
 */
export async function stopAndDrain(display) {
  if (!display || display.isDisposed) return;
  display.stop();
  // the WebGL2 backend has no queue to wait for
  if (!display.isWebGPUBackend) return;
  // the three.js typings leave the device off WebGPUBackend
  const {device} = /** @type {{device?: {queue: {onSubmittedWorkDone(): Promise<unknown>}} | null}} */ (
    display.renderer.backend
  );
  if (device) await device.queue.onSubmittedWorkDone();
}
```

Die Guards sind nötig: `isWebGPUBackend` wirft nach `dispose()`, und vor dem Ende von
`renderer.init()` ist `device` noch `null`. Der Cast ist in der Probe mit
`pnpm exec tsc -p packages/twopoint5d-testing/tsconfig.json` durchgelaufen (Exit 0); ein Cast
auf `WebGPUBackend` aus `three/webgpu` scheitert mit TS2339, weil `@types/three` dort kein
`device` deklariert.

### 4. Import in alle 16 Dateien

Alle Zeilennummern in den Schritten 5 und 6 gelten für den Stand vor diesem Schritt; der
Import schiebt sie in jeder Datei um eine Zeile nach unten.

In jede der 16 Dateien aus »Dateien« direkt nach der letzten `import … from '…';`-Anweisung
(vor den `/** @import … */`-Zeilen, wo es sie gibt):

```js
import {stopAndDrain} from './support/stopAndDrain.js';
```

### 5. Aufruf unmittelbar vor jedem Teardown-`dispose()`

**Elf Dateien mit eigenem `disposeDisplay`-Helfer.** Der Helfer wird `async` (wo er es nicht
ist), und `await stopAndDrain(display);` steht als Anweisung direkt vor dem Dispose — bei den
Helfern mit `try { display.dispose(); } catch {…}` vor dem `try`, nicht darin. Das `afterEach`
wird `async` und ruft `await disposeDisplay(display);`.

| Datei | Helfer | `display.dispose()` | Aufruf im `afterEach` |
| --- | --- | --- | --- |
| `sprites-rotation.test.js` | `:24` sync | `:27` im `try` | `:75` |
| `map2d-placement.test.js` | `:32` sync | `:35` im `try` | `:86` |
| `map2d-visibility-helpers.test.js` | `:35` sync | `:38` im `try` | `:132` |
| `map2d-tile-upload.test.js` | `:37` sync | `:40` im `try` | `:90` |
| `vertex-objects-heap.test.js` | `:32` sync | `:35` im `try` | `:109` |
| `vertex-objects-dispose.test.js` | `:26` sync | `:29` im `try` | `:73` |
| `vertex-objects-buffers-data.test.js` | `:23` sync | `:26` im `try` | `:66` |
| `vertex-objects-gpu-upload.test.js` | `:31` sync | `:34` im `try` | `:117` |
| `display-resize.test.js` | `:24` async | `:31`, nach `await display.start()` | `:70`, schon `await` |
| `stage-pipeline.test.js` | `:21` async | `:28`, nach `await display.start()` | `:38`, schon `await` |
| `stage-renderer.test.js` | `:25` async | `:32`, nach `await display.start()` | `:49`, schon `await` |

Bei den drei async-Helfern steht der Aufruf **zwischen** `await display.start()` und
`display.dispose()` — davor gesetzt startet `start()` die Loop neu, und der `StageRenderer`
reicht wieder Arbeit ein (in der Probe so gescheitert).

Form für einen sync-Helfer, am Beispiel `map2d-tile-upload.test.js:37-44`:

```js
async function disposeDisplay(display) {
  if (!display) return;
  await stopAndDrain(display);
  try {
    display.dispose();
  } catch {
    // ignore — the fixture still has to leave the dom
  }
}
```

**Fünf Dateien mit Dispose direkt im `afterEach`.** Das `afterEach` wird `async`, der Aufruf
steht direkt vor dem Dispose:

| Datei | Stelle | danach |
| --- | --- | --- |
| `display-constructor.test.js` | `:52-55` | `if (display) { await stopAndDrain(display); display.dispose(); }` |
| `display-dispose.test.js` | `:35-38` | ebenso |
| `display-adopt-renderer.test.js` | `:21-27` | nur im Zweig `if (display)`: `await stopAndDrain(display);` vor `display.dispose();` — der Kommentar `:23` bleibt darüber, der Zweig `else if (renderer)` bleibt unverändert |
| `renderer-backend.test.js` | `:31-32` | `await stopAndDrain(display);` vor `display?.dispose();` |
| `hello-twopoint5d-canvas.test.js` | `:11-12` | `await stopAndDrain(display);` vor `display?.dispose();` |

Nicht anfassen: jedes `display.dispose()` im Körper eines `it(…)` — in
`display-dispose.test.js` (`:77`, `:88`, `:97`, `:110`, `:129`, `:141`, `:162`, `:179`, `:229`,
`:242`, `:249`, `:264`, `:319`, `:341`) und `display-adopt-renderer.test.js:65`. Dort ist
`dispose()` der Gegenstand des Tests.

### 6. Drei Kommentare

- `texture-store-on.test.js:32` →
  `/** Resolve with the first truthy value \`cb\` returns; reject when \`cb\` throws or when the deadline elapses first. */`
- `display-resize.test.js:467-470` (die vier Kommentarzeilen) →

  ```js
      // The host CSS changes after construction and before start(), so the first frame measures a
      // size the constructor never saw — frame 1 still emits OnDisplayResize exactly once, with that size.
  ```

- `vertex-objects-heap.test.js:73-75` (die drei Kommentarzeilen) →

  ```js
      // Firefox has neither performance.memory nor globalThis.gc and cannot take a single sample —
      // skip before beforeEach starts a Display, so this file starts no GPU device in a browser it
      // cannot measure.
  ```

- dazu `vertex-objects-heap.test.js:14-15`, weil der Bump die Messung verschiebt:
  `11.7 % of the first sample, measured on Chromium 151` → `11.8 % of the first sample, measured
  on Chromium 153`. Den Wert aus der eigenen `[heap]`-Zeile des Verify-Laufs nehmen, auf eine
  Nachkommastelle; weicht er mehr als 0,1 Punkte von 11,8 ab, den gemessenen schreiben und im
  Report nennen. »about 13 KB per round« bleibt (Probe: ≈ 13,5 KB je Runde bei 20 Runden je
  Probe). `MAX_HEAP_GROWTH` bleibt 0,15.

### 7. `docs/architecture.md`

- §4, `:121-123`: `Playwright` / `1.62.1, Chromium 151 runs on WebGL2` (Zeilenwechsel dazwischen) → `Playwright 1.63.0,
  Chromium 153 runs on WebGL2`, und `Firefox 153 on WebGPU` → `Firefox 155 on WebGPU`. Sonst
  bleibt der Absatz; der Umbruch folgt den Nachbarzeilen.
- §5, `:214-217`: den Satz »Playwright is held to `~1.62.1` in the root `package.json`, because
  the browser suite hangs under WebGPU on the Firefox 155 that Playwright 1.63 ships; Dependabot
  proposes the jump as a pull request of its own, and the group leaves `playwright` out for that
  reason.« ersetzen durch: »`playwright` stays out of the group as well: each of its updates
  brings the Chromium and Firefox the browser suite runs on, so it comes as a pull request of
  its own.«
- §6, nach der Aufzählung (nach dem Punkt, der mit »vertex object interfaces, descriptions.«
  endet), ein neuer Absatz:

  > A browser test that disposes a display in its teardown calls `stopAndDrain()` from
  > `packages/twopoint5d-testing/test/support/stopAndDrain.js` right before `dispose()`: it
  > stops the display and waits until the GPU has run everything submitted to it. On Firefox
  > 155 under WebGPU, destroying a device while submitted work is still in flight reports a
  > `GPUInternalError` on that device and ends `requestAnimationFrame` for the whole page, and
  > every later test in the file waits for a frame until it times out. A test whose subject is
  > `dispose()` itself calls it without the helper. Once Firefox takes such a device down
  > without stalling, the calls can go; `pnpm test:browser` without them shows when.

  Zeilenbreite wie die Nachbarabsätze (≈ 90 Zeichen).

### 8. Prüfen

- `pnpm lint` (bei Prettier-Abweichungen `pnpm format`, dann erneut `pnpm lint`),
  `pnpm typecheck`.
- Verify-Kommando aus dem Kopf. Im Log von `test:browser`: `[renderer-backend] WebGPU on
  Firefox/155.0`, `[renderer-backend] WebGL2 on Chrome/153.…`, `[heap] … growth` unter 15 %, kein
  `GPUInternalError`, kein `Timeout of`, kein `did not finish`; `twopoint5d-testing:test` läuft
  wirklich (kein `[local cache]`/`existing outputs match the cache` für diesen Task).
- Offen bis zum ersten Push (der Lauf pusht nicht): Playwright-Cache unter dem neuen Key
  `playwright-<os>-1.63.0`, die `[renderer-backend]`-Zeilen und die Browser-Suite unter
  `xvfb-run` im CI-Runner.

## Findings im Volltext

Keine Audit-Findings; die vier Einträge stammen aus »Offene Befunde« des Plans.

**Nebenbefund aus Paket 2 · medium · `packages/twopoint5d-testing/web-test-runner.config.js:30`**
(`'dom.webgpu.enabled': true`) — auf Firefox 155 (Playwright 1.63) hängen 13 Browser-Tests in
`map2d-tile-upload`, `map2d-visibility-helpers`, `stage-pipeline`, `stage-renderer` bis zum
Timeout, Log `GPUInternalError: Buffer with '' label has been destroyed`; Firefox 151/153 grün,
Firefox 155 mit WebGPU aus grün. Paket 2 hält Playwright deshalb mit Tilde auf 1.62; der Sprung
auf 1.63 braucht erst eine Suite, die dort grün ist (berührt TEST-021 und die Backend-Frage in
Paket 3).
Grenze aus dem Plan: liegt die Ursache des Hängers in Bibliothekscode unter
`packages/twopoint5d/src/` statt im Harness, ist das kein Fix dieses Laufs — Befund mit Beleg
ins Audit, Playwright bleibt gehalten, Paket endet mit dem Isolations-Ergebnis. (Einordnung:
siehe »Entscheidungen in Zug 0«.)

**Nebenbefund aus Paket 3 · info · `packages/twopoint5d-testing/test/texture-store-on.test.js:32`**
— der Doc-Kommentar von `waitUntil` sagt »Resolve when `cb` returns a truthy value or the
deadline elapses«, bei Ablauf der Frist rejected die Funktion aber (Zeile 46).

**Nebenbefund aus Paket 3b · info · `packages/twopoint5d-testing/test/display-resize.test.js:469`**
— der Kommentar »this used to trigger a double emit on frame 1« erzählt den Vorzustand statt
das Verhalten, das der Fall festhält (vorbestehend, 7de63c45e).

**Nebenbefund aus Paket 3b · info · `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:73-75`**
— Kommentar hängt an einer Maschine (»on this machine it gets no GL context«, Paket 3 maß
Firefox 153 mit WebGPU) und blickt zurück (»stays exactly where it was before this file
existed«) (vorbestehend, bf868e409).
