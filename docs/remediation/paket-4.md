# Paket 4 — Sprites und map2d: die kleinen Review-Befunde der Pakete 1a, 2 und 3

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — fünf kleine Review-Befunde aus den Paketen 1a, 2 und 3
  (Volltext unten), dazu eine dritte Stelle derselben Leerzeilen-Ursache aus Paket 1a
- Folge von: Paket 1a, Paket 2, Paket 3
- Ziel: Die Domains sprites und map2d hinterlassen keinen offenen Review-Befund aus diesem Lauf.
- Modell: mittlere Stufe (sonnet)
- Effort: low
- Dateien:
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts`
  - `packages/twopoint5d/src/map2d/CameraBasedVisibility.spec.ts`
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.spec.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts` (nur TSDoc)
  - `packages/twopoint5d/CHANGELOG.md` (nur `[Unreleased]` → `### Fixed`)
- Verify: `pnpm run ci`
- Commit: `docs(sprites,map2d): say in the TSDoc of TexturedSprites#createSprite() that a new sprite starts with texFlipDiagonal at 0, give the slot reset of TexturedSprites#createSprite() one changelog entry and that of AnimatedSprite another, call createTile() once in each throw test of the TileSpritesFactory spec that counts the pool afterwards, and set the throw checks of the Map2DTileStreamer and CameraBasedVisibility specs apart from the call they check by a blank line`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · Leerzeilen `Map2DTileStreamer.spec.ts` unverändert an `:102-109` · `create`-Konstante `TileSpritesFactory.spec.ts:49` umgeformt (Paket 2 hat den Test mit einer `call`-Konstante neu geschrieben, Rest geht in Schritt 3 auf) · CHANGELOG-Bullet von `:16` nach `:274` gewandert, `:273` (Paket 1) beschreibt denselben Slot-Reset und wird mit gefasst · TSDoc `TexturedSprites.ts:62-63` unverändert · Doppelaufruf im `test.each` unverändert an `TileSpritesFactory.spec.ts:79-94`, dieselbe Ursache an `:44-55` und `:57-68` (Paket 2) mitgenommen · Leerzeile `CameraBasedVisibility.spec.ts:270-274` als dritte Stelle der 1a-Ursache aufgenommen · Queue: beide Einträge (texture, stage) teilen keine Ursache, bleiben liegen · keine `Folgen:` offen
  - 2026-09-26 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach paket-4.impl-0.json
  - 2026-09-26 Zug 2: Report FERTIG_MIT_VORBEHALT (drei Dateien nur ausschnittweise gelesen) · 5 Dateien geändert (Map2DTileStreamer.spec.ts, CameraBasedVisibility.spec.ts, TileSpritesFactory.spec.ts, TexturedSprites.ts, CHANGELOG.md) · Mutationsprobe 4× `expected 1 to be +0`, TileSpritesFactory.ts zurückgesetzt · Arbeitsbaum schmutzig · Verify ohne Nx-Cache exit=0 (paket-4.verify.log)
  - 2026-09-26 Zug 3: Reviewer (sonnet, low): alle sechs Stellen erfüllt, nichts kritisch/wichtig, ein kleiner Befund · Diff paket-4.diff
  - 2026-09-26 Zug 4: keine Runde nötig
  - 2026-09-26 Zug 5: committet `ef223cae`, Verify paket-4.verify.log exit=0

## Vorgehen

Kein Schritt ändert Laufzeitverhalten der Bibliothek. Nichts in `public-api.ts`, keine
Signatur, kein Export. Die Reihenfolge ist beliebig; Schritt 6 kommt nach Schritt 3.

### 1. `Map2DTileStreamer.spec.ts` — Leerzeile nach Konstante (heute Zeile 101–111)

Die Grenzfälle der map2d-Specs haben die Form: Konstante mit dem Aufruf, Leerzeile, dann die
`expect`-Zeilen (`Map2DSpatialHashGrid.spec.ts:32-35`, `RectangularVisibilityArea.spec.ts:175-178`,
`Map2D.spec.ts:120-124`). Der Test `a tile size that cannot be divided by is refused` bekommt zwei
Leerzeilen, sonst ändert sich nichts. Soll-Zustand:

