# Paket 12 — map2d: Musterwiederholung und ein Test ohne Beweiskraft

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefund: `RepeatingTilesProvider.ts:154` und `:182` (medium) — aus der
  Drain-Runde vom 2026-09-08, vorbestehend, `→ Scope`
- Folge aus Paket 5: `DataIdsChunk2D.spec.ts:29-33` — der Test hält nur die
  halbe Fehlerpolitik fest, die Paket 5 gesetzt hat. Belegt im nachgezogenen
  Review von `4d723fe` (2026-09-08).
- Ziel: `getTileIdsWithin()` setzt die Musterwiederholung an der Länge des
  zuletzt geschriebenen Stücks fort statt an der aufgelaufenen Zielbreite, und
  der Kompressions-Test fällt, wenn jemand die Fehlerpolitik zurückdreht.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.spec.ts`
  - `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
- Commit: `fix(twopoint5d): carry a tile pattern on by the piece just written and keep the compression error off the console`

## Abgleich (Zug 0, 2026-09-08)

Beide Sachverhalte bestehen unverändert, beide an der notierten Zeile.

**`RepeatingTilesProvider.ts:154` und `:182` — unverändert.** Zwei wortgleiche
Kopien derselben Schleife: `:148-155` im Zweig `horizontal`, `:176-183` im
Zweig `none`. Beide schalten die Musterspalte mit `col = (col + x) % this.#cols`
fort, wobei `x` in der Zeile davor bereits um `tiles.length` gewachsen ist. Ab
der dritten Schleifenrunde läuft `col` deshalb um die aufgelaufene Zielbreite
weiter statt um die Länge des Stücks, das gerade geschrieben wurde.

Gemessen am gebauten Stand (`dist/lib/map2d/RepeatingTilesProvider.js`, trägt
die Zeile wörtlich):

| Aufruf | Ist | Soll |
| --- | --- | --- |
| `new RepeatingTilesProvider([1,2,3]).getTileIdsWithin(1, 0, 10, 1)` | `[2,3,1,2,3,3,3,1,2,3]` | `[2,3,1,2,3,1,2,3,1,2]` |
| dasselbe mit `'horizontal'` | `[2,3,1,2,3,3,3,1,2,3]` | `[2,3,1,2,3,1,2,3,1,2]` |
| `new RepeatingTilesProvider([[1,2,3],[4,5,6]]).getTileIdsWithin(1, 0, 8, 2)` | `[2,3,1,2,3,3,3,1,5,6,4,5,6,6,6,4]` | `[2,3,1,2,3,1,2,3,5,6,4,5,6,4,5,6]` |
| `new RepeatingTilesProvider([1,2]).getTileIdsWithin(1, 0, 5, 1)` | `[2,1,2,2,2]` | `[2,1,2,1,2]` |

Der Zweig `vertical` ist nicht betroffen: er wiederholt entlang der Zeilen und
schreibt je Zeile genau ein Stück, ohne Spaltenfortschaltung. Gegenprobe
`new RepeatingTilesProvider([[1],[2],[3]], 'vertical').getTileIdsWithin(0, 0, 3, 4)`
liefert `[1,0,0, 2,0,0, 3,0,0, 1,0,0]` und damit das Richtige.

Warum keine bestehende Spec das sieht: der Fehler braucht eine dritte
Schleifenrunde, also `width > (cols - col) + cols` bei `col > 0`. Sämtliche
Aufrufe in `RepeatingTilesProvider.spec.ts` mit `left ≠ 0` enden nach der
zweiten Runde — `getTileIdsWithin(6, -1, 6, 6)` bei `cols = 4` etwa füllt
`2 + 4 = 6` Werte und ist damit fertig. Auch alle Nutzer im Repo bleiben
darunter: die drei Browser-Tests und die beiden Lookbook-Demos fahren ein
2×2-Muster, und `Map2DTileRenderer` fragt je Kachel eine Fläche in
Kachelgröße ab.

**`DataIdsChunk2D.spec.ts:29-33` — unverändert.** Der Test
`names the compression it cannot handle` prüft `toThrow(/gzip/)` und sonst
nichts. Die Fehlerpolitik, die Paket 5 gesetzt hat, ist zweiteilig; der
CHANGELOG hält sie im `Changed`-Block wörtlich fest:

> `DataIdsChunk2D#prepareData()` names the compression it cannot handle in the
> error it throws and writes nothing to the console: the caller reads the
> reason off the error, in a message that cannot be silenced away

Der Test hält die erste Hälfte. Wer ein `console.error` neben den `throw`
zurückschreibt, bleibt grün.

## Vorgehen

### 1. Die Regressionstests, rot

In `RepeatingTilesProvider.spec.ts`, in `describe('getTileIdsWithin()')`. Zwei
Tests im bestehenden `describe('none')`, einer im bestehenden
`describe('horizontal')` — die Schleife steht in beiden Zweigen, und ein Test
je Zweig ist das Minimum, mit dem eine Kopie nicht davonkommt.

Im `describe('none')`:

```ts
test('repeats a pattern that does not end on the target edge', () => {
  expect(
    Array.from(new RepeatingTilesProvider([1, 2, 3]).getTileIdsWithin(1, 0, 10, 1, new Uint32Array(10).fill(666))),
  ).toEqual([2, 3, 1, 2, 3, 1, 2, 3, 1, 2]);
});

test('repeats every row of a multi-row pattern the same way', () => {
  // prettier-ignore
  expect(
    Array.from(
      new RepeatingTilesProvider([
        [1, 2, 3],
        [4, 5, 6],
      ]).getTileIdsWithin(1, 0, 8, 2, new Uint32Array(16).fill(666)),
    ),
  ).toEqual([
    2, 3, 1, 2, 3, 1, 2, 3,
    5, 6, 4, 5, 6, 4, 5, 6,
  ]);
});
```

Im `describe('horizontal')`:

```ts
test('repeats a pattern that does not end on the target edge', () => {
  expect(
    Array.from(
      new RepeatingTilesProvider([1, 2, 3], 'horizontal').getTileIdsWithin(1, 0, 10, 1, new Uint32Array(10).fill(666)),
    ),
  ).toEqual([2, 3, 1, 2, 3, 1, 2, 3, 1, 2]);
});
```

Die drei laufen vor dem Fix rot, mit genau den Ist-Werten der Tabelle oben. Der
rote Lauf gehört in den Report:
`pnpm nx test twopoint5d -- src/map2d/RepeatingTilesProvider.spec.ts`

### 2. Die Zeile korrigieren, und zwar an einer Stelle

Der Defekt steht zweimal, weil der Block zweimal steht: `:145-156` und
`:173-184` sind wortgleich, bis auf die Einrückung. Beide Kopien zu berichtigen
und stehen zu lassen hieße, die nächste Änderung wieder an einer davon
vorbeilaufen zu lassen. Der Block wandert deshalb in eine private Methode, und
die Berichtigung steht dort einmal.

Neue private Methode auf `RepeatingTilesProvider`, unterhalb von
`getTileIdAt()`:

```ts
/**
 * Writes one row of `target` with the pattern row `patternRow`, repeated horizontally
 * from tile column `left` onwards.
 */
#writePatternRow(target: Uint32Array, targetRowOffset: number, patternRow: number, left: number, width: number): void {
  const row = this.#tileIds[patternRow]!;

  if (this.#cols === 1) {
    target.fill(row[0]!, targetRowOffset, targetRowOffset + width);
    return;
  }

  let col = (left < 0 ? left + Math.ceil(-left / this.#cols) * this.#cols : left) % this.#cols;
  let x = 0;

  while (x < width) {
    const piece = row.slice(col, col + width - x);
    target.set(piece, targetRowOffset + x);
    x += piece.length;
    // the next piece picks up at the pattern column right after the one just written
    col = (col + piece.length) % this.#cols;
  }
}
```

Die beiden Aufrufstellen in `getTileIdsWithin()`:

- Zweig `horizontal`, statt des `if (this.#cols === 1) … else … `-Blocks in
  `:145-156`:

  ```ts
  if (patternRow < this.#rows) {
    this.#writePatternRow(target, targetRowOffset, patternRow, left, width);
  } else {
    target.fill(0, targetRowOffset);
    break;
  }
  ```

- Zweig `none`, statt des `if (this.#cols === 1) … else … `-Blocks in
  `:173-184`:

  ```ts
  this.#writePatternRow(target, targetRowOffset, patternRow, left, width);
  ```

