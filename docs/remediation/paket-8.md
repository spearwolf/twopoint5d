# Paket 8 — Sprites: die Allokations-Specs der Sprite-Setter messen, was die Setter allozieren, in jedem Inlining-Zustand

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Folge von Paket 2, geschnitten in Zug 2 von Paket 6; Befund im Volltext unten)
- Folge von: Paket 2
- Ziel: Die Allokations-Specs der Sprites messen in jedem Inlining-Zustand von V8 — unter Coverage, unter Last, ohne Inlining — nur, was die Setter allozieren, die Weitergabe der Werte eines Aufrufers in einem Array ist unabhängig vom JIT belegt, und `pnpm run ci` fällt nicht mehr an ihnen.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/sprites/hot-path-allocations.spec.ts`, `AGENTS.md` (Absatz zu `hot-path-allocations.spec.ts`, Zeilen 99–108). **Nicht** anfassen: `TexturedSprite.ts`, `AnimatedSprite.ts`, `src/testing/` — die Setter sind korrekt (Abgleich unten), und ihre Kommentare zum Tupel (`TexturedSprite.ts:96`–`:107`, `AnimatedSprite.ts:39`–`:48`) stimmen weiter. Kein CHANGELOG-Eintrag: das Paket ändert kein Verhalten des Pakets, nur Specs und Agenten-Doku.
- Messverzeichnis (Zug 0): `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad/paket-8.zug0-messungen/` — im Folgenden `$M`. `README.txt` dort erklärt Aufrufe und Ergebnisse; `vitest.exp.config.ts` fährt eine einzelne Spec unter v8-Coverage **ohne** Schwellen (die Projekt-Config scheitert mit einer einzelnen Spec an den Glob-Schwellen, Exit 1).

## Abgleich (Zug 0, 2026-09-28, gegen `ed67fc58`)

Der Befund aus dem Plan besteht, der Ort der Ursache ist ein anderer als vermutet:
**Die Bibliothek alloziert nichts. Die 16 B je Sprite boxt die Schleife der Spec
selbst** — das Argument `i * 0.5 + 0.25`, sobald V8 ihren Aufruf von
`setPosition()` nicht inlinet.

1. **Signatur.** Mit abgeschaltetem Inlining (`--no-turbo-inlining --no-maglev-inlining`, auch nur TurboFan ohne Inlining) messen die drei geflatterten Tests exakt 16,00 B je Sprite — 4,00 / 8,00 / 16,00 B je Aufruf, dieselben Werte wie die Flakes (4,00308 / 8,00624 / 15,99648). Ein HeapNumber je Schleifendurchlauf; die Bibliothek legt selbst dann nichts drauf, wenn jede ihrer Methoden als eigener Frame läuft (`$M/tier-signatures.txt`).
2. **Zuordnung.** Der Sampling-Heap-Profiler legt ≥ 99,5 % der Bytes in den Frame der Rundenschleife der Spec. Ohne Inlining sind die Bibliotheksmethoden eigene Frames — die Bytes liegen also im Code der Spec, am Aufruf. Einschränkung: der Profiler rechnet ge-inlineten Code dem physischen Frame zu (die Mutante unten landet ebenfalls in der Schleife), er trennt Spec und Bibliothek also nur im Zustand ohne Inlining (`$M/attribution-*.txt`).
3. **Reproduktion.** `src/sprites/hot-path-allocations.spec.ts` allein unter Coverage: `moving, turning, re-framing and tinting a textured sprite allocates nothing per call` rot in **9 von 9** Läufen (3 mit der Projekt-Config, Schwellen auf 0, und 6 mit `$M/vitest.exp.config.ts`; die Kopie `$M/orig.exp.spec.ts` dazu 4 von 4), immer 4,00308 B je Aufruf; ohne Coverage 3/3 grün. In der vollen Suite ist er meist grün (Paket 6: 1 von 20) — welche Aufrufe V8 inlinet, hängt vom Zustand des JIT ab. Ohne jedes Inlining fallen **vier** Tests: dazu `moving and animating an animated sprite allocates nothing per call` (5,33 B je Aufruf = 16 B je Sprite), der bisher nie geflattert hat (`$M/candidate-tiers.txt`).
4. **Anteil von Paket 2.** Mit `setPosition()`/`setColor()` im Stand von `e7767c6d` (Default-Parameter statt `undefined`-Zweig, per Prototyp-Override im Scratch) ist dieselbe Spec allein unter Coverage 4/4 grün, mit den heutigen rot (`$M/prerun.txt`). Die größeren Setter aus Paket 2 schieben die volle Schleife über die Kante des Inlining-Budgets, das die Zähler der Block-Coverage ohnehin schneller aufbrauchen. Die Schwäche der Spec — ein frischer Bruchwert der Schleife über einen Aufruf, den V8 nicht inlinen muss — stand schon auf `e7767c6d` in zwei Tests (`git show e7767c6d:packages/twopoint5d/src/sprites/hot-path-allocations.spec.ts`, `:44` und `:65`). Einordnung bleibt: Folge von Paket 2, Ursache in der Spec.
5. **Nachweiskraft.** Die volle Schleife (mit `setFrame()`) fängt ohne Coverage eine Mutante, die `setPosition()` die Werte einzeln an `setInstancePosition()` reichen lässt (16 B je Sprite), und eine, die `setColor()` einzeln an `setColorValues()` reichen lässt (48 B); eine Schleife ohne `setFrame()` inlinet alles und fängt keine (`$M/variants.txt`). Unter Coverage, oder wenn V8 den Aufruf der Spec nicht inlinet, ist die Positions-Mutante unsichtbar: `x` kommt dann schon geboxt an. Der Nachweis per Bytes funktioniert für die Position nur in einem Fenster des Budgets — das ist die Wurzel des Flatterns.

### Entscheidung dieses Zugs

Die Schleifen reichen den Settern **keinen Bruchwert, den sie selbst ausrechnen**:
`setPosition(i, …)` statt `setPosition(i * 0.5 + 0.25, …)`. Dann boxt die Schleife
in keinem Inlining-Zustand etwas (Kandidat `$M/candidate.exp.spec.ts`: allein unter
Coverage 6/6 grün, ohne Inlining, nur Maglev, nur TurboFan und mit 200 ms
Compile-Verzögerung grün). Die Bruchwerte, die die Setter weiter sehen, kommen aus
Konstanten, aus `tint` und aus den Frames; die beiden letzten lesen die Setter selbst,
eine Farb-Mutante fällt deshalb weiter auf (12 B je Aufruf mit und ohne Coverage, auch
ohne Inlining; nur unter reinem Maglev nicht). Dass die Setter die Werte **eines
Aufrufers** in einem Array weiterreichen, belegt künftig ein Spy-Test — deterministisch,
unabhängig vom JIT (`$M/spy.txt`: Positions-Mutante rot).

Verworfen, mit Grund:
- `setPosition()`/`setColor()` wieder kleiner machen, bis das Budget reicht: Arbeit an einer Kante, die mit jeder V8-Version und jeder Coverage-Instrumentierung wandert; die Spec bliebe dieselbe Wette.
- Bytes per Heap-Profiler nach Frame zuordnen (Spec gegen Bibliothek): der Profiler rechnet ge-inlineten Bibliothekscode der Schleife zu — die Mutante wäre unsichtbar (Punkt 2).
- Schleifenreihenfolge ändern (`setPosition()` zuletzt): unter Coverage ebenso rot (`$M/variants.txt`, `poslast`).
- Allokations-Specs aus dem Coverage-Lauf nehmen: ändert die CI-Kette und die in Paket 5/6 für alle Allokations-Specs festgelegte Messumgebung — ein anderer Weg als der freigegebene, und unnötig, weil die Ursache in dieser einen Spec liegt.
- Toleranz von 16 B je Sprite für den eigenen Wert der Schleife: ließe genau die Regression durch, gegen die die Spec schützen soll.

## Vorgehen

Alle Pfade relativ zu `packages/twopoint5d/`. Kommentare, Testnamen und Doku auf Englisch;
Konventionen aus dem Plan-Kopf (keine Finding-ID, kein Rückblick auf den Vorzustand).

**0. Rot vor dem Umbau** — bevor du etwas änderst, aus `packages/twopoint5d/`:

```bash
M=/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad/paket-8.zug0-messungen
COVERAGE=1 SPEC=src/sprites/hot-path-allocations.spec.ts pnpm vitest --run --config $M/vitest.exp.config.ts
COVERAGE=1 EXEC_ARGV="--no-turbo-inlining --no-maglev-inlining" SPEC=src/sprites/hot-path-allocations.spec.ts pnpm vitest --run --config $M/vitest.exp.config.ts
```

Erwartet: der erste Lauf rot mit `4.00 bytes per call` am ersten Test, der zweite rot an vier
Tests (4,00 / 8,00 / 5,33 / 16,00). Beide Ausgaben gehören als roter Lauf in den Report.

**1. Die vier Schleifen** in `src/sprites/hot-path-allocations.spec.ts`: in genau diesen Zeilen
`i * 0.5 + 0.25` durch `i` ersetzen, sonst nichts an den Aufrufen:
- `:45` `sprite.setPosition(i * 0.5 + 0.25, 1.5, 2.5);` → `sprite.setPosition(i, 1.5, 2.5);`
- `:65` `sprite.setPosition(i * 0.5 + 0.25, 1.5);` → `sprite.setPosition(i, 1.5);`
- `:102` `sprite.setPosition(i * 0.5 + 0.25, 1.5, 2.5);` → `sprite.setPosition(i, 1.5, 2.5);`
- `:121` `all[i]!.setPosition(i * 0.5 + 0.25, 1.5);` → `all[i]!.setPosition(i, 1.5);`

`1.5`, `2.5`, `tint`, `0.5`, `rotation = i`, `animOffset = i`, die Frames und die Divisoren
(`all.length * 4` usw.) bleiben.

**2. Der Kommentar** `:37`–`:41` im ersten Test wird ersetzt. Vorlage — der Sinn ist
bindend, am Wortlaut darfst du feilen:

```ts
    // the loop hands the setters whole numbers from its counter, constants and objects, and no
    // fractional value it works out itself: V8 boxes such a value at each call it leaves
    // un-inlined, and which calls it inlines shifts with its inlining budget, which the counters
    // of block coverage use up sooner — the loop would measure a heap number of its own per
    // sprite. The fractional values here come from the constants, from `tint` and from the
    // frames, and the setters read the last two themselves: a setter that hands one of them on
    // as an argument of its own allocates in this round wherever V8 leaves that call un-inlined.
    // That the setters hand the values of their caller on in one array is checked by the two
    // tests after the allocation tests of the setters
