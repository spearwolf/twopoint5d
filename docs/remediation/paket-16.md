# Paket 16 — Text-Guide: Fehlerklassen der Abweisungen von BitmapFont

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 6
- Findings: — (Folge, kein Audit-Finding; low)
- Ziel: Der Absatz »Refusals« in `packages/twopoint5d/docs/text.md` nennt die
  Fehlerklassen, wie die TSDoc von `BitmapFont.parse()` und des Konstruktors
  sie hat: `RangeError` für eine Kennzahl von `common` (`lineHeight`, `base`,
  `scaleW`, `scaleH`), die keine endliche Zahl ist oder — außer `base` — nicht
  über 0 liegt, für ein Feld eines Zeichens, das keine endliche Zahl ist oder
  als `x`, `y`, `width`, `height` unter 0 liegt, und für das `amount` eines
  Kerning-Paars, das keine endliche Zahl ist; `Error` für alle übrigen
  Abweisungen. Dazu (Zug 0, zweite Fundstelle derselben Ursache): der
  Einleitungssatz von §4.4 »Refusals« in
  `packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md` sagt
  dasselbe.
- Modell: günstigste Stufe — reine Transkription: zwei Markdown-Dateien,
  benannte Zeilen, der neue Wortlaut steht unten fertig umbrochen; kein Code,
  nichts zu suchen
- Effort: low — exakter Auftrag; höherer Effort lädt dazu ein, den
  Nachbarabsatz zu `writeText()` gleich mitzunehmen, der ausdrücklich nicht
  dazugehört (siehe »Grenzen«)
- Dateien: `packages/twopoint5d/docs/text.md`,
  `packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md`
- Vorgehen:
  1. **Guide.** In `packages/twopoint5d/docs/text.md` die Zeilen 53–60 —
     der Absatz, der mit `**Refusals.** Each names what is wrong and where: a
     source in none of the three spellings, JSON that` beginnt und mit
     `know.` endet, direkt vor der Leerzeile und dem Absatz `A font and its
     atlas are plain data: nothing to dispose. …` (Z. 62) — ganz durch
     genau diese zehn Zeilen ersetzen, Zeichen für Zeichen, Umbruch wie hier
     (jede Zeile höchstens 100 Zeichen, wie die Prosa der Datei):

     ```
     **Refusals.** Each names what is wrong and where. A number of the font is refused with a
     `RangeError`: a `lineHeight`, `base`, `scaleW` or `scaleH` of the `common` block that is no finite
     number — `lineHeight`, `scaleW` and `scaleH` above 0 —, a field of a char that is no finite number,
     a negative position or size of a char, and a kerning pair whose `amount` is no finite number.
     Everything else is refused with an `Error`: a source in none of the three spellings, JSON that does
     not parse, font data that is no object, a font without a `common` block, without `chars` or with
     more than one page, a char with an id that is no whole number from 0 to 0x10FFFF, a glyph that
     reaches beyond the page, two chars of one id, and a kerning pair whose chars are no code points. A
     numeric entity in the XML that is no code point stays as it is written, like an entity the reader
     does not know.
     ```

     Der Inhalt ist gegen den Code abgeglichen (Zug 0): `RangeError` kommt aus
     `assertFinite()`/`assertPositiveFinite()` in `BitmapFont.ts:188–195`
     (`common`), `:225–232` (Felder eines Zeichens, `x`/`y`/`width`/`height`
     unter 0 über `AT_LEAST_ZERO`, Z. 107) und `:260` (Kerning-`amount`);
     jede andere Abweisung ist `new Error(…)` in `BitmapFont.ts` (Z. 180,
     186, 197, 209, 220, 234, 239, 244, 255) oder in
     `readBitmapFontSource.ts` (Z. 114, 120, 128). Keine Abweisung ist ein
     `TypeError`. »no finite number« statt des bisherigen »no number« ist
     gewollt: `NaN` und `Infinity` werden abgewiesen, und die TSDoc
     (`BitmapFont.ts:129–132`, `:170–176`) sagt es so.
  2. **Proposal.** In
     `packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md`,
     §4.4 »Refusals«, die zwei Zeilen 412–413:

     ```
     Each throws before the atlas holds a frame, naming the char by itself and its id where one is
     involved:
     ```

     durch genau diese drei ersetzen:

     ```
     Each throws before the atlas holds a frame, naming the char by itself and its id where one is
     involved. A number of the font — a metric of `common`, a field of a char, the `amount` of a kerning
     pair — is refused with a `RangeError`, every other refusal with an `Error`:
     ```

     Die Liste darunter (Z. 415–428) bleibt Wort für Wort, ebenso Status-Zeile
     und Abweichungsliste am Kopf des Proposals: die Fehlerklasse ist ein Fix
     am gebauten Stand, keine Stelle, an der der Bau den ersten Entwurf
     verlassen hat — Paket 6 hat `animation-playback-and-aseprite.md` §6.2
     genauso ohne Eintrag in der Abweichungsliste nachgezogen.
  3. Selbstprobe, bevor der Report geschrieben wird:
     `git diff --stat` zeigt genau die zwei Dateien;
     `grep -c 'RangeError' packages/twopoint5d/docs/text.md` ergibt `1`;
     `awk 'length($0) > 100' packages/twopoint5d/docs/text.md` und dasselbe
     für das Proposal zeigen keine der neuen Zeilen (bestehende überlange
     Tabellen- und Codezeilen sind nicht Sache dieses Pakets; `awk` zählt auf
     macOS Bytes, ein `—` zählt dort dreifach — im Zweifel
     `python3 -c` mit `len()` auf der Zeile).
  4. Kein CHANGELOG-Eintrag: die Library ändert sich nicht, und
     `packages/twopoint5d/CHANGELOG.md` Z. 115 (`[Unreleased]` →
     `### Changed`) nennt den `RangeError` von `BitmapFont` schon. Kein
     Regressionstest: kein Code, kein Verhalten; der Beleg ist der Abgleich
     in Schritt 1. Keine `ts check`-Blöcke berührt.
