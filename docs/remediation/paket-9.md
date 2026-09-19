# Paket 9 — texture: Nachtrag — eine abgewiesene TileSet-Option lässt kein TileSet aus anderen Optionen stehen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 3 (d90a308)
- Findings: — (Folge aus Paket 3, kein Audit-Finding)
- Ziel: Eine `TextureResource`, deren `tileSetOptions` von `new TileSet()` abgewiesen werden, meldet den Fehler und bietet kein TileSet, keinen Atlas und keine Animationen an, die aus anderen als ihren aktuellen Optionen gebaut sind.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TextureResource.ts`
  - `packages/twopoint5d/src/texture/TextureResource.spec.ts`
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts`
  - `packages/twopoint5d/CHANGELOG.md`
- Kein Browsertest: `TextureResource` ist Signal- und Event-Logik, kein Rendering- oder GPU-Buffer-Code; die Store-Pfade, die ein Browser sieht (`texture-store-on.test.js`), laufen über `TextureStore#on()`, das `undefined` ohnehin filtert und dessen Verhalten sich hier nur für den abgewiesenen Fall ändert.

## Abgleich (Zug 0, gegen `4e45acc`)

- **Folge aus Paket 3 — unverändert.** `TextureResource.ts:584-594`: der TileSet-Effekt
  schreibt `tileSetSignal`/`atlasSignal` nur, wenn `new TileSet(this.imageCoords, this.tileSetOptions)`
  gelingt. Wirft der Konstruktor (`RangeError` seit d90a308), bleiben TileSet und Atlas der
  vorigen Optionen stehen; der Animations-Effekt `TextureResource.ts:596-628` hängt nur an
  `tileSetSignal` und `#frameBasedAnimationsData` und hält die alten `frameBasedAnimations`.
  Die Bridges `TextureResource.ts:490-508` emittieren nichts, die retained Events halten die
  alten Werte — ein später Abonnent, auch `TextureStore#on()`/`#get()`, bekommt sie.
- **Zweite Fundstelle derselben Folge (neu in Zug 0).** Der Throw verlässt den Effekt. Läuft er im
  `batch()` des Bild-Effekts (`TextureResource.ts:538-542`, das Bild kommt mit abgewiesenen
  Optionen an), re-raised `batch()`, und die Übergabe `TextureResource.ts:545-547`
  (`#ownTexture = texture`, Vorgänger `dispose()`) fällt aus: die neue Textur steht auf dem
  Signal, gehört aber niemandem — `dispose()` gibt sie nie frei, der Vorgänger lebt bis
  `dispose()`. Beleg, dass der Batch wirft: der einzige Emitter von `{source: 'texture'}` ist das
  `.catch` in `TextureResource.ts:556-565`, und der Test
  `error sources › a tile set that is refused is reported as a texture failure`
  (`TextureResource.spec.ts:780`) sieht genau diesen Payload.
- **Dritte Fundstelle derselben Folge.** Läuft der Effekt über einen Setter
  (`resource.tileSetOptions = …` oder `TextureStore#parse()` mit geänderten `tileSet`-Optionen für
  eine geladene Resource, `TextureStore.ts:466-471`), re-raised signalize den Throw an den
  Schreiber: der Setter wirft, `parse()` wirft nach allen Schreibzugriffen aus dem äußeren
  `batch()` und lässt `ready` und die `resource:<id>`-Events aus. Kein `error`-Event — gegen den
  Vertrag, den Paket 3 in den CHANGELOG geschrieben hat (`CHANGELOG.md:200`: »a `TextureResource`
  reports it as an `error` with `source: 'texture'`«).
- **Mitgenommen, vorbestehend, gleiche Ursache.** `TextureResource.ts:586`: die Bedingung
  `this.imageCoords && this.tileSetOptions` lässt bei `resource.tileSetOptions = undefined` (der
  Setter nimmt `undefined`, `TextureResource.ts:351-355`) TileSet, Atlas und Animationen der
  vorigen Optionen stehen. Vorbestehend: `git show e352b56:packages/twopoint5d/src/texture/TextureResource.ts`
  Zeile 573 trägt dieselbe Bedingung. Gleiche Ursache: der Effekt schreibt nur ein gelungenes
  Ergebnis und nimmt nie eines zurück — ob die aktuellen Optionen abgewiesen werden oder fehlen,
  macht für den stehengebliebenen Zustand keinen Unterschied. Kostet im Umbau eine Zeile.
