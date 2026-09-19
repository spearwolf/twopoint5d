# Paket 5 — display und controls: Layout-Mathe, Resize-Ziel, Frame-Loop und Eingabe

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-083 (medium), BUG-084 (medium), BUG-003 (medium), BUG-085 (medium), BUG-086 (low), BUG-088 (low), BUG-087 (low), BUG-004 (low)
- Mitgenommen: ein vorbestehender Nebenbefund gleicher Ursache wie BUG-085 (der
  Lebenslauf eines Eintrags in `#pointersDown` endet nicht sauber) —
  `#onPointerUp` (`packages/twopoint5d/src/controls/PanControl2D.ts:352-366`)
  rechnet den letzten Schritt per `#updatePanState()` noch auf den Eintrag und
  löscht ihn dann samt dem seit dem letzten `update()` gesammelten Pan: die
  Bewegung zwischen dem letzten `update()` und dem Loslassen kommt nie in
  `panView` an. Die Empfehlung zu BUG-085 (»behandelt wie `#onPointerUp`, aber
  mit Verwerfen des gesammelten Pans«) setzt voraus, dass `pointerup` ihn
  abliefert — ohne diesen Fix wären Cancel und Up dasselbe.
- Ziel: Display misst und resized korrekt, FixedFrameLoop weist ungültige Raten ab, und PanControl2D reagiert layout-unabhängig und ohne hängende Pointer.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/display/styleUtils.ts`, neu `packages/twopoint5d/src/display/styleUtils.spec.ts`
  - `packages/twopoint5d/src/display/Display.ts`, `packages/twopoint5d/src/display/types.ts` (nur TSDoc)
  - `packages/twopoint5d/src/display/FixedFrameLoop.ts`, `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts`
  - `packages/twopoint5d/src/controls/PanControl2D.ts`, `packages/twopoint5d/src/controls/InputControlBase.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (eine Zeile, 601)
  - `packages/twopoint5d-testing/test/display-resize.test.js`, `pan-control-input.test.js`, `pan-control-switch-off.test.js`, `pan-control-dispose.test.js`, `pan-control-stylesheet-root.test.js` (nur Kommentar), neu `pan-control-keys.test.js`, neu `pan-control-cursor.test.js`
  - `packages/twopoint5d/CHANGELOG.md` (Abschnitt `[Unreleased]`)
- Vorgehen: siehe Abschnitt »Vorgehen« unten — er ist der Auftrag.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): measure side borders on the sides, resolve resize-to selectors in the display's own root without throwing, refuse fixed-loop rates that cannot tick, name the requested canvas size when clamping, pan by physical key position, end cancelled and released pointers where they ended and give every pan cursor a rule of its own`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · `git diff e352b56 HEAD -- packages/twopoint5d/src/display packages/twopoint5d/src/controls` leer, alle Fundstellen in `display/` und `controls/` unverändert · BUG-083, BUG-084, BUG-003, BUG-085, BUG-086, BUG-088, BUG-087 unverändert · BUG-004 unverändert bis auf `StageRenderer.ts:558` → `:601` (Paket 1/8 haben die Datei davor verlängert) · ein Nebenbefund gleicher Ursache mitgenommen (`#onPointerUp` verliert den letzten Pan) · keine offenen Folgen (Paket 1 → 8, Paket 3 → 9 erledigt; Paket 9 trägt keine Folgen-Zeile, `b7dd540` berührt nur `texture/`) · aus »Offene Befunde« teilt kein Eintrag die Ursache dieses Pakets · Restplan unverändert: Pakete 6 und 7 teilen keinen Bereich mit Paket 5, das Lookbook setzt weder `keyCodes` noch `maxStepsPerFrame` (`map2d-cam-visi.ts:87`, `map2d-rect-visi.ts:99` nur `speed`/`disablePointer`)
  - 2026-09-19 Zug 1: Implementierer beauftragt (opus, effort high), Brief `paket-5.impl-1.brief.txt`, Report nach `paket-5.impl-1.json`
  - 2026-09-19 Zug 2: Report FERTIG (`paket-5.impl-1.json`), rote Läufe belegt (Vitest 12 rot, Browser 14 rot), `pnpm run ci` laut Report grün · 14 Dateien geändert, 3 neu (`styleUtils.spec.ts`, `pan-control-keys.test.js`, `pan-control-cursor.test.js`) · Arbeitsbaum schmutzig · 3 Nebenbefunde gemeldet
  - 2026-09-19 Zug 3: Reviewer beauftragt (opus, effort high), Diff `paket-5.diff`, Report nach `paket-5.review-1.json`
  - 2026-09-19 Zug 3: Review 1 (`paket-5.review-1.json`): alle 8 Findings und der Mitgenommene behoben · 0 kritisch, 0 wichtig, 8 klein · Diff `paket-5.diff`
  - 2026-09-19 Zug 4: keine Runde nötig (keine offenen Findings, keine kritischen oder wichtigen Befunde)
  - 2026-09-19 Zug 5: `pnpm run ci` selbst gefahren, Exit 0 ohne Nx-Cache (`paket-5.verify.log`) · Commit `68c3bff` · Plan auf `[x]`, 2 Folgen, 3 Nebenbefunde in »Offene Befunde«

## Abgleich

Stand `b7dd540`. Seit dem Audit-Commit `e352b56` hat kein Commit `src/display/`,
`src/controls/` oder die Browsertests `display-resize.test.js` und
`pan-control-*.test.js` angefasst.

| Finding | Einordnung | Fundstelle jetzt |
| --- | --- | --- |
| BUG-083 | unverändert | `display/styleUtils.ts:27-29` — `getHorizontalInnerMargin` gibt `getVerticalBorder(style) + getHorizontalPadding(style)` zurück |
| BUG-084 | unverändert | `display/Display.ts:671-673` — `document.querySelector(resizeTo) as HTMLElement` ohne `try`, jeden Frame, immer ab `document` |
| BUG-003 | unverändert | `controls/PanControl2D.ts:104-113` (Option `keyCodes`), `:144` (Feld), `:174` (Default `[87, 83, 65, 68]`), `:428-441` (`#speedFieldFor(keyCode)`), `:450-462` (`({keyCode})` in beiden Handlern) |
| BUG-085 | unverändert | `controls/PanControl2D.ts:242-260` (kein `pointercancel`), `:321-342` (`if (!pointersDown.has(...))`), `:385-399` (`buttons === 0` stellt nur den Cursor zurück) |
| BUG-086 | unverändert | `display/FixedFrameLoop.ts:150` (öffentliches Feld `maxStepsPerFrame`), `:187-193` (Konstruktor schreibt `#fps` direkt) |
| BUG-088 | unverändert | `display/Display.ts:727-734`, Meldung `:34-43` |
| BUG-087 | unverändert | `controls/PanControl2D.ts:203-204` — `Stylesheets.installRule('PanControl2D', …)` |
| BUG-004 | verschoben | `display/Display.ts:340`, `:354`; `stage/StageRenderer.ts:601` (Audit: 558); `controls/InputControlBase.ts:4`, `:6`, `:14`, `:28` |

## Entscheidungen dieses Pakets

Der Implementierer setzt sie um, wie sie hier stehen; sie sind nicht neu zu verhandeln.

