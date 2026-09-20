# Paket 12 — map2d: Die beiden Visibility-Helfer auf dasselbe Verhalten bringen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine aus dem Audit — 5 Einträge aus »Offene Befunde« (2 low, 3 info),
  im Volltext unten
- Ziel: `show = false` hält den rechteckigen Helfer wirklich an, statt pro Frame
  eine Geometrie zu allokieren, die laut eigenem Zustand gar nicht da ist.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts` (+ `.spec.ts`)
  - `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts`
  - `apps/lookbook/src/demos/map2d-rect-visi.ts`
  - `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`
  - `packages/twopoint5d/CHANGELOG.md`
  - zum Gegenlesen, unangetastet:
    `packages/twopoint5d/src/map2d/CameraBasedVisibilityHelpers.ts`,
    `packages/twopoint5d/src/map2d/HelpersManager.ts`,
    `packages/twopoint5d/src/map2d/types.ts`
- Verify: `pnpm run ci`
- Commit: `fix(map2d): let show decide whether the rectangular visibility helpers stand, and leave a scene they were never handed alone`
- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · alle fünf Queue-Einträge stehen an ihrer
    Fundstelle, eine Zeilennummer gewandert (`Map2DTileStreamer.spec.ts` 253 → 251)
    · Eintrag 1 wird anders behoben als die Queue-Zeile vorschlägt (Begründung
    unter »Entscheidungen dieses Zugs«) · Eintrag 5 ist mehr als eine Asymmetrie:
    `remove(fremdeSzene)` reißt heute den eigenen Knoten herunter, Beleg unten ·
    offene Folge aus Paket 11 (Node-Untergrenze in Doku und Toolchain) triagiert
    als Symptom eines committeten Pakets → neues Paket 14 im Plan · die beiden
    Lookbook-Einträge in »Offene Befunde« bleiben liegen, andere Ursache

  - 2026-09-20 Zug 1: Implementierer beauftragt, Modell opus, Effort medium,
    Report `paket-12.impl-1.json`, Session `f9dc9a5b-d516-4f75-87d0-2175eecc6af4`
  - 2026-09-20 Zug 2: Report `FERTIG` · 8 Dateien geändert, keine neue · roter
    Lauf vor dem Fix: `builds nothing while show is off`, `a scene this helper
    was never handed keeps its node where it is`, `a second update() writes into
    the node that stands` · Arbeitsbaum jetzt schmutzig · eigener Verify-Lauf
    `pnpm run ci` → `paket-12.verify.log`, exit=0

  - 2026-09-20 Zug 3: Reviewer (Modell opus, Effort medium) in
    `paket-12.review-1.json`, Diff `paket-12.diff`, Session
    `26204ead-84a5-4e6d-a02e-63a54d56dfae` · alle fünf Einträge behoben, alle
    zwölf Schritte umgesetzt, Lebenszyklus ohne Befund · zwei kleine Befunde,
    keine Runde der Fehlerkette
  - 2026-09-20 Zug 4: entfällt — kein nicht erfüllter Eintrag, kein kritischer
    oder wichtiger Befund
  - 2026-09-20 Zug 5: committet als `56212f45`, 8 Dateien, 232+/31- · Verify aus
    Zug 2 trägt den Commit (seither keine Codeänderung), `paket-12.verify.log`,
    exit=0 · drei Nebenbefunde in »Offene Befunde«, keine Folge

## Vorgehen

Die Vorlage für die Schritte 1 bis 6 ist durchgehend das Schwestermodul
`CameraBasedVisibilityHelpers` in derselben Dateinachbarschaft. Wo unten »wie im
Schwestermodul« steht, ist die dortige Stelle wörtlich gemeint, angepasst an den
einen Knoten, den der rechteckige Helfer hält.

1. **`RectangularVisibilityAreaHelpers.ts` — den Knoten festhalten.** Neben
   `#viewRect` ein zweites privates Feld:

   ```ts
   // The node this helper keeps alive across updates. It is built once and then follows
   // `#viewRect`, which `Box3Helper` holds by reference and reads on every frame;
   // `HelpersManager` disposes it when it takes it down, and only then.
   #viewRectHelper?: Box3Helper = undefined;
   ```

   Dazu eine private Methode in der Schreibweise des Schwestermoduls
   (`private`, kein `#`):

   ```ts
   /**
    * Forgets the node this helper holds. Whoever calls this has just handed it to the
    * manager to take down, and the manager disposes what it takes down — a helper that
    * kept the reference would write into a released geometry on the next update.
    */
   private releaseNode(): void {
     this.#viewRectHelper = undefined;
   }
   ```

