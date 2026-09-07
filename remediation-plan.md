# Remediation-Plan — @spearwolf/twopoint5d

Quelle: ./audit.html vom 2026-09-04 · Branch: main · erstellt: 2026-09-06
Baseline: `pnpm lint` ✓ · `pnpm build` ✓ · `pnpm typecheck` ✓ · `pnpm test:ci` ✓ · `pnpm test:browser` ✓ · `pnpm checkPkgTypes` ✓ · `pnpm checkNameableTypes` ✓ · `pnpm lintPkg` ✓ — alles grün, keine vorbestehenden Fehler
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/aef04043-767e-48bc-89ef-e122713089e8/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Lauf-Status: Schleife durch (2026-09-06 21:40) · Abschluss offen — Schritt 7 der SKILL.md mit references/semver-and-closeout.md
Scope: 19 vom Nutzer benannte Findings (2 high, 6 medium, 11 low) · ausgenommen: alles Übrige, insbesondere `acknowledged`
Scope-Regel: Befunde aus BUG und PERF, die im berührten Code auffallen und mindestens medium sind, werden in diesem Lauf mit behoben — auch wenn sie im Audit fehlen. Alles andere geht als neues, offenes Finding ins Audit.
Stand (2026-09-06): Paket 1 committet (8f249ea) · Paket 2 committet (946f0bc) · Paket 3 committet (b8674c3) · Paket 4 committet (5c1db02) · Paket 5 committet (5a34e20) · Paket 6 committet (c83b0da) · Paket 7 committet (515575a) · Paket 8 committet (085ac4d) · kein Paket mehr offen, der Abschluss steht aus · Arbeitsbaum sauber (nur `remediation-plan.md` geändert)

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[!]` blockiert.

## Entscheidungen

- Neu auffallende Befunde: BUG und PERF ab medium im berührten Code kommen in diesen Lauf, der Rest geht ins Audit zurück (2026-09-06)
- API-032 — `cammeraBasedVisibility` wird **hart umbenannt**, kein Alias, kein Deprecation-Zyklus (2026-09-06)
- CONS-013 — numerischer Schlüssel im Hot-Path **und** eine geteilte `tileKey()`-Funktion, die `Map2DTileCoords.createID` und `Map2DSpatialHashGrid.getKey` auf ein Format zieht; die beiden öffentlichen String-Formate ändern sich damit (2026-09-06)
- API-041 — der Lebensdauer-Vertrag wird im TSDoc von `IMap2DVisibleTiles` festgeschrieben, die Scratch-Vektoren werden **nicht** geklont; Klonen liefe der Stoßrichtung von PERF-013 im selben Lauf zuwider (2026-09-06)
- BUG-035 — der `VertexObjectBuffer`-Zweig **übernimmt** die mitgelieferten Pufferdaten, statt sie laut abzulehnen; das ist das Verhalten, das der andere Konstruktorzweig bereits zeigt (2026-09-06, entschieden aus der Empfehlung)
- Release-Folge: die beiden Entscheidungen zu API-032 und CONS-013 sind Breaking Changes. Der Lauf endet damit auf einem Major, nicht auf einem Patch — das wird beim Abschluss bewertet, nicht hier (2026-09-06)

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

Projektspezifisch, aus `CLAUDE.md` und `AGENTS.md`:

- Conventional Commits, Commit-Messages auf Englisch (so zeigt es `git log`).
- Quell-Importe tragen die `.js`-Endung (NodeNext), Typ-Importe laufen über
  `import type` — `@typescript-eslint/consistent-type-imports` ist scharf.
- `no-console` ist in `.ts`/`.js` ein Fehler.
- Ein neues öffentliches Symbol steht erst dann im Paket, wenn es in der
  passenden `public-api.ts` re-exportiert ist.
- Wer Rendering- oder GPU-Puffer-Code anfasst, legt zusätzlich einen
  Browsertest in `packages/twopoint5d-testing/test/` an.
- Catalog-Deps (`three`, `@spearwolf/eventize`, `@spearwolf/signalize`) werden
  nur in `pnpm-workspace.yaml` bewegt, nicht in einzelnen `package.json`.

## Vorbestehende Fehler

Keine. Die Baseline war auf allen acht Kommandos grün.

## Offene Befunde

Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [ ] `packages/twopoint5d/src/display/Display.ts:808` — `dispose()` gibt den Renderer frei, lässt aber das `<div>` und das `<canvas>`, die der Konstruktor im Host-Element angelegt hat (`:391-402`), im DOM stehen. Selbst gebaute Knoten, die niemand abräumt. Aus Paket 1. BUG, medium → Scope
- [ ] `packages/twopoint5d/src/controls/PanControl2D.ts:198-220` — das Control hört auf `document`; liegt es in einem Shadow Root, retargetiert der Browser `event.target` auf den Host, und `#toRelativeCoords` misst dessen Rechteck statt des Canvas. Der Pan rechnet dort gegen die falsche Bezugsfläche. Aus Paket 1. BUG, medium → Scope
- [ ] `packages/twopoint5d/src/display/Display.ts:371-413, 416` — die Zweigkette des Konstruktors hat kein `else`: ein erstes Argument, das weder `WebGPURenderer` noch `HTMLElement` ist (`null`, ein beliebiges Objekt, ein `OffscreenCanvas`), fällt durch beide Zweige und stirbt an einer Non-Null-Assertion mit einem nackten `TypeError`. Der `WebGLRenderer`-Fall daneben wirft mit erklärender Meldung. Aus Paket 1. BUG, low → Audit
- [ ] `packages/twopoint5d/src/display/FrameLoop.ts:99-110` — `RAF.stop` setzt `#needsMeasureAnchor`, lässt `measuredFpsCollection` aber gefüllt; nach einer Pause (Tab versteckt, letzter Loop abgemeldet) mittelt das erste neue Sample mit bis zu neun Werten von vor der Pause, und `measuredFps` meldet rund zehn Fenster lang eine Rate, die der Renderer nicht fährt. Aus Paket 1. BUG, low → Audit
- [ ] `packages/twopoint5d/src/controls/PanControl2D.ts:347` — `#toRelativeCoords` castet `event.target as HTMLElement` und ruft `getBoundingClientRect()`; trifft ein Pointer-Event, dessen Target kein Element ist, wirft der Listener, und der Cast verdeckt das für den Compiler. Aus Paket 1. BUG, low → Audit
- [ ] `packages/twopoint5d/src/display/Display.ts:315-320` — `Display.canvas` begründet sein Werfen im TSDoc ausschließlich mit `dispose()`, prüft aber `this.renderer == null`; solange der Konstruktor keinen `else`-Ausgang hat, sind das zwei verschiedene Zustände unter einer Fehlermeldung. Zweite Fundstelle: `packages/twopoint5d/docs/resource-lifecycle.md:135-137` führt denselben Getter samt Wortlaut der Meldung als Beispiel und wandert mit, wenn der Befund fällt. Aus Paket 1, ergänzt in Paket 7. CONS, low → Audit
- [ ] `packages/twopoint5d/src/display/Display.ts:755` — der Kommentar in `renderFrame()` erklärt sich über den Vorzustand (»the double-emit that previously happened on every first frame«); ohne die Historie sagt der Satz nichts. Aus Paket 1. CONS, low → Audit
- [ ] `packages/twopoint5d/src/controls/PanControl2D.ts:355, 374` — `KeyboardEvent.keyCode` ist deprecated (TS 6385); die Tastaturbelegung hängt an einer abgekündigten Eigenschaft. Der Nachfolger `code` ändert die Bedeutung von `PanControl2DOptions.keyCodes` und ist damit ein API-Thema. Aus Paket 1. API, low → Audit
- [ ] `packages/twopoint5d/src/texture/TextureFactory.ts:180-184` — `TextureFactory.load()` reicht keinen `onError`-Callback an `TextureLoader.load()` durch. Eine URL, die nicht lädt, liefert dem Aufrufer eine leere Textur ohne jede Meldung; der Fehler landet allein in der Konsolenausgabe von three.js. Aus Paket 2. BUG, low → Audit
- [ ] `packages/twopoint5d/src/texture/TextureFactory.ts:18` — `TextureOptions.anisotrophy` ist öffentlich exportiert und sagt in keinem TSDoc, auf welcher Skala es zählt. Es beginnt bei 0 (= keine anisotrope Filterung), three.js zählt ab 1. Wer `getOptions()` direkt auswertet und das Ergebnis auf eine Textur legt, baut das tote Feld neu. Aus Paket 2. DOC, low → Audit
- [ ] `packages/twopoint5d/src/texture/TextureStore.ts:54` — das TSDoc von `TextureStoreEvents.Error` nennt als Quellen `'fetch'|'parse'|'atlas'|'image'`; der Store emittiert nur `fetch` und `parse` (`:272, 279, 285`), `atlas` und `image` kommen von `TextureResource` (`TextureResource.ts:435, 505`) und erreichen den Store nie. Wer sich auf die Liste verlässt, wartet am Store auf ein Event, das dort nicht ankommt. Aus Paket 2, Zug 0. DOC, low → Audit
- [ ] `packages/twopoint5d/src/controls/PanControl2D.ts:62` — `cursorStylesTarget` hat kein eigenes TSDoc, obwohl die Nachbaroptionen alle eins haben und der Default (`document.body`) nur im Text von `styleSheetRoot` auftaucht. Aus Paket 1. DOC, low → Audit
- [ ] `packages/twopoint5d/src/stage/OrthographicProjection.ts:31` und `packages/twopoint5d/src/stage/ParallaxProjection.ts:33` — der Konstruktor-Parameter heißt `specs?: OrthographicProjectionSpecs` bzw. `specs?: ParallaxProjectionSpecs`, während das Feld `viewSpecs`, in das er landet, als `Partial<…>` deklariert ist. Dieselbe zu enge Deklaration wie bei `fitIntoRectangle`, nur eine Ebene höher; wer eine Projektion mit einem Teil-Spec baut, braucht einen Cast. Aus Paket 4. TYPE, low → Audit
- [ ] `packages/twopoint5d/src/stage/StageRenderer.spec.ts:496, 624` — beide Stellen rufen `toThrowError`, das Vitest als deprecated führt (TS 6385). Der Nachfolger heißt `toThrow`. Aus Paket 4. CONS, low → Audit
- [ ] `packages/twopoint5d/src/stage/ParallaxProjection.ts:78` — über `getZoom()` steht `// TODO add jsdoc`; die Methode ist öffentlich und hat als einzige ihrer Nachbarschaft keine Doku. Aus Paket 4. DOC, low → Audit
- [ ] `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:80-82` — die Belegtmarke einer wiederverwendeten Kachel wird über `tile.x - tileCoords.tileLeft` in `#tileCreated` geschrieben. Ändert sich das Kachelraster zur Laufzeit (`Map2D.tileWidth`, `tileHeight`, `xOffset`, `yOffset`), passen die Indizes der alten Kacheln nicht mehr zum neuen Raster; der Schreibzugriff läuft ins Leere (ein `TypedArray` verschluckt einen Index außerhalb seiner Länge lautlos), und für dieselbe Fläche entsteht zusätzlich eine neue Kachel. Sichtbar als doppelt belegte Zellen, bis sie aus dem Sichtfeld wandern. Kein Aufrufer im Repo ändert das Raster nach dem Aufbau. Aus Paket 5, Zug 0. BUG, low → Audit
- [ ] `packages/twopoint5d/src/utils/Dependencies.ts:57-74` — `update()` schreibt jeden Schlüssel aus `nextProps` in den Zustand, `equals()` vergleicht nur die im Konstruktor deklarierten Props. Ein Schlüssel, den niemand deklariert hat — ein Tippfehler im Aufrufer —, wird gespeichert und nie beobachtet; `changed()` meldet für ihn nie etwas, ohne dass irgendwo etwas auffällt. Aus Paket 5, Zug 0. BUG, low → Audit
- [ ] `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:63-71` — `clearTiles()` erhöht `#dataSerial` auch dann, wenn der Renderer gar keine Kachel hielt. Das nächste `endUpdatingTiles()` ruft daraufhin `factory.update()` und schiebt die vollen Attribut-Puffer zur GPU, obwohl sich nichts geändert hat. Einmalig je leerem Clear, nicht je Frame. Aus Paket 5, Zug 0. PERF, low → Audit
- [ ] `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:99` — `this.tiles = visible?.tiles;` steht innerhalb von `if (visible)`; der Optional-Chaining-Operator kann dort nie greifen und liest sich wie ein Hinweis auf einen Fall, den es nicht gibt. Aus Paket 5, Zug 0, vom Reviewer bestätigt. CONS, low → Audit
- [ ] `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:94-102` — `frustumBoxScale` (`:60`, öffentlich und schreibbar) steht nicht in der Abhängigkeitsliste des Dirty-Checks, geht aber in die Sichtbarkeitsrechnung ein (`:335`). Wer das Feld zur Laufzeit ändert, bekommt bis zur nächsten Kamerabewegung den alten Kachelsatz. Ab diesem Paket wiegt das schwerer: der Cache-Pfad sagt dazu `changed: false`, und ein Konsument liest das als »der Kachelsatz stimmt noch«. Paket 6 hängt `CameraBasedVisibility.serial` an denselben Dirty-Check: die Sichtbarkeits-Helfer bauen nach einer Änderung an `frustumBoxScale` ebenfalls nicht neu. Aus Paket 5, ergänzt in Paket 6, Zug 0. BUG, low → Audit
- [ ] `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:44-53` — liefert `createTile()` `undefined`, landet nichts in `#tiles`; bei `TileSpritesFactory` ist das jede Kachel mit tileId 0. Jeder folgende `reuseTile()` fällt darum wieder in `addTile()` und ruft `createTile()` erneut — je Frame und je Lückenkachel, auch bei stehender Kamera. Eine Karte mit Löchern zahlt einen Nachschlag im Tile-Data-Provider je Loch und Frame. Aus Paket 5. PERF, low → Audit
- [ ] `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts:216-217` — der Kommentar »translate by 0 still bumps the equality gate via a fresh Matrix4 instance« sagt das Gegenteil des Codes: `Dependencies.cloneable<Matrix4>` vergleicht über `.equals()`, also wertbasiert, und eine frische Identitätsmatrix bricht das Gate gerade nicht. Was es bricht, ist die Translation um `0.0001` im Aufruf davor. Der Test läuft richtig, seine Begründung ist falsch. Aus Paket 5. CONS, low → Audit
- [ ] `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:43-59` — `update()` legt je Aufruf einen `Box3`, zwei `Vector3` und einen `Box3Helper` samt Geometrie und Material an und gibt den Helfer des Vorgängeraufrufs frei. Die Lookbook-Demo `map2d-rect-visi.ts:111` ruft das je gerendertem Bild. Dieselbe Bauart wie in `CameraBasedVisibilityHelpers`, aber eine zweite, eigenständige Implementierung — kein gemeinsamer Code, deshalb nicht in Paket 6 mitgenommen. Aus Paket 6, Zug 0. PERF, low → Audit
- [ ] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:106` — `createHelpers()` sucht mit `document.querySelector('.map2dCoords')` ein Element im Host-Dokument und schreibt die Ebenenkoordinaten hinein; darüber steht `// TODO remove this!` von der Autorenseite. Eine Bibliotheksklasse, die an einen CSS-Klassennamen der Anwendung gebunden ist, und der einzige Grund, warum die Spec `document` stubben muss. Aus Paket 6, Zug 0. CONS, low → Audit
- [ ] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:150` — `maxDebugHelpers` (`:37`) kappt die Frustum-Helfer der Nicht-Primärkacheln über den Laufindex `i` durch `visibles` statt über die Zahl der bereits gebauten. Stehen die ersten neun Einträge auf `primary`, entsteht kein einziger; die Kachelbox-Helfer daneben kappt das Feld gar nicht, obwohl sein Name über den ganzen Satz spricht. Aus Paket 6, Zug 0. CONS, low → Audit
- [ ] `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:231-234` — trifft die Kamera die Ebene nicht, kehrt `findVisibleTiles()` zurück, ohne `this.visibles` zu leeren. Das öffentliche Feld trägt danach die Kacheln der letzten erfolgreichen Neuberechnung samt ihrer alten `box`- und `frustumBox`-Werte, während das Ergebnis einen leeren Kachelsatz meldet. Wer `visibles` liest — die Sichtbarkeits-Helfer tun genau das — zeichnet Kachelboxen für eine Ansicht, die es nicht mehr gibt. Vorbestehend: derselbe Zweig ohne Leerung steht in `git show c16ce54:…:205-208`. Aus Paket 6, ergänzt in Paket 8: das TSDoc von `serial` und `visibles` beschreibt seit Paket 8 genau dieses Verhalten — wer den Befund behebt, zieht die beiden Absätze mit. BUG, low → Audit
- [ ] `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:33-40` — im `if`-Zweig von `add()` steht `tileSet.add(renderable)`, und direkt hinter dem `else` steht dieselbe Zeile noch einmal für beide Zweige. Der Aufruf im `if`-Zweig ist wirkungslos, der Zweig selbst braucht keinen Rumpf. Vorbestehend, unverändert seit `git show c16ce54:…:26-33`. Aus Paket 6. CONS, low → Audit
- [ ] `packages/twopoint5d-testing/test/display-adopt-renderer.test.js:19-23` — der Kommentar über dem `afterEach` sagt »the renderer belongs to this file, not to the display«, vier Zeilen darunter steht das Gegenteil. Gemeint ist die Aufräumpflicht der Testdatei, nicht Ownership im Sinne von §2 des Lebenszyklus-Dokuments; formuliert ist es als Eigentumsaussage und steht damit quer zur Übernahme, die das Konstruktor-TSDoc ausspricht. Vorbestehend, der Absatz stammt aus Paket 1. Aus Paket 7. CONS, low → Audit
- [ ] `packages/twopoint5d/src/map2d/HelpersManager.ts:61-63` — das TSDoc von `removeFromScene()` sagt »Takes every node this manager added to `scene` out of it«, verschweigt aber die Rekursion bei `:76-78`: außer der übergebenen Szene wird immer auch `root` geräumt. Genau diese Asymmetrie ist die Ursache, aus der Paket 8 entstanden ist; der Manager selbst stand dort auf »Nicht anfassen«. Öffentliche Fläche über `map2d/public-api.ts`. Vorbestehend, identisch in `git show c16ce54:…:61-78`. Aus Paket 8. DOC, low → Audit
- [ ] `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:39-41` — `remove(scene)` hat kein eigenes TSDoc und erbt in der IDE keins; dass ein Aufruf mit fremder Szene hier über die `root`-Rekursion den ganzen Satz herunternehmen kann, steht allein am Interface. Der Nachbar `CameraBasedVisibilityHelpers.remove()` trägt seit Paket 8 einen eigenen Block. Vorbestehend, unverändert seit `git show c16ce54:…:39-41`. Aus Paket 8. DOC, low → Audit
- [ ] `packages/twopoint5d/src/map2d/types.ts:143-150` — `IMap2DVisibilitor.computeVisibleTiles()` gibt `IMap2DVisibleTiles | undefined` zurück und sagt nirgends, was das `undefined` bedeutet. Seit Paket 8 tragen die Nachbartypen in derselben Datei TSDoc, dieses Mitglied nicht. Öffentliche Fläche über `map2d/public-api.ts`. Vorbestehend, ohne TSDoc seit `git show c16ce54:…:100-107`. Aus Paket 8. DOC, low → Audit
- [ ] `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts:51` — `spyOnReleases()` legt `type: node.type` in sein Rückgabeobjekt, und kein Test liest das Feld je. Totes Feld in einem Testhelfer. Vorbestehend, dieselbe Zeile in `git show c16ce54:…:29`. Aus Paket 8. CONS, low → Audit
- [ ] `packages/twopoint5d/src/stage/README.md:47` und `:437-439` — `Canvas2DStage.dispose()` ist in derselben Datei zweimal beschrieben, in der Übersichtstabelle und im Lebenszyklus-Abschnitt. Zwei Fassungen einer Zusage, die gemeinsam gepflegt werden müssen; genau durch diesen Riss ist die Tabellenzeile falsch geworden. Eine Zusammenführung ist mehr als eine Satzkorrektur. Vorbestehend, beide Fassungen stehen so seit `5e8d036`. Aus Paket 7. CONS, low → Audit

## Pakete

### [x] 1. Display: Renderer-Konstruktor, Stylesheet je Root, FPS-Fenster, Rückgabe von start()

- Findings: BUG-002 (high), BUG-049 (medium), BUG-051 (low), API-002 (low)
- Ziel: Der Konstruktorweg mit fertigem Renderer läuft, jeder Root bekommt sein eigenes Stylesheet, und `FrameLoop` mittelt über das angeschriebene Fenster und meldet immer eine Abmeldefunktion.
- Bereich: `packages/twopoint5d/src/display/`
- Hängt ab von: —
- Hash: 8f249ea
- Ergebnis: 2 Runden · BUG-002, BUG-049, BUG-051 und API-002 alle behoben, von zwei Reviewern
  bestätigt · Verify `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` exit 0,
  Log `paket-1.verify.log` · Regressionstests, alle vor dem Fix rot gesehen:
  `display-adopt-renderer.test.js` (»adopts the renderer and the canvas it brings«,
  »starts and renders a frame« — beide mit `TypeError: Cannot read properties of undefined
  (reading 'then')`), `stylesheets.test.js` (»installs its rule in the root it was given«),
  `FrameLoop.spec.ts` (»averages the fps over MEASURE_COLLECTION_SIZE samples, not one more« —
  57 statt 60; »start() hands back an unsubscribe function for a target that is already on the
  loop« — `undefined` statt `function`), `pan-control-stylesheet-root.test.js` (»installs the
  cursor rule in the root it was given«) · klein, nicht behoben: `Stylesheets.ts:37-47` sagt im
  TSDoc nicht, dass die Trennung einen Shadow Root voraussetzt und ein Root im Lichtbaum nur das
  Blatt trennt, nicht die Kaskade; `display-adopt-renderer.test.js` fährt keinen Fall mit einem
  vorab per `await renderer.init()` hochgefahrenen Renderer, obwohl dessen Idempotenz die
  tragende Annahme des Fixes ist
- Abbruch der Fehlerkette: Runde 2 hatte einen Doku-Absatz in `docs/resource-lifecycle.md`
  nachzutragen und brachte statt der Senkung zwei neue Befunde in genau dieser neuen Passage
  (1 offen vor der Runde, 2 danach). Der Absatz stand in keinem Schritt des Detailplans — der
  Bereich des Pakets ist `display/` —, er kam über eine Höherstufung eines als `klein`
  eingestuften Reviewer-Befunds herein. Die Höherstufung ist zurückgenommen und die Änderung an
  der Datei verworfen; der Sachverhalt läuft als Folge über Paket 7. Die beiden anderen
  Doku-Punkte derselben Runde (`PanControl2D.ts`) sind erledigt und im Commit.
- Nebenbefunde: → »Offene Befunde«
- Folgen:
  - `packages/twopoint5d/docs/resource-lifecycle.md:19-22, 276, 328-337` — die Ownership-Regel
    des Projekts (»was hereingereicht wurde, gehört dem Aufrufer und wird nicht disposed«) kennt
    die Übernahme des adoptierten `WebGPURenderer` nicht; Checkliste §7 und Assertion (b) in §8
    formulieren sie ebenso absolut. Erst dieses Paket macht den Weg erreichbar. → Paket 7
  - `packages/twopoint5d/CHANGELOG.md:109, 113` — der Abschnitt »Unreleased« beschreibt das
    Stylesheet als eines für das ganze Modul und die Cursor-Regel als von »every control of the
    module« geteilt; nach diesem Paket gilt beides je Root. Dazu fehlt ein »Added«-Eintrag für
    `PanControl2DOptions.styleSheetRoot`. → Abschluss des Laufs, wo das CHANGELOG ohnehin
    geschrieben wird (Schritt 9 des Detailplans nimmt es aus)
- Schnittstellen:
  - `FrameLoop.start(target: object): () => void` — gibt auf **jedem** Weg eine Abmeldefunktion
    zurück, auch für ein bereits angemeldetes und für ein fehlendes `target`; der Rückgabetyp
    trägt kein `undefined` mehr
  - `Stylesheets.getGlobalSheet(root?)` und `Stylesheets.installRule(name, css, root?)` —
    Signaturen unverändert, aber ein Blatt **je Root** statt eines je Modul; ein Name trägt seine
    Regel nur noch innerhalb eines Roots, und `getGlobalSheet` legt für einen unbekannten Root
    beim ersten Aufruf ein frisches, leeres Blatt an
  - `PanControl2DOptions.styleSheetRoot?: HTMLElement | ShadowRoot` — neues optionales Feld,
    Default `document.head`; muss denselben Root meinen wie `cursorStylesTarget`
  - `Display` — der Konstruktor **adoptiert** einen hereingereichten `WebGPURenderer` samt seinem
    `domElement`; `Display.dispose()` ruft dessen `dispose()`. Ein Renderer, der das Display
    überleben soll, gehört nicht in diesen Konstruktor. Steht im TSDoc der Konstruktor-Signatur
    (`Display.ts:352-362`)

### [x] 2. Texture: Anisotropie, Klassen-Priorität, Fehlerausgang und gehaltener ready-Wert

- Findings: BUG-050 (high), BUG-039 (medium), BUG-040 (medium), BUG-041 (medium)
- Ziel: Texturoptionen erreichen three.js, Item-Klassen schlagen Store-Defaults, ein Ladefehler bricht die statische `load()` ab statt sie hängen zu lassen, und ein `unsubscribe()` lässt den gehaltenen `ready`-Wert stehen.
- Bereich: `packages/twopoint5d/src/texture/` (`TextureFactory.ts`, `TextureStore.ts`)
- Hängt ab von: —
- Hash: 946f0bc
- Ergebnis: 1 Runde · BUG-050, BUG-039, BUG-040 und BUG-041 alle behoben, vom Reviewer je mit
  Fundstelle bestätigt · Verify `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser`
  exit 0, Log `paket-2.verify.log`; `lint` und `typecheck` zusätzlich mit `--skip-nx-cache`
  nachgefahren, weil sie im ersten Lauf zu 100 % aus dem Nx-Cache kamen · 14 Regressionstests,
  alle vor dem Fix rot gesehen, in `TextureFactory.spec.ts` (neu) und `TextureStore.spec.ts`:
  fünf zur Anisotropie (`expected 1 to be 4`, `expected 1 to be 2`, `expected 1 to be 8`,
  `expected NaN to be +0`, `expected 1 to be 2`), drei zur Klassenreihenfolge in der Factory
  (`expected false to be true`, `expected 'srgb' to be 'srgb-linear'`, `expected 4 to be +0`),
  zwei zum Vorrang des Items (`expected [ 'linear', 'nearest' ] to deeply equal
  [ 'nearest', 'linear' ]` und dasselbe für `flipy`), zwei zum gehaltenen ready-Wert
  (`expected [ 'rendererChanged' ] to include 'ready'`, `expected 'pending' to be 'ready'`) und
  zwei zum Fehlerausgang der statischen `load()` (je `expected 'pending' to be an instance of
  Error`) · dazu der Browsertest `texture-factory-anisotropy.test.js` gegen einen echten
  `WebGPURenderer`, in Chromium und Firefox · zwei Abweichungen vom Detailplan, beide abgenommen:
  alle zehn Zeilen der Prioritätstabelle getestet statt der im Fließtext genannten acht (die
  Tabelle hat zehn), und `= undefined` als Startwert der beiden Abmelde-Variablen, weil
  `prefer-const` die Form ohne Initialisierer bricht
- Klein, nicht behoben — vom Reviewer eingestuft, keine Runde ausgelöst:
  - `src/texture/TextureStore.spec.ts:1057, 1067` — beide Fehlertests prüfen nur
    `toBeInstanceOf(Error)`. Die Zusage, dass die Ablehnung die echte Ursache nennt und nicht den
    Fehler aus `dispose()`, bliebe grün, wenn `dispose()` wieder in den Listener rutschte. Eine
    Erwartung auf `/failed at the fetch step/` bzw. `/parse step/` unterscheidet die Ausgänge.
  - `packages/twopoint5d-testing/test/texture-factory-anisotropy.test.js:33, 43` — die Erwartung
    leitet sich aus derselben Quelle ab, die die Implementierung liest. Auf einem Backend, das `1`
    meldet, schrumpfen beide Fälle auf `1 === 1`, was der defekte Stand ebenso erfüllt hätte. Ein
    Gate auf `getMaxAnisotropy() > 1` hielte ihn überall zu einem Regressionstest.
  - `src/texture/TextureFactory.ts:115-121` — der `catch` um `getMaxAnisotropy()` schluckt jeden
    Fehler, und `#maxAnisotrophy` friert im Konstruktor ein. `TextureStore.ts:214` baut die Factory
    in dem Moment, in dem der Renderer zugewiesen wird; geschieht das vor `renderer.init()`, liefert
    dieser Store dauerhaft und lautlos `anisotropy: 1`. Der Zweig hat keinen Test.
  - `src/texture/TextureFactory.ts:148` — `getOptions()` gibt `anisotrophy` auf der Skala der
    Factory zurück (0 = aus), `update()` schreibt die Skala von three.js (ab 1). Die einzige Notiz
    dazu ist ein Inline-Kommentar in `update()` und erreicht die `.d.ts` nie.