1. **BUG-003 — wann `keyCodes` entscheidet.** Die Entscheidung im Plan verlangt:
   `event.code` gegen die neue Option `keys`, `keyCodes` als deprecated Fallback
   nur, wenn der Aufrufer ihn setzt, kein Breaking Change. »Gesetzt« wird **am
   Wert** erkannt, nicht über ein Flag: `keyCodes` entscheidet genau dann, wenn
   `keys` seinen Default hält und `keyCodes` **nicht**. Grund: das Feld
   `keyCodes` ist heute öffentlich, nicht optional typisiert und hält ein
   eigenes Array je Instanz — auch `control.keyCodes[0] = 38` (Umbelegen an
   Ort und Stelle) muss weiter wirken, und `control.keyCodes` muss weiter ein
   Array liefern. Ein optionales Feld oder ein Setter-Flag bräche genau das.
   Wer beide setzt, bekommt `keys` — die neue Option gewinnt, die alte ist nur
   Fallback. Keine Vereinigung beider Tabellen: sonst panten bei einem
   Aufrufer mit `keyCodes: [38, 40, 37, 39]` plötzlich auch W/A/S/D.
2. **BUG-004 — Abweichung von der Empfehlung in `InputControlBase`.** Die
   Empfehlung `callback: EventListenerOrEventListenerObject` compiliert nicht:
   `PanControl2D` übergibt `(event: PointerEvent) => void` und
   `(event: KeyboardEvent) => void`, und unter `strictFunctionTypes` ist das
   kein `EventListener` (im Scratchpad gegengeprüft, TS2345). Stattdessen
   generisch: `callback: ((event: E) => void) | EventListenerObject` mit
   `E extends Event`, gespeichert als `EventListenerOrEventListenerObject` über
   genau einen Cast (ebenfalls gegengeprüft, compiliert samt
   `InputControlBase.spec.ts`, das `EventListener` übergibt). Die beiden
   Display-Getter und `getClearColor` folgen der Empfehlung wörtlich (gegen
   `@types/three@0.185.4` gegengeprüft).
3. **BUG-084 — Cache mit Wächter.** Der Cache hält `{value, root, element}`;
   ein Treffer gilt nur, solange `element.getRootNode() === root` und
   `element.matches(value)`. Sonst bliebe ein entferntes oder umbenanntes
   Element für immer das Maß. Ein Selektor, der nichts findet, wird jeden
   Frame neu gesucht (wie heute) — ein später eingehängtes Element muss
   gefunden werden. Einzige Unschärfe, bewusst hingenommen: ein Element, das
   später *vor* dem gecachten in Dokumentreihenfolge eingefügt wird und
   ebenfalls passt, übernimmt nicht. Ungültige Selektoren werden gecacht, damit
   die Warnung einmal je Wert kommt.
4. **BUG-085 — kein `lostpointercapture`.** Die Empfehlung nennt ihn in
   Klammern. Das Control setzt nie ein Pointer Capture; ein
   `lostpointercapture` auf `document` stammt also von fremdem Code, und ein
   `releasePointerCapture()` mitten im Drag beendet keinen Pointer —
   `pointerup` bzw. `pointercancel` kommen trotzdem und erreichen `document`.
   Ihn zu behandeln, bräche fremde Drags ab. Nur `pointercancel`.
5. **BUG-085 — Mausende am Bit, nicht an `buttons === 0`.** Ein Maus-Eintrag
   endet bei einem `pointermove`, dessen `buttons` das Bit `mouseButton` nicht
   mehr trägt. Das schließt `buttons === 0` (außerhalb des Fensters
   losgelassen) ein und deckt den Akkord: linke Taste pannt, rechte kommt
   dazu, linke geht los — dafür feuert der Browser `pointermove`, kein
   `pointerup`, und ohne diesen Schritt rechnete der spätere `pointerup` die
   ganze Strecke mit der rechten Taste als Pan ab. Ein so beendeter Eintrag
   liefert seinen gesammelten Pan ab (es war ein Loslassen), die Position
   dieses Moves zählt nicht mehr.
6. **BUG-085 — Ende heißt: abliefern oder verwerfen.** `pointerup` und das
   Mausende nach 5. liefern den gesammelten Pan beim nächsten `update()` ab;
   `pointercancel` verwirft ihn (Empfehlung). Ein `pointerdown` auf einer
   bekannten id verankert neu und verwirft, was der alte Eintrag noch hielt
   (Empfehlung: `panX/panY` nullen).
7. **BUG-087 — Regelname aus dem Wert, injektiv.** Die Empfehlung nennt
   `slug(...)`; ein gewöhnlicher Slug ließe `url(a.png)` und `url(a-png)`
   wieder unter einem Namen zusammenfallen — derselbe Fehler eine Ebene tiefer.
   Daher: jedes Zeichen außerhalb `[a-zA-Z0-9-]` wird als `_<hex>_` geschrieben
   (auch `_` selbst). Schlüsselwörter wie `grabbing` bleiben lesbar, alles
   andere bleibt unterscheidbar. Grundlage ist der wirksame Wert
   (`cursorPanStyle || 'auto'`), damit `''` und `'auto'` eine Regel teilen.
   Kein Breaking Change: der Klassenname trägt ohnehin einen Zufalls-Postfix je
   Seitenladung, niemand kann ihn in eigenem CSS nennen.
8. **BUG-087 — Schreiben mitten im Drag.** Heute überschreibt ein Write die
   eine geteilte Regel, und der versteckte Cursor wechselt sofort. Mit einer
   Klasse je Wert säße die alte Klasse am Target, und `#restoreCursorStyle()`
   nähme später die neue ab — die alte bliebe für immer. Der Setter tauscht
   deshalb die Klasse am Target, solange der Cursor versteckt ist.
9. **BUG-087 — Write nach `dispose()` bleibt abgewiesen**, mit neuem Grund. Der
   alte Grund (»die Regel teilen sich alle Controls der Root«) gilt nicht mehr;
   der neue: ein entsorgtes Control installiert keine Regeln mehr in ein
   Stylesheet, das ihm nicht gehört, und hat kein Target mehr, an dem die
   Klasse sitzen könnte. Verhalten unverändert, nur Kommentar und TSDoc neu.
10. **BUG-086 — `Infinity` wird abgewiesen**, auch für `maxStepsPerFrame`
    (Empfehlung: `Number.isFinite(v) && v >= 1`). Ein unbegrenzter Wert nähme
    den Spiral-of-Death-Schutz weg, den das Feld dokumentiert.
11. **BUG-088 — der Satz der Warnung wird mit korrigiert** (»should not be
    bigger than«): das Finding handelt davon, dass diese eine Meldung das
    Falsche sagt; sie wird als Ganzes richtig.
12. **Modell und Effort.** Stärkste Stufe: zwei Module, öffentliche API bewegt
    sich (neue Option `keys`, deprecated `keyCodes`, `maxStepsPerFrame` wird
    Accessor, `getContentAreaSize` nimmt `Element`, protected Signatur in
    `InputControlBase`), dazu ein Pointer-Lebenslauf mit Randfällen und
    Browsertests in zwei Engines. Effort `high` nach Tabelle (öffentliche API
    berührt), nicht aus Vorsicht.

