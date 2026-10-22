# Paket 15 — Fehlerpfade, Zähler und Lücken in Display, Sprites, Stage, Text

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — drei Nebenbefunde der Queue (`AdaptiveResolution.ts`,
  `SpritePicker.ts`, `VertexObjectPool.ts`) und fünf kleine Reviewer-Befunde der Pakete 3, 7, 8, 10;
  der vierte Queue-Eintrag (`Fade`/`Flash`) ist gegenstandslos, siehe Abgleich
- Ziel: Die Fehlerpfade räumen auf, die Zähler einer Übernahme beginnen bei null, Text bricht nie
  vor einer schließenden Marke um, und Tests, Kommentare und TSDoc decken ab und sagen, was gilt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`):
  - `src/display/AdaptiveResolution.ts`, `src/display/AdaptiveResolution.spec.ts`, `docs/display.md`
  - `src/display/hot-path-allocations.spec.ts`
  - `src/sprites/SpritePicker.ts`, `src/sprites/SpritePicker.spec.ts`
  - `src/vertex-objects/VertexObjectPool.ts` (nur TSDoc)
  - `src/sprites/features/evenFrame.spec.ts`
  - `src/stage/StageRenderer.ts`
  - `src/text/layoutText.ts`, `src/text/layoutText.spec.ts`, `docs/text.md`,
    `docs/proposals/dynamic-atlas-and-bitmap-text.md`, `CHANGELOG.md` (eine `Added`-Zeile)
  - `src/text/writeText.ts` (ein Kommentar)
- Vorgehen: siehe Abschnitt »Vorgehen« unten — neun Schritte, je einer pro Befund, in beliebiger
  Reihenfolge; die drei Bugfixes (Schritte 1, 2, 7) zuerst mit rotem Regressionstest.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): count the windows toward a step up of AdaptiveResolution from 0 at every takeover, give back the handle arrays and the pick meshes a refused SpritePicker#pick() gathered, leave no place to break where layoutText() skips an ideograph or a kana so that a closing mark after it stays on its line, test resize() of a canvas that measures itself for allocations, type the evenFrame spec without casts, build the renderTo() refusal of a stage without asPassNode() from the shared text, and say the NaN order of sortBy() where its order is described`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · `AdaptiveResolution.ts:347–354` unverändert
    (`#takeOverScale()` setzt nur `#pacingDescentFrom`, `#gpuStepUpPending` zurück) ·
    `SpritePicker.ts:235` `#gather()` vor dem `try` `:237` (Wurf `:263–267`) unverändert ·
    `VertexObjectPool.ts:457` (gewandert von `:450`) · `Fade`/`Flash` gegenstandslos (TSDoc an
    `Fade.ts:16–19`, `Flash.ts:29–33` seit `6500527f`; kein `*Api`-Interface des Verzeichnisses trägt
    TSDoc am Interface, 17 von 17) · `hot-path-allocations.spec.ts` misst nur mit `resizeTo`-Callback
    unverändert · `evenFrame.spec.ts:11–22` fünf `as unknown as` · `StageRenderer.ts:1065`
    unverändert · `layoutText.ts:152` unverändert, dazu Test `layoutText.spec.ts:216`, der das
    Gegenteil pinnt · `writeText.ts:191` unverändert · offene Folgen von Paket 14 → Paket 19
    (Symptome, Nachtragspaket), Queue-Einträge `runCheckKind.ts`, `SpriteResources.ts`,
    `TextureAtlas.ts` u. a. → Paket 19, neuer Queue-Eintrag mit Kandidaten gleicher Ursache an 14 Stellen →
    Paket 19
  - 2026-10-22 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach `paket-15.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG · 15 Dateien unter `packages/twopoint5d/` (Liste wie »Dateien« oben) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-15.verify.log`) · Regressionstests rot gesehen (3× AdaptiveResolution, 1× SpritePicker, 2× layoutText)
  - 2026-10-22 Zug 3: Reviewer (sonnet, medium) — alle acht Schritte erfüllt, Befunde keine, Commit-Message in Ordnung · Diff `paket-15.diff`, Report `paket-15.review-0.json`
  - 2026-10-22 Zug 4: keine Runde nötig
  - 2026-10-22 Zug 5: committet als 3dd301b3 (15 Dateien, Trailer `Remediation-Run: 2026-10-21`), Verify `paket-15.verify.log` exit=0

## Abgleich

