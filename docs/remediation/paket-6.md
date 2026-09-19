# Paket 6 — utils und sprites: Dependencies, Zweierpotenzen, unpick, AnimatedSprites-Zeit

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-090 (medium), BUG-091 (low), BUG-092 (low), BUG-089 (low)
- Ziel: Die öffentlichen Helfer liefern für ihren ganzen Eingaberaum korrekte Ergebnisse, und AnimatedSpritesMaterial übernimmt `time` aus den Optionen.
- Modell: mittlere Stufe
- Effort: low — vier lokale Fixes, jede Implementierung, jeder Testfall und jeder CHANGELOG-Eintrag steht unten ausformuliert
- Dateien:
  - `packages/twopoint5d/src/utils/Dependencies.ts`, `Dependencies.spec.ts`
  - `packages/twopoint5d/src/utils/findNextPowerOf2.ts`, `findNextPowerOf2.spec.ts`
  - `packages/twopoint5d/src/utils/isPowerOf2.ts`, `isPowerOf2.spec.ts`
  - `packages/twopoint5d/src/utils/unpick.ts`, `unpick.spec.ts`
  - `packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts`, `AnimatedSpritesMaterial.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Kein Browsertest: keine der Änderungen berührt einen Node-Graph, ein Attribut oder einen GPU-Buffer. `AnimatedSpritesMaterial` schreibt den Optionswert in dasselbe `uniform`-Objekt (`#timeUniform`), das der Setter `time` beschreibt und der Shader-Graph schon referenziert; die Spec liest ihn über den Getter genau aus diesem Objekt zurück. `findNextPowerOf2` liefert für jede Eingabe bis `2 ** 30` — alle Bildmaße, die `PowerOf2ImageLoader` und `FrameBasedAnimations` hineingeben — dasselbe Ergebnis wie heute.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): let dependencies read a key left out of an update as absent, keep the power-of-two helpers exact for every number, let unpick keep the symbol keys it is not asked to drop and start the animated sprites clock at the time its options name`

## Vorgehen

Reihenfolge: erst alle neuen Testfälle schreiben (Schritt 1), dann der rote Lauf
(Schritt 2), dann die Fixes (Schritte 3–7), dann CHANGELOG (Schritt 8), dann Verify.
Code, Kommentare, TSDoc und CHANGELOG auf Englisch. Kein Finding-Kürzel irgendwo im
Repo, kein Satz über den Vorzustand in Code, Kommentar, TSDoc oder CHANGELOG (keine
Wörter wie »before«, »used to«, »no longer«, »hung«, »previously«) — der CHANGELOG
beschreibt, wie es jetzt ist.

### 1. Regressionstests schreiben (vor jedem Fix)

**`utils/Dependencies.spec.ts`** — drei neue `test()` am Ende des `describe('Dependencies')`:

```ts
test('a key left out of changed() is reported as a change once, not on every call', () => {
  const deps = new Dependencies(['a', 'b']);

  deps.update({a: 1, b: 'x'});

  expect(deps.changed({a: 2}), 'a moved and b went absent').toBe(true);
  expect(deps.changed({a: 2}), 'nothing moved since').toBe(false);
  expect(deps.value('b')).toBeUndefined();
});

test('update() writes a declared key it is not given as absent', () => {
  const deps = new Dependencies(['a', 'b']);

  deps.update({a: 1, b: 'x'});
  deps.update({a: 1});

  expect(deps.value('b')).toBeUndefined();
  expect(deps.equals({a: 1})).toBe(true);
});

test('a cloneable key left out goes absent and takes a clone again when it comes back', () => {
  const deps = new Dependencies<{v: Vector2}>([Dependencies.cloneable<Vector2>('v')]);

  expect(deps.changed({v: new Vector2(1, 2)})).toBe(true);
  expect(deps.changed({})).toBe(true);
  expect(deps.changed({})).toBe(false);
  expect(deps.value('v')).toBeUndefined();

  const v = new Vector2(3, 4);
  expect(deps.changed({v})).toBe(true);
  expect(deps.value('v')).not.toBe(v);
  expect(deps.value('v')!.equals(v)).toBe(true);
});
```