```ts
    test('a tile size that cannot be divided by is refused', () => {
      const create = () => new Map2DTileStreamer(0, 16);

      expect(create).toThrow(RangeError);
      expect(create).toThrow('[Map2DTileStreamer] tileWidth must be a finite number above 0, got 0');

      const layer = new Map2DTileStreamer(8, 16);
      const write = () => (layer.tileWidth = 0);

      expect(write).toThrow(RangeError);
      expect(write).toThrow('[Map2DTileStreamer] tileWidth must be a finite number above 0, got 0');
      expect(layer.tileWidth, 'tileWidth after a refused write').toBe(8);
    });
```

### 2. `CameraBasedVisibility.spec.ts` — Leerzeile nach der `write`-Konstante (heute Zeile 270–276)

Eine Leerzeile zwischen `};` (Zeile 273) und `expect(write).toThrow(TypeError);`. Sonst nichts.
Soll-Zustand:

```ts
      const write = () => {
        // @ts-expect-error — a getter without a setter
        visibility.map2dTileCoords = new Map2DTileCoordsUtil();
      };

      expect(write).toThrow(TypeError);
      // the rest of the wording is the engine's, not the library's
      expect(write).toThrow(/map2dTileCoords/);
```

### 3. `TileSpritesFactory.spec.ts` — ein Aufruf je Wurf-Test, der danach den Pool zählt

Jedes `expect(call).toThrow(…)` ruft `call` erneut. In drei Tests folgt darauf
`expect(pool.usedCount, …).toBe(0)`: nimmt `createTile()` den Slot vor dem Wurf, zählt der Pool
dann 2 statt 1, und die Meldung sagt nicht mehr, was ein einzelner Aufruf angerichtet hat.
Diese drei Tests rufen `createTile()` deshalb genau einmal, fangen den Fehler und prüfen danach
Klasse und Meldung. Das Idiom gibt es im Repo schon: `catchError` in `src/display/Display.spec.ts:1158`.

**3a. Helper.** Direkt nach `attrAt` (heute Zeile 37–40) und vor `describe('TileSpritesFactory', …)`,
mit einer Leerzeile davor und danach, auf Modulebene:

```ts
/**
 * Calls `fn` once and answers what it threw, `undefined` when it returned. A test that counts the
 * slots of the pool after a throw calls through this, since every `toThrow()` would call again.
 */
const catchError = (fn: () => void): unknown => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
};
```

Lokal in dieser Spec, wie in `Display.spec.ts`: das Paket hat keinen gemeinsamen Ort für
Spec-Helper, und für zwei Dateien legt dieses Paket keinen an.

**3b. Test `a factory without a tile set throws an Error …`** (heute Zeile 44–55). Titel, die ersten
drei Zeilen und die Pool-Prüfung bleiben; `const call …` und die beiden `expect(call)` werden zu:

```ts
      const error = catchError(() => factory.createTile(new Map2DTileCoords(0, 0)));

      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty(
        'message',
        'TileSpritesFactory#createTile() has no tileSet to look up tile id 1 of tile 0,0 in: set TileSpritesFactory#tileSet before the factory builds tiles',
      );
      expect(pool.usedCount, 'usedCount after a throw').toBe(0);
```

**3c. Test `a factory without a tile data provider throws an Error …`** (heute Zeile 57–68), gleich
gebaut:

```ts
      const error = catchError(() => factory.createTile(new Map2DTileCoords(2, 3)));

      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty(
        'message',
        'TileSpritesFactory#createTile() has no tileDataProvider to read tile 2,3 from: set TileSpritesFactory#tileDataProvider before the factory builds tiles',
      );
      expect(pool.usedCount, 'usedCount after a throw').toBe(0);
```

**3d. `test.each` `a tile id of %s from the tile data provider throws the RangeError …`** (heute
Zeile 79–94). Tabelle und Titel bleiben; der Rumpf nach `const pool …`:

```ts
        const error = catchError(() => factory.createTile(new Map2DTileCoords(0, 0)));

        expect(error).toBeInstanceOf(RangeError);
        expect(error).toHaveProperty('message', `[TileSet] tileId must be a whole number, got ${shown}`);
        expect(pool.usedCount, 'usedCount after a throw').toBe(0);
```

