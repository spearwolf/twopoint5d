# Paket 10 — Bitmap-Text: Layout, Font-Leser, Glyphen-Lebenszyklus

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-021 (low), BUG-022 (low), BUG-023 (low), BUG-024 (low), RES-006 (low), PERF-008 (low), COMP-001 (low), CONS-002 (low)
- Aufgenommen, gleiche Ursache:
  - zu BUG-024: die Leseseite. `BitmapFont#kerning(first, second)` (`BitmapFont.ts:292–297`) bildet für Zahlen, die der Aufrufer übergibt, denselben nicht injektiven Schlüssel: `font.kerning(66, 86 - 0x110000)` trifft das echte Paar `(65, 86)`. Ein Fix nur an der Schreibseite ließe denselben Zusammenstoß beim Lesen stehen
  - zu PERF-008: dasselbe Muster »alle vorwärts freigeben, dann neu schreiben« in den Lookbook-Demos, die als lebende Doku gelten: `apps/lookbook/src/demos/sine-scroller/SineScroller.ts:299` (`for (const glyph of this.#textGlyphs.splice(0)) this.text.freeSprite(glyph)`) und `apps/lookbook/src/demos/ui-panels/DungeonScreen.ts:101–103`/`:126` (`TextBlock#write()`/`#clear()`, sieben Textblöcke in einem gemeinsamen Pool `this.#text`)
  - zu CONS-002: die Präfixregel gilt für jede Meldung der Bibliothek, nicht nur für `texture/`. Der Scanner aus Schritt 6 findet heute 58 Meldungen, die nicht mit ihrem Subjekt ohne Klammern beginnen: 47 in Klammerform (`texture/`, `map2d/`, `controls/`, `display/`, `utils/`) und 11 ohne Subjekt (`display/`, `stage/`, `vertex-objects/`); Liste in Schritt 6
- Ziel: Das Layout behandelt Zeilenhöhe, hängende Leerzeichen, Tab und Steuerzeichen korrekt, Font-Leser und Kerning melden kaputte Eingaben mit Kontext, und `writeText` gibt bei Fehlern frei und verwendet Glyphen beim Textwechsel wieder.
- Modell: stärkste Stufe. Acht Findings über das Text-Modul, eine neue öffentliche Funktion (`rewriteText()`), ein Umbau des Zeilenumbruchs mit Unicode-Zeichenklassen und hängenden Leerzeichen, dazu ein mechanischer Sweep über die Fehlermeldungen von sechs Modulen samt ihrer Specs und einer neuen Regel in `AGENTS.md`
- Effort: medium. Jede Signatur, jede Zeichenklasse, jede Meldung und jede Fundstelle steht unten; die Formulierung von TSDoc, Leitfaden, Proposal und CHANGELOG nicht wörtlich
- Dateien:
  - `packages/twopoint5d/src/utils/assertPositiveFinite.ts`, `assertPositiveFinite.spec.ts`, neu `assertFinite.ts`, `assertFinite.spec.ts`
  - `packages/twopoint5d/src/text/BitmapFont.ts`, `BitmapFont.spec.ts`, `readBitmapFontSource.ts`, neu `codePoints.ts` (intern, nicht in `public-api.ts`)
  - `packages/twopoint5d/src/text/layoutText.ts`, `layoutText.spec.ts`
  - `packages/twopoint5d/src/text/writeText.ts`, `writeText.spec.ts`
  - `apps/lookbook/src/demos/sine-scroller/SineScroller.ts`, `apps/lookbook/src/demos/ui-panels/DungeonScreen.ts`
  - `packages/twopoint5d/docs/text.md`, `docs/architecture.md` (Abschnitt `text/`), `docs/sprites.md` (`:495`), `docs/proposals/dynamic-atlas-and-bitmap-text.md` (§4.4, §5.2–§5.4 und das Beispiel `:40–47`), `docs/proposals/animation-playback-and-aseprite.md` (`:394`, `:410`), `packages/twopoint5d/CHANGELOG.md`, `AGENTS.md` (Repo-Root)
  - Sweep (Schritt 6): `src/texture/TextureStore.ts`, `TextureResource.ts`, `TileSet.ts`, `checkTextureStoreData.ts`; `src/map2d/CameraBasedVisibility.ts`, `RectangularVisibilityArea.ts`, `Map2DSpatialHashGrid.ts`; `src/controls/PanControl2D.ts`; `src/display/Display.ts`; `src/stage/StageRenderer.ts`, `ProjectionPlane.ts`, `RootRenderPipeline.ts`, `outputNodeBuilders.ts`; `src/vertex-objects/VertexObjectPool.ts`, `createTypedArray.ts` — und jede Spec und jeder Browsertest, der eine dieser Meldungen prüft (bekannt: `TextureStore.spec.ts`, `TextureResource.spec.ts`, `TileSet.spec.ts`, `TileSpritesFactory.spec.ts`, `CameraBasedVisibility.spec.ts`, `RectangularVisibilityArea.spec.ts`, `Map2DSpatialHashGrid.spec.ts`, `Map2DTileStreamer.spec.ts`, `Map2DTileCoordsUtil.spec.ts`, `Map2D.spec.ts`, `outputNodeBuilders.spec.ts`, `ProjectionPlane.spec.ts`; weitere zeigt der Testlauf)
- Vorgehen: siehe unten, Schritte 1–7 in dieser Reihenfolge
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): let the spaces at the end of a line hang out of its width and alignment, set a tab as a space, drop control and format chars without drawing the fallback, break a line at U+2028, U+2029, U+200B, every breakable space and before an ideograph or a kana, refuse a line height that is not above 0, kerning pairs and numeric entities that are no code points and font data that is no object, free the glyphs written so far when createSprite() throws, add rewriteText() to write another text into the sprites of one, and start every error message of the library with its subject, unbracketed`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · BUG-021 unverändert (`layoutText.ts:94`, `:255`; `BitmapFont.ts:175–183`) · BUG-022 unverändert (`layoutText.ts:178`, `:233`) · BUG-023 unverändert (`readBitmapFontSource.ts:76–77`, `BitmapFont.ts:171`, `:208`) · BUG-024 unverändert (`BitmapFont.ts:242–251`, `:96`) · RES-006 unverändert (`writeText.ts:92–103`; der Wurf kommt aus `FeatureSprites#createSprite()` `:345–352` über `#grow()` `:356–367`, vom Audit-Stand `:324` gewandert) · PERF-008 unverändert (`writeText.ts:51`, `:92`; `docs/text.md:85`) · COMP-001 unverändert (`layoutText.ts:141`, `:224`) · CONS-002 im Text-Modul unverändert (`BitmapFont.ts:100`, `layoutText.ts:53`, `writeText.ts:75`, `utils/assertPositiveFinite.ts:10`), `TextureResource.ts:1024` → `:1131` gewandert, `TextureAtlasLoader.ts:85` unverändert, `VertexObjectPool.ts:438` → `:40`/`:46` gewandert · aufgenommen: Leseseite von `kerning()` zu BUG-024, Lookbook `SineScroller.ts:299` und `DungeonScreen.ts:101–126` zu PERF-008, alle 58 abweichenden Meldungen der Bibliothek zu CONS-002 · Folgen der Pakete 1–9: keine offen · aus »Offene Befunde«: nichts übernommen, kein Eintrag teilt eine Ursache mit diesem Paket · Scanner nach `paket-10.scan-messages.py` im Arbeitsverzeichnis
  - 2026-10-22 Zug 1: Implementierer beauftragt (Runde 0), opus, Effort medium, Brief `paket-10.impl-0.brief.txt`, Report nach `paket-10.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG_MIT_VORBEHALT (Vorbehalt: grep 2 aus 6.5 trifft den in 6.3 vorgeschriebenen Wortlaut `ProjectionPlane: up is mandatory …` — Widerspruch in der Paketdatei, kein Befund) · 52 Dateien geändert, 3 neu (`codePoints.ts`, `assertFinite.ts`, `assertFinite.spec.ts`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-10.verify.log`)
  - 2026-10-22 Zug 3: Reviewer beauftragt (Runde 0), opus, Effort medium, Diff `paket-10.diff` (4882 Zeilen), Report nach `paket-10.review-0.json`
  - 2026-10-22 Zug 3: Reviewer: alle acht Findings und drei aufgenommene Punkte behoben, fünf `klein`, kein `wichtig`/`kritisch` · Diff `paket-10.diff`
  - 2026-10-22 Zug 4: keine Runde nötig
  - 2026-10-22 Zug 5: committet 72127b52, Verify aus Zug 2 (`paket-10.verify.log`, exit=0) jünger als die letzte Codeänderung, Trailer `Remediation-Run: 2026-10-21`

## Was für das ganze Paket gilt