**`utils/isPowerOf2.spec.ts`** — neue `test()` im bestehenden `describe('isPowerOf2')`:

```ts
test('the powers of two a double holds beyond 32 bits', () => {
  expect(isPowerOf2(2 ** 31)).toBe(true);
  expect(isPowerOf2(2 ** 32)).toBe(true);
  expect(isPowerOf2(2 ** 53)).toBe(true);
  expect(isPowerOf2(2 ** 1023)).toBe(true);
});

test('no other number beyond 32 bits', () => {
  expect(isPowerOf2(2 ** 32 + 1)).toBe(false);
  expect(isPowerOf2(3 * 2 ** 32)).toBe(false);
  expect(isPowerOf2(2 ** 50 + 2)).toBe(false);
});

test('no fraction, no negative number and nothing that is not finite', () => {
  expect(isPowerOf2(2.5)).toBe(false);
  expect(isPowerOf2(0.5)).toBe(false);
  expect(isPowerOf2(-2)).toBe(false);
  expect(isPowerOf2(-(2 ** 31))).toBe(false);
  expect(isPowerOf2(Infinity)).toBe(false);
  expect(isPowerOf2(NaN)).toBe(false);
});
```

**`utils/findNextPowerOf2.spec.ts`** — neue `test()` im bestehenden `describe('findNextPowerOf2')`:

```ts
test('beyond 32 bits', () => {
  expect(findNextPowerOf2(2 ** 30 + 1)).toBe(2 ** 31);
  expect(findNextPowerOf2(2 ** 31)).toBe(2 ** 31);
  expect(findNextPowerOf2(2 ** 32 + 1)).toBe(2 ** 33);
  expect(findNextPowerOf2(2 ** 50 + 1)).toBe(2 ** 51);
  expect(findNextPowerOf2(2 ** 1023)).toBe(2 ** 1023);
});

test('a number no finite power of two reaches answers Infinity', () => {
  expect(findNextPowerOf2(2 ** 1023 + 2 ** 971)).toBe(Infinity);
  expect(findNextPowerOf2(Number.MAX_VALUE)).toBe(Infinity);
  expect(findNextPowerOf2(Infinity)).toBe(Infinity);
});

test('everything up to 1 answers 1, NaN answers NaN', () => {
  expect(findNextPowerOf2(0.5)).toBe(1);
  expect(findNextPowerOf2(-5)).toBe(1);
  expect(findNextPowerOf2(-Infinity)).toBe(1);
  expect(findNextPowerOf2(1.5)).toBe(2);
  expect(findNextPowerOf2(NaN)).toBeNaN();
});
```

(`2 ** 1023 + 2 ** 971` ist der nächste Double über `2 ** 1023`.)

**`utils/unpick.spec.ts`** — die beiden Tests `'with symbols'` und `'with multiple keys'`
bestehen heute, weil `unpick` jedes Symbol verwirft: sie werden ersetzt, und zwei Tests
kommen dazu. Die Symbol-Assertions laufen über `Object.getOwnPropertySymbols()`, nicht
über `toEqual` allein:

```ts
test('with symbols', () => {
  const Plah = Symbol('plah');
  const Other = Symbol('other');
  const result = unpick({foo: 'bar', xyz: 123, [Plah]: 666, [Other]: 42}, Plah)!;

  expect(Object.getOwnPropertySymbols(result)).toEqual([Other]);
  expect(result[Other]).toBe(42);
  expect(Object.keys(result)).toEqual(['foo', 'xyz']);
});

test('with multiple keys', () => {
  const Plah = Symbol('plah');
  const Other = Symbol('other');
  const result = unpick({foo: 'bar', xyz: 123, [Plah]: 666, [Other]: 42}, Plah, 'foo')!;

  expect(Object.getOwnPropertySymbols(result)).toEqual([Other]);
  expect(Object.keys(result)).toEqual(['xyz']);
});

test('keeps a symbol key it is not asked to remove', () => {
  const S = Symbol('s');
  const result = unpick({[S]: 1, a: 2}, 'a')!;

  expect(Object.getOwnPropertySymbols(result)).toEqual([S]);
  expect(result[S]).toBe(1);
  expect(Object.keys(result)).toEqual([]);
});

test('takes no property that is not enumerable', () => {
  const S = Symbol('s');
  const source = {a: 1};
  Object.defineProperty(source, 'hidden', {value: 2, enumerable: false});
  Object.defineProperty(source, S, {value: 3, enumerable: false});

  const result = unpick(source)!;

  expect(Reflect.ownKeys(result)).toEqual(['a']);
});
```

