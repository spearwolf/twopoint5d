# Paket 16 — Fehlerpfade und Verträge in Texture und Repo-Skripten

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings. Ein Nebenbefund aus »Offene Befunde«
  (`extractSnippets.mjs`, `OPENING_FENCE`), sechs kleine Reviewer-Befunde der
  Pakete 1, 2, 12 und 13 (Folgen), dazu aus Paket 18 übernommen: der
  Kopfkommentar `extractSnippets.mjs:8` (127 Zeichen, Absatz nicht umbrochen)
- Ziel: Doc-Snippet-Check, Preview-Generator, `DynamicAtlas#upload()` und
  `TextureResource` halten, was ihre Kommentare und TSDoc versprechen, auch auf
  Fehlerpfaden.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `scripts/checkDocSnippets/extractSnippets.mjs`, `scripts/checkDocSnippets/extractSnippets.test.mjs`
  - `scripts/lookbook/demoPreviewConfig.mjs`, `scripts/lookbook/demoPreviewConfig.test.mjs`
  - `packages/twopoint5d/src/texture/DynamicAtlas.ts`, `DynamicAtlas.spec.ts`
  - `packages/twopoint5d/src/texture/cmpAnimationsData.ts`, `cmpAnimationsData.spec.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts`, `TextureResource.spec.ts`
  - `packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md` (§3.3, ein Satz)
  - `AGENTS.md` (»Code blocks in Markdown«, ein Satz)
- Verify: `pnpm run ci`
- Commit: `fix: count a fence of a Markdown code block where CommonMark sees one — indented at most three columns past its line or its list item —, say once per run that a refused preview keeps its old image, build the staging canvas of DynamicAtlas#upload() under the guard that marks the whole texture on a throw, end the content comparison of animation data on cycles of any period, keep a disposed resource from reading a frameBasedAnimationsData written to it, and say that TextureResource is the base of the three shapes of the library alone`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · `OPENING_FENCE` besteht, von `:11`
    nach `:18` gewandert, `CLOSING_FENCE` `:19` gleiche Ursache aufgenommen ·
    Preview-Meldung unverändert (`demoPreviewConfig.mjs:85`, `:87`, `:104`) ·
    Doppel-Cast unverändert (`extractSnippets.mjs:76–77`, Zeilen des Reviewers
    galten dem Diff) · `#ensureStaging()` unverändert vor dem `try`
    (`DynamicAtlas.ts:435`/`:437`) · `cmpAnimationsData` unverändert
    (`:10–19`, `:21–22`, `:26`) · Setter ohne Dispose-Prüfung unverändert
    (`TextureResource.ts:1098`, `:1320`, Kommentar `:430–436`) ·
    `registerShapeEffects()` unverändert `@internal` (`:760–767`, `stripInternal`
    in `tsconfig.json:49`, fehlt in `dist/lib/texture/TextureResource.d.ts`) ·
    aus Paket 18 übernommen: `extractSnippets.mjs:8` · keine offene Folge ohne
    Paket, Queue-Eintrag `SpritePicker.ts:279–280` bleibt liegen (andere Ursache)
  - 2026-10-22 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report `paket-16.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG · 12 Dateien geändert (`AGENTS.md`, Proposal, `DynamicAtlas`, `TextureResource`, `cmpAnimationsData` je mit Spec, `extractSnippets`, `demoPreviewConfig` je mit Test) · Arbeitsbaum schmutzig · Doc-Snippet-Blöcke 61 vorher und nachher · `pnpm run ci` exit=0 (`paket-16.verify.log`)
  - 2026-10-22 Zug 3: Reviewer (sonnet, effort medium) — alle neun Punkte behoben, keine kritischen oder wichtigen Befunde, 4 klein · Diff `paket-16.diff`, Report `paket-16.review-0.json`
  - 2026-10-22 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-10-22 Zug 5: committet 94d00365 (12 Dateien), Verify aus Zug 2 (exit=0, keine Änderung seither)

## Vorgehen

Reihenfolge beliebig; jeder Schritt bringt seine Tests mit. Bei einem
Korrektheitsfehler zuerst den Test, rot sehen, dann beheben — welche Tests vor
dem Fix rot sein müssen, steht je Schritt.

### 1. `extractSnippets.mjs`: eine Fence zählt, wo CommonMark eine sieht

Heute nimmt `OPENING_FENCE = /^(\s*)(…)(.*)$/` (`:18`) jede Einrückung, und
`CLOSING_FENCE = /^\s*(…)\s*$/` (`:19`) schließt bei jeder Einrückung. Nach
CommonMark darf eine Fence höchstens drei Spalten über den Anfang ihres
Containers eingerückt sein — der Zeile, oder des Inhalts des Listenpunkts, in
dem sie steht. Vier und mehr Spalten sind Code eines eingerückten Blocks (oder
Fortsetzung eines Absatzes): die Zeile öffnet und schließt nichts. Ein Tab rückt
auf das nächste Vielfache von 4 vor (CommonMark §2.2).

Eine harte Grenze von drei Leerzeichen reicht nicht: eine Fence in einem
verschachtelten Listenpunkt steht legitim vier und mehr Spalten tief, und der
Kommentar `:130` rechnet ausdrücklich mit Listenpunkten. Fiele sie heraus, wäre
ein `ts check`-Block dort ohne ein Wort aus dem Check — genau das, was der
Kopfkommentar verbietet. Deshalb merkt sich der Check die Inhaltsspalten der
offenen Listenpunkte.

a) Modulweit, an der Stelle von `:18–20`:

```js
const OPENING_FENCE = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
const CLOSING_FENCE = /^([ \t]*)(`{3,}|~{3,})\s*$/;
const QUOTED_FENCE = /^\s*>[\s>]*(`{3,}|~{3,})(.*)$/;
// a bullet or an ordered marker of a list item, and the spaces after it
const LIST_ITEM = /^[ \t]*([-+*]|\d{1,9}[.)])( +|$)/;
const LEADING_WHITESPACE = /^[ \t]*/;

