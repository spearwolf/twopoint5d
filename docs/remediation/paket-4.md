# Paket 4 — AdaptiveResolution: Lebenszyklus, Controller-Registrierung, Frame-Pfad

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-011 (low, gegenstandslos), RES-004 (low), API-002 (low), PERF-013 (info), API-027 (low), BUG-036 (low), PERF-014 (low), BUG-037 (info), CONS-004 (low), CONS-005 (info), TEST-006 (low)
- Ziel: Ein Display trägt höchstens einen aktiven Controller, der Controller lehnt ein disposed Display ab, rechnet im Frame-Pfad allokationsfrei und robust gegen nicht endliche Werte, und Doku wie Browsertest sagen, was er tatsächlich tut.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/display/AdaptiveResolution.ts`
  - `packages/twopoint5d/src/display/AdaptiveResolution.spec.ts`
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d/src/display/types.ts` (nur TSDoc der Option `adaptiveResolution`)
  - neu: `packages/twopoint5d/src/display/hot-path-allocations.adaptive-resolution.spec.ts`
  - `packages/twopoint5d-testing/test/display-adaptive-resolution.test.js`
  - `packages/twopoint5d/docs/display.md`
  - `packages/twopoint5d/CHANGELOG.md`

## Abgleich gegen den Code (Stand `fab33a53`)

| Finding | Urteil | Fundstelle jetzt |
| --- | --- | --- |
| BUG-011 | **gegenstandslos** — `#scaleBefore` ist nicht mehr `readonly` und wird in jedem `#takeOverScale()` gesetzt, also auch bei `enabled = true`; behoben in `328f7a8e`, vor dem ersten Commit dieses Laufs. Der verlangte Test steht: `gives back the scale the display had when it took over last` (Aus → Skala 0,6 → Ein → Aus gibt 0,6 zurück; Aus, Ein, Aus gibt 0,9 zurück). Nach der Entscheidung vom 2026-10-21 als erledigt verbucht, nichts umbauen. | `AdaptiveResolution.ts:141-143`, `:270-277`; `AdaptiveResolution.spec.ts:585-603` |
| RES-004 | unverändert — der Konstruktor prüft `display.isDisposed` nicht, es gibt kein `isDisposed`; nur die TSDoc von `enabled` sagt, was nach `dispose()` gilt | `AdaptiveResolution.ts:181-205`, `:207-227` |
| API-002 | verschoben — `Display#adaptiveResolution` liest weiter nur das Feld, das der Display-Konstruktor setzt; nach `dispose()` des Controllers liefert der Getter den toten Controller | `Display.ts:906-917`, `:1283-1289`, `:2130-2131` |
| PERF-013 | verschoben — zwei Closures je Messung, die `epoch` einfangen | `AdaptiveResolution.ts:354-375` |
| API-027 | unverändert — TSDoc »`undefined` until the first frame it judges«; `#method` wird vor dem Settle-Zweig gesetzt | `AdaptiveResolution.ts:214-219`, `:327` |
| BUG-036 | verschoben — `#takeOverScale()` hält jeden Wert von `display.resolutionScale` als Rückgabeskala fest; NaN, 0 und negative Werte landen auf der untersten Stufe, ∞ auf der obersten, und `enabled = false` / `dispose()` schreiben den Wert zurück | `AdaptiveResolution.ts:270-277` |
| PERF-014 | verschoben — `median()` kopiert mit `values.slice()` und sortiert mit Vergleichs-Closure | `AdaptiveResolution.ts:75-79`, `:387` |
| BUG-037 | verschoben — `#loopFrameNo` wird nur in `#rafIntervalMs()` fortgeschrieben, das nur in Pacing-Frames nach dem Settle läuft | `AdaptiveResolution.ts:424-432`, `:329-338` |
| CONS-004 | verschoben — die Doku sagt weiter »A frame held up by JavaScript takes the scale down as well, which helps nothing; `minScale` is how far that goes«, der Kommentar »An unsteady pace, one the CPU sets, stays down here« | `docs/display.md:237-238`; `AdaptiveResolution.ts:489-492` |
| CONS-005 | verschoben — »a few seconds at a lower resolution« | `docs/display.md:213-214` |
| TEST-006 | unverändert — 40 Frames, `method` in einer Menge, `scale` im Intervall; dazu: die Frames zeichnen nur `renderer.clear()`, und `WebGPUBackend#clear()` (three 0.186.1) setzt keine Timestamp-Query — unter WebGPU misst der Test also nie eine GPU-Zeit, auch wo der Adapter `timestamp-query` hat | `packages/twopoint5d-testing/test/display-adaptive-resolution.test.js:21-41` |

Triage: Die `Folgen:`-Zeilen der Pakete 1–3 sind leer. Von »Offene Befunde« teilt
keiner die Ursache dieses Pakets: `OPENING_FENCE` liegt in `scripts/checkDocSnippets/`,
der Rückblick in `CHANGELOG.md:71` ist ein Wortlaut im Eintrag zu `Display#pixelZoom`.
Beide bleiben in der Queue. **Zeile 71 des CHANGELOG nicht anfassen**, auch wenn dieses
Paket im selben Abschnitt schreibt.

## Entscheidungen dieses Pakets

1. **Registrierung in `AdaptiveResolution.ts`, nicht als Member von `Display`.** Ein
   modulweites `WeakMap<Display, AdaptiveResolution>` und eine `@internal` exportierte
   Funktion `adaptiveResolutionOf(display)`, die `public-api.ts` nicht nennt (dort wird
   einzeln exportiert, die Funktion bleibt intern; `public-api.spec.ts` bleibt grün).
   Grund: der Controller kann ein `#`-Feld von `Display` nicht schreiben; ein
   `@internal`-Member auf `Display` müsste jedes Display-Double der Specs nachbauen, die
   Map funktioniert mit dem eventisierten Double in `AdaptiveResolution.spec.ts` wie mit
   dem echten Display. `AdaptiveResolution.ts` importiert `Display` nur als Typ — kein
   Laufzeitzyklus.
2. **»Aktiv« heißt: nicht disposed.** Ein Controller mit `enabled = false` hält das
   Display weiter (er gibt beim Einschalten und bei `dispose()` die Skala zurück und
   würde mit einem zweiten kämpfen); ein zweiter wird abgelehnt, solange der erste nicht
   disposed ist, eingeschaltet oder nicht. `display.adaptiveResolution` nennt auch den
   abgeschalteten.
3. **Nach `dispose()`** (und sobald das Display disposed ist), nach
   `docs/resource-lifecycle.md` §3: `method` und `gpuTime` (Typ lässt `undefined` zu)
   antworten `undefined`; `scale` behält die Stufe, die der Controller zuletzt gesetzt
   hat — wie `Display#width`, `height` und `frameNo` ihren letzten Wert behalten, eine
   Zahl, die weiter stimmt, statt eines Wurfs beim Lesen in einem Teardown; `enabled`
   behält seinen Wert, ein Schreiben tut nichts (steht schon so da); `targetFps`,
   `minScale`, `maxScale`, `display` behalten ihre Werte. Neu `get isDisposed()`
   (Checkliste §6 Punkt 8).
