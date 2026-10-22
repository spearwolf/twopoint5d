# Paket 19 — Abgelehnte Werte und Namen in Meldungen: die `describeValue()`-Regel zu Ende ziehen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — Nachtragspaket, `Folge von: Paket 14`. Inhalt: die drei
  Folgen von Paket 14 (Symptome seiner Ursache), die fünf Queue-Einträge »in Paket 19
  aufgenommen« und drei in diesem Zug 0 gefundene vorbestehende Stellen gleicher Ursache
- Ziel: Jede Meldung der Bibliothek zeigt einen abgelehnten Wert und einen Namen, der Symbole
  zulässt, über `describeValue()`, und `describeValue()` wirft für keinen Wert.
- Modell: mittlere Stufe (claude-sonnet-5-5)
- Effort: medium
- Dateien (alle unter `packages/twopoint5d/`, außer `AGENTS.md`):
  - `src/utils/describeValue.ts`, `src/utils/describeValue.spec.ts`
  - `src/vertex-objects/createTypedArray.ts` samt Spec, `src/vertex-objects/VertexObjectDescriptor.ts` samt Spec
  - `src/sprites/spriteDeclarations.ts` samt Spec, `src/sprites/runCheckKind.ts` (Test in
    `src/sprites/defineSprite.spec.ts`), `src/sprites/FeatureSprites/SpriteResources.ts` samt Spec,
    `src/sprites/SpritePicker.ts` samt Spec
  - `src/texture/TextureAtlas.ts`, `src/texture/selectAtlasFrames.ts`, `src/texture/FrameBasedAnimations.ts`,
    `src/texture/DynamicAtlas.ts`, `src/texture/TextureStore.ts` samt Specs (dazu
    `src/texture/TextureResource.spec.ts`, `src/texture/FrameTable.spec.ts`)
  - `src/stage/StageRenderer.ts`, `src/stage/StageRenderOrder.ts`, `src/stage/OrthographicProjection.ts`,
    `src/stage/ParallaxProjection.ts` samt Specs
  - `src/controls/PanControl2D.ts` samt Spec, `src/display/Display.ts`
  - `docs/sprites.md` (Absatz zu `checkKind(kind)`, `:2022–2032`),
    `docs/proposals/animation-playback-and-aseprite.md` (Tabelle `:107–116`), `CHANGELOG.md` (`:120`)
  - `AGENTS.md` im Repo-Root (»Error and warning messages«, `:110–113`)

## Die Regel, nach der dieses Paket arbeitet

Zug 0 von Paket 15 hat offen gelassen, ob die Regel in `AGENTS.md` jede Kandidatenstelle trifft.
Entschieden (Gründe unten unter »Entscheidungen dieses Zug 0«):

1. **Ein abgelehnter Wert** — ein Argument, eine Option, ein Feld, ein Dateneintrag, den die
   Bibliothek wegen Typ oder Wertebereich zurückweist — geht immer durch `describeValue()`, gleich
   welchen Typ er deklariert hat: nie `String()`, `JSON.stringify()`, `toString()`, keine rohe
   Interpolation und keine Interpolation in eigenen Anführungszeichen (`"${value}"`).
2. **Ein Name, der ein Symbol sein kann** (`TextureAtlasFrameName`, `AnimName`, beide
   `string | symbol`), geht durch `describeValue()`: es schreibt `"walk"` und `Symbol(walk)`
   unterscheidbar, eine Interpolation wirft für ein Symbol, `"${name.toString()}"` zeigt es als String.
3. **Die Argumente eines Aufrufs, den eine Meldung ausschreibt** (`getAsync("hero", ["atlas", "texture"])`),
   gehen durch `describeValue()`.
4. **Ein Name vom Typ `string`**, der Instanzen unterscheidet (`FeatureSprites "hud"`,
   `the stage "a"`, `feature "x"`) oder den ein Nachschlagen nicht fand (`no resource with id "a"`,
   `no feature declares the uniform "time"`), bleibt von Hand gequotet: `"${name}"` schreibt für
   jeden String, was `describeValue()` schreibt. Diese Stellen (rund 35) werden **nicht** angefasst.
5. **Ein three.js-Objekt**, das wegen seiner Klasse abgelehnt wird, wird mit seinem `type` genannt
   (`got PerspectiveCamera`); jeder andere Wert an dieser Stelle durch `describeValue()`.
6. Bleiben ausdrücklich, weil sie die **Art** eines Wertes nennen und nicht den Wert:
   `describeArray()` in `src/vertex-objects/checkBufferArray.ts:4–10` (`got Array`) und
   `describeCatalogValue()` in `src/texture/checkTextureStoreData.ts:12–13` (`an object`). Zahlen,
   die die Bibliothek selbst berechnet oder schon geprüft hat (Längen, Größen, Zähler), bleiben
   rohe Interpolation.

