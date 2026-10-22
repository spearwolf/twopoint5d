# Paket 20 — Doc-Snippet-Check: Listenpunkte und Tabs nach CommonMark zu Ende führen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 16
- Findings: keine aus dem Audit. Das Paket ist ein Nachtragspaket aus der `Folgen:`-Zeile von
  Paket 16 (vier Symptome) und nimmt vier Stellen gleicher Ursache auf (Abgleich unten).
- Ziel: `extractSnippets()` liest Listenpunkte, Trennlinien und Tab-Einrückung so, wie CommonMark
  sie liest — oder sagt im Kommentar, wo es bewusst nachsichtiger ist —, eine Diagnose trifft die
  Spalte auch in einem tab-eingerückten Block, und der Kopfkommentar hält die Breite der Datei.
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `scripts/checkDocSnippets/extractSnippets.mjs`, `scripts/checkDocSnippets/extractSnippets.test.mjs`,
  `scripts/checkDocSnippets/compileSnippets.mjs`, `scripts/checkDocSnippets/compileSnippets.test.mjs`.
  Nichts sonst — `checkDocSnippets.mjs` reicht die Snippets nur durch und liest kein `indent`.
- Vorgehen: siehe unten, Schritte 1–8
- Verify: `pnpm run ci && node /tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad/paket-20.snippets-fingerprint.mjs`
  — das zweite Kommando muss `snippet fingerprint: 61 0 f8675b7b…` drucken und mit Exit 0 enden:
  dieselben 61 Blöcke der getrackten Markdown-Dateien mit demselben Code wie vor dem Paket, kein
  Problem. Der Fingerabdruck hasht nur `file`, `line` und `code`, nicht `offsets`.
