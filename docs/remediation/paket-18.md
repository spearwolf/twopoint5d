# Paket 18 — Abschluss: offene Reviewer-Anmerkungen im Code

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — 22 Reviewer-Anmerkungen der Schwere klein aus den Paketen 4, 5, 6, 6b,
  7, 8, 10, 11, 11b, 11c, 13, 14, 15, 17, an HEAD 3b37c02d offen (Folgen, Liste mit Volltext unten)
- Folge von: Pakete 4–17
- Ziel: Jede genannte Stelle ist behoben oder mit Grund in der Paketdatei als kein Befund
  eingeordnet; Defekte bekommen einen Test zuerst.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/stage/` — `cullingSphere.ts`, `cullingSphere.spec.ts`, `StageDirector.ts`,
    `StageDirector.spec.ts`, `Stage2DCamera.ts`, `Stage2D.ts`, `Stage2D.spec.ts`, `directorSlots.ts`,
    `planeProjection.ts`
  - `packages/twopoint5d/src/vertex-objects/` — `VertexObjectPool.ts`, `VertexObjectPool.sortBy.spec.ts`,
    `README.md`
  - `packages/twopoint5d/src/sprites/SpritePicker.ts`
  - `packages/twopoint5d/src/display/` — `DisplayFullscreen.ts`, `DisplayFullscreen.spec.ts`,
    `DisplaySizer.ts`, `AdaptiveResolution.ts`
  - `packages/twopoint5d/src/texture/` — `SharedImageCache.ts`, `SharedImageCache.spec.ts`,
    `FrameBasedAnimations.ts`, `TileSet.ts`, `TextureStore.ts`
  - `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts`
  - `packages/twopoint5d/docs/proposals/display-fullscreen.md` (§6.2), `packages/twopoint5d/docs/proposals/pool-sorting.md` (§2.2)
  - `packages/twopoint5d/CHANGELOG.md` — nur zwei bestehende Unreleased-Einträge an Ort und Stelle (`:35`, `:87`)
  - `apps/lookbook/src/demos/utils/demoParts.spec.ts`, `apps/lookbook/src/demos/utils/demoInit.ts`
- Nicht anfassen: `loadCatalog.ts` (kein Befund, siehe A8), jede Datei unter `docs/` außerhalb der
  zwei Proposals (die Doku-Anmerkungen trägt Paket 19), `public-api.ts`.
- Verify: `pnpm run ci`
- Commit: `fix: count three.js sprites into the sphere a precompile without a projection plane aims at, refuse a releaseSortScratch() from the key function of a running sortBy(), read the state of a Stage2D in its camera as the stage reads it, let a refused fullscreen request that a turn joined enter the pseudo mode where native fullscreen is gone, and settle the comments, TSDoc and specs reviews left behind`
- Verlauf:
  - 2026-11-18 Zug 0: Detailplan steht · alle 22 Fundstellen an HEAD 3b37c02d nachgesehen, keine
    gegenstandslos · verschoben: `StageDirector.ts` `#release()` `:1375–1413` (Anmerkung nannte
    `:1872`), `SpritePicker.ts:420`, `DisplayFullscreen.ts:1012` (`#rearm()`), `SharedImageCache.ts:20`,
    `StageDirector.ts:1615`, `TextureStore.ts:1136` (`on()`), `RepeatingTilesProvider.ts:52–58` ·
    umgeformt: `Stage2DCamera`-Lesewege — gegen `8d624eec` belegt, dass Paket 11b drei Lesewege
    geändert hat (Fix statt Doku) · kein Befund: `loadCatalog` ohne eigene Spec (A8) · Schnitt: ein
    Paket, nicht geteilt (Grund unten) · keine weiteren offenen Folgen, »Offene Befunde« leer ·
    Restplan: 19 bleibt hinter 18, Hinweis zu gemeinsamen Dateien an Paket 19
  - 2026-11-18 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort medium, Report nach `paket-18.impl-0.json`
  - 2026-11-18 Zug 2: Report FERTIG, 27 Dateien geändert, rote Läufe A1, A3, A4×3, A6×2 und grüner A2 belegt; selbst gemeldet offen: Satz in `docs/proposals/display-fullscreen.md` §6.2 fehlt, geänderte Dateien nicht ganz gelesen · Verify noch nicht gelaufen
  - 2026-11-18 Zug 4 Runde 1: beide Punkte per Resume an denselben Implementierer (sonnet, medium), Report nach `paket-18.impl-1.json`
  - 2026-11-18 Zug 4 Runde 1 zurück: FERTIG_MIT_VORBEHALT, Proposal-Satz §6.2 ergänzt (28 Dateien), Nebenbefunde gemeldet, Specs nicht ganz gelesen · Verify `pnpm run ci` exit=0 (`paket-18.verify.log`)
  - 2026-11-18 Zug 3: Reviewer (sonnet, medium) — A1–A7, A9, B1–B12 erfüllt, A8 kein Befund, 0 kritisch, 0 wichtig, 2 klein · Diff `paket-18.diff` (1645 Zeilen), Report `paket-18.review-0.json`
  - 2026-11-18 Zug 5: committet 11b53b5a (28 Dateien, Trailer `Remediation-Run: 2026-11-17`), Verify aus Zug 4 Runde 1 trägt (keine Änderung danach) · Nebenbefunde `Stage2D.ts:747, 778` → Queue · Folgen `FrameBasedAnimations.ts:600–606`, `planeProjection.ts:117, 121` → `Folgen:` im Plan