2. **`update()` bekommt zwei Gates und baut nur noch einmal.** Zielgestalt:

   ```ts
   update() {
     if (this.#disposed) return;
     if (!this.#show) return;
     // the manager refuses a node it cannot place, so nothing is built until there is a scene
     if (this.#helpers.scene == null) return;

     const halfWidth = this.visibilityArea.width / 2;
     const halfHeight = this.visibilityArea.height / 2;
     const viewRectHelperHalfHeight = this.viewRectHelperHeight / 2;

     // written in place: the node built from this box reads it again on every frame
     const viewRect = (this.#viewRect ??= new Box3());
     viewRect.min.set(-halfWidth, -viewRectHelperHalfHeight, -halfHeight);
     viewRect.max.set(halfWidth, viewRectHelperHalfHeight, halfHeight);

     if (this.#viewRectHelper === undefined) {
       this.#viewRectHelper = new Box3Helper(viewRect, this.viewRectHelperColor);
       this.#helpers.add(this.#viewRectHelper);
     }

     // the color is a public field and may have been written after the node was built.
     // `Box3Helper` types its material as `Material | Material[]`; three builds it with a
     // single `LineBasicMaterial`, and the color of that one is what the caller picked
     (this.#viewRectHelper.material as LineBasicMaterial).color.copy(this.viewRectHelperColor);
   }
   ```

   Die Importe ziehen mit: `LineBasicMaterial` kommt in den `import type`-Block
   (`import type {LineBasicMaterial, Object3D} from 'three/webgpu';`, wie im
   Schwestermodul), und `Vector3` fällt aus dem Value-Import — die beiden Zeilen
   in `update()` sind seine letzten Vorkommen in der Datei. `Box3Helper#dispose()`
   gibt Geometrie und Material frei, das reicht dem `HelpersManager`.

3. **`set show` schreibt `#show` zuerst**, wie im Schwestermodul:

   ```ts
   set show(show: boolean) {
     if (this.#disposed) return;
     if (this.#show === show) return;
     this.#show = show;
     if (show) {
       this.update();
     } else {
       this.#helpers.remove();
       this.releaseNode();
     }
   }
   ```

4. **`add()` und `remove()` prüfen die Szene**, wie im Schwestermodul:

   ```ts
   add(scene: Object3D): void {
     if (this.#disposed) return;
     if (this.#helpers.scene === scene) return;
     this.#helpers.scene = scene;
     this.releaseNode();
   }

   remove(scene: Object3D): void {
     if (this.#disposed) return;
     if (this.#helpers.scene !== scene) return;
     this.#helpers.remove();
     this.releaseNode();
   }
   ```

   Beide `releaseNode()`-Aufrufe sind Pflicht: der Setter `HelpersManager#scene`
   ruft bei einem Szenenwechsel selbst `remove()` und disposed den Knoten dabei.

5. **`dispose()`** ruft nach `this.#helpers.scene = undefined` zusätzlich
   `this.releaseNode()`; `this.#viewRect = undefined` bleibt stehen.

6. **TSDoc nachziehen**, an `show`, `add`, `remove` und `update`. Was jetzt gilt:
   `update()` baut nur, solange `show` `true` ist und eine Szene dasteht; der
   Knoten bleibt über Updates hinweg derselbe und folgt der Fläche; `remove()`
   weist eine Szene ab, die der Helfer nie bekommen hat. Kein Rückblick auf den
   Vorzustand (siehe »Konventionen« im Plan-Kopf). `types.ts` bleibt
   unangetastet: das Interface stellt die fremde Szene der Implementierung
   ausdrücklich frei, und beide Implementierungen dürfen sie strenger
   beantworten, ohne dass der Interface-Vertrag sich bewegt.