| Punkt | Herkunft | Stand | Fundstelle jetzt |
| --- | --- | --- | --- |
| `#takeOverScale()` setzt Zähler nicht zurück | Queue (Paket 4) | besteht | `src/display/AdaptiveResolution.ts:347–354`; Felder `:185–194` |
| `RangeError` in `#gather()` vor dem `try` | Queue (Paket 6) | besteht | `src/sprites/SpritePicker.ts:235` (Aufruf), `:263–267` (Wurf), `try` ab `:237` |
| `NaN`-Zeile im `@throws` von `sortBy()` | Queue (Paket 5) | besteht, gewandert | `src/vertex-objects/VertexObjectPool.ts:457` |
| `Fade`/`Flash` ohne TSDoc am Export | Queue (Paket 7) | **gegenstandslos** | `Fade.ts:16–19`, `Flash.ts:29–33` |
| Allokations-Spec ohne selbstvermessendes Canvas | Reviewer Paket 3 | besteht | `src/display/hot-path-allocations.spec.ts:54` (nur `resizeTo: () => SIZE`) |
| `as unknown as` in `evenFrame.spec.ts` | Reviewer Paket 7 | besteht | `src/sprites/features/evenFrame.spec.ts:11`, `:17`, `:18`, `:19`, `:22` |
| `#getStagePass()` schreibt `NO_PASS_NODE` aus | Reviewer Paket 8 | besteht | `src/stage/StageRenderer.ts:1065`; Konstante `:53–54` |
| `pendingBreak` über ein übersprungenes Ideogramm | Reviewer Paket 10 | besteht | `src/text/layoutText.ts:152`; Test `layoutText.spec.ts:216–218` pinnt es |
| Kommentar »… any more« | Reviewer Paket 10 | besteht | `src/text/writeText.ts:191` |

**`Fade`/`Flash` gegenstandslos.** Der Eintrag sagt, die Exporte `FadeApi`/`Fade`, `FlashApi`/`Flash`
trügen kein TSDoc, »anders als jedes andere Feature des Verzeichnisses«. `Fade` (`Fade.ts:16–19`)
und `Flash` (`Flash.ts:29–33`) tragen TSDoc, schon in `6500527f`. `FadeApi` und `FlashApi` tragen
TSDoc an jedem Member, nicht am Interface — genau wie jedes andere `*Api`- und `*Options`-Interface
in `src/sprites/features/` (`TintApi`, `FlipApi`, `RotationApi`, `ShearApi`, `QuadSizeApi`,
`AnchorApi`, `YawApi`, `AnimatedFramesApi`, `AtlasFrameApi`, `InstancePositionApi`, `NineSliceApi`,
`OrientationApi`, `PaletteSwapApi`, `SegmentEndApi`, `TableFrameApi`: keines). Es gibt keine
Abweichung vom Verzeichnis, die zu beheben wäre.

**Ein Paket, kein Split.** Neun kleine Stellen in fünf Modulen, keine teilt eine Datei mit einer
anderen, jede für sich ein Einzeiler bis ein Test. Der Reviewer hält den Diff in einem Durchgang.

## Vorgehen

Die Konventionen aus dem Kopf von `./remediation-plan.md` gelten für jede Zeile: keine
Finding-Nummern, kein Rückblick auf den Vorzustand (»früher«, »now«, »no longer«, »any more«),
Code, Kommentare und Doku auf Englisch, Meldungen nach der Regel in `AGENTS.md`.

### 1. `AdaptiveResolution`: eine Übernahme zählt jeden Versuch von vorn (Bugfix)

`#takeOverScale()` (`src/display/AdaptiveResolution.ts:345–354`) läuft im Konstruktor und bei
`enabled = true`. Es setzt die laufende Abstiegsserie (`#pacingDescentFrom = -1`) und den Prüfstatus
eines GPU-Schritts nach oben (`#gpuStepUpPending = false`) zurück, aber nicht den Prüfstatus eines
Pacing-Schritts nach oben und nicht die Zähler auf den nächsten Schritt nach oben. Folge nach
Aus/Ein: (a) mitten in einem Probe-Versuch (`#pacingProbeWindows > 0`) zählen die ersten Fenster der
neuen Übernahme noch zum alten Versuch — ein spätes Fenster gilt als gescheiterter Versuch und
verdoppelt `#pacingProbeFrames`, saubere Fenster verbrauchen die Probe statt saubere Frames zu
zählen; (b) `#pacingCleanFrames` und `#gpuGoodWindows` von vor der Abschaltung zählen auf den
nächsten Schritt nach oben an, obwohl sie auf einer anderen Stufe gemessen wurden.

