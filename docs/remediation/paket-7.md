# Paket 7 — Nachtrag zu Paket 1: Meldungen von `FrameBasedAnimations#add()` aus einer Prüfstelle, letzter Resource-Test aus der Store-Spec

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Symptom einer Folge von Paket 1, triagiert in Zug 0 von Paket 2) · dazu aus »Offene Befunde« zwei Einträge gleicher Ursache (siehe »Abgleich«)
- Folge von: Paket 1
- Ziel: Ein Animationseintrag einer `TextureResource` ohne `duration` und ohne `frameRate` wird mit derselben Meldung übersprungen, die `FrameBasedAnimations#add()` für diesen Fall wirft — mit Präfix und Animationsnamen, aus einer Prüfstelle statt zweien; die beiden übrigen Ablehnungen von `add()` folgen demselben Format, und der letzte reine `TextureResource`-Test verlässt die Store-Spec.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/texture/TextureResource.ts`
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`
  - `packages/twopoint5d/src/texture/TextureResource.spec.ts`
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts`
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`

## Vorgehen

Die Reihenfolge ist Pflicht: erst die Tests in Schritt 1 schreiben und rot
laufen sehen (`pnpm nx test twopoint5d -- src/texture/TextureResource.spec.ts src/texture/FrameBasedAnimations.spec.ts`),
den roten Lauf in den Report, dann die Schritte 2 bis 5.

1. **Regressionstests (vor dem Fix rot).**
   1. `TextureResource.spec.ts`, `describe('frame based animations')`, der Test
      `'an animation entry without a duration and without a frameRate is skipped and reported'`
      (heute ab Zeile 487):
      - umbenennen in
        `'an animation entry without a duration and without a frameRate is skipped and reported with the error FrameBasedAnimations#add() throws for it'`;
      - die Animationsdaten um einen zweiten Eintrag der Form `firstTileId`
        erweitern, damit beide `add()`-Aufrufe des Tile-Set-Effekts gedeckt
        sind:
        `{walk: {tileIds: [1, 2]}, run: {firstTileId: 1, tileCount: 2}, idle: {duration: 1, tileIds: [3, 4]}}`
        (der Cast `as unknown as FrameBasedAnimationsDataMap` bleibt);
      - erwartet: `errors` hat Länge 2; je Eintrag `source` `'frameBasedAnimations'`,
        `id` `'tiles'`; die Animationen `'walk'` und `'run'` (Reihenfolge wie
        `Object.entries`: erst `walk`, dann `run`); die Meldungen exakt
        ``FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation `walk` ``
        und ``… for the animation `run` `` (ohne Leerzeichen vor dem schließenden
        Backtick — der Wortlaut ist der aus `FrameBasedAnimations.ts:89-91`);
      - `resource.frameBasedAnimations!.animId('idle')` bleibt `0`.
   2. `TextureResource.spec.ts`, der Test
      `'an atlas animation entry whose timing does not carry is skipped and reported'`
      (heute ab Zeile 547): umbenennen in
      `'an atlas animation entry whose timing does not carry is skipped and reported with the error FrameBasedAnimations#add() throws for it'`
      und zusätzlich
      `expect(errors[0]!.error.message).toBe('FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation `walk`')`
      — im Code als Template- oder String-Literal mit den Backticks um `walk`.
   3. `FrameBasedAnimations.spec.ts`, Test `'throw error on duplicate name'`
      (heute Zeile 156-164): umbenennen in `'a name that another animation already carries is refused with the name'`
      und die Erwartung auf den vollen neuen Wortlaut aus Schritt 3.1 stellen:
      ``FrameBasedAnimations: add() got the name `walk`, which another animation already carries — an animation name must be unique``.
   4. `FrameBasedAnimations.spec.ts`, neuer Test direkt dahinter im selben
      `describe`:
      `'a third argument that is no TextureAtlas, no TileSet and no array is refused with the value and the animation'` —
      `new FrameBasedAnimations().add('odd', 1, 5 as never)` wirft exakt
      ``FrameBasedAnimations: add() got a third argument of 5 for the animation `odd` — the third argument is a TextureAtlas, a TileSet or an array of frames``;
      danach `animations.hasAnimation('odd')` ist `false`.

