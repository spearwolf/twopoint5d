# Paket 18 — Drain: DisplayFullscreen — Armed-Zustand, Warnungen, Spec-Helfer und Proposal-Kopf

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — die fünf Nebenbefunde aus »Offene Befunde« mit »überführt in Paket 18« (alle aus Paket 5), davon vier umzusetzen, einer gegenstandslos (unten »Abgleich«)
- Ziel: Ein Fullscreen des Ziels ist nie scharf, wer ihn auch betreten hat; `onLandscape = true` neben einer noch offenen Antwort des Browsers schaltet erst scharf, wenn diese Antwort da ist, und nur, wenn das Ziel dann nicht im Fullscreen ist; der Konstruktor prüft die Konfliktwarnungen einmal; die Specs der Display feuern `fullscreenchange` nur an Listener, die das Dokument noch hält.
- Modell: stärkste Stufe — der Zustandsautomat von `DisplayFullscreen` hängt an der Reihenfolge von Promise-Reaktionen und `fullscreenchange`; Paket 5 brauchte an dieser Datei fünf Runden. Ein Modell, das die Microtask-Reihenfolge falsch liest, kostet mehr Runden als der Aufpreis.
- Effort: medium — Code-Änderungen sind unten exakt vorgegeben, Tests und Doku-Sätze sind aus dem Plan zu schreiben.
- Dateien:
  - `packages/twopoint5d/src/display/DisplayFullscreen.ts`
  - `packages/twopoint5d/src/display/DisplayFullscreen.spec.ts`
  - `packages/twopoint5d/src/display/Display.spec.ts`
  - `packages/twopoint5d/src/testing/eventTargetStub.ts` (neu)
  - `packages/twopoint5d/src/testing/eventTargetStub.spec.ts` (neu)
  - `packages/twopoint5d/docs/proposals/display-fullscreen.md` (§3.2 Code-Auszug, §6.2, §13.1 — **nicht** der Status-Kopf)
  - `packages/twopoint5d/docs/display.md` (»Fullscreen on landscape«-Absatz `:503-508`, Cheat Sheet `:660`)
- Verify: `pnpm run ci` (Gate; nie zwei parallel im selben Checkout). Innere Schleife beim Arbeiten: `pnpm --filter @spearwolf/twopoint5d exec vitest run src/display src/testing`
- Commit: `fix(twopoint5d): disarm a display whose target is in fullscreen, let onLandscape switched on during an answer of the browser arm once that answer is in, check the fullscreen warnings once in the constructor and fire fullscreenchange in the display specs only at listeners the document still holds`

## Abgleich (Zug 0, 2026-11-01, gegen HEAD a63429c8)

`DisplayFullscreen.ts` ist seit 11f2b368 (Paket 15) unberührt, `Display.spec.ts` seit 4308cc70 im Helfer unverändert. Alle Stellen wurden an der Fundstelle nachgelesen.

