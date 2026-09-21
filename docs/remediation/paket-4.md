# Paket 4 — Display-Abbau: Canvas-Übernahme nach Timeout und Test-Teardown nachziehen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — drei Folgen aus Paket 3 (Reviewer-klein) und ein
  vorbestehender Nebenbefund unter der Scope-Regel, alle unten im Volltext
- Folge von: 3
- Ziel: Die Canvas-Übernahme behandelt einen nach Timeout toten Kontext folgerichtig, die Doku
  sagt, wer den Kontext zurückholt, und der Heap-Test räumt sein Material ab.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d-testing/test/vertex-objects-heap.test.js`
  - `packages/twopoint5d/src/stage/README.md`
  - `packages/twopoint5d/docs/resource-lifecycle.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten, Schritte 1–8 in dieser Reihenfolge
- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
- Commit: `fix(display): let every display built on a canvas whose WebGL context did not come back in time try to restore it again, say in the docs that only a display brings that context back, and dispose the material in the heap test teardown`
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · Heap-Teardown unverändert, eine Zeile gewandert
    (`vertex-objects-heap.test.js:131`, Plan: `:130`), vorbestehend bestätigt
    (`0ba859d7`, Zeile 113) · Timeout-Folge unverändert (`Display.ts:191`), dieselbe
    Ursache zusätzlich in `#releaseRenderer()` `Display.ts:1120-1129` · Doku-Folge an 5
    Stellen plus `resource-lifecycle.md` §1, README-Pfad im Plan korrigiert
    (`src/stage/README.md`) · Testkommentar unverändert (`display-dispose.test.js:440-441`,
    Reviewer: `:442-443`) · »Offene Befunde«: 6 Einträge ohne gemeinsame Ursache, bleiben
    liegen; Feldname in einem Eintrag korrigiert · keine weiteren Folgen zu verteilen
  - 2026-09-21 Zug 1: Implementierer beauftragt, opus, effort medium, `paket-4.impl-0.json`
  - 2026-09-21 Zug 2: Report FERTIG · 6 Dateien geändert (`Display.ts`, `display-dispose.test.js`,
    `vertex-objects-heap.test.js`, `stage/README.md`, `resource-lifecycle.md`, `CHANGELOG.md`) ·
    roter Lauf `paket-4.impl.red.log` (neuer Fall rot auf Chromium, `TypeError … WebGLState._init`) ·
    Arbeitsbaum schmutzig · Verify `paket-4.verify.log` exit=0
  - 2026-09-21 Zug 3: Reviewer opus/medium · alle 4 Punkte behoben, 0 kritisch, 0 wichtig, 2 klein
    · Diff `paket-4.diff`, Report `paket-4.review-0.json`
  - 2026-09-21 Zug 4: keine Runde nötig (Offen: 0)
  - 2026-09-21 Zug 5: Commit 88019d0c · Verify `paket-4.verify.log` exit=0 (keine Änderung seither)

## Abgleich

Stand: `HEAD` = `1087d55d`, Arbeitsbaum sauber bis auf Plan und Paketdateien.

1. **Heap-Test ohne `material.dispose()`** — unverändert. `afterEach` steht jetzt in
   `vertex-objects-heap.test.js:128-136`, `material = undefined;` in `:131`. Vorbestehend:
   `git show 0ba859d7:packages/twopoint5d-testing/test/vertex-objects-heap.test.js`
   zeigt dieselbe Zeile als `:113`.
2. **Nach einem Timeout löscht `takeOverCanvas()` den Eintrag trotz totem Kontext** —
   unverändert. `Display.ts:183-192`; `:191` löscht den Eintrag nach `await release.restored`,
   ohne zu fragen, ob der Kontext zurück ist. Beim Abgleich an derselben Ursache eine zweite
   Stelle gefunden: `#releaseRenderer()` `Display.ts:1120-1129`. Der `Display`, der nach dem
   Timeout auf dem toten Kontext gestartet ist, setzt bei seinem `dispose()` einen eigenen
   Eintrag über den alten (`:1123`). Sein Init ist gescheitert oder lief auf einem verlorenen
   Kontext, also verliert seine Freigabe nichts (`lost == null`), und `:1128` löscht den
   Eintrag. Selbst wenn `takeOverCanvas()` den Eintrag stehen ließe, verlöre der Canvas die
   Information über den wiederherstellbaren Kontext spätestens hier. Die gemeinsame Ursache: der
   verlorene Kontext hängt am Eintrag einer Freigabe, lebt aber so lange wie der Canvas ihn
   verloren hat.
