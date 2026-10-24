# Paket 21 — Drain: Frame-Loops, Canvas2DStage-TSDoc und Konstruktoren der Feature-Sprites

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — 4 Nebenbefunde aus »Offene Befunde« (alle low,
  `→ Scope`): `FixedFrameLoop`-Tick nach einem werfenden Listener, TSDoc von
  `Canvas2DStage#setCanvasSize()` und den Feldern der Klasse, TSDoc von
  `FrameLoop#subscriptionCount`/`stop()`/`clear()`, Konstruktoren der Feature-Sprites ohne
  Prüfung von `kind` und der Form ihrer Optionen
- Ziel: `FixedFrameLoop` übersteht werfende Tick-Listener ohne wiederholten Tick, die
  Konstruktoren der Feature-Sprites weisen eine fremde Art und ungültige Optionen mit Subjekt
  ab, und die verbliebenen öffentlichen Member von `Canvas2DStage` und `FrameLoop` haben TSDoc.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/display/FixedFrameLoop.ts` samt `FixedFrameLoop.spec.ts`
  - `packages/twopoint5d/src/display/FrameLoop.ts` (nur TSDoc)
  - `packages/twopoint5d/src/stage/Canvas2DStage.ts` samt `Canvas2DStage.spec.ts`
  - `packages/twopoint5d/src/sprites/defineSprite.ts` samt `defineSprite.spec.ts`
  - `packages/twopoint5d/src/sprites/checkFeature.ts` (nur TSDoc)
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`,
    `FeatureSpritesGeometry.ts`, `FeatureSpritesMaterial.ts`, `SpriteResources.ts`, je samt Spec
  - `packages/twopoint5d/docs/sprites.md`, `packages/twopoint5d/docs/proposals/sprite-features.md`
    (§5.2)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`, kein **BREAKING**, kein
    Migration-Guide-Eintrag)
- Dazu (Zug 0), je mit Grund — dieselbe Ursache wie ein Queue-Eintrag dieses Pakets:
  1. **`SpriteResources`-Konstruktor** als vierter Konstruktor derselben Schicht: die Optionen
     `textures`/`uniforms` von Material und `FeatureSprites` landen ungeprüft dort, und er
     nimmt `features` und `options` selbst ungeprüft (`new SpriteResources(5)` wirft roh im
     Spread, `{textures: 5}` geht still durch). Ohne ihn bliebe die Formprüfung der
     Material-Optionen halb.
  2. **`geometry`/`material` von `new FeatureSprites()`**: ein Wert, der keine
     `FeatureSpritesGeometry`/`FeatureSpritesMaterial` ist, wird heute mit »built for another
     sprite kind« abgewiesen (`FeatureSprites.ts:174`, `:185`) — falsche Aussage, dieselbe
     Ursache (Form der Optionen eines Konstruktors der Schicht).
  3. **TSDoc-Lücken in denselben sieben Dateien**, am Laufbeginn schon so (`git show
     7341059f:…`, Stichproben `SpriteResources.ts:96/103/107`, `FeatureSprites.ts:48/230`,
     `FixedFrameLoop.ts:113/187`, `Canvas2DStage.ts:12/24`): dieselbe Ursache wie die
     TSDoc-Einträge der Queue — öffentliche Member außerhalb der Liste des Audits. Die
     Konstruktoren brauchen ihre TSDoc ohnehin für die neuen `@throws`.
  4. **`Canvas2DStage#setCanvasSize()` vergleicht ungerundet** (`Canvas2DStage.ts:269`): die
     TSDoc, die dieses Paket schreibt, sagt »ein Bruchteil wird abgerundet, ein Aufruf mit der
     Größe, die die Canvas hat, ändert nichts«; der Vergleich `this.width !== width` schreibt
     aber `canvas.width = 10.5` auf eine Canvas von 10 und leert sie damit (jede Zuweisung an
     `width` setzt das Bitmap zurück), ohne Größenwechsel und ohne `OnCanvas2DStageResize`.
     `width`/`height` und `#followCanvasSize()` lesen schon die gerundete Größe; der Vergleich
     ist die einzige Stelle, die davon abweicht. Ohne den Fix müsste die neue TSDoc den
     Ausreißer beschreiben.
  5. **Folge von Paket 20** (Symptom): `docs/sprites.md:1666–1670` (»Refusals« von
     `new FeatureSprites()`) und Proposal `sprite-features.md:656–660` nennen die Abweisungen
     aus Paket 20 nicht (Optionen ohne Objekt, `passes` ohne Liste) — Paket 20 hat beide Absätze
     nicht nachgezogen, dieses Paket erweitert genau diese Absätze. Am Laufbeginn fehlte dort
     schon `grow` ohne Boolean (`git show 7341059f:…FeatureSprites.ts`, Z. 127); er kommt mit
     in denselben Satz.
- Nicht aufgenommen, mit Grund:
  - `capacity` der Geometrie: wird schon abgewiesen (`VertexObjectBuffer: capacity must be a
    non-negative integer, got …`), nur im Namen der Schicht darunter — eine andere Frage
    (Subjekt der Meldung), keine fehlende Prüfung.
  - `OnRender` bleibt `emit()`: ein Frame-Ereignis wie `OnStageUpdateFrame` und
    `OnCanvas2DStageRender`, hinter ihm schreibt die Schleife keinen Zustand mehr; ein
    werfender Render-Listener beendet die Zustellung für die Listener hinter ihm wie überall in
    der Bibliothek.
  - `Display` stellt `OnDisplayRenderFrame` weiter über `emit()` zu; der Fehler der Schleife
    läuft wie bisher hinaus, nur später (nach `OnRender`).
