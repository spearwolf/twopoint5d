# Paket 13 — texture und stage: Ein Leak im Atlas-Pfad, ein halber Resize und was die TSDoc verschweigt

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — 8 Einträge aus »Offene Befunde« (3 low, 5 info),
  im Volltext unten
- Ziel: Ein fehlgeschlagener Atlas-Load lässt keine Textur zurück, ein
  abgebrochenes `resize()` keine Stage, die eine nie angekündigte Sicht meldet.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/texture/TextureResource.ts` — eine TSDoc-Zeile zieht mit
  - `packages/twopoint5d/src/stage/Stage2D.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts` — TSDoc
  - `packages/twopoint5d/src/stage/ParallaxProjection.ts` — TSDoc
  - `packages/twopoint5d/CHANGELOG.md`
  - zum Gegenlesen, unangetastet:
    `packages/twopoint5d/src/texture/TextureImageLoader.ts` (die Vorlage für Schritt 1),
    `packages/twopoint5d/src/stage/OrthographicProjection.ts`,
    `packages/twopoint5d/src/stage/IProjection.ts`,
    `packages/twopoint5d/docs/resource-lifecycle.md` §1
- Verify: `pnpm run ci`
- Commit: `fix(texture,stage): release the texture of an atlas that cannot be read, leave a stage the size it had when its camera is refused, and refuse an animation without frames or duration`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · alle acht Queue-Einträge stehen an ihrer
    Fundstelle, vier Zeilennummern gewandert (`Canvas2DStage.ts` 211 → 214,
    `TextureAtlasLoader.ts` 74-80 → 75-80, `Stage2D.ts` 207 → 209-213,
    `FrameBasedAnimations.ts` 192 → 191) · kein Eintrag gegenstandslos · ein
    Nebenbefund in Zug 0 gefunden und in »Offene Befunde« eingetragen
    (`getZoom()` beantwortet in den beiden Projektionen zwei verschiedene Fragen,
    → Rückfrage) · die fünf übrigen Queue-Einträge bleiben liegen, andere Ursache
    · keine offene `Folgen:`-Zeile im Plan, Restplan unverändert
  - 2026-09-20 Zug 1: Implementierer beauftragt · `claude -p` als eigener Prozess,
    Modell stärkste Stufe (opus), Effort `high`, Session
    `remediate-twopoint5d-p13-impl-1` · Brief in
    `<arbeitsdir>/paket-13.impl-1.brief.txt`, Report nach `paket-13.impl-1.json`
  - 2026-09-20 Zug 2: Report `FERTIG`, Session `30d5cff5-c9f9-46ac-82ec-e9a92dce5672`
    · 10 Dateien geändert, keine neue: `TextureAtlasLoader.ts` (+ Spec),
    `FrameBasedAnimations.ts` (+ Spec), `TextureResource.ts`, `Stage2D.ts` (+ Spec),
    `Canvas2DStage.ts`, `ParallaxProjection.ts`, `CHANGELOG.md` · sieben rote Läufe
    vor den drei Fixes im Report belegt (1× Atlas-Loader, 2× Stage2D, 4×
    FrameBasedAnimations) · zwei Abweichungen: Testgrößen `1024×512` statt
    `1024×768` (gleiches Seitenverhältnis wie 800×600 hätte beide Aussagen
    entwertet), `animNameInError()` als Modul-Helfer statt inline · zwei
    Nebenbefunde, keine Folgen · Arbeitsbaum schmutzig · eigener Verify-Lauf
    `pnpm run ci` exit=0, Log `<arbeitsdir>/paket-13.verify.log`
  - 2026-09-20 Zug 3: Reviewer als eigener Prozess, opus/high, Session
    `remediate-twopoint5d-p13-review-1` · alle acht Einträge erfüllt, je mit
    Fundstelle · ein wichtiger Befund (die CHANGELOG-Zeile zum Resize verspricht
    eine Erholung, die über einen `StageRenderer` nicht eintritt), drei kleine ·
    Diff `<arbeitsdir>/paket-13.diff`
  - 2026-09-20 Zug 4, Runde 1: ein Befund offen · derselbe Implementierer über
    `--resume 30d5cff5-c9f9-46ac-82ec-e9a92dce5672`, Modell und Effort unverändert ·
    zurück: eine geänderte Zeile im CHANGELOG, Code und Tests unangetastet ·
    Verify `pnpm run ci` exit=0, Log `<arbeitsdir>/paket-13.verify-2.log` · Diff
    `<arbeitsdir>/paket-13.diff-2` · Reviewer-Nachprüfung
    `remediate-twopoint5d-p13-review-2`: erfüllt, keine neuen Befunde · offene
    Befunde 1 → 0
  - 2026-09-20 Zug 5: committet als `ff393ae7`, 10 Dateien, 226 Zeilen dazu, 22
    weg · Verify aus Runde 1 trägt den Commit (seither keine Codeänderung),
    `<arbeitsdir>/paket-13.verify-2.log` exit=0 · Arbeitsbaum danach sauber bis auf
    die ungetrackten Lauf-Dateien

## Vorgehen

Die Reihenfolge ist die des Diffs, nicht der Wichtigkeit: erst die drei
Korrektheitsfixes, jeder mit seinem roten Lauf, dann die Textarbeit.

1. **Die Textur eines Atlas, der nicht gelesen werden kann, freigeben.**
   In `TextureAtlasLoader.ts`, im `catch` des `TexturePackerJson.parse()` bei
   Zeile 77-80: `texture.dispose()` läuft, bevor `onErrorCallback?.(error)` gerufen
   wird. Die Vorlage steht eine Ebene tiefer im selben Modul —
   `TextureImageLoader.ts:37-50` gibt die Textur im eigenen Fehlerpfad mit derselben
   Begründung frei und schreibt sie in einen Kommentar: die Textur wurde hier gebaut
   und nie herausgegeben, also gibt ein Fehlschlag sie frei. Im Atlas-Loader ist es
   eine Stufe darüber dieselbe Lage: der Loader hält die `Texture`, die ihm
   `TextureImageLoader` in den Callback gereicht hat, und im `catch` bekommt sie
   niemand sonst zu sehen — `onErrorCallback` trägt den Fehler, nicht die Textur.
   Ein Kommentar von einem Satz sagt, warum der Griff hier hingehört
   (§1 von `docs/resource-lifecycle.md`: was nicht herausgeht, gibt der frei, der
   es hält). `imgEl` und `texCoords` bleiben unangetastet — ein
   `HTMLImageElement`/`ImageBitmap` hat nichts freizugeben.

   Regressionstest in `TextureAtlasLoader.spec.ts`, gebaut wie der bestehende
   `a parse that throws rejects instead of leaving the promise open` — derselbe
   `queueMicrotask`-Rahmen, derselbe `parseSpy`, nur mit einer Textur, die das
   Freigeben mitzählt:
   `const texture = {dispose: vi.fn()} as unknown as Texture;`
   Name: `a parse that throws releases the texture the image loader handed out`.
   Er prüft `expect(texture.dispose).toHaveBeenCalledTimes(1)` nach dem erwarteten
   `rejects.toThrow(/boom/)`. Vor dem Fix ist er rot (0 Aufrufe) — der rote Lauf
   gehört in den Report.

2. **Ein Resize, den die Projektion abweist, lässt die Stage, wie er sie vorfand.**
   In `Stage2D.ts` heute: `resize()` (Zeile 170-181) schreibt `#containerWidth`
   und `#containerHeight` und ruft `#updateProjection()`; das schreibt
   `needsUpdate = false` (197), dann `#width`/`#height` (209-210) und ruft erst
   danach `projection.updateCamera(this.camera)` (213), das bei einer Kamera
   falschen Typs einen `TypeError` wirft. `emit(this, OnStageResize, …)` (226)
   bleibt dann aus, die geschriebenen Maße stehen, und weil der Guard in Zeile 173
   auf die Containergröße sieht, ist das zweite `resize()` mit denselben Zahlen
   ein No-op: die Stage trägt eine Sicht, die sie nie angekündigt hat, und kommt
   aus diesem Zustand nicht heraus.

   Der Fix macht den Vorgang zur Transaktion und lässt die Reihenfolge, in der
   sichtbar wird, was gelungen ist, wo sie ist:

   - In `#updateProjection()` den Vorzustand sichern (`needsUpdate` vor Zeile 197,
     `#width`/`#height` vor Zeile 209 — `prevWidth`/`prevHeight` stehen schon da)
     und den Kamera-Block (212-219) in ein `try` legen. Im `catch`:
     `needsUpdate`, `#width` und `#height` zurückschreiben, dann den Fehler
     weiterwerfen. Nicht schlucken — der Plan hat unter »Entscheidungen«
     festgehalten, dass eine Fehlkonfiguration wirft.
   - In `resize()` die beiden Containermaße ebenso sichern und bei einem Wurf aus
     `#updateProjection()` zurückschreiben, bevor der Fehler weitergeht. Nur so
     greift das nächste `resize()` mit denselben Zahlen wieder.
   - Je ein Kommentar sagt, warum: Ein `resize()`, den die Projektion abweist, hat
     keine Sicht erreicht; die Stage behält die, die sie hatte, und dieselbe Größe
     ist es wert, noch einmal versucht zu werden, sobald die Kamera passt.
   - Die Reihenfolge der Zuweisungen im Erfolgsfall bleibt exakt wie sie ist. Ein
     Vorziehen des Kamera-Blocks vor das Schreiben von `#width`/`#height` sieht
     kürzer aus, ändert aber, welche Größe ein Empfänger von
     `OnStageAfterCameraChanged` liest — das ist nicht Gegenstand dieses Pakets.
   - Was die Projektion selbst in `updateViewRect()` (199) bereits aufgenommen hat,
     bleibt stehen: sie rechnet aus Breite und Höhe und liefert beim nächsten
     Versuch mit denselben Zahlen dasselbe Ergebnis.

   Zwei Regressionstests in `Stage2D.spec.ts`, beide vor dem Fix rot:
   - `a resize the projection refuses leaves the stage the size it had` — Stage mit
     `new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640})`,
     `resize(800, 600)` läuft grün durch, dann `stage.camera = new OrthographicCamera()`
     (das Zuweisen selbst wirft nicht: der Setter ruft `updateProjection()` nur,
     wenn danach keine Kamera dasteht). Ein `OnStageResize`-Spy wird jetzt
     angehängt. `expect(() => stage.resize(1024, 768)).toThrow(TypeError)`, danach
     `[stage.width, stage.height]` und `[stage.containerWidth, stage.containerHeight]`
     unverändert und der Spy ungerufen.
   - `a resize refused once goes through when the camera fits` — direkt im Anschluss
     `stage.camera = new PerspectiveCamera()` und noch einmal `resize(1024, 768)`:
     kein Wurf, `OnStageResize` kommt, `stage.width`/`height` tragen die neue Sicht.
     Ohne den Rollback stünde die Containergröße schon auf 1024×768 und der Aufruf
     fiele durch den Guard.