- `AGENTS.md` im Repo-Root zuerst lesen, dazu »Konventionen« im Kopf von `./remediation-plan.md`: Code, Kommentare, Doku, CHANGELOG und Commit auf Englisch, keine Finding-IDs, kein Rückblick auf den Vorzustand (»no longer«, »now«, »anymore«, »instead of before« fallen weg — ein Satz beschreibt, was gilt). `AGENTS.md` sagt auch: die Quellen von `src/text/` ganz lesen (fünf Dateien, unter 1000 Zeilen), nicht Symbol für Symbol greppen.
- `public-api.ts` des Text-Moduls re-exportiert `BitmapFont.ts` und `writeText.ts` mit `export *`. **Jeder Export aus diesen beiden Dateien wird öffentlich.** Interne Helfer gehören deshalb in `src/text/codePoints.ts` oder bleiben unexportiert; `layoutText.ts` wird nur namentlich re-exportiert (`layoutText` und drei Typen), `layoutTextFor` bleibt intern.
- Coverage-Schwellen in `packages/twopoint5d/vite.config.ts`: `src/text/**` 98/98/98/98, `src/utils/**` 88/89/83/87 (Statements/Branches/Functions/Lines). Jeder neue Zweig im Text-Modul bekommt einen Test; 98 % lassen auf rund 700 Zeilen kaum eine Zeile ohne Test.
- Bei jedem Korrektheitsfehler zuerst der Regressionstest, rot sehen, dann der Fix; der rote Lauf gehört in den Report. Rot sein müssen vor dem Fix mindestens: der `lineHeight`-Teil von BUG-021 (Option und Font), BUG-022, BUG-023 (alle drei Pfade), BUG-024 (Schreib- und Leseseite), RES-006, die Tab-, Steuerzeichen-, U+2028-, U+200B-, U+3000- und CJK-Fälle von COMP-001.
- Das Text-Modul liegt in keinem Release: `git show v0.23.0:packages/twopoint5d/src/text/BitmapFont.ts` gibt es nicht, `text/` steht unter `[Unreleased] → Added` (`CHANGELOG.md:36–37`). Seine Änderungen gehen deshalb **in diese beiden `Added`-Zeilen**, ohne `Changed`-Eintrag und ohne Migration Guide — wie `tableFrame()` in Paket 7 und `AdaptiveResolution` in Paket 4. Die Präfixe der Meldungen aus Schritt 6 lagen dagegen in `v0.23.0` vor und bekommen einen `Changed`-Eintrag (Schritt 7).
- Lookbook-Previews werden nicht neu erzeugt: kein Demotext endet auf Leerzeichen, trägt Tab oder Steuerzeichen; das Bild bleibt gleich.

## Schritt 1 — Zahlenprüfungen aus `utils/` (CONS-002, Teil Text-Modul)

1. Neu `packages/twopoint5d/src/utils/assertFinite.ts`:
   ```ts
   export function assertFinite(value: unknown, subject: string, name: string): number
   ```
   Antwortet `value`, wenn es eine endliche Zahl ist (`isFiniteNumber()` aus `./isFiniteNumber.js`), sonst `throw new RangeError(`${subject}: ${name} must be a finite number, got ${describeValue(value)}`)`. TSDoc im Ton von `assertPositiveFinite`: wofür (ein Wert, mit dem gerechnet wird, eine Position, ein Abstand), was die Meldung nennt.
2. `packages/twopoint5d/src/utils/assertPositiveFinite.ts`: Rückgabetyp `number` (antwortet `value`), Meldung `${subject}: ${name} must be a finite number above 0, got ${describeValue(value)}`. Die bestehenden Aufrufer in `map2d/` (`Map2DTileStreamer.ts:92`, `:103`, `:159`, `:160`; `Map2DSpatialHashGrid.ts:73`, `:74`; `Map2DTileCoordsUtil.ts:81`, `:94`) bleiben im Code, wie sie sind; ihre Specs erwarten `Map2DTileStreamer: tileWidth must be …` statt `[Map2DTileStreamer] tileWidth must be …` (`Map2D.spec.ts`, `Map2DTileStreamer.spec.ts`, `Map2DTileCoordsUtil.spec.ts`, `Map2DSpatialHashGrid.spec.ts`).
3. `assertPositiveFinite.spec.ts`: Erwartungen auf `Subject: size must be a finite number above 0, got …`, dazu ein Test, dass ein gültiger Wert zurückkommt. Neu `assertFinite.spec.ts`: ein String erscheint in Anführungszeichen, `NaN`, `Infinity`, `-Infinity` werden abgelehnt, `0`, `-1`, `0.5` kommen zurück.
4. `utils/` ist nicht öffentlich (`utils/public-api.ts` exportiert keine der beiden); so bleibt es.

## Schritt 2 — Font-Leser und Kerning (BUG-021 Font-Seite, BUG-023, BUG-024, CONS-002)

1. Neu `packages/twopoint5d/src/text/codePoints.ts`, intern:
   - `export const MAX_CODE_POINT = 0x10ffff;`
   - `export const isCodePoint = (value: unknown): value is number` — `typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_CODE_POINT`
   - `export const isScalarValue = (code: number): boolean` — `isCodePoint(code)` und nicht `0xd800 ≤ code ≤ 0xdfff` (ein Surrogat ist kein Zeichen, das XML referenzieren darf)
2. `BitmapFont.ts`:
   1. Das lokale `isFiniteNumber` (`:100`) entfällt, importiert wird `isFiniteNumber` aus `../utils/isFiniteNumber.js`.
   2. Als erste Prüfung des Konstruktors, vor `const {common} = data` (`:171`): ist `data` kein Objekt (`isObject()` aus `../utils/isObject.js`), dann `throw new Error(`${WHERE}: the font data is ${describeValue(data)} — a font is an object in the JSON layout, {pages, chars, common}`)`. Ein Array zählt als Objekt und fällt danach auf »no common block« — das bleibt so. Derselbe Weg fängt `BitmapFont.parse(null)` und `BitmapFont.parse(42)`, weil `readBitmapFontSource()` ein Nicht-String unverändert durchreicht.
   3. In der Schleife über `lineHeight`, `base`, `scaleW`, `scaleH` (`:175–183`) gilt »above 0« für alle außer `base`: `const above0 = key !== 'base';`. Die Meldung behält ihre Form: `BitmapFont: common.lineHeight must be a finite number above 0, got 0`. Eine Zeilenhöhe von 0 wird nicht zugelassen (Begründung unten).
   4. Die Prüfung der Char-ID (`:207`) läuft über `isCodePoint(id)`; Meldung `` `${WHERE}: a char has the id ${describeValue(id)} — an id is a whole number from 0 to 0x10FFFF` ``.
   5. Kerning-Paare (`:241–251`): `first` und `second` über `isCodePoint()`, sonst `` `${WHERE}: kerning pair ${index} has ${article(field)} ${field} of ${describeValue(value)} — first and second are code points, whole numbers from 0 to 0x10FFFF` ``; `amount` über `isFiniteNumber()`, sonst `` `${WHERE}: kerning pair ${index} has an amount of ${describeValue(value)} — a finite number` ``. Geprüft wird in der Reihenfolge `first`, `second`, `amount`; das erste Feld, das scheitert, wird genannt. Abgelehnt, nicht übersprungen (Begründung unten).
   6. `kerning(first, second)` (`:292–297`) antwortet 0, sobald einer der beiden Codes kein Code Point ist (`!isCodePoint(a) || !isCodePoint(b)`) — eine Zahl, die der Aufrufer übergibt, trifft so nie den Schlüssel eines anderen Paars. Kommentar an `pairKey` (`:95–96`) bleibt sinngemäß: injektiv für Code Points, und nur solche kommen hinein. TSDoc von `kerning()`: »0 without a pair, and for a number that is no code point«.
   7. TSDoc: `BitmapFontCommon.lineHeight` (`:51`) »The distance of two lines, in pixels, above 0.«; `@throws` des Konstruktors (`:164–168`) nennt Font-Daten, die kein Objekt sind, `lineHeight`, `scaleW`, `scaleH` über 0, die ID »a whole number from 0 to 0x10FFFF« und Kerning-Paare, deren `first` oder `second` kein Code Point oder deren `amount` keine endliche Zahl ist.
