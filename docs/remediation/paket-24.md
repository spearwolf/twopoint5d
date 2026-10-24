# Paket 24 — Nachlese: Code, Tests und Meldungen aus den Reviewer-Urteilen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Folgen dieses Laufs: kleine Befunde der Reviewer an Code und Tests, die Folge aus
  Paket 23; dazu zwei Nebenbefunde aus der Queue; alle low)
- Ziel: Jede Abweisung der Sprite-Schicht zitiert den abgewiesenen Wert, und die offenen Kanten, die
  die Reviewer an Code und Tests dieses Laufs vermerkt haben, sind geschlossen.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `scripts/ci/nxCacheServer/createCacheServer.mjs`, `scripts/ci/nxCacheServer/createCacheServer.test.mjs`
  - `scripts/checkNameableTypes.mjs`, `scripts/checkNameableTypes/findUnnameableTypes.mjs`,
    `scripts/checkNameableTypes/findUnnameableTypes.test.mjs`
  - `packages/twopoint5d-testing/test/helpers/fixtures.js`, `.../test/sprites-picking.test.js`,
    `.../test/harness-rejections.test.js`
  - `packages/twopoint5d/src/texture/`: `TexturePackerJson.ts`, `AsepriteJson.ts`,
    `AsepriteJson.spec.ts`, `TileSet.ts`, `TileSet.spec.ts`, `TextureStore.ts`, `TextureStore.spec.ts`
  - `packages/twopoint5d/src/map2d/`: `Map2DSpatialHashGrid.ts`, `Map2DSpatialHashGrid.spec.ts`,
    `RectangularVisibilityArea.spec.ts`
  - `packages/twopoint5d/src/vertex-objects/GeometryAttributeSlots.spec.ts` (neu)
  - `packages/twopoint5d/src/display/Display.ts` (nur TSDoc)
  - `packages/twopoint5d/src/stage/`: `Canvas2DStage.ts`, `Canvas2DStage.spec.ts`,
    `OrthographicProjection.ts`
  - `packages/twopoint5d/src/utils/`: `isObject3D.ts` (neu), `describeThreeValue.ts` (neu),
    `describeThreeValue.spec.ts` (neu)
  - `packages/twopoint5d/src/sprites/`: `bindings/lightOf.ts`, `bindings/planeOf.ts`,
    `bindings/bindings.spec.ts`, `passes/passFeatures.ts`, `passes/definePass.spec.ts`,
    `features/PaletteSwap.spec.ts`, `features/TableFrame.spec.ts`, `features/placement.spec.ts`,
    `features/segments.spec.ts`, `SpritePicker.ts`, `SpritePicker.spec.ts`, `typedNodes.ts`,
    `typed-stages.spec.ts`, `GridBase.ts`, `GridBase.spec.ts`, `FeatureSprites/FeatureSprites.ts`,
    `FeatureSprites/FeatureSprites.spec.ts`, `spriteDeclarations.ts`, `spriteDeclarations.spec.ts`,
    `defineSprite.spec.ts`
  - Doku: `packages/twopoint5d/CHANGELOG.md` (nur `## [Unreleased]`), `AGENTS.md` (ein Nebensatz),
    Proposals `packages/twopoint5d/docs/proposals/gpu-picking.md`,
    `pipeline-stages-and-grid-base.md`, `sprite-uniform-bindings.md` (nur zitierte Meldungen)
