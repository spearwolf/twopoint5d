# Paket 20 — Abschluss: letzte Folgen aus den Paketen 18 und 19

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — Folgen von Paket 18 (11b53b5a) und 19 (05d59dd1), alle info;
  dazu gleicher Ursache `VertexObjectPool.ts:98–101` (Folge von Paket 8, e97f246c) und der
  Linktext in demselben Absatz von `AGENTS.md` (klein aus Paket 19)
- Folge von: Pakete 18, 19
- Ziel: Der Satz in AGENTS.md hat seinen Bezug, und die drei Kommentare sind so umbrochen wie
  die übrigen der Dateien. Was dieses Paket selbst an Anmerkungen hinterlässt, geht ohne
  weitere Runde ins Audit.
- Modell: günstigste Stufe (Transkription: jeder Schritt gibt Datei, Zeilen und den neuen
  Text Zeichen für Zeichen vor, nichts ist zu suchen oder zu entscheiden)
- Effort: low
- Dateien:
  - `AGENTS.md`
  - `packages/twopoint5d/src/display/DisplayFullscreen.ts`
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`
  - `packages/twopoint5d/src/sprites/SpritePicker.ts`
- Vorgehen: siehe »Schritte« unten — sechs Ersetzungen mit vorgegebenem Wortlaut, danach die
  Abnahmeprüfungen, dann das Verify-Kommando
- Verify: `pnpm run ci`
- Commit: `docs: name the peer dependencies of the library in AGENTS.md, and wrap five comments of the library to the width of their files`
- Kein CHANGELOG (keine öffentliche Änderung: AGENTS.md und Kommentare), kein Guide, kein
  Regressionstest (kein Verhalten ändert sich; Beleg für »nur Umbruch« ist Abnahme 1).
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · `AGENTS.md:152` nach `:168–169` gewandert (Paket 19
    hat den Absatz neu umbrochen), Herkunft korrigiert: vorbestehend seit a01acfd1, durch
    Paket 9 verschärft · `DisplayFullscreen.ts:385` (115 Zeichen) unverändert ·
    `VertexObjectPool.ts:563` (103) unverändert · `SpritePicker.ts:420–421` (102/102)
    unverändert, dazu `:396` (104) gleicher Ursache · neu `VertexObjectPool.ts:98–101` (`:99`
    mit 125, Paket 8) und der Linktext `AGENTS.md:173–174` (Paket 19) · »Offene Befunde« leer,
    keine weiteren offenen Folgen
  - 2026-11-18 Zug 1: Implementierer beauftragt, günstigste Stufe (haiku), Effort low
  - 2026-11-18 Zug 2: Report FERTIG · 4 Dateien (AGENTS.md, DisplayFullscreen.ts, VertexObjectPool.ts, SpritePicker.ts) · Abnahmen 1–4 erfüllt · Arbeitsbaum schmutzig · eigener Verify exit=0 (paket-20.verify.log)
  - 2026-11-18 Zug 3: Reviewer (sonnet, low) — alle sechs Schritte erfüllt, keine Befunde · Diff paket-20.diff
  - 2026-11-18 Zug 4: entfällt, nichts offen
  - 2026-11-18 Zug 5: Commit 7a17cf0e, Verify exit=0 aus Zug 2 (keine Änderung seither)

## Urteil des Reviewers

- Schritt 1 `AGENTS.md:168–175` behoben · Schritt 2 `DisplayFullscreen.ts:385–387` behoben ·
  Schritt 3 `VertexObjectPool.ts:98–101` behoben · Schritt 4 `VertexObjectPool.ts:563–564` behoben ·
  Schritt 5 `SpritePicker.ts:396–397` behoben · Schritt 6 `SpritePicker.ts:420–422` behoben
- Kleine Befunde: keine
- Anmerkung des Implementierers, kein Befund: die Heap-Probe `vertex-objects-heap` zeigt unter
  Firefox/WebKit 7,6 % Wachstum über sechs Samples, der Test ist grün (innerhalb seiner Schwelle)

## Abgleich in Zug 0 (gegen HEAD 05d59dd1)

- **`AGENTS.md:152` → `:168–169`.** Der Satz »The four are peer dependencies of the library;
  `@types/three` is an optional one …« steht im Listenpunkt »Shared dependency versions«
  (`:164–174`) direkt hinter der Liste der Katalog-Werkzeuge `typescript`, `rimraf`,
  `@types/node`, `playwright`, `vitest`, `@vitest/coverage-v8` — sechs Werkzeuge, keins davon
  eine Peer Dependency. Gemeint sind die vier aus dem ersten Satz des Punkts (`three`,
  `@types/three`, `@spearwolf/eventize`, `@spearwolf/signalize`), die genau die
  `peerDependencies` sind (`packages/twopoint5d/package.json:73–82`, `@types/three` optional).
  Herkunft, anders als die Folgen-Zeile von Paket 19 sagt: der Satz steht schon in
  `git show 2e3f585b:AGENTS.md:152`, damals hinter einer Liste von genau vier Werkzeugen
  (`typescript`, `rimraf`, `@types/node`, `playwright`, eingefügt mit a01acfd1 am 2026-10-31,
  vor dem Lauf) und dadurch schon irreführend; Paket 9 (4cf5fc5e) hat `vitest` und
  `@vitest/coverage-v8` angehängt, seither hat »the four« gar keinen Bezug. Behoben wird es
  hier, die Einordnung ändert daran nichts.
- **Linktext in demselben Absatz** (`AGENTS.md:173–174`): `[monorepo architecture` / `§5](…)`
  ist über zwei Zeilen gebrochen (klein aus der Ergebniszeile von Paket 19). Wird mitgenommen,
  weil Schritt 1 den Absatz ohnehin neu umbricht: ohne Umformulierung lässt jeder Umbruch auf
  90 Zeichen entweder den Linktext gebrochen oder eine Bruchzeile »bump are in« vor dem Link
  stehen (der Link ist 80 Zeichen lang). Der letzte Satz beginnt deshalb mit dem Link.
- **`DisplayFullscreen.ts`, TSDoc des Getters `onLandscape`**, zweiter Absatz `:383–387`:
  unverändert. `:384–385` stammen aus Paket 18, `:385` hat 115 Zeichen (Paket 18 nannte 116).
- **`VertexObjectPool.ts`, TSDoc von `releaseSortScratch()`**, letzter Absatz `:563–564`:
  unverändert, `:563` mit 103 Zeichen, beide Zeilen aus Paket 18.
- **`SpritePicker.ts`, Kommentar im `finally` von `#place()`** `:420–422`: unverändert, 102
  und 102 Zeichen. Gleicher Ursache `:396–397` (104 Zeichen): Paket 18 hat mit dem `try` auch
  diesen Kommentar um zwei Spalten eingerückt (`git show 11b53b5a^:…/SpritePicker.ts:395–396`
  stand mit 4 Leerzeichen Einzug in 100 Zeichen). Die »103/105« der Reviewer-Notiz von
  Paket 18 meinen diese beiden Kommentare.
