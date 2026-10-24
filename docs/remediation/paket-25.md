# Paket 25 — Nachlese: Folgen des ready-Fixes in TextureStore und Abweisungen in den Specs

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Folgen von Paket 24: kleine Befunde des Reviewers aus dessen Runde 1; dazu ein
  Nebenbefund aus der Queue; alle low)
- Folge von: Paket 24 — Kette 6 → 24 → 25 (der `ready`-Fix in Paket 24 war eine Folge von Paket 6,
  a154cadc), zweite Generation. Eine Folge dieses Pakets wäre die dritte: sie bleibt nach der
  Entscheidung vom 2026-10-24 im Paket, ein Paket 26 wird dafür nicht geschnitten
- Ziel: Der `ready`-Fix in `TextureStore` ist vollständig dokumentiert und getestet, sein
  CHANGELOG-Eintrag sagt genau, wen er betraf, und alle Specs prüfen Abweisungen mit Klasse und
  voller Meldung.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TextureStore.ts` (Kommentar an `#readyLate`, Fehlerweg der
    Schleife in `parse()`, TSDoc `TextureStoreEvents` › `Ready` und `parse()`)
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts` (neuer `describe`-Block, zwei Tests
    dorthin verschoben, dazu die Paare aus Teil C)
  - `packages/twopoint5d/CHANGELOG.md` (nur der Eintrag unter `## [Unreleased]` → `### Fixed`,
    Z. 160)
  - `packages/twopoint5d/docs/proposals/pipeline-stages-and-grid-base.md` (Z. 200–207, nur
    Umbruch), `packages/twopoint5d/docs/proposals/gpu-picking.md` (Z. 263–265, nur Umbruch)
  - die 32 Specs der Liste in Teil C, alle unter `packages/twopoint5d/src/`
- Vorgehen: siehe Abschnitt »Vorgehen« unten — Teile A bis D.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): report a throw of what a listener of the ready of a TextureStore starts on the console, as for what was started before the parse(), say in the changelog that the fix of that ready concerned the first ready and what each method does then, test what such a listener starts, check every refusal in the specs by its class and its whole message in one assertion, and wrap two paragraphs of the proposals at the width of their files`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · Abgleich gegen HEAD d559b0c7: alle fünf Folgen von
    Paket 24 offen und unverändert (`gpu-picking.md` eine Zeile verschoben, Z. 263 statt 264),
    der Queue-Eintrag zu den 14 Spec-Stellen unverändert · Stellen gleicher Ursache: dasselbe
    Muster an 125 Paaren in 32 Specs (die 14 eingeschlossen), 123 werden umgestellt, zwei
    Meldungen der JS-Engine bleiben · Fehlerweg der spät gebuchten Abonnenten: Konsole statt
    `error`-Event (Gleichlauf mit dem früh gebuchten) · Folgen aus Paket 24 alle in dieses
    Paket, keine anderswohin · Restplan unverändert, 25 ist das letzte Paket
  - 2026-10-24 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-25.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG_MIT_VORBEHALT (geänderte Dateien nicht ganz gelesen; Volltext in `paket-25.impl-0.report.md`, das `result` der JSON trägt ihn nicht) · 36 Dateien (TextureStore.ts, CHANGELOG.md, 2 Proposals, 32 Specs) · A5 (f) vor A2 rot, S1–S3 rot · Teil C 123 von 125 Paaren umgestellt · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-25.verify.log`)
  - 2026-10-24 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-25.diff`, Report nach `paket-25.review-0.json`
  - 2026-10-24 Zug 3: Urteil — F1–F5 und N1 behoben, Teil C Regeln 1–7 erfüllt, 2 × klein, nichts kritisch oder wichtig · Diff `paket-25.diff`, Report `paket-25.review-0.json`
  - 2026-10-24 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-10-24 Zug 5: committet 3e41351e (36 Dateien), Verify `paket-25.verify.log` exit=0 auf demselben Stand

## Abgleich

Gegen HEAD d559b0c7, Arbeitsbaum sauber.

| # | Stelle (aus `Folgen:` unter Paket 24) | Befund jetzt | Einordnung |
| --- | --- | --- | --- |
| F1 | `packages/twopoint5d/CHANGELOG.md:160` | Eintrag sagt »they resolve for an item that was built« auch für `on()` (löst nichts auf, stellt zu) und `whenReady()` (hat kein Item), nennt als Ablehnende nur `getAsync()`/`whenResource()` (auch `get()`, `acquireAsync()` lehnen ab) und liest sich, als gälte der Fehler für jedes `ready` | unverändert |
| F2 | `TextureStore.ts:473–476` | »a once() booked meanwhile would hear neither this ready nor a replay« — gilt nur im ersten `parse()` | unverändert |
| F3 | `TextureStore.ts:959–975` (Schleife, `catch` Z. 969–971), TSDoc `TextureStoreEvents` Z. 90–118, `parse()` Z. 919–931 | ein Wurf eines spät gebuchten Callbacks geht als `error` `{source: 'parse'}` hinaus, ein vor dem `parse()` gebuchter landet über `emitSafe()` auf der Konsole; keine TSDoc nennt das | unverändert |
| F4 | `TextureStore.spec.ts:3326–3362` | zwei Tests (`getAsync()`/`whenResource()` im ersten `parse()`); `on()`, `whenReady()`, `acquireAsync()`, Abmelde-Handle aus `#onReadyOnce()` (Z. 674–682), `dispose()` aus dem Listener und die Nachbuchung (`while`, Z. 966) ungetestet | unverändert |
| F5 | `docs/proposals/pipeline-stages-and-grid-base.md:203` (115 Zeichen), `docs/proposals/gpu-picking.md:264` (170) | Z. 203 hat 115 Zeichen, der Absatz Z. 200–207 sonst ≤ 99; in `gpu-picking.md` steht die 170-Zeichen-Zeile jetzt als Z. 263, dahinter Z. 264 (»drawn«, 7) und Z. 265 (169) | unverändert, eine Zeile verschoben |
| N1 | Queue-Eintrag: 14 Specs mit `toThrow(Klasse)` plus Teilstring | alle 14 Stellen unverändert an den genannten Zeilen; dasselbe Muster an 111 weiteren Stellen (Teil C) | unverändert, Umfang gewachsen |