**Entscheidung (Zug 0): zurückgesetzt wird der Stand eines Versuchs, behalten wird, was der
Controller gelernt hat.**

- zurück auf den Startwert in `#takeOverScale()`, neben den zwei Zeilen, die schon dort stehen:
  `#gpuGoodWindows = 0`, `#pacingCleanFrames = 0`, `#pacingProbeWindows = 0`.
- **bleiben** (nicht anfassen): `#gpuStepUpWindows` und `#pacingProbeFrames` (die Wartezeiten, die
  gescheiterte Schritte nach oben verdoppelt haben), `#pacingCadenceMs` (das Tempo, das ein Abstieg
  gefunden hat), `#method`, `#gpuTime`.
- Grund: Die Zähler und Prüf-Flags gehören zu einem Versuch auf einer Stufe; eine Übernahme setzt die
  Stufe neu aus der Skala des Displays und beginnt die Versuche von vorn — dasselbe Prinzip, nach
  dem `#gpuStepUpPending` und `#pacingDescentFrom` schon zurückgesetzt werden, und
  `#pacingProbeWindows` ist das Gegenstück zu `#gpuStepUpPending`. Die Wartezeiten und das Tempo sind
  dagegen Wissen über Display und Seite: ein Display hinter einem 30-Hz-Panel oder einem
  Stromsparmodus, das ein Spiel in jedem Pausenmenü aus- und einschaltet, zahlte sonst bei jedem
  Wiedereinschalten wieder 240 Frames bei niedrigerer Auflösung für den Abstieg und die
  gescheiterten Versuche nach oben. Abweichung vom Wortlaut des Queue-Eintrags, der
  `#gpuStepUpWindows` unter den nicht zurückgesetzten Feldern nennt: das Feld bleibt, und mit ihm
  sein Pacing-Gegenstück `#pacingProbeFrames`, damit beide Methoden gleich behandelt werden.
- Kommentar über `#takeOverScale()` (`:345–346`) neu, sinngemäß: *The highest step at or below the
  scale the display has — one that is no positive finite number counts as 1, as it does for the
  display. A takeover starts every try afresh — a descent, a step up and the windows counted toward
  the next one —, and keeps what the tries have taught: the pace a descent found and the waits that
  failed steps up doubled.*
- TSDoc von `enabled` (`:293–300`): den Satz »`true` takes over again from the scale the display has
  then.« ergänzen um: es zählt die Fenster auf den nächsten Schritt nach oben von vorn, das gefundene
  Tempo und die verdoppelten Wartezeiten bleiben. Ein Satz, kein Absatz.
- `docs/display.md:246–247` (Bullet »`adaptive.enabled = false` holds it still …«): nach »`true`
  takes over again.« denselben Inhalt in einem Satz. Zeilenbreite der Datei halten (Prosa ≤ 100).
- Kein CHANGELOG-Eintrag: `AdaptiveResolution` ist unveröffentlicht (`[Unreleased]` → `Added`,
  `CHANGELOG.md:53`), und die `Added`-Zeile beschreibt die Übernahme nicht im Einzelnen.

Regressionstests in `src/display/AdaptiveResolution.spec.ts`, im `describe('holding still and
letting go')` (ab `:579`), mit `makeDisplay()`, `frames()`, `SETTLE` (30) aus der Datei. Erst rot
gegen den unveränderten Code sehen, die Ausgabe gehört in den Report. Die Zahlen:
`GPU_WINDOW` 12 gemessene Frames, `GPU_STEP_UP_WINDOWS` 3, `PACING_WINDOW` 30,
`PACING_PROBE_FRAMES` 180, `PACING_PROBE_WINDOWS` 2; Stufen von 1 in Achteln bis 0,5; bei
`devicePixelRatio` 1 ohne Budget hat jede Stufe ihr eigenes Verhältnis, ein Schritt nach oben von
0,75 führt nach 0,875.

- `a takeover counts the good windows of gpu-time toward a step up from 0`:
  `makeDisplay({timestamps: true, resolutionScale: 0.75})`, `gpu.ms = 1`, neuer Controller;
  `frames(SETTLE + 2 * 12)` (zwei gute Fenster); `enabled = false`, `enabled = true`;
  `frames(SETTLE + 12)` → `scale` bleibt `0.75` (rot heute: drittes Fenster in Folge, Schritt nach
  0,875); `frames(2 * 12)` → `0.875`.
