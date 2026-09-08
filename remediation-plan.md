# Remediation-Plan — @spearwolf/twopoint5d

Quelle: ./audit.html vom 2026-09-07 · Branch: main · erstellt: 2026-09-07
Baseline: `pnpm run ci` ✓ (vollständig grün, exit=0, 2026-09-07)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/7618965c-615e-4b00-8547-17aa42994db9/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Scope: 70 von 132 Findings (0 critical, 0 high, 2 medium, 51 low, 17 info) · ausgenommen: alles nicht Gelistete, PERF-008, acknowledged
Scope-Regel: die vom Nutzer gelistete Auswahl. Für Befunde, die erst im Lauf auffallen: fällt in einer angefassten Datei ein echter Korrektheitsdefekt auf — Bug, Leak, Race —, wird er in diesem Lauf mit behoben; Kosmetik, Doku und Stilfragen gehen als neues Finding ins Audit.
Stand (2026-09-08): Lauf abgeschlossen. Zwölf Pakete committet, von `bc38818`
bis `72d2893`, kein Paket blockiert. Abschließender Verify-Lauf `pnpm run ci`
grün (exit=0), gleich der Baseline. Die Befund-Queue ist gedraint: sieben
Einträge gingen in die Pakete 10 bis 12, dreizehn in die `audit.html` — zehn
davon als neue Findings, drei als Fundstellen-Nachtrag in Altbefunden, die
denselben Sachverhalt schon führten (API-037, DOC-020, IMPL-002). Semver-Bewertung: breaking — entfernte Exporte, getauschte
Symbolschlüssel, read-only gewordene Felder und Setter, die jetzt werfen; bei
`0.21.2` wäre das `0.22.0`. Angehoben wird die Version hier nicht: das Projekt
sammelt unter `[Unreleased]` und setzt die Nummer beim Release (Entscheidung
vom 2026-09-08). BUG-058 und BUG-059 standen in keinem Paket und sind mit
Paket 1 gegenstandslos geworden — am Code verifiziert, im Report geschlossen.

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[!]` blockiert.

## Entscheidungen

- **TextureStore.load()** — nur additiv: die Instanz-Methode gibt die intern
  ohnehin vorhandene Promise zurück (`void` → `Promise` bricht keinen
  Aufrufer), dazu TSDoc, das die drei `load()`-Bedeutungen trennt. Die
  Umbenennung nach `activate()`/`loadAsync()` bleibt für den nächsten Major
  zurückgestellt. (2026-09-07)
- **Öffentliche API voll durchziehen** — die fünf im Audit als Major-Material
  notierten Punkte werden umgesetzt statt deprecated: neue Symbolschlüssel
  ersetzen die alten, der doppelte Timing-Typ wird zusammengelegt, der
  Zwilling `freeTileSprite()` fällt weg, die Setter für abgeleitete Werte
  verlassen die öffentliche Fläche. Das Release ist damit ein Breaking Change;
  bei `0.x` heißt das ein Minor-Bump. (2026-09-07)
- **Perf-Umbauten** — der Dedup-Cache für Bild-Fetches kommt, der
  RenderTarget-Pool nicht. Für den Pool gilt die Einschätzung des Audits: er
  lohnt erst, wenn eine reale Szene mehr als zwei, drei verschachtelte
  Pipelines fährt. Er bleibt als offenes Finding stehen. (2026-09-07)
- **Paket 5 bleibt committet, sein Review wird nachgezogen** — der Commit
  `4d723fe` entstand ohne Implementierer- und Reviewer-Beleg: der Runner hat
  den Code selbst geschrieben. Der Verify-Lauf lief dabei echt und grün
  (`--skip-nx-cache`, exit=0), und die Regressionstests liegen bei. Der Commit
  bleibt stehen; im Abschluss läuft ein Review über seinen Diff, und was es
  findet, wird als eigenes Paket nachgezogen. (2026-09-08)

- **Version bleibt auf `0.21.2`, der CHANGELOG sammelt weiter unter
  `[Unreleased]`** — die Bewertung des Laufs lautet breaking und damit `0.22.0`,
  aber die Historie des Projekts zeigt, dass die Nummer beim Release gesetzt
  wird und nicht bei jedem Merge: der `[Unreleased]`-Abschnitt trägt Einträge
  aus mehreren Commits, und `package.json` steht seit dem Release vom
  2026-06-19 unverändert. Die Anhebung gehört zum Release, nicht zu diesem
  Lauf. (2026-09-08)
- **BUG-058 und BUG-059 werden im Report geschlossen** — beide standen in
  keinem Paket, sind aber mit Paket 1 gegenstandslos geworden und wurden am
  Code verifiziert: der Cast ist durch das typisierte `coordsTarget` ersetzt
  (`PanControl2D.ts:420`), und die Konstruktorkette wirft im `else`
  (`Display.ts:451-455`). (2026-09-08)

## Konventionen

Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise, Commit-Messages:

- Inline-Kommentare sind erwünscht, wo sie erklären, *warum* etwas so ist.
- Keine Finding-IDs, auch nicht in der Commit-Message. Sie gehören diesem einen
  Audit, sind danach tot, und die Commit-Message überdauert den Lauf. Sie leben
  in diesem Plan und sonst nirgends; die Verbindung zwischen Finding und Commit
  trägt das Feld `Hash:` unter dem Paket — in genau der Richtung, in der jemand
  sie später sucht. Eine Commit-Message sagt in eigenen Worten, was sie ändert.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.

Projektspezifisch ergänzend:

- `AGENTS.md` im Repo-Root ist verbindlich und wird vor der ersten Änderung
  gelesen. `pnpm run ci` ist das Verify-Gate; ohne grünen Lauf kein Commit.
- `pnpm publishNpmPkg` und `scripts/publishNpmPkg.mjs` werden in diesem Lauf
  unter keinen Umständen ausgeführt.
- Code, Kommentare und Dokumentation im Paket `twopoint5d` sind englisch —
  die Sprache der Umgebung gewinnt. Der Plan hier bleibt deutsch.

## Vorbestehende Fehler

Keine. Die Baseline lief vollständig grün.

## Offene Befunde

Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] **→ Paket 10** (Drain-Runde 2026-09-08) `packages/twopoint5d/src/controls/PanControl2D.ts:218` (`set keyboardDisabled`) —
  wird die Tastatur abgeschaltet, während eine Taste gehalten wird, bleibt das
  zugehörige `speed…`-Feld stehen; das `keyup` erreicht das Control nie mehr, und
  `update()` schiebt die `panView` von da an dauerhaft weiter. Aus Paket 1
  (Gegenstück zum Pointer-Fall, aber eigene Ursache). Vorbestehend, belegt gegen
  `a9f7dd1` — der Setter räumte auch dort nichts auf. Geschätzt medium.
  → Scope
- [x] **→ Paket 10** (Drain-Runde 2026-09-08) `packages/twopoint5d/src/controls/PanControl2D.ts:233` (`set pointerDisabled`) —
  ein `pointerDisabled = true` mitten im Zug lässt `#hideCursorState` auf `YES` und
  die Cursor-Klasse auf dem `cursorStylesTarget` liegen, während `#onPointerUp`
  bereits abgemeldet ist; der Cursor bleibt unsichtbar, bis das Control disposed
  wird. Aus Paket 1. Vorbestehend, belegt gegen `a9f7dd1`. Geschätzt low.
  → Scope
- [x] **→ Paket 10** (Drain-Runde 2026-09-08) `packages/twopoint5d/src/display/Display.ts:415-435` — wirft die
  Renderer-Erzeugung im `HTMLElement`-Zweig, hängt der selbst gebaute Container
  bereits im DOM; es entsteht keine Instanz, und niemand ruft `dispose()`. Dasselbe
  Leck, das Paket 1 für den normalen Weg geschlossen hat, auf dem Fehlerweg. Aus
  Paket 1. Vorbestehend, belegt gegen `a9f7dd1` — der `appendChild` stand auch dort
  vor dem Aufruf. Geschätzt low.
  → Scope
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:56-59`
  (`getInstanceCount()`) — das TSDoc trägt ein offenes »TODO remove?!«. Die
  Methode hat Aufrufer in den Specs; die Frage steht unbeantwortet im Quelltext
  und beantwortet sich dort auch nicht. Aus Paket 6. Vorbestehend — Paket 6 hat
  die Datei nur am `voPrototype` angefasst. Doku, kein Korrektheitsdefekt.
  Geschätzt info. → Audit
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts:200` — das TSDoc von
  `fromBuffersData()` beginnt mit »NOTE: The capacity should be the same as the
  original pool«. Der Code lässt keine Wahl: `:203` wirft bei jeder abweichenden
  Kapazität. »should« gegen »must«. Aus Paket 6. Vorbestehend — der Wurf stand
  auch vor dem Getter-Umbau dort. Doku. Geschätzt info. → Audit
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:73,76,86,96,110`
  — die Kommentare in `resize()` sagen, was die nächste Zeile tut, nicht warum
  (»Create a new buffer with the new capacity«, »Copy existing data…«, »Resize
  the voIndex array…«, »Adjust usedCount if necessary«). Die Konvention dieses
  Laufs verlangt das Gegenteil, und die inhaltlich tragenden Kommentare derselben
  Methode (`:97-98`) machen es vor. Aus Paket 6. Vorbestehend. Stilfrage.
  Geschätzt info. → Audit
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/CHANGELOG.md:62` — der Unreleased-Eintrag »change the
  return type of `FrameLoop#start()` to `(() => void) | undefined`« beschreibt ein
  Verhalten, das der Code nicht hat: `FrameLoop#start()`
  (`src/display/FrameLoop.ts`) ist als `() => void` deklariert und gibt auch für ein
  `null`-Target und ein bereits laufendes Target immer eine Funktion zurück;
  `FrameLoop.spec.ts` prüft das ausdrücklich. Aus Paket 1. Vorbestehend, belegt
  gegen `a9f7dd1`. Doku, kein Korrektheitsdefekt — die Scope-Regel schickt ihn
  weiter. Geschätzt low. → Audit
- [x] `packages/twopoint5d/src/texture/TextureResource.ts:19` (`getTimingOptions`,
  gerufen in `:565` und `:664`) — **→ Paket 3** (Zug 0 am 2026-09-07: gleiche Ursache
  wie das Paket, Fix als Schritt 6 im Detailplan). Ein Animationseintrag ohne
  `duration` und ohne `frameRate` lässt den Effektlauf werfen. Der Wurf verlässt den Effekt über den
  globalen Fehlerkanal von signalize, nicht über ein `error`-Event; keine einzige
  Animation der Map wird registriert, und der Aufrufer erfährt nichts. Aus Paket 2.
  Vorbestehend, belegt gegen `a9f7dd1` — die Funktion steht dort unverändert auf
  derselben Zeile. Geschätzt low. → Scope
- [x] `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:129` — **→ Paket 3**
  (Zug 0 am 2026-09-07, zusammen mit dem Eintrag darüber; die Begründung unten trägt
  nur halb: über `Object.entries` eines `Record` kann kein doppelter Name entstehen,
  wohl aber wirft `resolveDuration` bei `frameRate: 0`, und jeder Wurf aus `add()`
  nimmt denselben Weg). `add()` wirft
  bei einem doppelten Animationsnamen, und dieser Wurf nimmt denselben Weg aus dem
  Effekt heraus wie der Eintrag darüber: kein `error`-Event, keine Animation, keine
  Meldung. Aus Paket 2. Vorbestehend, belegt gegen `a9f7dd1`. Geschätzt low.
  Die Scope-Regel nennt die angefasste Datei, und `FrameBasedAnimations.ts` gehört
  nicht dazu — der Defekt bricht aber durch `TextureResource.ts` heraus, das Paket 2
  umgebaut hat, und ist derselbe wie der Eintrag darüber. Zwei Ausgänge desselben
  Lochs verschieden zu behandeln, wäre Willkür. → Scope
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/texture/TextureResource.ts:260` (`refCount`) — ein
  öffentliches, frei beschreibbares Feld, an dem `TextureStore#clearUnused()` und
  `parse({evictMissing: true})` über Leben und Tod einer Resource entscheiden; ein
  fremder Schreiber hebelt beides aus. Aus Paket 2. Vorbestehend, belegt gegen
  `a9f7dd1` (dort `:187`, ebenfalls public). Kapselung, kein Korrektheitsdefekt —
  die Scope-Regel schickt ihn weiter. Geschätzt low. → Audit
- [x] **→ Paket 11** (Drain-Runde 2026-09-08) `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:87` — wirft
  `TexturePackerJson.parse()` auf einer JSON, die den Formcheck passiert hat, aber
  im Inneren nicht trägt, dann geschieht das im `onLoad`-Callback des
  `TextureImageLoader`. Von dort erreicht der Wurf keinen `onErrorCallback`, also
  settlet die Promise aus `loadAsync()` nie und der Aufrufer wartet für immer. Aus
  Paket 3. Vorbestehend, belegt gegen `77e030b` — der `parse()`-Aufruf steht dort an
  derselben Stelle im selben Callback. Hängende Promise, also ein echter
  Korrektheitsdefekt in einer angefassten Datei. Geschätzt low. → Scope
  Anmerkung Zug 0 Paket 9 (2026-09-07): Paket 9 vertieft das Prädikat davor und nimmt
  damit den wahrscheinlichsten Weg in diesen Hänger heraus; der Mechanismus bleibt, weil
  jeder andere Wurf im `onLoad`-Callback denselben Weg nimmt. Der Eintrag bleibt offen.
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:95` — der
  Progress-Callback an `fileLoader.load()` ist ein leerer Rumpf mit
  `// TODO add optional onProgressCallback parameter?`. Anders als beim Bild-Load
  liefert `FileLoader` echten XHR-Fortschritt: hier gäbe es etwas zu melden, und
  niemand kann es abholen. Aus Paket 3. Vorbestehend, belegt gegen `77e030b`.
  Fehlendes Feature, kein Korrektheitsdefekt — die Scope-Regel schickt ihn weiter.
  Geschätzt info. → Audit
- [x] **→ Paket 11** (Drain-Runde 2026-09-08) `packages/twopoint5d/src/texture/TextureResource.ts:522` — der `.catch()` des
  Bild-Effekts fängt nicht nur den Bild-Fetch, sondern alles, was aus dem `batch()`
  darüber herauswirft; die abgeleiteten Effekte laufen synchron darin. Ein Wurf von
  dort wird als `{source: 'image', url, error}` gemeldet, mit einer URL, die nie
  gescheitert ist. Paket 3 hat den Animationsfall aus diesem Weg herausgenommen, die
  Verwechslung bleibt für jeden anderen abgeleiteten Effekt. Aus Paket 3.
  Vorbestehend, belegt gegen `77e030b`. Falsch zugeordneter Fehler, also ein echter
  Korrektheitsdefekt in einer angefassten Datei. Geschätzt low. → Scope
- [x] **→ Paket 11** (Drain-Runde 2026-09-08) `packages/twopoint5d/src/texture/TextureResource.ts:617-639` — der
  `atlasUrl`-Pfad der Resource benutzt den `TextureAtlasLoader` nicht, sondern fetcht
  selbst und liest `this.atlasJson.meta.image` (`:639`, ebenso `:657`) ohne jede
  Formprüfung. Zwei Ausgänge: eine 200-Antwort, die keine Atlas-JSON ist, wirft einen
  `TypeError` innerhalb eines Effekts — genau das, was die Statusprüfung darüber
  abwenden soll —, und eine JSON ohne `meta.image` und ohne `overrideImageUrl`
  schreibt `undefined` auf `#imageUrl`, worauf die Resource still ohne Bild und ohne
  `error`-Event bleibt. Zwei Wege zum selben Ziel mit zwei Sicherheitsniveaus: der
  Loader meldet beides seit Paket 3, die Resource keines. Aus Paket 3.
  Vorbestehend, belegt gegen `77e030b`. Echter Korrektheitsdefekt in einer
  angefassten Datei. Geschätzt low. → Scope
- [x] `packages/twopoint5d/src/texture/TextureResource.spec.ts:53` — **→ Paket 9**
  (Zug 0 am 2026-09-07: dieselbe Ursache wie das Paket — eine Zusage, die die Suite
  nicht hält —, und es ist die Datei, in der Paket 9 seinen unterscheidenden Test
  unterbringt; Fix als Schritt 4 im Detailplan). Das `afterEach`
  stellt nur die sinon-Sandbox zurück. Die `vi.spyOn(ImageLoader.prototype,
  'loadAsync')` mehrerer Tests werden nie zurückgenommen, und
  `packages/twopoint5d/vite.config.ts` setzt kein `restoreMocks`. Ein Mock überlebt
  damit seinen Test und liegt über allen folgenden derselben Datei — eine Suite, die
  aus dem falschen Grund grün sein kann. Aus Paket 3. Vorbestehend, belegt gegen
  `77e030b`. Echter Defekt in einer angefassten Datei, auch wenn er nur die Tests
  trifft. Geschätzt low. → Scope
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/texture/TextureAtlas.ts:3` —
  `export type TextureAtlasFrameData = Record<string, any>;`, ein `any` in einem
  exportierten Typ. TYPE-007 nennt drei andere Stellen, diese nicht. Aus Paket 3.
  Vorbestehend, belegt gegen `77e030b`. Typschärfe, kein Korrektheitsdefekt — die
  Scope-Regel schickt ihn weiter. Geschätzt info. → Audit
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:83` — die geworfene
  Meldung beginnt mit `TODO too many animation frames - we need better way here…`.
  Eine Notiz an die eigene Adresse, die beim Nutzer landet. Aus Paket 3.
  Vorbestehend, belegt gegen `77e030b`. Kosmetik in einer Fehlermeldung — die
  Scope-Regel schickt ihn weiter. Geschätzt info. → Audit
- [x] `packages/twopoint5d/src/map2d/Map2D.ts:14` (`set tileStreamer`) — **erledigt in
  Paket 5** (`4d723fe`, Schritt 5). Der neue
  Streamer startet mit leerer `tiles`-Liste, während die Renderer die Kacheln des alten
  noch in ihrer `#tiles`-Map halten. Der nächste `update()` meldet sie als `createTiles`,
  `addTile()` überschreibt den Map-Eintrag, ohne den vorherigen über `destroyTile()`
  zurückzugeben — bei `TileSpritesFactory` bleibt pro Kachel ein `instancedPool`-Slot
  belegt, den nichts mehr erreicht. Ein `clearTiles()` im Setter würde das schließen. Aus
  Paket 4. Vorbestehend, belegt gegen `a9f7dd1` — der Setter tauschte auch dort nur die
  Renderer um, ohne zu räumen. Echter Leak in einer angefassten Datei. Geschätzt low.
  → Scope
- [x] `packages/twopoint5d/src/map2d/Map2D.ts:14` (`set tileStreamer`) — **erledigt in
  Paket 5** (`4d723fe`, Schritt 5, zusammen mit dem Eintrag darüber). `centerX` und
  `centerY` wandern nicht auf den neuen Streamer mit. Der Aufrufer liest über `Map2D`
  nach dem Wechsel eine Ansichtsmitte, die er nie geschrieben hat, und die Karte steht an
  einer anderen Stelle als die Anwendung annimmt. Aus Paket 4. Vorbestehend, belegt gegen
  `a9f7dd1` — derselbe Setter, dieselbe Lücke. Falscher Zustand nach einem legalen
  Aufruf, also ein Korrektheitsdefekt in einer angefassten Datei. Geschätzt low. → Scope
- [x] `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:66`
  (`readDataIdAt`) — **erledigt in Paket 5** (`4d723fe`, Schritt 1; inhaltlich dieselbe
  Lücke, die BUG-036 beschreibt, nur aus der anderen Richtung notiert — eine Dublette,
  kein zweiter Sachverhalt). Das TSDoc verspricht `undefined` für Koordinaten außerhalb des
  Chunks. `readDataIdAtLocal()` rechnet aber `y * width + x` ohne Bereichsprüfung: ein `x`
  links oder rechts daneben landet in der Nachbarzeile desselben Arrays und liefert eine
  fremde, gültig aussehende Daten-Id statt `undefined`. Nur ein `y` außerhalb fällt
  wirklich heraus. `containsDataAt()` existiert bereits und wäre der Guard. Aus Paket 4.
  Vorbestehend, belegt gegen `a9f7dd1` — die Zeile steht dort wörtlich so. Echter
  Korrektheitsdefekt in einer angefassten Datei. Geschätzt low. → Scope
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:116` — das TSDoc über
  `lookAtCenter` sagt »If `lookAtCenter` is set to *true* (default)«, das Feld steht auf
  `false`. Wer die Doku liest, baut auf einem Vorgabewert, den es nicht gibt. Aus Paket 4.
  Vorbestehend, belegt gegen `a9f7dd1` — dort dieselbe Zeile mit demselben Widerspruch.
  Doku, kein Korrektheitsdefekt — die Scope-Regel schickt ihn weiter. Geschätzt low.
  → Audit
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:418` — `findVisibleTiles()`
  ist als `IMap2DVisibleTiles | undefined` deklariert, hat aber genau ein `return`, und
  das ist ein Objektliteral. Die tote Breite im Rückgabetyp zwingt jeden Leser dazu, die
  `undefined`-Ausgänge der Klasse selbst nachzuzählen. Aus Paket 4. Vorbestehend, belegt
  gegen `a9f7dd1` (dort `:380`, dieselbe Signatur). Typschärfe, kein Korrektheitsdefekt —
  die Scope-Regel schickt ihn weiter. Geschätzt info. → Audit
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/map2d/types.ts:112, 126-128` — `tiles`, `removeTiles`,
  `reuseTiles` und `createTiles` in `IMap2DVisibleTiles` stehen ohne jedes TSDoc, während
  `offset`, `translate` und `changed` daneben dokumentiert sind. Weil die vier Felder
  nichts über sich sagen, muss die Aufteilung in der Methodenbeschreibung von
  `computeVisibleTiles()` miterklärt werden — dort ist sie in diesem Paket zweimal
  danebengegangen. Aus Paket 4. Vorbestehend, belegt gegen `a9f7dd1`. Doku, kein
  Korrektheitsdefekt — die Scope-Regel schickt ihn weiter. Geschätzt info. → Audit
- [x] **→ Paket 12** (Drain-Runde 2026-09-08) `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:154` und `:182`
  (`getTileIdsWithin()`, Zweige `horizontal` und `none`) — die Musterspalte wird mit
  `col = (col + x) % this.#cols` fortgeschaltet, also mit der aufgelaufenen Zielbreite
  statt mit der Länge des zuletzt kopierten Stücks (`tiles.length`). Ab der dritten
  Schleifenrunde bricht die Wiederholung: `new RepeatingTilesProvider([[1,2,3]])
  .getTileIdsWithin(1, 0, 10, 1)` liefert `[2,3,1,2,3,3,3,1,2,3]` statt
  `[2,3,1,2,3,1,2,3,1,2]`. Mit `left = 0` bleibt es unauffällig, weil dort jede Runde an
  der Musterkante endet — deshalb fällt es keiner Spec und keinem Lookbook-Demo auf. Aus
  Paket 5. Vorbestehend, belegt gegen `a9f7dd1` — dieselbe Zeile dort auf `:137` und
  `:165`. Falsche Kachel-Ids aus einer öffentlichen Methode, also ein echter
  Korrektheitsdefekt in einer angefassten Datei. Geschätzt medium. → Scope
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/stage/ParallaxProjection.ts:77` (`getZoom()`) — die
  Methode trägt statt eines TSDoc die Notiz `// TODO add jsdoc`. Sie ist öffentlich
  und rechnet mit dem Abstand zur Projektionsebene; wer sie aufruft, bekommt keine
  Auskunft darüber, was der Rückgabewert bedeutet. Aus Paket 7 — Paket 7 hat die
  Datei nur an der Konstruktorsignatur angefasst. Vorbestehend, belegt gegen
  `a9f7dd1` — dort dieselbe Zeile 77. Fehlende Doku, kein Korrektheitsdefekt — die
  Scope-Regel schickt ihn weiter. Geschätzt info. → Audit
- [x] **→ Audit (eingetragen 2026-09-08)** `packages/twopoint5d/src/texture/PowerOf2ImageLoader.ts:38` — der Canvas-Zweig
  für Bilder ohne Zweierpotenz-Kantenlänge schreibt
  `canvas.getContext('2d')!.drawImage(img, 0, 0)`. Gibt `getContext()` `null` zurück —
  ein erschöpftes Kontext-Kontingent des Browsers, ein Canvas, an dem bereits ein anderer
  Kontexttyp hängt —, wirft der Zugriff einen `TypeError` im `load`-Handler des
  three.js-`ImageLoader`. Von dort erreicht er keinen `onErrorCallback`, also settlet die
  Promise aus `loadAsync()` nie: derselbe Hänger wie in `TextureAtlasLoader.ts:102`, eine
  Ebene tiefer und aus eigener Ursache — ein `!`, das behauptet, was die Plattform nicht
  zusagt. Aus Paket 11. Vorbestehend — die Datei ist in diesem Lauf nie angefasst worden
  (`git log a9f7dd1..HEAD` auf sie ist leer) und wird von Paket 11 auch nicht angefasst.
  Die Scope-Regel nennt für neu auffallende Befunde die angefasste Datei; diese ist es
  nicht. Geschätzt low. → Audit

## Pakete

### [x] 1. Display und PanControl2D: Aufräumen, Messen, Melden
- Findings: LEAK-004 (medium), BUG-057 (medium), BUG-052, BUG-055, BUG-056,
  BUG-060, API-033, API-042, API-043, DOC-017, CONS-020, PERF-015
- Ziel: Display gibt beim Entsorgen zurück, was es selbst gebaut hat, misst und
  meldet Zeigerbewegungen gegen die richtige Bezugsfläche und lässt keine
  Rejection unbehandelt.
- Bereich: `packages/twopoint5d/src/display/`, `src/controls/PanControl2D.ts`
- Hängt ab von: —
- Hash: bc38818
- Ergebnis: 1 Runde · alle 12 Findings behoben, vom Reviewer je mit Fundstelle
  bestätigt · Regressionstests, jeder vor seinem Fix rot:
  `measures the rate after a pause without the samples from before it` (57 statt
  30), `carries its event keys under a namespaced symbol`,
  `takes the container it built out of the host` (Host behielt 1 Kind),
  `Display — what the constructor accepts and what it reports` (ganze Datei, der
  Fehlerweg war vor dem Fix nicht abonnierbar),
  `measures against its coordsTarget while the pointer crosses other elements`
  (−20 statt −320), `drops the pan collected while the pointer is switched off`,
  `reports an update when only the speed fields moved the view`,
  `reports restoreCursor only for a cursor it hid` · Verify `pnpm run ci` exit=0,
  mit `NX_SKIP_NX_CACHE=true` gefahren, damit kein Task aus dem Cache des
  Implementierers kam · klein und offen geblieben: der Stub-Kommentar in
  `packages/twopoint5d-testing/test/display-constructor.test.js:22` sagt »before
  the first frame«, der Stub enthält aber auch `dispose()`, das erst beim
  Entsorgen läuft · Commit-Message um einen `BREAKING CHANGE:`-Footer ergänzt,
  weil `AGENTS.md` das Repo an Conventional Commits bindet und das Paket die
  öffentliche Fläche zweifach bricht
- Beim Abschluss nachzuziehen: BUG-058 und BUG-059 stehen in keinem Paket dieses
  Laufs und sind mit Paket 1 gegenstandslos geworden — BUG-059 durch das `else`
  am Ende der Konstruktor-Zweigkette, BUG-058 durch den entfallenen Cast auf
  `HTMLElement` in `PanControl2D`. Ihr Status gehört in die `audit.html`.
- Nebenbefunde: → Queue (4 Einträge: `PanControl2D.ts:218`, `PanControl2D.ts:233`,
  `Display.ts:415-435`, `CHANGELOG.md:62`)
- Folgen: keine. Die beiden gewechselten Symbolschlüssel sind repoweit nur über
  die exportierten Konstanten in Gebrauch, im Lookbook baut niemand einen
  Schlüssel nach und niemand übergibt `createRenderer`.
- Schnittstellen:
  - `OnDisplayError` (`'error'`) und `IOnDisplayError` neu in `src/events.ts`,
    exportiert über die Display-Public-API · `Display#onError(listener)` als
    Kurzform, im `retain` des Konstruktors, also auch für einen Abonnenten
    erreichbar, der erst nach dem Fehlschlag anhängt
  - `PanControl2D#coordsTarget?: HTMLElement` als Option und als öffentliches
    Feld · Vorgabewert ist `cursorStylesTarget`, also `document.body`
  - `FrameLoop.OnRAF` ist `Symbol.for('twopoint5d:FrameLoop.OnRAF')`,
    `FrameLoop.OnFrame` entsprechend — Bruch für Aufrufer, die den Schlüssel aus
    dem String nachbauen
  - ein `createRenderer`-Callback bekommt `maxFps`, `resizeTo`, `resizeToElement`,
    `resizeToAttributeEl`, `styleSheetRoot` und `createRenderer` nicht mehr in
    seinen `params`; `CreateRendererParameters` nennt keinen davon
  - `Display.dispose()` nimmt einen selbst gebauten Container samt Canvas aus dem
    DOM; ein als Konstruktorargument übergebenes Canvas bleibt stehen
  - der Display-Konstruktor wirft für jedes erste Argument, das weder
    `WebGPURenderer` noch `HTMLElement` ist, einen `TypeError` mit der Meldung
    `The Display constructor expects a WebGPURenderer or an HTML element as the first argument!`

### [x] 2. TextureStore und TextureResource: Eingabe, Ausgabe, Fehlerwege
- Findings: ASYNC-001, ARCH-003, API-035, API-039, API-040, BUG-044, BUG-045,
  BUG-048, PERF-005, DOC-018, CONS-002, CONS-014
- Ziel: Abgeleitete Felder sind Ausgabe und nicht mehr beschreibbar, Ladefehler
  erreichen den Aufrufer, und zusammengehörige Signal-Updates werden atomar.
- Bereich: `packages/twopoint5d/src/texture/TextureStore.ts`,
  `src/texture/TextureResource.ts`
- Hängt ab von: —
- Hash: 77e030b
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/src/texture/TextureResource.ts`,
  `packages/twopoint5d/src/texture/TextureStore.ts`,
  `packages/twopoint5d/src/texture/TextureResource.spec.ts`,
  `packages/twopoint5d/src/texture/TextureStore.spec.ts`,
  `packages/twopoint5d/CHANGELOG.md`, `eslint.config.mjs`,
  `apps/lookbook/src/pages/demos/animated-sprites.astro`

#### Was der Abgleich ergeben hat

Alle zwölf Findings existieren unverändert; keines ist durch Paket 1
gegenstandslos geworden (Paket 1 hat nur `src/display/` und
`src/controls/PanControl2D.ts` angefasst). Sieben Fundstellen sind gegenüber der
`audit.html` verrutscht — die Zeilennummern unten sind die **aktuellen**:

| Finding | Fundstelle laut Audit | Fundstelle jetzt |
| --- | --- | --- |
| ASYNC-001 | `TextureStore.ts:178-201` | `TextureStore.ts:305-330` |
| API-039 | `TextureStore.ts:352-356` | `TextureStore.ts:518-524` |
| BUG-045 | `TextureStore.ts:182-189`; `TextureResource.ts:508-511` | `TextureStore.ts:316-322`; `TextureResource.ts:497-507` |
| BUG-048 | `TextureStore.ts:216-282` | `TextureStore.ts:346-440` (`parse()`) |
| API-035 | `TextureResource.ts:197-251, 288-294` | Setter `:205`, `:237`, `:253`, `:261`, `:306` |
| API-040 | `TextureResource.ts:209, 217, 225, 233, 241, 249` | `:213`, `:221`, `:229`, `:237`, `:245`, `:253` |
| BUG-044 | `TextureResource.ts:406-421, 472-484` | `:464-481` (Tileset), `:538-552` (Atlas) |

DOC-018 (`TextureStore.ts:54` gegen `:313`, `:320`, `:326`), CONS-014
(`TextureResource.ts:12`), CONS-002 (`TextureResource.ts:73-101`), ARCH-003 und
PERF-005 stehen exakt dort, wo das Audit sie nennt.

#### Vorgehen

Die Schritte bauen aufeinander auf, in dieser Reihenfolge. Jeder Korrektheits-
fehler bekommt seinen Regressionstest **zuerst**, rot gesehen, dann den Fix; der
rote Lauf gehört in den Report.

**1. Der `.ts`-Import und die Regel dagegen (CONS-014).**
`TextureResource.ts:12` auf `from './types.js'` ändern — es ist die einzige
Importzeile der Bibliothek mit `.ts`-Endung, und `tsc` schreibt sie unverändert
in `dist/lib/texture/TextureResource.d.ts`. Danach in `eslint.config.mjs` im
Block `files: ['**/*.ts']` die Wiederholung ausschließen:

```js
'no-restricted-syntax': [
  'error',
  {
    selector: ':matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/\\.ts$/]',
    message: 'Relative imports carry the .js suffix (NodeNext) — a .ts suffix is written unchanged into the published .d.ts.',
  },
],
```

`pnpm lint` muss danach grün sein; schlägt die Regel anderswo an, ist die
betroffene Stelle mitzuziehen (keine erwartet — die übrigen 169 Importe tragen
`.js`).

**2. Ein Vergleich für beide Compare-Funktionen (CONS-002).**
`cmpTexCoords` und `cmpTileSetOptions` (`TextureResource.ts:73-101`) zählen ihre
Felder auf. Beide ersetzen durch einen gemeinsamen flachen Vergleich über die
**Vereinigung** beider Schlüsselmengen:

```ts
// Compares every own enumerable field of both objects, so a field added to TextureCoords
// or TileSetOptions is part of the comparison the day it appears. The two key sets are
// unioned because an optional field that was never assigned is not an own key under
// `useDefineForClassFields: false` — `TextureCoords#parent` is exactly that case.
const cmpShallow = <T extends object>(a: T | undefined, b: T | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false;
  }
  return true;
};
```

`Object.keys` ist hier richtig und nicht bloß bequem: die abgeleiteten Werte von
`TextureCoords` (`s`, `t`, `s1`, `t1`, `u`, `v`, `root`, `flipH/V/D`) sind Getter
auf dem Prototyp und damit nicht own-enumerable — sie fallen korrekt heraus, die
sechs Datenfelder bleiben drin. `cmpTexClasses` bleibt, wie es ist: es
vergleicht ein Array über einen Join, das ist ein anderer Fall.

**3. Die abgeleiteten Felder werden Ausgabe (API-035) und die verbliebenen
Setter hören auf zu schlucken (API-040).**

Beide gehören zusammen und werden zusammen umgesetzt — API-035 nimmt zwei der
sechs Setter aus API-040 ohnehin weg.

API-035: die fünf Setter für `imageCoords`, `atlas`, `tileSet`, `texture` und
`frameBasedAnimations` entfallen ersatzlos. Die Getter bleiben public und
unverändert. TypeScript erlaubt **keine** unterschiedliche Sichtbarkeit für
Getter und Setter derselben Property — `protected set` neben `public get` ist ein
Compilerfehler. Der Weg ist deshalb: Setter löschen, und die Effekte in `load()`
schreiben direkt auf die privaten Signale.

Betroffene Schreibstellen in `load()`:

| Bisher | Neu |
| --- | --- |
| `this.imageCoords = new TextureCoords(0, 0, image.width, image.height)` | `this.#imageCoords.set(…)` |
| `this.texture = texture` | `this.#texture.set(texture)` |
| `this.tileSet = new TileSet(…)` | `tileSetSignal.set(…)` (die lokale Konstante gibt es schon) |
| `this.atlas = this.tileSet.atlas` / `this.atlas = atlas` | `atlasSignal.set(…)` bzw. `this.#atlas!.set(…)` |
| `this.frameBasedAnimations = new FrameBasedAnimations()` | `this.#frameBasedAnimations.set(…)` |
| `this.atlasJson = atlasJson` | bleibt (Setter bleibt public, siehe unten) |

Repoweit schreibt niemand außerhalb der Klasse auf diese fünf Felder — geprüft
über `packages/` und `apps/`, die einzigen Treffer sind gleichnamige Felder
fremder Klassen (`TileSet#atlas`, `Canvas2DStage#texture`,
`TileSpritesFactory#tileSet`, `TexturedSprites#texture`) plus die beiden
Spec-Stellen aus Schritt 3c.

**3a.** `#ownTexture` bleibt, wo es ist. Es trägt weiterhin »die Vorgängertextur,
die erst freigegeben wird, wenn die Nachfolgerin auf dem Signal steht«, und
`dispose()` hängt daran. Kein Umbau — aber die beiden Kommentarblöcke, die von
einer »durch den öffentlichen Setter zugewiesenen« Textur sprechen
(`TextureResource.ts:302-305`, `:318-320`, und der TSDoc-Absatz in `dispose()`),
sagen dann etwas Falsches und werden neu formuliert: jede Textur, die dieses
Signal erreicht, hat die Resource selbst gebaut, und sie gibt sie frei.

**3b.** Klassen-TSDoc an `TextureResource`, das Eingabe von Ausgabe trennt —
genau das, was das Audit als »steht nirgends« bemängelt:

- Eingabe (schreibbar): `imageUrl`, `atlasUrl`, `atlasJson`, `overrideImageUrl`,
  `tileSetOptions`, `frameBasedAnimationsData`, `textureClasses`,
  `textureFactory`, `renderer`
- Ausgabe (nur lesbar, von den Effekten in `load()` erzeugt): `imageCoords`,
  `atlas`, `tileSet`, `texture`, `frameBasedAnimations`

`atlasJson` steht bei der Eingabe und bekommt den Halbsatz dazu, dass der
Atlas-Effekt es auch selbst schreibt, wenn ein `atlasUrl` gesetzt ist.

**3c.** Was der eigene Umbau umwirft, wird mitgezogen:

- `TextureResource.spec.ts:141-159` — `test('does NOT dispose a texture that was
  handed in')` verliert sein Subjekt: eine fremde Textur kann nicht mehr
  hineingereicht werden. Der Fall (b) des Musters aus
  `docs/resource-lifecycle.md` §7 wird nicht gestrichen, sondern auf die
  `TextureFactory` umgehängt, die der Store injiziert und die die Resource laut
  ihrem eigenen TSDoc nicht freigibt: Test umbenennen in
  `does NOT dispose the texture factory it was handed`, Spy auf `factory.dispose`
  (Stub genügt), nach `resource.dispose()` `called === false`.