Belege für die eventize-Semantik, an der F2 und F3 hängen (`@spearwolf/eventize` 6.2.0, Probe in
Zug 0 mit `retain(t, ['ready'])` und einem `once()`, das ein Listener während `emitSafe()` bucht):
im ersten Emit hört das `once()` nichts und erst das `ready` des nächsten Emits; ab dem zweiten
Emit hört es sofort, noch im Listener, den gehaltenen Wert des vorigen Emits und danach nichts
mehr. Ein Wurf eines Listeners innerhalb von `emitSafe()` geht an `console.warn` mit dem Präfix
`[eventize]` (`a listener threw; the dispatch continues. event: ready`), über eine beim Import
gebundene Funktion — ein `vi.spyOn(console, 'warn')` fängt ihn nicht.

Dazu für Teil C (Vitest 5.0.3, Probe in Zug 0): `expect(fn).toThrow(new RangeError('m'))` schlägt
fehl, wenn `fn` einen `TypeError` mit `'m'` wirft, und wenn die Meldung länger ist als `'m'`; es
prüft Klasse und ganze Meldung. Ein Paar aus Klassen- und Teilstringprüfung ist damit genau eine
Prüfung in voller Form.

## Triage

- **Folgen von Paket 24** (alle fünf, F1–F5): Symptome des `ready`-Fixes aus Paket 24, Runde 1
  (Doku, Kommentar und Tests nicht zu Ende gezogen; die Umbrüche aus der eigenen Änderung von
  Paket 24). Paket 24 ist committet, der Orchestrator hat sie diesem Nachtragspaket zugeschlagen
  (Entscheidung vom 2026-10-24, zweiter Schritt der Nachlese). Keine geht anderswohin.
- **Nebenbefund N1**: vorbestehend (`git show 7341059f:packages/twopoint5d/src/utils/assertFinite.spec.ts`
  Z. 8–9), zum Teil auch in diesem Lauf geschriebene Specs im selben Stil. Die Ursache ist eine:
  eine Abweisung wird in zwei Aufrufen geprüft, die Klasse für sich und die Meldung als Teilstring
  oder Regex. Ein Scan in Zug 0 fand das Paar an 125 Stellen in 32 Specs; die 14 der Queue sind
  darunter. Alle gehören in dieses Paket — nur die 14 umzustellen ließe dieselbe Ursache an 111
  Stellen halb behoben, und ins Audit gebucht stünden sie einem Release ohne offene Issues im Weg
  (Entscheidung vom 2026-10-24, Nachlese). Es ist dieselbe Ursache, kein neuer Nebenbefund; die
  Regel »was Paket 25 an Nebenbefunden aufdeckt, geht ins Audit« trifft sie deshalb nicht.
- **Kein Befund**, keine Queue-Zeile:
  - `toThrow(Klasse)` ohne Meldungsprüfung desselben Aufrufs (etwa 75 Stellen): keine Regel dieses
    Projekts verlangt die Meldung in jedem Abweisungstest; das Muster der Queue ist die doppelte
    Prüfung mit Teilstring, nicht die fehlende Meldung.
  - Der innere `parse()` aus einem `ready`-Listener setzt `#readyLate` im `finally` auf
    `undefined` statt auf den äußeren Wert (Reviewer Paket 24, Runde 1: »kein Befund«; ein danach
    gebuchtes `once()` hört den gehaltenen Wert des inneren `parse()` sofort, nichts hängt).
- Restplan: unverändert — 25 ist das letzte Paket, danach der Abschluss; dieses Paket ändert keine
  `public-api.ts` und keine Signatur.

## Entscheidungen in Zug 0