// CommonMark: a fence may be indented up to three columns past the start of its container,
// the line or the content of a list item; four or more make the line code of an indented block
const MAX_FENCE_INDENT = 3;

/**
 * The column a run of leading spaces and tabs ends at: a tab moves on to the next multiple of 4.
 * @param {string} whitespace
 * @returns {number}
 */
const columnsOf = (whitespace) => {
  let column = 0;
  for (const char of whitespace) column = char === '\t' ? column + 4 - (column % 4) : column + 1;
  return column;
};
```

b) In `extractSnippets()` neben `open`:

```js
  // the content columns of the list items the next line may sit in, innermost last
  /** @type {number[]} */
  const listContent = [];
```

Die Typedef `OpenFence` bekommt `@property {number} base` — die Inhaltsspalte
des Listenpunkts, in dem die Fence steht, 0 außerhalb einer Liste. `indent`
bleibt die Spaltenzahl der Fence-Zeile selbst (Grundlage für das Abziehen der
Einrückung in `:132` und für die Spalte in `compileSnippets.mjs:80`).

c) Im Zweig `open == null`, **vor** der Prüfung auf `VERSION_HEADING`:

```js
      if (text.trim() === '') return;
      const indent = columnsOf(LEADING_WHITESPACE.exec(text)?.[0] ?? '');
      // a line indented less than the content of a list item is outside that item. A lazy
      // continuation line of a paragraph ends the item here, which CommonMark does not; only a fence
      // four or more columns deep that follows such a line in the same item is read differently
      while (listContent.length > 0 && /** @type {number} */ (listContent.at(-1)) > indent) listContent.pop();
      const base = listContent.at(-1) ?? 0;
      // code of an indented block, or text that goes on a paragraph: it opens no fence and no list item
      if (indent - base > MAX_FENCE_INDENT) return;
```

Eine Leerzeile ändert den Listen-Stapel nicht (CommonMark: Leerzeilen beenden
keinen Listenpunkt). Die frühe Rückkehr bei einer Leerzeile ändert sonst nichts:
heute fällt eine Leerzeile durch alle drei Muster und kehrt ebenso zurück.

d) Treffer von `OPENING_FENCE`: die Gruppen über den Index lesen, je mit einem
Cast (siehe Schritt 2); Gruppe 1 wird nicht mehr gebraucht, `indent` steht
schon. `open` bekommt `indent` (die Spalten aus c) und `base`.

e) Kein Treffer von `OPENING_FENCE`: zuerst `LIST_ITEM`, dann wie heute
`QUOTED_FENCE`.

```js
      const item = LIST_ITEM.exec(text);
      if (item != null) {
        const marker = /** @type {string} */ (item[1]);
        const spaces = /** @type {string} */ (item[2]).length;
        // CommonMark: the content starts after 1 to 4 spaces; after 5 or more, or at the end of the
        // line, one column past the marker
        listContent.push(indent + marker.length + (spaces >= 1 && spaces <= 4 ? spaces : 1));
        return;
      }