- `a takeover counts the clean frames of frame-pacing toward a try up from 0`:
  `makeDisplay({resolutionScale: 0.75})`, neuer Controller; `frames(SETTLE + 150)` (fünf saubere
  Fenster); Aus/Ein; `frames(SETTLE + 30)` → `scale` bleibt `0.75` (rot heute: 180 erreicht, Versuch
  nach 0,875); `frames(150)` → `0.875`.
- `a takeover ends a try up of frame-pacing that is still being judged`:
  `makeDisplay({resolutionScale: 0.75})`, neuer Controller; `frames(SETTLE + 180)` → `scale` `0.875`
  (Versuch läuft, zwei Probe-Fenster offen); Aus/Ein — das Display bekommt `0.75` zurück, die neue
  Übernahme setzt `0.75`; `frames(SETTLE + 180)` → `scale` `0.875` (rot heute: die ersten zwei
  Fenster gehen als Probe-Fenster des alten Versuchs weg, nur 120 saubere Frames gezählt, `0.75`).

Passt eine Frame-Zahl wegen eines Settle-Frames nicht genau, die Zahl aus dem Ablauf herleiten und im
Testkommentar begründen — nicht so lange schieben, bis es grün wird.

### 2. `SpritePicker`: ein abgelehnter Pick gibt zurück, was er gesammelt hat (Bugfix)

`#pick()` (`src/sprites/SpritePicker.ts:229–249`) ruft `#gather(list)` (`:235`) vor dem `try`
(`:237`). Wirft `#gather()` — der `RangeError` für ein Mesh mit mehr als 2^24 Sprites (`:263–267`),
oder ein Wurf aus `#sync()`/`#build()` —, gehen die Handle-Arrays der schon gesammelten Records nicht
an `#spareHandles` zurück, und die schon eingehängten Pick-Meshes bleiben bis zum nächsten Pick in
`#scene`.

- `#gather()` füllt ein Array, das `#pick()` hält: Signatur `#gather(list: readonly FeatureSprites[],
  drawn: Drawn[]): void` (statt `Drawn[]` zu liefern). In `#pick()`: `const drawn: Drawn[] = [];`
  vor dem `try`, dann im `try` zuerst `this.#gather(list, drawn);` und
  `if (drawn.length === 0) return undefined;`, danach `#aim()`, `#draw()`, `resolvePixel()` wie
  jetzt. Der `finally`-Block bleibt, wie er ist: er gibt jedes gesammelte Handle-Array zurück
  (Löcher übersprungen) und leert die Szene — jetzt auch nach einem Wurf aus `#gather()`.
- Einen Kommentar an den `try` setzen, warum `#gather()` darin steht (sinngemäß: *a refusal halfway
  through the list gives back what the meshes before it took*). Den bestehenden Kommentar »from here
  on everything runs in one go, up to the read back« behalten.
- TSDoc von `pick()` unverändert lassen: es sagt nichts über den Zustand nach einer Ablehnung, und der
  Vertrag nach außen ändert sich nicht.
- Kein CHANGELOG-Eintrag: `SpritePicker` ist unveröffentlicht (`CHANGELOG.md:47`, `[Unreleased]` →
  `Added`).

Regressionstest in `src/sprites/SpritePicker.spec.ts`, neben `refuses a mesh of more sprites than
the float target names exactly, before it draws` (`:250`), mit `makeRenderer()`, `makeSprites()`,
`makeCamera()`, `center` aus der Datei. Erst rot sehen:

- `a refused pick gives back the handles and the pick meshes of the entries before the one it
  refuses`: zwei Meshes `a` und `b` (je `makeSprites(1)`); `vi.spyOn(a.spritePool!, 'copyVOsInto')`
  zeichnet das übergebene Array auf. Erster Pick `[a]` → gelingt, `pickMesh =
  rendered[0]!.children[0]`, Handle-Array `first` aus dem Spy. Dann `usedCount` von `b` per
  `vi.spyOn(b.spritePool!, 'usedCount', 'get').mockReturnValue(2 ** 24 + 1)`, Pick `[a, b]` →
  rejects mit `RangeError`; danach `expect(pickMesh.parent).toBeNull()` (rot heute: hängt in der
  Pick-Szene). Dritter Pick `[a]` → der Spy sieht wieder `first` (`toBe(first)`; rot heute: ein
  neues Array, weil das alte nicht zurückkam). Aufräumen wie die Nachbartests (`dispose()` von
  Sprites und Picker).

### 3. `VertexObjectPool#sortBy()`: die `NaN`-Zeile gehört zur Ordnung