- `TextureResource.spec.ts:174-177` — die Zeile
  `expect(() => { resource.texture = undefined; }).not.toThrow();` verschwindet;
  an ihre Stelle tritt ein verbliebener Setter, der nach `dispose()` nichts tun
  darf: `expect(() => { resource.imageUrl = undefined; }).not.toThrow();`
- `packages/twopoint5d/CHANGELOG.md` — der Unreleased-Eintrag unter »Changed«,
  der mit »`TextureResource#dispose()` releases the texture the resource built
  for itself« beginnt, behauptet in seinem zweiten Satz »A texture assigned
  through the `texture` setter belongs to the caller and is left alone«. Diesen
  Satz herausnehmen; der Rest des Eintrags bleibt. Unreleased-Abschnitte sind
  änderbar, veröffentlichte nicht.

API-040: von den sechs Settern bleiben nach API-035 vier übrig — `atlasUrl`,
`atlasJson`, `overrideImageUrl`, `tileSetOptions`. Alle vier schreiben über `?.`
in ein Signal, das nur die passende Bauform anlegt, und verschlucken ihren Wert
sonst stumm. Sie werfen künftig einen `TypeError`, der Klasse, id, Property und
tatsächlichen Typ nennt, zum Beispiel:

```
TextureResource "hero" is an "image" resource and has no "tileSetOptions"
```

Reihenfolge im Setter: **erst** `#disposed` prüfen und dann still zurückkehren,
**danach** auf das fehlende Signal werfen. Der Vertrag aus `dispose()` — »a write
to any setter … does nothing« — bleibt damit unverletzt, und
`TextureStore.spec.ts:263` (`behaves as documented after dispose()`) läuft
weiter. Die Getter bleiben unverändert und antworten auf der falschen Bauform
weiter `undefined`; sie verschlucken nichts, sie haben schlicht nichts.

`TextureStore.parse()` ist davon nicht betroffen: es schreibt `atlasUrl` und
`overrideImageUrl` ausschließlich im Atlas-Zweig und `tileSetOptions`
ausschließlich im Tileset-Zweig.

Regressionstest (rot zuerst): auf einer `fromImage`-Resource wirft
`resource.tileSetOptions = {tileWidth: 16}`; auf einer `fromTileSet`-Resource
wirft `resource.atlasUrl = 'x.json'`. Vor dem Fix laufen beide durch, und der
Getter antwortet weiter `undefined`.

**4. Animationsdaten der falschen Form werden gemeldet (BUG-044).**

Modulweiter Helfer in `TextureResource.ts`:

```ts
type FrameBasedAnimationsDataShape = 'frameNameQuery' | 'tileIds' | 'firstTileId';

const animationDataShape = (data: FrameBasedAnimationsData): FrameBasedAnimationsDataShape | undefined => {
  if ('frameNameQuery' in data) return 'frameNameQuery';
  if ('tileIds' in data) return 'tileIds';
  if ('firstTileId' in data) return 'firstTileId';
  return undefined;
};
```

Der Tileset-Effekt (`:464-481`) nimmt `tileIds` und `firstTileId` an, der
Atlas-Effekt (`:538-552`) nimmt `frameNameQuery` an. Jede andere Form — und im
Atlas-Effekt auch die stumm übersprungenen `tileIds`-Einträge — wird
übersprungen **und gemeldet**, mit einem `error`-Event je Eintrag:

```ts
emit(this, OnError, {
  source: 'frameBasedAnimations',
  id: this.id,
  animation: name,
  error: new Error(
    `[TextureResource] animation "${name}" of resource "${this.id}" carries ${shape ?? 'no known'} data, which a "${this.type}" resource cannot use`,
  ),
});
```

Der Cast auf `FrameBasedAnimationsDataByTileCount` im `else`-Zweig entfällt
damit — nach der Prüfung auf `firstTileId` trägt der Typ selbst. `getTimingOptions`
bleibt unverändert; es wird weiterhin erst nach der Formprüfung gerufen.

`source: 'frameBasedAnimations'` ist ein dritter Wert neben `'image'` und
`'atlas'`; der TSDoc-Block `TextureResourceEvents` (`:53`) wird entsprechend
ergänzt.

Regressionstest (rot zuerst): eine Tileset-Resource mit
`{walk: {duration: 1, frameNameQuery: 'walk.*'}}` meldet ein `error`-Event und
registriert **keine** Animation. Vor dem Fix entsteht stattdessen eine Animation
über sämtliche Tiles, weil `firstTileId` und `tileCount` `undefined` sind und
`add()` auf `tileSet.firstId` / `tileSet.tileCount` zurückfällt.

**5. Kein `response.json()` ohne `response.ok` (BUG-045).**

`TextureStore#load()` (`:316-322`): zwischen `fetch` und `response.json()` tritt

```ts
if (!response.ok) {
  emit(this, OnError, {
    source: 'fetch',
    url,
    status: response.status,
    error: new Error(`[TextureStore] fetch("${String(url)}") answered ${response.status} ${response.statusText}`),
  });
  return;
}
```

`source: 'fetch'` und nicht `'parse'`: ein Statuscode ist ein Fehler der
Abholung, nicht des Parsens, und DOC-018 hält die beiden Quellen genau so
auseinander.

`TextureResource`, Atlas-Effekt (`:497-507`): dieselbe Prüfung, mit
`source: 'atlas'`, `url: atlasUrl` und `status`. Zusätzlich fehlt dort bisher ein
`aborted`-Check direkt nach dem `await fetch(...)` — er wird ergänzt, sonst meldet
ein abgebrochener Effektlauf noch einen Statusfehler.

Das Feld `status` ist neu und optional in beiden Fehler-Payloads.

Regressionstest (rot zuerst): `fetch` liefert
`new Response('{"items":{}}', {status: 404})`. Vor dem Fix parst der Store diesen
Body als gültigen Katalog und feuert `ready`; danach kommt ein `error`-Event mit
`source: 'fetch'` und `status: 404`, und `ready` bleibt aus. Der vorhandene Test
`TextureStore.load() emits 'error' on parse failure` bleibt gültig — er benutzt
`new Response('not-json')`, und das trägt Status 200.

**6. Atlas und Texture gehören zum selben Bild (ARCH-003).**

Der Vertrag, den der Regressionstest festnagelt: ein Abonnent von
`store.on(id, ['atlas', 'texture'], cb)` auf einer Atlas-Resource wird **nie** mit
einem `atlas` und einer `texture` gerufen, die aus verschiedenen Bild-URLs
stammen.

Der Regressionstest kommt zuerst und gehört neben das vorhandene
`describe('TextureResource.load() image race')` in `TextureStore.spec.ts:927` —
dort steht die Mechanik schon: `vi.spyOn(ImageLoader.prototype, 'loadAsync')` mit
von Hand aufgelösten Promises und ein gemockter `fetch` für die Atlas-JSON.
Aufbau: Atlas-Resource laden, Abonnent auf `['atlas', 'texture']` hängen, dann
`overrideImageUrl` auf ein zweites Bild wechseln und das zweite Bild auflösen.
Jedes Tupel, mit dem der Callback gerufen wird, wird protokolliert; die Assertion
prüft jedes einzelne auf Zusammengehörigkeit. Als Korrelationsgriff eignen sich
unterschiedliche Bildmaße: der Atlas wird über `TexturePackerJson.parse` aus
`atlasJson` **und** den `imageCoords` gebaut, also trägt
`atlas.baseCoords.width` die Breite des Bildes, aus dem er stammt, und die
gemockte Textur trägt ihre eigene. Vor dem Fix erscheint mindestens ein Tupel, in
dem die beiden nicht übereinstimmen.

Der Fix hat zwei Teile, und der zweite ist der, auf den es ankommt:

- **Korrelation.** Die Resource merkt sich in einem privaten Feld
  `#imageUrlOfCoords`, zu welcher URL die veröffentlichten `imageCoords` und die
  veröffentlichte `texture` gehören; gesetzt wird es im selben `batch()`, in dem
  der Bild-Effekt beide publiziert. Der Atlas-Effekt
  (`atlasJson` + `imageCoords` → `atlas`) veröffentlicht nur, wenn
  `#imageUrlOfCoords` mit der URL übereinstimmt, die die aktuelle `atlasJson`
  meint (`this.overrideImageUrl ?? this.atlasJson.meta.image`). Passt es nicht,
  bleibt der Atlas auf seinem letzten Wert stehen — er wird **nicht** auf
  `undefined` geräumt, sonst bekäme ein Abonnent ein `undefined`, wo der
  Event-Typ einen `TextureAtlas` zusagt.
- **Reihenfolge der Emits.** Der Abonnent sieht nicht die Signalwerte, sondern
  die Events, und der Mehrtyp-Pfad von `TextureStore#on()` merkt sich je Subtyp
  den zuletzt **emittierten** Wert. Der Atlas muss seine Abonnenten also
  spätestens gleichzeitig mit der zugehörigen Textur erreichen. `batch()` allein
  trägt das nicht: `@spearwolf/signalize` beschreibt es ausdrücklich als Hinweis,
  nicht als Zusage (»dedup + flush in priority order — a HINT, not a guarantee«),
  und »genau ein Effektlauf je Batch« ist keine Invariante, auf der man bauen
  darf.

  Drei Mechanismen kommen dafür in Frage; der Test entscheidet, welcher trägt,
  und der gewählte bekommt einen Kommentar mit dem Grund:
  1. Die ableitenden Effekte (Atlas aus `atlasJson`+`imageCoords`, TileSet aus
     `imageCoords`, beide `frameBasedAnimations`-Effekte) mit
     `{priority: 100}` anlegen, damit sie vor den Emit-Brücken laufen — die
     `onChange`-Brücken kennen keine Priorität und liegen fest auf 0.
  2. Die Texture-Brücke für eine Atlas-Resource gaten: die Textur geht erst
     hinaus, wenn der zu ihrem Bild gehörende Atlas veröffentlicht ist.
  3. Den Atlas für eine Atlas-Resource in der Fortsetzung des Bild-Effekts
     berechnen und im selben `batch()` vor der Textur setzen.

  Kein Mechanismus wird »auf Verdacht« zusätzlich eingebaut: was der Test grün
  macht, bleibt, der Rest nicht.

**7. `parse()` schreibt erst, wenn alles geprüft ist (BUG-048).**

`parse()` bekommt einen Validierungsdurchgang **vor** dem `batch()`:

```ts
const conflicts: string[] = [];
const withoutSource: string[] = [];

for (const [id, item] of Object.entries(data.items)) {
  const wanted = item.tileSet ? 'tileset' : item.atlasUrl ? 'atlas' : item.imageUrl ? 'image' : undefined;
  if (wanted == null) {
    withoutSource.push(id);
    continue;
  }
  const existing = this.#resources.get(id);
  if (existing && existing.type !== wanted) {
    conflicts.push(`"${id}" is a "${existing.type}" resource and cannot become "${wanted}"`);
  }
}
```

Danach:

- Gibt es Typkonflikte, wirft `parse()` **einen** Fehler, der alle aufzählt,
  bevor irgendetwas geschrieben oder emittiert wurde. Damit ist ein `parse()`
  entweder ganz gelaufen oder gar nicht — der halbe Durchlauf, den das Finding
  beschreibt, kann nicht mehr entstehen. Die drei einzelnen `throw` im
  `batch()` (`:364`, `:380`, `:401`) entfallen; die Validierung hat sie
  übernommen. Kein Test nagelt ihren Wortlaut fest.
- Gibt es keine Konflikte, wird je Eintrag ohne Quelle ein `error`-Event
  emittiert, danach läuft der `batch()` wie bisher:

  ```ts
  emit(this, OnError, {
    source: 'parse',
    id,
    error: new Error(`[TextureStore] item "${id}" names no tileSet, atlasUrl or imageUrl and builds no resource`),
  });
  ```

`id` ist ein neues, optionales Feld der Fehler-Payload; `url` fehlt hier, weil
`parse()` keine kennt. **Folge davon, bewusst in Kauf genommen:** das statische
`TextureStore.load()` rejectet auf jedes `error`-Event, ein Katalog mit einem
quellenlosen Eintrag lässt es also künftig scheitern statt still eine Resource zu
unterschlagen. Das ist die laute Variante, und sie ist richtig — bisher rejectet
`whenResource(id)` später mit »check your items keys«, obwohl der Key da ist, und
niemand findet den Grund. Der TSDoc von `static load()` sagt das ausdrücklich.

Zwei Stellen ziehen mit:

- `loadFailedError(source, url, cause)` (`TextureStore.ts:91`) baut die Meldung
  aus der URL. Sie bekommt stattdessen das, was da ist — URL oder id —, damit
  nicht `load("undefined")` in der Meldung steht.
- `apps/lookbook/src/pages/demos/animated-sprites.astro:84-86` loggt
  `` `… failed for ${url}` ``. Der Handler destrukturiert künftig auch `id` und
  benennt `url ?? id`.

Regressionstests (rot zuerst), zwei:
1. `parse()` mit einem Item ohne `tileSet`/`atlasUrl`/`imageUrl` emittiert genau
   ein `error`-Event mit `source: 'parse'` und der id.
2. `parse()` über zwei Items, von denen das zweite den Typ einer bestehenden
   Resource wechselt, wirft — und die **erste** Resource trägt danach noch ihre
   alten Werte, `ready` ist nicht gefeuert. Vor dem Fix ist die erste bereits
   aktualisiert.

**8. Der Einzeltyp-Pfad von `on()` filtert wie der Mehrtyp-Pfad (API-039).**

In `TextureStore#on()` (`:518-524`):

```ts
on(resource, type as TextureResourceSubType, (val) => {
  // the same filter the tuple path applies: a signal that is cleared and notifies would
  // otherwise hand the callback an undefined where its type promises a value — and
  // get() would resolve with it
  if (val == null) return;
  callback(val as MapSubTypes<T>);
}),
```

Das ist eine Verhaltensänderung an einer öffentlichen Methode und gehört in den
TSDoc von `on()`: der Callback wird nur für Werte gerufen, die da sind; ein
geräumter Wert wird nicht zugestellt. `get()` erbt das und kann damit nicht mehr
mit `undefined` resolven, wo sein Typ eine `Texture` zusagt.

**9. `TextureStore#load()` wird awaitable (ASYNC-001).**

Die Methode gibt heute `this` zurück, nicht `void` — die Notiz unter
»Entscheidungen« meint das verworfene `void (async () => …)()` im Rumpf. Der
beschlossene Weg gilt unverändert: die Instanz-Methode gibt die intern ohnehin
vorhandene Promise zurück, also `Promise<TextureStore>`, aufgelöst mit `this`.

Zwei Eigenschaften, die diesen Schritt tragen und die im TSDoc stehen müssen:

- **Die Promise rejectet nie.** Der interne IIFE fängt jeden Fehler ab und leitet
  ihn ins `error`-Event; das bleibt so. Andernfalls würde jeder der über zwanzig
  Aufrufe im Repo — alle als nackte Anweisung, keiner mit `await` — eine
  Fehlschlag-Ladung in eine unbehandelte Rejection verwandeln.
- **Sie sagt »der Versuch ist vorbei«, nicht »es hat geklappt«.** Für den Erfolg
  bleibt `whenReady()` zuständig. Auf einem entsorgten Store wird sofort mit
  `this` aufgelöst.

Kein Aufrufer im Repo verkettet auf dem Rückgabewert (geprüft über `packages/`
und `apps/`), die Signaturänderung bricht hier also nichts — sie ist trotzdem ein
Bruch der öffentlichen Fläche und gehört in `Schnittstellen:` und den CHANGELOG.
`TextureStore.ts:142` (`store.load(url)` im statischen `load()`) wird zu
`void store.load(url);`, damit sichtbar bleibt, dass die Promise dort absichtlich
liegen bleibt — es wartet das `Promise.race()` darunter.

Dazu die TSDoc-Trennung der drei gleichnamigen Methoden, jede mit einem Satz auf
die beiden anderen:

| Methode | Was sie tut |
| --- | --- |
| `static TextureStore.load(url)` | baut einen Store, holt die Daten, löst auf, wenn sie geparst sind, und rejectet, wenn ein Schritt scheitert |
| `TextureStore#load(url, options?)` | holt Daten in **diesen** Store, löst auf, wenn der Versuch vorbei ist, und rejectet nie |
| `TextureResource#load()` | registriert die Effekte dieser Resource, gibt `this` zurück und holt von sich aus nichts |

**10. Ein Bild wird einmal geholt (PERF-005).**

Der Cache sitzt am Store, weil nur er mehrere Resources überblickt. Geteilt wird
das `HTMLImageElement`, **nicht** die `Texture`: jede Resource wendet ihre eigenen
`textureClasses` an und gibt die Textur frei, die sie gebaut hat — eine geteilte
`Texture` hätte nach `docs/resource-lifecycle.md` §1 keinen Eigentümer.

Kanal zur Resource, nach dem Vorbild der bereits injizierten `textureFactory`.
In `TextureResource.ts`, Interface **nicht** exportiert, Feld mit `@internal`
(die `tsconfig` setzt `stripInternal: true`, das Feld verschwindet damit aus der
veröffentlichten `.d.ts` — dasselbe Mittel, das `VOBufferPool` und
`VOBufferGeometry` schon benutzen):

```ts
interface TextureImageSource {
  acquire(url: string): Promise<HTMLImageElement>;
  release(url: string): void;
}
```

```ts
/**
 * How this resource fetches its image. The store it belongs to injects its shared,
 * de-duplicating loader here; a resource on its own falls back to a plain `ImageLoader`.
 *
 * `acquire()` and `release()` are paired: every run of the image effect acquires once and
 * releases in its cleanup, which is what lets the store drop a cached image once no
 * resource wants it any more.
 *
 * @internal
 */
imageLoader?: TextureImageSource;
```

Im Bild-Effekt wird das Feld **einmal** in eine lokale Konstante gelesen und aus
ihr sowohl geholt als auch freigegeben, damit die Paarung nicht auseinanderläuft,
falls jemand das Feld zwischendurch umsetzt:

```ts
const source = this.imageLoader;
(source ? source.acquire(url) : new ImageLoader().loadAsync(url))
  .then(…)
  .catch(…);

return () => {
  aborted = true;
  source?.release(url);
};
```

Die Cleanup-Funktion eines Effekts läuft vor jedem Rerun **und** beim Destroy, und
`SignalGroup.delete(this)` in `dispose()` zerstört die angehängten Effekte — die
Freigabe ist damit an beiden Enden gedeckt. Der Effekt ist synchron und gibt eine
synchrone Cleanup zurück; die unbestimmte Verzögerung, die `signalize` für die
Cleanup eines `async`-Callbacks beschreibt, trifft ihn nicht.

Store-Seite in `TextureStore.ts` (`ImageLoader` aus `three/webgpu` importieren):

```ts
#images = new Map<string, {image: Promise<HTMLImageElement>; refCount: number}>();

// One fetch per url for as long as at least one resource wants it. What is shared is the
// image and not the texture: each resource applies its own texture classes to it and
// disposes the texture it built, and a shared Texture would belong to nobody.
#imageSource = {
  acquire: (url: string): Promise<HTMLImageElement> => {
    let entry = this.#images.get(url);
    if (!entry) {
      const created = {image: new ImageLoader().loadAsync(url), refCount: 0};
      // a failed load is not kept: the next resource asking for this url gets a fresh
      // attempt instead of the old rejection
      created.image.catch(() => {
        if (this.#images.get(url) === created) this.#images.delete(url);
      });
      this.#images.set(url, created);
      entry = created;
    }
    entry.refCount++;
    return entry.image;
  },
  release: (url: string): void => {
    const entry = this.#images.get(url);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) this.#images.delete(url);
  },
};
```

Injiziert wird an denselben beiden Stellen, an denen der Store die
`textureFactory` setzt, und **vor** ihr: `parse()` (`:413-419`, nur für neu
angelegte Resources) und der `onReadyHandler` in `on()` (`:489-500`, dort direkt
vor `resource.load()`). Die Reihenfolge ist kein Geschmack — der Bild-Effekt
kehrt ohne Factory sofort zurück und läuft erst, wenn sie ankommt; wäre der
Loader dann noch nicht gesetzt, ginge der erste Fetch am Cache vorbei. Gesetzt
wird mit `??=`, damit ein zweiter `parse()` nichts überschreibt.

`dispose()` leert `#images`.

Regressionstest (rot zuerst): zwei Items mit derselben `imageUrl`, beide über
`store.on(...)` abonniert — `ImageLoader.prototype.loadAsync` wird **einmal**
gerufen, und beide Resources bekommen ihre eigene Textur. Vor dem Fix zweimal.
Zweiter Test: nachdem beide Abonnements gekündigt und die Resources entsorgt
sind, holt ein erneutes Abonnement dasselbe Bild wieder — der Eintrag ist also
tatsächlich abgebaut worden.

**11. Der TSDoc des Error-Events nennt, was ankommt (DOC-018).**

Zuletzt, weil die Schritte 5, 7 und 9 daran gedreht haben. `TextureStore.ts:54`:

```
- `Error`: fires with `{source: 'fetch'|'parse', url?, id?, status?, error}`.
  `fetch` covers a request that failed and a response that answered with a
  status; `parse` a body that is no JSON, a `parse()` that threw, and an item
  that names no source. The `atlas` and `image` failures of a resource are
  emitted by `TextureResource` and are subscribed there.
```

**12. CHANGELOG.**

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`, im Stil der
vorhandenen Einträge: ausformulierte Sätze, die ohne Kenntnis des Vorzustands
lesbar sind, keine Finding-IDs. Unter »Changed« gehören hinein: die fünf
abgeleiteten Felder als reine Ausgabe, die vier werfenden Setter, der
Rückgabetyp von `TextureStore#load()`, der Filter in `on()`, die
`response.ok`-Prüfung samt `status` im Fehler-Payload, die Validierung in
`parse()` samt der Meldung für quellenlose Items, die gemeldete Fehlform von
Animationsdaten und das Zusammenspiel von Atlas und Textur. Unter »Added« der
geteilte Bild-Cache. Dazu die Korrektur des vorhandenen
`TextureResource#dispose()`-Eintrags aus Schritt 3c.

#### Warum dieses Paket nicht geteilt wird

Ein Schnitt entlang der beiden Dateien läge nahe — sechs Findings am Store, sechs
an der Resource. Er trägt nicht: BUG-045 steht in beiden Dateien, PERF-005
braucht den Cache im Store **und** den Injektionspunkt in der Resource, und
API-039 hängt an den Emit-Brücken der Resource. Jede Teilung ergäbe zwei Pakete,
die beide dieselben zwei Dateien anfassen — die schlechteste Form eines Schnitts.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
  (`AGENTS.md` bindet das Repo auf dieses Gate. Das Überspringen des Nx-Caches
  hat sich in Paket 1 als nötig erwiesen, damit kein Task als Treffer aus dem
  Cache des Implementierers durchgewinkt wird.)
- Commit: `fix(twopoint5d): report failed texture loads and publish derived resource values read-only`

  Footer, weil `AGENTS.md` das Repo an Conventional Commits bindet und das Paket
  die öffentliche Fläche vierfach bricht:

  ```
  BREAKING CHANGE: the derived fields of TextureResource — imageCoords, atlas, tileSet, texture and frameBasedAnimations — are read-only, and so is imageUrl on an atlas resource; a setter that does not fit the shape of a resource throws instead of swallowing the write; TextureStore#load() returns a promise instead of the store.
  ```
- Ergebnis: 2 Runden · alle 12 Findings behoben, von drei Reviewern je mit
  Fundstelle bestätigt · Regressionstests, jeder vor seinem Fix rot:
  `an image resource refuses tileSetOptions` und `a tileset resource refuses an
  atlasUrl` (Zuweisung lief vorher stumm durch),
  `a tileset resource reports animation data it cannot use` und `an atlas resource
  reports animation data it cannot use` (0 statt 1 Fehlermeldung),
  `a response that answers with a status is reported instead of parsed` und
  `TextureStore.load() emits 'error' on a response that answers with a status`
  (404 mit JSON-Body lief als Katalog durch),
  `an item that names no source is reported` (0 statt 1),
  `a type conflict leaves every resource of the run untouched` (erste Resource war
  bereits geschrieben),
  `two resources that name the same image share one fetch and keep their own
  texture` und `the image is fetched again once no resource wants it any more`
  (zwei Fetches statt einem),
  `every tuple a subscriber is called with carries an atlas and a texture of one
  image` (200 statt 100),
  `an atlas that swaps its json for one over another image of the same size follows
  it` (`first.png` statt `second.png`, dauerhaft),
  `an atlas resource refuses a write to imageUrl` und `an atlas resource refuses to
  be pointed at another image directly`,
  `the single-type path keeps an undefined away from the callback` ·
  Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0, Log
  `paket-2.verify.log` · Schritt 6 anders gelöst als der Detailplan vorschlug:
  keiner der drei dort genannten Mechanismen trug allein, weil der Mehrtyp-Pfad von
  `on()` das veraltete Element aus den Events festhielt; gebaut wurde die
  Korrelation über ein Signal `#imageUrlOfCoords`, ein Mehrtyp-Pfad, der die Werte
  von der Resource liest, und Mechanismus 1 (`priority: 100`) als Absicherung der
  Reihenfolge — letzterer gegen die installierte `signalize@1.0.0` nachgemessen,
  nicht aus der Doku übernommen · Commit-Message um einen `BREAKING CHANGE:`-Footer
  ergänzt und gegenüber dem Detailplan um den vierten Bruch erweitert
  (`imageUrl` auf einer Atlas-Resource) · klein und offen geblieben: nichts, beide
  kleinen Befunde des dritten Reviewers stehen unter »Folgen«, weil dieses Paket sie
  erzeugt hat
- Nebenbefunde: → Queue (3 Einträge: `TextureResource.ts:19` `getTimingOptions`,
  `FrameBasedAnimations.ts:129`, `TextureResource.ts:260` `refCount`)
- Folgen: beide als Symptome eingeordnet und in Paket 9 geschnitten (Zug 0 des Pakets 3, 2026-09-07)
  - `packages/twopoint5d/src/texture/TextureResource.ts:66` — der TSDoc-Block
    `TextureResourceEvents` beschreibt die `error`-Payload als
    `{source: 'image'|'atlas', url, error}`, während `:600-605` bei einer
    Statusantwort zusätzlich `status` mitschickt. Das Feld hat dieses Paket
    eingeführt und im Schwesterblock `TextureStore.ts:54` dokumentiert, hier nicht.
    Ein Halbsatz fehlt, sonst nichts.
  - `packages/twopoint5d/src/texture/TextureResource.ts:549` und `:654` — kein Test
    unterscheidet Anwesenheit und Abwesenheit von
    `priority: DERIVED_FROM_IMAGE_PRIORITY`: nimmt man beide heraus, bleiben alle 88
    Tests grün, weil die Korrelation still auf die Schreibreihenfolge im `batch()`
    zurückfällt. Die unterscheidende Gegenprobe haben Implementierer und Reviewer je
    von Hand gefahren; sie gehört in die Suite, damit ein späteres Entfernen im CI
    auffällt statt beim Nutzer.
- Schnittstellen:
  - Die fünf Setter von `TextureResource` für `imageCoords`, `atlas`, `tileSet`,
    `texture` und `frameBasedAnimations` sind entfallen; die Getter bleiben public.
    Die Effekte in `load()` schreiben direkt auf die privaten Signale.
  - `imageUrl` ist auf einer Atlas-Resource abgeleitet: der Setter wirft einen
    `TypeError`, der interne Ableitungseffekt schreibt daran vorbei. Auf einer
    `image`- und einer `tileset`-Resource bleibt `imageUrl` Eingabe.
  - `atlasUrl`, `atlasJson`, `overrideImageUrl` und `tileSetOptions` werfen einen
    `TypeError`, wenn die Bauform der Resource sie nicht kennt, statt den Wert
    stumm zu verschlucken. Nach `dispose()` bleiben sie still — der Vertrag »ein
    Schreibzugriff tut nichts« gilt dort weiter und wird zuerst geprüft.
  - `TextureStore#load(url, options?)` gibt `Promise<TextureStore>` zurück, aufgelöst
    mit dem Store. Die Promise rejectet nie und sagt »der Versuch ist vorbei«, nicht
    »es hat geklappt«; für den Erfolg bleibt `whenReady()` zuständig.
  - `TextureStore#on()`: der Einzeltyp-Pfad filtert `null` und `undefined` heraus
    wie der Mehrtyp-Pfad. Der Mehrtyp-Pfad liest die Werte von der Resource statt
    aus den Events und liefert einmal je fertigem Tupel statt einmal je
    Subtyp-Event. `get()` erbt den Filter und kann nicht mehr mit `undefined`
    resolven.
  - Fehler-Payloads: `status?: number` neu an den Fetch-Fehlern von Store und
    Resource, `id?: string` neu an den `parse`-Fehlern des Stores,
    `source: 'frameBasedAnimations'` neu an der Resource. Die `error`-Quellen des
    Stores sind `'fetch' | 'parse'` und sonst nichts; `atlas` und `image` werden an
    der Resource abonniert.
  - `TextureStore#parse()` validiert vollständig, bevor es schreibt: bei einem
    Typkonflikt wirft es einen Fehler, der alle aufzählt, und hat dann nichts
    geschrieben und nichts emittiert. Ein Item ohne Quelle erzeugt ein
    `error`-Event — das statische `TextureStore.load()` rejectet darauf.
  - Repoweit ab jetzt verbindlich: `eslint.config.mjs` verbietet über
    `no-restricted-syntax` jede Import- oder Export-Quelle, die auf `.ts` endet.
    Relative Importe tragen `.js` (NodeNext); ein `.ts`-Suffix landet unverändert
    in der veröffentlichten `.d.ts`. Das trifft jedes Folgepaket.

#### Die Findings im Wortlaut

**ASYNC-001 · low · `packages/twopoint5d/src/texture/TextureStore.ts:178-201`** — TextureStore.load() als Instanz-Methode ist nicht awaitable
Die Methode startet ein `void (async () => ...)()` nach dem Fire-and-forget-Muster. Erfolg oder Misserfolg beobachtet der Aufrufer separat über `whenReady()`. Die statische Variante tut inzwischen beides — zwei Methoden gleichen Namens in derselben Klasse, mit unterschiedlichem Vertrag.
Empfehlung: Entweder die Instanz-Methode die intern ohnehin vorhandene Promise zurückgeben lassen, oder die asynchrone Semantik klar dokumentieren.

**ARCH-003 · low · `packages/twopoint5d/src/texture/TextureResource.ts`** — Inkonsistenz-Fenster zwischen atlas und texture bei Atlas-Resources
Der Atlas-Effect und der Texture-Effect laufen unabhängig voneinander. Wechselt die `overrideImageUrl`, existiert ein Zeitfenster, in dem `atlas` schon zur neuen Datei gehört und `texture` noch zur alten. Wer per `on(id, [atlas, texture], ...)` subscribed, bekommt das Tupel — unter Umständen mit einem veralteten Element.
Empfehlung: Zusammengehörige Updates atomar batchen, oder den Atlas-Effect erst feuern lassen, wenn die zugehörige Texture wieder zur `imageUrl` passt. Ein Hash über die URL als Korrelationsschlüssel reicht.

**API-035 · low · `packages/twopoint5d/src/texture/TextureResource.ts:197-251, 288-294`** — TextureResource hat Setter für Werte, die seine eigenen Effekte berechnen
`imageCoords`, `atlas`, `tileSet`, `texture` und `frameBasedAnimations` sind abgeleitete Werte, die die Effekte in `load()` aus `imageUrl`, `atlasUrl`, `tileSetOptions` und den Animationsdaten erzeugen. Alle fünf haben öffentliche Setter. Wer `resource.texture = eigeneTextur` schreibt, sieht sie beim nächsten Effektlauf überschrieben, ohne dass Typ oder Doku warnen; und das Signal disposed beim Effekt-Cleanup nur die selbst erzeugte Textur, nicht die fremde. Welche Felder Eingabe und welche Ausgabe sind, steht nirgends.
Empfehlung: Die abgeleiteten Felder als Getter exponieren und die Setter auf `protected` oder in eine interne Methode ziehen. Im TSDoc der Klasse die Eingabefelder auflisten.

**API-039 · low · `packages/twopoint5d/src/texture/TextureStore.ts:352-356`** — Der Einzeltyp-Pfad von TextureStore.on() reicht undefined als Texture weiter
Der Einzeltyp-Pfad von `on()` reicht den Wert eines Subtyp-Events ungeprüft an `callback(val as MapSubTypes<T>)` weiter, während der Mehrtyp-Pfad daneben `null` und `undefined` herausfiltert. Wer ein Signal räumt und dabei benachrichtigt, liefert einem Callback ein `undefined`, dessen Typ eine `Texture` zusagt.
Empfehlung: Denselben Filter wie im Mehrtyp-Pfad anwenden, oder den Callback-Typ auf `T | undefined` erweitern; eine Verhaltensänderung an `on()`, die dokumentiert gehört.

**API-040 · low · `packages/twopoint5d/src/texture/TextureResource.ts:209, 217, 225, 233, 241, 249`** — Sechs Setter der TextureResource verschlucken ihren Wert auf der falschen Bauform
Sechs Setter schreiben über `?.` in ein Signal, das nur die passende Bauform der Resource überhaupt anlegt. Auf einer `image`-Resource verschluckt `resource.tileSet = …` seinen Wert stumm, und der Getter daneben antwortet weiter `undefined`. Der Aufrufer bekommt keinen Hinweis, dass die Zuweisung nirgends angekommen ist.
Empfehlung: Auf der falschen Bauform werfen, oder die Setter nach der bereits offenen Frage aus API-035 gleich mit aus der öffentlichen Fläche nehmen.

**BUG-044 · low · `packages/twopoint5d/src/texture/TextureResource.ts:406-421, 472-484`** — Animationsdaten des falschen Typs laufen still in einen Alle-Tiles-Zweig
Der Tileset-Effekt unterscheidet nur `'tileIds' in data`; alles andere wird per Cast zu `FrameBasedAnimationsDataByTileCount`. Ein Eintrag mit `frameNameQuery` (die Atlas-Form) auf einer Tileset-Resource landet so mit `firstTileId = undefined` und `tileCount = undefined` in `add()`, was auf `tileSet.firstId` und `tileSet.tileCount` zurückfällt: eine Animation über sämtliche Tiles, ohne Fehler. Der Atlas-Effekt umgekehrt überspringt `tileIds`-Einträge kommentarlos. Eine vertauschte Konfiguration bleibt in beiden Richtungen unsichtbar.
Empfehlung: Die drei Datenformen über einen Discriminator prüfen (`'frameNameQuery' in data`, `'tileIds' in data`, `'firstTileId' in data`) und bei einer Form, die nicht zum Resource-Typ passt, ein `error`-Event mit Animationsname und Resource-id emittieren.

**BUG-045 · low · `packages/twopoint5d/src/texture/TextureStore.ts:182-189`; `packages/twopoint5d/src/texture/TextureResource.ts:508-511`** — Kein response.ok-Check vor dem JSON-Parsen
Beide Fetch-Pfade parsen `response.json()` ungeachtet des Statuscodes. Ein 404 mit HTML-Body scheitert zufällig am Parser und wird zum `error`-Event; ein 404 oder 500 mit JSON-Body (die übliche API-Fehlerantwort) läuft als Katalog beziehungsweise Atlas weiter. Im Atlas-Pfad wirft dann `this.atlasJson.meta.image` innerhalb eines Effekts, und die Meldung nennt weder URL noch Status.
Empfehlung: `if (!response.ok)` vor dem Parsen, mit einem `error`-Event, das `status` und `url` trägt.

**BUG-048 · low · `packages/twopoint5d/src/texture/TextureStore.ts:216-282`** — parse() ignoriert Einträge ohne Quelle und lässt bei einem Typkonflikt halbe Zustände zurück
Ein Item ohne `tileSet`, `atlasUrl` und `imageUrl` erzeugt keine Resource und keinen Hinweis; `whenResource(id)` rejectet später mit »check your items keys«, obwohl der Key da ist. Trifft `parse()` in der Schleife auf eine id, deren Typ sich geändert hat, wirft es mitten im `batch()`: die bis dahin aktualisierten Resources sind geschrieben, `OnReady` und die `resource:<id>`-Events bleiben aus. Ein zweiter `parse()` mit korrigierten Daten heilt das, aber niemand erfährt, dass der erste halb durchlief.
Empfehlung: Vor dem `batch()` alle Items validieren und Typkonflikte gesammelt melden, dann erst schreiben. Items ohne Quelle als `error`-Event mit `source: 'parse'` und der id ausweisen.

**PERF-005 · low · `packages/twopoint5d/src/texture/TextureStore.ts`** — Kein Dedup-Cache für Bild-Fetches
Referenzieren zwei Resources dieselbe `imageUrl`, werden zwei `ImageLoader`-Requests abgesetzt und zwei `Texture`-Objekte erzeugt.
Empfehlung: Ein `imageUrl → Promise<HTMLImageElement>`-Cache am Store, mit Refcount für den Abbau. Der Aufwand ist gering, der Nutzen steigt linear mit der Zahl geteilter Atlanten.

**DOC-018 · low · `packages/twopoint5d/src/texture/TextureStore.ts:54` gegen `:313, :320, :326`** — Das Error-Event des TextureStore nennt zwei Quellen, die dort nie ankommen
Das TSDoc von `TextureStoreEvents.Error` nennt als Quellen `'fetch'|'parse'|'atlas'|'image'`. Der Store emittiert `fetch` und `parse`; `atlas` und `image` kommen aus `TextureResource` und erreichen den Store nie. Wer sich auf die Liste verlässt, wartet am Store auf ein Event, das dort nicht ankommt — und findet den Grund nicht, weil die Doku ihm recht gibt.
Empfehlung: Die Liste auf `'fetch'|'parse'` kürzen und in einem Halbsatz sagen, wo `atlas` und `image` stattdessen zu abonnieren sind.

**CONS-002 · info · `packages/twopoint5d/src/texture/TextureResource.ts`** — cmpTexCoords und cmpTileSetOptions vergleichen Felder einzeln
Beide Vergleichsfunktionen zählen ihre Felder auf. Wird `TileSetOptions` erweitert, vergleicht die Funktion das neue Feld stillschweigend nicht mit — und der Signal-Compare meldet fälschlich Gleichheit.
Empfehlung: Über `Object.keys` plus zentralen Diff. Niedrige Priorität, aber die Sorte Fehler, die erst Monate später als »warum aktualisiert sich das nicht« auftaucht.

