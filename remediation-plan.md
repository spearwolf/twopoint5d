# Remediation-Plan — twopoint5d

Quelle: ./audit.html vom 2026-09-28 · Branch: main · erstellt: 2026-09-29
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser)
Arbeitsverzeichnis: /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/9557ea1f-34da-4544-9cc6-16c7aee7f554/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 24 von 128 Findings (7 medium, 12 low, 5 info) — alle Findings der Features `vertex-objects`, `texture`, `display`, `sprites`, `map2d` · ausgenommen: alle anderen Features, acknowledged
Scope-Regel: jedes Finding, dessen Ort in den Features Vertex Objects, Texturen & Atlanten, Display & Frame-Loop, Sprites oder Map2D liegt (`packages/twopoint5d/src/{vertex-objects,texture,display,sprites,map2d}/`), jede Severity einschließlich info, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen. Ziel ist, dass diese Features ohne offenes Finding dastehen.
Kaltstarts: 3 Pakete × mindestens 3 Agenten ≈ 9, je Nachrunde zwei mehr · 8,0 Findings je Paket
Stand (2026-09-29): Lauf abgeschlossen — 5 Pakete committet (801906f3, 261bbd73, fc40b690, 98f2f561, 35e7942e), nichts blockiert, Befund-Queue leer, `pnpm run ci` grün

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` geparkt, Stand im Stash.

## Entscheidungen
- BUG-003: `Display` reicht das ungekappte Frame-Delta zusätzlich in den Render-Frame-Props weiter; `FixedFrameLoop` akkumuliert dieses Roh-Delta und begrenzt nur über sein eigenes `maxStepsPerFrame`. Der Default `maxDeltaTime = 1/30` bleibt für `display.deltaTime`/`display.now`. JSDoc von `Display.maxDeltaTime` und `FixedFrameLoop` beschreiben das Verhalten bei dauerhaft niedriger Framerate. (2026-09-29)
- PERF-001: Größenmessung über `ResizeObserver` auf die aufgelöste Größenquelle (mit `devicePixelContentBoxSize`, wo verfügbar) plus `matchMedia` für `devicePixelRatio`-Wechsel; im Frame nur ein Dirty-Flag. Polling bleibt Fallback für `resizeToCallback`, Selektorwechsel und Umgebungen ohne `ResizeObserver`. (2026-09-29)
- API-002: Ein manueller `resize()`-Aufruf misst immer; der `resizePollIntervalMs`-Throttle gilt nur für den Aufruf aus dem Frame (privater Pfad), keine neue öffentliche Option. (2026-09-29)
- BUG-011: Default von `FrameBasedAnimations.MaxTextureSize` auf 8192 (WebGPU-Mindestgarantie); `bakeDataTexture()` nimmt optional ein Limit bzw. das Limit des Renderers/Devices. Kein zweidimensionales Datenlayout in diesem Lauf. (2026-09-29)
- TYPE-002: `TextureAtlas` wird generisch — `TextureAtlas<D = TexturePackerFrameData | undefined>` o. ä. —, `any` verschwindet aus `TextureAtlasFrameData`; typbrechend, mit CHANGELOG-/Migrationshinweis; eigene Aufrufer werden mitgezogen. (2026-09-29)
- Arbeitsweise: Commits direkt auf `main`, lokal, kein Push. (2026-09-29)

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
- Projektregeln aus `AGENTS.md` gelten: `pnpm run ci` ist das Gate vor jedem Commit; neue öffentliche Symbole nur über das `public-api.ts` ihres Moduls; relative Imports mit `.js`-Suffix, `import type` für Typen; CHANGELOG-Einträge nach dem Skill `updating-changelog`.
- Commit-Messages im Stil von `git log`: Conventional Commits auf Englisch, `!` bei brechender Änderung.
- Niemals `pnpm publishNpmPkg` oder `scripts/publishNpmPkg.mjs` ausführen.

## Vorbestehende Fehler
- keine — Baseline `pnpm run ci` grün

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

Keine offenen Einträge — die acht Nebenbefunde aus den Paketen 1–3 sind in Paket 4 behoben.

## Pakete

### [x] 1. Texturen & Atlanten: Listener-Robustheit, Atlas-API, Texturlimit
- Findings: BUG-009 (medium), MEM-001 (medium), BUG-010 (medium), BUG-011 (medium), CONS-001 (low), BUG-014 (low), BUG-015 (low), PERF-020 (low), TYPE-002 (low)
- Nebenbefunde gleicher Ursache im Paket: `error` mit abbrechendem `emit` in `TextureResource.ts:599/770/960/1104` (medium) · `rendererChanged` mit `emit` in `TextureStore.ts:343` (low) · ungeschützte Dispose-Schleifen in `TextureStore#clearUnused()` und `evictMissing` (medium) · `#ownTexture.dispose()` in `TextureResource#dispose()` (low)
- Ziel: Das Texture-Feature übersteht werfende Listener, hält Optionen und Atlas-Namen konsistent, prüft Bakes gegen ein reales Texturlimit und typisiert Frame-Daten ohne `any`.
- Bereich: `packages/twopoint5d/src/texture/` (plus Aufrufer von `TextureAtlas`-Frame-Daten, v. a. `src/sprites/`)
- Detail: `docs/remediation/paket-1.md`
- Hängt ab von: —
- Hash: 801906f3
- Ergebnis: 0 Runden · alle neun Findings und N1–N4 behoben (Reviewer-Urteil je ID in der Paketdatei) · Regressionstests u. a. `dispose() tears the resource down whole behind a dispose listener that throws, and throws afterwards`, `a ready listener that throws keeps the ready value, a waiting getAsync(), the resource announcements and evictMissing`, `with g, every name is tested from its start`, `without a limit named a bake of 16384 texels is refused, naming 8192`, `the options are a frozen copy` (alle vor dem Fix rot) · klein: zwei wortgleiche `isObject`-Guards neu (`FrameBasedAnimations.ts:139`, `frameTrimMargins.ts:8`, dazu `checkTextureStoreData.ts:14`), Before-Beispiel im Migration Guide (`CHANGELOG.md:3180`) hätte auch vorher nicht kompiliert, doppelte Leerzeile vor `## [0.21.2]` (`CHANGELOG.md:3283`)
- Nebenbefunde: → Queue
- Folgen: —
- Schnittstellen: `TextureAtlas<D = TextureAtlasFrameData>`, `TextureAtlasFrame<D>`, `TextureAtlasArgs<D>`, `NamedTextureAtlasArgs<D>`, `TileSet<D>` — Datentyp als Typparameter; `TextureAtlasFrameData` = `TexturePackerFrameData` (kein `any` mehr) · `frameTrimMargins(data: unknown, target?)` · `TexturedSprite#setFrame()` und `prepareSpriteFrame()` nehmen `TextureAtlasFrame<unknown>`, `FrameBasedAnimations#add()` `TextureAtlas<unknown>`/`TileSet<unknown>`, `TileSpritesFactory` `tileSet?: TileSet<unknown>` · `FrameBasedAnimations.MaxTextureSize` = 8192; `BakeTextureOptions` `{includeTextureSize?, maxTextureSize?, renderer?: WebGPURenderer}` · `TileSet#options: Readonly<TileSetOptions>` und `TextureResource#tileSetOptions: Readonly<TileSetOptions> | undefined`, beide eingefroren · modulintern `throwCollected(errors, message)` in `src/texture/internals.ts` · Events: `error`, `ready`, `resource:<id>` mit `emitSafe`, `rendererChanged` und `dispose` mit `emitStrict`; `dispose()`/`clearUnused()` werfen gesammelt nach dem Abbau (mehrere als `AggregateError`)

