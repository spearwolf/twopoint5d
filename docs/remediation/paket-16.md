# Paket 16 — Zahlenprüfungen in TileSet, DynamicAtlas und VertexObjectDescriptor über die gemeinsamen Helfer

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nachtrag zu Paket 11: dessen `Folgen:`-Zeile, im Zug 0 von Paket 11b als Symptom eingeordnet)
- Folge von: Paket 11
- Ziel: Die letzten Grundform-Prüfungen der Library, die ihre Meldung von Hand bauen, laufen über die Helfer aus `src/utils/`, wie die Regel »Error and warning messages« in `AGENTS.md` es seit Paket 11 verlangt — `TileSet` über `assertFinite()`/`assertPositiveFinite()` und `DynamicAtlas` über `assertPositiveFinite()` mit unverändertem Wortlaut, `vertexCount` von `VertexObjectDescriptor` über `assertWholeNumber(…, 1)` mit dem Wortlaut »a whole number of 1 or more« der übrigen Library.
- Modell: mittlere Stufe (`sonnet`)
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/texture/TileSet.ts` (Imports `:1-6`, Prüfungen `:287-295` in `#createTextureCoords`)
  - `packages/twopoint5d/src/texture/TileSet.spec.ts` (`describe('degenerate options')`, ein Test nach `:100-106`)
  - `packages/twopoint5d/src/texture/DynamicAtlas.ts` (Imports `:1-7`, `check` in `#sizeOf()` `:567-576`)
  - `packages/twopoint5d/src/texture/DynamicAtlas.spec.ts` (Tabelle `refuses the size %o` `:614-618`)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts` (Imports `:1-10`, TSDoc `:114`, `#validate()` `:155-158`)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.spec.ts` (`:238-251`)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]` → `### Changed`, bestehender Eintrag `:60`)