## Entscheidungen aus Zug 0

- **Ein Paket, nicht 18/18b.** Neun Punkte ändern Verhalten oder Specs (Teil A), dreizehn sind
  Kommentar und TSDoc mit wörtlich vorgegebenem Text (Teil B). Eine Teilung kostete einen ganzen
  Zug 0, Implementierer und Reviewer für dreizehn Ein- bis Dreizeiler, und `Stage2DCamera.ts` läge
  in beiden Teilen. Der Reviewer prüft Teil B Zeile für Zeile gegen den Text unten.
- **`cullingSphere.ts`: Code statt Doku-Satz.** Der Reviewer von Paket 4 hielt einen TSDoc-Satz für
  ausreichend. Der Unreleased-Eintrag `CHANGELOG.md:27` und `docs/stages.md:667` versprechen aber
  schon »the middle of the objects of the scene that three.js culls by its frustum« — three 0.187
  cullt auch `Sprite` (`StandardDrawingPipeline.js:205–207`, `Sprite#intersectsFrustum()` →
  `Frustum#intersectsSprite()`, `Frustum.js:174–185`). Der Code holt die Zusage ein; der
  CHANGELOG-Eintrag bleibt, wie er ist (die Entscheidung vom 2026-11-17 »Code-Fix vor Doku-Vermerk«
  in derselben Richtung).
- **`Stage2DCamera`: die Lesewege von vor Paket 11b wiederherstellen.** Belegt mit
  `git show 8d624eec:packages/twopoint5d/src/stage/Stage2D.ts`: dort las die Stage für die
  Dispose-Prüfungen `this.#disposed` (`:331, 341, 357, 380, 395`), für `#buildsKindOf()` beim Lösen
  des Drivers `this.#projection` (`:366`), für die `!= null`-Prüfung der Projektion den Getter
  `this.projection` (`:341, 380`) und in `#updateCamera()` den Getter `this.camera` (`:308–315`).
  Heute liest `Stage2DCamera` `stage.isDisposed`, `stage.projection` und das private `current`.
  Paket 11b versprach unverändertes Verhalten; `Stage2D` ist öffentlich und ableitbar
  (`Stage2D.spec.ts:43` leitet selbst ab). Also kein Dokumentieren der Abweichung, sondern zurück
  auf die alten Lesewege, mit einem roten Test je Leseweg. Kein CHANGELOG: 0.25.0 las so.
- **`#rearm()` folgt dem `onLandscape`-Setter.** Nach einer Ablehnung steht der Controller in
  `'idle'`, im Querformat, mit offenem Gate — derselbe Stand, in dem der Setter (`:407`) und der
  Turn-Handler (`:999–1003`) bei `isSupported === false` nichts spannen und mit
  `fallback: 'pseudo'` den Pseudo-Modus betreten. Die Zusage von Paket 10 »the pseudo mode is
  entered from 'idle' only« bleibt gewahrt. Kein CHANGELOG: im Browser unerreichbar
  (`document.fullscreenEnabled` kippt nicht während eines Requests), und das Phasenmodell aus
  Paket 10 trägt keinen Eintrag.
- **`sortBy()` prüft nach der Key-Schleife, ob sein Scratch noch derselbe ist**, statt
  `releaseSortScratch()` während eines Sorts zu einem No-op zu machen: das ist das Muster der
  vorhandenen Prüfung von `usedCount` (`keyFunctionChangedPoolError()`), die Projektregel »Invalid
  input is refused« (AGENTS.md), und es fängt auch ein `prepareSortKeys()` oder ein verschachteltes
  `sortBy()` aus der Key-Funktion.
- **Verschachtelter `AggregateError` aus `#release()`: festhalten, nicht flachklopfen.** Ein
  `AggregateError` aus `StageRenderer#remove()` lässt sich von einem, den ein Listener selbst wirft,
  nicht unterscheiden; Auspacken verlöre dessen Meldung. Der Test hält die Form fest
  (Charakterisierung, kein Bugfix — er ist von Anfang an grün), TSDoc und der Unreleased-Eintrag
  sagen sie.
- **`SpritePicker#place()`: `finally` ohne Test.** Zwischen Füllen und Leeren des Scratch wirft
  heute nichts (`readAncestry()` liest nur, `parent.add()` hängt eigene Gruppen an); das `finally`
  macht die Freigabe der Gruppen von diesem Urteil unabhängig und kostet auf dem Pick-Pfad keine
  Allokation. Ohne werfenden Pfad gibt es keinen roten Lauf.
- **Breite einer Kommentarzeile.** Biome bricht Kommentare nicht um (`biome.jsonc:33`,
  `lineWidth: 130`). Wo dieser Plan »umbrechen« sagt: Absatz neu auf höchstens 100 Zeichen, wie die
  Nachbarn, Wörter unverändert, sofern der Schritt keinen neuen Wortlaut vorgibt.

## Vorgehen

Teil A zuerst, je Punkt mit Spec: Test schreiben, rot laufen lassen (Ausgabe in den Report), dann
der Fix. Ein Vitest-Lauf einer Datei: `pnpm nx test twopoint5d -- src/<pfad>.spec.ts`, im Lookbook
`pnpm nx test lookbook -- src/demos/utils/demoParts.spec.ts`.

### Teil A — Verhalten und Specs

**A1. `stage/cullingSphere.ts` zählt three.js-Sprites.**

