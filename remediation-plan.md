# Remediation-Plan — twopoint5d (Domains sprites und map2d)

Quelle: ./audit.html vom 2026-09-26 · Branch: main · erstellt: 2026-09-26
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0cde42d5-f02f-4e8e-b346-766a21beec2d/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 4 Findings der Domains sprites und map2d (1 medium anteilig, 2 low, 1 info) — BUG-126, BUG-125, TEST-042 (nur Sprites-Anteil), TEST-049 · ausgenommen: alle Findings anderer Domains, acknowledged
Scope-Regel: alles in den Domains sprites und map2d, jede Severity einschließlich info, jede Kategorie — sofern der Befund in `packages/twopoint5d/src/sprites/`, `packages/twopoint5d/src/map2d/`, deren Specs und Browser-Tests oder den zugehörigen Lookbook-Demos liegt; gilt auch für Befunde, die erst im Lauf auffallen. Alles andere geht als neues Finding ins Audit.
Kaltstarts: 2 Pakete × mindestens 3 Agenten ≈ 6, je Nachrunde zwei mehr · 3 bzw. 1 Findings je Paket
Stand (2026-09-26): Lauf abgeschlossen · 6 Pakete committet (324ab4a1..840e2c0e), keines blockiert · »Offene Befunde« ins Audit gebucht (CONS-058, DOC-072) · Report: docs/remediation/20260926-sprites-map2d-remediation-report.md

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` geparkt, Stand im Stash.

## Entscheidungen
- Paket 5 ist die letzte Runde: was sein Review noch findet, geht als Finding ins Audit (2026-09-26, Orchestrator)
- Die kleinen Review-Befunde, die in sprites/map2d offen blieben, gehen als Paket 4 durch die Schleife statt als induzierte Findings ins Audit, weil der Lauf die beiden Domains leeren soll (2026-09-26, Orchestrator nach dem Ziel des Nutzers)
- Ziel des Laufs: die Domains sprites und map2d im Audit ohne offenes Finding (2026-09-26)
- BUG-126 wird echt umgebaut, nicht per Doku umgangen: das `animsMap`-Layout aus `bakeDataTexture()` bekommt je Frame Versatz (`spriteSourceSize`) und Quellgröße (`sourceSize`), `AnimatedSpritesMaterial` und `TexturedSprite#setFrame()` legen den Quad danach; ein Browser-Test mit Pixelprobe hält es fest. Das Texel-Layout des `animsMap` ändert sich damit für jeden, der es selbst ausliest — CHANGELOG-Eintrag mit Migrationshinweis; die eigenen Aufrufer (Lookbook, Tests) zieht der Lauf mit. Der Anteil in `src/texture/` (`FrameBasedAnimations#bakeDataTexture()`) gehört zu diesem Umbau und liegt damit im Lauf (2026-09-26)
- BUG-125 wird auf der Seite von sprites behoben: eine `duration` von 0 gilt im Shader als Standbild (Frame 0), mit Test (2026-09-26)
- TEST-042 nur mit seinem Sprites-Anteil: Browser-Tests für Billboards an einem verschobenen Mesh, `texCoordsFromIndex` und die Frame-Index-Formel. Das Finding bleibt im Audit, eingeengt auf Stage (Pixel-Readback für Mode E und verschachteltes Plain-Kind) und das verlorene `keyup` von PanControl2D (2026-09-26)
- TEST-049 (info) ist im Scope, weil der Lauf die Domains komplett leeren soll (2026-09-26)

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
- Commit-Messages auf Englisch im Stil von `git log`: Conventional-Commit-Präfix mit den berührten Scopes, z. B. `fix(sprites,texture): …`.
- `AGENTS.md` im Repo-Root vor der ersten Änderung lesen; `pnpm run ci` ist das Pre-Commit-Gate. `pnpm publishNpmPkg` nie ausführen.
- Nutzerwirksame Änderungen bekommen einen Eintrag im CHANGELOG des Pakets (Keep a Changelog 1.1.0, Skill `updating-changelog`).