## Vorgehen

Allgemein für jeden Schritt: Code, Kommentare, TSDoc und Testnamen auf
Englisch; keine Finding-IDs irgendwo im Repo; kein Satz über den Vorzustand
(»früher«, »no longer«, »now«) in Code und Doku. Relative Imports mit `.js`,
Typen über `import type`. Browsertests laufen gegen `dist`: um einen
Browsertest rot zu sehen, erst `pnpm build:twopoint5d`, dann gezielt
`pnpm --dir packages/twopoint5d-testing exec web-test-runner test/<datei>.test.js`
(nicht über Nx: dessen Cache kann einen alten Lauf wiedergeben). Vitest einzeln:
`pnpm nx test twopoint5d -- src/display/styleUtils.spec.ts`.

Reihenfolge je Schritt: Regressionstest schreiben, rot sehen (Ausgabe in den
Report), dann fixen. Ausnahme Schritt 7 (reine Typen, kein Laufzeitverhalten).

### 1. Horizontaler Innenrand (BUG-083)

- `display/styleUtils.ts:27-29`: `getHorizontalInnerMargin` gibt
  `getHorizontalBorder(style) + getHorizontalPadding(style)` zurück.
- `getContentAreaSize(element: Element, style?: CSSStyleDeclaration)` — der
  Parameter wird von `HTMLElement` auf `Element` geweitet (Schritt 2 braucht
  es; `getComputedStyle` und `getBoundingClientRect` gibt es auf `Element`).
- Neu `display/styleUtils.spec.ts` (Vitest, Umgebung node — kein DOM): ein
  Stub `{getPropertyValue: (name: string) => values[name] ?? ''} as unknown as
  CSSStyleDeclaration` mit lauter verschiedenen Zweierpotenzen, damit jede
  Verwechslung sichtbar wird: `padding-top` 1, `padding-bottom` 2,
  `padding-left` 4, `padding-right` 8, `border-top-width` 16,
  `border-bottom-width` 32, `border-left-width` 64, `border-right-width` 128
  (als Strings mit `px`, z. B. `'16px'`). Fälle:
  - `getVerticalInnerMargin` → 51, `getHorizontalInnerMargin` → 204
    (vor dem Fix 60 → rot).
  - `getContentAreaSize(fakeElement, style)` mit
    `fakeElement = {getBoundingClientRect: () => ({width: 1000, height: 500})}`
    (Cast auf `Element`) → `width` 796, `height` 449.
  - `getVerticalPadding`/`getHorizontalPadding`/`getVerticalBorder`/`getHorizontalBorder`
    einzeln: 3, 12, 48, 192 (Wächter).
- Browsertest in `display-resize.test.js`, neuer Fall
  `a canvas with a border on top only keeps the full width of its host`:
  `host = makeContainer({width: 320, height: 200})`, Canvas mit
  `display: block; box-sizing: content-box; padding: 0; border: 0;
  border-top: 4px solid black`, in `host`, `new Display(canvas,
  {resizeToElement: host})`, `start()` + ein `nextFrame` → `display.width`
  320, `display.height` 196 (vor dem Fix `width` 316 → rot).

### 2. `resize-to`-Selektor (BUG-084)

In `display/Display.ts`:

- Neues privates Feld, mit einem Kommentar, *warum* es gecacht wird:
  `#resizeToSelector?: {value: string; root: Node; element: Element | null; invalid: boolean};`
- Neue private Methode `#resolveResizeToSelector(value: string): Element | undefined`:
  1. `const root = this.resizeToAttributeEl.getRootNode() as Node & ParentNode;`
     — das ist das Dokument, die Shadow Root, in der das Attribut-Element sitzt,
     oder bei einem abgehängten Baum dessen oberstes Element; alle drei haben
     `querySelector`.
  2. Cache-Treffer, wenn `cached.value === value && cached.root === root`:
     bei `invalid` → `undefined`; sonst, wenn `cached.element != null &&
     cached.element.getRootNode() === root && cached.element.matches(value)`
     → `cached.element`. In jedem anderen Fall neu suchen.
  3. Suche in `try { element = root.querySelector(value); }`. Im `catch`:
     einmal `console.warn` mit `// eslint-disable-next-line no-console` (wie
     Zeile 36), Text:
     `` `[Display] resize-to="${value}" is not a valid selector; the display measures its resizeToElement instead` ``
     (sinngemäß, er muss `resize-to` und den Wert enthalten), Cache
     `{value, root, element: null, invalid: true}`, `undefined` zurück.
  4. Sonst Cache `{value, root, element, invalid: false}` und
     `element ?? undefined` zurück.
- `resize()`, Zeile 643: `let sizeRefElement: Element | undefined = this.resizeToElement;`
  Zeile 671-673: `sizeRefElement = this.#resolveResizeToSelector(resizeTo) ?? this.resizeToElement ?? canvasElement;`
  Kein Cast auf `HTMLElement` mehr. Das Feld `resizeToElement` bleibt `HTMLElement`.
- Klassen-TSDoc, Aufzählung ab Zeile 112: der Selektor-Punkt sagt, dass im
  Root-Knoten von `resizeToAttributeEl` gesucht wird (das Dokument oder die
  Shadow Root, in der es sitzt), dass bei keinem Treffer auf
  `resizeToElement` bzw. den Canvas zurückgefallen wird, und dass ein Wert,
  der kein gültiger Selektor ist, einmal per `console.warn` gemeldet und
  genauso behandelt wird. `types.ts`, TSDoc von
  `DisplayParameters.resizeToAttributeEl`: ein Satz, dass jeder andere Wert ein
  CSS-Selektor ist, gesucht im Dokument bzw. in der Shadow Root des Elements.
- Browsertests in `display-resize.test.js` (`console.warn` im Test durch eine
  sammelnde Funktion ersetzen und im `finally` zurücksetzen; nur Aufrufe
  zählen, deren erstes Argument `resize-to` enthält — three.js warnt in
  manchen Engines selbst):
  - `an invalid resize-to selector warns once and measures the resizeToElement`:
    `host` 320×200, Canvas mit `resize-to="!not-a-selector"` **vor** dem
    Konstruktor gesetzt, in `host`, `new Display(canvas, {resizeToElement:
    host})`, `start()`, zwei `nextFrame` → kein Throw, `width` 320,
    `height` 200, genau eine passende Warnung. Vor dem Fix wirft schon der
    Konstruktor → rot. (Gegenprobe im Test nicht nötig; dass
    `document.querySelector('!not-a-selector')` in Chromium und Firefox wirft,
    einmal von Hand prüfen, sonst einen anderen sicher ungültigen Wert nehmen.)
  - `a resize-to selector finds its element inside the shadow root the display lives in`:
    `host` mit `attachShadow({mode: 'open'})`; in der Shadow Root ein `div`
    mit eindeutiger id, `position: absolute; width: 128px; height: 64px`, und
    ein Canvas mit `resize-to="#<id>"`; `new Display(canvas, {styleSheetRoot:
    shadowRoot})` → nach dem ersten Frame `width` 128, `height` 64. Vor dem
    Fix findet `document.querySelector` nichts und misst den Canvas → rot.
  - `a resize-to selector follows its element when it is replaced`
    (Wächter gegen einen veralteten Cache): Element A (id X, 128×64) → Frame →
    128; A entfernen, B mit derselben id X und 256×32 einhängen → nächster
    Frame → 256×32.