3. **Doku sagt nicht, dass nur ein `Display` den Kontext zurückholt** — unverändert. Stellen:
   - `packages/twopoint5d/src/stage/README.md:478-482` (der Plan nannte
     `src/display/stage/README.md`; die Datei liegt unter `src/stage/`)
   - `packages/twopoint5d/CHANGELOG.md:232`, im Abschnitt `[Unreleased]` (der reicht bis
     `:2089`)
   - TSDoc in `Display.ts`: Klasse `:217-220`, Konstruktor `:528-531`, `dispose()` `:1051-1057`
   - `packages/twopoint5d/docs/resource-lifecycle.md` sagt zum Canvas gar nichts; §1
     (`:12-13`) verspricht für alles Übergebene »not disposed, not cleared, not modified«,
     und der Canvas kommt unter WebGL mit verlorenem Kontext zurück
   - `packages/twopoint5d/docs/architecture.md:87-89` und `docs/architecture.md:264-267`
     behaupten nichts über den Kontext — keine Änderung
4. **Testkommentar nennt nur WebGL** — unverändert, `display-dispose.test.js:440-441` (der
   Reviewer zählte `:442-443`, die Zeilen um den Kommentar herum).

## Triage

- **Die drei Folgen aus Paket 3** gehören bereits diesem Paket (Drain-Runde 2). Einordnung:
  Symptome derselben Ursache wie der Canvas-Befund aus Paket 3 — die Übernahme eines Canvas
  ist dort nicht zu Ende gedacht worden. Paket 3 ist committet, also ist dieses Paket das eine
  Nachtragspaket.
- **Generation.** Die Kette läuft Paket 3 → Paket 4, das ist die zweite Generation. Die Zeile
  `Folge von: 1` unter Paket 3 gilt nur den kleinen Reviewer-Befunden aus Paket 1
  (Zeilenlänge in `docs/architecture.md`, Satzbau im Konstruktor-TSDoc, README-Ausnahme); aus
  denen ist hier nichts entstanden. Die drei Folgen stammen alle aus dem Canvas-Umbau, und der
  behob einen vorbestehenden Nebenbefund, keine Folge. Kein Halt nach der Generationsregel.
- **»Offene Befunde«** (6 Einträge): keiner teilt die Ursache dieses Pakets — drei betreffen
  TSDoc-Texte in `Display.ts` ohne Bezug zum Canvas, einer Abschnittsverweise in
  `stage/README.md`, einer Überlängen in `resource-lifecycle.md`. Dass dieses Paket zwei dieser
  Dateien anfasst, ist keine gemeinsame Ursache. Sie bleiben liegen, Urteile unverändert.
  Korrigiert: der Eintrag zu `Display.ts:194`/`:582` nannte das Feld `resizeThrottleMs`, es
  heißt `resizePollIntervalMs` (so schon in `0ba859d7:…/Display.ts:186`). Die Zeilennummern der
  `Display.ts`-Einträge stammen aus der Zeit vor Paket 3 und wandern mit diesem Paket noch
  einmal; die Einträge nennen ihre Symbole, daran findet der Abschluss sie.

## Entscheidungen in Zug 0

- **Zwei Maps statt einer.** `canvasReleases` hält künftig nur die laufende Freigabe
  (`Promise<void>`), eine neue `lostContexts` den verlorenen Kontext eines Canvas, solange er
  verloren ist. Verworfen: die Ein-Map-Variante, in der `takeOverCanvas()` den Eintrag stehen
  lässt und `#releaseRenderer()` den verlorenen Kontext des ersetzten Eintrags weiterreicht.
  Die trägt dieselben Fälle, verkettet aber jede Freigabe mit ihrer Vorgängerin und erklärt
  sich nur über diese Kette. Zwei Lebensdauern, zwei Maps: jede lässt sich in einem Satz
  beschreiben, und die zweite Fundstelle aus dem Abgleich verschwindet von selbst. Das ist kein
  anderer Weg als der freigegebene — der Kontext bleibt verloren, bis ein `Display` ihn
  zurückholt, der Konstruktor wartet auf die laufende Freigabe, höchstens 2000 ms auf den
  Kontext. Nur die Buchhaltung dahinter ist modulintern anders geschnitten; kein Export, keine
  Signatur ändert sich.