- Vorgehen:
  1. **Specs zuerst.** Kein Bugfix, sondern ein Umzug auf die Helfer: die Specs halten den Wortlaut fest, den die Helfer schreiben müssen.
     a. `src/texture/TileSet.spec.ts`, im `describe('degenerate options')` direkt nach dem Test `'a baseCoords width that is not finite is refused'` (`:100-106`) ein neuer Test `'a baseCoords height that is not finite is refused'`: mit `const options = {tileWidth: 16, tileHeight: 16, tileCount: 4};` wirft `new TileSet(new TextureCoords(0, 0, 64, NaN), options)` genau `new RangeError('TileSet: baseCoords.height must be a finite number, got NaN')` — dieselbe Form wie der Breiten-Test darüber. Grund: von den vier umgestellten `TileSet`-Prüfungen ist `baseCoords.height` die einzige, deren Wortlaut keine Spec exakt prüft (`baseCoords.width` `:104`, `tileWidth` `:111`/`:123`, `tileHeight` `:117` tun es).
     b. `src/texture/DynamicAtlas.spec.ts`, Tabelle `:614-618`, eine vierte Zeile: `[{width: '4' as never, height: 4}, 'DynamicAtlas: the width of the frame "a" must be a finite number above 0, got "4"']`. Grund: hält fest, dass ein Wert ohne Zahlentyp über den Helfer dieselbe Meldung bekommt (die drei Zeilen davor prüfen nur Zahlen).
     c. `src/vertex-objects/VertexObjectDescriptor.spec.ts:238-251`: Testname `:238` `'a vertexCount that is not a positive integer'` → `'a vertexCount that is no whole number of 1 or more'`; erwartete Meldungen `:243` → `'VertexObjectDescriptor: vertexCount must be a whole number of 1 or more, got 0'` und `:249` → `'VertexObjectDescriptor: vertexCount must be a whole number of 1 or more, got "4"'`. Die Schleife `:239-241` (`0`, `1.5`, `-1` → `RangeError`) bleibt.
     d. Lauf vor jeder Codeänderung: `pnpm nx test twopoint5d -- src/texture/TileSet.spec.ts src/texture/DynamicAtlas.spec.ts src/vertex-objects/VertexObjectDescriptor.spec.ts`. Erwartet: a und b grün (der Wortlaut stimmt schon), c rot mit genau zwei Fehlschlägen (`:243`, `:249`). Diese Ausgabe gehört in den Report.
  2. **`src/texture/TileSet.ts`.** Imports `import {assertFinite} from '../utils/assertFinite.js';` und `import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';` dazu. Die vier Aufrufe `:287-295` werden, in derselben Reihenfolge:
     ```ts
     assertFinite(baseWidth, 'TileSet', 'baseCoords.width');
     assertFinite(baseHeight, 'TileSet', 'baseCoords.height');
     assertPositiveFinite(this.tileWidth, 'TileSet', 'tileWidth');
     assertPositiveFinite(this.tileHeight, 'TileSet', 'tileHeight');
     ```
     Die Bedingungen sind gleich: `Number.isFinite(x)` ist `isFiniteNumber(x)`, `Number.isFinite(x) && x > 0` ist `isPositiveFinite(x)`, und die Helfer schreiben `TileSet: <name> must be a finite number[ above 0], got <describeValue>` — Zeichen für Zeichen die Meldung von `assertOption()`. `assertOption()` (`:64-68`) bleibt für `tileCount` (`:299-305`): dessen Meldung nennt eine Obergrenze (`a whole number from 1 to ${TileSet.MaxTiles}`) und schreibt nach `AGENTS.md` ihre eigene. Kommentar `:281-286` und das Konstruktor-TSDoc `:132-140` bleiben, wie sie sind.
  3. **`src/texture/DynamicAtlas.ts`.** Import `import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';` dazu. `check` in `#sizeOf()` (`:568-575`) wird zur Einzeile über den Helfer, der Rest der Methode bleibt:
     ```ts
     const check = (value: unknown, what: string): number =>
       Math.ceil(assertPositiveFinite(value, WHERE, `the ${what} of the frame ${describeValue(name)}`));
     return {width: check(given.width, 'width'), height: check(given.height, 'height')};
     ```
     Der Frame-Name geht weiter durch `describeValue()` — ein `TextureAtlasFrameName` kann ein Symbol sein (`TextureAtlas.ts:30`, Regel in `AGENTS.md`). Breite vor Höhe wie bisher. Kein Kommentar zum Namen, der jetzt auch bei gültiger Größe gebaut wird: `add()` ist kein Hot Path (keine Allocation-Spec erfasst `DynamicAtlas`, `add()` zeichnet in ein Canvas); `TexturePackerJson.ts:154` und `AsepriteJson.ts:404` bauen ihren Namen genauso vorab. Das TSDoc `@throws {RangeError} for a size that is no finite number above 0` (`:331`) bleibt.
  4. **`src/vertex-objects/VertexObjectDescriptor.ts`.** Import `import {assertWholeNumber} from '../utils/assertWholeNumber.js';` dazu. In `#validate()` wird `:156-158` zu
     ```ts
     if (vertexCount != null) assertWholeNumber(vertexCount, 'VertexObjectDescriptor', 'vertexCount', 1);
     ```
     Die Bedingung ist gleich (`isPositiveInteger` = `Number.isInteger(v) && v >= 1`, beide lehnen `'4'`, `1.5`, `0`, `NaN` ab), die Meldung lautet jetzt `VertexObjectDescriptor: vertexCount must be a whole number of 1 or more, got <describeValue>`. `isPositiveInteger` (`:12`) bleibt für die Attributgröße `:167`. TSDoc `:114` → ``1. `vertexCount`, when given, is a whole number of 1 or more (`RangeError`)``. Die Zeilen `:115-116` des TSDoc bleiben (sie gehören zur Attributgröße).
  5. **`CHANGELOG.md`**, `## [Unreleased]` → `### Changed`, im bestehenden Eintrag `:60` (»the `RangeError` of a refused number reads alike throughout the library …«) die Stelle ``… `copyAttributes()` of `VertexObjectBuffer` and the constructor of `VOBufferPool`, and for `NaN` …`` ersetzen durch ``… `copyAttributes()` of `VertexObjectBuffer`, the constructor of `VOBufferPool` and the `vertexCount` of `new VertexObjectDescriptor()`, and for `NaN` …``. Kein neuer Eintrag: `TileSet` und `DynamicAtlas` ändern keinen Wortlaut, und die Angleichung der Meldungen steht schon in diesem Eintrag. Der veröffentlichte Eintrag `:1861` (»no positive integer«) bleibt — ein Release-Abschnitt ist Historie.
  6. `pnpm format` (Biome sortiert die neuen Imports), dann die drei Specs aus 1d erneut: alle grün.