Typfehler beim Index mit einem Symbol (`result[Other]`) löst ein Cast wie
`(result as Record<symbol, unknown>)[Other]` — kein `@ts-expect-error`, kein `any`.

**`sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts`** — zwei neue `test()` direkt
hinter `'constructs with an animsMap option'`:

```ts
test('takes the animation time from its options', () => {
  const material = new AnimatedSpritesMaterial({time: 1.5});

  expect(material.time).toBe(1.5);

  material.dispose();
});

test('starts the animation time at 0 without one', () => {
  const material = new AnimatedSpritesMaterial();

  expect(material.time).toBe(0);

  material.dispose();
});
```

### 2. Der rote Lauf, vor dem ersten Fix — gehört in den Report

`findNextPowerOf2.spec.ts` läuft vor dem Fix **nicht** unter Vitest: jede Eingabe über
`2 ** 30` hängt die Schleife auf, und eine synchrone Endlosschleife hält der Test-Timeout
nicht an. Alle anderen Specs:

```bash
pnpm nx test twopoint5d -- src/utils/Dependencies.spec.ts src/utils/isPowerOf2.spec.ts src/utils/unpick.spec.ts src/sprites/AnimatedSprites/AnimatedSpritesMaterial.spec.ts
```

Erwartet rot: die drei neuen `Dependencies`-Tests, die drei neuen `isPowerOf2`-Tests (je
mindestens eine Assertion), `'with symbols'`, `'with multiple keys'`, `'keeps a symbol key it
is not asked to remove'`, `'takes the animation time from its options'`. Grün schon vor dem
Fix: `'takes no property that is not enumerable'` und `'starts the animation time at 0
without one'` — beide sind Wächter.

Für `findNextPowerOf2` der rote Beleg mit Node gegen die Quelldatei (Node ≥ 24 strippt die
Typen selbst), aus dem Repo-Root:

```bash
timeout -s KILL 10 node -e "import('./packages/twopoint5d/src/utils/findNextPowerOf2.ts').then(m => console.log(m.findNextPowerOf2(2 ** 31)))"; echo exit=$?
node -e "import('./packages/twopoint5d/src/utils/findNextPowerOf2.ts').then(m => console.log(m.findNextPowerOf2(NaN)))"
```

Erwartet vor dem Fix: `exit=137` (hängt, vom `timeout` getötet) bzw. `1`. Nach dem Fix:
`2147483648` bzw. `NaN`. Beide Ausgaben, vorher und nachher, in den Report.

### 3. `utils/Dependencies.ts` — `update()` schreibt jeden deklarierten Key

- `update()` (Zeilen 108–130) iteriert `this.#props` statt `Object.entries(nextProps)` und
  liest den Wert je Key aus `nextProps`; ein fehlender Key wird als `undefined` geschrieben.
  Der Rumpf der Schleife bleibt sonst, wie er ist:

  ```ts
  update(nextProps: DependencyValues<Shape>): void {
    for (const [name, callbacks] of this.#props) {
      // every declared key is written, one the argument leaves out as absent: equals() reads a
      // missing key as absent, and a state that kept an earlier value for it would answer
      // every later call as a change
      const value = (nextProps as Record<DependencyKey, unknown>)[name];

      if (callbacks != null) {
        const {clone, copy} = callbacks;
        if (value != null && clone != null && copy != null) {
          const curValue = this.#state.get(name);
          if (curValue == null) {
            this.#state.set(name, clone(value));
          } else {
            copy(value, curValue);
          }
          continue;
        }
      }
      this.#state.set(name, value);
    }
  }
  ```

  Der Kommentar zu nicht deklarierten Keys (Zeilen 110–112) entfällt: die Schleife läuft
  nur noch über deklarierte Keys, ein nicht deklarierter wird nie gelesen. Der Test `'a key
  nobody declared does not reach the state'` bleibt und bleibt grün.