- **Fehlerweg (F3): Konsole statt `error`-Event.** Der Reviewer ließ zwei Wege offen: die Quelle
  in die TSDoc aufnehmen oder den Wurf denselben Weg gehen lassen wie innerhalb von `emitSafe()`.
  Gewählt ist der zweite. Der Mangel ist der ungleiche Weg — derselbe Abonnent landet auf der
  Konsole oder im `error`-Event, je nachdem, ob er vor oder während des `ready` gebucht wurde;
  Doku allein schriebe die Ungleichheit fest. Beide Wege sind über die öffentliche API kaum
  erreichbar (`resolve()`/`reject()` werfen nicht, den Wurf eines Replays fängt eventize ab), der
  Gleichlauf in die andere Richtung — auch der früh gebuchte als `error`-Event — bräuchte um jedes
  `once()` von `#onReadyOnce()` eine Hülle, die einen Replay beim Buchen von einem `ready` in
  `parse()` unterscheidet. Gemeldet wird mit `console.error` samt Fehler als zweitem Argument, wie
  die Library gefangene Würfe sonst meldet (`src/display/FrameLoop.ts:153`,
  `src/display/canvasHandover.ts:389`); das `error`-Event des Stores und `TextureStoreErrorEvent`
  bleiben unverändert. Die Änderung trifft nur Code aus d559b0c7, nichts Veröffentlichtes: kein
  CHANGELOG-Eintrag dafür.
- **Test der Konsole beim früh gebuchten Abonnenten**: nur, dass kein `error`-Event hinausgeht und
  `parse()` durchläuft — die Warnung von eventize lässt sich nicht abfangen (siehe Abgleich).
- **Umfang von N1**: alle 125 Paare, zwei bleiben (Meldungen der JS-Engine), Gründe in Teil C.

## Vorgehen

Zeilennummern gegen HEAD d559b0c7. Reihenfolge: Teil C zuerst (in `TextureStore.spec.ts` liegen
die Paare oberhalb des neuen Blocks, das hält die Zeilen stabil), dann A, B, D. Lies vor der
ersten Änderung `AGENTS.md` im Repo-Root.

### Teil A — `TextureStore`: Kommentar, Fehlerweg, TSDoc, Tests, CHANGELOG

**A1. Kommentar an `#readyLate`** (`packages/twopoint5d/src/texture/TextureStore.ts:473–475`)
ersetzen durch:

```ts
  // Set while ready goes out: what a listener of it books through #onReadyOnce() waits here and
  // hears this ready behind the last listener, ahead of the resource:<id> events. eventize writes
  // the retained ready value only after the last listener, so a once() booked meanwhile would hear
  // the ready of the parse() before at once, and in the first parse(), which has none before it,
  // no ready until the next parse()
  #readyLate: Array<() => void> | undefined;
```

**A2. Fehlerweg der Schleife** (`TextureStore.ts:963–972`). Erst der Regressionstest A5 (f), rot
sehen (heute: ein `error`-Event mit `source: 'parse'`, kein `console.error`), dann ändern. Der
Kommentar über der Schleife wird zu:

```ts
      // the subscriptions a listener of ready booked while it went out hear this ready now, as the
      // ones that were there before it did. One of them may book or give back another, so the list
      // is read until it is empty. A throw goes to the console, as emitSafe() reports the throw of a
      // subscription booked before the parse(), and the next one hears this ready all the same
```

und der `catch` (Z. 969–971) zu:

```ts
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: the report emitSafe() gives a subscription booked before the parse()
          console.error('TextureStore: a subscription that a listener of ready started threw as it heard that ready — parse() goes on', error);
        }
```

Bricht der Formatter den Aufruf um, bleibt der `biome-ignore` direkt über der Anweisung. Sonst
bleibt die Schleife, wie sie ist; `#onReadyOnce()` (Z. 673–682) bleibt unverändert.

**A3. TSDoc `TextureStoreEvents` › `Ready`** (`TextureStore.ts:93–95`): hinter »…even behind one
that throws.« den Satz anfügen:

> A `whenReady()`, `whenResource()`, `getAsync()`, `get()`, `acquireAsync()` or `on()` that a
> listener starts hears this `ready`, behind the last listener.

Die Liste der Fehlerquellen unter `Error` (Z. 106–117) bleibt unverändert.

**A4. TSDoc `parse()`** (`TextureStore.ts:919–921`): hinter »…and `parse()` goes on and returns as
usual.« den Satz einfügen, die übrigen Sätze des Absatzes bleiben:

> What a listener of `ready` starts — `whenReady()`, `whenResource()`, `getAsync()`, `get()`,
> `acquireAsync()`, `on()` — hears that `ready` behind the last listener of it, ahead of the
> `resource:<id>` events; should one of them throw as it hears it, the throw is reported on the
> console as well, and `parse()` goes on.

Umbruch des TSDoc-Absatzes bei etwa 100 Spalten wie seine Nachbarn.

**A5. Tests** in `packages/twopoint5d/src/texture/TextureStore.spec.ts`. Neuer Block
`describe('what a listener of ready starts hears that ready', () => { … })` direkt hinter dem Block
`describe('the reason an item built no resource', …)` (endet Z. 3362). Die beiden Tests
`a listener of ready hears why an item was refused` (Z. 3326) und `a listener of ready that asks
getAsync() for an item that was built hears its value` (Z. 3346) ziehen unverändert in den neuen
Block. Jeder neue Test stubbt `ImageLoader.prototype.loadAsync` wie Z. 3347–3349
(`async () => ({width: 4, height: 4}) as unknown as HTMLImageElement`), baut `new TextureStore()`
ohne Renderer, wartet mit `settleWithin()` (Z. 40) und endet mit `store.dispose()`. Ein
`ready`-Listener für den ersten `parse()` wird vor dem `parse()` mit `once(store,
TextureStoreEvents.Ready, …)` gebucht (noch kein gehaltener Wert, also kein Replay). `vi`-Mocks
stellt die Vitest-Konfiguration nach jedem Test zurück (`restoreMocks: true`). `TextureStoreLease`
kommt bei Bedarf als `type`-Import aus `./TextureStore.js` dazu.