```

Die drei anderen Tests bekommen keinen eigenen Kommentar.

**3. Zwei neue Tests** im selben `describe('sprites on the hot path', …)`, direkt nach
`moving an animated sprite by x and y alone allocates nothing per call` (vor
`createSprite() allocates the sprite and nothing else`). `vi` kommt in den Import aus
`vitest` dazu. Vorlage:

```ts
  // a value its caller works out reaches a setter unboxed where V8 inlines the setter into the
  // caller, and it stays unboxed only while the setter does not hand it on as an argument of its
  // own to a call V8 leaves un-inlined — which the rounds above cannot show for such a value (see
  // the first of them). So these check what the setters hand on: one array, which the generated
  // setter copies into the buffer. The setters write the same array again on the next call, so
  // every call is checked before the next one
  test('a textured sprite hands the values of setSize(), setPosition() and setColor() on in one array', () => {
    const sprites = new TexturedSprites(1);
    const sprite = sprites.createSprite()!;
    const setQuadSize = vi.spyOn(sprite, 'setQuadSize');
    const setInstancePosition = vi.spyOn(sprite, 'setInstancePosition');
    const setColorValues = vi.spyOn(sprite, 'setColorValues');

    sprite.setSize(0.25, 0.75);
    expect(setQuadSize.mock.calls).toEqual([[[0.25, 0.75]]]);

    sprite.setPosition(0.25, 1.5, 2.5);
    expect(setInstancePosition.mock.calls).toEqual([[[0.25, 1.5, 2.5]]]);
    setInstancePosition.mockClear();
    sprite.setPosition(0.75, 1.25);
    expect(setInstancePosition.mock.calls).toEqual([[[0.75, 1.25]]]);

    sprite.setColor(new Color(0.5, 0.25, 0.125), 0.5);
    expect(setColorValues.mock.calls).toEqual([[[0.5, 0.25, 0.125, 0.5]]]);
    setColorValues.mockClear();
    sprite.setColor(new Color(0.75, 0.5, 0.25));
    expect(setColorValues.mock.calls).toEqual([[[0.75, 0.5, 0.25]]]);

    sprites.dispose();
  });

  test('an animated sprite hands the values of setSize() and setPosition() on in one array', () => {
    const geometry = new AnimatedSpritesGeometry(1);
    const sprite = geometry.instancedPool.createVO()!;
    const setQuadSize = vi.spyOn(sprite, 'setQuadSize');
    const setInstancePosition = vi.spyOn(sprite, 'setInstancePosition');

    sprite.setSize(0.25, 0.75);
    expect(setQuadSize.mock.calls).toEqual([[[0.25, 0.75]]]);

    sprite.setPosition(0.25, 1.5, 2.5);
    expect(setInstancePosition.mock.calls).toEqual([[[0.25, 1.5, 2.5]]]);
    setInstancePosition.mockClear();
    sprite.setPosition(0.75, 1.25);
    expect(setInstancePosition.mock.calls).toEqual([[[0.75, 1.25]]]);

    geometry.dispose();
  });