TSDoc von `sortBy()` (`src/vertex-objects/VertexObjectPool.ts:418–458`): die letzte Zeile des
`@throws`-Tags (`:457`, »`NaN` keys go behind every number, infinities included«, ohne Schlusspunkt)
streichen und ihren Inhalt in den Absatz zur Ordnung (`:434–435`) nehmen:

> The order is stable: equal keys keep the slot order they had. `descending` puts the highest key
> first, and a `NaN` key goes last in either direction, behind every number, infinities included.

Nur Kommentar, kein Test, kein CHANGELOG. Zeilenbreite 130 halten.

### 4. `Fade`/`Flash`: entfällt (gegenstandslos, siehe Abgleich)

Nichts zu tun. Nicht nebenbei TSDoc an `FadeApi`/`FlashApi` ergänzen — das wäre eine Abweichung
von den 15 anderen `*Api`-Interfaces des Verzeichnisses, keine Angleichung.

### 5. Allokations-Spec: `resize()` eines Canvas, das sich selbst vermisst

`src/display/hot-path-allocations.spec.ts` baut das Display mit `resizeTo: () => SIZE` (`:54`); der
Zweig `measuresItself` in `Display#applyMeasuredSize()` (`src/display/Display.ts`, `#selfSize*` und
`readsBackWrittenSize()`) und `#measureSizeSource()` über `getBoundingClientRect()` laufen dort nie.
Ein zweites `describe` in derselben Datei misst sie:

- `describe('Display on the hot path, a canvas that measures itself', …)` mit eigenem `beforeEach`/
  `afterEach` nach dem Muster des ersten, mit diesen Unterschieden:
  - der `view` hat die Size-Watch eines Browsers, damit das Display nicht pollt:
    `ResizeObserver` als Klasse mit `observe() {}`, `unobserve() {}`, `disconnect() {}`,
    `matchMedia: () => mediaQuery` (ein einmal gebautes Objekt mit `addEventListener() {}`,
    `removeEventListener() {}`), `addEventListener() {}`, `removeEventListener() {}`; daneben
    `devicePixelRatio: 2` und `performance` wie im ersten Block.
  - `getBoundingClientRect: () => RECT` mit einem einmal gebauten `const RECT = {width: 320,
    height: 200}` — ein Stub, der je Aufruf ein Objekt baut, misst seine eigene Allokation.
  - `new Display(renderer)` ohne `resizeTo`: die Größenquelle ist `renderer.domElement`, das Canvas
    selbst.
- zwei Tests mit dem vorhandenen `bytesPerResize()`-Muster (eine Messung vorweg, dann
  `measureSettledBytes()` über `CALLS` Aufrufe):
  - `resize() of a canvas that measures itself allocates nothing per call` — und belegt, dass
    gemessen wurde: `display.width` `640`, `display.height` `400` (320 × 200 CSS-Pixel bei Ratio 2).
  - `resize() of a canvas that measures itself under a pixelZoom allocates nothing per call` —
    `display.pixelZoom = 2`; `display.devicePixelZoom` `4`, `display.width` `160`, `display.height`
    `100`. Die ganzen Pixel ergeben wieder 320 × 200 CSS-Pixel: jede Messung nach der ersten liest
    die Größe zurück, die das Display geschrieben hat, und läuft durch den Zweig, der die Basis hält.
- Schwelle wie im ersten Block (`BYTES_PER_CALL_LIMIT`). Liegen `width`/`height` anders, als hier
  gerechnet, zuerst den Stub prüfen (Ränder aus `getComputedStyle`), nicht die Erwartung anpassen.
- Den Kopfkommentar über dem ersten `describe` (`:20–22`) so ergänzen, dass er beide Wege nennt: die
  Messung mit Callback (Poll-Pfad) und die eines Canvas, das sich selbst vermisst (Size-Watch).

Neue Testdatei-Abschnitte, kein Bugfix: kein roter Lauf nötig. Die Spec läuft unter
`pnpm test:allocations` (Projekt `allocations`), nicht unter `pnpm test:coverage`.

### 6. `evenFrame.spec.ts` ohne `as unknown as`