- (a) `on() holds its resource before resource:<id> goes out, and hands its callback the value` —
  ein Listener von `resource:a` (vor dem `parse()` mit `on()` aus eventize gebucht, Eventname wie
  in `TextureStore.spec.ts:3463`) merkt sich `resource.refCount`; der `ready`-Listener ruft `store.on('a', 'imageCoords',
  callback)`; `store.parse({items: {a: {imageUrl: 'a.png'}}})`. Erwartet: der gemerkte `refCount`
  ist `1`; nach `const coords = await store.getAsync('a', 'imageCoords')` ist `callback` genau
  einmal mit `coords` gerufen.
- (b) `whenReady() resolves, and acquireAsync() holds the value of a built item and rejects for a
  refused one with the reason` — der `ready`-Listener startet `store.whenReady()`,
  `store.acquireAsync('a', 'imageCoords')` (`settleWithin(…, 1000)`) und
  `store.acquireAsync('b', 'imageCoords')`; `store.parse({items: {a: {imageUrl: 'a.png'}, b:
  {tileSet: 5}}} as never)`. Erwartet: `whenReady()` liefert `store`; die Lease trägt als `value`
  dasselbe Objekt wie `await store.getAsync('a', 'imageCoords')`, und der `refCount` der Ressource
  `a` (über `await store.whenResource('a')`) ist `1`, nach `lease.release()` `0`; die Ablehnung für
  `b` ist `new Error('TextureStore: no resource with id "b" — its item builds no resource: tileSet
  is 5, not an object')` (Wortlaut wie im Test Z. 3284–3286).
- (c) `a subscription given back at once leaves the others it started in their place` — der
  `ready`-Listener ruft `const giveBack = store.on('a', 'imageCoords', released)`, dann
  `store.on('a', 'imageCoords', heard)`, dann `giveBack()`, dann `missing =
  settleWithin(store.getAsync('x', 'imageCoords'))`; `parse()` mit `a` wie in (a). Erwartet:
  `released` nie gerufen, `heard` genau einmal mit den `coords` aus `await store.getAsync('a',
  'imageCoords')`, `missing` ist `new Error('TextureStore: no resource with id "x" — check your
  TextureStoreData.items keys.')`.
- (d) `dispose() behind a getAsync() and a whenReady() it started cancels both, and parse() returns`
  — der `ready`-Listener startet `settleWithin(store.getAsync('a', 'imageCoords'))` und
  `settleWithin(store.whenReady())` und ruft danach `store.dispose()`. Erwartet:
  `expect(() => store.parse({items: {a: {imageUrl: 'a.png'}}})).not.toThrow()`; der erste ist
  `new Error('TextureStore: getAsync("a", "imageCoords") was cancelled: this store has been
  disposed')`, der zweite `new Error('TextureStore: whenReady() was cancelled: this store has been
  disposed')` (`disposedError()`, `TextureStore.ts:202`). Kein `store.dispose()` am Ende nötig.
- (e) `what a subscription it started books in turn hears the same ready` — im zweiten `parse()`:
  `store.parse({items: {a: {imageUrl: 'a.png'}}})`, `await store.getAsync('a', 'imageCoords')`
  (der Wert ist jetzt gehalten). Dann `let armed = false` und `on(store, TextureStoreEvents.Ready,
  () => { if (!armed) return; armed = false; store.on('a', 'imageCoords', () => { missing ??=
  settleWithin(store.getAsync('x', 'imageCoords')); }); })` — der Listener hört beim Buchen den
  gehaltenen Wert und kehrt dank `armed` zurück. `armed = true`, zweiter `store.parse({items: {a:
  {imageUrl: 'a.png'}}})`. Erwartet: `missing` ist direkt nach dem `parse()` gesetzt (`on()` hat
  den gehaltenen Wert noch in diesem `ready` zugestellt), und `await missing` ist die Ablehnung
  für `x` wie in (c).
- (f) Regressionstest zu A2, vor dem Fix rot: `a throw of what it starts goes to the console, and
  the parse goes on to the next one and to resource:<id>` —
  `const thrown = new Error('activate threw')`, `vi.spyOn(TextureResource.prototype,
  'activate').mockImplementation(() => { throw thrown; })` (`activate()` ruft nur
  `#subscribeToResource()`, `TextureStore.ts:1337`), `const consoleError = vi.spyOn(console,
  'error').mockImplementation(() => {})`, Fehler-Events in einer Liste
  (`on(store, TextureStoreEvents.Error, …)`), ein Spy auf `resource:a`. Der `ready`-Listener ruft
  `store.on('a', 'imageCoords', () => {})` und `missing = settleWithin(store.getAsync('x',
  'imageCoords'))`. Erwartet: `parse()` wirft nicht; `consoleError` genau einmal mit
  `('TextureStore: a subscription that a listener of ready started threw as it heard that ready —
  parse() goes on', thrown)`; die Liste der Fehler-Events ist leer; der Spy auf `resource:a` genau
  einmal gerufen; `missing` ist die Ablehnung für `x` wie in (c).