**CONS-014 · low · `packages/twopoint5d/src/texture/TextureResource.ts:12`** — Ein .ts-Suffix-Import landet im veröffentlichten .d.ts
Die einzige Importzeile der Bibliothek mit `.ts`-Endung. TypeScript lässt sie für `import type` durch, und `tsc` schreibt sie unverändert in die Deklarationsdatei: `import type {…} from './types.ts'`. Konsumenten mit TypeScript vor 5.0 oder mit Werkzeugen, die Deklarationen selbst auflösen, sehen dort eine Endung, die es im Paket nicht gibt. `attw` und `publint` schlagen nicht an, weil die Auflösung strukturell klappt.
Empfehlung: Auf `./types.js` ändern, wie die übrigen 169 Importe. Eine ESLint-Regel (`no-restricted-syntax` auf Import-Quellen, die auf `.ts` enden) verhindert die Wiederholung.

### [x] 3. Texture-Atlas, Animationen und Ladepfade
- Findings: BUG-037, BUG-043, BUG-065, API-034, CONS-012, TYPE-007
- Ziel: Namenskollisionen und unbekannte Namen bleiben nicht stumm, der
  Fehler-Callback erreicht den Aufrufer, und der Compiler prüft wieder mit.
- Bereich: `packages/twopoint5d/src/texture/` (TextureAtlas,
  FrameBasedAnimations, TextureAtlasLoader, TextureFactory, TextureResource,
  types), `src/map2d/chunk-quad-tree/base64toUint32Arr.ts`
- Hängt ab von: —
- Hash: 93590a1
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/src/texture/TextureAtlas.ts`,
  `packages/twopoint5d/src/texture/TextureAtlas.spec.ts`,
  `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`,
  `packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts`,
  `packages/twopoint5d/src/texture/TextureFactory.ts`,
  `packages/twopoint5d/src/texture/TextureFactory.spec.ts`,
  `packages/twopoint5d/src/texture/TextureAtlasLoader.ts`,
  `packages/twopoint5d/src/texture/TextureAtlasLoader.spec.ts` (neu),
  `packages/twopoint5d/src/texture/types.ts`,
  `packages/twopoint5d/src/texture/TextureResource.ts`,
  `packages/twopoint5d/src/texture/TextureResource.spec.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/base64toUint32Arr.ts`,
  `packages/twopoint5d/CHANGELOG.md`

#### Was der Abgleich ergeben hat

Alle sechs Findings existieren unverändert, und **alle Fundstellen stimmen auf die
Zeile** — Paket 1 hat `src/display/` und `src/controls/` angefasst, Paket 2
`TextureStore.ts` und `TextureResource.ts`. Keine der sechs Dateien dieses Pakets
lag in einem der beiden.

| Finding | Fundstelle laut Audit | Stand jetzt |
| --- | --- | --- |
| BUG-037 | `TextureAtlas.ts:29-38` | unverändert, `add()` steht auf `:29-38` |
| BUG-043 | `FrameBasedAnimations.ts:141` | unverändert |
| BUG-065 | `TextureFactory.ts:178-182` | unverändert |
| API-034 | `FrameBasedAnimations.ts:176` | unverändert (`animId()` auf `:175-177`) |
| CONS-012 | `FrameBasedAnimations.ts:24`, `types.ts:22` | unverändert, beide Deklarationen wörtlich gleich |
| TYPE-007 | `TextureAtlasLoader.ts:43`, `FrameBasedAnimations.ts:141`, `base64toUint32Arr.ts:2` | alle drei unverändert; in `base64toUint32Arr.ts:2` sind es zwei `any` in einer Zeile |

Vier Dinge, die der Abgleich zusätzlich ergeben hat und die die Schritte unten
tragen:

- **`FrameBasedAnimationsTimingData` war im letzten Release nicht exportiert.**
  Belegt gegen `6217477` (»chore: update to twopoint5d v0.21.2«): dort steht
  `type FrameBasedAnimationsTimingData = …` ohne `export`, während
  `AnimationTimingOptions` schon `export type` war. Der Export kam erst in diesem
  Unreleased-Zyklus (CHANGELOG-Eintrag über die 31 nameable gemachten Typen).
  Deshalb fällt in Schritt 5 der jüngere Name weg und nicht der veröffentlichte.
- **`animId()` ist als werfende Methode bereits festgenagelt.**
  `TextureResource.spec.ts:236` und `:269` (aus Paket 2) prüfen
  `expect(() => …animId('walk')).toThrow()` als dokumentiertes Verhalten für einen
  Namen, der nie registriert wurde. Der Rückgabewert wandert außerdem direkt in ein
  typisiertes VO-Feld (`AnimatedSprite#animId: number`, über
  `BouncingSprites#createSprites(count, animId)` in beiden Lookbook-Demos) — ein
  `undefined` würde dort still zu `NaN` und zu einem unsichtbaren Sprite. Deshalb
  wählt Schritt 3 die zweite Variante der Audit-Empfehlung.
- **Kein Aufrufer im Repo kollidiert mit dem Fix von BUG-037.**
  `TexturePackerJson.parse()` (`:39-41`) und `TileSet` (`:157`) füttern
  `TextureAtlas#add` aus `Object.entries` beziehungsweise unbenannt. Erreichbar ist
  die Kollision über den dritten Parameter von `TexturePackerJson.parse(data,
  parentCoords, target)`, mit dem sich zwei Atlas-JSONs in denselben Atlas parsen
  lassen; den benutzt im Repo niemand, ein Bibliotheksnutzer aber schon.
- **Kein Test nagelt die Frame-Reihenfolge einer Atlas-Animation fest.**
  Geprüft über alle `*.spec.ts` und `packages/twopoint5d-testing/test/*.js`: die
  beiden Atlas-Tests in `FrameBasedAnimations.spec.ts:81-107` prüfen `animId`, nicht
  die Frames. Der Comparator aus Schritt 2 bricht also nichts.

**Die zwei Einträge aus »Offene Befunde«, die Paket 2 diesem Zug 0 vorgelegt hat,
gehören in dieses Paket** — beide tragen `→ Scope`, beide sind derselbe Defekt, und
sein Fix sitzt in der Mechanik, die dieses Paket ohnehin aufmacht. Am Code geprüft:
`TextureResource.ts:565` und `:664` rufen `getTimingOptions(data)`, `:567`, `:569`
und `:665` rufen `animations.add(…)`, beide ohne Sicherung. Zwei Würfe sind real
erreichbar — `getTimingOptions` bei einem Eintrag ohne `duration` und ohne
`frameRate`, und `resolveDuration` → `calculateDurationFromFrameRate` bei
`frameRate: 0` —, und jeder von ihnen reißt den ganzen Effektlauf mit: die Zeile
`this.#frameBasedAnimations.set(animations)` am Ende der Schleife wird nie
erreicht, **keine** Animation der Map wird registriert, und der Wurf verlässt den
Effekt über den globalen Fehlerkanal von signalize statt über ein `error`-Event.
Die Begründung des Queue-Eintrags zu `FrameBasedAnimations.ts:129` trägt nur
halb — über `Object.entries` eines `Record` kann kein doppelter Name entstehen —,
sein Kern trägt ganz: jeder Wurf aus `add()` nimmt denselben Weg hinaus. Schritt 6
fängt sie alle. Beide Zeilen stehen in »Offene Befunde« auf `[x]` mit dem Verweis
hierher.

#### Vorgehen

Die Schritte sind unabhängig voneinander bis auf Schritt 5, der nach 2 und 3 läuft
(er fasst dieselbe Datei an). Jeder Korrektheitsfehler bekommt seinen
Regressionstest **zuerst**, rot gesehen, dann den Fix; der rote Lauf gehört in den
Report.

**1. `TextureAtlas#add()` wirft auf einem vergebenen Namen (BUG-037).**

In `TextureAtlas.ts:29-38`, im `isNamedTextureAtlasArgs`-Zweig und **vor** dem
`push`, damit kein halber Frame entsteht:

```ts
add(...args: TextureAtlasArgs | NamedTextureAtlasArgs): number {
  const id = this.#frames.length;
  if (isNamedTextureAtlasArgs(args)) {
    if (this.#frameNames.has(args[0])) {
      throw new Error(`TextureAtlas: the frame name "${args[0].toString()}" is already taken`);
    }
    this.#frameNames.set(args[0], id);
    this.#frames.push({coords: args[1], data: args[2]});
  } else {
    …
  }
}
```

`args[0].toString()` und nicht die Template-Interpolation: der Name kann ein
`symbol` sein, und eine Interpolation wirft darauf ihrerseits — dieselbe Falle, die
Schritt 2 aus `.sort()` nimmt. `FrameBasedAnimations#add:129` macht es genauso.

Das TSDoc über `add()` bekommt einen Satz: ein Name gehört genau einem Frame, ein
zweiter Frame unter demselben Namen wird abgelehnt.

Regressionstest (rot zuerst), in `TextureAtlas.spec.ts` unter `describe('add')`:
zweimal `atlas.add('foo', coords)` wirft beim zweiten Mal, `atlas.size` ist danach
`1`, und `atlas.frame('foo').coords` ist die **erste** Coords-Instanz. Vor dem Fix
läuft der zweite Aufruf durch, `size` steht auf 2 und der erste Frame ist über
seinen Namen nicht mehr erreichbar.

**2. Eine Atlas-Animation nimmt String-Namen in verlässlicher Reihenfolge
(BUG-043, TYPE-007 Stelle 2).**

`FrameBasedAnimations.ts:139-142`, der Atlas-Zweig von `add()`:

```ts
} else if (args[2] instanceof TextureAtlas) {
  const atlas = args[2];
  // Only string names go into an animation: a frame registered under a symbol has no
  // place in an ordered sequence, and the default comparator of Array#sort() converts
  // every value to a string, which throws on a symbol.
  // The collator orders "walk.2" before "walk.10"; the frames of an animation are a
  // sequence, and a plain lexicographic order breaks it for every name that carries an
  // unpadded number.
  const frameNameQuery = typeof args[3] === 'string' ? args[3] : undefined;
  const frameNames = atlas
    .frameNames(frameNameQuery)
    .filter((name) => typeof name === 'string')
    .sort(FRAME_NAME_ORDER.compare);
  frames = frameNames.map((frameName) => atlas.frame(frameName)!.coords);
}
```

Dazu modulweit `const FRAME_NAME_ORDER = new Intl.Collator('en', {numeric: true});`.

Der Cast `args[3] as any` entfällt damit ersatzlos — das ist die zweite der drei
Stellen aus TYPE-007. `frameNames()` selbst bleibt **unverändert**: sein TSDoc sagt
zu, ohne Argument alle Namen samt Symbolen zu liefern, und
`TextureAtlas.spec.ts:138-150` nagelt das fest.

Das Überladungs-TSDoc von `add()` hält fest, dass nur benannte String-Frames in eine
Atlas-Animation eingehen und in welcher Ordnung.

Regressionstests (rot zuerst), zwei in `FrameBasedAnimations.spec.ts` unter
`describe('add with TextureAtlas')`:
1. Ein Atlas mit einem Symbol-Frame neben zwei String-Frames lässt sich ohne
   `frameNameQuery` zu einer Animation machen. Vor dem Fix wirft `add()` mit
   `TypeError: Cannot convert a Symbol value to a string`.
2. Ein Atlas mit `walk.1`, `walk.2`, `walk.10` liefert die Frames in dieser
   Reihenfolge — geprüft über drei unterscheidbare `TextureCoords` (verschiedene
   `x`) und die gebackene DataTexture oder direkt über die Coords-Identität der
   Frames. Vor dem Fix steht `walk.10` an zweiter Stelle.

**3. `animId()` sagt, welcher Name fehlt (API-034).**

`FrameBasedAnimations.ts:175-177`:

```ts
/**
 * The id of a registered animation. A name that was never registered is an error,
 * not an absent value: the id goes straight into a typed vertex-object buffer, where
 * an `undefined` would quietly become `NaN`. Ask `hasAnimation()` first when the name
 * comes from outside.
 */
animId(name: AnimName): number {
  const anim = this.#animations.get(name);
  if (anim == null) {
    throw new Error(`FrameBasedAnimations: there is no animation named "${name.toString()}"`);
  }
  return anim.id;
}

/** Whether an animation is registered under this name. */
hasAnimation(name: AnimName): boolean {
  return this.#animations.has(name);
}
```

`hasAnimation()` gehört zum Fix und ist nicht Beiwerk: wer werfen lässt statt
`undefined` zu liefern, muss eine Prüfung anbieten, sonst bleibt `try/catch` der
einzige Weg, einen Namen aus Nutzerdaten zu testen.

Regressionstest (rot zuerst) in `FrameBasedAnimations.spec.ts` unter
`describe('animId')`: ein unbekannter Name wirft mit einer Meldung, die den Namen
enthält (`toThrow(/nope/)`), und `hasAnimation('nope')` ist `false`. Vor dem Fix
wirft es einen `TypeError` über `undefined`, in dem der Name nicht vorkommt.

**4. `TextureFactory` bekommt einen Fehlerweg (BUG-065).**

Zwei Zugänge, weil `load()` synchron eine `Texture` liefert und `...classNames` ein
Rest-Parameter ist — hinter den passt kein Callback mehr:

```ts
export interface TextureLoadOptions {
  onError?: (err: unknown) => void;
  onProgress?: (event: ProgressEvent) => void;
}

load(url: string, ...classNames: Array<TextureOptionClasses>): Texture;
load(url: string, options: TextureLoadOptions, ...classNames: Array<TextureOptionClasses>): Texture;
load(url: string, ...args: [TextureLoadOptions?, ...Array<TextureOptionClasses>] | Array<TextureOptionClasses>): Texture {
  const hasOptions = typeof args[0] === 'object' && args[0] != null;
  const options = hasOptions ? (args[0] as TextureLoadOptions) : undefined;
  const classNames = (hasOptions ? args.slice(1) : args) as Array<TextureOptionClasses>;

  return this.textureLoader.load(
    url,
    (texture) => {
      this.update(texture, ...classNames);
    },
    options?.onProgress,
    options?.onError,
  );
}

/**
 * The texture at `url`, with the texture classes applied once it is there.
 * A load that fails rejects — the error cannot be missed, which is the difference to
 * `load()`, where it has to be asked for through `onError`.
 */
loadAsync(url: string, textureClasses?: Array<TextureOptionClasses>): Promise<Texture> {
  return this.textureLoader.loadAsync(url).then((texture) => this.update(texture, ...(textureClasses ?? [])));
}
```

Die Unterscheidung am ersten Argument ist verlässlich: `TextureOptionClasses` sind
ausschließlich String-Literale, das Optionsobjekt ist ein Objekt. Dasselbe Muster
steht in `TextureAtlas.ts:16` (`isNamedTextureAtlasArgs`).

`loadAsync(url, textureClasses?)` nimmt ein Array und keinen Rest — das ist die Form
der Geschwister `TextureImageLoader#loadAsync(url, textureClasses)`,
`TextureAtlasLoader#loadAsync(url, textureClasses, options)` und
`PowerOf2ImageLoader`. Diese Familie ist der Grund, warum die Factory **kein**
`error`-Event über eventize bekommt, obwohl `TextureStore` und `TextureResource` es
so machen: die Loader dieses Moduls melden über Callback und Promise, und eine
siebte Bauform in derselben Fläche wäre die schlechtere Konsistenz.

Der Rückgabewert von `load()` bleibt die three.js-Textur, die sich selbst
nachträglich füllt; an der Signatur bricht nichts. Die fünf Aufrufer im Lookbook
(`stage-nested-pipelines.astro:32,33`, `display-minimal.astro:33`,
`stage-postprocessing.astro:54`, `display-multi.astro:108`) bleiben unverändert —
sie funktionieren weiter und sind nicht Teil dieses Pakets.

Tests in `TextureFactory.spec.ts`: `loadAsync` rejectet, wenn der `TextureLoader`
scheitert, und wendet die Klassen auf die geladene Textur an; `load(url, {onError},
'nearest')` reicht den Callback durch und wendet trotzdem `nearest` an. Beide über
einen Stub auf `TextureLoader.prototype.load` beziehungsweise `.loadAsync`
(`vi.spyOn`) — kein echter Netzverkehr. Kein roter Vorlauf nötig: die Methoden
existieren vorher nicht, ein Test darauf ist per Bau rot.

**5. Ein Name für den Timing-Typ (CONS-012).**

`AnimationTimingOptions` bleibt, `FrameBasedAnimationsTimingData` fällt weg. Grund
steht im Abgleich oben: der eine ist seit Releases veröffentlicht, der andere wurde
erst in diesem noch unveröffentlichten Zyklus exportierbar. Ein veröffentlichter
Name wird nicht wegen eines nie veröffentlichten gestrichen.

- `types.ts:22` — die Deklaration entfällt; stattdessen
  `import type {AnimationTimingOptions} from './FrameBasedAnimations.js';` am Kopf.
  Die drei Data-Typen (`:27`, `:35`, `:45`) bilden auf `AnimationTimingOptions & {…}`
  ab. Der TSDoc-Block über der entfallenden Deklaration (`:6-21`, mit den beiden
  Beispielen) wandert an `AnimationTimingOptions` in `FrameBasedAnimations.ts:20-24`
  und ersetzt dessen zwei Zeilen — er ist der ausführlichere von beiden.
- Zyklenfrei geprüft: `FrameBasedAnimations.ts` importiert `types.js` nicht.
- `TextureResource.ts:6` importiert `AnimationTimingOptions` bereits und bleibt, wie
  es ist.
- `packages/twopoint5d/CHANGELOG.md`, Unreleased/Added, der Eintrag »export 31 types
  that stood in public signatures…«: `FrameBasedAnimationsTimingData` aus der
  Aufzählung streichen und die Zahl auf 30 setzen. Unreleased-Abschnitte sind
  änderbar, veröffentlichte nicht.

Kein Regressionstest — die Zusammenlegung ist eine Typänderung, und `pnpm typecheck`
plus `checkNameableTypes` im Gate sind ihr Nachweis.

**6. Ein fehlerhafter Animationseintrag reißt nicht die ganze Map mit.**

Die beiden Animations-Effekte in `TextureResource.ts` (`:552-575` Tileset,
`:657-676` Atlas) sichern ihren Schleifenrumpf je Eintrag ab. Der Tileset-Effekt,
nach der bereits vorhandenen Formprüfung:

```ts
for (const [name, data] of Object.entries(this.frameBasedAnimationsData)) {
  const shape = animationDataShape(data);
  if (shape !== 'tileIds' && shape !== 'firstTileId') {
    emit(this, OnError, wrongAnimationDataError(this, name, shape));
    continue;
  }
  try {
    const timing = getTimingOptions(data);
    …
  } catch (error) {
    // One bad entry skips itself. Without this the throw leaves the effect through the
    // global error channel of signalize, no animation of the whole map is registered,
    // and the caller is told nothing.
    emit(this, OnError, {source: 'frameBasedAnimations', id: this.id, animation: name, error});
  }
}
```

Der Atlas-Effekt entsprechend um seinen `getTimingOptions`/`add`-Block. Die Payload
ist dieselbe, die Paket 2 dort eingeführt hat; `wrongAnimationDataError` bleibt für
den Formfall zuständig und wird nicht angefasst.

`getTimingOptions` und `FrameBasedAnimations#add` selbst werfen weiter: sie sind
Bibliotheks-API mit einem Vertrag, und der Ort zum Fangen ist der, der aus
Nutzerdaten baut.

Der TSDoc-Block `TextureResourceEvents` (`TextureResource.ts:59-68`) sagt bei
`frameBasedAnimations` schon »an animation entry whose data does not fit this kind of
resource — that entry is skipped«; er bekommt den zweiten Grund dazu: ein Eintrag,
dessen Daten die Animation nicht bauen lassen — kein `duration` und kein
`frameRate`, ein `frameRate` von 0 —, wird ebenso übersprungen und gemeldet.

Regressionstests (rot zuerst), zwei in `TextureResource.spec.ts` neben den beiden
Tests aus Paket 2 (`:200-271`), die die Mechanik schon aufgebaut haben:
1. Eine Tileset-Resource mit zwei Animationen, von denen die erste weder `duration`
   noch `frameRate` trägt: ein `error`-Event mit `source: 'frameBasedAnimations'` und
   dem Namen der ersten, und `animId` der **zweiten** antwortet mit ihrer id. Vor dem
   Fix ist `resource.frameBasedAnimations` `undefined` und es kommt kein Event.
2. Dieselbe Form mit `{frameRate: 0, tileIds: [1, 2]}` — der Wurf kommt dann aus
   `resolveDuration` heraus statt aus `getTimingOptions`, und die Absicherung muss
   auch ihn fangen.

**7. Die Atlas-JSON bekommt eine geprüfte Form (TYPE-007 Stelle 1).**

`TextureAtlasLoader.ts:43`. `FileLoader#load` typisiert seinen Callback als
`(data: string | ArrayBuffer) => void`, mit `setResponseType('json')` kommt aber ein
geparstes Objekt an — daher das `any`. Statt es zu behalten:

```ts
const isTexturePackerJsonData = (value: unknown): value is TexturePackerJsonData => {
  if (typeof value !== 'object' || value == null) return false;
  const {frames, meta} = value as Partial<TexturePackerJsonData>;
  return typeof frames === 'object' && frames != null && typeof meta?.image === 'string';
};
```

und im Callback:

```ts
(jsonData) => {
  if (!isTexturePackerJsonData(jsonData)) {
    onErrorCallback?.(new Error(`TextureAtlasLoader: the response of "${url}" is no texture atlas json`));
    return;
  }
  const imageUrl = options?.overrideImageUrl ?? jsonData.meta.image;
  …
}
```

Der Parameter bleibt ohne Annotation — three.js gibt ihm `string | ArrayBuffer`, und
der Type-Guard nimmt `unknown` entgegen; genügt das dem Compiler nicht, ist
`(jsonData: unknown)` die Annotation und **nicht** `any`. Das schließt nebenbei einen
realen Weg: eine JSON ohne `meta.image` wirft heute in `:44` einen `TypeError` aus
dem Nichts, an dem `loadAsync()` mit einer Meldung rejectet, die weder URL noch
Grund nennt.

Regressionstest (rot zuerst) in einer neuen `TextureAtlasLoader.spec.ts`: ein
`fileLoader`-Stub, der `{}` liefert, lässt
`loader.loadAsync('atlas.json')` mit einer Meldung rejecten, die die URL nennt, und
der `textureImageLoader` wird nicht gerufen. Vor dem Fix rejectet es mit
`Cannot read properties of undefined (reading 'image')`. Beide Loader werden über den
`defaults`-Parameter des Konstruktors injiziert — dafür ist er da.

**8. `base64toUint32Arr` ohne `any` (TYPE-007 Stelle 3).**

`src/map2d/chunk-quad-tree/base64toUint32Arr.ts:2`, zwei `any` in einer Zeile:

```ts
export function base64toUint32Arr(base64: string, isLittleEndian = true): Uint32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  …
}
```

Verhaltensgleich, auch beim Abschneiden einer Länge, die kein Vielfaches von 4 ist.
Der einzige Aufrufer ist `DataIdsChunk2D.ts:49`, die Signatur bleibt. Kein
Regressionstest — es ist kein Korrektheitsfehler, und `pnpm typecheck` ist der
Nachweis.

**9. CHANGELOG.**

`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, im Stil der vorhandenen
Einträge: ausformulierte Sätze, ohne Kenntnis des Vorzustands lesbar, keine
Finding-IDs.

Unter »Added«: `TextureFactory#loadAsync()` und die `TextureLoadOptions` an
`load()`; `FrameBasedAnimations#hasAnimation()`.
Unter »Changed«: der abgelehnte doppelte Frame-Name in `TextureAtlas#add()`; die auf
String-Namen und eine numerische Ordnung festgelegte Atlas-Animation; die Meldung von
`animId()`; der übersprungene und gemeldete Animationseintrag, dessen Timing nicht
trägt; die geprüfte Form der Atlas-JSON.
Dazu die Korrektur des Added-Eintrags über die exportierten Typen aus Schritt 5.

#### Wo dieses Paket aufhört

Nicht Teil dieses Pakets, damit der Implementierer nicht ausschweift: die fünf
`textureFactory.load()`-Aufrufe im Lookbook bleiben, wie sie sind — sie brechen
nicht und ein Fehlerweg dort ist eigene Arbeit. `frameNames()` behält sein
Verhalten. `TextureStore` und die Effekte von `TextureResource` außerhalb der beiden
Animationsschleifen werden nicht angefasst.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
  (`AGENTS.md` bindet das Repo auf dieses Gate. Das Überspringen des Nx-Caches hat
  sich in Paket 1 als nötig erwiesen, damit kein Task als Treffer aus dem Cache des
  Implementierers durchgewinkt wird.)
- Commit: `fix(twopoint5d): report taken frame names and unusable animation data instead of swallowing them`

  Footer, weil `AGENTS.md` das Repo an Conventional Commits bindet und das Paket die
  öffentliche Fläche dreifach bricht:

  ```
  BREAKING CHANGE: TextureAtlas#add() throws on a frame name that is already taken instead of overwriting it; the frames of an atlas animation are the string-named ones in numeric order, so an atlas carrying symbol names no longer throws and "walk.2" comes before "walk.10"; the meta of an atlas loaded with an overrideImageUrl names that image instead of the one the json carries.
  ```

  Der Footer weicht in zwei Punkten von dem ab, was Zug 0 aufgeschrieben hat, und
  beide Male, weil ein Review es nachgemessen hat: `FrameBasedAnimationsTimingData`
  war nie veröffentlicht (belegt gegen `6217477`, dort ohne `export`) und bricht
  deshalb keinen Aufrufer — der Punkt ist herausgefallen. Dafür ist die Bedeutung
  von `meta.image` dazugekommen, die Runde 2 gedreht hat; sie trägt einen eigenen
  Block im Migration Guide, und Footer und Guide sagen dasselbe.
- Ergebnis: 2 Runden · alle 6 Findings behoben, von drei Reviewern je mit
  Fundstelle bestätigt, dazu die beiden Queue-Einträge aus Paket 2
  (`TextureResource.ts:19` und `FrameBasedAnimations.ts:129`), die Zug 0 diesem
  Paket zugeschlagen hatte · Regressionstests, jeder vor seinem Fix rot:
  `a name that is already taken is refused` (der zweite `add` lief durch, `size`
  stand auf 2), `a frame registered under a symbol stays out of the animation`
  (`TypeError: Cannot convert a Symbol value to a string`),
  `frame names carrying a number are ordered by that number`
  (`walk.10` stand an zweiter Stelle),
  `a name that was never registered is an error naming that name` (der alte
  `TypeError` nannte den Namen nicht),
  `an animation entry without a duration and without a frameRate is skipped and
  reported` und `an animation entry with a frameRate of 0 is skipped and reported`
  (Quelle war `image` statt `frameBasedAnimations`, weil der Wurf über den
  `.catch()` des Bild-Effekts hinausging),
  `a response that is no texture atlas json is reported with its url`
  (`Cannot read properties of undefined (reading 'image')`),
  `an atlas animation entry whose timing does not carry is skipped and reported`
  (mit probeweise entfernter Absicherung rot),
  `a frame name query narrows the animation as a RegExp just as it does as a string`
  (3 statt 2 Frames),
  `an atlas json that names no image loads with an overrideImageUrl` (wurde vom
  Guard abgewiesen),
  `the meta of a loaded atlas names the image that was loaded`
  (`undefined` statt `sprites.png`) ·
  Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 über alle neun Stufen, Log
  `paket-3.verify.log` · drei Abweichungen vom Detailplan, jede von einem Review
  ausgelöst und nachgemessen: `TextureLoadOptions.onProgress` gestrichen statt
  dokumentiert, weil three.js den Parameter in `ImageLoader#load` als »Unsupported
  in this loader« führt und eine Option, die nie feuert, schlechter ist als keine ·
  der Type-Guard aus Schritt 7 prüft `frames` und `meta.size` statt `meta.image`,
  weil der Override-Pfad das Bild selbst mitbringt und ein Prädikat nicht mehr
  zusagen darf, als sein Rumpf prüft · `frameNameQuery` nimmt zusätzlich eine
  `RegExp`, weil `TextureAtlas#frameNames()` sie ohnehin nimmt und der alte
  `as any`-Pfad sie durchreichte · klein und offen geblieben: nichts, beide kleinen
  Befunde des dritten Reviewers stehen unter »Folgen«, weil dieses Paket sie
  erzeugt hat
- Nebenbefunde: → Queue (7 Einträge: `TextureAtlasLoader.ts` Progress-Callback,
  `TextureAtlasLoader.ts` hängende `loadAsync()`, `TextureResource.ts:520-523`,
  `TextureResource.ts:604-639`, `TextureResource.spec.ts:52-54`, `TextureAtlas.ts:3`,
  `FrameBasedAnimations.ts:69`)
- Folgen: beide vom dritten Reviewer gemeldet, beide von Runde 2 dieses Pakets
  erzeugt, beide von Zug 0 des Pakets 9 (2026-09-07) als Symptome derselben Ursache
  eingeordnet und **→ Paket 9** geschoben, statt ein zweites Nachtragspaket zu schneiden
  — Begründung dort unter »Warum ein Paket und nicht zwei«
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:28-35` — der Kommentar
    über dem Type-Guard sagt »Every property the check lets through is one the
    loader and its callers may rely on afterwards«, der Rumpf prüft aber nur eine
    Ebene tief: `size` gilt als `{w: number; h: number}`, geprüft wird nur, dass es
    ein Objekt ist, und die Einträge von `frames` werden gar nicht geprüft.
    `{frames: {a: {}}, meta: {size: {}}}` kommt durch, und `meta.size.w` erreicht
    den Aufrufer als `undefined` unter dem Typ `number`. Entweder eine Ebene tiefer
    prüfen oder den Kommentar sagen lassen, wo die Prüfung aufhört. Dazu: die
    `size`-Klausel ist von keinem Test gedeckt — streicht sie jemand, bleibt die
    Suite grün.
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.spec.ts:60-69` — der Test
    `the meta of a loaded atlas names the image that was loaded` nagelt nur die
    schwächere Hälfte der Zusage fest: die Fixture trägt kein `meta.image`, er
    bestünde also auch gegen ein `image: jsonData.meta.image ?? imageUrl`. Der Fall,
    den der Migration Guide als Bruch führt — die JSON nennt ein Bild und die
    `overrideImageUrl` sticht es aus —, ist ungetestet. Eine zweite Fixture mit
    `meta.image: 'from-json.png'` und der Erwartung `meta.image === 'sprites.png'`
    hielte die dokumentierte Zusage.
- Schnittstellen:
  - `TextureAtlas#add()` wirft, wenn der Frame-Name schon vergeben ist, statt die
    Zuordnung zu überschreiben. Wer denselben Namen zweimal vergeben könnte, fragt
    vorher `frameId(name)`.
  - `FrameBasedAnimations#add()`, Atlas-Variante: der vierte Parameter heißt
    `frameNameQuery?: string | RegExp`. In die Animation gehen nur Frames mit
    String-Namen ein, in der Ordnung von `Intl.Collator('en', {numeric: true})` —
    `walk.2` vor `walk.10`. Bei Gleichstand (`walk.01` neben `walk.1`) entscheidet
    die Registrierungsreihenfolge, weil `Array#sort()` stabil ist.
  - `FrameBasedAnimations#animId(name)` wirft mit einer Meldung, die den Namen
    nennt, statt einen `TypeError` auf `undefined` zu erzeugen. Neu daneben:
    `hasAnimation(name): boolean` für Namen aus Nutzerdaten.
  - `FrameBasedAnimationsTimingData` ist entfallen. `AnimationTimingOptions` in
    `FrameBasedAnimations.ts` ist der eine Name; `types.ts` importiert ihn.
  - `TextureFactory#load(url, options?, ...classNames)` nimmt ein optionales
    `TextureLoadOptions {onError?}` vor den Klassennamen und reicht es an den
    three.js-Loader. Neu: `TextureFactory#loadAsync(url, textureClasses?)`, das
    rejectet statt einen Fehler nur in die Konsole zu geben. `onProgress` gibt es
    dort bewusst nicht — three.js liefert für Bild-Loads keinen Fortschritt.
  - `TextureAtlasLoader` prüft die Antwort auf `frames` und `meta.size` und meldet
    eine Antwort ohne Bild-URL über den Fehler-Callback, statt in einen `TypeError`
    zu laufen. `TextureAtlasData.meta.image` nennt das Bild, aus dem die Textur
    stammt — bei gesetztem `overrideImageUrl` also dieses und nicht das der JSON.
  - `TextureResource`: beide Animationsschleifen überspringen einen Eintrag, dessen
    Timing nicht trägt (kein `duration` und kein `frameRate`, oder `frameRate: 0`),
    und melden ihn als `error` mit `source: 'frameBasedAnimations'`. Die übrigen
    Animationen der Map werden registriert. Vorher riss ein solcher Eintrag den
    ganzen Effektlauf mit.
  - `base64toUint32Arr(base64, isLittleEndian?)` bleibt in Signatur und Verhalten,
    wie es war — nur ohne `any`. `DataIdsChunk2D.ts:49` ist unberührt.

#### Die Findings im Wortlaut

**BUG-037 · low · `packages/twopoint5d/src/texture/TextureAtlas.ts:29-38`** — TextureAtlas#add überschreibt einen vergebenen Namen still
`add()` mit einem bereits vergebenen Namen überschreibt die Zuordnung im Namensregister und lässt den alten Frame in `#frames` stehen. `FrameBasedAnimations#add` wirft im gleichen Fall.
Empfehlung: Dasselbe Verhalten wie beim Geschwister: werfen. Mindestens den verwaisten Frame nicht liegen lassen.

**BUG-043 · low · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:141`** — add() ohne Frame-Query wirft auf jedem Atlas mit Symbol-Namen
`atlas.frameNames(undefined).sort()` liefert alle Namen inklusive Symbole und sortiert sie mit dem Default-Comparator, der jeden Wert nach String konvertiert. Für ein Symbol wirft das `TypeError: Cannot convert a Symbol value to a string` (in Node 26 geprüft). Ein Atlas, der auch nur einen Frame per Symbol registriert hat, lässt sich nicht als Ganzes zu einer Animation machen. Frames ohne Namen fehlen in der Animation außerdem ganz, ohne Hinweis.
Empfehlung: Vor dem Sortieren auf String-Namen filtern oder einen Comparator übergeben, der Symbole über `description` vergleicht. Im TSDoc festhalten, dass nur benannte String-Frames in die Animation eingehen.

**BUG-065 · low · `packages/twopoint5d/src/texture/TextureFactory.ts:178-182`** — TextureFactory.load() reicht keinen Fehler-Callback durch
`load()` ruft `textureLoader.load(url, onLoad)` und lässt den dritten und vierten Parameter — `onProgress`, `onError` — weg. Eine URL, die nicht lädt, liefert dem Aufrufer eine leere `Texture` zurück, ohne Meldung; der Fehler landet allein in der Konsolenausgabe von three.js. Die Anwendung rendert ein unsichtbares Sprite und hat keine Stelle, an der sie das erfahren könnte. Der `TextureStore` daneben macht es richtig und emittiert ein `Error`-Event.
Empfehlung: Einen optionalen `onError`-Parameter durchreichen. Weitergehend: `loadAsync()` anbieten, das den three.js-Promise zurückgibt — dann hat der Aufrufer einen Fehlerweg, den er nicht vergessen kann.

**API-034 · low · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:176`** — animId wirft bei einem Tippfehler, statt undefined zu liefern
Die Methode greift mit `!` auf einen unbekannten Namen zu und wirft einen `TypeError` auf `undefined`. Die Signatur verspricht `number`.
Empfehlung: Entweder `number | undefined` zurückgeben, wie die Nachbarmethoden es tun, oder mit einer Meldung werfen, die den unbekannten Namen nennt.

**CONS-012 · info · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:24, types.ts:22`** — Zwei Namen für denselben Timing-Typ, beide exportiert
`AnimationTimingOptions` und `FrameBasedAnimationsTimingData` sind wörtlich derselbe Typ, zweimal deklariert und beide im Barrel von `texture/` exportiert. Sie kollidieren nicht, es sind aber zwei Namen für eine Sache.
Empfehlung: Einen behalten, den anderen als Alias darauf führen und im nächsten Major streichen — die Zusammenlegung berührt zwei öffentliche Oberflächen.

**TYPE-007 · info · `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:43, texture/FrameBasedAnimations.ts:141, map2d/chunk-quad-tree/base64toUint32Arr.ts:2`** — Drei Stellen, an denen der Compiler nichts mehr prüft
`(jsonData: any)` beim Parsen der Atlas-JSON und `atlas.frameNames(args[3] as any)`. Beide Stellen sind unter den neuen Strictness-Schaltern die letzten, an denen die Typprüfung aussetzt.
Empfehlung: Für die Atlas-JSON einen Typ schreiben, der die erwartete Form beschreibt, und die Überladung von `frameNames()` so fassen, dass der Cast entfällt.

### [x] 9. Nachtrag zu Paket 2 und 3: was die Umbauten nicht beschrieben und nicht festgenagelt haben
- Findings: — (keine aus dem Audit; vier Symptome aus den Paketen 2 und 3, dazu ein
  Nebenbefund derselben Ursache)
- Folge von: Paket 2, Paket 3
- Ziel: Was die beiden Texture-Pakete an Verhalten gebaut haben, steht an seiner Stelle
  beschrieben, hält im Prädikat, was der Kommentar darüber zusagt, und geht im CI rot,
  wenn jemand es herausnimmt.
- Bereich: `packages/twopoint5d/src/texture/` (TextureResource, TextureAtlasLoader und
  beide Specs), `packages/twopoint5d/vite.config.ts`
- Hängt ab von: —
- Hash: d4eafd2
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/src/texture/TextureResource.ts`,
  `packages/twopoint5d/src/texture/TextureResource.spec.ts`,
  `packages/twopoint5d/src/texture/TextureAtlasLoader.ts`,
  `packages/twopoint5d/src/texture/TextureAtlasLoader.spec.ts`,
  `packages/twopoint5d/vite.config.ts`, `packages/twopoint5d/CHANGELOG.md`

#### Warum ein Paket und nicht zwei

Paket 2 und Paket 3 sind beide committet und haben denselben Rest liegen lassen: eine
Zusage, die der Code hält, die daneben aber weder vollständig beschrieben noch von der
Suite festgenagelt ist. Zug 0 dieses Pakets hat die beiden Folgen aus Paket 3 als
Symptome derselben Ursache eingeordnet und statt eines zweiten Nachtragspakets in
dieses geschoben: alle vier Fundstellen liegen in `packages/twopoint5d/src/texture/`,
jede Reparatur ist ein Satz Doku plus ein Test, und `pnpm run ci` fährt neun Stufen —
den Lauf zweimal für vier Halbsätze zu bezahlen wäre die teure Art, ordentlich zu sein.