- **Folgerichtig heißt: jeder neue `Display` versucht es noch einmal.** Nach einem Timeout
  bleibt der Eintrag stehen, `restoring` wird geleert, und der nächste `Display` auf dem Canvas
  wartet wieder höchstens 2000 ms und warnt, falls es wieder nichts wird. Verworfen: den
  Canvas nach dem ersten Timeout als tot abschreiben und nur noch warnen — dann bliebe ein
  Kontext verloren, den der Browser später hergäbe. Die Wartezeit je `Display` bleibt
  begrenzt und kündigt sich an; ein stiller Start auf dem toten Kontext kommt nicht mehr vor.
- **Doku an allen Stellen, die »carries a new `Display`« sagen, plus `resource-lifecycle.md`
  §1.** §1 ist die bindende Regel für Übergebenes und verspricht »not modified«; die Ausnahme
  gehört dorthin, sonst widerspricht die Regeldatei dem Code. `architecture.md` (beide) bleiben,
  sie sagen nichts Falsches.
- **CHANGELOG: den bestehenden Eintrag `:232` im `[Unreleased]`-Abschnitt ergänzen**, keinen
  neuen anlegen. Die Wiederholung nach Timeout gehört zu demselben noch unveröffentlichten
  Fix; ein zweiter Eintrag würde einen Fix an einem Fix melden, den kein Nutzer je gesehen hat.
- **Heap-Test: `material.dispose()` vor `disposeDisplay()`.** Der Renderer, der die
  `RenderObject`s gebaut hat, steht dann noch; so räumt three sie auf dem Weg ab, auf dem es
  sie angelegt hat (Ressourcen vor dem Renderer). Der Teardown läuft nach der Messung, das
  Messergebnis ändert sich nicht.
- **Modell stärkste Stufe, Effort medium.** Der Kern ist eine Promise-Reihenfolge über zwei
  WeakMaps, an genau dem Code, für den Paket 3 drei Runden brauchte — im Zweifel eine Stufe
  höher. Der Detailplan gibt Code und Texte wörtlich vor, deshalb nicht `high`: der
  Implementierer soll umsetzen, nicht umbauen.

## Vorgehen

Allgemein: Code, Kommentare und Doku auf Englisch. Keine Finding-IDs, kein Rückblick auf
einen Vorzustand (»now«, »no longer«, »instead of«) — siehe »Konventionen« im Plan-Kopf.
Prettier `printWidth` 130 für Code; Markdown wird von Prettier nicht umbrochen, dort gilt der
Umbruch der Umgebung (siehe je Schritt). Logs der Einzelläufe in das Arbeitsverzeichnis aus
dem Brief, nicht ins Projekt.

Einzellauf der Browser-Tests (Chromium und Firefox), gegen die gebaute Bibliothek:

```bash
pnpm build:twopoint5d && pnpm --dir packages/twopoint5d-testing exec web-test-runner test/display-dispose.test.js
```

### 1. Regressionstest zuerst, rot sehen

In `packages/twopoint5d-testing/test/display-dispose.test.js` einen neuen Fall einfügen,
**direkt nach** `'a WebGL context that does not come back holds the next display on its canvas
up for a bounded time'` (`:469-509`) und **vor** `'a canvas that was handed in keeps its WebGL
context lost while no display follows'` (`:511`):

```js
  it('a WebGL context that did not come back in time gets another restore from the next display on its canvas', async function () {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    previous = new Display(canvas);
    await previous.start();

    // only a WebGL context is lost on release and has to be restored
    if (!previous.isWebGLBackend) this.skip();

    // the three.js typings leave gl off the backend
    const {gl} = /** @type {{gl?: WebGL2RenderingContext}} */ (previous.renderer.backend);
    // the same object for as long as the context lives, and the one the release keeps
    const extension = gl.getExtension('WEBGL_lose_context');
    // the browser keeps the context lost while the display after the first one waits for it
    extension.restoreContext = () => {};

    /** @type {string[]} */
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      previous.dispose();
      previous = new Display(canvas);
      // it starts on the lost context once its wait has run out, or fails to; either will do
      await previous.start().then(
        () => 'resolved',
        () => 'rejected',
      );

      // from here on the browser lets the context come back
      delete extension.restoreContext;

      previous.dispose();
      display = new Display(canvas);
      await display.start();
      await display.nextFrame();
    } finally {
      console.warn = realWarn;
    }

    await expectLiveBackend(display);
    expect(
      warnings.filter((w) => w.includes('new Display()')),
      'warnings of a display that waited for the context in vain',
    ).to.have.length(1);
  });
```