- Nebenbefunde: → »Offene Befunde«
- Folgen:
  - `packages/twopoint5d/CHANGELOG.md` — drei Verhaltensänderungen an der öffentlichen Oberfläche
    wollen einen Eintrag: eine Texturklasse eines Items überstimmt jetzt den Store-Default gleicher
    Breite; `no-anisotrophy`, `flipy` und `linear-srgb` sind neben ihrem Gegenstück überhaupt erst
    erreichbar; und `TextureStore.load()` (statisch) verwirft ihren Promise bei einem Ladefehler,
    statt offen zu bleiben. → Abschluss des Laufs, wo das CHANGELOG ohnehin geschrieben wird
- Schnittstellen:
  - `TextureFactory.update(texture, ...classNames)` — schreibt die Anisotropie auf
    `texture.anisotropy` in der Zählung von three.js (Minimum 1) und legt kein Feld
    `texture.anisotrophy` mehr an. `getOptions()` behält Signatur und Skala der Factory
    (0 = keine anisotrope Filterung); umgerechnet wird ausschließlich in `update()`
  - `new TextureFactory(renderer, …)` — ein Renderer ohne `getMaxAnisotropy()` oder mit einer
    Methode, die wirft, ergibt Maximum `0` statt `NaN`; der Konstruktor wirft nicht mehr
  - `TextureOptionClasses` — die Priorität hat zwei Stufen nach Breite (1000 für `nearest` und
    `linear`, 500 für alle übrigen). Unter gleich breiten Klassen entscheidet die Reihenfolge, die
    zuletzt genannte gewinnt; eine schmalere Klasse behält das letzte Wort gegen eine breitere.
    Steht als Satz im TSDoc des Typs (`TextureFactory.ts:70-80`)
  - `TextureStore` — die Default-Klassen des Stores werden **vor** den Klassen eines Items
    eingereiht, ein Item überstimmt damit den Store-Default gleicher Breite. Ein doppelt genannter
    Klassenname behält seine letzte Position
  - `TextureStore.load(url)` (statisch) — verwirft ihren Promise bei einem fehlgeschlagenen
    `fetch`, einer Antwort, die kein JSON ist, und einem werfenden `parse()`; der Fehler trägt
    `cause` und nennt den Schritt, der scheiterte. Der für den Versuch gebaute Store ist dann
    bereits disposed. Die Instanz-`load()` ist unverändert und gibt weiter `this` zurück
  - `TextureStore.on(…)` — die zurückgegebene Abmeldefunktion nimmt den gehaltenen `ready`-Wert
    des Stores nicht mehr mit; ein späterer Abonnent bekommt ihn weiterhin

### [x] 3. VertexObjectBuffer übernimmt die mitgelieferten Pufferdaten in beiden Konstruktorzweigen

- Findings: BUG-035 (medium)
- Ziel: `new VertexObjectBuffer(otherBuffer, buffersData)` liefert einen Puffer mit den übergebenen Daten, nicht mit Nullarrays.
- Bereich: `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`
- Hängt ab von: —
- Hash: b8674c3
- Modell: mittlere Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts`,
  `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.spec.ts`,
  `packages/twopoint5d-testing/test/vertex-objects-buffers-data.test.js` (neu)
- Vorgehen:
  1. Zuerst der rote Lauf, in `packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.spec.ts`,
     direkt hinter dem Test `construct with vertex-object-descriptor` (`:96-167`). Zwei neue
     Tests, der Descriptor wird wie in den Nachbartests lokal im Test gebaut (vertexCount 4,
     Attribute `foo` `{components: ['x','y'], type: 'float32', usage: 'dynamic'}`, `bar`
     `{size: 1, type: 'float32', usage: 'static'}`, `plah` `{components: ['a','b','c'], type:
     'float32', usage: 'static'}`, `zack` `{components: ['zick'], type: 'float32', usage:
     'static'}`) — daraus entstehen die Puffer `static_float32` (itemSize 5) und
     `dynamic_float32` (itemSize 2), bei capacity 2 also Arrays der Länge 40 und 16. Kein
     gemeinsamer Helfer, kein Umbau der vorhandenen Tests.

     `a buffer source takes the typed arrays of the buffers data it is handed` — der einzige
     Test, der vor dem Fix rot ist:

     ```ts
     const source = new VertexObjectBuffer(descriptor, 1);
     const buffersData = {
       capacity: 2,
       usedCount: 1,
       buffers: {
         static_float32: new Float32Array(40).fill(7),
         dynamic_float32: new Float32Array(16).fill(9),
       },
     };
     const vob = new VertexObjectBuffer(source, buffersData);

     expect(vob.capacity).toBe(2);
     expect(vob.buffers.get('static_float32')!.typedArray).toBe(buffersData.buffers.static_float32);
     expect(vob.buffers.get('dynamic_float32')!.typedArray).toBe(buffersData.buffers.dynamic_float32);
     ```

     `a buffer name the buffers data does not mention gets a fresh zeroed array` — derselbe
     Aufbau, `buffers` nennt nur `dynamic_float32`. Erwartet wird, dass `dynamic_float32` die
     übergebene Referenz trägt und `static_float32` ein eigenes `Float32Array` der Länge 40 aus
     lauter Nullen. Er hält den `??`-Ausgang fest, damit ein fehlender Name nicht als `undefined`
     im Puffer landet. (Zug 4 nachgetragen: dieser Test ist vor dem Fix **ebenfalls rot** — der
     ungefixte Zweig ignoriert `buffersData` vollständig, also bekommt auch der genannte
     `dynamic_float32`-Puffer ein frisches Array. Die Annahme »auch vor dem Fix grün« war falsch;
     an Testinhalt und Fix ändert sie nichts.)
  2. Den Browsertest `packages/twopoint5d-testing/test/vertex-objects-buffers-data.test.js`
     anlegen. `web-test-runner.config.js` sammelt `test/**/*.test.js` ein, es ist nichts zu
     registrieren. Fixture-Helfer (`makeContainer`, `disposeDisplay`, `readBack`), `beforeEach`
     mit `Display` und `await display.start()`, `afterEach` und `this.timeout(20000)` werden
     eins zu eins aus dem Nachbarn `vertex-objects-gpu-upload.test.js` übernommen — jede Datei
     dieser Suite trägt ihre Helfer selbst, es gibt kein geteiltes Modul. Wie dort werden
     Geometrie und Pools nicht einzeln abgeräumt; das Display im `afterEach` trägt die Teardown.

     ```js
     const quadDescription = {
       vertexCount: 4,
       indices: [0, 1, 2, 0, 2, 3],
       attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
     };

     it('a pool restored from buffers data renders the values it was handed', async function () {
       const source = new VertexObjectPool(quadDescription, 2);
       source.createVO().setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);

       const buffersData = source.toBuffersData();

       const restored = new VertexObjectPool(quadDescription, 2);
       restored.buffer = new VertexObjectBuffer(restored.buffer, buffersData);
       restored.usedCount = buffersData.usedCount;

       const geometry = new VertexObjectGeometry(restored, 2);
       const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
       scene.add(mesh);

       mesh.update();
       display.renderer.render(scene, camera);
       await display.nextFrame();

       const position = geometry.getAttribute('position');
       expect((await readBack(display.renderer, position)).slice(0, 12)).to.deep.equal([
         0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9,
       ]);
     });
     ```

     Importiert wird `{Display, VertexObjectBuffer, VertexObjectGeometry, VertexObjectPool,
     VertexObjects}` aus `@spearwolf/twopoint5d` und `{MeshBasicMaterial, PerspectiveCamera,
     Scene}` aus `three/webgpu`. Vor dem Fix ist der Test rot: gelesen werden zwölf Nullen.

     Warum dieser Test überhaupt: `VertexObjectBuffer` ist GPU-Puffer-Code, und die Konvention
     oben verlangt dafür einen Browsertest. Er zahlt sich auch aus — nur er zeigt, dass ein
     übernommenes Array nicht bloß im Feld liegt, sondern über die Attribute der Geometrie bis
     in den GPU-Puffer durchgereicht wird. Der Weg
     `toBuffersData()` → neuer Puffer → `pool.buffer =` ist zugleich der Anwendungsfall, den
     das Finding beschreibt; die Bibliothek selbst ruft diesen Konstruktorzweig nirgends auf.
     `readBack()` über `renderer.getArrayBufferAsync()` läuft in dieser Suite bereits in
     Chromium und Firefox.
  3. Der Fix, in `VertexObjectBuffer.ts` im Zweig `source instanceof VertexObjectBuffer`
     (heute ab `:79`, das Audit nennt noch `:50-66`). Die Schleife bei `:86-95` bekommt denselben
     Übernahme-Ausdruck, den der Schwesterzweig bei `:134-136` schon trägt:

     ```ts
     for (const [bufferName, buffer] of source.buffers) {
       this.buffers.set(bufferName, {
         bufferName,
         itemSize: buffer.itemSize,
         dataType: buffer.dataType,
         usageType: buffer.usageType,
         typedArray:
           buffersData?.buffers[bufferName] ??
           createTypedArray(buffer.dataType, this.capacity * this.descriptor.vertexCount * buffer.itemSize),
         serial: 0,
       });
     }
     ```

     Sonst nichts: keine Längenprüfung, keine Prüfung des `dataType`, kein Kopieren. Der
     Schwesterzweig prüft ebenfalls nicht, `VOBufferPool#fromBuffersData` teilt die Referenz
     ausdrücklich (zero-copy), und beide Zweige unter derselben Zusage zu halten ist genau das,
     was hier beschlossen ist. `buffersData.usedCount` bleibt unangetastet — das ist Sache des
     Pools, nicht des Puffers.
  4. TSDoc an den Konstruktor (`:63`), englisch wie der Rest der Datei, ohne Rückblick auf den
     Vorzustand. Inhalt: der Puffer entsteht aus einer Beschreibung oder aus einem zweiten
     Puffer; `buffersData` wird **übernommen und nicht kopiert**, wer die Referenz behält,
     schreibt weiter in diesen Puffer hinein; ein Puffername, den die Daten nicht nennen,
     bekommt ein frisches Nullarray in der Größe, die Kapazität und Layout verlangen; die
     Kapazität kommt dann aus `buffersData.capacity`; `usedCount` gehört dem Pool. Dazu ein
     `@throws` für die vorhandene Absage an einen Quellpuffer, dessen Pool disposed ist.
- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser`
  — im Log nachsehen, ob `typecheck` und `test:ci` wirklich gelaufen sind; meldet Nx sie als
  aus dem Cache bedient, dieselben Tasks mit `--skip-nx-cache` nachfahren. `pnpm lint` ist
  reines `eslint . && prettier --check .` und kennt keinen Cache.
- Commit: `fix(vertex-objects): take the buffer data handed to either constructor path`
- Ergebnis: 2 Runden · BUG-035 behoben (`VertexObjectBuffer.ts:96-107`, der Zweig
  `source instanceof VertexObjectBuffer` trägt jetzt denselben Übernahme-Ausdruck wie sein
  Schwesterzweig), vom Reviewer mit Fundstelle bestätigt · Verify
  `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` exit 0, Log
  `paket-3.verify.log`; `typecheck` zusätzlich mit `--skip-nx-cache` nachgefahren, weil es im
  ersten Lauf zu 100 % aus dem Nx-Cache kam (`test:ci` und der Browsertest liefen echt) ·
  Regressionstests, vor dem Fix rot gesehen: in `VertexObjectBuffer.spec.ts` die beiden neuen
  Tests `a buffer source takes the typed arrays of the buffers data it is handed` und
  `a buffer name the buffers data does not mention gets a fresh zeroed array` (beide
  `AssertionError` an der `toBe`-Referenzgleichheit für `dynamic_float32`), dazu der Browsertest
  `vertex-objects-buffers-data.test.js` — `a pool restored from buffers data renders the values
  it was handed` las zwölf Nullen statt `[0,0,0,7,7,7,8,8,8,9,9,9]` aus dem GPU-Puffer · eine
  Abweichung vom Detailplan, abgenommen: der zweite der beiden Vitest-Tests war entgegen der
  Vorhersage in Schritt 1 ebenfalls rot, weil der ungefixte Zweig `buffersData` vollständig
  ignoriert; Schritt 1 ist oben entsprechend nachgetragen
- Fehlerkette: Runde 1 hatte einen `wichtig`-Befund zu schließen — das neue TSDoc und der neue
  Browsertest zeigten den rohen Konstruktorweg als Restore-Idiom, ohne zu sagen, dass ihm die
  Kapazitätsprüfung von `VOBufferPool#fromBuffersData()` fehlt und `VOBufferPool.capacity` als
  `readonly` dem Puffer nicht folgt. Geschlossen über Dokumentation statt Laufzeitprüfung: Schritt
  3 des Detailplans schließt eine Prüfung im Konstruktor ausdrücklich aus, und die Zusage der
  Bibliothek sollte sich nicht ändern. Danach 0 offene Befunde.
- Nebenbefunde: keine — weder Implementierer noch die beiden Reviewer haben in den berührten
  Dateien etwas gefunden, das auch ohne dieses Paket falsch gewesen wäre
- Folgen:
  - `packages/twopoint5d/CHANGELOG.md` — eine Verhaltensänderung an der öffentlichen Oberfläche
    will einen Eintrag: `new VertexObjectBuffer(otherBuffer, buffersData)` liefert die
    übergebenen Arrays statt frischer Nullarrays. → Abschluss des Laufs, wo das CHANGELOG ohnehin
    geschrieben wird
- Schnittstellen:
  - `new VertexObjectBuffer(source: VertexObjectBuffer, buffersData)` — Signatur unverändert, aber
    der Zweig **übernimmt** die Arrays aus `buffersData.buffers` als Referenz (zero-copy) statt
    frische Nullarrays anzulegen; wer die Referenz behält, schreibt weiter in diesen Puffer. Ein
    Puffername, den `buffersData` nicht nennt, bekommt weiterhin ein frisches Nullarray. Die
    Kapazität kommt aus `buffersData.capacity` und wird gegen nichts geprüft — `VOBufferPool`
    trägt seine eigene, unveränderliche `capacity`, und der abgleichende Weg bleibt
    `VOBufferPool#fromBuffersData()`. Steht im TSDoc des Konstruktors
    (`VertexObjectBuffer.ts:63-79`)

**BUG-035 · medium · packages/twopoint5d/src/vertex-objects/VertexObjectBuffer.ts:50-66** — Ein
Konstruktorpfad verwirft die mitgelieferten Pufferdaten

Im Zweig `source instanceof VertexObjectBuffer` wird das mitgelieferte `buffersData` bis auf die
Kapazität verworfen und die Puffer werden als frische Nullarrays angelegt, während der andere
Zweig auf Zeile 105 die übergebenen Daten übernimmt. Wer `new VertexObjectBuffer(otherBuffer,
buffersData)` aufruft, bekommt leere Puffer ohne jeden Hinweis.

Empfehlung: Die Daten in beiden Zweigen übernehmen, oder den Parameter in diesem Zweig laut
ablehnen, statt ihn still fallen zu lassen.


### [x] 4. Stage: eine Größenrechnung für die RenderTargets, ehrliche Signatur für fitIntoRectangle

- Findings: BUG-054 (low), TYPE-005 (low)
- Ziel: `resize()` und `#ensureRT()` rechnen die RenderTarget-Größe an einer Stelle, und `fitIntoRectangle` deklariert den Teil-Spec, den es ohnehin verarbeitet — der interne Cast-Helfer entfällt.
- Bereich: `packages/twopoint5d/src/stage/` (`StageRenderer.ts`, `fitIntoRectangle.ts`, `asFitIntoRectangleSpecs.ts` und dessen zwei Aufrufstellen)
- Hängt ab von: —
- Hash: 5c1db02
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/StageRenderer.ts`
  - `packages/twopoint5d/src/stage/StageRenderer.spec.ts`
  - `packages/twopoint5d/src/stage/fitIntoRectangle.ts`
  - `packages/twopoint5d/src/stage/fitIntoRectangle.spec.ts`
  - `packages/twopoint5d/src/stage/asFitIntoRectangleSpecs.ts` (**gelöscht**)
  - `packages/twopoint5d/src/stage/OrthographicProjection.ts`
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts`
  - `packages/twopoint5d-testing/test/stage-renderer.test.js`