1. Test zuerst, `stage/cullingSphere.spec.ts`, im `describe('cullingSphereOf()')`, `Sprite` aus
   `three/webgpu` importieren:
   - `it('takes the sphere three.js culls a sprite by, around its position and grown by its center', …)`:
     Szene mit `new Sprite()` bei `position.set(3, 0, 0)` → Mitte `(3, 0, 0)`, Radius
     `toBeCloseTo(0.7071067811865476, 12)`; ein zweiter `new Sprite()` allein in einer neuen Szene mit
     `center.set(0, 0)`, `scale.set(2, 2, 1)` bei `(0, 0, 0)` → Mitte `(0, 0, 0)`, Radius
     `toBeCloseTo(2 * (0.7071067811865476 + Math.SQRT1_2), 12)`.
   - `it('leaves out a sprite three.js does not cull by its frustum', …)`: `new Sprite()` mit
     `frustumCulled = false` → `isEmpty()` ist `true`.
   Vor dem Fix ist der erste Fall rot (leere Kugel).
2. Fix: im Interface `Culled` `isSprite?: boolean;` und `center?: Vector2;` ergänzen (`Vector2` als
   Typ importieren). Modulweit `const SPRITE_CENTER = new Vector2(0.5, 0.5);` neben `sphere`. In der
   Bedingung `:27` `object.isSprite === true` zur Liste nehmen. Vor dem Zweig `boundingSphere`
   einen Zweig für Sprites, nach `Frustum#intersectsSprite()` in three 0.187:
   ```ts
   if (object.isSprite === true) {
     // Frustum#intersectsSprite(): a sphere of radius √½ about the origin of the sprite, grown by
     // how far its center lies from the middle of the quad
     sphere.center.set(0, 0, 0);
     sphere.radius = Math.SQRT1_2 + SPRITE_CENTER.distanceTo(object.center!);
   } else if (object.boundingSphere !== undefined) {
   ```
   (der bestehende `boundingSphere`-/`geometry`-Teil wird zum `else if`/`else`, `applyMatrix4` und
   `union` danach bleiben für alle).
3. Kommentar `:3–4` und TSDoc `:16–21` nachziehen: »… of every visible mesh, line, points object and
   sprite whose `frustumCulled` is `true`; a sprite counts with the sphere
   `Frustum#intersectsSprite()` tests.« Kommentar über `Culled`: »what `Frustum#intersectsObject()`
   and `Frustum#intersectsSprite()` read of an object: …«.

**A2. `StageDirector#release()`: der verschachtelte `AggregateError` ist getestet und beschrieben.**

1. Test in `stage/StageDirector.spec.ts` direkt hinter dem Fall `keeps both errors when listeners
   throw as the director lets go of a stage it wrapped and disposes the wrapper` (`:1159`), gleicher
   Aufbau, Name `keeps the AggregateError of the remove as one error beside the one of the dispose
   of the wrapper`: zusätzlich `on(director, OnStageRemoved, () => { throw removed; })` mit
   `const removed = new Error('stageRemoved')`. Erwartet: `thrown` ist `AggregateError` mit der
   Meldung des Director (`… let go of the stage "world"`, wie `:1180–1182`), `errors.length === 2`,
   `errors[1] === second`; `errors[0]` ist `AggregateError` mit der Meldung
   `'StageRenderer#remove(): more than one listener of OnStageRemoved and OnRemoveFromParent threw'`
   und `errors` gleich `[removed, first]`; `director.stack` ist `[]`. Ohne Casts: nach
   `expect(thrown).toBeInstanceOf(AggregateError)` mit
   `if (!(thrown instanceof AggregateError)) expect.unreachable();` verengen, ebenso für `errors[0]`.
   Charakterisierung: der Test ist vor jeder Änderung grün; das gehört so in den Report.
2. TSDoc von `#release()` (`:1370–1374`) ergänzen: »… one unchanged, several as an
   `AggregateError`. Where several listeners throw on the remove from the base, their
   `AggregateError` is one error of it, beside the error of the dispose of a wrapper.«
3. `packages/twopoint5d/CHANGELOG.md:87` (Unreleased, `### Fixed`) am Ende ergänzen: »…, both reach
   the caller, as an `AggregateError`; where several listeners throw as the stage leaves, their
   `AggregateError` is one error of it«.

**A3. `VertexObjectPool#sortBy()` lehnt ein `releaseSortScratch()` aus der Key-Funktion ab.**

1. Test zuerst, `vertex-objects/VertexObjectPool.sortBy.spec.ts`, im
   `describe('VertexObjectPool#releaseSortScratch()')` (`:666`), Name `a call from the key function
   of a running sortBy() makes that sort throw, naming sortBy(), and moves nothing`:
   `const {pool} = makeThings([2, 1, 0]);`, Key-Funktion, die beim ersten Aufruf
   `pool.releaseSortScratch()` ruft und den Key aus dem Vertex-Objekt liest wie die Nachbarfälle;
   `expect(() => pool.sortBy(key)).toThrow(new Error('VertexObjectPool#sortBy(): the key function let go of the scratch of the sort through releaseSortScratch() — call it before or after the sort, not inside the key function'))`;
   danach `idsInSlotOrder(pool)` gleich `[0, 1, 2]`, und ein `pool.sortBy(key)` ohne Freigabe
   antwortet `true` und ordnet `[2, 1, 0]`; `pool.dispose()`. Vor dem Fix rot mit einem rohen
   `TypeError` aus `#sortByOwnKeys()`.