- Nicht anfassen (geprüft im Zug 0, mit Grund):
  - `TileSet.ts:299-305` `tileCount` — Obergrenze, eigene Meldung nach `AGENTS.md`.
  - `VertexObjectDescriptor.ts:167-171` (Attributgröße, »needs a size of at least 1 (a positive integer size or at least one component)«) und `:185-191` (Index, »must be an integer in 0 … n« samt Position) — Meldungen, die mehr sagen als die Grundform; Paket 11 hat die Index-Meldung in seinem Schritt 4 ausdrücklich stehen lassen, die Größen-Meldung gehört in dieselbe Klasse (Hinweis hinter dem Wert).
  - `VOBufferPool.ts:138-142` (`usedCount`) — eigener Eintrag in »Offene Befunde«, eigene Ursache (fehlende Typprüfung, `±Infinity` wird geklemmt, passt auf keinen Helfer).
  - `StageTransition.ts:167-169` (`progress`) — nimmt `±Infinity` und klemmt, kein Helfer passt.
  - `checkFeature.ts:112-116` (`needs a finite order`) — `TypeError` und die Satzform »needs …« der Nachbarmeldungen `:109`/`:119`; ein Helfer machte daraus einen `RangeError`.
  - `FrameBasedAnimations.ts:162`/`:594` — Satzform »— a … is …«, die Paket 11 als Klasse ausgenommen hat (`:266`, `:533-556`, `:735`).
  - Alles, was Paket 11 in seinem Schritt 4 als »bleibt« aufzählt (Hot Paths in `map2d/`, `Map2DSpatialHashGrid` mit mehreren Werten, Obergrenzen, `sampleAtlasFrame.ts:103-105`, `copyWithin()`/`toAttributeArrays()`). Nicht suchen gehen: die Liste oben ist abschließend.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): refuse a vertexCount in the words of every whole-number check and check the measures of a tile set and a dynamic atlas frame through the shared helpers`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · `TileSet.ts:287-295` unverändert (Plan nannte `:287-294`, Datei seit b91ab441 unberührt) · `DynamicAtlas.ts:568-575` unverändert · dazu `VertexObjectDescriptor.ts:157` als drittes Symptom derselben Ursache (an d9b648bf unverändert, in Schritt 4 von Paket 11 weder umgestellt noch ausgenommen) · keine offene `Folgen:`-Zeile im Plan · kein Eintrag in »Offene Befunde« teilt die Ursache (`VOBufferPool.ts:138-142` nachgesehen, bleibt) · Restplan unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt (sonnet, effort low), Report `paket-16.impl-0.json`
  - 2026-11-01 Zug 2: FERTIG · 7 Dateien geändert (TileSet.ts/.spec, DynamicAtlas.ts/.spec, VertexObjectDescriptor.ts/.spec, CHANGELOG.md) · roter Lauf 2 failed (VertexObjectDescriptor.spec) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-16.verify.log`)
  - 2026-11-01 Zug 3: Reviewer (sonnet, low): alle Schritte erfüllt, kein kritischer/wichtiger Befund, ein kleiner · Diff `paket-16.diff`
  - 2026-11-01 Zug 4: keine Runde nötig
  - 2026-11-01 Zug 5: Commit 06c8ccb7

## Abgleich (Zug 0)

- **`TileSet.ts`** — unverändert. Die vier Prüfungen stehen an `:287-295` (`baseCoords.width`/`height` über `assertOption(Number.isFinite(…), …, 'a finite number', …)`, `tileWidth`/`tileHeight` über `assertOption(Number.isFinite(…) && … > 0, …, 'a finite number above 0', …)`); `margin`/`padding`/`spacing` (`:296-298`) und `firstId` (`:307`) laufen seit Paket 11 über die Helfer. Specs prüfen den Wortlaut exakt an `TileSet.spec.ts:104`, `:111`, `:117`, `:123`.
- **`DynamicAtlas.ts`** — unverändert. `check` in `#sizeOf()` `:568-575` baut `${WHERE}: the ${what} of the frame ${describeValue(name)} must be a finite number above 0, got ${describeValue(value)}` von Hand, danach `Math.ceil`. Einziger Aufrufer `add()` `:343`. Specs `DynamicAtlas.spec.ts:615-617` prüfen den Wortlaut exakt.
- **`VertexObjectDescriptor.ts:157`** — neu im Zug 0. `vertexCount != null && !isPositiveInteger(vertexCount)` → `RangeError` »vertexCount must be a positive integer«: eine Grundform-Prüfung (ganze Zahl ab 1) mit dem alten Wortlaut, den Paket 11 in `VertexObjectPool`, `VertexObjectBuffer` und `VOBufferPool` (»a non-negative integer« → »a whole number of 0 or more«) angeglichen hat. Sie steht in Schritt 4 von Paket 11 weder bei den umgestellten Stellen noch bei den Ausnahmen (dort nur `VertexObjectDescriptor.ts:186`, die Index-Meldung). Einordnung: Symptom der Ursache von Paket 11 — hätte Paket 11 seine neue Regel (»a whole number of 1 or more« für jede Grundform) zu Ende durchgezogen, gäbe es die Stelle nicht. Specs `VertexObjectDescriptor.spec.ts:243`, `:249` prüfen den alten Wortlaut.
- **Suche nach weiteren Stellen**, damit das Nachtragspaket die Ursache abschließt: `grep` über `src/` (ohne Specs und `src/utils/assert*`) nach Meldungen mit `must be`, `integer`, `positive`, `non-negative`, `finite`, `at least`, `or above`, `number`, `NaN`, `Infinity` und Vergleichsoperatoren. Jeder Treffer außer den drei oben ist eine Meldung, die mehr sagt (Obergrenze, Position, Beziehung, Hinweis), eine Satzform ihrer Nachbarn, ein Hot Path mit Begründung oder ein Wert, der `±Infinity` annimmt — einzeln unter »Nicht anfassen«.