- Vorgehen:

  **Schritt 1 — der rote Lauf für BUG-054**, in `StageRenderer.spec.ts`, ans Ende des
  `describe('pipeline without buildOutputNode (§6.4 Mode C)')`-Blocks, hinter
  `runs pipeline into outputRenderTarget when set` (`:429-445`). Der Block hat sein
  `makePipelineMock()` schon; `renderer` kommt aus dem `beforeEach` der Datei und ist je Test frisch.
  Beobachtet wird das interne RenderTarget über `renderer.__renderTarget` im `renderTo`-Mock der
  Stage — dasselbe Idiom wie in `renders stages into an internal RT, then runs the pipeline`
  (`:376-403`). Die Referenz bleibt über den `resize()` hinweg gültig: `#ensureRT()` gibt dasselbe
  Objekt zurück, es wird nie ersetzt.

  ```ts
  it('the internal target keeps its device-pixel size when resize() moves it', () => {
    renderer.getPixelRatio.mockReturnValue(2);
    const sr = new StageRenderer();
    sr.resize(100, 50);
    const stage = fakeStage('s');
    sr.add(stage);
    sr.pipeline = makePipelineMock() as any;

    let rt: any;
    stage.renderTo.mockImplementation(() => {
      rt = renderer.__renderTarget;
    });
    sr.renderTo(renderer as any);

    expect([rt.width, rt.height], 'built in device pixels').toEqual([200, 100]);

    sr.resize(300, 150);
    expect([rt.width, rt.height], 'resized in device pixels').toEqual([600, 300]);
  });

  it('a fractional css size reaches the internal target as whole device pixels', () => {
    const sr = new StageRenderer();
    sr.resize(100, 50);
    const stage = fakeStage('s');
    sr.add(stage);
    sr.pipeline = makePipelineMock() as any;

    let rt: any;
    stage.renderTo.mockImplementation(() => {
      rt = renderer.__renderTarget;
    });
    sr.renderTo(renderer as any);

    sr.resize(100.5, 50.5);
    expect([rt.width, rt.height]).toEqual([100, 50]);
  });
  ```

  Vor dem Fix liest der erste Test `[300, 150]` statt `[600, 300]` und der zweite
  `[100.5, 50.5]` statt `[100, 50]`. Beide roten Läufe gehören in den Report.

  **Schritt 2 — der Fix in `StageRenderer.ts`.** Heute stehen zwei Rechnungen nebeneinander:
  `resize()` gibt den RenderTargets `Math.max(1, width)` (`:275-276`), `#ensureRT()` rechnet
  `Math.max(1, Math.floor(this.width * pixelRatio))` (`:525-536`). Beide gehen auf **eine**
  private Rechnung. `resize()` hat keinen Renderer, den es nach dem Pixelverhältnis fragen könnte,
  also merkt sich `#ensureRT()` das zuletzt gesehene.

  Neben `#asPassNodeRT` (`:345`) kommt das Feld dazu:

  ```ts
  /**
   * Pixel ratio of the renderer that last built or measured a `RenderTarget` here. `resize()`
   * has no renderer to ask; it sizes the targets from this value, and the next `#ensureRT()`
   * corrects them if the renderer has moved to a different ratio in the meantime.
   */
  #pixelRatio = 1;
  ```

  Direkt über `#ensureRT()` die beiden Helfer:

  ```ts
  /** Size a `RenderTarget` has to have, in device pixels, for the current `width`/`height`. */
  #renderTargetSize(): [width: number, height: number] {
    return [
      Math.max(1, Math.floor(this.width * this.#pixelRatio)),
      Math.max(1, Math.floor(this.height * this.#pixelRatio)),
    ];
  }

  #resizeRenderTarget(rt: RenderTarget): void {
    const [w, h] = this.#renderTargetSize();
    if (rt.width !== w || rt.height !== h) {
      rt.setSize(w, h);
    }
  }
  ```

  `#ensureRT()` wird zu:

  ```ts
  #ensureRT(rt: RenderTarget | undefined, renderer: WebGPURenderer): RenderTarget {
    this.#pixelRatio = renderer.getPixelRatio?.() ?? 1;
    if (!rt) {
      const [w, h] = this.#renderTargetSize();
      return new RenderTarget(w, h);
    }
    this.#resizeRenderTarget(rt);
    return rt;
  }
  ```

  und die beiden Zeilen in `resize()` (`:275-276`) zu:

  ```ts
  if (this.#internalRT) this.#resizeRenderTarget(this.#internalRT);
  if (this.#asPassNodeRT) this.#resizeRenderTarget(this.#asPassNodeRT);
  ```

  Warum das Merken und nicht das Weglassen: die beiden `setSize`-Aufrufe in `resize()` ersatzlos
  zu streichen wäre auch eine Rechnung an einer Stelle, träfe aber zwei Zusagen. `three`
  ruft in `RenderTarget#setSize()` bei jeder echten Größenänderung `this.dispose()` — die
  GPU-Textur wird freigegeben und neu angelegt. Mit der falschen Größe dazwischen kostet ein
  `resize()` zwei Neuanlagen statt einer. Und das TSDoc von `dispose()` (`:577-579`) beschreibt
  `resize()` als etwas, das seine Maße an die RenderTargets weiterreicht; das bleibt so.
  Das gemerkte Verhältnis ist nie länger stale als das heutige: vor dem ersten Frame steht es auf
  `1` und es gibt noch kein RenderTarget, und ab dem ersten Frame korrigiert `#ensureRT()`.

  Das `Math.floor` ist der zweite, stille Gewinn: eine gebrochene CSS-Breite landete über
  `resize()` bisher ungerundet in `texture.image.width`.

  **Schritt 3 — der Browsertest**, in `packages/twopoint5d-testing/test/stage-renderer.test.js`,
  als weiteres `it()` im vorhandenen `describe('StageRenderer — integration with Display')`.
  Fixture-Helfer (`makeContainer`, `disposeDisplay`), `afterEach` und die `display`/`host`-Variablen
  stehen dort schon; nichts davon wird umgebaut. `web-test-runner.config.js` sammelt
  `test/**/*.test.js` ein, es ist nichts zu registrieren.

  Der `StageRenderer` wird hier **ohne** Parent gebaut: er soll nicht am Frame-Loop des Displays
  hängen, sondern nur den echten `WebGPURenderer` nach seinem Pixelverhältnis fragen. Das
  Verhältnis wird von Hand gesetzt — `display.pixelRatio` ist im headless-Browser `devicePixelRatio`,
  also 1, und `pixelZoom` erzwingt seinerseits 1.0. `Display` schreibt `setPixelRatio()` nur dann
  nach, wenn sich sein eigener Resize-Hash ändert (`Display.ts:690-708`); deshalb steht die
  Nachprüfung `getPixelRatio() === 2` im Test, damit ein Überschreiben als benannte Zusicherung
  auffliegt und nicht als rätselhafte Zahl.

  ```js
  it('sizes its pass target in device pixels, before and after a resize', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    await display.start();

    display.renderer.setPixelRatio(2);
    expect(display.renderer.getPixelRatio(), 'pixel ratio the renderer reports').to.equal(2);

    const sr = new StageRenderer();
    sr.resize(100, 50);

    const passNode = sr.asPassNode(display.renderer);
    expect([passNode.value.image.width, passNode.value.image.height]).to.deep.equal([200, 100]);

    sr.resize(300, 150);
    expect([passNode.value.image.width, passNode.value.image.height]).to.deep.equal([600, 300]);

    sr.dispose();
  });
  ```

  `asPassNode()` gibt einen TSL-`TextureNode` zurück; `node.value` ist die Textur des
  Pass-Targets, und `image.width`/`image.height` sind genau die Felder, die
  `RenderTarget#setSize()` beschreibt. Vor dem Fix liest der zweite Vergleich `[300, 150]`.
  Import ergänzen: `StageRenderer` steht in der Importzeile der Datei bereits.

  Warum überhaupt ein Browsertest: die Konvention oben verlangt ihn für Rendering-Code, und er
  zahlt hier auch. Er ist die einzige Stelle, an der ein echter `WebGPURenderer` gefragt wird —
  der Vitest-Mock behauptet `getPixelRatio()` nur.

  **Schritt 4 — die Verhaltensproben für TYPE-005**, in `fitIntoRectangle.spec.ts`, hinter dem
  letzten Test der Datei. **Diese Tests sind vor und nach der Änderung grün**, und das ist ihr
  Zweck: TYPE-005 ist ein Typbefund ohne Laufzeitfehler, es gibt hier keinen roten Lauf zu
  zeigen. Sie halten das Verhalten fest, das der Rumpf-Umbau in Schritt 5 nicht verändern darf —
  gerade die Ausgänge, die heute niemand aufgeschrieben hat. Der Aufruf mit einem Teil-Spec
  compiliert erst nach Schritt 5; bis dahin läuft er über `asFitIntoRectangleSpecs()`, danach ohne.
  Wer die Tests vorher schreiben will, schreibt sie mit dem Helfer und nimmt ihn in Schritt 6
  wieder heraus.

  Vier Fälle, jeder mit einem Satz, was er festhält:

  ```ts
  it('an empty spec leaves the target untouched', () => {
    const target = new Vector2(11, 22);
    expect(fitIntoRectangle(new Vector2(640, 400), {}, target)).toBe(target);
    expect([target.width, target.height]).toEqual([11, 22]);
  });

  it('a contain spec without width or height leaves the view dimensions to the clamp', () => {
    const target = new Vector2();
    fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', maxPixelZoom: 2}, target);
    expect([target.width, target.height]).toEqual([320, 200]);
  });

  it('a contain spec without width, height and clamp leaves the target untouched', () => {
    const target = new Vector2(11, 22);
    fitIntoRectangle(new Vector2(640, 400), {fit: 'contain'}, target);
    expect([target.width, target.height]).toEqual([11, 22]);
  });

  it('a width of 0 means "this side is not constrained"', () => {
    const target = new Vector2();
    fitIntoRectangle(new Vector2(640, 400), {fit: 'contain', width: 0, height: 100}, target);
    expect([target.width, target.height]).toEqual([160, 100]);
  });
  ```

  Der zweite ist der wichtigste. Greift keine Form, bleibt die Klammer auf `minPixelZoom` /
  `maxPixelZoom` trotzdem stehen und rechnet mit dem, was im `target` steht: bei einem frischen
  `Vector2` ist `rect.width / 0` gleich `Infinity`, also schlägt jedes `maxPixelZoom` zu. Das ist
  bestehendes Verhalten und bleibt.

  **Schritt 5 — die Signatur weiten und den Rumpf darauf stellen**, in `fitIntoRectangle.ts:183`.
  Der Parameter wird `specs: Partial<FitIntoRectangleSpecs>`. `Partial` ist homomorph und verteilt
  sich über die Union, jedes Feld jedes Union-Glieds wird optional.

  Der Rumpf compiliert dann nicht mehr: `'width' in specs` fügt die Eigenschaft hinzu, nimmt ihr
  aber das `undefined` nicht (nachgemessen mit `tsc` 5.9.3 unter den Flags des Projekts: zwölf
  Fehler, TS2345/TS18048/TS2322). Die `in`-Prüfungen bleiben deshalb als Zugriffsweg stehen und
  bekommen eine Wertprüfung dazu; die Werte werden einmal oben gelesen. Das ist keine neue Semantik,
  sondern die vorhandene ausgeschrieben: jeder Zweig prüft heute schon »vorhanden **und** ungleich 0«,
  fehlend und 0 sind also längst dasselbe.

  ```ts
  export function fitIntoRectangle(
    rect: Vector2,
    specs: Partial<FitIntoRectangleSpecs>,
    target: Vector2 = new Vector2(),
  ): Vector2 {
    const pixelZoom = 'pixelZoom' in specs && specs.pixelZoom != null ? specs.pixelZoom : undefined;

    if (pixelZoom != null) {
      // ---------------------------------------------------------------
      // pixelZoom
      // ---------------------------------------------------------------
      target.copy(rect).divideScalar(pixelZoom);
    } else if (specs.fit === 'fill') {
      // ---------------------------------------------------------------
      // fill
      // ---------------------------------------------------------------
      target.copy(rect);
    } else if (specs.fit === 'contain' || specs.fit === 'cover') {
      // ---------------------------------------------------------------
      // contain & cover
      // ---------------------------------------------------------------
      // a side that is missing, undefined or 0 is a side the caller does not constrain
      const width = 'width' in specs && specs.width != null ? specs.width : 0;
      const height = 'height' in specs && specs.height != null ? specs.height : 0;

      if (width !== 0 && height === 0) {
        // --- we have a width and no height
        target.width = width;
        target.height = rect.height * (width / rect.width);
      } else if (width === 0 && height !== 0) {
        // --- we have no width but a height
        target.width = rect.width * (height / rect.height);
        target.height = height;
      } else if (width !== 0 && height !== 0) {
        // --- we have a width and a height
        const rectRatio = rect.width / rect.height;
        const specsRatio = width / height;
        const isContain = specs.fit === 'contain';
        if ((isContain && rectRatio > specsRatio) || (!isContain && rectRatio < specsRatio)) {
          target.width = rect.width * (height / rect.height);
          target.height = height;
        } else if ((isContain && rectRatio < specsRatio) || (!isContain && rectRatio > specsRatio)) {
          target.width = width;
          target.height = rect.height * (width / rect.width);
        } else {
          target.set(width, height);
        }
      }

      if (specs.minPixelZoom != null && rect.width / target.width < specs.minPixelZoom) {
        target.copy(rect).divideScalar(specs.minPixelZoom);
      } else if (specs.maxPixelZoom != null && rect.width / target.width > specs.maxPixelZoom) {
        target.copy(rect).divideScalar(specs.maxPixelZoom);
      }
    }
    return target;
  }
  ```

  Drei Dinge daran sind Absicht und keine Nachlässigkeit:
  - Der `as number`-Cast im Breiten-Zweig (`:196`) fällt weg — `width` ist dort schon `number`.
  - Die Überschrift des `fill`-Zweigs heißt `fill` statt `fix`. Der Zweig behandelt `fit: 'fill'`;
    die Überschrift gehört zum umgeschriebenen Block und wird mit ihm richtig.
  - `{pixelZoom: undefined}` zählt jetzt als »kein pixelZoom« statt als »pixelZoom ist NaN«.
    Erreichbar war das schon immer (`viewSpecs` ist `Partial`), sinnvoll war es nie.

  Nachgemessen mit `tsc` 5.9.3 unter `strict`, `noUncheckedIndexedAccess`: der Rumpf ist sauber,
  beide Aufrufstellen compilieren ohne Cast, und die bisherigen vollständigen Specs
  (`{pixelZoom: 2}`, `{fit: 'contain', width: 640, height: 480}`) gehen unverändert durch.
  Ebenfalls nachgemessen, was die Weitung aufgibt und was sie hält: `{fit: 'contain'}` ohne Maß
  ist danach kein Typfehler mehr — das ist der Preis, und er ist der Punkt des Findings, denn
  zur Laufzeit war diese Form immer erlaubt. Abgewiesen bleiben ein unbekannter `fit`-Wert
  (`{fit: 'nope'}`) und ein unbekanntes Feld (`{fit: 'contain', witdh: 100}`).

  **Schritt 6 — den Helfer entfernen.** `packages/twopoint5d/src/stage/asFitIntoRectangleSpecs.ts`
  löschen. Er steht in keiner `public-api.ts` und hat genau zwei Aufrufer; in
  `OrthographicProjection.ts` und `ParallaxProjection.ts` je die Importzeile (`:6`) streichen und
  den Aufruf (`:37` bzw. `:39`) auf

  ```ts
  fitIntoRectangle(new Vector2(width, height), this.viewSpecs, this.#viewRect);
  ```

  ziehen. `viewSpecs` ist dort `Partial<OrthographicProjectionSpecs>` bzw.
  `Partial<ParallaxProjectionSpecs>`, beides `Partial<FitIntoRectangleSpecs & {…}>` — zuweisbar,
  nachgemessen. Der Import von `FitIntoRectangleSpecs` bleibt in beiden Dateien stehen, er trägt
  den exportierten Specs-Typ.

  **Schritt 7 — das TSDoc an `fitIntoRectangle`** (`:157-182`) auf die geweitete Signatur bringen.
  `@example`, `@param`, `@returns` bleiben in Form und Reihenfolge. Was dazukommt, in eigenen
  Worten und ohne Rückblick auf den Vorzustand:
  - Der Spec ist ein Teil-Spec: jedes Feld darf fehlen.
  - Für `contain` und `cover` heißt eine fehlende oder auf `0` gesetzte Seite, dass der Aufrufer
    diese Seite nicht festlegt; die andere gibt dann das Seitenverhältnis vor.
  - Greift keine Form — kein `pixelZoom`, kein `fit`, oder `contain`/`cover` ohne beide Maße —,
    bleiben die Maße im `target` stehen, wie sie sind. `minPixelZoom` und `maxPixelZoom` rechnen
    danach trotzdem und können sie überschreiben; bei einem frischen `Vector2` ist die Breite `0`,
    das Verhältnis damit `Infinity`, und ein `maxPixelZoom` greift immer.

  Der Satz, den der gelöschte Helfer trug (»where no shape matches, `fitIntoRectangle()` hands
  back the target vector it was given, untouched«), wandert damit an die Funktion selbst — richtig
  gestellt, denn die Klammer rührt das Ziel sehr wohl an.

  **Nicht anfassen:** `packages/twopoint5d/CHANGELOG.md`. Die Signaturänderung will einen Eintrag,
  der wird beim Abschluss des Laufs geschrieben, wie bei Paket 1 bis 3.
- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser`
  — im Log nachsehen, ob `typecheck` und `test:ci` wirklich gelaufen sind; meldet Nx sie als aus
  dem Cache bedient, dieselben Tasks mit `--skip-nx-cache` nachfahren. `pnpm lint` ist reines
  `eslint . && prettier --check .` und kennt keinen Cache. `typecheck` ist hier der eigentliche
  Beleg für TYPE-005: er compiliert die Aufrufstellen ohne den gelöschten Cast.
- Commit: `fix(stage): size the render targets from one place and take a partial fit spec`
- Ergebnis: 1 Runde · BUG-054 und TYPE-005 beide behoben, vom Reviewer je mit Fundstelle
  bestätigt · BUG-054 an `StageRenderer.ts:256-258` (`#renderTargetSize()`), `:262-267`
  (`#resizeRenderTarget()`), `:232` (gemerktes `#pixelRatio`), von `resize()` (`:275-276`) und
  `#ensureRT()` (`:271-280`) gemeinsam benutzt · TYPE-005 an `fitIntoRectangle.ts:191`
  (`specs: Partial<FitIntoRectangleSpecs>`), `asFitIntoRectangleSpecs.ts` ersatzlos gelöscht,
  beide Aufrufer reichen `this.viewSpecs` direkt durch (`OrthographicProjection.ts:69`,
  `ParallaxProjection.ts:113`) · Verify
  `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` exit 0, Log
  `paket-4.verify.log`; `typecheck`, `test:ci` und `test:browser` kamen im ersten Lauf zu 100 %
  aus dem Nx-Cache und sind mit `--skip-nx-cache` echt nachgefahren (im selben Log unter
  »Nachlauf«, ebenfalls exit 0) · Regressionstests, beide vor dem Fix rot gesehen, in
  `StageRenderer.spec.ts`: `the internal target keeps its device-pixel size when resize() moves
  it` (`expected [ 300, 150 ] to deeply equal [ 600, 300 ]`) und `a fractional css size reaches
  the internal target as whole device pixels` (`expected [ 100.5, 50.5 ] to deeply equal
  [ 100, 50 ]`) · dazu der Browsertest `stage-renderer.test.js` — `sizes its pass target in
  device pixels, before and after a resize`, gegen einen echten `WebGPURenderer` mit
  `setPixelRatio(2)` · die vier Verhaltensproben in `fitIntoRectangle.spec.ts` waren
  planmäßig vor und nach der Änderung grün; für einen Typbefund ohne Laufzeitfehler gibt es
  keinen roten Lauf, und es wird auch keiner behauptet · eine Abweichung vom Detailplan,
  abgenommen: die vier Proben stehen als lose `it()`-Blöcke am Dateiende statt in einem
  `describe`; Schritt 4 sagt »hinter dem letzten Test der Datei« und zeigt sie ungruppiert,
  die Lücke liegt im Plan, nicht in der Umsetzung
- Klein, nicht behoben — vom Reviewer eingestuft, keine Runde ausgelöst:
  - `packages/twopoint5d/src/stage/fitIntoRectangle.spec.ts:200-231` — die vier neuen Proben
    hängen in keinem `describe`, während jeder andere Test der Datei in
    `describe('fitIntoRectangle')` oder `describe('calculateAnchorOffset')` sitzt. Sie laufen
    korrekt mit, erscheinen im Testreport aber ohne Gruppierung.
- Nebenbefunde: → »Offene Befunde«
- Folgen:
  - `packages/twopoint5d/CHANGELOG.md` — eine Änderung an der öffentlichen Oberfläche will einen
    Eintrag: `fitIntoRectangle()` nimmt einen Teil-Spec entgegen, und ein `pixelZoom: undefined`
    zählt als »kein pixelZoom« statt als `NaN`. → Abschluss des Laufs, wo das CHANGELOG ohnehin
    geschrieben wird (Schritt 7 des Detailplans nimmt es ausdrücklich aus)
- Schnittstellen:
  - `fitIntoRectangle(rect, specs: Partial<FitIntoRectangleSpecs>, target?)` — der zweite
    Parameter ist geweitet; jedes Feld darf fehlen, und ein Aufrufer mit einem Teil-Spec braucht
    keinen Cast mehr. Vollständige Specs gehen unverändert durch, ein unbekannter `fit`-Wert und
    ein unbekanntes Feld werden weiter abgewiesen. `{fit: 'contain'}` ohne Maß ist danach kein
    Typfehler mehr — zur Laufzeit war diese Form immer erlaubt. Die Funktion steht über
    `stage/public-api.ts` im veröffentlichten Paket
  - `packages/twopoint5d/src/stage/asFitIntoRectangleSpecs.ts` — gelöscht. Der Helfer war ein
    benannter Cast, stand in keiner `public-api.ts` und hat keinen Ersatz; wer ihn sucht, ruft
    `fitIntoRectangle()` direkt mit seinem Teil-Spec auf

**BUG-054 · low · packages/twopoint5d/src/stage/StageRenderer.ts:274-275** — `resize()` und
`#ensureRT()` rechnen die RenderTarget-Größe verschieden

`resize()` gibt den beiden RenderTargets `Math.max(1, width)`, während `#ensureRT()` mit
`Math.floor(width * pixelRatio)` rechnet; bei einem pixelRatio ungleich 1 hat das RenderTarget
zwischen `resize()` und dem nächsten `#ensureRT()` die falsche Größe. Aufgefallen im
Remediation-Lauf vom 2026-09-06 (Paket 12); der Code wurde seitdem nicht neu auditiert.

Empfehlung: Eine Größenfunktion für beide Stellen; Test mit pixelRatio 2.

**TYPE-005 · low · packages/twopoint5d/src/stage/fitIntoRectangle.ts:183** — `fitIntoRectangle`
deklariert einen engeren Parameter, als die Funktion verlangt

Der Parameter heißt `specs: FitIntoRectangleSpecs`, der Rumpf liest aber jedes Feld über eine
`in`-Prüfung oder einen Vergleich auf `fit` (`:184-225`) und lässt das Zielrechteck unangetastet,
wenn keine Form greift — er nimmt in Wahrheit jedes `Partial<FitIntoRectangleSpecs>`. Weil der Typ
das verschweigt, braucht jede Aufrufstelle mit einem Teil-Spec einen Cast;
`stage/asFitIntoRectangleSpecs.ts` ist dieser Cast, benannt und begründet, aber ein Umweg.

Empfehlung: Den Parameter auf `Partial<FitIntoRectangleSpecs>` weiten. Der Helfer entfällt damit
ersatzlos.

### [x] 5. Änderungssignal im Kachel-Protokoll: der GPU-Upload hängt daran

- Findings: PERF-010 (medium), BUG-033 (medium), PERF-011 (low), PERF-013 (low), API-041 (low)
- Ziel: Eine Abhängigkeit ohne `equals` meldet ihre Änderung wieder, `IMap2DVisibleTiles` trägt ein `changed`-Signal, beide Visibilitoren setzen es ehrlich, und der Renderer schiebt die Attribut-Puffer nur bei gesetztem Signal zur GPU.
- Bereich: `packages/twopoint5d/src/utils/Dependencies.ts`, `packages/twopoint5d/src/map2d/` (`types.ts`, `CameraBasedVisibility.ts`, `RectangularVisibilityArea.ts`, `Map2DTileStreamer.ts`, `Map2DTileRenderer.ts`) sowie ein Browsertest in `packages/twopoint5d-testing/test/`
- Hängt ab von: —
- Hash: 5a34e20
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/utils/Dependencies.ts`
  - `packages/twopoint5d/src/utils/Dependencies.spec.ts`
  - `packages/twopoint5d/src/map2d/types.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts`
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.spec.ts` (**neu**)
  - `packages/twopoint5d/src/map2d/Map2DTileRenderer.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileRenderer.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts`
  - `packages/twopoint5d-testing/test/map2d-tile-upload.test.js` (**neu**)

  Nicht in der Liste, obwohl der Grobplan sie im Bereich nennt:
  `TileSprites/TileSpritesFactory.ts` bleibt unangetastet. Ihr `update()` ist die Stelle, an der
  der Upload passiert (`geometry.touch('quadSize', 'texCoords', 'instancePosition')`), aber die
  Sperre liegt eine Ebene darüber: erreicht der Serial des Renderers `endUpdatingTiles()` nicht,
  wird `factory.update()` gar nicht erst gerufen. Eine zweite Prüfung in der Factory wäre
  dieselbe Entscheidung an zwei Orten.