Nach dem Paket enthält keine Meldung unter `packages/twopoint5d/src/` (ohne Specs und
`src/testing/`) mehr `String(`, `JSON.stringify(` oder `.toString()`. Prüfbar mit:
`git grep -n -E 'String\(|JSON\.stringify\(|\.toString\(\)' -- 'packages/twopoint5d/src/**/*.ts' ':!*.spec.ts' ':!packages/twopoint5d/src/testing/**'`
— übrig bleiben genau: `src/display/Stylesheets.ts:1` (Zufalls-Id), `src/controls/PanControl2D.ts:64`
(Regelname), `src/map2d/chunk-quad-tree/StringDataChunk2D.ts:21` (eigene `toString()`),
`src/text/readBitmapFontSource.ts:44` (Datenumwandlung) und `src/utils/describeValue.ts` selbst
(`String(value)` und die TSDoc, die die Namen nennt). Zug 0 hat den Grep gegen den Stand vor dem
Paket laufen lassen: er trifft genau diese fünf und die Stellen der Schritte 2–8.

## Vorgehen

Zu jedem Schritt erst den Test schreiben bzw. die Erwartung ändern, rot laufen sehen
(`pnpm nx test twopoint5d -- <spec-datei>`), dann den Code. Den roten Lauf je Schritt in den Report.

1. **`describeValue()` wirft für keinen Wert und ruft keinen Getter** (`src/utils/describeValue.ts`).
   - `describeAt(value, depth)` wird zur Wache um ein neues `describeUnguarded(value, depth)`, das
     den heutigen Rumpf von `describeAt()` trägt: `try { return describeUnguarded(value, depth); }
     catch { return typeof value === 'function' ? '[Function]' : '[object]'; }`. Die Wache sitzt auf
     jeder Ebene (die Rekursion läuft über `describeAt()`), damit ein Eintrag, der wirft, nur sich
     selbst ersetzt: `{a: 1, b: <widerrufener Proxy>}` → `{a: 1, b: [object]}`.
   - Einträge werden über ihren eigenen Property-Descriptor gelesen, nie per `record[key]` oder
     `slice()`: neue Funktion `describeProperty(container: object, key: string | number, depth: number): string`
     — `Object.getOwnPropertyDescriptor(container, key)`; Getter und Setter → `'[Getter/Setter]'`,
     nur Getter → `'[Getter]'`, nur Setter → `'[Setter]'` (die Formen von `node:util.inspect`),
     sonst `describeAt(descriptor.value, depth + 1)`. Kein Descriptor: in einem Array ein Loch → `''`
     (heutige Ausgabe `[1, , 3]` bleibt), in einem Objekt → `'undefined'`.
   - Arrays: die Indizes `0 … min(length, MAX_ENTRIES) - 1` über `describeProperty()`, danach `…`
     wie heute, wenn `length > MAX_ENTRIES`. Plain Objects: `Object.keys()` wie heute, jeder Wert
     über `describeProperty()`. `describeEntries()` darf dafür seine Signatur ändern.
   - TSDoc um diese Sätze ergänzen (Englisch, im Ton der Datei): ein Symbol steht als `Symbol(a)`,
     unterscheidbar vom String `"Symbol(a)"`; ein Accessor eines Plain Objects oder Arrays steht als
     `[Getter]`, `[Setter]` oder `[Getter/Setter]` und wird nicht aufgerufen; ein Wert, der beim
     Zeigen wirft — ein widerrufener `Proxy`, ein Objekt, dessen `toString()` wirft oder das keins
     hat —, steht als `[object]`, eine Funktion als `[Function]`: keine Meldung verliert ihren Text
     an den Wert, den sie zeigt.
   - Neue Tests in `describeValue.spec.ts` (rot vor dem Fix, außer dem letzten):
     - `shows an accessor of a plain object by its kind and calls none of them` —
       `{get a() {calls++; return 1}, set b(v) {}, get c() {return 1}, set c(v) {}}` →
       `'{a: [Getter], b: [Setter], c: [Getter/Setter]}'`, `calls` bleibt 0
     - `shows an accessor of an array the same way, one that throws included` — `[1, 2]` mit
       `Object.defineProperty(arr, 1, {get() { throw new Error('read'); }, enumerable: true})` → `'[1, [Getter]]'`
     - `writes a value that throws while it is shown as [object]` (`test.each`): ein Objekt einer
       Klasse, deren `toString()` wirft; `Object.create(Object.create(null))`; ein widerrufener
       Proxy (`Proxy.revocable({}, {})`, dann `revoke()`); `new Proxy({}, {ownKeys() { throw new Error('keys'); }})` → je `'[object]'`
     - `writes a value that throws beside others in its place, and the others as they are` —
       `{a: 1, b: revoked}` → `'{a: 1, b: [object]}'`, `[1, revoked]` → `'[1, [object]]'`
     - `writes a function whose name throws as [Function]` —
       `Object.defineProperty(function f() {}, 'name', {get() { throw new Error('name'); }})` → `'[Function]'`
     - `shows a hole of an array as the array literal does` — `[1, , 3]` → `'[1, , 3]'` (pinnt Bestand)