Aus »Offene Befunde« kommt ein Eintrag derselben Ursache mit hinein:
`TextureResource.spec.ts:53` nimmt die `vi.spyOn`-Attrappen nie zurück. Das ist genau
die Datei, in der Schritt 2 den unterscheidenden Test unterbringt, und eine Suite, die
aus dem falschen Grund grün sein kann, macht diesen Test wertlos.

#### Was der Abgleich ergeben hat

Alle vier Fundstellen existieren; drei sind gegenüber ihrer Notiz verrutscht — die
Zeilennummern unten sind die **aktuellen**, gegen `93590a1`:

| Fundstelle laut Notiz | Stand jetzt |
| --- | --- |
| `TextureResource.ts:66`, Payload bei `:600-605` | TSDoc unverändert `:66-69`, `status` wird bei `:612` mitgeschickt |
| `TextureResource.ts:549` und `:654` | `:551` (Tileset-Effekt) und `:663` (Atlas-Effekt) |
| `TextureAtlasLoader.ts:28-35` | Kommentar `:27-30`, Prädikat `isAtlasJsonResponse` `:31-36` |
| `TextureAtlasLoader.spec.ts:60-69` | unverändert |

Vier Dinge, die der Abgleich zusätzlich ergeben hat und die die Schritte unten tragen:

- **`status` steht nur an einem der beiden Fehlerwege.** Das Feld wird ausschließlich
  bei `:612` mitgeschickt, im Atlas-Fetch und damit unter `source: 'atlas'`. Der
  Bild-Weg bei `:522` emittiert `{source: 'image', url, error}` ohne `status`, weil der
  Fehler dort aus dem Loader-Promise kommt und keine Antwort hat. Der TSDoc darf also
  nicht »die Payload trägt `status`« sagen, sondern muss den Fall benennen.

- **Von den beiden Prioritäten kann die Suite genau eine unterscheiden.** Gemessen
  gegen die installierte `@spearwolf/signalize@1.0.0` mit einer Probe, nicht aus der
  Doku übernommen: `Batch#batch(effectId, priority)` hängt die Effekte eines Batches in
  eine nach Priorität absteigend sortierte Liste, gleiche Prioritäten laufen in
  Einreihungsreihenfolge. Der Batch bei `:509-513` schreibt `#imageUrlOfCoords`,
  dann `#imageCoords`, dann `#texture`.
  Der Tileset-Effekt (`:542-552`) hängt nur an `#imageCoords` und ist **nach** der
  Brücke `#imageCoords.onChange` (`:462`) registriert — ohne die Priorität läuft
  die Brücke zuerst, und ein Abonnent von `imageCoords` sieht `tileSet` und `atlas`
  auf `undefined`. Mit der Priorität läuft der abgeleitete Effekt zuerst. Das ist der
  unterscheidende Fall.
  Der Atlas-Effekt (`:646-664`) hängt zusätzlich an `#imageUrlOfCoords`, und das ist
  die **erste** Zeile des Batches: er wird dadurch vor jeder Brücke eingereiht, mit
  oder ohne Priorität. Gemessen ergibt die Atlas-Form beide Male dieselbe Reihenfolge.
  Ein Test, der dort die Priorität unterscheidet, existiert nicht und lässt sich ohne
  Umbau der drei Batch-Zeilen auch nicht schreiben.
  Die Brücke für `texture` (`:478`) läuft in beiden Fällen zuletzt — deshalb bleiben
  die vorhandenen Tests, die über `texture` prüfen, grün, wenn man beide Prioritäten
  herausnimmt. Genau das war der Befund.

- **`restoreMocks: true` kostet nichts.** Gemessen mit einer Konfiguration im
  Arbeitsverzeichnis (`npx vitest run --root packages/twopoint5d --config …`): 61
  Dateien, 1036 Tests, grün mit und ohne den Schalter, identische Zahlen. Der Schalter
  ist damit keine Entscheidung mit Blast Radius, sondern eine Zeile.

- **Das tiefere Prädikat weist keine echte Atlas-JSON des Repos ab.** Alle acht
  Atlas-JSONs unter `apps/lookbook/public/assets/` (`ball-patterns`, `clouds-2`,
  `fire-particles`, `glaskugeln`, `lab-walls-tiles`, `skulls-n-robots`, `spaceships`,
  `splotchs-256x`) tragen `meta.size.w`/`.h` als Zahlen und in jedem Frame-Eintrag ein
  `frame` mit vier Zahlen. Die Browser-Suite lädt Atlanten über `TextureResource`, nicht
  über den `TextureAtlasLoader` — dieses Paket fasst sie nicht an.

#### Restplan

Geprüft und unverändert. Die Pakete 4 bis 8 fassen `map2d`, `vertex-objects`, `stage`
und das Lookbook an; keines davon berührt `src/texture/`, keine Abhängigkeit verschiebt
sich, keine Reihenfolge ändert sich. Paket 9 bleibt, wo es steht — hinter Paket 3, weil
es auf dessen fertigem Stand aufsetzt, und vor Paket 4, weil nichts darauf wartet. Die
fünf `→ Audit`-Einträge und die sechs übrigen `→ Scope`-Einträge in »Offene Befunde«
teilen keine Ursache mit diesem Paket und bleiben für die Drain-Runde des Abschlusses
liegen.

#### Vorgehen

Die Schritte 1–4 gehören zu `TextureResource`, die Schritte 5–6 zum
`TextureAtlasLoader`; die beiden Hälften sind unabhängig voneinander. Schritt 7 kommt
zum Schluss.

**1. Die `error`-Payload der Resource vollständig beschreiben.**

`TextureResource.ts:66-69`, im TSDoc-Block über `TextureResourceEvents`. Der erste Satz
sagt heute `{source: 'image'|'atlas', url, error}` für einen gescheiterten Fetch und
verschweigt, dass eine Atlas-Antwort mit Status zusätzlich `status` mitbringt. Nach dem
Vorbild des Schwesterblocks in `TextureStore.ts:54-59`, der es benennt:

```
 * `error` carries `{source: 'image'|'atlas', url, error}` for a fetch that failed, with a
 * `status: number` beside it when the atlas request answered with a status instead of a body —
 * an image that does not load comes out of the loader promise and has no status to name. It
 * carries `{source: 'frameBasedAnimations', id, animation, error}` for an animation entry …
```

Der Rest des Blocks bleibt, wie er ist.

**2. Die Korrelation aus Paket 2 festnageln, Tileset-Weg (`:551`).**

Ein Test in `TextureResource.spec.ts`, in einem eigenen
`describe('what a subscriber sees')` hinter `describe('frame based animations')`. Name:
`a tile set is on the resource by the time the imageCoords event arrives`. Er folgt dem
Aufbau der Tests darüber — `vi.spyOn(ImageLoader.prototype, 'loadAsync')`,
`makeTextureFactory()`, `resource.load()`, Abonnement, dann `resource.textureFactory =
factory`, dann `await flushMicrotasks()`:

```ts
const seen: Array<{tileSet: unknown; atlas: unknown}> = [];
on(resource, 'imageCoords', () => {
  // read off the resource, not out of the payload: the question is what is already
  // there when this bridge fires, and the priority of the derived effects is what
  // answers it
  seen.push({tileSet: resource.tileSet, atlas: resource.atlas});
});
```

Erwartet: genau ein Eintrag, und in ihm sind `tileSet` und `atlas` beide gesetzt.
Die Resource ist ein `TextureResource.fromTileSet('tiles', 'tiles.png', {tileWidth: 16,
tileHeight: 16})` ohne Animationsdaten.

**Der rote Lauf für diesen Test hat eine eigene Form**, und die gehört so in den
Report: es gibt keinen Fix, den man danach baut — das Verhalten ist bereits richtig,
der Test ist die Lieferung. Rot gesehen wird er, indem man `priority:
DERIVED_FROM_IMAGE_PRIORITY` bei `:551` vorübergehend herausnimmt und die Datei laufen
lässt (`pnpm nx test twopoint5d -- src/texture/TextureResource.spec.ts`). Er muss
fallen, weil `tileSet` `undefined` ist. Danach die Priorität zurücksetzen, grün sehen,
und beide Läufe in den Report. Fällt er dabei **nicht**, ist der Test wertlos und die
Ursache zu suchen, statt ihn stehen zu lassen.

**3. Den Atlas-Weg (`:663`) beschreiben statt ihn zu behaupten.**

Ein zweiter Test derselben Bauart, `an atlas is on the resource by the time the
imageCoords event arrives`, mit `TextureResource.fromAtlas('sprites', 'atlas.json')`
und den Attrappen für `fetch` und `ImageLoader` wie in `an atlas resource reports
animation data it cannot use`. Er nagelt die Zusage fest, aber **nicht** die Priorität:
er bleibt grün, wenn man sie bei `:663` herausnimmt, weil die Schreibreihenfolge des
Batches denselben Effekt hat. Rot geht er erst, wenn beides fällt — Priorität und
Reihenfolge. Das ist der Wert, den er hat, und mehr wird ihm nicht zugeschrieben.

Dazu zwei Sätze an den Kommentar über `DERIVED_FROM_IMAGE_PRIORITY` (`:107-112`), damit
niemand die Priorität bei `:663` für ungedeckt hält und wegnimmt:

```
// The tile set effect is the one the suite can tell apart: it hangs off `#imageCoords`
// alone and is registered after the bridge that carries the coordinates out, so without
// the priority the bridge goes first. The atlas effect also reads `#imageUrlOfCoords`,
// the first write of the batch, which queues it ahead of every bridge on its own — its
// priority is what keeps the promise once those three lines are ever reordered.
```

**4. Die Attrappen der Suite zurücknehmen.**

`packages/twopoint5d/vite.config.ts`, im `test`-Block: `restoreMocks: true`, mit einem
Kommentar, der sagt warum — eine `vi.spyOn`-Attrappe, die ihren Test überlebt, liegt
über allen folgenden derselben Datei, und ein Test, der eine Reihenfolge misst, wird
davon still bedeutungslos. Die vorhandenen `fetchMock.mockRestore()` in den Tests
bleiben stehen; sie kosten nichts und sagen an Ort und Stelle, was der Test tut. Das
`afterEach` mit `sandbox.restore()` bleibt ebenfalls — sinon ist von dem Schalter nicht
berührt.

**5. Das Prädikat hält, was der Kommentar zusagt.**

`TextureAtlasLoader.ts:31-36`. Der Kommentar darüber sagt »Every property the check lets
through is one the loader and its callers may rely on afterwards«, der Rumpf prüft eine
Ebene tief: `frames` muss ein Objekt sein, seine Einträge werden nicht angesehen, und
`meta.size` gilt als `{w: number; h: number}`, geprüft wird nur, dass es ein Objekt ist.
Beides wird danach gelesen — `TexturePackerJson.parse` liest `frame.x/y/w/h` je Eintrag,
und `meta.size.w`/`.h` steht als `number` im `TextureAtlasData`, das der Aufrufer
bekommt. Das Prädikat geht eine Ebene tiefer:

```ts
const isFrameData = (value: unknown): value is TexturePackerFrameData => {
  if (typeof value !== 'object' || value == null) return false;
  const {frame} = value as Partial<TexturePackerFrameData>;
  if (typeof frame !== 'object' || frame == null) return false;
  return typeof frame.x === 'number' && typeof frame.y === 'number' && typeof frame.w === 'number' && typeof frame.h === 'number';
};

const isAtlasJsonResponse = (value: unknown): value is AtlasJsonResponse => {
  if (typeof value !== 'object' || value == null) return false;
  const {frames, meta} = value as Partial<AtlasJsonResponse>;
  if (typeof frames !== 'object' || frames == null) return false;
  if (!Object.values(frames).every(isFrameData)) return false;
  if (typeof meta !== 'object' || meta == null) return false;
  const {size} = meta;
  return typeof size === 'object' && size != null && typeof size.w === 'number' && typeof size.h === 'number';
};
```

`TexturePackerFrameData` kommt als `import type` aus `./TexturePackerJson.js` dazu. Die
Fehlermeldung bleibt wörtlich, wie sie ist — der Test bei `:35` prüft sie —, und der
Kommentar bei `:27-30` bleibt stehen: er wird durch diesen Schritt wahr, statt umgeschrieben
zu werden.

Der Durchlauf über alle Frames ist kein Kostenposten: `TexturePackerJson.parse`
iteriert dieselbe Menge unmittelbar danach und baut je Eintrag ein `TextureCoords`.

**6. Die beiden ungedeckten Zusagen des Loaders festnageln.**

In `TextureAtlasLoader.spec.ts`, mit den vorhandenen Attrappen `fileLoaderAnswering`
und `imageLoaderAnswering`:

- `an atlas json whose frames carry no coordinates is refused` — Antwortkörper
  `{frames: {'walk.1': {}}, meta: {size: {w: 16, h: 16}}}`, geladen mit
  `{overrideImageUrl: 'sprites.png'}`. Erwartet: `rejects.toThrow(/is no texture atlas
  json/)` und `imageLoad` nicht gerufen. **Rot vor dem Fix**: der Aufruf kommt heute am
  Prädikat vorbei, `TexturePackerJson.parse` läuft auf `frame.x` und die Promise
  rejectet mit einem `TypeError` statt mit der Meldung des Loaders. (Mit den echten,
  asynchronen Loadern settlet sie an dieser Stelle gar nicht — das ist der eigene
  Befund `TextureAtlasLoader.ts:87` in »Offene Befunde«, den dieses Paket nicht
  behebt.)
- `an atlas json whose meta names no size is refused` — Antwortkörper
  `{frames: {}, meta: {size: {}}}`, ebenfalls mit `overrideImageUrl`. Erwartet dieselbe
  Ablehnung. **Rot vor dem Fix**: heute läuft der Aufruf durch und der Aufrufer bekommt
  `meta.size.w === undefined` unter dem Typ `number`. Das ist die `size`-Klausel, die
  bis jetzt von keinem Test gedeckt war.
- `an overrideImageUrl outranks the image the json names` — zweite Fixture
  `{frames: {'walk.1': {frame: {x: 0, y: 0, w: 8, h: 8}}}, meta: {image:
  'from-json.png', size: {w: 16, h: 16}}}`, geladen mit `{overrideImageUrl:
  'sprites.png'}`. Erwartet: `imageLoad.mock.calls[0]![0] === 'sprites.png'` **und**
  `meta.image === 'sprites.png'`. Der vorhandene Test bei `:60-69` fährt gegen eine
  Fixture ohne `meta.image` und bestünde deshalb auch gegen ein
  `jsonData.meta.image ?? imageUrl` — das ist genau der Bruch, den der Migration Guide
  von Paket 3 führt, und bis hierher hat ihn nichts gehalten. Der alte Test bleibt
  stehen; er deckt die andere Hälfte.

**7. CHANGELOG.**

Kein neuer Eintrag, sondern der vorhandene Unreleased-Punkt unter »Changed«, der mit
»`TextureAtlasLoader` checks the response of an atlas url against the shape of a texture
packer json before it reads it« beginnt: er bekommt einen Halbsatz, wie tief die Prüfung
geht — jeder Frame-Eintrag trägt ein `frame` mit vier Zahlen, und `meta.size` trägt `w`
und `h` als Zahlen. Der Punkt ist unveröffentlicht, also wird er fortgeschrieben statt
verdoppelt. Der Skill `updating-changelog` gilt.

Kein `BREAKING CHANGE:`-Footer: die geprüfte Fläche des Loaders ist selbst
unveröffentlicht (sie kam mit Paket 3 in denselben Unreleased-Block), das Prädikat wird
darin nur genauer, und die übrigen Schritte ändern kein Verhalten.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci` — der Cache-Schalter, weil sonst Stufen
  aus dem Cache des Implementierers durchgewinkt werden.
- Commit: `fix(twopoint5d): check an atlas response as deep as its frames are read`

  Body:

  ```
  The predicate now promises what its comment always claimed: every frame entry carries a
  frame with four numbers, and meta.size carries w and h as numbers. Beside it, the two
  promises the texture rework made and left untested are pinned — the derived effects run
  before the bridges that carry their values out, and an overrideImageUrl outranks the image
  the json names — and the vitest spies of the package are restored between tests.
  ```
- Ergebnis: 1 Runde · alle sieben Schritte des Detailplans erfüllt, vom Reviewer je mit
  Fundstelle bestätigt, dazu der Queue-Eintrag `TextureResource.spec.ts:53` und die beiden
  Folgen aus Paket 3 · Regressionstests: `a tile set is on the resource by the time the
  imageCoords event arrives` — rot mit vorübergehend entfernter
  `priority: DERIVED_FROM_IMAGE_PRIORITY` am Tileset-Effekt (`expected undefined to be
  defined` an `seen[0]!.tileSet`), von Implementierer und Reviewer unabhängig voneinander
  gefahren · `an atlas json whose frames carry no coordinates is refused` (`Cannot read
  properties of undefined (reading 'x')` statt der Loader-Meldung) · `an atlas json whose
  meta names no size is refused` (Promise löste auf, statt abzulehnen) · `an
  overrideImageUrl outranks the image the json names` — rot gegen die Mutation
  `jsonData.meta.image ?? options?.overrideImageUrl` (`expected 'from-json.png' to be
  'sprites.png'`), während der vorhandene Nachbartest dabei grün blieb; genau die Lücke,
  die er schließt · `an atlas is on the resource by the time the imageCoords event
  arrives` hat planmäßig keinen roten Vorlauf: er nagelt die Zusage fest, nicht die
  Priorität, und die Gegenprobe bestätigt das — ohne die Priorität am Atlas-Effekt bleibt
  er grün · 1041 statt 1036 Tests · Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 über
  alle neun Stufen, Log `paket-9.verify.log` · keine Abweichungen vom Detailplan · klein
  und offen geblieben: der Kommentar über `restoreMocks` in
  `packages/twopoint5d/vite.config.ts:10` sagt, jede `vi.spyOn`-Attrappe werde
  zurückgenommen, wenn ihr Test endet — Vitest ruft `vi.restoreAllMocks()` in
  `onBeforeTryTask`, also vor jedem Test. Wirkung und Schutz stimmen, der Zeitpunkt im
  Satz nicht.
- Nebenbefunde: keine. Was in den angefassten Dateien falsch ist, steht bereits unter
  »Offene Befunde« (`TextureAtlasLoader.ts:87`, `:95`, `TextureResource.ts:522`,
  `:617-639`); Implementierer und Reviewer haben nichts darüber hinaus gefunden.
- Folgen: keine.
- Schnittstellen:
  - `TextureAtlasLoader` weist eine Antwort ab, deren `frames`-Einträge kein `frame` mit
    `x`, `y`, `w` und `h` als Zahlen tragen oder deren `meta.size` `w` und `h` nicht als
    Zahlen nennt. Die Meldung ist dieselbe wie für jede andere abgewiesene Form. Wer den
    Loader in einem Test mit einer Attrappe füttert, braucht ab jetzt eine vollständige
    Fixture — eine Minimal-JSON wie `{frames: {a: {}}, meta: {size: {}}}` kommt nicht mehr
    durch.
  - `packages/twopoint5d/vite.config.ts` setzt `restoreMocks: true`. Das gilt für alle
    Testdateien des Pakets: eine `vi.spyOn`-Attrappe wirkt nur noch in dem Test, der sie
    installiert hat. Wer eine Attrappe über mehrere Tests hinweg braucht, setzt sie in
    `beforeEach`.

### [x] 4. map2d: Sichtbarkeit, Streaming, Kachel-Rendering
- Findings: BUG-046, BUG-061, BUG-062, BUG-063, API-044, PERF-012, PERF-016,
  PERF-018, DOC-019, CONS-009, CONS-016, CONS-017, CONS-019
- Ziel: Der Dirty-Check erfasst alles, was ihn beeinflusst, Laufzeitwechsel von
  Kachelgröße und Raster schlagen bis zu den bestehenden Kacheln durch, und
  jeder Frame macht nur die Arbeit, die anfällt.
- Bereich: `packages/twopoint5d/src/map2d/` (CameraBasedVisibility samt Spec
  und Helpers, HelpersManager, Map2DTileStreamer, Map2DTileRenderer,
  RectangularVisibilityArea, TileSprites/TileSpritesFactory)
- Hängt ab von: —
- Hash: 4f2c53f
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/map2d/Map2D.ts`,
  `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts`,
  `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts`,
  `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts`,
  `packages/twopoint5d/src/map2d/Map2DTileRenderer.spec.ts`,
  `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`,
  `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`,
  `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`,
  `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts`,
  `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts`,
  `packages/twopoint5d/src/map2d/RectangularVisibilityArea.spec.ts`,
  `packages/twopoint5d/src/map2d/HelpersManager.ts`,
  `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts`,
  `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`,
  `packages/twopoint5d/CHANGELOG.md`

#### Was der Abgleich ergeben hat

Dieser Lauf hat `src/map2d/` bis auf `chunk-quad-tree/base64toUint32Arr.ts`
nicht angefasst (`git diff --stat a9f7dd1..HEAD`). Elf der dreizehn Findings
stehen deshalb unverändert und **auf der Zeile**. Zwei nicht — beide, weil der
Remediation-Lauf vom 2026-09-06 sie ganz oder halb miterledigt hat und das
Audit vom 2026-09-07 seinen `carried-over`-Text dazu nicht nachgezogen hat.

| Finding | Fundstelle laut Audit | Stand jetzt |
| --- | --- | --- |
| BUG-046 | `Map2DTileStreamer.ts:30-56`, `TileSpritesFactory.ts:56-58`, `CameraBasedVisibility.ts:331-336` | die vier Setter stehen unverändert auf `:30-56`, `updateTile()` auf `:56-58`; die dritte Fundstelle zeigt heute auf einen TSDoc-Block und trägt nichts bei |
| BUG-061 | `CameraBasedVisibility.ts:109, 224-236, 548` | unverändert, alle drei Zeilen exakt |
| BUG-062 | `CameraBasedVisibility.ts:302-305` gegen `:386` | unverändert, beide Zeilen exakt |
| BUG-063 | `RectangularVisibilityArea.ts:112-117` | unverändert, exakt |
| API-044 | `TileSpritesFactory.ts:30-32` | unverändert; `freeTileSprite()` hat repoweit keinen Aufrufer |
| PERF-012 | `Map2D.ts:120-123`, `Map2DTileStreamer.ts:84, 96-98` | **halb gegenstandslos**, siehe unten |
| PERF-016 | `Map2DTileRenderer.ts:44-54, 56-71` | unverändert, exakt |
| PERF-018 | `Map2DTileRenderer.ts:85-94` | unverändert, exakt |
| DOC-019 | `HelpersManager.ts:61-63` gegen `:76-78` | unverändert, exakt |
| CONS-009 | `CameraBasedVisibilityHelpers.ts:8-19` + `CameraBasedVisibility.ts:9-20`, dazu `FrameBasedAnimations.ts:141` und `DataIdsChunk2D.ts:56` | **Hauptteil gegenstandslos**, siehe unten; die beiden Ausrufezeichen bleiben, das erste nach `:190` gewandert |
| CONS-016 | `CameraBasedVisibilityHelpers.ts:37, 154-165` | unverändert; die Kappung steht auf `:158` |
| CONS-017 | `Map2DTileStreamer.ts:99` | unverändert, exakt |
| CONS-019 | `CameraBasedVisibility.spec.ts:284-285` | unverändert, exakt |

**CONS-009, Hauptteil: gegenstandslos.** Der Typ `TileBox` steht nur noch
einmal im Repo — `CameraBasedVisibility.ts:11`, exportiert; belegt mit
`grep -rn "interface TileBox\|type TileBox" --include=*.ts`, ein Treffer.
`CameraBasedVisibilityHelpers.ts:5` importiert ihn von dort. Die Kopie, die das
Audit unter `:8-19` beschreibt, ist gefallen; auf diesen Zeilen steht heute der
TSDoc-Block von `PointHelper`. Die beiden Nebenfundstellen des Findings leben
weiter und werden in Schritt 12 erledigt.

**PERF-012, Vektor-Hälfte: gegenstandslos.** Der Streamer legt keine drei
Vektoren pro Frame mehr an. `Map2DTileStreamer.ts:62` hält ein
`readonly #position = new Vector3()`, `:103` schreibt es mit `.set()`; ein
`new Vector2()` gibt es dort nicht mehr, und `offset` und `translate` kommen aus
dem Ergebnis des Visibilitors, statt kopiert zu werden. Bleibt die
Matrix-Hälfte, und die trifft zu: `Map2D.update()` (`:120-123`) ruft
`updateMatrixWorld()`, unmittelbar danach ruft der Streamer
`node.updateWorldMatrix(true, false)` auf demselben Objekt.

**Was ausdrücklich nicht angefasst wird.** In `CameraBasedVisibilityHelpers.ts`
liegen zwei Findings, die der Nutzer nicht in den Scope genommen hat und die
deshalb stehen bleiben, obwohl dieses Paket die Datei öffnet:

- `:105-111` — der Block mit `document.querySelector('.map2dCoords')` und dem
  `// TODO remove this!` darüber. Das ist ARCH-004 und IMPL-001 der
  `audit.html`, beide außerhalb der gelisteten Auswahl. Nicht entfernen, nicht
  umbauen, nicht kommentieren.
- ebenso `RectangularVisibilityAreaHelpers.ts` (PERF-017) und
  `CameraBasedVisibilityHelpers.spec.ts:52` (CONS-022) — außerhalb des Scopes.

#### Die Entscheidungen dieses Zuges

Vier Findings bieten zwei Wege an. Gewählt ist je einer, mit dem Grund:

1. **BUG-046 über die Setter, nicht über `updateTile()`.** Das Audit nennt
   beides. Ein Rasterwechsel ist ein seltenes Ereignis, ein `reuseTile()` läuft
   in jedem Frame: `updateTile()` auch `quadSize` und `texCoords` schreiben zu
   lassen, verteuert den heißen Pfad für einen kalten Fall — und dieses Paket
   arbeitet mit PERF-016 und PERF-018 an zwei Stellen genau in die Gegenrichtung.
   Der Streamer hat mit `#clearTilesOnNextUpdate` die passende Maschinerie schon.
2. **BUG-061 in die Abhängigkeitsliste, nicht hinter einen Setter.**
   `frustumBoxScale` ist eine Zahl wie `depth`, und `depth` steht bereits in der
   Liste. Ein Setter für nur eines der beiden Felder wäre eine neue Inkonsistenz
   an der Stelle, die dieses Paket geradezieht, und er vergrößerte die
   öffentliche Fläche.
3. **BUG-063 im Visibilitor selbst, zusätzlich zu BUG-046.** Der Fix am Streamer
   deckt den Weg über `Map2D` ab, aber `RectangularVisibilityArea` bekommt seinen
   `map2dTileCoords` als Parameter und ist öffentlich: wer den Streamer nicht
   benutzt, umgeht Schritt 1 vollständig. Ein Visibilitor, der Kacheln aus einem
   fremden Raster wiederverwendet, muss sich selbst schützen.
4. **CONS-016 kappt die Frustum-Helfer, nicht die Kachelbox-Helfer.** Das Audit
   merkt an, dass `maxDebugHelpers` die Kachelbox-Helfer gar nicht begrenzt.
   Sie zu begrenzen wäre eine Verhaltensänderung an einer öffentlichen
   Stellschraube: ein Kachelbox-Helfer gehört zu je einer sichtbaren Kachel und
   zeichnet die Ansicht vollständig, und wer heute zwanzig Kacheln sieht, sieht
   zwanzig Boxen. Statt das zu ändern, sagt ein TSDoc-Satz, worauf sich die Zahl
   bezieht.

#### Vorgehen

Reihenfolge egal, außer bei Schritt 5 und 6 — die fassen dieselbe Methode an.
Jeder Schritt mit `(RT)` verlangt einen Regressionstest, geschrieben **vor** dem
Fix und **rot gesehen**; die rote Ausgabe gehört in den Report.

1. **(RT) `Map2DTileStreamer.ts`: ein Rasterwechsel räumt die Kacheln.**
   Die vier Setter `tileWidth` (`:30`), `tileHeight` (`:38`), `xOffset` (`:46`)
   und `yOffset` (`:54`) schreiben heute ohne Vergleich in `#tileCoords`. Jeder
   bekommt die Form:

   ```ts
   set tileWidth(width: number) {
     if (this.#tileCoords.tileWidth === width) return;
     this.#tileCoords.tileWidth = width;
     this.clearTiles();
   }
   ```

   `clearTiles()` setzt `#clearTilesOnNextUpdate`, der nächste `update()` leert
   jeden Renderer und die eigene `tiles`-Liste — die Kacheln entstehen im neuen
   Raster neu. Ein Kommentar an einer der vier Stellen sagt, warum der Wechsel
   die Kacheln kostet: eine Kachel wird über ihre id `(x, y)` wiedererkannt, und
   `updateTile()` schreibt nur die Position, nicht `quadSize` und `texCoords`.
   Regressionstest in `Map2DTileStreamer.spec.ts`: nach einem `update()`, das
   Kacheln erzeugt hat, `tileWidth` auf einen anderen Wert setzen; der nächste
   `update()` ruft `clearTiles()` auf dem Renderer und meldet die Kacheln als
   `createTiles`. Zweiter Fall im selben Test oder daneben: derselbe Wert
   geschrieben löst nichts aus.

2. **(RT) `RectangularVisibilityArea.ts`: keine Kachel aus einem fremden Raster
   wiederverwenden.** In `computeVisibleTiles()` vor der Zeile mit
   `this.#deps.changed(...)` (`:76`) den gespeicherten Raster-Stand holen und
   vergleichen:

   ```ts
   const storedTileCoords = this.#deps.value('map2dTileCoords') as Map2DTileCoordsUtil | undefined;
   // a tile from another grid carries indices this grid cannot place: `tile.x - tileLeft`
   // lands outside the occupancy array — or, worse, inside it on the wrong cell, where it
   // marks a place as taken that nothing covers
   const tileGridChanged = storedTileCoords != null && !storedTileCoords.equals(map2dTileCoords);
   ```

   `Dependencies#value()` gibt den geklonten Zustand zurück, `changed()`
   überschreibt ihn — die Frage muss also davor stehen. In der Schleife bei
   `:112-121` entscheidet das Ergebnis mit:

   ```ts
   if (!tileGridChanged && fullViewArea.isIntersecting(tile.view)) {
   ```

   Alles andere geht wie bisher nach `removeTiles`. Kein zweiter Snapshot neben
   `#deps` — der Wert liegt dort schon.
   Regressionstest in `RectangularVisibilityArea.spec.ts`: einen ersten
   `computeVisibleTiles()` fahren, dann denselben Aufruf mit einem
   `Map2DTileCoordsUtil` anderer Kachelgröße und den Kacheln des ersten Laufs als
   `previousTiles`; `reuseTiles` ist leer, `removeTiles` enthält sie alle, und
   keine Fläche ist doppelt belegt.

3. **(RT) `CameraBasedVisibility.ts`: `frustumBoxScale` in den Dirty-Check.**
   In der Liste bei `:154-162` neben `'depth'` ein `'frustumBoxScale'`, und im
   Objekt in `dependenciesChanged()` (`:228-236`) die Zeile
   `frustumBoxScale: this.frustumBoxScale,`. Mehr nicht — der Vergleich läuft
   über `!==` und trägt eine Zahl.
   Regressionstest in `CameraBasedVisibility.spec.ts`: nach einem ersten
   `computeVisibleTiles()` `frustumBoxScale` ändern und ohne Kamerabewegung
   erneut rechnen; das Ergebnis trägt `changed: true` und `serial` ist um eins
   gestiegen.

4. **(RT) `CameraBasedVisibility.ts`: `visibles` leeren, wenn kein Strahl
   trifft.** Im Zweig bei `:302-305` vor dem Setzen von `#visibleTiles` ein
   `this.visibles.length = 0;`, mit einem Kommentar, warum es hier steht und
   nicht nur in `findVisibleTiles()`: dieser Weg erreicht die Methode nie, und
   `visibles` ist öffentlich — die Sichtbarkeits-Helfer lesen es und zeichnen
   sonst Kachelboxen für eine Ansicht, die es nicht mehr gibt.
   **Drei TSDoc-Blöcke wandern mit**, sie beschreiben heute genau das alte
   Verhalten:
   - `:164-168` über `visibles` — der Satz »A recomputation in which the camera
     looks past the plane reports an empty tile set and leaves this list standing
     as it is« stimmt dann nicht mehr.
   - `:173-181` über `serial` — dort steht »`visibles` und `planeCoords2D` folgen
     nur einem Schritt, in dem die Kamera die Ebene getroffen hat«. Für
     `planeCoords2D` bleibt das richtig, für `visibles` nicht.
   - Der Kommentar über `#tileBoxPool` (`:196-201`) bleibt richtig und wird nicht
     angefasst: der Pool überlebt einen erfolglosen Durchgang weiterhin,
     `visibles.length = 0` fasst ihn nicht an.
   Regressionstest in `CameraBasedVisibility.spec.ts`: erst eine Kamera, die die
   Ebene sieht, dann eine, die von ihr wegzeigt; nach dem zweiten Aufruf ist
   `visibility.visibles` leer. Kein bestehender Test der Datei nagelt das alte
   Stehenbleiben fest — die siebzehn Stellen, die `visibles` lesen, tun es je hinter
   einem erfolgreichen Durchgang.

5. **(RT) `Map2DTileRenderer.ts`: eine abgelehnte Kachel wird nicht jeden Frame
   neu erfragt.** Ein `readonly #declined = new Set<string>();` neben `#tiles`.
   - `addTile()` (`:44-54`): im `tile == null`-Zweig die id eintragen, mit dem
     Kommentar, dass die Antwort der Factory für diese Koordinate feststeht und
     jede Wiederholung den Tile-Data-Provider einen Lookup je Frame und je Loch
     kostet.
   - `reuseTile()` (`:56-71`): der `else`-Zweig wird zu
     `else if (!this.#declined.has(tileCoords.id)) { this.addTile(tileCoords); }`.
   - `removeTile()` (`:73-83`): ganz vorn, hinter dem `tileFactory === null`-Guard,
     ein `this.#declined.delete(tileCoords.id);`. Das ist nicht optional — ohne
     es wächst das Set mit jeder Kachel, die je abgelehnt wurde, und bindet
     Speicher an die Größe der Karte statt an die Größe der Ansicht. Ein
     Kommentar hält genau das fest.
   - `clearTiles()` (`:85-94`): `this.#declined.clear();` neben
     `this.#tiles.clear()`.
   Regressionstest in `Map2DTileRenderer.spec.ts`: eine Factory, deren
   `createTile()` immer `undefined` gibt; nach `addTile()` und drei
   `reuseTile()`-Aufrufen mit derselben Koordinate ist `createTile` genau einmal
   gerufen worden. Dazu die Gegenprobe, dass ein `removeTile()` dazwischen die
   Frage wieder freigibt.

6. **(RT) `Map2DTileRenderer.ts`: ein leeres `clearTiles()` erzwingt keinen
   Upload.** In derselben Methode `:85-94` den Stand vor der Schleife merken und
   den Serial nur dann heben:

   ```ts
   const hadTiles = this.#tiles.size > 0;
   // …destroyTile-Schleife, #tiles.clear(), #declined.clear()…
   if (hadTiles) ++this.#dataSerial;
   ```

   Das geleerte `#declined` hebt den Serial nicht: eine abgelehnte Kachel stand
   nie in einem Attribut-Puffer. Ein Kommentar sagt, dass das Serial-Tor davor
   genau für diesen Fall gebaut ist.
   Regressionstest in `Map2DTileRenderer.spec.ts`: auf einem Renderer ohne
   Kacheln `clearTiles()` und danach `endUpdatingTiles()`; `factory.update()`
   wurde nicht gerufen. Gegenprobe mit einer gehaltenen Kachel: dort wird es
   gerufen.

7. **`Map2D.ts` und `Map2DTileStreamer.ts`: ein Matrix-Update statt zwei.**
   In `Map2D.update()` (`:120-123`) das `this.updateMatrixWorld()` streichen; der
   Aufruf `node.updateWorldMatrix(true, false)` im Streamer (`:89`) bleibt und
   ist der einzige. Die Begründung gehört als Kommentar an die Stelle in
   `Map2D.update()`, und sie ist der Grund, warum die Wahl so und nicht anders
   fällt: `updateWorldMatrix(true, false)` geht die Elternkette hoch und bringt
   die eigene `matrixWorld` in Ordnung, `updateMatrixWorld()` rechnet gegen die
   `matrixWorld` des Elternteils, wie sie gerade dasteht. Der Streamer-Aufruf ist
   also der stärkere von beiden, und er ist der einzige, den ein Aufrufer ohne
   `Map2D` überhaupt hat. Was `updateMatrixWorld()` zusätzlich täte — die Kinder
   mitziehen — braucht in diesem Zug niemand: die Renderer-Nodes bekommen ihre
   Position erst danach, in `beginUpdatingTiles()`, und der three.js-Renderer
   aktualisiert den Szenengraph vor dem Zeichnen ohnehin.

8. **`Map2DTileStreamer.ts`: `visible?.tiles` → `visible.tiles` (`:99`).** Eine
   Zeile, innerhalb von `if (visible)`.

9. **(RT) `CameraBasedVisibilityHelpers.ts`: `maxDebugHelpers` zählt gebaute
   Helfer.** In `updateTileHelpers()` (`:143-172`) einen lokalen Zähler führen
   und ihn prüfen, statt des Laufindex:

   ```ts
   let debugHelpers = 0;
   for (let i = 0; i < visibles.length; ++i) {
     const tile = visibles[i]!;
     if (!tile.primary && debugHelpers < this.maxDebugHelpers) {
       this.placeFrustumBoxHelper(…);
       debugHelpers += 1;
     }
     …
   }
   ```

   Dazu ein TSDoc an `maxDebugHelpers` (`:37`), das sagt, was die Zahl begrenzt:
   die Frustum-Helfer der Kacheln, die kein Sondierungsstrahl direkt getroffen
   hat. Die Helfer der primären Kacheln und die Kachelbox-Helfer sind nicht
   gemeint — sie hängen an der Zahl der sichtbaren Kacheln.
   Regressionstest in `CameraBasedVisibilityHelpers.spec.ts`: eine Sichtbarkeit,
   deren erste Einträge in `visibles` auf `primary` stehen, und
   `maxDebugHelpers` auf einen Wert kleiner als die Zahl dieser Einträge; danach
   steht mindestens ein Frustum-Helfer für eine Nicht-Primärkachel. Der
   bestehende Test `maxDebugHelpers reaches the next update` (`:193-203`) bleibt
   grün.