## Vorbestehende Fehler
- keine — die Baseline ist grün

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:104` — `getBufferSize()` trägt `16384` als eigenes Default-Literal neben `FrameBasedAnimations.MaxTextureSize`; heute wirkungslos, weil der einzige Aufrufer den statischen Wert übergibt · aus Paket 1 · vorbestehend, info, Domain texture → Audit
- [x] `packages/twopoint5d/src/stage/OrthographicProjection.ts:133` und `packages/twopoint5d/src/stage/ParallaxProjection.ts:136` — `expectDefined(this.projectionPlane, …)` meldet ein fehlendes `projectionPlane` mit `expected the projection plane of this projection to be defined`: die Meldung nennt weder Klasse noch Methode, und `projectionPlane` ist ein optionales öffentliches Feld des Aufrufers, keine Invariante; dasselbe Muster, das Paket 2 in `TileSpritesFactory` behebt · aus Paket 2 (Zug 0) · vorbestehend (`ead22dd1`), info, Domain stage → Audit


## Pakete

### [x] 1. Sprites: getrimmte Frames, Standbild-Animationen und GPU-Tests
- Findings: BUG-126 (low, Aufwand L), BUG-125 (low), TEST-042 (medium, nur Sprites-Anteil)
- Ziel: Sprites zeichnen getrimmte und stehende Frames richtig, belegt durch Browser-Tests mit Pixelprobe.
- Bereich: `packages/twopoint5d/src/sprites/`, `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `packages/twopoint5d/src/texture/frameTrimMargins.ts` (neu), `packages/twopoint5d-testing/test/`
- Detail: docs/remediation/paket-1.md
- Hängt ab von: —
- Hash: 324ab4a1
- Ergebnis: 1 Runde (Doku-Nachbesserung nach Review) · BUG-126, BUG-125, TEST-042 (Sprites-Anteil) und der Nebenbefund `voInitialize` behoben · Regressionstests vor dem Fix rot: die vier Tests in `sprites-trimmed-frames.test.js` (»… a trimmed TexturePacker frame is drawn where its untrimmed sprite has it«, Chromium und Firefox), `shows the first frame of an animation whose duration is 0, at the start and later on` (`sprites-animated-material.test.js`, beide Browser), `createSprite() hands out a sprite that starts upright and untrimmed, whatever its slot held before` (`TexturedSprites.spec.ts`) · Frame-Index-`select` mit `int`-Zweigen, weil WGSL in Firefox den gemischten Zweig ablehnt
- Nebenbefunde: → Queue (4)
- Folgen: keine
- Schnittstellen: `TexturedSprite` neu: Felder `trimLeft`, `trimTop`, `trimRight`, `trimBottom`, `setTexTrim(l, t, r, b)` / `setTexTrim([l, t, r, b])`, Attribut `texTrim` (vec4, Alias von `texCoords` in `TexturedSpritesGeometry`), `setFrame()` schreibt es · `TexturedSpritesMaterial.TexTrimAttributeName = 'texTrim'`, `TexturedSpritesMaterial#texTrimNode` (Signal, `undefined` = Attribut) · Typ `TAttributeNodeTexTrim = Node<'vec4'>` · `animsMap` aus `bakeDataTexture()`: 3 Texel je Frame, sobald ein registrierter Frame getrimmt ist, drittes Texel `[left, top, right, bottom]`, Header-Feld 4 nennt die Zahl · intern: `frameTrimMargins(data, target?)` in `src/texture/frameTrimMargins.ts`, nicht exportiert · `[voInitialize]()` von `TexturedSprite` setzt `texFlipDiagonal` 0 und `texTrim` 0
- Nebenbefund aufgenommen (Zug 0): `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts:48` — `[voInitialize]()` setzt `texFlipDiagonal` nicht zurück, ein Sprite aus `createSprite()` erbt den Flip seines Slots; vorbestehend (low), dieselbe Ursache wie der Reset, den das neue `texTrim` braucht
- Hinweis: TEST-049 in Zug 0 als Paket 1a abgetrennt — ohne es berührt das Paket schon 17 Dateien, TEST-049 brächte 9 map2d-Specs dazu, die mit Sprites nur die Domänengrenze teilen. Billboards am verschobenen Mesh (Teil von TEST-042) sind seit `deeddeea` belegt und entfallen hier.