```

Eine Fence direkt hinter dem Marker (`- ```ts`) wird wie heute nicht erkannt;
das bleibt so.

f) Im Zweig der offenen Fence schließt eine Zeile nur noch, wenn zusätzlich
`columnsOf(<Gruppe 1>) - open.base <= MAX_FENCE_INDENT` gilt; die Gruppen von
`CLOSING_FENCE` verschieben sich um eins (Lauf jetzt Gruppe 2). Eine weniger
eingerückte Zeile als `base` schließt weiterhin (Differenz negativ). Der
Listen-Stapel wird innerhalb einer offenen Fence nicht angefasst.

g) Kopfkommentar `:6–11`: der Absatz bekommt die Einrückungsregel und wird
neu umbrochen, keine Zeile über 90 Zeichen (wie der Rest des Kopfs; heute steht
`:8` mit 127 Zeichen — der übernommene Befund aus Paket 18). Zieltext:

```
// Every fence is tracked, marked or not, because a `ts check` line inside another code
// block (a four-backtick block that shows Markdown, say) is an example of the marker, not
// the marker. Backtick and tilde fences count alike, and a fence counts where CommonMark
// sees one: indented at most three columns past the start of its line, or past the content
// of the list item it sits in, a tab moving on to the next multiple of four. A line
// indented further is code of an indented block and neither opens nor closes a fence.
//
// A marker that is nearly right (`js check`, `ts check strict`) is reported instead of
// ignored: a typo must not drop a block out of the check without a word. So is a marker
// inside a blockquote: `checkDocSnippets` does not unwrap quotes, and the block would
// otherwise fall out of the check in silence.
```

h) `AGENTS.md`, Abschnitt »Code blocks in Markdown«, nach dem Satz »Backtick
and tilde fences count alike, … the block would go unchecked.« ein Satz, im
Umbruch des Abschnitts (Fortsetzungszeilen mit zwei Leerzeichen, keine Zeile
über 88 Zeichen):

> A fence counts where CommonMark sees one: indented at most three columns past
> the start of its line or past the content of its list item; a line indented
> further is code of an indented block and opens no block.

i) Tests in `extractSnippets.test.mjs` (mit `doc()`, `FENCE`), je als
eigenes `test(...)` auf oberster Ebene neben `strips the fence indentation …`:

| Test | Eingabe | Erwartung | vor dem Fix |
| --- | --- | --- | --- |
| `a fence indented four spaces at the top level opens no block: the line is code of an indented block` | `doc('Write a fence like this:', '', `    ${FENCE}ts check`, '', 'and close it.', '', `${FENCE}ts check`, 'const b = 1;', FENCE)` | `snippets` `[{file: 'a.md', line: 8, indent: 0, code: 'const b = 1;'}]`, `problems` `[]` | rot |
| `a tab before a fence is four columns: the line opens no block` | `doc(`\t${FENCE}ts check`, 'const a = 1;', `\t${FENCE}`)` | `snippets` `[]`, `problems` `[]` | rot |
| `a line indented four spaces inside a block is code, not its closing fence` | `doc(`${FENCE}ts check`, '// a fence in a comment:', `    ${FENCE}`, 'const a = 1;', FENCE)` | `[{file: 'a.md', line: 2, indent: 0, code: '// a fence in a comment:\n    ' + FENCE + '\nconst a = 1;'}]` | rot |
| `a fence indented four spaces in a nested list item opens a block` | `doc('- outer', '  - inner', '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`)` | `[{file: 'a.md', line: 5, indent: 4, code: 'const a = 1;'}]` | grün (pinnt den Listenfall) |
| `a fence of an ordered list item is measured from the content of the item` | `doc('10. item', '', `    ${FENCE}ts check`, '    const a = 1;', `    ${FENCE}`)` | `[{file: 'a.md', line: 4, indent: 4, code: 'const a = 1;'}]` | grün (pinnt) |
| `a fence four columns past the content of its list item is code of an indented block` | `doc('- item', '', `      ${FENCE}ts check`, '      const a = 1;', `      ${FENCE}`)` | `snippets` `[]` | rot |
| `a line less indented than the content of a list item ends it: a fence after it is measured from its line` | `doc('- item', '', 'prose', '', `    ${FENCE}ts check`, 'x', `    ${FENCE}`)` | `snippets` `[]` | rot |

Alle bestehenden Tests der Datei bleiben unverändert grün; `pnpm typecheck`
(Nx-Projekt `scripts`, `checkJs`) und der Doc-Snippet-Lauf über alle getrackten
`*.md` müssen grün bleiben. Kein getracktes Markdown hat heute eine Fence mit
vier und mehr Spalten Einrückung (`git ls-files '*.md' | xargs grep -nE
'^\s{4,}(`{3,}|~{3,})'` leer); die Zahl der geprüften Blöcke im Lauf von
`checkDocSnippets.mjs` darf sich nicht ändern — vorher und nachher ablesen und
in den Report.

### 2. `extractSnippets.mjs`: ein Cast je Gruppe

`:76` destrukturiert über einen Doppel-Cast durch `unknown`
(`/** @type {[string, string, string]} */ (/** @type {unknown} */ (quoted))`),
`:77` liest dieselbe Gruppe daneben mit einem Cast. Beide Stellen der Funktion,
die Gruppen eines Treffers lesen (`quoted` `:76–77`, `match` `:93`), lesen sie
über den Index mit je einem `/** @type {string} */`-Cast, wie `:77` und `:120`
es tun:

```js
          const quotedFence = /** @type {string} */ (quoted[1]);
          const quotedRest = /** @type {string} */ (quoted[2]);