- Commit: `fix(scripts): read a list item of a Markdown doc the way CommonMark does — a tab after its marker, an empty first line, a fence or a quote on the line of its marker —, take a line of three or more *, - or _ for a thematic break and no list item, and point a diagnostic of a code block at the column of its Markdown line, tabs and lines shallower than the fence included`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · die vier Folgen von Paket 16 bestehen unverändert
    (`extractSnippets.mjs:9` 91 Zeichen, `:27`, `:110`, `:186` mit `compileSnippets.mjs:80`) ·
    gleiche Ursache aufgenommen: Fence und Zitat auf der Zeile eines Listenmarkers, leere erste
    Zeile eines Listenpunkts, Spalte einer Codezeile flacher als ihre Fence · keine offene Folge
    und kein Queue-Eintrag teilt die Ursache · Fingerabdruck-Skript
    `paket-20.snippets-fingerprint.mjs` im Arbeitsverzeichnis angelegt, am Ausgangsstand grün
  - 2026-10-22 Zug 1: Implementierer beauftragt (sonnet, effort medium), `paket-20.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG · geändert `extractSnippets.mjs`, `extractSnippets.test.mjs`, `compileSnippets.mjs`, `compileSnippets.test.mjs` · Arbeitsbaum schmutzig · Verify exit=0 (`paket-20.verify.log`, test:scripts 216/216, Fingerabdruck `61 0 f8675b7b…`) · roter Lauf: 10 Tests rot (Test 9 mit 7 statt NaN, weil `compile` noch `indent: 0` vorbelegte)
  - 2026-10-22 Zug 3: Reviewer (opus, effort medium) — alle acht Punkte behoben, kein kritischer oder wichtiger Befund, 3 klein (2 vorbestehend → Queue, 1 im Code belassen) · Diff `paket-20.diff`, Report `paket-20.review-0.json`
  - 2026-10-22 Zug 4: keine Runde
  - 2026-10-22 Zug 5: committet `50e01baa` mit Trailer `Remediation-Run: 2026-10-21`; Verify aus Zug 2 (keine Änderung seither)

## Urteil des Reviewers

| Punkt | Urteil | Fundstelle |
| --- | --- | --- |
| Kopfzeile 91 Zeichen | behoben | Kopf `extractSnippets.mjs:1–28` ≤ 90, übrige Kommentarzeilen ≤ 100 |
| Tab hinter dem Listenmarker | behoben | `:35` `LIST_ITEM` `([ \t]+\|$)`, `:160–166` `columnsOf(item[2], start)`; Test 1 |
| Trennlinie als Listenpunkt | behoben | `:38` `THEMATIC_BREAK`, `:157` vor `LIST_ITEM` je Durchlauf; Tests 4 und 5 |
| Spalte bei tab-eingerückter Fence | behoben | `:67–79` `stripIndent()`, `:241–243`, `compileSnippets.mjs:80`; Tests 8 und 10 |
| leere erste Zeile eines Listenpunkts | behoben | `:166`, `:169`; Test 3 |
| Fence auf der Markerzeile | behoben | `:154–172`, `:174`, `:213` `indent: column`; Test 6 (a–c) |
| Zitat auf der Markerzeile | behoben | `:176` `QUOTED_FENCE.exec(rest)`; Test 7 |
| Codezeile flacher als ihre Fence | behoben | `:77–78`, Offset je Zeile; `extractSnippets.test.mjs:39` `offsets: [2, 2, 1]`, Test 9 |

Konventionen eingehalten (keine Finding-ID, kein Rückblick, Commit-Message geprüft); Aufrufer
(`checkDocSnippets.mjs`) liest weder `indent` noch `offsets`.

## Kleine Befunde

- `extractSnippets.mjs:77–78` — bei negativem Offset bekäme eine Diagnose auf einem der stehen
  gebliebenen Leerzeichen Spalte 0; TypeScript zeigt nie auf führenden Leerraum, belassen
  (Reviewer empfiehlt keine Änderung).
- Vorbestehend, in »Offene Befunde« des Plans: markierte Fence in einem Listenpunkt innerhalb eines
  Zitats (`:33`/`:176`) wird nicht gemeldet — Urteil `→ Scope`, weil die Scope-Regel jeden Befund
  nimmt und der Kopfkommentar die Meldung verspricht; ein offener Block endet nicht mit seinem
  Listenpunkt (`:224–244`) — `→ Scope`, laut statt still, aber der Kommentar zur nicht verfolgten
  Struktur nennt den Fall nicht. Beide sind keine Folge dieses Pakets: Paket 20 hat an beiden
  Stellen nichts verschlechtert (vor dem Lauf fiel jeder Block im Zitat still heraus, und eine
  Fence schloss nur an einer Fence).

## Abgleich

Am Code von `dc46243e` nachgesehen, Basis des Laufs `6500527f`.

| Stelle | Stand | Einordnung |
| --- | --- | --- |
| `extractSnippets.mjs:9` — Kopfzeile mit 91 Zeichen | besteht; die übrigen Kopfzeilen 1–21 halten höchstens 90 (`:7`) | Folge von Paket 16 |
| `:27` — `LIST_ITEM` `( +\|$)` nimmt keinen Tab hinter dem Marker | besteht unverändert; `-\titem` ist kein Listenpunkt, eine Fence vier Spalten tief darunter öffnet keinen Block | Folge von Paket 16 |
| `:110` — `LIST_ITEM` nimmt `* * *` und `- - -` als Listenpunkt | besteht unverändert; nach `* * *` öffnet eine Fence mit vier Leerzeichen einen Block, CommonMark sieht dort eingerückten Code | Folge von Paket 16 |
| `:186` — `^ {0,indent}` zieht nur Leerzeichen ab, `indent` zählt Spalten | besteht unverändert; `compileSnippets.mjs:80` rechnet `character + 1 + snippet.indent` — bei `\t`-Fence im Listenpunkt Spalte 12 statt 8 | Folge von Paket 16 |
| `:116` — ein Listenpunkt, dessen erste Zeile nach dem Marker leer ist (`-   `), bekommt die Inhaltsspalte hinter den Leerzeichen; CommonMark setzt sie eine Spalte hinter den Marker | neu gefunden; `LIST_ITEM` kam mit Paket 16 | Symptom derselben Ursache, aufgenommen |
| `:108–118` — eine Fence auf der Zeile eines Listenmarkers (`` - ```ts check ``) öffnet keinen Block; ihre schließende Fence öffnet dann einen ungemarkten, der den nächsten `ts check`-Block verschluckt | neu gefunden; vorbestehend, `6500527f` liest die Zeile genauso wenig (`OPENING_FENCE` `^(\s*)` + Backticks) | gleiche Ursache — die Zeile eines Listenmarkers wird nicht als erste Zeile des Punkts gelesen —, aufgenommen |
| `:120` — ein Zitat auf der Zeile eines Listenmarkers (`` - > ```ts check ``) wird nicht gemeldet, `QUOTED_FENCE` prüft die ganze Zeile ab `^\s*>` | neu gefunden; die Zitat-Meldung kam mit Paket 2 | gleiche Ursache, aufgenommen |
| `:186` mit `compileSnippets.mjs:80` — eine Codezeile, die flacher eingerückt ist als ihre Fence (` x` unter einer Fence mit zwei Spalten), verliert weniger als `indent`, die Spalte verschiebt sich um die Differenz | neu gefunden; vorbestehend, `6500527f` rechnet genauso (`indent: indent.length`, `column: character + 1 + snippet.indent`) | gleiche Ursache — die Spalte rechnet mit der Einrückung der Fence statt mit dem, was die Zeile verlor —, aufgenommen |

Die vier Folgen und die vier aufgenommenen Stellen sind Symptome einer Ursache: Paket 16 hat die
Fence- und Listenregel nach CommonMark eingeführt, aber Listenmarker, Trennlinien und Tabs nur zum
Teil gelesen und die Spalte einer Diagnose nicht an das angepasst, was eine Codezeile verliert.
Generation: Paket 16 ist die Wurzel dieser Kette, Paket 20 die zweite Generation. Eine Folge
**dieses** Pakets wäre die dritte — dann nicht schneiden, sondern anhalten und vorlegen.

Geprüft und **nicht** aufgenommen: die Queue-Einträge `CHANGELOG.md:71`, die Proposal-Stellen und
`docs/text.md`/`docs/sprites.md` (Pakete 17 und 18) und `SpritePicker.ts:279–280` teilen die
Ursache nicht.

## Entscheidungen dieses Pakets

- **Gefixt statt kommentiert**, wo CommonMark eine klare Regel hat (Tab nach dem Marker, leere
  erste Zeile, Trennlinie, Fence und Zitat auf der Markerzeile, Spalte je Zeile): jede ist eine
  Regex oder ein paar Zeilen, ein Kommentar über die Abweichung wäre länger als der Fix.
- **Bewusst nicht nachgebaut, nur im Kommentar gesagt:** das Extrahieren verfolgt keine Absätze.
  Eine Lazy Continuation beendet den Listenpunkt (so von Paket 16 entschieden und belassen), und
  ein Listenmarker, der nach CommonMark keinen Absatz unterbrechen darf (ein leerer Punkt, ein
  geordneter, der nicht mit 1 beginnt), beginnt hier trotzdem einen. Beides wirkt sich nur auf
  eine Fence aus, die vier oder mehr Spalten tief auf eine solche Zeile folgt. Absatzverfolgung
  hieße einen halben Markdown-Parser nachbauen, für einen Fall, den keine Datei des Repos hat.
- **Spalte je Codezeile statt einer Zahl je Block.** Das Snippet trägt `offsets: number[]` statt
  `indent: number`: je Codezeile, was zu einem Zeichenindex dieser Zeile addiert werden muss, damit
  er auf dasselbe Zeichen der Markdown-Zeile zeigt. Eine Zahl je Block kann nicht stimmen, sobald
  Zeilen unterschiedlich viel verlieren (Tab gegen Leerzeichen, flachere Zeile). Verworfen wurde,
  die Codezeilen gar nicht mehr zu kürzen (`column = character + 1`): kürzer, aber der Code wiche
  vom Inhalt des Blocks ab, wie CommonMark ihn liest, und der Kopfkommentar verspricht genau diesen.
- **Ein Tab, der über die abzuziehende Spaltenzahl hinausreicht**, lässt den Rest seiner Breite
  als Leerzeichen stehen, wie CommonMark es tut; der Offset der Zeile wird dann negativ
  (ein Zeichen entfernt, zwei Leerzeichen eingefügt → −1). Das ist richtig so.
- **`AGENTS.md` bleibt unverändert.** Ihr Satz »A fence counts where CommonMark sees one: indented
  at most three columns past the start of its line or past the content of its list item« deckt die
  Markerzeile (null Spalten hinter dem Inhalt des Punkts), Tabs und Trennlinien sind Einzelheiten
  von »where CommonMark sees one« und stehen im Kopfkommentar der Datei.
- **Kein CHANGELOG-Eintrag:** `scripts/` liegt nicht im veröffentlichten Paket (wie Paket 16).
- **Breite:** der Kopfkommentar (Zeilen bis zum ersten `const`) hält höchstens 90 Zeichen je
  Zeile, jede andere Kommentarzeile in `extractSnippets.mjs` höchstens 100; Absätze werden als
  Ganzes umbrochen. Code bleibt bei Biomes 130.

## Vorgehen

Konventionen des Plans gelten: Kommentare auf Englisch, kein Rückblick auf den Vorzustand (kein
»now«, »no longer«, »unlike before«), keine Finding-ID. JSDoc muss unter `checkJs` mit
`noUncheckedIndexedAccess` compilieren: Regex-Gruppen und `at(-1)` per Cast wie im bestehenden
Code (`/** @type {string} */ (item[1])`).

### Schritt 1 — Regressionstests zuerst, rot sehen

In `scripts/checkDocSnippets/extractSnippets.test.mjs` neue Tests (Namen so oder sinngleich),
`FENCE` und `doc()` sind dort definiert. Erwartet ist nach dem Fix jeweils genau das Gezeigte;
in Klammern, was der Code vor dem Fix liefert:

1. `a tab after a list marker counts to the next multiple of four: a fence at the content of the item opens a block`
   — `doc('-\titem', '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`)` →
   `snippets` `[{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [4]}]`; im selben Test
   `doc('1.\titem', …)` mit denselben Folgezeilen → dasselbe (vorher beide `[]`).
2. `a list marker followed by more than four columns starts its item with indented code: the content is one column past the marker`
   — `doc('-\t\tcode', '', `     ${FENCE}ts check`, '     const a = 1;', `     ${FENCE}`)` (fünf
   Leerzeichen) → `[{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [5]}]` (vorher `[]`;
   eine Inhaltsspalte hinter den Tabs, also 8, ergäbe ebenfalls `[]`).
3. `a list item whose first line is empty after the marker has its content one column past the marker`
   — `doc('-   ', `      ${FENCE}ts check`, '      const a = 1;', `      ${FENCE}`)` (Marker,
   drei Leerzeichen, Zeilenende; dann sechs Leerzeichen) → `snippets` `[]`: sechs Spalten sind vier
   hinter der Inhaltsspalte 2, also eingerückter Code (vorher ein Snippet mit `indent: 6`).
4. `a line of three *, - or _ is a thematic break and no list item: a fence four columns deep after it is code of an indented block`
   — `doc('* * *', '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`)` → `[]`; im selben
   Test dasselbe mit `'- - -'` → `[]` (vorher je ein Snippet).
5. `a thematic break as the content of a list item leaves the item open` (Schutztest, vorher schon
   grün) — `doc('- * * *', '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`)` →
   `[{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [4]}]`.
6. `a fence on the line of a list marker opens a block in the item, and the fences after it pair up`
   — (a) `doc(`- ${FENCE}ts check`, '  const a = 1;', `  ${FENCE}`)` →
   `[{file: 'a.md', line: 2, code: 'const a = 1;', offsets: [2]}]`;
   (b) verschachtelt `doc(`1. - ${FENCE}ts check`, '     const a = 1;', `     ${FENCE}`)` →
   `[{file: 'a.md', line: 2, code: 'const a = 1;', offsets: [5]}]`;
   (c) `doc(`- ${FENCE}ts`, '  x', `  ${FENCE}`, '', `${FENCE}ts check`, 'const z = 26;', FENCE)` →
   `[{file: 'a.md', line: 6, code: 'const z = 26;', offsets: [0]}]` (vorher alle drei `[]`; in (c)
   öffnet die schließende Fence der Zeile 3 einen ungemarkten Block, der den `ts check`-Block
   verschluckt).
7. `a marked fence in a blockquote on the line of a list marker is a problem with its line`
   — `doc(`- > ${FENCE}ts check`, '  > const a = 1;', `  > ${FENCE}`)` → `snippets` `[]`,
   `problems` genau ein Eintrag mit `line: 1` und der Meldung
   ``a code block marked `ts check` inside a blockquote is not checked — only a `ts check` block outside a quote is compiled``
   (vorher `problems` `[]`).
8. `a tab before the code of a block counts as columns: the code loses as much as its fence is deep`
   — (a) `doc('- item', '', `\t${FENCE}ts check`, '\tconst a = 1;', `\t${FENCE}`)` →
   `[{file: 'a.md', line: 4, code: 'const a = 1;', offsets: [1]}]` (vorher `code: '\tconst a = 1;'`);
   (b) `doc('- item', '', `  ${FENCE}ts check`, '\tconst a = 1;', `  ${FENCE}`)` →
   `[{file: 'a.md', line: 4, code: '  const a = 1;', offsets: [-1]}]` (der Tab reicht bis Spalte 4,
   zwei Spalten werden abgezogen, zwei bleiben als Leerzeichen; vorher `code: '\tconst a = 1;'`).

In `scripts/checkDocSnippets/compileSnippets.test.mjs`:

9. `maps the column of each line by what that line lost` — `compile({line: 10, offsets: [0, 1], code: "const a = 1;\nconst n: number = 'x';"})`
   → eine Diagnose, `line` 11, `column` 8 (`n` an Index 6, plus 1, plus Offset 1); vorher `NaN`.
10. `a diagnostic in a tab-indented block of a list item points at the column of the Markdown line`
    — durchgehend: `extractSnippets(doc('- item', '', '\t```ts check', "\tconst n: number = 'x';", '\t```'), 'a.md')`,
    dessen `snippets` an `compileSnippets({snippets, anchorDir, tsconfigPath})` → eine Diagnose,
    `line` 4, `column` 8 — `n` steht in der Markdown-Zeile an Index 7 (vorher 12). Dafür
    `extractSnippets` aus `./extractSnippets.mjs` importieren und eine `doc()`-Hilfe wie in der
    anderen Testdatei anlegen (oder die Zeilen von Hand mit `'\n'` verbinden).

Roter Lauf, Ausgabe in den Report:
`node --test scripts/checkDocSnippets/extractSnippets.test.mjs scripts/checkDocSnippets/compileSnippets.test.mjs`.
Rot müssen 1, 2, 3, 4, 6, 7, 8, 9, 10 sein, jeweils aus dem in Klammern genannten Grund (in 1–8
schlägt zusätzlich der Vergleich auf `offsets` fehl, weil die Snippets vorher `indent` tragen);
5 schlägt vorher allein an diesem Schlüssel fehl, sein Inhalt stimmt schon.

### Schritt 2 — `columnsOf()` bekommt eine Startspalte

`columnsOf(whitespace, from = 0)`: zählt ab Spalte `from`, ein Tab springt zum nächsten Vielfachen
von 4 der **Zeile** (`column + 4 - (column % 4)` mit `column` ab `from`). JSDoc: »The column a run
of spaces and tabs that starts at column `from` ends at: a tab moves on to the next multiple of 4.«

### Schritt 3 — Muster

- `OPENING_FENCE = /^(`{3,}|~{3,})(.*)$/` — ohne führende Leerraum-Gruppe, es wird auf den Rest der
  Zeile hinter Einrückung und Listenmarkern angewendet (Schritt 4). Gruppen verschieben sich:
  `match[1]` ist der Lauf, `match[2]` der Info-String.
- `LIST_ITEM = /^([-+*]|\d{1,9}[.)])([ \t]+|$)/` — ebenfalls ohne führenden Leerraum, mit Tab hinter
  dem Marker. Kommentar darüber: »a bullet or an ordered marker of a list item, and the spaces and
  tabs after it«.
- neu `THEMATIC_BREAK = /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/` mit Kommentar »CommonMark: three or more
  of the same `*`, `-` or `_`, spaced or not, make a thematic break, which wins over a list item«.
- `CLOSING_FENCE`, `QUOTED_FENCE`, `LEADING_WHITESPACE`, `MAX_FENCE_INDENT` bleiben.

### Schritt 4 — der Zweig `open == null` liest die Zeile von ihrem ersten Zeichen an

Bis einschließlich der Changelog-Überschrift bleibt der Zweig, wie er ist, nur dass der führende
Leerraum einmal festgehalten wird (`const whitespace = LEADING_WHITESPACE.exec(text)?.[0] ?? ''`,
`indent = columnsOf(whitespace)`) und `base` mit `let` steht. Danach statt `OPENING_FENCE.exec(text)`
und des `LIST_ITEM`-Blocks:

```js
// the line is read from its first character on: a list marker hands the rest of the line on as
// the first line of its item, which may open a fence or start with another marker
let column = indent;
let rest = text.slice(whitespace.length);
for (;;) {
  if (THEMATIC_BREAK.test(rest)) return;
  const item = LIST_ITEM.exec(rest);
  if (item == null) break;
  const start = column + /** @type {string} */ (item[1]).length;
  const end = columnsOf(/** @type {string} */ (item[2]), start);
  rest = rest.slice(item[0].length);
  // CommonMark: the content starts after 1 to 4 columns of spaces or tabs; on an otherwise empty
  // line, or after 5 or more (the item starts with indented code), one column past the marker
  const content = rest === '' || end - start > 4 ? start + 1 : end;
  listContent.push(content);
  // an empty first line, or one of indented code, opens no fence and holds no other marker
  if (content !== end) return;
  column = content;
  base = content;
}
```

Danach `OPENING_FENCE.exec(rest)`; trifft es nicht, läuft die Zitat-Prüfung wie bisher, aber auf
`rest` statt `text` (`QUOTED_FENCE.exec(rest)`), dann `return`. Trifft es, bleibt alles wie bisher
(Backtick im Info-String, Marker, Problem bei `unknown marker`), nur `open` bekommt
`indent: column` (statt der Einrückung der Zeile), `base` (aus der Schleife oder von oben) und
`offsets: []`.

Der Kommentar über der `while`-Schleife, die Listenpunkte schließt (heute `:92–94`), wird zu
(umbrochen auf ≤ 100):

```js
// a line indented less than the content of a list item is outside that item. Paragraphs are not
// tracked: a lazy continuation line of a paragraph ends the item here, and a list marker that may
// not interrupt a paragraph (an empty item, an ordered one that does not start at 1) starts one
// all the same, which CommonMark does neither; only a fence four or more columns deep that follows
// such a line is read differently
```

Die `while`-Zeile selbst ist 110 Zeichen lang und darf bleiben (Code, Biome 130).

### Schritt 5 — Codezeilen nach CommonMark kürzen, Offset je Zeile

Modulweit neu, unter `columnsOf()`:

```js
/**
 * Takes up to `columns` columns of indentation off a code line, as CommonMark does with the lines
 * of a fenced block: a tab counts up to the next multiple of 4, and one that reaches past `columns`
 * leaves the rest of its width as spaces.
 * @param {string} text
 * @param {number} columns
 * @returns {{code: string, offset: number}} `offset` is what a character index in `code` needs
 *   added to point at the same character in `text`
 */
