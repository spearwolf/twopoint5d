# Paket 4 — Importreihenfolge in TexturedSpritesMaterial

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — das Paket trägt einen kleinen Befund des Reviewers aus Paket 3
- Folge von: Paket 3 — ausgelöst durch dessen Schritt 6, den Fix des vorbestehenden Nebenbefunds
  `vertexPositionNode`; erste Generation, nicht dritte (siehe »Entscheidungen in Zug 0«)
- Ziel: Der Typimport aus `./TexturedSprite.js` ist alphabetisch sortiert wie seine Nachbarn.
- Modell: günstigste Stufe
- Effort: low
- Dateien:
  - geändert: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts`, nur der
    `import type`-Block `:5-11`
  - nicht anfassen: jede andere Zeile dieser Datei; jede andere Datei — ausdrücklich auch nicht die
    übrigen Importlisten im Repo, die anders sortiert sind (siehe »Abgleich«); keine ESLint- oder
    Prettier-Regel für die Importreihenfolge; kein `pnpm format` über das Repo; kein
    CHANGELOG-Eintrag
- Vorgehen:
  1. In `TexturedSpritesMaterial.ts` den Block `:5-11`, heute
     ```ts
     import type {
       TAttributeNodeInstancePosition,
       TAttributeNodeVertexPosition,
       TAttributeNodeQuadSize,
       TAttributeNodeRotation,
       TAttributeNodeTexCoords,
     } from './TexturedSprite.js';
     ```
     auf genau diesen Endstand bringen:
     ```ts
     import type {
       TAttributeNodeInstancePosition,
       TAttributeNodeQuadSize,
       TAttributeNodeRotation,
       TAttributeNodeTexCoords,
       TAttributeNodeVertexPosition,
     } from './TexturedSprite.js';
     ```
     `TAttributeNodeVertexPosition,` wandert von Zeile 7 ans Ende der Liste (danach Zeile 10), sonst
     ändert sich kein Zeichen. Der Block bleibt mehrzeilig: einzeilig wäre er 175 Zeichen lang, die
     `printWidth` in `.prettierrc` ist 130.
  2. Abnahme am Diff: `git diff --stat -- packages/` zeigt genau diese eine Datei mit
     `1 insertion(+), 1 deletion(-)`, `git diff` nur die verschobene Zeile.
- Regressionstest: keiner. Kein Laufzeitverhalten ändert sich, und weder Lint noch Typecheck prüfen
  die Reihenfolge — ein roter Lauf ist weder zu erwarten noch verlangt.
- Verify: `pnpm run ci`
  - schnelle Schleife während der Arbeit: `pnpm lint`, `pnpm typecheck`
- Commit (Subject allein, kein Footer — nichts an der Oberfläche ändert sich):
  - Subject: `refactor(sprites): list TAttributeNodeVertexPosition last in the type import of TexturedSpritesMaterial, in the alphabetical order of the other names`
- Verlauf:
  - 2026-09-25 Zug 0: Detailplan steht · Folge `TexturedSpritesMaterial.ts:6-10` unverändert (der
    Name steht auf `:7` im Block `:5-11`) → Schritt 1 · Symptomsuche über die 19 Quelldateien von
    `c7cbb6d8..0d982277`: 3 unsortierte Importlisten, 1 Befund (dieser), 2 Hauskonvention → nichts
    dazu · Generationsfrage: erste Generation, keine Rückfrage · »Offene Befunde«: 4 Einträge, keiner
    mit gleicher Ursache, alle bleiben liegen · Restplan: kein offenes Paket nach 4, keine
    Umsortierung
  - 2026-09-25 Zug 1: Implementierer beauftragt, haiku, effort low, `paket-4.impl-1.json`
  - 2026-09-25 Zug 2: Report FERTIG · geändert `TexturedSpritesMaterial.ts` (1+/1−) · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-4.verify.log`)
  - 2026-09-25 Zug 3: Reviewer sonnet/low · Freigabe, erfüllt, keine kritischen oder wichtigen Befunde · Diff `paket-4.diff`
  - 2026-09-25 Zug 4: entfällt, nichts offen
  - 2026-09-25 Zug 5: Commit `9eae955d` auf `main`, Verify `paket-4.verify.log` exit=0

## Abgleich

Gegen `main` auf `0d982277`, Arbeitsbaum sauber (ungetrackt nur Plan und Paketdateien).

| Eintrag | Fundstelle jetzt | Einordnung |
| --- | --- | --- |
| Folge aus Paket 3: `TAttributeNodeVertexPosition` vor `TAttributeNodeQuadSize` | `TexturedSpritesMaterial.ts:7` im Block `:5-11`; vor dem Lauf (`git show c7cbb6d8:…`, `:5-10`) war die Liste sortiert, `0d982277` hat den Namen an zweiter Stelle eingefügt | unverändert |

