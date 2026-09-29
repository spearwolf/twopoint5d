# Paket 5 — Folgen: Guard-Duplikate, Migration Guide und Kommentarform

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (keine Audit-Findings; das Paket trägt Folgen aus Paket 1 und Paket 4)
- Folge von: Paket 1, Paket 4
- Ziel: Was die Pakete 1 und 4 an Duplikaten, falschen Doku-Beispielen und Kommentarform hinterlassen haben, ist bereinigt.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - neu: `packages/twopoint5d/src/utils/isObject.ts`, `packages/twopoint5d/src/utils/isObject.spec.ts`
  - geändert: `packages/twopoint5d/src/texture/frameTrimMargins.ts`, `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `packages/twopoint5d/src/texture/checkTextureStoreData.ts`, `packages/twopoint5d/CHANGELOG.md`
  - nicht angefasst: `packages/twopoint5d/src/utils/public-api.ts` — der Helfer bleibt intern wie `isFiniteNumber`
- Vorgehen: siehe Abschnitt »Vorgehen« unten; jeder Schritt nennt den Text wörtlich.
- Verify: `pnpm run ci`
- Commit: `refactor(texture): share one isObject guard from utils between the texture modules, let the before example of typed atlas frame data in the migration guide compile against the API of 0.21.2, and let two comments of FrameBasedAnimations#add() read as their neighbours do`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · (a) `isObject` unverändert an `FrameBasedAnimations.ts:140` und `frameTrimMargins.ts:8`, dritte Stelle umgeformt: `checkTextureStoreData.ts:14` ist `isPlainObject` (schließt Arrays aus), dazu inline `:11`, beide vorbestehend (`5a673d6c`), ins Paket genommen · (b) Before-Zeile unverändert, jetzt `CHANGELOG.md:3190` · (c) doppelte Leerzeile vor `## [0.21.2]` gegenstandslos, genommen in `261bbd73` · (d) überlange Zeile unverändert `FrameBasedAnimations.ts:250` (115 Zeichen) · (e) angehängter Kommentar unverändert `FrameBasedAnimations.ts:382–384` · Folgen: keine offen außer diesen · Restplan unverändert
  - 2026-09-29 Zug 1: Implementierer beauftragt, sonnet (mittlere Stufe), effort low, Report `paket-5.impl-0.json`
  - 2026-09-29 Zug 2: FERTIG · neu `src/utils/isObject.ts`, `isObject.spec.ts`; geändert `frameTrimMargins.ts`, `FrameBasedAnimations.ts`, `checkTextureStoreData.ts`, `CHANGELOG.md` · Baum schmutzig · `pnpm run ci` exit=0 (`paket-5.verify.log`)
  - 2026-09-29 Zug 3: Reviewer beauftragt, sonnet, effort low, Diff `paket-5.diff`
  - 2026-09-29 Zug 3: Urteil freigeben, keine kritischen oder wichtigen Befunde (`paket-5.review-0.json`)
  - 2026-09-29 Zug 4: entfällt, 0 Runden
  - 2026-09-29 Zug 5: Commit `35e7942e`, Verify `paket-5.verify.log` exit=0

## Die Folgen im Volltext

Quelle: die `Folgen:`-Zeile von Paket 5 im Plan, gespeist aus den kleinen
Reviewer-Befunden von Paket 1 (`801906f3`) und Paket 4 (`98f2f561`).

**(a) aus Paket 1 · `src/texture/FrameBasedAnimations.ts:140`, `src/texture/frameTrimMargins.ts:8`, `src/texture/checkTextureStoreData.ts:14`** —
wortgleiche lokale `isObject`-Guards; ein gemeinsamer Helfer in `src/utils/`.

**(b) aus Paket 1 · `packages/twopoint5d/CHANGELOG.md` (um Zeile 3180, Abschnitt zur Typisierung der Frame-Daten)** —
das Before-Beispiel des Migration Guide hätte auch vor der Änderung nicht kompiliert.

**(c) aus Paket 1 · `packages/twopoint5d/CHANGELOG.md`** — doppelte Leerzeile vor `## [0.21.2]`.

**(d) aus Paket 4 · `src/texture/FrameBasedAnimations.ts:251`** — überlange TSDoc-Zeile an `FrameBasedAnimations#add()`.