7. **`RectangularVisibilityAreaHelpers.spec.ts` — vier Fälle, drei davon zuerst
   rot.** Der rote Lauf gehört in den Report.

   - `builds nothing while show is off` — `add(scene)`, dann `update()` ohne
     `show`: `scene.children` bleibt leer. **Vor dem Fix rot** (ein Knoten steht
     darin).
   - `a scene this helper was never handed keeps its node where it is` —
     `add(sceneA)`, `show = true`, dann `remove(new Object3D())`: der Knoten in
     `sceneA` ist derselbe wie vorher, und weder seine Geometrie noch sein
     Material wurde freigegeben (`spyOnReleases` steht schon in der Datei).
     **Vor dem Fix rot**; das Gegenstück im Schwestermodul heißt
     `a scene this set was never handed keeps its nodes where they are`.
   - `a second update() writes into the node that stands` — `add(scene)`,
     `show = true`, Knoten und Geometrie merken, `visibilityArea.width` auf einen
     anderen Wert, `update()`: Knoten und Geometrie sind dieselben Instanzen, und
     `helper.box.max.x` trägt die neue halbe Breite. **Vor dem Fix rot** (jeder
     Aufruf baute einen neuen Knoten).
   - `switching show back on builds the helper again` — `add(scene)`,
     `show = true`, `show = false` (Szene leer), `show = true`: ein Knoten steht
     wieder. Dieser Fall ist vorher wie nachher grün; er hält die Reihenfolge im
     Setter fest, ohne die das Gate aus Schritt 2 ein `show = true` verschluckt.
     Im Report als solcher ausweisen.

8. **Browser-Testfläche** — ein Fall in
   `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`, im
   bestehenden `describe`. Dafür eine zweite Fabrik neben `makeMap()` (etwa
   `makeRectMap()`), die dasselbe aufbaut, aber
   `new RectangularVisibilityArea(640, 480)` als Visibilitor setzt; `makeMap()`
   selbst bleibt unangetastet, die drei Fälle darüber hängen daran. Dann
   `helpers.add(map2d)`, `helpers.show = true`, zwei Aufwärmframes über das
   vorhandene `frame()`, Knoten über das vorhandene `helperNodes()` gesucht. In
   einem Fall
   (`the rectangular helper keeps its node across frames and takes it down with show`):
   nach einem weiteren Frame ist der Helferknoten dieselbe Instanz mit derselben
   Geometrie; danach `helpers.show = false`, und der Knoten ist aus dem Szenengraph
   raus und seine Geometrie freigegeben — belauscht über das `dispose`-Event der
   Geometrie, wie im Fall `dispose() takes the whole set down and releases what it built`.

9. **`RepeatingTilesProvider.ts` — jeder Pfad des Konstruktors schreibt.** Die
   Kette wird zur `else`-Kette, der tote Test `if (!this.tileIds)` fällt weg:

   ```ts
   constructor(tileIds?: RepeatingTilesPatternType, limitToAxis: LimitToAxisType = 'none') {
     if (typeof tileIds === 'number') {
       this.tileIds = [[tileIds]];
     } else if (Array.isArray(tileIds) && typeof tileIds[0] === 'number') {
       this.tileIds = [tileIds as number[]];
     } else if (Array.isArray(tileIds) && Array.isArray(tileIds[0]) && typeof tileIds[0][0] === 'number') {
       this.tileIds = tileIds as number[][];
     } else {
       // anything else — no argument, an empty array, a shape of another kind — is a pattern
       // without cells, which every lookup answers with 0
       this.tileIds = [[]];
     }
     this.limitToAxis = limitToAxis;
   }
   ```

   Der Kommentar an `#tileIds!` sagt danach, dass der Konstruktor auf jedem Pfad
   durch den Setter schreibt; das `!` bleibt, weil TypeScript eine Zuweisung über
   einen Setter nicht als definite assignment zählt. Verhalten bleibt Zeile für
   Zeile dasselbe — in `RepeatingTilesProvider.spec.ts` kommt unter
   `describe('new')` ein Fall
   `a shape it does not recognize gets a pattern without cells` dazu
   (z. B. `new RepeatingTilesProvider([] as number[])` und
   `new RepeatingTilesProvider(['a'] as unknown as number[])` → `tileIds` ist
   `[[]]`). Der Fall ist vorher wie nachher grün und hält den Zweig fest.