2. **Folgen von Paket 14 in `createTypedArray.ts` und `spriteDeclarations.ts`.**
   - `src/vertex-objects/createTypedArray.ts:39`: `'${dataType}'` → `${describeValue(dataType)}`;
     Meldung `typedArrayOf: this runtime has no Float16Array for data type "float16"`. Test
     `the module loads without Float16Array, and only float16 is refused` (`createTypedArray.spec.ts:59`)
     erwartet statt `/no Float16Array/` die volle Meldung — rot vor dem Fix.
   - `src/sprites/spriteDeclarations.ts:35`: `shown()` entfällt, `:60` und `:67` nehmen
     `describeValue(…)`. Erwartungen in `spriteDeclarations.spec.ts:54` (`{value: [1, 2], shared: true}`)
     und `:70` (`starting at [0, 1, 0] and at [0, 1, 1]`) zuerst ändern — rot vor dem Fix.

3. **`runCheckKind()` zeigt einen geworfenen Nicht-`Error` ohne `String()`**
   (`src/sprites/runCheckKind.ts:12`): `error instanceof Error ? error.message : typeof error === 'string' ? error : describeValue(error)`.
   Ein geworfener String ist die Meldung selbst und bleibt ohne Anführungszeichen — so pinnt es
   `a throw of something that is no Error is refused in its string form`
   (`defineSprite.spec.ts:441–452`), der unverändert grün bleibt. Neuer Test daneben:
   `a throw of a value that is neither an Error nor a string is refused with the value quoted` —
   `throw {code: 1}` → `'defineSprite: feature "picky": {code: 1}'`, `throw Object.create(null)` →
   `'defineSprite: feature "picky": {}'` (vor dem Fix `[object Object]` bzw. ein `TypeError` von
   `String()` statt der Meldung — rot). TSDoc von `runCheckKind()` um den Satz ergänzen: ein
   geworfener `Error` gibt seine Meldung, ein geworfener String ist die Meldung, jeder andere Wert
   steht, wie `describeValue()` ihn zeigt. In `docs/sprites.md` im Absatz zu `checkKind(kind)`
   (`:2022–2032`) hinter `` `defineSprite: feature "name": <message>` `` denselben Inhalt als
   Einschub: die Meldung eines geworfenen `Error`, ein geworfener String selbst, jeder andere
   geworfene Wert gequotet wie ein abgelehnter Wert (`{code: 1}`); Absatz auf ≤ 100 Zeichen umbrechen.

4. **`SpriteResources.ts:60`**: `filterName()` fällt auf `describeValue(filter)` zurück statt
   `String(filter)`. Test in `SpriteResources.spec.ts` neben den Warnungstests `:280`/`:297`: ein
   Filter, der kein Wert von three ist und keine Zahl (`magFilter = 'linear' as never`), steht in
   der Warnung als `magFilter "linear"` — rot vor dem Fix (`magFilter linear`).

5. **`SpritePicker.ts:477`**: die Ablehnung des Pointers schreibt
   `got ${typeof pointer !== 'object' || pointer === null ? describeValue(pointer) : `{x: ${describeValue(pointer.x)}, y: ${describeValue(pointer.y)}}`}`
   (bei Bedarf in eine lokale Konstante gezogen). `SpritePicker.spec.ts:218` (`got {x: NaN, y: 0}`)
   bleibt grün. Neue Fälle daneben, rot vor dem Fix: Pointer `{x: '0', y: 0}` → `got {x: "0", y: 0}`;
   Pointer `5` → `got 5` (vorher `got {x: undefined, y: undefined}`). Das Zitat in
   `docs/proposals/gpu-picking.md:256` bleibt gültig.