**(e) aus Paket 4 · `src/texture/FrameBasedAnimations.ts:383–385`** — Kommentar über `if (!name)` als angehängte dritte Zeile eines fremden Kommentars.

## Abgleich

| Folge | Urteil | Fundstelle jetzt |
| --- | --- | --- |
| (a) | unverändert, dritte Stelle umgeformt | `FrameBasedAnimations.ts:140` und `frameTrimMargins.ts:8` tragen `const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;`, beide von `801906f3` neu (an der Basis `5a673d6c` fehlen sie). `checkTextureStoreData.ts:13–14` trägt `isPlainObject` = `typeof value === 'object' && value !== null && !Array.isArray(value)` und `:11` denselben Kern inline in `describeCatalogValue`; beide stehen wortgleich schon an der Basis `5a673d6c`. |
| (b) | unverändert, verschoben | `CHANGELOG.md:3190`: `const width = atlas.frame('hero').data.sourceSize.w; // any`, im Block **Before** unter `#### A \`TextureAtlas\` names the type of its frame data` (`:3181`), innerhalb `[Unreleased]` (endet `:3356`). In 0.21.2 (`62174770`) antwortet `TextureAtlas#frame()` mit `TextureAtlasFrame \| undefined` (`TextureAtlas.ts:52`) und `TextureAtlasFrame#data` ist optional (`:7`) — unter `strict` bricht die Zeile an beiden Punkten. |
| (c) | gegenstandslos | `[Unreleased]` endet mit genau einer Leerzeile vor `## [0.21.2] - 2026-06-19` (`:3357`); `801906f3` hatte die doppelte an `:3284`, `261bbd73` hat sie genommen. Die drei weiteren doppelten Leerzeilen der Datei (`:4182`, `:4224`, `:4231`) liegen in den veröffentlichten Abschnitten 0.13.0, 0.7.0 und 0.6.0 — nach dem Skill `updating-changelog` unveränderlich, kein Befund. |
| (d) | unverändert, verschoben | `FrameBasedAnimations.ts:250` hat 115 Zeichen (`   * name that was never registered. The counter moves … an \`add()\` that throws`), die Nachbarzeilen des Absatzes 89–99. `printWidth` ist 130, Lint meldet nichts; es geht um die Form des Absatzes. |
| (e) | unverändert, verschoben | `FrameBasedAnimations.ts:382–384`: der Zwei-Zeilen-Kommentar zum Zähler (so schon in `fc40b690:378–379`) und darunter ohne Satzgrenze `// the empty string counts as no name`, direkt über `if (!name) {` (`:385`). |

### Einordnung

- (a) ist ein **Symptom** der Ursache, die Paket 1 unter CONS-001 behoben hat:
  eine lokale Kopie eines Guards, der nach `src/utils/` gehört. Paket 1 hat
  `isFiniteNumber` nach `utils/` geholt und im selben Commit zwei neue lokale
  `isObject` angelegt. Paket 1 ist committet, also bringt dieses
  Nachtragspaket die Ursache zu Ende und zählt alle Fundstellen auf — auch
  `checkTextureStoreData.ts`, obwohl vorbestehend: die Folge-Zeile nennt die
  Stelle ausdrücklich, und ein Helfer, neben dem die dritte Kopie desselben
  Kerns stehen bleibt, behebt die Ursache halb. `isPlainObject` bleibt als
  lokaler Guard bestehen, weil nur dieses Modul Arrays ausschließen muss, baut
  aber auf `isObject` auf.
- (b), (d), (e) sind **echte Folgen** der Pakete 1 und 4 (dort neu
  geschrieben), klein, alle in diesem Paket.
- `src/vertex-objects/createVertexObjectPrototype.ts:219`
  (`typeof first === 'object' && first !== null`) bleibt, wie es ist: das ist
  kein Guard auf `Record<string, unknown>`, sondern eine Weiche im generierten
  Setter, der danach `first as ArrayLike<number>` schreibt, und sie liegt auf
  dem Hot Path, dessen Kommentare dort jede Indirektion begründen. Nicht Teil
  der Folge, kein Befund.

## Vorgehen

Alle Pfade relativ zu `packages/twopoint5d/`. Kein Schritt ändert Verhalten;
kein öffentliches Symbol kommt dazu oder fällt weg, deshalb **kein**
CHANGELOG-Eintrag für den Helfer. Kommentare und Doku auf Englisch.