10. **`Map2DTileStreamer.spec.ts:246-253` — der Wert bleibt, sein Zweck kommt
    dazu.** Über den Fake-Visibilitor ein Kommentar, sinngemäß:

    ```ts
    // the `translate` is not zero on purpose: the streamer places the renderer at `offset`
    // alone, and the expectation below is what says so — a translate that found its way into
    // the position would show up in it
    ```

    Nichts weiter an diesem Test. Warum nicht gelöscht: siehe
    »Entscheidungen dieses Zugs«.

11. **CHANGELOG.** Zwei Zeilen ans Ende von `### Fixed` im `## [Unreleased]`,
    eine Migrationsüberschrift direkt unter `### Migration Guide` (die neueste
    steht dort oben):

    - `Fixed`: `RectangularVisibilityAreaHelpers#update()` baut den Knoten nur,
      solange `show` `true` ist, und behält den gebauten Knoten — ein Aufrufer,
      der jeden Frame `update()` ruft, allokiert keine Liniengeometrie pro Frame
      mehr, und ein ausgeschalteter Helfer bleibt unten.
    - `Fixed`: `RectangularVisibilityAreaHelpers#remove(scene)` mit einer Szene,
      die der Helfer nie bekommen hat, lässt seinen Knoten stehen.
    - `Migration Guide`, Überschrift
      `#### The rectangular visibility helpers follow their own show`: ein
      **Before**-Block, der `add(map2d)` und ein `update()` pro Frame zeigt, und
      ein **After**-Block, der einmal `show = true` dazwischensetzt. Ton und
      Aufbau wie die Abschnitte darunter.

12. **Der Aufrufer im Lookbook zieht mit.** In
    `apps/lookbook/src/demos/map2d-rect-visi.ts` hinter
    `rectVisiAreaHelpers.add(map2d);` (Zeile 67) ein
    `rectVisiAreaHelpers.show = true;`. Ohne diese Zeile zeigt die Demo nach
    Schritt 2 nichts mehr — sie ist der einzige Aufrufer im Repository, der
    `update()` ohne `show` fährt. Die `.astro`-Seite gleichen Namens unter
    `apps/lookbook/src/pages/demos/` wird **nicht** angefasst.

## Abgleich

| Eintrag | Stand heute |
| --- | --- |
| `Map2DTileStreamer.spec.ts:253` — `translate` im Fake | unverändert, auf `:251` gewandert. `Map2DTileStreamer.ts:148-152` baut die Position aus `offset` allein, `translate` liest niemand |
| `RepeatingTilesProvider.ts:65` — `if (!this.tileIds)` | unverändert auf `:65`, Feld weiter `#tileIds!: number[][]` |
| `RectangularVisibilityAreaHelpers.ts:44-60` — `update()` ohne `show`-Gate | unverändert, auf `:74-93` gewandert (Paket 4 hat `dispose()` und TSDoc davorgesetzt). `apps/lookbook/src/demos/map2d-rect-visi.ts:111` ruft weiter jeden Frame `update()`, ohne `show` je zu setzen |
| `RectangularVisibilityAreaHelpers.ts:52-60` — `set show` schreibt `#show` zuletzt | unverändert, auf `:38-46` gewandert |
| `RectangularVisibilityAreaHelpers.ts:75` — `remove()` nimmt jede Szene | unverändert, auf `:63-66` gewandert |

## Entscheidungen dieses Zugs

**Eintrag 5 ist kein Schönheitsfehler.** Die Queue-Zeile nennt die Asymmetrie
zum Schwestermodul. Nachgesehen im `HelpersManager`: `removeFromScene(fremde)`
findet in der fremden Szene nichts, läuft danach aber in
`if (this.root && scene !== this.root) this.removeFromScene(this.root)` — und
`root` ist die Wurzel über der *eigenen* Szene. Ein `remove(fremdeSzene)` reißt
also den eigenen Knoten heraus und disposed ihn. Deshalb bekommt der Eintrag
einen roten Regressionstest und eine `Fixed`-Zeile, keine reine TSDoc-Angleichung.

