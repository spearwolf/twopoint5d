# Paket 23 — Drain 2: DisplayFullscreen — fremder Fullscreen sperrt onLandscape, Verlassen im Querformat

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (zwei Nebenbefunde aus »Offene Befunde«, in der Drain-Runde 2 hierher überführt; Volltext unten)
- Ziel: `onLandscape` fragt nicht an und schaltet nicht scharf, solange ein anderes Element als das Ziel im Fullscreen liegt, und jedes Verlassen im Querformat hält den Nutzer draußen, bis das Gerät aufrecht und zurück gedreht ist — nach den beiden Einträgen der Drain-Runde 2 unter »Entscheidungen«; Getter, TSDoc (auch `types.ts:72ff.`), Proposal §3.2 und Guide sagen dasselbe.
- Modell: stärkste Stufe — der Zustandsautomat von `DisplayFullscreen` hängt an der Reihenfolge von Promise-Reaktionen und `fullscreenchange`, und fünf Stellen, die `#declined` setzen, müssen zusammen umgestellt werden; Paket 5 brauchte an dieser Datei fünf Runden.
- Effort: medium — die Code-Änderungen sind unten exakt vorgegeben, Tests und Doku-Sätze mit Inhalt und Zielwortlaut.
- Dateien: `packages/twopoint5d/src/display/DisplayFullscreen.ts`, `packages/twopoint5d/src/display/DisplayFullscreen.spec.ts`, `packages/twopoint5d/src/display/types.ts`, `packages/twopoint5d/docs/display.md`, `packages/twopoint5d/docs/proposals/display-fullscreen.md`. Kein CHANGELOG, kein Browser-Test, nichts unter `apps/lookbook/`.
- Vorgehen: siehe Abschnitt »Vorgehen« unten (Schritte 1–6).
- Verify: `pnpm run ci` (im Repo-Root; nie parallel zu einem zweiten Gate oder Build). Rot/Grün der neuen Specs: `cd packages/twopoint5d && pnpm vitest --run src/display/DisplayFullscreen.spec.ts`
- Commit: `fix(twopoint5d): keep onLandscape from asking or arming while another element is in fullscreen, and hold off its arming after every fullscreen the user leaves in landscape`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · Nebenbefund »fremder Fullscreen« besteht, verschoben (`#turned()` `DisplayFullscreen.ts:894-929`, Wächter `:919`; `#holdsTarget()` `:949-953`; Setter `:347-371`, Wächter `:359`; `#rearm()` `:934-947`, Wächter `:940`; `#onArmedTap` `:282-291` unverändert; Klassen-TSDoc `:199-202`) · Nebenbefund »`#declined` nur für den eigenen Fullscreen« besteht (`docs/display.md:510-511` unverändert; `#readState()` `:802-814`, Bedingung `:808`; dazu dieselbe Einschränkung in `#exit()` `:703` und `#leavePseudo()` `:990`) · beide vorbestehend (an d9b648bf `:464` `#entered === 'landscape'`, `:603` `pseudo.by === 'landscape'`, `#turned()` mit `isActive` allein) · keine offenen Folgen im Plan, keine weiteren offenen Einträge in »Offene Befunde« außer dem von Paket 24 (andere Ursache) · Restplan unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, Effort medium), Brief `paket-23.impl-0.brief.txt`, Report nach `paket-23.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG · geändert `src/display/DisplayFullscreen.ts`, `DisplayFullscreen.spec.ts`, `types.ts`, `docs/display.md`, `docs/proposals/display-fullscreen.md` · roter Lauf 21 failed / 189 passed, danach 210 passed · Arbeitsbaum schmutzig · eigenes Verify `pnpm run ci` exit=0 (`paket-23.verify.log`)
  - 2026-11-01 Zug 3: Reviewer beauftragt (opus, Effort medium), Diff `paket-23.diff`, Report nach `paket-23.review-0.json`
  - 2026-11-01 Zug 3: Urteil FREIGABE · beide Nebenbefunde und Schritte 1–6 erfüllt · keine kritischen oder wichtigen Befunde · 4 klein · Report `paket-23.review-0.json`
  - 2026-11-01 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-01 Zug 5: Commit f02c7d86 auf dem Verify-Lauf aus Zug 2 (`paket-23.verify.log`, exit=0, seither keine Codeänderung)

## Abgleich

Stand des Codes: `src/display/` zuletzt in 8379ebe7 (Paket 22, nur `types.ts`) und
1a8ec51e (Paket 18) geändert; Arbeitsbaum sauber.

**Nebenbefund 1 — `onLandscape` zieht das Ziel über einen fremden Fullscreen.** Besteht.
`#holdsTarget()` (`DisplayFullscreen.ts:951-953`) ist `this.isActive || this.#activeElement != null`;
`isActive` liest über `#nativeElement()` (`:579-584`) nur, ob das *Ziel* das Fullscreen-Element seiner
Root ist, und `#activeElement` setzt `#readState()` (`:798-801`) nur, wenn das Ziel selbst oben lag.
Ein Element, das in den Fullscreen geht, während das Ziel nicht im Stapel ist — ein Video im Ziel,
ein Element außerhalb —, ist für den Controller unsichtbar. Folgen an den Fundstellen von heute:

- `#turned()` `:919` (`if (this.#holdsTarget() || this.#declined || !this.#gateIsOpen()) return;`) —
  die Drehung ins Querformat ruft `#request('landscape', false)` `:928`, das Ziel wird über den
  fremden Fullscreen gezogen.
- Setter `onLandscape` `:359` (`else if (!this.#holdsTarget())`) — schaltet scharf bzw. betritt den
  Pseudo-Modus.