- Das Feld `#declared` (Zeilen 67–68, samt TSDoc) und seine drei `this.#declared.set(…)`-Aufrufe
  im Konstruktor (Zeilen 90, 93, 97) werden entfernt — `update()` war sein einziger Leser,
  `#props` trägt dieselbe Information. Der Konstruktor gibt dieselben Tupel zurück wie jetzt.
- TSDoc von `update()` (Zeilen 103–107) neu:

  ```ts
  /**
   * Writes the given values into the state, one for every key this `Dependencies` was declared
   * with. A declared key the argument leaves out is written as absent — the same reading
   * {@link equals} gives it — and a key nobody declared is not written at all. A key that
   * carries `clone` and `copy` is kept as a copy of its own, so a value written in place
   * afterwards does not move the state along with it.
   */
  ```

- `equals()`, `changed()`, `clear()`, `value()` und alle Typen bleiben unverändert. Die drei
  Aufrufer in `map2d/` (`RectangularVisibilityArea.ts:90`, `CameraBasedVisibility.ts:249`,
  `CameraBasedVisibilityHelpers.ts:305`) übergeben jeden deklarierten Key und brauchen keine
  Änderung.

### 4. `utils/findNextPowerOf2.ts` — Verdoppeln statt Schieben

```ts
/**
 * The smallest power of two that is at least `x`, counting from `1`: every `x` up to `1` — `0`
 * and negative numbers among them — answers `1`. A number above the largest power of two a
 * double holds (`2 ** 1023`) answers `Infinity`, and `NaN` answers `NaN`.
 */
export const findNextPowerOf2 = (x: number): number => {
  if (Number.isNaN(x)) return NaN;
  let p = 1;
  // doubling is exact for every power of two a double holds, and it ends: after 1024 steps p
  // is Infinity, which no x exceeds
  while (p < x) p *= 2;
  return p;
};
```

### 5. `utils/isPowerOf2.ts` — ganzzahlig, positiv, exakt

```ts
/**
 * Whether `n` is a power of two with an exponent of 0 or more: `1`, `2`, `4`, … up to
 * `2 ** 1023`. A fraction — `0.5` among them —, `0`, a negative number, `Infinity` and `NaN`
 * are not.
 */
export const isPowerOf2 = (n: number): boolean => {
  if (!Number.isInteger(n) || n < 1) return false;
  // halving a double of 1 or more is exact, so the test holds beyond 2 ** 53 as well, where
  // Math.log2() already rounds a neighbour of a power of two onto its exponent
  let m = n;
  while (m > 1) {
    if (m % 2 !== 0) return false;
    m /= 2;
  }
  return true;
};
```

### 6. `utils/unpick.ts` — über `Reflect.ownKeys()`

```ts
export const unpick = <T extends object>(o: T | null | undefined, ...keys: (keyof T)[]): Partial<T> | undefined => {
  if (o == null) return undefined;

  const result: Partial<T> = {};
  // Reflect.ownKeys() lists the symbol keys beside the string keys; of those, the enumerable
  // ones are taken — the same ones a spread copies
  for (const key of Reflect.ownKeys(o) as (keyof T)[]) {
    if (!keys.includes(key) && Object.prototype.propertyIsEnumerable.call(o, key)) {
      result[key] = o[key];
    }
  }
  return result;
};
```

Signatur und Rückgabetyp bleiben; `unpick` bleibt in `utils/public-api.ts` exportiert.