### [x] 2. Display & Frame-Loop: Resize per Observer, Delta-Entkopplung, Hot-Path
- Findings: PERF-001 (medium), BUG-003 (medium), API-002 (low), CONS-002 (low), PERF-007 (low), ASYNC-001 (low), BUG-012 (low)
- Nebenbefund gleicher Ursache im Paket: `instanceof HTMLElement` in `Display.ts:923` weist Canvas und Host aus einem same-origin-iframe ab (low) — gehört zur Realm-Ursache von CONS-002
- Ziel: `Display` misst seine Größe ereignisgetrieben im richtigen Realm, und die Frame-Loops liefern korrekte, allokationsarme Zeitdaten auch nach Pausen und bei niedriger Framerate.
- Bereich: `packages/twopoint5d/src/display/` (plus Browser-Tests in `packages/twopoint5d-testing/test/`)
- Detail: `docs/remediation/paket-2.md`
- Hängt ab von: —
- Hash: 261bbd73
- Ergebnis: 1 Runde · alle sieben Findings und der Nebenbefund `instanceof HTMLElement` behoben (Reviewer-Urteil je ID in der Paketdatei) · Regressionstests u. a. `starts the delta anew once the loop has lost its last subscriber and got one again`, `reports a renderer whose animation loop fails once per error, and leaves no unhandled rejection`, `lets a FixedFrameLoop keep up with the wall clock on a display at 20 fps`, `is rawDeltaTime, not the deltaTime that maxDeltaTime of the display has cut`, `a resize() of your own measures within resizePollIntervalMs, and leaves the measurements of the frames where they were`, `size watch › measures nothing in the frames after the first as long as nothing reports a change`, `takes visibility, pixel ratio, window size and the default styleSheetRoot from the document of its canvas`, Browser `measures nothing in the frames after the first two as long as its size source does not change` und `takes a canvas in the document of a same-origin iframe, and measures and styles it there` (alle vor dem Fix rot) · Runde 1: Migration Guide und JSDoc nennen das eine Frame Verzögerung einer Observer-Meldung, CHANGELOG ohne Rückblick, `BREAKING CHANGE:`-Footer, fünf kleine Befunde mitgenommen · klein offen: keine
- Nebenbefunde: → Queue
- Folgen: —
- Schnittstellen: `Chronometer#rawDeltaTime` (Getter, neu) · `DisplayEventProps.rawDeltaTime: number` Pflichtfeld nach `deltaTime` — wer die Props als Literal baut, muss es setzen · `FixedFrameLoop` akkumuliert `rawDeltaTime`, Fallback `deltaTime`, wenn nicht endlich · `Display#resize()` misst immer, `resizePollIntervalMs` gilt nur im Frame · `Display` misst ereignisgetrieben (`ResizeObserver` mit `device-pixel-content-box`, `matchMedia` auf das Pixelverhältnis, `resize` des Fensters), Änderung kommt ein Frame nach der Meldung an; gepollt wird mit `resizeToCallback` oder ohne `ResizeObserver`/`matchMedia` · Dokument und Fenster des Canvas statt globaler (Default `styleSheetRoot` = `head` des Canvas-Dokuments); Canvas/Host aus same-origin-iframe angenommen · `getContentAreaSize()` bleibt öffentlich, `Display` nutzt sie nicht mehr · Testhelfer `makeIframeDocument({width?, height?})` in `packages/twopoint5d-testing/test/helpers/fixtures.js` gibt `{iframe, doc}` zurück, Aufräumen beim Aufrufer