3. `readBitmapFontSource.ts`, `decodeEntities` (`:74–79`): eine numerische Entity, deren Wert kein Unicode Scalar Value ist — über U+10FFFF, ein Surrogat, oder so groß, dass `Number()` `Infinity` liefert —, bleibt stehen, wie sie geschrieben ist (`match`), so wie eine unbekannte benannte Entity heute stehen bleibt (`ENTITIES[name] ?? match`). Ein Satz Kommentar: warum stehen lassen und nicht werfen (eine Entity steht nur in Text-Attributen wie `face`; in einem Zahlenfeld lehnt `BitmapFont` den String ohnehin mit Feldnamen ab).
4. Tests in `BitmapFont.spec.ts` (vor dem Fix rot, wo es ein Fehler ist):
   - `new BitmapFont(null)`, `new BitmapFont(42)`, `BitmapFont.parse(null)` → `BitmapFont: the font data is null — …` bzw. `… is 42 — …`; kein `TypeError` »Cannot destructure«.
   - Tabelle `common.%s of %o` um `['lineHeight', 0, 'BitmapFont: common.lineHeight must be a finite number above 0, got 0']` und `['lineHeight', -10, '… got -10']` erweitern; die bestehende `NaN`-Zeile erwartet `… finite number above 0, got NaN`.
   - Char-ID: die Zeile `6.5` erwartet die neue Meldung; neu `{id: 0x110000}` → `BitmapFont: a char has the id 1114112 — an id is a whole number from 0 to 0x10FFFF`.
   - Kerning, Schreibseite: Tabelle über `{first: -1}`, `{first: 0x110000}`, `{second: 1.5}`, `{second: -0x110000 + 5}` (das Beispiel des Audits) mit je der Meldung; `amount: NaN` mit der neuen Meldung.
   - Kerning, Leseseite: `font.kerning(66, 86 - 0x110000)` → 0 (heute −1, der Wert des Paars `A`/`V`); `font.kerning(65.5, 86)` → 0.
   - XML: `<info face="A&#x110000;B&#xD800;C&#1114112;D&#99999999999999999999;"/>` liest `face` als genau diesen String (heute `RangeError: Invalid code point`). Die bestehende Zeile »an unknown entity stays« bleibt.
5. `docs/text.md`, Absatz »Refusals« (`:53–57`): `lineHeight` über 0, die ID als ganze Zahl von 0 bis 0x10FFFF, ein Kerning-Paar, dessen Zeichen keine Code Points sind oder dessen `amount` keine Zahl ist, Font-Daten, die kein Objekt sind; dazu ein Satz: eine numerische Entity im XML, die kein Code Point ist, bleibt stehen wie eine unbekannte. Proposal `dynamic-atlas-and-bitmap-text.md` §4.4 (`:373–380`) entsprechend.

## Schritt 3 — Zeilenlayout: Zeichenklassen, Umbruch, hängende Leerzeichen (BUG-021 Option, BUG-022, COMP-001, CONS-002)

Datei `packages/twopoint5d/src/text/layoutText.ts`.

1. **Optionen** (`resolveOptions()`, `:72–98`): `finite()` (`:53–58`) entfällt. `x`, `y`, `letterSpacing` über `assertFinite(value, where, name)`, `scale`, `lineHeight`, `maxWidth` über `assertPositiveFinite(value, where, name)`. Die Meldungen lauten damit `layoutText: scale must be a finite number above 0, got 0` (ohne »the«), `layoutText: lineHeight must be a finite number above 0, got -10`, `layoutText: x must be a finite number, got NaN`; aus `writeText()` und `rewriteText()` mit deren Namen. TSDoc von `TextLayoutOptions.lineHeight`: »above 0«.
2. **Zeichenklassen.** Jedes Zeichen des Texts (nach Code Point, `for … of`) fällt in genau eine Klasse, geprüft in dieser Reihenfolge:

   | Klasse | Zeichen | gesetzt als | Umbruch |
   | --- | --- | --- | --- |
   | Zeilenende | `\n` (U+000A), U+2028, U+2029 | — | beendet die Zeile |
   | umbrechbares Leerzeichen | U+0020, U+0009 (Tab), U+1680, U+2000–U+2006, U+2008–U+200A, U+205F, U+3000 | Tab: immer der Glyph von U+0020; die übrigen: ihr eigener Glyph, sonst der von U+0020 | Umbruchstelle, hängt am Zeilenende, fällt am Umbruch weg |
   | Umbruch ohne Breite | U+200B; ebenso ein umbrechbares Leerzeichen, für das der Font weder einen eigenen Glyph noch U+0020 hat | — (kein Eintrag, kein Platz) | Umbruchstelle vor dem nächsten Zeichen |
   | geschütztes Leerzeichen | U+00A0, U+2007, U+202F | ihr eigener Glyph, sonst der von U+0020; ohne beide fällt es weg | keine Umbruchstelle, zählt zum Wort und zur Zeilenbreite |
   | Steuer- und Formatzeichen | `\p{Cc}` und `\p{Cf}`, soweit nicht oben (also auch `\r`, U+00AD, U+200C–U+200F, U+2060, U+FEFF) | — fällt weg: kein Glyph, kein Platz, nie das `fallback`; ein Kerning-Paar bildet sich darüber hinweg, wie über ein fehlendes Zeichen | — |
   | übriges Zeichen | alles andere | sein Glyph, sonst `fallback`, sonst übersprungen (wie heute) | ein Zeichen von `\p{Script=Han}`, `\p{Script=Hiragana}` oder `\p{Script=Katakana}` ist eine Umbruchstelle **vor** sich — bestimmt am Zeichen des Texts, auch wenn es als `fallback` gezeichnet wird |

   Die Klassen als Regexe mit `u`-Flag oder als Vergleiche auf den Code Point, modulweit konstant (kein Regex-Literal je Zeichen neu); das Target ist ES2022 (`tsconfig.json:50`), Unicode Property Escapes stehen zur Verfügung. Ein Zeichen, das in die CJK-Klasse fällt, setzt nur »Umbruch davor«: ein Satzzeichen danach (`。`, `」`, Script Common) bleibt beim Zeichen davor und beginnt so nie eine Zeile. Weitere Kinsoku-Regeln gibt es nicht, Hangul bricht an Leerzeichen.
3. **Einträge statt nackter Glyphen.** Die Zeilen des Texts (`textLines`, `:217–226`) tragen je Zeichen einen internen Eintrag `{glyph: BitmapFontGlyph; space: boolean; breakBefore: boolean}` (Typ nicht exportiert). `space` ist wahr nur für umbrechbare Leerzeichen; `breakBefore` setzt ein CJK-Zeichen für sich selbst, ein Umbruch ohne Breite für den nächsten Eintrag. Kerning wird zwischen den Glyphen aufeinanderfolgender Einträge gebildet, Leerzeichen eingeschlossen, wie heute.
4. **`wrap()`** (`:132–180`): ein neuer Lauf beginnt, wo `space` wechselt **oder** ein Nicht-Leerzeichen-Eintrag `breakBefore` trägt. Zwei Wortläufe dürfen so ohne Leerzeichen dazwischen aufeinanderfolgen; zwischen ihnen ist `pendingSpaces` leer, und die Logik der Schleife (`:155–176`) bleibt sonst, wie sie ist: am Umbruch fallen die Leerzeichen weg, die führenden Leerzeichen einer Textzeile bleiben (Test `drops every space at a break and keeps the leading spaces of a line of the text` bleibt grün).
5. **Hängende Leerzeichen.** Die Breite einer Zeile misst nur bis zum letzten Eintrag, der kein umbrechbares Leerzeichen ist: der Stift nach diesem Glyph, weniger einem `letterSpacing` (`widthOf()`, `:100–111`, bekommt dieses Ende). Leerzeichen dahinter hängen: sie zählen weder in `lineWidth` noch in der Ausrichtung (`:233–235`) noch in `TextLayout.width`. Eine Zeile nur aus Leerzeichen ist 0 breit. Am Ende der letzten Zeile einer Textzeile (`:177–178`) bleiben sie für den Stift stehen, wie heute.
6. **Kein Glyph aus einem Leerzeichen.** Ein Eintrag mit `space: true` ergibt nie einen `TextLayoutGlyph`, auch wenn der Leerzeichen-Glyph des Fonts eine Box über 0 × 0 hat — das sagt `docs/text.md:124–125` schon (»A space moves the pen and yields no sprite«). Für alle anderen gilt weiter `glyph.width > 0 && glyph.height > 0` (`:241`).
7. **TSDoc**: `TextLayoutOptions.maxWidth` — eine Zeile bricht vor dem Wort, das sie zu breit machte: an einem umbrechbaren Leerzeichen, nach U+200B, vor einem Ideogramm oder Kana; `fallback` — nie für ein Leerzeichen, ein Zeilenende, ein Steuer- oder Formatzeichen; `TextLayout.width` — die breiteste Zeile, ihre Leerzeichen am Ende hängen hinaus; der Absatz »Chars are read …« in `layoutText()` (`:193–196`) mit den Regeln der Tabelle; `@throws {RangeError}` für `scale`, `lineHeight`, `maxWidth`, die keine endliche Zahl über 0 sind, und `x`, `y`, `letterSpacing`, die keine endliche Zahl sind.
8. **Tests in `layoutText.spec.ts`** (mit `tinyFontData()`: Leerzeichen 0 × 0 mit Vorschub 3, `A`/`V`/`-` mit Vorschub 4, Paar `A`→`V` −1; was der Font nicht hat, zeichnet `{fallback: '-'}`):
   - hängende Leerzeichen: `layoutText(font, 'A  ', {align: 'right'})` legt `A` bei x = −4 und antwortet `width` 4 (heute −10 und 10); `'AV'` und `'AV  '` legen unter `align: 'center'` das erste Glyph an dieselbe Stelle; `layoutText(font, 'A   ', {maxWidth: 5}).width` ist 4 (heute 13); `' \n  '` ist 0 breit.
   - Tab: `'A\tA'` legt das zweite `A` bei x = 7; mit `{maxWidth: 8}` zwei Zeilen; mit `{fallback: '-'}` kein `-`.
   - Steuer- und Formatzeichen: `'A\u0001­V﻿'` mit `{fallback: '-'}` ergibt genau `A` und `V`, und `V` steht bei x = 2 — Stift 4, Paar −1, `xoffset` −1 (das Kerning-Paar bildet sich über die weggefallenen Zeichen hinweg, wie die bestehende Probe `skips a char the font lacks, and the kerning pair forms across it` es für fehlende Zeichen zeigt).
   - U+2028 und U+2029 beginnen je eine Zeile wie `\n`.
   - U+200B: `'AV​AV'` ist ohne `maxWidth` eine Zeile ohne Lücke, mit `{maxWidth: 8}` zwei Zeilen.
   - U+3000 und U+00A0, die `tiny` nicht hat: `'A　A'` wird mit dem Vorschub des Leerzeichens gesetzt und bricht mit `{maxWidth: 8}` um; `'A A'` bricht mit `{maxWidth: 8}` nicht um, Breite 11; beide mit `{fallback: '-'}` ohne `-`.
   - ein Font ohne U+0020 (`tinyFontData()` ohne den Eintrag `id: 32`): `'A A'` legt das zweite `A` bei x = 4 und bricht mit `{maxWidth: 5}` um; mit `{fallback: '-'}` kein `-`.
   - CJK: `layoutText(font, '日本語。', {fallback: '-', maxWidth: 8})` legt vier `-` in zwei Zeilen, `日本` | `語。` — das `。` bleibt bei `語`; `'あいう'` mit `{fallback: '-', maxWidth: 8}` bricht nach zwei Zeichen.
   - Refusals: Tabelle `:205–214` auf die neuen Meldungen (ohne »the«), dazu `{lineHeight: 0}` und `{lineHeight: -10}` (heute angenommen, `height` −20).