```

Die Kommentare »both groups … / the three groups of the pattern always take
part in a match« bleiben über den Lesezeilen stehen (für `match` jetzt »the
groups of the pattern …«, weil Gruppe 1 nicht mehr gelesen wird). Kein Test
nötig, reine Typ-Schreibweise; `pnpm typecheck` muss grün bleiben.

### 3. Preview-Generator: »the old image stays« einmal

Eine verweigerte Demo sagt heute zweimal, dass ihr altes Bild bleibt: in ihrer
Problemzeile (`refuseScreenshot()`, `demoPreviewConfig.mjs:85`, `:87`, geworfen
in `generateDemoPreviews.mjs:92–93`, gedruckt unter der Demo) und in der
Schlusszeile von `summarizeRun()` (`:104`), die es für jede gescheiterte Demo
sagt — auch für die, deren Problemzeile ein Timeout ist. Die Schlusszeile ist die
eine Stelle.

- `demoPreviewConfig.mjs:85`: `the page threw ${pageErrors} error(s)`
- `demoPreviewConfig.mjs:87`: `the page logged ${consoleErrors} console error(s) under --strict`
- `summarizeRun()` und `generateDemoPreviews.mjs` bleiben unverändert;
  `apps/lookbook/README.md:97–99` stimmt weiter.
- Tests in `demoPreviewConfig.test.mjs`: die drei `assert.match` auf
  `refuseScreenshot()` (`:154`, `:155`, `:160`) werden `assert.equal` auf den
  vollen Text (rot vor dem Fix, der Text endet heute auf », the old image
  stays«); `names the failed demos and exits with 1` bekommt
  `assert.match(summary, /their old images stay/)` (grün, pinnt die eine
  Stelle).

### 4. `DynamicAtlas#upload()`: die Staging-Leinwand unter dem Schutz

`DynamicAtlas.ts:435–436` baut die Staging-Leinwand vor dem `try` (`:437`):
wirft `#ensureStaging()` (`buildCanvas()` ohne `OffscreenCanvas` und Dokument,
`expectDefined()` bei einem `getContext('2d')`, das `null` antwortet), bleibt
die Textur unmarkiert und `#dirty` gefüllt — jeder weitere Aufruf wirft
wieder, und keine Änderung erreicht die GPU, gegen »no change is lost« im TSDoc
`:403–404`.

- `const staging = this.#ensureStaging(stageW, stageH);` und
  `const {context} = staging;` werden die ersten Anweisungen im äußeren `try`;
  `catch` (Textur markieren, weiterwerfen) und `finally` (`dirty.length = 0`)
  bleiben, wie sie sind.
- TSDoc von `upload()`, Satz `:403–404` »A copy that throws marks the whole
  texture, so no change is lost, and the error goes on to the caller.« wird:
  »A call that throws — while it builds its staging canvas or in a copy —
  marks the whole texture, so no change is lost, and the error goes on to the
  caller.« Absatz neu umbrechen, keine Zeile über 130 Zeichen wie der Rest.
- Proposal `dynamic-atlas-and-bitmap-text.md` §3.3, `:178–179`: »and a copy
  that throws marks it as well, so no change is lost, before the error goes on
  to the caller.« wird »and an `upload()` that throws — while it builds the
  staging canvas or in a copy — marks it as well, so no change is lost, before
  the error goes on to the caller.« Absatz neu umbrechen, keine Zeile über 100
  Zeichen.
