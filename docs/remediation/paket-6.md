# Paket 6 — display: Ein disposetes Display abweisen und die Ownership-Texte geraderücken

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: CONS-027 (low), CONS-040 (info), CONS-021 (low)
- Ziel: Eine FixedFrameLoop über einem toten Display entsteht gar nicht erst,
  statt lebendig auszusehen und nichts zu tun.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/FixedFrameLoop.ts`
  - `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts`
  - `packages/twopoint5d/src/display/Stylesheets.ts`
  - `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit:
  ```
  fix(display): let the fixed frame loop refuse a display that has been disposed

  A FixedFrameLoop built over a disposed Display subscribed to an emitter that
  never fires again: it reported isDisposed === false, never ticked and never
  disposed itself. The constructor turns such a display away now, the way
  VOBufferGeometry already turns away a disposed pool.

  Alongside it: Stylesheets.releaseRule() looks its three values up one after
  another, so each early return narrows exactly what the lines below it read,
  and the afterEach block of the adopt-renderer test says what it does — clean
  up whatever got as far as existing — instead of denying the take-over the
  file tests four cases further down.
  ```
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · CONS-027 unverändert, Fundstelle
    gewandert: der Konstruktor steht heute auf `FixedFrameLoop.ts:181-198`,
    `Display#isDisposed` auf `Display.ts:320` · CONS-040 unverändert auf
    `Stylesheets.ts:125` · CONS-021 unverändert auf
    `display-adopt-renderer.test.js:19-20` · keine offene `Folgen:`-Zeile in
    den Paketen 1–5 zu triagieren · keiner der 14 Einträge in »Offene Befunde«
    teilt die Ursache dieses Pakets, nichts hereingenommen · Restplan
    unverändert
  - 2026-09-20 Zug 1: Implementierer beauftragt — `claude -p`, Modell sonnet
    (mittlere Stufe), Effort medium, Brief
    `<arbeitsdir>/paket-6.impl-1.brief.txt`, Report
    `<arbeitsdir>/paket-6.impl-1.json`, Session
    `898981ac-ce9a-4657-a24c-ae22ff50f991`
  - 2026-09-20 Zug 2: Report `FERTIG` · geändert:
    `packages/twopoint5d/src/display/FixedFrameLoop.ts`,
    `FixedFrameLoop.spec.ts`, `Stylesheets.ts`,
    `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`,
    `packages/twopoint5d/CHANGELOG.md` — keine neue Datei · Arbeitsbaum jetzt
    schmutzig an diesen fünf Pfaden · roter Lauf vor dem Guard belegt
    (`AssertionError: expected [Function] to throw an error`, 1 failed |
    41 passed) · keine Nebenbefunde, keine Folgen, keine Abweichungen ·
    eigener Verify-Lauf `pnpm run ci` exit=0, alle elf Ziele grün, Log
    `<arbeitsdir>/paket-6.verify.log`
  - 2026-09-20 Zug 3: Reviewer (sonnet, Effort medium, Session
    `e59e6716-5f4b-488e-a208-20d092970687`) bestätigt alle drei Findings je mit
    Fundstelle, kein Befund `kritisch` oder `wichtig`, zwei `klein` ·
    Diff `<arbeitsdir>/paket-6.diff` (231 Zeilen, 5 Dateien), Report
    `<arbeitsdir>/paket-6.review-1.json`
  - 2026-09-20 Zug 4: keine Runde — nichts offen, was eine auslöst. Die zwei
    kleinen Befunde stehen unten und bleiben stehen
  - 2026-09-20 Zug 5: committet als `7675e843`, fünf Dateien, 59 Einfügungen,
    7 Löschungen · kein zweiter Verify-Lauf: zwischen dem Lauf aus Zug 2 und
    dem Commit hat niemand eine Datei angefasst · Arbeitsbaum danach sauber,
    nur die ungetrackten Lauf-Dateien

## Vorgehen

### 1. `FixedFrameLoop`: einen disposeten Display im Konstruktor abweisen

Datei `packages/twopoint5d/src/display/FixedFrameLoop.ts`, Konstruktor ab
Zeile 181. Der Guard steht **vor** `eventize(this)` — nach dem Muster, das
`VOBufferGeometry` und `InstancedVOBufferGeometry` mit ihrem Guard vor
`super()` bereits im Repository tragen: was nicht laufen kann, entsteht nicht.