2. **`TextureResource.ts` — eine Prüfstelle für das Timing.**
   1. `getTimingOptions()` samt TSDoc löschen (heute Zeilen 25-38).
   2. Im Tile-Set-Animations-Effekt (heute ab Zeile 796) die Zeile
      `const timing = getTimingOptions(data);` streichen und den Eintrag selbst
      als Timing übergeben:
      `animations.add(name, data, tileSet, data.tileIds);` bzw.
      `animations.add(name, data, tileSet, data.firstTileId, data.tileCount);`.
      Über dem `if ('tileIds' in data)` dieser Kommentar (zwei Zeilen, Stil der
      Nachbarkommentare):
      `// the entry goes in as the timing: add() reads its duration or frameRate, and it is the one`
      `// place that refuses an entry carrying neither, with the name of the animation`
   3. Im Atlas-Animations-Effekt (heute ab Zeile 1006) genauso:
      `animations.add(name, data, atlas, data.frameNameQuery);`, mit demselben
      Kommentar darüber. Die Datei wiederholt ihre Kommentare je Effekt (siehe
      die beiden gleichlautenden `catch`-Kommentare »One bad entry skips
      itself …«); ein Verweis von einem Effekt auf den anderen überlebt die
      Zerlegung in Paket 5 nicht.
   4. Die jetzt unbenutzten Imports entfernen: `type AnimationTimingOptions`
      aus Zeile 7 (`FrameBasedAnimations` bleibt) und `FrameBasedAnimationsData`
      aus Zeile 23 (`FrameBasedAnimationsDataMap` bleibt).
   5. Die TSDoc von `TextureResourceEvents` (Zeilen 99-104) bleibt inhaltlich
      richtig; nichts ändern.
   - Verhalten bleibt gleich: `resolveDuration()` (`FrameBasedAnimations.ts:76-92`)
     prüft `frameRate` vor `duration` mit denselben `!== undefined`-Bedingungen
     wie `getTimingOptions()`. Einziger Unterschied: ein Eintrag mit fehlendem
     Timing *und* unbrauchbaren Frames meldet jetzt die Frames zuerst — `add()`
     prüft die Frames vor der Dauer. Das ist gewollt und braucht keinen Test.

3. **`FrameBasedAnimations.ts` — die zwei Ablehnungen ohne Präfix.**
   1. Zeile 202: `throw new Error(`name='${name.toString()}' must be unique!`);`
      wird
      ``throw new Error(`FrameBasedAnimations: add() got the name \`${animNameInError(name)}\`, which another animation already carries — an animation name must be unique`);``
      (`animNameInError()` steht schon in der Datei, Zeile 47; `name` ist an
      dieser Stelle gesetzt).
   2. Zeile 272: `throw new Error('add(): the third argument must be a TextureAtlas, a TileSet or an array of frames');`
      wird
      ``throw new Error(`FrameBasedAnimations: add() got a third argument of ${describeValue(args[2])} for the animation \`${animNameInError(name)}\` — the third argument is a TextureAtlas, a TileSet or an array of frames`);``
      (`describeValue` ist bereits importiert).
   3. Zeilen über `printWidth` 130 bricht Prettier nicht um (Template-Literal) —
      `pnpm lint` entscheidet; falls nötig, wie an den übrigen Meldungen der
      Datei den `new Error(` auf eine eigene Zeile stellen.

4. **`TextureStore.spec.ts:126-130` → `TextureResource.spec.ts`.** Den Test
   `'TextureResource.dispose() is idempotent and does not throw'` aus
   `describe('dispose()')` der Store-Spec löschen und in
   `TextureResource.spec.ts`, `describe('dispose()')` (ab Zeile 250), direkt
   hinter `'is safe to call twice'` (Zeile 312) einfügen als
   `'is safe to call twice on a resource that never loaded'`, Rumpf unverändert
   (`TextureResource.fromImage('x', 'x.png')`, zwei `dispose()` ohne Wurf).
   Kein Duplikat: der Nachbartest ruft `dispose()` auf einer geladenen
   Resource mit Texture, dieser auf einer, die nie `load()` gesehen hat.
   Den Import von `TextureResource` in der Store-Spec stehen lassen — er wird
   dort weiter gebraucht (Zeilen 5, 326, 394).

5. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, `[Unreleased]`, Skill
   `updating-changelog`), unter `### Changed` ein neuer Punkt mit diesem
   Wortlaut:

   ```markdown
   - the `error` a `TextureResource` reports for an animation entry that carries neither a `duration` nor a `frameRate` is the error `FrameBasedAnimations#add()` throws for it, which names the animation. `add()` refuses a name that another animation already carries and a third argument that is no `TextureAtlas`, no `TileSet` and no array of frames with an error that starts with `FrameBasedAnimations: add()` and names the animation, as every other refusal of `add()` does; the one for the third argument names the value it got
   ```

   Kein Rückblick (kein »now«, »no longer«, »instead of«). Die bestehenden
   Punkte Zeile 129 (dritter Parameter) und Zeile 193 (»must be unique«)
   bleiben wahr und werden nicht angefasst.

## Verify

`pnpm run ci`

## Commit

`fix(texture): report an animation entry of a TextureResource that carries neither a duration nor a frameRate with the error FrameBasedAnimations#add() throws for it, begin the refusals of a taken name and of a third argument add() cannot read with FrameBasedAnimations: add() and the animation, and move the last TextureResource test out of the store spec`