1. **`isArmed` bleibt nach Betreten** (`DisplayFullscreen.ts:778ff.` → jetzt `#readState()` `:781-805`) — **unverändert.** `#readState()` setzt beim Betreten `#activeElement`/`#entered` (`:786-789`), nichts ruft `#disarm()`. Weitere Wege in denselben Zustand, gleiche Ursache, im Zug 0 gefunden und aufgenommen: (a) ein Fullscreen, den jemand anderes auf dem Ziel betritt (`#entered` bleibt `undefined`), (b) eine halbe Drehung `landscape-primary` → `landscape-secondary` eines scharfen Controllers: `#turned()` (`:907-916`) fragt an, der Browser gewährt, der Tap-Listener bleibt hängen, (c) der Pseudo-Modus, betreten während scharf (`#enterPseudo()` `:947-968` entschärft nicht; erreichbar, wenn `isSupported` zwischen Arming und `request()` kippt). Folge des Fehlers über den Hinweis hinaus: nach Escape im Querformat wirft der nächste Tap den Nutzer zurück in den Fullscreen — gegen die Zusage in `docs/display.md:510-511` (»Whoever leaves the fullscreen while the phone is still sideways … stays out of it«). Vorbestehend: an d9b648bf weder in `#readState()` noch in `#enterPseudo()` ein `#disarm()`.
2. **`set onLandscape(true)` neben offenem Request** (`:353` → jetzt `:352`) — **unverändert.** Wächter `this.#isLandscape() && this.#gateIsOpen() && !this.#holdsTarget()`, kein Blick auf `#pending`/`#pendingExit`. Spiegelbild, gleiche Ursache, aufgenommen: während eines laufenden Exits ist `isActive` noch `true`, der Setter schaltet nichts scharf — und danach auch nichts, obwohl derselbe Setter nach dem Exit scharf schalten würde. Vorbestehend: an d9b648bf `:252` mit `!this.isActive`.
3. **`#warnConflicts()` doppelt im Konstruktor** (`:313-314`) — **unverändert.** Der Setter `onLandscape` endet mit `#warnConflicts()` (`:362`), sobald er etwas setzt; setzt er nichts (`false`), kehrt auch der zweite Aufruf `:314` sofort zurück (`!this.#onLandscape`, `:851`). `#orientationLock`/`#exitOnPortrait` stehen vor dem Setter (`:308-309`). Der Aufruf `:314` ist in jedem Fall tot.
4. **Spec-Helfer ruft entfernte Listener** (`Display.spec.ts:131-135` → jetzt `:129-136`) — **unverändert.** `fireFullscreenChange()` iteriert `doc.addEventListener.mock.calls`; der Dokument-Stub in `beforeEach` (`:143`) ist ein nacktes `vi.fn()` ohne Register. `DisplayFullscreen.spec.ts:24-45` hat mit `makeEventTarget()` bereits ein ehrliches Register (Set je Typ), dessen `dispatch()` aber einen Listener, den ein früherer Listener derselben Auslieferung entfernt, trotzdem ruft — das DOM ruft ihn nicht (gleiche Ursache, aufgenommen). Dasselbe Muster mit Set steht schon in `Display.spec.ts:1878ff.` (`pageWithVisibility`).
5. **Rückblick im Proposal-Kopf** (`docs/proposals/display-fullscreen.md:11-37`) — **gegenstandslos.** Dort steht »Deviations of the build from the first draft of this spec, which the sections below now state as built:« mit 13 Punkten, je mit Abschnitt. Genau das verlangt die Proposal-Konvention *dieses Repos*: `packages/twopoint5d/docs/proposals/README.md`, »Reading an implemented proposal« (»The list of deviations under the status line names every place the build left the first draft, each with the section that now states it — the one place a proposal keeps where the design moved, and why«) und »Building a proposal« (»its deviations name every place the build left the design«); »Proposals and guides« nennt die Liste als einzige erlaubte Historie. Alle 17 umgesetzten Proposals unter `docs/proposals/` führen sie an derselben Stelle. Ein ADR-Verzeichnis gibt es im Repo nicht, und das README sagt »There is no roadmap file«. Der Nebenbefund maß am Schema des Skills `project-harness-dev-docs` (Historie ins ADR), das hier nicht gilt — Projektanweisung vor Skill. Abweichung von der Ziel-Formulierung im Plan deshalb: der Kopf bleibt, wie er ist.

**Offene Folgen:** keine — kein erledigtes Paket trägt eine offene `Folgen:`-Zeile (Paket 17: »Folgen: keine«).

**Offene Befunde:** außer den fünf überführten teilt keiner die Ursache (die übrigen offenen gehören den Paketen 19–21). Neu im Zug 0 aufgefallen und **nicht** übernommen (andere Ursache, eigene Designfrage): `onLandscape` fragt an bzw. schaltet scharf, während ein *anderes* Element im Fullscreen liegt und das Ziel nicht im Stapel ist — steht als eigener Eintrag »aus Paket 18 (Zug 0)« in »Offene Befunde« mit `→ Scope`. Begründung der Trennung: die fünf Befunde betreffen den Zustand, den der Controller über sein *eigenes* Ziel führt; der neue braucht eine Regel, welcher fremde Fullscreen (im Ziel, im Root, im Dokument) die Drehung sperrt, die weder TSDoc noch Proposal §3.2 bisher treffen.

**CHANGELOG:** kein Eintrag. `display.fullscreen` ist unveröffentlicht (nur unter `## [Unreleased]`, `CHANGELOG.md:27-30`), und die vier »Added«-Zeilen bleiben wahr — keine sagt etwas über `isArmed` im Fullscreen oder den Setter während einer Antwort. Wie Paket 15.