10. **`HelpersManager.ts`: das TSDoc nennt die Rekursion.** Der Block bei
    `:61-64` bekommt den Satz, dass außer der übergebenen Szene immer auch
    {@link root} geräumt wird, weil die Knoten dieses Managers in beiden liegen
    und nur zusammen heruntergehen. Der Nebeneffekt bleibt, wie er ist.

11. **`TileSprites/TileSpritesFactory.ts`: `freeTileSprite()` entfernen
    (`:30-32`).** Der Rumpf ist Zeile für Zeile `destroyTile()` (`:64-66`), die
    Methode steht in keinem Interface und hat repoweit keinen Aufrufer. Die
    Entscheidung vom 2026-09-07 im Kopf dieses Plans — »der Zwilling
    `freeTileSprite()` fällt weg« — gilt: entfernen, nicht deprecaten.
    `map2d/public-api.ts` bleibt unberührt, exportiert wird die Klasse.

12. **CONS-009, die beiden Ausrufezeichen.**
    - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:190` —
      `atlas.frame(frameName)!.coords` bekommt den Satz, der das `!` trägt: die
      Namen kommen aus `atlas.frameNames()` desselben Atlas, jeder von ihnen ist
      dort registriert.
    - `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:56` — das
      `!` in `return this.#uint32Data!;` fällt weg; das `if` zwei Zeilen darüber
      hat den Wert gesetzt. Meldet `pnpm typecheck` das doch an, bleibt es
      stehen und bekommt stattdessen den Satz, was der Compiler an dieser Stelle
      nicht sieht.

13. **`CameraBasedVisibility.spec.ts:284-285`: der Testkommentar sagt, was
    stimmt.** Nicht die frische `Matrix4`-Instanz bricht das Gate —
    `Dependencies.cloneable<Matrix4>` vergleicht über `.equals()`, also
    wertbasiert —, sondern die Translation um `0.0001` im Aufruf darunter. Der
    Test selbst bleibt, wie er ist.

14. **`packages/twopoint5d/CHANGELOG.md`.** Alles unter `## [Unreleased]`, nach
    Keep a Changelog 1.1.0 und in der Machart der bestehenden Einträge — ein
    Satz je Änderung, aus der Sicht dessen, der die Bibliothek benutzt, ohne
    Rückblick auf den Vorzustand außer dort, wo er den Bruch erklärt.
    - `### Removed`: `freeTileSprite()`, mit `destroyTile()` als dem Weg, den es
      immer schon gab.
    - `### Migration Guide`: derselbe Wechsel, eine Zeile.
    - `### Changed`: der Rasterwechsel, der die Kacheln neu aufbaut (Schritte 1
      und 2), `frustumBoxScale` als Teil des Dirty-Checks, das geleerte
      `visibles`, `maxDebugHelpers` mit seiner geschärften Bedeutung.
    - `### Fixed` beziehungsweise `### Changed`: die beiden Renderer-Punkte aus
      Schritt 5 und 6, kurz.
    Der Skill `updating-changelog` gilt.

**Zwei Testflächen, hier reicht eine.** `AGENTS.md` verlangt für Änderungen an
Rendering- und GPU-Puffer-Code zusätzlich einen `*.test.js` in
`packages/twopoint5d-testing/test/`. Dieses Paket ändert an keiner Stelle ein
Puffer-Layout, einen Shader oder eine Attributschreibung: was sich ändert, ist
die Buchhaltung davor — wann eine Kachel erfragt, wann ein Serial gehoben, wann
ein Kachelsatz verworfen wird. Das ist in Vitest vollständig prüfbar, und ein
Browser-Test würde dieselben Zusagen teurer und schwächer festnageln. Die
`*.spec.ts` sind die Fläche dieses Pakets.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci` — der Cache-Schalter, weil sonst
  Stufen aus dem Cache des Implementierers durchgewinkt werden.
- Commit: `fix(twopoint5d): rebuild what a grid change invalidates and stop redoing what a frame already has`

  Scope `twopoint5d` statt `map2d`: die Scopes dieses Repos sind Paketnamen, und
  die drei Commits dieses Laufs davor lauten alle `fix(twopoint5d)`. Dazu ein
  `BREAKING CHANGE:`-Footer, weil `freeTileSprite()` von der öffentlichen Fläche
  verschwindet — dieselbe Form, die `bc38818` und `77e030b` dafür verwenden.
  (Zug 4 Runde 1 am 2026-09-07, aus dem Review.)

  Body:

  ```
  A change to tileWidth, tileHeight, xOffset or yOffset on a running map now clears the
  tiles: they are recognised by their (x, y) id, and updateTile() writes only the
  position, so they would go on showing the old tile size at new places. A visibility
  area guards the same case on its own, because it takes the grid as an argument and can
  be driven without a tile streamer.

  frustumBoxScale joins the dependencies its own result is computed from, and a
  recomputation in which no probe ray meets the plane empties visibles instead of leaving
  the tiles of the last one standing for the helpers to draw.

  The renderer stops asking the factory for a tile it has already refused, and an empty
  clearTiles() no longer forces a full attribute upload. The map updates its world matrix
  once per frame instead of twice.

  freeTileSprite() is gone; destroyTile() is the call it duplicated. Beside these,
  maxDebugHelpers counts the helpers that were built rather than the tiles it walked past,
  and three doc comments say what their code does.

  BREAKING CHANGE: TileSpritesFactory#freeTileSprite() is gone; destroyTile(tile) does the
  same work and is the one the IMapTileFactory interface names.
  ```
- Ergebnis: 4 Runden · alle 13 Findings behoben, vom Reviewer je mit Fundstelle
  bestätigt · Regressionstests, jeder vor seinem Fix rot: `a changed tile grid
  builds the tiles again` (Renderer wurde nicht geleert),
  `a tile of another grid is removed instead of reused` in
  `RectangularVisibilityArea.spec.ts` (16 statt 0 wiederverwendete Kacheln),
  `a new value recomputes without the camera having moved` (`changed` blieb
  `false`), `empties visibles when the camera turns away from the plane`
  (16 statt 0), `is not asked for again in the cycles that follow` (4 statt 1
  `createTile()`), `is asked for again once it was removed` (4 statt 2),
  `an empty renderer forces no upload` (`factory.update()` lief),
  `maxDebugHelpers counts the frustum boxes that were built, not the tiles
  walked past` (kein Helfer gebaut), sowie in Runde 1 dasselbe Muster für
  `CameraBasedVisibility`: `a tile of another grid is removed instead of reused`
  (16 statt 0) · Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0, acht Stufen
  grün wie in der Baseline, selbst gefahren nach dem letzten Implementierer ·
  die Fehlerkette lief 5 → 4 → 3 → 2 → 0: Runde 1 nahm zwei wichtige Befunde
  (fehlender Eigenschutz gegen den Rasterwechsel in `CameraBasedVisibility`,
  Commit-Message ohne `BREAKING CHANGE:`-Footer), die Runden 2 bis 4 arbeiteten
  nur noch an Sätzen, die etwas anderes sagten als der Code darunter tut · zwei
  Wegentscheidungen des Detailplans wurden im Lauf geschärft: die Rasterfrage
  beantwortet `takeOverTileCoords()` (vormals
  `invalidateTileCoordsCacheIfChanged()`, privat), die dabei auch die
  `map2dTile`-Hüllen der Pool-Slots freigibt, damit nicht dieselbe
  `Map2DTileCoords`-Instanz gleichzeitig in `removeTiles` und `createTiles`
  steht · Commit-Scope auf `twopoint5d` statt `map2d` gezogen, weil die Scopes
  dieses Repos Paketnamen sind
- Klein und offen geblieben: `CameraBasedVisibility.ts:418` deklariert
  `findVisibleTiles(): IMap2DVisibleTiles | undefined`, obwohl die Methode nur
  ein Objektliteral zurückgibt — steht als Nebenbefund in »Offene Befunde«
- Nebenbefunde: → Queue (6 Einträge: `Map2D.ts:14` zweimal,
  `CameraBasedVisibility.ts:116`, `CameraBasedVisibility.ts:418`,
  `DataIdsChunk2D.ts:66`, `types.ts:112,126-128`)
- Folgen: keine. `freeTileSprite()` hatte repoweit keinen Aufrufer — weder in
  `packages/`, `apps/lookbook` noch in der Doku —, `map2d/public-api.ts`
  exportiert die Klasse und nicht die Methode, und der gestrichene
  `updateMatrixWorld()`-Aufruf in `Map2D.update()` hat keinen externen Leser.
- Schnittstellen:
  - `TileSpritesFactory#freeTileSprite()` ist entfernt. `destroyTile(tile)`
    macht dieselbe Arbeit und ist die Methode, die `IMapTileFactory` nennt.
  - `Map2DTileStreamer`: die Setter `tileWidth`, `tileHeight`, `xOffset` und
    `yOffset` lösen bei geändertem Wert ein `clearTiles()` aus. Ein
    Rasterwechsel am laufenden Objekt baut die Kacheln also neu auf, statt sie
    wiederzuverwenden.
  - `IMap2DVisibilitor.computeVisibleTiles()` trägt jetzt einen Vertrag, gegen
    den eine dritte Implementierung gebaut wird: eine Kachel aus `previousTiles`
    kommt nur zur Wiederverwendung zurück, solange das Raster steht. Auf einem
    anderen `tileCoords`-Raster gehen diese Kacheln in `removeTiles`. Der erste
    Aufruf hat kein voriges Raster und nimmt `previousTiles` als zum
    mitgegebenen Raster gehörig. Beide vorhandenen Implementierungen halten das.
  - `CameraBasedVisibility.frustumBoxScale` steht in der Abhängigkeitsliste:
    eine Änderung zur Laufzeit rechnet neu und meldet `changed: true`, statt bis
    zur nächsten Kamerabewegung den alten Kachelsatz mit `changed: false` zu
    liefern. Trifft kein Sondierungsstrahl die Ebene, ist `visibles` leer statt
    mit den Kacheln des letzten Erfolgs besetzt.
  - `CameraBasedVisibilityHelpers.maxDebugHelpers` zählt die gebauten
    Frustum-Helfer, nicht mehr den Laufindex durch `visibles`. Die Zahl bedeutet
    damit, was sie sagt, unabhängig von der Sortierung der Liste.
  - `Map2D#update()` ruft `updateMatrixWorld()` nicht mehr selbst. Der Streamer
    bringt die Matrix in Ordnung, sobald er einen Visibilitor und mindestens
    einen Renderer hat; ein Update, dem eines von beiden fehlt, fasst keine
    Matrix an.
  - `Map2DTileRenderer` merkt sich eine von der Factory abgelehnte Kachel und
    erfragt sie erst nach `removeTile()` oder `clearTiles()` wieder. Ein leeres
    `clearTiles()` hebt den Daten-Serial nicht mehr und erzwingt keinen Upload.

#### Die Findings im Wortlaut

**BUG-046 · low · `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:30-56`, `TileSprites/TileSpritesFactory.ts:56-58`, `CameraBasedVisibility.ts:331-336`** — Eine Änderung der Tile-Größe am laufenden Map2D lässt bestehende Kacheln in alter Größe
Die Setter `tileWidth`, `tileHeight`, `xOffset` und `yOffset` schreiben nur in den Koordinaten-Helfer; `clearTiles()` wird nicht ausgelöst. Beim nächsten `update()` findet der Visibilitor die Kacheln über ihre id `(x, y)` wieder und meldet sie als `reuseTiles`; `updateTile()` setzt aber nur die Position, `quadSize` und `texCoords` bleiben stehen. Die Sprites zeigen die alte Kachelgröße an neuen Positionen, bis sie zufällig aus dem Sichtbereich fallen.
Empfehlung: In den vier Settern bei geändertem Wert `clearTiles()` vormerken, so dass der nächste `update()` alles neu aufbaut. Alternativ `updateTile()` auch `quadSize` schreiben lassen; dann bleibt nur die Positionsänderung übrig.

**BUG-061 · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:109, 224-236, 548`** — frustumBoxScale steht nicht im Dirty-Check, den es beeinflusst
`frustumBoxScale` (:109) ist öffentlich und schreibbar und geht bei :548 in die Sichtbarkeitsrechnung ein. In der Abhängigkeitsliste von `dependenciesChanged()` (:227-235) steht es nicht. Wer das Feld zur Laufzeit ändert, bekommt bis zur nächsten Kamerabewegung den alten Kachelsatz — und der Cache-Pfad meldet dazu `changed: false`, was ein Konsument als »der Kachelsatz stimmt noch« liest. Seit `CameraBasedVisibility.serial` am selben Dirty-Check hängt, bauen auch die Sichtbarkeits-Helfer nach einer Änderung nicht neu.
Empfehlung: `frustumBoxScale` in die Liste in `dependenciesChanged()` aufnehmen. Alternativ das Feld hinter einen Setter legen, der `needsUpdate` hebt — das ist die Bauform, die `RectangularVisibilityArea` bereits verwendet.

**BUG-062 · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:302-305` gegen `:386`** — Trifft die Kamera die Ebene nicht, trägt visibles weiter die Kacheln von vorhin
Findet keiner der neun Sondierungsstrahlen die Ebene, kehrt `computeVisibleTiles()` bei :302-305 zurück und meldet einen leeren Kachelsatz. Geleert wird `this.visibles` aber erst in `findVisibleTiles()` (:386) — das auf diesem Weg nie erreicht wird. Das öffentliche Feld trägt danach die Kacheln der letzten erfolgreichen Rechnung samt ihrer alten `box`- und `frustumBox`-Werte. Wer `visibles` liest — die Sichtbarkeits-Helfer tun genau das —, zeichnet Kachelboxen für eine Ansicht, die es nicht mehr gibt. Vorbestehend, derselbe Zweig ohne Leerung steht in `git show c16ce54`.
Empfehlung: `this.visibles.length = 0` in den `hitCount === 0`-Zweig ziehen. Achtung beim Beheben: das TSDoc von `serial` und `visibles` beschreibt seit dem letzten Remediation-Paket genau dieses Verhalten und wandert mit.

**BUG-063 · low · `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:112-117`** — Ein Rasterwechsel zur Laufzeit schreibt die Belegtmarke ins Leere
Die Belegtmarke einer wiederverwendeten Kachel wird über `tile.x - tileCoords.tileLeft` in ein `Uint8Array` geschrieben. Ändert sich das Kachelraster zur Laufzeit (`Map2D.tileWidth`, `tileHeight`, `xOffset`, `yOffset`), passen die Indizes der alten Kacheln nicht mehr zum neuen Raster: Der Schreibzugriff läuft ins Leere — ein `TypedArray` verschluckt einen Index außerhalb seiner Länge lautlos —, und für dieselbe Fläche entsteht zusätzlich eine neue Kachel. Sichtbar als doppelt belegte Zellen, bis sie aus dem Sichtfeld wandern. Kein Aufrufer im Repo ändert das Raster nach dem Aufbau; deshalb low und nicht höher.
Empfehlung: Bei einem Wechsel von `map2dTileCoords` die vorherigen Kacheln verwerfen statt wiederzuverwenden — `#deps` kennt den Wechsel bereits, der Zweig muss ihn nur auswerten. Gehört zusammen mit dem Finding über die Setter behoben, das dieselbe Ursache von der anderen Seite beschreibt.

**API-044 · low · `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts:30-32`** — freeTileSprite() ist ein veröffentlichter Zwilling von destroyTile()
`freeTileSprite(sprite)` ist Zeile für Zeile derselbe Rumpf wie `destroyTile(tile)`: beide rufen `this.tileSprites.geometry?.instancedPool.freeVO(…)`. `freeTileSprite()` steht nicht in `IMapTileFactory` und hat im Repo keinen Aufrufer, ist über `map2d/public-api.ts` aber veröffentlicht. Aufgefallen im Remediation-Lauf vom 2026-09-06 (Paket 11); der Code wurde seitdem nicht neu auditiert.
Empfehlung: Deprecaten und im nächsten Major entfernen. — Der Kopf dieses Plans entscheidet anders: entfernen, siehe »Entscheidungen« vom 2026-09-07.

**PERF-012 · info · `packages/twopoint5d/src/map2d/Map2D.ts:120-123`, `Map2DTileStreamer.ts:84, 96-98`** — Zwei World-Matrix-Updates und drei frische Vektoren pro Frame im Streamer
`Map2D.update()` ruft `updateMatrixWorld()`, gleich danach ruft der Streamer `node.updateWorldMatrix(true, false)` auf demselben Objekt; beim zweiten Aufruf hat sich nichts geändert. Dazu legt der Streamer pro Frame `new Vector2()`, `new Vector3()` und `new Vector3(position)` an, obwohl er die Werte nur an `beginUpdatingTiles()` durchreicht.
Empfehlung: Einen der beiden Matrix-Aufrufe streichen und die drei Vektoren als Instanzfelder wiederverwenden.

**PERF-016 · low · `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:44-54, 56-71`** — Eine Kachel, die der Factory nichts wert ist, wird jeden Frame neu erfragt
Liefert `createTile()` `undefined`, landet nichts in `#tiles` (:48). Jeder folgende `reuseTile()` findet die Kachel nicht und fällt wieder in `addTile()`, das `createTile()` erneut ruft — je Frame und je Lückenkachel, auch bei stehender Kamera. Bei `TileSpritesFactory` ist das jede Kachel mit tileId 0, also jedes Loch in der Karte. Eine Karte mit Löchern zahlt einen Nachschlag im Tile-Data-Provider je Loch und Frame; das Serial-Tor davor greift hier nicht, weil gar nichts eingetragen wird.
Empfehlung: Die Absage merken: ein `Set` der tileIds, für die die Factory `undefined` geliefert hat, wird bei `clearTiles()` mitgeleert. `reuseTile()` fragt es ab, bevor es `addTile()` ruft.

**PERF-018 · low · `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:85-94`** — clearTiles() erzwingt einen GPU-Upload, auch wenn nichts zu leeren war
`clearTiles()` erhöht `#dataSerial` bedingungslos — auch dann, wenn der Renderer gar keine Kachel hielt. Das nächste `endUpdatingTiles()` sieht einen frischen Serial, ruft `factory.update()` und schiebt die vollen Attribut-Puffer zur GPU, obwohl sich nichts geändert hat. Einmalig je leerem Clear, nicht je Frame; das Serial-Tor davor ist ansonsten genau dafür gebaut, solche Uploads zu vermeiden.
Empfehlung: Den Serial nur erhöhen, wenn `#tiles.size > 0` war. Zwei Zeilen, und das Tor stimmt wieder mit sich selbst überein.

**DOC-019 · low · `packages/twopoint5d/src/map2d/HelpersManager.ts:61-63` gegen `:76-78`** — removeFromScene() verschweigt, dass es immer auch root räumt
Das TSDoc sagt »Takes every node this manager added to `scene` out of it« — und verschweigt die Rekursion vier Zeilen weiter unten: außer der übergebenen Szene wird immer auch `root` geräumt. Genau diese Asymmetrie war die Ursache des letzten Remediation-Pakets; der Manager selbst stand dort auf »nicht anfassen«. Öffentliche Fläche über `map2d/public-api.ts`. Vorbestehend, identisch in `git show c16ce54`.
Empfehlung: Den Satz um die Rekursion ergänzen. Der Nebeneffekt ist gewollt — er muss nur dastehen, damit ein Aufruf mit fremder Szene keine Überraschung ist.

**CONS-009 · info · `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:8-19`, `CameraBasedVisibility.ts:9-20`** — Der Typ TileBox steht zweimal im selben Verzeichnis
Zwei strukturgleiche Deklarationen desselben Typs, beide nicht exportiert. Dazu zwei kleinere Fundstellen derselben Machart: `texture/FrameBasedAnimations.ts:141` trägt ein `atlas.frame(frameName)!` ohne den Satz, der die Invariante benennt, und `map2d/chunk-quad-tree/DataIdsChunk2D.ts:56` ein überflüssiges `!` unmittelbar nach der Zuweisung im `if` darüber. Im Remediation-Lauf vom 2026-09-06 erneut bestätigt; `TileBox` ist inzwischen aus dem Paket exportiert, die Kopie in `CameraBasedVisibilityHelpers.ts:9-20` kann ohne Änderung der Oberfläche fallen.
Empfehlung: Eine Deklaration, aus einem Modul bezogen. Die beiden Ausrufezeichen bekommen ihren Satz oder fallen weg.

**CONS-016 · low · `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:37, 154-165`** — maxDebugHelpers kappt über den Laufindex statt über die Zahl der gebauten Helfer
`maxDebugHelpers` begrenzt die Frustum-Helfer der Nicht-Primärkacheln über `i < this.maxDebugHelpers` — `i` läuft aber durch `visibles`, nicht durch die gebauten Helfer. Stehen die ersten neun Einträge auf `primary`, entsteht kein einziger Helfer, obwohl das Feld neun erlaubt. Die Kachelbox-Helfer daneben kappt das Feld gar nicht, obwohl sein Name über den ganzen Satz spricht. Eine öffentliche Stellschraube, deren Wirkung von der Sortierung einer Liste abhängt.
Empfehlung: Einen eigenen Zähler mitführen, der nur bei tatsächlich gebauten Helfern hochzählt, und ihn gegen `maxDebugHelpers` prüfen. Dann bedeutet die Zahl, was sie sagt.

**CONS-017 · low · `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:99`** — Ein Optional-Chaining-Operator hinter einem Guard, der ihn ausschließt
`this.tiles = visible?.tiles;` steht innerhalb von `if (visible)`. Der Operator kann dort nie greifen und liest sich wie ein Hinweis auf einen Fall, den es nicht gibt — der nächste Leser prüft, ob der Guard vielleicht doch löchrig ist, und findet nichts.
Empfehlung: Zu `visible.tiles` vereinfachen.

**CONS-019 · low · `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts:284-285`** — Ein Testkommentar begründet das Gegenteil dessen, was der Test tut
Der Kommentar sagt »translate by 0 still bumps the equality gate via a fresh Matrix4 instance«. `Dependencies.cloneable<Matrix4>` vergleicht über `.equals()`, also wertbasiert — eine frische Identitätsmatrix bricht das Gate gerade nicht. Was es bricht, ist die Translation um `0.0001` im Aufruf davor. Der Test läuft richtig, seine Begründung ist falsch, und wer sie glaubt, baut den nächsten Test auf einer Annahme, die nicht trägt.
Empfehlung: Kommentar korrigieren: nicht die frische Instanz bricht das Gate, sondern der von 0 verschiedene Translationswert.

### [x] 5. map2d: Map2D-Kern, Kachel-Provider, Chunk-Quadtree
- Findings: BUG-032, BUG-036, BUG-047, READ-002, READ-003, READ-009, CONS-015
- Ziel: Grenzprüfungen greifen in beiden Achsen, unregelmäßige Muster liefern
  richtige Maße, und toter Code verschwindet.
- Bereich: `packages/twopoint5d/src/map2d/Map2D.ts`,
  `Map2DSpatialHashGrid.ts`, `RepeatingTilesProvider.ts`,
  `chunk-quad-tree/DataIdsChunk2D.ts`
- Hängt ab von: —
- Hash: 4d723fe
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/map2d/Map2D.ts`,
  `packages/twopoint5d/src/map2d/Map2D.spec.ts`,
  `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts`,
  `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`,
  `packages/twopoint5d/src/map2d/RepeatingTilesProvider.spec.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts` (neu),
  `packages/twopoint5d/CHANGELOG.md`

#### Was der Abgleich ergeben hat

Alle sieben Findings existieren. Keines ist durch die Pakete 1 bis 4 oder durch
Paket 9 gegenstandslos geworden. Von den vier Dateien dieses Pakets hat dieser
Lauf zwei überhaupt nicht angefasst (`RepeatingTilesProvider.ts`,
`Map2DSpatialHashGrid.ts`, belegt mit `git diff a9f7dd1..HEAD`), und die
anderen beiden nur an Stellen, die kein Finding berühren: `Map2D.update()` hat
den `updateMatrixWorld()`-Aufruf gegen einen Kommentar getauscht,
`DataIdsChunk2D.ts:56` hat sein `!` verloren. Damit sind auch die beiden
Hinweise erledigt, die der Grobplan hier hinterlassen hatte — der
`base64toUint32Arr`-Umbau aus Paket 3 lässt `:49` unverändert, und der Stand
nach Paket 4 ist der Stand, gegen den dieser Detailplan geschrieben ist.

Drei Fundstellen sind verrutscht — die Zeilennummern unten sind die **aktuellen**:

| Finding | Fundstelle laut Audit | Fundstelle jetzt |
| --- | --- | --- |
| BUG-032 | `RepeatingTilesProvider.ts:27` | `:33` (`this.#cols = tileIds[0]!.length` im Setter `:28-34`) |
| BUG-036 | `DataIdsChunk2D.ts:380` | `:59-61` (`readDataIdAtLocal`), TSDoc auf `:63-65` |
| READ-002 | `Map2DSpatialHashGrid.ts:29` | `:35` (im `if`-Zweig) gegen `:40` (unbedingt) |

Die Zeilenangabe des Audits zu BUG-036 zeigt in eine Datei mit 69 Zeilen und
trifft nichts; gemeint ist die Methode, und die steht dort, wo die Tabelle sie
nennt. BUG-047 (`:52-73`), READ-003 (`:30`), READ-009 (`:14-22`) und CONS-015
(`:44-46`) stehen exakt dort, wo das Audit sie nennt.

**BUG-047 trägt weiter.** `TileSpritesFactory.createTile()` (`:30-50`) prüft
`if (tileDataId === 0) return;` und läuft mit einem `undefined` weiter bis
`tileSet.frameId(undefined)`. Der Weg dorthin ist unverändert offen.

#### Was dieses Paket aus »Offene Befunde« mitnimmt

Drei Einträge der Queue haben dieselbe Ursache wie Findings dieses Pakets und
liegen in denselben zwei Methoden. Sie werden hier miterledigt und in der Queue
auf `[x]` gesetzt:

1. `Map2D.ts:14` (`set tileStreamer`) — der Wechsel räumt die Kacheln nicht ab.
   Dieselbe Methode, die READ-009 umbaut.
2. `Map2D.ts:14` (`set tileStreamer`) — `centerX` und `centerY` wandern nicht
   mit. Dieselbe Methode.
3. `DataIdsChunk2D.ts:66` (`readDataIdAt`) — inhaltlich dieselbe Lücke, die
   BUG-036 beschreibt, aus der anderen Richtung notiert (das TSDoc gegen die
   fehlende Grenzprüfung). Eine Dublette, kein zweiter Sachverhalt: Schritt 1
   schließt beide.

**Neu aufgefallen und mitgenommen:** `Map2D.ts:45` — `set visibilitor` prüft
`if (this.#tileStreamer != null)` auf dasselbe Feld, das der Konstruktor immer
füllt. Dieselbe Ursache wie READ-003 und READ-009, vier Zeilen unter dem Fix.
Er geht nicht in die Queue, sondern in Schritt 6.

Alles andere in »Offene Befunde« bleibt liegen: die Einträge zu `PanControl2D`,
`Display`, `texture/` und `CameraBasedVisibility`/`types.ts` haben weder
dieselbe Ursache noch eine der vier Dateien dieses Pakets.

#### Die Entscheidungen dieses Zuges

1. **BUG-032 lehnt ab, statt zu normalisieren.** Ein Muster mit ungleich langen
   Zeilen kann auf zwei Wegen gerettet werden: kürzeste Zeile als Breite, oder
   kurze Zeilen mit `0` auffüllen. Beide raten, was der Aufrufer gemeint hat,
   und beide erzeugen eine Karte, die anders aussieht als der Quelltext, der sie
   beschreibt. Das Audit empfiehlt die laute Ablehnung, und der Provider hat
   keinen anderen Weg, dem Aufrufer etwas zu sagen. Geprüft wird **vor** der
   Zuweisung: ein abgelehntes Muster lässt den Provider unverändert stehen.
2. **BUG-036 prüft beide Achsen, nicht nur `x`.** Das Audit nennt nur `x`, weil
   ein zu großes oder negatives `y` allein aus dem Array fällt. Zusammen mit
   einem `x` außerhalb tut es das aber nicht: bei `width = 4` liefert
   `(x = 5, y = -1)` den Index `1` und damit einen fremden, gültig aussehenden
   Wert. Der Guard, der nur `x` prüft, ließe diesen Weg offen.
3. **Der Guard sitzt in `readDataIdAtLocal()`, nicht in `readDataIdAt()`.** Die
   Methode rechnet den Index, sie ist `protected` und damit der Einstieg jeder
   Unterklasse, und das CHANGELOG führt sie bereits mit der Zusage
   `number | undefined` für Koordinaten außerhalb des Chunks. `containsDataAt()`
   käme als Guard in `readDataIdAt()` in Frage, prüft aber in Weltkoordinaten
   und ließe jeden lokalen Einstieg ungeschützt.
4. **Der `tileStreamer`-Setter räumt über `clearTiles()` des neuen Streamers,
   nicht über die Renderer direkt.** `Map2DTileStreamer#clearTiles()` merkt den
   Auftrag vor und führt ihn im nächsten `update()` aus — dieselbe Maschinerie,
   die Paket 4 für den Rasterwechsel eingesetzt hat. Die Renderer von der
   `Map2D` aus einzeln zu leeren, umginge sie und legte einen zweiten Weg neben
   den bestehenden.

#### Restplan

Unverändert. Die Pakete 6 (vertex-objects, `src/utils/Dependencies.ts`), 7
(`src/stage/`) und 8 (tote Blöcke im Lookbook, in `ProjectionPlane.ts`, in
`ChunkQuadTreeNode.ts` und im Quadtree-Playground) teilen mit diesem Paket keine
Datei und keine Ursache; keines von ihnen trägt ein `Hängt ab von`, das dieses
Paket berührt. Die Reihenfolge bleibt, wie sie steht — Paket 8 als
breitflächige Löschung am Ende, damit kein vorheriger Diff durch verschwundene
Dateien unlesbar wird.

Eine Nachbarschaft ohne Folgen: `IDataChunk2D.ts:15` trägt die auskommentierte
Zeile `// readDataIdAt(x: number, y: number): number;`. Sie steht in keinem der
vier Blöcke, die Paket 8 aufzählt, und in keiner Datei dieses Pakets. Sie bleibt
liegen.

#### Vorgehen

Die Schritte sind unabhängig voneinander und stehen in dieser Reihenfolge, weil
die drei Korrektheitsfehler zuerst kommen. Jeder von ihnen bekommt seinen
Regressionstest **zuerst**, rot gesehen, dann den Fix; der rote Lauf gehört in
den Report. Ein einzelner Test läuft mit
`pnpm nx test twopoint5d -- src/map2d/<datei>.spec.ts`.

**1. Die Grenzprüfung von `DataIdsChunk2D` (BUG-036, dazu der Queue-Eintrag
`DataIdsChunk2D.ts:66`).**

`packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts` gibt es
noch nicht; sie wird angelegt. Ein Chunk lässt sich ohne Base64 bauen — der
Konstruktor nimmt `{x, y, width, height, uint32Arr}`. Aufbau: `x: 10, y: 20,
width: 4, height: 3`, `uint32Arr` mit den Werten `1..12`, damit jede Zelle
unterscheidbar ist.

Testname: `reads nothing from the row next door`. Er hält drei Koordinaten
fest, die heute einen fremden Wert liefern und `undefined` liefern müssen:

- `readDataIdAt(9, 21)` — lokal `(-1, 1)`, Index `3`, heute der letzte Wert der
  ersten Zeile
- `readDataIdAt(14, 20)` — lokal `(4, 0)`, Index `4`, heute der erste Wert der
  zweiten Zeile
- `readDataIdAt(15, 19)` — lokal `(5, -1)`, Index `1`, heute der zweite Wert der
  ersten Zeile

Dazu im selben Test die Gegenprobe, dass eine Koordinate im Chunk weiterhin
ihren Wert liefert: `readDataIdAt(12, 21)` ist `7`.

Der Fix in `readDataIdAtLocal()`:

```ts
protected readDataIdAtLocal(x: number, y: number): number | undefined {
  const {width, height} = this.data;
  // `y * width + x` folds a coordinate from outside into the neighbouring row and lands on a
  // valid-looking id there, so the index is held against both axes rather than against the
  // length of the array alone
  if (x < 0 || x >= width || y < 0 || y >= height) return undefined;
  return this.uint32Arr[y * width + x];
}
```

`this.data` ist das `DataIdsChunk2DParams` des Konstruktors und trägt `width`
und `height` aus `DataChunkCoords2D`. Signaturen und Rückgabetypen von
`readDataIdAtLocal()` und `readDataIdAt()` bleiben, wie sie sind — das CHANGELOG
führt beide bereits mit `number | undefined`, und dieser Schritt macht die
Zusage erst wahr. Das TSDoc auf `:63-65` bleibt ebenfalls stehen; es beschreibt
ab jetzt, was der Code tut.

**2. Die Kompressions-Meldung (CONS-015).**

In `prepareData()` das `console.error` samt der `// eslint-disable-next-line
no-console`-Zeile darüber streichen und die Angabe in die Fehlermeldung nehmen.
Die `// TODO support compression`-Zeilen mit den drei Links bleiben — sie sind
kein Finding und sagen, was noch fehlt:

```ts
if (compression) {
  // TODO support compression
  // - https://github.com/imaya/zlib.js
  // - https://github.com/nodeca/pako
  // - ... ?
  throw new Error(`DataIdsChunk2D: the compression "${compression}" is not supported`);
}
```

Der Klassenname in der Meldung ist `DataIdsChunk2D` und nicht `Data2DChunk` —
so heißt die Klasse. Der base64-String selbst gehört nicht in die Meldung: er
kann beliebig lang sein, und die Frage, die der Aufrufer hat, beantwortet die
Kompression.

Test in derselben neuen Spec-Datei, Name `names the compression it cannot
handle`: ein Chunk mit `{data: '…', compression: 'gzip'}`, ein Lesezugriff über
`readDataIdAt()`, und die Erwartung, dass der Wurf `gzip` in der Meldung nennt.
Kein Rot-vor-Grün nötig — die Meldung ändert sich, das Werfen nicht.

**3. Rechteckige Muster im `tileIds`-Setter (BUG-032).**

Zuerst der Test in `RepeatingTilesProvider.spec.ts`, im `describe('new', …)`,
Name `rejects a pattern whose rows are not all the same length`:

- `new RepeatingTilesProvider([[1, 2], [3]])` wirft, und die Meldung nennt die
  Zeile, die abweicht
- ein Provider mit `[[1, 2], [3, 4]]`, dem danach `[[1, 2], [3]]` über den
  Setter zugewiesen wird, wirft ebenfalls und trägt anschließend unverändert
  `[[1, 2], [3, 4]]` — die Ablehnung lässt ihn stehen, wie er war
- `new RepeatingTilesProvider()` bleibt `[[]]`, wie es der bestehende Test
  `without arguments` festhält: eine einzelne leere Zeile ist rechteckig

Der Fix:

```ts
set tileIds(tileIds: number[][]) {
  const rows = tileIds.length;
  if (rows === 0) {
    throw new Error('RepeatingTilesProvider: a tile id pattern needs at least one row');
  }
  const cols = tileIds[0]!.length;
  for (let row = 1; row < rows; row++) {
    if (tileIds[row]!.length !== cols) {
      throw new Error(
        `RepeatingTilesProvider: every row of a tile id pattern has the same length, but row ${row} has ${tileIds[row]!.length} instead of ${cols}`,
      );
    }
  }
  this.#tileIds = tileIds;
  this.#rows = rows;
  this.#cols = cols;
}
```

Die Prüfung läuft vollständig vor der ersten Zuweisung: ein abgelehntes Muster
darf den Provider nicht halb beschrieben zurücklassen.

Der Kommentar über `#rows`/`#cols` (`:18-20`) behauptet heute eine Invariante,
die erst mit diesem Schritt gilt. Er wird nachgezogen, so dass er die Prüfung
nennt, die ihn trägt. Der Kommentar auf `:31-32` beschreibt, was der Setter mit
einem leeren äußeren Array tut, und beschreibt es nach diesem Schritt falsch —
er wird ersetzt oder fällt weg, je nachdem, was der neue Rumpf noch erklärt
braucht. Beide sind ohne Rückblick auf den Vorzustand zu formulieren, wie es die
Konventionen im Kopf dieses Plans verlangen.

**4. Der fehlende Guard in `getTileIdAt()` (BUG-047).**

Test zuerst, in `RepeatingTilesProvider.spec.ts` unter
`describe('getTileIdAt()', …)`, Name `answers with 0 on a pattern that has no
columns`:

- `new RepeatingTilesProvider().getTileIdAt(0, 0)` ist `0`
- dasselbe für `(3, 7)` und `(-3, -7)`
- dasselbe mit `limitToAxis: 'horizontal'` — der Zweig läuft heute in
  `col % 0` und liefert `undefined`; `'vertical'` fällt schon heute über seine
  Spaltenprüfung heraus und liefert `0`

Der Fix ist eine Zeile am Anfang der Methode, dieselbe Bedingung, mit der
`getTileIdsWithin()` öffnet:

```ts
getTileIdAt(col: number, row: number): number {
  // the guard `getTileIdsWithin()` opens with: a pattern without cells has no id to answer
  // with, and the `% 0` below would turn the index into NaN
  if (this.#cols === 0 || this.#rows === 0) return 0;
  switch (this.limitToAxis) {
    …
```

**5. Der `tileStreamer`-Setter (READ-003, READ-009 und die beiden
Queue-Einträge zu `Map2D.ts:14`).**

Zwei Tests zuerst, in `Map2D.spec.ts`, in einem neuen
`describe('tileStreamer', …)`. Die Datei hat mit `makeTileRenderer()` bereits
einen Fake-Renderer; für den zweiten Test braucht es zusätzlich einen
Fake-Visibilitor, dessen `computeVisibleTiles()` ein Ergebnis mit leeren Listen
zurückgibt (`{tiles: [], createTiles: [], reuseTiles: [], removeTiles: []}`),
damit `Map2DTileStreamer#update()` seinen Rumpf durchläuft.

- `hands the view center to the streamer that takes over`: `map.centerX = 100`,
  `map.centerY = -50`, dann `map.tileStreamer = new Map2DTileStreamer()`, und
  danach sind `map.centerX` und `map.centerY` unverändert `100` und `-50`. Heute
  liest der Test `0` und `0`.
