# Paket 18 — stage: Nachtrag — eine Stage2D ohne View trägt keine Maße einer vorigen Projektion, und die TSDoc von buildOutputNode nennt jeden Fall ohne Zeichnung

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 12
- Findings: — (zwei Folgen aus Paket 12 und ein mitgenommener vorbestehender Nebenbefund gleicher Ursache, kein Audit-Finding)
- Ziel: Eine `Stage2D`, deren Projektion keine View ergibt oder die keine Projektion hat, meldet über `width`/`height` keine Maße einer vorigen Projektion, und die TSDoc von `StageRenderer#buildOutputNode` nennt jeden Fall, in dem der Composed-Modus nichts zeichnet.
- Modell: mittlere Stufe (`sonnet`)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/Stage2D.ts` (Setter `projection`, TSDoc der Getter `width`/`height`)
  - `packages/twopoint5d/src/stage/Stage2D.spec.ts` (neuer `describe`-Block)
  - `packages/twopoint5d/src/stage/StageRenderer.ts` (nur TSDoc von `buildOutputNode`)
  - `packages/twopoint5d/src/stage/README.md` (ein Satz im Pitfall »Stage with no camera yet«)
  - `packages/twopoint5d/CHANGELOG.md` (ein Eintrag unter `## [Unreleased]` → `### Fixed`)
- Verify: `pnpm run ci` (aus dem Repo-Root). Für den roten Lauf vorab: `pnpm nx test twopoint5d -- src/stage/Stage2D.spec.ts`
- Commit: `fix(stage): let a Stage2D give up the size of a projection together with its camera and let the buildOutputNode docs name a Stage2D without a camera`

## Sachverhalt am Stand `fdba2c34`

`Stage2D` hält `#width`/`#height` (`Stage2D.ts:65-74`) als die View, die die
Projektion für den Container ergibt. Geschrieben werden sie nur in
`#updateProjection` (`:172-176`), und nur, wenn die Projektion eine View mit
Fläche liefert (`:168-170` kehrt sonst vorher zurück). Der Setter `projection`
(`:82-92`) nimmt die Kamera der vorigen Projektion weg
(`#cameraFromProjection = undefined`), die Maße aber nicht. Daraus:

1. **Projektion ohne View** — wird `projection` bei einem Container mit Fläche
   auf eine Projektion gesetzt, deren Specs keine View ergeben (etwa
   `new OrthographicProjection('xy|bottom-left', {fit: 'contain'})`), ist die
   Kamera weg, `stage.width`/`height` melden weiter die View der vorigen
   Projektion. Folge aus Paket 12 (bis dahin schrieb `#updateProjection` die
   Werte der neuen Projektion immer).
2. **Keine Projektion** (mitgenommen, vorbestehend seit `e352b56`) —
   `projection = undefined` nimmt die Kamera weg, `updateProjection()` läuft
   ohne Projektion nicht (`:152-156`), `width`/`height` bleiben stehen.
3. **Container ohne Fläche** — wird `projection` gesetzt, während der Container
   0×n ist, kehrt `#updateProjection` bei `:161` zurück; auch hier bleiben die
   Maße der vorigen Projektion auf einer Stage ohne deren Kamera stehen.
   Dieselbe Ursache, derselbe Fix.
4. **TSDoc** — `StageRenderer.ts:362-364`: »While this renderer's `width` or
   `height` is 0, the composed mode draws nothing.« Seit Paket 12 zeichnet der
   Composed-Modus auch nichts, solange eine `Stage2D` der Komposition keine
   Kamera hat (`StageRenderer.ts:517`, `isStage2DWithoutCamera`). README
   (`stage/README.md:287-292`, `:465-470`) und CHANGELOG (`CHANGELOG.md:127`)
   sagen es, die TSDoc nicht — und nur die landet in der `d.ts`.

## Entscheidungen dieses Pakets (Zug 0)