Symptomsuche: jede Liste benannter Importe in den 19 `.ts`/`.js`-Dateien, die
`c7cbb6d8..0d982277` geändert hat, gegen alphabetische Reihenfolge (ohne Groß/Klein, `type`
ignoriert) und gegen ihren Stand vor dem Lauf:

| Fundstelle | Liste | Herkunft | Urteil |
| --- | --- | --- | --- |
| `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:5-11` | `…InstancePosition, …VertexPosition, …QuadSize, …Rotation, …TexCoords` | neu im Lauf (`0d982277`); vorher sortiert | Befund dieses Pakets |
| `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.spec.ts:6` | `TexturedSpritesGeometry, type TexturedSpritesBasePool` | neu im Lauf (Datei aus `aceff5f0`) | kein Befund: Werte vor Typen ist eine der gelebten Konventionen im Repo |
| `packages/twopoint5d-testing/test/sprites-rotation.test.js:4` | `coveredBox, makeContainer, disposeDisplay, renderToPixels` | vorbestehend: vor dem Lauf `makeContainer, disposeDisplay`; `deeddeea` hat vorn und hinten ergänzt, ohne eine Vertauschung hinzuzufügen | kein Befund: `makeContainer, disposeDisplay` ist das Muster von 12 Browser-Tests (display, map2d, stage, vertex-objects, sprites); die Zeile entspricht ihren Geschwistern |

## Entscheidungen in Zug 0

- **Keine dritte Generation, keine Rückfrage.** Formal steht die Kette Paket 1 → Paket 3 → Paket 4.
  Die Unordnung stammt aber aus Schritt 6 von Paket 3, dem Fix des Nebenbefunds
  `vertexPositionNode` — vorbestehend, belegt mit `git show c7cbb6d8:…TexturedSpritesMaterial.ts`
  (`:26` `createSignal<TAttributeNodeInstancePosition>`, `:66` der Setter mit demselben Typ), also
  keine der Folgen aus Paket 1 oder 2. Kausal ist Paket 4 die erste Folge eines Nebenbefund-Fixes.
  Die Generationsregel sucht einen Wurzelweg, der immer neue Defekte gebiert; eine
  Importreihenfolge sagt über den Weg von Paket 1 nichts. Der Vermerk steht an `Folge von:`, damit
  eine spätere Zählung nicht bei drei ansetzt.
- **Maßstab ist die Nachbarschaft, nicht eine Norm.** Das Repo erzwingt keine Importreihenfolge
  (keine ESLint-Regel, kein Prettier-Plugin, keine Commit-Hooks) und lebt mehrere Ordnungen
  nebeneinander: alphabetisch ohne Groß/Klein (`createEffect, createSignal, type Effect,
  SignalGroup`), ASCII mit Großbuchstaben zuerst (`VO, VOAttrSetter, VertexObjectDescription`),
  Werte vor Typen (16 gemischte Listen folgen allein dieser, 8 allein der alphabetischen
  Verschränkung). 50 von 413 Listen mit mindestens zwei Namen sind unter der ersten Lesart
  unsortiert. Befund ist deshalb die Abweichung von den Nachbarn: in `TexturedSpritesMaterial.ts`
  ist jede andere Liste alphabetisch, und diese war es vor dem Lauf auch. Die beiden anderen Treffer
  der Symptomsuche folgen einer gelebten Konvention und sind weder Symptom noch Nebenbefund.
- **Keine Lint-Regel einführen.** Eine Regel für die Reihenfolge (`sort-imports`,
  `eslint-plugin-perfectionist`) würde rund 50 Listen in allen Domains umsortieren und die Toolchain
  ändern — außerhalb eines Ein-Zeilen-Pakets und außerhalb der Scope-Regel.
- **Günstigste Stufe, Effort low.** Eine Datei, eine benannte Zeile, der exakte Endstand steht im
  Vorgehen — Transkription.
- **`refactor` statt `style`.** Das Log kennt keinen `style`-Commit; Umbauten ohne
  Verhaltensänderung laufen hier unter `refactor` (38 Commits). Kein CHANGELOG-Eintrag, weil sich an
  der Oberfläche nichts ändert.

## Findings im Volltext

**Folge aus Paket 3 · klein · `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesMaterial.ts:6-10`**
— Reviewer `paket-3.review-1.json`, »Klein«: »Im Import steht `TAttributeNodeVertexPosition` vor
`TAttributeNodeQuadSize`, also nicht alphabetisch. Lint besteht, es ist nur Kosmetik. Der Platz ist
von der Paketdatei vorgegeben (»ergänzen«), daher ohne Nachbesserungszwang.«

## Urteil des Reviewers

- Folge aus Paket 3 (`TexturedSpritesMaterial.ts:5-11`): behoben — `TAttributeNodeVertexPosition` steht am Listenende, Endstand zeichengleich mit dem Vorgehen, Diff 1+/1−.
- Klein: Commit-Message erfüllt die Konventionen; nichts musste mitgezogen werden.
