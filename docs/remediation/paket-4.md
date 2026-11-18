# Paket 4 — CameraRig, StageTransition und PanControl2D

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-001 (medium), BUG-002 (medium), READ-001 (medium, Rig-Teil), BUG-005 (low), BUG-006 (low), API-002 (low), CONS-002 (low), dazu offene Fragen 2 und 3 (Entscheidungen im Plan vom 2026-11-17)
- Ziel: Transition und Rig klemmen Progress und deltaTime robust, `precompile()` funktioniert ohne Projektionsebene, ein gefolgtes Object3D liegt in der Bildmitte, der Zustand des Rigs ist ein explizites Modell hinter dem Internals-Muster, und PanControl2D reagiert nur auf eigene Tasten.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/utils/easing.ts`, `utils/easing.spec.ts`
  - `packages/twopoint5d/src/stage/StageTransition.ts`, `stage/StageDirector.ts` (nur TSDoc von `updateFrame()`), `stage/StageDirector.spec.ts`, `stage/StageDirector.masks.spec.ts`
  - `packages/twopoint5d/src/stage/CameraRig.ts`, neu `stage/cameraRigState.ts`, neu `stage/cullingSphere.ts` (+ `cullingSphere.spec.ts`), `stage/cameraTarget.ts`, `stage/cameraRest.ts`, `stage/CameraRig.spec.ts`, `stage/CameraRig.across.spec.ts`, `stage/hot-path-allocations.camera-rig.spec.ts` (nur die direkten Aufrufe von `placeBase()`/`compose()`/`write()`); `StageCameraDriver.ts` und `CameraFlight.ts` bleiben, wie sie sind
  - `packages/twopoint5d/src/controls/PanControl2D.ts`, `controls/PanControl2D.spec.ts`
  - `packages/twopoint5d/docs/stages.md`, `packages/twopoint5d/docs/proposals/camera-rig.md`, `packages/twopoint5d/CHANGELOG.md`
- Vorgehen: siehe Abschnitt »Vorgehen« unten — Teil A (Fehler, je Regressionstest zuerst rot), Teil B (Struktur), Teil C (Doku und CHANGELOG)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): clamp the eased progress of transitions and of the camera rig to 0 to 1, NaN included, count a delta time of a transition that is no finite number above 0 as 0, compile a stage without a projection plane for the meshes of its scene, keep an object the rig follows under a camera projection in the middle of the picture, name the target of CameraRig.across() as to, let a keyup of PanControl2D reset only a speed its key raised, and keep the state of the rig in one model behind private driver calls`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · BUG-001 unverändert (`StageTransition.ts:244`, `easing.ts:75`) · BUG-002 unverändert (`CameraRig.ts:1060-1064`) · READ-001 unverändert (`CameraRig.ts` 1744 Zeilen, `SavedState` `:200-216`, Kopie hin `:1677-1693`, zurück `:1723-1737`) · BUG-005 verschoben nach `PanControl2D.ts:798-803` (Paket 3 hat `mouseButton` als Accessor eingefügt) · BUG-006 unverändert (`StageTransition.ts:223, 232`) · API-002 unverändert (`CameraRig.ts:1645, 1659`, `cameraPose.ts:105`) · CONS-002 unverändert (`CameraRig.ts:980, 1012, 1026`) · offene Frage 2 unverändert (`cameraTarget.ts:138-150`, `cameraRest.ts:59-64`) · offene Frage 3 unverändert (`CameraFlight.ts:264-267`) · keine Folgen offen (Pakete 1–3: »Folgen: keine«) · aus »Offene Befunde« nichts übernommen (keine gleiche Ursache) · Restplan: Paket 11 hängt jetzt auch von 4 ab (Driver-Adapter), Reihenfolge unverändert
  - 2026-11-18 Zug 1: Implementierer beauftragt (opus, effort high), Brief `paket-4.impl-0.brief.md`, Report nach `paket-4.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG_MIT_VORBEHALT (Adapter bindet die privaten Methoden statt Arrows: Arrows maßen 16 B/Aufruf; flackernder Display-Allocation-Spec gemeldet) · 20 Dateien, neu `cameraRigState.ts`, `cullingSphere.ts`, `cullingSphere.spec.ts` · Arbeitsbaum schmutzig · Verify läuft nach `paket-4.verify.log`
  - 2026-11-18 Zug 2: Verify `pnpm run ci` exit=0 (`paket-4.verify.log`)
  - 2026-11-18 Zug 3: Reviewer beauftragt (opus, effort high), Diff `paket-4.diff` (3957 Zeilen)
  - 2026-11-18 Zug 3: Urteil nachbessern · alle Findings behoben außer offene Frage 2 teilweise · kritisch: Tiefendrift beim erneuten `moveTo()`/`jump()` auf ein Object3D unter `CameraProjection` (`cameraTarget.ts:72`) · wichtig: `camera-rig.md:1136` nennt `applyEasing()`, `CHANGELOG.md:55-56` zwei Rückblick-Teilsätze · klein: `cullingSphere.ts:27` ohne `isSprite` · Report `paket-4.review-0.json`
  - 2026-11-18 Zug 4 Runde 1: offen kritisch 1, wichtig 2 → derselbe Implementierer per `--resume` (opus, high), Brief `paket-4.impl-1.brief.md`
  - 2026-11-18 Zug 4 Runde 1: Report FERTIG · `readObjectPose()` bekommt `followed` (auch `across({to: object})` hatte die Drift) · Proposal-Zeile und CHANGELOG-Teilsätze korrigiert · 3 neue Specs, vor dem Fix rot · Verify läuft nach `paket-4.verify-1.log`
  - 2026-11-18 Zug 4 Runde 1: Verify `pnpm run ci` exit=0 (`paket-4.verify-1.log`) · Reviewer per `--resume` gezielt auf die drei Befunde, Diff `paket-4.diff-1`
  - 2026-11-18 Zug 4 Runde 1: Urteil freigeben · alle drei Befunde behoben, nichts Neues · Report `paket-4.review-1.json`
  - 2026-11-18 Zug 5: Commit 92ed8863 (20 Dateien, Trailer `Remediation-Run: 2026-11-17`), getragen von `paket-4.verify-1.log` (exit=0, keine Änderung seither)

## Abgleich

Stand des Codes: HEAD `7e8d5b14`. Seit dem Audit (`2e3f585b`) hat in diesem
Bereich nur Paket 3 etwas geändert: `PanControl2D.ts` (Accessor
`mouseButton`, Zeilen verschoben), `CameraRig.spec.ts` (Frame-Pacer-Fälle) und
ein Kommentar in `hot-path-allocations.camera-rig.spec.ts`. `CameraRig.ts`,
`StageTransition.ts`, `easing.ts`, `cameraPose.ts`, `cameraTarget.ts` und
`cameraRest.ts` sind unverändert.

| Finding | Urteil | Fundstelle jetzt |
| --- | --- | --- |
| BUG-001 | unverändert | `StageTransition.ts:244` schreibt `applyEasing(this.#easing, elapsed / this.duration)` ungeklemmt in `#progress`; `easing.ts:75` klemmt mit `Math.min(1, Math.max(0, e))`, `NaN` geht durch. Die übrigen Fundstellen (`StageMask.ts:170` `followProgress`, `StageDirector.ts:1327` `renderToCurrentTarget`, `CameraRig.ts:1118`, `:1322`, `CameraFlight.ts:351`, `cameraTrack.ts:289`) sind Verbraucher und werden durch die beiden zentralen Stellen mit behoben. |
| BUG-002 | unverändert | `CameraRig.ts:1060-1064`: `distance` bleibt 0 ohne Ebene und ohne `#focus`, `shot.lens = 2 * Math.max(distance, rest.near) * shot.lens`. |
| READ-001 (Rig) | unverändert | `CameraRig.ts:240-327` (rund 50 `#`-Felder), `SavedState` `:200-216`, von Hand kopiert in `#takeFlightTarget()` `:1677-1693` und zurück in `#leaveFlight()` `:1723-1737`; Modus abgeleitet in `busy` `:416-426`, `cancel()` `:669`, `step()` `:849, 860`, `#resolve()` `:1097-1106`, `#resolveTarget()` `:1203-1214`, `#refusesLook()` `:1485-1492`, `#shownShot()` `:1517-1525`. |
| BUG-005 | verschoben | `PanControl2D.ts:798-803` (`#onKeyUp`), Inhalt unverändert: `this[field] = 0` ohne Blick in `#keyedSpeeds`. |
| BUG-006 | unverändert | `StageTransition.ts:223` (`#waited += deltaTime`) und `:232` (`#elapsed + deltaTime * this.#direction`). Eintrittspunkt `StageDirector.ts:1277`. |
| API-002 | unverändert | `#readTarget()` `CameraRig.ts:1505-1511` ruft `kindOfTarget(subject, target)` (`cameraTarget.ts:32`) und `readPose(…)` ohne `path`; `across()` erreicht es über `#readFlightEnd()` `:1645` und `#takeFlightTarget()` `:1659` (zweimal, auch `:1675`). `readPose()` (`cameraPose.ts:100`) kann `path` schon. |
| CONS-002 | unverändert | `placeBase()` `:980`, `compose()` `:1012`, `write()` `:1026` sind öffentliche Laufzeitmethoden mit `@internal`; die Stage ruft sie über `StageCameraDriver` (`Stage2D.ts:531, 602, 628, 696`). Direkte Aufrufe in Specs: `CameraRig.spec.ts:812, 2001`, `hot-path-allocations.camera-rig.spec.ts:69, 97, 309, 365, 387-388, 447, 511-512`. |
| Frage 2 | unverändert | `readObjectGoal()` `cameraTarget.ts:138-150` projiziert auf `rest.right`/`rest.up`; ohne Ebene sind das die Weltachsen (`cameraRest.ts:59-64`), die Kamera steht also auf Welt-x/y des Objekts bei der Tiefe und Ausrichtung des Rests. |
| Frage 3 | unverändert | `CameraFlight.ts:264-267` (`void transition.finished.then(() => this.check())`); der Guide (`stages.md:958-961`) nennt den Weg über `finished` nicht, das Proposal (`camera-rig.md:896-897`) schon. |

## Triage

- Folgen aus erledigten Paketen: keine (Pakete 1, 2, 3 tragen »Folgen: keine«).
- »Offene Befunde«: nichts übernommen. Der einzige Eintrag in einer Datei
  dieses Pakets — `PanControl2D.ts:352-353`, `keys`/`keyCodes` ungeprüft — hat
  eine andere Ursache als BUG-005 (fehlende Eingabeprüfung, nicht die
  Keyup-Logik) und blockiert nichts; er bleibt in der Queue für die
  Drain-Runde. Der Implementierer lässt ihn liegen.

## Entscheidungen in Zug 0

1. **Paket nicht geteilt.** Alle Findings sitzen in `CameraRig.ts` und seinen
   Helfern bzw. sind Einzeiler (BUG-005, BUG-006); die Reihenfolge Teil A vor
   Teil B hält die Regressionstests unabhängig vom Umbau, und der Umbau läuft
   gegen eine dann vollständige Spec-Suite.
2. **BUG-001: `applyEasing()` entfällt.** `StageTransition#advance()` nutzt
   `applyEasingInPlace()` über einen modulweiten `Float64Array(1)`-Slot, wie es
   die Empfehlung verlangt (»dieselbe Funktion«). Damit gibt es genau eine
   Auswertung samt Klemme in der Library. `applyEasing()` hat außer der
   Transition keinen Aufrufer und ist nicht öffentlich (`utils/public-api.ts`
   exportiert nur den Typ `Easing`).
3. **BUG-001: Klemme.** `slot[0] = e > 0 ? (e < 1 ? e : 1) : 0;` — `NaN`,
   `undefined` und jede andere Nicht-Zahl fallen auf 0, weil der Vergleich
   `e > 0` für sie falsch ist; eine Zeichenkette wie `"0.5"` wird beim
   Schreiben in den `Float64Array` zur Zahl. Wert aus der Empfehlung.
4. **BUG-006: Form der Prüfung.** `deltaTime > 0 && deltaTime <
   Number.POSITIVE_INFINITY ? deltaTime : 0` statt `Number.isFinite()`: gleiche
   Wirkung wie in `PanControl2D#update()`, aber ohne Aufruf auf einem Bruch,
   wie `CameraRig#step()` es hält (V8 boxt einen Bruch, den es an einen nicht
   inlinten Aufruf gibt). Gezählt als 0, nicht geworfen — so empfiehlt es das
   Audit, und `updateFrame()` ist ein Frame-Eintritt, dessen erster Frame aus
   einer eigenen Schleife kein `deltaTime` haben kann.
5. **BUG-002: Rückfall auf die Szene, keine neue Option.** Ohne Ebene und ohne
   `#focus` nimmt `#writeOtherKind()` die Distanz entlang der Blickachse zur
   Mitte der Bounding Sphere aller Objekte, die three.js am Frustum verwirft.
   Damit funktioniert der dokumentierte Ablauf (`await rig.precompile()` beim
   Start, `moveTo(…, {focus})` später) ohne Codeänderung beim Nutzer; eine
   Option `precompile(renderer, {focus})` (der andere Weg der Empfehlung)
   brächte neue öffentliche Fläche, ohne diesen Ablauf zu reparieren. Die
   Sphere folgt genau der Regel von `Frustum#intersectsObject()` in three
   0.187 (`math/Frustum.js:146-166`): `object.boundingSphere`, wo das Objekt
   eine hat (Instanced/Batched), sonst `geometry.boundingSphere`, je mit
   `computeBoundingSphere()` wo `null`, dann `applyMatrix4(matrixWorld)` — also
   nichts, was der erste Draw nicht ohnehin berechnet.
6. **Frage 2: ein Follow-Frame im Rest.** Posen unter einer Projektion ohne
   Ebene bleiben in Weltachsen (dokumentiert in `stages.md:722-723`); nur ein
   `Object3D` — als Ziel von `jump()`, `moveTo()`, `across({to})` und als Shot
   eines Track-Keys — wird in einem eigenen Frame verfolgt: unter einer Ebene
   ist es die Ebene (keine Verhaltensänderung), ohne Ebene die Ebene durch den
   Weltursprung, die der Basiskamera zugewandt ist — rechts und oben die Achsen
   der Basis, Normale ihre Rückwärtsachse. Der Fuß des Objekts auf dieser Ebene
   liegt auf der Blickachse des Rests, das Objekt also in der Bildmitte; Abstand,
   `offset` und Trailing behalten ihre Bedeutung relativ zu dieser Ebene. So
   bleibt die ganze 2D-Maschinerie (`goalX`/`goalY`, `trailObject()`) wie sie
   ist, und unter einer Ebene ändert sich kein Wert.
7. **CONS-002: Driver-Adapter statt `CameraRigInternals` für die Stage.** Die
   Stage kennt den Rig nur als `StageCameraDriver` und importiert `CameraRig`
   nicht; ein Adapterobjekt, das der Rig einmal baut (wie `#flightSide()`),
   hält das so. Für Specs und `across()` gibt es ein kleines
   `CameraRigInternals` mit `driverOf(rig)`, analog zu `Stage2DInternals`.
8. **READ-001: Zustand in `CameraRigState` mit `mode`.** Die fünf Modi des
   Rigs schließen sich im heutigen Code gegenseitig aus (geprüft: `moveTo()`,
   `jump()`, `track()`, `#hold()`, `#takeFlightTarget()` setzen die jeweils
   anderen Flags zurück); ein Feld `mode` bildet das ohne Verlust ab. Der Flight
   bleibt eine Schicht darüber (`#flight`), weil der Rig unter ihm seinen
   eigenen Zustand weiterführt.

## Vorgehen

Allgemein: Konventionen aus dem Plan-Kopf und `AGENTS.md` gelten für jede
Zeile — Englisch in Code, Kommentaren und Doku, `#`-Member, `.js`-Suffix,
Meldungen nach der Projektregel, keine Finding-IDs, kein Rückblick auf den
Vorzustand. Lies `CameraRig.ts` ganz, bevor du Teil B beginnst. Zwischendurch
einzelne Specs mit `pnpm nx test twopoint5d -- src/stage/CameraRig.spec.ts`
(usw.); die Allocation-Specs nur als ganze Datei über `pnpm test:allocations`.
Nie zwei Gates oder Builds parallel. Für das ganze Paket gilt:
`hot-path-allocations.director.spec.ts` (deckt `StageTransition#advance()`)
und `hot-path-allocations.camera-rig.spec.ts` bleiben mit unveränderten
Erwartungen grün; geändert werden dort nur die direkten Aufrufe aus B1.

### Teil A — Fehler, je Regressionstest zuerst rot

**A1 · Eased Progress klemmen (BUG-001)**

1. Specs zuerst, rot sehen:
   - `utils/easing.spec.ts`: ein Fall »`applyEasingInPlace()` writes 0 for an
     easing that answers no number« mit den Antworten `NaN`, `undefined`
     (Funktion ohne `return`) und `null` → jeweils `0` im Slot. (Rot: `NaN`
     bleibt `NaN`.)
   - `stage/StageDirector.spec.ts`: eine Transition mit `duration: 1` und der
     überschwingenden Easing `(t) => t * 2 - 0.5` — nach dem Startframe (der
     keine Zeit zählt) in Frames zu `0.125` s liest `transition.progress` nie
     unter 0 oder über 1, bei `elapsed` 0.125 ist es exakt `0`, bei 0.875
     exakt `1`; und eine Transition mit der Easing
     `(() => undefined) as unknown as (t: number) => number` — `progress` ist
     während des Laufs `0`, nie `NaN`, die Transition endet nach ihrer Dauer
     als `finished` mit `progress` 1.
   - `stage/StageDirector.masks.spec.ts`: eine Maske, deren Effekt-Transition
     mit `(t) => t * 2 - 0.5` läuft — `mask.progress` und
     `mask.progressNode.value` bleiben in jedem Frame in `[0, 1]`.
   - `stage/CameraRig.spec.ts`: `moveTo({position: [100, 0]}, 1, {easing:
     (() => Number.NaN) as (t: number) => number})` — in jedem Frame vor der
     Ankunft ist `rig.camera.position` endlich und gleich der Startposition,
     nach der Ankunft steht die Kamera auf dem Ziel.
2. `utils/easing.ts`: `applyEasing()` (Zeilen 31-49) entfernen. In
   `applyEasingInPlace()` die letzte Zeile durch
   `slot[0] = e > 0 ? (e < 1 ? e : 1) : 0;` ersetzen, mit einem Kommentar,
   dass ein Vergleich `NaN` und jede Nicht-Zahl auf 0 fallen lässt. TSDoc der
   Funktion: geklemmt auf `[0, 1]`, eine Antwort, die keine Zahl ist — `NaN`,
   `undefined` —, zählt als 0; die Verweise auf `applyEasing` entfallen, die
   benannten Kurven beschreibt die Funktion selbst. TSDoc des Typs `Easing`
   (Zeile 3): Antwort geklemmt auf `[0, 1]`, eine Antwort, die keine Zahl ist,
   zählt als 0.
3. `stage/StageTransition.ts`: Import auf `applyEasingInPlace`; modulweit
   `const easedProgress = new Float64Array(1);` mit einem Kommentar, warum ein
   Slot (ein Bruch in einem typisierten Array wird nicht geboxt, wie im Rig);
   Zeile 244 wird
   `easedProgress[0] = elapsed / this.duration; applyEasingInPlace(this.#easing, easedProgress); this.#progress = easedProgress[0]!;`.
   TSDoc von `progress` (Zeile 158-162): »The eased progress, 0 to 1« bleibt,
   ergänzt um: an easing that overshoots stops at the ends, and an answer that
   is no number counts as 0.
4. `utils/easing.spec.ts` auf `applyEasingInPlace()` umstellen: die Kurven-
   Fälle (Zeilen 14-21) prüfen über den Slot; der Fall »writes what
   applyEasing() answers…« (24-34) vergleicht gegen eine lokale, ungeklemmte
   Referenz im Spec (`curves[name]` bzw. die Funktion selbst) mit
   `Math.min(1, Math.max(0, …))`; »a function passes through« (52-56) prüft
   `easingOf('test', fn) === fn` und den Slot-Wert `0.5` für `t = 0.25`.

**A2 · deltaTime der Transition (BUG-006)**

1. Spec zuerst, rot sehen, in `stage/StageDirector.spec.ts`:
   `director.replace(a, b, {duration: 1})`, erster Frame mit
   `updateFrame(0, Number.NaN, 0)`, danach Frames zu `0.1` — die Transition
   endet als `finished` nach ihrer Dauer, `elapsed` und `progress` bleiben in
   jedem Frame endlich; derselbe Ablauf mit `-0.5`, `Infinity` und einer
   `delay: 0.3` (das Warten zählt `NaN` ebenfalls als 0). (Rot: `elapsed` wird
   `NaN`, die Transition endet nie.)
2. `StageTransition#advance()` (Zeile 219): als erste Zeile
   `const dt = deltaTime > 0 && deltaTime < Number.POSITIVE_INFINITY ? deltaTime : 0;`
   mit dem Kommentar: a delta time the first frame of a loop may lack, or one
   that runs backwards, counts as no time; inline, not through a call, since a
   fraction handed to a call that V8 does not inline is boxed. `dt` ersetzt
   `deltaTime` in Zeile 223 und 232.
3. TSDoc von `StageDirector#updateFrame()` (`StageDirector.ts:1249`): a
   `deltaTime` that is no finite number above 0 counts as 0 for the
   transitions.

**A3 · Keyup nur für eigene Tasten (BUG-005)**

1. Spec zuerst, rot sehen, in `controls/PanControl2D.spec.ts` neben »lets go
   of a held key by a keyup from wherever it comes« (Zeile 228):
   - `speedEast = 40` von Hand, dann `keydown` und `keyup` von `KeyD` in ein
     `input` getippt (`origin: {localName: 'input'}`) → `speedEast` bleibt 40.
   - `speedEast = 40` von Hand, `keydown` `KeyD` mit `ctrlKey: true`, `keyup`
     `KeyD` → bleibt 40.
   - `speedEast = 40` von Hand, nur ein `keyup` `KeyD` → bleibt 40.
   - Der bestehende Fall (Taste gehalten, Keyup von woanders lässt los) bleibt
     grün.
2. `PanControl2D.ts:798-803`: `#onKeyUp` wird
   `const field = this.#speedFieldFor(event); if (field == null || !this.#keyedSpeeds.delete(field)) return; this[field] = 0;`
   — Kommentar: a keyup lets go only of a speed its key raised: one the
   control refused on its keydown, or one set by hand, stays.
3. TSDoc der Speed-Accessoren (`speedNorth` usw.), wo sie das Setzen von Hand
   beschreiben: a keyup of a key the control did not take leaves the value
   alone.

**A4 · `precompile()` ohne Projektionsebene (BUG-002)**

1. Spec zuerst, rot sehen, in `stage/CameraRig.spec.ts` unter
   `describe('precompile()')` mit dem dortigen `makeRenderer()`: eine Stage mit
   `new CameraProjection(source)`, `source` eine `PerspectiveCamera(50, 4 / 3,
   0.1, 1000)` bei `(0, 6, 10)` mit `lookAt(0, 0, 0)` und
   `updateMatrixWorld()`, in der Szene ein `Mesh(new BoxGeometry(1, 1, 1),
   new MeshBasicMaterial())` bei `(3, 0, -2)` (`frustumCulled` bleibt
   `true`); die Stage bekommt einen View wie in `makeRig()`. Nach
   `rig.precompile(renderer)` ist die Kamera des Aufrufs eine
   `OrthographicCamera`, und
   `new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)).intersectsObject(mesh)`
   ist `true`. (Rot: die Höhe liegt bei rund 0.09.) Zweiter Fall: hat ein
   `moveTo()` vorher `focus` genannt, gilt weiter `#focus`.
2. Neu `src/stage/cullingSphere.ts` (`@internal`, nicht in `public-api.ts`):
   `export function cullingSphereOf(root: Object3D, out: Sphere): Sphere` —
   `out.makeEmpty()`, `root.updateMatrixWorld()`, dann
   `root.traverseVisible()`: für jedes Objekt mit `frustumCulled === true` und
   `isMesh`, `isLine` oder `isPoints` die Sphere, die three.js gegen das
   Frustum hält (`object.boundingSphere`, wo das Feld definiert ist, sonst
   `geometry.boundingSphere`; je `computeBoundingSphere()` wo `null`), in
   Weltkoordinaten (`applyMatrix4(object.matrixWorld)`), per `out.union()`
   gesammelt; eine leere Sphere wird übersprungen. Antwortet `out`, leer, wo
   nichts gefunden wurde. TSDoc: the sphere around what three.js culls by its
   frustum, the same spheres `Frustum#intersectsObject()` tests. Eigene Spec
   `cullingSphere.spec.ts`: leer für eine leere Szene, leer für ein Mesh mit
   `frustumCulled = false` oder `visible = false`, die Vereinigung zweier
   Meshes in einer verschobenen Gruppe, ein `InstancedMesh` mit seiner eigenen
   `boundingSphere`.
3. `CameraRig#writeOtherKind()` (Zeile 1059-1062): Reihenfolge der Distanz
   bleibt Ebene → `#focus` (bzw. nach Teil B `state.focus`); neu als dritter
   Zweig: `cullingSphereOf(this.#stage.scene, new Sphere())`, und wo sie nicht
   leer ist, `distance = new Vector3().subVectors(sphere.center,
   shot.position).dot(forward)`. Der Boden `Math.max(distance, rest.near)` im
   perspektivischen Zweig bleibt (eine Mitte hinter der Kamera fällt darauf),
   ebenso der orthographische Zweig. Kommentar oberhalb anpassen: to the
   plane, the focus of the move, or the middle of what three.js culls in the
   scene. Allokationen sind hier erlaubt (kein Hot Path).
4. TSDoc von `precompile()` (Zeile 864-884): ohne Ebene steht die Kamera der
   anderen Art auf der Fokus-Distanz des letzten Moves, sonst auf der Mitte
   der Objekte der Szene, die three.js am Frustum verwirft, damit sie
   kompiliert werden.

**A5 · Ziel von `across()` als `to` (API-002)**

1. Spec zuerst, rot sehen, in `stage/CameraRig.across.spec.ts`:
   `CameraRig.across(transition, {to: 5 as never})` wirft
   `new TypeError('CameraRig.across(): to must be a CameraPose, a camera, a projection or an Object3D, got 5')`;
   `{to: {position: [Number.NaN, 0]}}` wirft
   `new RangeError('CameraRig.across(): to.position[0] must be a finite number, got NaN')`;
   eine `Camera`, die weder perspektivisch noch orthographisch ist, als `to`
   wirft `CameraRig.across(): to must be a PerspectiveCamera or an OrthographicCamera where it is a camera, got …`
   (Form wie `cameraTrack.ts:146-148`). Vorher den genauen Wortlaut der
   `describeValue()`-Ausgabe im Spec gegen die Funktion halten.
2. `cameraTarget.ts:32`: `kindOfTarget(subject, target, path?: string)`; mit
   `path` lautet die Kamera-Ablehnung
   `${subject}: ${path} must be a PerspectiveCamera or an OrthographicCamera where it is a camera, got ${describeThreeValue(target, 'isObject3D')}`,
   ohne `path` bleibt sie wörtlich wie heute (Specs `CameraRig.spec.ts:888,
   892`). TSDoc um `path` ergänzen.
3. `CameraRig#readTarget()` bekommt einen letzten optionalen Parameter
   `path?: string` und reicht ihn an `kindOfTarget()` und `readPose()` durch.
   `#readFlightEnd()` (Zeile 1645) und beide Aufrufe in
   `#takeFlightTarget()` (Zeile 1659, 1675) rufen mit `'to'`; `jump()` und
   `moveTo()` ohne `path` (ihre Meldungen bleiben `target …`).

**A6 · Objekt in der Bildmitte ohne Ebene (offene Frage 2)**

1. Specs zuerst, rot sehen, in `stage/CameraRig.spec.ts`, eigener
   `describe('an Object3D under a projection without a plane')`, Stage mit
   `new CameraProjection(source)` wie in A4, `object` bei `(3, 0, -2)` in der
   Szene; nach jedem Schritt eines Frames
   `object.getWorldPosition(new Vector3()).project(rig.camera)` mit `x` und
   `y` je `toBeCloseTo(0, 6)`:
   - `rig.jump(object)`; danach `object.position.set(-4, 1, 3)` und ein Frame
     → wieder in der Mitte.
   - `rig.moveTo(object, 0.5)` bis zur Ankunft, dann `{smooth: 0.2}`, bis
     `busy` `false` ist.
   - `moveTo(object, 0, {offset: [1, 0]})` → `y` ≈ 0 und `x` < 0 (die Kamera
     ist entlang ihrer eigenen Rechtsachse versetzt).
   - ein Track `rig.track(object, {})` bei `lerp(0)` → das Objekt in der Mitte.
   - dieselbe Stage mit einer schräg blickenden `OrthographicCamera` als
     Quelle → in der Mitte.
   - die Tiefe: ohne `offset[2]` hält die Kamera den Abstand, den sie von der
     Ebene des Follow-Frames hatte (Kamera vorher auf `{}` → Abstand des
     Rests).
   Bestehende Follow-Specs unter `ParallaxProjection`/`OrthographicProjection`
   behalten ihre Erwartungen unverändert.
2. `cameraRest.ts`: `Rest` bekommt den Frame, in dem ein `Object3D` verfolgt
   wird — `readonly followRight: Vector3`, `readonly followUp: Vector3`,
   `readonly followNormal: Vector3`, `followDistance: number` (Abstand der Basis
   von der Follow-Ebene entlang `followNormal`, gemessen ab `origin`). TSDoc:
   under a plane the plane's own axes; without one the plane through the world
   origin that faces the base — its right and up axes those of the base, its
   normal the base's backward axis. `createRest()` legt die Vektoren an
   (`followDistance: 0.5` als Bruch, wie die anderen Felder). `readRest()`
   füllt sie allokationsfrei: mit Ebene Kopien von `right`/`up`/`normal` und
   `followDistance = distance`; ohne Ebene `followRight.set(1, 0, 0).applyQuaternion(rest.quaternion)`,
   `followUp.set(0, 1, 0)…`, `followNormal.set(0, 0, 1)…` und
   `followDistance` als Skalarprodukt `(position - origin) · followNormal`
   (inline, wie `distance`).
3. `cameraTarget.ts`:
   - `readObjectGoal()` projiziert auf `rest.followRight`/`rest.followUp`
     statt `right`/`up`.
   - `readObjectPose()`: der Abstand aus `shown` entlang `followNormal`,
     `out.hasDistance = true`; ohne `shown` unter einem Rest ohne Ebene die
     Position der aktuellen Pose über `writePosePosition()` in einen
     modulweiten Scratch-`Vector3` und deren Abstand entlang `followNormal`,
     `hasDistance = true` (eine Pose ohne Ebene trägt ihren Abstand in
     Weltachsen; das Objekt braucht ihn im Follow-Frame). Mit Ebene bleibt das
     Ergebnis wertgleich. `offset[2]` setzt wie heute den Abstand.
   - neu `writeFollowPosition(rest, pose, out)`: wie `writePosePosition()`,
     aber auf `followRight`/`followUp`/`followNormal` mit
     `along = pose.hasDistance && rest.kind === 'perspective' ? pose.distance - rest.followDistance : 0`.
   - neu `resolveFollowShot(rest, pose, look, out)`: wie `resolvePoseShot()`,
     aber die Position über `writeFollowPosition()`; `#resolveKey()` ruft sie
     für einen Key mit `follow`, `resolvePoseShot()` für die anderen.
   - TSDoc von `readObjectGoal()`, `readObjectPose()`, `ObjectFollow`
     (»relative to the rest«) auf den Follow-Frame umstellen.
4. `CameraRig.ts`: `#resolveTarget()` schreibt die Position über
   `writeFollowPosition()`, wo ein Objekt verfolgt wird (`follow.object !==
   undefined`), sonst wie heute; `#resolveKey()` ebenso für Keys mit `follow`.
   Unter einer Ebene sind beide Wege wertgleich — die Allocation-Specs müssen
   ohne Änderung grün bleiben.
5. TSDoc: `CameraTarget` (Zeile 71-72), `CameraMoveOptions.offset` (96-100),
   `CameraTrackKey.shot` (131-136), `moveTo()` (494-499): unter einer
   Projektion ohne Ebene — einer `CameraProjection` — liegt ein `Object3D` in
   der Bildmitte; `offset` verschiebt entlang der Rechts- und Hochachse der
   Kamera des Rests, der Abstand zählt von der Ebene durch den Weltursprung,
   die dieser Kamera zugewandt ist.

**A7 · Fehlerweg am Ende eines Flights (offene Frage 3)**

Nur Doku, kein Code: TSDoc von `CameraRig.across()` (Zeile 1564-1593) und der
Guide (siehe C2) sagen, dass ein Flight, dessen Ende kein Frame und kein Aufruf
bemerkt — eine Transition, nach der keine Stage des Flights mehr gezeichnet
wird, ein Director, der disposed wurde —, über `transition.finished` endet und
dass ein Wurf eines Rigs dort als Unhandled Rejection hinausgeht; ein
Error-Event gibt es nicht. Der Kommentar `CameraFlight.ts:264-266` bleibt.

### Teil B — Struktur, ohne Verhaltensänderung

Jede Spec, auch jede Allocation-Spec, bleibt mit unveränderter Erwartung grün;
geändert werden dürfen nur die direkten Aufrufe von `placeBase()`,
`compose()`, `write()` (B1). Misst eine Allocation-Spec nach dem Umbau Bytes,
ist der Umbau zu korrigieren, nicht die Spec.

**B1 · Driver-Methoden privat (CONS-002)**

1. `placeBase()`, `compose()`, `write()` werden `#placeBase()`, `#compose()`,
   `#write()`; ihre `@internal`-Absätze »Not for use outside the stage«
   entfallen, der Rest der Kommentare bleibt als Zeilenkommentar.
2. Der Rig baut im Konstruktor einmal einen Adapter
   `readonly #driver: StageCameraDriver` als Objektliteral im Klassenkörper:
   `get camera()` → `rig.#camera`, `placeBase: (projection) => rig.#placeBase(projection)`,
   `compose: () => rig.#compose()`, `write: () => rig.#write()` (mit
   `const rig = this`). `Stage2DInternals.attachDriver(stage, this.#driver)`;
   die Vergleiche `driverOf(stage) === this` (Zeile 379, 960) werden
   `=== this.#driver`. Modulweit `const rigOfDriver = new WeakMap<StageCameraDriver, CameraRig>()`,
   gefüllt im Konstruktor vor `attachDriver()`; `across()` (Zeile 1596-1597)
   fragt `rigOfDriver.get(Stage2DInternals.driverOf(stage))`.
3. Exportiert und `@internal`, nicht in `public-api.ts`:
   `export const CameraRigInternals = {} as { driverOf(rig: CameraRig): StageCameraDriver }`,
   belegt im `static {}`-Block der Klasse, nach dem Muster von
   `Stage2DInternals`/`StageTransitionInternals`.
4. Der Kommentar Zeile 218-219 sagt jetzt: the rig hands its stage a driver
   adapter over private methods; it does not name `StageCameraDriver` in its
   published declarations. `import type {StageCameraDriver}` ist erlaubt
   (private Felder und `@internal`-Exporte erscheinen nicht in den
   Deklarationen); `pnpm run ci` prüft das über `checkPkgTypes` und
   `checkNameableTypes`.
5. Specs: `rig.compose()` → `CameraRigInternals.driverOf(rig).compose()` usw.
   (`CameraRig.spec.ts:812, 2001`, `hot-path-allocations.camera-rig.spec.ts`,
   Fundstellen oben im Abgleich); `CameraRig.spec.ts:778`
   (`driverOf(stage)).toBe(next)`) gegen `CameraRigInternals.driverOf(next)`.
   Ein neuer Spec: `'placeBase' in rig`, `'compose' in rig`, `'write' in rig`
   sind `false`.

**B2 · Zustand als Modell (READ-001, Rig-Teil)**

1. Neu `src/stage/cameraRigState.ts` (`@internal`, nicht in `public-api.ts`):
   ```ts
   /** What the camera of a CameraRig shows while it takes part in no flight. @internal */
   export type CameraRigMode = 'pose' | 'held' | 'move' | 'locked' | 'track';
   ```
   - `'pose'`: steht auf `pose` über dem Rest der Stage (auch nach `jump()`
     auf eine Projektion und nach der Ankunft eines Moves auf eine Pose oder
     Projektion)
   - `'held'`: steht auf dem Shot, den `cancel()` hielt (heute `#holding`)
   - `'move'`: ein Move läuft (heute `#moving`)
   - `'locked'`: auf eine Kamera oder ein `Object3D` eingerastet (heute
     `#follows && !#moving`)
   - `'track'`: auf einem Track (heute `#track !== undefined`)

   und eine Klasse `CameraRigState` mit TSDoc (the target state of a rig: its
   mode and everything it resolves its shot from; a flight saves it whole and
   gives it back whole) und diesen Feldern, initialisiert wie heute im Rig
   (Brüche bzw. `NaN` als Startwerte, damit V8 Double-Felder behält):

   | Feld in `CameraRigState` | heute im Rig |
   | --- | --- |
   | `mode: CameraRigMode = 'pose'` | abgeleitet aus `#moving`, `#holding`, `#track`, `#follows` |
   | `targetKind: TargetKind = 'pose'` — Art des Ziels eines Moves oder Lock-ons | `#follows` ist `targetKind === 'camera' \|\| targetKind === 'object'` |
   | `readonly pose`, `readonly look` | `#pose`, `#look` |
   | `holdingTurn`, `readonly held` | `#holdingTurn`, `#held` |
   | `track: CameraTrack \| undefined` | `#track` |
   | `projection`, `assigns`, `rest`, `placed`, `width`, `height`, `pixelRatio` | `#targetProjection`, `#assigns`, `#targetRest`, `#targetPlaced`, `#targetWidth`, `#targetHeight`, `#targetPixelRatio` |
   | `readonly follow` | `#follow` |
   | `focus`, `depth` | `#focus`, `#depth` |

   Methode `copy(source: CameraRigState): this`: Werte für `pose`
   (`copyPoseValues`), `look`, `held` (`copyShot`), `follow` (neu
   `copyObjectFollow(source, target)` in `cameraTarget.ts`, Feld für Feld) und
   alle Skalare; Referenzen für `track`, `projection` und `rest`. TSDoc von
   `copy()` erklärt die Referenzen: ein Ziel mit Projektion bekommt in
   `#takeTarget()` einen eigenen Rest, der gesicherte bleibt also unberührt,
   und ein Ziel ohne Projektion platziert keinen Rest.
2. `CameraRig.ts`: `readonly #state = new CameraRigState()` ersetzt die Felder
   der Tabelle; `#saved?: CameraRigState` ersetzt `SavedState` (Interface
   Zeile 198-216 entfällt). `#takeFlightTarget()` sichert mit
   `this.#saved = new CameraRigState().copy(this.#state)` (statt Zeile
   1677-1693), `#leaveFlight()` stellt mit `this.#state.copy(saved)` wieder
   her (statt Zeile 1723-1737) und platziert danach wie heute den Rest neu
   (Zeile 1738-1742).
3. Jede Stelle, die heute den Modus aus Flags ableitet, fragt `mode`:
   `busy`, `cancel()`, `#hold()` (`mode = hasRest ? 'held' : 'pose'`),
   `step()`, `#resolve()`, `#resolveTarget()`, `#refusesLook()`,
   `#shownShot()`, `#arrive()` (`'locked'` für `targetKind` `camera`/`object`,
   sonst `'pose'`), `#endMove()`, `#release()`, `#takeTarget()`, `jump()`,
   `moveTo()`, `track()`. Wer einen Modus setzt, setzt ihn genau dort, wo
   heute das entsprechende Flag gesetzt wird. Die Uhr des Moves (`#elapsed`,
   `#duration`, `#moveEasing`, `#fromPending`, `#from`, `#settle`), der Lift,
   `#followMoved`, die Kameras, `#rest`/`#hasRest`, `#lensChange`, die
   Scratch-Shots und der Flight (`#flight`, `#flightRole`, `#side`) bleiben
   Felder des Rigs — der Flight sichert keinen laufenden Move (er beendet ihn
   vorher mit `#hold()`).
4. Kein neues Verhalten, keine neue öffentliche Fläche.

### Teil C — Doku und CHANGELOG

1. CHANGELOG `packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog`
   laden. `CameraRig`, `CameraProjection`, `across()`, `precompile()` und der
   Typ `Easing` sind unveröffentlicht (`## [Unreleased]`, `### Added`): ihre
   Bullets werden ergänzt, kein `Fixed`-Eintrag für sie — das `Easing`-Bullet
   um die Klemme samt »no number counts as 0«, das `precompile()`-Bullet um
   den Rückfall ohne Ebene, das Bullet zu Kameras und `Object3D`s als Ziel um
   die Bildmitte unter einer Projektion ohne Ebene. `StageTransition`,
   `StageDirector` und `PanControl2D` sind veröffentlicht: unter `### Fixed`
   je ein Eintrag — die Transition klemmt die Antwort ihrer Easing auf
   `[0, 1]` und zählt eine Antwort, die keine Zahl ist, als 0; ein `deltaTime`
   von `StageDirector#updateFrame()`, das keine endliche Zahl über 0 ist,
   zählt für die Transitions als 0; ein Keyup von `PanControl2D` setzt nur
   einen Speed zurück, den seine Taste gesetzt hat.
2. `packages/twopoint5d/docs/stages.md`:
   - Viewpoints (Zeile 526-527): der Satz zur Klemme um »an answer that is no
     number — `NaN`, `undefined` — counts as 0«.
   - Abschnitt der Transitions, wo `easing` beschrieben ist: dieselbe Klemme
     für Transitions, und ein `deltaTime`, das keine endliche Zahl über 0 ist,
     zählt als 0.
   - »No hitch on the swap« (ab Zeile 661): der Satz zum Rückfall ohne Ebene
     aus A4.4.
   - »A 3D scene through the cameras of a `.glb`« (Zeile 722-723): hinter dem
     Bullet zu Posen in Weltachsen ein Bullet, dass ein `Object3D` als Ziel in
     der Bildmitte liegt, `offset` entlang der Kameraachsen.
   - »A camera that follows« (Zeile 1060-1065): die Bullets zu Fuß und
     `offset` um den Fall ohne Ebene.
   - »A flight across a transition« (Bullet Zeile 958-961): der Satz aus A7.
3. `packages/twopoint5d/docs/proposals/camera-rig.md`:
   - §4.1 (ab Zeile 575): der Rig gibt der Stage einen Adapter über private
     Methoden; die Namen `placeBase()`, `compose()`, `write()` sind die des
     Interfaces `StageCameraDriver`.
   - neuer Unterabschnitt in §4 (nach §4.2): der Zustand des Rigs —
     `CameraRigState`, die fünf Modi als Tabelle »Modus · was die Kamera
     zeigt · welcher Aufruf hinein- und hinausführt« (`jump()`, `moveTo()`,
     Ankunft, `cancel()`, `track()`, Ende eines Flights) und dass der Flight
     den Zustand als Ganzes sichert.
   - §4.5 (Zeile 800-803) und Tabelle Zeile 140: der Follow-Frame ohne Ebene.
   - §4.9 (Zeile 953-962): `applyEasing()` gibt es nicht mehr;
     `StageTransition#advance()` nutzt `applyEasingInPlace()` über einen
     Slot, die Klemme samt `NaN` liegt dort.
4. Die Lookbook-Demos prüfen: keine folgt einem `Object3D` unter einer
   `CameraProjection` (`camera-rig-into-the-map.astro:323` folgt unter der
   Karte mit Ebene), keine ruft `placeBase()`/`compose()`/`write()`. Bleibt so,
   ist dort nichts zu ändern.

## Findings im Volltext

**BUG-001 · medium · packages/twopoint5d/src/stage/StageTransition.ts:244** — Eased Progress von StageTransition und CameraRig einheitlich auf 0…1 klemmen, NaN eingeschlossen
Weitere Fundstellen: `StageMask.ts:170`, `StageDirector.ts:1327`, `utils/easing.ts:75`, `CameraRig.ts:1118`, `CameraFlight.ts:351`, `cameraTrack.ts:289`.
`StageTransition#advance()` schreibt `applyEasing(this.#easing, elapsed / this.duration)` ungeklemmt in `#progress`. Eine eigene Easing-Funktion, die überschwingt (back-out, elastic), liefert Werte unter 0 oder über 1; sie gehen unverändert in den `progress`-Uniform des Shapes und über `followProgress()` in `StageMask.progress`. Die Effekte mischen per `mix(from, to, progress)` und extrapolieren dann — übersättigte oder negative premultiplied Farben in den Frames des Überschwingers, obwohl `docs/stages.md` und das TSDoc von `progress` »`0`…`1`« versprechen.
Der CameraRig klemmt über `applyEasingInPlace()`, doch dessen `Math.min(1, Math.max(0, e))` lässt `NaN` durch: eine Easing-Funktion ohne `return` (Arrow mit geschweiften Klammern) macht `blendProgress` zu `NaN`, `blendShotsAtProgress()` erkennt weder `e <= 0` noch `e >= 1`, und Position, Quaternion und Linse der Kamera werden `NaN` — die Stage zeigt stumm nichts.
Beleg: `this.#progress = applyEasing(this.#easing, elapsed / this.duration);` · `slot[0] = Math.min(1, Math.max(0, e));`
Empfehlung: `applyEasingInPlace()` in `utils/easing.ts` so klemmen, dass auch `NaN` und Nicht-Zahlen auf einen definierten Wert fallen (`slot[0] = e > 0 ? (e < 1 ? e : 1) : 0;`), und `StageTransition#advance()` dieselbe Funktion nutzen lassen. Specs: eine überschwingende Easing an einer Transition, eine Easing ohne Rückgabewert an Rig und Transition.

**BUG-002 · medium · packages/twopoint5d/src/stage/CameraRig.ts:1064** — `precompile()` ohne Projektionsebene über eine Ansicht von Szenengröße kompilieren
Weitere Fundstellen: `CameraRig.ts:1060`, `CameraRig.ts:915`.
`#writeOtherKind()` setzt die Kamera der anderen Art für `precompile()` über die Fokus-Distanz: die Projektionsebene, sonst `#focus`. `#focus` setzt aber nur `moveTo({focus})`; vor dem ersten Linsenwechsel ist es `NaN`, `distance` bleibt 0, und eine perspektivische Kamera wird zur orthographischen mit der Höhe `2 · rest.near · tan(fov/2)` — bei `near` 0.1 und 50° rund 0.09 Einheiten. Genau das ist der dokumentierte Ablauf (`await rig.precompile()` beim Start, `moveTo(…, {focus})` später) auf einer Stage mit `CameraProjection` (ohne Ebene), dem Anwendungsfall `.glb`. `Renderer#compileAsync()` von three 0.187 läuft über `StandardDrawingPipeline#project()` und verwirft per `isCulled()` jedes Mesh mit `frustumCulled === true` außerhalb des Frustums — die Meshes einer geladenen Szene werden also größtenteils nicht kompiliert, und der erste Frame des Linsenwechsels baut doch Shader (Hitch). Die Sprites der Library setzen `frustumCulled = false` und sind nicht betroffen.
Beleg: `else if (!Number.isNaN(this.#focus)) distance = this.#focus;` … `shot.lens = 2 * Math.max(distance, rest.near) * shot.lens;`
Empfehlung: `precompile(renderer, {focus?})` annehmen oder ohne Ebene und ohne Fokus auf eine sinnvolle Distanz zurückfallen (etwa die Bounding Sphere der Szene oder die Distanz zum Ursprung der Szene) statt auf `near`; Verhalten im Guide (Abschnitt »No hitch on the swap«) festhalten und einen Spec mit `CameraProjection` und einem `frustumCulled`-Mesh abseits der Achse ergänzen.
Abweichung: nur der Rückfall, keine Option — Grund in »Entscheidungen in Zug 0«, Punkt 5.

**READ-001 · medium · packages/twopoint5d/src/stage/CameraRig.ts:200** — Zustand von `CameraRig` und `DisplayFullscreen` als explizites Modell statt als Flag-Kombination führen (hier nur der Rig-Teil; `DisplayFullscreen` gehört Paket 10)
Weitere Fundstellen (Rig): `CameraRig.ts:240`, `:1677`, `:1723`, `:1485`, `:1517`.
`CameraRig.ts` (1744 Zeilen, rund 50 `#`-Felder) leitet seinen Modus — Pose, gehaltener Shot, Move, Lock-on, Track, Flight — aus Kombinationen von `#moving`, `#fromPending`, `#holding`, `#follows`, `#targetPlaced`, `#track`, `#flight` u. a. ab, und `#refusesLook()`, `#shownShot()`, `#resolveTarget()` und `busy` tun das jeweils selbst. Der Rückweg aus einem Flight kopiert 17 Felder von Hand in `SavedState` und von Hand zurück: ein neues Zustandsfeld muss an drei Stellen nachgezogen werden, ein vergessenes fällt erst bei einem abgebrochenen Flight auf. (Der Teil zu `DisplayFullscreen` steht im Audit und gehört Paket 10.)
Empfehlung (Rig): Im Rig den Zielzustand (Pose, Look, Hold, Target samt Rest, Follow, Track, Focus) in ein Objekt mit `copy()` bündeln, das `SavedState` ersetzt und beim Flight als Ganzes gesichert wird; den Modus als ein Feld oder diskriminierte Union führen.

**BUG-005 · low · packages/twopoint5d/src/controls/PanControl2D.ts:778 (jetzt :798-803)** — Keyup nur für ein Feld wirken lassen, das eine Taste angehoben hat
`#onKeyUp` setzt das Speed-Feld der Taste auf 0, ohne zu prüfen, ob `#keyedSpeeds` es hält. Ein Keydown, das die Control verworfen hat — getippt in ein `input`, mit Ctrl/Meta/Alt —, kommt trotzdem mit seinem Keyup an und nullt ein Feld, das der Caller von Hand gesetzt hat (JSDoc von `speedNorth`: »set by hand, it moves the view in every update«). Beispiel: Ein Spiel scrollt per `speedEast = 40` automatisch, der Spieler tippt »d« in ein Chat-Feld — der Auto-Scroll steht.
Beleg: `const field = this.#speedFieldFor(event); if (field == null) return; this[field] = 0;`
Empfehlung: Nur zurücksetzen, wenn `this.#keyedSpeeds.delete(field)` true liefert; das erhält den dokumentierten Fall »its keyup still lets go of a key held before« und schützt von Hand gesetzte Werte.

**BUG-006 · low · packages/twopoint5d/src/stage/StageTransition.ts:232** — Nicht endliches deltaTime in StageTransition#advance() abfangen
Weitere Fundstelle: `StageTransition.ts:223`.
`#advance()` rechnet `deltaTime` ungeprüft in `#elapsed` und `#waited`. Ein `NaN` — etwa vom ersten Frame einer eigenen Schleife, die `StageDirector#updateFrame()` direkt aufruft — macht `#elapsed` und `#progress` dauerhaft zu NaN: `elapsed >= duration` wird nie wahr, die Transition endet nie, `finished` resolved nie, und die Masken tragen NaN in ihren Uniform. `PanControl2D#update()` fängt genau diesen Fall ab (»a delta time the first frame of a loop may lack must not turn the view into NaN for good«), die Transition nicht.
Beleg: `const elapsed = this.#elapsed + deltaTime * this.#direction;`
Empfehlung: Wie in `PanControl2D#update()` ein nicht endliches oder negatives `deltaTime` als 0 zählen (`Number.isFinite(dt) && dt > 0 ? dt : 0`).
Abweichung: dieselbe Wirkung als Vergleich statt `Number.isFinite()` — Grund in »Entscheidungen in Zug 0«, Punkt 4.

**API-002 · low · packages/twopoint5d/src/stage/CameraRig.ts:1645** — Ziel von `CameraRig.across()` in Meldungen als `to` benennen
Weitere Fundstellen: `cameraPose.ts:105`, `CameraRig.ts:1659`.
`CameraRig.across()` liest `options.to` über `#readFlightEnd()`/`#takeFlightTarget()` → `#readTarget()` → `readPose()` ohne `path`. Die Meldungen nennen das Feld deshalb wie bei `jump()`: `CameraRig.across(): target must be a CameraPose, a camera, a projection or an Object3D, got 5` oder `CameraRig.across(): position[0] must be a finite number …` — die Option heißt aber `to`, ein Parameter `target` existiert dort nicht.
Empfehlung: `#readTarget()` einen optionalen `path` durchreichen lassen und `across()` mit `'to'` aufrufen, sodass die Meldungen `to must be …` und `to.position[0] must be …` lauten; im Spec von `across()` eine Meldung festhalten.

**CONS-002 · low · packages/twopoint5d/src/stage/CameraRig.ts:980** — Driver-Methoden des `CameraRig` hinter das Internals-Muster legen
Weitere Fundstellen: `CameraRig.ts:1012`, `CameraRig.ts:1026`.
`placeBase()`, `compose()` und `write()` sind zur Laufzeit öffentliche Methoden der exportierten Klasse `CameraRig`, nur per `@internal` und `stripInternal` aus den Typen genommen. `Stage2D` und `StageTransition` legen ihre internen Zugriffe dagegen in `Stage2DInternals`/`StageTransitionInternals` (`Stage2D.ts:65`), die über `#`-Member gehen. Ein Aufruf von außen — JavaScript, ein Cast — etwa `rig.placeBase(otherProjection)` überschreibt `#rest` und `#containerSize` des Rigs ohne die Stage; die AGENTS-Regel zu privaten Membern zielt gerade darauf, dass Internes zur Laufzeit nicht erreichbar ist.
Empfehlung: Die drei Methoden als `#`-Methoden führen und der Stage über ein `CameraRigInternals`-Objekt (oder einen Driver-Adapter, den `attachDriver()` bekommt) zugänglich machen, wie es `Stage2DInternals` vormacht.

**Offene Frage 2** (Audit) — »Folgt der `CameraRig` einem `Object3D` auf einer Stage mit `CameraProjection` ohne Ebene, stellt er die Kamera auf Welt-x/y des Objekts, bei Tiefe und Ausrichtung des Rests — bei einer schräg blickenden glTF-Kamera liegt das Objekt dann nicht in der Bildmitte. Ist das so gewollt?«
Entscheidung (Plan, 2026-11-17): Das Objekt soll in der Bildmitte liegen, auch bei einer schräg blickenden glTF-Kamera. Der aktuelle Stand ist ein Fehler und wird in Paket 4 behoben.

**Offene Frage 3** (Audit) — »Wirft ein Listener am Ende eines Flights, der über `transition.finished.then()` statt im Frame einer Stage endet, landet der Fehler als Unhandled Rejection. Der Code kommentiert das als gewollt — ist das für Nutzer der Library der richtige Fehlerweg, oder soll er über ein Error-Event des Rigs laufen?«
Entscheidung (Plan, 2026-11-17): Bleibt Unhandled Rejection und wird im Guide des Camera Rig ausdrücklich dokumentiert; ein Error-Event gibt es nicht.

## Urteil des Reviewers

Review 0 (`paket-4.review-0.json`) und gezielte Nachprüfung nach Runde 1 (`paket-4.review-1.json`), Stand Commit 92ed8863:

| Finding | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-001 | behoben | Klemme `e > 0 ? (e < 1 ? e : 1) : 0` in `utils/easing.ts` (`applyEasingInPlace()`); `StageTransition#advance()` über den Slot `easedProgress`; `applyEasing()` entfernt |
| BUG-002 | behoben | dritter Zweig in `CameraRig#writeOtherKind()` über `cullingSphereOf()` (`stage/cullingSphere.ts`), Regel wie `Frustum#intersectsObject()` in three 0.187 |
| READ-001 (Rig) | behoben | `stage/cameraRigState.ts` (`mode`, `copy()`), `SavedState` entfernt, Sichern/Wiederherstellen in `#takeFlightTarget()`/`#leaveFlight()`; Moduswechsel gegen die alten Flags nachgerechnet, äquivalent |
| BUG-005 | behoben | `PanControl2D#onKeyUp` setzt nur zurück, wenn `#keyedSpeeds.delete(field)` true liefert |
| BUG-006 | behoben | `StageTransition#advance()`, `dt` als Vergleich, greift auch beim Warten auf `delay` |
| API-002 | behoben | `kindOfTarget(…, path)` in `cameraTarget.ts`, `'to'` an allen drei Aufrufen aus `across()` |
| CONS-002 | behoben | `#placeBase()`/`#compose()`/`#write()`, Adapter mit `bind()`, `rigOfDriver`, `CameraRigInternals`; Spec `'placeBase' in rig === false` |
| Offene Frage 2 | behoben (nach Runde 1) | Follow-Frame in `cameraRest.ts`, `writeFollowPosition()`/`resolveFollowShot()` in `cameraTarget.ts`; Tiefe beim erneuten Anvisieren über `readObjectPose(…, followed)` |
| Offene Frage 3 | behoben | TSDoc von `CameraRig.across()` und Guide `stages.md` (»A flight across a transition«) |

Kleine Befunde (lösen keine Runde aus):
- `cullingSphere.ts` lässt `isSprite` aus; three 0.187 verwirft auch `Sprite` mit `frustumCulled === true` (`StandardDrawingPipeline.js:204-206`), eine Szene nur aus three.js-Sprites fällt ohne Ebene weiter auf `near` zurück. Die Sprites der Library setzen `frustumCulled = false`. Ein Satz im TSDoc würde reichen.
- `CameraRig#takeFlightTarget()`: läuft ein Move zu einem Objekt und kommt `across({to: object})` dazu, liest die Stelle das Ziel nach `#hold()` erneut mit `followed === false`; wirkt nur vor dem ersten Frame der Stage (ohne Rest). Kein Handlungsbedarf laut Reviewer.

## Nebenbefunde

- `display/hot-path-allocations.adaptive-resolution.spec.ts:83-93` flackert unter `run-many` (2 von 4 Läufen, 16.02 B je Aufruf), allein grün. Importiert nichts aus diesem Paket. Urteil `→ Scope` (Scope-Regel: alles). Herkunft nicht geklärt: Spec vorbestehend, Code darunter in Paket 3 geändert — deshalb mit Prüfhinweis in »Offene Befunde«, die Drain-Runde bzw. der nächste Zug 0 ordnet ein.
- Ungeprüfter Hinweis des Implementierers: der erste `pnpm test:allocations` nach Quelländerungen meldete einmal `Cache: 1/1 hit`. Ohne Fundstelle, nicht in die Queue übernommen.
