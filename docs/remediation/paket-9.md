# Paket 9 — CHANGELOG

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des Laufs, hier die
Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: DOC-061 (low), DOC-038 (low), DOC-039 (low), DOC-040 (info), DOC-071 (info),
  CONS-047 (info)
- Dazu (Folge aus Paket 2, verteilt in Zug 0 Paket 3): `CHANGELOG.md` heute `:915` —
  »(see the next section)« hängt an der Reihenfolge der H4
- Dazu (aus der Queue, Zug 0 Paket 9): `CHANGELOG.md:188–190` »see the migration guide« klein
  — gleiche Ursache wie die Folge aus Paket 2 (die Einträge verweisen in uneinheitlicher Form
  auf den Migration Guide); es sind neun Stellen, nicht drei
- Dazu (Zug 0, gleiche Ursache, vorbestehend): `CHANGELOG.md:182` (`VOBufferPool#buffer`,
  vierte Accessor-Stelle wie DOC-038, widerspricht zudem `:242`) · `PanControl2D.ts:643`
  (Code-Kommentar mit derselben ungenauen Vorrangregel wie DOC-039)
- Dazu (»Paket 9 glättet« aus Paket 1, 2, 5, 6, 7, 10, in Zug 0 konkretisiert): drei Einträge
  dieses Laufs mit eigenem H4 bekommen den Verweis auf den Migration Guide, der auf vier
  Änderungen angewachsene Fixed-Eintrag `:346` wird geteilt, der H4 zu `@types/three` rückt zu
  den anderen Peer-H4
- Ziel: Der Unreleased-Block sagt, dass seine Ansammlung beabsichtigt ist, und seine Einträge
  zu Accessor-Paaren, `keys`/`keyCodes`, Pointer-Handling, `loadAsync()` und `dispose()` sind
  präzise und eindeutig.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/CHANGELOG.md` (nur der Block `## [Unreleased]`, heute
  `:8–3614`), `packages/twopoint5d/src/stage/Stage2D.ts` (TSDoc von `dispose()`, heute
  `:422–437`), `packages/twopoint5d/src/controls/PanControl2D.ts` (Kommentar in
  `#speedFieldFor()`, heute `:641–643`)
- Verify: `pnpm run ci`, dazu die acht Proben unter »Verify« unten

## Rahmen für den Implementierer

- **Freigabe.** Jede Umformulierung unten ist durch den freigegebenen Plan gedeckt (Paket 9,
  Scope-Regel des Laufs, Entscheidung vom 2026-09-30 zum Kopf des Unreleased-Blocks). Die rote
  Flagge »reword an existing `[Unreleased]` bullet → ask first« im Skill `updating-changelog`
  ist damit beantwortet — nicht nachfragen. Umformuliert wird genau, was unten steht, und
  sonst kein Eintrag, auch kein offensichtlich verbesserbarer.
- **Released sections sind tabu.** Ab `## [0.21.2] - 2026-06-19` (heute `:3615`) bis zum
  Dateiende ändert sich kein Byte.
- **Bullets bleiben einzeilig.** Jeder Bullet im Unreleased-Block ist eine einzige Zeile,
  gleich wie lang; das bleibt so (der Dateistil gewinnt hier über die Umbruchregel des Laufs).
  Neue oder geänderte Prosa außerhalb von Bullets (Kopfabsatz, H4-Text) und die Kommentare in
  den beiden `.ts`-Dateien brechen bei höchstens 90 Zeichen um, in Zeichen gezählt
  (`perl -CSD`, nicht macOS-awk).
- **Zeilennummern sind Stand heute** und verschieben sich mit jedem Schritt. Gesucht wird über
  den zitierten Text; jedes zitierte Stück kommt im Block genau einmal vor.
- Englisch, Stil der Datei. Keine Finding-IDs, kein neuer CHANGELOG-Eintrag über diese
  Glättung selbst.

## Vorgehen