1. **Neu `src/utils/isObject.ts`**, im Stil von `src/utils/isFiniteNumber.ts`
   (Funktionsdeklaration mit TSDoc, kein Arrow), genau dieser Inhalt:

   ```ts
   /**
    * Whether `value` is an object whose fields can be read by name: anything `typeof` calls
    * `'object'` except `null`. Arrays count, functions do not.
    */
   export function isObject(value: unknown): value is Record<string, unknown> {
     return typeof value === 'object' && value !== null;
   }
   ```

   **Nicht** in `src/utils/public-api.ts` aufnehmen — intern wie
   `isFiniteNumber`, `isPositiveFinite`, `describeValue`.

2. **Neu `src/utils/isObject.spec.ts`**, im Stil von
   `src/utils/isPowerOf2.spec.ts`, genau dieser Inhalt. Die Spec hält fest,
   dass Arrays durchgehen — darauf baut `isPlainObject` in Schritt 5 auf:

   ```ts
   import {describe, expect, it} from 'vitest';
   import {isObject} from './isObject.js';

   describe('isObject', () => {
     it('takes a plain object, an array and an instance of a class', () => {
       expect(isObject({})).toBe(true);
       expect(isObject([])).toBe(true);
       expect(isObject(new Map())).toBe(true);
     });

     it('refuses null, undefined, a primitive and a function', () => {
       expect(isObject(null)).toBe(false);
       expect(isObject(undefined)).toBe(false);
       expect(isObject(0)).toBe(false);
       expect(isObject('object')).toBe(false);
       expect(isObject(Math.max)).toBe(false);
     });
   });
   ```

3. **`src/texture/frameTrimMargins.ts`**
   - Nach Zeile 1 (`import {isFiniteNumber} from '../utils/isFiniteNumber.js';`)
     einfügen: `import {isObject} from '../utils/isObject.js';`
   - Die Zeilen 6–8 löschen (den Kommentar `// a guard, and not an object
     pattern with defaults: setFrame() calls this on the hot path, and a` /
     `// call allocates nothing` und `const isObject = …`) samt der Leerzeile
     danach (`:9`), sodass auf `export type FrameTrimMargins = …;` genau eine
     Leerzeile und dann der TSDoc-Block von `frameTrimMargins` folgt.
   - Der Grund des gelöschten Kommentars gilt weiter und wandert an die
     Aufrufstelle: im Rumpf von `frameTrimMargins()` unmittelbar **vor**
     `const spriteSourceSize = isObject(data) ? data['spriteSourceSize'] : undefined;`
     diese zwei Zeilen einfügen (zwei Leerzeichen Einrückung):

     ```ts
       // guards, and not an object pattern with defaults: setFrame() calls this on the hot path, and a
       // call allocates nothing
     ```

   - Sonst nichts an der Datei; insbesondere bleibt die TSDoc von
     `frameTrimMargins` wortgleich.

4. **`src/texture/FrameBasedAnimations.ts`**
   - Nach Zeile 4 (`import {findNextPowerOf2} from '../utils/findNextPowerOf2.js';`)
     einfügen: `import {isObject} from '../utils/isObject.js';`
   - Zeile 140 (`const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;`)
     samt der Leerzeile danach (`:141`) löschen, sodass auf
     `const isTextureSize = …;` (`:138`) genau eine Leerzeile und dann der
     Kommentar `// The limit of the device behind \`renderer\`, …` folgt.
     `readMaxTextureSize` bleibt sonst unverändert.
   - TSDoc von `add()`: die Zeilen 250–251

     ```
        * name that was never registered. The counter moves for an animation that was registered: an `add()` that throws
        * spends no name.
     ```

     ersetzen durch genau diese zwei Zeilen (95 und 40 Zeichen, wie die
     Nachbarn des Absatzes unter 100):

     ```
        * name that was never registered. The counter moves for an animation that was registered: an
        * `add()` that throws spends no name.
     ```

     Die Zeilen 245–249 des Absatzes bleiben, wie sie sind.
   - Im Rumpf von `add()` die drei Kommentarzeilen 382–384

     ```ts
         // the counter hands out a name only once the animation can be built: an add() that throws
         // spends none, and the names follow the animations that were registered
         // the empty string counts as no name
     ```

     ersetzen durch genau diese drei (vier Leerzeichen Einrückung, 94, 94
     und 62 Zeichen; Satzgrenze mit Punkt und Großbuchstaben wie im
     Kommentar über `if (frames.length === 0)` an `:362–364`):

     ```ts
         // the counter hands out a name only once the animation can be built: an add() that throws
         // spends none, and the names follow the animations that were registered. The empty string
         // counts as no name and gets one from the counter as well
     ```

     `if (!name) {` darunter bleibt.