- Vorgehen:
  1. **`FixedFrameLoop` — der Tick zählt, jeder Listener hört ihn**
     (`FixedFrameLoop.ts:226–263`, `[OnDisplayRenderFrame]()`):
     - Import um `emitStrict` aus `@spearwolf/eventize` und `throwCollected` aus
       `../utils/throwCollected.js` ergänzen.
     - In der Tick-Schleife (Z. 235–247) `emit(this, OnTick, {…})` durch
       `emitStrict(this, OnTick, {…})` in einem `try` ersetzen; im `catch` den Fehler in eine
       erst bei Bedarf angelegte Liste schieben (`let errors: unknown[] | undefined;` vor der
       Schleife, `(errors ??= []).push(error)` — kein Array je Frame). Die Fortschreibung von
       `#accumulator`, `#tickTime`, `#tickNo`, `steps` bleibt **hinter** dem Ereignis und läuft
       nach dem `try/catch` unbedingt: ein Listener liest während des Ticks über die Getter
       weiter die Werte vom Beginn des Ticks, wie bisher. Die Schleife läuft nach einem
       werfenden Tick mit den übrigen Ticks des Frames weiter.
     - Kommentare (warum): am `emitStrict` — jeder Listener hört den Tick, auch hinter einem,
       der wirft; ein ausgelassener fiele gegenüber den anderen und gegenüber `tickNo` einen
       Schritt zurück. An der Fortschreibung — der Tick zählt, was seine Listener auch werfen,
       sonst brächte der nächste Frame denselben Tick (gleiche `tickNo`) wieder.
     - Guard und `#alpha` unverändert. `OnRender` bleibt `emit()`, in einem `try`: im `catch`
       ohne gesammelte Tick-Fehler unverändert weiterwerfen, sonst anhängen. Danach, wenn
       `errors` existiert: `throwCollected(errors, 'FixedFrameLoop: listeners threw in more
       than one OnTick or OnRender of the frame')` — ein Fehler unverändert, mehrere als
       `AggregateError` in der Reihenfolge der Zustellungen.
     - Klassen-TSDoc (Z. 40–94) um einen Absatz ergänzen: Jeder Listener von `OnTick` hört
       jeden Tick, auch hinter einem, der wirft; der Tick zählt — `tickNo` und `tickTime`
       gehen weiter, der nächste Frame bringt ihn nicht wieder —, der Frame läuft mit seinen
       übrigen Ticks und `OnRender` weiter, und der Fehler erreicht danach den, der den Frame
       geschickt hat (`Display#renderFrame()` und dessen Aufrufer) — einer unverändert,
       mehrere als `AggregateError`. `OnRender` geht über `emit()` hinaus: ein Listener, der
       wirft, beendet die Zustellung für die Listener hinter ihm.
  2. **`FixedFrameLoop` — TSDoc** (Dazu 3): `FixedFrameLoopTickProps` (Z. 14: die Props jedes
     `OnTick`, ein neues Objekt je Tick, das ein Listener behalten darf),
     `FixedFrameLoopRenderProps` (Z. 23: die `DisplayEventProps` des Render-Frames und der
     Stand der Interpolation, ein neues Objekt je Frame), `display` (Z. 116: das Display, auf
     dem die Schleife tickt, dem Konstruktor übergeben; es bleibt dem Aufrufer, siehe
     `dispose()`), `isDisposed` (Z. 190: `true`, sobald `dispose()` lief — auch durch das
     `dispose()` des Displays, das die Schleife mitnimmt), `[OnDisplayRenderFrame]()`
     (Z. 226: nimmt jeden Render-Frame des Displays entgegen, läuft die Ticks, für die der
     Frame Platz hat, und schickt `OnRender`; der Absatz zu werfenden Listenern steht in der
     Klassen-TSDoc, hier ein `@throws` mit Verweis). Kein `@internal`.
  3. **`FrameLoop` — TSDoc** (`FrameLoop.ts`, nur Kommentare): Klasse (Z. 193; Dazu 3) — sendet
     `FrameLoop.OnFrame` an jedes Ziel auf ihr, einmal je Animation-Frame, aus der Animation
     Loop des übergebenen Renderers oder aus `requestAnimationFrame` ohne einen, höchstens
     `maxFps`-mal je Sekunde; die Payload trägt `now`, `lastNow`, `deltaTime` in Sekunden,
     `frameNo` und `measuredFps`; die Schleifen teilen sich einen Treiber je Renderer und
     einen ohne, ein Treiber läuft, solange eine Schleife auf ihm ein Ziel hat; ein `Display`
     baut sich eine (`Display.ts:938`). `subscriptionCount` (Z. 294) — die Zahl der Ziele
     auf der Schleife: `start()` fügt ein Ziel hinzu, das noch nicht drauf ist, `stop()` und
     `clear()` nehmen sie herunter; über 0 nimmt die Schleife Frames von ihrem Treiber.
     Rückgabetyp `: number` explizit dazuschreiben. `stop(target)` (Z. 354) — nimmt `target`
     von der Schleife; ein Ziel, das nicht drauf ist, sowie `null` und `undefined` ändern
     nichts; mit dem letzten Ziel lässt die Schleife ihren Treiber los, und der erste Frame
     nach dem nächsten `start()` hat `deltaTime` 0 und beginnt den `maxFps`-Takt neu
     (Z. 361–370). Rückgabetyp `: void` explizit. `clear()` (Z. 419) — nimmt jedes Ziel
     herunter, wie `stop()` es eins nach dem anderen tut. Rückgabetyp `: void` explizit.
     Keine Verhaltensänderung, kein Spec.
  4. **`Canvas2DStage` — `setCanvasSize()` vergleicht gerundet** (Dazu 4,
     `Canvas2DStage.ts:269`): `if (this.width !== Math.floor(width) || this.height !==
     Math.floor(height))` (Argumente sind nach `assertCanvasSide()` endlich und ≥ 1, `floor`
     gleich der Kürzung, die die Canvas vornimmt), Kommentar: die Canvas nimmt ganze Zahlen,
     und jede Zuweisung an ihre Breite leert sie — eine Größe, die sie schon hat, wird nicht
     geschrieben. Geschrieben wird weiter das Argument (`this.canvas.width = width`), die
     Canvas rundet selbst.
  5. **`Canvas2DStage` — TSDoc** (nur Kommentare außer Schritt 4): `Canvas2DStageFitType`
     (Z. 15; Dazu 3: wie die Sicht die Canvas in den Container bringt — `'contain'` zeigt die
     ganze Canvas, `'cover'` füllt den Container; gegen `stage/fitIntoRectangle.ts` prüfen),
     Klasse (Z. 45; Dazu 3: eine 2D-Canvas in einer three.js-Szene — ein `Stage2D` mit
     orthografischer Projektion zeigt sie auf einem Sprite, in den Container eingepasst; in
     `OnCanvas2DStageRender` zeichnen, `needsUpdate` setzen, `render()` einmal je Frame; die
     Stage treibt ihren `StageRenderer` selbst; `dispose()` gibt frei, was sie gebaut hat),
     `renderer` (Z. 46: der übergebene `WebGPURenderer`, mit dem `render()` zeichnet; bleibt dem
     Aufrufer), `stageRenderer` (Z. 47: der `StageRenderer`, den die Stage baut und in dem
     `stage` hängt; `setContainerSize()` gibt ihm die Containergröße, `render()` aktualisiert
     und zeichnet ihn; `dispose()` disposed ihn), `canvas` (Z. 69: vom Konstruktor in der
     übergebenen Größe gebaut, oder die übergebene, die dem Aufrufer bleibt — `dispose()` lässt
     sie, wie sie ist), `projection` (Z. 85: die orthografische Projektion von `stage`,
     `'xy|bottom-left'`, auf die Canvas-Größe mit `fit` eingepasst), `stage` (Z. 86: das
     `Stage2D`, das die Canvas auf `sprite` zeigt; vom Konstruktor gebaut, `dispose()`
     disposed es), `scene` (Z. 88: die Szene von `stage`, sie hält `sprite`),
     `setCanvasSize()` (Z. 261: gibt der Canvas die Größe `width` × `height` und bringt Sprite
     und Sicht sofort dorthin; das nächste `render()` schickt `OnCanvas2DStageResize`, wenn sich
     die Größe seit dem letzten Frame geändert hat. Die Canvas nimmt ganze Zahlen und rundet ab
     — `setCanvasSize(10.5, 8)` gibt Canvas, Sprite und Sicht 10 × 8 —, ein Aufruf mit der
     Größe, die die Canvas hat, lässt sie samt Inhalt stehen; ein Aufruf mit einer anderen
     leert sie, wie jede Zuweisung an `canvas.width`: in `OnCanvas2DStageResize` oder
     `OnCanvas2DStageRender` neu zeichnen und `needsUpdate` setzen. Eine übergebene Canvas
     gehört dem Aufrufer, der Aufruf schreibt ihre Breite und Höhe. Auf einer disposten Stage
     tut ein gültiger Aufruf nichts. `@throws {RangeError}` für eine Breite oder Höhe, die
     keine endliche Zahl ab 1 ist, mit dem Aufruf als Subjekt, bevor etwas geschrieben wird —
     auch nach `dispose()`). Die TSDoc von `dispose()` (Z. 382–411) bleibt.
  6. **`checkSpriteKind()`** in `src/sprites/defineSprite.ts`, intern (`@internal`, in keiner
     `public-api.ts`):
     - Modulkonstante `const spriteKinds = new WeakSet<object>();` mit Kommentar: jede Art,
       die `defineSprite()` herausgibt; geprüft wird eine Art einmal, dort — eine Kopie oder
       ein Objekt derselben Form hat keine der Prüfungen durchlaufen.
     - `defineSprite()` Z. 283: `const kind = Object.freeze({…}); spriteKinds.add(kind); return
       kind;`
     - `export function checkSpriteKind(kind: unknown, where: string): asserts kind is
       SpriteKind` — wirft, wenn `!spriteKinds.has(kind as object)`:
       `new TypeError(`${where}: the kind must be a sprite kind from defineSprite(), got ${describeValue(kind)}`)`.
       TSDoc: prüft in den Worten von `where`, dass `kind` von `defineSprite()` kommt;
       `@internal`; `@throws` einen `TypeError`, der den Wert zitiert.
  7. **`new FeatureSprites()`** (`FeatureSprites.ts`, `resolveParts()` Z. 159ff.):
     - erste Zeile von `resolveParts()`: `checkSpriteKind(kind, WHERE);` (vor der
       Options-Prüfung, die Art ist das erste Argument).
     - im Zweig `geometry != null` (Z. 173) zuerst: kein `instanceof FeatureSpritesGeometry`
       → `TypeError` `FeatureSprites: the geometry handed in is no FeatureSpritesGeometry, got
       ${…}`; im Zweig `material != null` (Z. 184) zuerst: kein `instanceof
       FeatureSpritesMaterial` → `FeatureSprites: the material handed in is no
       FeatureSpritesMaterial, got ${…}`. Das zitierte `${…}` nach AGENTS.md: ein three.js-Objekt
       nach seinem `type` (`isBufferGeometry === true` bzw. `isMaterial === true` →
       `value.type`), sonst `describeValue(value)` — Muster `OrthographicProjection.ts:143`.
       Danach die bestehenden Vergleiche der Art.
     - TSDoc des Konstruktors (Z. 302–309): `@throws`-Zeile um »a kind that did not come from
       `defineSprite()`« und »a `geometry` or a `material` that is no `FeatureSpritesGeometry`
       or `FeatureSpritesMaterial`« ergänzen, und die Abweisungen von Geometrie, Material und
       Ressourcen, die durchschlagen, nennen (»what `new FeatureSpritesGeometry()`, `new
       FeatureSpritesMaterial()` and `new SpriteResources()` refuse of the options, in their
       name«); Zeile 307 dabei auf Spaltenbreite umbrechen.
     - TSDoc (Dazu 3): `FeatureSpritesOptions` (Z. 21: die Optionen von `FeatureSprites` —
       die der Geometrie und des Materials nebeneinander, dazu `geometry`, `material`, `grow`
       und `passes`; jedes Feld optional; die `//`-Zeile Z. 20 bleibt, über der TSDoc),
       `FeatureSpritesPass#material` (Z. 58: das für `pass` gebaute Material; die Sprites bauen
       und geben es frei), `FeatureSpritesPass#pass` (Z. 59: der Pass, den dieses Mesh
       zeichnet), Konstruktor von `FeatureSpritesPass` (Z. 67: die Sprites bauen eins je Pass,
       über ihrer Geometrie und mit dem für den Pass gebauten Material; es wird nicht allein
       gebaut), `FeatureSprites#kind` (Z. 277: die Sprite-Art, die das Mesh zeichnet, dem
       Konstruktor übergeben).
  8. **`new FeatureSpritesGeometry()`** (`FeatureSpritesGeometry.ts:75–87`), alles vor
     `super()` und vor dem Lesen von `kind.base`:
     - `checkSpriteKind(kind, WHERE);`
     - `parameters`: `undefined` → Vorgabe 100 wie bisher; eine Zahl → `{capacity}` wie bisher
       (die Kapazität prüft der Pool); sonst muss es ein Objekt sein, kein Array
       (`isObject(x) && !Array.isArray(x)`), sonst `TypeError` `FeatureSpritesGeometry: the
       parameters must be a number or an object, got ${describeValue(parameters)}`
       (`null` eingeschlossen).
     - `baseArgs`: `undefined` und `null` gelten als nicht übergeben → `kind.base.defaultArgs`
       (`baseArgs ?? kind.base.defaultArgs` statt des Destrukturierungs-Defaults); sonst
       `Array.isArray`, sonst `TypeError` `FeatureSpritesGeometry: baseArgs is a list of
       arguments, got ${…}`.
     - `attributeUsage`: `undefined`/`null` → keiner (wie bisher in `descriptionOf()`); sonst
       ein Objekt, kein Array, sonst `TypeError` `FeatureSpritesGeometry: attributeUsage must be
       an object, got ${…}`; von dessen `dynamic`, `stream`, `static` je `undefined`/`null` →
       keine Liste, sonst ein Array aus Strings, sonst `TypeError`
       `FeatureSpritesGeometry: attributeUsage.dynamic is a list of names, got ${…}` (bzw.
       `.stream`, `.static`, der ganze Wert zitiert). Die Prüfung der Namen gegen die Art in
       `descriptionOf()` bleibt.
     - Der Weg über `grown()` (`growthDescriptor`) läuft durch dieselben Prüfungen, sein
       Objekt besteht sie.
     - TSDoc (Dazu 3): `basePool`/`instancedPool` (Z. 68–69: der Pool des einen
       Basis-Vertex-Objekts — Quad oder Gitter der Basis — bzw. der Pool der Sprites, eine
       Instanz je Sprite; die `//`-Zeile Z. 67 bleibt über der TSDoc von `basePool`),
       `isFeatureSpritesGeometry` (Z. 71: kennzeichnet eine `FeatureSpritesGeometry`, wie die
       `is…`-Flags von three), `kind` (Z. 73: die Art, für die die Geometrie gebaut ist),
       Konstruktor (Z. 75: baut die Geometrie von `kind` für `capacity` Sprites — eine Zahl
       oder `parameters.capacity`, 100 ohne — und ruft `make()` des Basis-Vertex-Objekts mit
       `baseArgs`, ohne sie mit den `defaultArgs` der Basis; `@throws` `TypeError` für eine
       Art, die nicht von `defineSprite()` kommt, und jede Formabweisung oben, ein `Error` für
       einen Namen in `attributeUsage`, den die Art nicht kennt; die Abweisung der Kapazität
       mit der Klasse nennen, die der Pool wirft — in `VertexObjectBuffer` nachsehen).
  9. **`new FeatureSpritesMaterial()`** (`FeatureSpritesMaterial.ts:163ff.`), beides vor
     `super()`:
     - `checkSpriteKind(kind, WHERE);`
     - `options`: `undefined` → keine; sonst ein Objekt, kein Array, sonst `TypeError`
       `FeatureSpritesMaterial: the options must be an object, got ${describeValue(options)}`
       (`null` eingeschlossen — wie `new FeatureSprites()` seit Paket 20). `options ?? {}`
       in Z. 168 bleibt für `undefined`.
     - `resources`: `undefined`/`null` → keine (wie bisher); sonst `instanceof SpriteResources`,
       sonst `TypeError` `FeatureSpritesMaterial: resources must be a SpriteResources, got
       ${describeValue(resources)}` — vor den bestehenden Prüfungen Z. 188–193.
     - `textures`/`uniforms` prüft `SpriteResources` (Schritt 10) mit `where` = `WHERE`.
     - TSDoc des Konstruktors (Z. 159–162) um `@throws` ergänzen: die neuen Abweisungen und
       die bestehenden (Ressourcen neben `textures`/`uniforms`, disposte Ressourcen,
       Ressourcen ohne das, was ein Feature deklariert, Pass- und Placement-Abweisungen) —
       mit der Klasse, die der Code wirft.
     - TSDoc (Dazu 3): `isFeatureSpritesMaterial` (Z. 138: Kennzeichen wie bei der
       Geometrie), `kind` (Z. 140: die Art, die das Material zeichnet), `resources` (Z. 141: die
       Uniforms und Texturen, die das Material liest — die übergebenen `resources`, die dem
       Aufrufer bleiben, oder eigene aus `textures` und `uniforms`, die `dispose()` freigibt).
  10. **`new SpriteResources()`** (`SpriteResources.ts:108ff.`, Dazu 1), alles vor
      `collectSpriteDeclarations()` und vor dem ersten Signal:
      - `features`: `null`/`undefined` oder ohne `Symbol.iterator` → `TypeError`
        `${where}: features is a list of features, got ${describeValue(features)}` (Wortlaut
        wie `defineSprite.ts:248`); nach `features = [...features]` jedes Element durch
        `checkFeature(feature, where)`.
      - `options`: `undefined` → `{}` wie bisher; sonst ein Objekt, kein Array, sonst
        `TypeError` `${where}: the options must be an object, got ${…}`.
      - `textures`/`uniforms`: `undefined`/`null` → keine; sonst ein Objekt, kein Array, sonst
        `TypeError` `${where}: textures must be an object of textures by name, got ${…}` bzw.
        `${where}: uniforms must be an object of values by name, got ${…}`.
      - TSDoc (Dazu 3): `textureNames` (Z. 97: die Namen der Texturen, die die Features
        deklarieren, in der Reihenfolge ihrer ersten Deklaration — gegen
        `collectSpriteDeclarations()` prüfen), `isDisposed` (Z. 104: `true`, sobald `dispose()`
        lief), Konstruktor (Z. 108: baut die Uniforms und Texturen, die `features` deklarieren,
        jede Uniform auf ihrem Startwert oder dem aus `options.uniforms`, jede Textur auf die aus
        `options.textures`; `where` nennt den Aufrufer in den Meldungen, `SpriteResources` ohne
        ihn; `@throws` für die neuen Formabweisungen und die bestehenden — Name, den kein
        Feature deklariert, Wert falscher Form, Kollision der Deklarationen —, je mit der
        Klasse, die der Code wirft).
      - `checkFeature.ts:15–18` (TSDoc): `new SpriteResources()` in die Aufzählung der Stellen
        aufnehmen, die ein Feature prüfen.
  11. **Specs** — Korrektheitsfehler, also zuerst rot:
      - `FixedFrameLoop.spec.ts`, neuer `describe('a listener that throws')` mit eigener
        Schleife (`new FixedFrameLoop(makeFakeDisplay(), {fps: 60})`), der werfende Listener
        **vor** dem aufzeichnenden abonniert:
        - »every listener of OnTick hears the tick behind one that throws, the tick counts,
          OnRender goes out, and the error comes out afterwards« — ein Frame `1 / 60`, der
          erste Tick-Listener wirft einmal: `toThrow` mit genau diesem Fehler (`toBe` über
          `try/catch`), der zweite hat `tickNo` 0 gehört, ein `OnRender` mit `tickNo` 1,
          `sim.tickNo === 1`; der nächste Frame `1 / 60` gibt dem zweiten `tickNo` 1, nicht
          wieder 0.
        - »a listener that throws in every tick of a frame: every tick runs, and the errors
          come out together as an AggregateError« — Frame `0.05` (3 Ticks), Listener wirft
          je Tick einen eigenen Fehler: `AggregateError`, `errors` die drei in Reihenfolge,
          Meldung `FixedFrameLoop: listeners threw in more than one OnTick or OnRender of the
          frame`, `OnRender` mit `tickNo` 3.
        - »a tick listener and a render listener that throw come out together« —
          `AggregateError` mit `[tickError, renderError]`.
        - Charakterisierung (vor dem Fix grün): »a render listener that throws ends the
          dispatch for the render listeners behind it, comes out unchanged, and the next frame
          runs as usual«.
      - `Canvas2DStage.spec.ts`: »setCanvasSize() leaves a canvas of the size it is given,
        rounded down, as it is« — eine Variante von `makeRoundingCanvas()` (Z. 36ff.), die die
        Zuweisungen an `width`/`height` zählt; Stage 10 × 8, `setCanvasSize(10.5, 8.9)` →
        0 Zuweisungen; `setCanvasSize(12, 8)` → Zuweisungen, Sprite und Sicht 12 × 8. Vor dem
        Fix rot (eine Zuweisung).
      - `defineSprite.spec.ts`: `checkSpriteKind()` nimmt jede Art aus `defineSprite()`
        (`QuadBase`-Art, `TexturedSpriteKind`) und weist `undefined`, `5`, `{}`, `{...kind}`
        und `Object.create(kind)` mit dem `TypeError` oben ab (für die Kopien Präfix-Prüfung
        der Meldung, `describeValue` schreibt deren Inhalt).
      - `FeatureSprites.spec.ts`: neben der Tabelle Z. 465ff. ein `test.each` für die Art —
        `undefined`, `5`, `{}`, eine Kopie `{...kind}` — mit `new TypeError('FeatureSprites:
        the kind must be a sprite kind from defineSprite(), got …')` (Kopie per Präfix),
        nichts gebaut (Spy auf `FeatureSpritesGeometry.prototype.dispose` nicht gerufen,
        Signal- und Effektzahl unverändert, wie die Tabelle es misst); `geometry: new
        BufferGeometry()` → `…the geometry handed in is no FeatureSpritesGeometry, got
        BufferGeometry`, `geometry: 5` → `…got 5`, `material: new MeshBasicMaterial()` →
        `…the material handed in is no FeatureSpritesMaterial, got MeshBasicMaterial`;
        `{baseArgs: 5}` → `FeatureSpritesGeometry: baseArgs is a list of arguments, got 5`,
        nichts gebaut; `{textures: 5}` → `FeatureSpritesMaterial: textures must be an object of
        textures by name, got 5` und mit `passes: [ShadowPass]` → Subjekt `FeatureSprites`.
        Vor dem Fix rot: die Kopie baut ohne Fehler, `undefined` wirft roh, die Geometrie- und
        Material-Fälle melden »built for another sprite kind«.
      - `FeatureSpritesGeometry.spec.ts`: Abweisungen der Art (wie oben, Subjekt
        `FeatureSpritesGeometry`), `parameters` `null`, `'x'`, `[]`, `true`; `baseArgs` `5`,
        `'ab'`, `{}`; `attributeUsage` `5`, `[]`; `{dynamic: 'position'}`, `{stream: [5]}`,
        `{static: {}}` — je mit der Meldung aus Schritt 8; Charakterisierung: `baseArgs: null`
        und `attributeUsage: null` bauen wie ohne (gleiche Basis-Vertices, gleicher
        Descriptor wie `kind.description`). Vor dem Fix rot: `null` als Parameter, `baseArgs`
        und die Listen werfen roh oder bauen still.
      - `FeatureSpritesMaterial.spec.ts`: Art wie oben; `options` `null`, `5`, `'x'`, `[]`;
        `resources` `5`, `{}`; `textures: 5`, `uniforms: 'ab'` — je mit der Meldung aus
        Schritt 9/10 und Signal-/Effektzahl unverändert. Vor dem Fix rot: `5`, `'x'`, `[]`
        bauen still, `resources: 5` wirft roh.
      - `SpriteResources.spec.ts`: `features` `5`, `undefined`; ein Element
        `{name: 'odd', uniforms: 5}` (Meldung von `checkFeature()` mit Subjekt
        `SpriteResources`); `options` `null`, `5`; `textures: 5`, `uniforms: []` — Subjekt
        `SpriteResources`; ein `where` von außen (`new SpriteResources(5, {}, 'Mine')`) gibt
        Subjekt `Mine`.
  12. **Guide** `packages/twopoint5d/docs/sprites.md`:
      - Z. 1064–1072 (Geometrie, `attributeUsage`/`baseArgs`): ein Satz — die Geometrie nimmt
        nur eine Art aus `defineSprite()`, `parameters` als Zahl oder Objekt, `baseArgs` als
        Liste, `attributeUsage` als Objekt aus Namenslisten; anderes wirft einen `TypeError`,
        bevor etwas gebaut ist.
      - Z. 1074–1079 (Material): ein Satz — Art aus `defineSprite()`, Optionen als Objekt,
        `resources` ein `SpriteResources`, `textures` und `uniforms` Objekte nach Namen;
        anderes wirft einen `TypeError`.
      - Z. 1666–1670 »Refusals« (Dazu 5): die Liste der `TypeError`s um eine Art, die nicht von
        `defineSprite()` kommt, Optionen ohne Objekt, `passes` ohne Liste, `grow` ohne `true`
        oder `false`, eine `geometry`/ein `material`, die keine `FeatureSpritesGeometry` bzw.
        `FeatureSpritesMaterial` sind, ergänzen; dazu, dass Geometrie, Material und Ressourcen
        ihre eigenen Abweisungen in ihrem Namen werfen.
  13. **Proposal** `docs/proposals/sprite-features.md` §5.2: je ein Halbsatz bzw. Satz an
      `FeatureSpritesGeometry` (Z. 611–617), `SpriteResources` (Z. 618–625),
      `FeatureSpritesMaterial` (Z. 626–632) und `FeatureSprites` (Z. 656–660, Dazu 5: auch
      Optionen ohne Objekt, `passes` ohne Liste, `grow` ohne Boolean) zu den Abweisungen
      dieses Pakets — im Stil des Proposals, für Entwickler, ohne Vorgeschichte.
  14. **CHANGELOG** `## [Unreleased]`:
      - `### Changed`, direkt hinter dem Eintrag zu `definePass()` (Z. 71): `new
        FeatureSprites()`, `new FeatureSpritesGeometry()` and `new FeatureSpritesMaterial()`
        refuse a kind that did not come from `defineSprite()` with a `TypeError` that names the
        class, before anything is built; dazu je in einem Satz die Formabweisungen
        (Geometrie: Parameter, `baseArgs`, `attributeUsage` samt Listen — `baseArgs: null`
        takes the `defaultArgs` of the base; Material: Optionen, `resources`; `new
        SpriteResources()`: `features`, ein Feature wie `defineFeature()`, Optionen, `textures`,
        `uniforms`; `new FeatureSprites()`: eine `geometry`/ein `material`, die keine sind).
        Kein **BREAKING**: jede abgewiesene Eingabe liegt außerhalb der Typen.
      - `### Fixed`, neben dem Eintrag zu `OnCanvas2DStageResize` (Z. 201): every listener of
        `OnTick` of a `FixedFrameLoop` hears each tick, also behind one that throws: the tick
        counts — the next frame does not run it again —, the frame goes on with its remaining
        ticks and `OnRender`, and the error reaches the caller of the frame afterwards — one
        unchanged, several as an `AggregateError`.
      - `### Fixed`: `Canvas2DStage#setCanvasSize()` with the size the canvas has — a
        fraction rounded down to it included — leaves the canvas and what is drawn on it as
        they are.
      - Keine Einträge für reine TSDoc-Ergänzungen (wie Paket 19).
  15. `pnpm format` nicht nötig, aber `pnpm lint` muss grün sein; überlange Zeilen in TSDoc
      und Markdown auf die Spaltenbreite der Datei umbrechen.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: let every listener of a FixedFrameLoop hear each tick behind one that throws and count the tick all the same, refuse a sprite kind that did not come from defineSprite() and options that new FeatureSprites(), new FeatureSpritesGeometry(), new FeatureSpritesMaterial() and new SpriteResources() cannot read, leave a canvas of the size setCanvasSize() is given alone, and document the remaining members of FrameLoop, FixedFrameLoop, Canvas2DStage and the feature sprites`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · `FixedFrameLoop.ts:238–246` unverändert (Tick-Schleife
    Z. 235–247) · `Canvas2DStage.ts:261`, `:46–47`, `:69`, `:85–86`, `:88` unverändert ·
    `FrameLoop.ts:294`, `:354`, `:419` unverändert · Sprite-Konstruktoren verschoben durch
    Paket 20: `FeatureSprites.ts:300` → Konstruktor Z. 310, Prüfungen in `resolveParts()`
    Z. 159ff.; `FeatureSpritesGeometry.ts:75–79` unverändert; `FeatureSpritesMaterial.ts:112–117`
    → Z. 163–168 · Dazu 1–5 aufgenommen (Gründe oben) · Folge aus Paket 20 (Guide- und
    Proposal-Absatz zu `new FeatureSprites()`) als Symptom hierher, im Plan unter Paket 20
    vermerkt · Restplan unverändert, kein weiteres Paket offen
  - 2026-10-24 Zug 1: Implementierer beauftragt (Runde 0), opus, Effort medium · Brief `paket-21.impl-0.brief.txt`
  - 2026-10-24 Zug 2: Report FERTIG (`paket-21.impl-0.json`, Session cc41deee) · 17 Dateien geändert (7 Quell-, 7 Spec-Dateien, Guide, Proposal, CHANGELOG) · Arbeitsbaum schmutzig · rote Läufe: FixedFrameLoop 3, Canvas2DStage 1, FeatureSprites/ 46 · 2 Nebenbefunde gemeldet · Verify `pnpm run ci` exit=0 (`paket-21.verify.log`)
  - 2026-10-24 Zug 3: Reviewer beauftragt (Runde 0), opus, Effort medium · Diff `paket-21.diff` (19 Dateien)
  - 2026-10-24 Zug 3: Urteil »mit Nacharbeit annehmbar« (`paket-21.review-0.json`) · 4/4 Nebenbefunde und Dazu 1–5 erfüllt · Q1 wichtig (»in their own name« falsch für die geteilten Ressourcen der Passes: Guide, Proposal, TSDoc `FeatureSprites`) · Q2 wichtig (Kopie einer Art erfüllt `SpriteKind` und wird jetzt abgewiesen → Bruch) · Q3–Q5 klein
  - 2026-10-24 Zug 4 Runde 1: offen Q1, Q2 (+ Q3–Q5 nebenbei) · Resume Session cc41deee, opus, medium · Entscheidung zu Q2: **BREAKING** samt Migration-Guide-Abschnitt und `fix(twopoint5d)!:` — die Zug-0-Prämisse »nur `defineSprite()` baut eine `SpritePipeline`« trägt nicht (eine Kopie trägt dieselbe), die Konvention »jeder Bruch mit Migrationshinweis« geht vor; die übrigen Formabweisungen bleiben ohne BREAKING
  - 2026-10-24 Zug 4 Runde 1 zurück: FERTIG (`paket-21.impl-1.json`) · Q1–Q5 nachgezogen (Guide, Proposal, TSDoc `FeatureSprites`/`FixedFrameLoop`/`checkFeature`, CHANGELOG BREAKING + Migration-Guide-Abschnitt »A sprite kind that did not come from defineSprite()«) · Commit-Zeile auf `fix(twopoint5d)!:` · Verify `pnpm run ci` exit=0 (`paket-21.verify.log`; Runde 0 in `paket-21.verify-r0.log`) · Reviewer Runde 1 beauftragt, sonnet, medium, Diff `paket-21.r1.diff`
  - 2026-10-24 Zug 4 Runde 1 Review: angenommen (`paket-21.review-1.json`) · Q1–Q5 erledigt · neu nur klein (Umbruch `docs/sprites.md:1677–1681`)
  - 2026-10-24 Zug 5: Commit ccf8754f (19 Dateien, Trailer `Remediation-Run: 2026-10-23`) · Verify-Lauf nach Runde 1 trägt den Commit (`paket-21.verify.log`, exit=0) · Plan auf `[x]`, Queue-Einträge 1–4 abgehakt, 1 Nebenbefund in »Offene Befunde«, 1 Folge von Paket 10 unter dem Paket

## Findings im Volltext

Die vier Einträge aus »Offene Befunde« (`./remediation-plan.md`), wörtlich:

**Nebenbefund · low · `packages/twopoint5d/src/display/FixedFrameLoop.ts:238–246`** (Tick-Schleife
in `#onFrame`) — `OnTick` geht über `emit()` hinaus, Akkumulator, `tickTime` und `tickNo` werden
erst danach fortgeschrieben: ein werfender Tick-Listener lässt denselben Tick (gleiche `tickNo`)
im nächsten Frame wiederkommen, und `OnRender` fällt für diesen Frame aus; am Laufbeginn schon so
(`git show 7341059f:…`, Z. 235) · Paket 18 · `→ Scope`