- (g) `booked before the parse(), the same throw sends no error event either` — dieselben Mocks
  wie (f), aber `store.on('a', 'imageCoords', () => {})` vor dem `parse()`; erwartet: `parse()`
  wirft nicht, die Liste der Fehler-Events ist leer. Die Warnung von eventize auf der Konsole wird
  nicht geprüft (Abgleich: nicht abfangbar). War vor dem Fix schon grün; das gehört so in den
  Report.

**Sabotage-Läufe** (je einzeln einbauen, den Spec laufen lassen, rot sehen, zurücknehmen; der rote
Lauf gehört in den Report): S1 — `#onReadyOnce()` bucht immer `once(this, OnReady, hear)` (die
Zeile mit `late === undefined` ohne Bedingung) → (a), (b) und die beiden verschobenen Tests rot;
S2 — `late.splice(at, 1)` wird `late.splice(at)` → (c) rot (`heard` nie gerufen); S3 — die
`while`-Schleife wird ein einziger Durchgang über `late.splice(0)` → (e) rot (`missing` bleibt
`'pending'`).

**A6. CHANGELOG** (`packages/twopoint5d/CHANGELOG.md:160`, `## [Unreleased]` → `### Fixed`): den
Eintrag ersetzen durch

```markdown
- a `whenReady()`, `whenResource()`, `getAsync()`, `get()`, `acquireAsync()` or `on()` of a `TextureStore` that a listener of the first `ready` of the store starts hears that `ready`, as one started after the `parse()` does: `whenReady()` resolves, `on()` follows the resource of its id from this `ready` on, and `whenResource()`, `getAsync()`, `get()` and `acquireAsync()` resolve for an item that was built and reject for an item that built no resource with the reason
```

Eine Zeile wie die Nachbareinträge. Sonst nichts im CHANGELOG: Teil B und C sind nicht
nutzersichtbar, A2 trifft nur Unveröffentlichtes.

### Teil B — zwei Absätze der Proposals neu umbrechen

Nur Umbruch, kein Wort ändert sich (`git diff --word-diff` dieser Dateien zeigt nur
Zeilenwechsel), Zielbreite höchstens 100 Zeichen, Folgezeilen eines Listenpunkts mit zwei
Leerzeichen wie jetzt. Ein Code-Span darf an einem Leerzeichen brechen, wie es die Dateien schon
tun (`gpu-picking.md:261–262`, `pipeline-stages-and-grid-base.md:201–202`).

- B1. `packages/twopoint5d/docs/proposals/pipeline-stages-and-grid-base.md:200–207` — der
  Listenpunkt »**Refusals**« ganz.
- B2. `packages/twopoint5d/docs/proposals/gpu-picking.md:263–265` — im Listenpunkt der
  Abweisungen von `pick()` (ab Z. 257) der Rest ab »A listed mesh of more than 2²⁴ sprites« bis
  zum Ende des Listenpunkts (»… meshes of at most 16777216`).«); Z. 257–262 bleiben, Z. 263 endet
  nach »the picker draws FeatureSprites alone`).« oder bricht im Satz bei höchstens 100 Zeichen.

Andere überlange Zeilen dieser Dateien (Tabellen, Code-Blöcke) bleiben.

### Teil C — Abweisungen in den Specs: Klasse und volle Meldung in einer Prüfung

Das Muster: derselbe Aufruf wird zweimal geprüft, einmal mit `toThrow(Klasse)` und einmal mit
`toThrow('Teilstring')`, `` toThrow(`…`) `` oder `toThrow(/Regex/)` (auch als
`.rejects.toThrow(…)`). Daraus wird eine Prüfung in voller Form, wie
`packages/twopoint5d/src/controls/PanControl2D.spec.ts:527`:

```ts
expect(() => makeControl({speed})).toThrow(new RangeError(`PanControl2D: speed must be a finite number, got ${written}`));
```

Regeln:

1. Ein Paar wird eine Prüfung `expect(<Aufruf>).toThrow(new <Klasse>(<volle Meldung>))` bzw.
   `await expect(<Promise>).rejects.toThrow(new <Klasse>(<volle Meldung>))` an der Stelle der
   beiden. Trägt eine der beiden ein Label (`expect(run, 'the message names …')`), bleibt es
   stehen; tragen beide eins, das der Meldungsprüfung.
2. Die Klasse ist die, die der Code wirft (an allen Stellen `RangeError` oder `TypeError`).
3. Die volle Meldung: ein String, der schon die ganze Meldung ist, bleibt, wie er ist; ein
   Teilstring oder eine Regex wird zur ganzen Meldung — aus der Abweisung im Quelltext, und wo sie
   zusammengesetzt ist (`describeValue()`, Zahlen, Listen), aus einem Lauf des Specs: Vitest zeigt
   die erhaltene Meldung. In einem `test.each` mit wechselndem Wert kommt dessen geschriebene Form
   als Spalte in die Tabelle, wo sie fehlt, wie in `src/utils/assertFinite.spec.ts:12–18`
   (`[NaN, 'NaN']`); ein Template-Literal mit `${…}` bleibt, wo es die ganze Meldung ergibt.