Alles Übrige der Methode bleibt, wie es ist: die beiden Frühausgänge auf ein
leeres Muster, der `vertical`-Zweig, die `1×1`-Abkürzung in `none` und die
Berechnung von `patternRow` in beiden Zweigen. Der neue Helfer greift auf
`this.#tileIds` zu, nicht auf den Getter.

Danach laufen die drei neuen Tests grün, und alle bestehenden Tests der Datei
laufen unverändert weiter — sie sind die Absicherung, dass die Zusammenlegung
nichts verschoben hat.

### 3. Den Kompressions-Test an die ganze Zusage binden

In `DataIdsChunk2D.spec.ts`. `vi` in den Import aus `vitest` aufnehmen und den
bestehenden Test ersetzen:

```ts
test('names the compression it cannot handle and reports it by throwing alone', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const chunk = new DataIdsChunk2D({x: 0, y: 0, width: 2, height: 2, data: 'AAAAAA==', compression: 'gzip'});

  expect(() => chunk.readDataIdAt(0, 0)).toThrow(/gzip/);
  expect(error).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
});
```

Kein `mockRestore()` von Hand: `restoreMocks: true` in
`packages/twopoint5d/vite.config.ts` nimmt jeden Spy am Testende zurück, und der
Kommentar dort sagt es. Das Muster mit `mockImplementation(() => {})` steht so
schon in `packages/twopoint5d/src/stage/StageRenderer.spec.ts:259-275`.

**Der Nachweis, dass dieser Test etwas hält.** Ein roter Lauf vor dem Fix ist
hier nicht zu haben — es gibt keinen Fix am Produktivcode, der Test schärft eine
Zusage, die der Code bereits einhält. An seine Stelle tritt die Gegenprobe, und
sie ist Pflicht:

1. In `DataIdsChunk2D.ts` versuchsweise ein
   `console.error('compression', compression)` vor den `throw` in
   `prepareData()` setzen.
2. `pnpm nx test twopoint5d -- src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts`
   — der Test fällt an `expect(error).not.toHaveBeenCalled()`.
3. Die Zeile wieder herausnehmen, denselben Lauf noch einmal — grün.

Beide Ausgaben gehören in den Report. `DataIdsChunk2D.ts` steht deshalb nicht
unter »Dateien«: es wird nichts daran geändert, und der Diff darf die Zeile
nicht enthalten.

### 4. CHANGELOG

Ein Eintrag, unter `### Fixed` im `## [Unreleased]`-Block, im Stil der
Nachbarn. Der Skill `updating-changelog` gilt.

```markdown
- fix `RepeatingTilesProvider#getTileIdsWithin()` for a rectangle whose left edge falls inside the pattern and that spans more than two pieces of it: the pattern is carried on by the length of the piece just written, so every repetition after the second picks up at the column that follows it. This is the `'horizontal'` and the `'none'` axis limit; `'vertical'` does not repeat along this axis
```

Kein Eintrag für den Kompressions-Test — ein Test ist keine Änderung, die ein
Nutzer der Bibliothek sieht. Kein Migrations-Abschnitt: keine Signatur, kein
Name und kein Vertrag der öffentlichen Fläche bewegt sich, es werden nur die
Werte richtig, die die Methode ohnehin zusagt.

### 5. Was für dieses Paket nicht ansteht

- **Kein neuer Browser-Test.** `AGENTS.md` verlangt beide Testflächen für
  Änderungen an Rendering- oder GPU-Buffer-Code; hier ändert sich reine
  Kachel-Id-Arithmetik ohne three.js darin.
- **Aber:** kippt einer der bestehenden Playwright-Tests unter
  `packages/twopoint5d-testing/test/` an den berichtigten Ids, gehört seine
  Erwartung mitgezogen — das ist der eigene Umbau und kein Nebenbefund.
  Erwartet wird es nicht: alle drei fahren ein 2×2-Muster über
  `Map2DTileRenderer`, der je Kachel eine Fläche in Kachelgröße abfragt.

## Findings im Volltext

**Nebenbefund · geschätzt medium · `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:154` und `:182`**
(`getTileIdsWithin()`, Zweige `horizontal` und `none`) — die Musterspalte wird
mit `col = (col + x) % this.#cols` fortgeschaltet, also mit der aufgelaufenen
Zielbreite statt mit der Länge des zuletzt kopierten Stücks (`tiles.length`). Ab
der dritten Schleifenrunde bricht die Wiederholung:
`new RepeatingTilesProvider([[1,2,3]]).getTileIdsWithin(1, 0, 10, 1)` liefert
`[2,3,1,2,3,3,3,1,2,3]` statt `[2,3,1,2,3,1,2,3,1,2]`. Mit `left = 0` bleibt es
unauffällig, weil dort jede Runde an der Musterkante endet — deshalb fällt es
keiner Spec und keinem Lookbook-Demo auf. Aus Paket 5. Vorbestehend, belegt
gegen `a9f7dd1` — dieselbe Zeile dort auf `:137` und `:165`. Falsche Kachel-Ids
aus einer öffentlichen Methode, also ein echter Korrektheitsdefekt in einer
angefassten Datei. → Scope