3. **Eine Animation ohne Frames und eine Dauer, die keine ist, werden abgewiesen.**
   In `FrameBasedAnimations.ts#add()` steht heute zwischen der Auflösung der Zweige
   und der Registrierung nur die Namensvergabe (Zeile 216-220). Dort kommen zwei
   Guards dazu, **vor** `#nextAnonymousName()` — die Regel aus Paket 10, dass ein
   `add()`, das wirft, keinen Namen verbraucht, gilt auch für diese beiden, und der
   bestehende Test `an add that throws spends no name of the counter` hält sie:
   - `frames.length === 0` → `Error`. Die Meldung nennt Klasse und Aufruf und sagt,
     was fehlt, im Ton der Meldungen dieser Datei:
     ``FrameBasedAnimations: add() got no frames for the animation `${name?.toString() ?? '(no name)'}` — an atlas query without a match, an empty tile range or an empty frame list registers nothing``.
     Der Guard sitzt hinter der Zweig-Auflösung und gilt damit für alle vier Formen,
     nicht nur für den Atlas-Zweig, aus dem der Eintrag kommt: es ist eine Ursache,
     die an vier Stellen zuschlägt, und `frames` ist der Ort, an dem sie sichtbar
     wird.
   - `duration` muss eine endliche Zahl **at or above zero** sein, sonst `Error` mit
     dem Wert, der ankam. Null bleibt ausdrücklich erlaubt — der bestehende Test
     `add animation with zero duration` beschreibt eine Standbild-Animation und
     bleibt grün. Abgewiesen werden negative Werte, `NaN` und `Infinity`; `NaN`
     kommt heute über `resolveDuration()` auch aus `{frameRate: NaN}` durch, weil
     `calculateDurationFromFrameRate()` nur gegen `<= 0` prüft.
   - Die TSDoc von `add()` bekommt einen Satz zu beidem, die TSDoc von
     `AnimationTimingOptions` einen zur Dauer.

   Regressionstests in `FrameBasedAnimations.spec.ts`, vor dem Fix rot:
   `an atlas query that matches no frame is refused`,
   `an empty frame list is refused` und
   `a duration that is negative or no finite number is refused` (drei Fälle in einem
   Test: `-1`, `NaN` über `{frameRate: NaN}`, `Infinity`). Dazu ein Fall, der die
   Reihenfolge festhält: nach einem abgewiesenen `add()` ohne Namen heißt die
   nächste anonyme Animation weiterhin `anim_0`.

   **Was die Änderung mitzieht** (nicht als eigener Befund, sondern als Teil dieser
   Änderung): `TextureResource.ts` fängt in beiden Animationszweigen (Zeile 671-683
   und 848-858) jeden Wurf aus `add()` ab und meldet ihn als `error`-Event mit
   `{source: 'frameBasedAnimations', id, animation, error}`, der Eintrag wird
   übersprungen, die übrigen werden registriert. Das trägt die neuen Würfe ohne
   Anpassung — aber die Klassen-TSDoc bei `TextureResource.ts:82-85` zählt auf,
   welche Fälle so gemeldet werden (»no `duration` and no `frameRate`, or a
   `frameRate` of 0«). Sie bekommt den neuen Fall dazu: ein Eintrag, dessen Frames
   leer bleiben — eine `frameNameQuery` ohne Treffer, ein leerer Kachelbereich.
   Kein Test dieser Suite bricht dadurch: jede Query in `TextureResource.spec.ts`
   trifft heute mindestens einen Frame (geprüft in Zug 0), und `animated-billboards.astro:73`
   ist der einzige Aufrufer von `add()` außerhalb der Specs und übergibt acht
   Kachel-Ids.