- **Nicht mitgenommen (→ »Offene Befunde«).** Dieselbe ausgefallene Übergabe von `#ownTexture`
  über den Atlas-Weg: ein `atlasJson`, von außen gesetzt, dessen Frames
  `TexturePackerJson.parse()` nicht lesen kann (`{frames: {a: {}}}` → `TypeError` bei
  `frame.x`), wirft im Atlas-Effekt innerhalb des Bild-Batches. Vorbestehend (dieselbe Struktur
  in `e352b56` Zeile 525-533), eigene Ursache: die Übergabe steht hinter einem `batch()`, der
  abgeleitete Fehler re-raised. Nach diesem Paket wirft der TileSet-Effekt nicht mehr, der
  Atlas-Weg bleibt.

Triage der übrigen Queue: keiner der offenen Befunde teilt die Ursache. Die texture-Einträge
(`TileSet.ts:147-148` gebrochenes `padding`, `TileSet.ts:67` Typ von `options`,
`TileSetLoader.ts:33` Signatur) sitzen in `TileSet` bzw. dem Loader, nicht im Effekt der
Resource. Weitere `Folgen:`-Zeilen gibt es nicht (Pakete 2, 4, 8: keine; Paket 1 ging in Paket 8).

Restplan: unverändert. Die offenen Pakete 5 (`display/`, `controls/`, eine Zeile
`stage/StageRenderer.ts`), 6 (`utils/`, `sprites/AnimatedSprites/`) und 7 (`scripts/`, Lookbook)
fassen `texture/` nicht an; keine verschobene Fundstelle und kein weggefallenes Finding.

## Entscheidungen dieses Pakets (Zug 0)

1. **Der TileSet-Effekt fängt die Abweisung selbst und meldet sie als `error`-Event**, statt sie
   weiterzuwerfen. Grund: nur so erreicht sie beide Wege gleich — den Bild-Batch (dort bleibt die
   Textur-Übergabe intakt) und den Setter bzw. `parse()` (der Schreiber bekommt keinen Throw,
   `parse()` läuft ganz durch, `ready` feuert). Payload unverändert
   `{source: 'texture', id, error}` — der Test aus Paket 3 bleibt grün, und der CHANGELOG-Vertrag
   aus Paket 3 gilt danach für beide Wege. Dieselbe Machart haben die Animations-Effekte schon
   (`TextureResource.ts:616-621`, `765-770`): fangen, melden, weiterlaufen.
2. **Zurückgenommen wird auf den Signalen, angekündigt wird kein `undefined`.** Die drei Signale
   `#tileSet`, `#atlas`, `#frameBasedAnimations` gehen auf `undefined` (die Getter antworten
   `undefined`), die Bridges emittieren dafür nichts, sondern leeren das retained Event mit
   `retainClear()` aus `@spearwolf/eventize` (6.2.0, vorhanden). Grund: das Modul verspricht an
   drei Stellen, dass ein Event nie `undefined` trägt, wo sein Typ einen Wert zusagt
   (`TextureResource.ts:694-695`, `734-737`, `456-458`; `CHANGELOG.md:48`); ein direkter
   Abonnent (`on(resource, 'tileSet', …)`) bekäme sonst eines. Ohne `retainClear()` bekäme ein
   später Abonnent — und `TextureStore#on()` mit einfachem Subtyp, das den Event-Wert
   weiterreicht (`TextureStore.ts:636-642`) — den zurückgenommenen Wert aus dem Retain.
3. **Der TileSet-Effekt nimmt alle drei selbst zurück, bevor er den Fehler emittiert** — auch
   `#frameBasedAnimations`, obwohl der Animations-Effekt es sonst schreibt. Grund: läuft der
   TileSet-Effekt in einem Batch-Flush (Bild-Batch, `parse()`), wird der Animations-Effekt erst
   nach ihm fällig; ein `error`-Listener, der die Resource liest, sähe sonst noch die alten
   Animationen. Der Animations-Effekt bleibt unverändert: bei `tileSet === undefined` tut er
   nichts.
4. **Keine Änderung an `TextureStore`.** `on()`/`get()` lesen bei Tupeln die Getter
   (`TextureStore.ts:614-627`) und filtern beim einfachen Subtyp `null`/`undefined`; mit
   Entscheidung 2 kommt dort kein `undefined` mehr an, und nach `retainClear()` wartet ein neuer
   Abonnent bzw. ein `get()` auf das nächste gebaute TileSet. Die TSDoc von `TextureStore#on()`
   bleibt wahr.

## Vorgehen

