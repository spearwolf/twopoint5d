# Paket 13 — map2d: Visibility-Helfer ohne globales DOM, RepeatingTilesProvider mit Default-Achse

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (zwei Nebenbefunde aus der Befund-Queue, Drain-Runde 1; der erste deckt sich mit dem Audit-Finding ARCH-004, siehe »Abgleich«)
- Ziel: Die map2d-Helfer laufen ohne `document`, und `getTileIdsWithin()` behandelt einen ungültigen `limitToAxis` genauso wie `getTileIdAt()`.
- Modell: mittlere Stufe
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.spec.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Vorgehen (beide Teile sind Korrektheitsfixes: erst der Regressionstest, rot sehen, dann der Fix; der rote Lauf gehört in den Report). Roter und grüner Lauf gezielt, ohne Coverage-Schwellen:
  `pnpm --dir packages/twopoint5d exec vitest run src/map2d/CameraBasedVisibilityHelpers.spec.ts src/map2d/RepeatingTilesProvider.spec.ts`

  **Teil A — `CameraBasedVisibilityHelpers` ohne `document`**

  1. Regressionstest zuerst, in `CameraBasedVisibilityHelpers.spec.ts`:
     - Den Stub von `document` löschen: den Kommentar und die Hooks `beforeEach(() => { vi.stubGlobal('document', {querySelector: () => null}); })` und `afterEach(() => { vi.unstubAllGlobals(); })` am Anfang von `describe('CameraBasedVisibilityHelpers', …)` (heute Zeilen 70–78). Aus dem Import in Zeile 3 fallen `afterEach` und `beforeEach` weg (sonst ungenutzt); `vi` bleibt, `spyOnReleases()` braucht es.
     - Als ersten Test in diesem `describe` einfügen: `test('builds its set in a host without a document', …)`. Inhalt: ein Kommentar, dass die Suite in Node läuft und dort — wie in einem Worker — kein DOM existiert; `expect(typeof document).toBe('undefined')` als Wächter, dass der Test etwas misst; dann `const scene = new Object3D()`, `const helpers = new CameraBasedVisibilityHelpers(makeVisibility())`, `helpers.add(scene)`, `expect(() => { helpers.show = true; }).not.toThrow()` und `expect(scene.children).toHaveLength(5)` mit dem Kommentar `// one PlaneHelper and four point helpers` wie im Test darunter.
     - Roter Lauf: der neue Test und jeder Test, der `show` einschaltet, scheitern mit `ReferenceError: document is not defined`. Ausgabe in den Report.
  2. Fix in `CameraBasedVisibilityHelpers.ts`, `createHelpers()`: den Block `// TODO remove this!` … `// ---` (heute Zeilen 118–123: der Kommentar, `const el = document.querySelector('.map2dCoords');`, das `if (el) { el.textContent = … }` und die Schlusszeile `// ---`) samt der Leerzeile davor löschen. `createHelpers()` endet danach mit `this.hideSurplus();`. Nichts ersetzt den Block: die Koordinaten stehen öffentlich in `CameraBasedVisibility#planeCoords2D`, und kein Lookbook-Demo, kein Browsertest und keine Doku im Repo nennt `.map2dCoords` (geprüft per `grep` in Zug 0).
  3. Grüner Lauf mit demselben Kommando.

  **Teil B — `RepeatingTilesProvider#getTileIdsWithin()` mit Default-Zweig**

  4. Regressionstests zuerst, in `RepeatingTilesProvider.spec.ts`, innerhalb von `describe('getTileIdsWithin()', …)` direkt hinter dem Block `describe('agrees with getTileIdAt()', …)`:
     - Typ holen mit eigener Zeile `import type {LimitToAxisType} from './RepeatingTilesProvider.js';` (Lint verlangt `import type`).
     - Neuer Block `describe('a limitToAxis outside the type', …)` mit zwei Tests. Beide bauen den Provider mit `new RepeatingTilesProvider(pattern)` und weisen danach `provider.limitToAxis = value as unknown as LimitToAxisType` zu — über den Konstruktor würde der Default-Parameter `undefined` zu `'none'` machen. Muster: `[[1, 2, 3, 4], [5, 6, 7, 8]]`, Rechteck `left = -3, top = -1, width = 9, height = 4` (reicht über alle Kanten des Musters hinaus). Referenz: `new RepeatingTilesProvider(pattern, 'none')`.
       - `test.each(['diagonal', '', undefined, null])('%j repeats the pattern along both axes, as getTileIdAt() does', …)`: `Array.from(provider.getTileIdsWithin(-3, -1, 9, 4))` gleicht `Array.from(reference.getTileIdsWithin(-3, -1, 9, 4))`, und jede Zelle `(i, j)` gleicht `provider.getTileIdAt(-3 + i, -1 + j)`.
       - `test('writes every cell of a target it is handed, whatever limitToAxis holds', …)`: mit `limitToAxis = 'diagonal'` in ein `new Uint32Array(36).fill(99)` schreiben; das Ergebnis ist dasselbe Array (`toBe(target)`) und gleicht `Array.from(reference.getTileIdsWithin(-3, -1, 9, 4))` — keine `99` bleibt stehen.
     - Roter Lauf: die `test.each`-Fälle bekommen lauter `0`, der Target-Test behält die `99` (in Zug 0 in Node nachgestellt: Muster `[[1, 2], [3, 4]]`, `limitToAxis = 'diagonal'` → `getTileIdsWithin(0, 0, 2, 2)` ist `[0, 0, 0, 0]`, `getTileIdAt()` liefert `1, 2, 3, 4`; ein mit `99` gefülltes Target bleibt `[99, 99, 99, 99]`). Ausgabe in den Report.
  5. Fix in `RepeatingTilesProvider.ts`, `getTileIdsWithin()`: das `case 'none':` des `switch` (heute Zeile 179) bekommt wie in `getTileIdAt()` (Zeilen 83–84) ein `default:` darunter, darüber ein Kommentar: `// a value outside LimitToAxisType, which JavaScript can assign, repeats along both axes as in getTileIdAt()`. Sonst ändert sich am `switch` nichts — insbesondere wird `limitToAxis` weder zum Accessor noch geprüft: es bleibt ein öffentliches Feld, und das Ziel ist Gleichklang mit `getTileIdAt()`, nicht Abweisung.
  6. TSDoc an das Feld `limitToAxis` (heute Zeile 13), die bislang nirgends steht, was der Wert bewirkt:
     ```ts
     /**
      * The axis the pattern repeats along: `'horizontal'` repeats it along the x axis only (outside
      * its rows every id is `0`), `'vertical'` along the y axis only (outside its columns every id
      * is `0`), and `'none'` along both. Any other value, which JavaScript can assign, counts as
      * `'none'`.
      */
     ```
  7. Grüner Lauf mit demselben Kommando.

  **CHANGELOG**

  8. In `packages/twopoint5d/CHANGELOG.md` unter `## [Unreleased]` (Format nach dem Skill `updating-changelog`, Keep a Changelog 1.1.0), je ein Eintrag am Ende der Liste:
     - `### Removed` (hinter dem Eintrag zu `DependencyProp`):
       `- remove the write of the plane coordinates into the first element with the class \`map2dCoords\` from \`CameraBasedVisibilityHelpers\`: the helpers read and write no DOM, so they run in a host without one — a worker, Node — as they do in a browser. \`CameraBasedVisibility#planeCoords2D\` carries those coordinates for a page that wants to show them`
     - `### Fixed` (letzter Eintrag vor `### Migration Guide`):
       `- fix \`RepeatingTilesProvider#getTileIdsWithin()\` for a \`limitToAxis\` other than \`'horizontal'\`, \`'vertical'\` and \`'none'\`, which JavaScript can assign: the value counts as \`'none'\`, as in \`getTileIdAt()\`, so the pattern repeats along both axes and every cell of the rectangle is written`
     - Kein Abschnitt im Migration Guide: keine Signatur, kein Typ und kein Export ändert sich; wer die Anzeige in `.map2dCoords` nutzt, findet den Ersatz im Eintrag selbst.
  9. Die vier geänderten Quelldateien vor dem Verlassen ganz lesen und melden, was darin falsch ist und nicht zu diesem Paket gehört (Nebenbefunde).

