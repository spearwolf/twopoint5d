# Paket 1 — Texturen & Atlanten: Listener-Robustheit, Atlas-API, Texturlimit

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-009 (medium), MEM-001 (medium), BUG-010 (medium), BUG-011 (medium), CONS-001 (low), BUG-014 (low), BUG-015 (low), PERF-020 (low), TYPE-002 (low)
- Nebenbefunde gleicher Ursache, in dieses Paket aufgenommen: N1–N4 unter »Abgleich«
- Ziel: Das Texture-Feature übersteht werfende Listener, hält Optionen und Atlas-Namen konsistent, prüft Bakes gegen ein reales Texturlimit und typisiert Frame-Daten ohne `any`.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/texture/internals.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts` + `.spec.ts`
  - `packages/twopoint5d/src/texture/TextureStore.ts` + `.spec.ts`
  - `packages/twopoint5d/src/texture/TextureAtlas.ts` + `.spec.ts`
  - `packages/twopoint5d/src/texture/TileSet.ts` + `.spec.ts`
  - `packages/twopoint5d/src/texture/frameTrimMargins.ts` + `.spec.ts`
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts` + `.spec.ts`
  - `packages/twopoint5d/src/texture/TextureFactory.ts` + `.spec.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprite.ts`
  - `packages/twopoint5d/src/map2d/TileSprites/TileSpritesFactory.ts`
  - Fixtures, die ein `TextureAtlasFrame` mit Daten ohne `frame` bauen: `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSprites.spec.ts:22`, `packages/twopoint5d/src/sprites/hot-path-allocations.spec.ts:27`, `packages/twopoint5d/src/sprites/hot-path.bench.ts:12` und `:15`
  - `apps/lookbook/src/pages/demos/animated-sprites.astro:106`, `apps/lookbook/src/pages/demos/animated-billboards.astro:72`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix(texture)!: let every listener of a texture store and a texture resource hear its event, tear a resource and a store down whole behind a dispose listener that throws, test every frame name against a RegExp from its start, draw a random frame name by index, type the frame data of TextureAtlas and TileSet by a type parameter, check a bake against 8192 texels or the limit of a renderer, lay the defaultOptions of TextureFactory over its seed, and keep the options of a TileSet and of TextureResource#tileSetOptions as a frozen copy`