- `builds the tiles again when another streamer takes over`: eine `Map2D` mit
  einem Fake-Renderer, dessen `clearTiles()` gespiont wird; Streamer wechseln,
  Visibilitor setzen, `map.update()` — `clearTiles()` muss genau einmal gelaufen
  sein. Heute läuft es nie, und die Kacheln des vorigen Streamers bleiben in der
  `#tiles`-Map des Renderers liegen, wo der nächste `addTile()` sie ohne
  `destroyTile()` überschreibt.

Der Rumpf danach, vollständig:

```ts
set tileStreamer(streamer: Map2DTileStreamer) {
  if (this.#tileStreamer === streamer) return;

  const previous = this.#tileStreamer;

  for (const renderer of this.#renderers) {
    previous.removeTileRenderer(renderer);
  }

  this.#tileStreamer = streamer;

  // the view center belongs to the map: whoever set it through Map2D reads it back through
  // Map2D, whichever streamer carries it underneath
  streamer.centerX = previous.centerX;
  streamer.centerY = previous.centerY;

  if (this.#visibilitor) {
    streamer.visibilitor = this.#visibilitor;
  }

  for (const renderer of this.#renderers) {
    streamer.addTileRenderer(renderer);
  }

  // the renderers hold the tiles of the streamer that left, and the one taking over starts with
  // an empty tile list: without this every one of those tiles comes back as a createTile and
  // overwrites its map entry, and the tile it replaces never reaches destroyTile()
  streamer.clearTiles();
}
```

Der frühe Ausstieg ersetzt die Verschachtelung, und mit ihm fallen beide toten
Verzweigungen weg: `if (this.#renderers.size > 0)` sparte eine Schleife über ein
leeres Set, `if (this.#tileStreamer)` fragte ein Feld ab, das der Konstruktor
immer füllt. Es ist dieselbe Bauform, die die vier Setter von
`Map2DTileStreamer` verwenden.

Das Raster — `tileWidth`, `tileHeight`, `xOffset`, `yOffset` — wandert
ausdrücklich **nicht** mit: es gehört dem Streamer, der Konstruktor nimmt es
entgegen, und wer einen Streamer austauscht, tauscht in aller Regel genau das
aus. Die Ansichtsmitte hat kein Konstruktorargument und ist die Stelle, an der
die Anwendung steht, nicht das Raster, auf dem sie steht.

**6. Der `visibilitor`-Setter (mitgenommener Nebenbefund `Map2D.ts:45`).**

Dieselbe tote Prüfung eine Methode weiter unten, dieselbe Bauform:

```ts
set visibilitor(v: IMap2DVisibilitor) {
  if (this.#visibilitor === v) return;
  this.#visibilitor = v;
  this.#tileStreamer.visibilitor = v;
}
```

Kein Test — das Verhalten ändert sich nicht.

**7. Der doppelte `add`-Aufruf im Spatial-Hash-Grid (READ-002).**

In `Map2DSpatialHashGrid#add()` bleibt der unbedingte Aufruf, der Zweig wird
umgedreht, damit kein leerer `if`-Block stehenbleibt:

```ts
let tileSet = this.#tiles.get(key);
if (tileSet == null) {
  tileSet = new Set<Renderable>();
  this.#tiles.set(key, tileSet);
}
tileSet.add(renderable);
```

Kein Test — `Set#add` ist idempotent, das Verhalten ist unverändert, und
`Map2DSpatialHashGrid.spec.ts` deckt `add` bereits ab.

**8. `packages/twopoint5d/CHANGELOG.md`.** Alles unter `## [Unreleased]`, nach
Keep a Changelog 1.1.0 und in der Machart der bestehenden Einträge — ein Satz je
Änderung, aus der Sicht dessen, der die Bibliothek benutzt, ohne Rückblick auf
den Vorzustand außer dort, wo er den Bruch erklärt. Der Skill
`updating-changelog` gilt.

- `### Changed`: der `tileIds`-Setter, der ein nicht-rechteckiges Muster und
  eines ohne Zeile ablehnt (Schritt 3) · `Map2D#tileStreamer`, der die
  Ansichtsmitte übergibt und die Kacheln neu aufbauen lässt (Schritt 5) ·
  `DataIdsChunk2D#prepareData()`, das die Kompression in seiner Meldung nennt
  und nichts mehr auf die Konsole schreibt (Schritt 2).
- `### Fixed`: `getTileIdAt()` auf einem Muster ohne Spalten (Schritt 4) ·
  `readDataIdAt()` und `readDataIdAtLocal()` außerhalb des Chunks (Schritt 1).
  Der bestehende `### Changed`-Eintrag zum Rückgabetyp der beiden bleibt stehen,
  wo er steht; er beschreibt den Typ, dieser Eintrag das Verhalten.
- `### Migration Guide`: der `tileIds`-Setter, ein Before/After-Paar in der Form
  der bestehenden Abschnitte.

**Zwei Testflächen, hier reicht eine.** `AGENTS.md` verlangt für Änderungen an
Rendering- und GPU-Puffer-Code zusätzlich einen `*.test.js` in
`packages/twopoint5d-testing/test/`. Dieses Paket fasst kein Puffer-Layout,
keinen Shader und keine Attributschreibung an: es prüft Indizes an ihren
Grenzen, dreht zwei Bedingungen um und lässt einen Setter übergeben, was er
schon übergeben sollte. Die `*.spec.ts` sind die Fläche dieses Pakets.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci` — der Cache-Schalter, weil sonst
  Stufen aus dem Cache des Implementierers durchgewinkt werden.
- Commit: `fix(twopoint5d): hold every tile lookup against its own edges and hand the view over with the streamer`

  Scope `twopoint5d` statt `map2d`: die Scopes dieses Repos sind Paketnamen, und
  die vier Commits dieses Laufs davor lauten alle `fix(twopoint5d)`. Dazu ein
  `BREAKING CHANGE:`-Footer, weil der `tileIds`-Setter ein Muster ablehnt, das
  er bisher angenommen hat — dieselbe Form, die `bc38818`, `77e030b` und
  `4f2c53f` dafür verwenden.

  Body:

  ```
  A data id chunk holds a coordinate against both of its axes before it computes an index:
  an x outside the chunk folded into the neighbouring row and answered with a foreign id
  that looked valid, which only a y on its own fell out of the array for.

  A tile id pattern is rectangular or it is refused: the width came from the first row
  alone, and a shorter row below answered with undefined under a signature that promises a
  number. A pattern without cells answers with 0 where it used to compute an index from a
  modulo by zero.

  Exchanging the tile streamer of a map hands the view center over and has the tiles built
  again: the renderers still held the tiles of the streamer that left, and the one taking
  over would have overwritten each of them without giving it back to its factory.

  BREAKING CHANGE: RepeatingTilesProvider#tileIds throws for a pattern whose rows differ in
  length and for one without any row, and keeps the pattern it had. Every row has the
  length of the first one.
  ```
- Ergebnis: 1 Runde · alle sieben Findings behoben, dazu die drei Queue-Einträge
  (`Map2D.ts:14` zweimal, `DataIdsChunk2D.ts:66`) und der Nebenbefund
  `Map2D.ts:45`, vom Reviewer je mit Fundstelle bestätigt · Regressionstests,
  jeder vor seinem Fix rot: `reads nothing from the row next door` (`(9,21)`
  gab `4` statt `undefined`), `names the compression it cannot handle` (Meldung
  nannte `gzip` nicht), `rejects a pattern whose rows are not all the same
  length` (warf nicht), `answers with 0 on a pattern that has no columns`
  (`undefined` statt `0`), `hands the view center to the streamer that takes
  over` (`0` statt `100`), `builds the tiles again when another streamer takes
  over` (`clearTiles()` lief nie) · Verify `NX_SKIP_NX_CACHE=true pnpm run ci`
  exit=0 · vier kleine Befunde offen geblieben: der Zweig `#rows === 0` in
  `RepeatingTilesProvider.ts:68` ist nach dem Setter-Guard unerreichbar (als
  Spiegelung von `getTileIdsWithin()` stehengelassen, der Kommentar darüber
  erklärt ihn nicht) · das öffentliche TSDoc von `RepeatingTilesProvider` und
  seinem `tileIds`-Setter nennt die Rechteckigkeitsregel nicht, sie lebt nur im
  CHANGELOG · die Ablehnung eines Musters ohne Zeile (`tileIds = []`) ist
  ungetestet, während `new RepeatingTilesProvider([])` still auf `[[]]` fällt ·
  `builds the tiles again when another streamer takes over` prüft den
  `clearTiles()`-Aufruf, nicht den Wiederaufbau über den Cache-Pfad des
  Visibilitors
- Nebenbefunde: → Queue (1 Eintrag: `RepeatingTilesProvider.ts:154`/`:182`)
- Folgen: keine. Alle `RepeatingTilesProvider`-Muster im Repo sind rechteckig
  (`apps/lookbook/src/demos/map2d-cam-visi.ts:58`, `map2d-tile-sprites.ts:43`,
  `map2d-rect-visi.ts:81`, in `packages/twopoint5d-testing/test/` die Dateien
  `map2d-visibility-helpers.test.js:45` und `map2d-tile-upload.test.js:49`), und
  `readDataIdAt()` hat außerhalb der neuen Spec keinen Aufrufer.
- Schnittstellen:
  - `RepeatingTilesProvider#tileIds` wirft für ein Muster, dessen Zeilen
    verschieden lang sind, und für eines ohne Zeile; der Provider behält dabei
    das Muster, das er hatte. Der Konstruktor geht durch denselben Setter.
  - `RepeatingTilesProvider#getTileIdAt()` antwortet auf einem Muster ohne
    Spalten oder ohne Zeilen mit `0` statt mit `undefined` unter einer
    `number`-Signatur.
  - `DataIdsChunk2D#readDataIdAtLocal()` und `#readDataIdAt()` liefern
    `undefined` für jede Koordinate außerhalb des Chunks, in beiden Achsen. Eine
    Unterklasse, die auf dem Nachbarzeilen-Wert aufbaute, sieht jetzt
    `undefined`.
  - `Map2D#tileStreamer` übergibt `centerX` und `centerY` an den übernehmenden
    Streamer und lässt dessen Kacheln über `clearTiles()` neu aufbauen. Das
    Raster (`tileWidth`, `tileHeight`, `xOffset`, `yOffset`) wandert
    ausdrücklich nicht mit — es gehört dem Streamer und seinem Konstruktor.
  - `DataIdsChunk2D#prepareData()` schreibt nichts mehr auf die Konsole und
    nennt die nicht unterstützte Kompression in der geworfenen Meldung.

#### Die Findings im Wortlaut

**BUG-032 · low · `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:27`** — RepeatingTilesProvider nimmt die Breite aus der ersten Zeile allein
`#cols` wird im Setter `tileIds` aus `tileIds[0].length` genommen. Bei einem Muster mit ungleich langen Zeilen liefert `getTileIdAt()` für die kürzeren `undefined` unter einer Signatur, die `number` verspricht, und `getTileIdsWithin()` schreibt entsprechend kurze Zeilen in den `Uint32Array`. Weder Konstruktor noch Setter prüfen die Rechteckigkeit, keine Spec deckt den Fall ab.
Empfehlung: Im Setter die Rechteckigkeit prüfen und ein ungleichmäßiges Muster laut ablehnen, statt es halb zu verarbeiten. Eine Spec mit ungleich langen Zeilen dazu.

**BUG-036 · low · `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:380`** — readDataIdAtLocal prüft die x-Grenze nicht
Die Methode rechnet `y * width + x` ohne Grenzprüfung auf `x`. Der Docblock an `readDataIdAt` auf Zeile 384 verspricht `undefined` außerhalb des Chunks; für ein `x` außerhalb `[0, width)` liefert sie aber still den Wert der Nachbarzeile. Nur ein `y` außerhalb fällt aus dem Array.
Empfehlung: `x` gegen `[0, width)` prüfen und außerhalb `undefined` liefern, wie der Docblock es zusagt.

**BUG-047 · low · `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:52-73`** — getTileIdAt() antwortet mit undefined auf einem leeren Muster
`getTileIdsWithin()` fängt `#cols === 0 || #rows === 0` ab und füllt mit `0`. `getTileIdAt()` hat diesen Guard nicht: mit dem Default-Muster `[[]]` ist `#cols = 0`, `col % 0` wird `NaN`, der Index liefert `undefined`, und das Non-Null-Assertion gibt es als `number` zurück. `TileSpritesFactory.createTile()` vergleicht mit `=== 0`, hält `undefined` für eine Kachel und ruft `tileSet.frameId(undefined)`.
Empfehlung: Denselben Guard wie in `getTileIdsWithin()` an den Anfang von `getTileIdAt()` und `0` zurückgeben.

**READ-002 · info · `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:29`** — tileSet.add steht zweimal, der erste Aufruf ist tot
`tileSet.add(renderable)` steht im `if`-Zweig und drei Zeilen darunter noch einmal unbedingt.
Empfehlung: Den Aufruf im Zweig streichen.

**READ-003 · info · `packages/twopoint5d/src/map2d/Map2D.ts:30`** — Ein if-Zweig, der nicht falsch werden kann
`if (this.#tileStreamer)` steht unmittelbar nach der Zuweisung auf Zeile 24; das Feld ist nicht optional und immer belegt. Der Zweig zählt als ungedeckt in die Coverage.
Empfehlung: Die Bedingung streichen.

**READ-009 · low · `packages/twopoint5d/src/map2d/Map2D.ts:14-22`** — Zwei tote Verzweigungen im tileStreamer-Setter
Im `tileStreamer`-Setter ist `if (this.#renderers.size > 0)` um `if (this.#tileStreamer)` gewickelt; die äußere Prüfung spart eine Schleife über ein leeres Set, die innere fragt ein Feld ab, das der Konstruktor immer füllt. Zwei tote Verzweigungen, kein Fehlverhalten. Aufgefallen im Remediation-Lauf vom 2026-09-06 (Paket 6); der Code wurde seitdem nicht neu auditiert.
Empfehlung: Beide Bedingungen streichen.

**CONS-015 · info · `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.ts:44-46`** — Ein console.error direkt vor dem throw, gegen die eigene Fehlerpolitik
Das texture-Modul hat Fehler bewusst von `console.error` auf `error`-Events umgestellt; die Specs tragen das im Namen. `DataIdsChunk2D.prepareData()` loggt mit `eslint-disable` und wirft dieselbe Information danach als Error. Der Aufrufer bekommt beides, der Log lässt sich nicht unterdrücken.
Empfehlung: Das `console.error` streichen und die Details (`compression`) in die Fehlermeldung nehmen.

### [x] 6. vertex-objects und Dependencies: Typen, Kapselung, Dubletten
- Findings: BUG-038, BUG-064, API-045, TYPE-002, TYPE-004, DOC-016, CONS-008,
  CONS-010, CONS-011
- Ziel: `Dependencies` beobachtet, was es speichert, `capacity` ist wieder
  gekapselt, und die doppelte Attribut-Initialisierung existiert einmal.
- Bereich: `packages/twopoint5d/src/vertex-objects/`,
  `src/utils/Dependencies.ts`
- Hängt ab von: —
- Hash: edbd3c0
- Modell: stärkste Stufe
- Effort: high
- Dateien: `packages/twopoint5d/src/utils/Dependencies.ts`,
  `packages/twopoint5d/src/utils/Dependencies.spec.ts`,
  `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts`,
  `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`,
  `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`,
  `packages/twopoint5d/src/vertex-objects/selectBuffers.ts`,
  `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts`,
  `packages/twopoint5d/src/vertex-objects/initializeInstancedAttributes.ts` (entfällt),
  `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts`,
  `packages/twopoint5d/src/vertex-objects/InstancedVertexObjectGeometry.spec.ts`,
  `packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`,
  `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts`,
  `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts`,
  `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts`,
  `packages/twopoint5d/CHANGELOG.md`

#### Was der Abgleich ergeben hat

Acht der neun Findings existieren; **CONS-008 ist gegenstandslos**. Vier Fundstellen
sind gegenüber der `audit.html` verrutscht — die Zeilennummern unten sind die
**aktuellen**:

| Finding | Fundstelle laut Audit | Fundstelle jetzt |
| --- | --- | --- |
| BUG-038 | `InstancedVOBufferGeometry.ts:426-434` | `InstancedVOBufferGeometry.ts:490-506`, der Spread auf `:497` |
| API-045 | `VertexObjectPool.ts:107-113` | `VertexObjectPool.ts:108-114` |
| CONS-011 | `selectBuffers.ts:5-9` | `selectBuffers.ts:6-8` (Parameter `bufferTypes`) |
| TYPE-004 | Datei | `Dependencies.ts:76-102` (`equals()`), ohne TSDoc |

BUG-064 (`Dependencies.ts:57-74` gegen `:76-102`), TYPE-002 (`:3`, `:7`, `:13`,
`:37`, `:57`, `:76`, `:104`, `:118`), DOC-016 (`createVertexObjectPrototype.ts:12`,
ebenso `:23`, `:40`, `:70`) und CONS-010 stehen dort, wo das Audit sie nennt.

**CONS-008 entfällt.** Alle vier Zugriffe auf `extraInstancedBuffers.get(name)`
laufen heute über `expectDefined()`: `touchAttributes()` (`:442`),
`#checkBufferSerials()` (`:578`, dazu die Serials auf `:579`),
`#updateBuffersUpdateRange()` (`:592`) und `#getAutoTouchBuffers()` (`:657`). Der
fünfte Zugriff in `#detachRoute()` (`:296`) prüft mit `if (buffers != null)` und
gehört ohnehin zum Löschweg. Belegt gegen `a9f7dd1`, den Stand, auf dem das Audit
sitzt: dort stehen dieselben `expectDefined()` auf `:432`, `:442`, `:572`, `:578`,
`:592`, `:653` und `:657`. Das Finding war schon bei seiner Aufnahme überholt —
niemand ist daran vorbeigekommen, es ist nur nicht nachgesehen worden. Keine
Änderung, kein Schritt.

**Aus »Offene Befunde« kommt nichts dazu.** Die offenen Einträge liegen in
`src/controls/`, `src/display/`, `src/texture/` und `src/map2d/`; keiner teilt eine
Ursache mit diesem Paket. Sie gehören der Drain-Runde des Abschlusses.

**Der Restplan bleibt, wie er ist.** Paket 7 (`src/stage/`) und Paket 8
(Löschungen in `apps/lookbook/`, `src/stage/ProjectionPlane.ts`,
`src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`, `apps/quadtree-playground/`)
berühren weder `vertex-objects/` noch die drei `Dependencies`-Konsumenten in
`map2d/`. Weder Reihenfolge noch Schnitt ändern sich.

#### Vorgehen

Die Schritte stehen in dieser Reihenfolge, vom Mechanischen zum Öffentlichen. Jeder
Korrektheitsfehler bekommt seinen Regressionstest **zuerst**, rot gesehen, dann den
Fix; der rote Lauf gehört in den Report. Das sind hier die Schritte 3 und 6.

**1. Die dritte Kopie des Usage-Map-Typs fällt (CONS-011).**

`selectBuffers.ts` schreibt den Parametertyp inline aus:

```ts
bufferTypes: {
  [Type in VertexAttributeUsageType]?: boolean;
},
```

Ersetzen durch `bufferTypes: TouchBuffersType` und den Import auf
`import type {BufferLike, TouchBuffersType, VertexAttributeUsageType} from './types.js';`
ziehen. `VertexAttributeUsageType` bleibt im Import — die beiden Casts im Rumpf
(`:12`, `:13`) brauchen ihn weiter. Reine Typänderung, `TouchBuffersType`
(`types.ts:23`) ist dieselbe Form; kein Test bewegt sich.

**2. Eine Attribut-Initialisierung statt zweier (CONS-010).**

`initializeAttributes.ts` und `initializeInstancedAttributes.ts` unterscheiden sich
in genau drei Dingen: dem Index-Block am Anfang (nur in der nicht-instanzierten
Fassung), dem Konstruktor des Interleaved-Buffers und dem der einzelnen
BufferAttribute. Alles andere ist Zeile für Zeile dasselbe.

Zusammengelegt wird **in `initializeAttributes.ts`**;
`initializeInstancedAttributes.ts` wird gelöscht und die Importzeile
`InstancedVOBufferGeometry.ts:14` entfällt, weil `:13` beide Namen mitbringt.
`VOBufferGeometry.ts:9` bleibt unverändert. Beide Funktionsnamen bleiben bestehen —
`attributeNamesOf.ts:6` verlinkt sie im TSDoc.

Die Gestalt: eine nicht exportierte Implementierung plus zwei exportierte
Einstiege. Die abweichenden Konstruktoren kommen als Bauhelfer herein:

```ts
/**
 * What separates a plain attribute route from an instanced one: the two three.js
 * constructors, and whether the route also carries the index of the geometry.
 */
interface AttributeBuilders {
  interleavedBuffer(array: ThreeTypedArray, itemSize: number): InterleavedBuffer;
  bufferAttribute(array: ThreeTypedArray, itemSize: number, normalized: boolean): BufferAttribute;
  ownsIndex: boolean;
}
```

`ThreeTypedArray` kommt als `import type {TypedArray as ThreeTypedArray} from 'three/webgpu';`
— genau so importiert `asThreeTypedArray.ts:1` ihn. `InstancedInterleavedBuffer`
und `InstancedBufferAttribute` erben von den beiden Rückgabetypen, die Signaturen
tragen also beide Fassungen.

Die Einstiege:

```ts
export function initializeAttributes(
  geometry: BufferGeometry,
  pool: VOBufferPool,
  buffers: AttributeRoute,
  bufferSerials: Map<string, number>,
  slots: GeometryAttributeSlots,
): void {
  initializeRoute(geometry, pool, buffers, bufferSerials, slots, {
    interleavedBuffer: (array, itemSize) => new InterleavedBuffer(array, itemSize),
    bufferAttribute: (array, itemSize, normalized) => new BufferAttribute(array, itemSize, normalized),
    ownsIndex: true,
  });
}

export function initializeInstancedAttributes(
  geometry: BufferGeometry,
  pool: VOBufferPool,
  buffers: AttributeRoute,
  bufferSerials: Map<string, number>,
  slots: GeometryAttributeSlots,
): void {
  // every instanced attribute advances once per mesh of the descriptor
  const meshPerAttribute = pool.descriptor.meshCount;
  initializeRoute(geometry, pool, buffers, bufferSerials, slots, {
    interleavedBuffer: (array, itemSize) => new InstancedInterleavedBuffer(array, itemSize, meshPerAttribute),
    bufferAttribute: (array, itemSize, normalized) =>
      new InstancedBufferAttribute(array, itemSize, normalized, meshPerAttribute),
    // the index of an instanced geometry comes from its base route, never from this one
    ownsIndex: false,
  });
}
```

`initializeRoute` ist der heutige Rumpf von `initializeAttributes` mit drei
Ersetzungen: der Index-Block steht unter `if (builders.ownsIndex && descriptor.hasIndices)`,
`new InterleavedBuffer(...)` wird `builders.interleavedBuffer(...)`, und
`new BufferAttribute(...)` im `else`-Zweig wird `builders.bufferAttribute(...)`.
Das `const {descriptor, capacity} = pool;` bleibt; `capacity` wird nur im
Index-Block gebraucht.

Kein Verhalten ändert sich. Deckung liegt bereits in
`vertex-buffers-geometry-updates.spec.ts` und `InstancedVertexObjectGeometry.spec.ts`;
kein neuer Test.

**3. `touch()` verliert keine flachen Keys mehr (BUG-038).**

Regressionstest zuerst, neben
`InstancedVertexObjectGeometry.spec.ts:265` (`touch() calls touchAttributes() and/or
touchBuffers()`), im selben Muster: `touchAttributes` und `touchBuffers` spionieren
und die Argumente prüfen. Der Test gibt beide Formen in einem Aufruf:

```ts
geometry.touch({static: true}, {instanced: {dynamic: true}});
```

Erwartet werden **zwei** `touchBuffers()`-Aufrufe, einer mit `{static: true}` und
einer mit der `instanced`-Form. Vor dem Fix kommt genau einer, und `{static: true}`
ist darin verschwunden: der Spread faltet beide zu
`{static: true, instanced: {dynamic: true}}`, und `touchBuffers()` nimmt wegen
`'instanced' in bufferTypes` den ersten Zweig, der `static` nie ansieht.

Der Fix in `touch()` (`InstancedVOBufferGeometry.ts:490-506`) sammelt getrennt:

```ts
touch(...args: Array<string | TouchBuffersType | TouchInstancedBuffersType>): void {
  const attrNames: string[] = [];
  let flat: TouchBuffersType | undefined;
  let routed: TouchInstancedBuffersType | undefined;

  for (const arg of args) {
    if (typeof arg === 'string') {
      attrNames.push(arg);
    } else if ('base' in arg || 'instanced' in arg) {
      // merged per route, not across them: a second {base: …} would otherwise replace the
      // first one whole instead of adding to it
      routed = {base: {...routed?.base, ...arg.base}, instanced: {...routed?.instanced, ...arg.instanced}};
    } else {
      flat = {...flat, ...arg};
    }
  }

  if (attrNames.length) {
    this.touchAttributes(...attrNames);
  }
  if (flat) {
    this.touchBuffers(flat);
  }
  if (routed) {
    this.touchBuffers(routed);
  }
}
```

`touchBuffers()` bleibt unverändert: `routed` trägt nach dem Zusammenlegen immer
beide Schlüssel, `'base' in bufferTypes` greift also, und ein leeres
`{}` unter `base` oder `instanced` läuft durch `selectBuffers()` als Schleife über
keinen Schlüssel — ein No-op.

`VOBufferGeometry#touch()` (`VOBufferGeometry.ts:123-137`) bleibt, wie es ist: es
kennt nur die flache Form, mischen kann dort niemand.

Zwei Dinge sind an dieser Fassung nachgemessen, damit sie niemanden überrascht.
Erstens trägt sie ohne Casts durch: `'base' in arg` verengt die Union unter der
Konfiguration dieses Repos von allein, `tsc` läuft ohne einen einzigen. Zweitens
reicht der `routed`-Zweig künftig immer beide Schlüssel weiter, also auch ein leeres
`{base: {}}` für einen Aufruf, der nur `instanced` genannt hat. Die vorhandene
Zusicherung `InstancedVertexObjectGeometry.spec.ts:277-280` prüft mit
`toMatchObject`, nimmt den zusätzlichen Schlüssel also hin und bleibt grün.

**4. `capacity` wird ein Getter (API-045).**

In `VOBufferPool.ts` tritt an die Stelle des Feldes (`:16`):

```ts
#capacity: number;

/** How many vertex objects this pool was sized for; it goes on saying so once {@link dispose} has run. */
get capacity(): number {
  return this.#capacity;
}

/**
 * Writes the capacity this pool reports. Only {@link VertexObjectPool#resize} has any business
 * here, and only after it has built the buffers for the new size — everything that reads
 * `capacity` reads it as the size of the buffers behind it.
 *
 * @internal
 */
protected setCapacity(capacity: number): void {
  this.#capacity = capacity;
}
```

Die beiden Konstruktor-Zuweisungen (`:47`, `:51`) schreiben `this.#capacity`
direkt. In `VertexObjectPool#resize()` (`:108-114`) ersetzt
`this.setCapacity(capacity);` den `Object.defineProperty`-Block samt seinem
Kommentar; die Stelle im Ablauf bleibt dieselbe — nach dem Umhängen von
`#voIndex`, vor dem `usedCount`-Nachziehen.

Kein Verhalten ändert sich: `capacity` liest sich weiter gleich, und die zehn
`resize()`-Tests in `VertexObjectPool.spec.ts:327-505` bleiben grün. Was wegfällt,
ist die konfigurierbare Property, über die ein Fremder von außen dasselbe tun
konnte. Kein neuer Test — `Object.getOwnPropertyDescriptor` festzunageln hieße, die
Umsetzung zu testen statt das Verhalten.

**5. Der `voPrototype` verlässt die aufzählbare Fläche (DOC-016).**

Das Audit bietet zwei Wege an. Beide fallen aus, und der dritte ist besser:

- Die Getter auf einen fehlenden Buffer prüfen — das kehrt eine ausdrückliche
  Entscheidung um. Über allen vier Accessoren in `createVertexObjectPrototype.ts`
  (`:8-10`, `:19-21`, `:36-38`, `:64-66`) steht wörtlich, dass sie pro Sprite und
  pro Frame laufen und deshalb behaupten statt zu prüfen. Diese Zeilen sind der
  heißeste Pfad der Bibliothek.
- Ein `toJSON` auf dem Prototyp wirkt, aber jedes Vertex-Objekt erbt es:
  `JSON.stringify(vo)` antwortet heute `{}` und danach mit der Marke des
  Prototyps. Gemessen an `@vitest/pretty-format@4.0.18`; ein
  `Symbol.for('nodejs.util.inspect.custom')` und ein `Symbol.toStringTag` wirken
  dort überhaupt nicht.

Der Weg ist stattdessen, den Printer gar nicht erst zum Prototyp zu lassen. Er
erreicht ihn ausschließlich über das öffentliche Feld
`VertexObjectDescriptor#voPrototype` (`:13-14`) — `VertexObjectBuffer` und
`VOBufferPool` tragen den Deskriptor, sonst nichts. Ein Accessor liegt auf dem
Prototyp der Klasse und nicht auf der Instanz, und `pretty-format` zählt nur eigene
aufzählbare Schlüssel auf. Gemessen: mit Feld wirft er, mit Accessor druckt er
`VertexObjectDescriptor { "vertexCount": 1, … }`.

In `VertexObjectDescriptor.ts` ersetzt also

```ts
#voPrototype?: object;

/**
 * The prototype every vertex object of this descriptor is created from. The first
 * {@link VertexObjectBuffer} built on this descriptor builds it and assigns it here; before
 * that there is none, and the declared type says otherwise because every caller reaches this
 * through a buffer that has already built it.
 *
 * It is read through an accessor rather than held in a field so that it stays off the
 * enumerable surface of the descriptor. The attribute accessors on that prototype read
 * through a buffer the prototype itself does not have, so anything that walks a descriptor
 * property by property — a test runner rendering a failed assertion, for one — would die on
 * the first of them instead of showing what it set out to show.
 */
get voPrototype(): object {
  return this.#voPrototype!;
}

set voPrototype(prototype: object) {
  this.#voPrototype = prototype;
}
```

das Feld samt seiner beiden Kommentarzeilen. Der deklarierte Typ bleibt `object`
und nicht `object | undefined`: `createVertexObject.ts:6` und
`VertexObjectBuffer.ts:171-172` rechnen mit dem heutigen Vertrag, und das `!` sagt
dasselbe wie das heutige `voPrototype!: object`.

Regressionstest in `VertexObjectDescriptor.spec.ts`, zwei Zusicherungen:

1. Der Vertrag, deterministisch rot: ein Deskriptor, dessen Prototyp gebaut ist
   (`new VertexObjectBuffer(descriptor, 1)`), führt `voPrototype` nicht in
   `Object.keys(descriptor)`.
2. Wozu das gut ist: eine fehlschlagende Assertion über denselben Deskriptor
   meldet die Assertion. Den Fehler von `expect(descriptor).toEqual({someKeyItCannotHave: true})`
   fangen und prüfen, dass seine Meldung `someKeyItCannotHave` nennt — vor dem Fix
   steht dort `Cannot read properties of undefined (reading 'buffers')`. Baut
   Vitest die Meldung nicht beim Werfen, sondern später, geht dieser zweite Test
   nicht rot; dann fällt er weg und der erste trägt allein. Er ist der Grund für
   den Umbau, nicht sein Beleg.

`VertexObjectBuffer.spec.ts:287` (`toBeUndefined()` vor dem ersten Buffer) und
`:293`/`:301` laufen unverändert weiter.

**6. `Dependencies` beobachtet, was es speichert — und sagt, was darin liegt
(BUG-064, TYPE-002, TYPE-004).**

Drei Findings, eine Datei, ein Umbau.

**6a. Regressionstest zuerst** in `Dependencies.spec.ts`: ein `Dependencies`, das
`centerX` und `centerY` deklariert, bekommt ein `update({centerX: 1, centerY: 2, cnterX: 99})`.
Danach ist `deps.value('cnterX')` `undefined`, während `centerX` und `centerY`
stehen. Vor dem Fix antwortet `value('cnterX')` mit `99` — ein Wert, den
`equals()` nie ansieht und `changed()` nie meldet.

**6b. BUG-064.** Der Zustand nimmt nur deklarierte Schlüssel an. Die Prüfung darf
**nicht** über `#callbacks` laufen: dort steht nur, was mit Callbacks deklariert
wurde, ein blanker String wie `'centerX'` fehlt darin, und ein `continue` auf
dieser Karte würde jede callback-lose Abhängigkeit aus dem Zustand werfen. Statt
eine dritte Sammlung anzulegen, wird `#callbacks` vollständig gemacht: es heißt
`#declared` und trägt **jeden** deklarierten Schlüssel, mit seinen Callbacks oder
mit `undefined`.

Im Konstruktor bekommt also auch der `else`-Zweig (der blanke String) ein
`this.#declared.set(p, undefined)`. In `update()` steht vor der Callback-Abfrage:

```ts
// a key nobody declared is never compared in equals(), so keeping it would only make the
// state look like it watches something it does not — a caller's typo stays invisible
// exactly as long as the value sits there looking right
if (!this.#declared.has(name)) continue;
```

Der Rest von `update()` bleibt, mit `this.#declared.get(name)` statt
`this.#callbacks.get(name)`. `equals()` läuft weiter über `#props` und rührt sich
nicht.

Nachgemessen an einem Nachbau der Klasse: alle 26 Zusicherungen der heutigen
`Dependencies.spec.ts` bleiben mit dieser Fassung grün, dazu die drei neuen aus 6a.

**6c. TYPE-002.** Die Klasse bekommt einen Shape-Parameter:

```ts
/** The keys a `Dependencies` watches, and the type of the value behind each of them. */
export type DependencyShape = Record<DependencyKey, unknown>;

/**
 * What `update()`, `equals()` and `changed()` take: every declared key is optional, and each
 * may carry `null` beside its own type. An absent value is a state of its own here, not a
 * missing argument — `equals()` answers `true` for two absent values and `false` when only
 * one of them is.
 */
export type DependencyValues<Shape extends DependencyShape> = {[K in keyof Shape]?: Shape[K] | null};

export class Dependencies<Shape extends DependencyShape = DependencyShape> {
```

Damit:

- `#state` wird `new Map<DependencyKey, unknown>()`.
- `update`, `equals` und `changed` nehmen `nextProps: DependencyValues<Shape>`.
  In `equals()` liest der Zugriff auf den Namen als
  `(nextProps as Record<DependencyKey, unknown>)[name]`, weil `name` aus `#props`
  kommt und ein `string` ist.
- `value` wird `value<K extends keyof Shape>(key: K): Shape[K] | undefined` und
  gibt `this.#state.get(key as DependencyKey) as Shape[K] | undefined` zurück.
  Das `| undefined` ist der Unterschied zur Empfehlung des Audits und die
  Wahrheit: ein Schlüssel, für den nie ein `update()` lief, hat keinen Wert.
- Die Callbacks in `#declared` und `#props` werden intern als
  `DependencyCallbacks<any>` geführt.

Und hier weicht das Paket von der Empfehlung ab, **im deklarierenden Teil**:
`EqualityCallback`, `DependencyCallbacks` und `DependencyProp` behalten ihr
`T = any`. Nachgemessen mit `tsc` unter der Konfiguration dieses Repos: sobald der
Vorgabewert `unknown` oder `never` lautet, ist
`Dependencies.cloneable<Matrix4>('matrixWorld')` nicht mehr an den
Konstruktor zuweisbar — `CloneCallback<Matrix4>` gegen `CloneCallback<unknown>`
scheitert unter `strictFunctionTypes` an der Kontravarianz, und zwar in allen drei
`map2d`-Konsumenten. Die Prop-Liste ist ihrem Wesen nach heterogen: jeder Eintrag
trägt seinen eigenen Werttyp, und TypeScript hat keine Existenzquantoren, um das
in einem Array-Elementtyp zu halten. Was das Finding dem Leser verspricht — »was
liegt eigentlich in der Map« — steht danach vollständig auf der Zustandsseite, und
genau die war blind.

**6d. Die drei Konsumenten** benennen ihren Shape lokal, direkt über der
Deklaration:

- `RectangularVisibilityArea.ts:23` — `{centerX: number; centerY: number; map2dTileCoords: Map2DTileCoordsUtil; matrixWorld: Matrix4}`.
  Damit fällt in `:75` der Cast weg: `const storedTileCoords = this.#deps.value('map2dTileCoords');`
  hat bereits den Typ `Map2DTileCoordsUtil | undefined`, den die Zeile heute von
  Hand behauptet. Der Kommentar darüber bleibt.
- `CameraBasedVisibility.ts:154` — `depth: number`, `frustumBoxScale: number`,
  `lookAtCenter: boolean`, `centerPoint2D: Vector2`, `map2dTileCoords: Map2DTileCoordsUtil`,
  `matrixWorld: Matrix4`, `cameraMatrixWorld: Matrix4`, `cameraProjectionMatrix: Matrix4`.
  Die Typen stehen an den Feldern, aus denen `dependenciesChanged()` (`:237-247`)
  sie liest.
- `CameraBasedVisibilityHelpers.ts:73` — `maxDebugHelpers: number`,
  `tileBoxHelperExpand: number`, `frustumBoxHelperExpand: number` und die vier
  `Color`-Regler. Quelle ist `update()` (`:292-300`).

Alle drei geben heute genau die deklarierten Schlüssel weiter; 6b ändert für sie
nichts. Der Shape ist eine lokale `type`-Deklaration in der jeweiligen Datei, kein
neuer Export.

**6e. TYPE-004.** TSDoc an `equals()`, das die Grenzfälle nennt, statt sie zum
Nachlesen zu lassen — die Vergleichskette steht in `:84-98`:

- Beide Seiten leer: gleich. Der Vergleich ist `==`, also gilt `null` und
  `undefined` als derselbe Zustand.
- Eine Seite leer, die andere nicht: verschieden, und der `equals`-Callback wird
  nicht gefragt.
- Beide da und identisch: gleich, ohne Callback.
- Beide da und verschieden: der Callback entscheidet. Ohne Callback bleibt es
  verschieden — Identität ist dann alles, was die Abhängigkeit hat.
- Ein Schlüssel, der in `nextProps` fehlt, zählt als leer und wird nach denselben
  Regeln verglichen.

Dazu je ein Satz an `update()` (nimmt nur deklarierte Schlüssel), an `value()`
(`undefined`, solange nichts geschrieben wurde) und an `changed()` (fragt
`equals()` und schreibt nur bei einem Unterschied fort). Auf Englisch, wie der
Rest der Bibliothek.