- Vorgehen:

  **Warum die fünf Findings ein Paket sind.** Sie hängen an einer Kette, und jedes Glied davor
  trägt das nächste: Der Renderer lädt jeden Frame hoch, weil `reuseTile()` den Serial hebt
  (PERF-010). Er soll das nur noch tun, wenn ihm jemand sagt, dass sich etwas geändert hat —
  also braucht `IMap2DVisibleTiles` ein `changed` und beide Visibilitoren müssen es ehrlich
  setzen. `CameraBasedVisibility` kann das sofort, es hat seinen Dirty-Check schon;
  `RectangularVisibilityArea` hat keinen (PERF-011) und bekommt ihn über dieselbe
  `Dependencies`-Klasse — die für einfache Werte wie `centerX` gar keine Änderung meldet
  (BUG-033). PERF-013 und API-041 liegen in denselben zwei Methoden und betreffen dieselben
  Scratch-Instanzen, die das Ergebnisobjekt trägt. Getrennt gebaut wäre jede Hälfte für sich
  nicht end-to-end prüfbar.

  **Schritt 1 — der rote Lauf für BUG-033**, in `packages/twopoint5d/src/utils/Dependencies.spec.ts`,
  direkt hinter `test('equals without equality callback')` (`:16-22`). Ein Test:

  ```ts
  test('a dependency without an equality callback reports a change of its value', () => {
    const deps = new Dependencies(['a', 'b']);

    deps.update({a: 1, b: 'foo'});

    expect(deps.equals({a: 2, b: 'foo'}), 'a moved from 1 to 2').toBe(false);
    expect(deps.equals({a: 1, b: 'bar'}), 'b moved from foo to bar').toBe(false);
    expect(deps.equals({a: 1, b: 'foo'}), 'nothing moved').toBe(true);

    expect(deps.changed({a: 2, b: 'foo'})).toBe(true);
    expect(deps.changed({a: 2, b: 'foo'})).toBe(false);
  });
  ```

  Vor dem Fix sind die ersten beiden Erwartungen rot (`expected true to be false`) und die
  vierte ebenfalls (`expected false to be true`). Der vorhandene Test bei `:16` bleibt, wie er
  ist; er deckt nur den Gleichheitsfall ab, und genau das ist die Lücke, die diesen Test nötig
  macht.

  **Schritt 2 — der Fix in `Dependencies.equals()`** (`Dependencies.ts:76-97`). Die Bedingung bei
  `:91` wird aufgeteilt:

  ```ts
      if (curValue !== nextValue) {
        // identity has already failed here; a dependency declared without an `equals` has
        // nothing else to judge by, so the difference stands
        const equals = callbacks?.equals;
        if (equals == null || equals(curValue, nextValue) === false) {
          return false;
        }
      }
  ```

  Sonst nichts. `=== false` bleibt für den Fall, dass ein Callback da ist — das ist die heutige
  Zusage an einen vorhandenen `equals`, und sie ändert sich nicht. Der `?.`-Zugriff auf
  `callbacks` bleibt, weil `#props` für einen einfach benannten Prop `undefined` einträgt
  (`:52`); der Zugriff auf `equals` wird zur ausdrücklichen Prüfung, weil das Feld in
  `DependencyCallbacks` zwar pflichtig deklariert ist, der bisherige Code es aber optional
  behandelt hat.

  Zwei Nachweise, dass der Fix nichts umwirft: `Dependencies` hat im Repo genau einen Anwender,
  `CameraBasedVisibility` (`:91-99`), und dort sind `'depth'` und `'lookAtCenter'` die einzigen
  Props ohne Callbacks. Beide sind zur Laufzeit stabil, der Cache-Trefferanteil ändert sich also
  nicht — es sei denn, jemand ändert sie, und dann ist die Invalidierung genau der Punkt des
  Findings. Und `Dependencies.spec.ts:49-66` bleibt grün: dort wechselt `c` von `undefined` auf
  `23`, das entscheidet schon der Null-Zweig bei `:84-89`.

  **Schritt 3 — `changed` in `IMap2DVisibleTiles`** (`map2d/types.ts:89-98`). Neues optionales
  Feld, hinter `tiles`:

  ```ts
    /**
     * `false` says that this result carries the same tiles, in the same order, with the same
     * view coordinates as the result of the previous call. A consumer may then leave the data
     * of a tile it already holds alone. Left out, it counts as `true`.
     */
    changed?: boolean;
  ```

  Optional und nicht pflichtig: ein fremder Visibilitor, der das Feld nicht kennt, behält damit
  sein heutiges Verhalten, und die Erweiterung ist additiv — kein Breaking Change. (Die beiden
  Breaking Changes dieses Laufs stehen in Paket 6 und bleiben dort.)

  Dazu, im selben Zug, der Lebensdauer-Vertrag für **API-041**, als TSDoc über dem Interface
  `IMap2DVisibleTiles` und an den beiden Feldern `offset` und `translate`. Was darin stehen
  muss, in eigenen Worten und englisch wie der Rest der Datei:
  - Das Ergebnis gilt bis zum nächsten `computeVisibleTiles()` desselben Visibilitors. Danach
    darf jedes Feld andere Werte tragen, und es darf dasselbe Objekt sein.
  - `offset` und `translate` sind Instanzen, die der Visibilitor wiederverwendet. Wer die Werte
    über den Aufruf hinaus braucht, kopiert oder klont sie; wer die Instanz behält, hält einen
    Wert, der sich unter ihm ändert.
  - Kein Rückblick auf den Vorzustand — der Satz beschreibt, was gilt, nicht was sich geändert hat.

  Ebenfalls hier: ein Satz am Interface `IMap2DVisibilitor` (`:100-110`), dass eine Instanz den
  Stand ihres letzten Aufrufs behält und deshalb genau einem `Map2DTileStreamer` dient. Das ist
  ab diesem Paket für beide Implementierungen wahr und trägt die Cache-Pfade unten.

  **Schritt 4 — `beginUpdatingTiles()` nimmt das Signal entgegen** (`map2d/types.ts:51-54`).

  ```ts
    /**
     * Start the update cycle for the tiles.
     *
     * `position` is read during the call and not kept by the caller's side of the contract:
     * the streamer hands over an instance it reuses, so a renderer that wants the value
     * afterwards copies it.
     *
     * `tilesChanged` says whether the tile coordinates of this cycle can differ from the last
     * one's. On `false` a renderer may leave the data of a tile it already holds untouched. It
     * still has to take on a tile it does not know yet, and it says nothing about the tiles
     * that arrive through {@link addTile} and {@link removeTile}. Left out, it counts as `true`.
     */
    beginUpdatingTiles(position: Vector3, tilesChanged?: boolean): void;
  ```

  Warum am Anfang des Zyklus und nicht — wie die Empfehlung des Audits sagt — an
  `endUpdatingTiles()`: Die Entscheidung fällt in `reuseTile()`, und das läuft zwischen den
  beiden. Am Ende gereicht käme das Signal zu spät, um die `updateTile()`-Aufrufe zu sparen; der
  Renderer müsste stattdessen mitzählen, welche Serial-Erhöhungen aus einem Reuse und welche aus
  einem Add oder Remove stammen, und die Ersparnis bliebe auf den Upload beschränkt. Am Anfang
  gereicht spart beides und steht neben `position`, der anderen Angabe, die für den ganzen
  Zyklus gilt. Die Aussage der Empfehlung — der Streamer reicht das Signal an den Renderer
  weiter — bleibt unverändert, nur die Tür ist eine andere.

  Der Parameter heißt `tilesChanged` und das Feld `changed`, und das ist Absicht: im Interface
  `IMap2DVisibleTiles` steht »Kacheln« schon im Namen des Typs, in einer Methodensignatur neben
  `position` nicht.

  **Schritt 5 — der rote Lauf für PERF-010 in Vitest**, in
  `packages/twopoint5d/src/map2d/Map2DTileRenderer.spec.ts`. Die Datei hat heute genau ein
  `describe('dispose()')` innerhalb von `describe('Map2DTileRenderer')`. Davor — also als erstes
  Kind von `describe('Map2DTileRenderer')`, vor `describe('dispose()')` bei `:34` — ein neues
  `describe('the tilesChanged signal')` mit vier Tests. `makeTileFactory()` (`:14-25`) und der
  `sandbox` aus `:28` werden benutzt, wie sie sind.

  ```ts
  describe('the tilesChanged signal', () => {
    test('a reused tile is left alone while the signal says nothing changed', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();

      const updateTile = sandbox.spy(tileFactory, 'updateTile');
      const update = sandbox.spy(tileFactory, 'update');

      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.reuseTile(tileCoords);
      renderer.endUpdatingTiles();

      expect(updateTile.called, 'updateTile()').toBe(false);
      expect(update.called, 'factory.update()').toBe(false);
    });

    test('a tile the renderer does not know is created even while the signal says nothing changed', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const createTile = sandbox.spy(tileFactory, 'createTile');
      const update = sandbox.spy(tileFactory, 'update');

      renderer.beginUpdatingTiles(new Vector3(), false);
      renderer.reuseTile(new Map2DTileCoords(0, 0));
      renderer.endUpdatingTiles();

      expect(createTile.calledOnce, 'createTile()').toBe(true);
      expect(update.calledOnce, 'factory.update()').toBe(true);
    });

    test('a reused tile is written again once the signal says something changed', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();

      const updateTile = sandbox.spy(tileFactory, 'updateTile');
      const update = sandbox.spy(tileFactory, 'update');

      renderer.beginUpdatingTiles(new Vector3(), true);
      renderer.reuseTile(tileCoords);
      renderer.endUpdatingTiles();

      expect(updateTile.calledOnce, 'updateTile()').toBe(true);
      expect(update.calledOnce, 'factory.update()').toBe(true);
    });

    test('a cycle that does not say counts as changed', () => {
      const tileFactory = makeTileFactory();
      const renderer = new Map2DTileRenderer(tileFactory);
      const tileCoords = new Map2DTileCoords(0, 0);

      renderer.beginUpdatingTiles(new Vector3());
      renderer.addTile(tileCoords);
      renderer.endUpdatingTiles();

      const updateTile = sandbox.spy(tileFactory, 'updateTile');

      renderer.beginUpdatingTiles(new Vector3());
      renderer.reuseTile(tileCoords);
      renderer.endUpdatingTiles();

      expect(updateTile.calledOnce).toBe(true);
    });
  });
  ```

  Vor dem Fix ist der erste Test rot (`updateTile()`: `expected true to be false`) und der zweite
  bereits grün — er ist die Gegenprobe, dass die Sperre nicht zu weit greift. Der dritte und
  vierte sind vor und nach der Änderung grün und halten das unveränderte Verhalten fest.
  Der Import von `Map2DTileCoords` und `Vector3` steht in der Datei bereits (`:3`, `:6`).

  **Schritt 6 — der Fix in `Map2DTileRenderer.ts`.** Neben `#updateDataSerial` (`:9`) das Feld:

  ```ts
  /**
   * What the current update cycle was told about its tiles. `true` until a
   * {@link beginUpdatingTiles} says otherwise, so a `reuseTile()` outside a cycle writes.
   */
  #tilesChanged = true;
  ```

  `beginUpdatingTiles()` (`:29-34`) nimmt den Parameter und merkt ihn:

  ```ts
  beginUpdatingTiles(position: Vector3, tilesChanged = true): void {
    // this one never reaches the factory, but moving the node of a spent renderer is a
    // mutation all the same
    if (this.tileFactory === null) return;

    this.#tilesChanged = tilesChanged;
    this.node.position.copy(position);
  }
  ```

  `reuseTile()` (`:49-60`) bekommt den einen Ausgang:

  ```ts
  reuseTile(tileCoords: IMap2DTileCoords): void {
    const tileFactory = this.tileFactory;
    if (tileFactory === null) return;

    const tile = this.#tiles.get(tileCoords.id);
    if (tile) {
      // same tiles as last cycle: what updateTile() would write is already in the buffer, and
      // raising the serial for it costs a full attribute upload in endUpdatingTiles()
      if (!this.#tilesChanged) return;

      tileFactory.updateTile(tile, tileCoords);
      ++this.#dataSerial;
    } else {
      this.addTile(tileCoords);
    }
  }
  ```

  In `dispose()` (`:106-118`) neben `#dataSerial = 0` und `#updateDataSerial = -1` auch
  `this.#tilesChanged = true;` — derselbe Ausgangszustand wie im Konstruktor.

  Das TSDoc an `tileFactory` (`:14-21`) bleibt inhaltlich, wie es ist. `endUpdatingTiles()` wird
  nicht angefasst: die Serial-Prüfung dort trägt die Entscheidung weiterhin, sie bekommt nur
  keine unechten Erhöhungen mehr.

  **Schritt 7 — `CameraBasedVisibility` setzt das Signal** (`CameraBasedVisibility.ts`). Drei
  Rückgabestellen, keine Rechnung dazu:

  1. Cache-Pfad (`:178-185`): im `if (this.#visibleTiles)`-Block zusätzlich
     `this.#visibleTiles.changed = false;`.
  2. Kein Schnittpunkt mit der Ebene (`:206`): das Objektliteral wird
     `{tiles: [], removeTiles: previousTiles, changed: true}`. `removeTiles` ist dort nicht
     leer, der Renderer muss handeln.
  3. `findVisibleTiles()`-Rückgabe (`:376-383`): `changed: true` dazu.

  Ehrlich ist das, weil `changed: false` genau dann steht, wenn `dependenciesChanged()` false
  war — also weder `depth`, `lookAtCenter`, `centerPoint2D`, `map2dTileCoords`, `matrixWorld`
  noch die beiden Kameramatrizen sich bewegt haben. Dann sind die Kacheln dieselben Objekte, und
  `tile.view` hängt an nichts anderem als `tile.x`/`tile.y` und dem Kachelraster. Feiner
  aufzulösen — etwa `changed: createTiles.length > 0 || removeTiles.length > 0` — wäre falsch:
  ein geändertes Raster bewegt `view` bei gleichbleibender Kachelmenge.

  **Schritt 8 — die Tests dazu**, in `CameraBasedVisibility.spec.ts`, ans Ende von
  `describe('computeVisibleTiles()')`, hinter `:260`. Die Helfer `makeTopDownCamera()` und die
  `beforeEach`-Variablen stehen dort schon.

  ```ts
  test('marks a freshly computed result as changed and a cached one as unchanged', () => {
    visibility = new CameraBasedVisibility(makeTopDownCamera());

    const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
    expect(first.changed, 'first frame').toBe(true);

    const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;
    expect(second.changed, 'second frame, nothing moved').toBe(false);

    const third = visibility.computeVisibleTiles(second.tiles, [400, 0], tileCoords, matrixWorld)!;
    expect(third.changed, 'third frame, center moved').toBe(true);
  });

  test('a changed depth invalidates the cached tile set', () => {
    visibility = new CameraBasedVisibility(makeTopDownCamera());

    const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
    visibility.depth = 200;
    const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

    expect(second).not.toBe(first);
    expect(second.changed).toBe(true);
  });

  test('a changed lookAtCenter invalidates the cached tile set', () => {
    visibility = new CameraBasedVisibility(makeTopDownCamera());

    const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
    visibility.lookAtCenter = true;
    const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

    expect(second).not.toBe(first);
    expect(second.changed).toBe(true);
  });
  ```

  Die beiden letzten sind vor dem Fix aus Schritt 2 rot (`expected … to be … `, weil der
  Cache-Pfad dasselbe Objekt zurückgibt) — sie sind der zweite Nachweis für BUG-033, diesmal an
  der Stelle, die das Finding namentlich nennt. Der erste Test ist vor Schritt 7 rot, weil
  `changed` dort noch `undefined` ist.

  **Schritt 9 — `RectangularVisibilityArea` bekommt seinen Dirty-Check** (PERF-011). Neue Felder
  neben `#tileCreated` (`:14`):

  ```ts
  readonly #deps = new Dependencies([
    'centerX',
    'centerY',
    Dependencies.cloneable<Map2DTileCoordsUtil>('map2dTileCoords'),
    Dependencies.cloneable<Matrix4>('matrixWorld'),
  ]);

  #visibleTiles?: IMap2DVisibleTiles;

  // Per-call scratch — reused across calls, handed out in the result. See IMap2DVisibleTiles.
  readonly #fullViewArea = new AABB2();
  readonly #offset = new Vector2();
  readonly #translate = new Vector3();
  ```

  `Map2DTileCoordsUtil` und `Matrix4` müssen dafür als Wert importiert werden statt als Typ
  (`:1`, `:5`); `Dependencies` kommt aus `../utils/Dependencies.js`, genau wie in
  `CameraBasedVisibility.ts:3`.

  `centerX` und `centerY` stehen bewusst als einfache Namen ohne Callbacks in der Liste — das
  ist der Fall, den Schritt 2 repariert, und ohne ihn wäre dieser Dirty-Check von Anfang an
  taub. Die Reihenfolge im Rumpf von `computeVisibleTiles()` (`:43-116`):

  ```ts
    if (this.width === 0 || this.height === 0) {
      return undefined;
    }

    // always ask, even when needsUpdate already forces the recompute: changed() is what keeps
    // the snapshot current, and a snapshot left behind reports a change on the next call
    const depsChanged = this.#deps.changed({centerX, centerY, map2dTileCoords, matrixWorld});

    if (!depsChanged && !this.needsUpdate && this.#visibleTiles != null) {
      this.#visibleTiles.createTiles = undefined;
      this.#visibleTiles.reuseTiles = this.#visibleTiles.tiles;
      this.#visibleTiles.removeTiles = undefined;
      this.#visibleTiles.changed = false;
      return this.#visibleTiles;
    }

    this.needsUpdate = false;
  ```

  Danach der heutige Rumpf, mit drei Änderungen:
  - `const fullViewArea = AABB2.from(tileCoords);` (`:62`) wird
    `const fullViewArea = AABB2.from(tileCoords, this.#fullViewArea);`.
  - `offset` und `translate` (`:105-106`) werden
    `const offset = this.#offset.set(map2dTileCoords.xOffset - centerX, map2dTileCoords.yOffset - centerY);`
    und `const translate = this.#translate.setFromMatrixPosition(matrixWorld);`.
  - Das Rückgabeliteral (`:108-115`) bekommt `changed: true` und wird `this.#visibleTiles`
    zugewiesen, das dann zurückgegeben wird.

  Die Arrays (`removeTiles`, `reuseTiles`, `createTiles`, `reuseTiles.concat(createTiles)`) bleiben
  je Neuberechnung frisch. Das ist kein Übersehen: `Map2DTileStreamer` hält das zurückgegebene
  `tiles` als `this.tiles` und reicht es beim nächsten Mal als `previousTiles` wieder herein —
  ein wiederverwendetes Array müsste die Eingabe leeren, während es sie liest.
  `CameraBasedVisibility` legt aus demselben Grund je Neuberechnung ein frisches `tiles` an
  (`:364`). Nach diesem Schritt ist eine Neuberechnung ohnehin der seltene Fall, und das ist die
  eigentliche Ersparnis, um die es PERF-011 geht.

  `needsUpdate` bleibt öffentlich und behält seine heutige Bedeutung — die beiden Setter
  (`:25-41`) setzen es, wenn sich `width` oder `height` bewegt —, wird jetzt aber auch gelesen
  und danach zurückgesetzt. Ein Aufrufer, der von außen `needsUpdate = true` setzt, erzwingt
  damit genau eine Neuberechnung. Das gehört in ein TSDoc am Feld: was es bewirkt, wer es setzt,
  und dass `computeVisibleTiles()` es beim Neurechnen wieder auf `false` stellt.

  **Schritt 10 — `RectangularVisibilityArea.spec.ts` anlegen.** Die Klasse hat heute keine
  eigene Spec (nur ihre Helper haben eine). Vitest-Idiom wie in `CameraBasedVisibility.spec.ts`:
  `describe`/`test`, `beforeEach` für `tileCoords = new Map2DTileCoordsUtil(100, 100)` und
  `matrixWorld = new Matrix4()`.

  ```ts
  test('returns undefined while one of its sides is zero', () => { … width 0 … height 0 … });

  test('classifies every tile as created on the first call and says so', () => {
    const area = new RectangularVisibilityArea(320, 240);
    const result = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;

    expect(result.tiles.length).toBeGreaterThan(0);
    expect(result.createTiles).toHaveLength(result.tiles.length);
    expect(result.reuseTiles).toHaveLength(0);
    expect(result.removeTiles).toHaveLength(0);
    expect(result.changed).toBe(true);
  });

  test('hands back the same result, marked unchanged, while nothing moves', () => {
    const area = new RectangularVisibilityArea(320, 240);
    const first = area.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
    const tilesRef = first.tiles;

    const second = area.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

    expect(second).toBe(first);
    expect(second.tiles).toBe(tilesRef);
    expect(second.reuseTiles).toBe(tilesRef);
    expect(second.createTiles).toBeUndefined();
    expect(second.removeTiles).toBeUndefined();
    expect(second.changed).toBe(false);
  });

  test('a moved center recomputes', () => { … [400, 0] … expect(third).not.toBe(first) … changed true … });

  test('a changed width recomputes', () => { … area.width = 640 … not.toBe(first) … });

  test('needsUpdate forces exactly one recompute', () => {
    … first, second (cached), area.needsUpdate = true, third (fresh), fourth (cached again) …
    expect(area.needsUpdate).toBe(false);
  });

  test('offset and translate are the same instances across calls', () => {
    … zwei Neuberechnungen mit verschiedenen Zentren …
    expect(second.offset).toBe(first.offset);
    expect(second.translate).toBe(first.translate);
  });

  test('a tile that leaves the view is removed and one that stays is reused', () => {
    … erster Aufruf, dann Zentrum um mehrere Kachelbreiten verschieben …
    … removeTiles ⊆ erste tiles, reuseTiles ⊆ erste tiles, reuse ∪ create = zweite tiles …
  });
  ```

  Rot vor dem Fix sind »hands back the same result, marked unchanged«, »needsUpdate forces
  exactly one recompute« und »offset and translate are the same instances« — heute gibt jede
  Berechnung ein frisches Objekt mit frischen Vektoren zurück. Die übrigen halten das Verhalten
  fest, das der Umbau nicht verändern darf, und sind vor und nach der Änderung grün.

  **Schritt 11 — `Map2DTileStreamer.update()`** (`Map2DTileStreamer.ts:73-118`). Vier Dinge in
  einer Methode:

  a) **PERF-013.** Eine Scratch-Instanz auf der Klasse statt drei Vektoren je Frame:

  ```ts
  // Per-frame scratch — handed to beginUpdatingTiles(), which reads it during the call.
  readonly #position = new Vector3();
  ```

  und im Rumpf an die Stelle von `:96-98`:

  ```ts
      const offset = visible.offset;
      const translate = visible.translate;
      const position = this.#position.set(
        (offset?.x ?? 0) + (translate?.x ?? 0),
        translate?.y ?? 0,
        (offset?.y ?? 0) + (translate?.z ?? 0),
      );
  ```

  Das ist eine Instanz statt dreien, nicht drei statt dreien wie in der Empfehlung: zwei der
  heutigen Allokationen sind reine `?? new Vector2()`-Ersatzwerte, und wer die Komponenten mit
  `?? 0` liest, braucht sie gar nicht. `Vector2` fällt damit aus dem Import (`:2`).

  b) **PERF-010, Weiterreichen.** `tileRenderer.beginUpdatingTiles(position)` (`:101`) wird
  `tileRenderer.beginUpdatingTiles(position, visible.changed ?? true);`. Das `?? true` ist
  nicht kosmetisch: ein fremder Visibilitor, der das neue Feld nicht kennt, behält damit sein
  heutiges Verhalten.

  c) **Die Schleife über die Renderer** ohne die drei Closures je Renderer und Frame — dieselbe
  Ursache wie (a), dieselbe Methode:

  ```ts
      for (const tileRenderer of this.renderers) {
        tileRenderer.beginUpdatingTiles(position, visible.changed ?? true);

        if (visible.removeTiles) for (const tile of visible.removeTiles) tileRenderer.removeTile(tile);
        if (visible.createTiles) for (const tile of visible.createTiles) tileRenderer.addTile(tile);
        if (visible.reuseTiles) for (const tile of visible.reuseTiles) tileRenderer.reuseTile(tile);

        tileRenderer.endUpdatingTiles();
      }
  ```

  Reihenfolge wie heute: remove, create, reuse. Prettier bestimmt die endgültige Zeilenform.

  d) **`clearTiles()` darf den Cache eines Visibilitors nicht aushebeln.** `:80` sagt heute
  `this.tiles.length = 0;` und leert damit **dasselbe Array**, das der Visibilitor als
  `#visibleTiles.tiles` festhält. Der nächste Aufruf trifft bei stehender Kamera den Cache-Pfad,
  bekommt seine eigene, eben geleerte Liste zurück — und die Karte bleibt leer, bis sich etwas
  bewegt. Aus `:80` wird:

  ```ts
        // a new list, not `length = 0`: the visibilitor holds this very array as the tile set of
        // its last result, and its cache path hands that result back untouched by previousTiles
        this.tiles = [];
  ```

  Danach greift der Weg von selbst: der Cache-Pfad meldet die Kacheln als `reuseTiles`, der
  geleerte Renderer kennt keine davon, und `reuseTile()` legt sie über `addTile()` neu an — auch
  bei `changed: false`, denn die Sperre in Schritt 6 gilt nur für eine Kachel, die der Renderer
  schon hält.

  Warum das hierher gehört und nicht in die Queue: der Sachverhalt ist vorbestehend
  (`git show c16ce54:packages/twopoint5d/src/map2d/Map2DTileStreamer.ts` zeigt dieselbe Zeile),
  aber Schritt 9 baut mit `RectangularVisibilityArea` einen **zweiten** Cache-Pfad in genau
  dieses Loch. Gleiche Ursache, und ohne den Einzeiler liefert dieses Paket einen bekannten
  Defekt mit aus.

  **Schritt 12 — die Tests zum Streamer**, in `Map2DTileStreamer.spec.ts`. Die Datei hat heute
  nur `describe('new')`; daneben kommt ein `describe('update()')`. Gebraucht werden zwei
  Attrappen, beide lokal in der Datei:

  - `makeRecordingRenderer()` — ein `IMap2DTileRenderer`, der `beginUpdatingTiles`-Argumente
    (`position`-Instanz und `tilesChanged`) sowie die Aufrufe von `addTile`/`reuseTile`/
    `removeTile`/`clearTiles` in Arrays mitschreibt.
  - `makeCachingVisibilitor(tiles)` — ein `IMap2DVisibilitor`, der beim ersten Aufruf
    `{tiles, createTiles: tiles, reuseTiles: [], removeTiles: [], changed: true}` liefert und
    danach dasselbe Objekt mit `createTiles: undefined`, `removeTiles: undefined`,
    `reuseTiles: tiles`, `changed: false`. Also genau das Protokoll der beiden echten
    Visibilitoren, ohne Kamera und ohne Raster.

  ```ts
  test('hands the changed flag of the visibilitor to every renderer', () => {
    … erster update(): tilesChanged true · zweiter update(): tilesChanged false …
  });

  test('a visibilitor without a changed flag counts as changed', () => {
    … Visibilitor, dessen Ergebnis kein `changed` trägt → tilesChanged true …
  });

  test('the position handed to the renderers is the same instance in every frame', () => {
    … zwei update()-Aufrufe, expect(second).toBe(first) …
  });

  test('clearTiles() gets the tiles back into the renderer even from a caching visibilitor', () => {
    const streamer = new Map2DTileStreamer(100, 100);
    const renderer = makeRecordingRenderer();
    streamer.addTileRenderer(renderer);
    streamer.visibilitor = makeCachingVisibilitor([tileA, tileB]);

    streamer.update(node);          // creates both
    streamer.update(node);          // cached, nothing to do
    streamer.clearTiles();
    streamer.update(node);          // clears, and must bring them back

    expect(renderer.cleared).toBe(1);
    expect(renderer.added.map((t) => t.id)).toEqual(['y0x0', 'y0x0', 'y0x1']);
  });
  ```

  Für den letzten Test schreibt die Attrappe `reuseTile()` so, wie es der echte Renderer tut:
  eine Kachel, die sie nicht kennt, geht durch `addTile()`. Vor dem Fix aus Schritt 11d ist er
  rot — nach dem `clearTiles()` kommt keine Kachel mehr an. »the position … is the same
  instance« ist vor Schritt 11a rot. `node` ist ein `new Object3D()`.

  **Schritt 13 — der Browsertest**, `packages/twopoint5d-testing/test/map2d-tile-upload.test.js`
  (neu). `web-test-runner.config.js` sammelt `test/**/*.test.js` ein, es ist nichts zu
  registrieren. Fixture-Helfer (`makeContainer`, `disposeDisplay`, `bufferOf`), `beforeEach` mit
  `Display` und `await display.start()`, `afterEach` und `this.timeout(20000)` werden eins zu
  eins aus dem Nachbarn `vertex-objects-gpu-upload.test.js` übernommen — jede Datei dieser Suite
  trägt ihre Helfer selbst, es gibt kein geteiltes Modul. Geometrie, Material und Map werden wie
  dort nicht einzeln abgeräumt; das Display im `afterEach` trägt die Teardown.

  Der Aufbau kommt ohne geladene Textur aus: `TileSet` nimmt auch nur `TextureCoords` entgegen
  und baut seinen Atlas selbst, und `TileSpritesMaterial` hat ohne `colorMap` eine Default-Farbe.

  ```js
  function makeMap(camera) {
    const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
    const tileData = new RepeatingTilesProvider([
      [1, 2],
      [3, 4],
    ]);
    const tileSprites = new TileSprites(new TileSpritesGeometry(512), new TileSpritesMaterial());
    const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));

    const map2d = new Map2D();
    map2d.tileWidth = 256;
    map2d.tileHeight = 256;
    map2d.xOffset = -128;
    map2d.yOffset = -128;
    map2d.visibilitor = new CameraBasedVisibility(camera);
    map2d.addTileRenderer(tileRenderer);

    return {map2d, tileSprites};
  }
  ```

  Die Kamera wie in der Lookbook-Demo `map2d-cam-visi`: `new PerspectiveCamera(75, 1.6, 0.1, 4000)`,
  `position.set(0, 350, 500)`, `lookAt(0, 0, 0)`. Sie gehört dem Test und nicht dem `Display`,
  damit ein Resize sie nicht bewegt.

  ```js
  it('a second frame with a still camera touches no tile attribute buffer', async function () {
    const {map2d, tileSprites} = makeMap(camera);
    scene.add(map2d);

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const usedCount = tileSprites.geometry.instancedPool.usedCount;
    // without tiles the whole test would pass on an empty buffer
    expect(usedCount, 'tiles on screen after the first frame').to.be.greaterThan(0);

    const instancePosition = tileSprites.geometry.getAttribute('instancePosition');
    const version = bufferOf(instancePosition).version;

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect(bufferOf(instancePosition).version, 'buffer version after a still frame').to.equal(version);
    expect(tileSprites.geometry.instancedPool.usedCount, 'tiles still on screen').to.equal(usedCount);
  });

  it('a frame that moves the map touches the tile attribute buffers again', async function () {
    … derselbe Aufbau, dann `map2d.centerX = 1024;` vor dem zweiten `map2d.update()` …
    expect(bufferOf(instancePosition).version).to.be.greaterThan(version);
  });
  ```

  Beobachtet wird `version` und nicht `updateRanges`: `touch()` setzt am Puffer
  `needsUpdate = true`, und three zählt dabei `version` hoch — ein monoton wachsender Zähler
  dessen, was zum Upload angemeldet wurde. `updateRanges` räumt der Renderer nach dem Upload
  selbst wieder ab und wäre vom Zeitpunkt abhängig. `bufferOf()` ist nötig, weil
  `instancePosition`, `texCoords` und `quadSize` als `dynamic` in **einem** interleavten Puffer
  liegen; die drei teilen sich damit auch die `version`, was für diesen Test genau richtig ist.
  Die drei tragen `autoTouch: false` (`TileSprites/descriptors.ts:72-76`), es gibt also keinen
  zweiten Weg, auf dem sie je Frame angemeldet würden.

  Vor dem Fix ist der erste Test rot: `reuseTile()` hebt für jede der Kacheln den Serial,
  `endUpdatingTiles()` ruft `factory.update()`, und `version` wächst. Der zweite ist vor und nach
  der Änderung grün — er ist der Nachweis, dass die Sperre wieder aufgeht.

  Warum überhaupt ein Browsertest: die Konvention im Kopf dieses Plans verlangt ihn für
  GPU-Puffer-Code, und er zahlt hier auch. Er ist die einzige Stelle, an der die ganze Kette
  läuft — Visibilitor, Streamer, Renderer, Factory, Geometrie, echter `WebGPURenderer` —, und
  genau diese Kette beschreibt PERF-010.

  **Nicht anfassen:** `packages/twopoint5d/CHANGELOG.md`. Die drei Oberflächenänderungen dieses
  Pakets (`IMap2DVisibleTiles.changed`, der zweite Parameter von `beginUpdatingTiles()`, das
  geänderte Verhalten von `Dependencies` ohne `equals`) wollen einen Eintrag; der wird beim
  Abschluss des Laufs geschrieben, wie bei Paket 1 bis 4.

- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser`
  — im Log nachsehen, ob `typecheck`, `test:ci` und `test:browser` wirklich gelaufen sind; meldet
  Nx sie als aus dem Cache bedient, dieselben Tasks mit `--skip-nx-cache` nachfahren. `pnpm lint`
  ist reines `eslint . && prettier --check .` und kennt keinen Cache. `typecheck` deckt hier auch
  die Lookbook-Demos mit ab — `map2d-tile-sprites.ts:61` ruft `beginUpdatingTiles()` einargumentig
  auf und muss das weiterhin dürfen.
- Commit: `fix(map2d): skip the tile upload on a still frame, and report a plain dependency change`
- Ergebnis: 2 Runden · PERF-010, BUG-033, PERF-011, PERF-013 und API-041 alle behoben, vom
  Reviewer je mit Fundstelle bestätigt · PERF-010 an `Map2DTileRenderer.ts:15, 35-42, 56-71, 129`
  (das gemerkte `#tilesChanged` und der eine Ausgang in `reuseTile()`), weitergereicht in
  `Map2DTileStreamer.ts:110`, deklariert in `types.ts:52-63` · BUG-033 an `Dependencies.ts:91-98`
  (fehlt `equals`, entscheidet die Identität allein; der `=== false`-Vertrag an ein vorhandenes
  Callback bleibt) · PERF-011 an `RectangularVisibilityArea.ts:23-28, 74-84, 97, 140-141` ·
  PERF-013 an `Map2DTileStreamer.ts:61-62, 100-105` (eine Scratch-Instanz statt dreier Vektoren
  je Frame) · API-041 als TSDoc-Vertrag an `types.ts:98-103, 107-117, 133-137` · Verify
  `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser` exit 0, Log
  `paket-5.verify.log`; nichts davon aus dem Nx-Cache (typecheck 0/3, test:ci 0/1, der
  Browsertest wirklich gefahren) · Regressionstests, alle vor dem Fix rot gesehen:
  `Dependencies.spec.ts` »a dependency without an equality callback reports a change of its
  value« (`a moved from 1 to 2: expected true to be false`), `Map2DTileRenderer.spec.ts` »a
  reused tile is left alone while the signal says nothing changed« (`updateTile(): expected true
  to be false`), in `CameraBasedVisibility.spec.ts` die drei neuen Tests (»marks a freshly
  computed result as changed and a cached one as unchanged«, »a changed depth invalidates the
  cached tile set«, »a changed lookAtCenter invalidates the cached tile set« — je `expected
  undefined to be true`, die beiden letzten gegen den zurückgesetzten `Dependencies.ts`
  zusätzlich mit `expected {…} not to be {…}`), in `RectangularVisibilityArea.spec.ts` sechs der
  acht Tests, in `Map2DTileStreamer.spec.ts` alle vier neuen (darunter »clearTiles() gets the
  tiles back into the renderer even from a caching visibilitor« mit `expected ['y0x0','y0x1'] to
  deeply equal ['y0x0','y0x1','y0x0','y0x1']`) · dazu der Browsertest `map2d-tile-upload.test.js`
  — »a second frame with a still camera touches no tile attribute buffer«, `buffer version after
  a still frame: expected 4 to equal 3`, rot auf Chromium und Firefox · fünf Abweichungen vom
  Detailplan, alle vom Reviewer nachgeprüft und abgenommen: `Matrix4` und `Map2DTileCoordsUtil`
  bleiben `import type` (beide stehen nur in Typposition von `Dependencies.cloneable<…>`, der Plan
  lag falsch); in `RectangularVisibilityArea.spec.ts` waren sechs statt der angesagten drei Tests
  rot, weil auch die übrigen `changed` prüfen; der erwartete Wert in Schritt 12 ist
  `['y0x0','y0x1','y0x0','y0x1']`, weil nach dem `clearTiles()` beide Kacheln erneut durch
  `addTile()` gehen; die beiden Browsertests fahren einen Aufwärmframe voran, weil der erste
  `render()` unter echtem WebGPU die `projectionMatrix` der Kamera umstellt und der Test sonst
  browserabhängig wäre; und `this.tiles = visible?.tiles` blieb unangetastet, es steht als
  Nebenbefund in der Queue
- Fehlerkette: Runde 1 hatte einen Befund zu schließen, den der Reviewer als `klein` einstufte
  und der Runner auf `wichtig` hochgestuft hat: das TSDoc von `IMap2DTileRenderer.reuseTile()`
  (`types.ts:72`) sagte »Reuse means that the tile has already been added to the renderer«,
  während Schritt 11d sich darauf stützt, dass `reuseTile()` eine unbekannte Kachel annimmt.
  `IMap2DTileRenderer` ist veröffentlichte Oberfläche — ein Fremd-Renderer nach der alten Lesart
  zeigt nach einem `clearTiles()` eine leere Karte. Geschlossen durch einen neuen Absatz an
  `types.ts:71-81`, der den `clearTiles()`-Fall benennt und sich mit dem Nachbarabsatz an
  `beginUpdatingTiles()` deckt; kein Code, kein Test angefasst. Danach 0 offene Befunde.
- Klein, nicht behoben — vom Reviewer eingestuft, keine Runde ausgelöst:
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts:159` — »the position handed to the
    renderers is the same instance in every frame« prüft nur Instanzgleichheit; die Attrappe
    liefert weder `offset` noch `translate`, die Position ist in jedem Frame `(0,0,0)`. Die
    umgeschriebene Rechnung `(offset?.x ?? 0) + (translate?.x ?? 0)` ist damit nirgends
    abgedeckt.
  - `packages/twopoint5d/src/map2d/RectangularVisibilityArea.spec.ts` — die beiden
    `cloneable`-Abhängigkeiten `map2dTileCoords` und `matrixWorld` haben keinen Test. Ausgerechnet
    sie sind der Weg, auf dem ein Fehler zur stillen Karte würde; die Spec deckt nur `centerX`,
    `width` und `needsUpdate` ab.
- Nebenbefunde: → »Offene Befunde«
- Folgen:
  - `packages/twopoint5d/CHANGELOG.md` — sechs Oberflächenänderungen wollen einen Eintrag. Drei
    Erweiterungen: `IMap2DVisibleTiles.changed`, der zweite Parameter von `beginUpdatingTiles()`,
    und `Dependencies` meldet für einen Prop ohne `equals` jetzt eine Änderung. Drei
    Vertragsverengungen, die ein Fremdaufrufer merken kann: `beginUpdatingTiles()` bekommt eine
    Instanz, die der Streamer je Frame wiederverwendet; `RectangularVisibilityArea` gibt auf dem
    Cache-Pfad dasselbe Ergebnisobjekt zurück; und dessen `offset`/`translate` sind über alle
    Aufrufe hinweg dieselben Instanzen. Ohne den Eintrag ist das eine stille Verhaltensänderung an
    öffentlichem Code. → Abschluss des Laufs, wo das CHANGELOG ohnehin geschrieben wird (der
    »Nicht anfassen«-Absatz des Detailplans nimmt es aus)
- Schnittstellen:
  - `IMap2DVisibleTiles.changed?: boolean` — neues optionales Feld. `false` sagt zu, dass dieses
    Ergebnis dieselben Kacheln in derselben Reihenfolge mit denselben View-Koordinaten trägt wie
    das vorige. Fehlt es, zählt es als `true`; ein fremder Visibilitor behält damit sein Verhalten
  - `IMap2DTileRenderer.beginUpdatingTiles(position: Vector3, tilesChanged?: boolean)` — zweiter
    Parameter neu und optional. `position` ist eine Instanz, die der Streamer je Frame
    wiederverwendet; wer den Wert über den Aufruf hinaus braucht, kopiert ihn
  - `IMap2DTileRenderer.reuseTile()` — das TSDoc sagt jetzt ausdrücklich, dass eine dem Renderer
    unbekannte Kachel wie über `addTile()` angenommen wird und die `tilesChanged`-Regel nur für
    eine bereits gehaltene Kachel gilt (`types.ts:71-81`). Das war schon das Verhalten von
    `Map2DTileRenderer`; ab hier ist es Zusage, und der `clearTiles()`-Weg des Streamers hängt
    daran
  - `IMap2DVisibleTiles.offset` / `.translate` — bei **beiden** Visibilitoren wiederverwendete
    Instanzen. Das Ergebnis gilt bis zum nächsten `computeVisibleTiles()` desselben Visibilitors;
    danach darf jedes Feld andere Werte tragen, und es darf dasselbe Objekt sein. Eine
    Visibilitor-Instanz dient deshalb genau einem `Map2DTileStreamer` (`types.ts:98-103, 107-117,
    133-137`)
  - `Dependencies` — ein Prop, der ohne `equals`-Callback deklariert ist, meldet eine Änderung,
    sobald sich seine Identität bewegt. Ein vorhandenes Callback behält seinen `=== false`-Vertrag
  - `RectangularVisibilityArea` — der Cache-Pfad gibt dasselbe Ergebnisobjekt zurück, mit
    `reuseTiles = tiles` und `createTiles`/`removeTiles` auf `undefined`. `needsUpdate` bleibt
    öffentlich, wird jetzt aber gelesen und beim Neurechnen auf `false` gestellt; ein Aufrufer
    erzwingt damit genau eine Neuberechnung

**PERF-010 · medium · packages/twopoint5d/src/map2d/Map2DTileRenderer.ts:46-54, 74-78; packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts:68-73; packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:176-183** — Jede Kachel wird jeden Frame komplett neu hochgeladen, auch bei stehender Kamera

Steht die Kamera still, nimmt `CameraBasedVisibility` den Cache-Pfad und meldet alle Kacheln als
`reuseTiles`. `Map2DTileRenderer.reuseTile()` ruft daraufhin `updateTile()` und erhöht
`#dataSerial` für jede Kachel; `endUpdatingTiles()` sieht einen neuen Serial und ruft
`factory.update()`, das `touch('quadSize', 'texCoords', 'instancePosition')` auf der gesamten
Geometrie ausführt. Ergebnis: drei Attribut-Buffer werden pro Frame vollständig zur GPU
geschoben, unabhängig davon, ob sich etwas geändert hat. Der Cache in `CameraBasedVisibility`
spart die CPU-Rechnung der Sichtbarkeit, nicht den Upload. Bei 5000 Instanzen wie in der
Lookbook-Demo sind das rund 180 KB pro Frame ohne Änderung.

Empfehlung: `reuseTile()` den Serial nur erhöhen lassen, wenn `updateTile()` etwas geschrieben hat
(Position vergleichen), oder `IMap2DVisibleTiles` um ein `changed: boolean` ergänzen, das der
Streamer an `endUpdatingTiles()` weiterreicht. Ein Browsertest, der die Buffer-Serials über zwei
stehende Frames vergleicht, sichert das ab.

**BUG-033 · medium · packages/twopoint5d/src/utils/Dependencies.ts:90** — Eine Abhängigkeit ohne
Callbacks meldet nie eine Änderung

Die Bedingung lautet `curValue !== nextValue && callbacks?.equals?.(curValue, nextValue) === false`.
Fehlen die Callbacks, ergibt der rechte Teil `undefined === false`, also `false` — die Änderung
fällt durch. `CameraBasedVisibility.ts:90,91` deklariert `'depth'` und `'lookAtCenter'` genau so:
eine Änderung an beiden invalidiert den Kachelsatz nicht. `Dependencies.spec.ts:16` deckt nur den
Gleichheitsfall ab.

Empfehlung: Fehlt `equals`, muss `curValue !== nextValue` allein entscheiden. Eine Spec für den
Fall ohne Callbacks dazu, und die beiden Deklarationen in `CameraBasedVisibility` gegenprüfen.

**PERF-011 · low · packages/twopoint5d/src/map2d/RectangularVisibilityArea.ts:12, 43-116** —
RectangularVisibilityArea rechnet und alloziert in jedem Frame neu

Ohne Cache-Pfad: pro `update()` neue Arrays für `removeTiles`, `reuseTiles` und `createTiles`, ein
`concat`, ein `Vector2`, ein `Vector3`, ein `AABB2` und pro neu erzeugter Kachel `Map2DTileCoords`
plus `AABB2`. Das Feld `needsUpdate` wird von den Settern gesetzt, aber nirgends gelesen; eine
Änderungsprüfung wie in `CameraBasedVisibility` über `Dependencies` fehlt. Bei stehendem Center
liefert jeder Frame dasselbe Ergebnis mit frischen Objekten, und PERF-010 lädt es hoch.

Empfehlung: `needsUpdate` mit `centerX`, `centerY`, `map2dTileCoords` und `matrixWorld` zu einem
echten Dirty-Check verdrahten und bei unverändertem Zustand das letzte Ergebnis mit
`reuseTiles = tiles` zurückgeben; Scratch-Objekte wie in `CameraBasedVisibility` wiederverwenden.

**PERF-013 · low · packages/twopoint5d/src/map2d/Map2DTileStreamer.ts:96-98** —
Map2DTileStreamer.update() alloziert drei Vektoren je Frame

`update()` legt je Aufruf drei Vektoren an: `visible.offset ?? new Vector2()`,
`visible.translate ?? new Vector3()` und in jedem Fall
`new Vector3(offset.x + translate.x, translate.y, offset.y + translate.z)`. Die Methode läuft je
gerendertem Bild, und der dritte Vektor wird immer gebaut. `CameraBasedVisibility` hält für genau
diesen Zweck bereits wiederverwendete Instanzen auf der Klasse. Aufgefallen im Remediation-Lauf
vom 2026-09-06 (Paket 6); der Code wurde seitdem nicht neu auditiert.

Empfehlung: Drei Scratch-Instanzen auf der Klasse halten und mit `set()` befüllen.

**API-041 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:371-384, 120-121** —
findVisibleTiles() gibt Klassen-Scratch im Ergebnis heraus

`findVisibleTiles()` gibt `offset: this.#scratchOffset` und `translate` (das ist
`#scratchTranslate`) im Ergebnis heraus. Beide werden im nächsten Frame überschrieben; der auf dem
Cache-Pfad erneut zurückgegebene `#visibleTiles` zeigt auf dieselben Instanzen.
`Map2DTileStreamer` liest sie synchron, es fällt heute nicht auf — wer das Ergebnis aufhebt, hält
Werte, die sich unter ihm ändern. Aufgefallen im Remediation-Lauf vom 2026-09-06 (Paket 6); der
Code wurde seitdem nicht neu auditiert.

Empfehlung: Entweder im TSDoc von `IMap2DVisibleTiles` festschreiben, dass das Ergebnis nur bis zum
nächsten Aufruf gilt, oder die beiden Vektoren im Ergebnis klonen.

### [x] 6. Kachelschlüssel, Sichtbarkeits-Helfer und die Umbenennung des öffentlichen Feldes

- Findings: CONS-013 (low), API-032 (low), PERF-014 (low)
- Ziel: Ein Schlüsselformat für die Kachelkoordinate, ein numerischer Schlüssel im Hot-Path der Sichtbarkeitsrechnung, wiederverwendete Helfer-Knoten und ein öffentliches Feld, dessen Name sich schreiben lässt. Dieses Paket trägt die Breaking Changes des Laufs.
- Bereich: `packages/twopoint5d/src/map2d/` (`tileKeys.ts` neu, `Map2DTileCoords.ts`, `Map2DSpatialHashGrid.ts`, `CameraBasedVisibility.ts`, `CameraBasedVisibilityHelpers.ts`) und ein Browsertest in `packages/twopoint5d-testing/test/`
- Hängt ab von: Paket 5 (berührt dieselben Stellen in `CameraBasedVisibility.ts`)
- Hash: c83b0da
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/map2d/tileKeys.ts` (**neu**)
  - `packages/twopoint5d/src/map2d/tileKeys.spec.ts` (**neu**)
  - `packages/twopoint5d/src/map2d/Map2DTileCoords.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileCoords.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileRenderer.spec.ts`
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts`
  - `packages/twopoint5d/src/map2d/public-api.ts`
  - `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js` (**neu**)

  Nicht anfassen, obwohl es naheliegt:
  - `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts` — hat dieselbe Bauart
    wie PERF-014 und steht als eigener Nebenbefund in »Offene Befunde«. Es ist eine zweite
    Implementierung mit demselben Muster, nicht dieselbe Ursache; über sie entscheidet die
    Drain-Runde des Abschlusses.
  - `CameraBasedVisibility.ts:91-99` — `frustumBoxScale` fehlt in der Abhängigkeitsliste.
    Steht in »Offene Befunde« mit dem Urteil `→ Audit`. Der neue `serial` erbt diese Lücke;
    das ist in der Zeile dort vermerkt und wird hier nicht nebenbei geschlossen.
  - `packages/twopoint5d/CHANGELOG.md` — die Breaking Changes dieses Pakets schreibt der
    Abschluss, dort wird das CHANGELOG ohnehin geschrieben.
  - Der `document.querySelector('.map2dCoords')`-Block in `createHelpers()` bleibt inhaltlich
    stehen und wandert nur mit. Er läuft danach nicht mehr je Bild, sondern je Neuberechnung —
    also genau dann, wenn die Koordinaten sich ändern. Er steht als Nebenbefund in der Queue.