- `#rearm()` `:940` (`!this.#holdsTarget()`) — eine abgelehnte Anfrage schaltet scharf, auch wenn
  inzwischen ein fremdes Element im Fullscreen liegt.
- `#readState()` `:791-817` — ein `fullscreenchange`, das einen fremden Fullscreen bringt, entschärft
  nicht; ein scharfer Controller bleibt scharf, und der Tap auf das Video läuft in der Capture-Phase
  über `#onArmedTap` `:282-291` am Ziel vorbei und fragt das Ziel an.
- Shadow DOM: `fullscreenElementOfRoot()` `:68-70` liest die Root des Ziels; eine Shadow Root nennt
  ein Fullscreen-Element außerhalb nicht (`fullscreenElement` ist dort `null`). »Egal wo das Element
  liegt« verlangt daher zusätzlich `this.#host.doc.fullscreenElement`.

**Nebenbefund 2 — `#declined` nur für den Fullscreen von `onLandscape`.** Besteht. Der Guide-Satz
steht unverändert in `docs/display.md:510-511`. Die Einschränkung auf `'landscape'` steht an drei
Stellen, nicht nur an der genannten:

- `#readState()` `:808` — `this.#pendingExit == null && this.#entered === 'landscape' && this.#onLandscape && this.#isLandscape()`
- `#exit()` `:703` — `declines = by === 'call' && this.#onLandscape && this.#isLandscape() && this.#enteredBy() === 'landscape'`
- `#leavePseudo()` `:990` — `pseudo.by === 'landscape' && this.#onLandscape && this.#isLandscape()`

Dazu die zwei Stellen, die einen notierten Rückzug anwenden und unverändert richtig sind, sobald
`declines` nicht mehr am Betreter hängt: Ablehnung im `#request()` `:682`, Settle in `#leaveNative()`
`:747`. `#turned()` `:922-928` (in der Fundstelle genannt) liest `#declined` nur; es ändert sich
dort nichts außer dem Wächter aus Nebenbefund 1.

Vorbestehend: an d9b648bf `#readState()` mit `#entered === 'landscape'` (`:464`), `#leavePseudo()`
mit `pseudo.by === 'landscape'` (`:603`), `#turned()` mit `this.isActive` allein — nachgesehen mit
`git show d9b648bf:packages/twopoint5d/src/display/DisplayFullscreen.ts`.

**Triage.** Unter den erledigten Paketen steht keine offene `Folgen:`-Zeile (alle `keine` oder
verteilt). In »Offene Befunde« ist außer den beiden Einträgen dieses Pakets nur der von Paket 24
offen (handgesetzte Anführungszeichen in Meldungen) — andere Ursache, bleibt bei 24. Paket 23 fügt
keine Meldung hinzu und ändert keine.

## Wahl mit Grund

1. **Wer »fremder Fullscreen« ist.** Jedes Fullscreen-Element des Dokuments oder der Root des
   Ziels, solange das Ziel nicht selbst im Fullscreen ist oder unter einem darauf gestapelten Element
   liegt (`#holdsTarget()`). Gelesen über `this.#host.doc.fullscreenElement` *und*
   `fullscreenElementOfRoot(this.element)`: das Dokument sieht jeden Fullscreen (ein Element in einer
   Shadow Root erscheint dort als Host), die Root deckt ein Ziel ab, dessen Dokument nicht `host.doc`
   ist. Ein Video *im* Ziel, das in den Fullscreen geht, während das Ziel es nicht ist, zählt als
   fremd — so verlangt es die Entscheidung (»egal wo das Element liegt«), und das Ziel darüber zu
   ziehen wäre genau das Stehlen.
2. **`#lock()` bleibt auf `#holdsTarget()`.** Dort heißt die Frage »hält das Ziel noch seinen
   Fullscreen«, nicht »sperrt etwas `onLandscape`«; ein fremder Fullscreen ist kein Grund, eine Sperre
   des Ziels zu behalten.
3. **Die Seite darf.** Entscheidung 1 bindet `onLandscape`, nicht `request()`: ein `request()` der
   Seite neben einem fremden Fullscreen fragt weiter an (»whoever asked for a fullscreen decides«,
   Proposal §6.3). Ein Spec hält das fest.
4. **Ende eines fremden Fullscreens im Querformat setzt `#declined`.** Die Entscheidung der
   Drain-Runde 2 sagt »jedes Verlassen eines Fullscreens im Querformat … gleich wer ihn betreten hat«.
   Die Alternativen sind schlechter: nichts tun ließe den Controller im Querformat ohne Fullscreen,
   unscharf und ohne Rückzug zurück — ein Zustand, den es sonst nicht gibt, und eine halbe Drehung
   zöge ihn in den Fullscreen; wieder scharf schalten wäre die Falle, gegen die die Regel existiert
   (der Nutzer hat eben einen Fullscreen verlassen). Erkannt über ein Feld `#foreignHeld`, das
   `#readState()` nach jedem `fullscreenchange` fortschreibt — nur ein echter Übergang von »fremder
   Fullscreen« zu »gar kein Fullscreen« zählt, ein `fullscreenchange` ohne Änderung nicht.
