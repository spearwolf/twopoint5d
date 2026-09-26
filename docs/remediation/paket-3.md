# Paket 3 — map2d: die Zusagen im @throws von TileSpritesFactory#createTile() mit Tests belegen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — ein Nebenbefund aus dem Review von Paket 2
  (info, Domain map2d, vorbestehend seit `ead22dd1`), Volltext unten
- Ziel: `TileSpritesFactory.spec.ts` hält jede Zusage im `@throws` von `createTile()` fest.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts` (einzige
  Datei, die sich am Ende ändert). `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`
  wird nur für die Mutationsprobe in Schritt 3 kurz angefasst und danach wiederhergestellt.
- Kein CHANGELOG-Eintrag: das Paket fügt nur Tests hinzu, am Verhalten der Bibliothek ändert
  sich nichts (wie Paket 1a).
- Kein Bugfix-Paket: das Verhalten stimmt bereits, die Tests halten es fest. Einen roten Lauf
  vor einem Fix gibt es deshalb nicht; an seine Stelle tritt die Mutationsprobe in Schritt 3,
  die belegt, dass jeder neue Test beißt.

## Vorgehen

Ausgangslage im Code (`packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`):

- `:41-44` — das `@throws` von `createTile()` sagt zu: ein `Error` ohne `tileDataProvider`;
  ein `Error` ohne `tileSet` *nur für eine Koordinate, deren Tile-Id nicht `0` ist*; der
  `RangeError` von `TileSet#frameId()`, wenn der Provider eine Tile-Id antwortet, die keine
  ganze Zahl ist; und in jedem dieser Fälle: nichts wird aus dem Pool genommen.
- `:56` `if (tileDataId === 0) return;` steht **vor** der `tileSet`-Prüfung (`:58-64`) — daraus
  folgt die Zusage für Tile-Id `0` ohne `tileSet`.
- `:65` `tileSet.frameId(tileDataId)` — `TileSet#frameId()` (`src/texture/TileSet.ts:151-153`)
  wirft `RangeError` mit der Meldung `[TileSet] tileId must be a whole number, got <value>`,
  wobei `<value>` per `describeValue()` gebildet wird (`1.5` → `1.5`, `NaN` → `NaN`).
- `:73` `this.createTileSprite()` nimmt den Slot erst, nachdem alles geworfen hat, was werfen kann.

Die Spec deckt heute die ersten beiden Zusagen ab (Tests `a factory without a tile set throws …`
bei `TileSpritesFactory.spec.ts:44` und `a factory without a tile data provider throws …` bei
`:57`), die beiden anderen nicht.

1. **Zwei Tests einfügen** in `TileSpritesFactory.spec.ts`, im `describe('createTile()', …)`,
   direkt nach dem Test `a factory without a tile data provider throws an Error naming the method,
   the field and the tile, and leaves the instanced pool as it found it` (endet bei `:68`) und vor
   `a tile the factory can build takes a slot out of the instanced pool` (`:70`). Keine neuen
   Imports nötig: `TileSprites`, `TileSpritesGeometry`, `TileSpritesFactory`,
   `RepeatingTilesProvider`, `Map2DTileCoords` und der Helfer `makeTileSet` (`:18`) sind da.
   `new RepeatingTilesProvider(<number>)` legt ein 1×1-Muster an, das der Provider ungeprüft für
   jede Koordinate antwortet — auch `1.5` und `NaN`.

   ```ts
       test('a factory without a tile set answers undefined for a coordinate whose tile id is 0 and takes no slot', () => {
         const tileSprites = new TileSprites(new TileSpritesGeometry(4));
         const factory = new TileSpritesFactory(tileSprites, undefined, new RepeatingTilesProvider(0));
         const pool = tileSprites.geometry!.instancedPool;

         expect(factory.createTile(new Map2DTileCoords(0, 0))).toBeUndefined();
         expect(pool.usedCount, 'usedCount after a coordinate without a tile').toBe(0);
       });

       test.each([
         [1.5, '1.5'],
         [NaN, 'NaN'],
       ])(
         'a tile id of %s from the tile data provider throws the RangeError of TileSet#frameId() and leaves the instanced pool as it found it',
         (tileId, shown) => {
           const tileSprites = new TileSprites(new TileSpritesGeometry(4));
           const factory = new TileSpritesFactory(tileSprites, makeTileSet(), new RepeatingTilesProvider(tileId));
           const pool = tileSprites.geometry!.instancedPool;

           const call = () => factory.createTile(new Map2DTileCoords(0, 0));
           expect(call).toThrow(RangeError);
           expect(call).toThrow(`[TileSet] tileId must be a whole number, got ${shown}`);
           expect(pool.usedCount, 'usedCount after a throw').toBe(0);
         },
       );
   ```

   Die Formatierung setzt Prettier: `pnpm exec prettier --write packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts`.
   Die Fehlerklasse und die volle Meldung werden beide geprüft — so halten es alle
   Grenzfehler-Tests der map2d-Specs (und `TileSet.spec.ts:163-176` für dieselbe Meldung).

2. **Grün sehen:** `pnpm nx test twopoint5d -- src/map2d/TileSprites/TileSpritesFactory.spec.ts`
   — alle Tests der Datei grün, die drei neuen Testfälle (einer plus zwei aus `test.each`)
   in der Ausgabe.