4. **Eine Skala, die keine positive endliche Zahl ist, übernimmt der Controller als `1`**
   und gibt `1` zurück — nicht nur NaN und ∞, auch 0 und negative Werte. Grund: genau
   diese Werte zählt `Display#resolutionScale` laut seiner TSDoc als `1`
   (`Display.ts:832-845`); der Controller übernimmt also die Skala, mit der das Display
   tatsächlich zeichnet. Dieselbe Ursache wie das Finding, deshalb mitgenommen.
5. **CHANGELOG: den bestehenden `[Unreleased]`-Eintrag ergänzen, keinen
   Migrationshinweis.** `AdaptiveResolution` und die Option `adaptiveResolution` stehen
   unter `[Unreleased]` → `### Added` (`CHANGELOG.md:52`), sind also nie veröffentlicht
   worden; die Entscheidung vom 2026-10-21 (Breaking Change mit Migrationshinweis) zielt
   auf Verbraucher eines Releases, und hier gibt es keinen. Der Added-Eintrag muss
   beschreiben, was gilt; ein Migrationshinweis würde eine Migration von einem Stand
   beschreiben, den niemand hatte. Fixes an unveröffentlichtem Verhalten bekommen keinen
   `### Fixed`-Eintrag.
6. **Allokations-Spec als eigene Datei**
   `src/display/hot-path-allocations.adaptive-resolution.spec.ts` statt Erweiterung von
   `src/display/hot-path-allocations.spec.ts`. Grund: die Runde muss den Frame-Listener
   des Controllers direkt rufen, weil `emit()` von eventize je Aufruf ein Array für die
   Rest-Argumente baut (`emit(target, eventNames, ...args)`); den Listener fängt ein
   `vi.mock('@spearwolf/eventize', …)`, und dieser Modul-Mock soll die Resize-Messungen
   der bestehenden Datei nicht berühren. Das Muster `src/**/hot-path-allocations*.spec.ts`
   des Vitest-Projekts `allocations` erfasst die neue Datei.
7. **`#gpuTime` bleibt ein optionales Feld.** Der Median eines echten Fensters ist ein
   Bruch, dessen Speichern in ein Feld, das mit `undefined` beginnt, je Fenster (12
   gemessene Frames) eine Heap-Zahl kostet. Das nennt keines der Findings, eine
   NaN-Sentinel-Umstellung änderte den Feldvertrag für 16 B je 12 Frames; die Spec misst
   nach AGENTS.md mit ganzen Zahlen und sieht es nicht.
8. **Browsertest leitet die Methode unabhängig vom Controller ab**:
   `renderer.hasFeature('timestamp-query')` — unter WebGPU das Device-Feature, unter
   WebGL 2 bildet three den Namen auf `EXT_disjoint_timer_query_webgl2` ab
   (`GLFeatureName`, three 0.186.1). Der Controller liest dagegen
   `backend.trackTimestamp`/`backend.hasTimestamp`; benennt three diese Felder um, fällt
   der Test, statt still `frame-pacing` zu bestätigen. Der Fallback nach 60 Frames ohne
   Messwert ist dokumentiertes Verhalten und wird akzeptiert — mit einer
   Assertion-Message, die sagt, welcher Fall eintrat.
9. Modell stärkste Stufe, Effort `high`: elf Findings über drei Testflächen
   (Vitest-Spec, Allokations-Spec unter V8, echte Renderer unter drei Backends), und die
   öffentliche Oberfläche bewegt sich (`isDisposed`, zwei Ablehnungen im Konstruktor,
   Semantik von `Display#adaptiveResolution`).

## Vorgehen

Vorab: `AGENTS.md` lesen. Die Skills `using-eventize` (für den Modul-Mock und
`once`/`off`) und `updating-changelog` (für Schritt 9) laden. Je Korrektheitsfehler zuerst
den Regressionstest, rot laufen sehen, dann beheben; der rote Lauf gehört in den Report.
Das gilt auch für die Allokations-Spec unter gpu-time (Schritt 6): erst rot gegen die
Closures und die Kopie, dann umbauen.

### 1. BUG-011 — nichts ändern

Gegenstandslos, siehe Abgleich. `#scaleBefore` und den Test
`gives back the scale the display had when it took over last` stehen lassen.

### 2. Registrierung und Ablehnungen in `AdaptiveResolution.ts` (API-002, RES-004)

1. Über der Klasse, nach den Konstanten:

   ```ts
   // the controller that holds a display: one at a time, from its constructor to its dispose()
   // or the dispose of the display
   const controllers = new WeakMap<Display, AdaptiveResolution>();

   /**
    * The controller that holds `display`, `undefined` while none does — what
    * {@link Display.adaptiveResolution} answers.
    *
    * @internal
    */
   export function adaptiveResolutionOf(display: Display): AdaptiveResolution | undefined {
     return controllers.get(display);
   }
   ```

2. Am Anfang des Konstruktors, **vor** `this.display = display` und vor
   `#takeOverScale()` (das `display.resolutionScale` schreibt), in dieser Reihenfolge:

   ```ts
   // before anything is written: a controller that cannot hold the display never comes into
   // being, and the display keeps its scale and its listeners
   if (display.isDisposed) {
     throw new Error(
       'AdaptiveResolution: the display handed to the constructor has been disposed and sends no more ' +
         'render frames to judge. Build the controller while the display is alive, or hand it a live display.',
     );
   }
   if (controllers.has(display)) {
     throw new Error(
       'AdaptiveResolution: the display handed to the constructor is held by another controller, which ' +
         'sets its resolutionScale as well. dispose() that one first — it is display.adaptiveResolution — ' +
         'or keep it and set its enabled.',
     );
   }
   ```

3. Am Ende des Konstruktors, nach `this.#unsubscribe = [...]`:
   `controllers.set(display, this);`
4. In `#letGo()` nach dem Abmelden der Listener:
   `if (controllers.get(this.display) === this) controllers.delete(this.display);`
   `#letGo()` läuft bei `dispose()` und bei `OnDisplayDispose` — beide Wege melden ab.
5. Neuer Getter, neben `enabled`:

   ```ts
   /**
    * `true` after {@link AdaptiveResolution.dispose}, and once the display is disposed: the
    * controller lets go of it then.
    */
   get isDisposed(): boolean {
     return this.#disposed;
   }
   ```