2. Fix in `VertexObjectPool.ts`: neben `keyFunctionChangedPoolError()` (`:52`)
   `function keyFunctionReleasedScratchError(): Error` mit genau der Meldung oben. In `sortBy()`,
   Zweig Key-Funktion, nach der bestehenden Prüfung hinter der Schleife (`:477`):
   `if (this.#sortKeys !== keys) throw keyFunctionReleasedScratchError();` mit dem Kommentar
   »// a key function that let go of the scratch — or built another — leaves the keys of this sort
   in an array the pool no longer holds«.
3. TSDoc: an `sortBy()` im `@throws` nach dem Satz über das Erzeugen und Freigeben ergänzen: »…, and
   when the key function calls {@link releaseSortScratch}: the sort has moved nothing then.« An
   `releaseSortScratch()` (`:545–554`) als letzten Satz: »Called from the key function of a running
   {@link sortBy}, it makes that sort throw.«
4. Doku mitziehen: `src/vertex-objects/README.md:259` »… and must not create or free objects of the
   pool« → »… and must not create or free objects of the pool, nor call `releaseSortScratch()`«
   (Absatz neu umbrechen). `docs/proposals/pool-sorting.md` §2.2, nach dem zitierten Fehler `:92`
   einen Absatz: »Nor may it call `releaseSortScratch()`: after the last key `sortBy()` checks that
   its keys are still the scratch of the pool, and refuses otherwise:« mit der Meldung als
   Zitatblock wie `:92`. `CHANGELOG.md:35` (Unreleased, `### Added`) vor »(see …)« ergänzen: »; called
   from the key function of a running `sortBy()`, it makes that sort throw, and nothing moves«.

**A4. `Stage2DCamera` liest den Zustand der Stage wie vor Paket 11b.**

1. Tests zuerst, `stage/Stage2D.spec.ts`, im `describe('a camera driver')` (`:1353`, `FakeDriver`
   und `createStage` dort), je einer pro Leseweg, alle vor dem Fix rot:
   - `it('announces a change of camera by what stage.camera answers, also where a subclass overrides the getter', …)`:
     `class Pinned extends Stage2D { pinned?: Camera; override get camera(): Camera | undefined { return this.pinned ?? super.camera; } override set camera(camera: Camera | undefined) { super.camera = camera; } }`;
     `new Pinned(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}))`,
     `resize(800, 600)`, `stage.pinned = new PerspectiveCamera()`, Spy auf
     `OnStageAfterCameraChanged`, `Stage2DInternals.attachDriver(stage, new FakeDriver([]))` →
     der Spy wurde nicht gerufen.
   - `it('takes a driver by whether the stage itself is disposed, also where a subclass overrides isDisposed', …)`:
     `class Closing extends Stage2D { closing = false; override get isDisposed(): boolean { return this.closing || super.isDisposed; } }`;
     Stage wie oben, `closing = true`, `attachDriver()` wirft nicht, und `stage.camera` ist
     `driver.camera`.
   - `it('drops an assigned camera by the projection the stage holds, also where a subclass answers another one', …)`:
     `class Shown extends Stage2D { shown?: IProjection; override get projection(): IProjection | undefined { return this.shown ?? super.projection; } override set projection(projection: IProjection | undefined) { super.projection = projection; } }`;
     Aufbau wie `drops an assigned camera of another kind than the projection builds, with a
     warning` (`:1639`): Stage mit `OrthographicProjection`, `stage.camera = new OrthographicCamera()`,
     Driver anhängen, `stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640})`,
     dann `stage.shown = new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640})`,
     `Stage2DInternals.detachDriver(stage)` → `console.warn` genau einmal (die Stage hält die
     `ParallaxProjection`); Spy auf `console.warn` wie dort, mit `try`/`finally` und `mockRestore()`.
2. Fix: `Stage2DCameraHost` (`Stage2DCamera.ts:25–31`) bekommt
   ```ts
   /** Whether the stage is disposed, read past a subclass that overrides `isDisposed`. */
   disposed(): boolean;
   /** The projection the stage holds, read past a subclass that overrides the getter of `projection`. */
   projection(): IProjection | undefined;
   ```
   Im Host-Literal in `Stage2D.ts:250–262` `disposed: () => this.#disposed,` und
   `projection: () => this.#projection,`. In `Stage2DCamera.ts`:
   - `this.#stage.isDisposed` → `this.#host.disposed()` an allen fünf Stellen (`:119`, `:129`,
     `:145`, `:168`, `:183`);
   - `:153` `Stage2DCamera.#buildsKindOf(this.#stage.projection, assigned)` →
     `Stage2DCamera.#buildsKindOf(this.#host.projection(), assigned)`;
   - `this.#stage.projection != null` in `:129` und `:168` bleibt (las vor 11b den Getter);
   - `#updateCamera()` (`:193–212`): `this.current` → `this.#stage.camera` an allen drei Stellen
     (`prevCamera`, Vergleich, `const camera`), mit dem Kommentar »// the camera as stage.camera
     answers it, a getter a subclass may override«.
   `.d.ts` von `Stage2D` bleibt unverändert (das Host-Literal ist ein `#private`-Feld).

**A5. `SpritePicker#place()` leert den Scratch im `finally`.** In `sprites/SpritePicker.ts:391–421`
den Rumpf ab `const groupOrder = readAncestry(…)` in `try { … } finally { applied.length = 0; }`
setzen; der Kommentar `:418–419` wandert mit vor das `applied.length = 0` im `finally` und bekommt
den Zusatz »— also where a step of the placement throws«. Kein Test (Grund oben).

