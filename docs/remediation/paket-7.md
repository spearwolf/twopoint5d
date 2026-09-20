# Paket 7 — texture: Animationsnamen, Guard-Meldung und die Loader-Signaturen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: CONS-003 (low), IMPL-002 (low), CONS-032 (low), CONS-044 (info)
- Ziel: Eine ohne Namen angelegte Animation bleibt auffindbar, und der
  Größen-Guard erklärt dem Aufrufer, was er überschritten hat.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts` (CONS-003, IMPL-002)
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts` (Regressionstests)
  - `packages/twopoint5d/src/texture/TileSetLoader.ts` (CONS-032)
  - `packages/twopoint5d/src/texture/TextureImageLoader.ts` (CONS-032)
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.ts` (CONS-032, dazugenommen)
  - `packages/twopoint5d/src/texture/TextureImageLoader.spec.ts` (ein Test für den gelockerten Vertrag)
  - `packages/twopoint5d/src/texture/TextureResource.ts` (CONS-044)
  - `packages/twopoint5d/CHANGELOG.md` (drei Einträge unter `Changed`)
- Verify: `pnpm run ci`
- Commit: `fix(texture): give an unnamed animation a name it can be found under`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · CONS-003 unverändert auf
    `FrameBasedAnimations.ts:166` · IMPL-002 unverändert auf
    `FrameBasedAnimations.ts:82-84` · CONS-032 unverändert auf
    `TileSetLoader.ts:33` und `TextureImageLoader.ts:30` · CONS-044 unverändert
    auf `TextureResource.ts:552-554` · keine `Folgen:`-Zeile eines erledigten
    Pakets war offen, kein Eintrag aus »Offene Befunde« liegt in `texture/`,
    also kam keiner herein · dazugenommen: `TextureAtlasLoader.ts:39,98` als
    dritter Vertrag derselben Ursache, an
    `git show f8d255e3:packages/twopoint5d/src/texture/TextureAtlasLoader.ts`
    als vorbestehend geprüft · Restplan unverändert: Paket 8 (`stage/`) und
    Paket 9 (`vertex-objects/`) teilen mit `texture/` keine Datei, das
    »Hängt ab von« von Paket 8 zeigt auf das committete Paket 2
  - 2026-09-20 Zug 1: Implementierer beauftragt, mittlere Stufe (`sonnet`),
    Effort `medium` · Brief `<arbeitsdir>/paket-7.impl-1.brief.txt`, Report
    `<arbeitsdir>/paket-7.impl-1.json`, `session_id`
    `cfa66433-14c0-4571-84eb-d5bd57534fd1`
  - 2026-09-20 Zug 2: Report `FERTIG` · geändert: die acht Dateien des
    Detailplans (`FrameBasedAnimations.ts` und `.spec.ts`, `TileSetLoader.ts`,
    `TextureImageLoader.ts` und `.spec.ts`, `TextureAtlasLoader.ts`,
    `TextureResource.ts`, `CHANGELOG.md`), keine neue Datei · Arbeitsbaum
    schmutzig · vier Spec-Fälle vor dem Fix rot (4 failed | 261 passed), der
    Typecheck brach an `TextureImageLoader.spec.ts(48,73): TS2554` ab · eigener
    Verify-Lauf `pnpm run ci` exit=0, alle elf Ziele grün, Log
    `<arbeitsdir>/paket-7.verify.log`
  - 2026-09-20 Zug 3: Reviewer (`sonnet`, Effort `medium`) · alle vier Findings
    behoben, kein kritischer und kein wichtiger Befund, drei kleine · Diff
    `<arbeitsdir>/paket-7.diff`, Report `<arbeitsdir>/paket-7.review-1.json`
  - 2026-09-20 Zug 4: keine Runde — nicht erfüllte Findings gab es keine, und
    kleine Befunde lösen keine aus
  - 2026-09-20 Zug 5: committet als `0e8ceaa1`, ohne zweiten Verify-Lauf — seit
    dem grünen Lauf aus Zug 2 hat niemand eine Datei angefasst

## Vorgehen

### 1. `FrameBasedAnimations.add()`: Auto-Counter statt Symbol (CONS-003)

In `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`.

Der Plan hat den Weg unter »Entscheidungen« festgelegt: Auto-Counter
(`anim_0`, `anim_1`), kein `Symbol` mehr. Das steht nicht zur Wahl.

**1a.** Ein privates Zählfeld in der Klasse `FrameBasedAnimations`, direkt
unter `#names`:

```ts
  #anonymousCounter = 0;
```

**1b.** Eine private Methode, die den nächsten freien Namen liefert. Sie
gehört unter `add()`, vor `animId()`:

```ts
  // a name handed out here goes into the same lookup as one the caller picked, so it has to
  // step over every name that is already taken — the counter alone cannot promise a free one
  #nextAnonymousName(): string {
    let name = `anim_${this.#anonymousCounter++}`;
    while (this.#animations.has(name)) {
      name = `anim_${this.#anonymousCounter++}`;
    }
    return name;
  }
```

**1c.** In `add()` den `else`-Zweig auf Zeile 165-167 ersetzen:

```ts
    } else {
      name = this.#nextAnonymousName();
    }
```

Der `if (name)`-Zweig darüber bleibt unangetastet, `AnimName` bleibt
`string | symbol` — ein Aufrufer darf weiterhin ein Symbol übergeben, nur
vergibt die Klasse selbst keines mehr.

**1d.** Die TSDoc von `add()` schließt heute mit »Without a name the animation
is reachable through the id alone.« (Zeile 139). Dieser Satz wird ersetzt; der
Rest des Blocks bleibt, wie er ist:

```
   * A name is registered once; a second animation under the same name is refused with an
   * error. An animation added without a name is given one — `anim_0`, `anim_1`, and so on,
   * stepping over every name already taken — so it is reachable through `animId()` like
   * any other.
```

### 2. Die Guard-Meldung in `getBufferSize()` (IMPL-002)

In derselben Datei, Zeile 82-84. Der Wurf ist richtig und bleibt; nur die
Meldung wird eine für den Aufrufer. Sie nennt die vier Zahlen, die er braucht,
und folgt dem Hausstil: Klassenname als Präfix, `(s)` für die Pluralfrage wie
in `TextureStore.ts:444`:

```ts
  if (bufSize > maxTextureSize) {
    throw new Error(
      `FrameBasedAnimations: ${totalFramesCount} frame(s) in ${anims.length} animation(s) ask for a data texture of ${bufSize} texels, over the maximum of ${maxTextureSize}`,
    );
  }