6. **Namen, die Symbole zulassen, in `src/texture/`** — überall `${describeValue(name)}` ohne
   eigene Anführungszeichen:
   - `TextureAtlas.ts:58` → `` `TextureAtlas: the frame name ${describeValue(args[0])} is already taken` ``;
     der Kommentar `:56–57` sagt stattdessen, warum `describeValue()`: ein Name kann ein Symbol sein,
     das eine Interpolation nicht schreibt, und es zeigt ihn unterscheidbar von einem String.
   - `selectAtlasFrames.ts:43` → `` `${where}: the atlas holds no frame ${describeValue(name)}` ``;
     Kommentar `:42` ebenso.
   - `FrameBasedAnimations.ts:565` und `:589` → `there is no animation named ${describeValue(…)}`.
   - `FrameBasedAnimations.ts:114`: `animNameInError = (name) => (name ? describeValue(name) : '(no name)')`;
     an allen 18 Aufrufen fallen die Backticks um `${animNameInError(name)}` weg
     (`for the animation "walk"`, `add() got the name "walk", which another animation already carries`,
     `for the animation (no name)`). Erwartungen in `FrameBasedAnimations.spec.ts`
     (`:87`, `:109`, `:119`, `:120`, `:134`, `:187`, `:1047`, `:1056`, `:1126`, `:1155`, `:1193`,
     `:1202`, `:1210`, `:1220`, `:1234`, `:1287`, `:1295`, `:1302`) und `TextureResource.spec.ts`
     (`:646`, `:649`, `:724`) mitziehen; die Tabelle in
     `docs/proposals/animation-playback-and-aseprite.md:109–116` schreibt `` for the animation "a" ``
     statt `` for the animation `a` ``.
   - `DynamicAtlas.ts:97`: `nameOf()` entfällt; die neun Aufrufe (`:292`, `:347`, `:504`, `:517`,
     `:535`, `:581`, `:644`, `:650`, `:660`) schreiben `${describeValue(name)}` ohne eigene
     Anführungszeichen, `:504` als `add(${describeValue(name)}) with a draw callback needs the size …`.
     `DynamicAtlas.spec.ts:509` erwartet `the frame name Symbol(label) is already taken` — zuerst
     ändern, rot vor dem Fix. Das Zitat `dynamic-atlas-and-bitmap-text.md:243` (`"hp"`) bleibt gültig.
   - Neue Symbol-Tests, rot vor dem Fix: `TextureAtlas.spec.ts` — ein doppelter Symbolname →
     `TextureAtlas: the frame name Symbol(bar) is already taken`; `FrameTable.spec.ts` neben `:78` —
     `FrameTable.fromAtlas(atlas, [Symbol('x')])` → `FrameTable: the atlas holds no frame Symbol(x)`;
     `FrameBasedAnimations.spec.ts` neben `:1369` — `animId(Symbol('nope'))` und
     `animation(Symbol('nope'))` → `FrameBasedAnimations: there is no animation named Symbol(nope)`,
     und ein `add()` mit einem Symbolnamen, der abgelehnt wird (z. B. doppelt) → die Meldung nennt `Symbol(…)`.

7. **`TextureStore.ts`: Aufrufnotation und URLs.**
   - Modulweit neu `const hrefOf = (url: string | URL): string => (typeof url === 'string' ? url : url.href);`
   - `:135` `loadFailedError`: `` `: "${hrefOf(what)}"` `` statt `String(what)` (Ausgabe unverändert).
   - `:600` → `` const what = `loadAsync(${describeValue(hrefOf(url))})`; `` (`loadAsync("http://…")`).
   - `:676` → `` `TextureStore: fetch(${describeValue(hrefOf(url))}) answered …` `` (Ausgabe unverändert).
   - `:1107` → `` `TextureStore: on(${describeValue(id)}, ${describeValue(type)}) is never called for "${id}": …` ``.
   - `:1267` → `` const what = `${method}(${describeValue(id)}, ${describeValue(type)})`; ``.
   - Erwartungen in `TextureStore.spec.ts` mitziehen, mindestens `:259`, `:309`, `:798`, `:809`
     (`loadAsync("…")`), `:1063`, `:1079` (`get("a", "texture")`), `:1195`, `:1210`, `:1212`
     (`acquireAsync("a", …)`), `:2546`, `:2571`, `:2591`, `:2708`, `:2821`, `:2834`, `:2927`,
     `:3221`, `:3340`, `:3533` (`getAsync("…", "…")`), `:2864` (`on("hero", "atlas") is never called for "hero"`)
     und jede weitere, die der Lauf zeigt. Rot vor dem Fix: `:2808` →
     `getAsync("hero", ["atlas", "texture"]) cannot resolve: …` und `:2847` →
     `getAsync("sheet", ["tileSet", "frameBasedAnimations"]) cannot resolve: …` (heute `atlas,texture`).
   - Nicht anfassen: `noResourceError` (`:121`), `resourceDisposedError` (`:128`), `:140`, `:152`,
     `:156`, `:159`, `:447`, `:453`, `:800–869` — Namen vom Typ `string` nach Regel 4.