6. TSDoc und Verhalten nach `dispose()` (Entscheidung 3):
   - `scale`: Satz ergänzen, dass der Wert nach `dispose()` und sobald das Display
     disposed ist die Stufe bleibt, die der Controller zuletzt gesetzt hat.
   - `method`: Getter `return this.#disposed ? undefined : this.#method;` — TSDoc siehe
     Schritt 4.
   - `gpuTime`: Getter `return this.#disposed ? undefined : this.#gpuTime;` — TSDoc
     ergänzen: »`undefined` … after dispose(), and once the display is disposed«.
   - `enabled`: TSDoc ergänzen, dass es dann seinen Wert behält (das Schreiben tut schon
     jetzt nichts).
   - Konstruktor bekommt eine TSDoc mit `@throws`, nach dem Muster von
     `FixedFrameLoop` (`FixedFrameLoop.ts:192-196`): wirft, wenn das Display disposed ist,
     und wenn ein anderer Controller es hält, der nicht disposed ist, ob eingeschaltet
     oder nicht; die Meldung nennt Klasse und Zustand, kein Controller entsteht, das
     Display behält Skala und Listener.
   - Klassen-TSDoc, letzter Absatz (`AdaptiveResolution.ts:126-127`): ein Display trägt
     einen Controller zugleich; `new AdaptiveResolution(display)` wirft auf einem Display,
     das ein anderer hält, und auf einem disposed Display;
     {@link Display.adaptiveResolution} nennt den Controller, der es hält; nach `dispose()`
     behalten Optionen, `display` und `scale` ihre Werte, `method` und `gpuTime` antworten
     `undefined`, `isDisposed` antwortet `true`.

### 3. `Display.ts` liest die Registrierung (API-002)

1. Import (`Display.ts:24`): `import {AdaptiveResolution, adaptiveResolutionOf} from './AdaptiveResolution.js';`
2. Feld `#adaptiveResolution` (`:906`) entfernen.
3. Getter (`:915-917`): `return this.#disposed ? undefined : adaptiveResolutionOf(this);`
   TSDoc (`:908-914`) neu, sinngemäß: »The controller that holds the display and sets
   {@link Display.resolutionScale} by the cost of a frame: the one the constructor built
   with the option `adaptiveResolution`, or one built with `new AdaptiveResolution(display)`.
   A display carries one at a time, enabled or not. `undefined` while none holds it, once
   that one is disposed, and once the display is disposed — the controller lets go of the
   display with it.«
4. Konstruktor (`:1283-1289`): `new AdaptiveResolution(this, {...})` ohne Zuweisung, mit
   Kommentar, dass der Controller sich selbst am Display registriert.
5. `dispose()` (`:2130-2131`): die Zeile `this.#adaptiveResolution = undefined;` samt
   Kommentar entfernen — der Controller meldet sich mit `OnDisplayDispose` ab, und der
   Getter antwortet nach dem Dispose ohnehin `undefined`.
6. Die Klassen-TSDoc, Punkt 4 (`:497-499`), bleibt wahr; nicht ändern.
7. `types.ts:81` (TSDoc der Option `adaptiveResolution`): »the controller is
   {@link Display.adaptiveResolution}« um »until it is disposed« ergänzen.

### 4. `method` sagt, wann es steht (API-027)

TSDoc von `get method()` (`AdaptiveResolution.ts:214-216`), sinngemäß: »How the controller
reads the cost of a frame, set in the first frame it runs in — the frames that settle after
a start count, a frame it holds still in, disabled or under a {@link Display.pixelZoom},
does not. `undefined` until then, after dispose(), and once the display is disposed.« Das
Verhalten bleibt (es ist das, was der Spec `is undefined until the first frame` und
`reads the GPU time where the backend tracks timestamps` schon festhalten); die TSDoc folgt
ihm. Der Kommentar in `docs/display.md:170` (»undefined before the first frame«) bleibt.

### 5. Übernahme einer Skala, die keine positive endliche Zahl ist (BUG-036)

`#takeOverScale()` (`AdaptiveResolution.ts:269-277`):

```ts
// The highest step at or below the scale the display has — one that is no positive finite
// number counts as 1, as it does for the display. A takeover starts afresh
#takeOverScale(): void {
  const scale = isPositiveFinite(this.display.resolutionScale) ? this.display.resolutionScale : 1;
  this.#scaleBefore = scale;
  // … Rest unverändert, `findIndex` auf `scale`
}
```

TSDoc von `enabled` und `dispose()`: wo sie »gives the display back the resolutionScale it
had when the controller took over last« sagen, ergänzen: `1` where that was no positive
finite number, which the display counts as `1`.

### 6. GPU-Messung ohne Closures und ohne Kopie (PERF-013, PERF-014)

1. Samples in ein festes Array statt `number[]` (`:151`):

   ```ts
   // the measurements of the window that runs, in an array that is kept, as the intervals of
   // frame-pacing are: a frame allocates nothing
   readonly #gpuSamples = new Float64Array(GPU_WINDOW);
   #gpuSampleCount = 0;
   ```

   `#settle()` setzt `#gpuSampleCount = 0` statt `#gpuSamples.length = 0`.
2. `median()` (`:75-79`) ersetzen durch eine Funktion auf dem vollen Fenster, die in
   place sortiert — die Samples eines beurteilten Fensters sind danach verbraucht:

   ```ts
   // the median of a full window, sorted in place: the samples of a judged window are done with.
   // A typed array sorts its numbers without a compare function
   const medianOfWindow = (values: Float64Array): number => {
     values.sort();
     const mid = values.length >> 1;
     return values.length % 2 === 1 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
   };
   ```

   `#judgeGpuWindow()`: `const time = medianOfWindow(this.#gpuSamples); this.#gpuSampleCount = 0;`
3. Zwei gebundene Handler als `readonly`-Felder statt der Closures in `#sampleGpuTime()`
   (`:354-375`), die Epoche in einem Feld:

   ```ts
   // the epoch the measurement in flight started in; one at a time is in flight
   #gpuResolvingEpoch = 0;

   readonly #onGpuTime = (ms: number): void => {
     this.#gpuResolving = false;
     // what holds #onRenderFrame still drops a measurement that comes in after it
     if (this.#disposed || !this.#enabled || isPositiveFinite(this.display.pixelZoom) ||
         this.#gpuResolvingEpoch !== this.#epoch || !isPositiveFinite(ms)) {
       return;
     }
     this.#gpuSilentFrames = 0;
     this.#gpuSamples[this.#gpuSampleCount] = ms;
     this.#gpuSampleCount += 1;
     if (this.#gpuSampleCount >= GPU_WINDOW) this.#judgeGpuWindow();
   };

   readonly #onGpuTimeFailed = (): void => {
     this.#gpuResolving = false;
   };
   ```

   In `#sampleGpuTime()`: `this.#gpuResolving = true; this.#gpuResolvingEpoch = this.#epoch;
   renderer.resolveTimestampsAsync('render').then(this.#onGpuTime, this.#onGpuTimeFailed);`
   Die Felder stehen in der Klasse vor ihrer ersten Verwendung im Konstruktor nicht im
   Weg (sie werden erst in Frames gebraucht); Reihenfolge der Deklaration wie die übrigen
   `readonly #… = () =>`-Felder (`#settle`, `#onRenderFrame`).

### 7. Frame-Nummer in jedem Frame lesen (BUG-037)

`#onRenderFrame` (`:324-339`) liest die Frame-Nummer der Frame-Loop in jedem Frame, in dem
der Controller läuft, **vor** dem Settle-Zweig:

```ts
readonly #onRenderFrame = ({rawDeltaTime}: DisplayEventProps): void => {
  if (!this.#enabled || isPositiveFinite(this.display.pixelZoom)) return;

  this.#method ??= this.#tracksGpuTime() ? 'gpu-time' : 'frame-pacing';

  // every frame the controller runs in reads the frame of the frame loop, the frames that settle
  // included: a renderFrame() of one's own right after them has nothing but its own delta
  const loop = this.display.frameLoop;
  const fromLoop = loop.frameNo !== this.#loopFrameNo;
  this.#loopFrameNo = loop.frameNo;

  if (this.#settleFrames > 0) {
    this.#settleFrames -= 1;
    return;
  }

  if (this.#method === 'gpu-time') {
    this.#sampleGpuTime();
  } else {
    this.#samplePacing(this.#rafIntervalMs(rawDeltaTime, fromLoop));
  }
};
```

`#rafIntervalMs(rawDeltaTime: number, fromLoop: boolean)` behält seinen Kommentar
(`:425-427`) und liest nur noch `fromLoop && loop.longestRafInterval > 0 ? … : rawDeltaTime * 1000`.
Nach einer Phase, in der der Controller stillhielt (abgeschaltet, `pixelZoom`), folgt
immer ein Settle (`enabled = true` ruft `#settle()`, der Zoomwechsel ist ein Resize), in
dem der Zähler wieder nachzieht — kein weiterer Fall nötig.

Misst die Allokations-Spec aus Schritt 10 unter frame-pacing ≥ 1 B je Frame, liegt das an
einer Gleitkommazahl, die V8 an einem nicht inlinten Aufruf boxt (Rückgabe von
`#rafIntervalMs`, Argument von `#samplePacing`): dann das Intervall in ein Feld
`#pacingRafMs = 0` schreiben (ein Double-Feld wird in place überschrieben) und
`#samplePacing()` ohne Argument daraus lesen lassen. Nur dann; ist die Spec grün, bleibt
die Signatur wie oben.

### 8. Doku zur Last und zur Dauer der Probe (CONS-004, CONS-005)

1. `docs/display.md:237-238` — der Punkt »`frame-pacing` cannot tell the GPU from the CPU«
   sagt künftig beide Fälle: Eine Last des JavaScript nimmt die Skala ebenfalls herunter,
   was nichts hilft. Hält das JavaScript jeden Frame auf dasselbe langsamere Tempo, bringt
   der Abstieg bis `minScale` die Frames nicht früher, und der Controller geht zurück wie
   oben beschrieben (Abstieg, Rückkehr, Messung gegen das gefundene Tempo). Kommt und geht
   die Last, kommen die Frames in keinem gleichmäßigen Tempo, und die Skala bleibt unten
   — `minScale` ist, wie weit das geht —, bis saubere Frames die Versuche nach oben
   (alle 180 sauberen Frames einer) sie zurückholen.
2. Kommentar `AdaptiveResolution.ts:489-492` gleichsinnig: ein Tempo ohne Gleichmaß — eine
   Last, die kommt und geht — bleibt unten, `minScale` ist, wie weit das geht; eine
   gleichmäßige Last des CPU sieht aus wie der 30-Hz-Schirm und geht ebenfalls zurück.
   Der Klassen-TSDoc (`:103-115`) sagt »It cannot tell the GPU from the CPU« — dort einen
   Halbsatz ergänzen, dass eine gleichmäßige CPU-Last wie ein 30-Hz-Schirm zurückführt und
   eine sprunghafte unten bleibt.
3. `docs/display.md:213-214` — statt »a few seconds at a lower resolution« die Dauer
   beziffern: mit den voreingestellten Skalen vier Stufen zu je 60 Frames — 30, die sich
   setzen, und ein Fenster von 30 —, 240 Frames bei niedrigerer Auflösung, acht Sekunden
   bei 30 Frames pro Sekunde. Die Klassen-TSDoc (`:113`, »It takes that one descent, and
   the return, to find out«) bekommt dieselbe Zahl.
4. Die Zahl 240 hält ein Spec fest (Schritt 10, `measures against the pace …`). Ergibt der
   Spec eine andere Zahl, gilt die gemessene: sie kommt in Doku und TSDoc, und der Report
   sagt, warum die Rechnung oben nicht stimmte.
5. `docs/display.md:240-243` (Punkt zu `enabled`/`dispose()`): ergänzen, dass ein Display
   einen Controller zugleich trägt — `new AdaptiveResolution(display)` wirft, solange ein
   anderer es hält, eingeschaltet oder nicht, und auf einem disposed Display —, dass
   `display.adaptiveResolution` den Controller nennt, der es hält (den der Option oder
   einen eigenen) und `undefined` antwortet, sobald dieser oder das Display disposed ist,
   und dass `adaptive.isDisposed` das sagt. Eine Skala, die keine positive endliche Zahl
   ist, übernimmt der Controller als `1` — ein Halbsatz genügt.
6. Codeblock `docs/display.md:247-256` (`ts check`): nach `const adaptive = …` eine Zeile
   `display.adaptiveResolution; // adaptive: the controller that holds the display`.
   Der Block bleibt eigenständig und typprüfbar.

### 9. CHANGELOG (Entscheidung 5)

`packages/twopoint5d/CHANGELOG.md:52`, Eintrag unter `[Unreleased]` → `### Added`: den Satz
»`Display#adaptiveResolution` is the controller the display built, and `undefined` once the
display is disposed.« ersetzen durch einen, der sagt: `Display#adaptiveResolution` is the
controller that holds the display — the one the option built, or one of
`new AdaptiveResolution(display)` —, and `undefined` once that one or the display is
disposed; a display carries one controller at a time, and the constructor throws on a
display another one holds, enabled or not, and on a disposed display;
`AdaptiveResolution#isDisposed`. Den Rest des Eintrags nur ändern, wo er jetzt nicht mehr
stimmt. Kein `### Migration Guide`-Eintrag, kein `### Fixed`-Eintrag. Zeile 71 bleibt.

### 10. Specs

`AdaptiveResolution.spec.ts` — das Double `makeDisplay()` (`:42-121`) bekommt
`isDisposed: false` als Feld (es hält sich an den Vertrag eines Displays). Neu bzw.
erweitert:

- `describe('options')`:
  `it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])('takes over a resolutionScale of %s as 1, and gives 1 back', …)`
  — Double mit `resolutionScale: value`, `new AdaptiveResolution(display, {maxScale: 1.5})`
  (so ist auch ∞ vor dem Fix rot: es landete auf 1,5): `adaptive.scale` und
  `display.resolutionScale` sind `1`; nach `adaptive.enabled = false` ist
  `display.resolutionScale` `1`.
- `describe('method')`:
  - `it('is set in the first frame, while the frames after the start settle', …)` — mit
    Timestamps nach einem Frame `'gpu-time'` und `resolveTimestampsAsync` nicht gerufen,
    ohne nach einem Frame `'frame-pacing'`.
  - `it('stays undefined through the frames it holds still in', …)` — `pixelZoom = 2`,
    fünf Frames: `undefined`; auf einem zweiten Double `enabled = false`, fünf Frames:
    `undefined`.