- Grenzen (gehören **nicht** in dieses Paket, stehen in »Offene Befunde« des
  Plans — nicht anfassen, auch wenn der Guide danach in sich ungleich wirkt):
  - der zweite Absatz `**Refusals.**` in `text.md` (Z. 172–181, zu
    `writeText()`/`rewriteText()`/`layoutText()`) nennt ebenfalls keine
    Fehlerklassen — war schon vor dem Lauf so, eigene Ursache;
  - der Listenpunkt in Proposal §4.4 Z. 420–421 nennt unter 0 nur `width`,
    `height`, nicht `x`, `y` — war schon vor dem Lauf so, eigene Ursache.
- Verify: `pnpm run ci` (Gate)
- Commit: `docs(twopoint5d): name the error classes of the refusals of BitmapFont in the text guide and in the proposal of bitmap text`
- Verlauf:
  - 2026-10-23 Zug 0: Detailplan steht · Folge aus Paket 6 unverändert an
    `docs/text.md:53–60` (Absatz nennt keine Fehlerklasse, sagt »no number«
    statt »no finite number«) · zweite Fundstelle derselben Ursache als
    Symptom aufgenommen: Proposal `dynamic-atlas-and-bitmap-text.md` §4.4
    Z. 412–413 · zwei vorbestehende Nebenbefunde → »Offene Befunde«
    (`text.md:172–181`, Proposal Z. 420–421), je `→ Scope` · keine offenen
    Folgen anderer Pakete · Restplan unverändert
  - 2026-10-23 Zug 1: Implementierer beauftragt (haiku, effort low), `paket-16.impl-0.json`
  - 2026-10-23 Zug 2: FERTIG · `docs/text.md`, Proposal `dynamic-atlas-and-bitmap-text.md` · Baum schmutzig · `pnpm run ci` exit=0 (`/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-16.verify.log`)
  - 2026-10-23 Zug 3: Reviewer (sonnet, low): erfüllt, keine kritischen/wichtigen Befunde · Diff `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-16.diff`
  - 2026-10-23 Zug 4: entfällt, 0 Runden
  - 2026-10-23 Zug 5: Commit 793015fa

## Review

- Folge aus Paket 6 — behoben: `docs/text.md:53–62` nennt `RangeError` (`common`-Kennzahlen über `assertFinite`/`assertPositiveFinite` Z. 191/193, Zeichenfelder Z. 226/228, Kerning-`amount` Z. 260) und `Error` für den Rest (`BitmapFont.ts` Z. 180–255, `readBitmapFontSource.ts` Z. 114–128); Wortlaut identisch mit dem Detailplan.
- Proposal §4.4 Einleitungssatz — behoben (Z. 412–414), Liste darunter unverändert.
- Kleine Befunde: keine eigenen; die zwei Grenzstellen stehen schon in »Offene Befunde«.

## Abgleich

- **Folge aus Paket 6** — unverändert. `packages/twopoint5d/docs/text.md:53–60`
  zählt die Abweisungen von `BitmapFont.parse()` auf, nennt aber keine
  Fehlerklasse, und für die Zahlen schreibt er »no number«. Der Code
  (`packages/twopoint5d/src/text/BitmapFont.ts`) weist seit Paket 6
  (a154cadc) die Kennzahlen von `common` (Z. 188–195), die Felder eines
  Zeichens (Z. 225–232) und das Kerning-`amount` (Z. 260) mit `RangeError`
  ab, alles andere mit `Error`; am Laufbeginn (7341059f) war jede Abweisung
  ein `Error` — da genügte der Guide ohne Klassennamen. TSDoc von `parse()`
  (Z. 129–132) und Konstruktor (Z. 170–176) und der CHANGELOG (Z. 115) nennen
  die Klassen schon.