1. **Kopfabsatz des Unreleased-Blocks.** Zwischen `## [Unreleased]` und `### Added` steht heute
   nur eine Leerzeile. Danach steht dort, mit je einer Leerzeile davor und dahinter, genau
   dieser Absatz:

   ```markdown
   The changes in this block are held back on purpose, to go out together in one release:
   many of them break the API, and the Migration Guide at the end of this block walks a
   project through all of them in one upgrade.
   ```

   Keine Versionsnummer, kein Datum (die Version im Manifest bleibt 0.21.2, kein Bump — so
   entschieden).

2. **Accessor-Paare: der Unterklassen-Halbsatz.** Vorbild ist `:221`
   (`Map2DTileStreamer#visibilitor`), das bleibt unverändert. Drei Bullets bekommen am Ende
   einen Satz angehängt, beim vierten wird der Schlusssatz ersetzt. Jeweils alt → neu, das
   alte Stück ist das Bullet-Ende:
   - `:184` (Changed, »a disposed `StageRenderer` builds no further `RenderTarget`«):

     ```text
     alt: `pipeline` is an accessor pair on the prototype now; reading and writing it on a live renderer is unchanged
     neu: `pipeline` is an accessor pair on the prototype now; reading and writing it on a live renderer is unchanged. A subclass that declares `pipeline` as a field does not compile (TS2610) and overrides the accessor pair instead
     ```

   - `:218` (Changed):

     ```text
     alt: - `StageRenderer#buildOutputNode` is an accessor pair on the prototype; reading and writing it on a live renderer is unchanged
     neu: - `StageRenderer#buildOutputNode` is an accessor pair on the prototype; reading and writing it on a live renderer is unchanged. A subclass that declares `buildOutputNode` as a field does not compile (TS2610) and overrides the accessor pair instead
     ```

   - `:227` (Changed, »`FixedFrameLoop` ignores an `fps` or `maxStepsPerFrame` …«):

     ```text
     alt: and the loop starts at 60 fps and 5 steps per frame. `maxStepsPerFrame` is an accessor pair on the prototype
     neu: and the loop starts at 60 fps and 5 steps per frame. `maxStepsPerFrame` is an accessor pair on the prototype. A subclass that declares `maxStepsPerFrame` as a field does not compile (TS2610) and overrides the accessor pair instead
     ```

   - `:182` (Changed, »a disposed `VOBufferPool` hands out nothing …«):

     ```text
     alt: `buffer` is an accessor pair on the prototype now; reading and writing it on a live pool is unchanged
     neu: `buffer` is an accessor on the prototype, read-only in the published types; a subclass that declares `buffer` as a field does not compile (TS2610)
     ```

     Grund: der Setter ist `@internal` (`VOBufferPool.ts:83`), die Root-tsconfig setzt
     `stripInternal: true`, `dist/lib/vertex-objects/VOBufferPool.d.ts:36` trägt nur
     `get buffer()`, und `:242` sagt bereits »read-only in the published types«; »reading and
     writing … is unchanged« stimmt für Konsumenten nicht. Kein Rat zum Überschreiben: ein
     Getter allein in der Unterklasse verdeckte den internen Setter, den
     `VertexObjectPool#resize()` braucht.

   Geprüft in Zug 0: diese fünf sind alle Zeilen mit »accessor pair« im Block; `fps` war schon
   in 0.21.2 ein Accessor (62174770), `Map2D#visibilitor` ebenso — beide bleiben außen vor.