**7. CHANGELOG.**

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `[Unreleased]`. Dafür den Skill
`updating-changelog` laden — er trägt das Format dieses Repos. Es gehören hinein:

- unter **Changed**: `Dependencies` ist generisch über den Shape, den es
  beobachtet, und `value()` antwortet in dessen Typ statt in `any`; ein Schlüssel,
  den niemand deklariert hat, wird nicht mehr in den Zustand geschrieben.
- unter **Changed**: `InstancedVOBufferGeometry#touch()` wendet beide
  Argumentformen an, wenn sie in einem Aufruf gemischt werden.
- unter **Changed**: `VOBufferPool#capacity` ist ein Getter über ein privates
  Feld, und `VertexObjectDescriptor#voPrototype` ein Accessor — beides steht nicht
  mehr als eigene Property auf der Instanz.

Der `BREAKING CHANGE:`-Footer der Commit-Message nennt den Typwechsel an
`Dependencies#value()`: Aufrufer außerhalb der Bibliothek bekommen dort statt
`any` den Typ aus dem Shape, und ohne Typargument ist das `unknown`. Das deckt die
Entscheidung vom 2026-09-07 (»Öffentliche API voll durchziehen«), bei `0.x` also
ein Minor-Bump.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
- Commit: `fix(twopoint5d): store only the keys a dependency set declares and honour both forms of a mixed touch`
- Ergebnis: 3 Runden · BUG-038, BUG-064, API-045, TYPE-002, TYPE-004, DOC-016,
  CONS-010 und CONS-011 behoben, CONS-008 entfallen (siehe unten) ·
  Regressionstests `touch() applies both argument forms when they are mixed in
  one call`, `is not an enumerable property of the descriptor` und `a key nobody
  declared does not reach the state` (alle drei vor ihrem Fix rot gesehen),
  dazu `a declaration that spells out its key is held against the shape` mit
  drei `@ts-expect-error`-Zusicherungen, von denen zwei vor der Änderung als
  `TS2578` rot standen · Verify `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0
  (`paket-6.verify.log`) · die Kette hing nicht an den Findings, sondern an der
  Typnaht zwischen Shape und Deklarationsliste und an ihrer Beschreibung: der
  Reviewer-Vorschlag aus Runde 1 trug wörtlich nicht (`cloneable()` schreibt
  seinen Rückgabetyp fest, bevor er die Liste erreicht), die Fassung aus Runde 2
  schnürt beide Deklarationsformen ohne eine geänderte Aufruferzeile · zwei
  kleine Reste offen: die zweite Zusicherung aus Schritt 5 fiel wie im
  Detailplan vorgesehen weg (Vitest baut die Diff-Meldung nicht beim Werfen), und
  das Konstruktor-TSDoc `Dependencies.ts:78-88` zählt die geprüften
  Deklarationsformen weiter auf, als sie sind — die Ausnahme steht zwei Absätze
  später korrekt daneben, es ist Regel plus Ausnahme und keine Fehlaussage
- Nebenbefunde: → Queue (3 Einträge, alle in `vertex-objects/`)
- Folgen: `packages/twopoint5d/src/utils/Dependencies.ts:13` — `DependencyProp`
  ist durch diesen Umbau verwaist: kein Aufrufer in der Bibliothek, und er
  beschreibt nicht mehr, was der Konstruktor nimmt. Sein TSDoc sagt das jetzt
  und verweist auf `DependencyDeclaration`; ob der Typ gestrichen oder als
  veraltet markiert wird, ist eine Entscheidung an der öffentlichen API und
  gehört in den Abschluss dieses Laufs. Schritt 6c hat ihn ausdrücklich behalten,
  damals noch als Konstruktor-Typ.
  Verteilt in Zug 0 von Paket 7 (2026-09-08): Symptom, nicht eigene Ursache — hätte
  Paket 6 seinen Umbau zu Ende geführt, gäbe es den Eintrag nicht. Paket 6 ist
  committet, also wäre ein Nachtragspaket fällig; es geht stattdessen an das noch
  offene Paket 8, dessen Ziel wörtlich das ist, was hier zu tun bleibt. Ob
  gestrichen oder als veraltet markiert, ist damit entschieden: die Entscheidung
  »Öffentliche API voll durchziehen« vom 2026-09-07 sagt umsetzen statt
  deprecaten, und das Release ist ohnehin ein Minor-Bump.
- Schnittstellen:
  - `Dependencies<Shape>` ist generisch über den beobachteten Shape. `value()`
    antwortet als `Shape[K] | undefined` statt `any`; ohne Typargument ist der
    Shape `Record<string, unknown>` und der Wert damit `unknown`. `update()`,
    `equals()` und `changed()` nehmen `DependencyValues<Shape>`.
  - `update()` verwirft jeden Schlüssel, den keine Deklaration nennt. Wer eine
    `Dependencies` als allgemeinen Key-Value-Speicher benutzt hat, verliert diese
    Werte zur Laufzeit, ohne dass ein Typfehler es ankündigt.
  - Der Konstruktor nimmt `Array<DependencyDeclaration<NoInfer<Shape>>>`. Eine
    Deklaration, deren Callbacks unvollständig sind — ein blanker Name, ein Paar
    mit `equals` oder mit Callbacks ohne `clone`/`copy` —, muss einen Schlüssel
    des Shape nennen. Ein Paar mit allen drei Callbacks wird nicht gegen den
    Shape gehalten; darüber läuft `Dependencies.cloneable()`, dessen Name deshalb
    ungeprüft bleibt.
  - Neu und öffentlich: `DependencyShape` (Constraint `object`, ein benanntes
    `interface` erfüllt ihn), `DependencyValues<Shape>` und
    `DependencyDeclaration<Shape>`. Letzterer ist der Typ für eine
    Deklarationsliste, die nicht inline im Konstruktoraufruf steht —
    `DependencyProp[]` trägt dort mit benanntem Shape nicht mehr.
  - `VOBufferPool#capacity` ist ein Getter über ein privates Feld, daneben
    `protected setCapacity()` mit `@internal`. Die Property steht nicht mehr auf
    der Instanz, und `resize()` schreibt sie ohne `Object.defineProperty`.
  - `VertexObjectDescriptor#voPrototype` ist ein Accessor-Paar statt eines
    Feldes. Der Getter behält den Typ `object`, der Setter bleibt der Weg, den
    `VertexObjectBuffer` geht. Die Property ist damit nicht mehr aufzählbar.
  - `initializeInstancedAttributes()` lebt jetzt in
    `vertex-objects/initializeAttributes.ts`; die eigene Datei ist weg. Beide
    Funktionsnamen und beide Signaturen bleiben.
  - `InstancedVOBufferGeometry#touch()` wendet die flache und die geroutete
    Argumentform beide an, wenn sie in einem Aufruf gemischt werden, statt sie
    zu einem Objekt zu falten.
- Beim Abschluss nachzuziehen: CONS-008 ist gegenstandslos, ohne dass dieses Paket
  eine Zeile dafür ändert — alle vier Zugriffe liefen schon bei `a9f7dd1` über
  `expectDefined()`. Das Finding stand von Anfang an falsch in der `audit.html`,
  und sein Status gehört dorthin zurück.

#### Die Findings im Wortlaut

**BUG-038 · low · `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:426-434`** — touch() verliert flache Usage-Keys, wenn beide Argumentformen gemischt werden
`touch()` verschmilzt alle Objekt-Argumente per Spread in eines. Werden ein `TouchBuffersType` und ein `TouchInstancedBuffersType` gemischt übergeben, enthält das Ergebnis `base`/`instanced`, `touchBuffers()` nimmt den ersten Zweig, und die flachen Keys fallen still unter den Tisch.
Empfehlung: Die beiden Formen getrennt einsammeln und beide anwenden, statt sie in ein Objekt zu falten.

**BUG-064 · low · `packages/twopoint5d/src/utils/Dependencies.ts:57-74 gegen :76-101`** — Dependencies speichert jeden Schlüssel, beobachtet aber nur die deklarierten
`update()` schreibt jeden Schlüssel aus `nextProps` in den Zustand, `equals()` vergleicht nur die im Konstruktor deklarierten Props. Ein Schlüssel, den niemand deklariert hat — ein Tippfehler im Aufrufer —, wird gespeichert und nie beobachtet. `changed()` meldet für ihn nie etwas, und weil der Wert brav im Zustand landet, sieht auch beim Debuggen alles richtig aus. Die Klasse ist der Dirty-Check hinter beiden Visibilitors; ein stiller blinder Fleck an dieser Stelle kostet Frames, bevor jemand ihn sucht.
Empfehlung: In `update()` nur deklarierte Schlüssel übernehmen und einen unbekannten Schlüssel in der Entwicklung sichtbar machen. `Dependencies` hat keinen Logger; ein `throw` im Konstruktor-Vergleich wäre zu hart, aber `update()` kann den unbekannten Schlüssel schlicht ignorieren — dann fällt beim Debuggen auf, dass der Wert nirgends ankommt.

**API-045 · low · `packages/twopoint5d/src/vertex-objects/VertexObjectPool.ts:107-113`** — resize() überschreibt ein readonly capacity per defineProperty
`resize()` definiert `capacity` per `Object.defineProperty` mit `configurable: true` neu, obwohl die Basisklasse `readonly capacity` deklariert (`VOBufferPool.ts:16`); ein Aufrufer kann dieselbe Property von außen genauso überschreiben. Reine Kapselungsfrage: auf einem entsorgten Pool wirft `resize()` vorher. Aufgefallen im Remediation-Lauf vom 2026-09-06 (Paket 19); der Code wurde seitdem nicht neu auditiert.
Empfehlung: `capacity` als Getter über ein privates Feld führen, das `resize()` regulär schreibt.

**TYPE-002 · low · `packages/twopoint5d/src/utils/Dependencies.ts`** — Dependencies verwendet any auf breiter Front
`EqualityCallback<T = any>`, `Map<DependencyKey, any>`, `value(key): any`. Funktional einwandfrei und in der performance-kritischen Sichtbarkeitsschleife im Einsatz — aber wer den Code liest, bekommt keinen einzigen Hinweis darauf, was eigentlich in der Map liegt.
Empfehlung: Ein Generic über ein Key-Value-Record: `class Dependencies<Shape extends Record<string, unknown>>` mit `value<K extends keyof Shape>(key: K): Shape[K]`. Der Migrationsaufwand ist klein, weil die wenigen Konsumenten ihren Shape ohnehin lokal kennen.

**TYPE-004 · info · `packages/twopoint5d/src/utils/Dependencies.ts`** — Dependencies.equals() hat undokumentierte implizite Semantik
Die Vergleichslogik behandelt Grenzfälle wie `null` gegen `undefined` auf eine bestimmte Art. Welche das ist, erfährt man nur durch Lesen.
Empfehlung: TSDoc mit zwei, drei Beispielzeilen. Kostet zehn Minuten und erspart die nächste Fehlersuche.

**DOC-016 · low · `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:12`** — Der Vitest-Diff-Printer stirbt am voPrototype, statt die Assertion zu zeigen
Die generierten Attribut-Getter greifen ungeprüft auf `this[voBuffer]!.buffers` zu. Der `voPrototype` eines Deskriptors trägt nie einen Buffer, jeder Zugriff darauf wirft also einen `TypeError`. Sobald eine Assertion über einen `VertexObjectBuffer`, einen `VOBufferPool` oder einen `VertexObjectDescriptor` fehlschlägt, stirbt der Diff-Printer von Vitest am Prototyp, statt die Assertion auszugeben — die eigentliche Fehlermeldung ist dann unsichtbar. Aufgefallen im Remediation-Lauf vom 2026-09-06 (Paket 19); der Code wurde seitdem nicht neu auditiert.
Empfehlung: Die Getter auf fehlenden Buffer prüfen und `undefined` liefern, oder dem Prototyp einen eigenen `toJSON`/`Symbol.for('nodejs.util.inspect.custom')` geben.

> Gegenstandslos, kein Schritt — siehe »Was der Abgleich ergeben hat«.

**CONS-008 · low · `packages/twopoint5d/src/vertex-objects/InstancedVOBufferGeometry.ts:521,531`** — Zwei von vier Zugriffen auf extraInstancedBuffers sind ungeguarded
`#checkBufferSerials()` und `#updateBuffersUpdateRange()` reichen das Ergebnis von `extraInstancedBuffers.get(name)` ungeprüft weiter, während `touchAttributes()` und `#getAutoTouchBuffers()` dieselbe Stelle absichern. Auslösbar ist es nicht — `extraInstancedPools` und `extraInstancedBuffers` werden im Gleichschritt gepflegt, und `#detachRoute()` löscht beide. Eine Inkonsistenz in der Absicherung, kein Fehler.
Empfehlung: Auf eine Linie bringen: entweder alle vier Stellen guardieren oder keine, und im zweiten Fall dazuschreiben, warum die Invariante trägt.

**CONS-010 · info · `packages/twopoint5d/src/vertex-objects/initializeAttributes.ts, initializeInstancedAttributes.ts`** — initializeAttributes und initializeInstancedAttributes sind dieselbe Funktion
Bis auf drei Konstruktoraufrufe Zeile für Zeile identisch. Jede Korrektur muss zweimal gemacht werden — zuletzt zwölf Fundstellen doppelt.
Empfehlung: Zusammenführen und die drei abweichenden Konstruktoren als Parameter hereinreichen.

**CONS-011 · info · `packages/twopoint5d/src/vertex-objects/selectBuffers.ts:5-9`** — Eine dritte Kopie des Usage-Map-Typs steht inline
Die Datei schreibt `{[Type in VertexAttributeUsageType]?: boolean}` inline aus, als Parametertyp genau der Funktion, die beide Geometrie-Klassen mit ihrem `TouchBuffersType` aufrufen. Die beiden anderen Vorkommen derselben Form liegen zusammengeführt in `vertex-objects/types.ts:22`.
Empfehlung: `import type {TouchBuffersType} from './types.js'` und die Kopie ablösen.

### [x] 7. stage: Typsicherheit, Cache-Initialisierung, Doku
- Findings: BUG-053 (low), TYPE-006 (low), TYPE-008 (low), TYPE-009 (low),
  TEST-020 (info), CONS-018 (low)
- Ziel: Die `as any` verschwinden zugunsten tragfähiger Typen, der
  renderOrder-Cache wird berechnet statt vorbelegt.
- Bereich: `packages/twopoint5d/src/stage/`
- Hängt ab von: —
- Hash: 73f71d5
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/stage/StageRenderer.ts`,
  `packages/twopoint5d/src/stage/StageRenderer.spec.ts`,
  `packages/twopoint5d/src/stage/Canvas2DStage.ts`,
  `packages/twopoint5d/src/stage/Canvas2DStage.spec.ts`,
  `packages/twopoint5d/src/stage/OrthographicProjection.ts`,
  `packages/twopoint5d/src/stage/ParallaxProjection.ts`,
  `packages/twopoint5d/src/stage/RootRenderPipeline.spec.ts`,
  `packages/twopoint5d/src/stage/README.md`,
  `packages/twopoint5d/CHANGELOG.md`

#### Was der Abgleich ergeben hat

Alle sechs Findings existieren. Keines ist durch die Pakete 1 bis 6 gegenstandslos
geworden — keines davon hat `src/stage/` angefasst. Vier Fundstellen sind
verrutscht; die Zeilennummern unten sind die **aktuellen**:

| Finding | Fundstelle laut Audit | Fundstelle jetzt |
| --- | --- | --- |
| BUG-053 | `StageRenderer.ts:174-184` | unverändert (`:174` das Feld, `:176-184` der Getter, `:633-638` `orderedStages`) |
| TYPE-006 | `Canvas2DStage.ts:139` | `Canvas2DStage.ts:156` |
| TYPE-008 | `Canvas2DStage.ts:102, 153` | `Canvas2DStage.ts:103` und `:156` |
| TYPE-009 | `OrthographicProjection.ts:30-33`, `ParallaxProjection.ts:32-35` | `OrthographicProjection.ts:30`, `ParallaxProjection.ts:32` |
| TEST-020 | `StageRenderer.spec.ts:459, 587` | `StageRenderer.spec.ts:496`, `:624` |
| CONS-018 | `README.md:47` und `:437-439` | `README.md:47` und `:440-442` |

Drei Dinge, die den Zuschnitt der Arbeit ändern:

**TYPE-006 und TYPE-008 zeigen zum Teil auf dieselbe Zeile.** In
`Canvas2DStage.ts` stehen heute genau zwei `as any`: `:103` (`fit` im
Konstruktoraufruf der Projektion) und `:156` (`width`/`height` in
`setCanvasSize()`). TYPE-008 nennt beide, TYPE-006 nennt den zweiten noch einmal
und verlangt für ihn einen Namen. Ein Umbau erledigt alle drei Findings; es gibt
nicht drei Casts.

**Die Empfehlung von TYPE-006 verweist auf ein Vorbild, das es nicht mehr gibt.**
`asFitIntoRectangleSpecs.ts` ist mit `5c1db02` entfallen, als `fitIntoRectangle()`
auf `Partial<FitIntoRectangleSpecs>` umgestellt wurde. Der Detailplan weicht
deshalb von ihr ab: statt einen benannten Cast anzulegen, verschwindet der Cast.
Der Grund gehört in den Report.

**Was gemessen ist und was daraus folgt.** Zug 0 hat beide Wege im Arbeitsbaum
ausprobiert und ihn danach unverändert zurückgelassen:

- Zieht man nur TYPE-009 durch — beide Konstruktorparameter auf
  `Partial<…Specs>` —, fällt der Cast auf `:103` ersatzlos weg. `tsc` läuft grün
  durch.
- Der Cast auf `:156` fällt damit **nicht**. `Partial<>` verteilt sich über die
  Union `FitIntoRectangleSpecs`, und deren `pixelZoom`-Arm kennt weder `width`
  noch `height`; ein Schreibzugriff darauf ist `TS2339`, wörtlich:
  `Property 'width' does not exist on type 'Partial<OrthographicProjectionSpecs>'`.
- Er fällt, sobald die Stage ihr Spec-Objekt selbst führt und es der Projektion
  beim Bau übergibt (Schritt 3). Gemessen: `tsc -p tsconfig.typecheck.json`
  exit=0, `vitest run src/stage` 9 Dateien / 139 Tests grün, kein `as any` mehr
  in `Canvas2DStage.ts`.

**Ein Nebenbefund wandert in dieses Paket.** `RootRenderPipeline.spec.ts:70`
trägt ein drittes `toThrowError()`, dieselbe deprecated Vitest-API wie TEST-020,
in derselben Modulmappe und damit im Bereich dieses Pakets. Zwei von drei
Vorkommen zu ersetzen und das dritte stehen zu lassen, stellt genau die
Inkonsistenz her, gegen die das Finding geschrieben ist. Er geht deshalb nicht in
die Queue, sondern als Schritt 5 in dieses Paket.

#### Vorgehen

Die Schritte sind unabhängig voneinander und stehen in dieser Reihenfolge, weil
Schritt 1 der einzige Korrektheitsfehler ist und zuerst seinen roten Test
braucht.

**1. Der renderOrder-Cache startet leer (BUG-053).**

Erst der Regressionstest in `StageRenderer.spec.ts`, rot gesehen, dann der Fix.
Der Test kommt zu den übrigen `renderOrder`-Tests der Datei:

```ts
it('answers the render order as an array on the first read', () => {
  const sr = new StageRenderer();
  expect(sr.renderOrderArray).toEqual(['*']);
});
```

Vor dem Fix antwortet der Getter `[]`. Der Fix ist `StageRenderer.ts:174`:

```ts
#renderOrderArray?: string[];
```

Das `= []` fällt weg, sonst nichts. `orderedStages` (`:633-638`) behandelt
`length === 0` und `['*']` bereits gleich, das Rendering ändert sich also nicht —
nur der öffentliche Getter antwortet vor und nach einem Setter-Aufruf endlich
dasselbe.

**2. Beide Projektions-Konstruktoren nehmen ein Teil-Spec (TYPE-009).**

`OrthographicProjection.ts:30` und `ParallaxProjection.ts:32`, je der zweite
Parameter:

```ts
constructor(projectionPlane?: ProjectionPlane | ProjectionPlaneDescription, specs?: Partial<OrthographicProjectionSpecs>)
```

und entsprechend `Partial<ParallaxProjectionSpecs>`. Die Rümpfe bleiben, wie sie
sind — `this.viewSpecs = specs ?? {}` weist bereits in genau diesen Typ.

**3. `Canvas2DStage` führt sein View-Spec selbst (TYPE-006, TYPE-008).**

Die Stage treibt immer denselben Spec-Arm: ein `contain`/`cover`-Fit mit beiden
Seiten. Das wird ein benannter Typ, und das Objekt gehört der Stage; die
Projektion bekommt es beim Bau und liest fortan dieselbe Referenz. Damit
verschwinden beide Casts, ohne dass ein Wert seinen Weg ändert.

Direkt unter `Canvas2DStageFitType` (`:9`):

```ts
/**
 * The view specs a `Canvas2DStage` drives: a `contain`/`cover` fit with both sides given.
 * That is one arm of the `FitIntoRectangleSpecs` union, and writing `width` and `height`
 * through the union itself is not possible — its `pixelZoom` arm carries neither. The stage
 * holds the object it hands to its projection, so both read the same specs.
 */
type Canvas2DViewSpecs = {fit: Canvas2DStageFitType; width: number; height: number};
```

Ein privates Feld dazu, bei `#lastWidth`/`#lastHeight` (`:68-69`):

```ts
#viewSpecs: Canvas2DViewSpecs;
```

Kein `!` — der Konstruktor weist es unbedingt zu, `tsc` ist damit zufrieden
(gemessen). Im Konstruktor tritt an die Stelle von `:100-104`:

```ts
this.#viewSpecs = {width: this.width, height: this.height, fit: this.#fit};

this.projection = new OrthographicProjection('xy|bottom-left', this.#viewSpecs);
```

Der `fit`-Setter (`:27`) schreibt auf dasselbe Feld:

```ts
this.#viewSpecs.fit = value;
```

und `setCanvasSize()` (`:156-158`) ebenso:

```ts
this.#viewSpecs.width = width;
this.#viewSpecs.height = height;
```

Danach steht in `Canvas2DStage.ts` kein `as any` mehr. Der Typ bleibt
unexportiert: er beschreibt ein privates Feld und steht in keiner öffentlichen
Signatur.

**4. Ein Test, der die Verbindung festnagelt.**

Schritt 3 legt fest, dass die Stage ihr Spec-Objekt hält, statt es bei jedem
Schreibzugriff über `projection.viewSpecs` zu suchen. Das ist heute dasselbe
Objekt, und kein Aufrufer im Repo ersetzt `viewSpecs` von außen — aber die
Zusage will geprüft sein. In `Canvas2DStage.spec.ts`:

```ts
test('carries a canvas resize into the specs its projection reads', () => {
  const stage = makeStage();

  stage.setCanvasSize(128, 96);

  expect(stage.projection.viewSpecs).toMatchObject({fit: 'contain', width: 128, height: 96});
});
```

Dieser Test ist **kein** Regressionstest: er steht vor dem Umbau genauso grün wie
danach, und das gehört so in den Report. Er sichert die Verbindung, die Schritt 3
neu knüpft.

**5. Die deprecated Vitest-Zusicherung (TEST-020, dazu die dritte Fundstelle).**

`toThrowError(` durch `toThrow(` ersetzen, an drei Stellen:
`StageRenderer.spec.ts:496`, `StageRenderer.spec.ts:624` und
`RootRenderPipeline.spec.ts:70`. Argumente und Matcher bleiben unverändert;
danach kennt `packages/twopoint5d/src/` kein `toThrowError` mehr.

**6. Eine Zusage, eine Stelle (CONS-018).**

`src/stage/README.md` beschreibt zweimal, was `Canvas2DStage.dispose()` freigibt.
Die Tabellenzeile (`:47`) wird auf die Rolle der Klasse gekürzt und verweist auf
den Lebenszyklus-Abschnitt — so, wie es die Zeilen von `Display` und
`StageRenderer` daneben schon halten, die über `dispose()` nichts sagen:

```markdown
| `Canvas2DStage` | Wraps an `HTMLCanvasElement` 2D-context drawing as a textured sprite inside a `Stage2D`. What its `dispose()` releases is in [Resource lifecycle](#resource-lifecycle). |
```

Ein Halbsatz der Tabelle steht bisher **nur** dort und darf nicht mit ihr
verschwinden: dass auch eine von außen auf `texture` gelegte Textur freigegeben
wird. Er wandert in den Lebenszyklus-Eintrag (`:440-442`), der ihn nicht hat:

```markdown
- `Canvas2DStage.dispose()` releases the sprite material, both textures that ever sat behind it —
  a texture assigned to `texture` from outside as much as one the stage built — and its
  `StageRenderer`, and leaves the `WebGPURenderer` and a canvas handed to the constructor alone.
  The sprite geometry is shared by every `THREE.Sprite` of the module and stays.
```

Das TSDoc an `dispose()` (`Canvas2DStage.ts:191-207`) sagt dasselbe ein drittes
Mal, bleibt aber: es ist die API-Dokumentation der Methode und wird an der
Aufrufstelle gelesen, nicht in der README. Angefasst wird es nicht.

**7. CHANGELOG.**

Der `updating-changelog`-Skill gilt. Zwei Punkte gehören unter `### Changed` im
`[Unreleased]`-Block von `packages/twopoint5d/CHANGELOG.md`:

- `StageRenderer#renderOrderArray` antwortet vom ersten Zugriff an mit dem
  zerlegten `renderOrder` — ohne vorangegangenen Setter-Aufruf also `['*']`. Die
  Reihenfolge, in der gerendert wird, ändert sich dadurch nicht.
- Der `specs`-Parameter von `OrthographicProjection` und `ParallaxProjection`
  nimmt ein Teil-Spec. Der Unreleased-Block trägt bereits einen Eintrag über
  `viewSpecs` als `Partial<…>` und die optionalen Konstruktorargumente beider
  Klassen — der Konstruktorparameter gehört dort hinein, nicht in einen zweiten
  Eintrag daneben.

Kein `BREAKING CHANGE:`-Footer: `Partial<T>` nimmt jeden Aufruf entgegen, den der
engere Typ entgegennahm, und `renderOrderArray` liefert einen berichtigten Wert,
keinen anders benannten. Die Änderungen an den Spec-Dateien und der README
erscheinen nicht im CHANGELOG.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
- Commit: `fix(stage): compute the render order cache on first read and type the view specs without a cast`
- Ergebnis: 1 Runde · alle sechs Findings behoben, vom Reviewer je mit
  Fundstelle bestätigt, kein Qualitätsbefund · Regressionstest
  `answers the render order as an array on the first read` (vor dem Fix rot:
  `expected [] to deeply equal [ '*' ]`) · dazu der nicht-regressive Test
  `carries a canvas resize into the specs its projection reads`, der die von
  Schritt 3 neu geknüpfte Verbindung zwischen Stage und Projektion festnagelt
  und vor wie nach dem Umbau grün steht · Verify `NX_SKIP_NX_CACHE=true pnpm run ci`
  exit=0 · abgewichen bei TYPE-006: der Cast bekommt keinen Namen, sondern
  verschwindet — das Vorbild `asFitIntoRectangleSpecs.ts` gibt es seit `5c1db02`
  nicht mehr, und die Stage führt ihr Spec-Objekt jetzt selbst
- Nebenbefunde: → Queue (1 Eintrag: `ParallaxProjection.ts:77`)
- Folgen: keine. Der Umbau bleibt in `src/stage/`; kein Aufrufer außerhalb hält
  eine alte Signatur oder ein altes Verhalten.
- Schnittstellen:
  - Der zweite Konstruktorparameter von `OrthographicProjection` und
    `ParallaxProjection` heißt `specs?: Partial<…ProjectionSpecs>`. Rein
    weitend — jeder Aufruf, den der engere Typ annahm, wird weiter angenommen;
    ein Teil-Spec braucht keinen Cast mehr.
  - `StageRenderer#renderOrderArray` antwortet vom ersten Zugriff an mit dem
    zerlegten `renderOrder`, ohne vorangegangenen Setter-Aufruf also `['*']`
    statt `[]`. Die Reihenfolge, in der gerendert wird, ändert sich nicht.

#### Die Findings im Wortlaut

**BUG-053 · low · `packages/twopoint5d/src/stage/StageRenderer.ts:174-184`** — Der renderOrderArray-Cache startet gefüllt und wird nie berechnet
`#renderOrderArray?: string[] = []` initialisiert den Cache mit einem leeren Array. Der Getter prüft `if (!this.#renderOrderArray)` — ein leeres Array ist truthy, der Zweig läuft nie, und `renderOrderArray` antwortet `[]` statt `['*']`, bis jemand den `renderOrder`-Setter aufruft (nur der setzt auf `undefined`). Die Split-Logik in den Zeilen 178-182 ist beim Erstzugriff toter Code. Ohne Rendering-Folge: `orderedStages` behandelt `length === 0` in Zeile 637 genau wie `['*']`. Was bleibt, ist ein öffentlicher Getter, der vor und nach einem Setter-Aufruf mit demselben Wert zwei verschiedene Antworten gibt.
Empfehlung: Die Initialisierung auf `#renderOrderArray?: string[]` ohne `= []` ändern. Dann greift der Cache-Zweig, und der Getter liefert vom ersten Zugriff an `['*']`.

**TYPE-006 · low · `packages/twopoint5d/src/stage/Canvas2DStage.ts:139`** — Canvas2DStage trägt einen unbenannten as any
`const viewSpecs = this.projection.viewSpecs as any;` — ein Cast ohne Namen und ohne Begründung. Er steht dort, weil `setCanvasSize()` `width` und `height` in ein Spec schreibt, dessen Union-Mitglied gerade ein anderes ist. Die übrigen Casts dieser Art im Repository tragen inzwischen einen Namen, der die Grenze ausspricht; dieser ist übrig geblieben.
Empfehlung: Einen benannten Helfer in der Machart von `asFitIntoRectangleSpecs.ts` anlegen, dessen TSDoc sagt, warum der Cast hält.

**TYPE-008 · low · `packages/twopoint5d/src/stage/Canvas2DStage.ts:102, 153`** — Zwei as any an OrthographicProjection#viewSpecs vorbei
Zwei `as any` führen an `OrthographicProjection#viewSpecs` vorbei (`fit` beim Bau, `width`/`height` in `setCanvasSize()`); seit `viewSpecs` als `Partial<OrthographicProjectionSpecs>` typisiert ist, braucht es sie vermutlich nicht mehr. Aufgefallen im Remediation-Lauf vom 2026-09-06 (Paket 12); der Code wurde seitdem nicht neu auditiert.
Empfehlung: Beide Casts entfernen und den Typecheck laufen lassen.

**TYPE-009 · low · `packages/twopoint5d/src/stage/OrthographicProjection.ts:30-33`, `packages/twopoint5d/src/stage/ParallaxProjection.ts:32-35`** — Beide Projektions-Konstruktoren deklarieren enger, als ihr Feld hält
Der Parameter heißt `specs?: OrthographicProjectionSpecs` bzw. `specs?: ParallaxProjectionSpecs`, während das Feld `viewSpecs`, in das er unverändert landet, als `Partial<…>` deklariert ist (:15 in beiden Dateien). Wer eine Projektion mit einem Teil-Spec baut — `{fit: 'contain', width: 640}`, also genau das, was die Specs der Klasse zeigen —, braucht einen Cast. Dieselbe zu enge Deklaration, die `fitIntoRectangle` hatte, eine Ebene höher.
Empfehlung: Beide Parameter auf `Partial<…Specs>` ziehen. Der Rumpf ändert sich nicht; die Zuweisung ist bereits die richtige.

**TEST-020 · info · `packages/twopoint5d/src/stage/StageRenderer.spec.ts:459, 587`** — Zwei toThrowError(), in Vitest zugunsten von toThrow() deprecated
Zwei `toThrowError()`, in Vitest zugunsten von `toThrow()` deprecated. Aufgefallen im Remediation-Lauf vom 2026-09-06 (Paket 12); der Code wurde seitdem nicht neu auditiert.
Empfehlung: Durch `toThrow()` ersetzen.

**CONS-018 · low · `packages/twopoint5d/src/stage/README.md:47` und `:437-439`** — Canvas2DStage.dispose() ist in derselben Datei zweimal beschrieben
Die Übersichtstabelle (:47) und der Lebenszyklus-Abschnitt (:437-439) beschreiben beide, was `Canvas2DStage.dispose()` freigibt — in verschiedenen Worten, mit verschiedener Genauigkeit. Zwei Fassungen einer Zusage, die gemeinsam gepflegt werden müssen; genau durch diesen Riss ist die Tabellenzeile schon einmal falsch geworden. Beide stehen so seit `5e8d036`.
Empfehlung: Die Tabellenzeile auf einen Halbsatz kürzen und auf den Lebenszyklus-Abschnitt verweisen. Eine Zusage, eine Stelle.

### [x] 8. Toter Code: Lookbook-Reste und auskommentierte Blöcke
- Findings: READ-004 (info), READ-006 (info), READ-007 (info), READ-008 (info),
  PERF-009 (low)
- Ziel: Was keinen Aufrufer hat und sich nicht mehr einkommentieren lässt, ist
  weg; die Demo loggt nicht mehr 512-mal pro Seitenaufruf.
- Bereich: `apps/lookbook/`, `packages/twopoint5d/src/stage/ProjectionPlane.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/`,
  `packages/twopoint5d/src/utils/Dependencies.ts`,
  `packages/twopoint5d/CHANGELOG.md`
- Hängt ab von: — (steht als breitflächige Löschung bewusst am Ende, damit
  kein vorheriger Diff durch verschwundene Dateien unlesbar wird)
- Dazu, aus den Folgen von Paket 6 (verteilt in Zug 0 von Paket 7, 2026-09-08):
  `packages/twopoint5d/src/utils/Dependencies.ts:13-19` — der exportierte Typ
  `DependencyProp` hat nach dem Umbau von Paket 6 repoweit keinen Aufrufer mehr
  und beschreibt nicht, was der Konstruktor nimmt; sein TSDoc verweist bereits auf
  `DependencyDeclaration`. `src/utils/public-api.ts` exportiert die Datei als
  Ganzes, der Typ steht also in der veröffentlichten Fläche. Er wird gestrichen,
  nicht deprecated — so hat es die Entscheidung vom 2026-09-07 für die öffentliche
  API festgelegt. Zug 0 dieses Pakets prüft vor dem Streichen noch einmal, dass
  kein Aufrufer nachgewachsen ist, und trägt den Wegfall ins CHANGELOG.
- Hash: e456752
- Modell: mittlere Stufe
- Effort: low
- Dateien: `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro`,
  `apps/lookbook/src/components/LookBookApi.ts`,
  `apps/lookbook/src/demos/map2d-cam-visi.ts`,
  `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts`,
  `packages/twopoint5d/src/stage/ProjectionPlane.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.spec.ts`,
  `packages/twopoint5d/src/utils/Dependencies.ts`,
  `packages/twopoint5d/CHANGELOG.md` · gelöscht:
  `apps/lookbook/src/demos/passes/fovealVisionEffect.ts`,
  `apps/lookbook/src/layouts/ReactDemo.astro`,
  `apps/lookbook/src/demos/utils/createFrameLoopComponent.js` und elf Dateien
  unter `apps/lookbook/public/images/demo-preview/`

#### Was der Abgleich ergeben hat

Alle fünf Findings und die Folge aus Paket 6 existieren. Kein Vorgänger-Paket
hat eine der Stellen mit erledigt — die Pakete 1 bis 7 haben `apps/lookbook/`
nicht angefasst, und die beiden Stellen in der Bibliothek liegen neben dem, was
Paket 6 und 7 dort umgebaut haben. Drei Angaben des Audits sind ungenau; die
Fundstellen unten sind die **aktuellen**:

| Finding | Fundstelle laut Audit | Fundstelle jetzt |
| --- | --- | --- |
| PERF-009 | `textured-quads-from-tileset.astro:100` | `:103` |
| READ-004 | `LookBookApi.ts:56` | unverändert (`:10-13` der Typ, `:54` der Modulzustand, `:56-85` die Funktion) |
| READ-006 | `demos/passes/fovealVisionEffect.ts` | unverändert, 54 Zeilen, einziger Inhalt seines Verzeichnisses |
| READ-007 | `ProjectionPlane.ts:84-86` | `:84-87` — die schließende `// }` gehört dazu |
| READ-007 | `quadtree-playground/QuadTreeVisualization.ts:53-55` | `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:53-56` — der Audit-Pfad ist verkürzt notiert, `apps/quadtree-playground/` gibt es nicht |
| READ-007 | `ChunkQuadTreeNode.ts:300-324`, `map2d-cam-visi.ts:43-44,108` | unverändert; bei `map2d-cam-visi.ts` sind es drei Zeilen: `:43-44`, `:106` und `:108` |
| READ-008 | 13 Dateien | unverändert, die elf Bilder unten namentlich |
| Folge aus Paket 6 | `Dependencies.ts:13-19` | unverändert, kein Aufrufer nachgewachsen |

Nachgesehen, was das Audit nicht ausgezählt hat:

- **Die elf Bilder ohne Verwender.** Unter `apps/lookbook/public/images/demo-preview/`
  liegen 25 Dateien, die 17 Demo-JSONs nennen in ihrem `previewImage` 14 davon.
  Die verbleibenden elf stammen alle aus 2023 und Anfang 2024, aus Commits der
  react-three-fiber-Zeit. Zwei heutige Demos haben kein `previewImage`
  (`_stage-nested-pipelines.json`, `_stage-postprocessing.json`), und für keine
  von beiden ist ein Bild aus diesem Bestand ein Kandidat: `two5-post-processing.png`
  ist vom 2023-12-14, die Demo daneben vom 2026-09-04 und zeigt etwas anderes.
  `Card.astro:17` fällt ohne `previewImage` auf `defaultTeaserImage` zurück, es
  bricht also nichts. Ein Vorschaubild für die beiden ist ein Screenshot-Auftrag
  und gehört nicht in ein Löschpaket.
- **Was beim Streichen mit wegfällt.** In `LookBookApi.ts` verliert der Import in
  Zeile 1 mit `LookBookMetadata` seinen letzten Leser; `noUnusedLocals` steht in
  der Root-`tsconfig.json` auf `true`, ein stehengelassener Import bricht den
  typecheck. Sonst fällt nirgends ein Import mit: `Vector2` in `ProjectionPlane.ts`
  und `AABB2` in `QuadTreeVisualization.ts` stehen nur im Kommentar, nicht in den
  Import-Zeilen, und `RectangularVisibilityAreaHelpers` wird in `map2d-cam-visi.ts`
  nirgends importiert.