**Folge aus Paket 5 · `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts:29-33`**
(`names the compression it cannot handle`) — der Test prüft nur, dass die
geworfene Meldung den Kompressionsnamen enthält. Den trug sie schon, bevor das
`console.error` daneben verschwand; der Test wäre auch mit ihm grün und hält die
Fehlerpolitik damit nicht fest. Belegt im nachgezogenen Review von `4d723fe`
(2026-09-08).

## Verlauf

- 2026-09-08 Zug 0: Detailplan steht · beide Sachverhalte unverändert an der
  notierten Zeile, der Musterfehler zusätzlich am gebauten Stand nachgemessen
  (vier Aufrufe, Ist gegen Soll in der Tabelle oben) · `vertical` als
  unbetroffen gegengeprüft · keine Folgen zu verteilen, keine offenen Befunde
  aus der Queue zu übernehmen — die dreizehn verbliebenen stehen alle auf
  `→ Audit` und teilen mit diesem Paket keine Ursache · Restplan unverändert:
  Paket 12 ist das letzte, danach kommt der Abschluss
- 2026-09-08 Zug 1: Implementierer beauftragt (sonnet, Effort medium)
- 2026-09-08 Zug 2: Report `FERTIG` · `RepeatingTilesProvider.ts`,
  `RepeatingTilesProvider.spec.ts`, `DataIdsChunk2D.spec.ts`,
  `CHANGELOG.md` · roter Lauf der drei neuen Tests belegt, Gegenprobe zum
  Kompressions-Test in beiden Richtungen belegt · Arbeitsbaum jetzt schmutzig
- 2026-09-08 Zug 3: Reviewer (sonnet) · beide Posten erfüllt, Musterfortschaltung
  gegen alle vier Tabellenwerte nachgerechnet · keine Qualitätsbefunde ·
  Diff: `paket-12.diff` im Arbeitsverzeichnis
- 2026-09-08 Zug 4: entfällt, der Reviewer hat nichts geöffnet
- 2026-09-08 Zug 5: `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0
  (`paket-12.verify.log`) · committet als `72d2893`

## Urteil des Reviewers

Beide Posten erfüllt, keine Qualitätsbefunde — auch keine kleinen.

- **Nebenbefund `RepeatingTilesProvider.ts:154`/`:182`** — erfüllt. Beide Kopien
  sind zu `#writePatternRow()` zusammengelegt (`RepeatingTilesProvider.ts:96-114`),
  die Fortschaltung läuft über `col + piece.length`. Der Reviewer hat alle vier
  Aufrufe aus der Tabelle im Abgleich nachgerechnet; alle treffen das Soll. Beide
  Aufrufstellen ersetzt (`:169` `horizontal`, `:186` `none`), `vertical`, der
  1×1-Kurzschluss und die Frühausgänge unverändert.
- **Folge aus Paket 5, `DataIdsChunk2D.spec.ts`** — erfüllt. Der Test hält jetzt
  beide Hälften der Zusage; `restoreMocks: true` in
  `packages/twopoint5d/vite.config.ts:13` nimmt die Spies zurück, ein
  `mockRestore()` von Hand steht nicht da.
- `DataIdsChunk2D.ts` ist unangetastet, der Diff enthält die Zeile der
  Gegenprobe nicht.