3. **Mutationsprobe — belegen, dass jeder neue Test beißt.** Jede Mutation einzeln in
   `TileSpritesFactory.ts` einsetzen, die Spec-Datei wie in Schritt 2 laufen lassen, die rot
   gewordenen Testnamen samt Assertion-Zeile in den Report schreiben, dann die Datei mit
   `git checkout -- packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`
   wiederherstellen, bevor die nächste kommt:
   - **M1** — die Zeile `if (tileDataId === 0) return;` (`:56`) hinter den `tileSet`-Block
     verschieben (nach `:64`). Erwartet rot: `a factory without a tile set answers undefined …`
     (wirft `has no tileSet …`).
   - **M2** — direkt nach `:56` die Zeile `if (!Number.isInteger(tileDataId)) return;`
     einfügen. Erwartet rot: beide Fälle `a tile id of 1.5 …` und `a tile id of NaN …`
     (kein Wurf mehr).
   - **M3** — die Zeile `const sprite = this.createTileSprite();` (`:73`) direkt vor
     `const frameId = tileSet.frameId(tileDataId);` (`:65`) verschieben. Erwartet rot: die
     `usedCount`-Assertion beider `test.each`-Fälle (1 statt 0).

   Ist ein erwarteter Test unter einer Mutation grün, ist der Test falsch gebaut — dann den Test
   nachschärfen, nicht die Mutation. Am Ende muss
   `git diff --exit-code -- packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`
   mit 0 enden: die Quelldatei ist unverändert.

4. **Gate:** `pnpm run ci` (Verify unten).

## Verify

`pnpm run ci`

## Commit

`test(map2d): hold TileSpritesFactory#createTile() to the undefined it answers for tile id 0 without a tile set and to the RangeError of TileSet#frameId() for a tile id that is no whole number, with the instanced pool left as it was`

## Verlauf

- 2026-09-26 Zug 0: Detailplan steht · Nebenbefund unverändert: `TileSpritesFactory.ts:56`
  kehrt vor der `tileSet`-Prüfung (`:58-64`) zurück, `:65` ruft `TileSet#frameId()` mit dem
  `RangeError` aus `TileSet.ts:152`, `@throws` bei `:41-44`; in `TileSpritesFactory.spec.ts`
  kein Test für Tile-Id `0` ohne `tileSet` und keiner für eine Tile-Id, die keine ganze Zahl ist ·
  vorbestehend bestätigt mit `git show ead22dd1:…/TileSpritesFactory.ts` (gleiche Reihenfolge,
  `frameId()` mit demselben `RangeError`; `980a01e5` hat nur den Text des `@throws` ausgeschrieben,
  nicht das Verhalten geändert) · kein Audit-Finding nennt `TileSpritesFactory` · Folgen der
  Pakete 1, 1a, 2: keine offen · »Offene Befunde«: zwei Einträge (texture, stage), beide
  `→ Audit`, keine gemeinsame Ursache, bleiben liegen · Restplan: Paket 3 ist das letzte Paket,
  Reihenfolge und Schnitt bleiben
- 2026-09-26 Zug 1: Implementierer beauftragt, Modell sonnet (mittlere Stufe), Effort low, Report nach paket-3.impl-0.json
- 2026-09-26 Zug 2: Report FERTIG · geändert `TileSpritesFactory.spec.ts` (3 Testfälle), Quelldatei unverändert · Mutationsprobe M1–M3 rot wie erwartet (M3: usedCount 2 statt 1, weil `call` zweimal läuft) · Arbeitsbaum schmutzig · `pnpm run ci` exit=0, Log paket-3.verify.log
- 2026-09-26 Zug 3: Reviewer (sonnet, low) — Nebenbefund behoben, keine kritischen/wichtigen Befunde, 2 klein · Diff paket-3.diff · Report paket-3.review-0.json
- 2026-09-26 Zug 4: keine Runde nötig
- 2026-09-26 Zug 5: committet `af225b63`, Verify aus Zug 2 (exit=0, keine Änderung seither)

## Urteil des Reviewers

- Nebenbefund (Zusagen im `@throws` von `createTile()`): behoben — `TileSpritesFactory.spec.ts`, Test `a factory without a tile set answers undefined for a coordinate whose tile id is 0 and takes no slot` und `test.each` `a tile id of %s from the tile data provider throws the RangeError of TileSet#frameId() …` (1.5, NaN), direkt nach dem Test »without a tile data provider«
- klein: `call` läuft im `test.each` zweimal (je `toThrow`), unter M3 zählt der Pool deshalb 2 statt 1; Test beißt trotzdem, Form folgt dem Detailplan
- klein: kein CHANGELOG-Eintrag, zu Recht (nur Tests)

## Findings im Volltext

Kein Audit-Finding. Der Nebenbefund, wie er im Plan unter Paket 3 steht:

**Nebenbefund · info · `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts`** —
kein Test hält fest, dass `createTile()` ohne `tileSet` für eine Tile-Id `0` `undefined`
antwortet statt zu werfen, und keiner den `RangeError` von `TileSet#frameId()` bei einer nicht
ganzzahligen Tile-Id; beides sagt das `@throws` von `TileSpritesFactory.ts:41` zu · aus Paket 2
(Review) · vorbestehend (`ead22dd1`), info, Domain map2d.

Begründung der Modellwahl: die Tests stehen fast wörtlich im Detailplan (daher Effort `low`),
die Mutationsprobe arbeitet aber aus Prosa und fasst Quellcode an, der danach unverändert sein
muss — das ist die Untergrenze der mittleren Stufe. Der Reviewer braucht für einen reinen
Test-Diff dieser Größe ebenfalls nur die mittlere Stufe.