- Vorgehen:

  **Warum die drei Findings ein Paket sind.** CONS-013 ändert den Typ von `TileBox.id`, API-032
  und PERF-014 liegen beide in `CameraBasedVisibilityHelpers.ts`, und dieselbe Datei hält eine
  strukturelle Kopie von `TileBox`, die mit umgezogen werden muss. Getrennt gebaut würde die
  Helfer-Datei zweimal umgeschrieben und einmal gegen einen Typ, den das andere Paket gerade
  ändert. Zusammen ist es ein Commit über ein Modul.

  **Schritt 1 — `packages/twopoint5d/src/map2d/tileKeys.ts` anlegen.** Zwei exportierte
  Funktionen, englisches TSDoc wie im Rest des Moduls, keine `@link`-Verweise über Modulgrenzen
  (Codespans reichen und brechen nicht):

  ```ts
  /**
   * The textual key of a tile coordinate. It is the one format the map2d module builds for a
   * tile: the `id` of a `Map2DTileCoords`, the bucket keys of `Map2DSpatialHashGrid`, and
   * whatever a caller assembles to look a tile up in either of them. It reads in the order of
   * the arguments and needs no special case for a negative coordinate.
   */
  export function tileKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  // A biased pair of 26-bit numbers: the packed value stays below 2^52, which a double carries
  // exactly. The bias lifts a negative coordinate into the positive range instead of masking it
  // away, and that is what makes the packing collision-free rather than merely fast.
  const TILE_KEY_BIAS = 0x2000000; // 2^25
  const TILE_KEY_SPAN = 0x4000000; // 2^26

  /**
   * Packs a tile coordinate into a single number, for a hot path that keys a `Map` or a `Set`
   * by a tile and would otherwise build a string per lookup.
   *
   * The result is exact and free of collisions for every coordinate in `[-33554432, 33554431]`.
   * Outside that range the packed value is the one of some other coordinate; a tile grid would
   * have to span 67 million tiles in one direction to reach it.
   */
  export function packTileCoords(x: number, y: number): number {
    return (y + TILE_KEY_BIAS) * TILE_KEY_SPAN + (x + TILE_KEY_BIAS);
  }
  ```

  Warum `${x},${y}` und nicht eines der beiden anderen Formate: es liest sich in der Reihenfolge
  der Argumente und jeder Aufrufstelle, und es braucht für eine negative Koordinate keinen
  Sonderfall — `y${y.toString(16)}${x < 0 ? '' : 'x'}${x.toString(16)}` lässt für negatives `x`
  das Trennzeichen weg, und diese Warze wird nicht weitergetragen.

  Warum nicht die Formel `(y << 16) ^ (x & 0xffff)` aus der Empfehlung: sie ist nur für
  Koordinaten in `[-32768, 32767]` eindeutig und kollidiert darüber still — zwei Kacheln teilen
  sich dann einen Pool-Platz, und das Bild zeigt die falsche Kachel. Die Empfehlung nennt daneben
  eine verschachtelte `Map`; die biased Multiplikation ist derselbe Gedanke mit demselben
  Vorteil (kein String) und ohne den zweiten Lookup. Eine Laufzeitprüfung der Grenze gibt es
  nicht: sie kostet einen Vergleich je Kachel, und ihr einziger sinnvoller Ausgang wäre ein
  `throw` auf einer Karte, die heute fehlerfrei rendert. Stattdessen steht die Grenze im TSDoc
  und wird in Schritt 1b festgenagelt.

  **Schritt 1b — `tileKeys.spec.ts`.** Drei Tests. Der zweite ist der einzige, der vor der
  Änderung rot läuft, und er ist der Nachweis für CONS-013 — die anderen beiden halten fest, was
  neu entsteht.

  ```ts
  import {describe, expect, test} from 'vitest';
  import {Map2DSpatialHashGrid} from './Map2DSpatialHashGrid.js';
  import {Map2DTileCoords} from './Map2DTileCoords.js';
  import {packTileCoords, tileKey} from './tileKeys.js';

  describe('tile keys', () => {
    test('a tile key reads x before y, negative coordinates included', () => {
      expect(tileKey(0, 0)).toBe('0,0');
      expect(tileKey(1, 0)).toBe('1,0');
      expect(tileKey(3, -4)).toBe('3,-4');
      expect(tileKey(-3, 4)).toBe('-3,4');
    });

    test('the tile id and the hash grid key are the same key', () => {
      const coords: Array<[number, number]> = [
        [0, 0],
        [1, 0],
        [0, 1],
        [-3, 7],
        [12, -5],
      ];
      for (const [x, y] of coords) {
        const expected = tileKey(x, y);
        expect(new Map2DTileCoords(x, y).id, `tile id of ${expected}`).toBe(expected);
        expect(Map2DSpatialHashGrid.getKey(x, y), `hash grid key of ${expected}`).toBe(expected);
      }
    });

    test('the packed key of a coordinate belongs to that coordinate alone', () => {
      const LIMIT = 33_554_432;
      const coords: Array<[number, number]> = [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [4711, -815],
        [-815, 4711],
        [LIMIT - 1, LIMIT - 1],
        [-LIMIT, -LIMIT],
        [LIMIT - 1, -LIMIT],
        [-LIMIT, LIMIT - 1],
      ];
      const seen = new Map<number, string>();
      for (const [x, y] of coords) {
        const key = packTileCoords(x, y);
        expect(Number.isSafeInteger(key), `${tileKey(x, y)} packs into a safe integer`).toBe(true);
        expect(seen.get(key), `${tileKey(x, y)} shares its key with ${seen.get(key)}`).toBeUndefined();
        seen.set(key, tileKey(x, y));
      }
    });
  });
  ```

  Der rote Lauf des zweiten Tests, vor der Änderung: `tile id of 0,0: expected 'y0x0' to be
  '0,0'`. Er gehört in den Report.

  Die Paare `[1,0]/[0,1]` und `[4711,-815]/[-815,4711]` stehen dort mit Absicht: sie fallen um,
  sobald jemand die Packung symmetrisch macht. Die vier `LIMIT`-Ecken halten die zugesagte
  Grenze.

  **Schritt 2 — `Map2DTileCoords.ts`.** `createID` wird zum Weiterreicher, die Klasse behält
  ihn: er ist der Einstieg, den jemand mit einem `Map2DTileCoords` in der Hand sucht, und nach
  der Änderung kann er nicht mehr von `tileKey` abdriften.

  ```ts
  import {tileKey} from './tileKeys.js';

  export class Map2DTileCoords implements IMap2DTileCoords {
    /**
     * The id of the tile at these coordinates: the shared tile key, so the id of a tile and the
     * bucket key of a `Map2DSpatialHashGrid` for the same coordinate are the same string.
     */
    static createID(x: number, y: number): string {
      return tileKey(x, y);
    }
  ```

  In `Map2DTileCoords.spec.ts:7` wird `'y0x0'` zu `'0,0'`.

  **Schritt 3 — `Map2DSpatialHashGrid.ts`.** `getKey` (`:8-10`) wird zu `return tileKey(x, y);`,
  Import ergänzen. `Map2DSpatialHashGridKeyType` bleibt `string`, die Signatur bleibt. TSDoc an
  `getKey`: der Schlüssel ist derselbe wie die `id` eines `Map2DTileCoords`, wer eine Kachel aus
  einem Visibilitor im Grid sucht, rechnet nichts um. `Map2DSpatialHashGrid.spec.ts` bleibt
  unangetastet — sie geht durch die öffentliche Oberfläche und nennt kein Schlüsselformat.

  **Schritt 4 — `CameraBasedVisibility.ts` auf den numerischen Schlüssel stellen.** Sechs
  Stellen, alle im selben Objekt:

  1. `toBoxId` (`:36`) fällt ersatzlos weg, `import {packTileCoords} from './tileKeys.js';` kommt
     dazu.
  2. `TileBox.id` (`:10`) wird `number`, mit einer TSDoc-Zeile darüber: der gepackte Schlüssel
     der Kachelkoordinate, wie `packTileCoords(x, y)` ihn liefert; wer eine lesbare Kennung
     braucht, nimmt `x` und `y`.
  3. `#visitedIds` (`:105`) wird `Set<number>`, `#previousTilesById` (`:107`) wird
     `Map<number, IMap2DTileCoords>`, `#tileBoxPool` (`:113`) wird `Map<number, TileBox>`. Die
     beiden Kommentare, die noch von `` `${x},${y}` `` (`:109`) und von `toBoxId()` (`:356`)
     sprechen, nennen stattdessen `packTileCoords()`.
  4. `acquireTileBox` (`:245`): `const id = packTileCoords(x, y);`. Signatur bleibt.
  5. In `findVisibleTiles` wird der Index über `previousTiles` (`:264-268`) numerisch befüllt:

     ```ts
     this.#previousTilesById.set(packTileCoords(previousTile.x, previousTile.y), previousTile);
     ```

     und die beiden Zugriffe bei `:333-335` werden zu `this.#previousTilesById.get(tile.id)` und
     `this.#previousTilesById.delete(tile.id)` — `tile.map2dTile` entsteht bei `:329` aus
     `tile.x, tile.y`, also ist `tile.id` genau der Schlüssel, unter dem der Vorgänger derselben
     Kachel eingetragen wurde. Das ist die Stelle, an der zwei Schlüsselräume auf einen
     zusammenfallen; im Review gehört sie nachgerechnet.
  6. Die Nachbarschleife (`:346`) prüft `this.#visitedIds.has(packTileCoords(tx, ty))`.

  Dazu der Zähler, den Schritt 5 braucht. Feld neben `#visibleTiles` (`:102`):

  ```ts
  #serial = 0;
  ```

  und der Lesezugang, direkt hinter `visibles`/`#visibleTiles`:

  ```ts
  /**
   * Counts how often this visibility has rebuilt its state from the camera. It moves with every
   * recomputation — `visibles`, the plane and the plane coordinates are new afterwards — and
   * stands still while the cached tile set is handed back. Whoever mirrors that state compares
   * the value it last saw instead of the state itself.
   */
  get serial(): number {
    return this.#serial;
  }
  ```

  Erhöht wird er an genau einer Stelle in `computeVisibleTiles()`, unmittelbar hinter dem
  Cache-Ausgang bei `:186`, also vor `invalidateTileCoordsCacheIfChanged()`:

  ```ts
      return this.#visibleTiles;
    }

    this.#serial += 1;

    this.invalidateTileCoordsCacheIfChanged();
  ```

  Warum dort und nicht in `findVisibleTiles()`: hinter dem Gate liegen zwei Wege, und beide
  schreiben Zustand. Findet die Kamera die Ebene nicht, läuft `findVisibleTiles()` gar nicht,
  aber `planeWorld`, `pointOnPlane` und `planeOrigin` sind trotzdem neu — ein Konsument, der nur
  auf den Kachelsatz hörte, zeigte danach Punkte an der alten Stelle.

  In `CameraBasedVisibility.spec.ts` ziehen die Typänderungen vier Stellen nach:
  - `:70` `expect(tileIds).toContain('y0x0')` → `'0,0'`
  - `:172` `result.tiles.find((t) => t.id === 'y0x0')` → `'0,0'`
  - `:210-211` `new Map<string, Box3>()` und `new Map<string, Vector3>()` → `new Map<number, …>()`
  - die Meldungstexte, die `${v.id}` einsetzen (`:158-161`, `:225-227`, `:245`, `:258`), nennen
    statt der gepackten Zahl `${v.x},${v.y}` — eine fehlgeschlagene Erwartung soll weiter sagen,
    um welche Kachel es ging.

  `function ids(tiles: {id: string}[] | undefined)` (`:28`) bleibt, wie sie ist: sie arbeitet auf
  `IMap2DTileCoords`, und dessen `id` bleibt ein String.

  In `Map2DTileRenderer.spec.ts:196` wird `['y0x0', 'y0x1']` zu `['0,0', '1,0']`, in
  `Map2DTileStreamer.spec.ts:186` wird `['y0x0', 'y0x1', 'y0x0', 'y0x1']` zu
  `['0,0', '1,0', '0,0', '1,0']`. Die Reihenfolge ist nicht symmetrisch: `y0x1` ist die Kachel
  `x=1, y=0` und heißt danach `'1,0'`, nicht `'0,1'`.

  **Schritt 5 — `CameraBasedVisibilityHelpers.ts`: Umbenennung und Knoten-Pools.** Das ist der
  große Teil des Pakets; die Reihenfolge unten ist auch die Reihenfolge der Arbeit.

  5a. **Die Umbenennung (API-032).** `cammeraBasedVisibility` → `cameraBasedVisibility`, in der
  Deklaration (`:58`) und an den zehn Nutzungen (`:80, 85, 91, 93, 94, 97, 100, 159, 161, 162`).
  Kein Alias, kein `@deprecated` — das ist so beschlossen. Außerhalb dieser Datei gibt es im
  ganzen Repository keine Nutzung, Lookbook eingeschlossen.

  5b. **Die lokale `TileBox`-Kopie (`:9-20`) fällt weg.** Stattdessen
  `import type {CameraBasedVisibility, TileBox} from './CameraBasedVisibility.js';` — die Datei
  importiert die Klasse schon von dort. Die Kopie ist strukturell identisch und würde mit dem
  neuen `id: number` sonst auseinanderlaufen.

  5c. **`PointHelper` wird wiederverwendbar.** Die Größe steckt heute in der `BoxGeometry` und
  macht jeden Knoten unbrauchbar für eine andere Größe. Ein Einheitswürfel plus `scale` löst
  das, ohne dass sich am Bild etwas ändert:

  ```ts
  class PointHelper extends Mesh<BoxGeometry, MeshBasicMaterial> {
    constructor() {
      super(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    }
    // dispose() bleibt unverändert
  }
  ```

  5d. **Die Pools.** Vier Felder neben `#helpers` (`:56`), dazu die Zähler und die Marke:

  ```ts
  // The helper nodes this class keeps alive across updates. A node is built once and then
  // written to; `HelpersManager` disposes it when the whole set goes down, and only then.
  #planeHelper?: PlaneHelper;
  readonly #pointHelpers: PointHelper[] = [];
  readonly #frustumBoxHelpers: Box3Helper[] = [];
  readonly #tileBoxHelpers: Box3Helper[] = [];

  // How many of each pool the current set uses. Whatever sits above that is kept, hidden.
  #pointCount = 0;
  #frustumBoxCount = 0;
  #tileBoxCount = 0;

  // The `serial` of the visibility the current set was built from. -1 means: nothing built.
  #builtSerial = -1;
  ```

  `#frustumBoxHelpers` und `#tileBoxHelpers` sind getrennt, weil die einen in den Root und die
  anderen in die Szene gehen (`addToRoot` bei `:112-138`) und weil sie verschiedene Farben und
  verschiedene Aufweitungen tragen.

  5e. **`update()` bekommt das Tor.**

  ```ts
  update(): void {
    if (!this.#show) return;
    // the manager refuses a node it cannot place, so nothing is built until there is a scene
    if (this.#helpers.scene == null) return;
    if (this.#builtSerial === this.cameraBasedVisibility.serial) return;

    this.#builtSerial = this.cameraBasedVisibility.serial;
    this.createHelpers();
  }
  ```

  `createHelpers()` bleibt der Name und der Aufbau, wird aber `private` und schreibt in die Pools
  statt zu bauen: Zähler auf 0, `updatePlaneHelpers()`, `updateTileHelpers(…visibles)`, dann
  `hideSurplus()`. Der `.map2dCoords`-Block bleibt am Ende stehen, wie er ist.

  Der `show`-Setter (`:64-72`) wird zu:

  ```ts
  set show(show: boolean) {
    if (this.#show === show) return;
    this.#show = show;
    if (show) {
      this.update();
    } else {
      this.#helpers.remove();
      this.releasePools();
    }
  }
  ```

  5f. **Die Ausgabestellen.** `addPointHelper` und `addBoxHelper` werden zu Schreibern. Der
  `addToRoot`-Parameter von `addPointHelper` fällt weg — jede der vier Aufrufstellen übergibt
  heute `true`.

  ```ts
  private placePointHelper(point: Vector3, size: number, color: ColorRepresentation): void {
    let helper = this.#pointHelpers[this.#pointCount];
    if (helper === undefined) {
      helper = new PointHelper();
      this.#pointHelpers.push(helper);
      this.#helpers.add(helper, true);
    }
    helper.visible = true;
    helper.position.copy(point);
    helper.scale.setScalar(size);
    helper.material.color.set(color);
    this.#pointCount += 1;
  }

  private placeBoxHelper(pool: Box3Helper[], addToRoot: boolean, box: Box3, expand: number, color: Color): number {
    const index = pool === this.#frustumBoxHelpers ? this.#frustumBoxCount : this.#tileBoxCount;
    let helper = pool[index];
    if (helper === undefined) {
      // its own Box3: the helper follows whatever sits in `box`, and the boxes of a TileBox
      // belong to the visibility and are rewritten there
      helper = new Box3Helper(new Box3(), color);
      pool.push(helper);
      this.#helpers.add(helper, addToRoot);
    }
    helper.visible = true;
    helper.box.copy(box);
    helper.box.expandByVector(helper.box.getSize(_size).multiplyScalar(expand));
    // `Box3Helper` types its material as `Material | Material[]`; three builds it with a single
    // `LineBasicMaterial`, and the color of that one is what the caller picked
    (helper.material as LineBasicMaterial).color.copy(color);
    return index;
  }
  ```

  Der Rückgabewert ist Beiwerk; die beiden Zähler erhöht der Aufrufer, damit im Rumpf keine
  Pool-Fallunterscheidung nötig ist. Wer das lieber sauber trennt, gibt den Zähler als Objekt
  weiter oder schreibt zwei kleine Wrapper `placeFrustumBoxHelper` / `placeTileBoxHelper` — die
  Form ist frei, die Zusage nicht: **kein `Box3Helper` und kein `PointHelper` wird in einem
  `update()` neu gebaut, solange der Pool einen freien Platz hat.**

  `_size` ist ein modulweiter `const _size = new Vector3();` neben den anderen Konstanten der
  Datei — `addBoxHelper` legt heute je Aufruf einen an (`:150`).

  Das Klonen der Box (`:149`) entfällt: der Helfer trägt seine eigene `Box3` und bekommt den Wert
  hineinkopiert. Das ist zugleich der Grund, warum das Aufweiten den Quellwert nicht mehr
  anfassen kann.

  5g. **Der Plane-Helper wird genau einmal gebaut.** `new PlaneHelper(planeWorld, 100, 0x20f040)`
  hält die Ebene als Referenz und folgt ihr von allein; `CameraBasedVisibility` schreibt immer in
  dieselbe `planeWorld`-Instanz (`:236-239`).

  ```ts
  private updatePlaneHelpers(): void {
    if (this.#planeHelper === undefined) {
      this.#planeHelper = new PlaneHelper(this.cameraBasedVisibility.planeWorld, 100, 0x20f040);
      this.#helpers.add(this.#planeHelper, true);
    }
    // ... die vier Punkte wie bisher, über placePointHelper()
  }
  ```

  Die Reihenfolge der Punkte bleibt: `pointOnPlane` (falls gesetzt, Größe 10, `0xc0c0c0`),
  `planeOrigin` (5, `0x406090`), `ux` (5, `0xff0000`), `uy` (5, `0x00ff00`). Fällt `pointOnPlane`
  zwischen zwei Aufbauten weg, rutschen die übrigen einen Platz vor — das ist harmlos, weil
  Position, Größe und Farbe bei jedem Durchgang geschrieben werden.

  `makePointOnPlane()` (`:157-163`) darf weiter allozieren: es läuft jetzt je Neuberechnung
  statt je Bild, und drei `Vector3` dort sind kein Posten mehr.

  5h. **`hideSurplus()` und `releasePools()`.**

  ```ts
  /** A node the current set does not need stays in the pool and out of sight. */
  private hideSurplus(): void {
    for (let i = this.#pointCount; i < this.#pointHelpers.length; ++i) this.#pointHelpers[i]!.visible = false;
    for (let i = this.#frustumBoxCount; i < this.#frustumBoxHelpers.length; ++i) this.#frustumBoxHelpers[i]!.visible = false;
    for (let i = this.#tileBoxCount; i < this.#tileBoxHelpers.length; ++i) this.#tileBoxHelpers[i]!.visible = false;
  }

  /**
   * Forgets the pooled nodes. Whoever calls this has just handed the whole set to the manager
   * to take down, and the manager disposes what it takes down — a pool that kept its entries
   * would hand out released geometry on the next update.
   */
  private releasePools(): void {
    this.#planeHelper = undefined;
    this.#pointHelpers.length = 0;
    this.#frustumBoxHelpers.length = 0;
    this.#tileBoxHelpers.length = 0;
    this.#pointCount = 0;
    this.#frustumBoxCount = 0;
    this.#tileBoxCount = 0;
    this.#builtSerial = -1;
  }
  ```

  `releasePools()` läuft an drei Stellen und nirgends sonst: im `show`-Setter beim Abschalten,
  in `add(scene)`, wenn die Szene wirklich wechselt (der Setter von `HelpersManager#scene` nimmt
  dabei das alte Set herunter), und in `remove(scene)`.

  ```ts
  add(scene: Object3D): void {
    if (this.#helpers.scene === scene) return;
    this.#helpers.scene = scene;
    this.releasePools();
  }

  remove(scene: Object3D): void {
    this.#helpers.removeFromScene(scene);
    this.releasePools();
  }
  ```

  Das ist die Stelle, an der ein übersehener Pfad teuer wird: ein Pool, der einen abgeräumten
  Knoten behält, hängt beim nächsten `update()` eine freigegebene Geometrie in die Szene. Im
  Review gehört jede Stelle geprüft, die `#helpers.remove()` oder `#helpers.removeFromScene()`
  ruft.

  5i. **`maxDebugHelpers` bleibt, wie es zählt.** Die Kappung vergleicht heute den Laufindex `i`
  über `visibles` (`:124`) und nicht die Zahl der gebauten Frustum-Helfer. Das ist eine
  vorbestehende Ungenauigkeit, sie steht als Nebenbefund in der Queue und wird hier **nicht**
  geändert — der Umbau soll das Bild nicht verschieben.

  **Schritt 6 — `CameraBasedVisibilityHelpers.spec.ts`.** `makeVisibility()` bekommt ein
  schreibbares `serial: 0`. Der Test `releases the geometry and the material of every helper node
  it takes down` (`:47-70`) und `builds no helper while no scene has been handed over`
  (`:91-104`) bleiben unverändert und müssen grün bleiben.

  `releases the helper nodes an update replaces` (`:72-89`) beschreibt genau das Verhalten, das
  dieses Paket abschafft, und wird durch zwei Tests ersetzt. Beide sind vor der Änderung rot:

  ```ts
  test('an update finds nothing to do while the visibility stands still', () => {
    const scene = new Object3D();
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

    helpers.add(scene);
    helpers.show = true;

    const nodes = [...scene.children];
    const released = spyOnReleases(scene);

    helpers.update();

    expect(scene.children, 'the same nodes, in the same order').toEqual(nodes);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }
  });

  test('an update after a recomputation writes into the nodes it already has', () => {
    const scene = new Object3D();
    const visibility = makeVisibility();
    const helpers = new CameraBasedVisibilityHelpers(visibility);

    helpers.add(scene);
    helpers.show = true;

    const nodes = [...scene.children];
    const released = spyOnReleases(scene);

    visibility.pointOnPlane!.set(5, 0, 7);
    (visibility as unknown as {serial: number}).serial += 1;
    helpers.update();

    expect(scene.children, 'the same nodes, in the same order').toEqual(nodes);
    expect(
      scene.children.some((node) => node.type === 'Mesh' && node.position.equals(new Vector3(5, 0, 7))),
      'and the point helper followed the point it marks',
    ).toBe(true);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }
  });
  ```

  Rote Läufe vor der Änderung: im ersten `expected [ … ] to deeply equal [ … ]` an der
  Knotenliste (heute baut `update()` fünf neue Knoten) plus `expected "spy" to be called 0 times,
  but got 1 time`; im zweiten dasselbe. Beide gehören in den Report. `serial` steht auf der
  Attrappe und nicht auf dem Typ, deshalb der Cast — `makeVisibility()` castet ohnehin schon.

  **Schritt 7 — `public-api.ts`.** `export * from './tileKeys.js';` ergänzen, eingeordnet nach
  der vorhandenen Sortierung: zwischen `./RepeatingTilesProvider.js` und
  `./TileSprites/descriptors.js`.

  **Schritt 8 — der Browsertest**, `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`.
  Die Konvention verlangt für Rendering-Code einen Browsertest, und hier zahlt er: der Vitest-Lauf
  fährt gegen ein nacktes `Object3D` ohne Renderer, und die Zusage dieses Pakets ist gerade, dass
  über echte Frames hinweg dieselben Knoten samt Geometrie in der Szene stehenbleiben.

  `makeContainer`, `disposeDisplay` und der `beforeEach`/`afterEach`-Rahmen samt
  `this.timeout(20000)` werden eins zu eins aus `map2d-tile-upload.test.js` übernommen; `makeMap`
  ebenso, nur gibt es zusätzlich den Visibilitor heraus. `web-test-runner.config.js` sammelt
  `test/**/*.test.js` ein, es ist nichts zu registrieren.

  ```js
  function makeMap(camera) {
    const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
    const tileData = new RepeatingTilesProvider([
      [1, 2],
      [3, 4],
    ]);
    const tileSprites = new TileSprites(new TileSpritesGeometry(512), new TileSpritesMaterial());
    const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));

    const visibility = new CameraBasedVisibility(camera);

    const map2d = new Map2D();
    map2d.tileWidth = 256;
    map2d.tileHeight = 256;
    map2d.xOffset = -128;
    map2d.yOffset = -128;
    map2d.visibilitor = visibility;
    map2d.addTileRenderer(tileRenderer);

    return {map2d, visibility};
  }

  /** Every node the helpers put into the scene graph carries the mark HelpersManager sets. */
  function helperNodes(...roots) {
    const found = [];
    for (const root of roots) {
      for (const child of root.children) {
        if (child.userData.isHelper) found.push(child);
      }
    }
    return found;
  }

  /** The values every box helper shows, as one string: it changes as soon as one box moves. */
  function boxSignature(nodes) {
    return nodes
      .filter((node) => node.box != null)
      .map((node) => `${node.box.min.toArray().join()}|${node.box.max.toArray().join()}`)
      .join(';');
  }
  ```

  Im `describe` ein Helfer, der ein Bild fährt:

  ```js
  async function frame(map2d, helpers) {
    map2d.update();
    helpers.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();
  }
  ```

  Zwei Tests:

  ```js
  it('a still frame leaves every helper node in place', async function () {
    const {map2d, visibility} = makeMap(camera);
    scene.add(map2d);

    const helpers = new CameraBasedVisibilityHelpers(visibility);
    helpers.add(map2d);
    helpers.show = true;

    // the first render puts the camera projection onto the coordinate system of the renderer,
    // which moves the projection matrix once; from the second frame on it stands still
    await frame(map2d, helpers);
    await frame(map2d, helpers);

    const before = helperNodes(scene, map2d);
    expect(before.length, 'helper nodes after the warm-up frames').to.be.greaterThan(0);
    const geometries = before.map((node) => node.geometry);
    const serial = visibility.serial;

    await frame(map2d, helpers);

    expect(visibility.serial, 'the visibility recomputed nothing').to.equal(serial);

    const after = helperNodes(scene, map2d);
    expect(after.length, 'the number of helper nodes').to.equal(before.length);
    for (let i = 0; i < after.length; ++i) {
      expect(after[i], `helper node ${i}`).to.equal(before[i]);
      expect(after[i].geometry, `geometry of helper node ${i}`).to.equal(geometries[i]);
    }
  });

  it('a moved map writes into the helper nodes it already has', async function () {
    const {map2d, visibility} = makeMap(camera);
    scene.add(map2d);

    const helpers = new CameraBasedVisibilityHelpers(visibility);
    helpers.add(map2d);
    helpers.show = true;

    await frame(map2d, helpers);
    await frame(map2d, helpers);

    const before = helperNodes(scene, map2d);
    expect(before.length, 'helper nodes after the warm-up frames').to.be.greaterThan(0);
    const signature = boxSignature(before);
    const serial = visibility.serial;

    map2d.centerX = 1024;
    await frame(map2d, helpers);

    expect(visibility.serial, 'the visibility recomputed').to.be.greaterThan(serial);

    const after = helperNodes(scene, map2d);
    expect(after.length, 'no node was taken out').to.be.at.least(before.length);
    for (let i = 0; i < before.length; ++i) {
      expect(after[i], `helper node ${i} survived the recomputation`).to.equal(before[i]);
    }
    expect(boxSignature(after), 'the boxes moved with the map').to.not.equal(signature);
  });
  ```

  Vor der Änderung sind beide rot an `helper node 0`: `update()` baut heute jedes Bild einen
  frischen Satz, und `expected {…} to equal {…}` vergleicht Instanzen. Beide roten Läufe gehören
  in den Report, aus Chromium und aus Firefox.

  Importe: `{CameraBasedVisibility, CameraBasedVisibilityHelpers, Display, Map2D,
  Map2DTileRenderer, RepeatingTilesProvider, TextureCoords, TileSet, TileSprites,
  TileSpritesFactory, TileSpritesGeometry, TileSpritesMaterial}` aus `@spearwolf/twopoint5d`,
  `{PerspectiveCamera, Scene}` aus `three/webgpu`, `{expect}` aus `@esm-bundle/chai`.

  **Was der Implementierer als Nebenbefund meldet und nicht behebt:** alles, was in den
  berührten Dateien auch ohne dieses Paket falsch war. Drei solche Punkte stehen bereits in
  »Offene Befunde« und brauchen keine zweite Meldung: die Bauart von
  `RectangularVisibilityAreaHelpers.update()`, der `.map2dCoords`-Block und die Zählweise von
  `maxDebugHelpers`.
- Verify: `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser && pnpm checkNameableTypes && pnpm checkPkgTypes`
  — die beiden letzten stehen hier zusätzlich, weil dieses Paket die veröffentlichte Typ-Oberfläche
  ändert (`TileBox.id`, zwei neue Exporte, ein neuer Getter) und `pnpm typecheck` die gebauten
  `.d.ts` nicht ansieht; beide bauen `dist/` selbst. Im Log nachsehen, ob `typecheck`, `test:ci`
  und `test:browser` wirklich gelaufen sind; meldet Nx sie als aus dem Cache bedient, dieselben
  Tasks mit `--skip-nx-cache` nachfahren. `pnpm lint` ist reines `eslint . && prettier --check .`
  und kennt keinen Cache.
- Commit:

  ```
  fix(map2d): give every tile coordinate one key and let the visibility helpers keep their nodes

  BREAKING CHANGE: `Map2DTileCoords.id` and the bucket keys of `Map2DSpatialHashGrid` read
  `x,y`. The `id` of a `TileBox` is the packed numeric key of its coordinate, and
  `CameraBasedVisibilityHelpers` names its visibility `cameraBasedVisibility`.
  ```
- Ergebnis: 1 Runde · CONS-013, API-032 und PERF-014 alle behoben, vom Reviewer je mit
  Fundstelle bestätigt (`tileKeys.ts:7, 26` und der lückenlos numerische Hot-Path in
  `CameraBasedVisibility.ts`; `CameraBasedVisibilityHelpers.ts:64`; die vier Knoten-Pools bei
  `CameraBasedVisibilityHelpers.ts:51-54` samt Serial-Tor bei `:235-243`) · repoweit null
  Vorkommen von `cammera`, `y0x`, `x;y` oder `toBoxId`, `apps/lookbook/` eingeschlossen · Verify
  `pnpm lint && pnpm typecheck && pnpm test:ci && pnpm test:browser && pnpm checkNameableTypes &&
  pnpm checkPkgTypes` exit 0, Log `paket-6.verify.log`; die fünf cachefähigen Tasks von vornherein
  mit `--skip-nx-cache` gefahren, das Log weist für jeden »Cache: Skipped« aus · Regressionstests,
  alle vor der Änderung rot gesehen: `tileKeys.spec.ts` — `the tile id and the hash grid key are
  the same key` (`expected 'y0x0' to be '0,0'`); `CameraBasedVisibilityHelpers.spec.ts` — `an
  update finds nothing to do while the visibility stands still` und `an update after a
  recomputation writes into the nodes it already has` (beide an der Knotenidentität, verschiedene
  `uuid` bei sonst gleichem Objekt); dazu der Browsertest `map2d-visibility-helpers.test.js` mit
  beiden `it` · sechs Abweichungen vom Detailplan, alle vom Reviewer nachgeprüft und abgenommen:
  die beiden Browsertests waren im Vorzustand nicht an der angesagten Assertion rot, sondern gar
  nicht zu Ende zu bringen (weder in 120 s noch in 900 s — rund 500 je Bild neu gebaute
  `Box3Helper` im Software-Backend); für diesen Vorzustandslauf war `CameraBasedVisibilityHelpers.ts:10`
  einzeilig anzupassen, wovon im Endstand nichts steht; die zusätzlich angesagte Zeile `expected
  "spy" to be called 0 times` erschien nicht, weil beide Tests davor abbrechen; die drei
  blocklokalen `const tileKey` in `Map2DSpatialHashGrid.ts` heißen `key`, um die importierte
  Funktion nicht zu beschatten; `placeBoxHelper` ist ein geteilter Rumpf mit zwei Wrappern statt
  der Form mit dem Pool-Vergleich (vom Plan freigegeben); und die vier `expectDefined`-Meldungen
  nennen `${tile.x},${tile.y}`, weil `tile.id` dort eine sechzehnstellige Zahl wäre