Tests zuerst (Schritt 1), rot sehen und den roten Lauf in den Report, dann Schritt 2–5.

1. **Regressionstests.**

   In `packages/twopoint5d/src/texture/TextureResource.spec.ts` ein neuer Block
   `describe('tile set options that are refused', …)` hinter `describe('error sources', …)`
   (endet bei Zeile 805). Muster wie der Test in Zeile 780: `ImageLoader.prototype.loadAsync`
   per `vi.spyOn` auf `{width: 64, height: 64, tag: 'tiles'}`, `makeTextureFactory()`,
   `flushMicrotasks()`, am Ende `resource.dispose()`. Gültige Optionen:
   `{tileWidth: 16, tileHeight: 16}`; abgewiesene: `{tileWidth: 0, tileHeight: 16, tileCount: 4}`
   (der `tileCount` hält das Layout endlich); Animationsdaten:
   `{walk: {duration: 1, firstTileId: 1, tileCount: 2}}`.

   | Test | Ablauf | Erwartung | vor dem Fix |
   | --- | --- | --- | --- |
   | `options that are refused take the tile set, the atlas and the animations back` | Resource mit gültigen Optionen und Animationsdaten laden, Getter sind gesetzt; `error`-Listener, der beim Aufruf `resource.tileSet`, `resource.atlas`, `resource.frameBasedAnimations` mitschreibt; dann `resource.tileSetOptions = <abgewiesen>` | Zuweisung wirft nicht; genau ein Error `{source: 'texture', id: 'tiles'}` mit `RangeError`; im Listener und danach alle drei Getter `undefined` | rot (Setter wirft) |
   | `a subscriber that arrives after the refusal is handed nothing built from other options` | wie oben bis nach der Abweisung (Zuweisung im Test in `try/catch`, damit der Test vor dem Fix bis zur Prüfung kommt); dann `on(resource, 'tileSet' \| 'atlas' \| 'frameBasedAnimations', spy)` | kein Spy aufgerufen | rot (Retain liefert Altwerte) |
   | `a subscriber is never handed undefined when a tile set is taken back` | Abonnenten auf die drei Events vor der Abweisung, Werte mitschreiben; Abweisung (in `try/catch`) | kein mitgeschriebener Wert ist `undefined` | Wächter, grün |
   | `options that work again bring a tile set, an atlas and animations back` | nach der Abweisung (in `try/catch`) `resource.tileSetOptions = {tileWidth: 32, tileHeight: 32}` | drei Getter gesetzt, `resource.tileSet.tileWidth === 32`; ein vor der Abweisung registrierter `tileSet`-Abonnent bekommt das neue TileSet | Wächter, grün |
   | `options that are cleared take the tile set, the atlas and the animations back` | geladen mit gültigen Optionen, dann `resource.tileSetOptions = undefined` | drei Getter `undefined`, kein `error`-Event, später Abonnent bekommt nichts | rot |
   | `a tile set refused on the first image leaves the texture to the resource` | Resource von Beginn an mit abgewiesenen Optionen, laden, Factory setzen, flushen; `resource.texture` ist gesetzt; `resource.dispose()` | `textures[0].disposed === true` | rot (`#ownTexture` nie gesetzt) |

   In `packages/twopoint5d/src/texture/TextureStore.spec.ts` ein Test hinter
   `a parse without the overrideImageUrl gives the atlas its json image back`
   (beginnt bei Zeile 1334, gleiches Muster: `store.parse`, `store.on(…)` hält die Resource
   geladen, `await store.whenResource(id)`, `resource.textureFactory = factory as never`, zweimal
   `flushMicrotasks()`):

   | Test | Ablauf | Erwartung | vor dem Fix |
   | --- | --- | --- | --- |
   | `a parse that refuses the tile set options of a loaded resource reports it and completes` | `items: {t: {imageUrl: 'tiles.png', tileSet: {tileWidth: 16, tileHeight: 16}}}`, `store.on('t', 'tileSet', …)`, laden bis `resource.tileSet` gesetzt ist; `error`-Listener auf der **Resource**, `ready`-Zähler auf dem Store (nach dem ersten `parse()` registriert — das retained `ready` zählt dabei einmal); zweiter `parse()` mit `tileSet: {tileWidth: 0, tileHeight: 16, tileCount: 4}`; danach neuer `store.on('t', 'tileSet', spy)` | `parse()` wirft nicht; der `ready`-Zähler steht nach dem zweiten `parse()` um eins höher; ein Error `{source: 'texture', id: 't'}`; `resource.tileSet` `undefined`; `spy` nicht aufgerufen | rot (`parse()` wirft) |