**Nebenbefund · low · `packages/twopoint5d/src/stage/Canvas2DStage.ts:261`** `setCanvasSize()` —
ohne TSDoc; Abweisungen, Abrundung der Canvas und Verhalten nach `dispose()` stehen nur in der
TSDoc von `dispose()` und im CHANGELOG; am Laufbeginn schon so. Dazu ohne TSDoc in derselben
Klasse: `renderer`, `stageRenderer` (Z. 46–47), `canvas` (Z. 69), `projection`, `stage`
(Z. 85–86), `scene` (Z. 88) (Zug 0 von Paket 19) · Paket 18 · `→ Scope`

**Nebenbefund · low · `packages/twopoint5d/src/display/FrameLoop.ts:294`** `subscriptionCount` und
`:419` `clear()` — öffentlich, ohne TSDoc, während die übrigen Getter der Klasse eine tragen; am
Laufbeginn schon so. Dazu ohne TSDoc: `stop(target)` (Z. 354) (Zug 0 von Paket 19) · Paket 18 ·
`→ Scope`

**Nebenbefund · low · `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:300`,
`FeatureSpritesGeometry.ts:75–79`, `FeatureSpritesMaterial.ts:112–117`** (Konstruktoren) — keiner
prüft, dass `kind` eine Sprite-Art aus `defineSprite()` ist (`new FeatureSprites(undefined)`
wirft roh in `kind.base…` ohne Subjekt), und Geometrie und Material prüfen die Form ihrer
Optionen nicht (`new FeatureSpritesGeometry(kind, null)` wirft roh, `new
FeatureSpritesMaterial(kind, 5)` baut still mit Defaults); am Laufbeginn schon so (`git show
7341059f:…FeatureSpritesGeometry.ts`, Z. 71–75). Die Optionen von `new FeatureSprites()` prüft
Paket 20 · Paket 20 (Zug 0) · `→ Scope`