**Restplan:** unverändert. 19–21 berühren weder `src/display/` noch das Fullscreen-Proposal; der neue Eintrag in »Offene Befunde« geht an die Drain-Runde des Abschlusses.

## Vorgehen

Alle Code-, Kommentar- und Doku-Texte auf Englisch, ohne Rückblick (kein »no longer«, »now«, »before this«), ohne Nummern aus diesem Plan. `#private`-Member, `.js`-Suffix bei relativen Imports (AGENTS.md).

### 1. Regressionstests zuerst (rot sehen)

In `src/display/DisplayFullscreen.spec.ts` die folgenden Tests schreiben und **vor** den Schritten 2–4 laufen lassen; der rote Lauf (Kommando + Ausgabe) gehört in den Report. Die Hilfsmittel `make`, `turn`, `tap`, `flush`, `answerLater`, `exitLater`, `fireFullscreenChange`, `makeTarget`, `asElement`, `emitted`, `defaultTarget`, `orientation`, `doc` existieren in der Datei.

In `describe('onLandscape')` (`:860`), nach `'onLandscape = true at runtime arms a page that is in landscape'` (`:1136`):

1. `'a request() of the page on an armed display disarms once the target is in fullscreen, and leaving it in landscape arms nothing'`
   - `orientation.type = 'landscape-primary'`; `const fs = make({onLandscape: true})`; `expect(fs.isArmed).toBe(true)`
   - `await fs.request()`; `expect(fs.isActive).toBe(true)`; `expect(fs.isArmed).toBe(false)`
   - `expect(emitted.at(-1)).toMatchObject({isActive: true, isArmed: false})`; `expect(emitted.some((props) => props.isActive && props.isArmed)).toBe(false)`
   - `expect(defaultTarget.listenerCount('pointerup')).toBe(0)`; `expect(defaultTarget.listenerCount('click')).toBe(0)`
   - Escape im Querformat verlässt den Fullscreen: `fireFullscreenChange(null)`; `expect(fs.isArmed).toBe(false)`; `tap('touch')`; `expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1)`
   - erwartet rot vor dem Fix: `isArmed` ist `true` nach dem `request()`.
2. `'a fullscreen someone else enters on the target disarms'`
   - `orientation.type = 'landscape-primary'`; `const fs = make({onLandscape: true})`; `fireFullscreenChange(defaultTarget)`
   - `expect(fs.isActive).toBe(true)`; `expect(fs.isArmed).toBe(false)`; `expect(emitted.at(-1)).toMatchObject({isActive: true, isArmed: false})`
   - rot vor dem Fix.
3. `'a half turn of an armed display asks again, and the fullscreen the browser grants is not armed'`
   - `orientation.type = 'landscape-primary'`; `const fs = make({onLandscape: true})`; `expect(fs.isArmed).toBe(true)`
   - `turn('landscape-secondary')`; `await flush()`
   - `expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(1)`; `expect(fs.isActive).toBe(true)`; `expect(fs.isArmed).toBe(false)`
   - rot vor dem Fix.
4. `'onLandscape = true beside a request() the browser has not answered arms nothing, and nothing once the browser grants it'`
   - `orientation.type = 'landscape-primary'`; `const answer = answerLater(defaultTarget)`; `const fs = make()`; `const requested = fs.request()`
   - `fs.onLandscape = true`; `expect(fs.isArmed).toBe(false)`
   - `answer.grant()`; `await expect(requested).resolves.toBe(true)`; `await flush()`
   - `expect(fs.isArmed).toBe(false)`; `expect(emitted.some((props) => props.isArmed)).toBe(false)`
   - rot vor dem Fix (scharf direkt nach dem Setter).
5. `'onLandscape = true beside a request() the browser refuses arms once the refusal is in'`
   - wie 4, aber `answer.refuse()`; `await expect(requested).resolves.toBe(false)`; `await flush()`
   - `expect(fs.isArmed).toBe(true)`; `expect(emitted.at(-1)).toMatchObject({isActive: false, isArmed: true})`
   - vor dem Fix grün (scharf seit dem Setter) — er hält fest, dass der Fix das Scharfschalten aufschiebt und nicht verliert. Im Report als »grün vor und nach« ausweisen.