```

`TODO` fällt damit weg — ohne Ersatz: die Berechnung ist richtig, es gibt
nichts nachzuholen.

### 3. Ein Vertrag für `textureClasses` in allen drei Loadern (CONS-032)

Drei Loader desselben Moduls fragen heute dreimal anders nach demselben
Parameter. Das Audit nennt zwei davon; `TextureAtlasLoader` trägt dieselbe
Ursache und kommt mit.

**Der Zielvertrag**, für alle drei gleich:

| Methode | Signatur |
| --- | --- |
| `load()` | `textureClasses: Array<TextureOptionClasses> \| null \| undefined` |
| `loadAsync()` | `textureClasses?: Array<TextureOptionClasses> \| null` |

Warum `load()` die ausgeschriebene Union bekommt und kein `?`: in allen drei
`load()`-Methoden folgt `onLoadCallback` als pflichtiger Parameter, und
TypeScript lässt keinen pflichtigen Parameter auf einen optionalen folgen. In
`loadAsync()` steht `textureClasses` dagegen am Ende oder vor einem weiteren
optionalen Parameter, dort geht `?`.

**3a.** `TileSetLoader.ts`: Zeile 33 trägt die Ziel-Union bereits — sie bleibt,
wie sie ist. Zeile 71 (`loadAsync`) wird zu
`textureClasses?: Array<TextureOptionClasses> | null`.

**3b.** `TextureImageLoader.ts`: Zeile 30 (`load`) wird zu
`textureClasses: Array<TextureOptionClasses> | null | undefined`, Zeile 62
(`loadAsync`) zu `textureClasses?: Array<TextureOptionClasses> | null`. Der
Rumpf bleibt unangetastet: `textureClasses ?? []` auf Zeile 45 macht schon
genau das, was der neue Typ zulässt.

**3c.** `TextureAtlasLoader.ts`: Zeile 39 (`load`) wird zu
`textureClasses: Array<TextureOptionClasses> | null | undefined`, Zeile 98
(`loadAsync`) zu `textureClasses?: Array<TextureOptionClasses> | null`.

**3d.** Derselbe Aufruf, eine Zeile weniger Arbeit: `TextureAtlasLoader.ts:69`
reicht heute `textureClasses ?? []` an `TextureImageLoader.load()` durch und
normalisiert damit ein zweites Mal, was der Empfänger selbst normalisiert. Das
`?? []` fällt weg, der Wert geht durch:

```ts
        this.textureImageLoader.load(
          imageUrl,
          textureClasses,
```

### 4. Der Rückblick im Ownership-Kommentar (CONS-044)

In `packages/twopoint5d/src/texture/TextureResource.ts`, Zeile 552-556. »any
more« blickt auf einen Vorzustand, den der Leser nicht kennt. Mit dem Streichen
wandert der Umbruch; der Block wird wörtlich dieser (Einrückung 16 Spalten,
jede Zeile unter den 130 Zeichen aus `.prettierrc`):

```
                // The resource owns the texture before it publishes it: a subscriber that throws
                // inside the batch, or one that disposes this resource, cannot skip the handover —
                // dispose() releases whatever is owned at that moment. The predecessor stays alive
                // while it is still the published value and is released only after the batch, once
                // the successor is on the signal and no reader can reach it
```

Sonst bleibt in dieser Datei alles unangetastet. Das »any more« auf Zeile 420
ist kein Rückblick auf den Code, sondern eine Aussage über den Zeitpunkt, an
dem keine Ressource das Bild mehr will — es bleibt stehen.

### 5. Regressionstests (CONS-003)

In `packages/twopoint5d/src/texture/FrameBasedAnimations.spec.ts`, im
`describe('add with TextureCoords array', …)`.

**Zuerst schreiben, rot sehen, dann Schritt 1 umsetzen.** Der rote Lauf gehört
in den Report.

**5a.** Der bestehende Test `add animation without name (using Symbol)` (Zeile
29-37) wird ersetzt — sein Name beschreibt danach etwas, das es nicht mehr
gibt, und seine Assertionen prüfen nur, dass eine Zahl herauskommt:

```ts
    test('an animation added without a name gets one it can be found under', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32)];

      const id = animations.add(undefined, 0.5, frames);

      expect(id).toBe(0);
      expect(animations.hasAnimation('anim_0')).toBe(true);
      expect(animations.animId('anim_0')).toBe(0);
    });
```

**5b.** Der zweite anonyme Eintrag zählt weiter:

```ts
    test('a second animation without a name gets the next name of the counter', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      animations.add(undefined, 1.0, frames);
      const id = animations.add(undefined, 1.0, frames);

      expect(id).toBe(1);
      expect(animations.animId('anim_0')).toBe(0);
      expect(animations.animId('anim_1')).toBe(1);
    });
```

**5c.** Ein Name, den der Aufrufer selbst vergeben hat, wird übersprungen —
die Stelle, an der ein Counter ohne Kollisionsprüfung einen fremden Eintrag
überschreiben würde:

```ts
    test('a name the caller already took is stepped over, not overwritten', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32)];

      const taken = animations.add('anim_0', 1.0, frames);
      const auto = animations.add(undefined, 1.0, frames);

      expect(animations.animId('anim_0')).toBe(taken);
      expect(animations.animId('anim_1')).toBe(auto);
    });