- **Die Maße gehen mit der Kamera der Projektion, im Setter, vor dem
  Kamera-Event.** Der Setter setzt `#width`/`#height` auf 0, bevor er die
  Kamera wegnimmt, und ruft danach wie bisher `updateProjection(true)`. Gründe:
  Der Setter ist die einzige Stelle, an der eine Projektion wechselt; eine
  Stage nach dem Wechsel steht damit genau dort, wo eine neu gebaute
  `new Stage2D(projection)` stünde (0×0, keine Kamera, bis die Projektion eine
  View ergibt). Vor dem Kamera-Event, damit ein Listener auf
  `OnStageAfterCameraChanged` (alt → `undefined`) keine Maße liest, zu denen
  die Stage keine View mehr hat.
- **Die erste View der neuen Projektion geht über `OnStageResize` hinaus, auch
  bei gleicher Größe wie die vorige.** Folgt aus dem Zurücksetzen (Vergleich
  gegen 0 in `:186`). Verworfen: das Zurücksetzen nur dann, wenn die neue
  Projektion keine View ergibt — das bräuchte eine eigene Erkennung, ob
  `#updateProjection` Maße geschrieben hat (`#cameraFromProjection` taugt
  nicht: mit einer vom Nutzer gesetzten Kamera bleibt es `undefined`, obwohl
  die Projektion eine View hat). Ein Projektionswechsel meldet ohnehin eine neue
  Kamera; dass er auch die View der neuen Projektion meldet, ist konsistent.
  Kein Konsument im Repo hört auf `OnStageResize` (Bibliothek, Lookbook,
  Browsertests durchsucht).
- **Kein `OnStageResize` für den Sturz auf 0.** `OnStageResize` meldet Views
  mit Fläche — so halten es die Pakete 1 und 12 (`resize()` auf 0 behält die
  Maße und sendet nichts; Test `never emits OnStageResize with NaN`). Ein
  Listener, der durch die Größe teilt, bekommt nie eine 0.
- **Eine vom Nutzer gesetzte Kamera bleibt**, die Maße gehen trotzdem auf 0 —
  sie sind die View der Projektion, nicht die der Kamera (Klassen-TSDoc
  `Stage2D.ts:26-27`: »calculated based on the properties of the projection and
  the container dimension«).
- **Nicht anfassen:** `projection.updateCamera(this.camera)` für eine vom
  Nutzer gesetzte Kamera (`Stage2D.ts:178-179`) — dazu steht eine offene
  `→ Rückfrage` in der Queue des Plans. Ebenso den Kommentar und das
  frühe `return` in `#updateProjection` (`:159-161`, `:168-170`): beide bleiben
  wahr.
- **Kein Browsertest.** Die Änderung berührt keinen Draw-Call, keinen
  Pass-Node, keinen GPU-Buffer; `StageRenderer` liest `width`/`height` einer
  Stage nicht. Der einzige Browsertest, der `stage.width` liest
  (`packages/twopoint5d-testing/test/stage-renderer.test.js:79-80`), wechselt
  keine Projektion und bleibt, wie er ist.
- **Kein Migration Guide.** Keine Signatur ändert sich; kein Konsument muss
  Code ändern: ein Listener auf `OnStageResize` bekommt die neue View wie bisher
  (bei gleicher Größe ein Event mehr), und Code, der `width`/`height` einer
  Stage ohne View liest, bekam dort eine Größe, mit der keine Kamera zeichnet.
- **CHANGELOG unter `### Fixed`**, nicht `### Changed`: der Fall
  `projection = undefined` war schon in 0.21.2 falsch.

## Vorgehen