```

`vi.spyOn()` auf dem Vertex-Objekt legt eine eigene Eigenschaft an und ruft das Original
weiter (in Zug 0 geprüft); `restoreMocks: true` der Config räumt nach jedem Test auf.
Typfehler des Spys wegen der Overloads: mit dem kleinsten nötigen Cast lösen, nicht mit
`any` für das ganze Sprite.

**4. Beleg, dass die neuen Tests beißen** — Mutanten, danach **zurücksetzen** (im Diff
darf nichts davon stehen):
- `src/sprites/TexturedSprites/TexturedSprite.ts` `setPosition()` vorübergehend auf
  `this.setInstancePosition(x, y, z === undefined ? this.z : z);` → der neue Test der
  Textured-Sprites rot. Zurücksetzen.
- `setColor()` vorübergehend auf `this.setColorValues(color.r, color.g, color.b, a === undefined ? this.a : a);`
  → der neue Test rot, und unter Schritt 0 (erstes Kommando) der erste Allokationstest rot
  mit 12,00 B je Aufruf. Zurücksetzen.
- `src/sprites/AnimatedSprites/AnimatedSprite.ts` `setPosition()` vorübergehend auf
  `this.setInstancePosition(x, y, z === undefined ? this.z : z);` → der neue Test der
  Animated-Sprites rot. Zurücksetzen.

Alle drei roten Läufe in den Report, danach `git diff --stat` ohne `TexturedSprite.ts` und
`AnimatedSprite.ts`.

**5. `AGENTS.md`**: im Absatz zu `hot-path-allocations.spec.ts` nach dem Satz, der mit
``src/map2d/hot-path-allocations.tilted-view.spec.ts` shows the sequence.`` endet
(`:107`), ein Satz dazu. Vorlage:

> A round hands the calls it measures whole numbers, constants and objects, never a
> fractional value it works out itself: V8 boxes such a value at each call it leaves
> un-inlined, and which calls it inlines shifts with the inlining budget, which block
> coverage uses up sooner — the round would measure heap numbers of its own. Whether a
> method hands the values of its caller on without boxing them is checked by what it calls,
> as `src/sprites/hot-path-allocations.spec.ts` does for the sprite setters.

Zeilenlänge und Einrückung wie der Absatz drumherum.

## Verify

Aus dem Repo-Root; `$M` wie oben:

```bash
M=/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad/paket-8.zug0-messungen
pnpm run ci \
&& cd packages/twopoint5d \
&& for n in 1 2 3 4 5 6 7 8 9 10; do COVERAGE=1 SPEC=src/sprites/hot-path-allocations.spec.ts pnpm vitest --run --config $M/vitest.exp.config.ts || exit 1; done \
&& for f in "--no-turbo-inlining --no-maglev-inlining" "--no-turbofan" "--no-maglev"; do COVERAGE=1 EXEC_ARGV="$f" SPEC=src/sprites/hot-path-allocations.spec.ts pnpm vitest --run --config $M/vitest.exp.config.ts || exit 1; done
```

In Zug 0 fiel die Spec im ersten Block 9 von 9 Mal, im zweiten mit vier Tests; nach dem
Umbau muss alles grün sein. `pnpm run ci` ist das Gate; die Baseline im Plan-Kopf ist
vollständig grün.