```

**5d.** Die Meldung des Größen-Guards (IMPL-002). `FrameBasedAnimations.MaxTextureSize`
ist ein öffentliches statisches Feld und lässt sich für den Test
herunterdrehen; `try`/`finally` stellt es wieder her, damit kein anderer Test
darauf läuft. Der Test gehört in `describe('buffer size calculation', …)`:

```ts
    test('a data texture over the maximum is refused with the numbers that were asked for', () => {
      const animations = new FrameBasedAnimations();
      const frames = [new TextureCoords(0, 0, 32, 32), new TextureCoords(32, 0, 32, 32), new TextureCoords(64, 0, 32, 32)];

      animations.add('walk', 1.0, frames);

      const maxBefore = FrameBasedAnimations.MaxTextureSize;
      FrameBasedAnimations.MaxTextureSize = 2;
      try {
        expect(() => animations.bakeDataTexture()).toThrow(/3 frame\(s\) in 1 animation\(s\).*4 texels.*maximum of 2/);
      } finally {
        FrameBasedAnimations.MaxTextureSize = maxBefore;
      }
    });
```

Die Zahlen darin: eine Animation mit drei Frames ergibt
`minBufSize = 1 + 3 * 1 = 4`, `findNextPowerOf2(4) = 4`, und 4 liegt über 2.
Vor dem Fix ist der Test rot — die Meldung enthält keine einzige davon.

**5e.** Ein Test für den gelockerten Loader-Vertrag, in
`packages/twopoint5d/src/texture/TextureImageLoader.spec.ts`. Nur dieser eine:
bei `TileSetLoader` und `TextureAtlasLoader` war der Parameter schon optional,
allein `TextureImageLoader.loadAsync()` verlangte ihn pflichtig, und genau das
ist die Lockerung, die ein Test belegen soll. Nach dem Muster des bestehenden
Tests, mit einer Factory, die mitschreibt, was sie bekommt:

```ts
  test('a load without texture classes reaches the factory with none', async () => {
    let deliver!: () => void;
    const imageLoader = {
      load(_url: string, onLoad: (image: unknown) => void) {
        deliver = () => onLoad({imgEl: {} as HTMLImageElement, texCoords: new TextureCoords(0, 0, 16, 16)});
      },
    } as unknown as PowerOf2ImageLoader;

    let classesSeen: unknown[] | undefined;
    const textureFactory = {
      update(_texture: Texture, ...classes: unknown[]) {
        classesSeen = classes;
      },
    } as unknown as TextureFactory;

    const promise = new TextureImageLoader(textureFactory, imageLoader).loadAsync('image.png');
    deliver();

    await expect(promise).resolves.toMatchObject({texture: expect.any(Texture)});
    expect(classesSeen).toEqual([]);
  });
```

Vor Schritt 3b ist dieser Test rot: `loadAsync('image.png')` erfüllt die
pflichtige Signatur nicht, der Typecheck bricht ab.

### 6. CHANGELOG

In `packages/twopoint5d/CHANGELOG.md`, unter `## [Unreleased]` → `### Changed`,
am Ende des Abschnitts. Drei Einträge, wörtlich:

```markdown
- `FrameBasedAnimations#add()` gives an animation added without a name one of its own — `anim_0`, `anim_1`, and so on, stepping over every name already registered. It goes into the same lookup as a name the caller picked, so `hasAnimation()` and `animId()` reach such an animation like any other. A caller who hands out names of that shape themselves meets the usual "must be unique" error when they ask for one the counter has already spent
- the guard of `FrameBasedAnimations#bakeDataTexture()` against a data texture wider than `FrameBasedAnimations.MaxTextureSize` names the numbers behind the refusal: how many frames in how many animations are registered, how wide the texture they ask for would be, and what the maximum is
- `TileSetLoader`, `TextureImageLoader` and `TextureAtlasLoader` ask for `textureClasses` under one contract: `load()` reads `Array<TextureOptionClasses> | null | undefined`, `loadAsync()` an optional `Array<TextureOptionClasses> | null`. An absent value means an empty list at each of the three, so a caller with no classes to pass leaves the argument out or writes `null`, whichever of the loaders they hold
```

**Kein Migrationsabschnitt.** Keine der vier Änderungen bricht Aufrufercode:
der Auto-Counter vergibt Namen, wo vorher keiner zu gebrauchen war, die
Loader-Signaturen werden gelockert, die Guard-Meldung und der Kommentar sind
Text. Das unterscheidet dieses Paket von den Paketen 3, 4 und 6, die je ein
bisher erlaubtes Aufrufmuster abgewiesen haben.

**Keine Browser-Testfläche.** Die Konvention verlangt beide Testflächen für
Rendering- und GPU-Buffer-Code. Hier ändert sich nichts daran: der
Animationsname geht nicht in den Datentexture-Puffer — `renderFloatsBuffer()`
schreibt `frames.length`, `duration` und `offset` —, der Guard ändert nur seine
Meldung, und die Loader-Signaturen sind Typen. Das Layout der `DataTexture`
bleibt Zeichen für Zeichen dasselbe.

### 7. Formatierung

`pnpm run ci` enthält `prettier --check .`. Nach den Änderungen
`pnpm exec prettier --write` auf die geänderten Dateien, sonst fällt das Gate
an einer Einrückung.

## Was Zug 0 dazugenommen hat, und was nicht

**Dazu: `TextureAtlasLoader.ts`.** CONS-032 nennt zwei Loader; der dritte im
selben Modul trägt einen dritten Vertrag für denselben Parameter
(`Array<TextureOptionClasses> | undefined` ohne `| null`). Dieselbe Ursache,
dieselbe Diff-Fläche, und ein Paket, das zwei von drei angleicht, lässt die
Inkonsistenz stehen, gegen die es angetreten ist. An
`git show f8d255e3:packages/twopoint5d/src/texture/TextureAtlasLoader.ts` als
vorbestehend geprüft, also ein Nebenbefund mit gemeinsamer Ursache — er wird in
diesem Paket behoben und nicht in »Offene Befunde« eingetragen.

**Dazu: das CHANGELOG.** Zwei der vier Findings bewegen die öffentliche
Oberfläche: der Default-Name einer Animation und die Signaturen der drei
Loader.

**Nicht dazu: die Spec-Stellen mit `anim_${i}`.**
`FrameBasedAnimations.spec.ts:356` und `:373` vergeben Namen im selben Schema
wie der neue Counter. Beide Tests legen eine frische Instanz an und vergeben
jeden Namen ausdrücklich, ohne einen anonymen `add()` dazwischen — sie bleiben
grün und werden nicht angefasst. Die Kollision, die dort keine ist, hat
trotzdem die Schleife in `#nextAnonymousName()` begründet.

**Nicht dazu: `TextureStore.ts` und der Rest von `TextureResource.ts`.** Die
Suche nach Rückblick-Formulierungen im ganzen Modul (`any more`, `no longer`,
`previously`, `used to`) hat sechs weitere Treffer, alle inhaltlich: sie
beschreiben, was zur Laufzeit nicht mehr gilt, nicht was im Code einmal anders
war. Kein zweiter Fall von CONS-044.

**Kein Eintrag aus »Offene Befunde«.** Die dreizehn Einträge der Queue liegen
im Lookbook-CSS, in `map2d/` und in `Canvas2DStage.ts`; keiner in `texture/`,
keiner teilt die Ursache dieses Pakets.

## Aufrufer im Repository

Geprüft über Bibliothek, Specs, `packages/twopoint5d-testing/test/` und
`apps/lookbook/`:

- **`FrameBasedAnimations#add()` ohne Namen** ruft außerhalb der eigenen Spec
  niemand. `TextureResource.ts:674,676,851` übergibt je einen `name` aus der
  Animations-Map, wo der Name der Schlüssel ist;
  `apps/lookbook/src/pages/demos/animated-billboards.astro:75` vergibt
  `'anim0'` — anderes Schema als `anim_0`, keine Kollision.
- **Die drei Loader** werden im Lookbook sechsmal über `loadAsync()` gerufen,
  dazu `TextureAtlasLoader` intern über `textureImageLoader.load()`. Alle
  Aufrufe erfüllen den gelockerten Vertrag unverändert — eine Lockerung bricht
  keinen Aufrufer. `TextureAtlasLoader.spec.ts` stellt `textureImageLoader` als
  `{load: …}`-Double, das sich an keiner Signatur stößt.