**Eintrag 1 wird nicht gelöscht, sondern erklärt.** Die Queue-Zeile schlägt vor,
das `translate` aus dem Fake zu nehmen, weil es eine Wirkung suggeriert, die es
nicht gibt. Genau darin liegt sein Zweck: die einzige Assertion des Tests
(`positions[0]` ist `[-60, 0, -45]`, also der reine `offset`) wird erst dadurch
scharf, dass der Fake ein von null verschiedenes `translate` danebenlegt. Der
CHANGELOG-Eintrag zum Kartenversatz (»a map at `(t, 0, 0)` drew its tiles at
`2t`«) beschreibt genau den Fehler, gegen den dieser Wert absichert; es ist die
einzige Stelle im Spec, die ihn hält. Gelöscht wäre ein Regressionsschutz weg
und der Befund formal erledigt — die teuerste Art, eine Zeile loszuwerden.
Stattdessen bekommt der Wert den Satz, der ihn lesbar macht.

**Der Knoten wird wiederverwendet, nicht nur gegated.** Das Gate allein
verschiebt das Problem: die Demo braucht ihre Helfer, bekommt in Schritt 12 ihr
`show = true` — und allokiert danach wieder eine Geometrie pro Frame, also genau
das, was der Eintrag benennt. Der Helfer hält deshalb seinen Knoten, wie das
Schwestermodul seine Pools hält. `Box3Helper` liest seine `Box3` in jedem
`updateMatrixWorld()` neu (geprüft an three 0.185.1), ein in place geschriebener
`#viewRect` reicht dafür aus.

**Browser-Testfläche: ja, ein Fall.** Die Konvention verlangt beide Flächen für
Rendering-Code, und dieses Paket ändert, wann eine Liniengeometrie entsteht und
wann sie fällt. Ein einzelner Fall an echter GPU hält fest, dass der Knoten über
Frames hinweg derselbe bleibt und mit `show = false` wirklich freigegeben wird;
mehr braucht es nicht, die Feinheiten stehen im Vitest-Spec.

**`types.ts` bleibt, wie es ist.** Der Interface-TSDoc stellt es der
Implementierung frei, wie sie eine fremde Szene beantwortet. Diese Freiheit
enger zu ziehen, würde jede fremde Implementierung binden — eine Semver-Frage,
die weit über den Befund hinausgeht. Beide mitgelieferten Klassen antworten ab
hier gleich; das gehört in ihre eigene TSDoc.

**Kein weiterer Eintrag aus »Offene Befunde« kommt herein.** Die beiden offenen
Lookbook-Einträge (`display-multi.astro:184`, `textured-sprites.astro:26`) sind
CSS ohne Wirkung und teilen die Ursache dieses Pakets nicht.

## Die Einträge im Volltext

**`packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:44-60` · low ·
aus Paket 4, Zug 0** — `update()` prüft `show` nicht und baut bei jedem Aufruf
einen neuen `Box3Helper` samt Geometrie, während der vorige über
`#helpers.remove()` fällt. `apps/lookbook/src/demos/map2d-rect-visi.ts:111` geht
diesen Pfad in jedem Frame, ohne `show` je auf `true` zu setzen: die Demo zeigt
Knoten, die laut `show` nicht da sind, und allokiert eine Geometrie pro Frame.
Das Schwestermodul `CameraBasedVisibilityHelpers` gated seinen `update()` mit
`if (!this.#show) return;`.

**`packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:52-60` · low ·
aus Paket 4, Zug 2** — `set show` ruft `update()`, **bevor** es `#show` schreibt.
Heute harmlos, weil `update()` `#show` nicht liest. Sobald der Eintrag darüber
behoben wird und `update()` sein `show`-Gate bekommt, baut ein `show = true`
nichts mehr: die beiden hängen zusammen und müssen zusammen gefixt werden. Das
Schwestermodul schreibt `#show` zuerst.