### 3. MaxResolution-Warnung (BUG-088)

- `display/Display.ts:727-734` ersetzen durch: wenn `wPx > Display.MaxResolution
  || hPx > Display.MaxResolution`, **zuerst** `showCanvasMaxResolutionWarning(wPx, hPx)`
  mit den noch ungeklemmten Werten, dann beide per
  `Math.min(…, Display.MaxResolution)` klemmen. Eine Warnung, auch wenn
  beide Seiten zu groß sind.
- `showCanvasMaxResolutionWarning`, Zeile 38: »should not **be** bigger than«.
- Browsertest: der bestehende Fall `clamps oversized dimensions to
  Display.MaxResolution` bekommt die `console.warn`-Sammlung **vor**
  `new Display(...)` (der Konstruktor ruft `resize()` schon mit dem Callback)
  und assertiert genau eine Warnung, deren erstes Argument
  `` `(${oversized}x${oversized} was requested)` `` enthält. Vor dem Fix steht
  dort `8192x12288` → rot. Die Warnung ist ein Modul-Flag je Seite; in dieser
  Testdatei darf kein anderer Fall vorher über `MaxResolution` gehen.

### 4. FixedFrameLoop (BUG-086)

In `display/FixedFrameLoop.ts`:

- `maxStepsPerFrame` wird Accessor-Paar über `#maxStepsPerFrame`. Die TSDoc
  des Feldes (Zeile 243-249) wandert an den Getter, ergänzt um: ein Wert, der
  nicht endlich oder kleiner als 1 ist, wird ignoriert, auch im Konstruktor.
  Setter: `if (!Number.isFinite(value) || value < 1) return;`
- `fps`: dem Getter bzw. Setter ein Satz TSDoc, dass ein Wert, der nicht
  endlich oder ≤ 0 ist, ignoriert wird — auch im Konstruktor, wo die Loop dann
  `DefaultFps` behält.
- Konstruktor: `#fps`, `#fixedDelta` und `#maxStepsPerFrame` zuerst aus
  `FixedFrameLoop.DefaultFps` bzw. `DefaultMaxStepsPerFrame`, dann
  `if (options?.fps != null) this.fps = options.fps;` und
  `if (options?.maxStepsPerFrame != null) this.maxStepsPerFrame = options.maxStepsPerFrame;`
- TSDoc von `dispose()` (Zeile 359-361): »a write lands« → ein Write, den der
  Setter annimmt, landet.
- Specs in `FixedFrameLoop.spec.ts`:
  - `it.each([0, -60, NaN, Infinity])` `the constructor keeps DefaultFps for an fps of %s`:
    `new FixedFrameLoop(makeFakeDisplay(), {fps})` → `fps` 60, `fixedDelta`
    1/60; ein Frame mit `deltaTime` 1/60 → genau ein Tick. Vor dem Fix rot.
  - `it.each([0, -1, 0.5, NaN, Infinity])` `maxStepsPerFrame refuses %s`:
    Wert schreiben → bleibt 5; ein Frame mit `deltaTime` 0.05 → 3 Ticks.
    Vor dem Fix rot.
  - `the constructor keeps DefaultMaxStepsPerFrame for a maxStepsPerFrame of 0` → 5. Vor dem Fix rot.
  - Wächter: `maxStepsPerFrame takes 1 and above` (2 → 2).
  - Der bestehende Fall `spiral-of-death guard …` (setzt 3) bleibt grün.

### 5. PanControl2D: Tasten nach Position (BUG-003)

In `controls/PanControl2D.ts`:

- Modulkonstanten:
  `const DEFAULT_KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'] as const;`,
  `const DEFAULT_KEY_CODES = [87, 83, 65, 68] as const;`,
  `const KEYED_SPEED_FIELDS: readonly KeyedSpeedField[] = ['speedNorth', 'speedSouth', 'speedWest', 'speedEast'];`
  und ein Helfer `holdsDefault(values: readonly unknown[], defaults: readonly unknown[]): boolean`
  (gleiche Länge, jeder Eintrag `===`).
- `PanControl2DOptions`:
  - neu `keys?: [string, string, string, string];` — TSDoc: `KeyboardEvent.code`
    der vier Tasten in der Reihenfolge up, down, left, right; Default
    `['KeyW', 'KeyS', 'KeyA', 'KeyD']`, die Tasten an der WASD-Position, wie
    auch immer das Layout sie beschriftet;
    Verweis https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
  - `keyCodes`: `@deprecated Use keys.` plus: `KeyboardEvent.keyCode` hängt am
    Layout; solange `keyCodes` etwas anderes als `[87, 83, 65, 68]` hält und
    `keys` seinen Default, vergleicht das Control `event.keyCode` mit
    `keyCodes` statt `event.code` mit `keys`.
- Felder: neu `keys: [string, string, string, string];`, `keyCodes` bleibt
  `[number, number, number, number]` (nicht optional) und bekommt dasselbe
  `@deprecated`. Konstruktor:
  `this.keys = readOption(options, 'keys', [...DEFAULT_KEYS] as [string, string, string, string]);`
  und `this.keyCodes = readOption(options, 'keyCodes', [...DEFAULT_KEY_CODES] as [number, number, number, number]);`
  (je Instanz ein eigenes Array, wie heute).
- `#speedFieldFor(event: KeyboardEvent): KeyedSpeedField | undefined`: Index
  `holdsDefault(this.keys, DEFAULT_KEYS) && !holdsDefault(this.keyCodes, DEFAULT_KEY_CODES)
  ? this.keyCodes.indexOf(event.keyCode) : this.keys.indexOf(event.code)`,
  Rückgabe `KEYED_SPEED_FIELDS[index]` (bei -1 `undefined`). Ein Kommentar
  sagt, warum der deprecated Weg am Wert erkannt wird (Entscheidung 1).
- `#onKeyDown`/`#onKeyUp` nehmen `(event: KeyboardEvent)` und reichen das
  Event weiter.
- Kommentar an `#keyedSpeeds` (Zeile 132-133): `keys` und `keyCodes` sind
  öffentlich und beschreibbar. TSDoc von `dispose()` (Zeile 478): `keys` in die
  Aufzählung der Felder, die weiter Werte nehmen.
- Bestehende Browsertests mitziehen, sie senden heute nur `keyCode`:
  `pan-control-switch-off.test.js` und `pan-control-dispose.test.js` —
  Konstanten `KEY_NORTH = 'KeyW'`, `KEY_SOUTH = 'KeyS'`, `KEY_WEST = 'KeyA'`,
  `KEY_EAST = 'KeyD'`, Helfer
  `key(type, code)` → `new KeyboardEvent(type, {code, bubbles: true})`,
  Kommentar »the default keys of PanControl2D …«.