3. **Vorrang `keys` vor `keyCodes`.**
   - `CHANGELOG.md:321` (Deprecated), Bullet-Ende:

     ```text
     alt: a `keyCodes` passed in or rebound in place keeps working, and `keys` wins where both are set
     neu: a `keyCodes` passed in or rebound in place keeps working, and `keys` wins wherever it differs from its default
     ```

   - `PanControl2D.ts:641–643`, die drei Kommentarzeilen über `const index =` in
     `#speedFieldFor()`, werden zu genau diesen vier (Einrückung 4 Leerzeichen, alle ≤ 90):

     ```ts
         // keyCodes is deprecated and only decides when a caller set it. That is read off the
         // values, not a flag: the field is public and holds an array of its own, so a
         // keyCodes[0] = 38 rebinds in place and has to keep working. Whoever sets keys to
         // anything but its default gets keys, whatever keyCodes holds
     ```

     Grund: `holdsDefault(this.keys, DEFAULT_KEYS) && !holdsDefault(this.keyCodes, …)`
     (`:645`) — wer `keys` ausdrücklich auf den Default setzt, bekommt `keyCodes`, sobald das
     abweicht. Code ändert sich nicht.

4. **Der Cursor am Ende des Drags.** `CHANGELOG.md:461` (Fixed, »fix the pointer handling of
   `PanControl2D`«), Bullet-Ende:

   ```text
   alt: also while another button stays down, and the cursor comes back with it
   neu: also while another button stays down, and the cursor comes back as the drag ends
   ```

   Abweichung von der Empfehlung (»as the pan ends«): der Satz nennt den Maus-Drag als das,
   was endet, und der Code gibt den Cursor zurück, sobald kein Maus-Pointer mehr unten ist
   (`#restoreCursorUnlessMouseDown()`, `PanControl2D.ts:579–588`) — nicht am Ende eines Pans,
   den auch Tasten oder ein Touch tragen.

5. **`loadAsync()` und die Fehlschläge, die rejecten.** `CHANGELOG.md:57` (Added,
   `TextureStore#loadAsync()`):

   ```text
   alt: An `error` listener that throws while it hears one of the failures above does not change how the promise settles
   neu: An `error` listener that throws while it hears one of the four failures that reject does not change how the promise settles
   ```

   Die TSDoc (`TextureStore.ts:458–463`) ist schon eindeutig und bleibt.

6. **Was ein disposter `Stage2D` behält und was er noch annimmt.**
   - `CHANGELOG.md:39` (Added, `Stage2D#dispose()`); der Satz danach (»The rules behind this
     are written down in …«) bleibt:

     ```text
     alt: and a second `dispose()` do nothing; `scene`, `camera`, `projection`, `containerWidth`, `containerHeight`, `width`, `height` and `name` keep the values the stage was left with, and `name`, `needsUpdate`, `isFirstFrame` and `scene` still take new ones — a write to `scene` goes through and has no effect, since the stage no longer builds a node from it.
     neu: and a second `dispose()` do nothing. Nothing is reset: `scene`, `camera`, `projection`, `containerWidth`, `containerHeight`, `width`, `height`, `name`, `needsUpdate` and `isFirstFrame` answer with the values the stage was left with. Of these, `scene`, `name`, `needsUpdate` and `isFirstFrame` still take new ones — a write to `scene` goes through and has no effect, since the stage no longer builds a node from it.
     ```

   - `Stage2D.ts`, TSDoc von `dispose()`: der dritte Absatz, von »Afterwards `isDisposed` is
     `true`« bis »… when more than one listener threw.« (heute `:422–437`, direkt vor ` */`),
     wird durch genau diese Zeilen ersetzt — Wortlaut außerhalb der beiden neuen Sätze
     unverändert, neu umbrochen auf ≤ 90:

     ```ts
        * Afterwards `isDisposed` is `true` and {@link asPassNode} throws an error naming the
        * class and the state. `renderTo()`, `updateFrame()`, `resize()`, `updateProjection()`
        * and a write to `projection` or `camera` do nothing, and so does a further
        * `dispose()`. The plain state no longer drives anything, and `dispose()` resets none
        * of it: `scene`, `camera`, `projection`, `containerWidth`, `containerHeight`,
        * `width`, `height`, `name`, `needsUpdate` and `isFirstFrame` answer with the values
        * the stage was left with. Of these, `scene`, `name`, `needsUpdate` and `isFirstFrame`
        * still take new ones. A write to `scene` goes through and has no effect, since the
        * stage no longer builds a node from it, and announces nothing — no
        * `OnStageAfterSceneChanged`. `name` writes through to `scene.name` as it always does,
        * and so reaches the scene the caller may have handed in. An `OnStageDispose` goes out
        * to every subscriber before this stage stops listening; no event follows it. A
        * listener of `OnStageDispose` that throws does not hold up the teardown: every
        * subscriber hears the event, the instance is torn down completely, and the error
        * reaches the caller afterwards — one unchanged, several as an `AggregateError`. An
        * error from releasing the pass node reaches the caller as well: on its own unchanged,
        * together with that of the listeners as an `AggregateError` of the error of the
        * listeners and that of the release, in this order — the first an `AggregateError`
        * itself when more than one listener threw.
     ```

     (Einrückung wie im Bestand: drei Leerzeichen vor `*`.) Grund: der Satz »The plain state
     stays readable and writable« stimmt nicht für `camera` und `projection` (ihre Setter
     kehren nach `dispose()` sofort zurück, `Stage2D.ts:130`, `:175`), und die beiden
     Aufzählungen überschnitten sich in `scene` und `name`. Die Teilung: erst alle zehn, die
     nichts zurücksetzt, dann die vier davon, die noch schreiben lassen. `needsUpdate` und
     `isFirstFrame` gehören in die erste Liste, weil `dispose()` sie ebenfalls nicht anfasst.