6. `'onLandscape = true while an exit() is under way arms once the exit is through'`
   - `orientation.type = 'landscape-primary'`; `const fs = make()`; `await fs.request()`
   - `const exit = exitLater()`; `const left = fs.exit()`; `fs.onLandscape = true`; `expect(fs.isArmed).toBe(false)`
   - `exit.finish()`; `await expect(left).resolves.toBe(false)`; `await flush()`; `expect(fs.isArmed).toBe(true)`
   - rot vor dem Fix (am Ende `false`).
7. `'onLandscape = true beside a request() arms nothing once dispose() has run before the answer'`
   - `orientation.type = 'landscape-primary'`; `const answer = answerLater(defaultTarget)`; `const fs = make()`; `void fs.request()`; `fs.onLandscape = true`; `fs.dispose()`; `answer.refuse()`; `await flush()`
   - `expect(fs.isArmed).toBe(false)`; `expect(defaultTarget.listenerCount('pointerup')).toBe(0)`
   - vor dem Fix grün (der Setter schaltet sofort scharf, `dispose()` entschärft, die Ablehnung danach kehrt an `if (this.#disposed) return` `:669` um); nach dem Fix trägt `#rearm()` mit `!this.#disposed` dasselbe. Im Report als »grün vor und nach« ausweisen.

In `describe('pseudo fullscreen')` → `describe('with onLandscape')` (`:1989`):

8. `'a pseudo mode entered while armed disarms'`
   - `doc.fullscreenEnabled = true`; `orientation.type = 'landscape-primary'`; `const fs = make({fallback: 'pseudo', onLandscape: true})`; `expect(fs.isArmed).toBe(true)`
   - `isSupported` wird bei jedem Request neu gelesen: `doc.fullscreenEnabled = false`; `await fs.request()`
   - `expect(fs.mode).toBe('pseudo')`; `expect(fs.isArmed).toBe(false)`; `expect(defaultTarget.listenerCount('pointerup')).toBe(0)`
   - rot vor dem Fix. Der `beforeEach` von `pseudo fullscreen` (`:1876`) setzt `doc.fullscreenEnabled = false`; deshalb setzt der Test es vor `make()` auf `true`.

Kein Regressionstest für Schritt 3 (doppelte Konfliktprüfung): die Warnungen erscheinen einmal je Seite, der zweite Aufruf ist von außen nicht beobachtbar. Die bestehenden Tests `'a portrait lock beside onLandscape warns once and does not lock'` (`:1187`) und `'an explicit exitOnPortrait true beside a landscape lock warns once …'` (`:1176`) müssen grün bleiben.

### 2. Ein Fullscreen des Ziels ist nie scharf (`DisplayFullscreen.ts`)

- `#readState()` (`:781`): im Zweig `if (active != null) {` als erste Anweisung `this.#disarm();` — vor der Prüfung `if (this.#activeElement == null)`. Kommentar darüber: `// the target lies on top, whoever entered it: no tap is awaited`. Alle drei Aufrufer (`#syncState()` `:776`, die Gewährung in `#request()` `:655`, `settle` in `#leaveNative()` `:734`) emittieren danach selbst; `#disarm()` ist »state alone«.
- `#enterPseudo()` (`:947`): vor `this.#pseudo = pseudo;` (`:964`) `this.#disarm();` — das `#emitIfChanged()` am Ende (`:967`) trägt die Änderung in ein Event.
- Nichts schaltet nach dem Verlassen wieder scharf: kein `#rearm()` und kein `#arm()` an neuer Stelle. Das ist Absicht — nach dem Verlassen im Querformat bleibt der Controller unscharf bis zur nächsten Drehung ins Hoch- und zurück ins Querformat (bzw. bis `onLandscape` aus- und wieder eingeschaltet wird), wie für den Fullscreen von `onLandscape` (`#declined`) und wie `docs/display.md:510-511` es allen zusagt.
- TSDoc `isArmed` (`:439-446`): nach »A page can show a hint by it.« einfügen: `Never \`true\` while the target is in fullscreen — whoever entered it, native or pseudo — or lies under an element stacked on it.`

### 3. Der Setter wartet auf die Antwort des Browsers (`DisplayFullscreen.ts`)

Setter `onLandscape` (`:345-363`), der `if (on)`-Zweig wird zu:

```ts
if (on) {
  this.#watchOrientation();
  // no turn has happened, and nothing grants an exemption: a page in landscape arms — or, where
  // only the pseudo mode is there, which needs no gesture, enters it. While the browser is still
  // answering a request or an exit, its answer decides first: the arming is held against the state
  // once the run is through, as the answer of a request of onLandscape is
  if (this.#isLandscape() && this.#gateIsOpen()) {
    if (this.#pending != null || this.#pendingExit != null) {
      void this.#joinRun().then((active) => this.#rearm(active));
    } else if (!this.#holdsTarget()) {
      if (this.isSupported) this.#arm();
      else if (this.fallback === 'pseudo') this.#enterPseudo('landscape');
    }
  }
}
```

- Invariante, auf die das baut: solange `#pending` oder `#pendingExit` gesetzt ist, ist `#run` offen (`#request()` ruft `#joinRun()` vor `#pending =`, `#leaveNative()` läuft nur innerhalb eines Laufs, `#endRun()` löst erst, wenn beide leer sind; `dispose()` löst den Lauf mit `false`). `#joinRun()` hängt sich also an den laufenden Lauf, legt keinen neuen an.
- `#rearm()` (`:921-934`) prüft bereits alles Nötige (`!active`, nicht entsorgt, `onLandscape`, Querformat, `!#holdsTarget()`, nicht `#declined`, nichts offen) und bleibt im Code unverändert. Nur der Kommentar darüber wird weiter: `// after a run of answers of the browser that onLandscape waits for — its own request, or onLandscape switched on while one was under way: a refusal arms, unless the controller is disposed or anything has changed in the meantime — a newer request or an exit is under way, say`.
- Den Pseudo-Zweig nicht in den Aufschub nehmen: ein offener nativer Request setzt voraus, dass `isSupported` bei seinem Aufruf galt.
- Der `else`-Zweig des Setters bleibt unverändert.
- TSDoc des Getters `onLandscape` (`:333-340`): vor »After {@link Display.dispose} …« einfügen: `Switched on while the browser is still answering a request or an exit, it arms once that answer is in — where the screen is still landscape and the target out of fullscreen.`

### 4. Eine Konfliktprüfung im Konstruktor (`DisplayFullscreen.ts`)

- Zeile `:314` `this.#warnConflicts();` ersatzlos streichen. Der Setter in `:313` prüft, sobald er `onLandscape` einschaltet; `#orientationLock` und `#exitOnPortrait` stehen davor (`:308-309`). Kein Kommentar nötig.

### 5. Ein Listener-Register für die Specs (`src/testing/`)

- Neu `src/testing/eventTargetStub.ts`, mit einem TSDoc-Kopf, der sagt, wofür der Stub ist (ein `EventTarget` für die Specs, das hält, was angemeldet ist, und bei `dispatch()` nur das ruft, wie der Browser):
  - `export type EventTargetListener = (event?: unknown) => void;`
  - `export interface EventTargetStub` mit `addEventListener: Mock<(type: string, listener: EventTargetListener, options?: unknown) => void>`, `removeEventListener: Mock<…gleich…>`, `dispatch(type: string, event?: unknown): void`, `listenerCount(type: string): number` — wie `DisplayFullscreen.spec.ts:17-22`.
  - `export function makeEventTarget(): EventTargetStub` — Inhalt wie `DisplayFullscreen.spec.ts:24-45`, mit einem Unterschied in `dispatch()`: über einen Schnappschuss iterieren und jeden Listener nur rufen, wenn er im Set noch steht (`if (set.has(listener)) listener(event)`), denn das DOM ruft keinen Listener, den ein früherer derselben Auslieferung entfernt hat. Kommentar dazu. Ein zweites `addEventListener` desselben Listeners bleibt ein Eintrag (Set).
  - Optionen und Capture-Flag werden nicht ausgewertet; ein Satz im TSDoc sagt das, mit dem Grund: der Code unter Test meldet jeden Listener mit demselben Capture-Flag an und ab (`DisplayFullscreen`: Tap mit `{capture: true}`, `fullscreenchange`/`keydown` ohne; `Display`: `visibilitychange` mit `false`, `fullscreenchange` ohne).
  - `import {type Mock, vi} from 'vitest';` — wie `src/testing/stageFixtures.ts`. `src/testing/` liegt außerhalb von Build (`tsconfig.build.json:15`) und Coverage (`vite.config.ts:49`).