`src/sprites/features/evenFrame.spec.ts:11–22`: die fünf `as unknown as` streichen. Unter
`@types/three` 0.186 liefert `uniform(n)` ein `UniformNode<'float', number>` und
`uniform(0).lessThan(1)` ein `Node<'bool'>`; `evenFrameOf()` antwortet `Node<'int'>`. Erwartet:
alle fünf entfallen ohne Ersatz, `evaluateNode(…) as number` (eine gewöhnliche Verengung von
`EvaluatedValue`) bleibt. Wo `pnpm nx typecheck twopoint5d` an einer Stelle widerspricht, kommt dort
genau ein benannter, typisierter Helfer in die Spec mit einem Kommentar, welche Deklaration von
`@types/three` zu eng ist — kein `as unknown as` in der Datei. Die anderen Specs des Verzeichnisses
(`fade-flash.spec.ts`, `Anchor.spec.ts`, `Flip.spec.ts`, `Wave.spec.ts`) bleiben unberührt: der
Befund gilt der Datei, die Paket 7 neu angelegt hat.

### 7. `layoutText()`: ein übersprungenes Ideogramm lässt keine Umbruchstelle (Bugfix)

`entriesOf()` (`src/text/layoutText.ts:125–160`) setzt in `:152` `pendingBreak = true` für jedes
Zeichen aus `BREAK_BEFORE` (Han, Hiragana, Katakana), bevor es weiß, ob das Zeichen eine Glyphe
bekommt. Fehlt sie und gibt es kein `fallback`, wird das Zeichen übersprungen, und die Umbruchstelle
wandert auf den nächsten Eintrag — ist das `。` oder `」`, beginnt eine schließende Marke eine Zeile,
gegen das TSDoc von `layoutText()` (`:262–265`), den Kommentar über `BREAK_BEFORE` (`:72–73`) und
`docs/text.md:147–148`.

**Entscheidung (Zug 0): die Umbruchstelle vor einem Ideogramm oder Kana gehört zu seiner Glyphe.**
Ein übersprungenes Zeichen nimmt keinen Platz ein und trennt kein Kerning-Paar (TSDoc `:259`) —
es ist für das Layout nicht da, also lässt es auch keine Umbruchstelle. Im Modell der Bibliothek
bleibt jedes Zeichen, das nicht selbst in `BREAK_BEFORE` ist, beim Zeichen davor, ein Buchstabe wie
eine Marke; eine Regel »die Stelle bleibt, aber eine Marke nimmt sie nicht« fiele deshalb mit
»die Stelle entfällt« zusammen. Eine Umbruchstelle, die vor dem übersprungenen Zeichen schon
offenstand — ein Leerzeichen ohne Glyphe, ein U+200B —, geht wie bisher auf den nächsten Eintrag
über. Das kehrt den Test `a skipped ideograph leaves the place to break before the next char`
(`layoutText.spec.ts:216–218`) um, den Paket 10 geschrieben hat; eine Entscheidung des Nutzers steht
dem nicht entgegen (»Entscheidungen« im Plan nennt das Thema nicht), und der Reviewer von Paket 10
hat den Widerspruch zum Vertrag gemeldet.

- Code in `entriesOf()`, Zweig »any other char« (`:151–153`): erst die Glyphe holen, dann die
  Umbruchstelle setzen, nur wenn es eine gibt:

  ```ts
  } else {
    glyph = font.glyph(char) ?? fallback;
    // the place to break before an ideograph or a kana goes with its glyph: one skipped leaves none,
    // so the mark after it stays with the char before
    if (glyph !== undefined && BREAK_BEFORE.test(char)) pendingBreak = true;
  }
  ```

  Die Zeilen danach (`if (glyph !== undefined) { push …; pendingBreak = false; }`) bleiben.
- Kommentar über `BREAK_BEFORE` (`:72–73`): um den Halbsatz ergänzen, dass ein Ideogramm oder Kana,
  das die Schrift nicht hat und kein `fallback` zeichnet, keine Umbruchstelle lässt.
- TSDoc von `layoutText()` (`:262–265`): nach »A mark after an ideograph stays with it, so a closing
  mark never starts a line.« ein Satz: *An ideograph or a kana the font lacks and no `fallback`
  draws is skipped and leaves no place to break.*
- `docs/text.md:145–149` (Absatz **Word wrap**): derselbe Satz nach »… so a closing mark never starts
  a line.« Prosa ≤ 100 Zeichen je Zeile, Absatz neu umbrechen.
- `docs/proposals/dynamic-atlas-and-bitmap-text.md:528–529` (»An ideograph or a kana … is a place to
  break before itself, decided by the char of the text even where the `fallback` draws it.«): um
  »; one the font lacks and no `fallback` draws is skipped and leaves none« ergänzen. Zeilenbreite
  der Datei halten.