- `describe('frame-pacing')`:
  - `it('reads the pace of a renderFrame() of its own right after a settle from its rawDeltaTime', …)` —
    vor dem Fix rot:

    ```ts
    const {display, frame, frames} = makeDisplay();
    const adaptive = new AdaptiveResolution(display);
    await frames(SETTLE + 30);
    emit(display, OnDisplayRestart, {});
    await frames(SETTLE - 1);
    // the last frame of the settle: late, and it counts for nothing
    await frame({deltaMs: 40, rafMs: 40});
    // the first frame judged: a renderFrame() of one's own, on time
    await frame({fromLoop: false});
    await frames(27);
    await frames(2, {deltaMs: 40});

    expect(adaptive.scale, 'two late frames of 30').toBe(1);
    ```

    (Vor dem Fix liest der eigene Frame die 40 ms des letzten Settle-Frames, das Fenster
    zählt drei späte Frames und geht auf 0,875.)
  - `descendAndReturn()` (`:134-147`) zählt zusätzlich die Frames, nach denen die Skala
    unter 1 lag, und gibt sie als `framesBelow` zurück; in
    `measures against the pace the page reaches where fewer pixels bring the frames no sooner`
    dazu `expect(framesBelow, 'the frames at a lower resolution').toBe(240);`
- `describe('holding still and letting go')`:
  - `it('refuses a display that is disposed, and leaves its scale and its listeners as they are', …)` —
    Double mit `resolutionScale: 0.8`, dann `display.isDisposed = true` (Cast wie im
    Double üblich); `toThrow('AdaptiveResolution: the display handed to the constructor has been disposed')`;
    `display.resolutionScale` bleibt `0.8`; `getSubscriptionCount(display)` ist `0`
    (aus `@spearwolf/eventize`, wie `Display.spec.ts` es importiert).
  - `it('refuses a second controller on a display another one holds, enabled or not', …)` —
    `toThrow('is held by another controller')`, einmal mit dem ersten eingeschaltet,
    einmal nach `first.enabled = false`; der erste arbeitet weiter (z. B. nach
    `first.enabled = true` und `SETTLE + 12` Frames bei 15 ms steht `display.resolutionScale` auf `0.875`).
  - `it('takes a display whose controller has been disposed', …)` — `first.dispose()`,
    dann baut `new AdaptiveResolution(display)` ohne Fehler, und nur der zweite bewegt die
    Skala.
  - `it('answers isDisposed: false until dispose(), and true after it and once the display is disposed', …)` —
    auf einem zweiten Double `emit(display, OnDisplayDispose, display)` (vorher
    `display.isDisposed = true`, wie ein echtes Display es vor dem Event setzt).
  - `it('answers undefined for method and gpuTime after dispose(), and keeps the scale it set last', …)` —
    `gpu.ms = 15`, `SETTLE + 12` Frames: `scale` 0,875, `gpuTime` 15, `method` `'gpu-time'`;
    nach `dispose()`: `method` und `gpuTime` `undefined`, `scale` 0,875.
  - Im bestehenden `lets go of a display that is disposed` (`:621-630`) vor dem `emit`
    `display.isDisposed = true` setzen und am Ende `expect(adaptive.isDisposed).toBe(true)`.

`Display.spec.ts`, `describe('adaptiveResolution')` (`:2109ff`, mit `makeMeasuringDisplay()`):

- `it('answers a controller built with new AdaptiveResolution(display), and undefined after its dispose()', …)`
- `it('refuses a second controller beside the one the option built, and takes one after its dispose()', …)` —
  `display.adaptiveResolution` ist danach der neue.
- `it('refuses a controller on a display that is disposed', …)`
- Der bestehende Test `lets go of the controller it built with dispose(): …` bleibt grün
  und unverändert.

Neu `src/display/hot-path-allocations.adaptive-resolution.spec.ts` (Entscheidung 6), nach
dem Muster von `src/display/hot-path-allocations.spec.ts`: `measureSettledBytes()` aus
`src/testing/`, `BYTES_PER_CALL_LIMIT = 1`, `CALLS = 1000`. Skizze, nicht wörtlich:

```ts
// the listener of OnDisplayRenderFrame the controller subscribes, caught as it subscribes: a round
// calls it directly, because emit() builds an array for the arguments of every event
const frameListeners = vi.hoisted(() => [] as ((props: DisplayEventProps) => void)[]);
vi.mock('@spearwolf/eventize', async (importOriginal) => {
  const eventize = await importOriginal<typeof import('@spearwolf/eventize')>();
  const {OnDisplayRenderFrame} = await import('../events.js');
  return {
    ...eventize,
    on: (...args: unknown[]) => {
      if (args[1] === OnDisplayRenderFrame) frameListeners.push(args.at(-1) as (props: DisplayEventProps) => void);
      return (eventize.on as (...args: unknown[]) => UnsubscribeFunc)(...args);
    },
  };
});

// a whole number: a round hands its calls no fraction it works out (AGENTS.md)
const GPU_MS = 10;
// answers synchronously, so the measurement and the window it fills fall inside the round
const measurement = {then: (onFulfilled: (ms: number) => void) => onFulfilled(GPU_MS)};

const makeRound = (timestamps: boolean) => {
  const frameLoop = {frameNo: 0, longestRafInterval: 1000 / 60};
  const display = eventize({
    renderer: {backend: {trackTimestamp: timestamps, hasTimestamp: timestamps}, resolveTimestampsAsync: () => measurement},
    resolutionScale: 1, pixelZoom: 0, isDisposed: false, frameLoop, pixelRatioAt: () => 1,
  }) as unknown as Display;
  const adaptive = new AdaptiveResolution(display);
  const onFrame = frameListeners.at(-1)!;
  const props = {rawDeltaTime: 1 / 60} as DisplayEventProps;
  const round = () => {
    for (let i = 0; i < CALLS; i++) {
      frameLoop.frameNo += 1;
      onFrame(props);
    }
  };
  return {adaptive, round};
};
```

- `test('a frame under gpu-time allocates nothing, the frames that judge a window included', …)` —
  `bytesPerCall < BYTES_PER_CALL_LIMIT`; danach `adaptive.method` `'gpu-time'`,
  `adaptive.gpuTime` `10` (ein Fenster wurde beurteilt), `adaptive.scale` `1` (10 ms
  liegen unter dem Budget von 13,3 ms, und über `maxScale` geht nichts). **Vor dem Umbau
  aus Schritt 6 rot laufen lassen** (Closures je Messung, Kopie je Fenster).
- `test('a frame under frame-pacing allocates nothing, the frames that judge a window included', …)` —
  `bytesPerCall < BYTES_PER_CALL_LIMIT`; `adaptive.method` `'frame-pacing'`,
  `adaptive.scale` `1` (saubere Frames, die Versuche nach oben finden über `maxScale`
  keine Stufe). Siehe die Bedingung am Ende von Schritt 7.

Läuft mit `pnpm test:allocations` und mit `pnpm test`, nicht mit `pnpm test:coverage`.

### 11. Browsertest (TEST-006)