- Neu `src/testing/eventTargetStub.spec.ts` (Muster: `src/testing/spriteGraph.spec.ts`), drei Tests:
  - `'calls no listener removed before the dispatch'`
  - `'calls no listener an earlier listener of the same dispatch removes'`
  - `'holds a listener added twice once'` (einmal gerufen, `listenerCount` 1)
- `DisplayFullscreen.spec.ts`: `type Listener`, `interface EventTargetStub` und `function makeEventTarget()` (`:15-45`) löschen, stattdessen `import {type EventTargetStub, makeEventTarget} from '../testing/eventTargetStub.js';` (und `EventTargetListener`, falls `Listener` sonst noch gebraucht wird — laut `grep` nur in `:15-45`). Alle übrigen Verwendungen (`DocStub extends EventTargetStub`, `TargetStub`, `OrientationStub`, `QueryStub`, `makeQuery()`, `with onLandscape`) bleiben, wie sie sind.
- `Display.spec.ts`:
  - `interface DocumentStub` (`:37-45`) erweitert `EventTargetStub` (aus `../testing/eventTargetStub.js`) und verliert seine eigenen `addEventListener`/`removeEventListener`-Felder; `hidden`, `fullscreenEnabled?`, `fullscreenElement?`, `exitFullscreen?`, `head` bleiben.
  - `beforeEach` (`:143`): `doc = Object.assign(makeEventTarget(), {hidden: false, head: {}});`
  - `fireFullscreenChange()` (`:129-136`): `doc.fullscreenElement = element; doc.dispatch('fullscreenchange');` — Kommentar: `// as the browser does it: \`element\` becomes the fullscreen element of the document, and every listener the document holds for fullscreenchange hears it — the display's and the controller's`.
  - `type DocumentListenerStub` (`:35`) bleibt nur, solange `frameDoc` (`:1800-1806`) es braucht; sonst streichen.
  - `documentListener()` (`:124-127`) und die `mock.calls`-Lesungen für `visibilitychange` (`:736`, `:2440`, `:2523`) bleiben: die Mocks zeichnen weiter auf.
  - Im Test `'dispose() takes every fullscreenchange listener off the document'` (`:2798-2808`) am Ende ergänzen: `expect(doc.listenerCount('fullscreenchange')).toBe(0);`
- Wird ein Test in `Display.spec.ts` mit dem ehrlichen Register rot, hat er sich auf einen entfernten Listener gestützt: Ursache im Report nennen. Liegt sie in der Library, ist das ein Befund für den Report, kein stilles Anpassen des Tests.

### 6. Proposal `docs/proposals/display-fullscreen.md` (Entwickler-Doku)

Der Status-Kopf `:3-37` bleibt unverändert (siehe Abgleich 5); dieses Paket weicht nicht vom ersten Entwurf ab, es bringt den Bau an §6.2 heran — also auch keine neue Zeile in der Abweichungsliste.

- §3.2 Code-Auszug, Kommentar über `get isArmed()` (`:146`): `/** \`onLandscape\` waits for a tap to enter fullscreen, §6.2; never while the target is in fullscreen. A page can show a hint by it. */`
- §6.2 (`:340-363`): nach Punkt 2 und vor »The answer of every request of §6 …« ein Absatz: `A fullscreen of the target disarms, whoever entered it — the armed tap, a \`request()\` of the page, the answer to a half turn from one landscape to the other, a request of someone else on the target, the pseudo mode —, and leaving it arms nothing by itself: the next turn to landscape does.`
- §6.2, der Satz »`onLandscape` set to `true` later does the same.« (`:359`) wird: `\`onLandscape\` set to \`true\` later does the same — while the browser is still answering a request or an exit, once that answer is in, held against the state then as the answer of a request of §6 is.`
- §13.1, der §6-Punkt (`:568-571`): vor »`onLandscape = false` takes the listeners down;« einfügen: `a fullscreen of the target disarms, whoever entered it, and leaving it in landscape arms nothing; \`onLandscape = true\` beside a request or an exit still under way arms once the browser has answered, and only where the target is out of fullscreen then;`