**A6. `DisplayFullscreen#rearm()` spannt nur, wo nativer Fullscreen da ist.**

1. Tests zuerst, `display/DisplayFullscreen.spec.ts`, direkt hinter `a turn to landscape while a
   request is under way joins that request, and enters no pseudo mode beside it` (`:2475`), gleicher
   Aufbau mit `answer.refuse()` statt `answer.grant()`; die Ablehnung des `request()` der Seite so
   abwarten, wie die Ablehnungsfälle der Datei es tun (`outcomeOf()`, `nextTask()`):
   - `it('a turn that joined a request the browser refuses enters the pseudo mode where native fullscreen is gone by then, and arms nothing', …)`:
     `make({fallback: 'pseudo', onLandscape: true})` → danach `fs.mode` ist `'pseudo'`,
     `fs.isArmed` ist `false`, `defaultTarget.listenerCount('pointerup')` ist `0`.
   - `it('a turn that joined a request the browser refuses arms nothing where native fullscreen is gone by then', …)`:
     `make({onLandscape: true})` → `fs.isArmed` `false`, `fs.isActive` `false`,
     `defaultTarget.listenerCount('pointerup')` `0`.
   Vor dem Fix sind beide rot (`isArmed` ist `true`).
2. Fix `#rearm()` (`:1012–1024`): die Bedingung bleibt, ihr Rumpf wird
   `if (this.isSupported) this.#arm(); else if (this.fallback === 'pseudo') this.#enterPseudo('landscape');`.
   Kommentar über `#rearm()` (`:1009–1011`): »a refusal arms — or, where native fullscreen is gone by
   then, enters the pseudo mode as a turn in 'idle' does —, unless …«.
3. TSDoc des `onLandscape`-Getters (`:383–386`): »Switched on while the browser is still answering a
   request or an exit, it arms once that answer is in — or enters the pseudo mode, where native
   fullscreen is no longer supported by then and `fallback` is `'pseudo'` — where the screen is …«.
4. `docs/proposals/display-fullscreen.md` §6.2, an Schritt 2 (»… the user has not left in
   landscape (§6.3).«) anhängen: »A refusal that finds native fullscreen gone by then —
   `isSupported` answers `false` — arms nothing; with `fallback: 'pseudo'` the controller enters
   the pseudo mode instead, as a turn in `'idle'` does.«

**A7. `texture/SharedImageCache.spec.ts` wartet auf einen Task statt auf acht Microtasks.**
`settleMicrotasks` (`:24–26`) ersetzen durch
```ts
// a task runs once every microtask queued before it, and every one those queue, has run: the
// releases and the clean-up of a failed load are through then, however long their chain
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
```
und die sieben Aufrufe auf `await nextTask();` umstellen (Muster `DisplayFullscreen.spec.ts:153`).
Alle Fälle bleiben grün.

**A8. `loadCatalog` ohne eigene Spec — kein Befund.** Paket 6b hat das entschieden
(`docs/remediation/paket-6b.md`, Abschnitt READ-007): sein Vertrag ist der von
`TextureStore#loadAsync()`, und `TextureStore.spec.ts` hält jeden Pfad des Moduls — bereits
abgebrochenes Signal `:783`, Abbruch per Signal `:816`, keine Listener am Signal des Aufrufers
danach `:866`, die Ablösung durch ein späteres `loadAsync()` `:938`, das `describe('loadAsync()')`
ab `:618`. Eine zweite Suite gegen die Hooks hielte dieselben Pfade über einen nachgebauten Store.
Nichts zu tun.

**A9. `apps/lookbook/src/demos/utils/demoParts.spec.ts:96–100` ohne Casts.** Nach
`expect(caught).toBeInstanceOf(AggregateError);` die Zeile
`if (!(caught instanceof AggregateError)) expect.unreachable();` und in den beiden Erwartungen
`(caught as AggregateError).message` → `caught.message`, `(caught as AggregateError).errors` →
`caught.errors`.

### Teil B — Kommentare und TSDoc, Wortlaut vorgegeben

**B1. `texture/SharedImageCache.ts:20` — TSDoc an `acquire()`:**
```ts
  /**
   * Leases the image of `url`: the first lease of a url starts its load, every later one shares it.
   * `release()` gives the lease back once — a second call does nothing —, and the image is given up
   * a microtask after its last lease came back. A load that fails is forgotten, so the next lease of
   * its url loads anew.
   */
```

**B2. `display/DisplaySizer.ts:286–289` — Zeilenkommentar und TSDoc über `resize()` zu einem TSDoc:**
```ts
  /**
   * Answers whether this call emitted `OnDisplayResize`. `fromFrame` is the call at the start of a
   * frame: that one measures only when the size watch has seen a change, or on the poll path within
   * `resizePollIntervalMs`. A call of your own always measures and leaves the timing of the frames
   * alone.
   */
```
**`:394–397`** — dasselbe über `stopWatch()`:
```ts
  /**
   * Takes the size watch and the fullscreenchange listener of `watchFullscreen()` down. The display's
   * `dispose()` calls it directly, so a constructor that throws after `startWatch()` takes the watch
   * down as well.
   */
```

**B3. `display/AdaptiveResolution.ts:455–461`** — die drei Zeilen »a frame a display renders while it
is not running — … paused, its rawDeltaTime is 0« wandern über `if (this.display.isRunning) {`
(`:454`), die vier Zeilen ab »The interval between the animation frames …« bleiben über der
Zuweisung. Wortlaut unverändert.