5. **`#declined` schließt Scharfsein aus.** Neu ist ein Zustand »scharf und zurückgezogen«: ein
   `request()` der Seite, während der Controller scharf ist (Knopf außerhalb des Ziels, Taste), dann
   `exit()` im Querformat vor der Antwort, und der Browser lehnt ab. Bisher entstand er nicht, weil
   `declines` für einen Request der Seite nie galt. Eine Hilfe `#decline()` setzt `#declined` und
   entschärft; jede Stelle, die zurückzieht, ruft sie. Die Ablehnung im `#request()` emittiert danach
   über `#emitIfChanged()` — sie emittiert damit nur, wenn sich `isArmed` geändert hat; »a refusal
   emits nothing« bleibt für jede Ablehnung ohne diesen Rückzug wahr.
6. **Ein Wächter im scharfen Tap.** `#readState()` entschärft beim `fullscreenchange` des fremden
   Fullscreens. Zwischen dem Moment, in dem der Browser das Element zum Fullscreen-Element macht, und
   dem Event (es kommt erst im nächsten Rendering-Update) kann ein Tap liegen; `#onArmedTap` prüft
   deshalb vor der Anfrage selbst.
7. **`#foreignHeld` im Konstruktor** aus dem Zustand initialisieren: ein Display, das gebaut wird,
   während ein Video im Fullscreen liegt, zieht sich nach dessen Ende im Querformat ebenso zurück. Der
   Konstruktor liest `this.element` schon heute (Setter `onLandscape` → `#holdsTarget()`).
8. **Kein CHANGELOG.** Fullscreen ist unveröffentlicht (nur unter `## [Unreleased]`); die
   »Added«-Zeile `packages/twopoint5d/CHANGELOG.md:28` (»the user who leaves in landscape is not thrown
   back in until the screen has turned upright and back«) wird erst durch dieses Paket uneingeschränkt
   wahr, und den Stapel-Fall nennt sie ebenso wenig. Wie in den Paketen 15, 18 und 22.
9. **Kein Browser-Test.** `onLandscape` liegt hinter dem Geräte-Gate und einer Drehung, die kein
   Runner macht; die Specs modellieren `fullscreenElement` von Dokument und Root, wie der Browser es
   liest. Wie Paket 15.
10. **Geänderte Bestands-Specs.** Zwei Zeilen der Tabelle `the refusal an exit() of the page sets in
    landscape belongs to that call: the last call wins` (`DisplayFullscreen.spec.ts:1540`, `:1542`)
    erwarten nach dem Verlassen eines Fullscreens der Seite im Querformat, dass eine halbe Drehung
    wieder anfragt — genau das kehrt Entscheidung 2 um. Sie werden angepasst (Schritt 1c), nicht
    gelöscht; was die Tabelle dort prüfen wollte (der `request()` nimmt den Rückzug des `exit()` mit
    zurück), zeigen weiter die Zeilen, die nicht aktiv enden.

## Vorgehen

Reihenfolge: Schritt 1 (Specs, rot sehen und den roten Lauf in den Report), dann 2–5, dann Verify.

### Schritt 1 — Specs in `packages/twopoint5d/src/display/DisplayFullscreen.spec.ts`

**1a. Helfer**, auf Modulebene direkt unter `stackOn()` (`:119-125`):

```ts
/**
 * Another element goes fullscreen while the target is not in the fullscreen stack: a video or a
 * dialog of the app that goes fullscreen on its own — inside the target, or anywhere else on the
 * page. With `fire: false` the browser has made it the fullscreen element and fires the event only
 * in a later rendering update.
 */
function otherGoesFullscreen(
  target: TargetStub,
  {inside = false, fire = true}: {inside?: boolean; fire?: boolean} = {},
): TargetStub {
  const other = makeTarget(inside ? 'video inside the target' : 'video');
  if (inside) target.contains.mockImplementation((element) => element === other);
  if (fire) fireFullscreenChange(other);
  else doc.fullscreenElement = other;
  return other;
}
```

`target.matches` bleibt `false`: das Ziel ist nicht im Stapel.

**1b. Neue Specs** in `describe('onLandscape')` (Helfer `turn`, `flush`, `tap` von dort), als eigener
Block `describe('a fullscreen of another element: onLandscape takes nothing from it', …)`. Wo
`$inside` steht: `it.each([{inside: true}, {inside: false}])`, Titelzusatz `(inside the target: $inside)`.
Jede mit »rot« markierte Spec muss vor Schritt 2 rot laufen.