### 7. Guide `docs/display.md` (Nutzer-Doku: kein Interna-Name, keine Historie)

- Absatz `:503-508`: nach »— `isArmed` is `true` while the display waits for it, and the tap still reaches the game.« einfügen: `Once the target is in fullscreen, whoever put it there, \`isArmed\` is \`false\`.` Der Rest des Absatzes bleibt; die Zeilen auf die Breite der Nachbarzeilen (~100 Zeichen) neu umbrechen, nicht ragged.
- Cheat Sheet `:660`: `| \`isArmed\` | \`onLandscape\` waits for a tap; never while in fullscreen |`
- Der Setter-Aufschub kommt nicht in den Guide: er ist im TSDoc von `onLandscape` beschrieben, und der Guide nennt das Setzen zur Laufzeit nicht.

### 8. Selbstprüfung vor dem Report

- Jede geänderte Datei ganz lesen (bei `DisplayFullscreen.spec.ts`/`Display.spec.ts` die geänderten `describe`-Blöcke samt Nachbarn) und melden, was darin falsch ist und nicht zum Paket gehört.
- Die neuen Kommentar-, TSDoc- und Doku-Zeilen auf »no longer«, »any more«, »anymore«, »now« durchsehen (`git diff -U0 | grep -n -i 'no longer\|any more\|anymore\|\bnow\b'`): kein Rückblick.
- `pnpm run ci` grün; `biome ci --error-on-warnings .` ohne Warnung (Paket 17 hat die Specs warnfrei gemacht).

## Findings im Volltext

Die fünf Einträge aus »Offene Befunde« im Wortlaut des Plans:

**1 · low · `packages/twopoint5d/src/display/DisplayFullscreen.ts:778ff.` (`#readState()`)** — `isArmed` bleibt `true`, nachdem ein `request()` der Seite den Fullscreen betreten hat; nichts entschärft beim Betreten, ein Hinweis »tap for fullscreen« bliebe im Vollbild stehen; vorbestehend (in f9a8bfde `#disarm()` nur in Tap, Setter, `dispose()` und Hochformat) · aus Paket 5 (Runde 4) · → Scope

**2 · low · `packages/twopoint5d/src/display/DisplayFullscreen.ts:353` (`set onLandscape(true)`)** — schaltet neben einem offenen Request scharf, eine Prüfung auf `#pending` fehlt; vorbestehend (in f9a8bfde mit `!isActive` an derselben Stelle) · aus Paket 5 (Runde 4) · → Scope

**3 · low · `packages/twopoint5d/docs/proposals/display-fullscreen.md:11-37`** — der Status-Kopf führt »Deviations of the build from the first draft«, ein Rückblick, der nach der Proposal-Konvention ins ADR gehört; vorbestehend (in f9a8bfde `:11`) · aus Paket 5 (Runde 0) · → Scope — **im Zug 0 gegenstandslos** (Abgleich 5)

**4 · low · `packages/twopoint5d/src/display/Display.spec.ts:131-135` (`fireFullscreenChange()`)** — ruft jeden je registrierten `fullscreenchange`-Listener aus `doc.addEventListener.mock.calls`, auch entfernte; nach einem `dispose()` erreicht der Helfer Listener, die der Browser nicht mehr riefe; vorbestehend (in f9a8bfde `:131`) · aus Paket 5 (Runde 0) · → Scope

**5 · info · `packages/twopoint5d/src/display/DisplayFullscreen.ts:313-314`** — der Konstruktor ruft `#warnConflicts()` zweimal (im Setter `onLandscape` und direkt danach); harmlos, weil jede Warnung einmal je Seite erscheint; vorbestehend · aus Paket 5 (Runde 0) · → Scope

## Verlauf