- **Neu, gleicher Ursache: `VertexObjectPool.ts:98–101`** (Kommentar über den Sortier-Feldern):
  `:99` hat 125 Zeichen. Paket 8 (e97f246c) hat »releaseSortScratch() and« eingefügt, ohne den
  Absatz neu zu umbrechen (`git show 2e3f585b:…/VertexObjectPool.ts:92–95`: 101/100/101/53
  Zeichen). Folge von Paket 8, Symptom derselben Ursache wie die Stellen aus Paket 18 (Absatz
  nach einer Einfügung nicht neu umbrochen); übernommen, weil es eine Datei dieses Pakets ist
  und in den drei Dateien die einzige Zeile eines mehrzeiligen Kommentars, die über das
  hinausgeht, was der Altbestand derselben Datei trägt (dort bis 103 in `VertexObjectPool.ts`,
  106 in `DisplayFullscreen.ts`, 108 in `SpritePicker.ts`).

### Kein Befund, mit Grund

- **Die übrigen Kommentarzeilen über 100 Zeichen in den drei Dateien** (laut `git blame`
  Altbestand oder aus den Paketen 7, 8 und 10, mehrzeilige Kommentare bei 101–103,
  einzeilige TSDoc `/** … */` bis 114) bleiben, wie sie sind. Das Projekt hat keine
  Breitenregel für Kommentare: Biome bricht sie nicht um (`biome.jsonc:33`, `lineWidth: 130`
  gilt dem Code), AGENTS.md nennt keine, und repo-weit tragen 1 655 Kommentarzeilen aus der
  Zeit vor dem Lauf mehr als 100 Zeichen, 203 davon mehr als 110 (Zählung in Zug 0 per
  `git blame` über alle getrackten `.ts`/`.js`/`.mjs`/`.astro` unter `packages/`,
  `apps/lookbook/src/`, `scripts/`, ohne `biome-ignore`-Zeilen). Die Zeilen dieses Laufs liegen
  in derselben Spanne wie der Altbestand ihrer Datei; ein Umbruch wäre Diff ohne Befund. Die
  Breite 100 dieses Pakets ist die Regel, die Paket 18 für seine eigenen Absätze gesetzt und
  Paket 19 für TSDoc in Quelltexten angewandt hat — sie gilt den Absätzen, die diese Pakete
  geschrieben haben, nicht der ganzen Datei.