4. Zwei Aufrufe mit Absicht bleiben zwei Prüfungen, jede in voller Form:
   `map2d/RectangularVisibilityArea.spec.ts:349–350` (»the same call again, instead of the result
   around [0, 0]«) und `map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts:44–48` (»the refusal is not
   cached: the next read throws again«), der Kommentar dazwischen bleibt. In
   `vertex-objects/VertexObjectDescriptor.spec.ts:354–356` ist das Paar
   `build({attributes: {a: {size: 5}}})`; die Klassenprüfung für `components` (Z. 355) bleibt, wie
   sie ist.
5. Zwei Paare bleiben unverändert, weil ihre Meldung von der JS-Engine stammt, nicht von der
   Library (ein Schreibzugriff auf einen Getter ohne Setter; die volle Meldung bände den Spec an
   V8): `map2d/CameraBasedVisibility.spec.ts:344–346` (der Kommentar Z. 345 sagt es) und
   `texture/TextureStore.spec.ts:2597–2598` (Schreiben von `refCount`).
6. Ein Kommentar zwischen den beiden, der nur die Wahl von Teilstring oder Regex erklärt, entfällt;
   einer, der weiter stimmt, bleibt (`vertex-objects/VertexObjectBuffer.spec.ts:1107` »a string,
   not a RegExp: the text of 1.5 holds a dot« stimmt weiter).
7. Nicht im Umfang: `toThrow(Klasse)` ohne Meldungsprüfung desselben Aufrufs und Meldungsprüfungen
   ohne Klassenprüfung (etwa `assertFinite.spec.ts:17`). Kein Testname ändert sich, kein
   Quelltext außerhalb der Specs.

Die Paare, gegen HEAD d559b0c7 — je Klassenprüfung/Meldungsprüfung, alle Pfade unter
`packages/twopoint5d/`. Ein Paar desselben Musters, das die Liste nicht nennt, gehört dazu; ein
gelistetes, das sich als etwas anderes erweist, bleibt und steht mit Grund im Report.

- `src/display/FrameLoop.spec.ts` (1): 248/245
- `src/map2d/CameraBasedVisibility.spec.ts` (2): 344/346 (bleibt, Regel 5), 855/856
- `src/map2d/CameraBasedVisibilityHelpers.spec.ts` (2): 492/493, 516/517
- `src/map2d/Map2D.spec.ts` (2): 205/206, 226/227
- `src/map2d/Map2DSpatialHashGrid.spec.ts` (5): 35/36, 43/44, 45/46, 310/311, 333/334
- `src/map2d/Map2DTileCoordsUtil.spec.ts` (9): 39/40, 45/46, 52/53, 60/61, 70/71, 76/77, 88/89,
  99/100, 319/320
- `src/map2d/Map2DTileStreamer.spec.ts` (6): 157/158, 163/164, 171/172, 173/174, 228/229, 230/231
- `src/map2d/RectangularVisibilityArea.spec.ts` (9): 284/285, 316/317, 350/349 (Regel 4),
  431/432, 496/497, 503/504, 510/511, 518/519, 527/528
- `src/map2d/RectangularVisibilityAreaHelpers.spec.ts` (1): 209/210
- `src/map2d/RepeatingTilesProvider.spec.ts` (5): 84/85, 352/353, 374/375, 383/384, 408/409
- `src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts` (4): 33/34, 35/36, 45/46 und 48/49 (Regel 4)
- `src/sprites/features/PaletteSwap.spec.ts` (1): 94/95
- `src/sprites/features/TableFrame.spec.ts` (1): 70/71
- `src/stage/StageRenderer.spec.ts` (1): 2915/2916
- `src/text/BitmapFont.spec.ts` (1): 444/445
- `src/text/layoutText.spec.ts` (1): 371/372
- `src/text/writeText.spec.ts` (2): 152/153, 169/170
- `src/texture/AsepriteJson.spec.ts` (4): 405/406, 414/415, 432/433, 441/442
- `src/texture/AtlasFrameTable.spec.ts` (1): 120/121
- `src/texture/FrameTable.spec.ts` (1): 163/164
- `src/texture/TextureAtlas.spec.ts` (1): 302/303
- `src/texture/TextureCoords.spec.ts` (1): 269/270
- `src/texture/TexturePackerJson.spec.ts` (2): 280/281, 289/290
- `src/texture/TextureResource.spec.ts` (6): 1912/1913, 1929/1930, 1946/1947, 1977/1978,
  2059/2060, 2157/2158
- `src/texture/TextureStore.spec.ts` (7): 1659/1660, 1677/1678, 2171/2172, 2597/2598 (bleibt,
  Regel 5), 3051/3052, 3060/3061, 3080/3081