- Kein CHANGELOG-Eintrag: `upload()` ist unveröffentlicht (`Added`-Zeile
  `CHANGELOG.md:35` unter `[Unreleased]`), und die Zeile sagt nichts über den
  Fehlerpfad.
- Test in `DynamicAtlas.spec.ts`, `describe('upload()')` (dort stubbt
  `beforeEach` `OffscreenCanvas` mit `FakeCanvas`), neben `an upload that
  throws marks the whole texture, …`, rot vor dem Fix:

```ts
    test('an upload whose staging canvas cannot be built marks the whole texture, so no change is lost, and the error goes on', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.upload(renderer);
      atlas.add('a', noop, {width: 10, height: 8});
      // a staging canvas whose 2D context is taken: getContext('2d') answers null
      vi.stubGlobal(
        'OffscreenCanvas',
        class extends FakeCanvas {
          constructor(width: number, height: number) {
            super(width, height);
            this.context2d = null;
          }
        },
      );
      const version = atlas.texture.version;

      expect(() => atlas.upload(renderer)).toThrow('expected the 2D context of a canvas of its own to be defined');

      expect(atlas.texture.version).toBeGreaterThan(version);
      vi.stubGlobal('OffscreenCanvas', FakeCanvas);
      atlas.upload(renderer);
      expect(copyTextureToTexture).not.toHaveBeenCalled();
    });
```

### 5. `cmpAnimationsData()`: Zyklen jeder Periode enden

`onPath` (`cmpAnimationsData.ts:10–19`, `:26`) merkt sich je Objekt von `a`
nur einen Partner aus `b`. Zwei Zyklen verschiedener Periode — `x.self = x`
gegen `y1.self = y2, y2.self = y1` — überschreiben den Partner von `x` im
Wechsel, das Paar `(x, y1)` wird nie wiedererkannt, und der Vergleich endet in
`RangeError: Maximum call stack size exceeded`, gegen den Kommentar `:21–22`
(»a pair met again further down is a cycle, and it counts as equal«).

- `onPath` wird `Map<object, Set<object>>`: je Objekt von `a` die Objekte von
  `b`, mit denen es gerade verglichen wird.
- `sameData()`, `:26`: `if (onPath.get(a)?.has(b)) return true;`
- `descend()`:

```ts
// compares the parts of `a` and `b` with the pair on the path, and takes it off once that is done
const descend = (a: object, b: object, onPath: Map<object, Set<object>>, compareParts: () => boolean): boolean => {
  let partners = onPath.get(a);
  if (partners === undefined) {
    partners = new Set();
    onPath.set(a, partners);
  }
  partners.add(b);
  try {
    return compareParts();
  } finally {
    partners.delete(b);
    if (partners.size === 0) onPath.delete(a);
  }
};
```

- Kommentar `:21–22` sagt, was jetzt gilt: »`onPath` holds, for each object
  of `a`, the objects of `b` it is being compared with: a pair met again further
  down is a cycle, and it counts as equal, since every other part of both
  graphs is compared on its own — cycles of different periods included«.
  `cmpAnimationsData` bleibt `(a, b) => sameData(a, b, new Map())`.
- Kein CHANGELOG-Eintrag: der Inhaltsvergleich ist unveröffentlicht
  (`CHANGELOG.md:104` unter `[Unreleased]`).
- Test in `cmpAnimationsData.spec.ts`, neben `a cycle in both graphs ends the
  comparison`, rot vor dem Fix (`RangeError`):

```ts
  test('cycles of different periods end the comparison', () => {
    const once = () => {
      const entry: Record<string, unknown> = {duration: 1, tileIds: [1]};
      entry['self'] = entry;
      return {walk: entry} as unknown as FrameBasedAnimationsDataMap;
    };
    const twice = (secondDuration: number) => {
      const first: Record<string, unknown> = {duration: 1, tileIds: [1]};
      const second: Record<string, unknown> = {duration: secondDuration, tileIds: [1]};
      first['self'] = second;
      second['self'] = first;
      return {walk: first} as unknown as FrameBasedAnimationsDataMap;
    };

    expect(cmpAnimationsData(once(), twice(1))).toBe(true);
    expect(cmpAnimationsData(twice(1), once())).toBe(true);
    expect(cmpAnimationsData(once(), twice(2))).toBe(false);
  });
```

### 6. `frameBasedAnimationsData`: ein disposed Resource bleibt still