- Vorgehen: siehe Abschnitt »Vorgehen« unten — Schritte 1–9, je mit Fundstelle, Wortlaut und Test.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): quote the refused value in the refusals of SpritePicker#pick(), gridBase() and FeatureSprites#bindUniform(), name a three.js object in a refusal by its type through one helper, refuse a plane without a normal in planeOf(), check the renames of a pass right after its uniformNames, draw a frame of Canvas2DStage in the size a render listener gives the canvas, let a throw while TextureStore#parse() writes its items reach the caller, work out the cells of a renderable of the spatial hash grid once, keep the reason of a failing cache read in the log of the cache server, and test what the Nameable-Types check, the atlas parsers, the texture store, the visibility area, the attribute slots and the browser harness left untested`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · Abgleich gegen HEAD ff7d5422: 27 Stellen — 22 offen
    (Zeilen zum Teil verschoben), `AsepriteJson.ts:~263` gegenstandslos (Paket 19, 24f78f5b:
    Formprüfungen Z. 340–353 vor der Dauerprüfung Z. 364–366), `styleUtils.ts` Drehung ohne
    Codeänderung (Grenze wie in Paket 18 freigegeben, nur TSDoc und CHANGELOG),
    `Map2DTileCoordsUtil.ts:176` kein Befund (Biome-Breite 130, Formatter), `#getOnce()` und
    `GeometryAttributeSlots` mit Entscheidung · Folge aus Paket 23 (Migration Guide
    `Chronometer`) ins Paket, Kette 4 → 23 → 24, zweite Generation · Stellen gleicher Ursache
    dazu: `picker.dispose()` in `sprites-picking.test.js:478`, `describePart()` in
    `FeatureSprites.ts:154`, `OrthographicProjection.ts:143` · Restplan: unverändert, 24 ist das
    letzte Paket
  - 2026-10-24 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach
    `paket-24.impl-0.json`
  - 2026-10-24 Zug 2: Report FERTIG_MIT_VORBEHALT (2.7 zweiter Fall herausgenommen: hängt) · 51
    Dateien, 4 neu (`utils/isObject3D.ts`, `utils/describeThreeValue.ts` samt Spec,
    `GeometryAttributeSlots.spec.ts`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0
    (`paket-24.verify.log`)
  - 2026-10-24 Zug 3: Reviewer (opus, medium) · Erfüllung: 25 Stellen behoben, Stelle 18
    teilweise (zweiter Fall von 2.7 fehlt) · Qualität: 1 wichtig (`TextureStore.ts:934` Kommentar
    sagt zu, dass ein `getAsync()` aus einem `ready`-Listener den Grund hört; es hängt), 4 klein ·
    Diff `paket-24.diff`, Report `paket-24.review-0.json`
  - 2026-10-24 Zug 4 Runde 1: offen das wichtige und Stelle 18 (Folge von Paket 6, a154cadc:
    Zusage samt `#refusedItems` stammt aus diesem Lauf → Verhalten herstellen), dazu klein
    TSDoc `parse()` und Umbruchbreiten · Resume desselben Implementierers (sonnet, medium),
    Report nach `paket-24.impl-1.json` · zurück: FERTIG, `#readyLate`/`#onReadyOnce()` in
    `TextureStore` (Ursache: `retain` schreibt erst nach dem letzten Listener), zwei Specs rot vor
    dem Fix, TSDoc `parse()`, Umbrüche · Verify `pnpm run ci` exit=0 (`paket-24.verify-1.log`) ·
    Reviewer gezielt (opus, medium) auf `paket-24.diff-1`, Report nach `paket-24.review-1.json`
    · Urteil: wichtig und Stelle 18 erledigt, TSDoc `parse()` erledigt, Umbrüche nur in
    `harness-rejections.test.js` erledigt · 4 neue klein (Folgen der Runde) → Fortschritt, keine
    weitere Runde (nur klein offen)
  - 2026-10-24 Zug 5: Commit d559b0c7 (51 Dateien, Message mit Scope `fix(twopoint5d)` und dem
    `ready`-Fix ergänzt), Trailer `Remediation-Run: 2026-10-23` · Verify `paket-24.verify-1.log`
    exit=0, jünger als die letzte Änderung · Plan auf `[x]`, Folgen und Queue-Eintrag eingetragen

## Urteil des Reviewers

Review 0 (`paket-24.review-0.json`) auf den Stand nach Runde 0, Review 1 (`paket-24.review-1.json`)
gezielt auf Runde 1.

| # | Urteil | Fundstelle |
| --- | --- | --- |
| 1 | behoben, Test rot vor dem Fix | `scripts/ci/nxCacheServer/createCacheServer.mjs:85`, `createCacheServer.test.mjs:195` |
| 2 | behoben | `scripts/checkNameableTypes/findUnnameableTypes.mjs:164`, `.test.mjs:159`, `scripts/checkNameableTypes.mjs:42` |
| 3 | gegenstandslos | — |
| 4 | behoben | `AsepriteJson.spec.ts:576` |
| 5 | behoben | `TexturePackerJson.ts:105–110` |
| 6 | behoben | `AsepriteJson.ts:176`, Spec `:529` |
| 7 | behoben, Test rot | `Map2DSpatialHashGrid.ts:127`, Spec `:290` |
| 8 | behoben | `RectangularVisibilityArea.spec.ts:380`, `:402` |
| 9 | behoben | `GeometryAttributeSlots.spec.ts:19`, `:32`, `:49` |
| 10 | behoben, Test rot | `TileSet.ts:330`, `TileSet.spec.ts:191` |
| 11 | behoben | `Display.ts:254–256`, `CHANGELOG.md:206` |
| 12 | behoben, Test rot | `passFeatures.ts:113–118`, `definePass.spec.ts:196` |
| 13 | behoben | `definePass.spec.ts:168`, `:180`, vier Factory-Specs |
| 14 | behoben | `sprites-picking.test.js:477`, `:488`, `:492`, `helpers/fixtures.js` `release()` |
| 15 | behoben, Test rot | `Canvas2DStage.ts:401`, Spec `:359`, `CHANGELOG.md:198` |
| 16 | behoben, Test rot | `TextureStore.ts:1080`, `:1109`, Spec `:1203` |
| 17 | behoben (77 Zeilen, Klasse `Settlement`) | `TextureStore.ts:272`, `#getOnce()` ab `:1450` |
| 18 | behoben in Runde 1 (Review 0: teilweise), beide Specs rot vor dem Fix | `TextureStore.spec.ts:3310`, `:3326`, `:3346`; Fix `TextureStore.ts:476`, `:673–682`, `:958–975` |
| 19 | behoben, Test rot | `planeOf.ts:15`, `bindings.spec.ts:152`, `CHANGELOG.md:217` |
| 20 | behoben | `bindings.spec.ts:197–209` |
| 21 | behoben | `src/utils/isObject3D.ts`, `lightOf.ts:3`, `planeOf.ts:5` |
| 22 | behoben | `harness-rejections.test.js:22` |
| 23 | behoben | `Canvas2DStage.spec.ts:509` |
| 24 | behoben, alle sechs Stellen | `SpritePicker.ts:477`, `:490`, `:496`; `typedNodes.ts:18`; `GridBase.ts:100`; `FeatureSprites.ts:629`; `CHANGELOG.md:72` |
| 25 | behoben | `spriteDeclarations.ts:102` |
| 26 | kein Befund | — |
| 27 | behoben | `CHANGELOG.md:1099–1117` |

Konventionen: keine Finding-ID, kein Satz über den Vorzustand, CHANGELOG nur unter `[Unreleased]`.

### Kleine Befunde

- Review 0, Commit-Message: Scope fehlte, `ready`-Fix und Meldungsänderungen fehlten — im Commit
  nachgezogen (`fix(twopoint5d)`, `ready`-Fix, `TileSet`-Meldung, `Chronometer`-Guide).
- Review 0: `describeThreeValue.spec.ts:11–18` vergleicht die Negativfälle gegen `describeValue()`
  selbst statt gegen einen festen String (entspricht der Vorgabe dieses Detailplans).
- Review 1 (Folgen der Runde, im Plan unter `Folgen:` mit Fundstellen): CHANGELOG-Satz Z. 160 zu
  `on()`/`whenReady()` und »jedes `ready`«; Kommentar `TextureStore.ts:473–475` nur für den ersten
  `parse()` wahr; Fehlerweg `TextureStore.ts:966–971` undokumentiert und ungetestet; Testlücken
  `TextureStore.spec.ts:3326–3362`; Umbruchbreite `pipeline-stages-and-grid-base.md:203`,
  `gpu-picking.md:264`.
- Nebenbefund des Implementierers (Queue, `→ Scope`): 14 Specs prüfen `toThrow(Klasse)` plus
  Teilstring; vorbestehend, `git show 7341059f:packages/twopoint5d/src/utils/assertFinite.spec.ts`
  Z. 8–9 zeigt dasselbe Muster. Scope-Regel »alles«, kein gemeinsamer Fix mit diesem Paket.

## Abgleich

Gegen HEAD `ff7d5422`. »Quelle« ist die Paketdatei, deren Reviewer-Urteil die Stelle nennt.

| # | Stelle | Quelle | Stand jetzt | Was folgt |
| --- | --- | --- | --- | --- |
| 1 | `createCacheServer.mjs` `serve()`, `finally` Z. 81–84 | Paket 3 | unverändert | Schritt 1.1 |
| 2 | `checkNameableTypes.mjs:42`, `/`-Normalisierung ohne Test | Paket 3 | unverändert | Schritt 1.2 |
| 3 | `AsepriteJson.ts:~263`, Dauerprüfung vor den Formprüfungen | Paket 7 | **gegenstandslos**: seit Paket 19 (24f78f5b) prüfen Z. 340–353 Objekt und `filename` jedes Frames, Z. 354–362 doppelte Namen, erst Z. 364–366 die Dauer; ein Frame ohne `filename` wird mit seinem Index abgewiesen, `"undefined"` erscheint nicht mehr. Dass `TexturePackerJson` den `frame` danach prüft, ist eine Reihenfolge zweier Abweisungen, kein Fehler | — |
| 4 | `AsepriteJson.spec.ts:490–494`, »two slices of one name« mit `Error` | Paket 19 | unverändert, Tabelle Z. 573–578 prüft `toThrow(errorClass)` | Schritt 2.3 |
| 5 | `TexturePackerJson.ts:105–110`, geprüft `jsonFrames`, gelesen `data.frames` | Paket 19 | unverändert | Schritt 2.1 |
| 6 | »the bounds of … is undefined« | Paket 19 | `AsepriteJson.ts:177` | Schritt 2.2 |
| 7 | `Map2DSpatialHashGrid#add()`, `#cellsOf()` zweimal | Paket 8 | Z. 128 und Z. 138 | Schritt 3.1 |
| 8 | `RectangularVisibilityArea.spec.ts`, zwei Pfade von `#gridChangeRefused` | Paket 8 | unverändert (Merker `RectangularVisibilityArea.ts:65/203/242/249`) | Schritt 3.2 |
| 9 | `GeometryAttributeSlots.ts:139`, Zweig von `withdrawRoute()` ungetestet | Paket 12 | Z. 131 und Z. 139–142, vom einzigen Aufrufer (`InstancedVOBufferGeometry.ts:334`) nicht erreichbar | Schritt 4 |
| 10 | `TileSet.ts:~285`, Meldung bei `fitting === Infinity` | Paket 13 | jetzt Z. 327–331 | Schritt 2.4 |
| 11 | `styleUtils.ts` `getContentAreaSize()` bei Drehung | Paket 18 | Verhalten wie im Detailplan von Paket 18 (C1) freigegeben und in der TSDoc `styleUtils.ts:51–57` beschrieben | Schritt 5.1 (TSDoc `Display`, CHANGELOG) |
| 12 | `passes/passFeatures.ts:~91–93`, Reihenfolge der Prüfungen von `uniformNames` | Paket 20 | Umbenennungsprüfungen Z. 92–118 hinter `material` (Z. 86–90) und `renderOrder` (Z. 91) | Schritt 6.1 |
| 13 | Factory-Specs und `definePass.spec.ts:~166`, Meldung als Teilstring | Paket 20 | `definePass.spec.ts:165–170` und `:178–181`, vier Factory-Specs | Schritt 6.2 |
| 14 | `sprites-picking.test.js:84–85`, doppelte Freigabe | Paket 2 | Test Z. 452–484: `sprites.dispose()` Z. 469, `colorMap.dispose()` Z. 482, dazu `picker.dispose()` Z. 478 (der `afterEach` Z. 60 gibt ihn ein zweites Mal frei) | Schritt 7.1 |
| 15 | `Canvas2DStage.ts` `render()`, Größenwechsel in `OnCanvas2DStageRender` | Paket 5 | Z. 396–398 | Schritt 5.2 |
| 16 | `TextureStore.ts` `#writeItems()`, `catch` um Schleife und Flush | Paket 6 | Z. 1046–1089 | Schritt 2.5 |
| 17 | `TextureStore.ts` `#getOnce()`, 99 statt etwa 80 Zeilen | Paket 6 | Z. 1418–1512, 95 Zeilen | Schritt 2.6 |
| 18 | `TextureStore.spec.ts`, kein Fall für ein verworfenes Item mit Ressource | Paket 6 | unverändert (`#refusalsWithoutResource` Z. 1169–1175, gesetzt vor `OnReady` Z. 908) | Schritt 2.7 |
| 19 | `planeOf.ts:20–25`, `{isPlane: true}` ohne `normal` | Paket 11 | `assertFinitePlane()` Z. 16–21 | Schritt 6.4 |
| 20 | `bindings.spec.ts:263–268`, zweites `test.each` | Paket 11 | jetzt Z. 182–197 | Schritt 6.5 |
| 21 | `isObject3D` doppelt in `lightOf.ts:5` und `planeOf.ts:9` | Paket 11 | unverändert | Schritt 6.3 |
| 22 | `harness-rejections.test.js`, Logs nach einem Timeout | Paket 14 | unverändert (Wiederherstellung nur im `finally` Z. 27–31) | Schritt 7.2 |
| 23 | `Canvas2DStage.spec.ts`, Disposed-Zweig von `setContainerSize()` nur Breite | Paket 15 | Z. 478–481 | Schritt 5.3 |
| 24 | Abweisungen ohne Wert: `SpritePicker.ts:476/488/492`, `typedNodes.ts:16`, `GridBase.ts:100`, `FeatureSprites.ts:631` | Queue (Paket 22, Zug 0) | unverändert | Schritt 6.6 |
| 25 | `spriteDeclarations.ts:102` ohne »finite« | Queue (Paket 22, Review) | unverändert | Schritt 6.7 |
| 26 | `Map2DTileCoordsUtil.ts:172` (jetzt Z. 176), 122 Zeichen | Queue (Paket 23) | **kein Befund**, siehe »Triage« | — |
| 27 | CHANGELOG Migration Guide »The deltas of a stopped Chronometer« | Folge von Paket 23 | `CHANGELOG.md:1088–1110`, After-Block liest `deltaTime` ohne laufenden Frame | Schritt 8.1 |

## Triage der offenen Folgen und Befunde

- **Folge von Paket 23** (Migration Guide `Chronometer`): eigene Ursache in Paket 23, das den Block
  geschrieben hat; Paket 23 ist committet, Paket 24 ist die Nachlese, in der seine Reviewer-Folgen
  ohnehin landen (Entscheidung vom 2026-10-24, »Nachlese«) und deren Bereich das CHANGELOG
  einschließt — kein eigenes Nachtragspaket für einen Codeblock. Die Entscheidung schickt, »was
  die Nachlese selbst an Befunden liefert«, ins Audit; eine Folge ist kein Befund im Sinne der
  Queue, und den Ausgang »Folge ins Audit« gibt es nicht. **Generation:** die Kette dieser Stelle
  ist Paket 4 (Bruch von `Chronometer#update()`) → Paket 23 (Migration Guide) → Paket 24, die
  zweite. Die Kette 10 → 22 → 23 trägt keine Stelle dieses Pakets: aus Paket 22 kommt nur der
  Nebenbefund `spriteDeclarations.ts:102`, der vorbestehend ist, keine Folge.
- **Queue-Eintrag `Map2DTileCoordsUtil.ts:172`** (jetzt Z. 176): kein Befund. Die Zeile hat 122
  Zeichen und liegt unter `lineWidth` 130 aus `biome.jsonc:33`; ein Umbruch von Hand fiele beim
  nächsten `pnpm format` zurück in eine Zeile, `biome ci` meldete ihn als Abweichung. Eine
  »Breite von 100, die die Datei sonst hält« gibt es nicht: Z. 243 (108), 287 (118), 330 (107),
  339 (114) und 341 (114) sind Code über 100. Nebenbei falsch eingeordnet: die Zeile stammt aus
  Paket 9 (`git show b3bf6a53`, `clone()` über die privaten Felder), sie ist eine Folge, nicht
  vorbestehend — an der Sache ändert das nichts. Im Plan auf `[x]` mit diesem Grund.
- **`styleUtils.ts` bei Drehung** (Paket 18): keine Codeänderung. Paket 18 hat die Messung über
  `getBoundingClientRect()` samt Rand-Skalierung `rectSide / layoutSide` freigegeben (Detailplan
  Paket 18, C1) und für ein gedrehtes Element dokumentiert; der Reviewer bestätigt, dass die TSDoc
  es sagt. Eine Messung in den Achsen des Elements bräuchte die zusammengesetzte lineare
  Transformation des Elements und aller Vorfahren (`transform`, `rotate`, `scale`, `zoom`) und
  änderte die Größe, die `Display` jedem transformierten Container gibt — ein anderer Weg als der
  freigegebene, kein Nachlese-Punkt. Was fehlt, ist dieselbe Aussage dort, wo ein Nutzer des
  `Display` sie liest: Schritt 5.1.
- **`#getOnce()`** (Paket 6, 95 Zeilen): wird gekürzt (Schritt 2.6). Das Ziel »etwa 80 Zeilen« stand
  im Detailplan von Paket 6 zu READ-001, das mit diesem Vorbehalt geschlossen ist. Die
  Buchführung `settled`/`track()`/`settle()` geht in eine kleine Klasse im selben Modul; damit
  fällt auch die `let`-Variable, die drei Closures teilen. Die Reihenfolge »erst `#subscribe()`,
  dann der Follower« und der synchron zugestellte Wert bleiben, wie sie sind.
- **`GeometryAttributeSlots#withdrawRoute()`** (Paket 12): Test statt Streichung. Die Zweige
  »Claim nicht oben« (Z. 131) und »Claim darunter« (Z. 139–142) erreicht der einzige Aufrufer
  nicht — `attachInstancedPool()` weist jeden schon gehaltenen Namen vorher ab
  (`InstancedVOBufferGeometry.ts:312–323`). Die Klasse ist aber ein eigener Baustein mit
  `releaseRoute()` als Gegenstück, und ihr Vertrag hängt nicht an der Wache des Aufrufers; ein
  Unit-Test der Klasse deckt beide Zweige, ohne Code zu entfernen, den eine spätere zweite
  Aufrufstelle bräuchte.
- **Stellen gleicher Ursache, mitgenommen:** `picker.dispose()` im selben Test wie die doppelte
  Freigabe (Ursache: eine Freigabe, die Gegenstand des Tests ist, wiederholt der Abbau);
  `describePart()` in `FeatureSprites.ts:154–155` und der Ausdruck in
  `OrthographicProjection.ts:143` benennen ein three.js-Objekt nach seinem `type`, wie es die
  neuen Meldungen in Schritt 6.6 brauchen — ein Helfer statt eines dritten und vierten Exemplars;
  der Abgleich aller `*.test.js` auf Teile, die `keep()` hält und der Testkörper freigibt, fand
  sonst nichts (die Treffer in `stage-pipeline.test.js` sind gleichnamige, nicht gehaltene
  Variablen).
- **Nicht aufgenommen:** `FeatureSprites.ts:196` und `:212` (»built for another sprite kind«)
  weisen eine Geometrie oder ein Material wegen der Art ab, nicht wegen eines Werts — es gibt
  nichts zu zitieren; der Abgleich der Sprite-Schicht in Zug 0 von Paket 22 hat sie ebenso
  stehen lassen. `docs/superpowers/plans/2026-10-08-sprite-uniform-bindings.md` zitiert die alte
  Meldung von `bindUniform()`: datierter Arbeitsplan, kein Vertrag (Begründung wie in Paket 23).

## Vorgehen

Vor der ersten Zeile `AGENTS.md` lesen — die Regel »Error and warning messages« gilt für jede
Meldung unten — und die Module, die du änderst, ganz. Bei jedem Korrektheitsfehler (markiert mit
**rot zuerst**) erst den Test, rot sehen, dann beheben; der rote Lauf gehört in den Report. Die
übrigen Tests decken ungetestete Kanten ab und laufen sofort grün; das ist dort richtig.

Exakte Meldungen prüfen die Specs mit `toThrow(new TypeError('…'))` (bzw. `RangeError`, `Error`):
Vitest 5 vergleicht dabei `name` und `message` genau — so steht es schon in
`Canvas2DStage.spec.ts:467`.

In den Codeblöcken unten steht `…` für Code, der bleibt, wie er heute dasteht; alles andere ist
der Wortlaut, der hinein soll. `vi.spyOn()` braucht kein Aufräumen: `restoreMocks: true` in
`packages/twopoint5d/vite.config.ts:18` stellt jeden Spy nach seinem Test zurück.

### 1. Repo-Skripte

1.1 **`scripts/ci/nxCacheServer/createCacheServer.mjs` `serve()`** — **rot zuerst.** Wirft
`handle.stat()` oder `handle.utimes()` und danach auch `handle.close()`, überdeckt im `finally`
(Z. 81–84) der Fehler von `close()` den eigentlichen, und das Log nennt den falschen Grund. Umbau:
den `finally`-Block durch einen `catch` ersetzen, der das Handle schließt und den ursprünglichen
Fehler weiterwirft; ein Fehler von `close()` dort geht verloren:

```js
    } catch (err) {
      // the reason the entry could not be served is err; a handle that fails to close as well
      // adds nothing the log could act on
      await handle.close().catch(() => {});
      throw err;
    }
```

Der Erfolgspfad bleibt: das Handle gehört ab `createReadStream()` dem Stream (der Kommentar Z. 82
entfällt mit dem `finally`, der Satz »the stream closes the handle itself« wandert als Kommentar
vor `stream = handle.createReadStream();`). Test in `createCacheServer.test.mjs` nach dem Muster
von »a GET whose entry vanishes …« (Z. 172): `handlePrototype.stat` per `t.mock.method` mit
`new Error('stat failed')` ablehnen lassen, `handlePrototype.close` so ersetzen, dass es erst das
Original aufruft (der Deskriptor wird frei) und dann mit `new Error('close failed')` ablehnt;
`console.error` stummschalten wie Z. 197. Erwartet: Status 500, genau ein Log, das auf
`/^nx cache server: GET \/v1\/cache\/123 failed: stat failed$/` passt. Titel: `a GET whose entry
cannot be read answers 500 and logs that reason, also when the handle fails to close`.

1.2 **`/`-Normalisierung von `scripts/checkNameableTypes.mjs:42`.** Den Ausdruck in eine Funktion
in `scripts/checkNameableTypes/findUnnameableTypes.mjs` ziehen, unter `partitionAccepted()`:

```js
/**
 * The key of `entry` in ACCEPTED: its path relative to the workspace root, `/`-separated on
 * every platform, so that one key serves Windows and POSIX alike.
 *
 * @param {string} entry
 * @param {string} workspaceRoot
 * @param {import('node:path').PlatformPath} [pathApi] `path.win32` or `path.posix`; the platform's by default
 * @returns {string}
 */
export function entryKeyOf(entry, workspaceRoot, pathApi = path) {
  return pathApi.relative(workspaceRoot, entry).split(pathApi.sep).join('/');
}
```

`checkNameableTypes.mjs:42` wird zu `ACCEPTED.get(entryKeyOf(entry, workspaceRoot)) ?? new Map()`,
Import ergänzen. Test in `findUnnameableTypes.test.mjs`: `entryKeyOf('C:\\ws\\packages\\twopoint5d\\dist\\lib\\index.d.ts', 'C:\\ws', path.win32)`
ist `'packages/twopoint5d/dist/lib/index.d.ts'`, ebenso mit `/ws/…` und `path.posix`. Titel:
`entryKeyOf() writes the key of an entry with / on Windows and POSIX alike`. Das Verhalten ändert
sich nicht; kein roter Lauf.

### 2. `texture/`

2.1 **`TexturePackerJson.ts:105–110`** — die Zeilen lesen `data.frames`, geprüft ist `jsonFrames`
(Z. 86). Beide Lesestellen auf `jsonFrames` umstellen: `const isArray = Array.isArray(jsonFrames);`
und `Array.isArray(jsonFrames) ? jsonFrames.map(…) : Object.entries(jsonFrames as Record<string, unknown>)`
(die Verengung wie in `AsepriteJson.ts:333–338`). Kein neues Verhalten, kein neuer Test; die
bestehende Spec bleibt grün.

2.2 **`AsepriteJson.ts:177`** — `the bounds of … is …` ist falscher Numerus. Das Verb hängt am
Feld: `const verb = field === 'bounds' ? 'are' : 'is';` und
`` `AsepriteJson: the ${field} of ${where} ${verb} ${describeValue(value)} — a rectangle of a slice is an object {x, y, w, h}` ``.
Spec `AsepriteJson.spec.ts:529`: `'the bounds of the key 0 of the slice "s" are undefined — a
rectangle of a slice is an object {x, y, w, h}'`; der Fall für `center` (Z. 535) bleibt `is`.

2.3 **`AsepriteJson.spec.ts:573–578`** — die Tabelle prüft die Klasse mit `toThrow(errorClass)`,
und `toThrow(Error)` nimmt auch einen `TypeError`. Beide `expect(…).toThrow(…)` der Tabelle
ersetzen durch eines:
`expect(() => AsepriteJson.parse(data as AsepriteJsonData, {target: t})).toThrow(new errorClass(`AsepriteJson: ${message}`));`
(`expect(t.size).toBe(0)` bleibt). Wird eine Zeile damit rot, weil die Klasse nicht passt,
entscheidet die TSDoc von `AsepriteJson.parse()` (Z. 293–303), welche richtig ist; melde es im
Report, statt die Tabelle dem Code anzupassen.

2.4 **`TileSet.ts:327–331`** — bei einer denormalen Kachelbreite ohne `tileCount` ist `fitting`
`Infinity`, und die Meldung beginnt mit `Infinity tiles of 5e-324 × …`. Die Zahl wird zu
`` Number.isFinite(fitting) ? `${fitting} tiles` : `more than ${TileSet.MaxTiles} tiles` ``, der Rest
der Meldung bleibt. Test in `TileSet.spec.ts` unter `describe('TileSet.MaxTiles')`:
`new TileSet(new TextureCoords(0, 0, 64, 64), {tileWidth: Number.MIN_VALUE, tileHeight: 16})` wirft
`RangeError` mit `/^TileSet: more than 1048576 tiles of 5e-324 × 16 fit into 64 × 64 /`. **Rot
zuerst** (heute `Infinity tiles of …`).

2.5 **`TextureStore.ts` `#writeItems()` (Z. 1046–1089)** — **rot zuerst.** Der `catch` fängt auch
einen Wurf der Schleife; dann gehen `ready` und `evictMissing` hinaus, als wäre jedes Item
geschrieben. Ein Merker am Schleifenende:

```ts
    let written = false;
    try {
      batch(() => {
        for (…) { … }
        written = true;
      });
    } catch (error) {
      // a throw of the loop is no throw of a subscriber: the items after it were never written,
      // and ready and evictMissing must not go out as if they were
      if (!written) throw error;
      // (the existing comment about the flush stays here)
      publishError = {error};
    }
```

Test in `TextureStore.spec.ts` (bei den `evictMissing`-Fällen, Z. ~1186): erstes `parse()` mit
`{items: {a: {imageUrl: 'a.png'}, b: {imageUrl: 'b.png'}}}`; einen Dispose-Spy an die Ressource
`b` (`once(b, TextureResourceEvents.Dispose, spy)`), die `OnReady`-Aufrufe ab jetzt zählen; dann
`vi.spyOn(TextureResource, 'fromImage').mockImplementationOnce(() => { throw new Error('boom'); })`
und `store.parse({items: {c: {imageUrl: 'c.png'}, b: {imageUrl: 'b.png'}}}, {evictMissing: true})`.
Erwartet: `parse()` wirft `boom`, kein weiteres `OnReady`, `b` nicht disposed (der Spy bleibt
ungerufen) und `store.whenResource('b')` löst mit derselben Instanz auf. Heute: kein Wurf, `ready`
geht hinaus, `b` (benannt, aber nicht erreicht) wird disposed. Titel: `a throw while parse() writes
its items reaches the caller: no ready, and evictMissing disposes nothing`. Kein
CHANGELOG-Eintrag: aus Katalogdaten ist der Pfad nicht erreichbar — `#checkItems()` prüft jedes
Feld vorher, `resolveRelativeUrl()` und `#namedAtlasAdapter()` werfen nicht, in der Schleife wirft
nur `expectDefined()`.

2.6 **`TextureStore.ts` `#getOnce()` (Z. 1418–1512)** — die Buchführung des Promises in eine Klasse
im selben Modul, oberhalb von `class TextureStore` (nicht exportiert, in keiner `public-api.ts`):

```ts
// The listeners one promise of #getOnce() installs, given back at once when it settles. A
// listener booked after that is given back right away: on() can deliver a retained value
// synchronously, before it has returned its unsubscribe function, and a subscription booked into
// a settled promise would otherwise stay
class Settlement {
  #settled = false;
  readonly #teardown: Array<() => void> = [];

  get settled(): boolean {
    return this.#settled;
  }

  track(unsubscribe: () => void): void {
    if (this.#settled) unsubscribe();
    else this.#teardown.push(unsubscribe);
  }

  // true for the call that settles, false for every one after it
  settle(): boolean {
    if (this.#settled) return false;
    this.#settled = true;
    for (const unsubscribe of this.#teardown) unsubscribe();
    this.#teardown.length = 0;
    return true;
  }
}
```

In `#getOnce()`: `const settlement = new Settlement();` statt `teardown`, `settled`, `settle()` und
`track()`; `giveUp` wird `(error: Error) => { if (settlement.settle()) reject(error); }`; im
Wert-Callback `settlement.settle()` statt `settle()` (vor `resolve`, beim Lease nach `leaseOn()`
wie heute); jedes `track(…)` wird `settlement.track(…)`. Der Abort-Listener geht zuletzt über
dieselbe Buchführung, damit `settle()` ihn mit abbaut:

```ts
      if (signal && !settlement.settled) {
        signal.addEventListener('abort', onAbort, {once: true});
        settlement.track(() => signal.removeEventListener('abort', onAbort));
      }
```

Die Kommentare von `track()` und `settle()` wandern in den Klassenkommentar oben, der zum Abort
(Z. 1508–1510) bleibt. Ziel: `#getOnce()` bei etwa 80 Zeilen. Ein Refactoring ohne neues
Verhalten: kein neuer Test, die bestehenden Fälle von `getAsync()`, `get()` und `acquireAsync()`
in `TextureStore.spec.ts` bleiben unverändert grün — auch die mit synchron zugestelltem Wert, mit
`signal` und mit Dispose während des Wartens.

2.7 **`TextureStore.spec.ts`, zwei ungetestete Kanten von `#refusalsWithoutResource()`** (neben
den Fällen zu verworfenen Items, Z. ~3219–3257):
- `a refused item whose id still carries a resource keeps no reason: a later direct dispose
  answers without one` — `parse({items: {a: {imageUrl: 'a.png'}}})`, dann ein `parse()`, das `a`
  verwirft (ein Feld vom falschen Typ, wie die Nachbarfälle es tun); die Ressource `a` steht noch;
  sie direkt disposen; `store.whenResource('a')` lehnt mit genau
  `new Error('TextureStore: no resource with id "a" — check your TextureStoreData.items keys.')` ab.
- `a listener of ready hears why an item was refused` — ein `parse()`, das ein Item `b` ohne
  Ressource verwirft; in einem `OnReady`-Listener `store.getAsync('b', 'imageCoords')` starten;
  die Ablehnung trägt dieselbe Meldung wie ein `getAsync('b', 'imageCoords')` nach dem `parse()`
  (mit `— its item …`). Hängt das Promise, weil der Listener das zurückgehaltene `ready` noch
  nicht sieht, ist das ein Befund: melde ihn mit dem beobachteten Verhalten, statt den Test umzubauen.

### 3. `map2d/`

3.1 **`Map2DSpatialHashGrid#add()` (Z. 123–154)** — **rot zuerst.** `#cellsOf()` läuft je Renderable
zweimal, in der Prüfschleife (Z. 128) und beim Einsortieren (Z. 138). Die Prüfschleife merkt sich
das Rechteck jedes Renderables in einem lokalen Array, die zweite Schleife liest es von dort:

```ts
    // the cells of each renderable, worked out once by the check and read again to place it
    const spans: number[] = [];
    for (const renderable of renderables) {
      assertFiniteAABB(renderable.aabb, 'the aabb of a renderable');
      const {tileLeft, tileTop, columns, rows} = this.#cellsOf(renderable.aabb);
      if (columns * rows > this.#maxCellsPerRenderable) { … }
      spans.push(tileLeft, tileTop, columns, rows);
    }
    for (let i = 0; i < renderables.length; i++) {
      const renderable = renderables[i]!;
      this.#takeOut(renderable);
      const tileLeft = spans[4 * i]!;
      const tileTop = spans[4 * i + 1]!;
      const columns = spans[4 * i + 2]!;
      const rows = spans[4 * i + 3]!;
      …
```

Test in `Map2DSpatialHashGrid.spec.ts`: `vi.spyOn(Map2DTileCoordsUtil.prototype,
'computeTilesWithinArea')`, `grid.add(a, b)` mit zwei Renderables, der Spy ist genau zweimal
gerufen (heute viermal). Titel: `add() works out the cells of each renderable once`. Die
bestehenden Fälle, dass ein werfendes `add()` keinen Renderable bewegt, bleiben grün.

3.2 **`RectangularVisibilityArea.spec.ts`, `describe('maxVisibleTiles')`** — zwei Fälle neben
»a grid change a refused call saw reaches the next call that computes« (Z. 353), mit demselben
Aufbau (Fläche 320 × 240, `gridA` 100 × 100, `gridB` 50 × 50, `maxVisibleTiles = 16`, `ids()`,
`views()`); beide laufen heute grün und halten das Verhalten fest:
- `a return to the grid of the last result after a refused grid change lays every tile out
  again` — auf A rechnen (Kopie der `tiles` als `previousTiles`), auf B abgewiesen, dann wieder
  auf A mit `previousTiles`: `reuseTiles` leer, `ids(removeTiles)` gleich den Ids von
  `previousTiles`, `changed` `true`, `views(tiles)` gleich denen einer frischen Fläche auf A.
  Kommentar im Test: die Fläche kennt das Gitter ihres letzten Ergebnisses nur aus dem Snapshot,
  den der abgewiesene Aufruf überschrieben hat, und nimmt die Rückkehr für einen Wechsel — kein
  Tile wird zu Unrecht wiederverwendet.
- `a grid change a refused call saw survives a switch-off` — auf A rechnen, auf B abgewiesen,
  `area.width = 0`, ein Aufruf auf B (ausgeschaltet), `area.width = 320`,
  `area.maxVisibleTiles = 100`, ein Aufruf auf B mit den `previousTiles` von A: `reuseTiles` leer,
  `ids(removeTiles)` gleich den Ids von `previousTiles`, `changed` `true`. Kommentar: der Snapshot
  zeigt B, nur der Merker sagt noch, dass die Tiles von A stammen.

### 4. `vertex-objects/`

**`GeometryAttributeSlots.spec.ts` (neu)** — Unit-Tests von `withdrawRoute()` gegen eine
`BufferGeometry` und zwei Routen (`new Map()` genügt als `AttributeRoute`, Claims über `claim()`,
das Attribut setzt der Test selbst mit `geometry.setAttribute()`):
- `withdrawRoute() of the topmost claim puts the claim underneath back into the slot and keeps its
  name held` — Route A claimt `a` mit `attrA`, Route B mit `attrB`, die Geometrie zeigt `attrB`;
  `withdrawRoute(geometry, routeB)`: die Geometrie zeigt `attrA`, `everHeld(['a'])` ist `['a']`.
- `withdrawRoute() of a claim underneath leaves the slot as it shows` — dieselbe Lage,
  `withdrawRoute(geometry, routeA)`: die Geometrie zeigt weiter `attrB`; ein folgendes
  `releaseRoute(geometry, routeB)` räumt den Slot (`geometry.getAttribute('a')` ist `undefined`),
  weil kein Claim von A mehr darunter liegt.
- `withdrawRoute() of the only claim forgets the name` — nur Route A claimt `a`;
  `withdrawRoute(geometry, routeA)`: kein Attribut `a`, `everHeld(['a'])` ist `[]`.

Kopfkommentar der Datei: `attachInstancedPool()` erreicht die ersten beiden Zweige nicht, weil es
jeden gehaltenen Namen vorher abweist; die Klasse hält ihren Vertrag ohne diese Wache.

### 5. `display/` und `stage/`

5.1 **TSDoc von `Display`, Regel 3 (`Display.ts:251–254`)** — an den Satz »… padding and border come
off in the scale of that transform, as in `getContentAreaSize()`.« anschließen: »A rotated element
is measured by the bounding box `getBoundingClientRect()` gives it, its padding and border in the
ratio of that box to its layout size, as there.« Den Absatz neu umbrechen wie die Nachbarzeilen.
**CHANGELOG** `CHANGELOG.md:205` (Eintrag `getContentAreaSize()` …) endet danach mit: »; a rotated
element measures the bounding box `getBoundingClientRect()` gives it, its borders and padding in
the ratio of that box to its layout size«. Kein Code.

5.2 **`Canvas2DStage#render()` (Z. 396–398)** — **rot zuerst.** Ein Listener von
`OnCanvas2DStageRender`, der die Canvas in place auf eine andere Größe setzt, lässt den Frame die
neue Textur auf Sprite und Sicht der alten Größe zeigen. Direkt nach
`emit(this, OnCanvas2DStageRender, this);` und vor `this.#updateTexture();`:

```ts
      // a listener may have resized the canvas in place: sprite and view follow before the upload,
      // as they do for setCanvasSize(); its OnCanvas2DStageResize goes out with the next render()
      this.#followCanvasSize();
```

`#lastWidth`/`#lastHeight` bleiben unberührt, damit der nächste `render()` das Ereignis sendet.
TSDoc von `render()` (Z. 346–350): die Aufzählung wird zu »… `OnCanvas2DStageRender` — the moment
to draw into the canvas and set `needsUpdate` —, sprite and view following a size a listener of it
gave the canvas, whose `OnCanvas2DStageResize` goes out with the next `render()`, the upload of
the canvas, `stageRenderer.updateFrame()` and `stageRenderer.renderTo()`.« Test in
`Canvas2DStage.spec.ts`, `describe('a canvas resized in place')`: nach einem ersten `render()` auf
64 × 64 setzt ein Listener von `OnCanvas2DStageRender` `canvas.width = 48; canvas.height = 32`;
im nächsten `render()` sieht `stageRenderer.renderTo()` (Spy im Stil der Datei, `sandbox`) Sprite
`[48, 32, 1]` und `projection.viewSpecs` `{width: 48, height: 32}`; ein Listener von
`OnCanvas2DStageResize` hört in diesem Frame nichts und im darauf folgenden `render()` genau
einmal. Titel: `a canvas a listener of OnCanvas2DStageRender resizes is drawn in its new size in
that frame, and the next render() sends OnCanvas2DStageResize`. **CHANGELOG** `CHANGELOG.md:198`
(»`Canvas2DStage` brings sprite and view to the size of a canvas … as `setCanvasSize()` does«)
endet danach mit: »; a canvas a listener of `OnCanvas2DStageRender` resizes in place is drawn in
its new size in that frame, and its `OnCanvas2DStageResize` goes out with the next `render()`«.

5.3 **`Canvas2DStage.spec.ts:478–481`** — nach `stage.dispose()` auch die Höhe prüfen:
`expect(() => stage.setContainerSize(320, Infinity)).toThrow(new RangeError('Canvas2DStage#setContainerSize(): height must be a finite number, got Infinity'));`

### 6. `utils/` und `sprites/`

6.1 **`passes/passFeatures.ts` `checkPass()`** — **rot zuerst.** Die Umbenennungsprüfungen
(Z. 92–118, `declares` und die Schleife über `uniformNames`) rücken direkt hinter die Formprüfung
von `uniformNames` (Z. 81–85), vor `material` (Z. 86–90) und `renderOrder` (Z. 91). TSDoc Z. 25–33:
»… `uniformNames` that are an object whose renames are sound, a `material` that is an object, and a
`renderOrder` that is a finite number.« statt »`uniformNames` and `material` that are objects, the
renames among them sound, and a `renderOrder` …«. Test in `definePass.spec.ts`,
`describe('uniformNames')`: ein Pass mit `uniformNames: {time: 'moonTime'}` (kein Feature
deklariert `time`) und `material: 5` wirft
`new TypeError('definePass: pass "moon" renames the uniform "time", which no feature of the pass declares')`
(heute die Meldung zu `material`). Titel: `checks the renames before the material`.

6.2 **Meldungen vollständig prüfen** — überall, wo ein Spec die Klasse mit `toThrow(Class)` und die
Meldung mit `toThrow('…')` als Teilstring prüft, beides durch `toThrow(new Class('…'))` mit der
vollen Meldung ersetzen:
- `features/PaletteSwap.spec.ts`, `features/TableFrame.spec.ts`, `features/placement.spec.ts`
  (`flatPlacement`, `axisBillboardPlacement`), `features/segments.spec.ts` — die Tabellen
  »refuses options of %o that are no object« (aus Paket 20).
- `passes/definePass.spec.ts:165–170` — `expect(define).toThrow(new errorClass(`definePass: ${message}`))`.
- `passes/definePass.spec.ts:178–181` (»is checked by FeatureSprites …«) — die Schleife liest
  `errorClass` mit und prüft `toThrow(new errorClass(`FeatureSprites: ${message}`))`. Schreibt
  `new FeatureSprites()` eine längere Meldung, steht die volle Meldung im Test; der Code bleibt.

6.3 **Zwei interne Helfer in `src/utils/`** (in keiner `public-api.ts`):

`isObject3D.ts`:

```ts
import type {Object3D} from 'three/webgpu';

/**
 * Whether `value` is a three.js `Object3D`, by its `isObject3D` flag — an object of another copy
 * of three counts as well. @internal
 */
export const isObject3D = (value: unknown): value is Object3D =>
  (value as {isObject3D?: unknown} | null | undefined)?.isObject3D === true;
```

`describeThreeValue.ts`:

```ts
import {describeValue} from './describeValue.js';
import {isObject} from './isObject.js';

/**
 * A refused value as a message quotes it: a three.js object that carries the flag `flag` —
 * `'isObject3D'`, `'isBufferGeometry'`, `'isMaterial'`, `'isNode'` — by its `type`, anything else
 * as {@link describeValue} writes it. @internal
 */
export const describeThreeValue = (value: unknown, flag: string): string =>
  isObject(value) && value[flag] === true && typeof value['type'] === 'string' ? value['type'] : describeValue(value);
```

`describeThreeValue.spec.ts`: ein `Mesh` mit `'isObject3D'` ist `'Mesh'`; ein `Mesh` mit
`'isMaterial'` und ein Objekt `{isObject3D: true}` ohne `type` stehen, wie `describeValue()` sie
schreibt; `undefined` ist `'undefined'`.

Umstellen: `lightOf.ts:5–6` und `planeOf.ts:9–10` verlieren ihr eigenes `isObject3D` und
importieren es; `FeatureSprites.ts:153–155` (`describePart()` samt Kommentar) entfällt, Z. 193 und
Z. 209 rufen `describeThreeValue(geometry, 'isBufferGeometry')` bzw.
`describeThreeValue(material, 'isMaterial')`; `OrthographicProjection.ts:143` wird
`` `OrthographicProjection: updateCamera() needs an OrthographicCamera, got ${describeThreeValue(camera, 'isObject3D')}` ``.
Die Meldungen bleiben Zeichen für Zeichen gleich; die bestehenden Specs dazu bleiben grün.
`AGENTS.md:128–129`: »A three.js object refused for its class is named by its `type`« wird zu »…
is named by its `type`, through `describeThreeValue()` in `src/utils/`«; den Absatz neu umbrechen,
wie die Datei umbricht.

6.4 **`bindings/planeOf.ts` `assertFinitePlane()` (Z. 16–21)** — **rot zuerst.** Ein Objekt mit
`isPlane: true` ohne `normal` wirft heute roh `Cannot read properties of undefined`. Als erste
Zeile:

```ts
  if (!isObject(plane.normal)) {
    throw new TypeError(`${WHERE}: ${name}.normal must be a Vector3, got ${describeValue(plane.normal)}`);
  }
```

TSDoc `planeOf()` Z. 49–51: der `@throws {TypeError}` endet »… for an `options.plane` that is no
`Plane`, and for a plane without a normal.« Tests in `bindings.spec.ts`, als zwei Zeilen in einer
neuen Tabelle neben »refuses a plane whose normal or constant is no finite number«:
`planeOf({isPlane: true, constant: 0} as never)` → `new TypeError('planeOf: plane.normal must be a Vector3, got undefined')`,
`planeOf(new Object3D(), {plane: {isPlane: true, constant: 0} as never})` →
`new TypeError('planeOf: options.plane.normal must be a Vector3, got undefined')`. **CHANGELOG**
`CHANGELOG.md:217`: nach »… with a `RangeError` that names the field« einfügen: », and a plane
without a normal with a `TypeError`«.

6.5 **`bindings.spec.ts:182–197`** — die beiden `test.each` von `lightOf()` werden einer: die
Zeilen `undefined`, `null`, `{}`, `{isDirectionalLight: true}` (zitiert
`{isDirectionalLight: true}`) und `new Vector3()` in einer Tabelle, die dritte Spalte ein String
oder — für den `Vector3`, den `describeValue()` als `[object Object]` schreibt — der RegExp
`/^lightOf: the node must be an Object3D/`, geprüft wie die Tabelle von `planeOf()` Z. 119–129:
`toThrow(typeof message === 'string' ? new TypeError(message) : message)`. Titel: `refuses a node
that is no Object3D with a TypeError that names lightOf and quotes it: %s`.

6.6 **Abweisungen, die den Wert zitieren** — Meldungen genau so; die Specs ziehen mit:
- `SpritePicker.ts:476`: `` `${WHERE}: the camera is no three.js Camera, got ${describeThreeValue(camera, 'isObject3D')}` ``
- `SpritePicker.ts:488`: `` `${WHERE}: takes a list of FeatureSprites, got ${describeThreeValue(sprites, 'isObject3D')} — pick(camera, pointer, [sprites])` ``
- `SpritePicker.ts:492`: `` `${WHERE}: the entry ${k} of the list is no FeatureSprites, got ${describeThreeValue(sprites[k], 'isObject3D')} — the picker draws FeatureSprites alone` ``
- `typedNodes.ts:16`: `` `asTextureNode: the node is no TextureNode, got ${describeThreeValue(node, 'isNode')} — sample() of a stage context answers one` ``
- `GridBase.ts:100`: `` `gridBase: takes {columns, rows}, got ${describeValue(options)} — gridBase({columns: 3, rows: 3})` ``
- `FeatureSprites.ts:631`: `` `${WHERE}: bindUniform("${name}") takes a source with a type of vec3 or vec4 and a write(), got ${describeValue(source)}` ``

Specs: `SpritePicker.spec.ts:208`, `:269`, `:273`; `typed-stages.spec.ts:33`; `GridBase.spec.ts:129`
(jede Zeile der Tabelle mit ihrem Wert); `FeatureSprites.spec.ts:330`, `:1099`. Wo ein Spec mehrere
Werte prüft, steht für jeden die volle Meldung. **Rot zuerst** für die neuen Meldungen (die Specs
zuerst auf den neuen Wortlaut, rot sehen, dann den Code). Proposals mit zitierter Meldung nachziehen:
`gpu-picking.md:258`, `:262`, `:264`; `pipeline-stages-and-grid-base.md:201`;
`sprite-uniform-bindings.md:153`. **CHANGELOG** `### Changed`, hinter dem Eintrag zu `definePass()`
(`CHANGELOG.md:71`): »- `SpritePicker#pick()`, `gridBase()` and `FeatureSprites#bindUniform()`
quote the value they refuse, as every other refusal of the library does — a three.js object by its
`type`: `SpritePicker#pick(): the camera is no three.js Camera, got Mesh`«.

6.7 **`spriteDeclarations.ts:102`** — die Meldung endet
`a uniform takes a finite number, 2 to 4 finite numbers, or {value, shared}`. Mitziehen:
`spriteDeclarations.spec.ts:81`, `:87`, `:93`; `defineSprite.spec.ts:342`; `CHANGELOG.md:81` (das
Zitat im bestehenden Eintrag); `pipeline-stages-and-grid-base.md:272`. **Rot zuerst** über die
Specs.

### 7. Browser-Tests

7.1 **`helpers/fixtures.js`** — neben `keep()` und `disposeKept()`:

```js
/**
 * Releases `item` now, as the subject of a test, and takes it off the list of {@link keep}, so
 * that {@link disposeKept} does not release it a second time. An item `keep()` does not hold is
 * released all the same.
 *
 * @template {{dispose(): unknown}} T
 * @param {T} item
 * @returns {ReturnType<T['dispose']>}
 */
export function release(item) {
  const at = kept.lastIndexOf(item);
  if (at >= 0) kept.splice(at, 1);
  return /** @type {ReturnType<T['dispose']>} */ (item.dispose());
}
```

`sprites-picking.test.js`, Test »builds nothing more over 50 picks …« (Z. 452–484):
`release(sprites)` statt `sprites.dispose()` (Z. 469), `release(colorMap)` statt
`colorMap.dispose()` (Z. 482); nach `picker.dispose()` (Z. 478) `picker = undefined;`, damit der
`afterEach` (Z. 60) ihn nicht noch einmal freigibt. `release` importieren. Den JSDoc von `keep()`
(Z. 123–132) um einen Satz ergänzen: »A test whose subject is the release of a kept item releases
it through {@link release}.«

7.2 **`harness-rejections.test.js`** — bei einem Timeout erreicht der Test sein `finally` nie, und
die Konsole bliebe für jede spätere Datei der Seite stumm. Die Stubs bucht der Test in eine
`Map` im `describe`, eine Funktion `restoreConsole()` setzt jede gebuchte Methode zurück und leert
die `Map`; der Test ruft sie in seinem `finally` wie heute, und ein `afterEach(restoreConsole)`
mit dem Kommentar »a test the runner times out never reaches its finally, and every file after it
would write into the stubs« holt sie auch nach einem Timeout zurück. Kein roter Lauf (ein Timeout
lässt sich in der Suite nicht provozieren, ohne sie rot zu machen); Abgleich: ein grüner Lauf der
Browser-Suite unter allen vier Launchern.

### 8. CHANGELOG

8.1 **Migration Guide »The deltas of a stopped Chronometer« (`CHANGELOG.md:1088–1110`)** — beide
Blöcke zeigen einen laufenden Frame vor der Pause. **Before** (`ts`, ungeprüft):

```ts
chronometer.update(); // a running frame
chronometer.stop();
chronometer.update();
const last = chronometer.deltaTime; // the delta of the last running frame
```

**After** (`ts check`):

```ts check
import {Chronometer} from '@spearwolf/twopoint5d';

const chronometer = new Chronometer(0);
chronometer.update(1 / 60); // a running frame
// read before the update() of the pause, which sets it to 0
const last = chronometer.deltaTime;
chronometer.stop();
chronometer.update();

export {last};
```

8.2 Die CHANGELOG-Zeilen aus 5.1, 5.2, 6.4, 6.6 und 6.7. Kein **BREAKING**: eine Meldung mit Wert
ist kein Bruch (wie in Paket 22), und ein `Canvas2DStage`, der den Frame in der Größe zeichnet, die
seine Canvas hat, ist die Zusage, die der Eintrag Z. 198 schon macht.

### 9. Gate

`pnpm run ci` grün. Die Browser-Suite läuft darin; die Proben aus 7.2 brauchen keinen eigenen Lauf.

## Was dieses Paket nicht tut

- Keine Messung gedrehter Elemente in ihren eigenen Achsen (siehe »Triage«).
- Keine Änderung der Reihenfolge der Prüfungen in `AsepriteJson.parse()` (Stelle 3 ist
  gegenstandslos).
- Keinen Umbruch von `Map2DTileCoordsUtil.ts:176` (kein Befund).
- Keine Änderung an `stage-pipeline.test.js`, an `StageRenderer.spec.ts` oder an
  `FixedFrameLoop.spec.ts` (deren lokale `thrownBy()` prüfen Identität, nicht Meldungen).
- Kein Eintrag in einem freigegebenen Abschnitt des CHANGELOG.

## Befunde im Volltext

Die kleinen Befunde der Reviewer, wie sie in `docs/remediation/paket-<N>.md` stehen, dazu die
Einträge der Queue und die Folge aus Paket 23.

**Paket 2** (`paket-2.md`, »Kleine Befunde (ohne Runde)«)
- `packages/twopoint5d-testing/test/sprites-picking.test.js:84-85` — `makeSprites()` hält
  `colorMap` und `sprites` per `keep()`, der Test »builds nothing more over 50 picks …«
  (`:469`, `:482`) gibt beide als Gegenstand frei, `disposeKept()` ruft sie ein zweites Mal;
  so schon mit dem lokalen Array, `keep()` blieb laut Plan an Ort und Stelle

**Paket 3** (»Kleine Befunde, offen gelassen«)
- `scripts/ci/nxCacheServer/createCacheServer.mjs`, `serve()`, `finally`: wirft `handle.close()`
  selbst, überdeckt der Fehler den von `stat()`/`utimes()`, und im Log stünde der falsche Grund;
  Status bleibt richtig.
- `scripts/checkNameableTypes.mjs:42`: die `/`-Normalisierung des Entry-Schlüssels hat keinen
  Test, die CI läuft nur unter Linux.

**Paket 5** (»Kleine Befunde des Reviewers (offen, ohne Runde)«)
- `packages/twopoint5d/src/stage/Canvas2DStage.ts:264` — ändert ein Listener von
  `OnCanvas2DStageRender` die Canvas-Größe in place, zeigt dieser Frame die neue Textur einen
  Frame lang auf Sprite und Sicht der alten Größe.

**Paket 6** (»Kleine Befunde (keine Runde)«)
1. `TextureStore.ts:1029–1060` — der `catch` in `#writeItems()` fängt auch einen Wurf aus der
   Schleife selbst, nicht nur aus dem Flush; dann ginge `ready` hinaus und `evictMissing`
   disposte Ressourcen benannter, aber nicht geschriebener Items. Heute wirft die Schleife nur
   über `expectDefined`, der Kommentar »after the loop has written every item« trägt also —
   ungeschützt. Absicherung: ein `written`-Flag am Schleifenende, das im `catch` den Wurf
   andernfalls weiterreicht.
2. `TextureStore.ts:1393–1491` — `#getOnce()` 99 Zeilen statt etwa 80 (vom Implementierer
   gemeldet; `track()`/`settle()`/`giveUp()` bleiben laut Detailplan inline).
6. `TextureStore.spec.ts:3219–3257` — ohne Spec: ein verworfenes Item, dessen ID weiter eine
   Ressource trägt, merkt sich keinen Grund (`#refusalsWithoutResource`, `TextureStore.ts:1144`),
   und der Grund ist schon für einen `ready`-Listener sichtbar (`:883`).

**Paket 7** (»Kleine Befunde (ohne Runde)«)
- `packages/twopoint5d/src/texture/AsepriteJson.ts:263` — die Dauerprüfung läuft vor den Prüfungen
  von `TexturePackerJson`; ein Frame im Layout »Array« ohne `filename` wird als `the duration of the
  frame "undefined"` gemeldet. Ursache ist die vorbestehende Namensschleife, als Nebenbefund in
  »Offene Befunde«.

**Paket 8** (»Kleine Befunde (keine Runde)«)
- `Map2DSpatialHashGrid#add()` — `#cellsOf()` läuft je Renderable zweimal (Prüfschleife und
  Einsortieren); harmlos, doppelte Rechnung
- `RectangularVisibilityArea.spec.ts` (`describe('maxVisibleTiles')`) — zwei Pfade des Merkers
  `#gridChangeRefused` ohne Test: Rückkehr zu Gitter A nach Abweisung auf B, Ab- und
  Wiedereinschalten (`width = 0`) zwischen Abweisung und nächstem Rechnen

**Paket 11** (»Kleine Befunde (lösen keine Runde aus)«)
2. `planeOf.ts:20–25` — ein Objekt mit `isPlane: true` ohne `normal` scheitert in
   `assertFinitePlane()` mit einem rohen `Cannot read properties of undefined` statt einer Meldung
   mit Subjekt `planeOf` (konstruierter Randfall, wirft weiter beim Aufruf).
3. `bindings.spec.ts:263–268` — die Regex-Fälle von `lightOf()` (`{isDirectionalLight: true}`,
   `new Vector3()`) stehen in einem zweiten `test.each` mit eigenem Titel statt im einen aus dem
   Plan; Abdeckung gleich.
4. `lightOf.ts:5` / `planeOf.ts:9` — `isObject3D` wortgleich in beiden Dateien, wie der Plan es
   vorsah.

**Paket 12** (»Kleine Befunde (keine Runde)«)
- `GeometryAttributeSlots.ts:139` (`withdrawRoute`) — Zweig für einen Claim, der nicht oben liegt,
  ungetestet (laut Plan bei angehängter Route nicht erreichbar)

**Paket 13** (»Kleine Befunde (keine Runde)«)
- `TileSet.ts:285` — bei denormaler Tile-Breite ohne `tileCount` lautet die Meldung »Infinity tiles
  of 5e-324 × … fit into …«; bei `fitting === Infinity` läse sich »more than … tiles« besser.

**Paket 14** (»Urteil des Reviewers«)
- klein: `harness-rejections.test.js` — bei einem Timeout im Test laufen Logs bis zum `finally`
  ins Leere; tolerierbar.

**Paket 15** (»Urteil des Reviewers«)
- klein: Der Disposed-Zweig im Test prüft nur die Breite, nicht die Höhe.

**Paket 18** (»Kleine Befunde (keine Runde)«)
- `styleUtils.ts:40` / TSDoc `:62–67` — bei einem gedrehten Element skaliert `rectSide /
  layoutSide` die Ränder im Verhältnis Bounding Box zu Layoutgröße, nicht mit der Skala des
  Elements; die TSDoc sagt das.

**Paket 19** (»Kleine Befunde (keine Runde)«)
- `src/texture/TexturePackerJson.ts:104–107` — geprüft wird `jsonFrames`, gelesen danach wieder
  `data.frames`
- `src/texture/AsepriteJson.spec.ts` (Fall »two slices of one name«) — `toThrow(Error)` nagelt die
  Klasse nicht gegen `TypeError` fest
- Meldung »the bounds of … is undefined« — Plural mit »is«, Wortlaut aus Schritt 4

**Paket 20** (»Kleine Befunde (lösen keine Runde aus)«)
- `passFeatures.ts:91–93`: die Umbenennungsprüfungen von `uniformNames` laufen nach den Prüfungen
  von `material` und `renderOrder`, Schritt 8 setzt sie direkt hinter die Formprüfung von
  `uniformNames`; bei zwei Fehlern wird ein anderer zuerst gemeldet, abgewiesen werden beide.
- Factory-Specs und `definePass.spec.ts:166` prüfen die Meldung per `toThrow(string)` als
  Teilstring; die Klasse wird getrennt geprüft.

**Paket 23** (»Urteil des Reviewers«, als `Folgen:` im Plan)
1. `CHANGELOG.md:~1088ff`, Migration Guide »The deltas of a stopped Chronometer«, After-Block liest
   `deltaTime` an einem frischen `Chronometer` ohne `update()` — Wortlaut stammt aus dieser
   Paketdatei; als `Folgen:` im Plan für Paket 24.

**Queue** (»Offene Befunde« im Plan)
- `packages/twopoint5d/src/sprites/SpritePicker.ts:476`, `:488`, `:492`,
  `src/sprites/typedNodes.ts:16`, `src/sprites/GridBase.ts:100`,
  `src/sprites/FeatureSprites/FeatureSprites.ts:631` (`bindUniform()`) — Abweisungen, die den
  abgewiesenen Wert nicht zitieren: `SpritePicker: the camera is no three.js Camera` (ohne den
  `type` des Objekts), `takes a list of FeatureSprites`, `the entry k of the list is no
  FeatureSprites`, `asTextureNode: the node is no TextureNode`, `gridBase: takes {columns, rows}`,
  `bindUniform("x") takes a source with a type of vec3 or vec4 and a write()` — gegen die
  Fehlermeldungsregel in AGENTS.md (Wert über `describeValue()`, ein three.js-Objekt nach seinem
  `type`); am Laufbeginn schon so (`git show 7341059f:` dieselben Meldungen, `GridBase.ts` Z. 97)
  · Paket 22 (Zug 0) · low
- `packages/twopoint5d/src/sprites/spriteDeclarations.ts:102` (Abweisung eines deklarierten
  Startwerts in `collectSpriteDeclarations()`) — die Meldung sagt `a uniform takes a number, 2 to 4
  numbers, or {value, shared}`, ohne »finite«, obwohl `isUniformValue()` nur endliche Zahlen
  durchlässt und die Startwerte der Optionen seit Paket 22 `finite numbers` nennen; am Laufbeginn
  schon so (`git show 7341059f:…spriteDeclarations.ts`, Z. 101) · Paket 22 (Review) · low
- `packages/twopoint5d/src/map2d/Map2DTileCoordsUtil.ts:172` (`clone()`) — Codezeile mit 125
  Zeichen über der Breite von 100, die die Datei sonst hält (Biome-Limit 130 greift nicht) ·
  Paket 23 · info