4. **Das Shadowing im Atlas-Zweig auflösen.** `FrameBasedAnimations.ts:191`:
   `.filter((name) => typeof name === 'string')` überschattet das äußere `name` aus
   Zeile 166, das zwei Schritte später neu zugewiesen wird. Der Parameter heißt
   `frameName` — so wie der Parameter der `map()`-Zeile zwei Zeilen darunter.
   Reine Umbenennung, kein Verhalten.

5. **Die TSDoc von `Canvas2DStage#dispose()` geraderücken.** Zeile 214-215 führt
   `stageRenderer` in der Liste der Felder, die »keep the values the stage was left
   with«. Formal wahr, praktisch irreführend: `dispose()` ruft
   `this.stageRenderer.dispose()` (Zeile 235), die Instanz im Feld ist danach zu
   nichts mehr zu gebrauchen. `stage` stand in derselben Liste und ist dort
   bereits herausgenommen — dieselbe Behandlung für den Nachbarn: `stageRenderer`
   verlässt die Aufzählung, und ein Satz sagt, was für beide gilt — die `readonly`
   Felder `stage` und `stageRenderer` antworten weiter mit derselben Instanz, und
   beide melden `isDisposed === true`. Kein CHANGELOG-Eintrag: die dortige Zeile zu
   `Canvas2DStage#dispose()` zählt diese Felder nicht auf. Sollte der Implementierer
   dieselbe Halbwahrheit doch im CHANGELOG finden, zieht er sie mit.