1. **Regressionstests zuerst, rot sehen.** In
   `packages/twopoint5d/src/stage/Stage2D.spec.ts` einen neuen Block
   `describe('size after a change of projection', …)` innerhalb von
   `describe('Stage2D', …)`, direkt hinter dem Test
   `hands back to the projection camera when the assigned one is cleared`
   (endet bei Zeile 149). Alle Imports sind schon da (`on`, `PerspectiveCamera`,
   `vi`, `OnStageAfterCameraChanged`, `OnStageResize`, `StageResizeProps`,
   beide Projektionen). Gemeinsamer Aufbau, wo nicht anders gesagt:
   `const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));`
   `stage.resize(800, 600);` und als Vorbedingung
   `expect([stage.width, stage.height]).toEqual([640, 480]);`

   | Testname | Schritte | Erwartung | vor dem Fix |
   | --- | --- | --- | --- |
   | `drops the size of the previous projection for one whose specs give no view` | `stage.projection = new OrthographicProjection('xy|bottom-left', {fit: 'contain'})` | `stage.camera` `undefined`, `[stage.width, stage.height]` `[0, 0]` | rot (`[640, 480]`) |
   | `drops the size together with the projection` | `stage.projection = undefined` | `stage.camera` `undefined`, Maße `[0, 0]` | rot |
   | `drops the size of the projection while it keeps an assigned camera` | Aufbau abweichend: `const custom = new PerspectiveCamera(); stage.camera = custom;` **vor** `stage.resize(800, 600)`; Vorbedingung Maße `[640, 480]`, dann `stage.projection = undefined` | `stage.camera` ist `custom`, Maße `[0, 0]` | rot |
   | `a listener to the camera change reads no size of the projection that went` | Listener `on(stage, OnStageAfterCameraChanged, () => sizes.push([stage.width, stage.height]))` mit `const sizes: [number, number][] = []`, dann `stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320})` | `sizes` ist `[[0, 0], [320, 240]]` (erst die Kamera, die geht, dann die neue) | rot (erster Eintrag `[640, 480]`) |
   | `announces the first view of a new projection, also at the size of the previous one` | `const onResize = vi.fn(); on(stage, OnStageResize, onResize);` erst **nach** `resize(800, 600)`, dann `stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640})` | `onResize` genau einmal, mit `{stage, width: 640, height: 480}` | rot (nicht aufgerufen) |
   | `takes the view of a projection assigned while the container has no area on the next resize() with one` | `stage.resize(0, 600)` (Maße bleiben `[640, 480]`, bestehendes Verhalten), dann `stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320})`; Zwischenstand prüfen; `onResize` abonnieren; `stage.resize(800, 600)` | nach der Zuweisung Kamera `undefined`, Maße `[0, 0]`; nach dem Resize Kamera definiert, Maße `[320, 240]`, `onResize` genau einmal mit `{stage, width: 320, height: 240}` | rot (Maße nach der Zuweisung `[640, 480]`) |
   | `sends no OnStageResize for the drop to no size` | `onResize` abonnieren, dann `stage.projection = new OrthographicProjection('xy|bottom-left', {fit: 'contain'})` und `stage.projection = undefined` | `onResize` nicht aufgerufen | Wächter, grün vor und nach dem Fix |

   Roter Lauf: `pnpm nx test twopoint5d -- src/stage/Stage2D.spec.ts` — sechs
   rot, der Wächter grün. Die Ausgabe gehört in den Report.

2. **Fix in `packages/twopoint5d/src/stage/Stage2D.ts`, Setter `projection`
   (`:82-92`).** Neuer Körper im `if`:

   ```ts
   this.#projection = projection;
   // the size and the camera of the previous projection go first, the camera announced as the
   // camera it was: a listener to that change reads no size the stage has no view for.
   // updateProjection() then gives the view and the camera of the new one, if the container has
   // an area for it and its specs give a view
   this.#width = 0;
   this.#height = 0;
   this.#updateCamera(() => {
     this.#cameraFromProjection = undefined;
   });
   this.updateProjection(true);
   ```

   Der bisherige Kommentar (`:85-86`) geht in diesem auf. Sonst nichts an der
   Logik ändern: `#updateProjection` vergleicht danach gegen 0 und sendet
   `OnStageResize` für die erste View der neuen Projektion von selbst.