### 7. `sprites/AnimatedSprites/AnimatedSpritesMaterial.ts` — `time` aus den Optionen

- Im Konstruktor direkt nach `super(options);` (Zeile 49):

  ```ts
  if (options?.time != null) this.time = options.time;
  ```

  `TexturedSpritesMaterial` ruft `super()` ohne Optionen und nie `setValues()`, der Getter
  `time` wird also vor diesem Punkt nicht berührt — `#timeUniform` ist an dieser Stelle
  initialisiert.
- TSDoc an das Feld `time` in `AnimatedSpritesMaterialParameters` (Zeile 9):

  ```ts
  /** The animation time the material starts at, in seconds. Default is `0`. */
  time?: number;
  ```

### 8. CHANGELOG — `packages/twopoint5d/CHANGELOG.md`, Abschnitt `## [Unreleased]`

Skill `updating-changelog` laden. Vier Einträge ans Ende von `### Fixed` (die Liste endet
direkt vor `### Migration Guide`), sinngemäß:

- `fix Dependencies#update(): it writes every key the Dependencies was declared with, and a declared key the argument leaves out as absent — the reading equals() gives a missing key. changed() with a key left out reports the change once, and the call after it answers false`
- `fix findNextPowerOf2() and isPowerOf2() for every number a double holds: findNextPowerOf2() answers the smallest power of two that is at least its argument, 1 for everything up to 1, Infinity above 2 ** 1023 and NaN for NaN; isPowerOf2() answers true for the integer powers of two from 1 to 2 ** 1023 and false for every fraction, negative number, Infinity and NaN`
- `fix unpick(): it keeps every enumerable symbol key it is not asked to remove, as it keeps the string keys`
- `fix AnimatedSpritesMaterial: the time option of the constructor sets the animation time the material starts at`

Symbolnamen in Backticks wie in den Nachbareinträgen. Dazu **ein** Abschnitt ans Ende von
`### Migration Guide` (hinter `#### \`PanControl2D\` keys by \`KeyboardEvent.code\``, vor
`## [0.21.2]`), im Format der Nachbarabschnitte:

````markdown
#### `Dependencies#update()` writes every declared key

`update()` writes a value for every key the `Dependencies` was declared with; a key the
argument leaves out is written as absent. Code that writes only some keys passes the others
along.

**Before**

```ts
deps.update({centerX: 1});
```

**After**

```ts
deps.update({centerX: 1, centerY: deps.value('centerY')});
```
````

Die drei anderen Fixes brauchen keinen Migrationsabschnitt: kein Aufrufer, der heute ein
richtiges Ergebnis bekommt, bekommt danach ein anderes.

## Abgleich (Zug 0, 2026-09-19, Stand `68c3bff`)

Seit Laufbeginn (`e352b56`) hat kein Commit `utils/` oder `sprites/` berührt
(`git diff --stat e352b56 HEAD -- packages/twopoint5d/src/utils packages/twopoint5d/src/sprites` leer).

- **BUG-090 unverändert** — `Dependencies.ts:108-130` iteriert `Object.entries(nextProps)`,
  `equals()` (`:143-171`) iteriert `#props`. Nachgestellt: `update({a: 1, b: 'x'})`, dann
  dreimal `changed({a: 2})` → `true true true`, `value('b')` bleibt `'x'`.
- **BUG-091 unverändert** — `findNextPowerOf2.ts:1-5` (`p <<= 1`), `isPowerOf2.ts:1`
  (`n & (n - 1)`). Nachgestellt: `findNextPowerOf2(2 ** 31)` hängt (Exit 137 nach
  `timeout -s KILL 5`), `findNextPowerOf2(NaN)` → `1`; `isPowerOf2` → `true` für
  `2 ** 32 + 1`, `2.5`, `-(2 ** 31)`, `2 ** 50 + 2`, `3 * 2 ** 32`.
- **BUG-092 unverändert** — `unpick.ts:1-2` über `Object.entries`; die Spec »with symbols«
  an `unpick.spec.ts:9-12`. Nachgestellt: `unpick({[S]: 1, a: 2}, 'a')` → `{}`.