5. **`src/texture/checkTextureStoreData.ts`**
   - Nach Zeile 5 (`import {describeValue} from '../utils/describeValue.js';`)
     einfügen: `import {isObject} from '../utils/isObject.js';`
   - In `describeCatalogValue` (`:10–11`) die zweite Zeile ersetzen durch
     `  Array.isArray(value) ? 'an array' : isObject(value) ? 'an object' : describeValue(value);`
     — die Deklaration bleibt auf zwei Zeilen (einzeilig wären es 146
     Zeichen, über `printWidth` 130).
   - `isPlainObject` (`:13–14`) ersetzen durch genau diese eine Zeile (117
     Zeichen, Prettier hält sie einzeilig):
     `const isPlainObject = (value: unknown): value is Record<string, unknown> => isObject(value) && !Array.isArray(value);`
   - Der Kommentar über `describeCatalogValue` (`:9`) und alle Aufrufer von
     `isPlainObject` bleiben unverändert.

6. **`CHANGELOG.md`**, nur innerhalb von `## [Unreleased]`: Zeile 3190 im
   Block **Before** unter `#### A \`TextureAtlas\` names the type of its frame data`

   `const width = atlas.frame('hero').data.sourceSize.w; // any`

   ersetzen durch

   `const width = atlas.frame('hero')?.data?.sourceSize.w; // any`

   Grund: gegen die API, die das Before zeigt (0.21.2), antwortet `frame()`
   mit `TextureAtlasFrame | undefined` und `data` ist optional; ab
   `sourceSize` ist alles `any` (`Record<string, any>`) und kompiliert. Der
   Block bleibt ein reines `ts`-Excerpt (kein `ts check` — `coords` ist dort
   nicht deklariert, und `pnpm typecheck` prüft gegen die aktuelle API, nicht
   gegen die alte). Die beiden anderen Zeilen des Blocks und der Prosatext
   darüber bleiben. Kein anderer Abschnitt des CHANGELOG wird angefasst, vor
   allem kein veröffentlichter.

7. `pnpm format` ist nicht nötig, schadet aber nicht; danach `pnpm run ci`.
   Die Hot-Path-Messung von `TexturedSprite#setFrame()` in
   `src/sprites/hot-path-allocations.spec.ts` läuft in `test:coverage` mit und
   muss grün bleiben — `frameTrimMargins()` ruft den Guard jetzt über einen
   Modul-Import auf.

## Offen gelassen, mit Grund

- Folge (c) entfällt, siehe Abgleich.
- Kein Regressionstest im Sinne eines roten Laufs: keiner der Schritte behebt
  einen Korrektheitsfehler. Die neue Spec in Schritt 2 hält den Vertrag des
  Helfers fest und ist vom ersten Lauf an grün.

## Urteil des Reviewers

- (a) behoben — `src/utils/isObject.ts` neu, lokale Kopien in `FrameBasedAnimations.ts` und `frameTrimMargins.ts` entfernt, `checkTextureStoreData.ts` baut `isPlainObject` und `describeCatalogValue` auf `isObject`; außerhalb nur `createVertexObjectPrototype.ts:219`, wie vorgesehen.
- (b) behoben — `CHANGELOG.md` Block **Before** in `[Unreleased]`: `atlas.frame('hero')?.data?.sourceSize.w; // any`.
- (d) behoben — TSDoc von `add()` umbrochen.
- (e) behoben — Kommentar über `if (!name)` mit Satzgrenze in den Zähler-Kommentar gezogen.
- (c) gegenstandslos, nicht im Diff.
- Klein: Kommentaranfang »guards, and not an object pattern…« an der Aufrufstelle in `frameTrimMargins.ts` liest sich etwas verkürzt, Wortlaut der Paketdatei, kein Änderungsbedarf.
