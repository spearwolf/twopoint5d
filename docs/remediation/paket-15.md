# Paket 15 — DisplayFullscreen: ein request() der Seite übernimmt den Fullscreen von onLandscape auch unter einem gestapelten Element

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nachtrag zu Paket 5: dessen `Folgen:`-Zeile, im Zug 0 von Paket 6 als Symptom eingeordnet)
- Folge von: Paket 5
- Ziel: Ein `request()` der Seite macht einen Fullscreen, den `onLandscape` betreten hat, zu ihrem eigenen, auch während ein Element der App darauf gestapelt ist, sodass die nächste Drehung ins Hochformat ihn stehen lässt — wie `docs/proposals/display-fullscreen.md` §6.3 und das TSDoc von `request()` es zusagen.
- Modell: mittlere Stufe (`sonnet`)
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/display/DisplayFullscreen.ts` (Code `:609-614`, TSDoc von `request()` `:465-467`)
  - `packages/twopoint5d/src/display/DisplayFullscreen.spec.ts` (zwei Tests im `describe` ab `:1520`)
  - `packages/twopoint5d/docs/proposals/display-fullscreen.md` (§6.3 `:370-373`, §13.1 `:606-609`)
  - `packages/twopoint5d/docs/display.md` (»Which element goes fullscreen«, `:596-601`)
- Vorgehen:
  1. **Regressionstests zuerst, rot sehen.** In `DisplayFullscreen.spec.ts` im
     `describe('a fullscreen a request() of the page carries is the page’s own', …)`
     (beginnt `:1520`, innerhalb von `describe('onLandscape')`) direkt hinter dem Test
     `'a request() on a fullscreen onLandscape has entered makes it the page’s own: the next turn to portrait leaves nothing'`
     (endet `:1575`) diese zwei Tests einfügen, wörtlich (Apostroph ist `’`, wie in den
     Nachbarn):

     ```ts
     it('a request() on a fullscreen onLandscape has entered while an element of the app lies on top of it makes it the page’s own: the next turn to portrait leaves nothing', async () => {
       const fs = make({onLandscape: true});
       turn('landscape-primary');
       await flush();
       stackOn(defaultTarget);
       expect(fs.isActive).toBe(false);

       await expect(fs.request()).resolves.toBe(true);
       turn('portrait-primary');
       await flush();

       expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
       expect(doc.exitFullscreen).not.toHaveBeenCalled();
       expect(fs.isActive).toBe(true);
     });

     it('a request() on a fullscreen onLandscape has entered while an element of the app lies on top of it is the page’s own before the browser answers: a turn to portrait meanwhile leaves nothing', async () => {
       const fs = make({onLandscape: true});
       turn('landscape-primary');
       await flush();
       stackOn(defaultTarget);
       const answer = answerLater(defaultTarget);

       const requested = fs.request();
       turn('portrait-primary');
       answer.grant();
       await flush();

       await expect(requested).resolves.toBe(true);
       expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);
       expect(doc.exitFullscreen).not.toHaveBeenCalled();
       expect(fs.isActive).toBe(true);
     });
     ```

     Lauf: `pnpm nx test twopoint5d -- src/display/DisplayFullscreen.spec.ts`. Erwartet rot,
     beide an `expect(doc.exitFullscreen).not.toHaveBeenCalled()` (einmal gerufen): im ersten
     verlässt die Drehung den Fullscreen, im zweiten notiert sie ihren Exit auf dem offenen
     Request (`exitAfter = 'portrait'`), und der Grant verlässt ihn. Die Ausgabe des roten
     Laufs gehört in den Report. Die Fakes reichen ohne Änderung: `stackOn()` legt das Kind
     oben auf und lässt `matches(':fullscreen')` des Ziels `true` antworten, und der
     Default-Mock von `requestFullscreen` macht das Ziel wieder zum `fullscreenElement` —
     das Hochholen, das der Browser tut.
  2. **Fix in `DisplayFullscreen.ts:609-614`.** Der Block lautet jetzt:

     ```ts
     if (by === 'request') {
       // whoever asked for a fullscreen decides: the page asks for the one onLandscape has entered,
       // and it is the page's own from now on — a turn to portrait leaves it standing
       if (this.#pseudo?.by === 'landscape') this.#pseudo.by = 'request';
       else if (this.#entered === 'landscape' && this.#nativeElement() != null) this.#entered = 'request';
     }
     ```

     Er wird zu:

     ```ts
     if (by === 'request') {
       // whoever asked for a fullscreen decides: the page asks for the one onLandscape has entered,
       // and it is the page's own from now on — a turn to portrait leaves it standing. So it is while
       // an element of the app lies on top of the target as well: #entered stays set as long as the
       // target is in the fullscreen stack, and the request below asks for the target again
       if (this.#pseudo?.by === 'landscape') this.#pseudo.by = 'request';
       else if (this.#entered === 'landscape') this.#entered = 'request';
     }
     ```

     Sonst nichts am Code. Insbesondere bleibt der Rest von `#request()` unberührt: der
     Request an den Browser geht wie bisher raus, weil `isActive` unter dem gestapelten
     Element `false` ist.
  3. **TSDoc von `request()`, `DisplayFullscreen.ts:465-467`.** Der Satz
     »A fullscreen a request carries is the page's own, also when it shares the request of
     `onLandscape` or finds the fullscreen `onLandscape` has entered: a turn to portrait leaves
     it standing.« wird zu
     »A fullscreen a request carries is the page's own, also when it shares the request of
     `onLandscape` or finds the fullscreen `onLandscape` has entered — on top, or under an
     element of the app that lies on top of it: a turn to portrait leaves it standing.«
     Zeilenumbruch wie die Nachbarzeilen (Biome prüft die Breite nicht für Kommentare, die
     Datei bricht bei etwa 100 Zeichen).
  4. **Proposal §6.3, `docs/proposals/display-fullscreen.md:370-373`.** Hinter
     »and so does one `onLandscape` has entered once the page calls `request()` on it«
     einfügen: » — also while an element of the app lies on top of the target (§3.2)«, sodass
     der Satz endet: »…once the page calls `request()` on it — also while an element of the
     app lies on top of the target (§3.2).« Den Absatz neu umbrechen, nicht ragged lassen.
  5. **Proposal §13.1, letzter Punkt `:606-609`** (»a fullscreen stacked on the target: …
     ask nothing and arm nothing.«): vor dem Schlusspunkt anhängen: »; a `request()` of the
     page while it lies on a fullscreen `onLandscape` entered makes that fullscreen the page's
     own — the next turn to portrait leaves nothing, also one that comes before the browser
     answers«.
  6. **Guide `docs/display.md:596-601`** (»Which element goes fullscreen«). Der Satz
     »Once it is left, the fullscreen is the display's again, as before: `exitOnPortrait` acts
     on the next turn, and `dispose()` leaves it.« wird zu
     »Once it is left, the fullscreen is the display's again, as before: `exitOnPortrait` acts
     on the next turn — unless the page has called `request()` while the video lay on top,
     which makes the fullscreen the page's, as for one on top (see "Fullscreen when the phone
     turns sideways") —, and `dispose()` leaves it.« Absatz neu umbrechen.
  7. Kein CHANGELOG-Eintrag, kein Browser-Test, keine weitere Datei (Begründung unten).
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): let a request() of the page take over the fullscreen of onLandscape while an element lies on top of it`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · Folge aus Paket 5 unverändert an `DisplayFullscreen.ts:613` (Datei seit 4308cc70 unberührt) · fünf Nebenbefunde derselben Datei aus Paket 5 geprüft, keiner teilt die Ursache, alle bleiben in »Offene Befunde« · keine neuen `Folgen:` zu verteilen (Paket 6: keine) · Restplan unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt, sonnet · effort low · Report `paket-15.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG · geändert `DisplayFullscreen.ts`, `DisplayFullscreen.spec.ts`, `docs/proposals/display-fullscreen.md`, `docs/display.md` · Arbeitsbaum schmutzig · roter Lauf belegt (2 failed) · Verify `pnpm run ci` exit=0 (`paket-15.verify.log`)
  - 2026-11-01 Zug 3: Reviewer (sonnet, low): Folge behoben, keine kritischen/wichtigen Befunde, 3 kleine · Diff `paket-15.diff`, Report `paket-15.review-0.json`
  - 2026-11-01 Zug 4: keine Runde nötig
  - 2026-11-01 Zug 5: Commit 11f2b368, Verify `paket-15.verify.log` exit=0

## Urteil des Reviewers

- Folge aus Paket 5: behoben, `DisplayFullscreen.ts:616` (Bedingung entfallen; Kopplung `#entered`/`#activeElement` an `:562`, `:788`, `:800` nachgeprüft); Tests im `describe` ab `DisplayFullscreen.spec.ts:1520`
- klein: §6.3 in `docs/proposals/display-fullscreen.md` nach der Einfügung nicht neu umbrochen
- klein: Absatz »Which element goes fullscreen« in `docs/display.md:596-601` nicht neu umbrochen
- klein: »—,« im neuen Guide-Satz `docs/display.md:601` liest sich holprig (aus der Vorgabe)

## Abgleich

**Folge aus Paket 5, `DisplayFullscreen.ts:613` — unverändert.** `git log -- …/DisplayFullscreen.ts`
endet bei 4308cc70; Paket 6 hat nur `Display.ts` (TSDoc) angefasst. Die Zeile lautet wie
gemeldet `else if (this.#entered === 'landscape' && this.#nativeElement() != null) this.#entered = 'request';`.

Hergang, am Code nachvollzogen: `onLandscape` betritt den Fullscreen des Ziels T
(`#readState()` `:783-786` setzt `#activeElement = T`, `#entered = 'landscape'`). Ein Video V in T
geht selbst in den Fullscreen; `#nativeElement()` (`:568-573`) antwortet `undefined`, weil das
`fullscreenElement` V ist, und `#readState()` behält `#activeElement`/`#entered`, solange
`isInFullscreenStack(T)` gilt (`:787`, `:800-801`). Ruft die Seite jetzt `request()`, scheitert die
Anhebung an `#nativeElement() != null`; `isActive` ist `false`, also geht `requestFullscreen()` an
T raus. Beim Grant setzt `#readState()` `#entered` nicht neu, weil `#activeElement` schon steht
(`:783`). `#entered` bleibt `'landscape'`, und die nächste Drehung ins Hochformat ruft über
`#enteredBy() === 'landscape'` (`:888`) `#exit('portrait')` — der Fullscreen der Seite geht, gegen
§6.3 und `:465-467`. Liegt die Drehung vor der Antwort des Browsers, notiert `#exit('portrait')` den
Exit auf dem offenen Request (`:710`), weil `#enteredBy()` `#entered` vor `#pending.by` liest
(`:941`) — mit demselben Ergebnis.

## Entscheidungen dieses Zugs

- **Bedingung fällt weg, statt auf `#holdsTarget()` zu wechseln.** Der Reviewer von Paket 5
  schlug `this.#holdsTarget()` vor. `#entered` wird nur zusammen mit `#activeElement` gesetzt und
  gelöscht (`:784-785`, `:796-797`, `dispose()` `:560-561`; `:590` und `:613` heben nur einen
  gesetzten Wert an), also folgt aus `#entered === 'landscape'` immer `#activeElement != null` und
  damit `#holdsTarget() === true`. Die Zusatzbedingung wäre ein Wächter, der nie greift, und läse
  sich wie eine echte Einschränkung. Der Kommentar nennt die Kopplung stattdessen.
- **Angehoben wird beim Aufruf, nicht beim Grant.** So arbeitet schon der ungestapelte Fall: dort
  wird angehoben, ohne dass der Browser überhaupt gefragt wird (`isActive` ist `true`). Und §3.2/§6.3
  entscheiden auch die Ablehnung eines `exit()` beim Aufruf. Der zweite Test hält genau das fest:
  eine Anhebung erst im Grant fiele dort rot aus, weil die Drehung dazwischen ihren Exit schon
  notiert hätte.
- **Lehnt der Browser den Request unter dem gestapelten Element ab** (z. B. weil er nur Nachfahren
  des obersten Elements zulässt), bleibt die Anhebung stehen: die Seite hat nach dem Fullscreen
  gefragt, und er bleibt ihrer, sobald das Video geht. Das entspricht dem ungestapelten Fall. Ob ein
  Browser das Ziel tatsächlich nach oben holt, ändert dieses Paket nicht, und die neuen Doku-Sätze
  behaupten darüber nichts (§3.2 tut es schon, unverändert).
- **`toggle()`** unter dem gestapelten Element ruft `request()` (`isActive` ist `false`, `:510-511`)
  und ist mit dem Fix abgedeckt; kein eigener Test.
- **Kein CHANGELOG-Eintrag.** `display.fullscreen` und `onLandscape` stehen nur unter
  `## [Unreleased]` → `### Added` (`CHANGELOG.md:27-28`), in `[0.24.0]` kommt Fullscreen nicht vor.
  Der Eintrag zu `onLandscape` sagt nichts über die Übernahme durch die Seite, und eine
  `Fixed`-Zeile für ein unveröffentlichtes Feature widerspricht Keep a Changelog.
- **Kein Browser-Test.** Die Übernahme zeigt sich erst an einer Drehung, und kein Runner dreht einen
  Bildschirm (Proposal §13.2). Was der Browser auf den Request antwortet, ändert das Paket nicht.
  Die Vitest-Fakes bilden das Stapeln schon ab (`stackOn()`, `:150-156`).
- Effort `low`: Code, Tests und Sätze stehen hier wörtlich. Modell mittel: Bugfix mit
  Regressionstest gegen einen Zustandsautomaten.

## Nebenbefunde derselben Datei (»Offene Befunde«, aus Paket 5) — geprüft, nicht in diesem Paket

Der Plan bat den Zug 0, sie auf dieselbe Ursache zu prüfen. Die Ursache hier ist eine zu enge
Bedingung an der Übernahme `#entered` `'landscape'` → `'request'`. Keiner der fünf teilt sie:

- `#readState()` `:778ff.`, `isArmed` bleibt nach einem `request()` der Seite `true` — andere
  Ursache: niemand entschärft beim Betreten des Fullscreens. Der Fix säße in `#readState()`, nicht
  an der Übernahme. Im Szenario dieses Pakets ist nichts scharf (`#holdsTarget()` sperrt das Scharfschalten).
- `set onLandscape(true)` `:352-353`, schaltet neben einem offenen Request scharf — andere
  Ursache: der Setter prüft `#pending`/`#pendingExit` nicht, wie `#rearm()` es tut.
- Proposal-Kopf `:11-37`, Rückblick »Deviations…« — Doku-Konvention, andere Stelle des Proposals.
- `Display.spec.ts:131-135`, `fireFullscreenChange()` erreicht entfernte Listener — Testhelfer
  einer anderen Datei; dieses Paket nutzt den eigenen Helfer in `DisplayFullscreen.spec.ts:76-79`.
- Konstruktor `:313-314`, `#warnConflicts()` doppelt — andere Ursache.

Für den Implementierer: diese fünf sind bekannt und stehen schon in der Queue — nicht beheben,
nicht erneut melden.

## Findings im Volltext

Kein Audit-Finding. Quelle ist die `Folgen:`-Zeile von Paket 5 im Plan (Reviewer von Paket 5):

**Folge von Paket 5 · klein, sehr selten · `packages/twopoint5d/src/display/DisplayFullscreen.ts:613`** —
ein `request()` der Seite, während ein Element der App auf einem von `onLandscape` betretenen Ziel
gestapelt ist, holt das Ziel nach oben, aber die Anhebung `#entered` → `'request'` greift nur bei
`#nativeElement() != null`; die nächste Drehung ins Hochformat verlässt den Fullscreen der Seite,
gegen die Zusage in `docs/proposals/display-fullscreen.md` §6.3 (»whoever asked for a fullscreen
decides«), die erst Paket 5 gegeben hat.
Vorschlag des Reviewers: Bedingung auf `this.#holdsTarget()` — umgesetzt als Wegfall der
Bedingung, siehe »Entscheidungen dieses Zugs«.