`toHaveProperty('message', …)` prüft die ganze Meldung, `toThrow('…')` nur einen Teilstring. Die
drei Texte oben sind die vollständigen Meldungen: `TileSpritesFactory.ts:49-52` und `:60-63`
setzen sie aus zwei Stücken zusammen, `TileSet.ts:55` baut `[TileSet] ${name} must be ${rule}, got
${describeValue(value)}`. Schlägt die Gleichheit fehl, nicht auf `toThrow` zurückweichen, sondern
den Text mit der Quelle abgleichen und im Report nennen.

Nach dem Schritt steht in der Datei keine `call`-Konstante mehr. Die übrigen Tests der Datei
bleiben, wie sie sind.

### 4. `TexturedSprites.ts` — TSDoc von `createSprite()` (heute Zeile 62–63)

»upright« meint `texFlipDiagonal` 0 und liest sich wie eine Wiederholung von `rotation`. Die
Aufzählung folgt der Reihenfolge der Attribute in `TexturedSpriteDescriptor`
(`TexturedSprite.ts:117-126`). Die beiden Zeilen werden zu:

```ts
   * The sprite starts with its size, tex coords, `texFlipDiagonal`, trim margins, position and
   * rotation at 0, and white as its color, whatever the sprite that stood in its slot before carried.
```

Der erste Absatz des TSDoc (Zeile 59–60) bleibt.

### 5. `packages/twopoint5d/CHANGELOG.md` — ein Bullet je Slot-Reset (heute Zeile 273–274)

Beide Bullets stehen unter `## [Unreleased]` → `### Fixed` und stammen aus diesem Lauf (Zeile 273
aus `324ab4a1`, Zeile 274 aus `980a01e5`). Zeile 274 bündelt `TexturedSprites#createSprite()` mit
`AnimatedSprite`, und Zeile 273 beschreibt denselben Slot-Reset von `createSprite()` ein zweites Mal
für zwei weitere Attribute. Nach dem Schritt gibt es genau einen Bullet je Änderung. Die beiden
Zeilen 273 und 274 werden an ihrer Stelle durch diese zwei ersetzt, sonst ändert sich in der
Datei nichts:

```markdown
- fix `TexturedSprites#createSprite()`: the sprite starts with its size, tex coords, `texFlipDiagonal`, trim margins, position and rotation at 0, as in a slot no sprite has stood in, whatever the sprite that stood in its slot before carried
- fix `AnimatedSprite`: a sprite that `VertexObjectPool#createVO()` of an `AnimatedSpritesGeometry` hands out starts with its size, `animId`, `animOffset`, position and rotation at 0, as in a slot no sprite has stood in, whatever the sprite that stood in its slot before carried
```

Die Farbe fehlt mit Absicht: `TexturedSprite#[voInitialize]()` setzte sie schon vor diesem Lauf
auf Weiß (`git show ead22dd1:packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts`,
Zeile 48–50), sie ist kein Teil des Fixes. Keine `### Migration Guide`-Ergänzung, siehe unten.

### 6. Mutationsprobe für Schritt 3 (nicht committen)

Kein Bugfix, also kein roter Lauf vor der Änderung. Stattdessen belegt eine Probe, dass die drei
umgebauten Tests weiter beißen und jetzt die Zahl eines einzelnen Aufrufs melden:

1. In `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts` die Zeile
   `const sprite = this.createTileSprite();` (heute Zeile 73) an den Anfang von `createTile()`
   verschieben, vor `const {tileDataProvider} = this;`.
2. `pnpm nx test twopoint5d -- src/map2d/TileSprites/TileSpritesFactory.spec.ts` — erwartet: die
   Tests aus 3b, 3c und beide Fälle aus 3d rot mit `usedCount after a throw` und `expected 1 to be 0`
   (nicht 2). Die Ausgabe dieser vier Fehlschläge gehört in den Report. Weitere Tests der Datei, die
   einen leeren Pool erwarten, werden unter der Probe ebenfalls rot; das ist erwartet und kein Befund.
3. Die Datei zurücksetzen und belegen, dass sie unverändert ist:
   `git checkout -- packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts && git diff --exit-code -- packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`.

### Nicht in diesem Paket

- Die anderen Grenzfälle der map2d-Specs (`Map2DTileCoordsUtil.spec.ts`,
  `RectangularVisibilityArea.spec.ts`, `Map2DSpatialHashGrid.spec.ts`, `Map2D.spec.ts`,
  `DataIdsChunk2D.spec.ts`, `RepeatingTilesProvider.spec.ts`) rufen ihre Konstante zweimal auf,
  zählen danach aber nichts, was ein zweiter Aufruf verfälscht — sie bleiben bei der Form
  `toThrow(Klasse)` + `toThrow(Meldung)`. `Map2DTileStreamer.spec.ts:110` prüft nach zwei
  abgelehnten Schreibzugriffen einen Wert, der davon nicht abhängt.