- 2026-11-01 Zug 0: Detailplan steht · `#readState()` unverändert (`:781ff.`), dazu Fremd-Fullscreen auf dem Ziel, halbe Drehung, Pseudo-Modus · Setter unverändert (`:352`), dazu laufender Exit · `#warnConflicts()` unverändert (`:313-314`) · Spec-Helfer unverändert (`Display.spec.ts:129-136`), dazu `dispatch()` in `DisplayFullscreen.spec.ts:38-40` · Proposal-Kopf gegenstandslos (Konvention in `docs/proposals/README.md`) · keine offenen Folgen · neuer Eintrag »aus Paket 18 (Zug 0)« in »Offene Befunde« (`onLandscape` neben fremdem Fullscreen, → Scope) · Restplan unverändert
- 2026-11-01 Zug 1: Implementierer beauftragt (opus, effort medium), Brief `paket-18.impl-0.brief.txt`, Report nach `paket-18.impl-0.json`
- 2026-11-01 Zug 2: Report FERTIG · geändert `DisplayFullscreen.ts`, `DisplayFullscreen.spec.ts`, `Display.spec.ts`, `docs/proposals/display-fullscreen.md`, `docs/display.md`; neu `src/testing/eventTargetStub.ts` (+ `.spec.ts`) · roter Lauf 6 failed / 183 passed · Arbeitsbaum schmutzig · Verify (`biome ci --error-on-warnings . && pnpm run ci`) exit=0, Log `paket-18.verify.log`
- 2026-11-01 Zug 3: Reviewer (opus, effort medium) Urteil OK, alle Punkte erfüllt, 4 klein (einer davon außerhalb des Pakets → Offene Befunde) · Diff `paket-18.diff`, Report `paket-18.review-0.json`
- 2026-11-01 Zug 4: keine Runde (keine kritischen/wichtigen Befunde)
- 2026-11-01 Zug 5: committet 1a8ec51e (7 Dateien, +270/−56), Verify aus Zug 2 (exit=0) trägt, seither keine Codeänderung · Plan auf `[x]`

## Urteil des Reviewers (Runde 0)

- Fullscreen des Ziels entschärft, `request()` der Seite — behoben, `DisplayFullscreen.ts:793-794` (`#readState()`), Test `DisplayFullscreen.spec.ts:334`
- Fremder Fullscreen auf dem Ziel — behoben, dieselbe Stelle über `#syncState()`, Test `:355`
- Halbe Drehung eines scharfen Controllers — behoben, Gewährung über `#readState()`, Ablehnung über `#rearm()` → idempotentes `#arm()` `:1005`, Test `:366`
- Pseudo-Modus, betreten während scharf — behoben, `#disarm()` vor `this.#pseudo = pseudo` `:977`, Test `:466`
- Setter neben offenem Request oder Exit — behoben, `:351-360`; Invariante `#pending`/`#pendingExit` ⇒ `#run` offen nachgerechnet; Tests `:379`, `:396`, `:412`, `:429`
- Eine Konfliktprüfung im Konstruktor — behoben, `:313`; Warn-Tests grün
- Listener-Register in beiden Display-Specs — behoben, `src/testing/eventTargetStub.ts:51-58`, `Display.spec.ts:39`, `:131-135`, `:144`, `:2807`; kein bestehender Test wurde rot
- Proposal-Kopf — gegenstandslos (Abgleich 5), unverändert
- Doku — Proposal §3.2 `:146`, §6.2 `:353-355`/`:362-364`, §13.1 `:578-581`; Guide `docs/display.md:506-507`, Cheat Sheet `:660`

## Kleine Befunde

- `DisplayFullscreen.ts:358` — eine aufgeschobene Schärfung entfällt, wenn die Seite nach einer Ablehnung synchron erneut `request()` ruft (`#rearm()` sieht `#pending`); entspricht §6.2 (»the answer of that one decides«) und dem Drehungspfad, aber ohne Test
- `docs/display.md:507` — neu umbrochene Zeile 105 Zeichen statt ~100 (Implementierer: Code-Span nicht umbrechen)
- `DisplayFullscreen.spec.ts:4` — Import `../testing/eventTargetStub.js` steht zwischen den `./`-Imports, in `Display.spec.ts:15` davor; kosmetisch
- außerhalb des Pakets, vorbestehend → »Offene Befunde«: Guide-Zusage `docs/display.md:510-511` gilt nur für den Fullscreen von `onLandscape`
- Implementierer: Test 5 ohne Zwischencheck nach dem Setter (sonst vor dem Fix rot statt »grün vor und nach«); TSDoc-Satz im Getter `onLandscape` als eigener Absatz; `DocumentListenerStub` bleibt für `frameDoc`
- Folge (im Plan): `src/display/types.ts:72` TSDoc `DisplayFullscreenChangeProps.isArmed` ohne den Zusatz »never while the target is in fullscreen«