### [x] 3. Map2D, Sprites, Vertex Objects: Atomarer Streamer-Setter und Feinschliff
- Findings: BUG-128 (low), DOC-077 (low), DOC-075 (info), PERF-033 (info), PERF-034 (info), READ-024 (info), READ-026 (info), READ-027 (info)
- Ziel: `Map2D#tileStreamer` wechselt atomar, JSDoc und Kommentare stimmen mit dem Verhalten überein, und die Kleinst-Befunde in Sprites und Vertex Objects sind erledigt.
- Bereich: `packages/twopoint5d/src/map2d/`, `src/sprites/`, `src/vertex-objects/`
- Detail: `docs/remediation/paket-3.md`
- Hängt ab von: —
- Hash: fc40b690
- Ergebnis: 0 Runden · alle acht Findings behoben (Reviewer-Urteil je ID in der Paketdatei) · Regressionstests `leaves the map and every renderer on the streamer it has when a clearTiles() throws, and moves them with the next assignment` und `answers the same key for the color textures of a multisampled and a single-sampled render target` (beide vor dem Fix rot) · dazu `a second call after a clearTiles() that threw takes off the renderers that are left` und `keeps the nearest tiles of each view when one visibility follows a camera that moves and climbs` (halten Zusagen fest, vorher schon grün) · klein offen: keine
- Nebenbefunde: → Queue
- Folgen: —
- Schnittstellen: `Map2D#tileStreamer` hängt bei einem werfenden `clearTiles()` die schon abgenommenen Renderer an den bisherigen Streamer zurück und wirft weiter · `textureShapeKey()` (intern) setzt das Samples-Bit nur für Tiefentexturen · `CameraBasedVisibility#searchCanStop(next)` privat, ein Parameter, Stoppdistanz in `#searchStop`