## Abgleich (Zug 0, gegen `bb1fdd51`)

- **Folge von Paket 1** (`TextureResource.ts:27` im Plan) — unverändert, verschoben: `getTimingOptions()` steht jetzt `TextureResource.ts:30-38`, der Wurf `'Either duration or frameRate must be provided in animation data'` in `:37`; Aufrufer `:797` (Tile-Set-Effekt, beide Formen `tileIds`/`firstTileId`) und `:1007` (Atlas-Effekt). Die Gegenstelle `resolveDuration()` steht `FrameBasedAnimations.ts:76-92`, Wurf `:89-91` mit ``FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation `<name>` ``. Die Resource-Tests `TextureResource.spec.ts:487` und `:547` prüfen nur `source`, `id`, `animation`, nicht die Meldung — deshalb schlagen sie heute nicht an. `TextureStore.spec.ts:1875` (`a skipped animation entry does not reject get()`) prüft nur `source` und `animation` und bleibt grün.
- **Aus »Offene Befunde« aufgenommen, `FrameBasedAnimations.ts:193,233`** — unverändert, verschoben nach `:202` (`name='…' must be unique!`) und `:272` (`add(): the third argument must be …`). Gleiche Ursache wie das Paket: eine Ablehnung von Animationsdaten, die nicht dem Meldungsformat folgt, das Paket 1 für `add()` festgelegt hat (Präfix `FrameBasedAnimations: add()`, Wert, Animationsname, Regel nach dem Gedankenstrich). Ohne sie bleibt das Ziel »aus einer Prüfstelle, in einem Format« halb erreicht. Beide Stellen sind aus einer `TextureResource` heraus nicht erreichbar (Namen kommen aus `Object.entries`, der dritte Parameter ist dort immer Atlas oder Tile Set) — sie betreffen direkte Aufrufer von `add()`. Tests: `FrameBasedAnimations.spec.ts:156-164` erwartet heute den alten Wortlaut, für den dritten Parameter gibt es keinen Test.
- **Aus »Offene Befunde« aufgenommen, `TextureStore.spec.ts:126`** — unverändert: `'TextureResource.dispose() is idempotent and does not throw'` liegt weiter in `describe('dispose()')` der Store-Spec, als einziger `TextureResource`-Test dort (kein weiterer Treffer auf `test('TextureResource.` oder `describe('TextureResource`). Gleiche Ursache wie TEST-018 aus Paket 1 (»TextureResource-Tests liegen in TextureStore.spec.ts«, Empfehlung: verschieben): Paket 1 hat die drei vom Audit benannten Blöcke verschoben, diesen einen nicht. Ohne ihn bucht der Abschluss TEST-018 auf `dff733ff` als geschlossen, während eine Fundstelle stehen bleibt; Paket 7 ist der Nachtrag, der Paket 1 zu Ende bringt, und schreibt ohnehin in `TextureResource.spec.ts`.
- **Nicht aufgenommen:** `FrameBasedAnimations.ts:208` (Frame-Array per Referenz) — eigene Ursache (Besitz der Eingabe, nicht Meldungsformat). `AnimatedSpritesMaterial.ts:90` (`duration` 0 → NaN im Shader, `→ Rückfrage`) — eigene Ursache (Shader-Arithmetik, `add()` lässt 0 als Standbild ausdrücklich zu). `TextureStore.spec.ts:420` (falscher Kommentar) und `TextureResource.ts:167,185` (Zeilenlänge) — eigene Ursachen, kein Bezug zu Paket 1. Alle übrigen Einträge liegen außerhalb dieses Moduls oder dieser Ursache.
- **Offene Folgen im Plan:** keine neuen. Die einzige offene war die von Paket 1, die dieses Paket ist; Paket 2 → Paket 8 (erledigt), Paket 3, 8, 4, 9 ohne Folgen.
- **Abweichung vom Grobplan:** der Grobplan nannte nur `TextureResource.ts`, seine Spec und den CHANGELOG. Dazu kommen `FrameBasedAnimations.ts` samt Spec und `TextureStore.spec.ts` für die beiden aufgenommenen Einträge; der Umfang bleibt ein Paket für einen Implementierer der mittleren Stufe.
- **Wortlaut der neuen Meldungen:** nach dem Schema aus Paket 1 (`… add() got a <was> of <describeValue> for the animation \`<name>\` — <Regel>`). Die Namensmeldung behält »must be unique«, damit der unveröffentlichte CHANGELOG-Punkt Zeile 193 (»the usual "must be unique" error«) wahr bleibt.