- Neu `pan-control-keys.test.js` (Helfer `key(type, init)` →
  `document.dispatchEvent(new KeyboardEvent(type, {bubbles: true, ...init}))`,
  jedes `keydown` mit passendem `keyup` aufräumen, `control.dispose()` im
  `afterEach`), `new PanControl2D({state: {x: 0, y: 0, pixelRatio: 1}, disablePointer: true})`:
  - `moves north by the key at the W position whatever the layout calls it`:
    `{code: 'KeyW', keyCode: 90, key: 'z'}` (AZERTY) → `speedNorth` gleich
    `pixelsPerSecond`. Vor dem Fix rot.
  - `ignores the key labelled W where the layout moved it`:
    `{code: 'KeyZ', keyCode: 87, key: 'w'}` → alle vier `speed…` 0. Vor dem Fix rot.
  - `pans by the keys it is given`: `keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']`,
    `{code: 'ArrowLeft', keyCode: 37}` → `speedWest`. Vor dem Fix rot.
  - `keeps honouring keyCodes a caller sets` (Wächter): `keyCodes: [38, 40, 37, 39]`,
    `{code: 'ArrowUp', keyCode: 38}` → `speedNorth`; `{code: 'KeyW', keyCode: 87}` → nichts.
  - `keeps honouring keyCodes rebound in place` (Wächter): `control.keyCodes[0] = 38`,
    `{code: 'ArrowUp', keyCode: 38}` → `speedNorth`.
  - `prefers keys over keyCodes when both are set`: `keys` Pfeiltasten,
    `keyCodes: [73, 75, 74, 76]`; `{code: 'ArrowUp', keyCode: 38}` → `speedNorth`;
    `{code: 'KeyI', keyCode: 73}` → nichts. Vor dem Fix rot.

### 6. PanControl2D: Pointer-Lebenslauf (BUG-085 und der Mitgenommene)

In `controls/PanControl2D.ts`:

- `const POINTERCANCEL = 'pointercancel';` neben den drei anderen.
- Neue Felder `#releasedPanX = 0;` und `#releasedPanY = 0;` — der Pan, den ein
  beendeter Pointer gesammelt hat und der auf das nächste `update()` wartet
  (Kommentar).
- Neue private Methoden:
  - `#endPointer(pointerId: number, keepPan: boolean): void` — holt den
    Eintrag; gibt es keinen, nichts. Bei `keepPan` dessen `panX`/`panY` auf
    `#releasedPanX`/`#releasedPanY` addieren. Eintrag löschen.
  - `#dropPointers(): void` — `#pointersDown.clear()` und beide
    `#released…` auf 0. Ersetzt `this.#pointersDown.clear()` an beiden
    Stellen (Setter `pointerDisabled`, Zweig `true`, Zeile 255; `unsubscribe()`,
    Zeile 275).
  - `#restoreCursorUnlessMouseDown(): void` — der heutige Block aus
    `#onPointerUp` (Zeile 362-364): kein Maus-Eintrag mehr → `#restoreCursorStyle()`.
- Setter `pointerDisabled`: `POINTERCANCEL` → `#onPointerCancel` neben den
  drei anderen an- und abmelden.
- `#onPointerDown`: für einen Pan-Pointer den Eintrag **immer** frisch setzen
  (`pointerType`, `lastX`/`lastY` aus `#toRelativeCoords(event)`,
  `panX`/`panY` 0) — das `if (!pointersDown.has(...))` fällt. Kommentar: eine
  id, die schon unten ist, hat ihr Ende verpasst, ihre alte Position ist kein
  Anker.
- `#onPointerUp`: für einen Pan-Pointer mit Eintrag `#updatePanState(event, state)`,
  dann `#endPointer(event.pointerId, true)`. Danach für Maus
  `#restoreCursorUnlessMouseDown()`.
- Neu `#onPointerCancel = (event: PointerEvent): void` →
  `#endPointer(event.pointerId, false)`, für Maus
  `#restoreCursorUnlessMouseDown()`.
- `#onPointerMove`: nach dem bestehenden `#isPanPointer`-Block
  `if (event.pointerType === MOUSE && (event.buttons & this.mouseButton) === 0) this.#endPointer(event.pointerId, true);`
  — vor der bestehenden `buttons === 0`-Zeile, die bleibt.
- `update()`, im Zweig `!this.#pointerDisabled`: zu `panX`/`panY` aus
  `mergePan(...)` `#releasedPanX`/`#releasedPanY` addieren, dann beide auf 0.
- TSDoc prüfen: `unsubscribe()` und `dispose()` sprechen vom »pan collected in
  a drag« — gilt weiter, auch für den abgelieferten, noch nicht verbuchten.
- Browsertests in `pan-control-input.test.js`; der Helfer `pointer()` bekommt
  `pointerId = 1` und `pointerType = 'mouse'` als weitere Optionen (Defaults
  lassen die bestehenden Aufrufe unverändert). Alle mit
  `coordsTarget: box`, `state: makeState()`:
  - `a pointer the browser cancels gives the next drag no head start`
    (`pointerType: 'touch'`, `pointerId: 7`): down(10,10) → move(30,10) →
    `pointercancel`(30,10) → down(100,10) → move(110,10) → `update()` →
    `panView.x` -10. Vor dem Fix -100 → rot.
  - `a pointerdown on a pointer that never came up starts where it is`
    (Maus): down(10) → move(30) → `update()` → -20; down(100) → move(110) →
    `update()` → -30. Vor dem Fix -100 → rot.
  - `a drag released between two updates delivers its last movement`
    (Maus): down(10) → move(30) → up(30, `buttons: 0`) → `update()` → -20.
    Vor dem Fix 0 → rot.
  - `a pan button let go during a drag ends the pan where it was let go`
    (Maus, Akkord): down(10, `buttons: 1`) → move(30, `buttons: 1`) →
    move(60, `buttons: 2`) → up(90, `buttons: 0`) → `update()` → -20. Vor dem
    Fix 0 → rot (und mit nur dem Up-Fix -80).
  - Bestehende Fälle bleiben grün, auch `drops the pan collected while the
    pointer is switched off` und `delivers no pan collected before dispose()`.

### 7. Casts ohne `any` (BUG-004)

- `display/Display.ts:340`:
  `return (this.renderer?.backend as {isWebGPUBackend?: boolean} | undefined)?.isWebGPUBackend ?? false;`
  `:354` entsprechend mit `isWebGLBackend`.
- `stage/StageRenderer.ts:601`: `renderer.getClearColor(this.#oldClearColor);`
- `controls/InputControlBase.ts`:
  - Tupel: `[host: EventTarget, eventName: string, callback: EventListenerOrEventListenerObject, passive: boolean][]`
  - `#findListenerIndex(host: EventTarget, eventName: string, callback: EventListenerOrEventListenerObject, passive = true)`
  - `protected addEventListener<E extends Event>(host: EventTarget, eventName: string, callback: ((event: E) => void) | EventListenerObject, passive = true)`
    und `removeEventListener` mit derselben Signatur. In beiden am Anfang
    `const listener = callback as EventListenerOrEventListenerObject;` mit
    einem Kommentar: der Aufrufer nennt den Event-Typ, den der Host unter
    `eventName` schickt; der Host selbst verspricht nur ein `Event`.
  - `InputControlBase.spec.ts` compiliert unverändert (übergibt `EventListener`).