Der Fall überschreibt `previous` bewusst: der erste `Display` ist zu dem Zeitpunkt schon
disposed, `afterEach` räumt den zweiten (`previous`) und den dritten (`display`) ab.

Roter Lauf mit dem Einzelkommando oben, **vor** jeder Änderung an `Display.ts`, Ausgabe nach
`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0c5913dd-6536-4b42-94b0-31ab542295ab/scratchpad/paket-4.impl.red.log`. Erwartet: auf Chromium (WebGL2) rot — der dritte
`Display` baut sein Init ohne Wiederherstellung auf dem verlorenen Kontext, `start()` wird
verworfen oder `expectLiveBackend` scheitert an `gl.isContextLost() === true`. Auf Firefox
(WebGPU) übersprungen. Alle anderen Fälle grün. Ist er auf Chromium grün, anhalten und
`BLOCKIERT` mit dem Log melden — dann bewacht der Fall nicht, wofür er da ist.

### 2. `Display.ts`: Buchhaltung der Canvas-Übernahme auf zwei Maps

**a) `:71-98` ersetzen** — vom Kommentar `// The WebGL context a release has lost on a canvas
handed to a display, kept restorable.` bis einschließlich `const canvasReleases = new
WeakMap<HTMLCanvasElement, CanvasRelease>();`. Das Interface `CanvasRelease` entfällt ganz:

```ts
// The WebGL context a release has lost on a canvas handed to a display, kept restorable. The
// context stays lost until a display is built on the canvas: a live context that nobody draws
// to counts against the few the browser keeps alive, and it drops the oldest one — possibly
// that of a running display — once there are too many
interface LostContext {
  gl: WebGL2RenderingContext;
  extension: WEBGL_lose_context;
  // settles once the webglcontextlost event has had its default prevented; before that the
  // browser turns down a restoreContext()
  prevented: Promise<void>;
  // the restore a display built on the canvas has started, so a display built while it runs
  // waits for the same one; cleared once it has ended with the context still lost
  restoring?: Promise<void>;
}

// The release of a renderer runs on after dispose() has returned, and the canvas handed to
// that display is not free before the release is through: a renderer initialized on it in
// the meantime would share the WebGL context of the one being released and lose it with it.
// The entry settles once the release is through, never rejects, and goes with it. A WeakMap,
// like lostContexts below, so an entry does not hold on to a canvas its caller has let go
const canvasReleases = new WeakMap<HTMLCanvasElement, Promise<void>>();

// The context a release has lost on a canvas handed to a display, for as long as it stays
// lost: however long no display comes, and past a restore that ran out of time, so every
// display built on the canvas tries once more. The display that brings it back takes the
// entry out
const lostContexts = new WeakMap<HTMLCanvasElement, LostContext>();
```

`disposeKeepingContextRestorable()` (`:100-140`) und `restoreContext()` (`:142-179`) bleiben
unverändert; `disposeKeepingContextRestorable()` gibt weiter ein Objekt ohne `restoring`
zurück.

**b) `takeOverCanvas()` (`:181-192`) ersetzen**, Kommentar darüber eingeschlossen:

```ts
// What a display built on a canvas waits for before the init of its renderer starts: the release
// of the display on that canvas before it, while one runs, and the context a release has lost on
// the canvas coming back
async function takeOverCanvas(canvas: HTMLCanvasElement, release: Promise<void> | undefined): Promise<void> {
  await release;
  const lost = lostContexts.get(canvas);
  if (lost == null) return;

  lost.restoring ??= restoreContext(canvas, lost);
  const restoring = lost.restoring;
  await restoring;

  if (!lost.gl.isContextLost()) {
    // only this entry goes: one the release of a later display has made in the meantime stays
    if (lostContexts.get(canvas) === lost) lostContexts.delete(canvas);
  } else if (lost.restoring === restoring) {
    // the wait has run out and the entry stays, so the next display built on the canvas tries
    // the restore again
    lost.restoring = undefined;
  }
}
```

**c) Konstruktor `:625-634` ersetzen** (Kommentar und Zuweisung an `#waitForRenderer`):

