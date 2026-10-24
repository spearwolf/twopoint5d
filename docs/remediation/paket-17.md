# Paket 17 — RepeatingTilesProvider: ein Subjekt in den Abweisungen von getTileIdsWithin()

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 8
- Findings: — (Folge, kein Audit-Finding; low)
- Ziel: Jede Abweisung von `RepeatingTilesProvider#getTileIdsWithin()` beginnt
  mit dem Aufruf als Subjekt, auch die zum zu kurzen `target`
  (`RepeatingTilesProvider#getTileIdsWithin(): a target for 3x2 tile ids needs 6 cells, got 5`)
  — wie die Abweisungen der Koordinaten und Anzahlen desselben Aufrufs seit
  Paket 8.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`,
  `packages/twopoint5d/src/map2d/RepeatingTilesProvider.spec.ts`,
  `packages/twopoint5d/CHANGELOG.md`
- Vorgehen:
  1. **Regressionstest zuerst, rot sehen.** In
     `packages/twopoint5d/src/map2d/RepeatingTilesProvider.spec.ts` steht heute
     Z. 347–355 der Test `'%s: refuses a target shorter than width × height'`
     (ein `test.each` über die vier `providers`). Darin nur die zweite
     Erwartung (Z. 353) ändern, von

     ```ts
     expect(read).toThrow('RepeatingTilesProvider: a target for 3x2 tile ids needs 6 cells, got 5');
     ```

     auf

     ```ts
     expect(read).toThrow('RepeatingTilesProvider#getTileIdsWithin(): a target for 3x2 tile ids needs 6 cells, got 5');
     ```

     Testname, `expect(read).toThrow(RangeError)` in Z. 352 und alles andere
     bleiben. Dann `pnpm nx test twopoint5d -- src/map2d/RepeatingTilesProvider.spec.ts`
     laufen lassen, **bevor** `RepeatingTilesProvider.ts` angefasst wird: die
     vier Fälle dieses Tests müssen rot sein (die Meldung beginnt noch mit
     `RepeatingTilesProvider: a target …`). Die Ausgabe des roten Laufs gehört
     in den Report.
  2. **Meldung angleichen.** In
     `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`, Methode
     `getTileIdsWithin()`, heute Z. 192–196:

     ```ts
     } else if (target.length < width * height) {
       throw new RangeError(
         `RepeatingTilesProvider: a target for ${width}x${height} tile ids needs ${width * height} cells, got ${target.length}`,
       );
     }
     ```

     Nur das Subjekt der Template-Zeichenkette ändern, von
     `RepeatingTilesProvider: ` auf `RepeatingTilesProvider#getTileIdsWithin(): `.
     Der Rest der Meldung bleibt Wort für Wort, ebenso die Klasse
     `RangeError` und die Stelle der Prüfung (nach den vier
     `assertWholeNumber()`-Aufrufen Z. 185–188, vor dem ersten Schreiben in
     `target`). Kein Kommentar dazu nötig — die Zeilen Z. 185–188 darüber
     tragen dasselbe Subjekt sichtbar. `assertWholeNumber()` nicht für diese
     Prüfung umbauen: sie prüft eine Länge gegen ein Produkt, keine ganze Zahl.
     Die drei Meldungen des Setters `tileIds` (Z. 75, 81, 91) behalten das
     Subjekt `RepeatingTilesProvider:` — sie sind untereinander einheitlich,
     und die Regel in `AGENTS.md` (»Error and warning messages«, Z. 113–118)
     lässt die Klasse als Subjekt zu; es geht in diesem Paket nur um die
     Einheit innerhalb eines Aufrufs.
  3. **TSDoc bleibt.** Die TSDoc von `getTileIdsWithin()` (Z. 172–183) sagt zu
     `target` nur »A shorter one throws a `RangeError`« und nennt keinen
     Wortlaut — nichts nachzuziehen.
  4. **CHANGELOG.** `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` →
     `### Changed`, der Eintrag heute Z. 123:

     ```
     - `RepeatingTilesProvider#getTileIdAt()` and `#getTileIdsWithin()` throw a `RangeError` naming the call for a coordinate that is no whole number and for a width or a height that is no whole number of 0 or more, before a cell of the target is written
     ```

     um einen Halbsatz verlängern (kein neuer Eintrag, keine
     Migration-Guide-Notiz — Klasse und Zeitpunkt des Wurfs bleiben, nur das
     Subjekt der Meldung ändert sich):

     ```
     - `RepeatingTilesProvider#getTileIdAt()` and `#getTileIdsWithin()` throw a `RangeError` naming the call for a coordinate that is no whole number and for a width or a height that is no whole number of 0 or more, before a cell of the target is written; the `RangeError` of `getTileIdsWithin()` for a `target` shorter than `width × height` names the call as well
     ```

     Skill `updating-changelog` laden; die Zeile bleibt eine Zeile wie ihre
     Nachbarn (der Abschnitt bricht Einträge nicht um). Der Eintrag zum
     `target` unter `## [0.22.0]` (Z. 1244) gehört einem veröffentlichten
     Abschnitt und bleibt unangetastet.
  5. Nichts sonst. `packages/twopoint5d/docs/map2d.md` (Z. 24–27) nennt die
     Abweisungen der Koordinaten und Anzahlen, aber weder die des `target`
     noch einen Wortlaut; kein Proposal unter `packages/twopoint5d/docs/` und
     kein Lookbook-Code zitiert die Meldung (`grep -rn "RepeatingTilesProvider:"`
     außerhalb von `node_modules`, `dist` und `docs/remediation` trifft nur
     `RepeatingTilesProvider.ts` und dessen Spec).
  6. Vor dem Gate formatieren, nur die beiden Quelldateien:
     `pnpm exec biome check --write packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts packages/twopoint5d/src/map2d/RepeatingTilesProvider.spec.ts`
     (Zeilenbreite 130 aus `biome.jsonc`; die geänderte Erwartung in Z. 353
     wird damit länger als 130 Spalten und darf von Biome umgebrochen werden;
     `pnpm lint` im Gate prüft nur).