2. **Bridges** in `load()` (`TextureResource.ts:488-508`). `retainClear` zum Import aus
   `@spearwolf/eventize` (Zeile 1) hinzufügen. Die fünf `onChange`-Bridges durch einen lokalen
   Helfer ersetzen, der für alle fünf gilt (eine Regel für alle Ausgaben; heute können nur
   `tileSet`, `atlas` und `frameBasedAnimations` zu Lebzeiten der Resource auf `undefined` gehen,
   `texture` wird in `dispose()` stummgeschaltet):

   ```ts
   // A value that is taken back is not announced: a subscriber would get an `undefined`
   // where the event promises a value. The retained event is cleared instead, so a
   // subscriber that arrives later waits for the next value rather than being handed
   // the one that was taken back.
   const publish = (signal: Signal<unknown> | undefined, event: TextureResourceSubType) => {
     signal?.onChange((value) => {
       if (value === undefined) {
         retainClear(this, event);
       } else {
         emit(this, event, value);
       }
     });
   };
   ```

   Aufrufe: `publish(this.#imageCoords, 'imageCoords')`, `publish(this.#atlas, 'atlas')`,
   `publish(this.#tileSet, 'tileSet')`, `publish(this.#frameBasedAnimations, 'frameBasedAnimations')`,
   `publish(this.#texture, 'texture')`. Der Kommentar »these bridges end with the signals they
   read …« bleibt darüber stehen. Passt `Signal<unknown>` nicht zu den konkreten Signaltypen
   (Varianz), den Parameter generisch machen (`<T>(signal: Signal<T | undefined> | undefined, …)`),
   keinen Cast.

3. **TileSet-Effekt** (`TextureResource.ts:584-594`). Neuer Rumpf, Abhängigkeiten und Optionen
   (`[this.#imageCoords, tileSetOptionsSignal]`, `{attach: this, priority: DERIVED_FROM_IMAGE_PRIORITY}`)
   unverändert:

   ```ts
   () => {
     const imageCoords = this.imageCoords;
     if (!imageCoords) return;
     const options = this.tileSetOptions;

     let tileSet: TileSet | undefined;
     let refusal: {error: unknown} | undefined;
     if (options) {
       try {
         tileSet = new TileSet(imageCoords, options);
       } catch (error) {
         refusal = {error};
       }
     }

     if (tileSet) {
       tileSetSignal.set(tileSet);
       atlasSignal.set(tileSet.atlas);
       return;
     }

     // <Kommentar, siehe unten>
     tileSetSignal.set(undefined);
     atlasSignal.set(undefined);
     this.#frameBasedAnimations.set(undefined);

     if (refusal) {
       emit(this, OnError, {source: 'texture', id: this.id, error: refusal.error});
     }
   }
   ```

   - Das `try` umschließt **nur** `new TileSet(…)`. Ein `set()` im `try` würde einen Fehler aus
     nachgelagerten Effekten oder Bridges als Abweisung melden.
   - Kommentar vor dem Zurücknehmen, sinngemäß auf Englisch: nothing on the resource may have been
     built from options other than the current ones, so without a tile set from the current
     options the tile set, its atlas and the animations built on it are taken back — the
     animations here as well, because inside a batch the animation effect runs after this one
     and an error listener reading the resource would still find them. A refusal is reported
     here instead of thrown: thrown, it would reach whoever wrote the options — a setter, a
     `TextureStore#parse()` cut short before its ready event — or the image effect, whose
     batch would then skip handing over the texture.
   - Die Zeile »A tileset resource creates these signals …« (Zeile 579) und die Guards darüber
     bleiben.

4. **Kommentar und TSDoc in `TextureResource.ts` angleichen.**
   - `.catch`-Kommentar (`TextureResource.ts:557-562`): »texture creation, or any of the
     atlas/tileSet/frameBasedAnimations effects it derives« stimmt danach nicht mehr — der
     TileSet-Effekt meldet selbst, die Animations-Effekte fangen je Eintrag. Ersetzen durch
     sinngemäß »texture creation, or an effect derived from the image that throws — the atlas
     effect«; der Rest des Kommentars bleibt.
   - TSDoc `TextureResourceEvents` (`TextureResource.ts:63-84`): hinter dem Satz zu
     `{source: 'texture', id, error}` ergänzen, sinngemäß: »A tile set that `TileSet` refuses is
     reported here whether the image arrives or the `tileSetOptions` change; the write that
     changed them does not throw.«
   - Klassen-TSDoc (`TextureResource.ts:169-192`), Absatz **Output**: ergänzen, sinngemäß: »A
     tile set resource takes its `tileSet`, `atlas` and `frameBasedAnimations` back while its
     `tileSetOptions` are cleared or refused by `TileSet`: the getters answer `undefined`, and
     rather than announcing `undefined` the retained events are cleared, so a subscriber that
     arrives later waits for the next value.«
   - Kein Satz über einen Vorzustand (Konventionen).

5. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, Skill `updating-changelog`): ein neuer
   Eintrag unter `## [Unreleased]` → `### Fixed`, direkt hinter den drei Einträgen aus Paket 3
   (Zeilen 200-202). Inhalt, eigene Worte, im Präsens, ohne »stayed«/»previously«: eine
   Tile-Set-`TextureResource`, deren `tileSetOptions` `TileSet` abweist oder die geleert werden,
   bietet kein `tileSet`, keinen `atlas` und keine `frameBasedAnimations` aus früheren Optionen
   an — die Getter antworten `undefined`, die retained Events werden geleert statt `undefined`
   zu tragen, ein späterer `TextureStore#on()`/`#get()` wartet auf das nächste TileSet; eine
   Abweisung kommt als `error` mit `source: 'texture'`, gleich ob das Bild eintrifft oder die
   Optionen sich ändern, und weder der Setter noch `TextureStore#parse()` werfen deshalb.
   Kein Migration-Guide-Abschnitt: keine Signatur und kein Export ändert sich.

- Verify: `pnpm run ci`
  (roter Lauf vorab gezielt: `pnpm nx test twopoint5d -- src/texture/TextureResource.spec.ts src/texture/TextureStore.spec.ts`)
- Commit: `fix(texture): take back the tile set, atlas and animations of tile set options that are refused or cleared, and report a refused tile set as an error event instead of throwing at the writer`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht · Folge aus Paket 3 unverändert an `TextureResource.ts:584-594` (Animationen `596-628`, Bridges `490-508`) · dazu zwei Fundstellen derselben Folge: ausgefallene Textur-Übergabe `538-547` im Bild-Batch, Throw an Setter/`parse()` (`TextureStore.ts:466-471`) · mitgenommen: `tileSetOptions = undefined` (`TextureResource.ts:586`, vorbestehend seit e352b56) · Nebenbefund Übergabe über den Atlas-Weg → »Offene Befunde« (→ Scope) · keine weiteren Folgen zu verteilen · Restplan unverändert
  - 2026-09-19 Zug 1: Implementierer beauftragt, mittlere Stufe (sonnet), Effort medium · Brief `paket-9.impl-1.brief.md`, Report `paket-9.impl-1.json` im Arbeitsverzeichnis
  - 2026-09-19 Zug 2: Report `FERTIG_MIT_VORBEHALT` · geändert `TextureResource.ts`, `TextureResource.spec.ts`, `TextureStore.spec.ts`, `CHANGELOG.md` · roter Lauf 5 rot / 107 grün (die 5 erwarteten, 2 Wächter grün) · Vorbehalt: `pnpm run ci` Exit 1 nur in `test:browser` (Firefox-Disconnect, laut Report auch auf dem gestashten Ausgangsstand) · 3 Nebenbefunde gemeldet · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer beauftragt (opus, Effort medium) · Diff `paket-9.diff` im Arbeitsverzeichnis (500 Zeilen)
  - 2026-09-19 Zug 3: Reviewer-Urteil Freigabe · F1, F2, F3, M1 behoben · 3 kleine Befunde, keine Runde nötig
  - 2026-09-19 Zug 4: keine Runde (nichts offen außer Verify)
  - 2026-09-19 Zug 5: `pnpm run ci` Exit 1 (`paket-9.verify.log`) — alle Stufen bis `test:ci` grün, `test:browser` scheitert an 8 Firefox-Disconnects in texture-fremden Dateien · Gegenprobe auf `4e45acc` ohne die Änderung, nur Browsertest ohne Nx-Cache: ebenfalls Exit 1, 5 Disconnects (`paket-9.baseline-browser.log`) · Ursache Umgebung: Kernel meldet ab 19:39 `NVRM: GPU0 rpcRmApiAlloc_GSP: GspRmAlloc failed … NV_ERR_STATE_IN_USE`, Firefox (WebGPU) stirbt mit Coredumps · nicht committet
  - 2026-09-19 blockiert: Arbeitsbaum im Stash `paket-9-abgebrochen` (vier Dateien: `TextureResource.ts`, `TextureResource.spec.ts`, `TextureStore.spec.ts`, `CHANGELOG.md`) — Implementierung fertig und vom Reviewer freigegeben; es fehlt nur ein grünes Gate