Der Kommentar `TextureResource.ts:430–436` sagt: »The setters of the inputs of
one shape check the flag all the same«. Jeder Setter einer Form tut es
(`imageUrl` `:1016`, `:1067`, `tileSetOptions` `:1081`, `atlasUrl`,
`atlasJson`, `overrideImageUrl`, `atlasAdapter`) — außer
`TileSetTextureResource#frameBasedAnimationsData` (`:1098`) und
`AtlasTextureResource#frameBasedAnimationsData` (`:1320`). Folge: signalize
ruft beim Schreiben eines zerstörten Signals weiter `compare` auf
(`cmpAnimationsData()` liest die neuen Daten) und hält den Wert fest.

- Beide Setter beginnen mit `if (this.#context.isDisposed()) return;`, wie die
  übrigen Setter derselben Klassen.
- Kein CHANGELOG-Eintrag (nach außen nur: keine Lesezugriffe mehr auf die
  geschriebenen Daten).
- Test in `TextureResource.spec.ts`, `describe('dispose()')`, rot vor dem Fix
  (`reads` ist 1 je Ressource):

```ts
    test('a disposed tile set or atlas resource reads none of the frameBasedAnimationsData written to it', () => {
      for (const resource of [new TileSetTextureResource('tiles'), new AtlasTextureResource('frames')]) {
        resource.frameBasedAnimationsData = {walk: {duration: 1, tileIds: [1]}};
        resource.dispose();
        let reads = 0;

        resource.frameBasedAnimationsData = {
          get walk() {
            reads++;
            return {duration: 1, tileIds: [1]};
          },
        };

        expect(reads).toBe(0);
        expect(resource.frameBasedAnimationsData).toBeUndefined();
      }
    });
```

  Lässt der Typ von `AtlasTextureResource#frameBasedAnimationsData` `tileIds`
  nicht zu, für die Atlas-Ressource `{duration: 1, frameNameQuery: 'walk.*'}`
  nehmen; Imports der beiden Klassen aus `./TextureResource.js` ergänzen,
  falls sie fehlen.

### 7. `TextureResource`: die Basis trägt nur die drei Formen

`registerShapeEffects()` (`TextureResource.ts:760–767`) ist `protected
abstract` und `@internal`; mit `stripInternal` (`tsconfig.json:49`) fehlt es im
veröffentlichten d.ts. Eine fremde Unterklasse von `TextureResource` kompiliert
gegen das Paket, und ihr `activate()` ruft eine Methode, die es nicht gibt. Ein
Satz im Klassen-TSDoc reicht (Empfehlung des Reviewers; ein Laufzeit-Check im
Konstruktor müsste Unterklassen der drei Formen zulassen und ist nicht
verlangt).

- Klassen-TSDoc `:254–317`, als eigener Absatz direkt nach dem Absatz »Each
  class carries the inputs of its shape alone; … which write its first values
  as well.« (`:264–267`):

```
 * `TextureResource` is the base of these three alone and is not meant to be extended outside the
 * library: the effects of a shape hang on a member the published types leave out. To add to a
 * shape, extend the class of that shape.
```

  Keine Zeile über 100 Zeichen, wie der Rest des TSDoc.
- Kein Test, kein CHANGELOG-Eintrag (Doku einer bestehenden Grenze).

## Abgleich