7. **Verweise auf den Migration Guide in einer Form.** Die Form ist `. See the Migration Guide`
   am Ende des Bullets (27 der 36 Verweise im Block; die Überschrift heißt `### Migration
   Guide`).
   - Neun Bullets enden heute auf ` — see the migration guide`: `:188`, `:189`, `:190`, `:249`,
     `:250`, `:306`, `:307`, `:310`, `:339`. Bei jedem wird ` — see the migration guide` durch
     `. See the Migration Guide` ersetzt, sonst nichts.
   - Drei Einträge dieses Laufs haben einen H4 und verweisen nicht darauf; sie bekommen am
     Bullet-Ende `. See the Migration Guide` angehängt:
     - `:78` (Added) »- add `@types/three` as an optional peer dependency (`~0.185.4`): … a
       JavaScript consumer installs nothing« (H4 »`@types/three` is an optional peer
       dependency«)
     - `:209` (Changed) »- `Dependencies` is generic over the shape it watches: … so it only
       made the state look like it watched something it does not« (H4 »Inline callbacks in a
       `Dependencies` with several keys need parameter types«)
     - `:414` (Fixed) »- fix `PanControl2D#dispose()`: … and no `update` event goes out« (H4
       »A disposed `PanControl2D` moves its view no further«)
   - Im H4 »`DependencyProp` is gone« (heute `:913–915`) werden die letzten beiden Zeilen

     ```markdown
     an entry against the shape wherever it can read it, and the callbacks of an entry
     against the value type of its key (see the next section).
     ```

     zu

     ```markdown
     an entry against the shape wherever it can read it, and the callbacks of an entry
     against the value type of its key — see "Inline callbacks in a `Dependencies` with
     several keys need parameter types".
     ```

     Ohne »below« und ohne Anker-Link: der Verweis trägt, wo immer der H4 steht, und die Datei
     verlinkt nirgends auf eigene Überschriften.

8. **Den Fixed-Eintrag `:346` teilen.** Er beginnt mit »- fix `StageRenderer` for a listener of
   `OnStageAdded`, `OnStageRemoved`, `OnAddToParent` or `OnRemoveFromParent` that throws:«.
   Er endet künftig nach »… no disposed renderer is wired into a host or takes a stage«. Die
   beiden Sätze dahinter (aus Paket 6 und Paket 10) werden ein eigener Bullet direkt darunter,
   genau so:

   ```markdown
   - fix `StageRenderer` leaving a host: the host lets go of the renderer before the first listener of `OnRemoveFromParent` hears of the move, so a listener that disposes the renderer there leaves no frame loop driving it, wherever it stands among the listeners. An unsubscribe of that host that throws does not keep the renderer from giving up its other subscription there, and its error reaches the caller with those of the listeners
   ```

   Grund: Skill `updating-changelog`, »One giant multi-paragraph bullet → split into one bullet
   per discrete change«; das Abmelden vom Host ist eine eigene Änderung, die Paket 6 und 10 an
   den Listener-Eintrag angehängt haben.