8. **`src/stage/`.**
   - `StageRenderer.ts:820`, `:1065`, `:1308`, `:1314`: `${JSON.stringify(….name)}` → `"${….name}"`
     (Regel 4, `IStage.name` ist `string`); die Specs mit `"lost"` u. ä. bleiben grün.
   - `StageRenderOrder.ts:151`: `named "${name}" and renderOrder=${describeValue(this.#value)}`;
     Import von `describeValue` ergänzen. Den Text prüft heute keine Spec:
     `warns on duplicate name when renderOrder is non-default` (`StageRenderer.spec.ts:508–516`)
     zählt nur die Aufrufe. Dort zusätzlich die Meldung pinnen:
     `StageRenderer: 2 stages are named "a" and renderOrder="a,b" cannot tell them apart; …`
     (vor und nach dem Fix gleich).
   - `OrthographicProjection.ts:138` und `ParallaxProjection.ts:142`:
     `got ${(camera as {isObject3D?: unknown} | null | undefined)?.isObject3D === true ? camera.type : describeValue(camera)}`.
     Neue Tests in beiden Specs neben `:164`/`:205`: `{}` → `got {}`, `'cam'` → `got "cam"`,
     `{type: 'OrthographicCamera'}` (bzw. `'PerspectiveCamera'`) → `got {type: "…"}` — rot vor dem
     Fix; die falsche three-Kamera → `got PerspectiveCamera` bzw. `got OrthographicCamera` und
     `undefined` → `got undefined` pinnen Bestand. Das Zitat in `CHANGELOG.md:1472` steht in einem
     freigegebenen Abschnitt und bleibt.

9. **Vorbestehende Stellen gleicher Ursache** (in `6500527f` schon so, per `git show` geprüft):
   - `src/vertex-objects/VertexObjectDescriptor.ts:186`: `index ${index}` → `index ${describeValue(index)}`.
     Neuer Fall neben `VertexObjectDescriptor.spec.ts:285–294`: `indices: [0, '1', 2]` (Cast) →
     `index "1" at position 1` — rot vor dem Fix (`index 1`); die Erwartungen `index 4`, `-1`, `1.5` bleiben.
   - `src/controls/PanControl2D.ts:365`: `cursorPanStyle "${value}"` → `cursorPanStyle ${describeValue(value)}`.
     Neuer Test in `PanControl2D.spec.ts` mit `vi.stubGlobal('CSS', {supports: () => false})` (wie `:106`)
     und `console.warn`-Spy: `cursorPanStyle = 5 as never` → `PanControl2D: cursorPanStyle 5 is not a value …`
     — rot vor dem Fix (`"5"`); ein String bleibt `cursorPanStyle "grabby"`.
   - `src/display/Display.ts:1918`: `resize-to="${value}"` → `resize-to=${describeValue(value)}`.
     Kein roter Test möglich: `getAttribute()` antwortet immer einen String, die Ausgabe bleibt gleich.

10. **`AGENTS.md`** (Repo-Root), Abschnitt »Error and warning messages«, `:110–113`: den Satz ab
    »A refused value is quoted through« bis »array or a plain object by its content.« ersetzen
    durch (auf die Breite des Absatzes umbrochen, ≤ 89 Zeichen):

    > A refused value is quoted through `describeValue()` in `src/utils/`, never through
    > `String()`, `JSON.stringify()`, `toString()` or an interpolation, bare or in quotes of its
    > own: it writes a string in double quotes, a symbol as `Symbol(a)`, a BigInt as `1n`, and an
    > array or a plain object by its content, and it throws for no value. A name that may be a
    > symbol — of a frame, of an animation — and each argument of a call a message writes out
    > (`getAsync("hero", ["atlas", "texture"])`) go through it as well; a name typed as a string,
    > one that tells instances apart or one a look-up did not find, is quoted by hand
    > (`"${name}"`), which writes the same. A three.js object refused for its class is named by
    > its `type`.

11. **`CHANGELOG.md:120`** (`[Unreleased]` → `### Fixed`, Eintrag »every refusal of the library
    quotes the value it refuses the same way …«): ergänzen, ohne Rückblick — ein Name, der ein
    Symbol sein kann (eines Frames, einer Animation), steht als `Symbol(a)` und unterscheidbar von
    `"a"`, ein Animationsname in Anführungszeichen statt in Backticks; ein Aufruf, den eine Meldung
    von `TextureStore` nennt, steht mit seinen Argumenten wie geschrieben
    (`getAsync("hero", ["atlas", "texture"])`); ein Accessor eines Plain Objects oder Arrays steht als
    `[Getter]`/`[Setter]`/`[Getter/Setter]` und wird nicht aufgerufen; ein Wert, der beim Zeigen
    wirft, steht als `[object]`, sodass keine Meldung an ihm verloren geht. Kein Migration Guide:
    Meldungstexte sind keine API (wie in Paket 14).