## Schritt 4 — `writeText()` gibt bei einem Wurf frei, `rewriteText()` verwendet Glyphen weiter (RES-006, PERF-008, CONS-002)

Datei `packages/twopoint5d/src/text/writeText.ts`.

1. `z` über `assertFinite(options?.z ?? 0, WHERE, 'z')` (`:74–77`); Meldung `writeText: z must be a finite number, got NaN`.
2. **RES-006.** Die Erzeugungsschleife (`:92–103`) gibt auch frei, wenn `createSprite()` wirft — unter `grow` ein Pool, der nicht wachsen kann (Geometrie mit angehängten Pools, Geometrie im Slot, die die Sprites nicht gebaut haben; `FeatureSprites.ts:356–367`), oder ein werfender `onCreateVO`-Hook: die bis dahin erzeugten Sprites vom letzten zum ersten freigeben, dann denselben Fehler unverändert weiterwerfen. Der Pfad `sprite === undefined` bleibt mit seiner `RangeError`. TSDoc `@throws` von `writeText()`: »every error of `createSprite()`, after the sprites created so far are freed again«.
3. **PERF-008.** Neue öffentliche Funktion in derselben Datei (über `export *` öffentlich):
   ```ts
   export function rewriteText<Api extends TextSpriteApi>(
     sprites: FeatureSprites<Api>,
     glyphs: (Api & VO)[],
     font: BitmapFont,
     text: string,
     options?: WriteTextOptions,
   ): (Api & VO)[]
   ```
   Verhalten, in dieser Reihenfolge:
   1. Dieselben Prüfungen wie `writeText()` — Features, `z`, Layout —, die Meldungen mit `rewriteText` als Subjekt. Dann je Eintrag von `glyphs`: ein Sprite dieser Sprites (`sprites.spritePool.containsVO(glyph)`), sonst `` new TypeError(`rewriteText: glyph ${i} is no sprite of these sprites — hand in the array writeText() or rewriteText() answered for them`) ``. Alles, bevor sich etwas ändert.
   2. Disposed Sprites (`geometry == null`): `glyphs.length = 0`, `glyphs` zurück.
   3. `m` = Zahl der Glyphen des Layouts, `n` = `glyphs.length`.
      - `m > n`: `m − n` Sprites erzeugen, mit demselben Rückbau wie `writeText()` (bei `undefined` und bei einem Wurf; vom letzten zum ersten). Bei `undefined`: `` new RangeError(`rewriteText: "${preview(text)}" needs ${m} sprites, ${n} of them the glyphs handed in, and the pool ran full after ${k} more — give the sprites a larger capacity; the glyphs keep the text they had`) `` mit `k` = Zahl der erzeugten; bei einem Wurf derselbe Fehler. In beiden Fällen ist `glyphs` unverändert — Länge, Handles, Werte. Sonst die neuen hinten an `glyphs` anhängen.
      - `m < n`: `glyphs[n − 1]` bis `glyphs[m]` freigeben, vom letzten rückwärts; dann `glyphs.length = m`. Liegt der Text am Ende seines Pools, ist jedes Freigeben ein Pop, und kein anderes Sprite bewegt sich.
   4. Frame, Größe und Position in alle `m` schreiben, `glyphs[i]` ← `layout.glyphs[i]`, wie `writeText()` es tut.
   5. Jeden der ersten `min(n, m)` Glyphen zum Upload markieren: `sprites.spritePool!.touchVO(glyph)` ohne Attributnamen, also jeden Buffer des Slots. Der Pool wird **nach** dem Erzeugen gelesen — unter `grow` kann er gewachsen sein. `quadSize` und der Frame sind statisch (`docs/sprites.md:1008–1016`); ein Wert, den der Aufrufer nach dem Aufruf in den Glyph schreibt (eine Tönung), geht mit demselben `update()` hoch.
   6. `glyphs` zurück — dasselbe Array.

   TSDoc von `rewriteText()`: wofür (ein Text, der sich ändert: Punktestand, Dialog), dass es die Sprites eines früheren `writeText()`/`rewriteText()` auf diesen Sprites in Leserichtung weiterverwendet, den Überhang vom letzten Glyph rückwärts freigibt und nur fehlende anlegt; dass ein weiterverwendeter Glyph jeden Wert behält, den es nicht schreibt (Tönung, Rotation), ein neuer wie ein neues Sprite beginnt; dass `rewriteText(sprites, glyphs, font, '')` alle freigibt und das Array leert; dass `glyphs` an Ort und Stelle umgeschrieben und zurückgegeben wird; disposed Sprites; `@throws` wie `writeText()` plus der `TypeError` für einen fremden Glyph und die `RangeError` mit unverändertem `glyphs`.