- **BUG-089 unverändert** — `AnimatedSpritesMaterial.ts:7-10` deklariert `time`, der
  Konstruktor (`:48-52`) liest nur `animsMap`.

## Entscheidungen dieses Zugs

- **Abweichung von der Empfehlung bei BUG-091.** Die Empfehlung nennt für
  `findNextPowerOf2` zuerst `2 ** Math.ceil(Math.log2(x))`, für `isPowerOf2`
  `Math.log2(n) % 1 === 0`. Beide sind oberhalb von etwa `2 ** 49` falsch:
  `Math.log2(2 ** 50 + 1)` ist in V8 genau `50` (nachgesehen), also gäbe die erste
  `2 ** 50 < x` zurück, und `Math.log2(2 ** 50 + 2) % 1` ist `0`, also hielte die zweite
  `2 ** 50 + 2` für eine Zweierpotenz. Das Paket soll aber für den ganzen Eingaberaum
  richtig rechnen. Gewählt ist deshalb die zweite Variante der Empfehlung (Schleife mit
  `p *= 2`, deren obere Grenze `Infinity` ist) und für `isPowerOf2` der Wächter der
  Empfehlung (`Number.isInteger(n) && n > 0`) mit exaktem Halbieren statt `log2`. Die
  Entscheidung »wo die Empfehlung zwei Wege nennt, gilt der erste« zielt auf den
  Breaking Change; keiner der beiden Wege bricht etwas, der erste rechnet nur falsch.
- **`findNextPowerOf2(NaN)` ist `NaN`**, nicht `1` und kein Throw: wie `Math.ceil` und
  `Math.log2` gibt die Funktion `NaN` weiter. Kein Aufrufer im Repo kann `NaN`
  hineingeben (Bildmaße, ganzzahlige Framezahl in `FrameBasedAnimations.ts:79-80`).
- **`unpick` über `Reflect.ownKeys()` mit Filter auf aufzählbare Keys** — so steht es in
  »Entscheidungen« (Reflect.ownKeys, bleibt öffentlich). Der Filter hält die String-Keys
  bei genau der Menge, die `Object.entries()` liefert; nicht aufzählbare Keys kamen nie mit
  und kommen weiter nicht mit.
- **`#declared` fällt weg** — die Empfehlung zu BUG-090 weist selbst darauf hin, dass
  `#props` und `#declared` dieselbe Information doppelt halten, und nach dem Fix liest
  niemand mehr `#declared`.
- **Migrationsabschnitt nur für `Dependencies#update()`** — der einzige der vier Fixes, bei
  dem ein Aufrufer, der heute bekommt, was er will (teilweises Schreiben über `update()`),
  danach etwas anderes bekommt.

## Triage (Zug 0)

- **Folgen aus erledigten Paketen:** offen war nur die `Folgen:`-Zeile von Paket 5 (zwei
  Stellen in `controls/PanControl2D.ts`). Keine teilt eine Ursache mit Paket 6. Beide sind
  Schaden aus Paket 5 und gehen zusammen in das neue **Paket 10** (`Folge von: Paket 5`),
  einsortiert direkt hinter Paket 6:
  - `PanControl2D.ts:504-506` — der Akkord-Zweig beendet den Pan, gibt den Cursor aber
    nicht zurück: **Symptom** der Ursache, die Paket 5 behoben hat (ein Pointer endet
    sauber — `pointerup` und `pointercancel` rufen `#restoreCursorUnlessMouseDown()`, der
    dritte Weg nicht). Vor Paket 5 blieb der Eintrag im Akkord stehen und der Pan ruhte
    nur; seit Paket 5 ist er beendet und nicht wieder aufnehmbar (ein Akkord löst kein
    `pointerdown` aus), der versteckte Cursor passt zu keinem Zustand mehr.
  - `PanControl2D.ts:270-273` mit `display/Stylesheets.ts:49-76` — je Cursor-Wert eine
    Regel, die niemand freigibt: **echte Folge**. Vor Paket 5 gab es eine Regel
    `PanControl2D` je Root, die umgeschrieben wurde (`git show b7dd540:…PanControl2D.ts`,
    Zeile 204); die Regel je Wert ist neu und hat keine Lebensdauer.
  Zusammengelegt, weil beide dieselbe Datei und dieselbe Cursor-Behandlung betreffen und
  beide low sind; ein eigener Runner je Stelle kostete das Doppelte für dieselbe Lesearbeit.