**B4. Verweis auf `distinctMasks()` mit Datei.** `stage/directorSlots.ts:74` »as `distinctMasks()`
counts them« → »as `distinctMasks()` in `DirectorShapeCache.ts` counts them« (Absatz neu
umbrechen). `stage/StageDirector.ts:1615` »distinctMasks() counts the texture nodes« →
»distinctMasks() in DirectorShapeCache.ts counts the texture nodes«, der dreizeilige Kommentar
`:1613–1615` neu umbrochen.

**B5. `stage/planeProjection.ts`.** `:17–19` (Zeilenkommentar vor dem TSDoc von `DEFAULT_NEAR`):
```ts
/**
 * The near plane of the camera where the specs leave it out, or where their near and far plane
 * leave no depth a camera can be built from; `DEFAULT_FAR` below is the far plane of both cases.
 * @internal
 */
export const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100000;
```
`:84` auf zwei Zeilen: »// assigned by the first fit() that gives a view with an area, through
takeNearAndFar(); a« / »// camera built before that carries none«.

**B6. `stage/Stage2DCamera.ts:29`** — die 175 Zeichen lange TSDoc-Zeile an
`Stage2DCameraHost.updateProjection` als mehrzeiliges TSDoc, Wortlaut unverändert:
»Computes view and camera anew for the container of the last `resize()`; what the projection
throws comes out, what a listener or the driver throws goes into `errors`.« (Neben den zwei
Membern aus A4.)

**B7. `texture/FrameBasedAnimations.ts:607–609`** — »`firstTileId` and `tileCount` are checked only
when they are passed: their defaults come from the tile set, which may hold more tiles than
`MaxTextureSize`.« → »The checks of `firstTileId` and `tileCount` as such run only when they are
passed: their defaults come from the tile set, which may hold more tiles than `MaxTextureSize`.
The range of their ids is checked whatever it comes from.« (Absatz neu umbrechen.)

**B8. `texture/TileSet.ts:62`** — TSDoc der Option `firstId`:
```ts
  /**
   * The `tileId` of the first tile — a whole number that keeps the ids of all tiles, up to
   * `firstId + tileCount - 1`, within ±`Number.MAX_SAFE_INTEGER`. Defaults to 1.
   */
```

**B9. `texture/TextureStore.ts` — `on()` und die Zeilen über 130 Zeichen.**
- TSDoc von `on()` (`:1119–1140`): den Satz »On a store without a renderer, `texture` waits until
  one is set, and the first call of this store that waits so writes a warning to the console.« aus
  dem vierten Absatz (`:1136`) als letzten Satz an den ersten Absatz (`:1120–1122`) hängen; beide
  Absätze neu umbrechen.
- Jede weitere Kommentarzeile der Datei über 130 Zeichen neu umbrechen, Wortlaut unverändert: heute
  `:360` (statisches `loadAsync()`), `:414` (Getter `renderer`, Folgezeile `:415` mit), `:1274`
  (`getAsync()`). Die `biome-ignore`-Zeile `:818` (121 Zeichen) bleibt einzeilig. Abnahme:
  `awk 'length > 130 && /^ *(\*|\/\/)/' packages/twopoint5d/src/texture/TextureStore.ts` ist leer.

**B10. `stage/Stage2D.ts:150–155`** — TSDoc von `containerWidth`, der Satz »A `resize()` whose
projection throws leaves the container the stage had; one where only a listener throws has taken
the new container.« → »A `resize()` whose projection throws — as it fits the view, or as it places
the camera, the base camera of a `CameraRig` included — leaves the container the stage had; one
where only a listener throws, or the `CameraRig` as it composes its camera over the base, has taken
the new container.« Belegt: `placeBase()` wirft im `try` von `#updateProjection()` (`:446–464`,
Rollback), `resize()` stellt den Container zurück (`:364–371`); `compose()` sammelt
`Stage2DCamera#announcePlacement()` in `errors` (`Stage2DCamera.ts:107–113`).

**B11. `map2d/RepeatingTilesProvider.ts:52–58`** — TSDoc des Setters `tileIds` neu umbrechen
(`:56` hat 155 Zeichen), Wortlaut unverändert.

**B12. `apps/lookbook/src/demos/utils/demoInit.ts:3–13`** — TSDoc von `onDemoInit()`: hinter
»… prints the console line with its timeout instead.« den Satz »A demo whose init
`display.start()` awaits goes through {@link startDemo} instead.«

## Abnahme

- Die sieben roten Läufe vor dem Fix (A1, A3, A4 dreimal, A6 zweimal) stehen im Report, dazu der
  grüne Lauf von A2 vor jeder Änderung.
- `awk 'length > 130 && /^ *(\*|\/\/)/'` über `TextureStore.ts`, `Stage2DCamera.ts`,
  `planeProjection.ts`, `RepeatingTilesProvider.ts` ist leer.
- `git grep -n "as AggregateError" apps/lookbook/src/demos/utils/demoParts.spec.ts` ist leer.
- `pnpm run ci` grün (Baseline vollständig grün), die Allocation-Specs eingeschlossen.

## Findings im Volltext

Herkunft je Punkt: die Paketdatei, deren Reviewer ihn meldete. Fundstellen wie gemeldet, die
aktuelle Zeile im Schritt oben.