- **Repo-weit:** aus den Commits dieses Laufs stammen 229 Kommentarzeilen über 100 Zeichen,
  42 davon über 110. Aus demselben Grund kein Befund und keine Folge; nach der Entscheidung
  vom 2026-11-18 schließt die Folgen-Kette mit diesem Paket.

### Triage

- »Offene Befunde« im Plan: alle Einträge `[x]`, nichts offen.
- `Folgen:`-Zeilen erledigter Pakete: offen waren nur die von Paket 19, sie sind dieses Paket.
  Die zwei `Folgen:` von Paket 18 hat Paket 19 übernommen und behoben; alle älteren Pakete
  stehen auf »keine« oder sind verteilt.
- Generation: Paket 20 folgt aus 18 und 19, die ihrerseits Folgen der Pakete 1–17 sind. Die
  Entscheidung vom 2026-11-18 (»Die Folgen-Kette endet mit Paket 20 …«) regelt das: was
  dieses Paket hinterlässt, geht ohne weitere Runde ins Audit.

### Restplan

Paket 20 ist das letzte Paket vor dem Abschluss. Keine Änderung an Reihenfolge oder Schnitt.

## Schritte

Jeder Schritt ersetzt die genannten Zeilen durch genau den Text im Block darunter — Zeichen für
Zeichen, Einzug eingeschlossen, ohne Leerzeichen am Zeilenende. Die Blöcke enthalten Zeichen
außerhalb von ASCII (`—` U+2014, `§` U+00A7); sie bleiben so stehen. Die Zeilen in den
TS-Dateien behalten ihre Zahl, in `AGENTS.md` wird aus sieben Zeilen acht. Die Wörter der
TS-Kommentare ändern sich nicht, nur die Stellen der Zeilenumbrüche. Nichts außerhalb der
genannten Zeilen ändert sich.

### 1. `AGENTS.md:168–174` → acht Zeilen

Vorher (`:168–174`, Zeile `:167` endet mit »`@types/node`,« und bleibt byte-gleich, ebenso
`:164–166` und ab `:175` »- **Each package declares what it uses.** …«):

```text
  `playwright`, `vitest`, `@vitest/coverage-v8` —, likewise to be raised only there. The
  four are peer dependencies of the library; `@types/three` is an optional one (only a
  TypeScript consumer needs it). The catalog range lands verbatim in the published
  manifest, and a 0.x minor of `three` breaks, so `three` stays on the tilde — and every
  `three` bump is a release: until the library publishes, a consumer on the newer `three`
  meets a peer conflict. The steps of a bump are in [monorepo architecture
  §5](docs/architecture.md#5-shared-dependency-versions).
```

Nachher:

```text
  `playwright`, `vitest`, `@vitest/coverage-v8` —, likewise to be raised only there.
  `three`, `@spearwolf/eventize` and `@spearwolf/signalize` are peer dependencies of the
  library; `@types/three` is an optional one (only a TypeScript consumer needs it). The
  catalog range lands verbatim in the published manifest, and a 0.x minor of `three`
  breaks, so `three` stays on the tilde — and every `three` bump is a release: until the
  library publishes, a consumer on the newer `three` meets a peer conflict.
  [Monorepo architecture §5](docs/architecture.md#5-shared-dependency-versions) lists the
  steps of a bump.
```

Wortänderungen, sonst nur Umbruch: »The four« → »`three`, `@spearwolf/eventize` and
`@spearwolf/signalize`« (die drei Pflicht-Peers beim Namen; `@types/three` nennt der Satz danach
als optionalen) und »The steps of a bump are in [monorepo architecture §5](…).« →
»[Monorepo architecture §5](…) lists the steps of a bump.« (Linktext ganz, siehe Abgleich).
Breite 90 wie der Rest der Datei.

### 2. `packages/twopoint5d/src/display/DisplayFullscreen.ts:385–387`

TSDoc des Getters `onLandscape`, zweiter Absatz. `:383` (»Switched on while the browser …«)
und `:384` (»is in — or enters the pseudo mode, …«) bleiben byte-gleich. Vorher:

```text
   * `fallback` is `'pseudo'` — where the screen is still landscape, the target out of fullscreen, no other element
   * in fullscreen and no newer request or exit under way: a `request()` of the page called on that
   * answer decides with its own, and its refusal arms nothing.
```

Nachher:

```text
   * `fallback` is `'pseudo'` — where the screen is still landscape, the target out of fullscreen,
   * no other element in fullscreen and no newer request or exit under way: a `request()` of the
   * page called on that answer decides with its own, and its refusal arms nothing.
```

### 3. `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:98–101`

Kommentar über den Feldern `#sortKeys` … (`:102` ff. bleiben). Vorher:

```text
  // the scratch of sortBy(), sortByKeys() and prepareSortKeys(), built by the first sort, grown with
  // the capacity and let go of by releaseSortScratch() and dispose(): the keys, the order of the slots and the merge scratch
  // of the sort, the vertex objects on their way to a new slot, and one buffer for the copy of every
  // attribute buffer with a view of it per data type
```

Nachher:

```text
  // the scratch of sortBy(), sortByKeys() and prepareSortKeys(), built by the first sort, grown
  // with the capacity and let go of by releaseSortScratch() and dispose(): the keys, the order of
  // the slots and the merge scratch of the sort, the vertex objects on their way to a new slot, and
  // one buffer for the copy of every attribute buffer with a view of it per data type
```

### 4. `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:563–564`

TSDoc von `releaseSortScratch()`, letzter Absatz; `:565` (` */`) bleibt. Vorher:

```text
   * Does nothing on a pool that has not sorted and on a disposed pool. Called from the key function of
   * a running {@link sortBy}, it makes that sort throw.
```

Nachher:

```text
   * Does nothing on a pool that has not sorted and on a disposed pool. Called from the key function
   * of a running {@link sortBy}, it makes that sort throw.
```

### 5. `packages/twopoint5d/src/sprites/SpritePicker.ts:396–397`

Kommentar in `#place()` über der ersten `for`-Schleife. Vorher:

```text
      // a mirror of a ClippingGroup that no longer clips the sprites leaves the chain, so that it hangs
      // empty under none of the mirrors kept
```

Nachher:

```text
      // a mirror of a ClippingGroup that no longer clips the sprites leaves the chain, so that it
      // hangs empty under none of the mirrors kept
```

### 6. `packages/twopoint5d/src/sprites/SpritePicker.ts:420–422`

Kommentar im `finally` von `#place()`; `:423` (`applied.length = 0;`) bleibt. Vorher:

```text
      // the scratch lets go of the groups it was filled with: a group holds the sprites below it, and
      // up to the next pick the scratch would hold a mesh dropped along with its group — also where a
      // step of the placement throws
```

Nachher:

```text
      // the scratch lets go of the groups it was filled with: a group holds the sprites below it,
      // and up to the next pick the scratch would hold a mesh dropped along with its group — also
      // where a step of the placement throws
```

## Abnahmeprüfungen (vor `pnpm run ci`, Ausgabe in den Report)