## Folge im Volltext

Aus Paket 3, `Folgen:`-Zeile im Plan:

> `packages/twopoint5d/src/texture/TextureResource.ts:580-590` — der TileSet-Effekt setzt
> `tileSetSignal` nur bei Erfolg; weist `new TileSet()` geänderte `tileSetOptions` ab, bleibt das
> zuvor gebaute TileSet auf `resource.tileSet` stehen (samt der Animationen, die daran hängen),
> obwohl ein Fehler gemeldet wird — vor dem Paket hing die Seite dort, jetzt ist der Zustand
> erreichbar.

Einordnung (Zug 0 von Paket 4): Symptom — hätte Paket 3 seine Ursache bis zum einzigen Aufrufer
von `new TileSet()` in der Resource zu Ende geführt (Ziel: fehlerhafte Katalogdaten enden als
benannter Fehler statt in verlorenem Zustand), gäbe es den Eintrag nicht.

## Wiederaufnahme

Die Implementierung ist fertig und reviewt, es fehlt nur `pnpm run ci` mit Exit 0. Sobald der
Browsertest auf dieser Maschine wieder läuft (GPU/Treiber frei, etwa nach Neustart oder ohne
parallel laufende GPU-Last): `git stash pop` (Stash `paket-9-abgebrochen`), `pnpm run ci`
(mit frischem Browserlauf, nicht aus dem Nx-Cache), dann committen mit der Message oben. Kein
neuer Implementierer und kein neuer Review nötig — Report `paket-9.impl-1.json`, Review
`paket-9.review-1.json` und Diff `paket-9.diff` liegen im Arbeitsverzeichnis.

## Urteil des Reviewers (Runde 1, `paket-9.review-1.json`)

- F1 (Folge aus Paket 3: abgewiesene Optionen lassen TileSet/Atlas/Animationen stehen) — behoben — `TextureResource.ts:588-633` (Stand des Stashes): TileSet-Effekt nimmt `#tileSet`, `#atlas`, `#frameBasedAnimations` vor dem `error`-Event zurück; Bridge `publish()` (`:497-505`) leert das retained Event per `retainClear()`
- F2 (ausgefallene Übergabe von `#ownTexture` im Bild-Batch) — behoben — `TextureResource.ts:604-609` mit `:545-552`: `try` nur um `new TileSet(…)`, der Bild-Batch wirft nicht mehr; Test `a tile set refused on the first image leaves the texture to the resource`
- F3 (Throw an Setter bzw. `TextureStore#parse()`) — behoben — `TextureResource.ts:630-632`: Abweisung als `{source: 'texture', id, error}`; Setter-Test und `TextureStore.spec.ts:1372ff`
- M1 (`tileSetOptions = undefined`) — behoben — `TextureResource.ts:600-627`; Test `options that are cleared take the tile set, the atlas and the animations back`
- Konventionen erfüllt, Commit-Message konform, kein Aufrufer mit alter Signatur

Kleine Befunde (lösen keine Runde aus):
- `TextureResource.spec.ts:836-844` — Kommentare an `refuse()` beschreiben die rote Phase vor dem Fix (»the write does not throw once a refusal is reported instead … either way«); das `try/catch` ist danach totes Gerüst
- `TextureResource.ts:66-67` — TSDoc von `TextureResourceEvents` sagt weiter nur »retained — late subscribers see the latest value«; die Einschränkung (zurückgenommen heißt geleert) steht nur in der Klassen-TSDoc
- `TextureResource.spec.ts`, Test `options that are cleared …` — prüft den späten Abonnenten nur für `tileSet`, nicht für `atlas` und `frameBasedAnimations`

## Nebenbefunde (Urteilsbegründung)

- Animations-Effekte schreiben nur bei `tileSet && this.frameBasedAnimationsData` bzw. `atlas && …`: gemeldet von Implementierer. Bug (stehengebliebener Zustand), Scope-Regel greift, low. Nicht in dieses Paket: anderer Effekt, vom Detailplan nicht erfasst; die Drain-Runde entscheidet.
- Effekt-Registrierung in `load()` hängt am Wert bei `load()`: gemeldet von Implementierer und Reviewer. Bug, low, über `TextureStore` kaum erreichbar. Scope.