- `CHANGELOG.md:37` (`[Unreleased]` → `Added`, `writeText()`/`layoutText()`): der Text-Modul ist
  unveröffentlicht, die Zeile beschreibt den Stand. Nach »… after U+200B and before an ideograph or a
  kana« einfügen: »(one the font lacks and no `fallback` draws leaves no place to break)«. Kein
  Migration Guide, kein `Changed`-Eintrag.

Tests in `src/text/layoutText.spec.ts`, `describe` mit den Umbruch-Tests (`:201–218`). Erst den
neuen Test rot sehen:

- neu: `a closing mark after a skipped ideograph stays on the line of the char before it` — Font aus
  `tinyFontData()` plus eine Glyphe für `。` (U+3002), nach dem Muster von `:189–191`
  (`data.chars = [...data.chars, {...das '-'-Glyph, id: 0x3002}]`); `layoutText(font, 'AV日。',
  {maxWidth: 8})` ohne `fallback`: `lineCount` `1`, alle Glyphen auf Zeile 0 (rot heute: `。` auf
  Zeile 1, weil `AV` 7 breit ist und `。` 4 dazu bringt).
- umgedreht: `layoutText.spec.ts:216–218` heißt jetzt `a skipped ideograph leaves no place to break:
  the chars on both sides of it stay one word` und erwartet `lineCount` `1` für `'AV日AV'` bei
  `maxWidth: 8`.
- unverändert grün bleiben müssen `a line breaks before an ideograph, and a closing mark stays with
  the char before it` (`:201`, mit `fallback`) und `a line breaks before a kana` (`:211`).

### 8. `StageRenderer#getStagePass()` baut die Meldung aus `NO_PASS_NODE`

`src/stage/StageRenderer.ts:1064–1066`: die Meldung schreibt den Text der Konstante `NO_PASS_NODE`
(`:53–54`) aus. Ersetzen durch

```ts
`StageRenderer#renderTo() cannot compose the stage ${JSON.stringify(stage.name)}: that stage ${NO_PASS_NODE}`
```

— derselbe Wortlaut wie heute, wie in `add()` (`:1314`). Den Test `renderTo() throws for a stage
that has lost its asPassNode() since it was added` (`StageRenderer.spec.ts:2785`, Regex auf
`cannot compose the stage "lost"`) nicht anfassen; er bleibt grün. `JSON.stringify(stage.name)`
bleibt in diesem Paket stehen: ob Stage-Namen in Meldungen über `describeValue()` gehen, entscheidet
Paket 19 für alle vier Stellen der Datei zusammen.

### 9. `writeText.ts:191` ohne Rückblick

`src/text/writeText.ts:191`: »// disposed sprites hold no sprite, so none of the glyphs is theirs any
more« → »// disposed sprites hold no sprite, so no glyph belongs to them«. Nur der Kommentar.

## Was der Implementierer nicht tut

- Kein TSDoc an `FadeApi`/`FlashApi` (Schritt 4).
- Keine `as unknown as` in anderen Specs als `evenFrame.spec.ts`.
- Keine Änderung an `JSON.stringify(stage.name)` (Paket 19), an `docs/display.md:244` »one every 180
  clean frames« (Paket 17) oder an Umbrüchen außerhalb der Absätze, die dieses Paket ändert
  (Paket 18).
- `#gpuStepUpWindows`, `#pacingProbeFrames`, `#pacingCadenceMs` in `#takeOverScale()` nicht
  zurücksetzen (Schritt 1, Entscheidung).

## Befunde im Volltext

**Queue · `packages/twopoint5d/src/display/AdaptiveResolution.ts:346-353`** — `#takeOverScale()`
setzt `#pacingDescentFrom` und `#gpuStepUpPending` zurück, aber nicht `#pacingProbeWindows`,
`#pacingCleanFrames`, `#gpuGoodWindows`, `#gpuStepUpWindows`: nach Aus/Ein mitten in einem
Probe-Fenster zählt das erste Fenster der neuen Übernahme noch zum alten Versuch nach oben (spät →
eine Stufe tiefer, Wartezeit verdoppelt), gute GPU-Fenster von vor der Abschaltung zählen auf die
nächste Stufe an; stand so schon in `6500527f` (Paket 4) → Scope

**Queue · `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:450`** — im `@throws`-Tag von
`sortBy()` steht die Zeile »`NaN` keys go behind every number, infinities included« ohne
Schlusspunkt und gehört inhaltlich zur Ordnung der Keys, nicht zum Wurf; stand so schon in
`920bfdac` (Paket 5) → Scope