```ts
  /**
   * @throws when the display handed in has been disposed and sends no more render frames for
   *   the loop to tick on. The message names the class and the state, and no loop comes into
   *   being.
   */
  constructor(display: Display, options?: {fps?: number; maxStepsPerFrame?: number}) {
    // before eventize(), so that a loop which can never be ticked never comes into being
    if (display.isDisposed) {
      throw new Error(
        'FixedFrameLoop: the display handed to the constructor has been disposed and sends no more ' +
          'render frames to tick on. Build the loop while the display is alive, or hand it a live display.',
      );
    }

    eventize(this);
```

Der Rest des Konstruktors bleibt, wie er ist. Das Klassen-TSDoc (Zeilen 41-84)
wird **nicht** angefasst: der `@throws` am Konstruktor ist die Stelle, an der
`VOBufferGeometry` dieselbe Zusage trägt, und eine zweite Fassung im
Klassenkopf geht beim nächsten Umbau auseinander.

### 2. Den Spec-Fall dazu, mit rotem Lauf vorher

Datei `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts`.

Der Helfer `makeFakeDisplay()` (Zeile 8) baut heute ein Objekt ohne
`isDisposed`; der neue Guard läse dort `undefined` und liefe durch. Beide
Zustände bekommen einen Namen:

```ts
function makeFakeDisplay(isDisposed = false): Display {
  return eventize({isDisposed}) as unknown as Display;
}
```

Alle bestehenden Aufrufe bleiben unverändert — der Default hält sie am Leben.

Neuer Block, unmittelbar **vor** `describe('dispose()', …)` (heute Zeile 246),
damit die beiden Lebenszyklus-Enden nebeneinander stehen:

```ts
  describe('a display that has been disposed', () => {
    it('the constructor refuses it and builds no loop', () => {
      const deadDisplay = makeFakeDisplay(true);
      const subscriptionsBefore = getSubscriptionCount(deadDisplay);

      expect(() => new FixedFrameLoop(deadDisplay)).toThrow(/has been disposed/);

      // nothing came into being, so nothing listens on the display either
      expect(getSubscriptionCount(deadDisplay)).toBe(subscriptionsBefore);
    });
  });
```

`getSubscriptionCount` ist in Zeile 1 bereits importiert.

**Der rote Lauf gehört in den Report.** Schreib den Testfall zuerst, lass
`pnpm nx test twopoint5d -- src/display/FixedFrameLoop.spec.ts` laufen, sieh
ihn scheitern (der Konstruktor wirft nicht), und bau danach den Guard aus
Schritt 1. Die Ausgabe des roten Laufs kommt in den Report.

### 3. `Stylesheets.releaseRule()`: jede Prüfung hinter ihren Lookup

Datei `packages/twopoint5d/src/display/Stylesheets.ts`, Zeilen 120-125. Die
gesammelte Bedingung `sheet == null || rules == null || installed == null` ist
inhaltlich redundant — ohne Sheet gibt es keine Rules-Map und ohne die kein
`installed` — und steht nur da, damit TypeScript `sheet` und `rules` für die
Zeilen 131 und 136 verengt. Gestaffelt trägt jede Prüfung genau das Narrowing,
das die Zeilen unter ihr brauchen, und keine ist an ihrer Stelle überflüssig:

```ts
  static releaseRule(name: string, root: HTMLElement | ShadowRoot = document.head): void {
    // not getGlobalSheet(): a release is no reason to create a sheet
    const sheet = sheets.get(root);
    if (sheet == null) return;

    const rules = installedRules.get(sheet);
    if (rules == null) return;

    const installed = rules.get(name);
    if (installed == null || installed.users === 0) return;

    installed.users -= 1;
```

Ab `if (installed.users > 0 || installed.pinned) return;` (heute Zeile 128)
bleibt die Methode unverändert, samt ihrem Kommentar über dem
Index-Lookup. Das Verhalten ändert sich an keinem Pfad, und die TSDoc über der
Methode bleibt richtig, wie sie ist.

Die Audit-Empfehlung ließ die Wahl zwischen einem begründenden Kommentar und
einer Umordnung. Gewählt ist die Umordnung: ein Kommentar, der eine Redundanz
entschuldigt, überlebt den nächsten Umbau der Methode nicht, drei Lookups mit
je einem Early Return schon.

Neue Tests braucht dieser Schritt nicht.
`packages/twopoint5d-testing/test/stylesheets.test.js` fährt in »a release
without a retain changes nothing« (Zeile 126) beide Aussteigepfade ab — einen
Root ohne Sheet und einen zweiten Release auf einem Namen ohne Nutzer.

### 4. Den `afterEach`-Kommentar sagen lassen, was der Block tut