`packages/twopoint5d-testing/test/display-adaptive-resolution.test.js` neu schreiben,
Rahmen (Timeout 20 s, `afterEach` mit `disposeDisplay`, `makeContainer`) bleibt. Jeder Frame
zeichnet eine Szene mit `renderer.render(scene, camera)` — `new Scene()` und `makeCamera()`
aus `test/helpers/fixtures.js`, einmal gebaut — statt `renderer.clear()`: nur ein
Render-Pass trägt die Timestamp-Query (Abgleich). Warten nur über `await display.nextFrame()`
in Schleifen mit Bedingung und Obergrenze, keine feste Frame-Zahl als Beleg.

1. `it('picks in its first frame the method the backend measures with, and has a GPU time once a window is through or reads the frame pacing', …)`:
   - `display = new Display(host, {adaptiveResolution: true})`; vor `start()`
     `renderer.resolveTimestampsAsync` mit einem Zähler umhüllen (gebundenes Original
     rufen, Ergebnis durchreichen).
   - `await display.start(); await display.nextFrame();` dann
     `const expected = display.renderer.hasFeature('timestamp-query') ? 'gpu-time' : 'frame-pacing';`
     und `expect(adaptive.method, 'the method of the first frame').to.equal(expected)`.
   - Bis 30 Frames ab dem Start: Zähler `0` (die Frames, die sich setzen, messen nicht).
   - Dann höchstens 300 Frames, bis bei `gpu-time` `adaptive.gpuTime !== undefined` oder
     `adaptive.method === 'frame-pacing'` (Fallback); bei `frame-pacing` 90 Frames.
   - Unter `gpu-time`: entweder `adaptive.gpuTime` ist eine positive endliche Zahl und der
     Zähler ≥ 12, oder die Methode ist auf `'frame-pacing'` gefallen und `gpuTime`
     `undefined` — die Assertion-Message nennt den eingetretenen Fall (z. B.
     `'the renderer measured nothing for 60 frames: frame-pacing'`).
   - Unter `frame-pacing`: Zähler `0`, `gpuTime` `undefined`.
   - In beiden Fällen: `adaptive.scale` in `[minScale, maxScale]`,
     `display.resolutionScale === adaptive.scale`.
2. `it('draws the scale it sets into the drawing buffer, and gives the display its scale back when disabled', …)`:
   - `expect(window.devicePixelRatio, 'the pages of the browser tests run at a ratio of 1').to.equal(1)` —
     bei Ratio 1 sind beide Ratios exakt, und ein Launcher mit anderer Ratio scheitert hier
     mit klarer Meldung statt an einer Breite.
   - `display = new Display(host, {adaptiveResolution: {minScale: 0.5, maxScale: 0.5}})`
     (eine Stufe: der Controller setzt 0,5 bei der Übernahme und bleibt dort);
     `await display.start(); await display.nextFrame();` →
     `display.canvas.width` ist `160` (320 CSS-Pixel × 0,5).
   - `adaptive.enabled = false; await display.nextFrame();` → `display.resolutionScale`
     `1`, `display.canvas.width` `320`.
3. `it('lets go of the display with it', …)` — die bisherigen Zeilen 37–40:
   nach `display.dispose()` ist `display.adaptiveResolution` `undefined`,
   `adaptive.isDisposed` `true`, `adaptive.enabled = false` ändert nichts.

## Verify

`pnpm run ci` — das Gate: clean, lint, build, typecheck (inklusive der `ts check`-Blöcke in
`docs/display.md`), checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage,
test:allocations, test:browser. Während der Arbeit genügen
`pnpm nx test twopoint5d -- src/display/AdaptiveResolution.spec.ts`,
`pnpm nx test twopoint5d -- src/display/Display.spec.ts`, `pnpm test:allocations` und
`pnpm test:browser`.

## Commit

`fix(display): have a display carry one adaptive resolution controller at a time, refuse a disposed display and answer isDisposed, take over a scale that is no positive finite number as 1, judge GPU time and frame pacing without allocating, read the pace of a frame of one's own after a settle from its own delta, and have the display guide and the browser test say what the controller does`

## Verlauf

- 2026-10-22 Zug 0: Detailplan steht · BUG-011 gegenstandslos (behoben in `328f7a8e`,
  `AdaptiveResolution.ts:141-143`/`:270-277`, Spec `AdaptiveResolution.spec.ts:585`) ·
  RES-004, API-027 unverändert · API-002 nach `Display.ts:906-917` · PERF-013 nach
  `AdaptiveResolution.ts:354-375` · BUG-036 nach `:270-277` · PERF-014 nach `:75-79` ·
  BUG-037 nach `:424-432` · CONS-004 nach `docs/display.md:237-238` und
  `AdaptiveResolution.ts:489-492` · CONS-005 nach `docs/display.md:213-214` · TEST-006
  unverändert, dazu: `renderer.clear()` misst unter WebGPU nichts · Folgen der Pakete 1–3:
  keine · Offene Befunde: keiner mit gemeinsamer Ursache, beide bleiben in der Queue ·
  Restplan unverändert (kein offenes Paket berührt `src/display/`)
- 2026-10-22 Zug 1: Implementierer beauftragt · opus (stärkste Stufe), Effort high · Brief `paket-4.impl-0.brief.md`, Report `paket-4.impl-0.json` im Arbeitsverzeichnis
- 2026-10-22 Zug 2: Report FERTIG · geändert `AdaptiveResolution.ts`, `AdaptiveResolution.spec.ts`, `Display.ts`, `Display.spec.ts`, `types.ts`, `display.md`, `CHANGELOG.md`, `display-adaptive-resolution.test.js`, neu `hot-path-allocations.adaptive-resolution.spec.ts` · rote Läufe belegt (Konstruktor/isDisposed 10 rot, Display 3 rot, Skala-Übernahme 4 rot, renderFrame nach Settle 1 rot, Allokationen 241,38 B und 16,02 B) · Bedingung Schritt 7 trat ein → Feld `#pacingRafMs`, `#readRafInterval()` · 240 Frames bestätigt · Arbeitsbaum schmutzig · Verify läuft (`paket-4.verify.log`)
- 2026-10-22 Zug 2 (Verify): `pnpm run ci` exit=0 · `paket-4.verify.log`
- 2026-10-22 Zug 3: Reviewer opus/high · alle Findings erfüllt, BUG-011 gegenstandslos bestätigt · 0 kritisch, 0 wichtig, 3 klein · Browsertest frisch unter drei Launchern grün · Diff `paket-4.diff`, Report `paket-4.review-0.json`
- 2026-10-22 Zug 4: keine Runde (nur kleine Befunde)
- 2026-10-22 Zug 5: Commit `920bfdac` (Trailer `Remediation-Run: 2026-10-21`) · Commit-Message um »answer isDisposed« ergänzt (kleiner Befund 3) · kein zweiter Verify, keine Codeänderung seit dem Lauf aus Zug 2

## Urteil des Reviewers