## Entscheidungen dieses Zugs 0, mit Grund

- **Marke statt Formprüfung für die Art.** Ein Feature, das nie durch `defineFeature()` lief,
  wird strukturell geprüft und angenommen (Paket 10); eine Art nicht: `defineSprite()` mischt
  Beschreibung, Pipeline und Aliase und prüft deren Zusammenspiel einmal, die Konstruktoren
  verlassen sich darauf, und `resolveParts()` vergleicht Arten schon über ihre Identität
  (`geometry.kind !== kind`). Eine strukturelle Prüfung könnte das Zusammenspiel nur durch einen
  zweiten `defineSprite()`-Lauf bestätigen. Kein Aufrufer im Repo baut eine Art von Hand
  (`grep` über `packages/`, `apps/`: alle aus `defineSprite()`, `presets.ts` eingeschlossen).
  Eine zweite Kopie der Bibliothek im Bundle erkennt die Arten der ersten nicht — wie bei jedem
  `instanceof`; kein **BREAKING**, weil der Typ `SpriteKind` eine `SpritePipeline` verlangt, die
  nur `defineSprite()` baut.
- **`null` als Optionsobjekt abgewiesen, als Feld »nicht übergeben«.** Wie Paket 20 bei
  `new FeatureSprites()` (Vorgabe nur für `undefined`) und `checkPass()` (`null` gilt als nicht
  mitgebracht). Deshalb nimmt `baseArgs: null` die `defaultArgs` statt roh zu werfen.