| # | Titel | Ablauf | Erwartung | vor dem Fix |
| --- | --- | --- | --- | --- |
| 1 | `a turn to landscape while another element is in fullscreen asks nothing and arms nothing` ($inside) | Hochformat; `make({onLandscape: true})`; `otherGoesFullscreen(defaultTarget, {inside})`; `turn('landscape-primary')`; `await flush()` | `defaultTarget.requestFullscreen` nicht gerufen; `isArmed` `false`; `listenerCount('pointerup')` 0 | rot |
| 2 | `onLandscape = true in landscape while another element is in fullscreen arms nothing` ($inside) | `orientation.type = 'landscape-primary'`; `make()`; `otherGoesFullscreen(…)`; `fs.onLandscape = true` | `isArmed` `false`; kein `emitted` mit `isArmed: true`; kein Request | rot |
| 3 | `a display built in landscape while another element is in fullscreen arms nothing, and once that fullscreen is left in landscape a half turn asks nothing until portrait and back` | Querformat; `otherGoesFullscreen(defaultTarget)`; dann `make({onLandscape: true})`; `fireFullscreenChange(null)`; `turn('landscape-secondary')`; `await flush()`; dann `turn('portrait-primary')`, `turn('landscape-primary')`, `await flush()` | nach dem Bau `isArmed` `false`; nach der halben Drehung 0 Requests; nach Hoch- und Querformat 1 Request | rot |
| 4 | `a fullscreen another element enters disarms an armed display, and a tap asks nothing` ($inside) | Querformat; `make({onLandscape: true})` (scharf); `otherGoesFullscreen(…)`; `tap()` | `isArmed` `false`; `emitted.at(-1)` `toMatchObject({isActive: false, isArmed: false})`; `listenerCount('pointerup')` und `('click')` 0; kein Request | rot |
| 5 | `the armed tap asks nothing while another element is in fullscreen, also before the browser has fired its event` | Querformat; `make({onLandscape: true})`; `otherGoesFullscreen(defaultTarget, {fire: false})`; `tap()` | kein Request; `isArmed` `false`; `emitted.at(-1)` mit `isArmed: false` | rot |
| 6 | `a refused request of a turn arms nothing once another element has gone fullscreen meanwhile` ($inside) | `const answer = answerLater(defaultTarget)`; `make({onLandscape: true})`; `turn('landscape-primary')`; `otherGoesFullscreen(…)`; `answer.refuse()`; `await flush()` | `isArmed` `false` | rot |
| 7 | `a target in a shadow root: a fullscreen of an element outside it holds onLandscape off as well` | `const target = makeTarget('in a shadow root', {fullscreenElement: null})`; Hochformat; `make({onLandscape: true, element: asElement(target)})`; `fireFullscreenChange(makeTarget('video'))` (setzt nur `doc.fullscreenElement`); `turn('landscape-primary')`; `await flush()` | `target.requestFullscreen` nicht gerufen; `isArmed` `false` | rot |
| 8 | `leaving the fullscreen of another element in landscape holds off the arming until portrait and back` ($inside) | Querformat; `make({onLandscape: true})`; `otherGoesFullscreen(…)`; `fireFullscreenChange(null)`; `turn('landscape-secondary')`; `await flush()`; dann Hoch- und Querformat, `await flush()` | nach dem Verlassen `isArmed` `false`; halbe Drehung 0 Requests; danach 1 Request | rot |
| 9 | `once another element has left its fullscreen in portrait, the next turn to landscape asks again` | Hochformat; `make({onLandscape: true})`; `otherGoesFullscreen(defaultTarget)`; `fireFullscreenChange(null)`; `turn('landscape-primary')`; `await flush()` | 1 Request | grün (Abdeckung) |
| 10 | `a request() of the page while another element is in fullscreen still asks the browser` | `make({onLandscape: true})`; `otherGoesFullscreen(defaultTarget)`; `await fs.request()` | `defaultTarget.requestFullscreen` 1×; `isActive` `true` | grün (Abdeckung) |

Dazu in `describe('onLandscape')`, neben `the user leaving in landscape holds off a half turn to the
other landscape` (`:971`):

| # | Titel | Ablauf | Erwartung | vor dem Fix |
| --- | --- | --- | --- | --- |
| 11 | `the user leaving in landscape a fullscreen the page entered holds off a half turn until portrait and back` | Querformat; `make({onLandscape: true})`; `await fs.request()`; `fireFullscreenChange(null)`; `turn('landscape-secondary')`; `await flush()`; dann Hoch- und Querformat, `await flush()` | nach der halben Drehung `requestFullscreen` 1× (nur der der Seite), `isArmed` `false`; danach 2× | rot |
| 12 | `the user leaving in landscape a fullscreen someone else entered on the target holds off a half turn` | Querformat; `make({onLandscape: true})`; `fireFullscreenChange(defaultTarget)`; `fireFullscreenChange(null)`; `turn('landscape-secondary')`; `await flush()`; dann Hoch- und Querformat | halbe Drehung 0 Requests; danach 1 | rot |
| 13 | `an exit() of the page in landscape on a fullscreen the page entered holds off the arming` | Querformat; `make({onLandscape: true})`; `await fs.request()`; `await fs.exit()`; `turn('landscape-secondary')`; `await flush()` | `requestFullscreen` 1×; `isArmed` `false` | rot |
| 14 | `an exit() of the page in landscape while its own request() is pending holds off the arming and disarms, however the browser answers (the browser grants: $grants)` — `it.each([{grants: true}, {grants: false}])` | Querformat; `make({onLandscape: true})` (scharf); `const answer = answerLater(defaultTarget)`; `const requested = fs.request()`; `const exited = fs.exit()`; `answer.grant()` bzw. `answer.refuse()`; `await flush()`; dann `turn('landscape-secondary')`, `await flush()` | `requested` und `exited` resolven `false`; `isActive` `false`; `isArmed` `false`; `listenerCount('pointerup')` 0; nach der halben Drehung `requestFullscreen` weiter 1× | rot (granted: die halbe Drehung fragt; refused: bleibt scharf) |

Und in `describe('pseudo fullscreen') › describe('with onLandscape')`, neben `Escape in landscape
holds off re-entering until portrait and back` (`:2119`):

| # | Titel | Ablauf | Erwartung | vor dem Fix |
| --- | --- | --- | --- | --- |
| 15 | `Escape in landscape on a pseudo mode the page entered holds off re-entering until portrait and back` | Hochformat; `make({fallback: 'pseudo', onLandscape: true})`; `await fs.request()` (Pseudo der Seite); `turn('landscape-primary')`; `pressEscape()`; `turn('landscape-secondary')` | danach `isActive` `false`; `turn('portrait-primary')`, `turn('landscape-primary')` → `mode` `'pseudo'` | rot |

**1c. Bestands-Specs, die Entscheidung 2 umkehrt.** In der Tabelle `the refusal an exit() of the
page sets in landscape belongs to that call: the last call wins` (`:1511-1597`):