- Nicht Teil des Pakets: `CameraBasedVisibilityHelpers.spec.ts:62` (`type: node.type` in `spyOnReleases()`, im Audit als CONS-022), die sechs Kopien des Wrap-Modulos in `RepeatingTilesProvider.ts` (READ-012), ein `dispose()` für die Helfer-Klassen (MEM-004) — eigene Audit-Findings außerhalb der BUG-Serie, nicht anfassen.
- Kein Browsertest: der Browser hat immer ein `document`, der DOM-lose Host ist genau die Node-Umgebung der Vitest-Suite (`vite.config.ts` setzt kein `environment`); `RepeatingTilesProvider` ist Datenlogik ohne Rendering- oder GPU-Buffer-Code. Der bestehende Browsertest `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js` läuft im Gate mit und deckt die Helfer im Browser.
- Verify: `pnpm run ci`
- Commit: `fix(map2d): let the visibility helpers run without a document and let getTileIdsWithin() take an unknown limitToAxis as 'none', like getTileIdAt()`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · DOM-Write unverändert `CameraBasedVisibilityHelpers.ts:118-123` (HEAD `69e27081`), Spec-Stub `CameraBasedVisibilityHelpers.spec.ts:70-78`, deckt sich mit ARCH-004 · `limitToAxis`-Default unverändert `RepeatingTilesProvider.ts:131` (`switch` ohne `default`, `case 'none'` in `:179`; `getTileIdAt()` mit `default` in `:84`), in Node nachgestellt · Folgen aus Paket 12 (`StageRenderer.ts:363-364`, `Stage2D.ts:82-91`/`:168-170`) als Symptome in Nachtragspaket 18 geschnitten, dazu der vorbestehende Fall `projection = undefined` (`Stage2D.ts:152-156`) mitgenommen · Restplan: 18 direkt hinter 13, 14–17 unverändert
  - 2026-09-19 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-13.impl-1.json`
  - 2026-09-19 Zug 2: FERTIG · rot vorher 17 Tests, grün danach · 5 Dateien (2 Quellen, 2 Specs, CHANGELOG) · Abweichung: Kommentar über `case 'none':` (no-fallthrough) · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer (sonnet, low) — alles erfüllt, 0 kritisch, 0 wichtig, 2 klein · Diff `paket-13.diff`, Report `paket-13.review-1.json`
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: `pnpm run ci` exit=0 (`paket-13.verify.log`) · Commit `fdba2c34`

## Abgleich

- **DOM-Write in `createHelpers()`** — unverändert. `CameraBasedVisibilityHelpers.ts:118-123` (HEAD `69e27081`) liest `document.querySelector('.map2dCoords')` und schreibt `planeCoords2D` hinein; `createHelpers()` läuft aus `update()` bei eingeschaltetem `show` und gesetzter Szene. In der Node-Umgebung der Vitest-Suite stubbt die Spec deshalb `document` (`CameraBasedVisibilityHelpers.spec.ts:70-78`). Einzige DOM-Stelle in `src/map2d/` (grep auf `document`, `window.`, `globalThis`, `navigator`). `.map2dCoords` steht nirgends sonst im Repo (Lookbook, Browsertests, Doku); eingeführt mit `3b929faa` (»refactor map2d classes and demos«).
- **`switch` ohne `default` in `getTileIdsWithin()`** — unverändert. `RepeatingTilesProvider.ts:131` (`switch (this.limitToAxis)`), Zweige `'vertical'` `:132`, `'horizontal'` `:155`, `'none'` `:179`, kein `default`; `getTileIdAt()` hat `case 'none': default:` in `:83-84`. Nachgestellt per Type-Stripping auf einer Kopie der Quelle (außerhalb des Repos): siehe Schritt 4.

### Überschneidung mit ARCH-004

Der erste Nebenbefund ist im Audit bereits als **ARCH-004** (medium, `status: unchanged`, nicht acknowledged) geführt — Kategorie Architektur, also außerhalb der BUG-Serie des Scopes. Er bleibt trotzdem in diesem Paket: die Drain-Runde hat ihn nach der Scope-Regel (`Bugs und Korrektheitsdefekte … gilt auch für Befunde, die erst im Lauf auffallen`) eingeplant, und ein `ReferenceError` in jedem DOM-losen Host ist ein Korrektheitsdefekt, gleich unter welcher Kategorie das Audit ihn führt — das Audit begründet seine Einstufung auf medium selbst mit genau dieser Folge. Der Weg folgt der Empfehlung von ARCH-004 wörtlich (Block und `vi.stubGlobal` löschen; die Anzeige, falls gewollt, aus `planeCoords2D` in einer Demo — es gibt keine). ARCH-004 wird **nicht** als Finding des Pakets geführt, der Scope bleibt formal wie er ist; der Reviewer urteilt über den Nebenbefund. Für den Abschluss: nach dem Commit ist ARCH-004 nachweislich behoben und kann mit dem Hash dieses Pakets gebucht werden.

## Findings im Volltext

**Nebenbefund · low · `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts:118-123`** (aus Paket 2, Queue-Urteil `→ Scope → Paket 13`) — `update()` schreibt über `document.querySelector('.map2dCoords')` ins globale DOM (nur `// TODO remove this!`); ohne `document` (Worker, Node) wirft es einen `ReferenceError`.