**Queue · `packages/twopoint5d/src/sprites/SpritePicker.ts:264`** — der `RangeError` in `#gather()`
(Mesh mit mehr als 2^24 Sprites) fliegt vor dem `try` von `#pick()` (`:235`): die Handle-Arrays der
schon gesammelten Records gehen nicht an `#spareHandles` zurück, schon eingehängte Pick-Meshes
bleiben bis zum nächsten Pick in der Pick-Szene; ohne Folgen für die Korrektheit; stand so schon in
`0d04dce6` (Paket 6) → Scope

**Queue · `packages/twopoint5d/src/sprites/features/Fade.ts:4`/`:20`, `Flash.ts:4`/`:34`** — die
öffentlichen `FadeApi`/`Fade`, `FlashApi`/`Flash` tragen kein TSDoc am Export, anders als jedes
andere Feature des Verzeichnisses; stand so schon in `6500527f` (Paket 7) → Scope ·
**gegenstandslos** (Abgleich oben)

**Reviewer Paket 3 (klein)** — `hot-path-allocations.spec.ts` belegt den Zweig eines
selbstvermessenden Canvas (ResizeObserver-Pfad) nicht auf Allokationsfreiheit.

**Reviewer Paket 7 (klein)** — `src/sprites/features/evenFrame.spec.ts:11–21` sechs `as unknown as`
statt typisiertem Helfer.

**Reviewer Paket 8 (klein)** — `StageRenderer.ts:1065` `#getStagePass()` schreibt den Text von
`NO_PASS_NODE` aus statt die Konstante zu nutzen.

**Reviewer Paket 10 (klein)** — `layoutText.ts:152` `pendingBreak` geht über ein übersprungenes
CJK-Zeichen auf den nächsten Eintrag über, sodass ein `。` eine Zeile beginnen kann, gegen TSDoc
`:264–265`, Kommentar `:73` und `docs/text.md:148`.

**Reviewer Paket 10 (klein)** — `writeText.ts:191` Kommentar »… any more« liest sich als Rückblick.

## Urteil des Reviewers

- Schritt 1 (`#takeOverScale()`-Zähler): behoben — `src/display/AdaptiveResolution.ts` `#takeOverScale()` setzt `#gpuGoodWindows`, `#pacingCleanFrames`, `#pacingProbeWindows` auf 0; Kommentar, TSDoc `enabled`, `docs/display.md` nachgezogen; drei Regressionstests in `AdaptiveResolution.spec.ts`
- Schritt 2 (`SpritePicker`-Fehlerpfad): behoben — `#gather(list, drawn)` im `try` von `#pick()`; Regressionstest in `SpritePicker.spec.ts`
- Schritt 3 (`sortBy()`-NaN-Zeile): behoben — Satz im Ordnungsabsatz des TSDoc, `@throws` ohne die Zeile
- Schritt 4 (`Fade`/`Flash`): entfallen, unberührt
- Schritt 5 (Allokations-Spec): behoben — zweites `describe` in `hot-path-allocations.spec.ts`, Kopfkommentar nennt beide Wege
- Schritt 6 (`evenFrame.spec.ts`): behoben — alle fünf `as unknown as` ohne Ersatz entfallen
- Schritt 7 (`layoutText()`-Umbruch): behoben — `src/text/layoutText.ts` Zweig »any other char«; TSDoc, Kommentar `BREAK_BEFORE`, `docs/text.md`, Proposal, CHANGELOG nachgezogen; neuer und umgedrehter Test in `layoutText.spec.ts`
- Schritt 8 (`NO_PASS_NODE`): behoben — `src/stage/StageRenderer.ts:1065`
- Schritt 9 (`writeText.ts:191`): behoben
- Qualität: keine Befunde. Anmerkung des Runners: der Reviewer nennt für Schritt 5 640 × 400; im Code stehen richtig 320 × 200 (`Display#width`/`height` sind CSS-Pixel, `hot-path-allocations.spec.ts:177–179`), die Abweichung vom Detailplan hat der Implementierer begründet.

## Nebenbefunde (Urteil)

- `SpritePicker.ts:477` roher Pointer in der Meldung → Scope, in Paket 19: dieselbe Ursache (abgelehnter Wert am `describeValue()`-Weg vorbei).
- `SpritePicker.ts:279–280` Handle-Array geht bei Wurf in `#handlesOf()` verloren → Scope; nicht nachgezogen, weil der Detailplan nur die Records vor dem abgelehnten Eintrag nennt und die Drain-Runde den Schnitt entscheidet.
- `docs/text.md` Prosazeilen über 100 Zeichen: steht schon in »Offene Befunde« (Paket 18), kein neuer Eintrag.
