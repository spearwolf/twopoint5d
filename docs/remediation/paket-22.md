# Paket 22 — Drain: Meldungen von checkFeature und Startwerte der Sprite-Uniforms

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — 1 Nebenbefund aus »Offene Befunde« (low, `→ Scope`):
  `SpriteResources` misst Startwerte aus `options.uniforms` nur an ihrer Länge; 1 Folge von
  Paket 10 (low): Abweisungen von `checkFeature()` ohne den abgewiesenen Wert
- Folge von: Paket 10 (gefunden in Paket 21)
- Ziel: Jede Abweisung von `checkFeature()` zitiert den abgewiesenen Wert, und `SpriteResources`
  weist Startwerte von Uniforms ab, die keine endlichen Zahlen sind.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/sprites/checkFeature.ts` samt `SpriteFeature.spec.ts` (dort steht die
    Tabelle der Abweisungen) und `defineSprite.spec.ts`
  - `packages/twopoint5d/src/sprites/passes/passFeatures.ts` (nur `checkPass()`) samt
    `passes/definePass.spec.ts`
  - `packages/twopoint5d/src/sprites/spriteDeclarations.ts` (nur ein Export und seine TSDoc)
  - `packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts` samt `SpriteResources.spec.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.spec.ts`,
    `FeatureSpritesMaterial.spec.ts` (Erwartungen nachziehen, ein neuer Fall)
  - nur TSDoc: `src/sprites/SpriteFeature.ts` (`SpriteUniformValue` Z. 101, `defineFeature()`
    Z. 202), `src/sprites/passes/definePass.ts` (Z. 44–47),
    `src/sprites/FeatureSprites/FeatureSpritesMaterial.ts` (Option `uniforms` Z. 40)
  - `packages/twopoint5d/docs/sprites.md`, Proposals `docs/proposals/sprite-features.md`,
    `docs/proposals/pipeline-stages-and-grid-base.md`, `docs/proposals/sprite-uniform-bindings.md`
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`, kein **BREAKING**)
- Dazu (Zug 0), je mit Grund — dieselbe Ursache wie ein Eintrag dieses Pakets:
  1. **Alle Abweisungen von `checkFeature()` ohne Wert**, nicht nur die zwei aus der Folge
     (Z. 91 `nearestTextures`, Z. 117 `requires`): auch Z. 27 (Name), Z. 64 (Methode), Z. 68
     (`initialize`), Z. 96 (`frame`/`placement`/`colorSource`), Z. 113 (`transform` einer Stage),
     Z. 121 (`checkKind`). Das Ziel im Plan sagt »jede Abweisung«; die übrigen Meldungen derselben
     Funktion zitieren den Wert schon (Z. 24, 34, 40, 48, 54, 61, 73, 79, 85, 104, 109).
  2. **`checkPass()`** (`passes/passFeatures.ts`) Z. 45 (Name des Passes), Z. 47 (`visible`),
     Z. 101 (Ziel einer Umbenennung, das kein String ist): die Formprüfung des Passes ist das
     Gegenstück zu `checkFeature()`, ruft es für jedes Feature des Passes auf und läuft an denselben
     Eintrittsstellen (`definePass()`, `new FeatureSprites({passes})`); ihre übrigen Meldungen
     zitieren den Wert seit Paket 20 (Z. 42, 51, 73, 83, 88). Am Laufbeginn schon so (`git show
     7341059f:…/passFeatures.ts` Z. 25, 27, 59) — vorbestehend, gleiche Ursache.
  3. **Startwert `null`** in `options.uniforms`: wirft heute roh (`sizeOfValue(null)` liest
     `null.length`, `SpriteResources.ts:68/157`), ohne Subjekt — dieselbe Schleife, dieselbe Ursache
     (der Startwert wird nur an seiner Länge gemessen). Am Laufbeginn schon so.
  4. **»finite« in der Doku der Startwerte**: TSDoc von `SpriteUniformValue`
     (`SpriteFeature.ts:101`) und Guide `docs/sprites.md:2029` sagen »a number«, »2 to 4 numbers«;
     die Deklarationen verlangen endliche Zahlen (`spriteDeclarations.ts:15–20`), und die Startwerte
     der Optionen folgen jetzt derselben Regel.