- `src/texture/TileSet.spec.ts` (12): 103/104, 109/110, 114/115, 121/122, 126/127, 135/136,
  144/145, 154/155, 186/187, 194/195, 201/202, 209/210
- `src/texture/TileSetLoader.spec.ts` (1): 24/25 (`rejects`)
- `src/utils/assertFinite.spec.ts` (1): 8/9
- `src/utils/assertPositiveFinite.spec.ts` (1): 8/9
- `src/vertex-objects/VertexObjectBuffer.spec.ts` (19): 438/439, 453/454, 469/470, 484/485,
  493/494, 523/524, 554/555, 578/579, 597/598, 769/770, 780/781, 798/799, 1047/1048, 1059/1060,
  1067/1068, 1106/1108, 1114/1115, 1123/1124, 1236/1237
- `src/vertex-objects/VertexObjectDescriptor.spec.ts` (7): 354/356 (Regel 4), 362/363, 369/370,
  407/408, 417/418, 425/426, 449/450
- `src/vertex-objects/VertexObjectPool.spec.ts` (8): 605/606, 613/614, 621/622, 1091/1092,
  1097/1098, 1114/1115, 1133/1134, 1145/1146

Summe 125 Paare, davon 123 umzustellen. Kein Sabotage-Lauf nötig: die volle Form schlägt bei
falscher Klasse oder Meldung fehl, der grüne Lauf ist der Beleg. Der Report nennt je Datei die
Zahl der umgestellten Paare und jede Abweichung von der Liste.

### Teil D — Gate

`pnpm run ci` aus dem Repo-Root, exit 0. `pnpm format` vorher, wenn `pnpm lint` an Umbrüchen
hängt.

## Was dieses Paket nicht tut

- Keinen anderen Weg für den vor dem `parse()` gebuchten Abonnenten; `#onReadyOnce()` und die
  Buchung bleiben.
- Keine neue Fehlerquelle in `TextureStoreEvents` › `Error` und kein neues Feld in
  `TextureStoreErrorEvent`.
- `#readyLate` im `finally` bleibt `undefined` (verschachtelter `parse()`, kein Befund).
- Keine Klassen- oder Meldungsprüfung ohne Gegenstück (Teil C, Regel 7), keine Spec außerhalb der
  Liste, kein Testname.
- Keine anderen überlangen Zeilen der beiden Proposals.

## Folgen und Nebenbefund im Volltext

Aus dem Urteil des Reviewers zu Paket 24, Runde 1 (`paket-24.review-1.json` im
Arbeitsverzeichnis des Laufs), Abschnitt »Qualität« und Befund 3:

**klein: `CHANGELOG.md:160` sagt bei zwei Methoden etwas Falsches zu.** »they resolve for an item
that was built« passt nicht zu `on()`, das nichts auflöst, sondern Werte zustellt. Es passt auch
nicht zu `whenReady()`, das kein Item hat. Außerdem betraf der Fehler nur den **ersten**
`parse()`. Ab dem zweiten spielt eventize einem neu gebuchten `once()` sofort das `ready` des
vorigen `parse()` vor. Der Eintrag liest sich aber, als hätte jedes `ready` nicht gegriffen.

**klein: der Kommentar `TextureStore.ts:473–475` gilt nur für den ersten `parse()`.** Dort steht:
»a once() booked meanwhile would hear neither this ready nor a replay«. Ab dem zweiten `parse()`
bekommt so ein `once()` sofort einen Replay, nämlich den gehaltenen Wert des vorigen `ready`. Für
den ersten `parse()` trägt die Begründung, aber der Satz behauptet mehr.

**klein: der Fehlerweg beim Abarbeiten ist undokumentiert und ungetestet,
`TextureStore.ts:966–971`.**
- Wirft ein spät gebuchter Callback, geht das als `error`-Event mit `source: 'parse'` hinaus.
- Derselbe Callback, vor dem `ready` gebucht, wirft innerhalb von `emitSafe` und landet nur auf
  der Konsole. Der Weg hängt also davon ab, wann gebucht wurde.
- Weder die Liste der Fehlerquellen in der TSDoc von `TextureStoreEvents` (`:105–117`) noch die
  TSDoc von `parse()` nennt diese Quelle.
- Praktisch kaum erreichbar: Ein Wurf aus einem Replay fängt eventize ab (`publishReplays` warnt
  nur), `reject()` und `resolve()` werfen nicht. Entweder in die Fehlerquellen aufnehmen, oder den
  Wurf denselben Weg gehen lassen wie im `emitSafe`.

**klein: die Tests decken nur einen Teil der Zusage ab, `TextureStore.spec.ts:3326–3362`.** Beide
Specs prüfen `getAsync()` und `whenResource()` beim ersten `parse()`. Folgende Fälle, die der
CHANGELOG ausdrücklich zusagt oder die neu entstanden sind, prüft kein Test:
- `on()` aus einem `ready`-Listener bekommt seinen Wert, vor dem `resource:<id>`-Event;
- `whenReady()` und `acquireAsync()` aus einem `ready`-Listener;
- das Abmelde-Handle aus `#onReadyOnce()` (`:678–681`), also ein `on()`, das der Listener bucht
  und gleich wieder freigibt; ein kaputtes `splice` stellte einem abgemeldeten Callback still
  Werte zu;