- Klein, nicht behoben — vom Reviewer eingestuft, keine Runde ausgelöst; alle vier gehen als
  Folge dieses Pakets an Paket 8:
  - `CameraBasedVisibilityHelpers.ts:239` — das Serial-Tor legt die öffentlichen Stellschrauben
    still: `maxDebugHelpers` (`:36`), `tileBoxHelperExpand`/`frustumBoxHelperExpand` (`:38-39`)
    und die vier Farben (`:41-44`) wirken erst, wenn die Visibility neu rechnet. Kein TSDoc sagt
    das.
  - `CameraBasedVisibility.ts:109-112` — das TSDoc von `serial` sagt zu, `visibles` sei nach
    jedem Zählerschritt neu. Auf dem Weg bei `:223-226` (die Kamera trifft die Ebene nicht)
    steigt der Zähler, `visibles` behält aber den alten Kachelsatz.
  - `CameraBasedVisibilityHelpers.ts:230-233` — `remove(scene)` räumt die Pools bedingungslos.
    Mit einer fremden Szene aufgerufen bleiben die Kachelbox-Helfer referenzlos und ohne
    `dispose()` im Graphen stehen, und das nächste `update()` legt einen zweiten Satz darüber.
  - `CameraBasedVisibilityHelpers.spec.ts:17` und
    `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js:172` — die Attrappe fährt
    `visibles: []`, also berühren die Unit-Tests weder `placeBoxHelper` noch `hideSurplus`; der
    Browsertest prüft nur `at.least(before.length)`. Der schrumpfende Kachelsatz ist richtig
    gebaut, aber von keinem Test gehalten.
- Nebenbefunde: → »Offene Befunde«
- Folgen:
  - Die vier kleinen Befunde oben — alle vier entstehen aus den Knoten-Pools und dem Serial-Tor,
    die dieses Paket eingeführt hat, und haben damit dieselbe Ursache. → Paket 8 (neu
    geschnitten, `Folge von: Paket 6`)
  - `packages/twopoint5d/CHANGELOG.md` — die Breaking Changes dieses Pakets wollen einen Eintrag:
    das Schlüsselformat von `Map2DTileCoords.id` und `Map2DSpatialHashGrid`, der Typwechsel von
    `TileBox.id`, die Umbenennung von `cammeraBasedVisibility` und die beiden neuen Exporte.
    → Abschluss des Laufs, wo das CHANGELOG ohnehin geschrieben wird
- Schnittstellen:
  - `tileKey(x, y): string` und `packTileCoords(x, y): number` — zwei neue Exporte aus
    `map2d/tileKeys.ts`, re-exportiert über `map2d/public-api.ts`. `tileKey` baut `` `${x},${y}` ``
    und ist das eine textuelle Schlüsselformat des Moduls; `packTileCoords` packt kollisionsfrei
    für jede Koordinate in `[-33554432, 33554431]`, darüber hinaus still auf einen fremden Wert
  - `Map2DTileCoords.id` und `Map2DTileCoords.createID(x, y)` — lesen `x,y`. Das Format
    `y<hex>x<hex>` gibt es nicht mehr; wer einen `id` persistiert oder selbst zusammengebaut hat,
    liest ihn nicht mehr wieder
  - `Map2DSpatialHashGrid.getKey(x, y)` — liefert dasselbe `x,y`. Das Format `x;y` ist weg, und
    ein Kachelschlüssel aus dem Visibilitor passt jetzt ohne Umrechnung auf einen Bucket
  - `TileBox.id: number` — der gepackte Schlüssel aus `packTileCoords(x, y)` statt eines Strings.
    `IMap2DTileCoords.id` bleibt unverändert `string`; die beiden Typen tragen nicht mehr
    denselben Schlüsselraum
  - `CameraBasedVisibility.serial: number` — neuer öffentlicher Getter. Er steigt bei jeder
    Neuberechnung und ist das Signal, an dem ein Konsument erkennt, dass `visibles` neu ist. Er
    hängt am selben Dirty-Check wie der Kachelsatz und erbt damit dessen Lücke bei
    `frustumBoxScale` (steht in »Offene Befunde«)
  - `CameraBasedVisibilityHelpers.cameraBasedVisibility` — das öffentliche `readonly`-Feld, hart
    umbenannt. Kein Alias, kein Deprecation-Zyklus
  - `CameraBasedVisibilityHelpers.update()` — baut nur neu, wenn `CameraBasedVisibility.serial`
    sich bewegt hat; die Helfer-Knoten werden gehalten und beschrieben statt weggeworfen. Die
    öffentlichen Stellschrauben der Klasse wirken deshalb ab der nächsten Neuberechnung, nicht
    sofort

**CONS-013 · low · packages/twopoint5d/src/map2d/CameraBasedVisibility.ts:36;
packages/twopoint5d/src/map2d/Map2DTileCoords.ts:5-7;
packages/twopoint5d/src/map2d/Map2DSpatialHashGrid.ts:8-10** — Drei String-Formate für dieselbe
Kachelkoordinate

`toBoxId` baut `x,y`, `Map2DTileCoords.createID` baut `y<hex>x<hex>`, `Map2DSpatialHashGrid.getKey`
baut `x;y`. Drei Schlüsselräume für dasselbe Tupel; `CameraBasedVisibility` erzeugt pro sichtbarer
Kachel bis zu acht Nachbar-Strings je Neuberechnung. Wer eine Kachel aus dem Visibilitor im
Hash-Grid sucht, muss den Schlüssel umrechnen.

Empfehlung: Eine Funktion `tileKey(x, y)` im Modul, von allen drei Stellen genutzt. Für den
Hot-Path in `CameraBasedVisibility` lohnt ein numerischer Schlüssel (`(y << 16) ^ (x & 0xffff)`
oder eine verschachtelte `Map`), der die String-Allokation ganz vermeidet.

**API-032 · low · packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:38** — Ein
Tippfehler steht in einem öffentlichen readonly-Feld

Das öffentliche `readonly`-Feld heißt `cammeraBasedVisibility`, mit zwei m. Im Remediation-Lauf vom
2026-09-06 erneut bestätigt: `readonly cammeraBasedVisibility` in
`CameraBasedVisibilityHelpers.ts:58`, viermal in der Datei benutzt.

Empfehlung: Umbenennen und in einem Major mitführen. Der Weg ohne Bruch: das richtig geschriebene
Feld dazulegen, das alte als deprecated markieren und im nächsten Major entfernen.

**PERF-014 · low · packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:149-154** —
update() der Sichtbarkeits-Helfer baut jeden Frame den ganzen Satz neu

`update()` wirft jeden Helfer weg und baut den ganzen Satz neu auf. Bei eingeschalteten Helfern
kostet das je gerendertem Bild eine `BoxGeometry` und ein `MeshBasicMaterial` je Punkt-Helfer, dazu
einen `PlaneHelper` und einen `Box3Helper` je sichtbarer Kachel — Allokation und Freigabe im selben
Frame. Kein Leck mehr, seit der Remediation-Lauf die Freigabe vollständig macht, aber GC- und
Renderer-Druck. Aufgefallen in einem früheren Remediation-Lauf; der Code wurde seitdem nicht neu
auditiert.

Empfehlung: Die Knoten wiederverwenden und nur Positionen aktualisieren; nur ein geänderter
Kachelsatz baut neu.

### [x] 7. Die Ownership-Regel kennt die Übernahme des adoptierten Renderers

- Findings: — (Folge, kein Audit-Finding)
- Folge von: Paket 1
- Ziel: `docs/resource-lifecycle.md` spricht die Übernahme aus, die der Code an zwei Stellen bereits vollzieht, und die drei Stellen, die die Ownership-Regel heute ohne Einschränkung formulieren, tragen die Ausnahme. Der Kommentar, der dieselbe Frage auf der Testseite offenlässt, wird mitgezogen und bekommt seinen Fall.
- Bereich: `packages/twopoint5d/docs/resource-lifecycle.md` und
  `packages/twopoint5d-testing/test/` (`display-adopt-renderer.test.js`,
  `display-dispose.test.js`)
- Hängt ab von: —
- Hash: 515575a
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/docs/resource-lifecycle.md`,
  `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`,
  `packages/twopoint5d-testing/test/display-dispose.test.js`
- Vorgehen:
  1. `docs/resource-lifecycle.md`, §2: **hinter Zeile 22** (dem Absatz, der mit
     »returning a pool from a getter does not transfer it.« endet) und **vor** der
     Referenzimplementierung einen eigenen Absatz einfügen. Er sagt genau drei Dinge und
     nichts darüber hinaus:
     - Eine Übernahme ist möglich, aber nur dort, wo die entgegennehmende Stelle sie in
       ihrem eigenen TSDoc ausspricht — am Konstruktorparameter, am Feld, an der Methode.
       Fehlt die Zusage, gilt die Regel darüber unverändert.
     - Zwei Stellen des Pakets tun das heute: `Display` übernimmt den `WebGPURenderer`,
       den sein Konstruktor entgegennimmt, und gibt ihn in `dispose()` frei
       (`../src/display/Display.ts`); `Canvas2DStage` übernimmt jede Textur, die in
       seinem Feld `texture` landet, gleich ob von außen zugewiesen oder selbst gebaut
       (`../src/stage/Canvas2DStage.ts`).
     - Der Absatz ist als Anforderung formuliert, nicht als Inventar: keine Zahl, kein
       »the only«, keine Behauptung über Vollständigkeit. Eine dritte Übernahme, die
       ihre Zusage nicht ausspricht, ist damit weiterhin ein Fehler und nicht eine
       Lücke dieses Absatzes.
     Verlinkt wird über relative Pfade `../src/…`, wie im übrigen Dokument. Der Absatz
     bei `:43-52` (»Do not introduce a new take-over flag«) bleibt unangetastet und
     widerspricht nicht: dort geht es um eine Option, die ein Aufrufer je Aufruf setzt,
     hier um eine unbedingte Zusage der Klasse. Kein Wort im neuen Absatz darf nach
     `autoDispose` klingen.
  2. `docs/resource-lifecycle.md`, §7, **Punkt 1 der Checkliste** (`:264-265`, endet auf
     »and touch nothing else that was handed in«): den Halbsatz um die Ausnahme weiten —
     unangetastet bleibt, was hereingereicht wurde, sofern die entgegennehmende Stelle
     die Übernahme nicht in ihrem TSDoc ausspricht (Verweis auf §2). Ein Satz innerhalb
     des vorhandenen Punktes, kein neuer Punkt: die Checkliste bleibt neun Punkte lang.
  3. `docs/resource-lifecycle.md`, §8: den Skelett-Code **nicht** ändern — er zeigt den
     Normalfall. Stattdessen **direkt hinter dem Codeblock** (`:383`, vor dem vorhandenen
     Absatz zu Assertion (e)) einen Absatz im Duktus der Nachbarn einfügen: eine Klasse,
     die nach §2 eine Übernahme ausspricht, kehrt Assertion (b) um — sie prüft, dass
     `dispose()` die hereingereichte Ressource genau einmal freigibt, und der Testname
     sagt das. `Display` mit einem `WebGPURenderer` am Konstruktor ist der Fall im Paket;
     er steht in `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`, weil
     ein `WebGPURenderer` einen echten Browser braucht.
  4. `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`: einen dritten Fall
     anhängen, `it('releases the renderer it was handed', …)`:
     - `display = new Display(renderer);`
     - `await display.start();` **vor** dem `dispose()`. Der Konstruktor ruft
       `renderer.init()` auf beiden Wegen (`Display.ts:427`); ein `dispose()` in dieses
       Fenster hinein prüfte etwas anderes als seinen Namen. Dieselbe Vorsichtsmaßnahme
       steht begründet in `display-dispose.test.js:198-200`.
     - `renderer.dispose` zählend umhüllen, im Idiom der Nachbardatei
       (`display-dispose.test.js:184-195`): `const realDispose = renderer.dispose.bind(renderer);`
       dann eine Zählvariable und `renderer.dispose = () => { … realDispose(); }`. Die
       Umhüllung wird **nach** `await display.start()` und **vor** `display.dispose()`
       gesetzt.
     - `display.dispose();` und danach die Erwartung, dass der Zähler auf `1` steht, mit
       einer Meldung im Stil der Datei (zweites Argument von `expect`).
     - Das `afterEach` der Datei bleibt unverändert. Es ruft `display.dispose()` ein
       zweites Mal; der Aufruf kehrt an `Display.ts:799` früh zurück, der Zähler bleibt
       bei `1`.
  5. `packages/twopoint5d-testing/test/display-dispose.test.js:56-59`: der Kommentarabsatz
     zu Assertion (b) sagt heute, wem der Renderer gehört, sei nicht die Frage dieser
     Tests. Nach den Schritten 1 und 3 ist sie beantwortet. Den Absatz ersetzen: Assertion
     (b) ist für `Display` umgekehrt — ein an den Konstruktor gereichter `WebGPURenderer`
     wird übernommen, und der Fall dazu steht in `display-adopt-renderer.test.js`. Die
     Kommentarabsätze zu (a), (c), (d), (e) und (f) bleiben Wort für Wort stehen.
- Nicht anfassen:
  - `CHANGELOG.md` — dieses Paket bewegt keine öffentliche Oberfläche. Der CHANGELOG wird
    beim Abschluss des Laufs geschrieben, wie bei jedem Paket davor.
  - `src/display/Display.ts` und `src/stage/Canvas2DStage.ts` — beide sagen in ihrem TSDoc
    bereits, was sie tun. Dieses Paket zieht die Regel zu ihnen, nicht umgekehrt.
  - Der offene Punkt aus Paket 1, dass `display-adopt-renderer.test.js` keinen Fall mit
    einem vorab per `await renderer.init()` hochgefahrenen Renderer fährt. Andere Ursache,
    unter Paket 1 vermerkt, gehört nicht in diesen Diff.
- Zwei Behauptungen, die nicht fallen dürfen: Beide standen in einem verworfenen ersten
  Versuch, und sie sind der Grund, warum dieses Paket eigens geschnitten ist.
  - »the only take-over in the package« — unbelegt, und `Canvas2DStage#texture` widerlegt
    jede Zählung. Schritt 1 formuliert deshalb eine Anforderung statt einer Liste.
  - »`Display.dispose()` releases both«, gemeint Renderer und Canvas — `dispose()` ruft
    `renderer.dispose()` (`Display.ts:808`) und gibt danach das Feld auf. Über den Verbleib
    des `<canvas>` im DOM sagt dieser Weg nichts, und der Nebenbefund dazu
    (`Display.ts:808` in »Offene Befunde«) ist offen. Kein Satz dieses Pakets trifft eine
    Aussage über DOM-Knoten.
- Ton: englischer Text im Duktus des Dokuments, kein Rückblick auf den Vorzustand (kein
  »previously«, »used to«, »now also«), keine Finding-IDs — auch nicht im Test und nicht in
  der Commit-Message. Der Text schreibt eine Ausnahme auf, ohne zu erzählen, dass sie neu ist.
- Verify: `pnpm lint && pnpm test:browser`
- Commit: `docs(twopoint5d): let the ownership rule name the take-overs it already has`
- Ergebnis: 2 Runden · alle fünf Schritte des Detailplans umgesetzt und vom Reviewer je mit
  Fundstelle am Code bestätigt: §2-Absatz (`resource-lifecycle.md:24-32`), §7 Punkt 1
  (`:274-276`), §8-Absatz hinter dem Skelett (`:394-398`), der dritte Fall in
  `display-adopt-renderer.test.js:50-68` und der ersetzte Kommentarabsatz in
  `display-dispose.test.js:57-59` · beide Behauptungen, die nicht fallen durften, halten:
  keine Zählung der Übernahmen und kein Satz über DOM-Knoten · Verify
  `pnpm lint && pnpm test:browser` exit 0, Log `paket-7.verify.log`; `twopoint5d-testing:test`
  lief echt (18,3 s, Chromium und Firefox), aus dem Nx-Cache kam allein der vorgelagerte
  `twopoint5d:build`, und `pnpm lint` kennt keinen Cache · kein Regressionstest, weil das Paket
  keinen Korrektheitsfehler behebt: der neue Browsertest hält eine Zusage fest, die der Code
  schon einlöste, und lief gegen den Stand vor der Doku-Änderung grün — dass er misst, ist mit
  einer testweise auf `2` gedrehten Erwartung gezeigt (`expected 1 to equal 2`)
- Fehlerkette: Runde 1 hatte zwei `wichtig`-Befunde zu schließen, beide in
  `packages/twopoint5d/src/stage/README.md` — der Cheat-Sheet, auf die `resource-lifecycle.md:11-13`
  als Detailort des Display-Layers verweist. `:440` trug wörtlich die zweite der beiden
  Behauptungen, gegen die dieses Paket geschnitten ist (»releases the renderer + canvas«), und
  `:47` formulierte für `Canvas2DStage` weiter die absolute Ownership-Regel, die der neue
  §2-Absatz für dieses Feld gerade aufhebt. Beide Sätze sind umformuliert und vom zweiten
  Reviewer am Code gegengeprüft; danach 0 offene Befunde. Die Datei stand nicht im Detailplan,
  aber auch nicht auf »Nicht anfassen« — sie fällt unter »was die eigene Änderung umwirft«.
- Klein, nicht behoben — vom zweiten Reviewer eingestuft, keine Runde ausgelöst:
  - `packages/twopoint5d/src/stage/README.md:47` — die neue Tabellenzelle fasst
    `Canvas2DStage.dispose()` unscharf zusammen: die Vorgänger-Texturen fallen nicht dort,
    sondern beim Tausch in `updateTexture()` (`Canvas2DStage.ts:132-142`), und
    `#placeholderTexture` (`:221`) hat nie im `texture`-Feld gesessen, fällt unter der
    Formulierung »every texture that sat in its `texture` field« also heraus. Die
    Lebenszyklus-Zeile `:437-439` hat sie noch mit drin. Geleakt wird nichts.
  - `packages/twopoint5d-testing/test/display-dispose.test.js:52-55` — vom Implementierer als
    Nebenbefund gemeldet, vom Reviewer geprüft und verworfen: der Kommentar zu Assertion (a)
    spricht über den Nachweis freigegebener Backend-Ressourcen, der neue Test über den Nachweis
    der Übernahme. Zwei Aussagen über dasselbe Spy, kein Widerspruch. Nicht in die Queue.
- Nebenbefunde: → »Offene Befunde«
- Folgen: keine. Die Zeilennummern in §7 und §8 von `resource-lifecycle.md` verschieben sich um
  die neun neuen Zeilen aus §2; kein Verweis im Plan und keiner in der Datei selbst zeigt auf
  eine Zeilennummer darin.
- Schnittstellen: keine — das Paket bewegt keine öffentliche Oberfläche. Was es festschreibt,
  ist eine Regel über bestehende: eine Übernahme gilt nur, wo die entgegennehmende Stelle sie
  im eigenen TSDoc ausspricht (`docs/resource-lifecycle.md` §2), und `Display#renderer` sowie
  `Canvas2DStage#texture` sind die Fälle, die das heute tun.

Der Konstruktorweg, bei dem der Aufrufer einen fertigen `WebGPURenderer` übergibt, war
vor Paket 1 unbenutzbar und ist es seitdem nicht mehr. `Display` übernimmt diesen Renderer
samt seinem `domElement` und gibt ihn in `dispose()` frei; das steht im TSDoc der
Konstruktor-Signatur (`Display.ts:353-363`) und im Rumpf bei `:808`. Das Dokument, das die
Ressourcen-Regel des Projekts trägt, kennt diese Ausnahme an drei Stellen nicht — und eine
vierte, auf der Testseite, erklärt die Frage für gegenstandslos:

- `:19-22` — der Merksatz von §2: was über einen Konstruktor hereingereicht wird, gehört dem
  Aufrufer und wird nicht disposed.
- `:264-265` — Punkt 1 der Checkliste in §7: »touch nothing else that was handed in«. Wer die
  Checkliste als Arbeitsanweisung nimmt, bekommt die Ausnahme nie zu sehen.
- `:317-326` — Assertion (b) in §8 prüft die Regel absolut; ein Display-Test nach diesem
  Muster müsste rot sein.
- `packages/twopoint5d-testing/test/display-dispose.test.js:57-59` — der Kommentarblock erklärt
  Assertion (b) für `Display` für gegenstandslos: »who owns it is not what these tests answer«.
  Der Code beantwortet die Frage sehr wohl, und mit §8 tut es auch das Dokument.

Ein erster Versuch in Paket 1 hat einen Absatz in §2 nachgetragen und dabei zwei Aussagen
gemacht, die der Code nicht hergibt — beide sind der Grund, warum dieses Paket eigens
geschnitten ist und nicht nebenbei mitläuft:

- »This is the only take-over in the package« stimmt nicht. `Canvas2DStage#texture` ist ein
  zweiter, ausdrücklich dokumentierter Fall: »The stage owns whatever sits in this field«
  (`src/stage/Canvas2DStage.ts:55-57`) und »a texture assigned there from outside is released
  here as well« (`:194-196`), im Rumpf bei `:221`. Entschieden in Zug 0: beide Fälle nennen,
  und die Stelle als Anforderung formulieren statt als Liste — eine Zählung wird beim dritten
  Fall wieder falsch, eine Anforderung nicht.
- »`Display.dispose()` releases both« überschreibt, was `dispose()` tut. Freigegeben wird der
  Renderer; der Canvas bleibt im DOM, behält seine Attribute und die installierten CSS-Regeln.
  Der Display gibt beide auf — den Renderer über `renderer.dispose()`, den Canvas dadurch,
  dass `Display#canvas` danach wirft.

Beide Belege sind in Zug 0 am Code nachgesehen und stehen oben im Vorgehen mit ihren
Fundstellen; die Konvention »kein Rückblick auf den Vorzustand« gilt für jede Zeile, die hier
entsteht — der Text schreibt eine Ausnahme auf, ohne zu erzählen, dass sie neu ist.

### [x] 8. Was die Knoten-Pools und das Serial-Tor an Zusagen offen lassen

- Findings: — (Folge, kein Audit-Finding)
- Folge von: Paket 6
- Ziel: Die vier Zusagen, die das Serial-Tor und die Knoten-Pools der Sichtbarkeits-Helfer
  angerissen haben, stimmen wieder — im Tor, im `remove()`-Weg, im TSDoc und im Test.
- Bereich: `packages/twopoint5d/src/map2d/` (`CameraBasedVisibilityHelpers.ts`,
  `CameraBasedVisibilityHelpers.spec.ts`, `CameraBasedVisibility.ts`) sowie
  `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`