### [x] 4. Drain: Nebenbefunde aus Texturen, Display und Vertex Objects
- Nebenbefund: alle acht Einträge aus »Offene Befunde« mit `→ Paket 4` — `TileSet#tileCount`/`firstFrameId` von außen schreibbar (low); `[[…]]`-Links in der TSDoc von `TileSet` (info); leerer Name in `FrameBasedAnimations#add()` (low); `Chronometer` nimmt `±Infinity` an (low); `FixedFrameLoop#maxStepsPerFrame` nimmt nicht-ganzzahlige Werte (low); Positionsverweis im Kommentar von `TextureAtlasLoader.spec.ts:164` (info); `VertexObjectDescriptor#voPrototype` »Written once« nicht erzwungen (low); verdrehte JSDoc von `checkBasePrototype()` (info)
- Ziel: Die in den Paketen 1–3 aufgefallenen Nebenbefunde der Scope-Features sind behoben, sodass Texturen, Display und Vertex Objects ohne offenen Befund dastehen.
- Bereich: `packages/twopoint5d/src/texture/`, `src/display/`, `src/vertex-objects/`
- Detail: `docs/remediation/paket-4.md`
- Hängt ab von: —
- Hash: 98f2f561
- Ergebnis: 0 Runden · alle acht Nebenbefunde behoben (Reviewer-Urteil je Eintrag in der Paketdatei) · Regressionstests `tileCount and firstFrameId are read-only › a write to either throws a TypeError and leaves the layout as it is`, `a refusal of an animation with the empty string as its name calls it (no name)`, Block `a time that is not finite` in `Chronometer.spec.ts` (für `±Infinity`), `maxStepsPerFrame refuses 2.5`, `ignores a DefaultMaxStepsPerFrame of 2.5 and takes 5`, `keeps the whole number it has when it is handed a fraction, and runs no tick above it`, `the vertex object prototype › is written once: a second write throws and leaves the first prototype in place` (alle vor dem Fix rot) · klein: überlange TSDoc-Zeile an `FrameBasedAnimations#add()` (`FrameBasedAnimations.ts:251`), Kommentar über `if (!name)` als angehängte dritte Zeile (`:383–385`)
- Nebenbefunde: keine
- Folgen: —
- Schnittstellen: `TileSet#tileCount` und `TileSet#firstFrameId` sind Getter ohne Setter · `Chronometer` nimmt ein nicht endliches `time` als nicht angegeben · `FixedFrameLoop#maxStepsPerFrame` und `DefaultMaxStepsPerFrame` nehmen nur ganze Zahlen ≥ 1 · der interne Setter `VertexObjectDescriptor#voPrototype` wirft beim zweiten Schreiben · Fehlermeldungen von `FrameBasedAnimations#add()` nennen `''` als `(no name)`


### [x] 5. Folgen: Guard-Duplikate, Migration Guide und Kommentarform
- Folge von: Paket 1, Paket 4
- Folgen: aus Paket 1 — wortgleiche lokale `isObject`-Guards in `src/texture/FrameBasedAnimations.ts:140`, `src/texture/frameTrimMargins.ts:8` und `src/texture/checkTextureStoreData.ts:14` (ein gemeinsamer Helfer in `src/utils/`); das Before-Beispiel des Migration Guide in `packages/twopoint5d/CHANGELOG.md` (um Zeile 3180, Abschnitt zur Typisierung der Frame-Daten) hätte auch vor der Änderung nicht kompiliert; ~~doppelte Leerzeile vor `## [0.21.2]` in `packages/twopoint5d/CHANGELOG.md`~~ entfallen, `261bbd73` hat sie genommen · aus Paket 4 — überlange TSDoc-Zeile an `FrameBasedAnimations#add()` (`FrameBasedAnimations.ts:251`); Kommentar über `if (!name)` als angehängte dritte Zeile eines fremden Kommentars (`FrameBasedAnimations.ts:383–385`)
- Ziel: Was die Pakete 1 und 4 an Duplikaten, falschen Doku-Beispielen und Kommentarform hinterlassen haben, ist bereinigt.
- Bereich: `packages/twopoint5d/src/texture/`, `src/utils/`, `packages/twopoint5d/CHANGELOG.md`
- Detail: docs/remediation/paket-5.md
- Hängt ab von: —
- Hash: 35e7942e
- Ergebnis: 0 Runden · Folgen (a), (b), (d), (e) behoben, (c) entfallen (Reviewer-Urteil je Folge in der Paketdatei) · kein Regressionstest mit rotem Lauf, kein Korrektheitsfix; neue Spec `isObject` hält den Vertrag fest · klein offen: keine
- Nebenbefunde: keine
- Folgen: —
- Schnittstellen: interner Helfer `isObject(value: unknown): value is Record<string, unknown>` in `src/utils/isObject.ts` (nicht in `public-api.ts`); `frameTrimMargins.ts`, `FrameBasedAnimations.ts`, `checkTextureStoreData.ts` nutzen ihn