```ts
    // Both construction paths end with a renderer and both have to wait for the same promise.
    // One assignment, so a path that gets added later cannot leave the field empty. A canvas whose
    // previous display is still releasing its renderer, or whose WebGL context a release has left
    // lost, is not free yet: the init starts once that release is through and the context is back,
    // or once the wait for the context has run out
    const renderer = this.renderer!;
    const previousRelease = canvasReleases.get(renderer.domElement);
    this.#waitForRenderer =
      previousRelease != null || lostContexts.has(renderer.domElement)
        ? takeOverCanvas(renderer.domElement, previousRelease).then(() => renderer.init())
        : renderer.init();
```

Keine lokale Konstante `canvas` einführen: `:638` deklariert `canvas` im selben Block.

**d) `#releaseRenderer()` `:1099-1130` ersetzen** — ab `const released: Promise<LostContext |
undefined> = …` bis zum Ende des `if (handBack) {…}`. Der Kommentarblock `:1093-1098` und der
Kopf der Methode (`:1084-1091`) bleiben stehen:

```ts
    const released: Promise<void> = this.#waitForRenderer
      .then(
        async () => {
          await drainSubmittedWork(renderer);
          if (!handBack) {
            renderer.dispose();
            return;
          }
          const lost = await disposeKeepingContextRestorable(renderer);
          // set before the release settles, so a display that waits for the release finds it
          if (lost != null) lostContexts.set(canvas, lost);
        },
        () => {
          // a failed init has built nothing that renderer.dispose() would release, and its
          // setAnimationLoop(null) would wait on the rejected init once more — a rejection that
          // nobody could catch
        },
      )
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Display#dispose(): releasing the renderer failed after dispose() returned', error);
      });

    if (handBack) {
      // set before dispose() returns, so a display built on the canvas in the same tick sees it
      canvasReleases.set(canvas, released);
      void released.then(() => {
        // only this entry goes: one a display after this one has made in the meantime stays
        if (canvasReleases.get(canvas) === released) canvasReleases.delete(canvas);
      });
    }
```

Verengt TypeScript `canvas` im Callback nicht auf `HTMLCanvasElement` (Fehler bei
`lostContexts.set`), vor `released` eine Konstante `const handedBack = handBack ? canvas :
undefined;` anlegen und im Callback `if (handedBack == null) { renderer.dispose(); return; }`
sowie `lostContexts.set(handedBack, lost)` schreiben. Kein `!`-Operator.

**e) Prüfen:** `grep -n "CanvasRelease\|\.restored\b\|release\.released" packages/twopoint5d/src/display/Display.ts`
findet nichts mehr.

### 3. `Display.ts`: TSDoc

**Klasse, `:218-220`** — die Sätze ab `A canvas handed to the constructor carries a new` bis
`it.` ersetzen durch (Umbruch wie die Nachbarzeilen, ~78 Zeichen):

```
 *    submitted to it. A canvas handed to the constructor carries a new
 *    display afterwards; one built on it while the release runs waits for
 *    it. Under WebGL only a display brings the context of that canvas
 *    back — see {@link Display.dispose}.
```

**Konstruktor, `:528-531`** ersetzen durch:

```
   * A canvas handed in here stays the caller's. If a display disposed before this one is still
   * releasing the renderer it had on that canvas, or left its WebGL context lost, the renderer of
   * this display starts its init once that release is through and the context is back, or once
   * the wait for the context has run out — see {@link Display.dispose}.
```

**`dispose()`, `:1051-1057`** ersetzen durch:

```
   * A canvas handed to the constructor goes back to the caller able to carry a new display.
   * Under the WebGL backend `renderer.dispose()` loses the context of that canvas, and a canvas
   * keeps its one WebGL context for good, so the release keeps that context restorable and
   * leaves it lost. Only a `Display` brings it back: a `WebGPURenderer` or a
   * `getContext('webgl2')` of your own on that canvas gets the lost context. The next `Display`
   * built on the same canvas — while the release runs or any time after — waits for the
   * release, restores the context and then starts the init of its renderer. A context the
   * browser has not brought back within two seconds ends the wait with a warning on the
   * console; it stays lost and restorable, and the next `Display` built on the canvas tries
   * again.
```

### 4. `display-dispose.test.js`: Kommentare

**`:440-441`** ersetzen durch:

```js
    // the release is through and the canvas has sat without a display for 100 ms. Under WebGL
    // only the display built now can bring the context back; under WebGPU there is nothing to
    // restore, and the case checks that the second display draws
```