| Punkt | Herkunft | Fundstelle jetzt | Einordnung |
| --- | --- | --- | --- |
| `OPENING_FENCE` nimmt vier und mehr Leerzeichen | Queue (Nebenbefund Paket 2) | `extractSnippets.mjs:18` | verschoben (Kopf seit `698715a3` länger), unverändert |
| gleiche Ursache: `CLOSING_FENCE` schließt bei jeder Einrückung | in Zug 0 gefunden | `extractSnippets.mjs:19` | aufgenommen — dieselbe Einrückungsregel, ohne sie bleibt der Fix halb (eine Zeile `    ```` im Block schlösse ihn weiter) |
| »the old image stays« zweimal | Folge Paket 1 | `demoPreviewConfig.mjs:85`, `:87`, `:104`; `generateDemoPreviews.mjs:92–93` | unverändert |
| Doppel-Cast beim Destrukturieren | Folge Paket 2 | `extractSnippets.mjs:76–77` (Reviewer: `:79–82`, Zeilen des Diffs); gleiche Form `:93` | unverändert; `:93` mitgenommen, damit die Funktion eine Form hat |
| `#ensureStaging()` vor dem `try` | Folge Paket 12 | `DynamicAtlas.ts:435`, `try` `:437` | unverändert |
| Zykluserkennung je `a` ein Partner | Folge Paket 13 | `cmpAnimationsData.ts:10–19`, `:26`, Kommentar `:21–22` | unverändert |
| `frameBasedAnimationsData`-Setter ohne Dispose-Prüfung | Folge Paket 13 | `TextureResource.ts:1098`, `:1320`, Kommentar `:430–436` | unverändert |
| `registerShapeEffects()` fehlt im d.ts | Folge Paket 13 | `TextureResource.ts:760–767`, Klassen-TSDoc `:254–317` | unverändert |
| Kopfkommentar 127 Zeichen | Folge Paket 2, bisher Paket 18 | `extractSnippets.mjs:8` | übernommen — Schritt 1g schreibt genau diesen Absatz neu |

## Entscheidungen dieses Pakets

- **Listen-Stapel statt harter Grenze von drei Leerzeichen.** Die harte Grenze
  ließe einen `ts check`-Block in einem verschachtelten Listenpunkt (vier und
  mehr Spalten tief, CommonMark-konform) still aus dem Check fallen; das
  verbietet der Kopfkommentar der Datei, und `:130` rechnet mit Listenpunkten.
  Eine Meldung für jede tief eingerückte markierte Fence wäre ein Fehlalarm
  genau im Fall des Queue-Eintrags (ein eingerückter Codeblock, der eine Fence
  zeigt). Ein Stapel der Inhaltsspalten kostet eine Handvoll Zeilen und bleibt
  eine reine Funktion über Text.
- **Lazy Continuation nicht nachgebaut.** Eine Textzeile, die einen Absatz
  ohne die Einrückung ihres Listenpunkts fortsetzt, beendet hier den
  Listenpunkt. Anders liest sich das nur für eine Fence vier und mehr Spalten
  tief nach so einer Zeile im selben Punkt; die Absatzerkennung, die es dafür
  bräuchte, macht aus dem Check einen Markdown-Parser. Der Kommentar an der
  Stelle sagt es.
- **Tabs nach CommonMark** (nächstes Vielfaches von 4) für die
  Einrückungsprüfung; das Abziehen der Einrückung von den Codezeilen (`:132`,
  nur Leerzeichen) bleibt, wie es ist — TypeScript stört ein führender Tab
  nicht.
- **`CLOSING_FENCE` mitgenommen**: dieselbe Ursache (Fence-Zeilen ohne
  Einrückungsgrenze), sonst schlösse eine eingerückte Codezeile
  ` ```` den Block weiter.
- **»old image« bleibt in der Schlusszeile**, nicht in der Problemzeile: die
  Schlusszeile sagt es für jede gescheiterte Demo, auch nach einem Timeout oder
  einer falschen Größe; die Problemzeile nennt die Ursache.
- **`registerShapeEffects()`: nur der TSDoc-Satz**, wie der Reviewer
  empfiehlt. Ein Laufzeit-Check auf `new.target` müsste Unterklassen der drei
  Formen weiter zulassen und ändert Verhalten, das niemand verlangt hat.
- **Kein CHANGELOG-Eintrag im ganzen Paket**: die Skripte gehören nicht zum
  veröffentlichten Paket, `upload()` und der Inhaltsvergleich sind
  unveröffentlicht, und die Setter- und TSDoc-Änderungen ändern kein
  dokumentiertes Verhalten.

## Punkte im Volltext

**Queue · `scripts/checkDocSnippets/extractSnippets.mjs:11`** (jetzt `:18`) —
`OPENING_FENCE` nimmt mit `(\s*)` auch eine Zeile mit vier und mehr
Leerzeichen Einrückung als Fence-Anfang; nach CommonMark ist das ein
eingerückter Codeblock (Paket 2) → Scope.

**Folge Paket 1 · `generateDemoPreviews.mjs:92-93` mit
`demoPreviewConfig.mjs:84-89, :105`** — bei einer verweigerten Demo steht »the
old image stays« zweimal in der Ausgabe (Problemzeile und Schlusszeile).

**Folge Paket 2 · `extractSnippets.mjs:79–82`** — Destrukturieren mit
doppeltem Cast umständlich; `quoted[1]`/`quoted[2]` mit einem Cast wie in
`:92–93` reichten.

**Folge Paket 2 (aus Paket 18 übernommen) · `extractSnippets.mjs:8`** —
Kopfkommentar 127 Zeichen, der Absatz ist nicht neu umbrochen.

**Folge Paket 12 · `DynamicAtlas.ts:435`** — `#ensureStaging()` steht vor dem
`try` von `upload()`, ein Wurf dort lässt die Textur unmarkiert und verletzt
»no change is lost«.

**Folge Paket 13 · `cmpAnimationsData.ts:11–20`, `:26`** — die Zykluserkennung
merkt sich je `a` nur einen Partner; Graphen mit Zyklen verschiedener Periode
(`a.x = a` gegen `b1.x = b2, b2.x = b1`) laufen in `RangeError: Maximum call
stack size exceeded`, gegen das Versprechen im Kommentar `:22–23`. Aus JSON
kommt nie ein Zyklus. Abhilfe: `Map<object, Set<object>>`.

**Folge Paket 13 · `TextureResource.ts:434–436` gegen `:1098`, `:1320`** — der
Kommentar sagt, die Setter der Form prüfen das Dispose-Flag; die zwei
`frameBasedAnimationsData`-Setter tun es nicht (ohne Schaden, die Signale sind
nach `dispose()` gelöscht).

**Folge Paket 13 · `TextureResource.ts:761–767` mit `stripInternal`** —
`registerShapeEffects()` fehlt im veröffentlichten d.ts; eine fremde
Unterklasse kompiliert und stürzt in `activate()` ab. Ein Satz im
Klassen-TSDoc, dass die Basis nur die drei Formen der Bibliothek trägt, reicht.

## Urteil des Reviewers

Erfüllung (Reviewer-Report `paket-16.review-0.json`, Fundstellen im Stand 94d00365):

| Punkt | Urteil | Fundstelle |
| --- | --- | --- |
| `OPENING_FENCE` nimmt vier und mehr Leerzeichen (Queue) | behoben | `extractSnippets.mjs:23`, Listen-Stapel `:84`, `:91–98`, `:110–118` |
| `CLOSING_FENCE` schließt bei jeder Einrückung | behoben | `extractSnippets.mjs:24`, `:167–175` |
| »the old image stays« zweimal (Folge Paket 1) | behoben | `demoPreviewConfig.mjs:85`, `:87`; die eine Stelle `:102`; Tests `demoPreviewConfig.test.mjs:154`, `:155`, `:160`, `:179` |
| Doppel-Cast (Folge Paket 2) | behoben | `extractSnippets.mjs:123–124` (`quoted`), `:140–141` (`match`) |
| `#ensureStaging()` vor dem `try` (Folge Paket 12) | behoben | `DynamicAtlas.ts:437–438`; TSDoc und Proposal §3.3 nachgezogen; Test in `DynamicAtlas.spec.ts` |
| Zykluserkennung je `a` ein Partner (Folge Paket 13) | behoben | `cmpAnimationsData.ts:10–25`, Kommentar `:27–29`, Prüfung `:33`; Test in `cmpAnimationsData.spec.ts` |
| Setter ohne Dispose-Prüfung (Folge Paket 13) | behoben | `TextureResource.ts:1103–1104`, `:1328–1329`; Test in `describe('dispose()')` |
| `registerShapeEffects()` fehlt im d.ts (Folge Paket 13) | behoben | Absatz im Klassen-TSDoc `TextureResource.ts:268–270` |
| Kopfkommentar 127 Zeichen (Folge Paket 2, aus Paket 18) | behoben | `extractSnippets.mjs:6–16`; Satz in `AGENTS.md` »Code blocks in Markdown« |

Kleine Befunde (im Plan unter `Folgen:` von Paket 16, für den nächsten Zug 0):

- `extractSnippets.mjs:9` — 91 Zeichen, die Vorgabe des Kopfs ist 90.
- `extractSnippets.mjs:27` — `LIST_ITEM` verlangt `( +|$)` hinter dem Marker; ein Tab (`-\titem`) macht keinen Listenpunkt, eine `ts check`-Fence vier Spalten tief darunter fiele still aus dem Check.
- `extractSnippets.mjs:110` — `LIST_ITEM` nimmt auch Trennlinien (`* * *`, `- - -`) und `1986. text` als Listenpunkt; erhöht nur die Basisspalte (nachsichtiger, nie strenger); der Kommentar `:92–94` nennt nur die Lazy Continuation.
- `extractSnippets.mjs:157`/`:186` — `indent` zählt Tabs als Spalten, das Abziehen entfernt nur Leerzeichen; bei einer tab-eingerückten Fence im Listenpunkt bleibt der Tab in den Codezeilen und die Spalte in `compileSnippets.mjs:80` weicht ab. Entscheidung des Pakets, aber ohne Satz im Kommentar.