6. **`ParallaxProjection#getZoom()` bekommt seine TSDoc**, und das `// TODO add jsdoc`
   in Zeile 153 geht. Beschrieben wird, was die Methode rechnet, nicht, was ihr Name
   verspricht: mit `fovy = 2·atan(halfHeight / D)` kürzt sich der Ausdruck zu
   `1 - distanceToProjectionPlane / D`, wobei `D` das `distanceToProjectionPlane`
   der Projektion ist. Also `1` an der Kamera, `0` auf der Projektionsebene,
   negativ dahinter, und zwischen Kamera und Ebene linear fallend — der Faktor, mit
   dem eine Parallax-Ebene in dieser Distanz gegenüber der Projektionsebene
   mitgeführt wird. Der Sonderfall `distanceToProjectionPlane === 0` in Zeile 155
   ist derselbe Wert, den die Formel dort liefert, und bleibt stehen; die TSDoc
   erwähnt ihn nicht eigens. Der bestehende Test `getZoom` in
   `ParallaxProjection.spec.ts:47-62` hält genau diese Werte fest und bleibt
   unangetastet. **Kein Eingriff in den Rückgabewert** und keiner in
   `OrthographicProjection#getZoom()` — dass die beiden Implementierungen desselben
   Interfaces verschiedene Fragen beantworten, steht als eigener Eintrag in »Offene
   Befunde« und ist nicht Gegenstand dieses Pakets.