4. Gemeinsames zieht in unexportierte Helfer derselben Datei (Prüfen und Layout, Ausdehnung der Basis lesen, Erzeugen mit Rückbau, Schreiben) — `writeText()` ist im Kern `rewriteText()` auf einem leeren Array, mit eigener Meldung für den vollen Pool. Die Meldung von `writeText()` bei vollem Pool bleibt wörtlich (`:98–100`).
5. **Tests in `writeText.spec.ts`** (vor dem Fix rot, wo es ein Fehler ist):
   - RES-006: Sprites mit `{capacity: 2, grow: true}`, ein angehängter Pool wie in `FeatureSprites.grow.spec.ts:311–324` (`sprites.geometry!.attachInstancedPool('extra', extra)`), ein Sprite davor schon belegt; `writeText(sprites, font, 'AVAV')` wirft den Fehler von `createSprite()` (»… has pools attached …«), `usedCount` steht danach wieder bei 1, das Sprite davor ist noch im Pool. Heute bleibt das erste Glyph im Pool (rot).
   - `rewriteText()`:
     - verwendet die Handles weiter: `'AV'` → `'AVA'` antwortet dasselbe Array, `[0]` und `[1]` dieselben Objekte, eines neu; Frames, Größen, Positionen wie `writeText()` für `'AVA'`.
     - ein kürzerer Text gibt vom Ende her frei: ein Sprite vor dem Text belegt, `writeText(…, 'AVAV')`, dann `rewriteText(…, 'AV')` → `usedCount` 3, das Sprite davor und die zwei verbliebenen Glyphen an ihren Slots (`VOUtils.getIndex()` aus `src/vertex-objects/VOUtils.ts:22`).
     - markiert die Slots der weiterverwendeten Glyphen: Upload-Ranges der Buffer leeren, `rewriteText()`, dann decken die Ranges von `quadSize` und `texCoords` den Slot ab — Muster `uploaded()`/`uploadsSlot()` in `src/map2d/TileSprites/TileSpritesFactory.spec.ts:25–30`.
     - ein leerer Text gibt alle frei und leert das Array.
     - ein voller Pool: `{capacity: 4}`, `glyphs = writeText(…, 'AV')`, `rewriteText(…, 'AVAVAV')` wirft die `RangeError` mit der Meldung oben; `usedCount` unverändert, `glyphs` gleich lang, dieselben Handles mit ihren Positionen.
     - ein Wurf von `createSprite()` unter `grow` (wie oben) lässt `glyphs` und `usedCount` stehen.
     - ein Glyph anderer Sprites → `TypeError` mit Index, nichts geändert.
     - Ablehnungen von Optionen nennen `rewriteText` (`{scale: -1}`, `{z: NaN}`).
     - disposed Sprites: `glyphs` geleert und zurückgegeben.
   - Bestehende Erwartungen: `options it refuses are named as options of writeText` auf `writeText: scale must be …` und `writeText: z must be …`.
6. **Lookbook** (gleiche Ursache, siehe oben):
   - `SineScroller.ts:296–312` `#writeStaticText()`: statt `#textGlyphs` zwei Felder `readonly #titleGlyphs: PixelGlyph[] = []` und `readonly #infoGlyphs: PixelGlyph[] = []`, je über `rewriteText(this.text, this.#titleGlyphs, font, TITLE_TEXT, …)` bzw. `INFO_TEXT`; die Tönung danach über alle Glyphen des Arrays wie heute. `#textGlyphs` entfällt, falls es sonst nirgends gelesen wird (`:147`, `:299`, `:311` sind die einzigen Stellen).
   - `DungeonScreen.ts:91–129` `TextBlock`: `readonly glyphs: TexturedSprite[] = []`; `write()` ruft `rewriteText(this.sprites, this.glyphs, this.font, text, options)` statt `clear()` + `writeText()`, `clear()` ruft `rewriteText(this.sprites, this.glyphs, this.font, '')`. Der Klassenkommentar sagt, dass der Block seine Sprites beim Textwechsel weiterverwendet. Imports anpassen.
   - `pnpm typecheck` prüft beide; ein Browserlauf der Demos ist nicht nötig.

## Schritt 5 — Leitfaden, Architektur, Proposal

1. `docs/text.md`:
   - Das Beispiel `rewrite` (`:83–88`): `rewriteText(text, glyphs, font, next, {x: 0, y: 40, align: 'center', scale: 2})`, danach die Tönung über `glyphs`, dann `text.update()`; `rewriteText` in den Import. Der Block bleibt `ts check`.
   - Absatz »Freeing« (`:132–134`): Text wechseln mit `rewriteText()`; wer selbst freigibt, gibt vom letzten Glyph zum ersten frei (Begründung in einem Halbsatz: `freeSprite()` zieht das letzte Sprite des Pools in die Lücke); `rewriteText(sprites, glyphs, font, '')` gibt alle frei.
   - Absatz »What is written« (`:116–120`): ein von `rewriteText()` weiterverwendeter Glyph behält Tönung und Rotation; `rewriteText()` markiert seine Slots, ein `touchVO()` braucht es dafür nicht.
   - Absätze »Chars« (`:122–125`) und »Word wrap« (`:127–130`) mit den Regeln aus Schritt 3: Zeilenenden, Tab als Leerzeichen, umbrechbare und geschützte Leerzeichen, U+200B, Umbruch vor Ideogramm und Kana, Steuer- und Formatzeichen fallen weg und werden nie zum `fallback`, Leerzeichen am Zeilenende hängen aus Breite und Ausrichtung heraus.
   - Absatz »Coordinates« (`:101–103`): eine Zeile ist so breit wie der Stift nach ihrem letzten Zeichen, das kein Leerzeichen ist.
   - Absatz »Refusals« (`:141–146`): ein Wurf von `createSprite()` gibt die erzeugten Sprites frei und geht weiter; `lineHeight` über 0; `rewriteText()` lehnt einen Glyph anderer Sprites ab und lässt bei vollem Pool den alten Text stehen.
   - Prosa ≤ 100 Zeichen je Zeile wie im Rest der Datei.
2. `docs/architecture.md` Abschnitt `text/` (`:197–208`): `rewriteText()` schreibt einen anderen Text in die Sprites eines Texts und verwendet sie weiter. `docs/sprites.md:495`: `rewriteText()` neben `writeText()` und `layoutText()`.
3. Proposal `docs/proposals/dynamic-atlas-and-bitmap-text.md` (Status »implemented«, beschreibt das gebaute Text-Modul): §5.2 »Word wrap« und der Absatz über Zeichen (`:468–476`) mit den Regeln aus Schritt 3; `:466` die Breite ohne hängende Leerzeichen; §5.3 (`:496–499`) das Freigeben vom letzten Glyph rückwärts und `rewriteText()`; §5.4 (`:501–515`) die Ablehnung `lineHeight` über 0 und der Wurf von `createSprite()`; das Beispiel `:46` gibt vom letzten Glyph rückwärts frei oder ruft `rewriteText(text, glyphs, font, '')`. Kein Rückblick: das Proposal sagt, was gilt.

## Schritt 6 — eine Präfixregel für jede Meldung der Bibliothek (CONS-002)

1. **Regel in `AGENTS.md`**, Abschnitt »Rules you cannot read off the code« (`:96` ff.), als eigener Punkt nach »Public surface« oder »Imports«, sinngemäß:

   > **Error and warning messages** start with their subject, unbracketed: the class (`BitmapFont: …`), the call — `VertexObjectPool#sortBy(): …`, `new Display(): …`, `RootRenderPipeline.buildOutputNode(): …` —, or a function by its bare name (`writeText: …`). A quoted name may follow the subject where it tells instances apart (`FeatureSprites "hud": …`). The subject is followed by a colon and what is wrong, or a sentence goes on from it (`StageRenderer#add() cannot take …`). A number check goes through `assertFinite()` or `assertPositiveFinite()` in `src/utils/`, which write `Subject: name must be a finite number …, got …`. A failure of `expectDefined()` reports a broken invariant of the library, not a refusal, and names no subject; the refusals a feature's `checkKind` throws get theirs from `defineSprite()`.

   Kein Satz über die alte Klammerform. `docs/resource-lifecycle.md` bleibt unberührt (sein »an error naming the call and the state«, `:171`, stimmt weiter).
2. **Klammerform → Subjekt mit Doppelpunkt.** `[X] …` wird `X: …`; das erste Wort nach dem Doppelpunkt klein, wenn es kein Name ist (`[TextureStore] No resource with id` → `TextureStore: no resource with id`), der Rest der Meldung bleibt wörtlich. Fundstellen (Zeilen heute):
   - `src/texture/TextureStore.ts:120`, `:123`, `:127`, `:134`, `:139`, `:150`, `:155`, `:157`, `:440`, `:445`, `:451`, `:667`, `:791`, `:796`, `:803`, `:811`, `:825`, `:837`, `:859`, `:1094` (Warnung)
   - `src/texture/checkTextureStoreData.ts:23`, `:29`, `:34`
   - `src/texture/TextureResource.ts:186`, `:1061`, `:1110`, `:1131`, `:1176`, `:1242`, `:1247`
   - `src/texture/TileSet.ts:55`, `:61`
   - `src/map2d/CameraBasedVisibility.ts:276`, `:310`, `:362`; `RectangularVisibilityArea.ts:16`; `Map2DSpatialHashGrid.ts:36`, `:183`
   - `src/controls/PanControl2D.ts:296` (Warnung); `src/display/Display.ts:1920` (Warnung)
   - `src/utils/assertPositiveFinite.ts:10` (Schritt 1)