- Nicht aufgenommen, mit Grund:
  - `setUniform()` (`SpriteResources.ts:269`) prüft seine Zahlen nicht: der Schreibweg je Frame
    (»allocates nothing — call it every frame«), typisiert `number` wie die Setter der Sprite-Handles,
    die ebenfalls nicht prüfen; seine Abweisung (`#shapeError`, Z. 240–244) betrifft die Zahl der
    Argumente, nicht einen Wert. Er behält seine Meldung `… is a vec3 and takes 3 values`.
  - Abweisungen anderer Eintrittsstellen der Sprite-Schicht ohne Wert (`SpritePicker.ts:476`,
    `:488`, `:492`, `typedNodes.ts:16`, `GridBase.ts:100`, `FeatureSprites.ts:631`): andere
    Aufrufe, nicht die Formprüfung von Feature und Pass → Nebenbefund in »Offene Befunde«,
    `→ Audit` nach der Entscheidung vom 2026-10-24 zur Drain-Runde 3.
- Vorgehen (Specs zuerst und rot sehen, dann der Code — Schritt 6 vor 1–5):
  1. **`checkFeature()`** (`src/sprites/checkFeature.ts`) — jede Meldung ohne Wert bekommt
     `, got ${describeValue(…)}` am Ende, Wortlaut sonst unverändert:
     - Z. 27: `` `${where}: a feature needs a name, got ${describeValue(name)}` ``
     - Z. 64: `` `${where}: the method "${key}" of feature "${name}" is no function, got ${describeValue(value)}` ``
     - Z. 68: `` `${where}: the initialize of feature "${name}" is no function, got ${describeValue(initialize)}` ``
     - Z. 91: `` `${where}: the nearestTextures of feature "${name}" is no list of texture names, got ${describeValue(nearestTextures)}` ``
     - Z. 96: `` `${where}: the ${slot} of feature "${name}" is no function, got ${describeValue(value)}` ``
     - Z. 113: `` `${where}: the ${slot} stage of feature "${name}" needs a transform function, got ${describeValue(stage['transform'])}` ``
     - Z. 117: `` `${where}: the requires of feature "${name}" is no list of feature names, got ${describeValue(requires)}` ``
     - Z. 121: `` `${where}: the checkKind of feature "${name}" is no function, got ${describeValue(checkKind)}` ``
     - Z. 118 (`requires itself`) bleibt: die Meldung nennt den abgewiesenen Eintrag schon.
     - TSDoc Z. 20: `@throws a \`TypeError\` naming the feature and the field and quoting the
       value it refuses`.
  2. **`checkPass()`** (`src/sprites/passes/passFeatures.ts`), ebenso:
     - Z. 45: `` `${where}: a pass needs a name, got ${describeValue(name)}` ``
     - Z. 47: `` `${where}: the visible of pass "${name}" is no function, got ${describeValue(visible)}` ``
     - Z. 101: `` `${where}: pass "${name}" renames the uniform "${uniform}" to a name that is not a string, got ${describeValue(target)}` ``
     - TSDoc Z. 37: `@throws a \`TypeError\` naming the pass and the field and quoting the value
       it refuses, a \`RangeError\` …` (Rest unverändert).
  3. **`isUniformValue`** in `src/sprites/spriteDeclarations.ts` (Z. 15) exportieren, unverändert,
     mit TSDoc: `Whether \`value\` is a start value of a uniform: a finite number, or a list of 2 to
     4 finite numbers. @internal`. `spriteDeclarations.ts` steht in keiner `public-api.ts`; so bleibt
     es.
  4. **`SpriteResources`** (`src/sprites/FeatureSprites/SpriteResources.ts`):
     - Import Z. 28: `import {collectSpriteDeclarations, isUniformValue} from '../spriteDeclarations.js';`
     - Schleife Z. 154–159:
       ```ts
       for (const [name, value] of Object.entries(options.uniforms ?? {})) {
         // undefined and null keep the start value the feature declares
         if (value == null) continue;
         const size = this.#assertUniform(name);
         // the rule of a declared start value: a string or a list of anything but finite numbers
         // has a length as well, and would reach the vector as it is
         if (!isUniformValue(value) || sizeOfValue(value) !== size) {
           throw new TypeError(
             `${where}: the uniform "${name}" is a ${VECTOR_TYPES[size - 1]} and takes ${size === 1 ? 'a finite number' : `${size} finite numbers`} as its start value, got ${describeValue(value)}`,
           );
         }
         this.setUniform(name, ...((typeof value === 'number' ? [value] : value) as [number, number?, number?, number?]));
       }
       ```
       Reihenfolge wie bisher: erst der Name (`Error`, »no feature declares the uniform«), dann
       der Wert (`TypeError`). Der Kommentar darf umformuliert werden, das *Warum* bleibt.
       `#shapeError` bleibt für `setUniform()`.
     - TSDoc `SpriteResourcesOptions.uniforms` (Z. 40): `Start values that replace the declared
       ones, by declared name, each of the type of its uniform: a finite number for a \`float\`, a
       list of 2 to 4 finite numbers for a \`vec2\` to \`vec4\`. \`undefined\` or \`null\` keeps the
       declared one.`
     - TSDoc Konstruktor Z. 120–124: »for a start value of another shape than its uniform« ersetzen
       durch »for a start value in `options.uniforms` that is not of the type of its uniform — a
       finite number for a `float`, 2 to 4 finite numbers for a `vec2` to `vec4` —«.
  5. **TSDoc und Doku** (nur Prosa, im Stil der Datei, ohne Vorgeschichte, auf die Spaltenbreite der
     Datei umbrechen):
     - `SpriteFeature.ts:101` `SpriteUniformValue`: `The start value of a uniform: a finite number
       is a \`float\`, 2 to 4 finite numbers a \`vec2\` to \`vec4\`.`
     - `SpriteFeature.ts:202` (`defineFeature()`): `@throws a \`TypeError\` naming the feature and
       the field and quoting the value it refuses`.
     - `definePass.ts:44–47`: hinter die Aufzählung der Abweisungen », each quoting the value it
       refuses« (vor `a RangeError`).
     - `FeatureSpritesMaterial.ts:40` (Option `uniforms`): `Start values of uniforms, by the names
       the features declare, each of the type of its uniform — see
       {@link SpriteResourcesOptions.uniforms}.` (Import nur, wenn der Link ihn braucht und der Lint
       es verlangt; sonst den Satz ohne `@link` mit `` `SpriteResourcesOptions` ``.)
     - `docs/sprites.md` Z. 1082–1084 (Material): »… `resources` as a `SpriteResources` and
       `textures` and `uniforms` as objects by name, each start value of the type of its uniform —
       a finite number for a `float`, 2 to 4 finite numbers for a `vec2` to `vec4`; anything else
       throws a `TypeError`. A start value of `undefined` or `null` keeps the one the feature
       declares.«
     - `docs/sprites.md` Z. 2029–2030: »a finite number for a `float`, 2 to 4 finite numbers for a
       `vec2` to `vec4`«.
     - `docs/sprites.md` Z. 2077–2079: »is refused with a `TypeError` naming the feature and the
       field and quoting the value«.
     - `docs/proposals/sprite-features.md` Z. 280–281: »with a `TypeError` naming the feature, the
       field and the value«; Z. 778ff. (`definePass()`), in der Klammer `(TypeError, …)` am Ende des
       Satzes: »each quoting the value it refuses«; Z. 631–633 (`SpriteResources`) anhängen: »… and
       a start value in `uniforms` that is not of the type of its uniform — a finite number or 2 to
       4 of them, the rule of the declared start values; `null` keeps the declared one, as
       `undefined` does«.
     - `docs/proposals/pipeline-stages-and-grid-base.md` Z. 316–317: `(defineFeature: the checkKind
       of feature "x" is no function, got "grid")`.
     - `docs/proposals/sprite-uniform-bindings.md` Z. 274–275: `(definePass: the visible of pass "…"
       is no function, got …)`.
     - `docs/superpowers/plans/` bleibt unangetastet (Arbeitsplan von damals).
  6. **Specs — zuerst schreiben und rot sehen**, Ausgabe des roten Laufs in den Report:
     - `src/sprites/SpriteFeature.spec.ts`, Tabelle `malformedFeatures` (Z. 7–88): die Zeilen ohne
       Wert bekommen ihn — Methode `got 1`, `initialize` `got true`, `frame` `got {}`, `placement`
       `got 5`, `colorSource` `got 5`, Stage ohne `transform` `got undefined`, `requires`
       `got "abc"`; neue Zeilen `a name that is no string` (`{name: 5}` → `${where}: a feature needs
       a name, got 5`), `a checkKind that is no function` (`{name: 'odd', checkKind: 'grid'}` →
       `got "grid"`), `nearestTextures that is no list` (`{name: 'odd', nearestTextures: 'colorMap'}`
       → `got "colorMap"`). Der Tabellentest (Z. 131–134) prüft die Meldung ganz:
       `toThrow(new TypeError(message))` statt des Teilstrings, neben `toThrow(TypeError)`.
       Einzeltests nachziehen: Z. 99–101 (`{name: ''}` → `…, got ""`), Z. 117–121
       (`…, got "grid"`), Z. 123–129 (`test.each` der `nearestTextures`: je `…, got
       ${describeValue(nearestTextures)}` — `"colorMap"`, `["colorMap", 3]`, `{colorMap: true}`),
       Z. 135–142 (`…needs a transform function, got undefined`).
     - `src/sprites/defineSprite.spec.ts` Z. 365–374: `…is no function, got 1` und `…, got 5`.
     - `src/sprites/passes/definePass.spec.ts`: Z. 48 `definePass: a pass needs a name, got ""`,
       Z. 88–95 `…the visible of pass "p" is no function, got true`, Z. 202–204 `…to a name that is
       not a string, got 7`.
     - `src/sprites/FeatureSprites/FeatureSprites.spec.ts` Z. 219, 321, 465, 468 und
       `FeatureSpritesMaterial.spec.ts` Z. 431 vergleichen die Meldung ganz
       (`new TypeError(…)`): `…the placement of feature "odd" is no function, got 5`. Ohne das
       werden sie mit dem Fix rot.
     - `src/sprites/FeatureSprites/SpriteResources.spec.ts`:
       - Z. 66–72, der Konstruktor-Teil: `SpriteResources: the uniform "time" is a float and takes
         a finite number as its start value, got [1, 2]` (der `setUniform()`-Teil bleibt
         `…takes 1 value`).
       - Z. 93–97: `SpriteResources: the uniform "light" is a vec3 and takes 3 finite numbers as its
         start value, got [1, 2]`.
       - neu `test.each('refuses the start value %s of the uniform %s, quoting it, and builds
         nothing')` mit dem Feature `shaped` aus Z. 53 (`offset` vec2, `tint` vec4) und `anim`
         (`time` float, `light` vec3): `offset: 'ab'` → `got "ab"`, `offset: [Number.NaN, 0]` →
         `got [NaN, 0]`, `offset: [1, 'x']` → `got [1, "x"]`, `time: Number.NaN` → `got NaN`,
         `time: Number.POSITIVE_INFINITY` → `got Infinity`, `time: '1'` → `got "1"`, `light: new
         Float32Array([1, 2, 3])` → `got Float32Array [1, 2, 3]`, `tint: {x: 1}` → `got {x: 1}` —
         je `toThrow(new TypeError(…))` mit der vollen Meldung aus Schritt 4 und
         `getSignalsCount()`/`getEffectsCount()` vorher gleich nachher.
       - neu `a start value of null keeps the declared one`: `new SpriteResources([anim],
         {uniforms: {time: null as never}})` → `uniforms['time'].value` ist `0`.
       Vor dem Fix rot: `'ab'`, `[NaN, 0]`, `[1, 'x']`, `NaN`, `Infinity`, `'1'` und der
       `Float32Array` bauen still, `null` wirft roh.
     - `FeatureSpritesMaterial.spec.ts`, im `describe('uniforms')` hinter dem Test Z. 717–730, mit
       derselben Art (`defineFeature({name: 'timed', uniforms: {time: 0}})`, `defineSprite({base:
       QuadBase, features: [InstancePosition, FlatPlacement, timed]})`): `new
       FeatureSpritesMaterial(kind, {uniforms: {time: Number.NaN}})` → `new
       TypeError('FeatureSpritesMaterial: the uniform "time" is a float and takes a finite number as
       its start value, got NaN')` — das Subjekt kommt über `where` aus dem Material.
  7. **CHANGELOG** `## [Unreleased]`:
     - `### Changed` Z. 136 (`defineFeature()` checks every field …): »with a `TypeError` naming
       the feature and the field« → »with a `TypeError` naming the feature and the field and
       quoting the value«.
     - `### Changed` Z. 71 (`definePass()` — and every place that takes a pass —): »with a
       `TypeError` that names the pass and the field« → »with a `TypeError` that names the pass and
       the field and quotes the value«.
     - `### Fixed`, neuer Eintrag am Ende der Liste (vor `### Migration Guide`, Z. 223): »`new
       SpriteResources()` — and with it the `uniforms` of `new FeatureSpritesMaterial()` and `new
       FeatureSprites()` — refuses a start value that is not of the type of its uniform with a
       `TypeError` that names the uniform and quotes the value, before any signal is built: a
       finite number for a `float`, a list of 2 to 4 finite numbers for a `vec2` to `vec4`, the
       rule the start values a feature declares follow. A start value of `null` keeps the declared
       one, as `undefined` does«.
     - Kein **BREAKING**, kein Migration-Guide-Eintrag (Grund unten).
  8. `pnpm lint` muss grün sein: nach den Änderungen `pnpm format` (schreibt nur die
     Formatierung) oder von Hand auf die Spaltenbreite umbrechen.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): quote the refused value in every refusal of the checks of a sprite feature and of a pass, refuse a start value of a sprite uniform that is not a finite number or a list of finite numbers of the type of its uniform, and let a start value of null keep the declared one`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · Folge `checkFeature.ts:91`/`:117` unverändert; dazu
    Z. 27, 64, 68, 96, 113, 121 ohne Wert (Name, `checkKind`, `nearestTextures` standen am
    Laufbeginn in `SpriteFeature.ts` Z. 203/214/220, Paket 10 hat sie nach `checkFeature.ts`
    gezogen und die übrigen dazugeschrieben — Folge und vorbestehend gemischt, eine Ursache) ·
    Nebenbefund `SpriteResources.ts:157` unverändert (Schleife Z. 154–159) · Dazu 1–4 aufgenommen ·
    1 neuer Nebenbefund (Abweisungen ohne Wert in `SpritePicker`, `typedNodes`, `gridBase()`,
    `bindUniform()`) → »Offene Befunde«, `→ Audit` · Restplan unverändert, kein weiteres Paket offen
  - 2026-10-24 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet, effort medium), Report `paket-22.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG · 18 Dateien geändert (4 Code, 3 TSDoc, 6 Specs, 4 Doku, CHANGELOG) · roter Lauf: `SpriteFeature.spec.ts` 16, `SpriteResources.spec.ts` 11, `defineSprite.spec.ts` 2 · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-22.verify.log`)
  - 2026-10-24 Zug 3: Reviewer beauftragt, mittlere Stufe (sonnet, effort medium), Diff `paket-22.diff`, Report `paket-22.review-0.json`
  - 2026-10-24 Zug 3: Urteil Freigabe — beide Einträge und »Dazu« 1–4 behoben, kein kritischer oder wichtiger Befund, 3 klein · Diff `paket-22.diff`
  - 2026-10-24 Zug 4: keine Runde (0 Runden)
  - 2026-10-24 Zug 5: Commit 73af32b4 auf `main`, Verify `paket-22.verify.log` exit=0 · Plan auf `[x]` · 1 Nebenbefund aus dem Review → »Offene Befunde«, `→ Audit`

## Urteil des Reviewers (review-0)

- Folge von Paket 10, `checkFeature.ts` ohne Wert: behoben — `nearestTextures` `checkFeature.ts:95`, `requires` `:126`, TSDoc `:20`.
- Nebenbefund, Startwerte nur an der Länge gemessen: behoben — `SpriteResources.ts:~156–166` (erst Name, `Error`; dann `isUniformValue(value) && sizeOfValue(value) === size`, `TypeError`), vor jedem Signal (Spec mit Signal- und Effect-Zähler).
- Dazu 1 (alle Abweisungen von `checkFeature()`): behoben — `checkFeature.ts:28`, `:~66`, `:~71`, `:95`, `:~104`, `:119`, `:126`, `:~134`; Tabellentest prüft die ganze Meldung.
- Dazu 2 (`checkPass()`): behoben — `passFeatures.ts:45`, `:~47`, `:~101`; `definePass.spec.ts` auf `got ""`, `got true`, `got 7`.
- Dazu 3 (Startwert `null`): behoben — `SpriteResources.ts:~156` (`value == null` → `continue`), Spec »a start value of null keeps the declared one«.
- Dazu 4 (»finite« in der Doku): behoben — `SpriteFeature.ts:101`, `docs/sprites.md` Z. ~1082 und ~2029, `SpriteResourcesOptions.uniforms`, `FeatureSpritesMaterial.ts:40` (ohne `@link`, wie die Paketdatei erlaubt).

Kleine Befunde:
- `passes/passFeatures.ts:37` — die `@throws`-Zeile ist mit etwa 135 Zeichen länger als `lineWidth` 130, Lint merkt es nicht.
- `docs/proposals/sprite-features.md` (Absatz `defineFeature()` und `SpriteResources`) und `docs/sprites.md` Z. ~2077–2082 — unregelmäßige Umbrüche nach den Zusätzen (eine Kurzzeile, eine überlange).
- `spriteDeclarations.ts:102` — die Abweisung eines deklarierten Startwerts sagt »a number, 2 to 4 numbers« ohne »finite«; vorbestehend (`git show 7341059f:` Z. 101), nicht im Plan → »Offene Befunde«, `→ Audit` nach der Entscheidung vom 2026-10-24 zur Drain-Runde 3.

## Findings im Volltext

**Folge von Paket 10 · low · `packages/twopoint5d/src/sprites/checkFeature.ts:91`
(`nearestTextures`) und `:117` (`requires`)** — die Meldungen zitieren den abgewiesenen Wert nicht
(`got ${describeValue(…)}` fehlt, gegen die Fehlermeldungsregel in AGENTS.md); die Datei entstand
in diesem Lauf (Paket 10, 7b08fe55), also Folge von Paket 10, nicht vorbestehend · low → Paket 22
(Drain-Runde 3)

**Nebenbefund · low · `packages/twopoint5d/src/sprites/FeatureSprites/SpriteResources.ts:157`**
(Startwerte aus `options.uniforms`) — ein Startwert wird nur an seiner Länge gemessen: für eine
`vec2`-Uniform geht der String `'ab'` durch und `setUniform(name, 'a', 'b')` schreibt Strings in den
`Vector2`, ebenso ein Array mit Nicht-Zahlen (`[NaN, 'x']`); am Laufbeginn schon so (`git show
7341059f:…SpriteResources.ts`, Z. 123) · Paket 21 · `→ Scope` · in Paket 22 aufgenommen
(Drain-Runde 3)

## Entscheidungen dieses Zugs 0, mit Grund

- **Eine Regel für deklarierte und übergebene Startwerte.** `isUniformValue()` aus
  `spriteDeclarations.ts` prüft schon jeden Startwert, den ein Feature deklariert (endliche Zahl
  oder 2–4 endliche Zahlen, nur echte Arrays). Die Startwerte der Optionen ersetzen genau diese
  Werte; zwei Regeln für denselben Wert wären ein neuer Widerspruch. Deshalb wird auch ein
  `Float32Array` abgewiesen — wie in der Deklaration, und außerhalb von `SpriteUniformValue`.
- **`TypeError`, nicht `RangeError`, auch für `NaN`.** Die Deklaration weist `NaN` mit `TypeError`
  ab (`spriteDeclarations.ts:100`), die bestehende Formabweisung der Startwerte ist ein
  `TypeError`; ein Wert, der als Ganzes nicht passt — falsche Länge, ein String, ein `NaN` darin —,
  bekommt eine Klasse, damit ein Aufrufer nicht zwei fangen muss. `assertFinite()` passt nicht: es
  prüft ein Zahlenfeld, kein Tupel.
- **`null` als Startwert heißt »nicht übergeben«**, wie `undefined`: die Konvention der Bibliothek
  für Felder (`checkFeature()` Z. 28, `checkPass()`, `baseArgs`/`attributeUsage` aus Paket 21).
  Heute wirft `null` roh — darauf baut niemand.
- **Kein BREAKING**: ein `NaN` oder `Infinity` als Startwert lässt den Shader `NaN` lesen, das ist
  kein Gebrauch, den jemand braucht; Strings, Listen aus Nicht-Zahlen und Typed Arrays liegen
  außerhalb von `SpriteUniformValue`. Vorbild sind die `NaN`-Abweisungen in `### Fixed` ohne
  **BREAKING** (`Map2D`, `PanControl2D`, `computeVisibleTiles()`); die Meldungstexte von
  `checkFeature()` sind in diesem Zyklus neu (Paket 10) und ändern nur ihr Ende.
- **Meldungstext**: `the uniform "x" is a vec2 and takes 2 finite numbers as its start value, got
  …` statt eines angehängten `got` an `takes 2 values` — die alte Meldung sagt nicht, dass die
  Werte endliche Zahlen sein müssen, und genau das ist die neue Abweisung.
- **`checkPass()` kommt mit**, die übrigen Eintrittsstellen der Sprite-Schicht nicht: Feature- und
  Pass-Prüfung sind eine Einheit (eine ruft die andere, beide laufen in `definePass()` und
  `new FeatureSprites()`), `SpritePicker`, `typedNodes`, `gridBase()` und `bindUniform()` sind
  andere Aufrufe mit anderer Ursache ihres Fehlens.
- Modell mittlere Stufe, Effort `medium`: drei kleine Codestellen, die Meldungen und Stellen stehen
  hier wörtlich; die Arbeit liegt in acht Specs und ein paar Sätzen Prosa im Stil des Repos.