- Verify: `pnpm run ci` (Gate); zur Fehlersuche vorab
  `pnpm nx test twopoint5d -- src/map2d/RepeatingTilesProvider.spec.ts`
- Commit: `fix(twopoint5d): let the refusal of a target too short for RepeatingTilesProvider#getTileIdsWithin() name the call, as its other refusals do`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · Folge aus Paket 8 unverändert an
    `RepeatingTilesProvider.ts:193–195` (Subjekt `RepeatingTilesProvider:`,
    die vier Prüfungen Z. 185–188 desselben Aufrufs mit
    `RepeatingTilesProvider#getTileIdsWithin()`), Spec Z. 353 prüft den alten
    Wortlaut, CHANGELOG-Eintrag Z. 123 unter `### Changed` · keine weitere
    Fundstelle derselben Ursache, auch nicht unter den Meldungen, die Paket 9
    in `src/map2d/` neu schrieb · keine offenen Folgen zu verteilen (alle
    `Folgen:`-Zeilen der erledigten Pakete sind verteilt oder `keine`) · aus
    »Offene Befunde« nichts übernommen · Restplan unverändert

## Abgleich

- **Folge aus Paket 8** — unverändert. `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:192–196`:

  ```ts
  } else if (target.length < width * height) {
    throw new RangeError(
      `RepeatingTilesProvider: a target for ${width}x${height} tile ids needs ${width * height} cells, got ${target.length}`,
    );
  }
  ```

  Die vier Prüfungen davor (Z. 185–188) gehen über
  `assertWholeNumber(…, 'RepeatingTilesProvider#getTileIdsWithin()', …)` und
  schreiben `RepeatingTilesProvider#getTileIdsWithin(): left must be a whole number, got 0.5`.
  Ein Aufruf, zwei Subjekte. Die Meldung zum `target` stand am Laufbeginn
  schon so (`git show 7341059f:packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`,
  Z. 166–167); Paket 8 hat die neuen Abweisungen daneben gesetzt und sie nicht
  angeglichen — Symptom von Paket 8, Einordnung aus Zug 0 von Paket 9 hält.
- Spec: `RepeatingTilesProvider.spec.ts:353` erwartet wörtlich
  `'RepeatingTilesProvider: a target for 3x2 tile ids needs 6 cells, got 5'`;
  Z. 375, 385, 394 und 397 erwarten für die Koordinaten und Anzahlen das
  Subjekt `RepeatingTilesProvider#getTileIdsWithin()`.