- **A1 · Paket 4 · `stage/cullingSphere.ts:27`** — »`cullingSphere.ts` lässt `isSprite` aus; three
  0.187 verwirft auch `Sprite` mit `frustumCulled === true` (`StandardDrawingPipeline.js:204-206`),
  eine Szene nur aus three.js-Sprites fällt ohne Ebene weiter auf `near` zurück. Die Sprites der
  Library setzen `frustumCulled = false`. Ein Satz im TSDoc würde reichen.«
- **A2 · Paket 5 · `stage/StageDirector.ts:1872` (heute `#release()` `:1375–1413`)** — »wirft
  `super.remove()` schon einen `AggregateError` und das `dispose()` des Wrappers einen weiteren
  Fehler, entsteht ein verschachtelter `AggregateError` — vom Plan so gewollt, aber ungetestet und
  nicht dokumentiert«
- **A3 · Paket 8 · `vertex-objects/VertexObjectPool.ts:605`** — »ruft eine Key-Funktion von
  `sortBy()` (oder ein dadurch ausgelöster `onCreateVO`-Hook) selbst `releaseSortScratch()` auf,
  liest `#sortByOwnKeys()` `this.#sortKeys!` als `undefined` und endet in einem `TypeError` ohne
  Klassen- und Methodennamen; keine Datenverluste. Abhilfe: Guard wie beim Erzeugen/Freigeben von
  VOs aus der Key-Funktion, oder ein Satz in …«
- **A4 · Paket 11b · `stage/Stage2DCamera.ts:153` (dazu `:119`, `:129`, `:145`, `:168`, `:183`,
  `:194`)** — »drei Lesewege weichen ab — `detachDriver()` liest den überschreibbaren Getter
  `stage.projection` statt `#projection`, die Dispose-Prüfung `isDisposed` statt `#disposed`,
  `#updateCamera()` vergleicht über das private `current` statt den Getter `camera`. Wirkt nur bei
  einer Unterklasse von `Stage2D`, die einen dieser Getter überschreibt (`Stage2D.spec.ts:43` tut es
  für `projection`); die ersten beiden schreibt der Detailplan so vor; keine Spec deckt den Fall.«
- **A5 · Paket 7 · `sprites/SpritePicker.ts:420`** — »Das Leeren von `#clippingScratch` in
  `SpritePicker#place()` steht nicht in einem `finally`; zwischen Füllen und Leeren wirft nach
  Urteil des Reviewers nichts.«
- **A6 · Paket 10 · `display/DisplayFullscreen.ts:992-996`** — »der Regressionstest deckt nur die
  Gewährung ab; wird der beigetretene Request verweigert, spannt `#rearm()` den Tap auch bei
  `isSupported === false`, während der `onLandscape`-Setter (`:407`) dort den Pseudo-Modus betritt.
  Innerhalb der Entscheidung »was auch immer `isSupported` antwortet«, im Browser unerreichbar.«
- **A7 · Paket 6b · `texture/SharedImageCache.spec.ts`** — »`settleMicrotasks` leert pauschal 8
  Microtasks, stille Annahme über die Kettentiefe.«
- **A8 · Paket 6b · `texture/loadCatalog.ts`** — `loadCatalog` ohne eigene Spec (aus der Auswertung
  im Abschluss).
- **A9 · Paket 15 · `apps/lookbook/src/demos/utils/demoParts.spec.ts:98, 100`** — »(Fall `throws an
  AggregateError …`): zwei `as AggregateError`-Casts auf den gefangenen Fehler; ein
  `instanceof`-Guard würde verengen«
- **B1 · Paket 6b · `texture/SharedImageCache.ts:44` (heute `:20`)** — »`acquire()` ohne TSDoc.«
- **B2 · Paket 10 · `display/DisplaySizer.ts:286-289` und `:394-397`** — »verschobener
  Zeilenkommentar und neuer TSDoc-Satz stapeln sich über demselben Member; bei `stopWatch()`
  wiederholt der TSDoc die Zeile darüber.«
- **B3 · Paket 14 · `display/AdaptiveResolution.ts:455–461`** — »zwei Kommentarblöcke ohne Trenner
  übereinander«
- **B4 · Paket 11 · `stage/directorSlots.ts:74`, `stage/StageDirector.ts:1612` (heute `:1615`)** —
  »TSDoc von `OrderRef` verweist auf `distinctMasks()`, das modullokal in `DirectorShapeCache.ts`
  steht — der Verweis nennt die Datei nicht.« / »Kommentar in `#rebuildOrder()` nennt
  `distinctMasks()` ohne Ort, derselbe Punkt.«
- **B5 · Paket 11c · `stage/planeProjection.ts:17-19, 84`** — »Kommentar vor `#near`/`#far` in
  `planeProjection.ts` ~130 Zeichen, auf zwei Zeilen umbrechen.«; dazu aus der Auswertung im
  Abschluss: Zeilenkommentar vor dem TSDoc von `DEFAULT_NEAR`.
- **B6 · Paket 11b · `stage/Stage2DCamera.ts:29`** — »TSDoc-Zeile an
  `Stage2DCameraHost.updateProjection` 175 Zeichen lang, über Biomes `lineWidth` 130 (Biome
  umbricht Kommentare nicht und meldet nichts).«
- **B7 · Paket 13 · `texture/FrameBasedAnimations.ts:607–609`** — »der Satz »`firstTileId` and
  `tileCount` are checked only when they are passed« steht neben der immer laufenden
  Bereichsprüfung; besser »The whole-number checks of …«.«