3. **TSDoc der Getter `width` und `height`** (`Stage2D.ts:68-74`, bisher
   ohne), Wortlaut:

   ```ts
   /**
    * The width of the view the projection gives for the container. `0` while the stage has no
    * projection, or while its projection has given no view with an area: before the first
    * `resize()` with an area, for specs that give no view, and after an assignment to
    * `projection` until the new projection gives one. A `resize()` to a width or a height of 0
    * keeps the size, as it keeps the camera. `OnStageResize` announces every new view, and none
    * of the drops to 0.
    */
   get width(): number {
   ```

   ```ts
   /** The height of the view the projection gives for the container; `0` whenever {@link width} is. */
   get height(): number {
   ```

4. **TSDoc von `StageRenderer#buildOutputNode`**
   (`packages/twopoint5d/src/stage/StageRenderer.ts:362-364`). Den Satz
   »While this renderer's `width` or `height` is 0, the composed mode draws
   nothing.« ersetzen durch:
   »While this renderer's `width` or `height` is 0, or while a `Stage2D` it
   composes has no camera, the composed mode draws nothing.«
   Zeilenumbruch nach Prettier. Sonst nichts in `StageRenderer.ts`.

5. **README** `packages/twopoint5d/src/stage/README.md`, Pitfall
   »**Stage with no camera yet**« (`:465-470`): an den Bullet anhängen:
   »Until then its `width` and `height` are 0, and assigning another
   `projection` — or `undefined` — puts them back to 0 with the camera until
   the new projection gives a view.«
   Den Absatz zu `buildOutputNode` (`:287-292`) nicht ändern, er stimmt.

6. **CHANGELOG** `packages/twopoint5d/CHANGELOG.md`: Skill `updating-changelog`
   laden. Unter `## [Unreleased]` → `### Fixed` direkt hinter dem Eintrag
   »- fix `Stage2D`: `OnStageAfterCameraChanged` goes out on every change of
   the camera …« (`:211`) einfügen:
   »- fix `Stage2D#width` and `#height` on a change of `projection`: the size
   goes to 0 together with the camera of the previous projection,
   `projection = undefined` included, and stays 0 until the projection in place
   gives a view with an area. `OnStageResize` announces the first view of the
   new projection, also when it has the size of the previous one, and sends
   nothing for the drop to 0«
   Keine TSDoc-Änderung von `buildOutputNode` im CHANGELOG — das Verhalten steht
   schon in `:127`. Kein `### Migration Guide` (Begründung oben).

7. **Verify:** `pnpm run ci` aus dem Repo-Root, Exit 0.

## Abgleich (Zug 0, HEAD `fdba2c34`)

- Folge 1 (Projektion ohne View behält Maße): unverändert —
  `Stage2D.ts:82-92` (Setter) und `:168-170` (frühes `return` vor `:172-176`)
  stehen wie im Plan beschrieben.
- Folge 2 (TSDoc `buildOutputNode`): unverändert — `StageRenderer.ts:362-364`;
  der Guard steht bei `:517`, README `:287-292` und `:465-470`, CHANGELOG `:127`.
- Mitgenommen (`projection = undefined`): unverändert, vorbestehend —
  `git show e352b56:packages/twopoint5d/src/stage/Stage2D.ts` Setter `:79-84`
  nimmt nur `#cameraFromProjection`, `updateProjection()` `:142-146` läuft ohne
  Projektion nicht.
- Dazu Fall 3 (Zuweisung bei Container ohne Fläche): dieselbe Ursache, derselbe
  Fix, im Paket.
- Geschwister geprüft: `Canvas2DStage` (`Canvas2DStage.ts:112-115`) setzt die
  Projektion seiner `Stage2D` nur im Konstruktor; `width`/`height` dort sind die
  Canvas-Maße — nicht betroffen. Kein Audit-Finding deckt die Maße ab (JSON-Insel
  der `audit.html` nach `Stage2D`/`buildOutputNode` durchsucht).

## Findings im Volltext

Keine Audit-Findings. Die Einträge stammen aus Paket 12:

**Folge · klein · `packages/twopoint5d/src/stage/Stage2D.ts:82-90`, `:163-171` (Stand `69e27081`)** —
wechselt die Projektion auf eine, deren Specs keine View ergeben, während der
Container eine Fläche hat, geht die Projektionskamera, `stage.width`/`height`
behalten aber die Werte der vorigen Projektion (für `projection = undefined`
vorbestehend).