3. **Ohne Subjekt → mit Subjekt**, genau diese Wortlaute:
   - `src/display/Display.ts:47–50` (Warnung, zwei Argumente): das erste wird `` `Display: the canvas width or height should not be bigger than ${Display.MaxResolution} device pixels (${w}x${h} was requested).` ``, das zweite bleibt.
   - `src/display/Display.ts:1182–1185` (Warnung, zwei Argumente): ein Argument, `'new Display(): a WebGLRenderer is not supported — the first argument is a WebGPURenderer or an HTML element'` (der Versionssatz »Since twopoint5d@0.13 … anymore« ist ein Rückblick und entfällt).
   - `src/display/Display.ts:1186` und `:1252` (`TypeError`): `'new Display(): the first argument is a WebGPURenderer or an HTML element'`.
   - `src/stage/StageRenderer.ts:767` (`TypeError`, in `renderTo()`): `'StageRenderer#renderTo(): a WebGLRenderer is not supported — render with a WebGPURenderer'`.
   - `src/stage/ProjectionPlane.ts:33`: `'ProjectionPlane: up is mandatory for a custom projection plane'`.
   - `src/stage/RootRenderPipeline.ts:29`: `'RootRenderPipeline.buildOutputNode(): no passes to compose'`.
   - `src/stage/outputNodeBuilders.ts:79`: `'createBloomOutputNodeBuilder: the builder it built is not available: this builder has been disposed'`; `:82`: `'createBloomOutputNodeBuilder: the builder it built has no passes to compose'`.
   - `src/vertex-objects/VertexObjectPool.ts:153`: `'VertexObjectPool#resize() is only allowed before …'` — Subjekt vorangestellt, der Rest bleibt.
   - `src/vertex-objects/createTypedArray.ts:34`, `:38`: `typedArrayOf(): ` → `typedArrayOf: ` (Funktion mit bloßem Namen).
4. **Specs, Browsertests, Doku mitziehen.** Jede Erwartung auf eine geänderte Meldung — als String, als Regex (`/\[TextureStore\]/`, `/^\[TileSet\] /`) oder als `new Error(…)` — auf die neue Form. Bekannt sind die Dateien in »Dateien« oben; `grep -rnE '\[(TextureStore|TextureResource|TileSet|CameraBasedVisibility|RectangularVisibilityArea|Map2DSpatialHashGrid|Map2DTileStreamer|Map2DTileCoordsUtil|PanControl2D|Display|Subject)\\?\]' packages/twopoint5d/src packages/twopoint5d-testing/test` und `grep -rn "The Display constructor\|not supported anymore\|up is mandatory\|The builder of createBloom\|typedArrayOf(): \|'resize() is only" packages/twopoint5d/src packages/twopoint5d-testing/test` finden den Rest (am 2026-10-22 geprüft: beide treffen heute nur Meldungen und ihre Erwartungen; `apps/lookbook/src` bleibt draußen, dort steht nur der TSDoc-Link `[[Display]]` in `demos/utils/PerspectiveOrbitDemo.ts:13`, keine Meldung). Doku: `docs/proposals/animation-playback-and-aseprite.md:394`, `:410` zitieren Meldungen in Klammerform → neue Form. `CHANGELOG.md:4381` liegt in einem freigegebenen Abschnitt (`[0.23.0]` und älter) und bleibt.
5. **Abnahme**, vor dem Report selbst gelaufen und mit Ausgabe in den Report:
   - `python3 -I /tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad/paket-10.scan-messages.py packages/twopoint5d/src` listet danach genau sieben Zeilen und keine andere: `sprites/features/NineSlice.ts` (2), `sprites/features/SegmentPlacement.ts`, `sprites/features/Wave.ts`, `sprites/features/segmentChecks.ts`, `sprites/passes/refuseSegments.ts` — Bruchstücke, denen `defineSprite()` `defineSprite: feature "…": ` voranstellt (`sprites/defineSprite.ts:196–197`) — und `utils/expectDefined.ts` (Invariante). Die Zeilennummern dürfen wandern. Der Scanner liegt außerhalb des Repos und wird nicht eingecheckt.
   - die beiden `grep` aus Punkt 4 finden nichts mehr.

## Schritt 7 — CHANGELOG

Skill `updating-changelog` für Form und Ort.

1. `[Unreleased] → Added`, die Zeilen `:36` (`text/` und `BitmapFont`) und `:37` (`writeText()`/`layoutText()`), umgeschrieben auf das, was gilt: `lineHeight` über 0 in Font und Option; Font-Daten, die kein Objekt sind, Kerning-Paare, deren Zeichen keine Code Points sind, werden abgelehnt; eine numerische Entity, die kein Code Point ist, bleibt stehen; Zeilenenden `\n`, U+2028, U+2029; Tab als Leerzeichen; Umbruch an umbrechbaren Leerzeichen, nach U+200B und vor Ideogramm und Kana; Steuer- und Formatzeichen fallen weg, nie das `fallback`; Leerzeichen am Zeilenende hängen aus Breite und Ausrichtung heraus; ein Wurf von `createSprite()` gibt die erzeugten Sprites frei; dazu `rewriteText(sprites, glyphs, font, text, options?)` — in `:37` oder als eigene `Added`-Zeile direkt dahinter. Kein `Changed`, kein Migration Guide für das Text-Modul (unveröffentlicht, siehe oben).
2. `[Unreleased] → Changed`, eine neue Zeile: jede Fehlermeldung und Warnung der Bibliothek beginnt mit ihrem Subjekt ohne Klammern — die Meldungen von `TextureStore`, `TextureResource`, `TileSet`, `CameraBasedVisibility`, `RectangularVisibilityArea`, `Map2DSpatialHashGrid`, `Map2DTileStreamer`, `Map2DTileCoordsUtil`, `PanControl2D` und `Display` mit `Subject: …`, dazu die Meldungen von `new Display()`, `StageRenderer#renderTo()`, `ProjectionPlane`, `RootRenderPipeline.buildOutputNode()`, `createBloomOutputNodeBuilder` und `VertexObjectPool#resize()` mit ihrem Subjekt vorn; ein Log-Filter oder Test auf `[TextureStore]` greift auf `TextureStore:`. Kein Abschnitt im `### Migration Guide`: der Wortlaut einer Meldung ist keine API, der Hinweis in der Zeile genügt.

## Entscheidungen und Abweichungen in diesem Paket

- **Ein Paket, kein Split.** CONS-002 reicht über sechs Module, gehört aber einer Ursache (keine geschriebene Regel, lokale Nachbauten der `utils/`-Prüfungen), und der Text-Teil sitzt in denselben Zeilen wie BUG-021 und BUG-023. Ein Teilpaket `10a`/`10b` würde die Paketnummer, unter der die Schleife diesen Zug 0 ausgewertet hat, aus dem Plan nehmen (`marker_of 10` fände kein `### [~] 10.` mehr, die Schleife hielte mit Exit 10). Der Sweep ist mechanisch, die Fundstellen stehen oben einzeln, die Abnahme ist ein Scanner-Lauf; Paket 8 hat mit einem Sweep über 22 Dateien in einem Paket 0 Runden gebraucht.
- **Kein Umbau über mehrere Pakete.** Der Sweep ändert in `TileSet.ts` (Paket 11) und `TextureResource.ts`, `TextureStore.ts`, `checkTextureStoreData.ts` (Paket 13) nur den Anfang von Meldungstexten, keine Struktur, keine Signatur, keine Fundstelle eines ihrer Findings. Ihr Zug 0 gleicht gegen diesen Stand ab.
- **Die Präfixregel ist »Subjekt vorn, ohne Klammern«, nicht »immer `Klasse#methode(): `«.** Das Audit schlägt die Methodenform vor, »das schon die Mehrheit trägt«. Gezählt: die Mehrheit trägt das Subjekt vorn in drei Spielarten — Klasse (`BitmapFont: `), Aufruf (`VertexObjectPool#sortBy(): `), Funktion mit bloßem Namen (`wave: `, `sampleAtlasFrame: `, `writeText: `) —, und rund 40 Meldungen gehen nach dem Subjekt als Satz weiter, darunter jede Meldung des Dispose-Vertrags (`Display#${member} is not available: this display has been disposed`, ebenso `Stage2D`, `StageRenderer`, `VertexObjectPool`, `VOBufferPool`, `VertexObjectBuffer`, `DynamicAtlas`). Eine Pflicht zur Methodenform hätte diese Meldungen und ~15 Funktionspräfixe umgeschrieben, ohne dass ein Filter auf den Subjektnamen danach mehr träfe. Die Klammerform ist die einzige, die ein Präfixfilter auf `TextureStore` nicht trifft; sie fällt, ebenso jede Meldung ohne Subjekt.
- **`lineHeight` 0 wird abgelehnt, nicht zugelassen.** Eine Zeilenhöhe von 0 stapelt jede Zeile auf die erste und meldet `height: 0`; ein Panel, das sich danach richtet, bekommt keine Höhe. Wer Zeilen übereinanderlegen will, schreibt sie einzeln an dieselbe Stelle.
- **Kerning-Paare mit ungültigen Codes werden abgelehnt, nicht übersprungen** — wie Chars mit ungültiger ID; ein Font, der so etwas schreibt, ist kaputt, und still verworfene Paare fielen erst am Bildschirm auf.
- **Numerische Entities ohne Code Point bleiben stehen**, statt zu werfen — wie unbekannte benannte Entities (`readBitmapFontSource.ts:78`); eine Entity steht nur in Text-Attributen (`face`, `charset`, `file`), in Zahlenfeldern lehnt `BitmapFont` den String mit Feldnamen ab.
- **COMP-001: Tab als ein Leerzeichen, keine Tabstopps, keine Option `breakChars`.** Die Empfehlung nennt »Tab als Leerzeichenbreite«; Tabstopps verlangten eine Spaltenbreite, die ein Bitmap-Font nicht hat, und eine Ausrichtung, die mit `align: 'center'` nicht zusammengeht. Weitere Umbruchstellen kommen über feste Zeichenklassen (U+200B, die Leerzeichen aus Zs, Ideogramm und Kana), nicht über eine Option: eine Option wäre öffentliche Oberfläche ohne bekannten Aufrufer. Umbruch nur **vor** Ideogramm und Kana, damit ein schließendes Satzzeichen nie eine Zeile beginnt; ein öffnendes kann am Zeilenende stehen bleiben, weitere Kinsoku-Regeln gibt es nicht.
- **`rewriteText()` als Funktion, nicht als Text-Objekt.** Das Modul ist eine Sammlung von Funktionen über Sprites (»It is a function over sprites, not a mesh of its own«, `docs/architecture.md:207`); ein besitzendes Objekt hätte einen eigenen Lebenszyklus mit `dispose()` und einen Platz in `docs/resource-lifecycle.md` gebraucht. Das Array wird an Ort und Stelle umgeschrieben, damit beim Aufrufer kein Array mit freigegebenen Handles zurückbleibt.
- **Lookbook-Demos mitgezogen**, obwohl ihr Muster weiter funktioniert: sie gelten als lebende Doku (`AGENTS.md`, »Projects«) und zeigen das vorwärts freigebende Muster, das PERF-008 bemängelt.