- Zeilen `:1540` (`PENDING`, `['exit', 'request']`, `grants: true`) und `:1542` (`EXITING`,
  `['exit', 'request']`, `grants: true`): `halfTurnAsks: true` → `halfTurnAsks: false`.
- Kommentar am Feld `halfTurnAsks` (`:1525-1527`): sagt künftig, dass die Probe den Fullscreen,
  den die Folge hinterlässt, im Querformat verlässt — und dass jedes solche Verlassen den Rückzug
  setzt, wer den Fullscreen auch betreten hat; bei den Zeilen, die aktiv enden, zeigt die Probe
  daher den Rückzug des Verlassens, die Rücknahme des `exit()` durch den `request()` zeigen die
  Zeilen, die nicht aktiv enden.
- Kommentar der Probe `:1589` (»the user leaves a fullscreen of the page — no refusal —«): wird zu
  »the user leaves in landscape — a refusal, whoever entered the fullscreen —, then turns the
  phone half round«.

Fällt im Gate eine weitere Bestands-Spec, *nur* weil ein Fullscreen, den nicht `onLandscape`
betreten hat, im Querformat verlassen wird und danach eine Drehung im Querformat eine Anfrage
oder ein Scharfschalten erwartet: an Entscheidung 2 anpassen und im Report unter »Abweichungen« mit
Titel nennen. Jeder andere rote Bestandstest ist ein Fehler der Änderung, kein Anpassungsfall.

### Schritt 2 — Code in `packages/twopoint5d/src/display/DisplayFullscreen.ts`

Neue private Member (Namen exakt so):

- Feld `#foreignHeld = false;` direkt unter `#declined` (`:269`), mit Kommentar: was `#readState()`
  zuletzt las — ein anderes Element als das Ziel im Fullscreen —, damit das Ende dieses Fullscreens
  im Querformat als Verlassen zählt.
- Methoden direkt unter `#holdsTarget()` (`:949-953`):

```ts
// Another element than the target is in fullscreen — a video or a dialog of the app that went
// fullscreen on its own, inside the target or outside it, or an element of someone else — while the
// target is not in the stack. The document names every fullscreen of the page, a shadow root none
// outside it; the root of the target covers a target in another document
#foreignFullscreen(): boolean {
  if (this.#holdsTarget()) return false;
  return this.#host.doc.fullscreenElement != null || fullscreenElementOfRoot(this.element) != null;
}

// onLandscape takes no fullscreen from anyone: it neither requests nor arms while the target holds
// a fullscreen or another element is in one
#fullscreenHolds(): boolean {
  return this.#holdsTarget() || this.#foreignFullscreen();
}

// the user has left a fullscreen in landscape: no arming until the screen has turned to portrait
// and back — and no tap that waits for one either. State alone: the caller emits
#decline(): void {
  this.#declined = true;
  this.#disarm();
}
```

Umstellungen, je an ihrer Stelle:

1. Konstruktor (`:302-314`): nach `host.doc.addEventListener('fullscreenchange', …)` und vor
   `this.onLandscape = …` die Zeile `this.#foreignHeld = this.#foreignFullscreen();`.
2. Setter `onLandscape` `:359`: `else if (!this.#holdsTarget())` → `else if (!this.#fullscreenHolds())`.
3. `#turned()` `:919`: `this.#holdsTarget()` → `this.#fullscreenHolds()`.
4. `#rearm()` `:940`: `!this.#holdsTarget()` → `!this.#fullscreenHolds()`.
5. `#lock()` `:833` bleibt auf `#holdsTarget()` (Wahl 2).
6. `#onArmedTap` (`:282-291`): direkt nach dem Mausfilter `:284`:

   ```ts
   // a fullscreen the browser has granted another element before its fullscreenchange: the tap
   // takes nothing from it
   if (this.#fullscreenHolds()) {
     this.#disarm();
     this.#emitIfChanged();
     return;
   }
   ```

7. `#readState()` (`:791-817`): im Zweig »Ziel hat den Stapel verlassen« `:808` die Bedingung auf
   `this.#pendingExit == null && this.#onLandscape && this.#isLandscape()` (ohne
   `this.#entered === 'landscape'`) und `this.#decline()` statt `this.#declined = true`. Danach, als
   letzter Teil der Methode (nach dem `else`-Kommentar `:815-816`):

   ```ts
   const foreign = this.#foreignFullscreen();
   if (foreign) {
     this.#disarm();
   } else if (this.#foreignHeld && !this.#holdsTarget() && this.#pendingExit == null && this.#onLandscape && this.#isLandscape()) {
     this.#decline();
   }
   this.#foreignHeld = foreign;
   ```

   (mit je einem Kommentar: ein fremder Fullscreen entschärft — kein Tap wird erwartet, `onLandscape`
   nimmt ihm nichts; sein Ende im Querformat ist ein Verlassen wie das des Ziels, ein Exit dieses
   Controllers hat an seinem Aufruf entschieden.)
8. `#exit()` `:703`: `const declines = by === 'call' && this.#onLandscape && this.#isLandscape();`
   (ohne `&& this.#enteredBy() === 'landscape'`). `#enteredBy()` bleibt, `#turned()` `:903` nutzt es.
9. `#request()`, Ablehnungs-Handler `:677-685`: `if (request.declines && this.#onLandscape) this.#decline();`
   und vor `this.#endRun();` ein `this.#emitIfChanged();` (Wahl 5).
10. `#leaveNative()`, `settle` `:747`: `if (exit.declines && this.#onLandscape) this.#decline();`
    (`#emitIfChanged()` folgt dort schon).
