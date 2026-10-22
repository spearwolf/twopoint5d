# Paket 17 — Doku, CHANGELOG und Proposals sagen genau, was gilt

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — vier Queue-Einträge (»in Paket 17 aufgenommen«) und zehn
  kleine Reviewer-Befunde der Pakete 1, 2, 4, 9, 10, 12, 13 (der elfte, Paket 7, ging an Paket 14
  und ist dort erledigt), dazu die Stellen gleicher Ursache aus dem Abgleich unten
- Ziel: CHANGELOG, Guides und Proposals beschreiben das Verhalten des Codes ohne Rückblick, mit
  richtigen Verweisen und zitierten Meldungen.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d/CHANGELOG.md` (nur `## [Unreleased]`)
  - `docs/architecture.md`
  - `packages/twopoint5d/docs/display.md`, `docs/map2d.md`, `docs/text.md`, `docs/sprites.md`
  - `packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md`,
    `dynamic-atlas-and-bitmap-text.md`, `sprite-and-texture-roadmap.md`
  - `packages/twopoint5d/src/text/layoutText.ts` (nur TSDoc), `packages/twopoint5d/src/texture/DynamicAtlas.ts`
    (nur TSDoc)
- Verify: `pnpm run ci`
- Commit: `docs: state the zoom of a pixel, the wait between the tries up of frame-pacing, where the helpers of a rectangular visibility area put their rectangle, which spaces of a text hang and yield no sprite, what a redraw() of a DynamicAtlas that throws marks and the message of a full atlas as the code has them, mark the change of CameraBasedVisibility breaking at run time, name the majors Dependabot leaves out and the release files the publish script copies for a version it skips, and write the proposal of animation playback without looking back at the code before it`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · alle vier Queue-Einträge und alle zehn offenen
    Reviewer-Befunde bestehen; gewandert: `CHANGELOG.md:71` → `:76`, `:91` → `:93`, `:103` → `:104`,
    `animation-playback-and-aseprite.md` `:412`/`:420`/`:442` → `:416`/`:424`/`:446`,
    `dynamic-atlas-and-bitmap-text.md:210` → `:211`, `:262` → `:263`, `docs/architecture.md:365–372`
    → `:386–392` · gleiche Ursache aufgenommen: weitere Rückblicke im Aseprite-Proposal
    (`:118`, `:156`, `:166`, `:173`, `:178–179`, `:198`, `:359`, `:381`), Leerzeichen-Aussagen in
    `text.md` `:104`, `:147`, `:153–155`, im TSDoc von `layoutText.ts` `:51`, `:259` und im
    CHANGELOG `:37`, `DynamicAtlas.ts:326–328` (TSDoc zu werfendem `redraw()`), Migration Guide
    zu `CameraBasedVisibility` · Meldungs-Abgleich: 86 zitierte Meldungen in getrackten
    Markdown-Dateien gegen die Templates in `src/` gehalten, einzige Abweichung
    `dynamic-atlas-and-bitmap-text.md:211` (schon Queue-Eintrag) · keine offene `Folgen:`-Zeile
    eines erledigten Pakets; Queue-Einträge `SpritePicker.ts:279–280`, `extractSnippets.mjs:33`/`:176`,
    `:224–244` teilen die Ursache nicht und bleiben für den Abschluss · kleiner Befund `AGENTS.md:117` (jetzt `:119`)
    aus Paket 19 an Paket 18 (gleiche Ursache: Absatz nicht neu umbrochen); die übrigen drei kleinen
    Befunde von Paket 19 (Code) bleiben in `paket-19.md` für den Abschluss
  - 2026-10-22 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-17.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG_MIT_VORBEHALT (nachgeholt als `paket-17.impl-0-versuch-2.json`, erster Rückgabetext leer) · 11 Dateien geändert, keine neu · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-17.verify.log`)
  - 2026-10-22 Zug 3: Reviewer (sonnet, effort low) alle Schritte 1.1–10.11 erfüllt, keine kritischen oder wichtigen Befunde, zwei kleine · Diff `paket-17.diff`
  - 2026-10-22 Zug 4: entfällt, keine Runde
  - 2026-10-22 Zug 5: committet als eb20cfe6 · drei Streudateien des Implementierers (`100:`, `130:`, `90` im Repo-Root, Notizen aus einer Shell-Umleitung) gelöscht

## Urteil des Reviewers

- Schritte 1.1–1.5 `CHANGELOG.md` `[Unreleased]` und Migration Guide: erfüllt
- Schritte 2.1, 2.2 `docs/architecture.md` Publish- und Dependabot-Absatz: erfüllt
- Schritt 3 `display.md`: erfüllt (gegen `AdaptiveResolution.ts:71–72`, `:556` geprüft)
- Schritte 4.1–4.5 `text.md`, 5.1–5.2 `layoutText.ts`: erfüllt
- Schritt 6 `map2d.md`: erfüllt (gegen `RectangularVisibilityAreaHelpers.ts:121` geprüft)
- Schritte 7.1–7.3 `DynamicAtlas.ts:327–331`, `sprites.md:477–479`, Proposal `:263`: erfüllt
- Schritte 8.1, 8.2, 9: erfüllt
- Schritte 10.1–10.11: erfüllt, grep trifft nur `:48` und `:64`
- Alle vier Queue-Einträge und die zehn kleinen Reviewer-Befunde: behoben

Kleine Befunde:
- `packages/twopoint5d/src/text/layoutText.ts:259` (TSDoc): »yields a glyph where that one has a box« — Bezug von »that one« unscharf (gemeint: der Glyph, mit dem das Zeichen gesetzt wird)
- `packages/twopoint5d/src/text/layoutText.spec.ts:59`, `:65`: Testnamen »a space … yields no glyph« sagen dasselbe unscharf wie die korrigierte Doku; vorbestehend → Queue

## Regeln für jede Änderung dieses Pakets

- Englisch, Konventionen aus dem Kopf von `./remediation-plan.md`: kein Rückblick auf einen
  Vorzustand, keine Finding-IDs.
- Ein geänderter Absatz wird auf die Breite seiner Datei neu umbrochen: Prosa in
  `packages/twopoint5d/docs/**` höchstens 100 Zeichen je Zeile, `docs/architecture.md` höchstens
  90. Im CHANGELOG bleibt jeder Eintrag eine Zeile. TSDoc höchstens 130 Zeichen je Zeile samt
  Einrückung (Biome `lineWidth`). Nur den Absatz umbrechen, den der Schritt ändert — das Umbrechen
  der übrigen Datei ist Paket 18.
- Kein `ts check`-Block wird angefasst. Kein CHANGELOG-Eintrag für dieses Paket: es ändert kein
  Verhalten und keine Signatur, nur Doku und TSDoc.
- Die Ersatztexte unten sind verbindlich im Inhalt; Wortstellung darf sich beim Umbruch ändern,
  der Inhalt nicht.
- In den Alt- und Ersatztexten unten steht `\`` für einen Backtick der Zieldatei: in die Datei kommt
  der Backtick, ohne den Backslash.

## Vorgehen

### 1. `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`)

1. **`:76`, Eintrag `Display#pixelZoom`.** Ersetze
   `rounded down, at least 1 — where a zoom of 2 on a screen of a ratio of 2.625 drew the pixels 5 and 6 device pixels wide by turns.`
   durch
   `rounded down, at least 1, so that a zoom of 2 on a screen of a ratio of 2.625 draws every pixel 5 device pixels wide.`
   (2 × 2.625 = 5.25, abgerundet 5.) Der Rest des Eintrags bleibt.
2. **`:93`, Eintrag `CameraBasedVisibility`.** `(**BREAKING** for TypeScript)` wird `(**BREAKING**)`.
   Grund: `CameraBasedVisibility.Plane` war vor dem Lauf ein `static readonly`-Feld, eine geteilte
   Instanz (`git show 6500527f:packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:239`), jetzt
   ein Getter mit einer neuen Kopie je Zugriff (`CameraBasedVisibility.ts:252`); `pointOnPlane` war
   ein öffentliches Feld, jetzt ein Getter ohne Setter (`:394`). Beides bricht zur Laufzeit.
3. **Migration Guide, Abschnitt `#### What CameraBasedVisibility hands out` (`:368`).** Hinter den
   ersten Absatz (der mit `` `visibles`, `pointsOnPlane` and the fields of a `TileBox` are the
   visibility's own …``) einen Satz anhängen, im selben Absatz:
   `` `pointOnPlane` and `CameraBasedVisibility.Plane` are getters: an assignment to either throws a `TypeError` in strict code, and `Plane` answers a new copy on every access, so a change to it reaches no visibility. ``
   Die Before/After-Blöcke bleiben.
4. **`:104`, Eintrag `frameBasedAnimationsData`.** Ersetze
   `is compared by content — every field in its order, a \`RegExp\` by \`source\` and \`flags\` —: data equal to the current`
   durch
   `is compared by content, every field in its order and a \`RegExp\` by \`source\` and \`flags\`: data equal to the current`.
5. **`:37`, Eintrag `writeText`/`layoutText`** (die Zeile, die `the spaces at the end of a line hang out
   of its width and its alignment` enthält): `the spaces at the end of a line hang` wird
   `the breakable spaces at the end of a line hang`. Grund wie Schritt 4.2.

Nicht anfassen: die Rückblicke in `:67` (`one built by hand in the layout before — plays every
animation as a loop, as it did`), `:77` (`where it drew at the full \`devicePixelRatio\` before`)
und `:78` (`where it asked for four samples per pixel before`), und Before/After im Migration
Guide — Begründung unter »Entscheidungen dieses Pakets«.

### 2. `docs/architecture.md` (Breite 90)

1. **Publish, `:312–313`.** Ersetze `Before it asks npm anything it copies \`LICENSE\` from the
   workspace root,` durch `Before it asks npm anything, and so also for a version it then skips, it
   copies \`LICENSE\` from the workspace root,`. Belegt durch `scripts/publishNpmPkg.mjs:49–66`: die
   Kopie läuft nach dem `-dev`-Ausstieg und vor `npm show`, unabhängig von dessen Antwort.
   Absatz neu umbrechen.
2. **Dependabot, `:390–391`.** Ersetze `So each of them, and every major update, comes as a pull
   request by itself, to be reviewed on its own.` durch `So each of them, and every major update but
   those of \`typescript\` and \`@types/node\`, which it ignores (see below), comes as a pull request
   by itself, to be reviewed on its own.` Belegt durch `.github/dependabot.yml` (`ignore:` mit
   `version-update:semver-major` für beide); die Gründe stehen schon in den Absätzen ab `:396`
   und `:415`. Absatz neu umbrechen.

### 3. `packages/twopoint5d/docs/display.md` (Breite 100)

**`:243–244`.** Ersetze `until clean frames bring it back through the tries up, one every 180 clean
frames.` durch `until clean frames bring it back through the tries up: the first after 180 clean
frames, and twice as many after each try that failed, up to 3600.` Belegt durch
`AdaptiveResolution.ts:71–72` (`PACING_PROBE_FRAMES = 180`, `PACING_MAX_PROBE_FRAMES = 3600`) und
`:556` (Verdopplung nach einem gescheiterten Versuch); eine Übernahme behält die verdoppelte
Wartezeit (`:246–248` sagt das schon). Absatz neu umbrechen.

### 4. `packages/twopoint5d/docs/text.md` (Breite 100)

1. **`:104`.** `a line is as wide as the pen after its last char that is no space` wird
   `a line is as wide as the pen after its last char that is no breakable space`.
2. **Tabelle `:130–137`** — die Spalte »set as« trägt heute auch Umbruchverhalten. Ersetze die
   ganze Tabelle durch diese (Kopf und Zeilen wörtlich; Tabellenzeilen werden nicht umbrochen):

   ```markdown
   | class | chars | set as | at a line break |
   | --- | --- | --- | --- |
   | line end | `\n`, U+2028, U+2029 | nothing | ends the line |
   | breakable space | U+0020, tab, U+1680, U+2000–U+2006, U+2008–U+200A, U+205F, U+3000 | a tab as U+0020, the others as their own glyph or else as U+0020; no sprite | a place to break; dropped at a break, hangs at the end of a line |
   | break without width | U+200B, and a breakable space the font has neither glyph for | nothing: no room, no sprite | a place to break before the next char |
   | no-break space | U+00A0, U+2007, U+202F | its own glyph or else U+0020, else dropped | holds its word together |
   | control and format | `\r`, a soft hyphen, U+200C–U+200F, U+2060, U+FEFF and every other of Cc and Cf | dropped: no room, no sprite | none |
   | any other | | its glyph, else `fallback`, else skipped | a place to break before an ideograph or a kana that is drawn |
   ```

   Belegt durch `layoutText.ts:58–75` (Klassen und Kommentar) und `entriesOf()` `:126–163`.
3. **`:139`.** Ersetze den ersten Satz `A space moves the pen and yields no sprite, even where the
   font gives it a box.` durch `A breakable space moves the pen and yields no sprite, even where the
   font gives it a box; a no-break space yields one where its glyph has a box.` Belegt durch
   `layoutText.ts:148` (Eintrag mit `space: false`) und `:304` (ein Glyph entsteht für jeden Eintrag
   mit `!space`, Breite und Höhe über 0). Absatz neu umbrechen.
4. **`:147`.** `The spaces at the break are dropped.` wird `The breakable spaces at the break are
   dropped.`
5. **`:153–155`.** `**Spaces at the end of a line** hang out of it:` wird `**Breakable spaces at the
   end of a line** hang out of it:`, und `a line of nothing but spaces is 0 wide` wird `a line of
   nothing but breakable spaces is 0 wide`. Belegt durch `widthOf()` `:169–181`: nur ein Eintrag
   mit `space: true` bleibt aus der Breite. Absatz neu umbrechen.

### 5. `packages/twopoint5d/src/text/layoutText.ts` (nur TSDoc, Breite 130)

1. **`:51`**, TSDoc von `TextLayout#width`: `the spaces at the end of a line hang out of it` wird
   `the breakable spaces at the end of a line hang out of it`.
2. **`:259`**, TSDoc von `layoutText()`: Ersetze `A no-break space — U+00A0, U+2007, U+202F — is set
   the same way and holds its word together.` durch `A no-break space — U+00A0, U+2007, U+202F — is
   set as its own glyph or else as U+0020, yields a glyph where that one has a box, holds its word
   together, and is dropped without either.` Absatz neu umbrechen. Kein Code ändert sich.

### 6. `packages/twopoint5d/docs/map2d.md` (Breite 100)

**`:200–201`.** Ersetze `\`RectangularVisibilityAreaHelpers\` does the same for the rectangle of a
\`RectangularVisibilityArea\`.` durch `\`RectangularVisibilityAreaHelpers\` keeps the rectangle of a
\`RectangularVisibilityArea\` in the node \`add()\` names: it goes into no root and follows none.`
Belegt durch `RectangularVisibilityAreaHelpers.ts:121` (`this.#helpers.add(node)` ohne
`addToRoot`) gegen `CameraBasedVisibilityHelpers.ts:356` (`followRoot()`). Absatz neu umbrechen.

### 7. `DynamicAtlas`: ein `redraw()`, das wirft

Vor dem ersten `upload()` setzt eine Änderung `texture.needsUpdate`, danach merkt sie ihre Zelle
für das nächste `upload()` vor (`DynamicAtlas.ts:680–687`, `#changed()`); `redraw()` ruft
`#changed()` im `finally` (`:350–353`). Drei Stellen sagen nur »marked for upload«:

1. **`src/texture/DynamicAtlas.ts:326–328`**, TSDoc von `redraw()`: `and marked for upload; the frame,
   its name and its cell stay` wird `and marked for upload as any change is — the whole texture until
   the first {@link upload}, its cell for the next \`upload()\` from then on; the frame, its name and
   its cell stay`. Absatz neu umbrechen (Breite 130).
2. **`packages/twopoint5d/docs/sprites.md:478`**: `and marked for upload; the frame and its name stay,
   so the next \`redraw()\` mends it.` wird `and marked for upload like any change — the whole texture
   until the first \`upload()\`, its cell for the next \`upload()\` from then on; the frame and its name
   stay, so the next \`redraw()\` mends it.` Absatz neu umbrechen.
3. **`docs/proposals/dynamic-atlas-and-bitmap-text.md:263`**: `and marked for upload (in a \`finally\`);
   the frame, its name and its cell stay.` wird `and marked for upload (in a \`finally\`) as every
   change is (§3.3): the whole texture before the first \`upload()\`, its cell for the next
   \`upload()\` after it; the frame, its name and its cell stay.` Absatz neu umbrechen.

### 8. `docs/proposals/dynamic-atlas-and-bitmap-text.md`, übrige Stellen

1. **`:72`**: `which \`remove()\` needs (§3.4)` wird `which \`remove()\` needs (§3.6)` — `remove()`
   steht in §3.6 (`:252`); §3.4 ist das Packen.
2. **`:211`**, die zitierte Voll-Meldung: `does not fit beside the 30 frames in it;` wird `does not
   fit beside the 30 frames packed into it;` — so schreibt sie `DynamicAtlas.ts:579`.

### 9. `docs/proposals/sprite-and-texture-roadmap.md` (Breite 100)

**`:481`**: `- \`add()\` marks the texture for upload; \`remove()\` frees` wird `- \`add()\` marks the
texture for upload — or, once \`upload(renderer)\` has been called, notes its cell for the next call
(§3.3 of [\`dynamic-atlas-and-bitmap-text.md\`](dynamic-atlas-and-bitmap-text.md)); \`remove()\`
frees`. Rest des Punkts bleibt, Punkt neu umbrechen.

### 10. `docs/proposals/animation-playback-and-aseprite.md` — Rückblicke im gebauten Proposal (Breite 100)

Der Status-Kopf (`:3–5`) sagt, die Abschnitte darunter nennen den gebauten Stand. Jede Stelle unten
spricht relativ zum Code vor dem Proposal. §1 »Goal« und §2 »What there is today« bleiben (siehe
»Entscheidungen dieses Pakets«), ebenso die Liste der Abweichungen im Status-Kopf.

1. **`:118–119`**: `The old precedence of \`frameRate\` over \`duration\` when both are given (the types
   forbid it, a json catalog may not) stays as it is — changing it would break such a catalog.`
   wird `Where a json catalog gives both \`frameRate\` and \`duration\` (the types forbid it),
   \`frameRate\` wins; refusing the pair would break such a catalog.` Belegt durch
   `FrameBasedAnimations.ts:180–186` (`frameRate` wird vor `duration` gelesen).
2. **`:156`**: `run on backwards in their cycle, as they do today.` wird `run on backwards in their
   cycle.`
3. **`:166`**: `- texels \`0 … n−1\`: \`[frameCount, duration, firstFrameTexel, texelsPerFrame]\`, as
   before;` wird `- texels \`0 … n−1\`: the first header texel of each animation, \`[frameCount,
   duration, firstFrameTexel, texelsPerFrame]\`;`
4. **`:173`**: `No texel of the old layout goes below \`−1\`:` wird `No first header texel and no
   frame texel goes below \`−1\`:` (der Rest des Satzes zählt genau diese Texel auf).
5. **`:178–179`**: `with \`−2\` an animsMap of the old layout, one built by hand among them, plays as
   it did — every animation loops at one duration — as long as its frames lie within their image.`
   wird `with \`−2\` an animsMap without second header texels, one built by hand among them, plays
   every animation as a loop at one duration, as long as its frames lie within their image.`
6. **`:198–199`**: `(the old layout)` wird `(an animsMap without second header texels)`, und
   `\`D = 0\` shows frame 0 in every mode, as today.` wird `\`D = 0\` shows frame 0 in every mode.`
7. **`:359`**: `a bake of it belongs to the caller as before.` wird `a bake of it belongs to the
   caller, as every bake does.`
8. **`:381`**: `the resource lays the frames out on the image it loaded, which is how
   \`TexturePackerJson.parse()\` is called today;` wird `the resource lays the frames out on the
   image it loaded, as it does for \`TexturePackerJson.parse()\`;`
9. **`:416`**: `and is reported as today (\`source: 'texture'\`, step \`atlasParse\`)` wird `and is
   reported as a failed parse is (\`source: 'texture'\`, step \`atlasParse\`)`.
10. **`:424`**: `- neither adapter animations nor catalog entries: none, as today;` wird `- neither
    adapter animations nor catalog entries: none;`
11. **`:446`**: `per run of its effect, as today;` wird `per run of its effect;`

Danach `grep -nE "\btoday\b|as before|as it did|old layout" packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md`:
übrig bleiben dürfen nur `:48` (Überschrift §2) und `:64` (in §2).

## Entscheidungen dieses Pakets

- **Rückblicke im CHANGELOG: nur `:76`.** Die Konvention des Laufs bindet die Zeilen, die der Lauf
  schreibt; `:76` hat Paket 3 neu geschrieben (der Nebensatz stand schon vorher), und er erzählt
  den alten Fehler, ohne dass ein Leser beim Update etwas damit anfangen kann — die Gegenwartsform
  trägt dieselbe Information. `:67`, `:77`, `:78` hat der Lauf nicht angefasst, und sie nennen
  den alten Standardwert bzw. das weiter gelesene alte Format — das, was ein `Changed`-Eintrag nach
  Keep a Changelog sagen soll. Before/After im Migration Guide ist dessen Form, kein Rückblick.
- **Rückblicke im Aseprite-Proposal: alle in §3–§7, nicht nur »as today«.** Dieselbe Ursache wie
  der Queue-Eintrag (der Text spricht relativ zum Code vor dem Proposal), dieselbe Datei; nur
  »as today« zu ersetzen ließe »as before«, »as it did« und »the old layout« daneben stehen. §1
  und §2 bleiben: Ziel und Ausgangslage sind die Gattung eines Proposals (auch
  `dynamic-atlas-and-bitmap-text.md` §2 heißt »What there is today«), und der Status-Kopf grenzt
  sie ab. `:241` (`could no longer register its nodes`) spricht über einen verworfenen Entwurf,
  nicht über einen Vorzustand, und bleibt.
- **Leerzeichen in `text.md`: alle Aussagen, die nur für umbrechbare gelten.** Der Reviewer-Befund
  zu `:139` hat dieselbe Ursache an `:104`, `:147`, `:153–155`, im TSDoc `layoutText.ts:51`/`:259`
  und im CHANGELOG `:37`; das Proposal (`dynamic-atlas-and-bitmap-text.md:519–534`, `:507–509`) ist
  dort schon genau. Die interne Kommentarzeile `layoutText.ts:64` (»set the same way«) meint die
  Wahl der Glyphe und stimmt.
- **Migration Guide `CameraBasedVisibility` bekommt einen Satz.** Mit `(**BREAKING**)` statt
  `for TypeScript` verweist der Eintrag auf einen Bruch zur Laufzeit; der Guide nennt bisher nur
  Sortieren und Festhalten. Ein Satz, keine neuen Codeblöcke.
- **Kein CHANGELOG-Eintrag** für dieses Paket: Doku- und TSDoc-Korrekturen ohne Verhaltensänderung.
- **Zitierte Meldungen** wurden über alle getrackten Markdown-Dateien (ohne `docs/superpowers/`
  und die Laufdateien) gegen die Template-Strings in `packages/twopoint5d/src/` gehalten
  (Skript im Scratchpad dieser Session, nicht Teil des Pakets): 86 Zitate, eines weicht ab
  (Schritt 8.2); die zusammengesetzten Meldungen von `frameSlices.ts` (`setAnchorFromPivot`,
  `setSliceFrame`) per Hand gegen `Anchor.ts:39–43` und `NineSlice.ts:66–70` geprüft, stimmen.
  Die Doku-Zeilen der Pakete 14, 15, 16, 19 (`CHANGELOG.md:120`, `sprites.md:2022–2033`,
  `animation-playback-and-aseprite.md:107–116`, `dynamic-atlas-and-bitmap-text.md` §3.3,
  `display.md:246–248`, `text.md:147–149`) stimmen mit dem Code überein, bis auf die Rückblick-Zeile
  `:118` in Schritt 10.1.

## Punkte im Volltext

Aus »Offene Befunde« des Plans (alle `→ Scope`, vorbestehend):

- **`packages/twopoint5d/CHANGELOG.md:71`** (jetzt `:76`) — der `[Unreleased]`-Eintrag zu
  `Display#pixelZoom` trägt einen Rückblick auf den Vorzustand (»where a zoom of 2 on a screen of a
  ratio of 2.625 drew the pixels 5 and 6 device pixels wide by turns«), gegen die Konvention »Kein
  Rückblick«; stand schon vor dem Lauf da (Paket 3). → Schritt 1.1
- **`packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md:199`, `:412`, `:420`,
  `:442`** (jetzt `:199`, `:416`, `:424`, `:446`) — »as today« spricht im Rückblick auf einen
  Vorzustand, gegen die Konvention »Kein Rückblick«; stand so schon in `6500527f` (Paket 7).
  → Schritt 10
- **`packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md:210`** (jetzt `:211`) —
  die zitierte Voll-Meldung endet auf »beside the 30 frames in it«, die Meldung von
  `DynamicAtlas#pack()` sagt »beside the 30 frames packed into it«; stand so schon in `6500527f`
  (Paket 12). → Schritt 8.2
- **`packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md:72`** — »which `remove()`
  needs (§3.4)« verweist auf den falschen Abschnitt, `remove()` steht in §3.6; stand so schon in
  `6500527f` (Paket 12). → Schritt 8.1

Kleine Reviewer-Befunde (Folgen der Pakete, im Plan unter »Folgen von«):

- **Paket 1** — `docs/architecture.md:365-372` (jetzt `:386–392`): der Dependabot-Absatz nennt die
  Ausnahmen für `typescript` und `@types/node` nicht. → Schritt 2.2
- **Paket 2** — `docs/architecture.md` sagt nicht, dass `publishNpmPkg.mjs:54–65` die
  Release-Dateien auch auf dem Pfad »schon veröffentlicht« kopiert (jetzt `:312–313` »Before it
  asks npm anything it copies …« — legt es nahe, sagt es nicht). → Schritt 2.1
- **Paket 4** — `docs/display.md:244`: »one every 180 clean frames« ohne die Verdopplung bis 3600.
  → Schritt 3
- **Paket 7** — `CHANGELOG.md:97–98` nennt unveröffentlichte Factories im `describeValue`-Eintrag:
  an Paket 14 abgegeben, dort erledigt (`f9a6029e`); der Eintrag `:120` nennt nur
  `sampleAtlasFrame()`, das in `[0.23.0]` steht.
- **Paket 9** — `docs/map2d.md:199`: liest sich, als folge auch das Rechteck der Wurzel (jetzt
  `:200–201`). → Schritt 6
- **Paket 9** — `CHANGELOG.md:91` (jetzt `:93`): »(**BREAKING** for TypeScript)« statt
  »(**BREAKING**)«. → Schritt 1.2, 1.3
- **Paket 10** — `docs/text.md:139`: »A space … yields no sprite« gilt nur für umbrechbare
  Leerzeichen. → Schritt 4.3, mit 4.1, 4.4, 4.5, 5, 1.5
- **Paket 10** — `docs/text.md`: die Tabelle der Zeichenklassen mischt Umbruchverhalten in die
  Spalte »set as«. → Schritt 4.2
- **Paket 12** — `DynamicAtlas.ts:330`, `docs/sprites.md:478`, `dynamic-atlas-and-bitmap-text.md:262`
  beschreiben ein werfendes `redraw()` vor und nach dem ersten `upload()` unscharf (jetzt
  `DynamicAtlas.ts:326–328`, `sprites.md:478`, Proposal `:263`). → Schritt 7
- **Paket 12** — `sprite-and-texture-roadmap.md:481`: »`add()` marks the texture for upload« gilt nur
  bis zum ersten `upload()`. → Schritt 9
- **Paket 13** — `CHANGELOG.md:103` (jetzt `:104`): Gedankenstrich vor Doppelpunkt. → Schritt 1.4