9. **Den H4 zu `@types/three` zu den Peer-H4 stellen.** Der Block von
   `#### `@types/three` is an optional peer dependency` bis einschließlich der schließenden
   ```` ``` ```` des **After**-JSON und der Leerzeile danach (heute `:3591–3614`, der letzte
   Block vor `## [0.21.2]`) wandert unverändert hinter den H4 »`@spearwolf/eventize` and
   `@spearwolf/signalize` peer dependency ranges«, also direkt vor
   `#### `VertexObjectPool#onDestroyVO` is gone` (heute `:1536`). Danach steht vor
   `## [0.21.2] - 2026-06-19` die schließende ```` ``` ```` des `getZoom()`-H4 und eine
   Leerzeile. Grund: die drei Peer-Migrationen (`three`, `eventize`/`signalize`,
   `@types/three`) stehen dann beieinander, wo ein Konsument beim Upgrade der Peers sucht.

10. **Geprüft in Zug 0, nichts zu tun:** Removed-Eintrag und H4 aus Paket 7 (`:342` verweist
    schon, H4 `:970`), `.d.ts`-Eintrag aus Paket 1 (`:314`), `null`-Option aus Paket 2
    (`:315`), Added-Einträge zu `coordsTarget` und den `on…()`-Helfern und der perf-Eintrag
    aus Paket 5 (`:29`, `:76`, `:316`), `TextureStore#loadAsync()`-TSDoc. Diese bleiben, wie
    sie sind.

## Verify

```bash
pnpm run ci
```

Dazu die Proben (Erwartung jeweils im Kommentar; B hält sie im Verify-Log fest):

```bash
C=packages/twopoint5d/CHANGELOG.md
U() { sed -n '/^## \[Unreleased\]/,/^## \[0.21.2\]/p' "$C"; }
# 1 released sections unverändert → keine Ausgabe
diff <(git show HEAD:"$C" | sed -n '/^## \[0\.21\.2\]/,$p') <(sed -n '/^## \[0\.21\.2\]/,$p' "$C")
# 2 Verweise → 0 · 39 · 0
U | grep -c 'see the migration guide'; U | grep -c 'See the Migration Guide'; U | grep -c 'see the next section'
# 3 Accessor-Paare → keine Ausgabe · 7
U | awk '/accessor pair/ && !/TS2610/'; U | grep -c 'TS2610'
# 4 Bullets 511 (vorher 510) · H4 130 (unverändert) · keine Fortsetzungszeile unter einem Bullet
sed -n '/^## \[Unreleased\]/,/^### Migration Guide/p' "$C" | grep -c '^- '
U | grep -c '^#### '
sed -n '/^## \[Unreleased\]/,/^### Migration Guide/p' "$C" | awk 'prev ~ /^- / && /^ +[^ ]/ {print NR": "$0} {prev=$0}'
# 5 Reihenfolge → eventize/signalize-H4, dann @types/three, dann onDestroyVO
U | grep '^#### ' | grep -n 'peer dependency ranges\|optional peer dependency\|onDestroyVO'
# 6 Breiten → keine Ausgabe
git diff -U0 -- packages/twopoint5d/src | grep '^+[^+]' | perl -CSD -ne 'chomp; print "$_\n" if length($_) > 91'
sed -n '/^## \[Unreleased\]/,/^### Added/p' "$C" | perl -CSD -ne 'chomp; print "$_\n" if length($_) > 90'
# 7 alte Wortlaute weg → keine Ausgabe
U | grep -n 'wins where both are set\|comes back with it\|one of the failures above\|and `name` keep the values'
grep -n 'Whoever sets keys as well\|stays readable and writable' packages/twopoint5d/src/controls/PanControl2D.ts packages/twopoint5d/src/stage/Stage2D.ts
# 8 Umfang → genau diese drei Dateien
git diff --name-only
```