### [x] 1a. map2d-Specs: Grenzfehler an ihrer Meldung prüfen
- Findings: TEST-049 (info)
- Ziel: Jede Grenzprüfung der map2d-Specs hält neben der Fehlerklasse die Meldung fest, die Klasse, Eigenschaft und Wert nennt.
- Bereich: `packages/twopoint5d/src/map2d/**/*.spec.ts`
- Detail: docs/remediation/paket-1a.md
- Hash: 0b0b0877
- Ergebnis: 0 Runden · TEST-049 behoben an 18 Stellen in 9 Specs (`RectangularVisibilityArea.spec.ts:185` gegenstandslos) · kein Bugfix, kein Regressionstest · klein: Leerzeilen-Rhythmus in `Map2DTileStreamer.spec.ts:102-109` weicht ab
- Nebenbefunde: keine neuen (der aus Zug 0 steht in der Queue)
- Folgen: keine
- Hängt ab von: —
- Hash: —
- Abgleich (Zug 0, 2026-09-26): 19 Stellen in 9 Specs — 10 des Findings, 9 weitere derselben Ursache; `RectangularVisibilityArea.spec.ts:185` gegenstandslos (Zeile 186 prüft die Meldung). Nur Specs, kein CHANGELOG. Restplan: 1a ist das letzte Paket, keine Folgen offen, kein Queue-Eintrag teilt die Ursache — Reihenfolge und Schnitt bleiben.

### [x] 2. Sprites und map2d: Slot-Reset neuer Sprites, Labels der Geometrie-Args, Fehlermeldungen der TileSpritesFactory
- Nebenbefund: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts:67` — `[voInitialize]()` setzt `rotation` nicht zurück (ebenso `quadSize`, `instancePosition`): ein Sprite aus `createSprite()` im Slot eines gedrehten Vorgängers beginnt gedreht · aus Paket 1 · vorbestehend (`ead22dd1`), low
- Nebenbefund: `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSprite.ts:22` — `AnimatedSprite` hat kein `[voInitialize]()`, `animId` und `animOffset` eines neuen Sprites tragen die Werte des vorigen Slot-Bewohners · aus Paket 1 · vorbestehend (`ead22dd1`), low
- Nebenbefund: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts:19` und `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesGeometry.ts:19` — die Tupel-Labels von `makeBaseSpriteArgs` heißen `width`/`height`, die Werte sind halbe Breite und halbe Höhe (`BaseSprite.ts:34-53`); das TSDoc am Konstruktor sagt es seit `324ab4a1` richtig · aus Paket 1 · vorbestehend, info
- Nebenbefund: `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts:45,50,52` — `createTile()` meldet fehlenden Provider, fehlendes Tile-Set und fehlenden Atlas-Frame über `expectDefined()` (`expected the tile set of this factory to be defined`): die Meldung nennt weder `TileSpritesFactory` noch `createTile()`, und `expectDefined()` ist laut TSDoc für Invarianten, die das Typsystem nicht sieht — `tileSet` und `tileDataProvider` sind optionale öffentliche Felder des Aufrufers · aus Paket 1a (Zug 0) · vorbestehend (`ead22dd1`), info
- Ziel: Ein Sprite aus `createSprite()` beginnt ohne Werte seines Slot-Vorgängers, die Geometrie-Args heißen nach dem, was sie tragen, und `TileSpritesFactory#createTile()` nennt sich und das fehlende Feld in seinen Fehlern.
- Bereich: `packages/twopoint5d/src/sprites/`, `packages/twopoint5d/src/map2d/TileSprites/`, `packages/twopoint5d/CHANGELOG.md`
- Detail: docs/remediation/paket-2.md
- Hängt ab von: —
- Hash: 980a01e5
- Ergebnis: 0 Runden · alle vier Nebenbefunde behoben (Slot-Reset `TexturedSprite` samt `texCoords`, Slot-Reset `AnimatedSprite` mit allen fünf Komponenten, Labels `halfWidth`/`halfHeight` samt `BaseSprite#make()`, Fehlermeldungen `TileSpritesFactory#createTile()`; der Atlas-Frame bleibt bei `expectDefined()` als echte Invariante) · Regressionstests vor dem Fix rot: `createSprite() hands out a sprite with every attribute at the value of an unused slot — 0, and white as its color — whatever its slot held before` (`TexturedSprites.spec.ts`), `a sprite out of the pool of an AnimatedSpritesGeometry starts with every attribute at 0, whatever its slot held before` (`AnimatedSprites.spec.ts`), `a factory without a tile set throws an Error naming the method, the field and the tile, …` und `a factory without a tile data provider throws an Error naming the method, the field and the tile, …` (`TileSpritesFactory.spec.ts`) · klein: 4 Punkte in der Paketdatei
- Nebenbefunde: → Queue (1)
- Folgen: keine
- Schnittstellen: `AnimatedSprite#[voInitialize]()` neu: setzt `quadSize`, `animId`, `animOffset`, `instancePosition`, `rotation` auf 0 · `TexturedSprite#[voInitialize]()` setzt jedes Attribut auf 0, `color` auf weiß · Parameter `BaseSprite#make(halfWidth, halfHeight, xOffset, yOffset)` und die Labels von `TexturedSpritesMakeBaseSpriteArgs` bzw. `makeBaseSpriteArgs` des `AnimatedSpritesGeometry`-Konstruktors heißen `halfWidth`/`halfHeight` (keine Signaturänderung) · `TileSpritesFactory#createTile()` wirft `Error` mit `TileSpritesFactory#createTile() has no tileDataProvider …` bzw. `… has no tileSet …`