- **Was bleibt.** `DemoNavBar.astro` verliert mit `ReactDemo.astro` einen von zwei
  Importeuren, `VanillaDemo.astro` hält es. `tileSprites` in `map2d-cam-visi.ts`
  ist eine echte lokale Variable (`:77`, `:84`) und nur in `:106` auskommentiert.
  Von den Typen in `Dependencies.ts` fällt allein `DependencyProp`:
  `DependencyKey`, `EqualityCallback`, `CloneCallback`, `CopyCallback` und
  `DependencyCallbacks` haben in derselben Datei weiter Verwender.
- **`fovealVisionEffect.ts` ist gepflegter toter Code.** Er kam mit `4a48acb`
  als Anschauungsstück für `StageRenderer#buildOutputNode` und wurde am
  2026-09-04 in `5477b26` noch einmal angefasst, damit sein Beispiel compiliert —
  angeschlossen hat ihn nie jemand. Das Audit lässt die Wahl zwischen Streichen
  und einer Demo dazu; der freigegebene Grobplan hat sie getroffen, und eine Demo
  zu bauen ist Funktionsarbeit, die in kein Löschpaket gehört. Wer den Effekt
  zurückholen will, findet ihn in `5477b26` in einem Griff. Diese beiden Hashes
  stehen deshalb hier und nicht im Code.

Kein Regressionstest in diesem Paket: keines der Findings ist ein
Korrektheitsdefekt, und ein gestrichener Typ hat keine Laufzeitspur, gegen die
man testen könnte. Der typecheck über Bibliothek und Lookbook ist hier der
Nachweis, und er läuft im Verify mit.

#### Vorgehen

1. **PERF-009 — das Log aus der Schleife.** In
   `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro` die Zeile 103
   ersatzlos streichen:
   `console.log('texCoords', [texCoords.s, texCoords.t, texCoords.u, texCoords.v]);`
   Nicht vor die Schleife ziehen: jedes Quad zieht seinen eigenen Zufallsframe,
   außerhalb gäbe es nichts zu melden. Die beiden Logs nach dem Aufbau (`:132`,
   `:142`) bleiben, sie sind der Stil der übrigen Demos.
2. **READ-004 — der tote Export samt Typ.** In
   `apps/lookbook/src/components/LookBookApi.ts` streichen: `getMetadataForDemos()`
   (`:56-85`), den Modulzustand `let metadata` (`:54`), das Interface
   `LookBookMetadata` (`:10-13`) und die damit unbenutzte Import-Zeile
   `import type {IDemo, ITag} from '~demos/utils/loadMetadataForDemos';` (`:1`).
   `getShowDemosConfig()`, `saveShowDemosConfig()` und die übrigen Importe bleiben
   unangetastet.
3. **READ-006 — das verwaiste Modul.** Die Datei
   `apps/lookbook/src/demos/passes/fovealVisionEffect.ts` löschen. Sie ist der
   einzige Inhalt von `src/demos/passes/`, das Verzeichnis geht damit mit.
4. **READ-007 — die vier auskommentierten Blöcke.** Jeweils samt der Leerzeile,
   die sie vom Code darüber trennt:
   - `packages/twopoint5d/src/stage/ProjectionPlane.ts:84-87` — der Block
     `// getPlaneCoords(…)` bis `// }`. Die Klasse schließt danach mit `getPoint()`.
   - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:300-324` —
     der Block `// toDebugJson(): object | string {` bis `// }`.
   - `packages/twopoint5d/src/map2d/chunk-quad-tree/ChunkQuadTreeNode.spec.ts:85`
     und `:145` — je die Zeile
     `// console.log('QuadTree', JSON.stringify(node.toDebugJson(), null, 2));`.
     Die beiden `it('subdivide()')`-Blöcke bleiben stehen: ihr `node.subdivide()`
     ist die Vorbedingung der Tests darunter.
   - `apps/lookbook/src/demos/map2d-cam-visi.ts:43-44`
     (`// const rectVisiAreaHelpers = …`, `// rectVisiAreaHelpers.add(map2d);`),
     `:106` (`// tileSprites.update();`) und `:108`
     (`// rectVisiAreaHelpers.update();`).
   - `apps/lookbook/src/demos/quadtree-playground/QuadTreeVisualization.ts:53-56` —
     der Block `// for (const chunk of root.findChunks(…)` bis `// }`.
   Die GLSL-Referenzkommentare in `packages/twopoint5d/src/sprites/node-utils.ts`
   bleiben, wo sie sind: sie stehen als Vorlage neben der TSL-Übersetzung und sind
   kein toter Block. Das Audit nimmt sie ausdrücklich aus.
5. **READ-008 — die dreizehn Reste der react-three-fiber-Zeit.** Löschen:
   - `apps/lookbook/src/layouts/ReactDemo.astro`
   - `apps/lookbook/src/demos/utils/createFrameLoopComponent.js`
   - unter `apps/lookbook/public/images/demo-preview/` genau diese elf Dateien:
     `clouds.png`, `crosses-r3f.png`, `map2d-camera-based-visibility-r3f.png`,
     `map2d-rect-visi-area.png`, `map2d-tile-sprites-layer-r3f.png`,
     `map2d-tile-sprites-r3f.png`, `parallax-kastani-r3f.png`,
     `splotch-starfield.png`, `textured-sprites-from-tileset-r3f.png`,
     `textured-sprites-r3f.png`, `two5-post-processing.png`.
   Die 14 übrigen Bilder des Verzeichnisses bleiben — sie stehen in den
   `previewImage`-Feldern der Demo-JSONs.
6. **Die Folge aus Paket 6 — `DependencyProp` streichen.** In
   `packages/twopoint5d/src/utils/Dependencies.ts` den TSDoc-Block `:13-17` und
   die Typdeklaration `:18-19` entfernen. Nichts sonst in der Datei anfassen.
7. **CHANGELOG.** In `packages/twopoint5d/CHANGELOG.md` unter `## [Unreleased]`:
   - in `### Removed` eine Zeile im Stil der Nachbarn:
     ``- remove the `DependencyProp` type: `DependencyDeclaration<Shape>` is the
     type the `Dependencies` constructor takes, and it holds the name of an entry
     against the shape wherever it can read it``
   - in `### Migration Guide` einen Abschnitt nach dem Muster der bestehenden,
     mit `**Before**` und `**After**` und je einem `ts`-Block:

     ````markdown
     #### `DependencyProp` is gone

     **Before**

     ```ts
     const props: DependencyProp[] = ['centerX', ['matrixWorld', equalsMatrix4]];
     ```

     **After**

     ```ts
     const props: DependencyDeclaration<{centerX: number; matrixWorld: Matrix4}>[] = [
       'centerX',
       ['matrixWorld', equalsMatrix4],
     ];
     ```

     `DependencyDeclaration<Shape>` takes the same three forms and holds the name of
     an entry against the shape wherever it can read it.
     ````

   Nichts anderes im CHANGELOG anfassen; die gelöschten Lookbook-Dateien und die
   auskommentierten Blöcke erscheinen dort nicht — das CHANGELOG gehört der
   veröffentlichten Bibliothek, und keine dieser Stellen war je in ihr sichtbar.

Beim Staging: die Löschungen wollen mitgenommen werden. `git add -- <pfad>`
nimmt eine entfernte Datei auf, aber nur, wenn ihr Pfad genannt ist —
`apps/lookbook/public/images/demo-preview/` als Verzeichnis genügt für die elf
Bilder. `git add -A` bleibt verboten, es zöge `remediation-plan.md` mit hinein.

Für den Reviewer: der Diff enthält elf gelöschte Binärdateien, die als
»Binary files differ« erscheinen; Text steht dort nicht zu prüfen. Die
Modellstufe richtet sich nach dem, was an Text übrig bleibt, nicht nach der
Zeilenzahl der Löschung.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci` — der Cache-Schalter, weil sonst
  Stufen aus dem Cache des Implementierers kommen. Das Gate deckt das Lookbook
  mit ab: `pnpm run build` läuft `astro build`, `pnpm typecheck` läuft
  `astro check` über dessen `.ts` und `.astro`.
- Commit: `chore: delete what nothing imports, nothing renders and no compiler sees`

  Dazu der Footer, weil der Typ die veröffentlichte Fläche verlässt und
  `AGENTS.md` das Repo an Conventional Commits bindet:

  ```
  BREAKING CHANGE: the `DependencyProp` type is gone. `DependencyDeclaration<Shape>`
  is the type the `Dependencies` constructor takes.
  ```
- Ergebnis: 1 Runde · PERF-009, READ-004, READ-006, READ-007, READ-008 und die
  Folge aus Paket 6 behoben · kein Regressionstest (kein Korrektheitsdefekt im
  Paket; der typecheck über Bibliothek und Lookbook ist der Nachweis und lief im
  Verify grün) · Review ohne Qualitätsbefund, auch ohne kleinen · 23 Dateien:
  9 geändert, 14 gelöscht (elf Vorschaubilder, `ReactDemo.astro`,
  `createFrameLoopComponent.js`, `fovealVisionEffect.ts` samt seinem Verzeichnis)
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: der exportierte Typ `DependencyProp` aus
  `packages/twopoint5d/src/utils/Dependencies.ts` ist entfernt · was der
  `Dependencies`-Konstruktor nimmt, heißt `DependencyDeclaration<Shape>` ·
  CHANGELOG unter `## [Unreleased]` in `### Removed` und `### Migration Guide`
  fortgeschrieben · das Release ist damit ein Breaking Change

#### Die Findings im Wortlaut

**PERF-009 · low · apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro:100**
— Eine Demo loggt 512-mal pro Seitenaufruf

`console.log('texCoords', …)` steht im Rumpf der inneren Schleife und feuert bei
16 × 32 Quads 512-mal. Die übrigen Demos loggen einmal nach dem Aufbau.

Empfehlung: Aus der Schleife nehmen oder streichen.

**READ-004 · info · apps/lookbook/src/components/LookBookApi.ts:56** —
`getMetadataForDemos` ist ein toter Export samt Typ

Die Funktion ist exportiert und hat im ganzen Repo keinen Aufrufer, auch in
keiner der 36 `.astro`-Dateien; mit ihr ist auch `LookBookMetadata` ohne
Gebrauch.

Empfehlung: Beides streichen.

**READ-006 · info · apps/lookbook/src/demos/passes/fovealVisionEffect.ts** —
`fovealVisionEffect` ist ein verwaistes Modul

Der Name kommt im ganzen Repo nur in dieser Datei vor — kein Demo, keine
`.astro`-Seite und keine Demo-JSON importiert ihn. 60 Zeilen TSL-Post-Effekt,
die nichts bündelt und nichts rendert.

Empfehlung: Streichen, oder eine Demo dazu bauen, die ihn zeigt.

**READ-007 · info · packages/twopoint5d/src/stage/ProjectionPlane.ts:84-86,
map2d/chunk-quad-tree/ChunkQuadTreeNode.ts:300-324,
apps/lookbook/src/demos/map2d-cam-visi.ts:43-44,108,
quadtree-playground/QuadTreeVisualization.ts:53-55** — Vier auskommentierte
Codeblöcke, die sich nicht mehr einkommentieren lassen

Auskommentierter Code, den kein Compiler sieht und der auf einen Stand zeigt,
den es nicht mehr gibt. `ChunkQuadTreeNode.ts:300-324` hat zwei ebenfalls
auskommentierte Aufrufer in `ChunkQuadTreeNode.spec.ts:85,145`. Die im Vorlauf
mitgezählten Zeilen in `sprites/node-utils.ts` sind keine toten Blöcke, sondern
GLSL-Referenzkommentare neben der TSL-Übersetzung; sie bleiben.

Empfehlung: Streichen. Was gebraucht wird, steht in der Historie; was wieder
hineinsoll, muss ohnehin gegen den heutigen Code geschrieben werden.

**READ-008 · info · apps/lookbook/src/layouts/ReactDemo.astro,
src/demos/utils/createFrameLoopComponent.js, public/images/demo-preview/ (11
Dateien)** — Dreizehn Reste der react-three-fiber-Zeit

`ReactDemo.astro` wird von keiner Datei importiert — die 17 Demoseiten laden
alle `VanillaDemo.astro`, `index.astro` lädt `Layout.astro` —, enthält selbst
kein React und ist bis auf ein `description`-Prop und eine Hintergrundfarbe eine
Kopie von `VanillaDemo.astro`. Dazu ein ungenutztes Modul und elf Vorschaubilder
ohne Verwender.

Empfehlung: Alle dreizehn streichen. Die React-Kette selbst hat die App bereits
verlassen.

### [x] 10. Fehlerwege in Display und PanControl2D
- Nebenbefund: `PanControl2D.ts:218` (`set keyboardDisabled`, medium),
  `PanControl2D.ts:233` (`set pointerDisabled`, low),
  `Display.ts:415-435` (low)
- Ziel: Wer eine Eingabequelle mitten im Zug abschaltet oder in der
  Renderer-Erzeugung scheitert, hinterlässt keinen laufenden Pan, keinen
  unsichtbaren Cursor und kein verwaistes `<div>` im DOM.
- Bereich: `packages/twopoint5d/src/controls/PanControl2D.ts`,
  `packages/twopoint5d/src/display/Display.ts`
- Hängt ab von: — (Drain-Runde des Abschlusses, freigegeben 2026-09-08)
- Hash: 069b991
- Ergebnis: 1 Runde · alle drei Nebenbefunde behoben, dazu die vierte Fundstelle
  derselben Ursache (`PanControl2D#unsubscribe()`) · Regressionstests
  `releases a key still held when the keyboard is switched off`,
  `restores the cursor when the pointer is switched off mid-drag`,
  `hands back pan, keys and cursor when it is switched inactive` und
  `takes the container it built back out of the host when the renderer cannot be built`
  (alle vier vor dem Fix rot gesehen), dazu die Gegenprobe
  `keeps a speed a caller set by hand when the keyboard is switched off`, die vorher
  wie nachher grün ist · klein: die drei Abschaltwege rufen dieselben privaten
  Methoden an drei Stellen; die Testhelfer sind aus `pan-control-dispose.test.js`
  dupliziert — beides im Detailplan so vorgesehen
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `PanControl2D#unsubscribe()` ist überschrieben und gibt zurück,
  was die Eingabequellen halten — den Pan aus einem laufenden Zug, die Tasten, die
  gerade ein `speed…`-Feld anheben, und einen versteckten Cursor. Wer die Methode
  in einer Ableitung weiter überschreibt, ruft `super.unsubscribe()`. Ein
  `speed…`-Wert, den ein Aufrufer selbst geschrieben hat, bleibt unangetastet ·
  Der `Display`-Konstruktor nimmt den selbst gebauten Container aus dem
  Host-Element heraus, bevor ein Fehler aus der Renderer-Erzeugung den Aufrufer
  erreicht; ein Container oder Canvas, der als Argument kam, bleibt liegen
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/controls/PanControl2D.ts`,
  `packages/twopoint5d/src/display/Display.ts`,
  `packages/twopoint5d-testing/test/pan-control-switch-off.test.js` (neu),
  `packages/twopoint5d-testing/test/display-constructor.test.js`,
  `packages/twopoint5d/CHANGELOG.md`

#### Was der Abgleich ergeben hat

Alle drei Fundstellen existieren unverändert, die Zeilennummern der Notiz stimmen
gegen `e456752`:

| Fundstelle laut Notiz | Stand jetzt |
| --- | --- |
| `PanControl2D.ts:218` `set keyboardDisabled` | unverändert `:218-227`, meldet nur Listener an und ab |
| `PanControl2D.ts:233` `set pointerDisabled` | unverändert `:233-248`, `#pointersDown.clear()` seit Paket 1 auf `:246`, der Cursor bleibt liegen |
| `Display.ts:415-435` | `appendChild` auf `:415`, `#ownContainer = container` auf `:422`, die Renderer-Erzeugung `:435-442` |

Drei Dinge, die der Abgleich zusätzlich ergeben hat und die die Schritte unten
tragen:

- **Die Tastatur hat eine dritte Tür, und sie steht genauso offen.**
  `unsubscribe()` — öffentlich, und der Setter `isActive = false` ist der Weg
  dorthin — nimmt über `InputControlBase` alle Listener von `document`, ohne dass
  das Control etwas davon mitbekommt. Eine gehaltene Taste bleibt danach genauso
  in ihrem `speed…`-Feld stehen wie beim Setter, der laufende Pan in
  `#pointersDown` bleibt liegen, und der Cursor bleibt unsichtbar. Es ist dieselbe
  Ursache mit einem dritten Ausgang: der Eingabezustand dieses Controls wird
  ausschließlich von einem Folge-Event zurückgenommen, und genau dieses Event
  erreicht ein Control ohne Listener nie mehr. `dispose()` läuft über
  `super.dispose()` → `destroyAllListeners()` → `unsubscribe()`, hängt also an
  derselben Tür — dort ist der Pan und der Cursor seit Paket 1 von Hand
  nachgeräumt, die Tastatur nicht. Der Fix sitzt deshalb in einem Override von
  `unsubscribe()`, und die beiden Setter greifen ihn jeweils für ihre Seite ab.
  Wer nur die beiden Setter repariert, behebt dieselbe Ursache zweimal halb.
- **Die vier `speed…`-Felder gehören nicht der Tastatur.** Paket 1 hat
  festgeschrieben, dass `update()` sie bewegt, gleich wer sie gesetzt hat
  (`PanControl2D.ts:270-271`, Test »reports an update when only the speed fields
  moved the view«). Ein Aufräumen, das beim Abschalten stumpf alle vier auf `0`
  setzt, nähme einem Aufrufer den Wert weg, den er von Hand geschrieben hat —
  `disableKeyboard: true` plus eigene Steuerung ist genau die Kombination, die
  das Repo in seinen eigenen Tests fährt. Zurückgegeben wird deshalb nur, was
  eine Taste gerade hält, und dafür braucht es die Buchführung aus Schritt 1.
- **Der Fehlerweg im Display ist genau einer.** Nur die Renderer-Erzeugung
  `:435-442` wirft synchron, nachdem der Container im Host hängt; ein `init()`,
  das nicht durchkommt, wird als abgelehnte Promise vom Init-Callback `:465ff`
  abgefangen und als `error`-Event gemeldet, und die Display-Instanz lebt dann
  und hat ein `dispose()`. Alles zwischen der Erzeugung und dem Ende des
  Konstruktors ist Verdrahtung. Das `try` bleibt deshalb eng um den einen Aufruf,
  statt den halben Konstruktor einzuwickeln.
- **Was die vorhandene Suite bereits festhält.**
  `packages/twopoint5d-testing/test/pan-control-dispose.test.js` fährt vier
  Zusagen an, die dieser Umbau nicht bewegen darf: ein disposed Control nimmt
  weder Taste noch Pointer mehr an (`:88-115`), ein von Hand geschriebenes
  `speedNorth` bewegt die `panView` auch nach `dispose()` (`:130-150`), die
  Cursor-Klasse ist nach `dispose()` vom fremden Element herunter (`:152-163`),
  und ein `keyboardDisabled = false` nach `dispose()` holt das Control nicht
  zurück (`:177-200`). Alle vier bleiben mit dem Vorgehen unten grün: der
  Freigabepfad greift nur beim Abschalten, und die Wege, über die ein disposed
  Control zurückkäme, sind in `InputControlBase` verriegelt.

#### Vorgehen

1. **`PanControl2D`: Buchführung darüber, welches `speed…`-Feld eine Taste
   gerade hält.** Ein privates Feld
   `#keyedSpeeds = new Set<KeyedSpeedField>()` neben `#pointersDown`, dazu der
   modulprivate Typ `type KeyedSpeedField = 'speedNorth' | 'speedSouth' |
   'speedEast' | 'speedWest';` (nicht exportiert, er beschreibt Interna).
   Gemerkt wird der Feldname und nicht der KeyCode: `keyCodes` ist öffentlich und
   beschreibbar, und zurückzugeben ist das Feld, das angehoben wurde, nicht die
   Taste, die es angehoben hat. Ein Kommentar sagt genau das.
   Dazu eine private Methode, die die Zuordnung an einer Stelle hält:

   ```ts
   #speedFieldFor(keyCode: number): KeyedSpeedField | undefined {
     switch (keyCode) {
       case this.keyCodes[0]: return 'speedNorth';
       case this.keyCodes[1]: return 'speedSouth';
       case this.keyCodes[2]: return 'speedWest';
       case this.keyCodes[3]: return 'speedEast';
       default: return undefined;
     }
   }
   ```

   Die Zuordnung ist die bestehende und ändert sich nicht: `keyCodes[0]` → Norden
   (W), `[1]` → Süden (S), `[2]` → Westen (A), `[3]` → Osten (D).
   `#onKeyDown` und `#onKeyUp` (`:398-432`) laufen darüber:

   ```ts
   #onKeyDown = ({keyCode}: KeyboardEvent): void => {
     const field = this.#speedFieldFor(keyCode);
     if (field == null) return;
     this[field] = this.pixelsPerSecond;
     this.#keyedSpeeds.add(field);
   };

   #onKeyUp = ({keyCode}: KeyboardEvent): void => {
     const field = this.#speedFieldFor(keyCode);
     if (field == null) return;
     this[field] = 0;
     this.#keyedSpeeds.delete(field);
   };
   ```

   Die auskommentierten KeyCodes der alten `switch`-Zweige (`// 87: // W`) gehen
   dabei verloren; ihre Auskunft steht bereits im TSDoc von
   `PanControl2DOptions.keyCodes` (`:102-111`) und darf dort bleiben, statt an
   zwei Stellen gepflegt zu werden.

   Dazu die Freigabe:

   ```ts
   #releaseKeyedSpeeds(): void {
     for (const field of this.#keyedSpeeds) {
       this[field] = 0;
     }
     this.#keyedSpeeds.clear();
   }
   ```

2. **`unsubscribe()` überschreiben** — die eine Stelle, an der dieses Control
   erfährt, dass keine Eingabe mehr ankommt. Direkt hinter den beiden Settern:

   ```ts
   /**
    * Take every listener off `document` and give back what the input sources are holding:
    * the pan collected in a drag, the keys still down and a hidden cursor.
    *
    * None of it can come back through an event any more — a `pointerup` and a `keyup` reach a
    * control that is no longer listening, and without this the view would keep moving by a key
    * nobody is pressing. A speed field a caller wrote by hand is not touched: {@link update}
    * moves the view by those whether an input source reaches this control or not.
    */
   override unsubscribe(): void {
     // first: with the listeners off document, no event can refill what the lines below give up
     super.unsubscribe();

     this.#pointersDown.clear();
     this.#releaseKeyedSpeeds();
     this.#restoreCursorStyle();
   }
   ```

   `#restoreCursorStyle()` wird unbedingt gerufen, nicht nur aus `YES`: die
   Methode prüft das selbst (`:343-347`) und nimmt aus `MAYBE` allein den Zustand
   zurück, ohne eine fremde Klasse anzufassen. Genau das ist hier richtig — ein
   `MAYBE`, das kein `pointermove` mehr auflösen kann, bliebe sonst stehen.

3. **`set keyboardDisabled` (`:218-227`)** ruft im Abschaltzweig
   `this.#releaseKeyedSpeeds()`, mit einem Kommentar in der Machart des
   vorhandenen bei `:244-246`: das `keyup`, das die Taste zurücknähme, erreicht
   dieses Control nicht mehr, und ohne die Freigabe schiebt `update()` die
   `panView` von da an dauerhaft weiter.

4. **`set pointerDisabled` (`:233-248`)** ruft im Abschaltzweig nach dem
   vorhandenen `#pointersDown.clear()` zusätzlich `this.#restoreCursorStyle()`.
   Kommentar: der Cursor liegt auf einem Element, das dem Aufrufer gehört, und
   das `pointerup`, das ihn zurückgäbe, kommt nicht mehr an.

5. **`dispose()` (`:453-472`) auf das eindampfen, was nur dort gilt.** Über
   `super.dispose()` → `destroyAllListeners()` → `unsubscribe()` läuft jetzt der
   Override aus Schritt 2, und damit sind die beiden Zeilen `#pointersDown.clear()`
   und der `if (…YES) #restoreCursorStyle()`-Block dort doppelt. Beide entfallen;
   was bleibt, ist:

   ```ts
   override dispose(): void {
     if (this.isDisposed) return;

     // super.dispose() takes the listeners off and, through unsubscribe(), hands back what the
     // input sources were holding — while the listeners of this control are still attached, so
     // the restoreCursor that goes out on the way still reaches them
     super.dispose();

     // last: the restoreCursor above still has to reach the listeners that act on it
     off(this);
   }
   ```

   Die Reihenfolge, auf der die Zusage des TSDoc beruht, bleibt damit
   unverändert: `restoreCursor` geht vor `off(this)` hinaus.
   Das Argument des alten Kommentars bei `:460-463` — die Klasse aus `MAYBE`
   nicht abzuräumen, weil ein anderes Control noch dahinter stecken könnte — ist
   in `#restoreCursorStyle()` selbst schon zu Hause (`:339-347`) und wird nicht
   in den neuen Text mitgeschleppt.

6. **TSDoc von `dispose()` (`:434-452`) nachziehen.** Der Absatz zählt auf, was
   ein disposed Control noch tut. Er bleibt, wie er ist, bis auf den Satz über
   `update()`: dort kommt hinzu, dass eine Taste, die beim Aufruf noch gehalten
   wurde, ihr `speed…`-Feld zurückgibt — was weiter bewegt, sind die Werte, die
   ein Aufrufer selbst geschrieben hat. Kein Rückblick auf den Vorzustand, wie in
   den »Konventionen« oben.

7. **`Display.ts`: den Container am Fehlerweg zurücknehmen.** Die
   Renderer-Erzeugung `:435-442` bekommt ein `try`/`catch`:

   ```ts
   try {
     this.renderer = makeRenderer({
       canvas,
       stencil: false,
       alpha: true,
       antialias: true,
       powerPreference: 'high-performance',
       ...rendererOptions,
     } as CreateRendererParameters);
   } catch (error) {
     // the container went into the host a few lines up, and a constructor that throws leaves
     // no instance behind whose dispose() could take it back out again
     this.#ownContainer?.remove();
     this.#ownContainer = undefined;
     throw error;
   }
   ```

   Nur der selbst gebaute Container wird zurückgenommen — ein Canvas, der als
   Argument kam, gehört dem Aufrufer und bleibt, wo er ist; `#ownContainer` ist
   genau auf diese Unterscheidung gebaut (`:359-362`). Die CSS-Regel im
   `styleSheetRoot` bleibt stehen, wie sie auch nach `dispose()` stehen bleibt:
   sie trägt einen Namen pro Root und wird geteilt.

8. **Regressionstests, jeder vor seinem Fix rot.** Sie laufen im Browser
   (`@web/test-runner`, Chromium und Firefox), nicht in vitest.

   a. Neue Datei
   `packages/twopoint5d-testing/test/pan-control-switch-off.test.js`, describe
   »PanControl2D — what it gives back when an input source is switched off«. Die
   Helfer `pointer()`, `key()` und `makeState()` gibt es in
   `pan-control-dispose.test.js` in genau der Form, die hier gebraucht wird
   (`:5-33`) — von dort übernehmen, samt der beiden Kommentare, die erklären,
   warum ein auf `document.body` abgesetztes Event das Control erreicht. Ein
   `afterEach`, das ein noch lebendes Control disposed, gehört dazu.
   Vier Fälle:

   - `releases a key still held when the keyboard is switched off` —
     `key('keydown', 87)`, dann `control.keyboardDisabled = true`, dann
     `control.update(1 / 60)`: `speedNorth` ist `0` und `panView.y` steht auf
     `0`. Vor dem Fix schiebt jedes `update()` weiter.
   - `keeps a speed a caller set by hand when the keyboard is switched off` —
     die Gegenprobe zu Schritt 1, ohne die der Fix aus Variante »alle vier
     nullen« nicht zu unterscheiden wäre: `control.speedNorth = 100`, dann
     `control.keyboardDisabled = true`, dann `update()`: `panView.y` ist
     kleiner als `0`. Dieser Fall ist auch vor dem Fix grün und bleibt es —
     er sichert die Zusage aus Paket 1 gegen den Fix ab.
   - `restores the cursor when the pointer is switched off mid-drag` — Control
     mit eigenem `cursorStylesTarget` (ein `div`, wie in
     `pan-control-dispose.test.js:152-163`), `pointerdown` plus `pointermove`,
     dann `control.pointerDisabled = true`: `target.classList.length` ist `0`
     und ein `restoreCursor`-Event ist angekommen. Vor dem Fix bleibt die
     Klasse liegen.
   - `hands back pan, keys and cursor when it is switched inactive` — derselbe
     Aufbau, aber `control.isActive = false` statt der beiden Setter: gehaltene
     Taste freigegeben, Cursor-Klasse ab, und ein `update()` liefert keinen Pan
     aus dem Zug davor nach.

   b. In `packages/twopoint5d-testing/test/display-constructor.test.js` ein
   vierter Fall,
   `takes the container it built back out of the host when the renderer cannot be built`:
   `new Display(host, {createRenderer: () => { throw rendererFailed; }})` wirft
   `rendererFailed` weiter, und `host.children.length` ist danach `0`. Die
   Datei hat für den Wurf schon alles, was es braucht — `makeContainer()` und
   den Hinweis bei `:23-25`, dass das Ergebnis von `createRenderer` nirgends
   gegen `WebGPURenderer` geprüft wird. Vor dem Fix bleibt ein Kind im Host.

9. **CHANGELOG.** `packages/twopoint5d/CHANGELOG.md`, Abschnitt
   `## [Unreleased]` → `### Fixed`, im Stil der vorhandenen Einträge (»fix …«,
   Präsens, was jetzt gilt, kein Rückblick). Zwei Einträge:

   - `fix PanControl2D#keyboardDisabled`, `#pointerDisabled` und
     `unsubscribe()`: jeder dieser Wege gibt zurück, was die Eingabequellen
     halten — die Tasten, die gerade ein `speed…`-Feld anheben, den Pan aus
     einem laufenden Zug und einen versteckten Cursor. Ein `speed…`-Wert, den
     ein Aufrufer selbst geschrieben hat, bleibt stehen und bewegt die
     `panView` weiter.
   - `fix the Display constructor`: schlägt die Erzeugung des Renderers fehl,
     nachdem sich der Display seinen Container in das Host-Element gebaut hat,
     nimmt er ihn wieder heraus, bevor der Fehler den Aufrufer erreicht.

   Kein Eintrag im »Migration Guide«: keine Signatur ändert sich, und was sich
   am Verhalten ändert, war ein Defekt.

- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci` — der Cache-Schalter, weil sonst
  Stufen aus einem früheren Lauf als grün durchgereicht werden. `test:browser`
  ist die Stufe, an der die neuen Tests hängen.
- Commit: `fix(twopoint5d): give back the pan, the keys and the container when the way back through an event is gone`
- Anmerkungen des Reviewers (Prozess `remediate-twopoint5d-p10-review-1`, sonnet):
  alle vier Fundstellen behoben und je im neuen Code belegt, die Tests haben
  Beweiskraft, die Reihenfolge in `dispose()` (`restoreCursor` vor `off(this)`)
  hält, der `try` im Display-Konstruktor liegt eng um den Aufruf, der wirft. Zwei
  kleine Befunde, keiner davon eine Runde wert: die drei Abschaltwege ziehen
  dieselben privaten Methoden einzeln nach, und `pan-control-switch-off.test.js`
  dupliziert die Helfer `pointer()`, `key()` und `makeState()` aus
  `pan-control-dispose.test.js`. Beides steht so im Detailplan.

#### Die Befunde im Volltext

**`packages/twopoint5d/src/controls/PanControl2D.ts:218` · `set keyboardDisabled`
· geschätzt medium** — wird die Tastatur abgeschaltet, während eine Taste
gehalten wird, bleibt das zugehörige `speed…`-Feld stehen; das `keyup` erreicht
das Control nie mehr, und `update()` schiebt die `panView` von da an dauerhaft
weiter. Vorbestehend, belegt gegen `a9f7dd1` — der Setter räumte auch dort
nichts auf.

**`packages/twopoint5d/src/controls/PanControl2D.ts:233` · `set pointerDisabled`
· geschätzt low** — ein `pointerDisabled = true` mitten im Zug lässt
`#hideCursorState` auf `YES` und die Cursor-Klasse auf dem `cursorStylesTarget`
liegen, während `#onPointerUp` bereits abgemeldet ist; der Cursor bleibt
unsichtbar, bis das Control disposed wird. Vorbestehend, belegt gegen `a9f7dd1`.

**`packages/twopoint5d/src/display/Display.ts:415-435` · geschätzt low** — wirft
die Renderer-Erzeugung im `HTMLElement`-Zweig, hängt der selbst gebaute Container
bereits im DOM; es entsteht keine Instanz, und niemand ruft `dispose()`.
Dasselbe Leck, das Paket 1 für den normalen Weg geschlossen hat, auf dem
Fehlerweg. Vorbestehend, belegt gegen `a9f7dd1` — der `appendChild` stand auch
dort vor dem Aufruf.

### [x] 11. Texture-Ladepfade, die still danebengehen
- Nebenbefund: `TextureAtlasLoader.ts:87` (low),
  `TextureResource.ts:522` (low), `TextureResource.ts:617-639` (low)
- Ziel: Jeder Wurf auf einem Ladepfad erreicht den Aufrufer, und zwar als das,
  was er ist: keine Promise, die nie settlet, kein Bild-Fehler mit einer URL,
  die nie gescheitert ist, und kein stilles Ausbleiben der Textur, weil eine
  Atlas-JSON ungeprüft durchlief.
- Bereich: `packages/twopoint5d/src/texture/TextureAtlasLoader.ts`,
  `packages/twopoint5d/src/texture/TextureResource.ts`, dazu ein neues internes
  Modul `packages/twopoint5d/src/texture/isAtlasJsonResponse.ts` für den Guard,
  den beide Wege ab jetzt teilen
- Hängt ab von: — (Drain-Runde des Abschlusses, freigegeben 2026-09-08)
- Detail: `docs/remediation/paket-11.md`
- Hash: 417b04f
- Ergebnis: 2 Runden · alle drei Befunde behoben, vom Reviewer je mit Fundstelle
  bestätigt · Regressionstests `a parse that throws rejects instead of leaving
  the promise open` (vor dem Fix im Timeout), `a 200 response that is no atlas
  json is reported instead of set`, `an atlas json that names no image and has
  no override is reported`, `an atlas json without an image loads with an
  overrideImageUrl`, `a failure behind a loaded image is not reported as an
  image failure` und `an image load that rejects is reported as an image
  failure` (alle vor dem Fix rot) · Runde 1 der Fehlerkette schloss vier
  wichtige Befunde (CHANGELOG, TSDoc der `atlas`-Payload, Kommentar am
  `response.ok`-Check, fehlender Test auf dem Image-Rejection-Zweig) · klein und
  offen: drei Politurstellen in `docs/remediation/paket-11.md`
- Nebenbefunde: keine neuen
- Folgen: keine
- Schnittstellen:
  - Das `error`-Event von `TextureResource` kennt den Wert `source: 'texture'`.
    Er trägt `{source, id, error}` ohne `url` und meldet alles, was hinter einem
    bereits geladenen Bild schiefgeht: die Textur-Erzeugung selbst und jeden
    daraus abgeleiteten Wert (Atlas, TileSet, Animationen). `source: 'image'`
    meint ab jetzt ausschließlich die Rejection des Bild-Ladens.
  - `TextureResource` prüft die Antwort eines `atlasUrl`-Fetch gegen die Form
    einer TexturePacker-JSON, bevor sie gelesen wird. Eine 200-Antwort, die
    keine ist, und eine, die weder `meta.image` noch ein `overrideImageUrl`
    hergibt, werden über das `error`-Event mit `source: 'atlas'` gemeldet und
    nicht gesetzt. Die aufgelöste Bild-URL wird in die gesetzte JSON eingelegt.
  - `TextureAtlasLoader#loadAsync()` rejectet, wenn `TexturePackerJson.parse()`
    wirft; `load()` gibt denselben Fehler an `onErrorCallback`.
  - `packages/twopoint5d/src/texture/isAtlasJsonResponse.ts` ist neu und
    modulintern — der Typ `AtlasJsonResponse` und die Wache
    `isAtlasJsonResponse` liegen dort, nicht in `texture/public-api.ts`.

### [x] 12. map2d: Musterwiederholung und ein Test ohne Beweiskraft
- Nebenbefund: `RepeatingTilesProvider.ts:154` und `:182` (medium)
- Folge aus Paket 5: `DataIdsChunk2D.spec.ts:29-33`
  (`names the compression it cannot handle`) — der Test prüft nur, dass die
  geworfene Meldung den Kompressionsnamen enthält. Den trug sie schon, bevor
  das `console.error` daneben verschwand; der Test wäre auch mit ihm grün und
  hält die Fehlerpolitik damit nicht fest. Belegt im nachgezogenen Review von
  `4d723fe` (2026-09-08).
- Ziel: `getTileIdsWithin()` setzt die Musterwiederholung an der Stücklänge
  fort statt an der aufgelaufenen Zielbreite, und der Kompressions-Test fällt,
  wenn jemand die Fehlerpolitik zurückdreht.
- Bereich: `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`,
  `packages/twopoint5d/src/map2d/chunk-quad-tree/DataIdsChunk2D.spec.ts`
- Hängt ab von: — (Drain-Runde des Abschlusses, freigegeben 2026-09-08)
- Detail: `docs/remediation/paket-12.md`
- Hash: 72d2893
- Ergebnis: 1 Runde · beide Posten erfüllt · die Musterfortschaltung in
  `getTileIdsWithin()` läuft über die Länge des zuletzt geschriebenen Stücks,
  die beiden wortgleichen Schleifenkopien sind zur privaten Methode
  `#writePatternRow()` zusammengelegt · Regressionstests
  `repeats a pattern that does not end on the target edge` (in `none` und in
  `horizontal`) und `repeats every row of a multi-row pattern the same way`,
  alle drei vor dem Fix rot mit genau den Ist-Werten aus dem Detailplan ·
  `names the compression it cannot handle and reports it by throwing alone`
  bindet jetzt beide Hälften der Fehlerpolitik, die Gegenprobe mit einem
  versuchsweisen `console.error` vor dem `throw` schlug fehl und ohne sie grün ·
  keine Qualitätsbefunde des Reviewers, auch keine kleinen
- Nebenbefunde: keine
- Folgen: keine