- **Subjekt der Formabweisung ist die Klasse, die prüft**, auch wenn sie über `new
  FeatureSprites()` erreicht wird — wie die bestehende Meldung `FeatureSpritesGeometry:
  attributeUsage names "…"`.
- **Die Schleife tickt nach einem werfenden Tick weiter.** Jeder Tick ist ein Schritt, den alle
  Listener gehen; mit `emitStrict()` hat jeder den werfenden Tick gehört, ein Abbruch ließe nur
  den Rückstand für den nächsten Frame liegen. Ein Listener, der in jedem Tick wirft, ergibt
  höchstens `maxStepsPerFrame` Fehler in einem `AggregateError`.
- **Getter-Werte während eines Ticks bleiben die vom Beginn des Ticks** (Fortschreibung hinter
  dem Ereignis, nach dem `catch`), damit sich für keinen Listener etwas ändert, der nicht wirft.
- Modell stärkste Stufe: drei Module, ein Ereignisvertrag, eine Marke, rund dreißig
  TSDoc-Stellen und drei Doku-Absätze in der strengen Prosa dieses Repos; Effort `medium`, weil
  Werte, Meldungen und Stellen hier stehen.

## Urteil des Reviewers

Runde 0 (`paket-21.review-0.json`, »mit Nacharbeit annehmbar«), Runde 1 (`paket-21.review-1.json`, »angenommen«):