7. **Die überlange TSDoc-Zeile in `Stage2D.ts:361` umbrechen.** Sie läuft auf 113
   Zeichen, ihre Nachbarn liegen bei rund 100; `printWidth` der `.prettierrc` ist
   130, Prettier bricht Kommentare nicht um, also bleibt sie stehen, bis jemand
   Hand anlegt. Nur der Umbruch, kein Wort ändert sich.

8. **CHANGELOG.** In `[Unreleased]`:
   - `Fixed`: die Textur hinter einem Atlas, dessen Json nicht gelesen werden kann,
     wird freigegeben statt liegen gelassen — ein Leak pro fehlerhafter Atlas-Json.
   - `Fixed`: ein `resize()`, das die Projektion mit einem `TypeError` abweist,
     lässt Größe und Containergröße der `Stage2D` stehen, wie sie waren, und
     derselbe Aufruf greift wieder, sobald die Kamera passt.
   - `Changed`: `FrameBasedAnimations#add()` weist eine Animation ohne Frames und
     eine Dauer ab, die keine endliche Zahl ab null ist; beide mit einer Meldung,
     die den Fall nennt, und beide ohne einen Namen des Zählers zu verbrauchen.
   - `Changed`: die bestehende Zeile zum `error`-Event von `TextureResource`
     (»whose timing does not let the animation be built«) bekommt den neuen Fall
     dazu — ein Eintrag, dessen Frames leer bleiben, wird ebenso übersprungen und
     gemeldet.
   - `Migration Guide`: ein Abschnitt `#### An animation needs a frame and a
     duration` ganz vorn (die Abschnitte stehen jüngste zuerst), der das vormals
     erlaubte Aufrufmuster benennt und sagt, was an seine Stelle tritt —
     `TextureAtlas#frameNames(query)` vor dem `add()` befragen, wo die Query aus
     Daten kommt; über einen `TextureResource` läuft der Fall ohnehin schon als
     `error`-Event auf.

   Die Regeln von `Keep a Changelog` und die Unantastbarkeit veröffentlichter
   Abschnitte gelten; geschrieben wird ausschließlich unter `[Unreleased]`.

## Entscheidungen dieses Zugs

- **Der Progress-Callback des Atlas-Loaders fällt weg, der optionale Parameter
  kommt nicht.** Der Eintrag stellt beides frei. Ein neuer öffentlicher Parameter
  erweitert die Signatur eines Loaders, den in diesem Repo niemand mit einem
  Fortschrittswunsch ruft, und dieselbe Signatur tragen seit Paket 7 alle drei
  Loader des Moduls gemeinsam — ein vierter Parameter an einem von ihnen bräche
  diese Linie. Also: der leere Callback und seine TODO-Notiz verschwinden,
  `undefined` steht an ihrer Stelle in `FileLoader#load(url, onLoad, onProgress,
  onError)`. Kein CHANGELOG-Eintrag, weil sich für keinen Aufrufer etwas ändert.
- **Der Frames-Guard gilt für alle vier Formen von `add()`, nicht nur für den
  Atlas-Zweig.** Der Eintrag kommt aus dem Atlas-Zweig, die Ursache — `frames` wird
  vor der Registrierung nicht angesehen — liegt hinter allen vieren. Drei Stellen
  aus derselben halb behobenen Ursache sind ein Paket, nicht drei.