- Verlauf:
  - 2026-09-29 Zug 0: Detailplan steht · alle neun Findings unverändert an ihren Fundstellen (Tabelle »Abgleich«) · keine Folgen offen (kein Paket committet), »Offene Befunde« leer · N1–N4 gleicher Ursache ins Paket aufgenommen · Paket nicht geteilt (Grund unter »Entscheidungen dieses Detailplans«) · Restplan unverändert
  - 2026-09-29 Zug 1: Implementierer beauftragt · opus, Effort high · Session `remediate-twopoint5d-p1-impl-0` · Report nach `paket-1.impl-0.json` im Arbeitsverzeichnis
  - 2026-09-29 Zug 2: Report FERTIG (Session `6a5d62c5-1ff9-4592-b39a-eb74e139b401`) · 16 Dateien geändert (texture/*, TexturedSprite.ts, TexturedSprites.spec.ts, hot-path-allocations.spec.ts, hot-path.bench.ts, TileSpritesFactory.ts, zwei Lookbook-Demos, CHANGELOG.md), keine neu · rote Läufe je Block im Report · Arbeitsbaum schmutzig · eigener Verify-Lauf `pnpm run ci` → exit=0 (`paket-1.verify.log`)
  - 2026-09-29 Zug 3: Reviewer opus/high (`paket-1.review-0.json`, Session `b5c4e0da-d578-49d1-a4ee-9ee9493f3efc`) · alle neun Findings und N1–N4 behoben · 3 kleine Befunde, kein kritischer, kein wichtiger · Diff `paket-1.diff` (23 Dateien, +1111/−128)
  - 2026-09-29 Zug 4: keine Runde — nur kleine Befunde
  - 2026-09-29 Zug 5: Commit `801906f3` auf den Verify-Lauf aus Zug 2 (seither keine Codeänderung) · Commit-Message aus dem Detailplan plus `BREAKING CHANGE:`-Footer im Stil der bisherigen Lauf-Commits, Trailer `Remediation-Run: 2026-09-29` · 3 Nebenbefunde des Implementierers nach »Offene Befunde« (alle vorbestehend, per `git show HEAD~1:<pfad>` geprüft)

## Urteil des Reviewers

| ID | Urteil | Fundstelle |
| --- | --- | --- |
| BUG-009 | behoben | `TextureAtlas.ts:91` — `new RegExp(match)`, `lastIndex = 0` je Name; Tests in `TextureAtlas.spec.ts` (g, zweiter Aufruf, `lastIndex`, y) und `FrameBasedAnimations.spec.ts` (`add()` mit `/walk/g`) |
| MEM-001 | behoben | `TextureResource.ts:601` `emitStrict` im `try`, `throwCollected` `:627`; `TextureStore.ts:1161` bis `:1184` fängt je Resource, wirft gesammelt |
| BUG-010 | behoben | `TextureStore.ts:685`, `:697`, `:704` (`error`), `:801` (`ready`), `:804` (`resource:<id>`) mit `emitSafe`; `loadAsync()`-Test belegt, dass kein `parse`-Fehler mehr gemeldet wird |
| BUG-011 | behoben | `FrameBasedAnimations.ts:205` `MaxTextureSize = 8192`, `readMaxTextureSize` `:145`, Limitkette `:462`; Feldnamen gegen three 0.185.1 geprüft (`WebGPUBackend.js:292`, `WebGLBackend.js:249`); beide Lookbook-Demos übergeben `{renderer}` |
| CONS-001 | behoben | `frameTrimMargins.ts:1` importiert `isFiniteNumber` aus `utils/` |
| BUG-014 | behoben | `TextureFactory.ts:200` legt `defaultOptions` über den Seed, `undefined` gefiltert, `anisotrophy` wirkt weiter |
| BUG-015 | behoben | `TileSet.ts:102`/`:107`, `TextureResource.ts:451` eingefrorene Kopie; Tests in `TileSet.spec.ts` und `TextureResource.spec.ts` |
| PERF-020 | behoben | `TextureAtlas.ts:35` `#frameNameList`, `:112` Zug per Index; `frameNames()` ohne Argument antwortet eine Kopie |
| TYPE-002 | behoben | `TextureAtlas.ts:5`/`:30`, `TileSet.ts:73` generisch, `frameTrimMargins.ts:30` nimmt `unknown`; Aufrufer und Fixtures mitgezogen, `expectTypeOf`-Tests |
| N1 | behoben | `TextureResource.ts:636`, `:807`, `:996`, `:1141` mit `emitSafe`; Kommentare in Image- und Atlas-Effect neu |
| N2 | behoben | `TextureStore.ts:355` `emitStrict`; Test: jeder Listener hört, retained Wert geschrieben, Wurf geht an den Setter |
| N3 | behoben | `clearUnused()` `TextureStore.ts:1114`/`:1123`, `evictMissing` `:816`/`:820` — erst löschen, dann im `try` abbauen |
| N4 | behoben | `#ownTexture?.dispose()` im `try`; Test mit `Texture#addEventListener('dispose', …)` → `AggregateError` in Reihenfolge Resource, Textur |

Konventionen: keine Finding-ID in Code, Kommentaren, CHANGELOG oder Commit-Message; kein Satz über den Vorzustand in Code und TSDoc. Die Vergangenheitsform im Migration Guide und in »Fixed« folgt dem Stil der bestehenden `[Unreleased]`-Einträge (`CHANGELOG.md:84`, `:337`, `:637`) und ist kein Befund.

Kleine Befunde (keine Runde):

1. `src/texture/FrameBasedAnimations.ts:139` und `src/texture/frameTrimMargins.ts:8` — zwei wortgleiche `isObject`-Guards neu, `checkTextureStoreData.ts:14` hat einen dritten, fast gleichen; richtig wäre ein gemeinsamer Helper in `src/utils/` (etwa `isObject.ts`).
2. `packages/twopoint5d/CHANGELOG.md:3180` — das »Before«-Beispiel `atlas.frame('hero').data.sourceSize.w` hätte auch vorher nicht kompiliert (`frame()` antwortete schon `| undefined`, `data` war optional) und liest `sourceSize` aus Daten, die nur `hitBox` tragen; besser `atlas.frame('hero')!.data!.hitBox.w; // any`.
3. `packages/twopoint5d/CHANGELOG.md:3283–3284` — zwei Leerzeilen vor `## [0.21.2]` statt einer (`*.md` steht in `.prettierignore`).

## Nebenbefunde — Begründung der Urteile

Alle drei vom Implementierer gemeldet, in `HEAD~1` (vor diesem Lauf) schon vorhanden, Ort unter `src/texture/` — die Scope-Regel deckt jede Severity dort, daher `→ Scope`. Keiner teilt die Ursache dieses Pakets (werfende Listener, Atlas-Typen, Texturlimit, Optionskopie), deshalb nicht nachträglich hineingenommen.

## Vorab für den Implementierer

- Lies `TextureResource.ts` und `TextureStore.ts` **ganz**, bevor du sie änderst (Regel aus `AGENTS.md`): Signal-, Event- und Ownership-Verdrahtung ergibt nur im Stück Sinn. Dasselbe gilt für `packages/twopoint5d/docs/resource-lifecycle.md` §4 — `Display#dispose()` dort ist das Vorbild für Block A.
- Für die eventize-Semantik (`emit` / `emitSafe` / `emitStrict`, retain, `once`) gibt es den Skill `using-eventize`, für signalize `using-signalize`.
- Die vier Blöcke unten sind unabhängig voneinander umsetzbar; die Reihenfolge A → B → C → D ist eine Empfehlung, keine Bedingung.
- Jeder Korrektheitsfix beginnt mit seinem Regressionstest, der vor dem Fix rot läuft. Die roten Läufe gehören in den Report.

## Vorgehen

### Block A — Werfende Listener (MEM-001, BUG-010, N1–N4)

Die Regel für das ganze Texture-Modul, die dieser Block herstellt und die in die TSDoc von
`TextureResourceEvents` und `TextureStoreEvents` gehört:

- **Werte-Events** gehen mit `emitStrict` hinaus: jeder Listener hört sie, der retained Wert wird geschrieben, und der Wurf geht danach an den, der den Wert geschrieben hat. Die Subtyp-Events der Resource tun das schon (`TextureResource.ts:642`); neu dazu kommt `rendererChanged` des Stores (N2).
- **`error`-Events** gehen überall mit `emitSafe` hinaus: jeder Listener hört sie, einen werfenden meldet eventize auf der Konsole, und der Code, der den Fehler meldet, läuft weiter. Vorbild ist `failed` in `TextureStore#loadAsync()` (`TextureStore.ts:504–510`).
- **`ready` und `resource:<id>`** aus `TextureStore#parse()` gehen mit `emitSafe` hinaus (Begründung unter »Entscheidungen dieses Detailplans«).
- **`dispose`** geht mit `emitStrict` hinaus, in einem `try`; der Abbau läuft ganz, und was geworfen wurde, geht erst danach an den Aufrufer von `dispose()` — ein Fehler unverändert, mehrere als `AggregateError`. Vorbild ist `Display#dispose()`.

Schritte:

1. `internals.ts`: neue modulinterne Funktion (nicht in `public-api.ts`):
   ```ts
   /**
    * Throws what a teardown collected once it is done: nothing for no error, a single error
    * unchanged, several as an `AggregateError` with `message`.
    */
   export function throwCollected(errors: readonly unknown[], message: string): void {
     if (errors.length === 1) throw errors[0];
     if (errors.length > 1) throw new AggregateError(errors, message);
   }
   ```
2. `TextureResource#dispose()` (`TextureResource.ts:573–594`), Reihenfolge der Schritte bleibt, die bestehenden Kommentare bleiben:
   - `const errors: unknown[] = [];`
   - `emit(this, OnDispose)` → `emitStrict(this, OnDispose)` in `try { … } catch (error) { errors.push(error); }`, mit einem Kommentar wie in `Display#dispose()`: ein werfender Listener hält den Abbau nicht auf, sein Fehler wartet, bis die Resource ganz abgebaut ist.
   - `this.#ownTexture?.dispose()` ebenfalls in `try/catch` → `errors.push(error)` (N4: three dispatcht dabei das `dispose`-Event der Textur, und ein Listener dort kann werfen). `this.#ownTexture = undefined` danach, außerhalb des `try`.
   - `#loadFailures.clear()`, `SignalGroup.delete(this)`, `off(this)` laufen in jedem Fall.
   - Am Ende: `throwCollected(errors, \`TextureResource#dispose(): listeners of the dispose events of resource "${this.id}" and of its texture threw\`)`.
   - TSDoc von `dispose()` ergänzen: Ein Listener des `dispose`-Events der Resource oder ihrer Textur, der wirft, hält den Abbau nicht auf: die Resource wird ganz abgebaut, und der Wurf geht danach an den Aufrufer — beide zusammen als `AggregateError`. Ein zweiter `dispose()` tut nichts und wirft nicht.
   - Den Satz »`dispose` fires once at the start of `dispose()`« in der TSDoc von `TextureResourceEvents` (`TextureResource.ts:92`) ergänzen: jeder Listener hört es, auch hinter einem, der wirft.
3. `TextureResource`, `error`-Events (N1): `emit(this, OnError, …)` → `emitSafe(this, OnError, …)` in `#fail()` (`:599`), im Image-Effect (`:770`), im Atlas-Fetch (`:960`) und im Animations-Effect (`:1104`). Import von `emit` entfernen, falls danach unbenutzt.
   - Kommentar `:721–725` (»No closing .catch() …«) neu schreiben: nach der Umstellung kann aus den beiden Handlern nur noch ein Listener des `dispose`-Events der Textur werfen, die dieser Lauf ersetzt (`previous?.dispose()` im `finally`); ein `error`-Listener nicht mehr.
   - Kommentar `:898–901` (»No closing .catch() here either …«) neu schreiben: nach dem `try` wirft nichts mehr — `#fail()` und der `error` nach einem Wurf beim Veröffentlichen gehen mit `emitSafe` hinaus.
   - TSDoc von `TextureResourceEvents` ergänzen: Ein `error`-Listener, der wirft, nimmt keinem anderen Listener das Event: eventize meldet den Wurf auf der Konsole, und die Resource macht weiter wie ohne ihn — die übrigen Einträge einer Animations-Map werden registriert, und ein `TextureStore#getAsync()`, das auf die Resource wartet, hört den Fehler.
4. `TextureStore`-Konstruktor (`TextureStore.ts:343`, N2): `emit(this, OnRendererChanged, renderer)` → `emitStrict(this, OnRendererChanged, renderer)`. TSDoc von `TextureStoreEvents.RendererChanged` (`:64`) ergänzen: jeder Listener hört es und der retained Wert wird geschrieben, auch hinter einem Listener, der wirft; der Wurf geht an den, der `renderer` geschrieben hat.
5. `TextureStore#parse()` (BUG-010):
   - `:665`, `:677`, `:684` (`error`) → `emitSafe`.
   - `:776` `emit(this, OnReady, this)` → `emitSafe(this, OnReady, this)`; `:779` `emit(this, \`${OnResource}:${resource.id}\`, resource)` → `emitSafe(…)`.
   - Eviction `:782–792` (N3): pro Resource zuerst `this.#resources.delete(id)`, dann `resource.dispose()` in `try/catch`; ein Wurf geht als `emitSafe(this, OnError, {source: 'parse', id, error})` hinaus, die Schleife läuft weiter. Löschen während `for…of` über eine `Map` ist in JS erlaubt.
   - TSDoc von `parse()` ergänzen: Ein Listener von `ready`, `resource:<id>` oder `error`, der wirft, ändert nichts an der Analyse: jeder Listener hört sein Event, eventize meldet den Wurf auf der Konsole, und `parse()` läuft weiter und kehrt normal zurück. `parse()` wirft nur für Daten, die es abweist, bevor irgendetwas geschrieben oder gesendet ist. Eine Resource, die `evictMissing` abbaut, wird auch dann entfernt, wenn ein Listener ihres `dispose`-Events wirft; dieser Wurf geht als `error`-Event mit `source: 'parse'` und der id der Resource hinaus.
   - TSDoc von `TextureStoreParseOptions.evictMissing` (`:128–140`) um denselben Satz zur Eviction ergänzen.
   - TSDoc von `TextureStoreEvents` (`:59–80`): `Ready` — jeder Listener hört es und der retained Wert wird geschrieben, auch hinter einem, der wirft. `Error` — die Aufzählung unter `parse` um »a listener of the `dispose` event of a resource that `evictMissing` disposes that throws« ergänzen, und der Satz, dass ein `error`-Listener, der wirft, keinem anderen das Event nimmt.
   - TSDoc der Instanzmethode `loadAsync()` (`:442–469`): nach dem Satz über Katalog-Items, die keine Resource bauen, ergänzen: ein Listener des Stores, der innerhalb der Analyse wirft, ändert ebenso nichts — das Promise wird mit dem Store erfüllt.
6. `TextureStore#dispose()` (`:1102–1125`, MEM-001):
   - `const errors: unknown[] = [];`
   - `emit(this, OnDispose)` → `emitStrict(this, OnDispose)` in `try/catch` → `errors.push(error)`; der bestehende Kommentar bleibt.
   - `off(this)`, `this.#disposal.abort()` wie bisher.
   - Die Schleife: `try { resource.dispose(); } catch (error) { errors.push(error); }` für jede Resource.
   - `#resources.clear()`, `#images.clear()`, `#renderer.set(undefined)`, `SignalGroup.delete(this)` in jedem Fall.
   - Am Ende: `throwCollected(errors, 'TextureStore#dispose(): listeners of the dispose events of the store and of its resources threw')`.
   - TSDoc von `dispose()` ergänzen: Ein Listener des `dispose`-Events des Stores oder einer seiner Resources, der wirft, hält den Abbau nicht auf: jedes offene Promise wird abgewiesen, jede Resource abgebaut, und der Wurf geht danach an den Aufrufer — mehrere als `AggregateError`.
7. `TextureStore#clearUnused()` (`:1072–1082`, N3): pro Resource mit `refCount <= 0` erst `this.#resources.delete(id)` und `removed++`, dann `resource.dispose()` in `try/catch` → `errors.push(error)`; nach der Schleife `throwCollected(errors, 'TextureStore#clearUnused(): listeners of the dispose events of the resources it cleared threw')`, dann `return removed`. TSDoc ergänzen: Ein Listener des `dispose`-Events einer Resource, der wirft, hält die anderen nicht auf: jede unbenutzte Resource wird abgebaut und entfernt, und der Wurf geht danach an den Aufrufer — mehrere als `AggregateError`.
8. Tests, jeder vor seinem Fix rot:
   - `TextureResource.spec.ts`: »dispose() tears the resource down whole behind a dispose listener that throws, and throws afterwards« — geladene Resource (Hilfen der Spec, Spy auf `texture.dispose` wie bei `:275`), zwei `dispose`-Listener, der erste wirft `new Error('boom')`: `dispose()` wirft `'boom'`, der zweite Listener wurde gerufen, die Textur ist disposed, `getSubscriptionCount(resource)` (Export von `@spearwolf/eventize`) ist 0, ein zweiter `dispose()` wirft nicht.
   - `TextureResource.spec.ts`: »a dispose listener of the texture that throws does not hold up the teardown« — `texture.addEventListener('dispose', () => { throw … })` zusätzlich zu einem werfenden Resource-Listener: `dispose()` wirft ein `AggregateError` mit beiden Fehlern in der Reihenfolge Resource-Event, Textur-Event; die Resource ist trotzdem ganz abgebaut.
   - `TextureResource.spec.ts`: »an error listener that throws keeps the report from no other listener, and the other entries of the animation map are registered« — Resource mit zwei Animations-Einträgen, einer davon abgewiesen; ein werfender `error`-Listener vor einem zweiten: der zweite hört den Fehler, `frameBasedAnimations` trägt den gültigen Eintrag.
   - `TextureStore.spec.ts`: »getAsync() rejects on a failure of its resource even behind an error listener of the resource that throws« — Item, dessen Bild nicht lädt; ein werfender `error`-Listener auf der Resource vor dem `getAsync(id, 'texture')`: das Promise wird abgewiesen (vor dem Fix hängt es; `settleWithin` der Spec benutzen).
   - `TextureStore.spec.ts`: »a ready listener that throws keeps the ready value, a waiting getAsync(), the resource announcements and evictMissing« — der Test aus der Audit-Empfehlung: werfender `ready`-Listener vor einem wartenden `getAsync()`; `parse()` wirft nicht, `whenReady()` und ein nachträgliches `once(store, 'ready', …)` feuern (retained), ein `resource:<id>`-Listener hört seine Resource, `evictMissing` baut ab, und das `getAsync()` wird erfüllt oder mit dem Fehler seiner Resource abgewiesen, hängt aber nicht.
   - `TextureStore.spec.ts`: »an error listener that throws lets every other listener hear an item error, and the parse goes on« — Item ohne Quelle, werfender `error`-Listener vor einem zweiten: der zweite hört das Item-Event, `parse()` wirft nicht, die übrigen Items sind gebaut.
   - `TextureStore.spec.ts`: »loadAsync() resolves with the store when a listener throws inside the parse« — werfender `ready`-Listener; vor dem Fix weist `loadAsync()` mit »load failed at the parse step« ab.
   - `TextureStore.spec.ts`: »evictMissing removes a resource whose dispose listener throws and reports the throw as an error event« — `{source: 'parse', id, error}`.
   - `TextureStore.spec.ts`: »dispose(): a dispose listener of the store that throws keeps no pending getAsync() from rejecting and no resource from its dispose, and throws afterwards«.
   - `TextureStore.spec.ts`: »dispose(): dispose listeners of two resources that throw — every resource is disposed and the store throws an AggregateError of both«.
   - `TextureStore.spec.ts`: »clearUnused(): a resource whose dispose listener throws is removed, the others are cleared as well, and the throw goes on afterwards«.
   - `TextureStore.spec.ts`: »rendererChanged: a listener that throws keeps the retained renderer from no later subscriber« — werfender Listener vor einem zweiten; der zweite hört den neuen Renderer, ein danach angemeldeter Listener bekommt ihn retained. Was der `renderer`-Setter dabei tut, hält der Test so fest, wie signalize es liefert (erwartet: er wirft den Fehler des Listeners, nachdem jeder Listener ihn gehört hat).

### Block B — Atlas-API und Frame-Daten (BUG-009, PERF-020, TYPE-002, CONS-001)

1. `TextureAtlas.ts`, TYPE-002 — generisch über den Typ der Frame-Daten:
   ```ts
   import type {TextureCoords} from './TextureCoords.js';
   import type {TexturePackerFrameData} from './TexturePackerJson.js';

   /** The data a frame of a {@link TextureAtlas} carries when the atlas names no type of its own: its entry in a TexturePacker json. */
   export type TextureAtlasFrameData = TexturePackerFrameData;

   export interface TextureAtlasFrame<D = TextureAtlasFrameData> {
     coords: TextureCoords;
     data?: D;
   }

   export type TextureAtlasArgs<D = TextureAtlasFrameData> = [coords: TextureCoords, data?: D];
   export type NamedTextureAtlasArgs<D = TextureAtlasFrameData> = [name: TextureAtlasFrameName, coords: TextureCoords, data?: D];

   export class TextureAtlas<D = TextureAtlasFrameData> { … }
   ```
   - `isNamedTextureAtlasArgs` wird generisch: `<D>(args: TextureAtlasArgs<D> | NamedTextureAtlasArgs<D>): args is NamedTextureAtlasArgs<D>`.
   - `#frames: TextureAtlasFrame<D>[]`; `add(...args: TextureAtlasArgs<D> | NamedTextureAtlasArgs<D>)`; `get()`, `frame()`, `randomFrame()` antworten `TextureAtlasFrame<D> | undefined`, `randomFrames()` `(TextureAtlasFrame<D> | undefined)[]`.
   - Klassen-TSDoc: `D` ist der Typ der `data`, die die Frames tragen — ohne Angabe der Eintrag eines TexturePacker-json, den `TexturePackerJson.parse()` registriert; ein Atlas mit Daten anderer Form nennt ihren Typ, `new TextureAtlas<MyFrameData>()`. Ein Frame darf keine Daten tragen.
   - Der Typ-Import aus `TexturePackerJson.ts` ist ein reiner `import type`; `TexturePackerJson.ts` importiert `TextureAtlas` als Wert — zur Laufzeit entsteht kein Zyklus. `TexturePackerJson.parse()` bleibt textlich gleich (`TextureAtlas` ohne Argument = `TextureAtlas<TexturePackerFrameData>`).
   - Geprüft in Zug 0 mit einem Wegwerf-Snippet unter `tsc --strict`: `TextureAtlas<X>` ist `TextureAtlas<unknown>` zuweisbar, `TileSet<X>` ebenso `TileSet<unknown>`, ein Default-Atlas weist fremde Daten in `add()` ab.
2. `TextureAtlas#frameNames()`, BUG-009 (`TextureAtlas.ts:70–77`):
   ```ts
   if (match != null) {
     // a copy with the same flags, so that every name is tested from its start: a RegExp with `g`
     // or `y` goes on from its `lastIndex`, and the RegExp handed in keeps the `lastIndex` it had
     const regex = new RegExp(match);
     return this.#frameNameList.filter((name) => {
       if (typeof name !== 'string') return false;
       regex.lastIndex = 0;
       return regex.test(name);
     });
   }
   return this.#frameNameList.slice();
   ```
   `new RegExp(string)` verhält sich wie bisher; `new RegExp(regExp)` kopiert Quelle und Flags mit `lastIndex` 0. TSDoc ergänzen: ein `RegExp` wird an jedem Namen ab dessen Anfang getestet, gleich mit welchen Flags — mit `y` muss der Treffer dort beginnen; der übergebene `RegExp` bleibt, wie er war, `lastIndex` eingeschlossen.
3. PERF-020 (`TextureAtlas.ts:89–101`, `:121–127`): neues Feld `#frameNameList: TextureAtlasFrameName[] = []`, in `add()` direkt nach `this.#frameNames.set(args[0], id)` mit `push(args[0])` gepflegt. `randomFrameName()` wird `return this.#frameNameList[rand(this.#frameNameList.length)];` — die Schleife und ihr Kommentar fallen weg, die TSDoc bleibt (`rand(0)` ist 0, und `[][0]` ist `undefined`). `frameNames()` ohne Argument antwortet eine Kopie der Liste (Schritt 2). Die `Map` bleibt für `frameId()` und `frame()`.
4. `TileSet.ts` wird generisch, damit ein Atlas mit eigenem Datentyp weiter einen `TileSet` tragen kann: `class TileSet<D = TextureAtlasFrameData>`, `readonly atlas: TextureAtlas<D>`, Konstruktor `...args: [TextureAtlas<D>, TextureCoords, TileSetOptions?] | [TextureCoords, TileSetOptions?]`, eigener Atlas `new TextureAtlas<D>()`, `frame()` und `randomFrame()` antworten `TextureAtlasFrame<D>`. TSDoc: ein `TileSet` über einem Atlas mit eigenem Datentyp übernimmt diesen Typ; die Frames, die der `TileSet` selbst anlegt, tragen keine Daten.
5. `frameTrimMargins.ts` (TYPE-002, CONS-001):
   - Die lokale `isFiniteNumber` (`:6`) löschen, `import {isFiniteNumber} from '../utils/isFiniteNumber.js';`.
   - Signatur `frameTrimMargins(data: unknown, target: FrameTrimMargins = [0, 0, 0, 0])`; der Import von `TextureAtlasFrameData` entfällt.
   - Gelesen wird über eine modulinterne Wache ohne Allokation, etwa `const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;`, dann `spriteSourceSize`/`sourceSize` nur aus einem Objekt und `x`, `y`, `w`, `h`, `W`, `H` nur aus diesen Objekten. Keine neuen Objekte, Arrays oder Closures pro Aufruf: `TexturedSprite#setFrame()` ruft die Funktion im Hot Path, und `src/sprites/hot-path-allocations.spec.ts` misst ihn.
   - TSDoc ergänzen: `data` ist die `data` eines Atlas-Frames, von welchem Typ auch immer sein Atlas sie nennt; gelesen werden nur `spriteSourceSize` und `sourceSize`, und ein Wert ohne sie — oder einer, der kein Objekt ist — bekommt vier Nullen.
   - `frameTrimMargins.spec.ts:4` und `:19`: `TextureAtlasFrameData | undefined` → `unknown`.
6. Aufrufer mitziehen, damit Frames, Atlanten und Tile-Sets jedes Datentyps hineinpassen:
   - `TexturedSprite.ts:82` `prepareSpriteFrame(frame: TextureAtlasFrame<unknown>)` und `:174` `setFrame(frame: TextureAtlasFrame<unknown>)`; in beiden TSDocs ein Halbsatz: ein Frame jedes Atlas — die Trim-Ränder kommen aus TexturePacker-Daten und sind für alle anderen null.
   - `FrameBasedAnimations#add()` (`FrameBasedAnimations.ts:203–219`): in den Overload-Tupeln `atlas: TextureAtlas<unknown>` und `tileSet: TileSet<unknown>` (beide Tupel mit `tileSet`).
   - `TileSpritesFactory.ts:22` und `:26`: `tileSet?: TileSet<unknown>`.
   - Fixtures mit Daten ohne `frame` auf `TextureAtlasFrame<unknown>` annotieren: `TexturedSprites.spec.ts:22`, `sprites/hot-path-allocations.spec.ts:27`, `sprites/hot-path.bench.ts:12` und `:15`. Nur die Annotation, kein Laufzeit-Unterschied — die Allokationsmessung bleibt, wie sie ist.
   - `TextureAtlas.spec.ts:29`, `:64`, `:65` füllen einen Atlas mit eigenen Daten: dort den Typ nennen, `new TextureAtlas<{foo?: number; bar?: number; abc?: string}>()`.
   - Alles, was `pnpm typecheck` darüber hinaus bricht (Lookbook, Browser-Tests, `ts check`-Blöcke), gehört zur Änderung und wird mitgezogen; nach dem Abgleich in Zug 0 ist dort nichts zu erwarten.
7. Tests:
   - BUG-009 (vor dem Fix rot): `frameNames(/walk/g)` über `walk.1` … `walk.4` liefert alle vier; ein zweiter Aufruf mit demselben `RegExp`-Objekt dasselbe; der `lastIndex` des übergebenen `RegExp` ist nach dem Aufruf, was er vorher war (etwa vorher auf 3 gesetzt); `/walk/y` über `walk.1` und `mywalk.1` liefert nur `walk.1`; `FrameBasedAnimations#add(name, timing, atlas, /walk/g)` nimmt alle vier Frames.
   - PERF-020: `randomFrameName()` mit gestubbtem `Math.random` (`vi.spyOn(Math, 'random')`) antwortet den Namen am erwarteten Index in Einfügereihenfolge, ein Symbol-Name eingeschlossen; ein Atlas ohne Namen antwortet `undefined`; eine Änderung am Array aus `frameNames()` lässt den Atlas unberührt.
   - TYPE-002, mit `expectTypeOf` wie in `src/map2d/TileSprites/TileSprites.spec.ts` und `// @ts-expect-error`: `new TextureAtlas().get(0)` ist `TextureAtlasFrame<TexturePackerFrameData> | undefined`; `add('a', coords, {foo: 1})` auf einem Default-Atlas ist ein Typfehler; auf `new TextureAtlas<{foo: number}>()` ist `get(0)?.data` `{foo: number} | undefined`; `new TileSet(new TextureAtlas<{foo: number}>(), coords, {tileWidth: 1, tileHeight: 1}).frame(1).data` ist `{foo: number} | undefined`; ein `TextureAtlas<{foo: number}>` geht in `FrameBasedAnimations#add()`, ein Frame daraus in `TexturedSprite#setFrame()`.

### Block C — Optionen und Texturlimit (BUG-011, BUG-014, BUG-015)

1. BUG-011, `FrameBasedAnimations.ts`:
   - `static MaxTextureSize = 8192;` mit TSDoc: die breiteste Datentextur, die ein Bake ohne genanntes Limit baut — 8192 Texel, das `maxTextureDimension2D`, das jedes WebGPU-Device garantiert. Ein WebGL2-Device garantiert nur 2048: wer seinen Renderer an `bakeDataTexture()` gibt, bekommt das Limit von dessen Device. Zugleich die Obergrenze eines `tileCount` in `add()`.
   - `BakeTextureOptions` (`:18–25`): `includeTextureSize` wird optional (`includeTextureSize?: boolean`, TSDoc bleibt), dazu
     ```ts
     /**
      * The widest data texture the bake may build, in texels — a whole number of 1 or more. It takes
      * the place of the limit of `renderer` and of {@link FrameBasedAnimations.MaxTextureSize}.
      */
     maxTextureSize?: number;
     /**
      * The renderer the data texture is meant for. Without a `maxTextureSize` the bake reads the limit
      * of its device — `maxTextureDimension2D` of a WebGPU device, `MAX_TEXTURE_SIZE` of a WebGL2
      * context. A renderer that has not been initialized has no device to ask, and the bake falls back
      * to {@link FrameBasedAnimations.MaxTextureSize}.
      */
     renderer?: WebGPURenderer;
     ```
     `import type {WebGPURenderer} from 'three/webgpu';`
   - Modulintern neben `getBufferSize`: `const readMaxTextureSize = (renderer: WebGPURenderer): number | undefined => …` nach dem Muster von `readMaxAnisotropy` (`TextureFactory.ts:161–167`): in `try/catch` (Fehler → `undefined`), gelesen über `unknown` und Narrowing, weil `@types/three` `renderer.backend` nur als `Backend` typisiert — erst `backend.device?.limits?.maxTextureDimension2D` (WebGPU; `device` ist bis `init()` `null`), sonst `backend.gl` mit `getParameter` → `gl.getParameter(gl.MAX_TEXTURE_SIZE)` (WebGL2-Fallback). Nur eine ganze Zahl ≥ 1 zählt, alles andere ist `undefined`. Quelle: three 0.185.1, `WebGPUBackend.js:93` (`requiredLimits` default `{}`), `:292` (`this.device = device` erst in `init()`).
   - `bakeDataTexture(options?)`: das Limit ist `options.maxTextureSize`, wenn es nicht `undefined` ist — geprüft: keine ganze Zahl ≥ 1 → `throw new RangeError(\`FrameBasedAnimations: bakeDataTexture() got a maxTextureSize of ${describeValue(value)} — a maxTextureSize is a whole number of 1 or more\`)` —, sonst `readMaxTextureSize(options.renderer)`, wenn ein Renderer da ist und antwortet, sonst `FrameBasedAnimations.MaxTextureSize`. Es geht als drittes Argument an `getBufferSize()`; dessen Fehlermeldung nennt das Maximum schon. TSDoc von `bakeDataTexture()` um einen Absatz zum Limit ergänzen.
   - Lookbook: `animated-sprites.astro:106` → `frameBasedAnimations.bakeDataTexture({renderer})`, `animated-billboards.astro:72` → `anims.bakeDataTexture({renderer})`; `renderer` ist an beiden Stellen im Scope (`:70` bzw. `:53`) und initialisiert.
   - `FrameBasedAnimations.spec.ts:890`: das Label `'16385'` aus `String(FrameBasedAnimations.MaxTextureSize + 1)` bilden, damit der Testname nicht lügt; den Test bei `:931` (»a tile set of more tiles than MaxTextureSize …«) gegen 8192 prüfen.
   - Tests: Default weist einen Bake ab, dessen kleinste Zweierpotenz 16384 Texel ist, und nennt 8192 (vor dem Fix rot); `{maxTextureSize: 4}` weist einen Bake von 8 Texeln ab und nennt 4; Renderer-Stub `{backend: {device: {limits: {maxTextureDimension2D: 4}}}}` weist ab und nennt 4 (vor dem Fix rot); WebGL-Stub `{backend: {gl: {MAX_TEXTURE_SIZE: 0x0d33, getParameter: (p: number) => (p === 0x0d33 ? 4 : 0)}}}` nennt 4; Renderer ohne Device (`{backend: {}}`) und ein `backend`-Getter, der wirft, fallen auf `MaxTextureSize` zurück; `maxTextureSize` schlägt den Renderer; `maxTextureSize` von `0`, `1.5`, `NaN` und `'8'` wirft den `RangeError`; `bakeDataTexture({maxTextureSize: 4096})` ohne `includeTextureSize` kompiliert. Stubs als `WebGPURenderer` casten, wie `TextureFactory.spec.ts` (`rendererWithMaxAnisotropy()`) es tut.
2. BUG-014, `TextureFactory`-Konstruktor (`TextureFactory.ts:186–190`) — der Seed wird überlagert statt ersetzt:
   ```ts
   // every factory starts from this seed; `defaultOptions` are laid over it, and a key they leave out
   // or give as `undefined` keeps the value of the seed
   const {anisotrophy, ...given} = defaultOptions ?? {};
   const defined = Object.fromEntries(Object.entries(given).filter(([, value]) => value !== undefined)) as Partial<TextureOptions>;
   // the deprecated key stands in for the one it names while that one is missing
   this.#defaultOptions = {flipY: false, ...defined, anisotropy: defined.anisotropy ?? anisotrophy ?? 0};
   ```
   Die folgende Zeile `this.#defaultOptions = this.#mergeOptions(defaultClassNames);` bleibt samt Kommentar. Nicht `{anisotropy: 0, flipY: false, ...defaultOptions}` wie in der Audit-Empfehlung: damit stünde `anisotropy: 0` schon im Seed, `seed.anisotropy ?? anisotrophy` fände nie den veralteten Schlüssel, und der bestehende Test »defaultOptions with anisotrophy alone count it …« (`TextureFactory.spec.ts:124`) würde rot.
   - Konstruktor-TSDoc (fehlt heute): `@param maxAnisotropyOrRenderer` — das Anisotropie-Maximum oder der Renderer, der es nennt; `@param defaultClassNames` — die Texturklassen, die jede Textur dieser Factory vor den Klassen des Aufrufs bekommt; `@param defaultOptions` — Optionen über dem Seed `{anisotropy: 0, flipY: false}`; ein Schlüssel, den sie auslassen oder als `undefined` geben, behält den Wert des Seeds, und die Klassen liegen über beiden.
   - Tests (vor dem Fix rot): `new TextureFactory(16, [], {colorSpace: SRGBColorSpace}).update(new Texture())` hat `flipY === false` und `colorSpace === SRGBColorSpace`; `{flipY: undefined}` ergibt `false`; `{flipY: true}` ergibt `true`; der bestehende `anisotrophy`-Test bleibt grün.
3. BUG-015 — eingefrorene Kopie statt Referenz:
   - `TileSet.ts:73` → `readonly options: Readonly<TileSetOptions>;`; `:93` und `:98` → `this.options = Object.freeze({...options});` (`{...undefined}` ist `{}`). TSDoc am Feld: eine eingefrorene Kopie der Optionen, mit denen der Tile-Set gebaut wurde — Layout, Prüfungen und Getter lesen dieselben Werte, und eine Änderung am übergebenen Objekt erreicht keinen davon; ein Schreibzugriff wirft in Strict-Mode-Code einen `TypeError`.
   - `TextureResource`: Signal `#tileSetOptions` als `Signal<Readonly<TileSetOptions> | undefined>` (Deklaration `:293`, Erzeugung `:548`); Getter `get tileSetOptions(): Readonly<TileSetOptions> | undefined`; Setter (`:434–439`) schreibt `signal.set(value == null ? undefined : Object.freeze({...value}))`. TSDoc am Accessor (fehlt heute): gespeichert wird eine eingefrorene Kopie — eine Änderung am Objekt nach dem Schreiben erreicht den Tile-Set erst, wenn es erneut geschrieben wird, und erneutes Schreiben nach einer Änderung baut einen neuen Tile-Set.
   - Tests (vor dem Fix rot): `TileSet.spec.ts` — `firstId` des übergebenen Objekts nach dem Konstruktor ändern: `tileSet.firstId` und `frameId()` bleiben; `Object.isFrozen(tileSet.options)`; `tileSet.options !== options`. `TextureResource.spec.ts` — Optionen schreiben, das Objekt ändern (`tileWidth`), dasselbe Objekt erneut schreiben: ein neuer Tile-Set mit der neuen `tileWidth`; ohne erneutes Schreiben bleibt der alte.

### Block D — CHANGELOG und Migration

`packages/twopoint5d/CHANGELOG.md`, Abschnitt `[Unreleased]`, nach dem Skill `updating-changelog` (Keep a Changelog 1.1.0; veröffentlichte Abschnitte bleiben unberührt; Einträge in der Sprache und dem Ton der bestehenden Einträge):

- **Added:** `BakeTextureOptions#maxTextureSize` und `#renderer`.
- **Changed:** `TextureAtlas<D>`, `TextureAtlasFrame<D>`, `TextureAtlasArgs<D>`, `NamedTextureAtlasArgs<D>` und `TileSet<D>` mit dem Datentyp als Typparameter, `TextureAtlasFrameData` ist `TexturePackerFrameData`; `TexturedSprite#setFrame()`, `prepareSpriteFrame()`, `FrameBasedAnimations#add()` und `TileSpritesFactory` nehmen Frames, Atlanten und Tile-Sets jedes Datentyps; `FrameBasedAnimations.MaxTextureSize` ist 8192; `BakeTextureOptions#includeTextureSize` ist optional; `TileSet#options` und `TextureResource#tileSetOptions` sind eingefrorene Kopien; die `error`-Events von `TextureStore` und `TextureResource` erreichen jeden Listener; ein Listener, der in `TextureStore#parse()` wirft, erreicht dessen Aufrufer nicht mehr.
- **Fixed:** `TextureAtlas#frameNames()` mit einem `RegExp` mit `g` oder `y`; `TextureFactory` mit `defaultOptions` ohne `flipY`; `TextureResource#dispose()`, `TextureStore#dispose()` und `#clearUnused()` hinter einem werfenden `dispose`-Listener; `ready`, `resource:<id>` und `rendererChanged` hinter einem werfenden Listener; `evictMissing` hinter einem werfenden `dispose`-Listener.
- **Migration Guide**, je ein `####`-Abschnitt: »A `TextureAtlas` names the type of its frame data« (mit einem `ts check`-Block, der einen Atlas mit eigenem Datentyp baut und einen TexturePacker-Frame mit Null-Check liest); »`FrameBasedAnimations.MaxTextureSize` is 8192« (mit `bakeDataTexture({renderer})`); »The options of a `TileSet` are a frozen copy«; »The `defaultOptions` of a `TextureFactory` lie over its seed«; »A listener that throws inside `TextureStore#parse()` no longer reaches its caller«.

`packages/twopoint5d/docs/resource-lifecycle.md` und `docs/architecture.md` sagen nach dem Abgleich nichts, was danach falsch wäre; keine Änderung nötig. Ein Satz, den du beim Umsetzen doch lügen siehst, wird mitgezogen.

## Abgleich

| Finding | Urteil | Fundstelle jetzt |
| --- | --- | --- |
| BUG-009 | unverändert | `TextureAtlas.ts:73–74` reicht den `RegExp` unverändert an `regex.test(name)` im `filter`; `FrameBasedAnimations.ts:256–257` gibt die Query durch |
| MEM-001 | unverändert | `TextureResource.ts:575` setzt `#disposed`, `:577` `emit(this, OnDispose)`, Aufräumen `:582–593`; `TextureStore.ts:1110` `emit(this, OnDispose)`, `:1117–1119` Schleife über `resource.dispose()` |
| BUG-010 | unverändert | `TextureStore.ts:776` (`ready`), `:779` (`resource:<id>`), `:665`, `:677`, `:684` (`error`, das dritte stand nicht im Audit, gleiche Ursache), `:549` (`loadAsync()` meldet den Wurf als `parse`-Fehler) |
| BUG-011 | unverändert | `FrameBasedAnimations.ts:158` `MaxTextureSize = 16384`, `:115` Prüfung, `:414` `new DataTexture(floatsBuffer, bufSize, 1, …)`; three 0.185.1 `WebGPUBackend.js:93` bestätigt `requiredLimits` `{}` |
| CONS-001 | unverändert | `frameTrimMargins.ts:6`; `utils/isFiniteNumber.ts` exportiert denselben Type Guard |
| BUG-014 | unverändert | `TextureFactory.ts:187` |
| BUG-015 | unverändert | `TileSet.ts:93` und `:98`, Getter `:103–146`; `TextureResource.ts:434–439` Setter, `cmpShallow` `:115–123` erkennt dasselbe Objekt als unverändert |
| PERF-020 | unverändert | `TextureAtlas.ts:89–101`, `:121–127` |
| TYPE-002 | unverändert | `TextureAtlas.ts:3`; `frameTrimMargins.ts:26`, `:29–37` |

Nebenbefunde gleicher Ursache — ein abbrechendes `emit` oder eine Dispose-Schleife ohne Schutz, vor dem ersten Commit dieses Laufs vorhanden (der Lauf hat noch keinen Commit). In dieses Paket aufgenommen, weil der Fix von BUG-010 und MEM-001 dieselbe Ursache nur halb behöbe, ließe er sie stehen:

- **N1** `TextureResource.ts:599`, `:770`, `:960`, `:1104` — `error` mit `emit`: ein werfender `error`-Listener nimmt den Listenern dahinter die Meldung, darunter dem `rejectIfHeldBack` eines wartenden `TextureStore#getAsync()` (`TextureStore.ts:1030–1038`), das dann hängt; in `:1104` wirft er zudem aus dem Animations-Effect, und keine Animation der Map wird veröffentlicht (`:1107` läuft nicht). Geschätzt medium.
- **N2** `TextureStore.ts:343` — `rendererChanged` ist retained (`:339`) und geht mit `emit` hinaus: ein werfender Listener lässt den retained Wert ungeschrieben. Geschätzt low.
- **N3** `TextureStore.ts:1072–1082` (`clearUnused()`) und `:782–792` (`evictMissing`) — dieselbe ungeschützte Schleife über `resource.dispose()` wie `:1117`; in `clearUnused()` bleibt die abgebaute Resource zudem in `#resources`, weil `delete` nach `dispose()` kommt. Geschätzt medium.
- **N4** `TextureResource.ts:587` — `#ownTexture?.dispose()`: three dispatcht dabei das `dispose`-Event der Textur, und ein werfender Listener dort bricht den Abbau ab wie einer des Resource-Events. Geschätzt low.

## Entscheidungen dieses Detailplans

- **`emitSafe` für `ready`, `resource:<id>` und `error` in `parse()`** — die zweite der beiden Empfehlungen des Audits. `parse()` verspricht in seiner TSDoc (`TextureStore.ts:587–591`), nur für abgewiesene Daten zu werfen, bevor etwas geschrieben ist; mit `emitStrict` und nachgereichtem Wurf würfe es nach einem vollständigen Lauf, und `loadAsync()` könnte einen abgewiesenen Katalog nicht von einem geparsten unterscheiden — genau Punkt (4) des Findings. Derselbe Store behandelt werfende `error`-Listener in `loadAsync()` schon so (`:504–510`), und seine TSDoc sagt es (`:449–451`).
- **Eviction meldet über `error`** statt zu werfen, aus demselben Grund; Vorbild ist `TextureResource`, das einen Wurf beim Veröffentlichen als eigenes `error`-Event mit der `source` des laufenden Schritts meldet (`TextureResource.ts:770`). Der statische `TextureStore.loadAsync()` ist nicht betroffen: ein frischer Store hat nichts zu evicten.
- **`emitStrict` mit nachgereichtem Wurf für `dispose`** — die Empfehlung des Audits und das Vorbild `Display#dispose()` aus `resource-lifecycle.md` §4. Die Schleifen des Stores fangen je Resource, räumen ganz ab und reichen gesammelt nach.
- **`new RegExp(match)` mit `lastIndex = 0` je Name** statt Flags zu streichen (Audit: `match.flags.replace(/[gy]/g, '')`): Streichen änderte die Bedeutung von `y`, das mit `lastIndex` 0 am Namensanfang verankert; Zurücksetzen am übergebenen Objekt veränderte den `RegExp` des Aufrufers.
- **`TextureAtlasFrameData` bleibt als Name**, jetzt `TexturePackerFrameData`, statt zu verschwinden: er ist der Default des Typparameters, und bestehender Code, der ihn nennt, bekommt einen Typfehler an genau den Stellen, die `any` bisher verdeckte. `data?: D` macht den Frame ohne Daten möglich; ein `| undefined` im Default, wie die Entscheidung vom 2026-09-29 ihn nennt (»o. ä.«), ist damit schon enthalten.
- **`TileSet` wird mit generisch**: ohne das ließe sich ein `TileSet` nur noch auf einen Atlas mit TexturePacker-Daten setzen — eine Sackgasse, die die generische Atlas-API erst schafft. Mitgezogen wie die Entscheidung es verlangt.
- **`frameTrimMargins(data: unknown)`**: die Funktion prüft zur Laufzeit ohnehin jedes Feld; `unknown` sagt, was sie nimmt, und lässt `setFrame()` und `prepareSpriteFrame()` Frames jedes Atlas annehmen.
- **`maxTextureSize` schlägt `renderer`**: wer eine Zahl nennt, weiß es genauer als die Voreinstellung; ein Renderer ohne Device fällt still auf `MaxTextureSize` zurück wie `readMaxAnisotropy` auf 0.
- **Paket nicht geteilt**: Die Schleife liest die Marke nach Zug 0 von `### [.] 1.` (`remediate.sh`, `marker_of`) — `1a`/`1b` fände sie nicht und hielte an. Ein hinten angehängtes Paket brächte zwei Pakete in dieselben Dateien (`TileSet.ts` mit BUG-015 und TYPE-002, `TextureResource.ts` mit Block A und BUG-015) und einen zweiten CHANGELOG-Durchgang, ohne dass einer der Blöcke vom anderen abhinge. Dafür stärkste Stufe und Effort `high`: öffentliche API und Event-Semantik.

## Findings im Volltext

**BUG-009 · medium · src/texture/TextureAtlas.ts:74** — `lastIndex` eines RegExp mit `g`/`y`-Flag in `TextureAtlas#frameNames()` neutralisieren

Weitere Fundstellen: `src/texture/FrameBasedAnimations.ts:257`

`frameNames(match)` filtert mit `regex.test(name)` über alle Namen und reicht einen übergebenen RegExp unverändert durch. Trägt er das Flag `g` oder `y`, ist `test()` zustandsbehaftet: nach jedem Treffer beginnt die nächste Suche bei `lastIndex`, und Namen werden übersprungen. `frameNames(/walk/g)` über `walk.1`…`walk.4` liefert nur `walk.1` und `walk.3` (mit Node nachgestellt). Über `FrameBasedAnimations#add(name, timing, atlas, /walk/g)` entsteht so still eine Animation mit jedem zweiten Frame; ein zweiter Aufruf mit demselben RegExp-Objekt startet zudem bei einem Rest-`lastIndex`.

Beleg: `return frameNames.filter((name) => typeof name === 'string' && regex.test(name));`

Empfehlung: Vor dem Filtern `regex.lastIndex = 0` setzen und pro Name zurücksetzen, oder bei `g`/`y` einen Klon ohne diese Flags bauen (`new RegExp(match.source, match.flags.replace(/[gy]/g, ''))`). Einen Test mit `/walk/g` ergänzen.

**MEM-001 · medium · src/texture/TextureResource.ts:577** — Aufräumen in `TextureResource#dispose()` gegen einen werfenden `dispose`-Listener absichern

Weitere Fundstellen: `src/texture/TextureStore.ts:1110`, `src/texture/TextureStore.ts:1117`

`dispose()` setzt zuerst `#disposed = true` und ruft dann `emit(this, OnDispose)` mit dem einfachen `emit` von eventize, das beim ersten werfenden Listener abbricht und den Fehler durchreicht. Wirft ein Subscriber des `dispose`-Events, verlässt die Exception `dispose()` vor Zeile 582: die eigene Textur (`#ownTexture`) wird nie freigegeben, `SignalGroup.delete(this)` läuft nicht, die Effects bleiben registriert und reagieren weiter auf Signalwrites, `off(this)` entfernt keine Listener. Weil `#disposed` schon gesetzt ist, kehrt jeder weitere `dispose()`-Aufruf — auch der aus `TextureStore` — sofort zurück; die GPU-Textur bleibt bis zum Seitenende liegen. Nachfolgende Listener des Events hören es gar nicht.

Beleg: `this.#disposed = true;\n\n    emit(this, OnDispose);\n    ...\n    this.#ownTexture?.dispose();`

Empfehlung: Das Event mit `emitStrict` (alle Listener werden gerufen) in ein `try` legen und das Aufräumen (Textur freigeben, `SignalGroup.delete`, `off`) in den `finally`-Block ziehen; den Fehler danach weiterwerfen. Einen Test mit einem werfenden `dispose`-Listener ergänzen, der prüft, dass die Textur dennoch disposed wird.

**BUG-010 · medium · src/texture/TextureStore.ts:776** — `ready`- und `resource:<id>`-Events in `TextureStore#parse()` gegen werfende Listener absichern

Weitere Fundstellen: `src/texture/TextureStore.ts:779`, `src/texture/TextureStore.ts:665`, `src/texture/TextureStore.ts:677`

`parse()` sendet `ready`, `resource:<id>` und die Item-Fehler mit dem abbrechenden `emit`. Laut eventize-Typings schreibt `emit` bei einem werfenden Listener den retained Wert nicht und ruft die Listener dahinter nicht auf. Wirft ein früh registrierter `ready`-Listener der Anwendung, (1) bleibt der retained `ready`-Wert ungeschrieben — ein späteres `whenReady()`, `on()` oder `getAsync()` wartet bis zum nächsten `parse()`; (2) laufen die `once(OnReady)`-Handler bereits wartender `on()`-/`getAsync()`-Aufrufe nicht, deren Promises hängen; (3) entfallen alle `resource:<id>`-Ankündigungen und das `evictMissing`-Aufräumen, obwohl die Resources im Batch schon geschrieben sind; (4) meldet `loadAsync()` den Listener-Fehler als `parse`-Fehlschlag (Zeile 549) für einen Katalog, der tatsächlich geparst wurde. Ein werfender `error`-Listener in Zeile 665/677 bricht `parse()` sogar vor dem Batch ab, nachdem `defaultTextureClasses` in Zeile 662 bereits ersetzt wurde. `loadAsync()` selbst nutzt für denselben Fall bewusst `emitSafe` (Zeile 508).

Beleg: `emit(this, OnReady, this);\n\n    updatedResources.forEach((resource) => {\n      emit(this, `${OnResource}:${resource.id}`, resource);\n    });`

Empfehlung: Die Events aus `parse()` mit `emitStrict` senden (alle Listener laufen, retained Wert wird geschrieben) und den Fehler erst nach Ankündigungen und `evictMissing` weiterwerfen, oder konsequent `emitSafe` wie in `loadAsync()` nutzen. Die Item-`error`-Events ebenso. Test: werfender `ready`-Listener vor einem wartenden `getAsync()`.

**BUG-011 · medium · src/texture/FrameBasedAnimations.ts:158** — `FrameBasedAnimations.MaxTextureSize` an das Texturlimit des Devices binden

Weitere Fundstellen: `src/texture/FrameBasedAnimations.ts:115`, `src/texture/FrameBasedAnimations.ts:414`

`bakeDataTexture()` baut eine einzeilige `DataTexture` von `bufSize × 1` Texeln und prüft `bufSize` nur gegen `MaxTextureSize = 16384`. three.js' `WebGPUBackend` fordert ohne Zutun keine erhöhten Limits an (`requiredLimits` default `{}`, node_modules/three/src/renderers/webgpu/WebGPUBackend.js:93), das Device läuft also mit dem WebGPU-Default `maxTextureDimension2D = 8192`; WebGL2-Geräte garantieren nur 2048. Eine Bake mit 8193–16384 Texeln — bei getrimmten Frames (3 Texel/Frame) schon ab rund 2730 Frames — besteht die Prüfung, die Texturerzeugung scheitert aber auf der GPU mit einem Validierungsfehler statt mit der sprechenden Fehlermeldung aus Zeile 117, und die Animationen lesen nichts.

Beleg: `static MaxTextureSize = 16384;` · `const dataTexture = new DataTexture(floatsBuffer, bufSize, 1, RGBAFormat, FloatType);`

Empfehlung: Default auf 8192 (WebGPU-Mindestgarantie) senken oder `bakeDataTexture()` ein optionales Limit bzw. den Renderer übergeben lassen und dessen Limit (`device.limits.maxTextureDimension2D` bzw. `capabilities.maxTextureSize`) nutzen. Langfristig die Daten zweidimensional auslegen (Breite ≤ Limit, mehrere Zeilen), dann reicht auch ein kleines Limit für große Atlanten.

**CONS-001 · low · src/texture/frameTrimMargins.ts:6** — Lokale Kopie von `isFiniteNumber` in `frameTrimMargins.ts` durch den Helfer aus `utils/` ersetzen

`frameTrimMargins.ts` definiert `isFiniteNumber` als eigene Arrow-Function, obwohl `utils/isFiniteNumber.ts` denselben Type Guard wortgleich exportiert und `stage/` sowie `texture/` sonst aus `utils/` importieren. Zwei Kopien derselben Prüfung laufen auseinander, sobald eine davon geändert wird, etwa beim Umgang mit `-0` oder mit Boxed Numbers.

Beleg: `const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);`

Empfehlung: Die lokale Definition löschen und `import {isFiniteNumber} from '../utils/isFiniteNumber.js';` verwenden.

**BUG-014 · low · src/texture/TextureFactory.ts:187** — Seed-Defaults von `TextureFactory` mit übergebenen `defaultOptions` zusammenführen

Ohne `defaultOptions` startet die Factory von `{anisotropy: 0, flipY: false}`. Wer `defaultOptions` übergibt — etwa nur `{colorSpace: SRGBColorSpace}` —, ersetzt diesen Seed vollständig: `flipY` wird dann nie gesetzt, und `update()` lässt den three.js-Default `Texture#flipY = true` stehen. Dieselbe Klassenliste liefert so je nach Vorhandensein eines unbeteiligten Options-Objekts gespiegelte oder ungespiegelte Texturen. Im Repo übergibt derzeit niemand `defaultOptions`, die öffentliche Signatur lädt aber dazu ein.

Beleg: `const seedOptions: Partial<TextureOptions> = defaultOptions ?? {anisotropy: 0, flipY: false};`

Empfehlung: `{anisotropy: 0, flipY: false, ...defaultOptions}` als Seed verwenden oder das Ersetzungsverhalten im TSDoc der Konstruktorparameter ausdrücklich dokumentieren.

**BUG-015 · low · src/texture/TileSet.ts:93** — `TileSet#options` beim Konstruieren kopieren statt per Referenz halten

Weitere Fundstellen: `src/texture/TileSet.ts:115`, `src/texture/TileSet.ts:153`

`TileSet` speichert das übergebene Options-Objekt unverändert und liest `firstId`, `tileWidth`, `margin` usw. bei jedem Zugriff live daraus; das Layout der Frames entsteht aber einmalig im Konstruktor, wo auch die Validierung läuft. Über `TextureStore#parse()` → `TextureResource.fromTileSet()` ist dieses Objekt das `tileSet`-Objekt des Katalogs selbst. Mutiert der Aufrufer es danach (z. B. `firstId`), verschiebt `frameId()` sofort die Zuordnung tileId → frameId ohne Neulayout und ohne Prüfung; ein `firstId` als String würde in Zeile 153 konkateniert. Ein erneutes Setzen desselben Objekts erkennt `cmpShallow` als unverändert (`a === b`), der TileSet wird nicht neu gebaut.

Beleg: `this.options = options ?? {};` · `get firstId(): number { return this.options.firstId ?? 1; }`

Empfehlung: Im Konstruktor `this.options = Object.freeze({...options})` ablegen (und im `TextureResource`-Setter ebenso kopieren), sodass Layout, Validierung und Getter auf demselben Stand bleiben.

**PERF-020 · low · src/texture/TextureAtlas.ts:89** — Zufallsnamen in `TextureAtlas#randomFrameName()` ohne linearen Map-Durchlauf ziehen

Weitere Fundstellen: `src/texture/TextureAtlas.ts:121`

`randomFrameName()` iteriert pro Aufruf über die Keys der `#frameNames`-Map bis zum Zufallsindex, also O(n) je Name; `randomFrameNames(count)` ruft das `count`-mal auf und wird O(n·count). Beim Spawnen vieler Sprites mit zufälligem Frame-Namen aus einem großen Atlas (z. B. 10 000 Sprites × 1 000 Namen = 10⁷ Iterator-Schritte) landet das in einem einzigen Frame. `randomFrameId()`/`randomFrame()` sind dagegen O(1).

Beleg: `for (const name of this.#frameNames.keys()) { if (idx === randomIdx) { return name; } ++idx; }`

Empfehlung: Die Namen zusätzlich in einem Array in Einfügereihenfolge halten (in `add()` pflegen) und per Index ziehen; `frameNames()` ohne Argument kann dasselbe Array kopieren.

**TYPE-002 · low · src/texture/TextureAtlas.ts:3** — `TextureAtlasFrameData` als `Record<string, unknown>` oder als TexturePacker-Typ deklarieren

Weitere Fundstellen: `src/texture/frameTrimMargins.ts:29`

Das öffentliche `TextureAtlasFrameData = Record<string, any>` macht `frame.data` zu einem ungeprüften `any`-Beutel: `frame.data.spriteSourceSize.w` kompiliert ohne Null-Check. `frameTrimMargins()` fängt das nur ab, weil es die Werte händisch nach `unknown` zieht; jeder andere Konsument (etwa App-Code, der Pivot oder `sourceSize` liest) bekommt keine Hilfe vom Compiler. `TexturePackerJson.parse()` legt dort stets ein `TexturePackerFrameData` ab.

Beleg: `export type TextureAtlasFrameData = Record<string, any>;`

Empfehlung: Auf `Record<string, unknown>` umstellen (oder generisch `TextureAtlas<D = TexturePackerFrameData | undefined>`) und die Stellen, die heute implizit auf `any` bauen, explizit narrowen.