## Findings im Volltext

Keine Audit-Findings eigen. Die Einträge, die das Paket trägt, im Wortlaut ihrer Quelle:

**Folge von Paket 1** (`Folgen:` unter Paket 1 im Plan) — `packages/twopoint5d/src/texture/TextureResource.ts:27` (`getTimingOptions()`) wirft weiter `'Either duration or frameRate must be provided in animation data'` ohne Präfix und Animationsnamen, während `FrameBasedAnimations#add()` denselben Fall jetzt mit ``FrameBasedAnimations: add() got neither a duration nor a frameRate for the animation `…` `` meldet.

**Offene Befunde, `FrameBasedAnimations.ts:193,233`** (info → Scope, aufgefallen in Paket 3, Zug 0) — zwei Ablehnungen von `add()` tragen nicht das Präfix `FrameBasedAnimations: add()` der übrigen (`name='…' must be unique!`, `add(): the third argument must be …`) · vorbestehend (`fceda80b:…/FrameBasedAnimations.ts:181,221`).

**Offene Befunde, `TextureStore.spec.ts:126`** (low → Scope, aufgefallen in Paket 2) — `TextureResource.dispose() is idempotent and does not throw` ist ein reiner Resource-Test in der Store-Spec, von der Verschiebung in Paket 1 übrig · vorbestehend.

**TEST-018 · low · `packages/twopoint5d/src/texture/TextureStore.spec.ts:1026`** (Paket 1, Ursache des dritten Eintrags) — Rund zehn TextureResource-Tests liegen in TextureStore.spec.ts. Tests im `describe('TextureStore')` prüfen ausschließlich `TextureResource`: `TextureResource.load() initial firing`, `TextureResource.load() image race`, `TextureResource.fromX input safety`. Neben der Datei liegt `TextureResource.spec.ts`, in die sie gehören.
Empfehlung: Die Blöcke nach `TextureResource.spec.ts` verschieben.

## Verlauf

- 2026-09-26 Zug 0: Detailplan steht · Folge von Paket 1 unverändert, `getTimingOptions()` nach `TextureResource.ts:30-38` (Wurf `:37`, Aufrufer `:797`, `:1007`) gewandert · aus »Offene Befunde« aufgenommen: `FrameBasedAnimations.ts:193,233` (jetzt `:202`, `:272`) und `TextureStore.spec.ts:126` · keine offenen Folgen zu verteilen · Restplan unverändert (Paket 5 danach, `Hängt ab von: 2, 3, 7, 8` gewahrt)
- 2026-09-26 Zug 1: Implementierer beauftragt (sonnet, effort low), Report `paket-7.impl-0.json`
- 2026-09-26 Zug 2: Report FERTIG_MIT_VORBEHALT (Dateien nicht ganz gelesen, keine Nebenbefunde) · 6 Dateien geändert (TextureResource.ts, FrameBasedAnimations.ts, beide Specs, TextureStore.spec.ts, CHANGELOG.md) · roter Lauf 4 failed belegt · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-7.verify.log`)
- 2026-09-26 Zug 3: Reviewer (sonnet, low) — alle Punkte erfüllt, keine kritischen oder wichtigen Befunde, zwei kleine · Diff `paket-7.diff`, Report `paket-7.review-0.json`
- 2026-09-26 Zug 4: keine Runde nötig
- 2026-09-26 Zug 5: committet `686a4597`, Verify `paket-7.verify.log` exit=0 (keine Änderung seit dem Lauf)

## Urteil des Reviewers

- Folge von Paket 1: behoben — `TextureResource.ts` `getTimingOptions()` gelöscht, Tile-Set- und Atlas-Effekt übergeben `data` an `add()`; Tests `TextureResource.spec.ts` (beide umbenannten Tests prüfen den Wortlaut)
- `FrameBasedAnimations.ts:193,233` (Offene Befunde): behoben — `FrameBasedAnimations.ts:202-204` (Name) und `:274-276` (dritter Parameter); Tests in `FrameBasedAnimations.spec.ts`
- `TextureStore.spec.ts:126` (Offene Befunde, Rest von TEST-018): behoben — Test als `is safe to call twice on a resource that never loaded` in `TextureResource.spec.ts`, `describe('dispose()')`
- Klein: Testnamen in `TextureResource.spec.ts` über 130 Zeichen (Wortlaut der Paketdatei, gewollt) · Test für den dritten Parameter deckt nur den Wert `5` (describeValue anderswo getestet)
- Anmerkung: Der Implementierer hat die geänderten Dateien nicht ganz gelesen und daher keine Nebenbefunde gemeldet.