- **Offene Befunde:** kein Eintrag liegt in `utils/` oder `sprites/`. Der nächste
  Verwandte — `texture/TileSet.ts:147-148`, `padding << 1` schneidet einen gebrochenen
  `padding` ab — ist dieselbe Art Defekt (Bit-Schieben als Arithmetik), aber eine andere
  Stelle mit eigener Layout-Mathe und eigenen Tests in `texture/`; keine gemeinsame
  Ursache mit den Helfern hier. Er bleibt in der Queue (`→ Scope`, Drain-Runde).

## Verlauf

- 2026-09-19 Zug 0: Detailplan steht · BUG-090, BUG-091, BUG-092, BUG-089 unverändert
  · Folgen aus Paket 5 (`PanControl2D.ts:504-506`,
  `PanControl2D.ts:270-273`) → neues Paket 10, einsortiert hinter Paket 6 · aus »Offene
  Befunde« nichts übernommen
- 2026-09-19 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-6.impl-1.json`
- 2026-09-19 Zug 2: FERTIG · 11 Dateien (5 Quellen, 5 Specs, CHANGELOG) · roter Lauf 9 Tests wie erwartet · Arbeitsbaum schmutzig
- 2026-09-19 Zug 3: Reviewer beauftragt (sonnet, effort low), Diff `paket-6.diff`
- 2026-09-19 Zug 3: Review 1 — alle 4 Findings behoben, 0 kritisch, 0 wichtig, 1 klein · `paket-6.review-1.json`
- 2026-09-19 Zug 4: keine Runde nötig
- 2026-09-19 Zug 5: `pnpm run ci` Exit 0 (`paket-6.verify.log`) · Commit a25e927

## Findings im Volltext

**BUG-090 · medium · packages/twopoint5d/src/utils/Dependencies.ts:108-130, 136-137, 143-158, 177-185** — Dependencies.update() die Regel »fehlender Key = abwesend« beachten lassen, die equals() anwendet

`equals()` läuft über jeden deklarierten Key und behandelt einen in `nextProps` fehlenden
Key als abwesend (das TSDoc sagt das ausdrücklich), `update()` läuft aber nur über die in
`nextProps` vorhandenen Keys und lässt die anderen unberührt. Nachvollzogen mit
`new Dependencies(['a','b'])`, `update({a: 1, b: 'x'})`, dann `changed({a: 2})`: `equals`
sieht `b`: cur `'x'`, next `undefined` → `false`; `update({a: 2})` lässt `b = 'x'`; das
nächste `changed({a: 2})` gibt wieder `true` — für immer. Wer einen Key weglässt, bekommt
nicht »abwesend«, sondern einen Change-Detector, der sich nie beruhigt; in map2d hieße das
ein Recompute pro Frame. Die drei Aufrufer im Repo übergeben zufällig jeden Key, die Falle
ist latent, aber die Klasse ist exportiert und ihr TSDoc behauptet das Gegenteil dessen,
was passiert. Der Fix aus `edbd3c0` (nur deklarierte Keys speichern) hat diese Hälfte nicht
berührt.

Empfehlung: In `update()` die deklarierten Keys (`this.#props`) iterieren und
`nextProps[name]` für jeden schreiben, sodass ein ausgelassener Key im State `undefined`
wird — das entspricht dem dokumentierten `equals()`-Vertrag. Spec: einen Key auslassen und
das zweite `changed()` auf `false` assertieren. Nebenbei halten `#props` und `#declared`
dieselbe Information doppelt.