**`packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:75` · info ·
aus Paket 4, Zug 2** — `remove(scene)` nimmt jede Szene an und ruft
`#helpers.removeFromScene(scene)` darauf, ohne gegen die gehandelte zu prüfen;
das Schwestermodul `CameraBasedVisibilityHelpers` weist eine fremde Szene ab. Vom
Interface-TSDoc in `types.ts` formal gedeckt, das eine fremde Szene der
Implementierung freistellt — aber eine Asymmetrie zwischen zwei Klassen desselben
Interfaces, mit der ein Aufrufer nicht rechnet.

**`packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:65` · info · aus
Paket 3, Zug 2** — `if (!this.tileIds)` liest einen Getter vom Typ `number[][]`;
zur Laufzeit ist das Feld dort noch `undefined`, der Typ sagt also das Gegenteil
dessen, was der Ausdruck prüft. Funktioniert, ist laut Typsystem aber tot und
fällt beim nächsten Umbau still weg.

**`packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts:253` · info · aus
Paket 3, Zug 2** — der Fake-Visibilitor im Test »places the renderers at the
offset of the visibilitor…« liefert neben `offset` auch
`translate: new Vector3(7, 3, 11)`. `Map2DTileStreamer#update()` liest `translate`
nirgends; der Wert suggeriert eine Wirkung, die es nicht gibt.

## Urteil des Reviewers

Je Eintrag aus »Die Einträge im Volltext«, mit Fundstelle im Code nach dem Fix:

1. `update()` ohne `show`-Gate und Geometrie pro Frame — **behoben**.
   `RectangularVisibilityAreaHelpers.ts:105` (`if (!this.#show) return;`), `:107`
   (Szene-Gate), Knotenfeld `:18`, Bau nur einmal `:118-121`, `Box3` in place
   `:113-116`; Aufrufer nachgezogen in
   `apps/lookbook/src/demos/map2d-rect-visi.ts:68`.
2. `set show` schrieb `#show` zuletzt — **behoben**.
   `RectangularVisibilityAreaHelpers.ts:43-53`, `#show` in `:46` vor dem
   `update()` in `:48`, gleiche Reihenfolge wie
   `CameraBasedVisibilityHelpers.ts:109-119`.
3. `remove()` nahm jede Szene — **behoben**.
   `RectangularVisibilityAreaHelpers.ts:90-92`; der `root`-Pfad in
   `HelpersManager.ts:79-81` greift damit nicht mehr auf den eigenen Knoten durch.
4. `if (!this.tileIds)` laut Typsystem tot — **behoben**.
   `RepeatingTilesProvider.ts:56-69` als geschlossene `else`-Kette, Feldkommentar
   `:19-20` begründet das bleibende `!`.
5. `translate` im Fake-Visibilitor — **behoben** im Sinne von Zug 0 (erklärt
   statt gelöscht). `Map2DTileStreamer.spec.ts:246-248`, Wert unverändert `:254`,
   tragende Assertion `:260`.

Lebenszyklus gegen `docs/resource-lifecycle.md` und das Schwestermodul geprüft:
kein Weiterschreiben in eine freigegebene Geometrie (jeder Pfad, der den Knoten
abgibt, vergisst ihn in derselben Anweisung), keine doppelte Freigabe, kein
verwaister Knoten, kein verschlucktes Einschalten.

### Kleine Befunde, nicht behoben

- `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:35` — der
  TSDoc-Satz an `show` (»switching it on builds it again, as soon as a scene is
  there to hold it«) klingt, als käme der Knoten von allein hoch, sobald `add()`
  eine Szene nachreicht; gebaut wird er erst im nächsten `update()`. So
  formuliert wie in `add()` (`:64-66`) wäre es genau.
- `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.spec.ts:79` —
  der Knoten wird über `as unknown as {box: {max: {x: number}}; geometry: unknown}`
  aufgemacht, obwohl die Datei Typen aus `three/webgpu` importiert; ein
  `as Box3Helper` trüge dieselbe Aussage und ließe einen Knoten anderer Bauart
  überhaupt erst auffallen.