- **Dauer null bleibt erlaubt.** Der Eintrag nennt negative Werte und `NaN`; ein
  Test hält die Null seit Langem fest, und eine Animation mit einer Dauer von null
  ist ein Standbild, kein Konfigurationsfehler.
- **`Stage2D` rollt zurück, statt den Wurf zu schlucken oder die Reihenfolge zu
  drehen.** Schlucken widerspricht der Zeile unter »Entscheidungen« im Plan. Das
  Vorziehen des Kamera-Blocks wäre der kürzere Diff, verschiebt aber, welche Größe
  ein Empfänger von `OnStageAfterCameraChanged` sieht — eine Verhaltensänderung
  ohne Befund dahinter.
- **Keine Browser-Testfläche.** Keiner der drei Fixes ändert, was gerendert wird
  oder wann ein GPU-Buffer entsteht: der Atlas-Fix greift nur im Fehlerpfad, der
  Stage-Fix nur, wenn die Projektion die Kamera abweist, und die Datentextur der
  Animationen behält Aufbau und Inhalt — sie bekommt nur nicht mehr die Einträge,
  mit denen ohnehin niemand etwas anfangen konnte. Die Vitest-Fläche trägt alle
  drei.
- **Commit-Message mit zwei Scopes.** `fix(texture,stage):` statt eines nackten
  `fix:` — Paket 10 stand vor derselben Lage und ließ den Scope weg, was der
  Reviewer als kleinen Befund vermerkt hat. Conventional Commits lässt den
  Scope-String frei, commitlint gibt es in diesem Repo nicht.

## Einträge im Volltext

Die acht Zeilen aus »Offene Befunde« des Plans, wörtlich, dazu der Abgleich gegen
den heutigen Stand.

**1 · info · `packages/twopoint5d/src/stage/Canvas2DStage.ts:211`** (aus Paket 2, Zug 2)
Die TSDoc von `dispose()` führt `stageRenderer` unter den Feldern, die »die Werte
behalten, mit denen die Stage zurückgelassen wurde«. Das Feld behält seinen Wert,
die Instanz darin ist aber disposed und zu nichts mehr zu gebrauchen. Dieselbe
Halbwahrheit, die Paket 2 für das Nachbarfeld `stage` korrigiert hat; sie stand
schon vorher dort.
*Abgleich:* steht, die Zeile ist auf 214-215 gewandert. `stage` fehlt in der
Aufzählung, `stageRenderer` steht darin, und Zeile 235 disposed ihn.

**2 · info · `packages/twopoint5d/src/stage/ParallaxProjection.ts:153`** (aus Paket 8, Zug 2)
`getZoom()` trägt ein `// TODO add jsdoc` statt einer TSDoc; die Methode ist
öffentlich und rechnet den Zoomfaktor für eine Distanz zur Projektionsebene. Der
TODO stand schon vor dem ersten Commit dieses Laufs.
*Abgleich:* steht unverändert auf Zeile 153, in `e7a112b3^` auf Zeile 133.

**3 · low · `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:74-80`** (aus Paket 7, Zug 2)
Wirft `TexturePackerJson.parse()` im `load`-Callback des Bildes, geht der Fehler an
`onErrorCallback` und die `Texture`, die `TextureImageLoader` eine Zeile vorher
gebaut und herausgegeben hat, wird von niemandem mehr disposed: der Atlas-Loader
gibt sie im `catch` nicht frei, und der Aufrufer hat sie nie gesehen. Ein Leak pro
fehlerhafter Atlas-Json.
*Abgleich:* steht, `try` bei 75, `catch` bei 77-80, kein `dispose()` darin.

**4 · info · `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:88-91`** (aus Paket 7, Zug 2)
Der Progress-Callback an `THREE.FileLoader` hat einen leeren Rumpf mit einer
TODO-Notiz und einer auskommentierten `console.log`-Zeile. Entweder der optionale
Parameter kommt oder die Notiz geht.
*Abgleich:* steht unverändert auf 88-91.