| Finding | Urteil | Fundstelle (Stand `920bfdac`) |
| --- | --- | --- |
| BUG-011 | gegenstandslos, Urteil bestätigt — `#scaleBefore` beschreibbar, in jedem `#takeOverScale()` gesetzt; Test `gives back the scale the display had when it took over last` deckt beide Fälle | `AdaptiveResolution.ts:167`, `:253`, `:308`, `:346-348`; `AdaptiveResolution.spec.ts:653` |
| RES-004 | behoben — Konstruktor prüft `display.isDisposed` vor jedem Schreiben, `get isDisposed()`, TSDoc von `scale`/`method`/`gpuTime`/`enabled`, `@throws` am Konstruktor | `AdaptiveResolution.ts:225-230`, `:322`, `:280`, `:289`; Specs `AdaptiveResolution.spec.ts:703`, `:748`, `:761`, `:689`, `Display.spec.ts:2206` |
| API-002 | behoben — `WeakMap`-Registrierung, `adaptiveResolutionOf()` intern, zweiter Controller abgelehnt, `#letGo()` trägt aus, `Display#adaptiveResolution` liest die Map | `AdaptiveResolution.ts:91-101`, `:231-236`, `:262`, `:341`; `Display.ts:915-916`, `:1283-1290`; Specs `AdaptiveResolution.spec.ts:714`, `:734`, `Display.spec.ts:2185`, `:2194` |
| PERF-013 | behoben — `#onGpuTime`/`#onGpuTimeFailed` als `readonly`-Felder, Epoche in `#gpuResolvingEpoch`; Allokations-Spec gpu-time grün | `AdaptiveResolution.ts:436-438`, `:450-470` |
| API-027 | behoben — TSDoc von `method` beschreibt das Verhalten; Specs `:212`, `:227` | `AdaptiveResolution.ts:274-280` |
| BUG-036 | behoben (nach Entscheidung 4 erweitert) — NaN, ∞, 0, −1 werden als `1` übernommen und zurückgegeben | `AdaptiveResolution.ts:347`; Spec `:191ff` |
| PERF-014 | behoben — `Float64Array(GPU_WINDOW)`, `medianOfWindow()` sortiert in place ohne Vergleichsfunktion | `AdaptiveResolution.ts:77-82`, `:177`, `:473` |
| BUG-037 | behoben — Frame-Nummer in jedem laufenden Frame vor dem Settle-Zweig; `#pacingRafMs`, `#readRafInterval()`; Regressions-Spec `:553` | `AdaptiveResolution.ts:406-420`, `:212`, `:510` |
| CONS-004 | behoben — gleichmäßige und sprunghafte Last unterschieden in Doku, Kommentar, Klassen-TSDoc | `docs/display.md:239-244`; `AdaptiveResolution.ts:121-123`, `:576-578` |
| CONS-005 | behoben — 240 Frames, acht Sekunden bei 30 Hz, Spec hält die Zahl (`framesBelow`) | `docs/display.md:213-215`; `AdaptiveResolution.ts:130-132`; `AdaptiveResolution.spec.ts:499` |
| TEST-006 | behoben — echte Szene je Frame, Methode über `hasFeature('timestamp-query')`, Zähler auf `resolveTimestampsAsync` (Settle misst nichts, ≥ 12 Messungen unter gpu-time), Fallback mit sprechender Message, Drawing-Buffer-Breite 160/320, Loslassen samt `isDisposed` | `packages/twopoint5d-testing/test/display-adaptive-resolution.test.js:44-136` |

## Kleine Befunde (offen, keine Runde)

- `packages/twopoint5d/src/display/AdaptiveResolution.ts:124` — Absatz der Klassen-TSDoc nach dem Einschub nicht neu umbrochen, Zeile rund 150 Zeichen.
- `packages/twopoint5d/docs/display.md:244` — »one every 180 clean frames« nennt nur den Grundtakt; bei sprunghafter Last verdoppelt sich die Wartezeit bis 3600 Frames (Absatz bei `:207`) — »at first« oder ein Rückverweis wäre genauer.
- Commit-Message: `isDisposed` fehlte — übernommen (»answer isDisposed«); dass `method`/`gpuTime` nach `dispose()` `undefined` antworten, nennt sie nicht.

## Nebenbefund — Begründung des Urteils

`#takeOverScale()` (`AdaptiveResolution.ts:346-353`) setzt die Zähler `#pacingProbeWindows`, `#pacingCleanFrames`, `#gpuGoodWindows`, `#gpuStepUpWindows` nicht zurück. Vorbestehend: `git show 6500527f:packages/twopoint5d/src/display/AdaptiveResolution.ts:266-272` zeigt dieselben zwei Rücksetzungen. Andere Ursache als die Findings dieses Pakets (Lebenszyklus, Registrierung, Allokation), deshalb nicht mitgenommen. Scope-Regel »alles, jede Severity« greift → `→ Scope`, Severity geschätzt low.

## Findings im Volltext

**BUG-011 · low · packages/twopoint5d/src/display/AdaptiveResolution.ts:119** (weitere: `:153`, `:203`) — `#scaleBefore` beim erneuten Einschalten neu festhalten
`#scaleBefore` ist `readonly` und wird nur im Konstruktor gesetzt. TSDoc und docs/display.md versprechen, `enabled = false` gebe die Skala zurück, »die das Display hatte, als der Controller übernahm«, und `enabled = true` übernehme »von der Skala, die das Display dann hat«. Setzt der Nutzer zwischen Aus- und Einschalten eine eigene Skala (z. B. eine Qualitätsstufe 0,75), gibt das nächste `enabled = false` bzw. `dispose()` trotzdem den Konstruktorwert zurück und überschreibt die Nutzereinstellung.
Beleg: `readonly #scaleBefore: number;` … `this.display.resolutionScale = this.#scaleBefore;`
Empfehlung: `#scaleBefore` im `enabled = true`-Zweig vor `#takeOverScale()` auf `display.resolutionScale` setzen (Feld nicht mehr readonly) und einen Test für Aus → Skala ändern → Ein → Aus ergänzen.

**RES-004 · low · packages/twopoint5d/src/display/AdaptiveResolution.ts:139** (weitere: `:211`) — `AdaptiveResolution` auf einem disposed Display ablehnen und `isDisposed` anbieten
Der Konstruktor prüft `display.isDisposed` nicht. Auf einem bereits disposed Display hängt er drei Listener an ein Objekt, das `off(this)` schon hinter sich hat und nie wieder `OnDisplayDispose` sendet — die Listener (und damit der Controller samt Closure) bleiben am toten Display hängen, und der Controller sieht lebendig aus, tut aber nichts. docs/resource-lifecycle.md §3 verlangt ausdrücklich, dass ein Konstruktor eine disposed Instanz mit sprechendem Fehler ablehnt; `FixedFrameLoop` tut genau das. Außerdem fehlt dem Controller ein `isDisposed`, und kein Member dokumentiert sein Verhalten nach `dispose()` (Checkliste §6, Punkt 6).
Beleg: `constructor(display: Display, options?: AdaptiveResolutionOptions) { this.display = display; … on(display, OnDisplayRenderFrame, …)` — kein `isDisposed`-Check
Empfehlung: Wie in `FixedFrameLoop` am Anfang des Konstruktors werfen (`AdaptiveResolution: the display handed to the constructor has been disposed …`), `get isDisposed()` ergänzen und in der TSDoc von `scale`, `method`, `gpuTime` und `enabled` das Verhalten nach `dispose()` festhalten.