- Commit: `docs(twopoint5d): say at the head of the unreleased changes that they are held back for one release, tell in each entry on an accessor pair that a subclass declaring it as a field does not compile, give the rule by which keys wins over keyCodes, the end of the drag as the moment the cursor comes back and the four failures of loadAsync() that reject, tell what a disposed Stage2D keeps apart from what it still takes, point to the Migration Guide in one form from every entry that has a section there and to the section on inline Dependencies callbacks by its name, give the StageRenderer that leaves a host an entry of its own, and set the migration of @types/three beside the other peer dependencies`
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · DOC-061 unverändert (Unreleased `:8–3614` statt
    `:8–2855`, Manifest weiter 0.21.2) · DOC-038 verschoben nach `:184`, `:218`, `:227`
    (Vorbild `:221`), dazu `:182` gleiche Ursache · DOC-039 verschoben nach `:321`, dazu
    `PanControl2D.ts:643` · DOC-040 verschoben nach `:461` · DOC-071 verschoben nach `:57` ·
    CONS-047 verschoben nach `:39` und `Stage2D.ts:422–437` · Folge aus Paket 2 jetzt `:915`,
    hier · Queue `CHANGELOG.md:188–190` hierher (neun Stellen) · »glättet« aus Paket 1, 2, 5,
    6, 7, 10 als Schritte 7–10 konkretisiert · übrige Queue-Einträge: keine gleiche Ursache ·
    Restplan: Paket 9 ist das letzte offene, keine Umsortierung
  - 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach
    `paket-9.impl-0.json`
  - 2026-09-30 Zug 2: Report FERTIG · `CHANGELOG.md`, `Stage2D.ts`, `PanControl2D.ts` ·
    Arbeitsbaum schmutzig · Verify `pnpm run ci` + acht Proben exit=0
  - 2026-09-30 Zug 3: Reviewer (sonnet, low): alle Findings behoben, keine kritischen/wichtigen
    Befunde, zwei kleine · Diff `paket-9.diff`
  - 2026-09-30 Zug 4: keine Runde nötig
  - 2026-09-30 Zug 5: Commit f2772ec3, Verify-Log `paket-9.verify.log` exit=0

## Urteil des Reviewers

- DOC-061 behoben — Kopfabsatz unter `## [Unreleased]` in `CHANGELOG.md`
- DOC-038 behoben — `pipeline`, `buildOutputNode`, `maxStepsPerFrame` mit TS2610-Satz;
  `VOBufferPool#buffer` als read-only (Setter `@internal`, `VOBufferPool.ts:83`)
- DOC-039 behoben — Deprecated-Eintrag »wherever it differs from its default«,
  Kommentar `PanControl2D.ts:640–644` passt zu `:645–647`
- DOC-040 behoben — Pointer-Eintrag endet »the cursor comes back as the drag ends«
- DOC-071 behoben — `loadAsync()`-Eintrag »one of the four failures that reject«
- CONS-047 behoben — CHANGELOG und TSDoc `Stage2D.ts:422–444`, gegen Setter `:130`, `:175`
  geprüft
- Folge aus Paket 2 behoben — Verweis per Name auf den H4 `:916`
- Kleine Befunde: `CHANGELOG.md:3–5` »walks a project through all of them in one upgrade«
  überzieht leicht (Wortlaut aus dem freigegebenen Detailplan) · Commit-Message sehr lang
  (passt zur Praxis im `git log`)

## Abgleich

- **DOC-061** — unverändert. `## [Unreleased]` reicht heute von `:8` bis `:3614` (vor
  `## [0.21.2] - 2026-06-19` an `:3615`), `packages/twopoint5d/package.json:4` steht auf
  `0.21.2`. Laut Entscheidung vom 2026-09-30 kein Release-Schnitt und kein Bump; geschlossen
  durch den Kopfabsatz (Schritt 1), im Einklang mit dem acknowledged Release-Rückstand.