- **Der Guard in `getBufferSize()`** wird von `bakeDataTexture()` aus erreicht
  und sonst von nirgends; `getBufferSize` ist modulprivat.

## Findings im Volltext

**CONS-003 · low · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:166`**
— FrameBasedAnimations.add() nutzt ein Symbol als Default-Namen

`name = Symbol('n/a')` als Default macht Animationen anonym — und damit weder
auffindbar noch löschbar; `animId(name)` ist für solche Einträge nicht
aufrufbar. Re-Check: unverändert.

Empfehlung: Bei fehlendem Namen einen Auto-Counter vergeben, etwa `anim_0`,
`anim_1`. Dann funktioniert der Lookup auch für Aufrufer, die keinen Namen
vergeben wollten.

**IMPL-002 · low (vorher high) · `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:82-84`**
— Die TODO-Fehlermeldung in FrameBasedAnimations durch einen Satz für den
Aufrufer ersetzen

`throw new Error('TODO too many animation frames - we need better way here to
calculate a corresponding buffer size!')` ist ein legitimer Guard gegen
`bufSize > maxTextureSize` — der Wurf ist richtig, nur die Meldung liest sich
wie eine Notiz an sich selbst. Der Vorlauf führte den Punkt als *high*; dieser
Lauf stuft ihn neu ein: Die Prüfung schützt korrekt, ein Konsument, der sie
trifft, bekommt lediglich keine brauchbare Erklärung. Am Code hat sich nichts
geändert, die Neubewertung ist der einzige Unterschied.

Empfehlung: Umformulieren zu etwa `FrameBasedAnimations: N animation frames
exceed the maximum data texture width of ${maxTextureSize}` und die
tatsächlichen Zahlen einsetzen.

**CONS-032 · low · `packages/twopoint5d/src/texture/TileSetLoader.ts:33`; `TextureImageLoader.ts:30`**
— textureClasses in TileSetLoader.load() und TextureImageLoader.load() gleich
typisieren

`TileSetLoader.load()` nimmt `textureClasses` als `Array | null | undefined`,
das Geschwister `TextureImageLoader.load()` nur als `Array`. Zwei Loader
desselben Moduls, zwei Verträge für denselben Parameter. Aufgefallen im
Remediation-Lauf vom 2026-09-19.

Empfehlung: Beide auf `textureClasses?: Array<TextureOptionClasses> | null`
bringen, auch in `loadAsync()`.

**CONS-044 · info · `packages/twopoint5d/src/texture/TextureResource.ts:552-554`**
— Den Rückblick aus dem Ownership-Kommentar in TextureResource nehmen

»cannot skip the handover any more« blickt auf einen Vorzustand zurück, den der
Leser nicht kennt; die Konvention des Repos schreibt Kommentare ohne Rückblick.
Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: »cannot skip the handover«.

## Abweichungen von der Empfehlung des Audits

**IMPL-002.** Die vorgeschlagene Meldung nennt »N animation frames« gegen die
»maximum data texture width«. Beide Zahlen sagen dem Aufrufer wenig: die Grenze
verletzt nicht die Frame-Zahl, sondern die daraus errechnete Puffergröße
(`findNextPowerOf2(anims.length + frames * sizePerTexture)`), und zwischen
beiden liegt eine Aufrundung auf die nächste Zweierpotenz. Die Meldung nennt
deshalb alle vier Zahlen — Frames, Animationen, geforderte Texel, Maximum —,
sonst rechnet der Aufrufer die Lücke selbst nach.

**CONS-032.** Die vorgeschlagene Signatur
`textureClasses?: Array<TextureOptionClasses> | null` lässt sich in den
`load()`-Methoden nicht schreiben: dort folgt ein pflichtiger
`onLoadCallback`, und TypeScript verbietet das. Die Empfehlung greift
unverändert in `loadAsync()`; in `load()` steht dieselbe Menge als
ausgeschriebene Union.

## Anmerkungen des Reviewers

**Erfüllung.** Alle vier Findings behoben:

- CONS-003 — `FrameBasedAnimations.ts:165-173` vergibt über
  `#nextAnonymousName()` (`:230-238`) einen String `anim_N` in dieselbe
  `#animations`-Map, die `animId()` und `hasAnimation()` (`:246-257`) bedienen;
  das Zählfeld steht auf `:127`, die TSDoc von `add()` auf `:142-145`.
- IMPL-002 — `FrameBasedAnimations.ts:82-86` nennt Frames, Animationen,
  geforderte Texel und Maximum, Zeichen für Zeichen wie geplant; das `TODO` ist
  weg.
- CONS-032 — `TileSetLoader.ts:33` und `:68-72`, `TextureImageLoader.ts:30` und
  `:62`, `TextureAtlasLoader.ts:39` und `:98`; das doppelte `?? []` an
  `TextureAtlasLoader.ts:69` ist entfernt, der Empfänger normalisiert selbst.
- CONS-044 — `TextureResource.ts:552-556`, »any more« gestrichen, Block wörtlich
  wie geplant umbrochen, keine Zeile über 130 Zeichen; das »any more« auf
  `:420` steht wie beschlossen weiter da.

**Qualität.** Kein kritischer, kein wichtiger Befund. Geprüft und ohne Treffer:
Finding-IDs im Repo, Rückblick in Code, Kommentar, TSDoc und CHANGELOG,
Englisch, `.js`-Suffix und `import type` (keine neuen Imports), Prettier, sowie
die Stellen, die der Umbau hätte mitnehmen müssen — kein `Symbol('n/a')` und
kein alter Meldungstext mehr im Repo, `AnimName` unverändert
`string | symbol`, die Lookbook-Aufrufe erfüllen den gelockerten Vertrag, das
Double in `TextureAtlasLoader.spec.ts` prüft `textureClasses` nicht,
`docs/architecture.md:66` lügt nicht.

**Die drei kleinen Befunde**, keiner hat eine Runde ausgelöst:

1. Die Betreffzeile aus dem Detailplan nennt nur eine der vier Änderungen. In
   Zug 5 hat der Commit deshalb einen Body bekommen, der auch Guard-Meldung,
   Loader-Vertrag und den weggefallenen zweiten `?? []`-Griff benennt; die
   Betreffzeile blieb die geplante.
2. `FrameBasedAnimations.spec.ts` deckt den Fall nicht ab, den der
   CHANGELOG-Eintrag zusagt: der Zähler hat `anim_0` vergeben, danach fordert
   der Aufrufer selbst `anim_0` an und bekommt den »must be unique«-Fehler. Die
   Zusage steht im CHANGELOG und ist ungetestet.
3. `FrameBasedAnimations.ts:232-236` — `#anonymousCounter++` steht zweimal als
   Seiteneffekt in derselben Template-Zeile; ein `do … while` schriebe sie nur
   einmal. Geschmackssache, der Code ist korrekt.

## Nebenbefunde dieses Pakets und ihr Urteil

Beide stehen in `TextureAtlasLoader.ts`, beide an
`git show f8d255e3:packages/twopoint5d/src/texture/TextureAtlasLoader.ts` als
vorbestehend geprüft — der Baseline-Stand ist an beiden Stellen Zeichen für
Zeichen derselbe. Beide gingen in »Offene Befunde«; die Ursache dieses Pakets
teilen sie nicht: hier ging es um Parametertypen der Loader, dort um die
Ownership einer gebauten `Texture` und um eine Notiz im Progress-Callback.

- `:74-80`, die nicht disposete `Texture` auf dem Fehlerpfad von
  `TexturePackerJson.parse()`: geschätzt `low` — es leakt eine Textur pro
  fehlerhafter Atlas-Json, nicht pro Frame, und der Pfad setzt eine kaputte
  Antwort voraus. Die Scope-Regel des Laufs nimmt jede Severity, also `→ Scope`;
  ein Fix gehört zu den Regeln in `packages/twopoint5d/docs/resource-lifecycle.md`
  und damit in ein eigenes Paket, nicht in dieses.
- `:88-91`, der leere Progress-Callback mit TODO-Notiz: `info`, `→ Scope`.