## Restplan

Reihenfolge und Schnitt von Paket 11, 12 und 13 unverändert. Paket 10 stellt die Klammer-Präfixe in `TileSet.ts:55`, `:61` (Paket 11) und in `TextureResource.ts`, `TextureStore.ts`, `checkTextureStoreData.ts` (Paket 13) auf `X: ` um und schreibt die Regel in `AGENTS.md`; neue Meldungen dort folgen ihr. Paket 12 ändert `docs/proposals/dynamic-atlas-and-bitmap-text.md` in einem anderen Abschnitt (kaputtes Bild ohne `size`) als Paket 10 (§4.4, §5).

## Findings im Volltext

**BUG-021 · low · packages/twopoint5d/src/text/layoutText.ts:94** — `lineHeight` von Layout und Font auf Werte über 0 beschränken
Weitere Fundstellen: `layoutText.ts:255`, `BitmapFont.ts:175`
`resolveOptions()` prüft `lineHeight` nur auf Endlichkeit, `scale` und `maxWidth` dagegen auf > 0. Ein negatives `lineHeight` legt Zeile 1 über Zeile 0 und meldet eine negative Höhe; 0 stapelt alle Zeilen aufeinander mit `height: 0`. Der BitmapFont-Konstruktor akzeptiert `common.lineHeight` ≤ 0 aus der Datei genauso, und das wird dann der Default jedes Layouts. Ein Panel, das sich nach `layout.height` richtet, bekommt eine negative Größe.
Beleg: `layoutText(font, 'A\nB', {lineHeight: -10})` → `height: -20`, Glyph-y `[0, 10]` (Zeile 2 liegt oberhalb von Zeile 1)
Empfehlung: `finite(where, 'lineHeight', …, true)` wie bei `scale`; im BitmapFont-Konstruktor `lineHeight` > 0 verlangen (`base` darf bleiben, wie es ist). Ist eine Zeilenhöhe von 0 gewollt, sie ausdrücklich zulassen und dokumentieren.

**BUG-022 · low · packages/twopoint5d/src/text/layoutText.ts:178** — Leerzeichen am Zeilenende aus Zeilenbreite und Ausrichtung herausnehmen
Weitere Fundstellen: `layoutText.ts:233`
`wrap()` hängt die Leerzeichen am Ende eines Absatzes an die letzte Zeile, und `widthOf()` zählt sie mit. Bei `align: 'center'`/`'right'` verschiebt ein Leerzeichen am Ende den sichtbaren Text nach links, und `TextLayout.width` wird größer als die sichtbaren Glyphen und auch größer als `maxWidth`. An einem Umbruch werden dieselben Leerzeichen dagegen verworfen: der Absatz richtet sich je nach Zeile unterschiedlich aus. Nutzerstrings wie `'Score: 100 '` sind dafür der typische Fall.
Beleg: center: `'AB'` → erstes Glyph bei x = -8, `'AB  '` → x = -16; `'hello   '` mit `maxWidth: 10` → `width` 64 statt 40
Empfehlung: Für Breite und Ausrichtung die Leerzeichen am Zeilenende nicht mitzählen (sie »hängen« wie in CSS) und sie höchstens für den Pen behalten. Soll das bisherige Verhalten bleiben, es in docs/text.md unter »Word wrap« ausdrücklich nennen.

**BUG-023 · low · packages/twopoint5d/src/text/readBitmapFontSource.ts:76** — Fehlerpfade des Font-Lesers mit Kontext und richtiger Regel melden
Weitere Fundstellen: `readBitmapFontSource.ts:77`, `BitmapFont.ts:171`, `BitmapFont.ts:208`
Die Refusals des Moduls sind sonst ausführlich (`BitmapFont: …`). Drei Pfade fallen heraus: eine numerische XML-Entity über U+10FFFF wirft aus `String.fromCodePoint` einen nackten `RangeError: Invalid code point 1114112` ohne Hinweis auf Font oder Attribut; `BitmapFont.parse(null)` bzw. ein Nicht-Objekt landet in `const {common} = data` als `TypeError: Cannot destructure property 'common'`; eine Char-ID über 0x10FFFF wird abgelehnt mit »an id is a whole number of 0 or more« — die Obergrenze, an der es scheitert, steht nicht in der Meldung.
Beleg: `readBitmapFontSource('<font><info face="A&#x110000;"/>…')` → `RangeError Invalid code point 1114112`
Empfehlung: In `decodeEntities` den Codepoint prüfen (0…0x10FFFF, sonst Entity stehen lassen oder `BitmapFont: …` werfen); im Konstruktor `data` auf Objekt prüfen; die ID-Meldung auf »a whole number from 0 to 0x10FFFF« ändern.

**BUG-024 · low · packages/twopoint5d/src/text/BitmapFont.ts:243** — Kerning-Paare auf gültige Codepoints prüfen
Weitere Fundstellen: `BitmapFont.ts:96`
`first` und `second` eines Kerning-Paars werden nur auf Endlichkeit geprüft, die Char-IDs dagegen auf ganze Zahlen 0…0x10FFFF. `pairKey()` = `first * 0x110000 + second` ist nur für gültige Codepoints injektiv: ein Paar mit negativem, gebrochenem oder zu großem Wert landet still auf dem Schlüssel eines anderen, echten Paars und verschiebt dort Glyphen.
Beleg: `kernings: [{first: 1, second: -0x110000 + 5, amount: 3}]` → `font.kerning(0, 5)` liefert 3
Empfehlung: Für `first`/`second` dieselbe Prüfung wie für Char-IDs (`Number.isInteger`, 0…0x10FFFF) und sonst mit Index ablehnen — oder solche Paare überspringen und das dokumentieren.

**RES-006 · low · packages/twopoint5d/src/text/writeText.ts:94** — Bereits angelegte Glyphen freigeben, wenn `createSprite()` wirft
`writeText()` gibt die schon erzeugten Sprites nur frei, wenn `createSprite()` `undefined` liefert. Unter `grow: true` mit angehängten Pools (`attachInstancedPool()`) wirft `createSprite()` stattdessen (FeatureSprites.ts:324). Dann verlässt die Exception die Schleife, `created` geht verloren, und die bis dahin angelegten Glyphen bleiben als unsichtbare Sprites (Größe 0) dauerhaft im Pool — kein Aufrufer hält einen Handle darauf. Die Doku verspricht für den vollen Pool »nothing of the text is left behind«.
Beleg: `const sprite = sprites.createSprite();` ohne try/catch; Rollback nur im Zweig `sprite === undefined`
Empfehlung: Die Erzeugungsschleife in `try { … } catch (e) { for (j = created.length - 1; j >= 0; j--) sprites.freeSprite(created[j]); throw e; }` fassen.