**Folge · klein · `packages/twopoint5d/src/stage/StageRenderer.ts:363-364` (Stand `69e27081`)** —
TSDoc von `buildOutputNode` (öffentlich, landet in der `d.ts`) nennt als
einzigen Fall, in dem der Composed-Modus nichts zeichnet, einen Renderer ohne
Breite oder Höhe; README und CHANGELOG nennen jetzt auch »eine `Stage2D` der
Komposition hat keine Kamera«.

## Verlauf

- 2026-09-19 Zug 0: Detailplan steht · Folge 1 unverändert (`Stage2D.ts:82-92`, `:168-170`) · Folge 2 unverändert (`StageRenderer.ts:362-364`) · Mitgenommenes unverändert (vorbestehend `e352b56`) · Fall 3 (Zuweisung bei Container 0×n) als dieselbe Ursache ins Paket · offene Folgen: keine neuen (Paket 13: —) · Queue: kein Eintrag gleicher Ursache; `ParallaxProjection.ts:72/76` (`→ Scope`, andere Ursache) bleibt für die Drain-Runde · Restplan unverändert (14–17 fassen `stage/` nicht an)
- 2026-09-19 Zug 1: Implementierer beauftragt (`sonnet`, effort medium), Brief `paket-18.impl-1.brief.txt`, Report nach `paket-18.impl-1.json`
- 2026-09-19 Zug 2: Report FERTIG · geändert `Stage2D.ts`, `Stage2D.spec.ts`, `StageRenderer.ts`, `stage/README.md`, `CHANGELOG.md` · roter Lauf 6 rot / 14 grün (Wächter grün), danach 20 grün · `pnpm run ci` Exit 0 laut Report · Arbeitsbaum schmutzig
- 2026-09-19 Zug 3: Reviewer (`sonnet`, medium) — alle vier Einträge erfüllt, 0 kritisch, 0 wichtig, 2 klein · Diff `paket-18.diff`, Report `paket-18.review-1.json`
- 2026-09-19 Zug 4: keine Runde (nur kleine Befunde)
- 2026-09-19 Zug 5: `pnpm run ci` Exit 0 (`paket-18.verify.log`) · Commit `121a8fa9` · Plan auf `[x]`, ein Nebenbefund (→ Audit) in die Queue

## Urteil des Reviewers (Runde 1)

- Folge 1 (Projektion ohne View): behoben — `Stage2D.ts:98-99` (Setter setzt die Maße vor dem Kamera-Event auf 0), Test `Stage2D.spec.ts` `drops the size of the previous projection for one whose specs give no view`
- Mitgenommen (`projection = undefined`): behoben — derselbe Setter-Pfad; Tests `drops the size together with the projection`, `drops the size of the projection while it keeps an assigned camera`
- Fall 3 (Container ohne Fläche): behoben — `#updateProjection` kehrt bei `Stage2D.ts:174` zurück, die Maße sind schon 0; Test `takes the view of a projection assigned while the container has no area on the next resize() with one`
- Folge 2 (TSDoc `buildOutputNode`): behoben — `StageRenderer.ts:363-365`, deckt sich mit dem Guard `isStage2DWithoutCamera`

## Kleine Befunde

- `packages/twopoint5d/src/stage/README.md:471-472` — »puts them back to 0 with the camera«: bei einer vom Nutzer gesetzten Kamera bleibt die Kamera, nur die Maße gehen auf 0; die TSDoc von `width` ist genau, das README ungenauer (Vorschlag: »with the camera« streichen)
- `Stage2D.ts` — ein Projektionswechsel sendet auch bei gleicher Größe ein `OnStageResize`; gewollt (Entscheidung Zug 0), in TSDoc, CHANGELOG und Test abgebildet

## Nebenbefund (Begründung des Urteils)

- `Stage2D.ts:257`, Meldung von `asPassNode()` → Audit (DOC): Text einer Fehlermeldung, kein Korrektheitsdefekt; die Scope-Regel (BUG-Serie) greift nicht