1. Nur Umbruch in den drei TS-Dateien — jede Datei muss »nur Umbruch« melden:

   ```bash
   for f in packages/twopoint5d/src/display/DisplayFullscreen.ts packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts packages/twopoint5d/src/sprites/SpritePicker.ts; do
     if diff <(git show "HEAD:$f" | sed -E 's#^[[:space:]]*(//|\*)##' | tr -s '[:space:]' '\n') <(sed -E 's#^[[:space:]]*(//|\*)##' "$f" | tr -s '[:space:]' '\n') > /dev/null; then echo "$f: nur Umbruch"; else echo "$f: WORTE GEÄNDERT"; fi
   done
   ```

2. Umfang — genau diese Zahlen (hinzugefügt, entfernt, Datei):

   ```bash
   git diff --numstat -- AGENTS.md packages/twopoint5d/src
   ```

   erwartet: `8 7 AGENTS.md`, `3 3 …/DisplayFullscreen.ts`, `5 5 …/SpritePicker.ts`,
   `6 6 …/VertexObjectPool.ts`, sonst keine Datei.

3. Breite — keine Ausgabe:

   ```bash
   for spec in AGENTS.md:90 packages/twopoint5d/src/display/DisplayFullscreen.ts:100 packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:100 packages/twopoint5d/src/sprites/SpritePicker.ts:100; do
     f=${spec%:*}; w=${spec#*:}
     git diff -U0 -- "$f" | grep '^+[^+]' | awk -v w="$w" -v f="$f" 'length($0) - 1 > w {print f ": " length($0) - 1}'
   done
   ```

4. `git diff --word-diff=plain -- AGENTS.md` zeigt genau die zwei Wortänderungen aus Schritt 1.

## Findings im Volltext

Die Befunde dieses Pakets sind Anmerkungen von Reviewern, ohne Finding-ID. Wortlaut aus dem
Plan und den Paketdateien der Pakete, die sie gemeldet haben:

- **Paket 19, `Folgen:`** — »`AGENTS.md:152` — ›The four are peer dependencies …‹ folgt direkt
  auf die Katalog-Werkzeugliste, ›the four‹ ist ohne Bezug; der Satz fehlt in
  `git show 2e3f585b:AGENTS.md`, stammt also aus diesem Lauf (vom Reviewer von 19 gemeldet,
  nicht von 19 verursacht) · die drei Kommentarstellen über 100 Zeichen (`DisplayFullscreen.ts`,
  `releaseSortScratch()`, `finally` in `SpritePicker#place()`), die die Paketdatei dem Nutzer
  überlässt, bleiben unverändert« — zur Herkunft siehe Abgleich: der Satz steht schon im
  Basisstand.
- **Paket 18, »Kleine Befunde«** (`docs/remediation/paket-18.md`):
  - »`display/DisplayFullscreen.ts`, TSDoc von `onLandscape`: eine Zeile mit 116 Zeichen,
    Absatz nicht neu auf ~100 umbrochen (unter dem Limit 130)«
  - »`vertex-objects/VertexObjectPool.ts`, TSDoc von `releaseSortScratch()`: Zeile mit 104
    Zeichen; dazu die `finally`-Kommentare in `SpritePicker.ts` (103/105 Zeichen, eine
    Einrückung durch das `try`)«
  - Regel aus dem Detailplan von Paket 18: »Wo dieser Plan ›umbrechen‹ sagt: Absatz neu auf
    höchstens 100 Zeichen, wie die Nachbarn, Wörter unverändert, sofern der Schritt keinen
    neuen Wortlaut vorgibt.«
- **Paket 19, Ergebniszeile, klein** — »Linktext `[monorepo architecture §5](…)` in `AGENTS.md`
  über zwei Zeilen umbrochen«.
- **Entscheidung vom 2026-11-18 (Plan)** — »Die Folgen-Kette endet mit Paket 20: die vier
  trivialen Stellen aus den Paketen 18 und 19 werden noch behoben, weil das Ziel ein Release
  ohne offenes Finding ist; was Paket 20 selbst hinterlässt, geht ohne weitere Runde ins
  Audit.«