12. Zum Schluss die Prüfung aus »Die Regel«: der `git grep` dort listet nur noch die genannten fünf
    Dateien (`PanControl2D.ts:64`, `Stylesheets.ts:1`, `StringDataChunk2D.ts:21`,
    `readBitmapFontSource.ts:44`, `describeValue.ts`). Ergebnis in den Report.

- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): quote every refused value, every name that may be a symbol and every argument of a call a message writes out the way describeValue() does — a frame or an animation named by a symbol as Symbol(a), a TextureStore call as getAsync("hero", ["atlas", "texture"]) —, show an accessor of a plain object or an array as [Getter] without calling it, and write a value that throws while it is shown as [object], so that no message is lost to the value it quotes`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · Folgen aus Paket 14 bestehen: `createTypedArray.ts:38` jetzt
    `:39`, `spriteDeclarations.ts:35` unverändert (Aufrufe `:60`, `:67`), `describeValue.ts:31`/`:33`
    unverändert, dazu weitere Wurfwege (`Array.isArray`/`getPrototypeOf`/`Object.keys` auf Proxy,
    `value.name`-Getter `:23`, `slice()` liest Index-Getter `:37`) · Queue-Einträge bestehen alle
    unverändert an ihren Fundstellen (`runCheckKind.ts:12`, `SpriteResources.ts:60`/`:188`,
    `TextureAtlas.ts:58`, `selectAtlasFrames.ts:43`, `FrameBasedAnimations.ts:114`/`:565`/`:589`,
    `DynamicAtlas.ts:97` mit 9 Aufrufen, `StageRenderer.ts:820`/`:1065`/`:1308`/`:1314`,
    `StageRenderOrder.ts:151`, `OrthographicProjection.ts:138`, `ParallaxProjection.ts:142`,
    `TextureStore.ts:135`/`:600`/`:676`/`:1107`/`:1267`, `SpritePicker.ts:477`) · neu aufgenommen,
    vorbestehend in `6500527f`: `VertexObjectDescriptor.ts:186`, `PanControl2D.ts:365`,
    `Display.ts:1918` · `runCheckKind` weicht vom Wortlaut des Queue-Eintrags ab (String bleibt
    ungequotet) · offene Folgen: die vier von Paket 16 (`extractSnippets.mjs:9`, `:27`, `:110`,
    `:186`, bestätigt) → Nachtragspaket 20, `Folge von: Paket 16` · Restplan: Reihenfolge
    19 · 20 · 17 · 18
  - 2026-10-22 Zug 1: Implementierer beauftragt, claude-sonnet-5-5, Effort medium, Report `paket-19.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG_MIT_VORBEHALT (große Dateien nur um die Änderungsstellen gelesen; Volltext `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad/paket-19.impl-0.report.md`) · 39 Dateien geändert, keine neu · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad/paket-19.verify.log`) · Grep aus Schritt 12 trifft nur die fünf erlaubten Dateien
  - 2026-10-22 Zug 3: Reviewer claude-sonnet-5-5/medium, Report `paket-19.review-0.json` · alle Schritte 1–11 behoben, kritisch 0, wichtig 0, klein 4 · Diff `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/cedc8d36-b4ab-44d5-99e0-ae0ffbada2ae/scratchpad/paket-19.diff`
  - 2026-10-22 Zug 4: keine Runde (nichts offen)
  - 2026-10-22 Zug 5: committet `dc46243e`, Verify aus Zug 2 (`paket-19.verify.log`, exit=0), seither keine Codeänderung

## Entscheidungen dieses Zug 0

- **Grenze der Regel (Regel 4).** Ein Name vom Typ `string`, von Hand gequotet, bleibt — auch ein
  nachgeschlagener, nicht gefundener. Grund: `"${name}"` schreibt für jeden String genau, was
  `describeValue()` schreibt; Paket 14 hat dieselbe Grenze gezogen (seine 18 Stellen sind Werte,
  keine Namen), und die rund 35 Namensstellen umzuschreiben änderte keine Ausgabe für einen
  typisierten Aufrufer. Die Regel in `AGENTS.md` sagt die Grenze jetzt ausdrücklich, damit ein
  späteres Audit sie nicht als Bruch liest.
- **Ein abgelehnter Wert vom Typ `string` geht trotzdem durch `describeValue()`** (Regel 1:
  `PanControl2D.ts:365`, `Display.ts:1918`), damit die Regel für Werte ohne Ausnahme gilt und sich
  per Grep prüfen lässt; für Strings bleibt die Ausgabe gleich.
- **Getter werden nicht aufgerufen**, sondern als `[Getter]`/`[Setter]`/`[Getter/Setter]` gezeigt —
  wie `node:util.inspect` es ohne Option tut. Grund: eine Meldung führt keinen Code des Aufrufers aus,
  der werfen oder Seiteneffekte haben kann; die Wache allein hielte die Meldung am Leben, zeigte
  aber bei einem werfenden Getter das ganze Objekt als `[object]`. Der Preis: der Wert eines
  harmlosen Getters fehlt in der Meldung.
- **`String()` bleibt der Weg für Klasseninstanzen** (Error, Date, RegExp, URL schreiben sich dort
  lesbar), unter der Wache. Eine Klasseninstanz nach Konstruktornamen zu zeigen (`Vector2 {…}`)
  wäre eine neue Form, die die Spec `shows anything else as String() does` bewusst nicht hat — nicht
  in diesem Paket.
- **Ersatztext `[object]` / `[Function]`.** `Object.prototype.toString.call()` wirft selbst für
  einen widerrufenen Proxy (`IsArray`), ein fester Text ist der einzige Weg, der nie wirft.
- **`runCheckKind()`**: der Queue-Eintrag hält den ungequoteten geworfenen String für den Fehler.
  Abweichung: ein geworfener String ist nach dem Vertrag von `checkKind` (`SpriteFeature.ts:176–183`,
  `docs/sprites.md:2022`: »throws … with a message«) die Meldung, kein abgelehnter Wert; der Test
  `a throw of something that is no Error is refused in its string form` pinnt das. Behoben wird
  der eigentliche Regelbruch: `String()` für alles andere, das bei einem Objekt ohne `toString()`
  sogar selbst wirft.
- **`StageRenderer`**: `JSON.stringify(stage.name)` → `"${stage.name}"` statt `describeValue()`,
  weil der Name die Stage unterscheidet (Regel 4) und `IStage.name` `string` ist; Ausgabe gleich
  bis auf `\`-Escapes, die `JSON.stringify()` schrieb und sonst keine Meldung der Bibliothek schreibt.
- **Kameras** (Regel 5): `camera.type` für ein three-Objekt (`isObject3D === true`) bleibt, weil
  `describeValue()` eine Instanz als `[object Object]` zeigte; `isObject3D` statt `instanceof`, wie
  `SpritePicker.ts:472` mit `isCamera` prüft.
- **`TextureStore`**: die Aufrufnotation schreibt ihre Argumente über `describeValue()`, weil
  `String(type)` ein Array als `atlas,texture` schrieb. Eine `URL` wird über `hrefOf()` zum String,
  bevor sie gequotet wird — `describeValue(url)` schriebe ihr `href` ohne Anführungszeichen.
- Kein CHANGELOG-Migration-Guide, kein `!` im Commit: Meldungstexte sind keine API.

## Punkte im Volltext

**Folge von Paket 14 · `packages/twopoint5d/src/vertex-objects/createTypedArray.ts:38`** — die
float16-Meldung zitiert `'${dataType}'` roh, zwei Zeilen unter der `describeValue()`-Meldung `:35`
(Wert immer `float16`, folgenlos).

**Folge von Paket 14 · `packages/twopoint5d/src/sprites/spriteDeclarations.ts:35`** — `shown()`
schreibt Startwerte per `JSON.stringify()` als `[1,2]`, `describeValue()` in derselben Datei `[1, 2]`.

**Folge von Paket 14 · `packages/twopoint5d/src/utils/describeValue.ts:31`** — `record[key]` ruft
Getter eines Plain Objects auf, ein werfender Getter ersetzt die Meldung durch seinen Fehler;
dieselbe Lücke hat `String(value)` (`:33`) für ein Objekt, dessen `toString()` wirft.

**Queue · `packages/twopoint5d/src/sprites/runCheckKind.ts:12`** — reicht einen geworfenen
Nicht-`Error` per `String(error)` in die Meldung; ein geworfener String erscheint ohne
Anführungszeichen, gegen die `describeValue()`-Regel in `AGENTS.md`; stand so schon in `6500527f`.

**Queue · `packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts:60`** — `filterName()`
fällt für einen unbekannten Filter auf `String(filter)` zurück, gezeigt in der Ablehnung `:188`;
für eine Zahl gleich `describeValue()`, aber am Regelweg vorbei; stand so schon in `6500527f`.

**Queue · `packages/twopoint5d/src/texture/TextureAtlas.ts:58`, `selectAtlasFrames.ts:43`,
`FrameBasedAnimations.ts:565`, `:589`** — Frame- und Animationsnamen in Ablehnungen als
`"${name.toString()}"` (eigener Weg für Symbole), ein Symbol erscheint in Anführungszeichen als
`"Symbol(a)"`; `describeValue()` zeigt beides richtig; stand so schon in `6500527f`.

**Queue · Kandidaten aus Zug 0 Paket 15** — `StageRenderer.ts:820`, `:1065`, `:1308`, `:1314`
(`JSON.stringify(stage.name)`), `StageRenderOrder.ts:151` (`JSON.stringify(name)`,
`JSON.stringify(this.#value)`), `OrthographicProjection.ts:138`, `ParallaxProjection.ts:142`
(`camera?.type ?? String(camera)`), `src/texture/TextureStore.ts:135`, `:600`, `:676`, `:1107`,
`:1267` (`String(what)`, `String(url)`, `String(type)`), `DynamicAtlas.ts:97` (`nameOf()` per
`toString()`), `FrameBasedAnimations.ts:114` (`animNameInError()` per `toString()`) — Namen und
Werte in Meldungen am `describeValue()`-Weg vorbei; ob die Regel jede trifft, entscheidet dieser
Zug 0 je Stelle (oben unter »Die Regel« und »Entscheidungen«).

**Queue · `packages/twopoint5d/src/sprites/SpritePicker.ts:477`** — `checkArguments()` interpoliert
den abgelehnten Pointer roh (`{x: ${pointer?.x}, y: ${pointer?.y}}`) statt über `describeValue()`;
stand so schon in `f9a6029e`.

**Neu, vorbestehend (`6500527f`) · `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:186`**
— der abgelehnte Index steht roh in der Meldung (`index ${index}`); ein String-Index `'1'` erscheint als `1`.

**Neu, vorbestehend (`6500527f`) · `packages/twopoint5d/src/controls/PanControl2D.ts:365`** — der
abgelehnte `cursorPanStyle` steht in eigenen Anführungszeichen (`"${value}"`).

**Neu, vorbestehend (`6500527f`) · `packages/twopoint5d/src/display/Display.ts:1918`** — der
abgelehnte Selektor von `resize-to` steht in eigenen Anführungszeichen (`"${value}"`).

## Urteil des Reviewers

| Schritt | Urteil | Fundstelle |
| --- | --- | --- |
| 1 `describeValue()` wirft nie, ruft keinen Getter | behoben | `src/utils/describeValue.ts:27–66` |
| 2 Folgen aus Paket 14 | behoben | `createTypedArray.ts:39`; `spriteDeclarations.ts:59`, `:66` |
| 3 `runCheckKind()` | behoben | `runCheckKind.ts:14–17`, `docs/sprites.md:2025–2033` |
| 4 `filterName()` | behoben | `SpriteResources.ts:61` |
| 5 Pointer in `SpritePicker` | behoben | `SpritePicker.ts:477–481` |
| 6 Symbolnamen in `src/texture/` | behoben | `TextureAtlas.ts:58`, `selectAtlasFrames.ts:45`, `FrameBasedAnimations.ts:114`/`:565`/`:589`, `DynamicAtlas.ts` (`nameOf()` und neun Aufrufe) |
| 7 `TextureStore` | behoben | `hrefOf` `:130`, `:136`, `:602`, `:678`, `:1109`, `:1269` |
| 8 `src/stage/` | behoben | vier Stellen `StageRenderer.ts`, `StageRenderOrder.ts:152`, beide Projektionen |
| 9 vorbestehende Stellen | behoben | `VertexObjectDescriptor.ts:186`, `PanControl2D.ts:366`, `Display.ts:1919` |
| 10 `AGENTS.md` | behoben | `AGENTS.md:110–119` |
| 11 `CHANGELOG.md` | behoben | `CHANGELOG.md:120` |

Kleine Befunde (lösen keine Runde aus):

- `AGENTS.md:117` — der Absatz endet mitten im Punkt mit einer kurzen Zeile (54 Zeichen), der Rest des Punkts ist nicht neu umbrochen; Breite ≤ 89 hält.
- `packages/twopoint5d/src/sprites/runCheckKind.ts:15` — dreifach verschachtelte Ternary-Kette inline im Template-String, eine lokale Konstante wäre lesbarer.
- `packages/twopoint5d/src/texture/TextureAtlas.spec.ts` (neuer Symbol-Test) — `atlas.add(…) && atlas.add(…)` im `expect` verlässt sich darauf, dass `add()` truthy antwortet; der erste Aufruf gehört vor das `expect`.
- `packages/twopoint5d/src/sprites/SpritePicker.ts:480` — `describeValue(pointer.x)` liest `pointer.x` ein zweites Mal; ein werfender Getter am Pointer verlöre die Meldung schon bei `Number.isFinite(pointer?.x)`.
