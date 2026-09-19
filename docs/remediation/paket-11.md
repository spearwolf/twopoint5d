# Paket 11 — utils: Nachtrag — `unpick` übernimmt einen eigenen Key `"__proto__"` als Datenproperty

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Folge aus Paket 6, kein Audit-Finding)
- Folge von: Paket 6
- Ziel: `unpick()` übernimmt jeden eigenen aufzählbaren Key, den es nicht entfernen soll, als eigene Datenproperty des Ergebnisses — `"__proto__"` eingeschlossen — und setzt nie den Prototyp des Ergebnisses.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/utils/unpick.ts`, `packages/twopoint5d/src/utils/unpick.spec.ts`
- Vorgehen:
  1. **Regressionstests zuerst**, in `packages/twopoint5d/src/utils/unpick.spec.ts`, im bestehenden `describe('unpick', …)` hinter dem Test `takes no property that is not enumerable` und vor `return undefined if object is not defined`. Die Quelle entsteht mit `JSON.parse()`, weil nur so ohne Tricks ein eigener aufzählbarer Key `"__proto__"` entsteht (ein Objektliteral `{__proto__: …}` setzt den Prototyp und legt keinen Key an). Getypt als `Record<string, unknown>`, damit `unpick(source, '__proto__')` ohne Cast compiliert. Nicht `toEqual()` auf das ganze Ergebnis — Vergleiche über `Reflect.ownKeys()`, `Object.getPrototypeOf()` und `Object.getOwnPropertyDescriptor()`, sonst prüft der Test die Eigenheiten des Matchers statt des Objekts. Drei Tests, exakt so:

     ```ts
     test('keeps an own "__proto__" key as a data property and leaves the prototype alone', () => {
       const source: Record<string, unknown> = JSON.parse('{"__proto__": {"polluted": 1}, "a": 2}');
       const result = unpick(source)!;

       expect(Reflect.ownKeys(result)).toEqual(['__proto__', 'a']);
       expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
       expect(Object.getOwnPropertyDescriptor(result, '__proto__')).toEqual({
         value: {polluted: 1},
         writable: true,
         enumerable: true,
         configurable: true,
       });
       expect('polluted' in result).toBe(false);
     });

     test.each([null, 5, 'x'])('keeps an own "__proto__" key whose value is %s', (value) => {
       const source: Record<string, unknown> = JSON.parse(`{"__proto__": ${JSON.stringify(value)}, "a": 2}`);
       const result = unpick(source)!;

       expect(Reflect.ownKeys(result)).toEqual(['__proto__', 'a']);
       expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
       expect(Object.getOwnPropertyDescriptor(result, '__proto__')?.value).toBe(value);
     });

     test('drops an own "__proto__" key it is asked to remove', () => {
       const source: Record<string, unknown> = JSON.parse('{"__proto__": {"polluted": 1}, "a": 2}');
       const result = unpick(source, '__proto__')!;

       expect(Reflect.ownKeys(result)).toEqual(['a']);
       expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
     });
     ```

     Vor dem Fix laufen lassen: `pnpm nx test twopoint5d -- src/utils/unpick.spec.ts`. Erwartet rot: der erste Test (Ergebnis hat nur `['a']` und `{polluted: 1}` als Prototyp) und alle drei Fälle von `test.each` (`null` setzt den Prototyp auf `null`, `5` und `'x'` fallen still weg). Der dritte Test ist ein Wächter und läuft schon vorher grün. Die Ausgabe des roten Laufs gehört in den Report.
  2. **Fix** in `packages/twopoint5d/src/utils/unpick.ts`: in der Schleife die Zuweisung `result[key] = o[key];` (Zeile 9) durch eine Definition ersetzen, mit dem Deskriptor, den eine Zuweisung bzw. ein Spread einer neuen Property gibt, und einem Kommentar, der das Warum trägt:

     ```ts
     if (!keys.includes(key) && Object.prototype.propertyIsEnumerable.call(o, key)) {
       // defined, not assigned: assigning an own key "__proto__" (JSON.parse() makes one) would run
       // into the __proto__ setter of Object.prototype and set the prototype of the result
       Object.defineProperty(result, key, {value: o[key], writable: true, enumerable: true, configurable: true});
     }
     ```

     Alle drei Flags auf `true` sind Pflicht: fehlt eines, ist die Property im Ergebnis schreibgeschützt, unsichtbar oder nicht löschbar, wo der Spread sie offen lässt. Signatur, der frühe Ausgang für `null`/`undefined`, die Schleife über `Reflect.ownKeys(o)`, die Prüfung mit `propertyIsEnumerable` und der Kommentar über der Schleife (Zeilen 5-6) bleiben, wie sie sind — der Kommentar bleibt wahr. Formatierung nach Prettier (Teil von `pnpm lint`).
  3. Die drei Tests aus Schritt 1 laufen jetzt grün, die fünf bestehenden in `unpick.spec.ts` weiter.
  4. **Kein CHANGELOG-Eintrag.** Die zuletzt veröffentlichte Version 0.21.2 (2026-06-19) baute das Ergebnis mit `Object.fromEntries(Object.entries(o).filter(…))` (`git show 2d48f2a3:packages/twopoint5d/src/utils/unpick.ts`, danach bis `a25e927` unverändert) und übernahm `"__proto__"` damit schon als Datenproperty. Der Defekt ist innerhalb von `Unreleased` entstanden und wird dort wieder geschlossen; gegenüber dem Release ändert sich an `"__proto__"` nichts. Die bestehende Zeile `packages/twopoint5d/CHANGELOG.md:228` (»fix `unpick()`: it keeps every enumerable symbol key it is not asked to remove, as it keeps the string keys«) bleibt nach dem Fix wahr und bleibt stehen.
  5. Keine weitere Datei. `unpick` hat keinen Aufrufer in Bibliothek, Lookbook oder Browsertests (nur der Re-Export in `packages/twopoint5d/src/utils/public-api.ts:6`), keine TSDoc und keine Erwähnung in `docs/`; kein Rendering- oder GPU-Code, also kein Browsertest.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): let unpick define an own "__proto__" key on its result instead of assigning it, so the key is copied as a data property and never sets the prototype`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · Folge unverändert an `packages/twopoint5d/src/utils/unpick.ts:7-11` (HEAD `041c420`, seit `a25e927` unberührt), in Node nachgestellt: Ergebnis ohne eigenes `"__proto__"`, `polluted` geerbt; Wert `null` setzt den Prototyp auf `null`, `5` fällt weg · CHANGELOG-Zeile zu `unpick()` von `:227` nach `:228` gewandert, bleibt unverändert · Weg: `Object.defineProperty` in der bestehenden Schleife · keine offenen Folgen im Plan, kein Nebenbefund aus »Offene Befunde« mit derselben Ursache · Restplan unverändert (Paket 7 unabhängig)
  - 2026-09-19 Zug 1: Implementierer beauftragt (sonnet, effort low)
  - 2026-09-19 Zug 2: FERTIG · `unpick.ts`, `unpick.spec.ts` · roter Lauf 4 failed / 7 passed · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (sonnet, low): Folge behoben, keine Befunde · Diff `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/e44e579b-d9de-4c01-acae-af1edfbe58ff/scratchpad/paket-11.diff`
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: `pnpm run ci` exit=0 (`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/e44e579b-d9de-4c01-acae-af1edfbe58ff/scratchpad/paket-11.verify.log`) · Commit ef2e69e