### [x] 3. map2d: die Zusagen im @throws von TileSpritesFactory#createTile() mit Tests belegen
- Nebenbefund: `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts` — kein Test hält fest, dass `createTile()` ohne `tileSet` für eine Tile-Id `0` `undefined` antwortet statt zu werfen, und keiner den `RangeError` von `TileSet#frameId()` bei einer nicht ganzzahligen Tile-Id; beides sagt das `@throws` von `TileSpritesFactory.ts:41` zu · aus Paket 2 (Review) · vorbestehend (`ead22dd1`), info, Domain map2d
- Ziel: `TileSpritesFactory.spec.ts` hält jede Zusage im `@throws` von `createTile()` fest.
- Bereich: `packages/twopoint5d/src/map2d/TileSprites/`
- Detail: docs/remediation/paket-3.md
- Hängt ab von: —
- Hash: af225b63
- Ergebnis: 0 Runden · Nebenbefund behoben: drei Testfälle in `TileSpritesFactory.spec.ts` (Tile-Id 0 ohne `tileSet` → `undefined`, kein Slot; `RangeError` von `TileSet#frameId()` für 1.5 und NaN, Pool unberührt) · kein Bugfix, statt rotem Lauf Mutationsprobe M1–M3, alle rot · klein: 2 Punkte in der Paketdatei
- Nebenbefunde: keine
- Folgen: keine