- CHANGELOG: `## [Unreleased]` → `### Changed` Z. 123 nennt für
  `getTileIdAt()`/`getTileIdsWithin()` schon »naming the call«, aber nur für
  Koordinaten und Anzahlen. Unter `## [0.22.0]` Z. 1244 steht die Abweisung des
  zu kurzen `target` (veröffentlicht, unveränderlich).
- Doku: `docs/map2d.md` Z. 24–27 nennt die Abweisungen der Koordinaten und
  Anzahlen, nicht die des `target` und keinen Wortlaut.
- Regel: `AGENTS.md` Z. 113–118 — eine Meldung beginnt mit ihrem Subjekt, der
  Klasse oder dem Aufruf. Beides ist zulässig; innerhalb eines Aufrufs mischt
  die Library sonst nicht.

## Triage der offenen Folgen und Befunde

- **Weitere Fundstellen derselben Ursache** (ein Aufruf, dessen Abweisungen
  verschiedene Subjekte tragen): keine. Geprüft nach Paket 9 über alle
  `throw`/`assertFinite`/`assertPositiveFinite` in `src/map2d/`:
  `Map2D`, `Map2DTileStreamer`, `Map2DTileCoordsUtil`, `Map2DSpatialHashGrid`
  (`add()` Z. 130 und `assertFiniteAABB()` Z. 40 beide `Map2DSpatialHashGrid:`,
  `getTiles()` Z. 234 ebenso), `RectangularVisibilityArea`
  (`computeVisibleTiles()` Z. 182 und Z. 236 beide `RectangularVisibilityArea:`)
  und `CameraBasedVisibility` (`computeVisibleTiles()` Z. 620 mit
  `CameraBasedVisibility:` wie die Setter Z. 233, 267, 319) sind je Aufruf
  einheitlich. Die drei Meldungen des Setters `RepeatingTilesProvider#tileIds`
  (Z. 75, 81, 91) tragen untereinander dasselbe Subjekt.
- **`Folgen:`-Zeilen der erledigten Pakete**: alle verteilt — Paket 2 → 14,
  Paket 5 → 15, Paket 6 → 16, Paket 8 → 9 und → 17 (dieses Paket); Pakete 1,
  3, 4, 7, 9, 14, 15, 16 ohne Folgen. Nichts neu zu verteilen.
- **»Offene Befunde«**: kein Eintrag teilt die Ursache. Der nächste Nachbar,
  `TextureStore.ts:921` (handgesetzter Artikel in der Konfliktmeldung), betrifft
  den Wortlaut einer Meldung, nicht ihr Subjekt; `Map2DTileCoordsUtil.ts:209/237`
  ist eine fehlende Prüfung, kein Subjekt. Nichts übernommen, Urteile bleiben.

## Restplan

Unverändert. Paket 17 berührt nur `RepeatingTilesProvider.ts`, dessen Spec und
eine CHANGELOG-Zeile; keines der offenen Pakete 10–13 plant in diesen Dateien
(Paket 13 stellt `src/map2d/public-api.ts` auf benannte Exporte um — der Export
`RepeatingTilesProvider` bleibt davon unberührt, die Meldung ist keine Oberfläche). Reihenfolge 17 → 10 → 11
→ 12 → 13 bleibt, kein »Hängt ab von« verschoben.
  - 2026-10-24 Zug 1: Implementierer beauftragt, sonnet (mittlere Stufe), effort low, Report `paket-17.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG · RepeatingTilesProvider.ts, .spec.ts, CHANGELOG.md je eine Zeile · roter Lauf 4 failed belegt · Arbeitsbaum schmutzig
  - 2026-10-24 Zug 3: Reviewer (sonnet, low): erfüllt, keine kritischen/wichtigen Befunde · Diff `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-17.diff`
  - 2026-10-24 Zug 4: keine Runde nötig
  - 2026-10-24 Zug 5: Commit 2ad669ff, Verify `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/99f0da72-05a5-46e5-8b4b-9668cf6ebf6b/scratchpad/paket-17.verify.log` exit=0

## Urteil des Reviewers

- Folge aus Paket 8: behoben — `RepeatingTilesProvider.ts:194` wirft mit Subjekt `RepeatingTilesProvider#getTileIdsWithin():`, Klasse und Prüfposition unverändert; Spec Z. 353, CHANGELOG Z. 123 nachgezogen.
- Klein: keine Befunde; die langen Template-Zeilen (Z. 81, 91, 194 > 130 Spalten) bricht Biome nicht um, kein Befund.