**Kopfkommentar `:90-95`** — den Satz ab `The five cases after those follow a canvas that was
handed in:` bis `as long as no display follows.` ersetzen durch den folgenden Inhalt, umbrochen
wie der Block (~100 Zeichen):

```
The six cases after those follow a canvas that was handed in: it is the caller's, and after
the display on it has been disposed it carries the next one — built while the release runs,
built once the release is through, built after a dispose() inside the init, bounded in time
when the WebGL context does not come back, and with that context back once the display after
the one that waited in vain is built — while its WebGL context stays lost as long as no
display follows.
```

Die Reihenfolge im Satz folgt der Reihenfolge der Fälle in der Datei; der neue Fall aus
Schritt 1 ist der fünfte der sechs.

### 5. `packages/twopoint5d/src/stage/README.md:478-482`

An den Satz `… waits for the release, restores the context and then starts its renderer.`
anhängen, umbrochen wie die Liste (~92 Zeichen, zwei Leerzeichen Einzug):

```
  Only a `Display` restores it: a `WebGPURenderer` or a `getContext('webgl2')` of your own
  on that canvas gets the lost context.
```

### 6. `packages/twopoint5d/docs/resource-lifecycle.md` §1

Nach dem Absatz, der mit `in-house. An undocumented take-over is a bug.` endet (`:20`), einen
neuen Absatz einfügen (Leerzeile davor und danach):

```
A canvas handed to the `Display` constructor is not taken over, and it still comes back
changed under the WebGL backend: three gives up the one WebGL context of the canvas as
it releases the renderer, and the display leaves that context lost but restorable. Only
a `Display` built on the canvas afterwards brings it back; a `WebGPURenderer` or a
`getContext('webgl2')` of the caller's own on that canvas gets the lost context.
```

Keine neue Zeile länger als 88 Zeichen; prüfen mit
`awk 'NR>=21 && NR<=27 && length>88' packages/twopoint5d/docs/resource-lifecycle.md` (keine
Ausgabe). Die 11 bestehenden Überlängen der Datei gehören nicht zu diesem Paket.

### 7. `packages/twopoint5d/CHANGELOG.md:232`

Den bestehenden Eintrag im Abschnitt `[Unreleased]` ändern, keinen neuen anlegen. Der Eintrag
bleibt eine Zeile. Neuer Wortlaut:

```
- fix `Display#dispose()` for a canvas handed to the constructor: the canvas carries a new `Display` afterwards. Under the WebGL backend three loses the context of the canvas as it releases the renderer, and a canvas keeps its one WebGL context for good, so the release keeps that context restorable and leaves it lost until a `Display` is built on the canvas again; that display — built while the release is still running, as in a remount under React StrictMode, or any time later — restores the context and then initializes its renderer. Only a `Display` restores it: a `WebGPURenderer` or a `getContext('webgl2')` of your own on that canvas gets the lost context. A context that has not come back after two seconds ends the wait with a console warning and stays restorable, and the next `Display` built on the canvas tries again
```

### 8. `vertex-objects-heap.test.js`: Material im Teardown freigeben

`afterEach` (`:128-136`) so umstellen, dass das Material vor dem Display geht:

```js
  afterEach(() => {
    // three keeps a render object per rendered mesh on the material until the material is
    // disposed; it goes while the renderer that built them is still there
    material?.dispose();
    material = undefined;
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });
```

Kein Regressionstest: der Teardown läuft nach der Messung. Der Heap-Fall muss auf Chromium
grün bleiben (Firefox überspringt die Datei).

### Danach

Einzellauf wie oben (der Fall aus Schritt 1 grün auf Chromium, übersprungen auf Firefox, alle
anderen grün), Log nach `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0c5913dd-6536-4b42-94b0-31ab542295ab/scratchpad/paket-4.impl.green.log`. Dann das Verify-Kommando des
Pakets.

## Findings im Volltext

**Folge aus Paket 3 · klein · `packages/twopoint5d/src/display/Display.ts:183-192`** —
Nach einem Timeout geht der Eintrag verloren, der Kontext bleibt aber tot.
`takeOverCanvas` löscht den Eintrag auch dann, wenn `restoreContext` nur per Timeout endete und
der Kontext noch verloren ist. Ein dritter Display auf demselben Canvas versucht die
Wiederherstellung dann gar nicht mehr und startet stumm auf dem verlorenen Kontext. Das ist ein
Randfall, tragbar, aber so nirgends dokumentiert. (Reviewer Paket 3, Runde 1,
`paket-3.review-1.json`)
Ergänzt im Abgleich: dieselbe Ursache in `#releaseRenderer()` `:1120-1129` — die Freigabe des
Displays, der auf dem toten Kontext gestartet ist, ersetzt den Eintrag durch einen ohne
verlorenen Kontext und löscht ihn.