- Kein Migration Guide für den Slot-Reset (Punkt 4 des Reviewers von Paket 2, dort »nur
  festgehalten«): Nach `updating-changelog` braucht es einen, wenn ein Konsument seinen Code ändern
  muss. Hier muss keiner — wer nach `createSprite()` die Attribute schreibt, die er braucht, merkt
  nichts, und wer die geerbten Werte las, las die eines beliebigen Vorgängers im Slot. Es gibt kein
  Aufrufmuster, das jetzt wirft oder anders zu schreiben wäre.
- `TileSpritesFactory.ts` bleibt unverändert (außer vorübergehend in Schritt 6).
- Die beiden Einträge in »Offene Befunde« (`FrameBasedAnimations.ts:104`, Domain texture;
  `OrthographicProjection.ts:133`/`ParallaxProjection.ts:136`, Domain stage) teilen keine Ursache mit
  diesem Paket und liegen außerhalb der Scope-Regel.

## Abgleich (Zug 0, 2026-09-26)

Quelle der Befunde: die Abschnitte »Urteil des Reviewers« in `paket-1a.md` und `paket-3.md` und
»Review (Zug 3)« in `paket-2.md`. Alle fünf Einträge im Plan decken sich mit dem Wortlaut dort.
Paket 2 Punkt 3 wurde Paket 3, Paket 2 Punkt 4 ist »nur festgehalten« (entschieden unter »Nicht in
diesem Paket«), Paket 3 Punkt 2 (»kein CHANGELOG-Eintrag, zu Recht«) ist kein Mangel.

| Befund | Stand | Fundstelle jetzt | Schritt |
| --- | --- | --- | --- |
| Leerzeile `Map2DTileStreamer.spec.ts` (1a) | unverändert | `Map2DTileStreamer.spec.ts:102-109`, Konstante und `expect` ohne Leerzeile, zweimal | 1 |
| `create`-Konstante `TileSpritesFactory.spec.ts:49` (1a) | umgeformt | Paket 2 hat den Test neu geschrieben: `:49` ist jetzt `const call = () => factory.createTile(…)`, eine Konstante, aber `call` statt einer Handlung und ohne Leerzeile | 3 |
| CHANGELOG-Bullet bündelt zwei Slot-Resets (2) | verschoben | `CHANGELOG.md:274`; `:273` beschreibt denselben Slot-Reset von `createSprite()` getrennt | 5 |
| »upright« im TSDoc von `createSprite()` (2) | unverändert | `TexturedSprites.ts:62` | 4 |
| `call` läuft im `test.each` zweimal (3) | unverändert | `TileSpritesFactory.spec.ts:89-92` | 3d |

Mitgenommen, gleiche Ursache:

- `TileSpritesFactory.spec.ts:49-54` und `:62-67` (Paket 2) haben denselben Doppelaufruf vor der
  Pool-Prüfung wie der `test.each` aus Paket 3, der ihre Form übernahm. Drei Stellen einer Ursache,
  ein Schritt (3b, 3c, 3d).
- `CameraBasedVisibility.spec.ts:270-274` (Paket 1a, `0b0b0877`): `const write = () => {…};` direkt
  gefolgt von `expect(write)` — dieselbe Abweichung vom Leerzeilen-Rhythmus wie in
  `Map2DTileStreamer.spec.ts`, der Reviewer von 1a nannte sie nicht (Schritt 2).

Entscheidungen im Zug 0, je mit Grund:

- Der 1a-Befund »ohne `create`-Konstante« wird nicht durch Umbenennen von `call` in `create` erfüllt,
  sondern geht in Schritt 3 auf: die drei Tests rufen einmal auf, der benannte Wert ist das gefangene
  `error`, und die Leerzeile trennt ihn von den `expect`-Zeilen. Eine Konstante für eine Funktion, die
  genau einmal läuft, trüge nichts bei. Erfüllt ist der Befund, wenn in der Datei keine `call`-Konstante
  mehr steht und jeder Wurf-Test die Form `const error = catchError(…)`, Leerzeile, `expect` hat.