- `dispose()` aus einem `ready`-Listener, nachdem ein anderer schon ein `getAsync()` gebucht hat:
  es lehnt mit dem Disposed-Fehler ab, und der Eintrag verschwindet über `settlement`;
- ein spät gebuchter Callback, der selbst noch einen weiteren bucht; dafür läuft die
  `while`-Schleife.

(Zu »ein kaputtes `splice` stellte einem abgemeldeten Callback still Werte zu«, Zug 0: ein
abgemeldetes `on()` hat seinen Follower schon disposed, `follow()` tut dann nichts — beobachtbar
ist ein `splice`, das mehr als den eigenen Eintrag nimmt; darauf zielt Test (c) mit S2.)

**klein: Umbruchbreiten, Befund 3, nur teilweise erledigt.**
- `docs/proposals/pipeline-stages-and-grid-base.md:203`: nicht erledigt. Der Umbruch hat den
  Überhang nur nach unten geschoben, die Zeile hat jetzt **115** Zeichen; der Absatz hält sonst
  etwa 100.
- `docs/proposals/gpu-picking.md:264`: nicht erledigt, und schlimmer als vorher. Die Zeile
  »FeatureSprites, got Group — … A listed mesh of more than 2²⁴ sprites rejects the pick with a
  `RangeError` before anything is« hat **170** Zeichen, vor der Runde waren es höchstens 104. Ab
  »A listed mesh« hätte der Rest des Absatzes neu umbrochen werden müssen. `:265` (169 Zeichen)
  stammt schon von HEAD und gehört nicht zu diesem Befund.

(Zug 0: Z. 265 ist der Rest desselben Satzes ab »A listed mesh«; Teil B2 bricht sie mit um.)

**Nebenbefund aus der Queue** (eingetragen von Paket 24): `packages/twopoint5d/src/utils/assertFinite.spec.ts:8–9`,
`src/utils/assertPositiveFinite.spec.ts:8–9`, `src/vertex-objects/VertexObjectBuffer.spec.ts:493`,
`:1123`, `:1236`, `src/vertex-objects/VertexObjectPool.spec.ts:605`, `:613`, `:621`, `:1091`,
`:1097`, `src/texture/TextureResource.spec.ts:1912`, `:1929`, `:1946`, `:2157` — prüfen eine
Abweisung als `toThrow(Klasse)` plus Teilstring `toThrow('…')` statt in einem
`toThrow(new Klasse(volle Meldung))`, wie es Paket 24 in den Sprite- und Texture-Specs eingeführt
hat; am Laufbeginn schon so (`git show 7341059f:…assertFinite.spec.ts`, Z. 8–9) · Paket 24 · low
→ Scope · in Paket 25 aufgenommen (Nachlese)

## Urteil des Reviewers (Zug 3, `paket-25.review-0.json`)

| Stelle | Urteil | Fundstelle |
| --- | --- | --- |
| F1 CHANGELOG | behoben, wortgleich mit A6 | `packages/twopoint5d/CHANGELOG.md:160` |
| F2 Kommentar `#readyLate` | behoben, wortgleich mit A1 | `packages/twopoint5d/src/texture/TextureStore.ts:474–479` |
| F3 Fehlerweg und TSDoc | behoben: `console.error(msg, error)` mit `biome-ignore` samt Grund, TSDoc `Ready` (A3) und `parse()` (A4) | `TextureStore.ts:969–982`, `:95–96`, `:924–928` |
| F4 Tests | behoben: neuer Block, zwei Tests verschoben, (a)–(g); (f) vor A2 rot, S1–S3 rot | `packages/twopoint5d/src/texture/TextureStore.spec.ts:3339–3554` |
| F5 Umbrüche | behoben, Word-Diff nur Zeilenwechsel, ≤ 100 Zeichen | `docs/proposals/pipeline-stages-and-grid-base.md:200–207`, `docs/proposals/gpu-picking.md:263–266` |
| N1 / Teil C | behoben: 123 Paare umgestellt, Zahl je Datei wie in der Liste; Regel 5 (`CameraBasedVisibility.spec.ts:344–346`, `TextureStore.spec.ts:2608–2609`) unverändert; Scan fand kein vergessenes Paar | alle 32 Specs |

Kleine Befunde (keine Runde):

- `TextureStore.spec.ts:3539–3554`, Test (g): prüft nicht, dass der Wurf geschah — hörte das früh gebuchte `on()` das `ready` nicht, bliebe er grün; ein `expect(TextureResource.prototype.activate).toHaveBeenCalled()` hielte es fest. Die Paketdatei verlangt nur »wirft nicht, keine Fehler-Events«.
- `TextureStore.spec.ts:3401–3428`, Test (b): auch `acquireAsync('b', …)` bekommt die 1000 ms von `settleWithin`, vorgegeben nur für `a`; harmlos.

Aus dem Report des Implementierers: Kommentar `// a string per case, not one RegExp: the text of 1.5 holds a dot` in `VertexObjectPool.spec.ts` (um Z. 1085) bleibt stehen, der Reviewer hält ihn für weiter zutreffend (Regel 6).