**BUG-091 · low · packages/twopoint5d/src/utils/findNextPowerOf2.ts:1-5; utils/isPowerOf2.ts:1** — Die Zweierpotenz-Helfer außerhalb des Int32-Bereichs korrekt halten

`<<=` arbeitet auf Int32. Für jedes `x > 2**30` ist die Folge
`1<<30 → -2147483648 → 0 → 0 …`, und `x > 0` bleibt wahr: Die Funktion kehrt nie zurück
(Tab hängt). `isPowerOf2` trunkiert ebenfalls auf Int32, `isPowerOf2(2**32 + 1)` ist
`true`, und sie akzeptiert Nicht-Integer (`isPowerOf2(2.5)` → `true`). Beide sind
öffentliche Exporte; die Aufrufer im Repo füttern Bildmaße, heutige Eingaben sind sicher,
aber eine Endlosschleife ist der falsche Fehlermodus für eine Utility mit dem Namen einer
reinen Funktion.

Empfehlung: `findNextPowerOf2`: `x <= 1 → 1` guarden, `2 ** Math.ceil(Math.log2(x))` oder
eine `p *= 2`-Schleife mit oberer Grenze. `isPowerOf2`:
`Number.isInteger(n) && n > 0 && Math.log2(n) % 1 === 0`. Randfälle in beide Specs.

**BUG-092 · low · packages/twopoint5d/src/utils/unpick.ts:1-2; utils/unpick.spec.ts:9-12** — unpick für Symbol-Keys reparieren (oder streichen) — die Spec besteht aus dem falschen Grund

`Object.entries` liefert nie symbolgeschlüsselte Properties, `unpick` entfernt also jeden
Symbol-Key, ob benannt oder nicht — `unpick({[S]: 1, a: 2}, 'a')` ist `{}`. Die Spec »with
symbols« erwartet genau das Ergebnis, das das Verwerfen aller Symbole produziert, beweist
also nichts über Symbol-Handling. `unpick` ist aus `utils/public-api.ts` exportiert, aber
nichts in `packages/` oder `apps/` importiert es — tote öffentliche API mit Defekt.

Empfehlung: Entweder über `Reflect.ownKeys(o)` mit `filter(k => !keys.includes(k))`
implementieren und in der Spec assertieren, dass ein unbenanntes Symbol überlebt, oder aus
der Oberfläche entfernen. Wird API-027 mit `setValues(unpick(options, …))` gelöst, behalten
und reparieren.

**BUG-089 · low · packages/twopoint5d/src/sprites/AnimatedSprites/AnimatedSpritesMaterial.ts:7-10, 48-52** — time aus den AnimatedSpritesMaterial-Konstruktoroptionen lesen oder aus dem Interface streichen

`time` ist Teil der öffentlichen Konstruktoroptionen, der Konstruktor liest aber nur
`animsMap`; `options.time` erreicht `#timeUniform` nie. Wer die Animationsuhr über den
Konstruktor seedet, bekommt `0` und keine Warnung. Dieselbe Form wie API-027, eine Ebene
tiefer.

Empfehlung: `if (options?.time != null) this.time = options.time;` nach `super(options)`,
plus eine Einzeiler-Spec; oder das Feld aus dem Interface streichen (Breaking Change,
CHANGELOG-Eintrag).

## Urteil des Reviewers (Review 1)

- BUG-090 behoben — `Dependencies.ts` `update()` iteriert `#props`, ausgelassener Key wird `undefined`; `#declared` entfernt
- BUG-091 behoben — `findNextPowerOf2.ts` verdoppelt (`p *= 2`), `isPowerOf2.ts` prüft ganzzahlig und halbiert exakt
- BUG-092 behoben — `unpick.ts` über `Reflect.ownKeys` mit `propertyIsEnumerable`-Filter
- BUG-089 behoben — `AnimatedSpritesMaterial.ts` setzt `time` nach `super(options)`
- klein: `unpick.ts` — Zuweisung `result[key] = o[key]` setzt bei einem eigenen Key `"__proto__"` den Prototyp statt einer Datenproperty; als Folge im Plan vermerkt