## Entscheidungen in Zug 0

- **`Object.defineProperty` in der Schleife statt `Object.fromEntries`.** Paket 6 nennt beide Wege. Die Definition in der bestehenden Schleife ist ein Einzeilen-Diff an dem Code, den Paket 6 gebaut und der Reviewer abgenommen hat, und kommt ohne Cast aus. `Object.fromEntries(Reflect.ownKeys(o).filter(…).map(…))` bräuchte ein `as Partial<T>` und einen Tupel-Typ für die Einträge (`.map()` liefert sonst ein Array statt `[key, value]`) — mehr Typarbeit für dieselbe Semantik. Der Preis der Definition ist der Deskriptor, der von Hand vollständig sein muss; deshalb steht er in Schritt 2 wörtlich und ist im ersten Test geprüft.
- **CHANGELOG bleibt unberührt**, abweichend vom Bereich im Plan-Block (der den Eintrag unter `Unreleased` › Fixed nannte). Grund in Schritt 4: gegenüber Version 0.21.2 gibt es für `"__proto__"` nichts zu berichten, und die bestehende Zeile bleibt wahr.
- **Modell mittlere Stufe, Effort `low`.** Code und Tests stehen wörtlich im Plan, aber es ist ein Bugfix mit rotem Lauf vor dem Fix — die günstigste Stufe ist für reine Transkription ohne Testpflicht gedacht.
- **Einordnung bestätigt: echte Folge.** Vor dem Lauf definierte `Object.fromEntries` jeden Key (`git show e352b56:packages/twopoint5d/src/utils/unpick.ts`); die Zuweisung kam mit Paket 6. `Dependencies` aus demselben Commit schreibt in eine `Map` (`#state`), nicht in ein Objekt — dort gibt es denselben Fehler nicht, also kein weiteres Symptom.

## Folge im Volltext

**Folge aus Paket 6 · low · `packages/twopoint5d/src/utils/unpick.ts:7-11`** — Die Schleife über `Reflect.ownKeys(o)` schreibt `result[key] = o[key]`; ein eigener aufzählbarer Key `"__proto__"` (etwa aus `JSON.parse`) läuft dabei in den `__proto__`-Setter von `Object.prototype`: ist sein Wert ein Objekt oder `null`, wird er zum Prototyp des Ergebnisses (dessen Properties erscheinen dann geerbt), sonst fällt er still weg — als eigene Datenproperty kommt er nie mit. Nachgestellt in Node mit `JSON.parse('{"__proto__": {"polluted": 1}, "a": 2}')`: kein eigenes `"__proto__"`, `result.polluted` ist 1.
Abhilfe laut Paket 6: `Object.defineProperty` bzw. `Object.fromEntries` über die gefilterten Keys.

## Urteil des Reviewers

- Folge aus Paket 6: behoben — `packages/twopoint5d/src/utils/unpick.ts` definiert den Key per `Object.defineProperty` mit allen drei Flags auf `true`; Tests in `unpick.spec.ts` wie im Detailplan.
- Qualität: keine Befunde (kritisch/wichtig/klein: keine).