- **Proposal `dynamic-atlas-and-bitmap-text.md` §4.4** (Z. 410–428) — gleiche
  Lage: »Each throws …« ohne Klasse, während §5.4 desselben Proposals
  (Z. 579–596) für `writeText()` die Klassen nennt (`TypeError`,
  `RangeError`). Status `implemented`; `docs/proposals/README.md` »Reading an
  implemented proposal«: die Abschnitte sagen, was gebaut ist. Die Konvention
  des Laufs verlangt geänderte Verträge in Guides **und** Proposals
  nachzuziehen. Der Satz in der Plan-Zeile von Paket 16 »die Proposals dürfen
  nachhinken« (Zug 0 von Paket 15) war eine Randnotiz, keine Entscheidung des
  Nutzers; er weicht hiermit — Grund im Abschnitt »Triage«.
- Weitere Stellen geprüft, ohne Treffer: `docs/architecture.md:200–208`
  (`text/` ohne Abweisungen), `docs/sprites.md:515–518` (Verweis auf den
  Guide), `docs/proposals/sprite-and-texture-roadmap.md:499–511` (API-Skizze,
  keine Abweisungen), `src/text/fixtures/README.md`, Lookbook (`apps/lookbook/src`
  nennt keine Abweisung von `BitmapFont`).
- Restplan gegen Paket 11 (`src/text/`) gehalten: SEC-001 und BUG-023
  (`readBitmapFontSource.ts`, `__proto__` und Entity-Tabelle) und BUG-024
  (`BitmapFont.ts:199`, Seitenzahl ohne Spread) ändern an Klasse und Liste der
  Abweisungen nichts; Paket 11 plant danach gegen den nachgezogenen Absatz.

## Triage

- **Proposal §4.4, Einleitungssatz** — Symptom von Paket 6. Prüffrage: hätte
  Paket 6 seine Ursache zu Ende behoben (Konvention »Geänderte Verträge in
  Guides und Proposals unter `docs/` nachziehen«), stünde §4.4 nicht ohne
  Klasse da. Paket 6 ist committet → gehört in dieses Nachtragspaket, das die
  Ursache zu Ende bringt; kein eigenes Paket.
- **`text.md:172–181`, zweiter Absatz »Refusals« (`writeText()`,
  `rewriteText()`, `layoutText()`)** — vorbestehend: am Laufbeginn
  (`git show 7341059f:packages/twopoint5d/docs/text.md`) wortgleich, und
  `writeText.ts` warf schon damals `TypeError` (Z. 51, 198) und `RangeError`
  (Z. 82), `layoutText.ts` `RangeError` über `assertPositiveFinite()` und
  `Error` (Z. 100–110). Eigene Ursache (der Absatz wurde ohne Klassen
  geschrieben), keine Lücke, die Paket 6 hinterlassen hat; dass er sechs
  Zeilen weiter in derselben Datei steht, ist kein Grund. → »Offene Befunde«,
  low, `→ Scope`.
- **Proposal §4.4 Z. 420–421** (`width`, `height` below 0) — vorbestehend:
  am Laufbeginn stand dort derselbe Text, und `AT_LEAST_ZERO` war schon
  `{x, y, width, height}`. Eigene Ursache (Proposal unvollständig gegen den
  Bau), der Einleitungssatz aus Schritt 2 berührt den Listenpunkt nicht. →
  »Offene Befunde«, low, `→ Scope`.
- Offene `Folgen:`-Zeilen anderer Pakete: keine — Paket 2 → 14, Paket 5 → 15,
  Paket 6 → 16, alle verteilt. Aus »Offene Befunde« nichts übernommen: keiner
  der fünf Einträge teilt die Ursache.
- Restplan: unverändert. Paket 16 bleibt vor Paket 7, von allen offenen
  Paketen unabhängig.

## Folge im Volltext

Aus Paket 6, `Folgen:`-Zeile im Plan:

> `packages/twopoint5d/docs/text.md:53–58` (»Refusals«) — nennt keine
> Fehlerklasse; seit diesem Paket weist `BitmapFont` seine Zahlen mit
> `RangeError` ab, der Guide sagt das nicht (Text stimmt sonst) · low →
> Paket 16 (Zug 0 von Paket 15, Symptom: Paket 6 hat den Guide nicht
> nachgezogen; Nachtragspaket statt des Vorschlags Paket 11, das nicht
> verursacht hat und an den Fehlerklassen nichts ändert)

Der Absatz reicht bis Z. 60 (die Folge nannte 53–58; Z. 58–60 tragen den
Kerning-Teil und den Satz zu den XML-Entities, die mit ersetzt werden).

Die Regeln aus `docs/proposals/README.md`, die dieses Paket tragen: ein Guide
»is the state of the code as it is, without exception — a guide that disagrees
with the code is wrong, and it is fixed along with the code. It names no
internal module, no test, no proposal, … and no history«; »The sections of an
implemented proposal state what is built«.