## Entscheidungen des Zugs 0

- **`VertexObjectDescriptor.ts:157` ins Paket.** Dieselbe halb behobene Ursache wie `TileSet` und `DynamicAtlas`; ein Nachtragspaket zählt alle Fundstellen auf. Ziel, Titel und Bereich im Plan sind entsprechend erweitert. Weil sich hier der Wortlaut ändert, wird der `Changed`-Eintrag von Paket 11 unter `[Unreleased]` um `new VertexObjectDescriptor()` ergänzt, kein eigener Eintrag (Paket 11 hat die Angleichung dort schon als Ganzes beschrieben; die Fehlerart und die abgelehnten Werte bleiben, kein **BREAKING**).
- **Die zusammengesetzten Meldungen mit »integer« bleiben.** `AGENTS.md` verlangt für Meldungen, die mehr sagen, »the same words«; Paket 11 hat die Index-Meldung von `VertexObjectDescriptor` und `copyWithin()`/`toAttributeArrays()` trotzdem ausdrücklich stehen lassen, und sein Reviewer hat das freigegeben. Die Attributgröße `:169` gehört in dieselbe Klasse. Sie hier umzuformulieren hieße, die Entscheidung von Paket 11 neu aufzurollen und dieselbe Validierungsfunktion halb umzustellen.
- **Zwei Specs dazu, obwohl kein Bugfix.** `baseCoords.height` und ein Nicht-Zahlen-Wert in `DynamicAtlas` sind die beiden umgestellten Pfade ohne exakte Wortlaut-Prüfung; ein Tippfehler im `name`-Argument eines Helfers fiele sonst durch das Gate. Beide sind vor und nach der Änderung grün — sie sind keine Regressionstests, sie halten den Wortlaut fest.
- **`check` in `DynamicAtlas` bleibt als Closure**, nur ihr Rumpf geht auf den Helfer: kleinster Diff, Reihenfolge Breite vor Höhe bleibt sichtbar.
- **Commit-Typ `fix`.** Die `vertexCount`-Meldung weicht vom dokumentierten Meldungsvertrag der Library ab und ändert sich sichtbar; `TileSet` und `DynamicAtlas` sind reiner Umzug und reisen mit. Ein `refactor` mit geänderter Meldung und CHANGELOG-Eintrag wäre falsch etikettiert.
- **Modell mittlere Stufe, Effort `low`.** Drei kleine Stellen mit exakten Ersetzungen, Specs und CHANGELOG-Wortlaut stehen hier; nichts zu suchen, kein Hot Path, keine Nebenläufigkeit.

## Fundstellen im Volltext

Dieses Paket hat kein eigenes Audit-Finding. Seine Grundlage ist die `Folgen:`-Zeile von Paket 11 im Plan:

> die Regel »Error and warning messages« in `AGENTS.md:123ff.` nennt jetzt alle fünf Helfer für jede Grundform-Meldung; zwei Grundform-Prüfungen außerhalb der abschließenden Liste aus Schritt 4 laufen weiter von Hand — `packages/twopoint5d/src/texture/TileSet.ts:287-290` (`baseCoords.width`/`height` »a finite number«, `tileWidth`/`tileHeight` »a finite number above 0« über `assertOption()`, wären `assertFinite()`/`assertPositiveFinite()` mit identischer Meldung) und `packages/twopoint5d/src/texture/DynamicAtlas.ts:568-575` (`check` in `#sizeOf()` baut die Meldung von `assertPositiveFinite()` von Hand nach, kein Hot Path).

Dazu im Zug 0 dieses Pakets: `packages/twopoint5d/src/vertex-objects/VertexObjectDescriptor.ts:157` — `vertexCount must be a positive integer`, die Grundform »a whole number of 1 or more« im alten Wortlaut (Abgleich oben).

## Urteil des Reviewers (Zug 3)

- TileSet (`TileSet.ts:289-292`, Spec `TileSet.spec.ts:108`): erfüllt
- DynamicAtlas (`DynamicAtlas.ts:569-570`, Spec `DynamicAtlas.spec.ts:618`): erfüllt
- VertexObjectDescriptor (`VertexObjectDescriptor.ts:157`, TSDoc `:115`, Spec `:238`/`:243`/`:249`): erfüllt
- CHANGELOG `:60`: erfüllt
- Klein: `VertexObjectDescriptor.ts:115-117` — Punkt 2 des TSDoc sagt »a positive integer `size`« neben »a whole number of 1 or more« in Punkt 1; gewollt (eigene Meldungsklasse), liest sich aber wie ein Rest.