**PERF-008 · low · packages/twopoint5d/src/text/writeText.ts:92** — Bei Textwechsel Glyphen-Sprites wiederverwenden statt alle freizugeben und neu anzulegen
Weitere Fundstellen: `writeText.ts:51`
`writeText()` behält nichts und gibt ein nacktes Array zurück; ein Textwechsel heißt für den Aufrufer: n Sprites freigeben, m neu anlegen, alle statischen Attribute (quadSize, atlasFrame) neu hochladen. Das Muster in docs/text.md (»rewrite«) gibt vorwärts frei (`glyphs.splice(0)`): liegt der Text am Ende des Pools, kopiert jedes `freeVO()` den letzten Slot in die Lücke (n × `copyWithin` plus Upload), während Freigeben in umgekehrter Reihenfolge reine Pops wären — `writeText()` selbst macht es im Rollback deshalb rückwärts (Zeile 96). In einem geteilten Pool verschiebt jedes Freigeben fremde Sprites und ändert deren Zeichenreihenfolge. Und wer das Freigeben vergisst, füllt den Pool; unter `grow: true` wächst die Geometrie dann bei jedem Textwechsel weiter — ein Leak, den die API leicht macht.
Beleg: docs/text.md:85 `for (const glyph of glyphs.splice(0)) text.freeSprite(glyph);`
Empfehlung: Einen besitzenden Helfer anbieten (z. B. `rewriteText(sprites, glyphs, font, text, options)` oder ein kleines Text-Objekt mit `set(text)`/`free()`), der min(n, m) Sprites weiterverwendet, den Überhang vom Ende her rückwärts freigibt und nur fehlende anlegt. Mindestens das Doku-Beispiel auf rückwärtiges Freigeben umstellen.

**COMP-001 · low · packages/twopoint5d/src/text/layoutText.ts:141** — Weitere Umbruchstellen und Whitespace im Layout berücksichtigen
Weitere Fundstellen: `layoutText.ts:224`
Umbrochen wird nur an U+0020. Ein Tab ist keine Umbruchstelle und wird, weil der Font ihn meist nicht hat, still verschluckt oder mit gesetztem `fallback` als `'?'` gezeichnet; dasselbe gilt für U+200B, U+3000 und andere Steuer- und Leerzeichen. CJK-Text ohne Leerzeichen läuft als ein einziges »Wort« über `maxWidth` hinaus. Die Doku sagt das für den Fallback zwar, ein Tab als Fragezeichen dürfte trotzdem überraschen.
Beleg: `layoutText(font, 'aa\tbb\tcc', {maxWidth: 10})` → eine Zeile `aabbcc`, Tabs ohne Breite
Empfehlung: Tab als Leerzeichenbreite (oder n Leerzeichen) behandeln, Steuerzeichen nie durch den Fallback ersetzen und optional zusätzliche Umbruchstellen zulassen (z. B. Option `breakChars` oder Umbruch zwischen CJK-Ideogrammen).

**CONS-002 · low · packages/twopoint5d/src/text/BitmapFont.ts:100** — Ein Präfixformat für Fehlermeldungen festlegen und die Zahlen-Guards aus `utils/` verwenden
Weitere Fundstellen: `layoutText.ts:53`, `writeText.ts:75`, `utils/assertPositiveFinite.ts:10`, `texture/TextureResource.ts:1024`, `texture/TextureAtlasLoader.ts:85`, `vertex-objects/VertexObjectPool.ts:438`
Das Text-Modul definiert seine eigenen Prüfungen, obwohl `utils/` sie schon hat: BitmapFont.ts ein lokales `isFiniteNumber` (identisch mit utils/isFiniteNumber.ts), layoutText.ts ein `finite()` neben `assertPositiveFinite`, writeText.ts eine dritte Inline-Prüfung für `z`. Dazu kommen zwei Präfix-Konventionen für Fehlermeldungen: `BitmapFont: …`/`writeText: …` im Text-Modul, `[subject] …` in assertPositiveFinite und `[PanControl2D] …` in den Controls. Das sind drei Stellen, die bei einer Änderung der Regel auseinanderlaufen können, und Meldungen, die sich nicht einheitlich filtern lassen. Projektweit ist es dasselbe Bild: dieselbe Meldung »is no texture atlas json« heißt in `TextureResource.ts` `[TextureResource] …`, in `TextureAtlasLoader.ts` `TextureAtlasLoader: …`; `vertex-objects` und `sprites` schreiben `Klasse#methode(): …`. Im Quelltext stehen 15 Meldungen mit `[X]`-Präfix gegen rund 50 mit `X: `/`X#m(): `, `texture/` mischt beide fast hälftig.
Beleg: BitmapFont.ts:100 `const isFiniteNumber = (value: unknown): value is number => …` vs. utils/isFiniteNumber.ts:4
Empfehlung: Ein Format festlegen (etwa `Klasse#methode(): …`, das schon die Mehrheit trägt), in `docs/resource-lifecycle.md` oder AGENTS.md als Regel aufschreiben und `assertPositiveFinite` sowie die `[X]`-Meldungen in `texture/` darauf umstellen. Im Text-Modul `isFiniteNumber` aus `utils/` importieren und `finite()` dorthin ziehen.

## Urteil des Reviewers (Runde 0)

- BUG-021 behoben — `src/text/layoutText.ts:118`, `src/text/BitmapFont.ts:183–191`, TSDoc `BitmapFont.ts:54`, `layoutText.ts:18`
- BUG-022 behoben — `layoutText.ts:166–176`, `:238`, `:292–294`
- BUG-023 behoben — `readBitmapFontSource.ts:75–85`, `BitmapFont.ts:174–178`, `:215–217`
- BUG-024 behoben — `BitmapFont.ts:249–263`, `:98–100`; Leseseite `kerning()` `:303–309`
- RES-006 behoben — `writeText.ts:62–87` (`createSprites`), genutzt `:148`, `:207`
- PERF-008 behoben — `writeText.ts:182–225` (`rewriteText()`), `docs/text.md:88`, `:156–162`; Lookbook `SineScroller.ts:301–318`, `DungeonScreen.ts:91–129`
- COMP-001 behoben — `layoutText.ts:61–74`, `:125–161`, `:200–205`, `:300`
- CONS-002 behoben — `utils/assertFinite.ts`, `utils/assertPositiveFinite.ts:10`, `layoutText.ts:113–119`, `writeText.ts:55`, `BitmapFont.ts:4`; Regel `AGENTS.md:103–112`; CHANGELOG `Changed` `CHANGELOG.md:96`; Scanner zeigt nur die sieben vorgesehenen Reste

Abweichungen des Implementierers (vom Reviewer nicht beanstandet): `rewriteText()` prüft disposed Sprites vor `containsVO()` (sonst griffe 3.2 nie); ein übersprungenes Ideogramm lässt die Umbruchstelle für den nächsten Eintrag stehen; grep 2 aus 6.5 trifft den in 6.3 vorgeschriebenen Wortlaut `ProjectionPlane: up is mandatory …` — Widerspruch der Paketdatei, kein Befund.

Kleine Befunde:
- `src/text/layoutText.ts:152` — `pendingBreak` geht von einem übersprungenen CJK-Zeichen auf den nächsten Eintrag über; ist das ein `。`, kann es eine Zeile beginnen, während TSDoc `:264–265`, Kommentar `:73` und `docs/text.md:148` »a closing mark never starts a line« ohne Einschränkung sagen (nur bei Font mit Satzzeichen ohne Ideogramme)
- `docs/text.md:139` — »A space … yields no sprite« gilt nur für umbrechbare Leerzeichen; ein geschütztes Leerzeichen mit Rückfall auf einen U+0020-Glyph mit Box ergibt ein Sprite (so von der Paketdatei verlangt)
- `src/text/writeText.ts:191` — Kommentar »… any more« trifft wörtlich die Rückblick-Verbotsliste, obwohl er einen Laufzeitzustand beschreibt
- `docs/proposals/dynamic-atlas-and-bitmap-text.md` Bullet »font data that is no object: …« mit 132 Zeichen Prosa
- `docs/text.md` Tabelle der Zeichenklassen: Spalte »set as« trägt in »line end« und »break without width« Umbruchverhalten; die Umbruchspalte fehlt

Nebenbefund (→ Queue, Urteil `→ Scope`, weil die Scope-Regel jede Severity und jeden im Lauf auffallenden Befund deckt): Prosa über 100 Zeichen in `docs/text.md`, `docs/sprites.md`, `docs/proposals/dynamic-atlas-and-bitmap-text.md`, vorbestehend in `2fc5ddd2`.