**5 · low · `packages/twopoint5d/src/stage/Stage2D.ts:207`** (aus Paket 10, Zug 2)
Eine auf `Stage2D#camera` gesetzte Kamera falschen Typs lässt `resize()` mit dem
`TypeError` aus `updateCamera()` abbrechen, nachdem `#containerWidth`/`-Height` und
`#width`/`#height` schon geschrieben sind und bevor `OnStageResize` heraus ist. Ein
zweites `resize()` mit derselben Größe ist ein No-op, die Stage meldet also eine
Sicht, die nie angekündigt wurde.
*Abgleich:* steht. `resize()` 170-181 (Guard 173, Maße 174-175), `#updateProjection`
191-227 mit `needsUpdate = false` bei 197, den Maßen bei 209-210, dem
`updateCamera()` bei 213 und dem `emit` bei 226.

**6 · info · `packages/twopoint5d/src/stage/Stage2D.ts:361`** (aus Paket 10, Zug 2)
Eine Zeile der `dispose()`-TSDoc (»A `dispose` event goes out to every subscriber
…«) ist etwa doppelt so lang wie ihre Nachbarzeilen, der Umbruch fehlt.
*Abgleich:* steht unverändert auf Zeile 361, 113 Zeichen gegen rund 95 bei den Nachbarn.

**7 · info · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:192`** (aus Paket 10, Zug 2)
Der Filter `(name) => typeof name === 'string'` im Atlas-Zweig von `add()`
überschattet das äußere `name`, das weiter unten neu zugewiesen wird.
*Abgleich:* steht, auf Zeile 191 gewandert; das äußere `name` kommt aus Zeile 166
und wird in 219 neu zugewiesen.

**8 · low · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, Atlas-Zweig von `add()`** (aus Paket 10, Zug 2)
Ein Atlas oder eine `frameNameQuery` ohne Treffer registriert eine Animation mit
null Frames ohne Fehler, und `duration` wird nicht gegen negative Werte oder `NaN`
geprüft. Die Datentextur bekommt in beiden Fällen Einträge, mit denen ein Shader
nichts anfangen kann.
*Abgleich:* steht. `frames` wird in 172-210 aufgelöst und in 222-228 ohne Prüfung
registriert; `resolveDuration()` (59-70) reicht eine Zahl unbesehen durch und
prüft `frameRate` nur gegen `<= 0`, lässt also `NaN` passieren.

## Was in Zug 0 daneben auffiel

`ParallaxProjection#getZoom()` und `OrthographicProjection#getZoom(_)` beantworten
unter demselben Interface-Namen zwei verschiedene Fragen: die eine gibt
`1 - d/D` (1 an der Kamera, 0 auf der Projektionsebene, negativ dahinter), die
andere konstant `1` mit dem Kommentar, bei einer orthografischen Sicht sei der
Zoomfaktor immer derselbe. Ein Aufrufer, der gegen `IProjection` programmiert,
bekommt von der einen Implementierung einen Parallax-Faktor und von der anderen
einen Skalierungsfaktor. Im Repository ruft die Methode außerhalb der beiden Specs
niemand. Beides steht so seit vor `e7a112b3`, ist also vorbestehend. Eingetragen in
»Offene Befunde« mit dem Urteil `→ Rückfrage` (low): der Fix ändert entweder den
Rückgabewert einer veröffentlichten Interface-Methode oder schneidet das Interface
neu, und das kippt mehr als dieses Paket. Dieses Paket beschreibt nur, was dasteht.

## Urteil des Reviewers je Eintrag

Aus `paket-13.review-1.json`, bestätigt durch die Nachprüfung in
`paket-13.review-2.json`. Alle acht Einträge behoben:

1. `Canvas2DStage.ts:214-217` — `stageRenderer` ist aus der Aufzählung heraus, der Satz
   über die beiden `readonly` Felder steht da, beide melden `isDisposed === true`.
2. `ParallaxProjection.ts:153-163` — TSDoc mit Herleitung und `@param`, das TODO ist weg;
   die Herleitung `1 − d/D` gegen `#fovy = 2·atan(halfHeight/D)` nachgerechnet.
3. `TextureAtlasLoader.ts:77-80` — `texture.dispose()` vor `onErrorCallback?.(error)`, mit
   Begründungskommentar. Regressionstest `a parse that throws releases the texture the
   image loader handed out` (`TextureAtlasLoader.spec.ts:161`), vor dem Fix rot mit
   »expected "vi.fn()" to be called 1 times, but got 0 times«.
