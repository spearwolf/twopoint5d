# Paket 21 — Drain-Rest: Handle-Pool des Pickers, Zitat- und Listengrenzen im Doc-Snippet-Check, Testnamen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des Laufs, hier die
Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefund: die vier Queue-Einträge mit »in Paket 21 aufgenommen« — `SpritePicker.ts:279–280`,
  `extractSnippets.mjs:33`/`:176`, `extractSnippets.mjs:224–244`, `layoutText.spec.ts:59`/`:65`
  (Volltext unten)
- Folgen von: Paket 17, 19 — kleine Reviewer-Befunde, in Zug 0 hierher verteilt (Gründe unter
  »Triage«): `layoutText.ts:259–260` TSDoc »where that one has a box« (Paket 17);
  `runCheckKind.ts:15`, `TextureAtlas.spec.ts:118`, `SpritePicker.ts:476–480` (Paket 19)
- Ziel: Der Picker verliert auf keinem Fehlerpfad ein Handle-Array und liest seinen Pointer genau
  einmal, der Doc-Snippet-Check erkennt Blöcke in Listenpunkten innerhalb von Zitaten und beendet
  einen Block mit seinem Listenpunkt, und Testnamen wie TSDoc des Layouts sagen, welche Leerzeichen
  sie meinen.
- Modell: mittlere Stufe (claude-sonnet-5-5)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/sprites/SpritePicker.ts`, `SpritePicker.spec.ts`
  - `scripts/checkDocSnippets/extractSnippets.mjs`, `extractSnippets.test.mjs`
  - `packages/twopoint5d/src/text/layoutText.ts` (nur TSDoc), `layoutText.spec.ts`
  - `packages/twopoint5d/src/sprites/runCheckKind.ts`
  - `packages/twopoint5d/src/texture/TextureAtlas.spec.ts`
  - nicht geändert: `AGENTS.md`, `docs/architecture.md`, `packages/twopoint5d/docs/*`,
    `packages/twopoint5d/CHANGELOG.md` (Gründe unter »Entscheidungen und Gründe«)
- Vorgehen: siehe Abschnitt »Vorgehen« unten, Schritte 1–7
- Verify: `pnpm run ci && node /tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad/paket-21.snippets-fingerprint.mjs`
  — das zweite Kommando muss `snippet fingerprint: 61 0 780c97162578d0909c47ad324ef8f7d3658f5b2daa17c7b91f106b0a6defdf55` drucken und mit Exit 0 enden:
  dieselben 61 Blöcke mit demselben Code und denselben Zeilen in den 63 getrackten Markdown-Dateien,
  kein Problem. Das Skript ist das aus Paket 20 mit dem Hash des heutigen Stands (Paket 17 und 18
  haben Zeilen verschoben); am Ausgangsstand grün.
- Commit: `fix: give a SpritePicker pick its handle array back when the copy of the handles throws and read the x and y of its pointer once, report a code block marked ts check in a list item inside a blockquote, end a code block of a Markdown doc with the list item it sits in and report a marked one that ends so, and name the layout tests of a space for the breakable ones`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · `SpritePicker.ts:279–280` umgeformt (seit Paket 15 liegt
    `#gather()` im `try`, offen bleibt nur das Fenster `pop()` `:280` → `drawn[k]` `:272`, also
    `copyVOsInto()` `:281`) · `extractSnippets.mjs:33`/`:176` unverändert · `:224–244` unverändert ·
    `layoutText.spec.ts:59`/`:65` unverändert · aufgenommen als Folgen: `layoutText.ts:259–260`
    (Paket 17, gleiche Ursache wie die Testnamen), `runCheckKind.ts:15`, `TextureAtlas.spec.ts:118`,
    `SpritePicker.ts:476–480` (Paket 19, sonst ohne Ziel) · bestehender Test
    `extractSnippets.test.mjs:31` baut den Fall, den Schritt 3 anders liest, wird mitgezogen ·
    beide Snippet-Fixe im Scratchpad simuliert: 61 Blöcke unverändert, von 32 Tests kippt nur `:31` ·
    `paket-21.snippets-fingerprint.mjs` im Arbeitsverzeichnis angelegt, am Ausgangsstand grün
  - 2026-10-22 Zug 1: Implementierer beauftragt, claude-sonnet-5-5, Effort medium, Report nach
    `paket-21.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG · 8 Dateien geändert (`SpritePicker.ts`/`.spec.ts`, `runCheckKind.ts`,
    `layoutText.ts`/`.spec.ts`, `TextureAtlas.spec.ts`, `extractSnippets.mjs`/`.test.mjs`) · rote Läufe für
    Schritte 1–4 belegt · Arbeitsbaum schmutzig · Verify exit=0, Fingerprint gleich (`paket-21.verify.log`)
  - 2026-10-22 Zug 3: Reviewer (claude-sonnet-5-5, medium) Freigabe · alle acht Stellen behoben · 0 kritisch,
    0 wichtig, 3 klein · Diff `paket-21.diff`, Report `paket-21.review-0.json`
  - 2026-10-22 Zug 4: keine Runde, nur kleine Befunde
  - 2026-10-22 Zug 5: committet `0b02d70b` mit Trailer `Remediation-Run: 2026-10-21`, Verify aus Zug 2 (keine
    Änderung seither)

## Vorgehen

Regeln für jede Zeile: Englisch in Code, Kommentaren, Testnamen; kein Rückblick auf einen
Vorzustand (»now«, »no longer«, »instead of before«), keine Finding-IDs, auch nicht in Testnamen.
Bei jedem Korrektheitsfehler zuerst den Regressionstest schreiben, rot laufen sehen, die Ausgabe des
roten Laufs in den Report, dann beheben. Ein geänderter Kommentar- oder TSDoc-Absatz wird ab der
ersten geänderten Zeile auf die Breite seines Blocks neu umbrochen (Kopfkommentar von
`extractSnippets.mjs` höchstens 90 Zeichen je Zeile).

### Schritt 1 — `SpritePicker`: das Handle-Array steht in `drawn`, bevor kopiert wird

Fundstelle: `packages/twopoint5d/src/sprites/SpritePicker.ts`, `#gather()` `:270–272` und
`#handlesOf()` `:276–283`. `#handlesOf()` holt ein Array aus `#spareHandles` (`:280`) und füllt es
per `pool.copyVOsInto()` (`:281`); erst danach steht es im Record `drawn[k]` (`:272`). Wirft
`copyVOsInto()`, ist das Array weder im Vorrat noch in `drawn`, und das `finally` von `#pick()`
(`:244–252`) gibt es nicht zurück.

1.1 Regressionstest zuerst, in `SpritePicker.spec.ts` direkt nach dem Test `a refused pick gives back
the handles and the pick meshes of the entries before the one it refuses` (`:268–292`), im selben
Aufbau wie dieser:

```ts
test('a pick whose copy of the handles throws gives the handle array back', async () => {
  const {renderer} = makeRenderer();
  const picker = new SpritePicker(renderer);
  const a = makeSprites(1).sprites;
  const taken: unknown[][] = [];
  const copyVOsInto = a.spritePool!.copyVOsInto.bind(a.spritePool!);
  const copy = vi.spyOn(a.spritePool!, 'copyVOsInto').mockImplementation((into) => {
    taken.push(into);
    return copyVOsInto(into);
  });

  await picker.pick(makeCamera(), center, [a]);
  const first = taken[0];

  copy.mockImplementationOnce((into) => {
    taken.push(into);
    throw new Error('copy failed');
  });
  await expect(picker.pick(makeCamera(), center, [a])).rejects.toThrow('copy failed');
  expect(taken.at(-1), 'the throwing copy was handed the spare array').toBe(first);

  await picker.pick(makeCamera(), center, [a]);
  expect(taken.at(-1), 'the handle array the throwing copy took').toBe(first);

  a.dispose();
  picker.dispose();
});
```

Rot vor dem Fix: die letzte Erwartung bekommt ein neues Array statt `first`.

1.2 Fix: `#handlesOf()` entfällt. In `#gather()` ersetzt dieser Teil die Zeile `:272`:

```ts
      // in drawn before the copy: whatever throws from here on, the finally of #pick() gives the array back
      const record: Drawn = {sprites, pool, slotMoves: pool.slotMoves, handles: this.#spareHandles.pop() ?? []};
      drawn[k] = record;
      // the handles of every slot in use as they stand at the draw, copied without a look-up: the read
      // back resolves the slot here, before a sort, a freeSprite() or a growth can move it. A slot
      // without a handle stays empty and gets one only when the pick hits it
      pool.copyVOsInto(record.handles);
```

Der Kommentar über `#handlesOf()` (`:276–278`) wandert damit an die Kopie; sonst ändert sich an
`#gather()` und `#pick()` nichts. Kein Doku- und kein CHANGELOG-Eintrag (privater Pfad).

### Schritt 2 — `SpritePicker`: der Pointer wird einmal gelesen

Fundstelle: `checkArguments()` `:472–491` liest `pointer.x`/`pointer.y` in der Prüfung (`:476`) und
für die Meldung noch einmal (`:480`), `pick()` liest beide ein drittes Mal für die Kopie (`:214`).
Ein Getter am Pointer kann so der Meldung oder dem Pick einen anderen Wert geben, als die Prüfung
gesehen hat — gegen den Kommentar `:212–213`.

2.1 Regressionstest zuerst, in `SpritePicker.spec.ts` im `describe('pick() refuses', …)` (`:203`),
nach dem Test mit den Pointer-Ablehnungen (`:218–226`), mit `makeRenderer()`, `makeSprites(1)` und
`center` wie die Nachbartests, Name:
`reads x and y of the pointer once, for the check, the message and the pick`. Ablauf:
- ein Pointer mit zählenden Gettern, `x` und `y` je `0`: nach `await picker.pick(makeCamera(),
  pointer, [sprites])` ist der Zähler `{x: 1, y: 1}`;
- ein zweiter Pointer mit zählenden Gettern, `x` gibt `Number.NaN`, `y` gibt `0`: `pick()` verwirft
  mit `TypeError` `SpritePicker#pick(): the pointer is {x, y} in normalized device coordinates, -1 to 1 — got {x: NaN, y: 0}`,
  danach ist der Zähler `{x: 1, y: 1}`.

Rot vor dem Fix: `{x: 2, y: 2}` bzw. `{x: 2, y: 1}`.

2.2 Fix: `checkArguments()` antwortet den Pointer als Kopie, `x` und `y` je einmal gelesen:

```ts
// checks the arguments of pick() and answers the pointer as a copy, its x and y read once: the check,
// the message and the pick see the same values
function checkArguments(camera: Camera, pointer: PickPointer, sprites: readonly unknown[]): PickPointer {
  // the camera check of :473–475 stays as it is
  const x = pointer?.x;
  const y = pointer?.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    const got =
      typeof pointer !== 'object' || pointer === null ? describeValue(pointer) : `{x: ${describeValue(x)}, y: ${describeValue(y)}}`;
    throw new TypeError(`${WHERE}: the pointer is {x, y} in normalized device coordinates, -1 to 1 — got ${got}`);
  }
  // the list checks of :483–490 stay as they are
  return {x, y};
}
```

Die zwei Kommentare `// … stays as it is` im Block oben sind nur Platzhalter dieses Plans für den
unveränderten Code, sie gehören nicht in die Datei.

In `pick()` (`:205–215`): `let at: PickPointer;` vor dem `try`, im `try` `at = checkArguments(camera,
pointer, sprites);`, die Zeile `const at: PickPointer = {x: pointer.x, y: pointer.y};` entfällt. Der
Kommentar `:212–213` spricht danach nur noch von der Liste: `// taken now: a caller that reuses its
list while the renderer initializes changes neither what is drawn nor what checkArguments() has seen`.
Meldungstexte bleiben wörtlich gleich; die bestehenden Tests der Pointer-Ablehnung (`got null`,
`got {x: "0", y: 0}`, `got 5`) bleiben grün.

### Schritt 3 — Doc-Snippet-Check: ein Block endet mit seinem Listenpunkt

Fundstelle: `scripts/checkDocSnippets/extractSnippets.mjs` `:224–244`, der Zweig für eine Zeile in
einem offenen Block. Er kennt nur die schließende Fence. Nach CommonMark endet ein Listenpunkt an der
ersten Zeile, die nicht leer und weniger eingerückt ist als seine Inhaltsspalte (für Code gibt es
keine Lazy Continuation), und ein offener Fenced Block endet mit ihm. Heute läuft der Block weiter,
verschluckt Prosa und den nächsten `ts check`-Block bis zur nächsten passenden Fence, und der
Compiler meldet Mischcode. Nachgesehen mit markdown-it-py (CommonMark-Modus): `- item` / `` ```ts check`` (2
Spalten) / `const a = 1;` (2) / `next` (0) rendert den Block nur mit `const a = 1;`; eine
Fence-Zeile in Spalte 0 nach dem Block öffnet einen neuen Block auf oberster Ebene.

3.1 Regressionstests zuerst, in `extractSnippets.test.mjs` nach dem Test
`a line less indented than the content of a list item ends it: a fence after it is measured from its line`
(`:101–105`):

```js
const NEVER_CLOSED_AT_5 = {
  file: 'a.md',
  line: 3,
  message: 'code block marked `ts check` is never closed — its list item ends at line 5',
};

test('a line less indented than the content of its list item ends the item and the open block in it: a marked one is a problem with its fence line, and the next block is found', () => {
  // the second line ending the item is the marker of the next item
  for (const ending of ['next', '- next']) {
    const {snippets, problems} = extractSnippets(
      doc('- item', '', `  ${FENCE}ts check`, '  const a = 1;', ending, '', `${FENCE}ts check`, 'const c = 3;', FENCE),
      'a.md',
    );

    assert.deepEqual(snippets, [{file: 'a.md', line: 8, code: 'const c = 3;', offsets: [0]}], ending);
    assert.deepEqual(problems, [NEVER_CLOSED_AT_5], ending);
  }
});

test('a fence less indented than the content of its list item ends the item instead of closing the block, and opens a block of its own', () => {
  const {snippets, problems} = extractSnippets(doc('- item', '', `  ${FENCE}ts check`, '  const a = 1;', FENCE), 'a.md');

  assert.deepEqual(snippets, []);
  assert.deepEqual(problems, [NEVER_CLOSED_AT_5]);
});

test('a blank line in a block of a list item is code and ends nothing', () => {
  const {snippets, problems} = extractSnippets(
    doc('- item', '', `  ${FENCE}ts check`, '  const a = 1;', '', '  const b = 2;', `  ${FENCE}`),
    'a.md',
  );

  assert.deepEqual(snippets, [{file: 'a.md', line: 4, code: 'const a = 1;\n\nconst b = 2;', offsets: [2, 0, 2]}]);
  assert.deepEqual(problems, []);
});
```

Die Konstante darf auch inline stehen; Namen und Erwartungen wie hier. Alle drei Ergebnisse sind
im Scratchpad gegen die Simulation von 3.3 geprüft. Rot vor dem Fix: die ersten beiden Tests (heute
ein Snippet aus Mischcode bzw. eines aus `const a = 1;`, kein Problem); der dritte pinnt Bestand und
ist vorher schon grün.

3.2 Bestehenden Test mitziehen: `strips the fence indentation from the code and reports per line
what it took off` (`:31–40`) baut mit `' x'` (Spalte 1 unter einem Punkt mit Inhaltsspalte 2)
genau den Fall, den 3.3 als Ende des Punkts liest. Er behält seine Aussage (»a shallower line loses
what it has«), wenn die Fence eine Spalte tiefer steht und die flachere Zeile im Punkt bleibt:

```js
  const {snippets} = extractSnippets(
    doc('- item', '', `   ${FENCE}ts check`, '   const a = 1;', '     const b = 2;', '  x', `   ${FENCE}`),
    'a.md',
  );

  // up to the indentation of the fence goes, deeper indentation stays, a shallower line loses
  // what it has
  assert.deepEqual(snippets, [{file: 'a.md', line: 4, code: 'const a = 1;\n  const b = 2;\nx', offsets: [3, 3, 2]}]);
```

(im Scratchpad gegen die Simulation von 3.3 geprüft: genau dieses Ergebnis.)

3.3 Fix: die zwei Zweige des `lines.forEach`-Callbacks tauschen die Reihenfolge. Zuerst der Zweig
für einen offenen Block (heute `:224–244`), eingeleitet von dieser Prüfung:

```js
    if (open != null) {
      // CommonMark: a line that is not blank and is indented less than the content of the list
      // item the block sits in ends the item, and the block with it — code has no lazy
      // continuation. The line is read again below, outside the block: it may open the next one
      const whitespace = LEADING_WHITESPACE.exec(text)?.[0] ?? '';
      if (text.trim() !== '' && columnsOf(whitespace) < open.base) {
        if (open.marked) {
          problems.push({
            file,
            line: open.line,
            message: `code block marked \`ts check\` is never closed — its list item ends at line ${lineNumber}`,
          });
        }
        open = null;
      } else {
        // here the lines :224–244 as they are: the closing fence, else a code line, each ending
        // with return
      }
    }
```

Der Kommentar im `else` ist nur Platzhalter dieses Plans für die unveränderten Zeilen
`:224–244`; sie stehen dort wörtlich, jeder ihrer Ausgänge mit `return`.

Danach folgt der heutige Zweig für eine Zeile außerhalb eines Blocks (`:129–222`), ohne die
Bedingung `if (open == null)` — der Zweig davor kehrt in jedem anderen Fall zurück. `open.base` ist
außerhalb einer Liste 0, dort endet also nichts. Ein unmarkierter Block, der so endet, endet ohne
Meldung. Der Stapel `listContent` braucht nichts Neues: die erneut gelesene Zeile nimmt im Zweig
außerhalb eines Blocks (`:138`) die Punkte vom Stapel, aus denen sie fällt.

Kommentare: am Typedef `OpenFence` die Zeile zu `base` ergänzen um »; a line that is not blank and is
indented less ends the item and the block«. Im Kopfkommentar den Absatz `:6–14` hinter »thematic
break and no list item.« um diesen Satz ergänzen und ab dort auf 90 Zeichen neu umbrechen:
»A block inside a list item ends with the item, at the first line that is not blank and is indented
less than the item's content; a marked block that ends so is reported, as one that never closes is.«

### Schritt 4 — Doc-Snippet-Check: ein Block im Listenpunkt eines Zitats wird gemeldet

Fundstelle: `extractSnippets.mjs:33` `QUOTED_FENCE = /^\s*>[\s>]*(`{3,}|~{3,})(.*)$/` und sein
Aufruf `:176`. Hinter `>` lässt das Muster nur Leerraum und weitere `>` zu: `` > - ```ts check ``,
`` > 1. ~~~ts check `` und `` - > - ```ts check `` werden weder compiliert noch gemeldet, gegen den
Kopfkommentar `:20–23`. CommonMark (markdown-it-py) liest alle drei als Codeblock in einem
Listenpunkt im Zitat; `` > -```ts check `` (kein Leerzeichen hinter dem Marker) ist dort ein Absatz.

4.1 Regressionstest zuerst, nach `a marked fence in a blockquote on the line of a list marker is a
problem with its line` (`:156–168`), Name:
`a marked fence in a list item inside a blockquote is a problem with its line`. Für jedes Dokument
genau ein Problem an Zeile 1 mit der Meldung
`a code block marked \`ts check\` inside a blockquote is not checked — only a \`ts check\` block outside a quote is compiled`,
keine Snippets:
- `doc(`> - ${FENCE}ts check`, '>   const a = 1;', `>   ${FENCE}`)`
- `doc(`> 1. ${TILDES}ts check`, '>    const a = 1;', `>    ${TILDES}`)`
- `doc(`- > - ${FENCE}ts check`, '  >   const a = 1;', `  >   ${FENCE}`)`
- `doc(`>- ${FENCE}ts check`, '>  const a = 1;', `>  ${FENCE}`)`

Dazu im selben Test: `extractSnippets(doc(`> -${FENCE}ts check`), 'a.md').problems` ist `[]` (kein
Listenpunkt ohne Leerraum hinter dem Marker, also keine Fence).

Rot vor dem Fix: die ersten vier Dokumente ergeben kein Problem.

4.2 Fix, `:33`:

```js
// a quote marker, then any more quote markers, list markers and spaces, then a fence: a list marker
// counts only with a space or a tab behind it, as CommonMark has it
const QUOTED_FENCE = /^\s*>(?:[ \t>]|(?:[-+*]|\d{1,9}[.)])(?=[ \t]))*(`{3,}|~{3,})(.*)$/;
```

(Muster im Scratchpad gegen die Fälle aus 4.1 und die bestehenden Zitat-Tests geprüft.) Im
Kopfkommentar `:21–22` »So is a marker inside a blockquote:« → »So is a marker inside a
blockquote, in a list item of the quote as well:« und den Absatz ab dort auf 90 Zeichen neu
umbrechen. Der Aufruf `:176` bleibt.

### Schritt 5 — Layout: Testnamen und TSDoc sagen, welche Leerzeichen gemeint sind

5.1 `packages/twopoint5d/src/text/layoutText.spec.ts` — nur Namen, Inhalt unverändert:
- `:59` `a space moves the pen and yields no glyph` → `a breakable space moves the pen and yields no glyph`
- `:65` `a space yields no glyph even where the font gives it a box` →
  `a breakable space yields no glyph even where the font gives it a box`

5.2 Direkt nach dem Test von `:65` ein Test, der die andere Seite der Grenze pinnt (ohne Rot,
`docs/text.md:140–141` und TSDoc versprechen es, kein Test prüft es):

```ts
    test('a no-break space yields a glyph where the glyph it is set as has a box', () => {
      const data = tinyFontData();
      Object.assign(data.chars[0]!, {x: 12, y: 4, width: 2, height: 2});
      const boxed = new BitmapFont(data);
      // tinyFontData has no U+00A0: it is set as U+0020, which has a box here
      expect(boxes(layoutText(boxed, 'A A')).map(([char]) => char)).toEqual(['A', ' ', 'A']);
    });
```

Liefert der Lauf für das mittlere Zeichen etwas anderes als `' '`, ist der erwartete Wert das
`char` des U+0020-Glyphen der Fixture — dann diesen eintragen, nicht den Test umbauen.

5.3 `packages/twopoint5d/src/text/layoutText.ts:259–260` (TSDoc von `layoutText()`): »yields a glyph
where that one has a box« → »yields a glyph where the glyph it is set as has a box«. Der Absatz
(`:256–263`) wird ab `:259` neu umbrochen, keine Zeile über 109 Zeichen (die breiteste übrige Zeile
dieses TSDoc-Blocks).

### Schritt 6 — `runCheckKind()`: die Meldung aus einer lokalen Konstante

`packages/twopoint5d/src/sprites/runCheckKind.ts:13–17`: die Ternary-Kette steht inline im
Template-String. Ersetzen durch:

```ts
  } catch (error) {
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : describeValue(error);
    throw new Error(`${where}: ${message}`, {cause: error});
  }
```

Verhalten unverändert, die Tests in `defineSprite.spec.ts` bleiben grün; kein neuer Test.

### Schritt 7 — `TextureAtlas.spec.ts`: der Test hängt nicht an einer Id, die nicht 0 ist

`packages/twopoint5d/src/texture/TextureAtlas.spec.ts:118`:
`expect(() => atlas.add('foo', new TextureCoords()) && atlas.add('foo', new TextureCoords())).toThrow(…)`
wirft nur, weil das erste `add('foo', …)` die Id 1 bekommt (truthy); `add()` antwortet die Id, das
erste Frame eines Atlas hat 0. Das erste `atlas.add('foo', new TextureCoords());` wandert neben
`atlas.add(bar, new TextureCoords());` (`:115`), die Erwartung wird
`expect(() => atlas.add('foo', new TextureCoords())).toThrow('TextureAtlas: the frame name "foo" is already taken');`.
Testname unverändert.

## Abgleich

Am Code von `4b013345` nachgesehen, Basis des Laufs `6500527f`.

| Stelle | Stand | Einordnung |
| --- | --- | --- |
| `SpritePicker.ts:279–280` | umgeformt: `#sync()`/`#build()` laufen vor `#handlesOf()` (`:270`, schon in `f9a6029e`), ein Wurf eines späteren Eintrags gibt seit Paket 15 alles in `drawn` zurück (`#gather()` im `try`, `:237–239`); offen bleibt das Fenster zwischen `pop()` `:280` und `drawn[k]` `:272`, also `copyVOsInto()` `:281` (wirft praktisch nur bei Speichermangel) | Nebenbefund `→ Scope`, Schritt 1 |
| `extractSnippets.mjs:33`/`:176` | unverändert | Nebenbefund `→ Scope` (Zitat-Meldung kam mit Paket 2, vor dem Lauf fiel jeder Block im Zitat still heraus), Schritt 4 |
| `extractSnippets.mjs:224–244` | unverändert; in `6500527f` schloss ein Block nur an einer Fence, Listenpunkte gab es dort nicht | Nebenbefund `→ Scope`, keine Folge von Paket 16 oder 20 (beide haben den Fall nicht verschlechtert, Urteil des Reviewers von Paket 20), Schritt 3 |
| `layoutText.spec.ts:59`/`:65` | unverändert | Nebenbefund `→ Scope`, Schritt 5.1 |
| `layoutText.ts:259–260` (klein, Paket 17) | unverändert | Folge von Paket 17, gleiche Ursache wie die Testnamen, Schritt 5.3 |
| `runCheckKind.ts:15` (klein, Paket 19) | unverändert | Folge von Paket 19, Schritt 6 |
| `TextureAtlas.spec.ts:118` (klein, Paket 19) | unverändert | Folge von Paket 19, Schritt 7 |
| `SpritePicker.ts:480` (klein, Paket 19) | unverändert, mit `:476` und `:214` derselbe Mehrfach-Lesezugriff | Folge von Paket 19, Schritt 2 |

## Triage

- `Folgen:`-Zeilen unter erledigten Paketen: keine offen (14 → 19 und 16 → 20 verteilt, 15, 17, 18,
  19, 20 `keine`).
- »Offene Befunde«: genau die vier Einträge dieses Pakets offen, sonst nichts.
- Kleine Reviewer-Befunde, die nach Paket 17 »für den Abschluss« liegen blieben und die die Drain-Runde
  nicht liest (sie liest Queue und `Folgen:`): wie in der Drain-Runde 1 (»Entscheidungen«, Zeile
  »Drain-Runde«) als Folgen ihres Pakets behandelt und hierher verteilt, im Plan unter
  `Folgen von:`. `layoutText.ts:259–260` teilt die Ursache der Testnamen (welche Leerzeichen einen
  Glyph ergeben); die drei aus Paket 19 haben kein anderes Ziel mehr — Paket 21 ist das letzte —,
  `SpritePicker.ts:480` liegt zudem in der Datei von Schritt 1. Kein eigenes Paket, kein `Folge von:`
  (eine Folge von Paket 19, selbst Folge von Paket 14, wäre die dritte Generation; diese drei sind
  Lesbarkeit und Testaufbau, keine Schwäche des Wegs von Paket 14).
- Nicht offen, bleibt wie entschieden: `extractSnippets.mjs:77–78` (Paket 20, negative Spalte vor
  stehen gebliebenem Leerraum — Reviewer empfiehlt keine Änderung, TypeScript zeigt nie auf
  führenden Leerraum); Paket 18 »Absätze verschieben nur ein Wort« und »Listenköpfe kürzer« (von den
  Regeln gedeckt bzw. gewollt).

## Entscheidungen und Gründe

- **Schritt 1 ohne `try`:** das Array steht im Record, bevor kopiert wird; das `finally` von
  `#pick()` gibt jedes Array in `drawn` zurück und setzt die Länge auf 0. Ein `try`/`catch` in
  `#handlesOf()` hielte den Vertrag auch, verteilte das Zurückgeben aber auf zwei Stellen.
- **Schritt 2 über den Rückgabewert von `checkArguments()`:** der Reviewer nannte nur die Meldung
  (`:480`); dieselbe Ursache — der Pointer wird mehr als einmal gelesen — hat die Kopie in `pick()`
  (`:214`), deren Kommentar verspricht, dass der Pick sieht, was die Prüfung gesehen hat. Eine Kopie,
  einmal gelesen, deckt beides. Die Liste (`[...sprites]` gegen den Index-Zugriff der Prüfung) bleibt
  wie sie ist: für ein Array dasselbe, und der Befund gilt dem Pointer.
- **Schritt 3 meldet statt zu compilieren:** ein markierter Block, den sein Listenpunkt beendet, ist
  wie einer ohne schließende Fence ein Schreibfehler; CommonMark rendert ihn zwar als Block, aber der
  Autor meinte eine Fence. Meldung an der Fence-Zeile wie bei `never closed`, mit der Zeile, an der
  der Punkt endet. Die Zeile wird danach außerhalb des Blocks gelesen, damit der nächste `ts check`-
  Block gefunden wird. Eine Fence-Zeile flacher als die Inhaltsspalte schließt den Block nicht mehr,
  sondern beendet den Punkt und öffnet einen eigenen Block — so liest es CommonMark.
- **Keine Änderung an `AGENTS.md` (»Code blocks in Markdown«):** der Punkt sagt Autoren, welche Fence
  zählt und dass ein markierter Block im Zitat den Check scheitern lässt — das gilt nach Schritt 4
  für einen Listenpunkt im Zitat ebenso, ohne neuen Satz. Dass ein Block mit seinem Listenpunkt endet,
  ist CommonMark und zeigt das gerenderte Dokument selbst; die Meldung `never closed` steht dort auch
  nicht. `docs/architecture.md` beschreibt die Regeln des Checks nicht.
- **Kein CHANGELOG-Eintrag:** `scripts/` gehören nicht zum Paket, `SpritePicker` und das
  Text-Modul stehen nur unter `[Unreleased]` als `Added`, die Testnamen und der TSDoc-Satz ändern
  kein Verhalten.
- **Pin-Test in 5.2:** die umbenannten Tests ziehen die Grenze »breakable«; die andere Seite
  (`docs/text.md:140–141`, TSDoc `:259–260`) prüft sonst nichts.

## Findings im Volltext

**Queue · `packages/twopoint5d/src/sprites/SpritePicker.ts:279–280`** — `#handlesOf()` holt ein
Array aus `#spareHandles`, bevor `copyVOsInto()` läuft; wirft das (oder `#sync()`/`#build()`
danach), landet das Array nie in `drawn` und geht dem Pool verloren — nur ein GC-Zyklus, ohne
Folgen für die Korrektheit; stand so schon in `f9a6029e` (Paket 15) → Scope · in Paket 21
aufgenommen (Drain-Runde 2, 2026-10-22)

**Queue · `scripts/checkDocSnippets/extractSnippets.mjs:33`/`:176`** — `QUOTED_FENCE`
(`^\s*>[\s>]*` + Fence) lässt keinen Listenmarker hinter `>` zu: ein `ts check`-Block in einem
Listenpunkt innerhalb eines Zitats (`> - ```ts check`) wird weder compiliert noch gemeldet, gegen
den Kopfkommentar `:21–23`; vor dem Lauf fiel jeder Block im Zitat still heraus (Meldung kam mit
Paket 2), der umgekehrte Fall (Zitat auf der Markerzeile) ist in Paket 20 behoben (Paket 20,
Reviewer) → Scope · in Paket 21 aufgenommen (Drain-Runde 2, 2026-10-22)

**Queue · `scripts/checkDocSnippets/extractSnippets.mjs:224–244`** — ein offener Block endet nicht,
wenn sein Listenpunkt endet (eine Codezeile flacher als die Inhaltsspalte oder ein neuer Marker):
bei unsauber geschlossenem Block verschluckt er die folgenden Zeilen samt nächstem `ts check`-Block
bis zur nächsten passenden Fence; laut, nicht still (der Compiler meldet den Mischcode); stand so
schon in `6500527f` (Fence schloss nur an einer Fence), der Kommentar zur nicht verfolgten
Container-Struktur nennt den Fall nicht (Paket 20, Implementierer und Reviewer) → Scope · in
Paket 21 aufgenommen (Drain-Runde 2, 2026-10-22)

**Queue · `packages/twopoint5d/src/text/layoutText.spec.ts:59`, `:65`** — die Testnamen »a space
moves the pen and yields no glyph« und »a space yields no glyph even where the font gives it a box«
gelten nur für umbrechbare Leerzeichen (ein no-break space mit Box ergibt einen Glyph); stand so
schon vor Paket 17 (Paket 17, Reviewer) → Scope · in Paket 21 aufgenommen (Drain-Runde 2,
2026-10-22)

**Klein, Paket 17 · `packages/twopoint5d/src/text/layoutText.ts:259` (TSDoc)** — »yields a glyph
where that one has a box« — Bezug von »that one« unscharf (gemeint: der Glyph, mit dem das Zeichen
gesetzt wird)

**Klein, Paket 19 · `packages/twopoint5d/src/sprites/runCheckKind.ts:15`** — dreifach verschachtelte
Ternary-Kette inline im Template-String, eine lokale Konstante wäre lesbarer.

**Klein, Paket 19 · `packages/twopoint5d/src/texture/TextureAtlas.spec.ts`** (neuer Symbol-Test) —
`atlas.add(…) && atlas.add(…)` im `expect` verlässt sich darauf, dass `add()` truthy antwortet; der
erste Aufruf gehört vor das `expect`.

**Klein, Paket 19 · `packages/twopoint5d/src/sprites/SpritePicker.ts:480`** — `describeValue(pointer.x)`
liest `pointer.x` ein zweites Mal; ein werfender Getter am Pointer verlöre die Meldung schon bei
`Number.isFinite(pointer?.x)`.

## Urteil des Reviewers

| Stelle | Urteil | Fundstelle nach dem Fix |
| --- | --- | --- |
| `SpritePicker.ts:279–280` (Schritt 1) | behoben | `SpritePicker.ts:272–278`, `#handlesOf()` entfällt, Record vor `copyVOsInto()` in `drawn` |
| `SpritePicker.ts:476–480`, `:214` (Schritt 2) | behoben | `checkArguments()` liest `x`/`y` einmal und antwortet die Kopie, `pick()` übernimmt sie |
| `extractSnippets.mjs:224–244` (Schritt 3) | behoben | Zweig `if (open != null)` mit der Prüfung gegen `open.base`, Test `:31` angepasst, drei neue Tests |
| `extractSnippets.mjs:33`/`:176` (Schritt 4) | behoben | `QUOTED_FENCE` mit Listenmarkern hinter `>`, vier Dokumente plus Negativfall getestet |
| `layoutText.spec.ts:59`/`:65` (Schritt 5.1/5.2) | behoben | Namen mit »breakable«, Pin-Test für den No-break-Space (`'A\u00A0A'`) |
| `layoutText.ts:259–260` (Schritt 5.3) | behoben | Absatz neu umbrochen, breiteste Zeile 107 Zeichen |
| `runCheckKind.ts:15` (Schritt 6) | behoben | lokale Konstante `message` |
| `TextureAtlas.spec.ts:118` (Schritt 7) | behoben | erstes `add('foo')` vor dem `expect` |

Kleine Befunde:
- `extractSnippets.mjs`, Ende des `forEach`-Callbacks: das `return;` nach `open = {…}` ist die letzte Anweisung
  und überflüssig.
- `AGENTS.md` »Code blocks in Markdown«: ein Halbsatz, dass ein Block mit seinem Listenpunkt endet und ein
  markierter dann als »never closed« scheitert, würde Autoren die neue Meldung erklären — im Detailplan
  bewusst verworfen (»Entscheidungen und Gründe«).
- Die neuen Testnamen in `extractSnippets.test.mjs` sind lang, aber stilgleich mit den Nachbarn.

Abweichungen des Implementierers (vom Reviewer akzeptiert): Pin-Test mit Escape `'A\u00A0A'` statt des
unsichtbaren Literals; die vier Zitat-Dokumente in einer Schleife; Biome hat die Ternary in
`checkArguments()` auf drei Zeilen umbrochen.