Dazu im Audit, **ARCH-004 · medium · `CameraBasedVisibilityHelpers.ts:118-123` (Spec-Workaround in `CameraBasedVisibilityHelpers.spec.ts:72-74`)** — Den DOM-Write aus `CameraBasedVisibilityHelpers.createHelpers()` entfernen.
Bibliothekscode der map2d-Schicht greift nach dem globalen `document` und einer CSS-Klasse, die keine App im Repo definiert (`.map2dCoords` findet sich nur hier und im Coverage-Report). In einem Worker, unter Node/SSR oder in jedem DOM-losen Host ist das beim ersten Update mit `show = true` ein `ReferenceError`; die Unit-Spec muss `document` stubben, um überhaupt zu laufen. Ein Überbleibsel aus einer Demo, vom eigenen `// TODO remove this!` markiert. Der Vorlauf führte den Punkt als low; die Einstufung hier folgt der Konsequenz im DOM-losen Host.
Empfehlung: Den Block und das `vi.stubGlobal` in der Spec löschen. Ist die Anzeige gewollt, `planeCoords2D` (schon öffentlich) von der Demo schreiben lassen.

**Nebenbefund · low · `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:131`** (aus Paket 2, Queue-Urteil `→ Scope → Paket 13`) — der `switch` in `getTileIdsWithin()` hat keinen `default`; ein ungültiger `limitToAxis` aus JavaScript lässt den Puffer ungefüllt, während `getTileIdAt()` ihn als `'none'` behandelt (Zeile 84).
Weg: der `default` wie in `getTileIdAt()` (Gleichklang ist das Ziel im Plan); kein Audit-Finding deckt diese Stelle.

## Reviewer-Urteil

- DOM-Write (Nebenbefund `CameraBasedVisibilityHelpers.ts:118-123`, deckt ARCH-004): behoben — `createHelpers()` endet mit `this.hideSurplus();`, Spec ohne `document`-Stub, Test `CameraBasedVisibilityHelpers.spec.ts:70`.
- `limitToAxis`-Default (Nebenbefund `RepeatingTilesProvider.ts:131`): behoben — `default:` unter `case 'none':`, TSDoc am Feld, Block `a limitToAxis outside the type` in der Spec.
- CHANGELOG: beide Einträge wortgleich zum Plan, kein Migration Guide.
- Klein: Kommentar steht wegen `no-fallthrough` über `case 'none':`, meint aber `default` · `test.each`-Zeile in `RepeatingTilesProvider.spec.ts` rund 130 Zeichen (Prettier grün).
- Abweichungen des Implementierers (vom Reviewer gebilligt): Kommentarlage wie oben; Spec-Helfer `makeProvider(value: unknown)` statt `as unknown as`.
- Nebenbefunde alle → Audit: keine Bugs, nur Konsistenz/Doku.