4. `TextureAtlasLoader.ts:91` — `undefined` an der Stelle des Progress-Callbacks, Notiz raus.
5. `Stage2D.ts:174-190` und `224-240` — Rollback der Containermaße und von `#width`,
   `#height`, `needsUpdate`, dann Rethrow; die Reihenfolge im Erfolgsfall unangetastet.
   Regressionstests `a resize the projection refuses leaves the stage the size it had` und
   `a resize refused once goes through when the camera fits` (`Stage2D.spec.ts:190-220`),
   beide vor dem Fix rot.
6. `Stage2D.ts:383-384` — reiner Umbruch, kein Wort geändert.
7. `FrameBasedAnimations.ts:202` — Parameter heißt `frameName`.
8. `FrameBasedAnimations.ts:216-233` — beide Guards vor `#nextAnonymousName()`; `NaN` aus
   `{frameRate: NaN}` wird vom `Number.isFinite`-Guard gefangen, Null bleibt erlaubt. Vier
   Tests in `FrameBasedAnimations.spec.ts:75-104` und `231`, alle vor dem Fix rot. TSDoc an
   `add()` (142-146) und `AnimationTimingOptions` (23-24), Klassen-TSDoc von
   `TextureResource.ts:83-85` um den neuen Fall ergänzt.

## Kleine Befunde des Reviewers

Keiner hat eine Runde ausgelöst; sie stehen hier, weil sie sonst nirgends stünden.

- **Die Fehlermeldung nennt die `duration`, wo die `frameRate` schuld ist.**
  `FrameBasedAnimations.ts:230` meldet bei `{frameRate: NaN}` »got a duration of NaN«. Für
  einen Aufrufer, der eine `frameRate` gesetzt hat, zeigt die Meldung auf den falschen Knopf.
  Der Test hält es so fest, es ist also bewusst; ein Zusatz »(from a frameRate of …)« wäre
  die billigere Auskunft. Nicht behoben — der Wortlaut der Meldung steht so im Detailplan.
- **Die Commit-Message verschwieg die einzige brechende Änderung.** Der `add()`-Guard steht
  unter `### Changed` und hat einen eigenen Migration-Guide-Abschnitt, das Subject nannte ihn
  nicht. Behoben: die Zeile `Commit:` oben trägt jetzt einen dritten Teil. Typ `fix` und der
  zweiteilige Scope bleiben — derselbe Stil wie die vorangegangenen Commits des Laufs,
  commitlint gibt es in diesem Repo nicht.
- Der dritte kleine Befund (»`needsUpdate` keeps asking for the update that did not happen«)
  betraf dieselbe CHANGELOG-Zeile wie der wichtige und wurde in Runde 1 mit ihm erledigt.

## Abweichungen des Implementierers

- **Testgrößen `1024×512` statt der im Detailplan genannten `1024×768`.** Mit
  `{fit: 'contain', width: 640}` haben 800×600 und 1024×768 dasselbe Seitenverhältnis und
  geben beide die Sicht 640×480; beide Prüfungen des Plans wären damit gegenstandslos
  geworden, und `OnStageResize` wäre im zweiten Test wegen `prevWidth === w` gar nicht
  herausgegangen. `1024×512` gibt 640×320 und macht beide Aussagen prüfbar — die Absicht des
  Plans, nicht seine Zahl. Vom Reviewer als sachlich richtig bestätigt.
- **`animNameInError()` als modul-lokaler Helfer** statt des im Plan inline stehenden
  `${name?.toString() ?? '(no name)'}`; der Ausdruck steht in beiden neuen Meldungen, der
  Wortlaut der Frames-Meldung ist exakt der des Plans. Kein neues öffentliches Symbol.
- **Der Rollback greift nicht über einen `StageRenderer`, und das CHANGELOG sagt es jetzt.**
  Von den beiden Auswegen des Reviewers wurde der zweite genommen: `StageRenderer.ts` steht
  nicht im Umfang dieses Pakets, und die halb geschriebene Transaktion dort ist vorbestehend
  (geprüft in `e7a112b3^:StageRenderer.ts` — `resize()` schrieb `this.width`/`height` schon
  dort vor der Schleife). Sie steht als Nebenbefund in »Offene Befunde«.