- Hängt ab von: —
- Hash: 085ac4d
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.ts` (nur TSDoc)
  - `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`
- Vorgehen:

  Alle Zeilennummern stehen gegen den Stand `515575a`. Erst schreiben die Schritte 1–3 die
  Tests, Schritt 4 sieht sie am ungeänderten Quelltext rot, danach kommen die Fixes.

  **Schritt 1 — die Attrappe im Spec trägt Kacheln.** `CameraBasedVisibilityHelpers.spec.ts`
  fährt heute `visibles: []` (`:17`), und der Kommentar darüber (`:9-11`) erklärt das für
  gewollt. Damit läuft weder `placeBoxHelper` noch `hideSurplus` je durch einen Unit-Test.
  Die vorhandenen vier Tests bleiben unverändert und bekommen weiter einen leeren Kachelsatz;
  die Attrappe nimmt ihn jetzt als Parameter entgegen:

  ```ts
  function makeTileBox(x: number, y: number, primary: boolean): TileBox {
    return {
      id: packTileCoords(x, y),
      x,
      y,
      primary,
      box: new Box3(new Vector3(x, 0, y), new Vector3(x + 1, 1, y + 1)),
      frustumBox: new Box3(new Vector3(x - 1, -1, y - 1), new Vector3(x + 2, 2, y + 2)),
    };
  }

  function makeVisibility(visibles: TileBox[] = []): CameraBasedVisibility {
    return {
      planeWorld: new Plane(new Vector3(0, 1, 0), 0),
      pointOnPlane: new Vector3(1, 0, 1),
      planeOrigin: new Vector3(),
      visibles,
      map2dTileCoords: new Map2DTileCoordsUtil(),
      matrixWorld: new Matrix4(),
      planeCoords2D: new Vector2(),
      serial: 0,
    } as unknown as CameraBasedVisibility;
  }
  ```

  Dazu zwei Lesehelfer, die die Box-Helfer in ihrer Baureihenfolge liefern:

  ```ts
  /** The box helpers of the current set, in the order they were built. */
  function boxHelpers(scene: Object3D): Box3Helper[] {
    return scene.children.filter((node): node is Box3Helper => node.type === 'Box3Helper');
  }

  function boxHelperColors(scene: Object3D): string[] {
    return boxHelpers(scene).map((helper) => (helper.material as LineBasicMaterial).color.getHexString());
  }
  ```

  Neue Importe: `Box3` in den Wert-Import aus `three/webgpu`, `Box3Helper` und
  `LineBasicMaterial` in den Typ-Import daneben, `TileBox` in den vorhandenen
  `import type … from './CameraBasedVisibility.js'`, dazu
  `import {packTileCoords} from './tileKeys.js';`.

  Der Kommentar bei `:9-11` wird ersetzt: die Attrappe trägt die Mitglieder, die die Helfer
  lesen, und der Kachelsatz kommt vom Aufrufer, weil die Kachel-Helfer daraus entstehen. Kein
  Satz darüber, wie es vorher war.

  Baureihenfolge, auf der alle Erwartungen unten stehen — `createHelpers()` legt an: einen
  `PlaneHelper`, vier Punkt-Helfer (`pointOnPlane`, `planeOrigin`, ux, uy), dann je Kachelsatz
  zuerst die Frustum-Boxen der Primärkacheln, danach in einem Durchlauf über `visibles` je
  Nicht-Primärkachel eine Frustum-Box und je Kachel eine Kachelbox. Für
  `visibles = [makeTileBox(0, 0, true), makeTileBox(1, 0, false)]` sind das neun Knoten, davon
  vier `Box3Helper` in der Reihenfolge Frustum A, Kachelbox A, Frustum B, Kachelbox B. Im Spec
  ist `scene` elternlos, `findRootNode` liefert sie selbst zurück, und damit landen die Knoten
  aus beiden Wegen (`addToRoot` true wie false) in derselben `scene.children`.

  **Schritt 2 — die fünf neuen Vitest-Tests**, ans Ende des `describe`-Blocks.

  Zwei davon sind vor dem Fix rot und halten das Serial-Tor:

  ```ts
  test('a color written on the helpers reaches the next update', () => {
    const scene = new Object3D();
    const visibles = [makeTileBox(0, 0, true), makeTileBox(1, 0, false)];
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility(visibles));

    helpers.add(scene);
    helpers.show = true;

    expect(boxHelperColors(scene), 'frustum and tile box of each tile').toEqual(['ffffff', 'ff0066', '777777', '772222']);

    helpers.tileBoxHelperColor.set(0x00ff00);
    helpers.update();

    expect(boxHelperColors(scene), 'the tile box of the plain tile followed').toEqual([
      'ffffff',
      'ff0066',
      '777777',
      '00ff00',
    ]);
  });

  test('maxDebugHelpers reaches the next update', () => {
    const scene = new Object3D();
    const visibles = [makeTileBox(0, 0, true), makeTileBox(1, 0, false)];
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility(visibles));

    helpers.add(scene);
    helpers.show = true;

    expect(boxHelpers(scene).map((helper) => helper.visible)).toEqual([true, true, true, true]);

    helpers.maxDebugHelpers = 0;
    helpers.update();

    expect(
      boxHelpers(scene).map((helper) => helper.visible),
      'the frustum box of the plain tile is out of sight',
    ).toEqual([true, true, false, true]);
  });
  ```

  Der erste greift die Farbe **an Ort und Stelle** ab (`Color#set`) und nicht durch eine
  Zuweisung: das ist der Weg, auf dem ein Aufrufer eine Farbe setzt, und ein Tor, das nur
  Zuweisungen sieht, ginge daran vorbei. Sollte der sRGB-Hin-und-Rückweg von `getHexString()`
  nicht exakt landen, wird stattdessen mit `color.equals(new Color(0x…))` verglichen — die
  Aussage des Tests ist, welchem der vier Felder ein Helfer folgt, nicht die Zahlenform.

  Einer ist vor dem Fix rot und hält den `remove()`-Weg:

  ```ts
  test('a scene this set was never handed keeps its nodes where they are', () => {
    const scene = new Object3D();
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

    helpers.add(scene);
    helpers.show = true;

    const nodes = [...scene.children];
    const released = spyOnReleases(scene);

    helpers.remove(new Object3D());

    expect(scene.children, 'the set stays where it was put').toEqual(nodes);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }

    helpers.update();

    expect(scene.children, 'and the next update writes into the same nodes').toEqual(nodes);
  });
  ```

  Zwei sind vor **und** nach dem Fix grün. Sie halten Code, der bereits richtig gebaut und von
  keinem Test gehalten ist; dass sie messen, wird wie in Paket 7 mit einer testweise gedrehten
  Erwartung gezeigt und im Report belegt:

  ```ts
  test('a shrinking tile set keeps its helper nodes and takes the surplus out of sight', () => {
    const scene = new Object3D();
    const visibles = [makeTileBox(0, 0, true), makeTileBox(1, 0, false)];
    const visibility = makeVisibility(visibles);
    const helpers = new CameraBasedVisibilityHelpers(visibility);

    helpers.add(scene);
    helpers.show = true;

    expect(scene.children, 'plane, four points, two frustum boxes, two tile boxes').toHaveLength(9);

    const nodes = [...scene.children];
    const released = spyOnReleases(scene);

    visibles.length = 1;
    (visibility as unknown as {serial: number}).serial += 1;
    helpers.update();

    expect(scene.children, 'the same nodes, in the same order').toEqual(nodes);
    expect(
      boxHelpers(scene).map((helper) => helper.visible),
      'the two helpers of the tile that fell away are hidden',
    ).toEqual([true, true, false, false]);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(0);
      expect(node.material!).toHaveBeenCalledTimes(0);
    }
  });

  test('the scene it was handed takes the whole set down again', () => {
    const scene = new Object3D();
    const helpers = new CameraBasedVisibilityHelpers(makeVisibility());

    helpers.add(scene);
    helpers.show = true;

    const released = spyOnReleases(scene);

    helpers.remove(scene);

    expect(scene.children).toHaveLength(0);
    for (const node of released) {
      expect(node.geometry!).toHaveBeenCalledTimes(1);
      expect(node.material!).toHaveBeenCalledTimes(1);
    }
  });
  ```

  **Schritt 3 — ein `it` mehr im Browsertest**, in
  `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`, hinter
  `a moved map writes into the helper nodes it already has`. Die Datei zahlt den WebGPU-Start
  ohnehin; Fixtures, `frame()` und `helperNodes()` stehen dort schon.

  ```js
  it('a scene the helpers were never handed leaves their nodes alone', async function () {
    const {map2d, visibility} = makeMap(camera);
    scene.add(map2d);

    const helpers = new CameraBasedVisibilityHelpers(visibility);
    helpers.add(map2d);
    helpers.show = true;

    await frame(map2d, helpers);
    await frame(map2d, helpers);

    const before = helperNodes(scene, map2d);
    expect(before.length, 'helper nodes after the warm-up frames').to.be.greaterThan(0);

    // the set was handed `map2d`, and the scene above it is a different one
    helpers.remove(scene);

    expect(helperNodes(scene, map2d), 'nothing was taken out').to.deep.equal(before);

    map2d.centerX = 1024;
    await frame(map2d, helpers);

    const after = helperNodes(scene, map2d);
    expect(after.length, 'and no second set was built on top').to.equal(before.length);
    for (let i = 0; i < before.length; ++i) {
      expect(after[i], `helper node ${i} survived`).to.equal(before[i]);
    }
  });
  ```

  Warum dieser Test zusätzlich zum Unit-Test: erst hier hängt `map2d` unter einer echten
  `Scene`, `HelpersManager#root` und `#scene` sind zwei verschiedene Objekte, und genau aus
  dieser Zweiteilung entsteht der halb abgeräumte Zustand. Im Spec fallen beide zusammen. Dazu
  verlangt die Konvention für Code, der Knoten in den Szenengraphen legt, ohnehin einen
  Browsertest.

  **Schritt 4 — der Vorzustandslauf.** Beide Suiten gegen den ungeänderten Quelltext fahren und
  die roten Zeilen in den Report nehmen. Erwartet:

  - `a color written on the helpers reaches the next update` — die vierte Farbe steht auf
    `772222` statt `00ff00`.
  - `maxDebugHelpers reaches the next update` — `[true, true, true, true]` statt
    `[true, true, false, true]`.
  - `a scene this set was never handed keeps its nodes where they are` — `scene.children` ist
    leer statt der fünf Knoten. (`removeFromScene()` räumt außer der übergebenen Szene immer
    auch `root`, und im Spec ist `root` die Szene selbst.)
  - Browsertest `a scene the helpers were never handed leaves their nodes alone` — nach dem
    `remove(scene)` fehlen die an `root` hängenden Helfer, das `deep.equal(before)` bricht.

  Die beiden Übrigen sind grün; für jeden von beiden wird die gedrehte Erwartung samt ihrer
  Fehlermeldung im Report gezeigt. Weicht der wirkliche Vorzustandslauf von dieser Vorhersage
  ab, gilt der Lauf und nicht die Vorhersage — die Abweichung kommt mit Begründung in den
  Report.

  **Schritt 5 — das Tor in `update()` sieht auch die eigenen Felder.** Heute steht dort allein
  `if (this.#builtSerial === this.cameraBasedVisibility.serial) return;` (`:239`), und damit
  liegen die sieben öffentlichen Stellschrauben der Klasse still, bis die Visibility neu
  rechnet. Sie kommen in einen `Dependencies`-Satz — dieselbe Klasse, mit der
  `CameraBasedVisibility` seinen eigenen Dirty-Check fährt (`CameraBasedVisibility.ts:94-102`).
  Neben `#builtSerial` (`:61-62`):

  ```ts
  // The public fields of this class shape the set that gets built, so a set built from other
  // values is out of date just as a set built from an older visibility is. `cloneable` keeps a
  // copy of each color, which catches a color written in place as well as one assigned.
  readonly #knobs = new Dependencies([
    'maxDebugHelpers',
    'tileBoxHelperExpand',
    'frustumBoxHelperExpand',
    Dependencies.cloneable<Color>('frustumBoxHelperColor'),
    Dependencies.cloneable<Color>('frustumBoxPrimaryHelperColor'),
    Dependencies.cloneable<Color>('tileBoxHelperColor'),
    Dependencies.cloneable<Color>('tileBoxPrimaryHelperColor'),
  ]);
  ```

  Dazu `import {Dependencies} from '../utils/Dependencies.js';`. `Color` ist bereits als Wert
  importiert. Nimmt TypeScript `Dependencies.cloneable<Color>` nicht an — die Schranke verlangt
  `equals`, `clone` und `copy`, und `Color` bringt alle drei —, wird der Dreiklang für die vier
  Farbfelder ausgeschrieben (`[name, {equals: (a, b) => a.equals(b), clone: (s) => s.clone(),
  copy: (s, t) => t.copy(s)}]`); erfunden wird nichts anderes.

  `update()` wird zu:

  ```ts
  update(): void {
    if (!this.#show) return;
    // the manager refuses a node it cannot place, so nothing is built until there is a scene
    if (this.#helpers.scene == null) return;

    // asked on every pass and before the gate, never behind a `&&`: the state it keeps has to
    // follow every value written to those fields, not only the ones that fall on a pass that
    // rebuilds anyway
    const knobsChanged = this.#knobs.changed({
      maxDebugHelpers: this.maxDebugHelpers,
      tileBoxHelperExpand: this.tileBoxHelperExpand,
      frustumBoxHelperExpand: this.frustumBoxHelperExpand,
      frustumBoxHelperColor: this.frustumBoxHelperColor,
      frustumBoxPrimaryHelperColor: this.frustumBoxPrimaryHelperColor,
      tileBoxHelperColor: this.tileBoxHelperColor,
      tileBoxPrimaryHelperColor: this.tileBoxPrimaryHelperColor,
    });

    if (!knobsChanged && this.#builtSerial === this.cameraBasedVisibility.serial) return;

    this.#builtSerial = this.cameraBasedVisibility.serial;
    this.createHelpers();
  }
  ```

  Zwei Fallen, beide teuer: `changed()` schreibt seinen Zustand nur fort, wenn es eine Änderung
  meldet, und es muss deshalb auf **jedem** Durchlauf gefragt werden — hinter einem `&&` würde
  es übersprungen, und die nächste Neuberechnung ohne Feldänderung meldete dann eine. Und die
  Liste muss alle sieben Felder nennen: `Dependencies.update()` legt jeden übergebenen
  Schlüssel ab, aber `equals()` vergleicht nur die deklarierten, ein vergessenes Feld bliebe
  also stumm. Genau diese Lücke steht für `frustumBoxScale` in »Offene Befunde«.

  `releasePools()` bleibt unangetastet: es setzt `#builtSerial = -1`, und das erzwingt den
  Neubau schon über den Serial-Teil des Tors.

  Dazu ein TSDoc über `update()`, englisch, ohne Rückblick: die Methode baut den Satz, den die
  Visibility gerade beschreibt, sofern nicht genau dieser Satz schon steht — ein Durchlauf
  findet nichts zu tun, solange die Visibility denselben Kachelsatz zurückgibt und keins der
  öffentlichen Felder dieser Klasse sich seit dem letzten Bau bewegt hat. Ein Wert, der in
  eines dieser Felder geschrieben wird, steht mit dem nächsten Durchlauf im Bild.

  **Schritt 6 — `remove()` räumt ganz oder gar nicht** (`:230-233`). Heute ruft die Methode
  `removeFromScene(scene)` und danach bedingungslos `releasePools()`. Mit einer fremden Szene
  räumt der Manager trotzdem `root` mit ab, die Pools verlieren ihre Referenzen, und das
  nächste `update()` legt einen zweiten Satz über den ersten. Neu:

  ```ts
  remove(scene: Object3D): void {
    if (this.#helpers.scene !== scene) return;
    this.#helpers.remove();
    this.releasePools();
  }
  ```

  Dazu ein TSDoc: die Methode nimmt den ganzen Satz herunter und gibt die gehaltenen Knoten
  auf. Ein Satz lebt in genau einer Szene — der, die `add()` bekommen hat —, eine andere hat
  nichts von ihm herauszunehmen, und den Satz halb herunterzunehmen ließe die Pools auf
  freigegebene Knoten zeigen.

  Das ist eine Stufe schärfer als der Vorschlag im Grobplan-Absatz unten, der nur
  `releasePools()` an die Szene bindet: dessen Fassung ließe die an `root` hängenden Knoten
  freigegeben, während die Pools sie weiter halten — derselbe Schaden, nur leiser. Der Wächter
  umschließt deshalb die ganze Methode. `#helpers.remove()` statt `removeFromScene(scene)`
  sagt innerhalb des Wächters dasselbe und liest sich als das, was es ist: der ganze Satz
  geht herunter. Es ist dieselbe Paarung, die der `show`-Setter bei `:76-77` schon fährt.

  **Schritt 7 — die Zusage von `serial` stimmt wieder**, in `CameraBasedVisibility.ts`. Das
  TSDoc bei `:108-113` sagt zu, `visibles` sei nach jedem Zählerschritt neu. Der Zähler steigt
  bei `:203`, und der Weg bei `:223-226` — die Kamera trifft die Ebene nicht — kehrt zurück,
  ohne `findVisibleTiles()` zu rufen. Zwei kurze TSDoc-Blöcke, englisch, ohne Rückblick:

  - über `readonly visibles` (`:104`): die Kacheln der letzten Neuberechnung, die die Ebene
    getroffen hat, sortiert nach ihrem Abstand zur Kamera. Eine Neuberechnung, in der die
    Kamera an der Ebene vorbeisieht, meldet einen leeren Kachelsatz und lässt diese Liste
    stehen, wie sie ist.
  - an `serial` (`:108-113`): der Zähler zählt, wie oft diese Visibility ihren Zustand aus der
    Kamera neu gerechnet hat. Er bewegt sich mit jeder Neuberechnung und steht still, solange
    der zwischengespeicherte Kachelsatz zurückgegeben wird; wer abgeleiteten Zustand
    mitführt, vergleicht den zuletzt gesehenen Wert statt des Zustands selbst. Ein Schritt sagt,
    dass die Kamera erneut ausgewertet wurde, nicht dass jedes Feld einen neuen Wert trägt:
    `planeWorld`, `planeOrigin` und `pointOnPlane` folgen jedem Schritt, `visibles` und
    `planeCoords2D` nur einem Schritt, in dem die Kamera die Ebene getroffen hat.

  Der Satz beschreibt, was der Code tut. Er wird nicht durch einen Test festgenagelt — der
  Zweig selbst steht als vorbestehender Befund in »Offene Befunde« und geht ins Audit; ein
  Test darauf machte ihn teurer zu schließen.

- Nicht anfassen:
  - `CameraBasedVisibility.ts:223-226` — dass der Zweig `visibles` nicht leert, ist ein
    vorbestehender Befund mit dem Urteil `→ Audit` (nachgewiesen an `git show c16ce54`, Zweig
    unverändert). Dieses Paket schreibt auf, was dort geschieht; es ändert es nicht, und kein
    Test hält das Verhalten fest.
  - `CameraBasedVisibility.#deps` und `frustumBoxScale` (`:60`, `:94-102`) — dieselbe Bauart wie
    das Tor aus Schritt 5, aber ein anderer Dirty-Check in einer anderen Klasse und ein eigener,
    vorbestehender Befund in »Offene Befunde« mit dem Urteil `→ Audit`. Das Feld kommt in diesem
    Paket in keine Abhängigkeitsliste.
  - Was `maxDebugHelpers` kappt (`:132-149`): der Laufindex `i` statt der Zahl der gebauten
    Helfer, und die Kachelboxen gar nicht. Vorbestehend (identisch in `git show c16ce54`),
    eigener Befund in »Offene Befunde«, Urteil `→ Audit`. Schritt 5 sorgt dafür, dass das Feld
    überhaupt greift; **was** es greift, bleibt. Deshalb bekommen die sieben Felder in diesem
    Paket auch kein eigenes TSDoc: ein Satz über `maxDebugHelpers` wäre entweder falsch oder
    eine Vorwegnahme dieses Befunds. Was zu sagen ist — *wann* eine Änderung im Bild steht —,
    steht einmal am TSDoc von `update()`.
  - `document.querySelector('.map2dCoords')` in `createHelpers()` (`:91-96`) samt seinem
    `// TODO remove this!` — eigener Befund in »Offene Befunde«, Urteil `→ Audit`.
  - `RectangularVisibilityAreaHelpers.remove()` (`:39-41`) — sieht aus wie derselbe Fall, ist
    keiner: die Klasse hält keine Pools, und ihr `update()` beginnt mit einem vollständigen
    `#helpers.remove()`, das eine halb geräumte Szene beim nächsten Durchlauf wieder gerade
    zieht. Kein Angleichen.
  - `HelpersManager.removeFromScene()` — dass es außer der übergebenen Szene immer auch `root`
    räumt, ist die Asymmetrie, aus der der Schaden entsteht. Beide Helfer-Klassen hängen an
    diesem Manager; der Fix bleibt bei dem Aufrufer, der Pools hält.
  - `map2d-visibility-helpers.test.js:174` — `at.least(before.length)` bleibt stehen. Eine
    bewegte Karte darf mehr Kacheln bringen, `equal` machte den Test brüchig. Der schrumpfende
    Kachelsatz wird im Unit-Test gehalten, wo er von Hand gesetzt wird.
  - `CameraBasedVisibility.spec.ts` — dieses Paket ändert an `CameraBasedVisibility` nur TSDoc.
  - `CHANGELOG.md` — wird beim Abschluss des Laufs geschrieben, wie bei jedem Paket davor.
  - `map2d/public-api.ts` — kein neues öffentliches Symbol.
- Verify: `pnpm lint && pnpm nx run-many -t typecheck --skip-nx-cache && pnpm nx run-many -t test
  --projects=tag:ci --skip-nx-cache && pnpm nx run-many -t test --projects=tag:browser
  --skip-nx-cache`
  — die drei Nx-Ziele von vornherein ohne Cache, wie in Paket 6; `pnpm lint` ist reines
  `eslint . && prettier --check .` und kennt keinen. Im Log nachsehen, dass für jede cachefähige
  Task »Cache: Skipped« steht.
- Commit: `fix(map2d): let the visibility helper knobs take effect and keep the pools with their scene`
- Ergebnis: 2 Runden · alle vier Zusagen des Pakets eingelöst und von zwei Reviewern mit
  eigener Gegenprobe bestätigt: das Tor in `CameraBasedVisibilityHelpers.update()` fragt seinen
  `Dependencies`-Satz über alle sieben öffentlichen Felder auf jedem Durchlauf und vor dem
  Serial-Vergleich · `remove(scene)` räumt ganz oder gar nicht · das TSDoc von
  `CameraBasedVisibility.visibles` und `.serial` beschreibt den Code einschließlich des Weges,
  auf dem die Kamera die Ebene verfehlt · `IMap2DVisibilitorHelpers` trägt den Vertrag zu
  `remove(scene)`, wahr für beide Implementierer · Verify
  `pnpm lint && typecheck && test:ci && test:browser` (alle Nx-Ziele `--skip-nx-cache`) exit 0,
  Log `paket-8.verify.log` · vier Tests vor dem Fix rot gesehen:
  `a color written on the helpers reaches the next update` (vierte Farbe `772222` statt
  `00ff00`), `maxDebugHelpers reaches the next update` (`[true,true,true,true]` statt
  `[true,true,false,true]`), `a scene this set was never handed keeps its nodes where they are`
  (`scene.children` leer statt fünf Knoten), Browsertest `a scene the helpers were never handed
  leaves their nodes alone` (437 statt 451 Knoten) · zwei weitere Tests halten bereits richtig
  gebauten, ungehaltenen Code und sind mit gedrehter Erwartung als messend belegt:
  `a shrinking tile set keeps its helper nodes and takes the surplus out of sight`,
  `the scene it was handed takes the whole set down again` · Abweichung vom Detailplan: der
  Browsertest vergleicht knotenweise auf Identität statt mit `deep.equal`, weil ein
  Tiefenvergleich über Szenengraph-Knoten die Suite in den 120-Sekunden-Timeout des Testrunners
  trieb; die Aussage ist dieselbe · klein, nicht behoben, beide im TSDoc von
  `packages/twopoint5d/src/map2d/types.ts`: `:158` (und der Interface-Kopf `:154-155`) sagt
  »Names the scene the helper nodes go into«, obwohl Ebene, Punkte und Frustum-Boxen in der
  Wurzel über dieser Szene landen und nur die Kachelboxen in ihr — wer die Knoten über
  `scene.children` einsammelt, findet den halben Satz nicht; `:161` erwähnt nicht, dass die
  herausgenommenen Knoten dabei über `dispose()` freigegeben werden, ein Aufrufer könnte mit
  Wiederverwendung rechnen. Beide Sätze sind in diesem Paket entstanden und stehen an
  veröffentlichter Fläche; die dritte Review-Runde hat die Zahl der offenen Befunde nicht mehr
  gesenkt, deshalb endete die Kette hier.
- Nebenbefunde: → Queue
- Folgen: keine — kein Aufrufer im Repo übergibt `remove()` eine fremde Szene, die vier
  bestehenden Vitest-Tests laufen unverändert, und `map2d/public-api.ts` bekommt kein Symbol.
- Schnittstellen:
  - `CameraBasedVisibilityHelpers.update()` — baut auch dann neu, wenn sich eins der sieben
    öffentlichen Felder der Klasse bewegt hat (`maxDebugHelpers`, `tileBoxHelperExpand`,
    `frustumBoxHelperExpand` und die vier Farben). Eine Farbe zählt auch dann als geändert, wenn
    sie über `Color#set` an Ort und Stelle beschrieben wurde. Ein geschriebener Wert steht damit
    mit dem nächsten Durchlauf im Bild, statt auf die nächste Neuberechnung der Visibility zu
    warten
  - `CameraBasedVisibilityHelpers.remove(scene)` — nimmt den Satz nur herunter, wenn `scene` die
    Szene ist, die `add()` bekommen hat. Jede andere Szene lässt Knoten und Pools unangetastet;
    der Aufruf ist dann wirkungslos statt halb wirksam
  - `IMap2DVisibilitorHelpers` (`map2d/types.ts`) — trägt TSDoc am Interface und an allen vier
    Mitgliedern. Signaturen und Exportliste unverändert; der Vertrag zu `remove(scene)` sichert
    das vollständige Herunternehmen nur für die Szene aus `add()` zu und lässt jede andere
    ausdrücklich der Implementierung
  - `CameraBasedVisibility.serial` — die Zusage ist geschärft: ein Schritt heißt, dass die Kamera
    erneut ausgewertet wurde, nicht dass jedes Feld einen neuen Wert trägt. `planeWorld`,
    `planeOrigin` und `pointOnPlane` folgen jedem Schritt, `visibles` und `planeCoords2D` nur
    einem Schritt, in dem die Kamera die Ebene getroffen hat

Vier Stellen, alle aus derselben Ursache: Paket 6 hat die Helfer auf gehaltene Knoten und ein
Serial-Tor umgestellt und die Zusagen ringsherum nicht nachgezogen. Der Reviewer von Paket 6 hat
alle vier als `klein` eingestuft, keine davon hat eine Runde ausgelöst — deshalb stehen sie hier
und nicht dort.

- `CameraBasedVisibilityHelpers.ts:239` — das Serial-Tor legt die öffentlichen Stellschrauben
  still. `maxDebugHelpers` (`:36`), `tileBoxHelperExpand` und `frustumBoxHelperExpand` (`:38-39`)
  und die vier Farben (`:41-45`) wirken erst bei der nächsten Neuberechnung der Visibility. Wer
  eine Farbe setzt und auf ein stehendes Bild sieht, hält die Klasse für kaputt. Entweder das
  TSDoc der Felder sagt es, oder ein Setter zieht den Neubau nach; die zweite Fassung ist die
  ehrlichere und kostet nur bei einer tatsächlichen Änderung.
- `CameraBasedVisibility.ts:109-112` — das TSDoc von `serial` sagt zu, `visibles` sei nach jedem
  Zählerschritt neu. Auf dem Weg bei `:223-226` steigt der Zähler, ohne dass `visibles` angefasst
  wird. Der Vorbefund dazu (dass der Zweig `visibles` gar nicht leert) steht als vorbestehend in
  »Offene Befunde« und geht ins Audit; hier geht es nur um die Zusage, die Paket 6 aufgeschrieben
  hat und die der Code an dieser Stelle nicht hält.
- `CameraBasedVisibilityHelpers.ts:230-233` — `remove(scene)` ruft `releasePools()`
  bedingungslos. `HelpersManager.removeFromScene(fremdeSzene)` räumt aber nur `root` und die
  übergebene Szene; die Knoten, die an `#helpers.scene` hängen, bleiben stehen — jetzt ohne jede
  Referenz und ohne `dispose()`, und das nächste `update()` legt einen zweiten Satz darüber. Kein
  Aufrufer im Repo übergibt heute eine fremde Szene. Der einfachste Weg: die Pools nur freigeben,
  wenn die übergebene Szene die des Managers ist.
- `CameraBasedVisibilityHelpers.spec.ts:17` und
  `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js:172` — die Vitest-Attrappe
  fährt `visibles: []`, damit laufen weder `placeBoxHelper` noch `hideSurplus` je durch einen
  Unit-Test; der Browsertest prüft nur `at.least(before.length)`. Ein schrumpfender Kachelsatz —
  der Fall, für den `hideSurplus()` überhaupt existiert — ist nachweislich richtig gebaut und von
  keinem Test gehalten. Eine Attrappe mit zwei, dann einer sichtbaren Kachel schließt das.