- **B8 · Paket 13 · `texture/TileSet.ts:62`** — »(TSDoc der Option `firstId`) und
  `packages/twopoint5d/docs/textures.md:221` nennen `firstId` nur »a whole number«, nicht die
  Grenze ±`Number.MAX_SAFE_INTEGER` für die Ids aller Kacheln.« (`textures.md` trägt Paket 19.)
- **B9 · Paket 6 · `texture/TextureStore.ts`** — »Neue TSDoc-Sätze in `TextureStore.ts:1195`,
  `:1249`, `:1410`, `:1522` … sind 130–190 Zeichen lang, die Umgebung bricht bei etwa 100 um.« /
  »`TextureStore.ts:1410`: der Satz über das Warten auf einen Renderer steht im dritten Absatz von
  `on()`, der Detailplan wollte ihn als letzten Satz des ersten.« (Zeilen seither verschoben.)
- **B10 · Paket 14 · `stage/Stage2D.ts:153–154`** — »der Satz »A `resize()` whose projection
  throws leaves the container …« gilt ebenso, wenn der `CameraRig` (`driver.placeBase`) wirft
  (Rollback `#updateProjection` `:449–455`, `resize()` `:364–371`)«
- **B11 · Paket 13 · `map2d/RepeatingTilesProvider.ts:~436`** — »TSDoc-Absatz des Setters nach dem
  eingefügten Satz nicht neu umbrochen, eine Zeile deutlich zu lang.«
- **B12 · Paket 17 · `apps/lookbook/src/demos/utils/demoInit.ts`** — »TSDoc von `onDemoInit()`
  könnte auf `startDemo()` verweisen«

## Urteil des Reviewers (Zug 3, `paket-18.review-0.json`)

- A1 behoben — `stage/cullingSphere.ts:1–53` (`isSprite`/`center`, `SPRITE_CENTER`, Radius `SQRT1_2 + distanceTo(center)`), zwei Specs in `cullingSphere.spec.ts`
- A2 behoben — Spec in `StageDirector.spec.ts` hinter dem Vorgängerfall, TSDoc von `#release()` und CHANGELOG-Eintrag wörtlich
- A3 behoben — `keyFunctionReleasedScratchError()` und Prüfung `this.#sortKeys !== keys` in `VertexObjectPool.ts`; README, `pool-sorting.md` §2.2, CHANGELOG nachgezogen
- A4 behoben — `Stage2DCameraHost.disposed()`/`projection()`, Host-Literal `Stage2D.ts:640–641`; fünf Dispose-Prüfungen über den Host, `#buildsKindOf` über `host.projection()`, `#updateCamera` über `stage.camera`; drei Specs in `describe('a camera driver')`
- A5 behoben — `SpritePicker.ts` leert `#clippingScratch` im `finally`
- A6 behoben — `#rearm()` verzweigt auf `isSupported` / `fallback === 'pseudo'`; Kommentar, TSDoc `onLandscape`, `docs/proposals/display-fullscreen.md` §6.2, zwei Specs
- A7 behoben — `nextTask` ersetzt `settleMicrotasks` in `SharedImageCache.spec.ts`, sieben Aufrufe
- A8 kein Befund — `loadCatalog.ts` unberührt (Entscheidung aus Zug 0)
- A9 behoben — `instanceof`-Guard in `demoParts.spec.ts`, kein `as AggregateError` mehr
- B1–B12 behoben, Wortlaut Zeile für Zeile geprüft; B4: `distinctMasks` steht in `DirectorShapeCache.ts:112`
- Abnahme: `awk`-Checks über die vier Dateien und `git grep "as AggregateError"` leer

## Kleine Befunde

- `display/DisplayFullscreen.ts`, TSDoc von `onLandscape`: eine Zeile mit 116 Zeichen, Absatz nicht neu auf ~100 umbrochen (unter dem Limit 130)
- `vertex-objects/VertexObjectPool.ts`, TSDoc von `releaseSortScratch()`: Zeile mit 104 Zeichen; dazu die `finally`-Kommentare in `SpritePicker.ts` (103/105 Zeichen, eine Einrückung durch das `try`)
- `sortBy()` `@throws`: eigener Satz »It throws, too, when the key function calls {@link releaseSortScratch}: …« statt des Wortlauts »…, and when …« — der Satz, an den der Plan-Wortlaut hängen sollte, steht so nicht da; Inhalt gleich
- `DisplayFullscreen.ts`: die Auswahl »`isSupported` → `#arm()`, sonst bei `fallback: 'pseudo'` → `#enterPseudo('landscape')`« steht jetzt an drei Stellen (Setter `onLandscape`, `#turned()`, `#rearm()`), vom Plan so vorgegeben, nicht zusammengezogen
- Abweichungen des Implementierers: `Vector2` in `cullingSphere.ts` als Wert importiert (das Modul braucht `new Vector2(0.5, 0.5)`); `Math.SQRT1_2` statt der Literalzahl im Spec (Biome `noApproximativeNumericConstant`)
- Kein Befund: TSDoc von `releaseSortScratch()` »Does nothing … on a disposed pool« stimmt — `dispose()` ruft `releaseSortScratch()` selbst (`VertexObjectPool.ts:380`), ein weiterer Aufruf leert leere Felder; `apps/lookbook/src/demos/utils/demoInit.ts:45` (136 Zeichen) ist eine `biome-ignore`-Zeile
- Nicht ganz gelesen vom Implementierer: `StageDirector.spec.ts`, `Stage2D.spec.ts`, `DisplayFullscreen.spec.ts`, `VertexObjectPool.sortBy.spec.ts` (nur die neuen Tests samt Nachbarn)