11. `#leavePseudo()` `:990`: `if (this.#onLandscape && this.#isLandscape()) this.#decline();` (ohne
    `pseudo.by === 'landscape'`). Der Kommentar `:989` sagt: wie im nativen Modus — wer im
    Querformat verlässt, wer ihn auch betreten hat, wird nicht zurückgeworfen.

Danach steht `this.#declined = true` nirgends mehr außer in `#decline()`.

Kommentare, die die geänderte Regel beschreiben und nachgezogen werden (Inhalt, Wortlaut frei):

- `#declined` `:266-268`: der Nutzer hat einen Fullscreen im Querformat verlassen — den des Ziels,
  wer ihn auch betreten hat, oder den eines anderen Elements; der Rest des Kommentars bleibt.
- `#readState()` `:803-807`: »the user left what onLandscape entered« → den Fullscreen des Ziels,
  wer ihn auch betreten hat.
- `#exit()` `:699-702`: »the user leaves what onLandscape entered, or is entering« → der Nutzer
  verlässt im Querformat, was er auch verlässt.
- `#holdsTarget()` `:949-950`: bleibt; ein Satz dazu, dass `#fullscreenHolds()` darüber auch fremde
  Fullscreens zählt.

### Schritt 3 — TSDoc

**Klassen-TSDoc** (`DisplayFullscreen.ts:184-207`): nach dem Absatz `:199-202` (»An element inside
the target …«) ein neuer Absatz, Zielwortlaut:

```
 * `onLandscape` takes no fullscreen from anyone. While another element of the page is in
 * fullscreen and the target is not in its stack — a video or a dialog that went fullscreen on its
 * own, inside the target or outside it — it neither requests nor arms, and an armed display
 * disarms. Leaving that fullscreen in landscape holds off the arming as leaving the target's does.
```

**Setter `onLandscape`** (`:332-342`), Zielwortlaut der ersten beiden Absätze:

```
 * Enter fullscreen when the screen turns to landscape, on a device whose primary input is a
 * finger: at once where the browser lets the turn count as a gesture, else with the next tap
 * on the target ({@link DisplayFullscreen.isArmed}). The user who leaves a fullscreen in
 * landscape — the target's, whoever entered it, or one of another element — is not thrown into
 * one until the screen has turned to portrait and back. While another element of the page is in
 * fullscreen, a turn asks nothing and arms nothing: a request would pull the target over it.
 *
 * Switched on while the browser is still answering a request or an exit, it arms once that answer
 * is in — where the screen is still landscape, the target out of fullscreen and no other element
 * in fullscreen.
```

Der Absatz »After {@link Display.dispose} …« bleibt.

**Getter `isArmed`** (`:447-453`), erster Absatz:

```
 * `onLandscape` waits for a tap on the target to enter fullscreen. A page can show a hint by it.
 * Never `true` while the target is in fullscreen — whoever entered it, native or pseudo — or lies
 * under an element stacked on it, nor while another element of the page is in fullscreen.
```

**`exit()`** (`:488-502`): der Satz `:495-498` wird zu

```
 * … Called in landscape while `onLandscape` is on, it holds off the arming until the screen has
 * turned to portrait and back — whoever entered the fullscreen, and however late the browser
 * answers —, unless a `request()` after it, while the browser is still answering, takes it back.
```

**`packages/twopoint5d/src/display/types.ts:72-76`** (`DisplayFullscreenChangeProps.isArmed`), derselbe
Inhalt wie der Getter:

```
  /**
   * `onLandscape` waits for a tap on the target to enter fullscreen, see
   * {@link DisplayFullscreen.isArmed}. Never `true` while the target is in fullscreen — whoever
   * entered it, native or pseudo — or lies under an element stacked on it, nor while another
   * element of the page is in fullscreen.
   */
```

Das TSDoc von `exitOnPortrait` (`types.ts:59-63`, `DisplayFullscreen.ts:373-380`) bleibt: es
handelt vom Fullscreen, den `onLandscape` betreten hat, und das ist weiter richtig.

### Schritt 4 — Guide `packages/twopoint5d/docs/display.md`

- `:506-507`, nach »Once the target is in fullscreen, whoever put it there, `isArmed` is `false`.«
  einfügen: »So it is while another element of the page is in fullscreen — a video that went
  fullscreen on its own, inside the target or anywhere else: the display takes no fullscreen from
  anyone, and turning the phone sideways asks for nothing then.«
- `:510-511`, der Satz »Whoever leaves the fullscreen while the phone is still sideways — Escape, the
  back gesture, a button of the page — stays out of it until the phone has turned upright and back.«
  nennt künftig, dass er für jeden Fullscreen gilt: den der Drehung, einen, den die Seite mit
  `request()` betreten hat, und den eines Videos. Zielwortlaut: »Whoever leaves a fullscreen while
  the phone is still sideways — the one of the turn, one the page asked for with `request()`, or the
  one of a video; through Escape, the back gesture or a button of the page — stays out of fullscreen
  until the phone has turned upright and back.« Die Sätze danach (`:511-514`) bleiben.
- `:596-603` (Absatz »A video or a dialog inside the target …«): danach ein neuer Absatz,
  Zielwortlaut: »A video that goes fullscreen while the target is not — inside the target or
  anywhere on the page — is no fullscreen of the display: `isActive` stays `false`, `onLandscape`
  neither asks for the target nor arms while it holds, and leaving it sideways counts as leaving
  (see "Fullscreen when the phone turns sideways"). A `request()` of the page still asks: the page
  decides over its own fullscreens.«