- **DOC-038** — verschoben: `pipeline` `:184`, `buildOutputNode` `:218`, `maxStepsPerFrame`
  `:227`; das Vorbild `visibilitor` steht an `:221`. In 0.21.2 (62174770) waren alle drei
  noch Felder (`StageRenderer.ts:294`, `:313`, `FixedFrameLoop.ts:104`), der Bruch für eine
  Unterklasse ist also echt. Dazu `:182` (`VOBufferPool#buffer`, in 0.21.2 ein Feld): dieselbe
  Ursache, und der Satz widerspricht `:242`.
- **DOC-039** — verschoben nach `:321`. Code (`PanControl2D.ts:644–647`) bestätigt: `keys`
  entscheidet, sobald es vom Default abweicht; der Kommentar `:643` sagt wie der CHANGELOG
  »Whoever sets keys as well gets keys«. Die TSDoc der Option (`:170–173`) und der H4
  »`PanControl2D` keys by `KeyboardEvent.code`« sind genau.
- **DOC-040** — verschoben nach `:461`, Wortlaut unverändert.
- **DOC-071** — verschoben nach `:57`, Wortlaut unverändert; TSDoc der Methode eindeutig.
- **CONS-047** — verschoben: CHANGELOG `:39`, TSDoc `Stage2D.ts:422–437` (der Satz selbst
  `:424–429`). Die Geschwister in `Canvas2DStage.ts:270`, `FixedFrameLoop.ts:289` und
  CHANGELOG `:180` haben disjunkte Listen und bleiben.

## Triage der offenen Befunde

- Folge aus Paket 2 (`:911–913`, heute `:913–915`): offen, Schritt 7.
- »Paket 9 glättet« unter Paket 5, 6, 10 (Schnittstellen) und »Hängt ab von« (1, 2, 5, 6, 7,
  10): kein Befund mit Fundstelle, sondern ein Auftrag; in Zug 0 gegen die Diffs der Commits
  5738b5e5, 576d3fc6, c5037879, 4b9306c8, b8868b16 und 6861f3d0 am CHANGELOG konkretisiert
  (Schritte 7–10). d05f0422 (Paket 8) schreibt nichts in den CHANGELOG.
- Queue `CHANGELOG.md:188–190`: gleiche Ursache wie die Folge aus Paket 2 → hier. Vorbestehend
  (»schon in 4b9306c8 so«), und die Zählung in Zug 0 fand neun Stellen der kleinen Form.
- Übrige Queue-Einträge: keiner teilt eine Ursache mit diesem Paket (`README.md:35` ist
  Rechtschreibung im README, `StageRenderer.ts:286–289` ist Code), sie bleiben liegen.
- Neu in Zug 0, in dieses Paket genommen statt in die Queue, weil gleiche Ursache:
  `CHANGELOG.md:182` (wie DOC-038, vorbestehend seit f90dbbf6 und 2503bd68) und
  `PanControl2D.ts:643` (wie DOC-039, vorbestehend seit 68c3bffb).

## Findings im Volltext

**DOC-061 · low · packages/twopoint5d/CHANGELOG.md:8** (dazu `:2856`,
`packages/twopoint5d/package.json:4`) — Release aus dem stark angewachsenen
CHANGELOG-Unreleased-Block schneiden
Der Abschnitt "## [Unreleased]" des CHANGELOG erstreckt sich über rund 2850 der insgesamt 3738
Zeilen (Zeile 8 bis 2855, vor dem nächsten Versionskopf "## [0.21.2] - 2026-06-19") und
enthält bereits eigene Added/Changed/Deprecated/Removed/Fixed/Migration-Guide-Abschnitte mit
vielen benannten Breaking Changes. packages/twopoint5d/package.json steht unverändert auf
Version 0.21.2 — exakt der zuletzt veröffentlichten Version vom 2026-06-19, gut drei Monate vor
dem heutigen Datum —, ohne "-dev"-Suffix, wie ihn deploy.yml als Signal für "noch nicht reif"
auswertet. Wer das Paket heute von npm installiert, sieht keine der dokumentierten Änderungen;
wer sie liest, muss einen der größten Abschnitte der Projektgeschichte auf einmal
durcharbeiten, sobald doch veröffentlicht wird.
Empfehlung: Den nächsten Release früher schneiden, oder zumindest bewusst entscheiden und kurz
festhalten, dass die Ansammlung beabsichtigt ist (z. B. weil erst alle zusammengehörigen
Breaking Changes gemeinsam mit einer Migration Guide veröffentlicht werden sollen), damit der
Umfang nicht als Versehen wirkt.