- Kein Laufzeit-Regressionstest: nichts ändert sich zur Laufzeit. Beleg sind
  `pnpm typecheck` und `grep -n "as any" packages/twopoint5d/src/display/Display.ts
  packages/twopoint5d/src/stage/StageRenderer.ts packages/twopoint5d/src/controls/InputControlBase.ts`
  ohne Treffer.

### 8. Cursor-Regel je Wert (BUG-087)

In `controls/PanControl2D.ts`:

- Modul-Helfer, mit Kommentar zur Injektivität:
  ``const cursorRuleName = (cursor: string): string => `PanControl2D-${cursor.replace(/[^a-zA-Z0-9-]/g, (ch) => `_${ch.charCodeAt(0).toString(16)}_`)}`;``
- `#installCursorPanStyleRules`: `const cursor = this.#cursorPanStyle || 'auto';`
  → ``Stylesheets.installRule(cursorRuleName(cursor), `cursor: ${cursor}`, this.#styleSheetRoot)``.
- Setter `cursorPanStyle`: bei geändertem Wert die vorige Klasse merken, neue
  Regel installieren; ist `#hideCursorState === HideCursorState.YES` und
  `#cursorStylesTarget` gesetzt und die Klasse eine andere, am Target die alte
  Klasse ab- und die neue anlegen (Entscheidung 8).
- Kommentar im Setter (Zeile 193-194) und TSDoc des Setters (Zeile 185-191)
  sowie von `dispose()` (Zeile 476-477) neu begründen: Controls mit demselben
  Cursor-Stil teilen eine Regel, deren CSS sich nie ändert; ein Write betrifft
  nur das schreibende Control. Nach `dispose()` wird der Write abgewiesen,
  weil ein entsorgtes Control keine Regel mehr in ein fremdes Stylesheet
  schreibt (Entscheidung 9). TSDoc von `PanControl2DOptions.cursorPanStyle`
  (Zeile 61) bleibt.
- `pan-control-stylesheet-root.test.js`, Kommentar Zeile 4-5: die Regel steht
  unter einem Namen je Cursor-Stil; der Präfix-Such-Helfer bleibt gültig.
- Neu `pan-control-cursor.test.js`: zwei Targets `a`, `b` (je ein `div` in
  `document.body`), `controlA = new PanControl2D({state, cursorStylesTarget: a,
  coordsTarget: a, cursorPanStyle: 'grabbing'})`, `controlB` mit `b` und
  `'crosshair'`. Beide hören auf `document`, ein Drag über `document.body`
  (Maus: `pointerdown`, `pointermove`) versteckt beide Cursor.
  - `two controls with different cursor styles show their own`:
    nach dem Drag `getComputedStyle(a).cursor` `'grabbing'`,
    `getComputedStyle(b).cursor` `'crosshair'`. Vor dem Fix beide
    `'crosshair'` → rot.
  - `a write to one control's cursorPanStyle leaves the other one's cursor alone`:
    danach `controlB.cursorPanStyle = 'move'` → `a` bleibt `'grabbing'`, `b`
    wird `'move'`. Vor dem Fix wird `a` `'move'` → rot.
  - `a cursorPanStyle written during a drag moves the target onto the new rule`
    (Wächter gegen Entscheidung 8): ein Control, Drag, Write `'move'` →
    `getComputedStyle(target).cursor` `'move'`, `target.classList.length` 1;
    `pointerup` → `classList.length` 0.
  - `afterEach`: beide Controls `dispose()`, Targets entfernen.

### 9. CHANGELOG

`packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`, mit Skill
`updating-changelog`, in eigenen Worten und ohne Rückblick:

- Added: Option `keys` und Feld `PanControl2D#keys` (`KeyboardEvent.code`, Default `KeyW`/`KeyS`/`KeyA`/`KeyD`).
- Deprecated (Abschnitt neu anlegen, Keep a Changelog 1.1.0): Option und Feld `keyCodes`; wann sie noch entscheiden (Entscheidung 1).
- Changed: `PanControl2D` erkennt die Tasten an `event.code`; der `resize-to`-Selektor wird im Root-Knoten des Attribut-Elements gesucht; `FixedFrameLoop` ignoriert im Konstruktor und im Setter ein `fps` bzw. `maxStepsPerFrame`, das die Loop nicht fahren kann, und `maxStepsPerFrame` ist ein Accessor; `getContentAreaSize()` nimmt jedes `Element`; jeder Cursor-Stil von `PanControl2D` bekommt eine eigene Regel; `InputControlBase#addEventListener`/`#removeEventListener` sind typisiert.
- Fixed: horizontaler Innenrand aus den Seitenrahmen; ein `resize-to`-Wert, der kein gültiger Selektor ist, wird einmal per `console.warn` gemeldet und wie ein Selektor ohne Treffer behandelt; die MaxResolution-Warnung nennt die angeforderte Größe; `pointercancel` beendet einen Drag, ein `pointerdown` verankert immer neu, ein Loslassen liefert den gesammelten Pan ab, eine losgelassene Pan-Taste beendet den Maus-Drag. Jeder Eintrag beschreibt das Verhalten, das jetzt gilt — kein »no longer«.
- Migration Guide: `keyCodes` → `keys`, mit den `code`-Werten der Pfeiltasten als Beispiel.

## Für die Zeile `Schnittstellen:` nach dem Commit

Vorbereitet für den Commit-Zug; so, wie es nach Umsetzung dieses Plans gilt:
`PanControl2DOptions.keys` / `PanControl2D#keys` neu (`[string, string,
string, string]`, `KeyboardEvent.code`) · `keyCodes` deprecated, entscheidet
nur, solange es vom Default abweicht und `keys` nicht · `FixedFrameLoop#maxStepsPerFrame`
ist ein Accessor-Paar auf dem Prototyp (Unterklassen dürfen es nicht als Feld
deklarieren), Setter ignoriert nicht endliche Werte und Werte < 1; `fps` im
Konstruktor wie der Setter · `getContentAreaSize(element: Element, style?)` ·
`InputControlBase#addEventListener<E extends Event>(host, eventName, callback:
((event: E) => void) | EventListenerObject, passive?)`, ebenso
`removeEventListener` · `PanControl2D` hört zusätzlich auf `pointercancel` ·
Cursor-Klasse von `PanControl2D` je Cursor-Wert (`PanControl2D-<kodierter
Wert>-<postfix>`).

## Findings im Volltext

**BUG-083 · medium · packages/twopoint5d/src/display/styleUtils.ts:23-29 (Konsumenten: Display.ts:700-710, styleUtils.ts:39-45)** — getHorizontalInnerMargin reparieren: es addiert die vertikalen Rahmenbreiten

Der horizontale Innenrand wird aus `border-top-width + border-bottom-width` berechnet statt aus links + rechts. `getContentAreaSize()` (exportiert) und `Display.resize()` (Content-Box-Korrektur) nutzen beide die Funktion, jedes Size-Ref-Element oder Canvas mit asymmetrischem Rahmen (etwa nur ein 4px-Rahmen oben) ergibt also einen 4px zu schmalen Canvas, eins mit nur seitlichen Rahmen wird zu breit gemessen — jeden Frame, stumm; der Resize-Hash maskiert nichts, weil der falsche Wert stabil ist. `getHorizontalBorder()` (Zeile 16) ist dadurch tot. Es gibt keine `styleUtils.spec.ts`, deshalb hat das überlebt.

Empfehlung: `return getHorizontalBorder(style) + getHorizontalPadding(style);`. Eine Vitest-Spec für styleUtils mit einem `CSSStyleDeclaration`-Stub mit asymmetrischen Paddings/Rahmen (oben 1, unten 2, links 4, rechts 8) und Assertions auf beide Ränder.

**BUG-084 · medium · packages/twopoint5d/src/display/Display.ts:669-673 (Aufruf pro Frame: 795; Treiber: FrameLoop.ts:79-88)** — Die resize-to-Selektor-Suche absichern und auf den Root des Elements beschränken

`resize()` läuft jeden Frame aus `renderFrame()`. Ein `resize-to`-Wert, der kein gültiger Selektor ist (`"#my box"`, `"[data-x"`), lässt `document.querySelector` jeden Frame eine `SyntaxError`-DOMException werfen. eventizes `emit()` bricht den Dispatch bei einem Throw ab, die Exception verlässt also `FrameLoop[OnRAF]` und `RAF.#onAnimationFrame`, bevor die übrigen Subscriber dieser Loop und des geteilten Renderer-Treibers bedient werden, und three fordert den nächsten Frame an, bevor es die Loop ruft — die Seite loggt einen Uncaught Error in Refresh-Rate, für immer, und kein anderes Display an diesem Renderer bekommt Frames. Zudem sucht der Lookup ab `document`, ein Selektor kann nie ein Element innerhalb der Shadow Root auflösen, die das Display über `styleSheetRoot` selbst unterstützt; der Fallback misst stumm den Canvas. Und die Suche selbst ist eine DOM-Suche pro Frame auf einem String, der sich fast nie ändert.

Empfehlung: Den Selektor nur auflösen, wenn sich der Attribut-String ändert (Cache `{value, element}`), den Lookup in ein `try/catch`, das einmal `console.warn`t und zurückfällt, und über `this.resizeToAttributeEl.getRootNode() as Document | ShadowRoot` statt `document` suchen. Auf `Element` casten, nicht `HTMLElement`.

**BUG-003 · medium · packages/twopoint5d/src/controls/PanControl2D.ts:113, 144, 174, 428-437** — PanControl2D verwendet deprecated event.keyCode

Die WASD-Erkennung nutzt `KeyboardEvent.keyCode` — seit langem deprecated und nicht layout-unabhängig. Auf AZERTY liefert die Taste an Position W einen anderen Keycode, auf kyrillischen Layouts wieder einen anderen. Die Default-Codes `[87, 83, 65, 68]` sind Magic Numbers. Re-Check: unverändert (`keyCodes: [number, number, number, number]`, `#speedFieldFor(keyCode: number)`).

Empfehlung: Auf `event.code` umstellen (`KeyW | KeyS | KeyA | KeyD`), das ist layout-unabhängig. `PanControl2DOptions.keyCodes` auf ein String-Tupel oder eine benannte Struktur umstellen — den Breaking Change wert.

**BUG-085 · medium · packages/twopoint5d/src/controls/PanControl2D.ts:244-247, 321-335, 396-398** — pointercancel behandeln und eine bereits gedrückte pointerId neu verankern

Kein `pointercancel`- (oder `lostpointercapture`-)Listener: Ein Touch-Drag, den eine Browser-Scroll-/Zoom-Geste, eine OS-Geste oder ein Dialog unterbricht, endet mit `pointercancel`, nie mit `pointerup`, der Eintrag bleibt also mit veralteten `lastX/lastY` in `#pointersDown`. Eine außerhalb des Fensters losgelassene Maustaste wirkt gleich (kein Capture; `#onPointerMove` stellt den Cursor wieder her, lässt den Eintrag aber stehen). Weil `#onPointerDown` einen vorhandenen Eintrag unangetastet lässt, startet das nächste `pointerdown` mit derselben `pointerId` (Touch-ids werden wiederverwendet; die Maus ist immer dieselbe id) vom alten Punkt, und das erste `pointermove` schwenkt die View um die volle Distanz zwischen alter und neuer Position — ein sichtbarer Sprung. Die Browsertests fahren nur pointerId 1 mit Maus auf dem Happy Path.

Empfehlung: `pointercancel` (und `lostpointercapture`) neben den drei Listenern im `pointerDisabled`-Setter registrieren, behandelt wie `#onPointerUp`, aber mit Verwerfen des gesammelten Pans; in `#onPointerDown` `lastX/lastY` immer (neu) schreiben und `panX/panY` nullen, auch wenn die id bekannt ist; in `#onPointerMove` bei `pointerType === MOUSE && buttons === 0` den Eintrag ebenfalls löschen. Browsertest: pointerdown → pointermove → pointercancel → pointerdown anderswo → pointermove, erwarteter Pan nur der letzte Move.

**BUG-086 · low · packages/twopoint5d/src/display/FixedFrameLoop.ts:115-119, 149-151, 163, 175-178** — fps im FixedFrameLoop-Konstruktor validieren und maxStepsPerFrame überhaupt

Der Setter weist `0`, Negatives und Nicht-Endliches ab (die Spec assertiert das), der Konstruktor schreibt `#fps` aber direkt: `{fps: 0}` ergibt `fixedDelta = Infinity` und eine Loop, die nie tickt; `{fps: -60}` ein negatives `fixedDelta`, sodass `accumulator >= fixedDelta` immer wahr ist und jeder Frame `maxStepsPerFrame` Ticks mit negativem Schritt fährt, `tickTime` zählt rückwärts. `maxStepsPerFrame` (öffentlich, beschreibbar, unvalidiert) auf `0`, negativ oder `NaN` betritt die `while` nie und erfüllt dann jeden Frame `steps >= maxStepsPerFrame && accumulator >= fixedDelta`, was den Akkumulator nullt — eine Simulation, die stumm einfriert, `alpha` bleibt 0.

Empfehlung: Im Konstruktor mit dem Default initialisieren und durch den Setter routen: `this.#fps = DefaultFps; this.#fixedDelta = 1/DefaultFps; if (options?.fps != null) this.fps = options.fps;`. `maxStepsPerFrame` einen Setter mit `Number.isFinite(v) && v >= 1` geben. Spec-Fälle für `{fps: 0}` und `maxStepsPerFrame = 0`.

**BUG-088 · low · packages/twopoint5d/src/display/Display.ts:727-734 (Meldung in 34-43)** — In der MaxResolution-Warnung die angeforderte Größe melden, nicht die geklemmte

`showCanvasMaxResolutionWarning` druckt `(${w}x${h} was requested)`, aber `wPx` (und im zweiten Zweig auch `hPx`) ist bereits mit `Display.MaxResolution` überschrieben — die einmalige Warnung sagt dem Entwickler, 8192 sei angefordert worden, genau der Wert, der es nicht war. Der Browsertest »clamps oversized dimensions« assertiert den Clamp, nicht die Meldung.

Empfehlung: `const requestedW = wPx, requestedH = hPx;` vor den zwei Clamps festhalten und einmal damit warnen, wenn eine Seite das Limit überschreitet.

**BUG-087 · low · packages/twopoint5d/src/controls/PanControl2D.ts:203-204 (Stylesheets.ts:60-70)** — Zwei PanControl2D-Instanzen nicht gegenseitig die Cursor-Regel überschreiben lassen

Der Regelname ist die Konstante `'PanControl2D'`, und `installRule` schreibt die eine Regel unter diesem Namen pro Root um. Zwei Controls in derselben Root mit verschiedenem `cursorPanStyle` (etwa `grabbing` für eine Karte und `none` für eine Minimap) teilen sich also eine Klasse und eine Regel; wer zuletzt schrieb, entscheidet den Cursor für beide, und ein späterer Write auf `cursorPanStyle` eines Controls ändert das andere. Das Setter-TSDoc erwähnt das Teilen nur als Grund, Writes nach dispose abzulehnen; die Options-Doku nicht.

Empfehlung: Den Regelnamen vom Wert ableiten: `Stylesheets.installRule(`PanControl2D-${slug(this.#cursorPanStyle)}`, …)`, damit jeder Cursor-Stil eine eigene Klasse bekommt; oder das geteilte Verhalten an `PanControl2DOptions.cursorPanStyle` dokumentieren. Browsertest mit zwei Controls verschiedener Stile in einer Root.

**BUG-004 · low · packages/twopoint5d/src/display/Display.ts:340, 354; stage/StageRenderer.ts:558; controls/InputControlBase.ts:4, 6, 14, 28** — Die as-any-Casts durch die Shape ersetzen, die sie lesen

Beide Backend-Getter des Displays gehen über `as any`, obwohl die Nachbar-Guards (`isWebGPURenderer.ts`, `isWebGLRenderer.ts`) das typisierte Muster `(x as {isWebGPUBackend?: boolean})` vormachen. `renderer.getClearColor(this.#oldClearColor as any)` castet, obwohl `@types/three` `getClearColor(target: Color): Color` deklariert und `#oldClearColor` eine `Color` ist — der Cast verbirgt heute nichts und morgen eine Signaturänderung. `InputControlBase` typisiert jeden Callback als `any` im Tupel und in beiden protected Methoden. Keine Lint-Regel fängt das (`no-explicit-any` ist aus).

Empfehlung: `(this.renderer?.backend as {isWebGPUBackend?: boolean} | undefined)?.isWebGPUBackend ?? false`; den Cast an `getClearColor` entfernen; in `InputControlBase` `EventListenerOrEventListenerObject` für `callback`.

## Urteil des Reviewers (Review 1, `paket-5.review-1.json`)

- BUG-083 — behoben: `packages/twopoint5d/src/display/styleUtils.ts:28` (`getHorizontalBorder` + `getHorizontalPadding`), `getContentAreaSize(element: Element)` `:32`; Spec `styleUtils.spec.ts`, Browsertest `a canvas with a border on top only keeps the full width of its host`
- BUG-084 — behoben: `packages/twopoint5d/src/display/Display.ts:774-801` (`#resolveResizeToSelector`, Suche im Root-Knoten, `try/catch`, einmalige Warnung), Aufruf `:680`, Cache-Feld `:205`, TSDoc `:112-117`, `types.ts:59-60`; drei Browsertests
- BUG-003 — behoben: `packages/twopoint5d/src/controls/PanControl2D.ts:227` (`keys`), Wertentscheidung `:544`, `@deprecated` an Option und Feld; `pan-control-keys.test.js`, `pan-control-dispose.test.js` und `pan-control-switch-off.test.js` senden `code`
- BUG-085 — behoben: `PanControl2D.ts:317`/`:322` (`pointercancel` an/ab), Handler `:443` verwirft, `#onPointerDown` verankert immer frisch, Mausende am Bit `:504-505`; Browsertests Cancel, erneutes Down, Akkord
- BUG-086 — behoben: `packages/twopoint5d/src/display/FixedFrameLoop.ts:116` (Accessor, endlich und ≥ 1), Konstruktor über die Setter `:173-174`; Specs für `0`, negativ, `0.5`, `NaN`, `Infinity`
- BUG-088 — behoben: `Display.ts:734-739` (Warnung vor dem Klemmen, einmal), Satz `:38`; Browsertest prüft `(${oversized}x${oversized} was requested)`
- BUG-087 — behoben: `PanControl2D.ts:71-72`, `:272` (injektiver Regelname je Wert), Klassentausch im Drag `:263-266`; `pan-control-cursor.test.js`
- BUG-004 — behoben: `Display.ts:348`, `:362`; `packages/twopoint5d/src/stage/StageRenderer.ts:601`; `packages/twopoint5d/src/controls/InputControlBase.ts:23`, `:46` (generisch `E extends Event`, ein Cast je Methode)
- Mitgenommener Nebenbefund `#onPointerUp` — behoben: `PanControl2D.ts:432` liefert über `#endPointer(…, true)` in `#releasedPanX/Y` ab, `update()` verbucht, `#dropPointers()` `:326`, `:346` verwirft

## Kleine Befunde des Reviewers

- `packages/twopoint5d/CHANGELOG.md:146` — »`keys` wins where both are set« stimmt nicht, wenn `keys` ausdrücklich auf den Default gesetzt wird und `keyCodes` abweicht; genauer: »`keys` wins wherever it differs from its default«
- `packages/twopoint5d/src/display/Display.ts:102`, `:112-117` — TSDoc nennt die bewusst hingenommene Cache-Unschärfe (Entscheidung 3) nicht
- `packages/twopoint5d/CHANGELOG.md:139` — Hinweis fehlt, dass eine Unterklasse mit Feld `maxStepsPerFrame` nicht mehr compiliert (TS2610)
- `PanControl2D.ts:505` — Cursor bleibt nach dem Mausende im Akkord versteckt, bis alle Tasten oben sind (als Folge in den Plan)
- `PanControl2D.ts:71-72`, `:272` — Cursor-Regeln je Wert werden nie abgeräumt (als Folge in den Plan)
- `packages/twopoint5d-testing/test/pan-control-input.test.js` — ungetestet: `pointercancel` der Maus mit Cursor-Wiederherstellung; abgelieferter, noch nicht verbuchter Pan, den `pointerDisabled = true` verwirft
- `PanControl2D.ts:585`, `FixedFrameLoop.ts:241` — TSDoc-Umbruch verrutscht
- Commit-Message nennt weder die neue Option `keys` noch die Deprecation von `keyCodes` noch die protected Signatur von `InputControlBase`

## Nebenbefunde (Urteile)

- `display/types.ts:57` (`"self"` misst laut TSDoc den Canvas, Code misst `resizeToElement ?? canvas`) → Audit (DOC): Klassen-TSDoc und Code stimmen überein, nur die Parameter-Doku weicht ab
- `controls/PanControl2D.ts:286` (`#isFirstPanViewUpdate` fällt bei erneuter Zuweisung desselben State-Objekts) → Scope: Korrektheitsdefekt, das zugesagte erste `update`-Event bleibt aus
- `display/FixedFrameLoop.ts:84-85` (beschreibbare Default-Statics ungeprüft) → Scope: dieselbe Klasse Defekt wie die abgewiesenen Raten, aber über einen anderen Eingang, den das Finding nicht nannte; nicht in dieses Paket genommen, weil der Detailplan die Statics nicht vorsah