- `FixedFrameLoop`-Tick nach werfendem Listener: behoben — `FixedFrameLoop.ts:273` (`emitStrict` im `try`, Fortschreibung danach), `:310` (`throwCollected`), Klassen-TSDoc ab Z. 101
- TSDoc `Canvas2DStage#setCanvasSize()` und Felder: behoben — `Canvas2DStage.ts:299–309`, Felder ab Z. 57
- TSDoc `FrameLoop#subscriptionCount`/`stop()`/`clear()`: behoben — `FrameLoop.ts:307`, `:372`, `:438`, dazu Klassen-TSDoc
- Konstruktoren der Feature-Sprites: behoben — Marke `defineSprite.ts:70/78/299`, `checkSpriteKind` in `FeatureSprites.ts:176`, `FeatureSpritesGeometry.ts:121`, `FeatureSpritesMaterial.ts:183`
- Dazu 1 `SpriteResources`: behoben — `SpriteResources.ts:129–144`, `checkFeature.ts:16`
- Dazu 2 `geometry`/`material`: behoben — `FeatureSprites.ts:191–211`
- Dazu 3 TSDoc-Lücken: behoben
- Dazu 4 gerundeter Vergleich: behoben — `Canvas2DStage.ts:320`
- Dazu 5 Guide/Proposal: behoben — `docs/sprites.md:1672ff.`, `sprite-features.md:666ff.`; Subjekt der Ressourcen in Runde 1 korrigiert (`docs/sprites.md:1677–1680`, `sprite-features.md:673–676`, `FeatureSprites.ts:337–343`)

Kleine Befunde: Umbruch des Absatzes `docs/sprites.md:1677–1681` ungleichmäßig (Runde 1, offen gelassen) · Q3–Q5 aus Runde 0 in Runde 1 mitgenommen.

## Nebenbefunde und Folgen, mit Grund

- `SpriteResources.ts:157` (Startwerte nur an der Länge gemessen): vorbestehend, `git show 7341059f:…SpriteResources.ts` Z. 123 hat dieselbe Prüfung · low · Scope-Regel »alles« greift → `→ Scope`; nicht mitgenommen, weil die Wertprüfung der Uniforms eine eigene Ursache ist (Form der Optionen ja, Inhalt eines Werts nein).
- `checkFeature.ts:91`/`:117` (Meldungen ohne `got`): die Datei entstand in Paket 10 (7b08fe55), also nicht vorbestehend, sondern Folge von Paket 10 → unter Paket 21 als `Folgen:` für den Abschluss.