- Cheat Sheet `:660`: `| \`isArmed\` | \`onLandscape\` waits for a tap; never while the target or another element is in fullscreen |`.

### Schritt 5 — Proposal `packages/twopoint5d/docs/proposals/display-fullscreen.md`

- Abweichungsliste im Kopf, Zeile `:21-22` (»every leave in landscape of a fullscreen `onLandscape`
  entered holds off the arming, an exit button of the page included (§6.3);«) → »every leave in
  landscape holds off the arming — of a fullscreen of the target, whoever entered it, an exit button
  of the page included, and of a fullscreen of another element (§6.3);«. Direkt danach eine neue
  Zeile: »a fullscreen of another element than the target, wherever it lies, holds `onLandscape`
  off: it neither asks nor arms, and an armed controller disarms (§3.2, §6.2);«.
  (`docs/proposals/README.md` »Reading an implemented proposal« verlangt jede Abweichung vom
  ersten Entwurf in dieser Liste, mit dem Abschnitt, der sie jetzt beschreibt.)
- §3.2, Codeblock `:146`: der Kommentar von `isArmed` endet auf »never while the target or another
  element is in fullscreen.«
- §3.2, Absatz `:179-193`: nach »… since a request would pull the target over the element.«
  (`:188`) einfügen: »So does a fullscreen of any other element, wherever it lies — a video of the
  app that went fullscreen while the target was not, inside it or outside it, or an element of
  someone else: the controller takes no fullscreen from anyone. It reads it off `fullscreenElement`
  of the document and of the root of the target, since a shadow root names no element outside it.
  A `fullscreenchange` that brings one disarms, the armed tap asks nothing while one holds, and its
  end in landscape holds off the arming as the user's leave of §6.3 does. A `request()` of the page
  still asks.«
- §6.2 `:342`: »Every turn to landscape, with the gate of §6.1 open, the target not active and no
  other element in fullscreen (§3.2):«.
- §6.2 `:352-353`: »… as long as the screen is still landscape, the target not active, no other
  element in fullscreen and the user has not left in landscape (§6.3).«
- §6.2 `:354-357`: »A fullscreen of the target disarms, whoever entered it — the armed tap, a
  `request()` of the page, the answer to a half turn from one landscape to the other, a request of
  someone else on the target, the pseudo mode —, and so does a fullscreen of another element
  (§3.2). Leaving either arms nothing by itself: left in landscape it holds off the arming (§6.3),
  left in portrait the next turn to landscape acts.«
- §6.2 `:362-366` (»A page that loads in landscape arms at construction …«): der erste Satz nennt
  die Ausnahme: »A page that loads in landscape arms at construction — unless the target or another
  element is in fullscreen — and does not try at once: …«; der Rest bleibt.
- §6.3 »The user leaves« `:388-391`: erster Satz »Where the user leaves a fullscreen while the screen
  is still landscape — one of the target, whoever entered it (`onLandscape`, a `request()` of the
  page, someone else; native or pseudo), or one of another element (§3.2) — through Escape, the back
  gesture, the browser's own control or an exit button of the page, the controller does not arm
  again until the screen has turned to portrait and back.« Im Satz danach »also for one that joins
  the exit of the turn to portrait or a pending request of the turn or of the armed tap« → »… or a
  pending request — of the turn, of the armed tap or of the page«. Der Rest des Absatzes bleibt.
- §13.1: im §6-Spiegelstrich `:574-579` »the user's exit holds off arming until portrait and back«
  → »the user's leave in landscape holds off arming until portrait and back, whoever entered the
  fullscreen, and so does the end of one of another element«. Nach dem Spiegelstrich »a fullscreen
  stacked on the target: …« (`:614-619`) ein neuer: »a fullscreen of another element, inside the
  target or outside it, the target not in its stack — also one outside the shadow root of the
  target: a turn to landscape, `onLandscape = true`, a display built meanwhile and a refused request
  of a turn ask nothing and arm nothing; a `fullscreenchange` that brings it disarms; the armed tap
  asks nothing while it holds, also before its `fullscreenchange`; leaving it in landscape holds off
  the arming until portrait and back, leaving it in portrait does not; a `request()` of the page
  still asks.«

### Schritt 6 — Abschluss im Arbeitsbaum

- Keine Datei außerhalb der fünf oben; kein CHANGELOG (Wahl 8), keine Vorschaubilder.
- `grep -n 'this.#declined = true' packages/twopoint5d/src/display/DisplayFullscreen.ts` liefert genau
  die Zeile in `#decline()`; `grep -n "=== 'landscape'" …` liefert genau drei Zeilen: die Übernahme
  durch die Seite in `#request()` (heute `:625`/`:626`) und `#turned()` (heute `:903`,
  `#enteredBy()`). Heute stehen dort `:625`, `:626`, `:682`, `:703`, `:747`, `:808-809`, `:903` und
  `:990`.
- Umbrüche der Doku bei 100 Zeichen wie die Nachbarabsätze; kein Satz über den Vorzustand (»now«,
  »no longer«, »from this change on«) in Code, Kommentar, Guide oder Proposal — außer in der
  Abweichungsliste, deren Zweck das ist.

## Findings im Volltext