Datei `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`,
Zeilen 19-20. Der Kommentar behauptet »the renderer belongs to this file, not
to the display« — und vier Zeilen weiter ruft der Block `display.dispose()`,
weil das den Renderer mitnimmt. Vier Fälle darunter steht
`it('releases the renderer it was handed', …)`; §1 des Lifecycle-Dokuments
führt `Display` über seinen `WebGPURenderer` als einen von genau zwei
dokumentierten Take-overs, und §7 benennt diese Datei als den Ort seiner
Assertion. Gemeint ist die Aufräumpflicht der Testdatei, und die soll dastehen:

```js
  // this block cleans up whatever got as far as existing — including the case where the
  // constructor threw and no display ever took the renderer over
  afterEach(() => {
```

Der Kommentar im Rumpf (`// Display.dispose() releases the renderer it was
handed`, Zeile 23) bleibt stehen: er ist richtig und erklärt den Zweig, über
dem er steht. Am Code des Blocks ändert sich nichts.

### 5. CHANGELOG: `Changed` und Migration Guide

Datei `packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`. Der
Konstruktor weist ein Aufrufmuster ab, das bisher durchging — das bewegt die
öffentliche Oberfläche und braucht beide Einträge.

Als **erster** Eintrag unter `### Changed` (Zeile 36):

```
- `new FixedFrameLoop(display)` throws when the display handed to it has been disposed, with a message naming the class and the state. A loop over such a display subscribes to an emitter that never fires again: it reports `isDisposed === false`, emits neither `OnTick` nor `OnRender` and never disposes itself, because the `OnDisplayDispose` it waits for has already gone out. `Display#isDisposed` is the question to ask wherever a loop is built from a display that belongs to someone else
```

Als **erster** `####`-Abschnitt unter `### Migration Guide` (Zeile 249), vor
`#### `IMap2DVisibilitorHelpers` requires a `dispose()``:

````markdown
#### The `FixedFrameLoop` constructor refuses a disposed display

A `FixedFrameLoop` reads its frames from the `Display` it is handed. A display that has been disposed sends none and never will, so the constructor turns it away instead of building a loop that answers `isDisposed === false` and does nothing. Where the display comes from somewhere else, `Display#isDisposed` answers first.

**Before**

```ts
display.dispose();
const sim = new FixedFrameLoop(display); // → a loop that never ticks and never disposes itself
```

**After**

```ts
display.dispose();
new FixedFrameLoop(display); // → Error: FixedFrameLoop: the display handed to the constructor has been disposed …

if (!display.isDisposed) {
  const sim = new FixedFrameLoop(display);
}
```
````

Der bestehende Abschnitt `#### A disposed display refuses to be used`
(Zeile 539) bleibt unangetastet — er handelt von `Display` nach dessen
eigenem `dispose()`, nicht von einem Loop darüber.

Die Schritte 3 und 4 bekommen **keinen** CHANGELOG-Eintrag:
`Stylesheets.releaseRule()` ändert sein Verhalten an keinem Pfad, und ein
Kommentar in einer Testdatei ist nichts, was ein Konsument sieht.

## Was dieses Paket nicht anfasst

- Kein Aufrufer im Repository baut eine `FixedFrameLoop` — außerhalb der Spec
  taucht `new FixedFrameLoop` nirgends auf, geprüft über `packages/`,
  `apps/lookbook/` und `packages/twopoint5d-testing/test/`. Der neue Wurf zieht
  also nichts mit sich; die Semver-Folge trägt der Migrationsabschnitt.
- `FrameLoop` und `Chronometer` bleiben, wie sie sind. Sie nehmen kein Display
  entgegen, und ein Guard dort hätte kein Subjekt.
- `Display` selbst wird nicht angefasst. `isDisposed` steht seit dem Eintrag in
  `### Added` bereit und wird hier nur gelesen.

## Konventionen, die hier besonders greifen

- Keine Finding-ID in irgendeiner Zeile, die ins Repository geht — auch nicht
  in einem Kommentar, einem Testnamen, dem CHANGELOG oder der Commit-Message.
- Kein Rückblick auf den Vorzustand in Code, Kommentar, TSDoc oder CHANGELOG.
  Der Migrationsabschnitt ist die eine Stelle, an der ein »Before« stehen darf,
  und die Commit-Message die andere.
- Englisch in jeder Zeile, Conventional Commits, `.js`-Suffix an relativen
  Imports in `packages/`, `import type` für Typen.