**DOC-038 · low · packages/twopoint5d/CHANGELOG.md:126** — Im CHANGELOG bei jedem neuen
Accessor-Paar sagen, dass ein Feld in der Unterklasse nicht mehr kompiliert
Unter `Unreleased` steht für `StageRenderer#pipeline` und `#buildOutputNode` »reading and
writing it is unchanged«, für `FixedFrameLoop#maxStepsPerFrame` nur »is an accessor pair on the
prototype«. Eine TS-Unterklasse, die eines davon als Feld deklariert, bekommt TS2610 (und ein
Klassenfeld verdeckte den Setter). Der Eintrag zu `Map2DTileStreamer#visibilitor` (Zeile 133)
sagt genau das; die drei anderen nicht. Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: Den Halbsatz aus Zeile 133 an die drei Einträge hängen.

**DOC-039 · low · packages/twopoint5d/CHANGELOG.md:180** — Die Vorrangregel von keys gegenüber
keyCodes im CHANGELOG genau fassen
»`keys` wins where both are set« stimmt nicht, wenn `keys` ausdrücklich auf den Default gesetzt
wird und `keyCodes` abweicht — dann entscheidet `keyCodes`. Aufgefallen im Remediation-Lauf vom
2026-09-19.
Empfehlung: »`keys` wins wherever it differs from its default«.

**DOC-040 · info · packages/twopoint5d/CHANGELOG.md:276** — Den Bezug von »it« im
CHANGELOG-Eintrag zum Pointer-Handling klären
Das angehängte »and the cursor comes back with it« lässt offen, worauf sich »it« bezieht
(Pan-Taste, Pan oder Drag). Aufgefallen im Remediation-Lauf vom 2026-09-19.
Empfehlung: »… and the cursor comes back as the pan ends«.

**DOC-071 · info · packages/twopoint5d/CHANGELOG.md:54** — Der CHANGELOG-Eintrag zu loadAsync()
bezieht »the failures above« nicht eindeutig
Aufgefallen im Remediation-Lauf vom 2026-09-26. Der Eintrag zu `TextureStore#loadAsync()` sagt,
ein werfender `error`-Listener ändere nicht, wie das Promise settlet, »while it hears one of the
failures above«. Unmittelbar davor stehen die Item-Events, die nicht rejecten; »the failures
above« lässt sich zur Not auch auf sie beziehen, gemeint sind nur die vier Fehlschläge, die
rejecten.
Empfehlung: »one of the four failures that reject« statt »one of the failures above« schreiben.

**CONS-047 · info · packages/twopoint5d/CHANGELOG.md:33** — Die dispose()-TSDoc führt scene und
name in zwei einander ausschließenden Aufzählungen
`scene` und `name` stehen im selben Satz sowohl unter »keep the values the stage was left with«
als auch unter »still take new ones«. Gemeint ist: `dispose()` setzt sie nicht zurück, und sie
bleiben beschreibbar. Lesbar, aber nicht trennscharf; die CHANGELOG-Zeile trägt denselben
Satzbau.
Empfehlung: Die beiden Aussagen trennen — was seinen Wert behält, und was weiter
Schreibzugriffe annimmt — und die CHANGELOG-Zeile nachziehen.