**Nebenbefund aus Paket 18 (Zug 0) · low · `packages/twopoint5d/src/display/DisplayFullscreen.ts:907`/`:938-940` (`#turned()`, `#holdsTarget()`), `:352` (Setter `onLandscape`), `:282-291` (`#onArmedTap`)** —
`onLandscape` fragt das Ziel an und schaltet scharf, während ein anderes Element im Fullscreen liegt,
ohne dass das Ziel im Fullscreen-Stapel ist (ein Video der App im Ziel, das selbst in den Fullscreen
ging, oder ein Element außerhalb): `#holdsTarget()` sieht nur `isActive` und `#activeElement`, also
zieht die Drehung ins Querformat — oder der scharfe Tap auf das Video, der in der Capture-Phase am
Ziel ankommt — das Ziel über diesen Fullscreen; Klassen-TSDoc `:199-202` und Proposal §3.2 regeln nur
ein Element, das auf dem Ziel liegt. Offen ist die Regel, welcher fremde Fullscreen sperrt (im Ziel,
im Root, im Dokument) (nach Lesen des Codes, nicht ausgeführt); vorbestehend (an d9b648bf `#turned()`
mit `this.isActive` allein, `:557`, Setter `:252`). Ändert der Fix, wann `isArmed` scharf sein darf,
zieht er neben Getter `DisplayFullscreen.ts:447-450`, Proposal §3.2 und `docs/display.md:505-506`/`:660`
auch das TSDoc von `DisplayFullscreenChangeProps.isArmed` in `src/display/types.ts:72ff.` nach.
Entscheidung (Drain-Runde 2, 2026-11-01): Ein Fullscreen, den ein anderes Element als das Ziel hält,
sperrt `onLandscape` — weder Anfrage noch Scharfschalten, egal wo das Element liegt; die Library
stiehlt keinen fremden Fullscreen.

**Nebenbefund aus Paket 18 (Runde 0, Reviewer) · low · `packages/twopoint5d/docs/display.md:510-511`, `src/display/DisplayFullscreen.ts:806-810`/`:922-928` (`#readState()`, `#turned()`)** —
»Whoever leaves the fullscreen while the phone is still sideways … stays out of it until the phone
has turned upright and back«: die Zusage gilt nur für den Fullscreen von `onLandscape`. Verlässt der
Nutzer im Querformat einen Fullscreen, den ein `request()` der Seite oder jemand anderes betreten hat,
setzt nichts `#declined`, und eine halbe Drehung ins andere Querformat fragt wieder an bzw. schaltet
scharf; offen ist, ob der Satz eingeschränkt oder `#declined` für jedes Verlassen im Querformat gesetzt
wird (nach Lesen des Codes, nicht ausgeführt); vorbestehend (Guide-Satz und `#turned()` ohne
`#declined` für fremde Fullscreens schon vor Paket 18).
Entscheidung (Drain-Runde 2, 2026-11-01): Jedes Verlassen eines Fullscreens im Querformat setzt
`#declined`, gleich wer ihn betreten hat; die Zusage in `docs/display.md` gilt damit uneingeschränkt.

## Urteil des Reviewers (Zug 3, `paket-23.review-0.json`)

Urteil: FREIGABE.

- Nebenbefund »fremder Fullscreen sperrt onLandscape« — behoben: `#foreignFullscreen()` `DisplayFullscreen.ts:1001-1004` (liest `host.doc.fullscreenElement` und die Root des Ziels), `#fullscreenHolds()` in Setter `:381`, `#turned()` `:960`, `#rearm()` `:981`, Tap-Wächter `:296-300`; `#readState()` entschärft bei fremdem Fullscreen `:842-845`; `#lock()` bleibt auf `#holdsTarget()`; `request()` der Seite fragt weiter an (Spec `DisplayFullscreen.spec.ts:~2041`).
- Nebenbefund »`#declined` nur für den eigenen Fullscreen« — behoben: Einschränkung auf `'landscape'` weg in `#readState()` `:832`, `#exit()` `:727`, `#leavePseudo()` `:1055`; Ende eines fremden Fullscreens setzt den Rückzug über `#foreignHeld` `:846-857`; Guide-Satz `docs/display.md:513-515` gilt uneingeschränkt.
- Schritte 1–6 erfüllt (Specs 1–15, Tabelle `:1638`/`:1640`, TSDoc `:204-207`/`:354-361`/`:470-472`/`:517-520`, `types.ts:73-76`, Guide, Proposal; `this.#declined = true` nur in `#decline()` `:1015`; `=== 'landscape'` genau `:647`, `:648`, `:944`; kein Rückblick, keine ID).

Kleine Befunde (keine Runde):
1. `packages/twopoint5d/docs/proposals/display-fullscreen.md:406` — Zeile rund 150 Zeichen, Nachbarn brechen bei 100; der Einschub »— of the turn, of the armed tap or of the page« liest sich als Klammer ohne Ende, ein Komma wäre klarer.
2. `packages/twopoint5d/docs/proposals/display-fullscreen.md:373-375` — nach dem Einschub bricht `:374` nach etwa 45 Zeichen, »happened« steht allein am Anfang von `:375`.
3. `packages/twopoint5d/docs/display.md:515` — 101 Zeichen, eins über dem Umbruch der Nachbarzeilen.
4. `packages/twopoint5d/src/display/DisplayFullscreen.ts:992` — »#fullscreenHolds() counts the fullscreens of other elements on top of it« ist mehrdeutig (liest sich als »auf dem Ziel gestapelt«, den Fall deckt schon `#holdsTarget()`); gemeint ist »zusätzlich, ein fremder Fullscreen, solange das Ziel nicht im Stapel ist«.

Anmerkung des Implementierers ohne Wirkung: `dispose()` ruft `#leavePseudo()` nach `#disposed = true`; im Querformat mit `onLandscape` setzt das jetzt auch nach einem Pseudo-Modus der Seite `#declined` — harmlos, `isArmed` ist nach dem Dispose `false` (`DisplayFullscreen.ts:583`, `:1055`).