- `pnpm run ci` ist das Gate, nicht die Einzelziele. Während der Arbeit geht
  ein einzelner Vitest-Lauf über
  `pnpm nx test twopoint5d -- src/display/FixedFrameLoop.spec.ts`.

## Findings im Volltext

**CONS-027 · low · `packages/twopoint5d/src/display/FixedFrameLoop.ts:145-155`**
(Regel: `docs/resource-lifecycle.md` §3, letzter Absatz; `Display.isDisposed`
in `Display.ts:312-314`) — Ein disposetes Display im FixedFrameLoop-Konstruktor
abweisen

`resource-lifecycle.md` §3 verlangt: »a constructor or method handed an
already-disposed instance refuses it, with an error naming the call and the
state«. Eine `FixedFrameLoop` über einem disposeten Display abonniert einen
Emitter, der nie wieder emittiert (`off(this)` lief, `OnDisplayDispose` wird
nicht wiederholt), meldet also `isDisposed === false`, tickt nie und disposed
sich nie — genau der Fall »looks alive and does nothing«, den die Regel
benennt. Das Display exponiert `isDisposed`, der Check ist eine Zeile.

Empfehlung: `if (display.isDisposed) throw new Error('FixedFrameLoop: the
display handed to the constructor has been disposed');` und ein Spec-Fall (der
`makeFakeDisplay()`-Helfer braucht ein `isDisposed: false`).

**CONS-040 · info · `packages/twopoint5d/src/display/Stylesheets.ts:125`** —
Die redundanten Null-Prüfungen in `Stylesheets.releaseRule()` auflösen

`sheet == null || rules == null` neben `installed == null` ist inhaltlich
redundant (`installed` ist ohne beide schon `undefined`) und dient nur dem
Typ-Narrowing. Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: Das Narrowing über einen Kommentar begründen oder die Lookups so
ordnen, dass eine Prüfung genügt.

**CONS-021 · low · `packages/twopoint5d-testing/test/display-adopt-renderer.test.js:19-23`**
— Ein Testkommentar spricht von Ownership und meint Aufräumpflicht

Der Kommentar über dem `afterEach` sagt »the renderer belongs to this file, not
to the display« — vier Zeilen darunter ruft der Block `display.dispose()` und
verlässt sich darauf, dass das den Renderer mitnimmt. Gemeint ist die
Aufräumpflicht der Testdatei, formuliert ist es als Eigentumsaussage, die quer
zur Übernahme steht, die das Konstruktor-TSDoc ausspricht. Re-Check:
unverändert.

Empfehlung: Umformulieren auf das, was gemeint ist: Dieser Block räumt auf,
auch wenn der Konstruktor geworfen hat und nie ein Display entstanden ist.

## Abgleich, Zug 0 (2026-09-20)

| Finding | Urteil | Fundstelle heute |
| --- | --- | --- |
| CONS-027 | unverändert, Fundstelle verschoben | Der Konstruktor steht auf `FixedFrameLoop.ts:181-198`; die im Audit genannten Zeilen 145-155 tragen heute den `fps`-Accessor. Kein `isDisposed`-Guard, `eventize(this)` ist die erste Anweisung, `on(display, OnDisplayRenderFrame, …)` und `once(display, OnDisplayDispose, …)` stehen auf 196-197. `Display#isDisposed` steht auf `Display.ts:320`, nicht auf 312-314 |
| CONS-040 | unverändert | `Stylesheets.ts:125` trägt die Bedingung wortgleich; `sheet` wird auf 122 geholt, `rules` auf 123 aus `sheet && …`, `installed` auf 124 aus `rules?.get(name)`. Das Narrowing wird auf 131 (`sheet.cssRules`) und 136 (`rules.delete`) gebraucht |
| CONS-021 | unverändert | `display-adopt-renderer.test.js:19-20` trägt den Kommentar, der `afterEach` beginnt auf 21, `display.dispose()` steht auf 24. Der Take-over, dem der Kommentar widerspricht, wird auf 51-68 derselben Datei getestet |

Keines der drei Findings ist gegenstandslos. Keine Datei des Pakets wurde von
den Commits der Pakete 1–5 berührt (`git log` auf alle drei Pfade endet bei
`ed1b11e4`, vor dem Beginn dieses Laufs).

### Triage der offenen Arbeit

**Folgen aus erledigten Paketen: keine.** Die Pakete 1 bis 5 melden unter
`Folgen:` durchweg »keine« bzw. »Nichts offen«. Es ist nichts zu verteilen.

**Nebenbefunde aus »Offene Befunde«: keiner wandert herein.** Die 14 Einträge
teilen die Ursache dieses Pakets nicht:

- acht Einträge sind Lookbook-CSS und -Astro (`apps/lookbook/`), einer ist die
  Engine-Range in der Root-`package.json` — andere Domäne, andere Diff-Fläche.
- vier Einträge liegen in `packages/twopoint5d/src/map2d/`, drei davon an
  `RectangularVisibilityAreaHelpers.ts` — die gehören zusammen, aber nicht
  hierher.
- Ein Eintrag verdient die Begründung, warum er **nicht** mitkommt:
  `packages/twopoint5d/src/stage/Canvas2DStage.ts:211`, die TSDoc von
  `dispose()`, die `stageRenderer` unter die Felder zählt, die ihre Werte
  behalten, obwohl die Instanz darin disposed ist. Das klingt nach »Ownership-
  Texte geraderücken« und ist doch eine andere Ursache: dort steht eine
  Halbwahrheit über das Verhalten nach `dispose()` in der `stage`-Domäne,
  hier steht eine Eigentumsaussage in einer Testdatei der `display`-Domäne.
  Die Dateien überschneiden sich nicht, Paket 8 fasst `Canvas2DStage.ts` aus
  einem dritten Grund an (Kamera- und Größenlogik). Der Eintrag bleibt in der
  Queue für die Drain-Runde, die ihn mit allen Befunden vor Augen schneidet.

**Restplan: unverändert.** Die Pakete 7 (texture), 8 (stage) und 9
(vertex-objects) berühren `packages/twopoint5d/src/display/` an keiner Stelle;
Paket 6 bewegt keine Schnittstelle, gegen die sie compilieren, und hat keinen
Aufrufer außerhalb seiner eigenen Spec. Weder Reihenfolge noch Schnitt ändern
sich. Der gröbere Schnitt, den der Plan-Kopf für die Drain-Runde vorsieht,
bleibt der Drain-Runde.

## Anmerkungen des Reviewers

Runde 1, ein Reviewer (sonnet, Effort medium), Report
`<arbeitsdir>/paket-6.review-1.json`.

**Erfüllung je Finding-ID, je mit Fundstelle:**

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| CONS-027 | behoben | `FixedFrameLoop.ts:181-185` — der Wurf steht vor `eventize(this)` auf 187, also vor jeder Subscription; die Meldung nennt Klasse und Zustand, wie `resource-lifecycle.md` §3 es verlangt. `@throws` auf `:173-177`. Spec: `FixedFrameLoop.spec.ts:111-114` (`makeFakeDisplay(isDisposed = false)`) und `:139-149` (neuer Block unmittelbar vor `describe('dispose()')`) |
| CONS-040 | behoben | `Stylesheets.ts:120-127` — drei Lookups mit je einem Early Return, das Narrowing für `sheet.cssRules` und `rules.delete` bleibt erhalten, ab `installed.users -= 1` unverändert |
| CONS-021 | behoben | `display-adopt-renderer.test.js:19-20` — der Kommentar nennt die Aufräumpflicht des Blocks samt dem Fall, dass der Konstruktor geworfen hat; der Rumpfkommentar auf 23 steht richtig weiter |

Der Reviewer hat die Aufrufersuche eigenständig wiederholt — über `.ts`, `.js`,
`.astro`, `.md` und `.mdx` — und bestätigt: `FixedFrameLoop` kommt außerhalb
von Quelle, Spec, CHANGELOG, `public-api.ts`, `architecture.md` und
`resource-lifecycle.md` nicht vor, und die beiden Dokumente nennen die Klasse
nur als Beispiel, nicht ihr Verhalten an einem toten Display. Gegen die
Konventionen fand er nichts: keine Finding-ID im Diff, kein Rückblick auf den
Vorzustand außerhalb des Migrationsabschnitts, alles Englisch, keine neuen
Imports, die Commit-Message ein Conventional Commit.

**Zwei kleine Befunde, beide stehengelassen:**

- `FixedFrameLoop.ts:181-184` — die Fehlermeldung sagt am Ende »Build the loop
  while the display is alive, or hand it a live display« und damit zweimal
  dasselbe. Der Reviewer würde sie so lassen; der Text ist wörtlich aus dem
  Detailplan übernommen.
- `packages/twopoint5d/CHANGELOG.md`, `### Changed`, erster Eintrag — der
  Nachsatz über `isDisposed === false` beschreibt, was ein Loop über einem
  toten Display täte. Er ergibt auch ohne Kenntnis des Vorzustands Sinn und ist
  vom Detailplan vorgegeben, also kein Verstoß gegen die Konventionen.