**API-002 · low · packages/twopoint5d/src/display/Display.ts:871** (weitere: `AdaptiveResolution.ts:139`) — Zweiten Controller auf demselben Display verhindern oder sichtbar machen
`Display#adaptiveResolution` kennt nur den Controller, den der Konstruktor gebaut hat. `new AdaptiveResolution(display)` ist öffentlich und wird in docs/display.md sogar gezeigt; nichts verhindert, dass zwei Controller (der aus der Option und ein eigener, oder zwei eigene) gleichzeitig `resolutionScale` schreiben und sich gegenseitig überstimmen — jeder hält den Resize des anderen für ein Settle-Signal. Nach `display.adaptiveResolution.dispose()` liefert der Getter weiter den toten Controller, und es gibt keinen Weg, einen neuen am Display zu registrieren.
Beleg: `get adaptiveResolution(): AdaptiveResolution | undefined { return this.#adaptiveResolution; }` — nur im Konstruktor gesetzt
Empfehlung: Den Controller am Display registrieren (z. B. ein internes Feld, das der `AdaptiveResolution`-Konstruktor setzt und `dispose()` wieder löscht), einen zweiten aktiven Controller mit Fehler ablehnen, und den Getter nach `dispose()` des Controllers `undefined` liefern lassen.

**PERF-013 · info · packages/twopoint5d/src/display/AdaptiveResolution.ts:277** — Promise-Callbacks der GPU-Messung nicht pro Sample neu allozieren
Jede Messung (etwa jeden zweiten bis dritten Frame) baut zwei neue Closures für `.then(onFulfilled, onRejected)`, die `epoch` einfangen; `#judgeGpuWindow()` kopiert pro Fenster das Sample-Array für den Median. Im Frame-Hot-Path ist das wenig, aber vermeidbar — der Rest des Moduls arbeitet ausdrücklich allokationsarm.
Beleg: `renderer.resolveTimestampsAsync('render').then((ms) => { … }, () => { … });`
Empfehlung: Die Epoche beim Start der Messung in ein Feld (`#resolvingEpoch`) schreiben und zwei gebundene Handler als `readonly`-Felder verwenden; für den Median ein wiederverwendetes Scratch-Array sortieren.

**API-027 · low · packages/twopoint5d/src/display/AdaptiveResolution.ts:211** — TSDoc von `AdaptiveResolution#method` an den ersten Frame anpassen
Der TSDoc von `get method()` sagt »`undefined` until the first frame it judges«; der Wert steht aber schon im ersten Frame, auch während des Settle. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Den TSDoc an das Verhalten anpassen (oder `method` bis zum ersten Urteil tatsächlich `undefined` lassen) und einen Spec für den ersten Frame ergänzen.

**BUG-036 · low · packages/twopoint5d/src/display/AdaptiveResolution.ts:266** — `#takeOverScale()` gegen ein nicht endliches `resolutionScale` absichern
`#takeOverScale()` legt ein `display.resolutionScale` von NaN oder ∞ auf die unterste Stufe und hält NaN als Rückgabeskala fest; beim Abschalten gibt der Controller dann NaN zurück. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Eine nicht endliche Skala beim Übernehmen auf 1 (oder die nächste gültige Stufe) abbilden und als Rückgabeskala nur endliche Werte festhalten; Spec mit NaN und ∞.

**PERF-014 · low · packages/twopoint5d/src/display/AdaptiveResolution.ts:74** — `median()` ohne `slice()` im Frame-Pfad rechnen
`median()` allokiert mit `values.slice()` je GPU-Fenster (12 gemessene Frames) ein Array im Frame-Pfad. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Einen vorab allozierten Scratch-Puffer fester Länge sortieren oder den Median per Auswahl ohne Kopie bestimmen; Allokations-Spec für das GPU-Fenster.

**BUG-037 · info · packages/twopoint5d/src/display/AdaptiveResolution.ts:419** — `#loopFrameNo` auch in eigenen `renderFrame()`-Aufrufen fortschreiben
`#loopFrameNo` wird nur in Pacing-Frames nach dem Settle fortgeschrieben; ein eigener `renderFrame()` als erster Frame nach einem Settle liest einmal ein veraltetes `longestRafInterval` (ein Sample, praktisch folgenlos). Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Den Zähler unabhängig vom Settle fortschreiben oder das Sample nach einem Settle verwerfen.

**CONS-004 · low · packages/twopoint5d/docs/display.md:205** (weitere: `AdaptiveResolution.ts:482`) — docs/display.md: gleichmäßige JS-Last senkt die Auflösung nicht dauerhaft
»A frame held up by JavaScript takes the scale down as well … `minScale` is how far that goes« stimmt nur für unregelmäßige CPU-Last; eine gleichmäßige JS-Last erkennt der Controller als Kadenz und kehrt zurück. Der Kommentar in `AdaptiveResolution.ts` sagt dasselbe. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Doku und Kommentar auf das Verhalten bei gleichmäßiger und bei sprunghafter Last präzisieren.

**CONS-005 · info · packages/twopoint5d/docs/display.md:189** — docs/display.md: Dauer der Probe bei 30 Hz beziffern
»a few seconds at a lower resolution«: bei 30 Hz sind es rund 270–300 Frames, etwa 9–10 s. Aufgefallen im Remediation-Lauf vom 2026-10-21.
Empfehlung: Die Dauer in Frames angeben oder für 60 und 30 Hz beziffern.

**TEST-006 · low · packages/twopoint5d-testing/test/display-adaptive-resolution.test.js:33** — Browsertest für AdaptiveResolution mit aussagekräftiger Assertion versehen
Der einzige Real-Renderer-Test der AdaptiveResolution prüft, dass method in {gpu-time, frame-pacing} liegt und scale zwischen minScale und maxScale — beides folgt aus dem Konstruktor und ist nach 40 Frames kaum falsifizierbar. Nicht geprüft: dass unter WebGPU/WebGL2 mit timestamp-query tatsächlich 'gpu-time' gewählt wird, wo das Backend es meldet, dass nach der SETTLE-Phase ein Messwert (gpuTime) vorliegt, oder dass ein Scale-Schritt einen echten Resize auslöst. Die 40 Frames liegen zudem knapp über den 30 Settle-Frames, es wird also fast nur das Einschwingen durchlaufen.
Beleg: `expect(['gpu-time', 'frame-pacing'], 'method').to.include(adaptive.method);`
Empfehlung: Pro Backend die erwartete Methode ableiten (Chromium WebGPU mit swiftshader: frame-pacing/gpu-time je nach Feature) oder zumindest auf definiertes Verhalten nach >60 Frames prüfen (method definiert, bei gpu-time gpuTime > 0 oder undefined mit Fallback); Test deterministisch halten über await display.nextFrame statt fester Zahl.