- Zeile 273 des CHANGELOG wird mit dem `createSprite()`-Teil von Zeile 274 zusammengefasst, statt nur
  274 zu teilen: sonst stünden danach zwei benachbarte Bullets `fix TexturedSprites#createSprite()` für
  denselben Slot-Reset, und die Regel »ein Bullet je Änderung« wäre von der anderen Seite verletzt.
  Die Red-Flag-Regel von `updating-changelog` (fremde `[Unreleased]`-Bullets nicht ohne Rückfrage
  umschreiben) greift nicht: beide Bullets stammen aus diesem Lauf, und die Entscheidung vom
  2026-09-26 im Plan schickt genau diese Review-Befunde durch Paket 4.
- Commit-Typ `docs`: keine Zeile ändert Laufzeitverhalten; der Repo-Vorgänger `480b8fc3` fasst
  Doku und Spec-Form ebenso unter `docs(…)`.
- Modell mittlere Stufe, Effort `low`: jeder Schritt steht mit dem Soll-Text da, aber fünf Dateien und
  eine Mutationsprobe mit Rücksetzen sind mehr als eine Transkription an einer Stelle.

## Befunde im Volltext

**Paket 1a, Reviewer, klein** — `Map2DTileStreamer.spec.ts:102-109` ohne Leerzeile zwischen
Konstante und `expect` (plankonform). Im Plan: ohne die Leerzeile zwischen Konstante und `expect`,
die die übrigen Grenzfälle der Specs haben.

**Paket 1a, Reviewer, klein** — `TileSpritesFactory.spec.ts:49` ohne `create`-Konstante
(plankonform). Im Plan: prüft den Wurf ohne die `create`-Konstante, mit der die anderen Grenzfälle
desselben Pakets den Aufruf benennen.

**Paket 2, Reviewer, klein** — `packages/twopoint5d/CHANGELOG.md:16` — der Bullet zum Slot-Reset
bündelt `TexturedSprites#createSprite()` und `AnimatedSprite` in einem Eintrag; der Skill
`updating-changelog` will einen Bullet je Änderung. So vom Detailplan vorgegeben.

**Paket 2, Reviewer, klein** — `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.ts:62-63`
— TSDoc von `createSprite()`: »upright« meint `texFlipDiagonal` 0, nennt es aber nicht und liest sich
wie eine Wiederholung von `rotation`.

**Paket 3, Reviewer, klein** — `call` läuft im `test.each` zweimal (je `toThrow`), unter M3 zählt der
Pool deshalb 2 statt 1; Test beißt trotzdem, Form folgt dem Detailplan. Im Plan: ein Aufruf, dessen
Fehler einmal gefangen und dann auf Klasse und Meldung geprüft wird.

## Urteil des Reviewers (Zug 3)

| Befund | Urteil | Fundstelle |
| --- | --- | --- |
| Leerzeile `Map2DTileStreamer.spec.ts` (1a) | behoben | Test `a tile size that cannot be divided by is refused`, Leerzeile nach `create` und nach `write` |
| `create`-Konstante `TileSpritesFactory.spec.ts` (1a) | behoben | keine `call`-Konstante mehr; Wurf-Tests an `:69`, `:84`, `:110` in der Form `const error = catchError(…)`, Leerzeile, `expect` |
| CHANGELOG-Bullet bündelt zwei Slot-Resets (2) | behoben | `[Unreleased]` → `### Fixed`, je ein Bullet für `TexturedSprites#createSprite()` und `AnimatedSprite` |
| »upright« im TSDoc von `createSprite()` (2) | behoben | `TexturedSprites.ts`, TSDoc nennt `texFlipDiagonal` |
| `call` läuft im `test.each` zweimal (3) | behoben | `TileSpritesFactory.spec.ts:110`, ein Aufruf über `catchError` |
| Leerzeile `CameraBasedVisibility.spec.ts` (mitgenommen) | behoben | Leerzeile zwischen `};` der `write`-Konstante und `expect(write)` |

Kleine Befunde:

- Der Testname `createSprite() hands out a sprite that starts upright and untrimmed` (`TexturedSprites.spec.ts:137`, aus Paket 1) trägt dasselbe mehrdeutige »upright«, das der TSDoc jetzt ausschreibt. Nur Anregung; Domain sprites, also unter der Scope-Regel, aber kein Mangel.