### [x] 4. Sprites und map2d: die kleinen Review-Befunde der Pakete 1a, 2 und 3
- Folge von: Paket 1a — `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts:102-109` ohne die Leerzeile zwischen Konstante und `expect`, die die übrigen Grenzfälle der Specs haben (Reviewer, klein)
- Folge von: Paket 1a — `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts:49` prüft den Wurf ohne die `create`-Konstante, mit der die anderen Grenzfälle desselben Pakets den Aufruf benennen (Reviewer, klein)
- Folge von: Paket 2 — `packages/twopoint5d/CHANGELOG.md:16` bündelt den Slot-Reset von `TexturedSprites#createSprite()` und von `AnimatedSprite` in einem Bullet; `updating-changelog` will einen Bullet je Änderung (Reviewer, klein)
- Folge von: Paket 2 — `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:62-63`, TSDoc von `createSprite()`: »upright« meint `texFlipDiagonal` 0, sagt das aber nicht und liest sich wie eine Wiederholung von `rotation` (Reviewer, klein)
- Folge von: Paket 3 — `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts`, `test.each` für den `RangeError` von `TileSet#frameId()`: `call` läuft zweimal (je ein `toThrow`), die Pool-Prüfung zählt deshalb doppelt; ein Aufruf, dessen Fehler einmal gefangen und dann auf Klasse und Meldung geprüft wird (Reviewer, klein)
- Ziel: Die Domains sprites und map2d hinterlassen keinen offenen Review-Befund aus diesem Lauf.
- Bereich: `packages/twopoint5d/src/map2d/`, `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts`, `packages/twopoint5d/CHANGELOG.md`
- Detail: docs/remediation/paket-4.md
- Hängt ab von: —
- Hash: ef223cae
- Abgleich (Zug 0, 2026-09-26): alle fünf Befunde bestehen, einer umgeformt (`TileSpritesFactory.spec.ts:49` trägt seit Paket 2 eine `call`-Konstante; geht im Einmal-Aufruf auf), der CHANGELOG-Bullet nach `:274` gewandert und mit dem gleichlautenden `:273` aus Paket 1 zu fassen · mitgenommen, gleiche Ursache: Doppelaufruf vor der Pool-Prüfung auch in `TileSpritesFactory.spec.ts:44-55,57-68`, Leerzeile auch in `CameraBasedVisibility.spec.ts:270-274` · kein Migration Guide für den Slot-Reset (kein Aufrufmuster zu ändern) · Queue: beide Einträge ohne gemeinsame Ursache · Restplan: 4 bleibt das letzte Paket, danach der Abschluss mit der Drain-Runde
- Ergebnis: 0 Runden · alle fünf Review-Befunde und die mitgenommene Leerzeile in `CameraBasedVisibility.spec.ts` behoben (Reviewer) · kein Bugfix, Mutationsprobe statt rotem Lauf: die drei Wurf-Tests der `TileSpritesFactory`-Spec melden unter vorgezogenem Slot-Griff `usedCount after a throw: expected 1 to be +0` · klein: Testname `createSprite() hands out a sprite that starts upright and untrimmed` (`TexturedSprites.spec.ts:137`) trägt noch das mehrdeutige »upright«
- Nebenbefunde: keine
- Folgen: keine

### [x] 5. Sprites: der Testname zum Slot-Reset von createSprite()
- Folge von: Paket 4 — `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts:137`, Testname `createSprite() hands out a sprite that starts upright and untrimmed` trägt das mehrdeutige »upright«, das das TSDoc von `createSprite()` jetzt als `texFlipDiagonal` 0 ausschreibt (Reviewer, klein)
- Ziel: Der Testname sagt, was der Test prüft, in den Worten des TSDoc.
- Bereich: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts`
- Detail: docs/remediation/paket-5.md
- Hängt ab von: —
- Hash: 840e2c0e
- Abgleich (Zug 0, 2026-09-26): Folge unverändert, der Name steht nur in Zeile 137 · neuer Name buchstäblich in der Paketdatei, Variable `upright` und die Frame-Stellen in Zeile 101/112 bleiben (dort meint »upright« den ungedrehten Frame, wie im ganzen Repo) · kein CHANGELOG · Kette 2 → 4 → 5 ohne Rückfrage: jedes Glied ein Wortlaut-Befund, die Lösung an der Wurzel ist dieses Paket, und die Entscheidung »Paket 5 ist die letzte Runde« deckelt sie · Queue: beide Einträge ohne gemeinsame Ursache · Restplan: 5 bleibt das letzte Paket, danach der Abschluss mit der Drain-Runde
- Ergebnis: 0 Runden · Folge aus Paket 4 behoben (Reviewer: erfüllt, 0 Befunde) · kein Bugfix, kein roter Lauf · der Regressionstest aus Paket 1 heißt jetzt `createSprite() hands out a sprite that starts with its texFlipDiagonal and trim margins at 0, whatever its slot held before` (vorher `createSprite() hands out a sprite that starts upright and untrimmed, whatever its slot held before`)
- Nebenbefunde: keine
- Folgen: keine