const stripIndent = (text, columns) => {
  let column = 0;
  let index = 0;
  while (index < text.length && column < columns) {
    const char = text[index];
    if (char === ' ') column += 1;
    else if (char === '\t') column += 4 - (column % 4);
    else break;
    index += 1;
  }
  const kept = column > columns ? ' '.repeat(column - columns) : '';
  return {code: kept + text.slice(index), offset: index - kept.length};
};
```

- Typedef `OpenFence`: `indent` → »the column the fence starts at; CommonMark takes up to that many
  columns off each code line«, neu `@property {number[]} offsets` »for each code line, the `offset`
  of `stripIndent()`«.
- Der Zweig der Codezeile (heute `:183–187`): `const {code, offset} = stripIndent(text, open.indent);`
  `open.code.push(code); open.offsets.push(offset);` — der Kommentar `:184–185` entfällt, die
  Erklärung steht am Helfer.
- `snippets.push({file, line: open.line + 1, code: open.code.join('\n'), offsets: open.offsets})`
  — kein `indent` mehr.
- `@returns` von `extractSnippets()`: `snippets: Array<{file: string, line: number, code: string, offsets: number[]}>`,
  dazu eine Zeile im JSDoc: »`offsets` holds for each line of `code` what a character index of that
  line needs added to point at the same character of the Markdown line.«

### Schritt 6 — `compileSnippets.mjs`

- Typedef des Parameters: `snippets: Array<{file: string, line: number, code: string, offsets: number[]}>`.
- `:80`: `column: character + 1 + (snippet.offsets[line] ?? 0),` — `line` ist die Zeile innerhalb
  des Snippets.
- Kopfkommentar `:6–7` (»Diagnostics are mapped back to the line and column in the Markdown file.«)
  stimmt weiter und bleibt.

### Schritt 7 — Kopfkommentar von `extractSnippets.mjs`

Zeilen 1–21 werden zu folgendem Text (≤ 90 Zeichen je Zeile, so ausgemessen; der Absatz zu
CHANGELOG bleibt wörtlich):

```js
// Finds the code blocks of a Markdown document that are marked `ts check`.
//
// A pure function over text: no file system, no TypeScript. `checkDocSnippets.mjs` reads
// the files and hands them in, `compileSnippets.mjs` type-checks what comes out.
//
// Every fence is tracked, marked or not, because a `ts check` line inside another code
// block (a four-backtick block that shows Markdown, say) is an example of the marker, not
// the marker. Backtick and tilde fences count alike, and a fence counts where CommonMark
// sees one: indented at most three columns past the start of its line or past the
// content of the list item it sits in, the line of the item's marker included. A tab
// moves on to the next multiple of four columns, before a fence as after a list marker.
// A line indented further is code of an indented block and neither opens nor closes a
// fence. A line of three or more of the same `*`, `-` or `_`, spaced or not, is a
// thematic break and no list item.
//
// The code of a block loses the indentation CommonMark takes off it, up to the column of
// its fence, and a snippet carries for each code line how far that moved its characters,
// so that a diagnostic points at the column of the Markdown line, tabs and all.
//
// A marker that is nearly right (`js check`, `ts check strict`) is reported instead of
// ignored: a typo must not drop a block out of the check without a word. So is a marker
// inside a blockquote: `checkDocSnippets` does not unwrap quotes, and the block would
// otherwise fall out of the check in silence.
//
// In a `CHANGELOG.md` only the `## [Unreleased]` section counts, up to the next `## [`
// heading: a released section is history and shows the API of its release, so its
// blocks are neither compiled nor checked for their marker. A changelog without an
// Unreleased section has no block to check.
```

Danach jede Kommentarzeile der Datei auf ≤ 100 prüfen
(`awk 'length > 100 && /^ *\/\//' scripts/checkDocSnippets/extractSnippets.mjs`, Kopf: `> 90`) —
heute liegen `:93`, `:97`, `:114` darüber; sie werden mit Schritt 4 ohnehin neu geschrieben.
Der Kommentar über `MAX_FENCE_INDENT` (`:30–31`, 91 und 95 Zeichen) bleibt.

### Schritt 8 — bestehende Tests auf `offsets` umstellen

`extractSnippets.test.mjs` (Zeilen von heute): `:18` `offsets: [0, 0]` · `:31` Testname
`strips the fence indentation from the code and reports per line what it took off`, `:39`
`offsets: [2, 2, 1]` (der Kommentar `:37–38` bleibt sinngemäß) · `:58` `[0]` · `:75` `[0, 0, 0]` ·
`:84` `[4]` · `:90` `[4]` · `:115` `[0]` · `:164` `[0]` · `:188` `[0]` · `:198` `[0, 0, 0]` ·
`:209` `[0]` · `:257` `[0]` — jeweils `indent: N` durch `offsets: [...]` ersetzen, Reihenfolge der
Schlüssel wie im Snippet (`file, line, code, offsets`).

`compileSnippets.test.mjs`: der Helfer `compile` setzt statt `indent: 0` als Vorgabe
`offsets` mit einer 0 je Codezeile (`snippet.code.split('\n').map(() => 0)`, aus dem übergebenen
`code` berechnet, bevor `...snippet` es überschreiben kann); `:18` `{line: 10, offsets: [2], code: …}`,
der Kommentar `:25–26` sagt »plus what the code line lost of its indentation« statt »plus the fence
indentation«; Spalte bleibt 9.

### Nicht im Paket

- Zitate werden nicht ausgepackt, Absätze nicht verfolgt (siehe Entscheidungen).
- `AGENTS.md`, `docs/architecture.md`, CHANGELOG: unverändert (Gründe oben).
- Die Kommentarbreite anderer Dateien unter `scripts/`.

## Folgen im Volltext (aus der `Folgen:`-Zeile von Paket 16)

- `scripts/checkDocSnippets/extractSnippets.mjs:9` — die Kopfzeile hat 91 Zeichen gegen die 90 des
  Kopfs.
- `:27` — `LIST_ITEM` (`( +|$)`) nimmt keinen Tab hinter dem Marker: `-\titem` ist kein
  Listenpunkt, eine Fence vier Spalten tief darunter fiele still aus dem Check.
- `:110` — `LIST_ITEM` nimmt auch Trennlinien (`* * *`, `- - -`) als Listenpunkt (macht die Prüfung
  nur nachsichtiger), der Kommentar `:92–94` sagt es nicht.
- `:186` — zieht von einer Codezeile nur Leerzeichen ab, während `indent` (`:91` per `columnsOf()`,
  in die offene Fence übernommen `:157`) Tabs als Spalten zählt: bei einer tab-eingerückten Fence
  im Listenpunkt weicht die Spalte in `compileSnippets.mjs:80` (`character + 1 + snippet.indent`)
  ab, ein Satz im Kommentar fehlt.