## Commit

`test(sprites): let the loops of the sprite allocation specs hand the setters whole-number positions, so that a loop boxes nothing of its own whichever calls V8 inlines, and check that the sprite setters hand the values of their caller on in one array`

## Befund im Volltext (aus dem Plan, Stand vor Zug 0)

`packages/twopoint5d/src/sprites/hot-path-allocations.spec.ts:33` `moving, turning,
re-framing and tinting a textured sprite allocates nothing per call` fällt unter vollem
`pnpm nx run twopoint5d:coverage --skip-nx-cache` gelegentlich mit genau 4,00308 B je
Aufruf (16 012 B je Runde von 4 000 Aufrufen = ein geboxtes Double je Sprite, also ein
Setter, den V8 in diesem Lauf nicht inlinet), gemessen in Paket 6: auf `b4857658` 1 von 20
Läufen, im Verify von Paket 6 zweimal; dieselbe Art Fehler an `:58` `moving a textured
sprite by x and y alone and tinting it without an alpha …` (8,01 B je Aufruf,
`$ARBEITSDIR/paket-6.impl-verify-1.log`) und `:114` `moving an animated sprite by x and y
alone …` (`$ARBEITSDIR/paket-6.review-coverage-3.log`, unter Fremdlast); auf `93628b3c~1`
(vor dem Lauf) 0 von 20 — Paket 2 hat `TexturedSprite.ts` (+112 Zeilen) und
`AnimatedSprites` umgebaut; ob Bibliothekscode boxt oder die Messung positionsabhängig ist,
klärt Zug 0 (Sampling-Heap-Profiler wie in Paket 5).

## Verlauf

- 2026-09-28 Zug 0: Detailplan steht · Befund bestätigt, Ursache in der Spec statt in der
  Bibliothek: das Schleifenargument `i * 0.5 + 0.25` wird geboxt, wenn V8 den Aufruf von
  `setPosition()` nicht inlinet — allein unter Coverage 9/9 rot, ohne Inlining vier Tests
  rot, mit den Settern von `e7767c6d` 4/4 grün, Kandidat `setPosition(i, …)` in allen
  Stufen grün · Messungen `paket-8.zug0-messungen/` · offene Folgen anderer Pakete: keine ·
  »Offene Befunde« ohne gemeinsame Ursache mit diesem Paket, bleiben liegen · Restplan
  unverändert (Paket 7 danach, kein Dateiüberlapp)
- 2026-09-28 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort low · `paket-8.impl-0.json`
- 2026-09-28 Zug 2: Report FERTIG · geändert `hot-path-allocations.spec.ts`, `AGENTS.md` · roter Lauf belegt (Coverage 1 rot, ohne Inlining 4 rot), drei Mutanten rot · Arbeitsbaum schmutzig
- 2026-09-28 Zug 2: Verify `pnpm run ci` + 13 Einzel-Spec-Läufe, exit=0 · `paket-8.verify.log`
- 2026-09-28 Zug 3: Reviewer beauftragt (sonnet, low) · Diff `paket-8.diff`
- 2026-09-28 Zug 3: Reviewer (`paket-8.review-0.json`): Ziel erreicht, Schritte 1–5 erfüllt, keine kritischen oder wichtigen Befunde, zwei kleine · keine Fehlerkette
- 2026-09-28 Zug 5: Commit 8f79373a, Verify `paket-8.verify.log` exit=0

## Urteil des Reviewers

- Ziel: erreicht — `hot-path-allocations.spec.ts:49`, `:69`, `:106`, `:125` reichen `setPosition(i, …)`; Spy-Tests `:141`–`:182`; Verify exit=0.
- klein: `AGENTS.md:114` — der eingefügte Satz steht zwischen dem Satz zu `measureSettledBytes()` und »The Vitest config starts its workers with `--expose-gc` for it«; »for it« verliert seinen Bezug. Abhilfe: Satz hinter »never reaches `dist/`« setzen oder »for it« ausschreiben.
- klein: Kommentar im ersten Test (`hot-path-allocations.spec.ts:45`) verweist per Position (»the two tests after the allocation tests«) statt per Testname; folgt der Vorlage.