**Folge aus Paket 3 · klein · `packages/twopoint5d/src/stage/README.md:477-482`, CHANGELOG-Zeile
232** — Die Doku sagt »carries a new Display«, aber nicht, dass nur ein Display den Kontext
zurückholt. Der Kontext bleibt verloren, bis ein *`Display`* kommt. Wer den übergebenen Canvas
nach `dispose()` direkt mit einem eigenen `WebGPURenderer` oder `getContext('webgl2')`
weiterverwendet, bekommt einen verlorenen Kontext. Die Texte sagen durchgängig »carries a new
`Display`« und sind damit korrekt. Ein Halbsatz »only a `Display` restores it« würde die Falle
aber sichtbar machen. (Reviewer Paket 3, Runde 1)

**Folge aus Paket 3 · klein · `packages/twopoint5d-testing/test/display-dispose.test.js:442-443`**
— Der Kommentar im Fall spricht nur vom WebGL-Kontext (»only the display built now can bring its
WebGL context back«). Der Fall wird auf WebGPU aber nicht übersprungen und ist dort ohne jede
Wiederherstellung grün. Das stimmt schon, bewacht wird der Pfad aber nur auf Chromium bzw.
WebGL2. Der Fall aus `:408` verhält sich genauso, das ist also kein Rückschritt. Auch »for a few
tasks« ist etwas großzügig, denn gewartet wird ein einziger `setTimeout`-Task von 100 ms.
(Reviewer Paket 3, Runde 2, `paket-3.review-2.json`)

**Nebenbefund · low · `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:131`**
(Plan: `:130`) — `afterEach` setzt `material = undefined` ohne `material.dispose()`; die
`RenderObject`s und die Uniform-Gruppe in `info.memoryMap` bleiben bis dahin hängen.
Vorbestehend (`0ba859d7`, Zeile 113). Scope-Regel: Dispose-Pfad eines Browser-Tests der
vertex-objects → `→ Scope`, gleiche Ursache wie die Test-Teardowns rund um den Display-Abbau.

## Urteil des Reviewers

- Timeout-Folge, `takeOverCanvas()` — behoben, `packages/twopoint5d/src/display/Display.ts:183-200`
- Timeout-Folge, `#releaseRenderer()` — behoben, `Display.ts:1112-1143`
- Doku-Folge — behoben: `src/stage/README.md:482-483`, `CHANGELOG.md:232`, TSDoc `Display.ts:228-229`,
  `:539-540`, `:1064-1070`, `docs/resource-lifecycle.md:23-27`
- Testkommentar-Folge — behoben, `display-dispose.test.js:441-443` (Kopfkommentar `:90-96`)
- Heap-Teardown — behoben, `vertex-objects-heap.test.js:128-140`

Kleine Befunde:
- `Display.ts:66-68` — Kommentar über `CONTEXT_RESTORE_TIMEOUT_MS` vom Implementierer über den
  Detailplan hinaus umformuliert (»is not coming back for the display waiting for the canvas«);
  inhaltlich nötig, nichts zu beheben.
- `Display.ts:97`, `:183-200` — kommt der Kontext erst nach dem Timeout zurück, während der
  Display auf dem toten Kontext läuft, bleibt der `lostContexts`-Eintrag mit lebendem Kontext
  stehen; ein späterer Display nimmt ihn heraus. Harmlos, die Beschreibung der Map (»for as long
  as it stays lost«) stimmt in diesem Fenster nur ungefähr.

Nebenbefund (Implementierer), Urteil `→ Scope`: ein gescheitertes WebGL-Init hinterlässt den
`webglcontextlost`-Listener von three am übergebenen Canvas. Die Scope-Regel greift, weil es die
Freigabe der Ressourcen eines Renderers beim Abbau eines `Display` betrifft. Vorbestehend: jedes
gescheiterte Init auf einem Canvas mit verlorenem Kontext hinterlässt ihn, unabhängig von diesem
Lauf; im neuen Regressionstest sichtbar als eine `WebGL Device Lost`-Meldung beim Abbau des
dritten Displays.
