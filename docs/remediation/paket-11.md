# Paket 11 — Texture-Ladepfade, die still danebengehen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Nebenbefunde: `TextureAtlasLoader.ts:87` (low), `TextureResource.ts:522` (low),
  `TextureResource.ts:617-639` (low) — alle drei aus der Drain-Runde vom
  2026-09-08, alle drei vorbestehend, alle drei `→ Scope`
- Ziel: Jeder Wurf auf einem Ladepfad erreicht den Aufrufer, und zwar als das,
  was er ist: keine Promise, die nie settlet, kein Bild-Fehler mit einer URL,
  die nie gescheitert ist, und kein stilles Ausbleiben der Textur, weil eine
  Atlas-JSON ungeprüft durchlief.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/isAtlasJsonResponse.ts` (neu, intern)
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts`
  - `packages/twopoint5d/src/texture/TextureStore.ts` (nur TSDoc)
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.spec.ts`
  - `packages/twopoint5d/src/texture/TextureResource.spec.ts`
- Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
- Commit: `fix(twopoint5d): name every failure on a texture load by its own source and let none of them hang`

## Abgleich (Zug 0, 2026-09-08)

Alle drei Sachverhalte bestehen. Zwei sind gewandert, einer ist in seiner
Wirkung genauer zu fassen als der Befundtext ihn fasst.

**`TextureAtlasLoader.ts:87` → jetzt `:102`.** Der Aufruf
`TexturePackerJson.parse(atlasJson, texCoords)` steht im `onLoad`-Callback von
`textureImageLoader.load(...)`, der seinerseits im `onLoad` des
`PowerOf2ImageLoader` und damit im `load`-Event-Handler des three.js-`ImageLoader`
liegt. Von dort führt kein Weg zurück in die Promise, die `loadAsync()`
(`:117-125`) um `load()` legt: `onErrorCallback` ist `reject`, und der Wurf sieht
ihn nie. Der Aufrufer wartet für immer.

Paket 9 hat den Guard `isAtlasJsonResponse` (`:43-51`) eine Ebene tiefer geführt
— `frames`-Einträge und `meta.size` werden jetzt auf Zahlen geprüft. Damit ist
der *konkrete* Wurf durch eine Eingabe nicht mehr auslösbar:
`TexturePackerJson.parse()` baut nur `TextureCoords` (wirft nie) und ruft
`TextureAtlas#add()`, dessen einziger Wurf ein doppelter Frame-Name ist, und
über `Object.entries()` eines frischen Atlas kann keiner entstehen. Der
*Mechanismus* steht unverändert, und der Befund meint ihn: jede Zeile, die je
in dieses Callback wandert, hängt die Promise.

**`TextureResource.ts:522` → jetzt `:527` (`.catch`), Meldung auf `:529`.** Der
`.catch` hängt hinter einem `.then`, das drei Dinge tut, die werfen können:
`factory.create(...)` (`:513`), das `batch(...)` (`:516-521`) und
`previous?.dispose()` (`:526`). Das `batch()` ist der interessante Fall, und die
Semantik von signalize macht ihn hart: Propagation läuft inline, ein Effekt, der
wirft, wird isoliert und sein Fehler am Ende der Zustellung an den Schreiber
**herausgeworfen** — mehrere zugleich als `AggregateError`. Der Schreiber ist
hier das `batch()` selbst, also landet der Fehler eines abgeleiteten Effekts
(Atlas, TileSet, Animationen) im `.then` und von dort im `.catch`, der ihn als
`{source: 'image', url, error}` meldet. Der Bild-Fetch ist da längst geglückt.

**`TextureResource.ts:617-639` → jetzt `:605-670`.** Der `atlasUrl`-Block. Der
Fetch-Effekt (`:605-636`) prüft `response.ok`, nimmt dann `await
response.json()` (`:624`) und legt das Ergebnis ungeprüft auf `this.atlasJson`
(`:626`). Beide Ausgänge bestehen, der erste anders als notiert:

- Eine 200-Antwort, die keine Atlas-JSON ist: der `imageUrl`-Effekt (`:642-648`)
  liest `atlasJson.meta.image` und wirft auf einem fehlenden `meta`. Der Wurf
  bleibt aber nicht liegen — `this.atlasJson = …` schreibt ein Signal, die
  Effekte laufen synchron darin, und der Wurf kommt am `set()` wieder heraus,
  also in das `try` des Fetch-Effekts, das ihn als `{source: 'atlas', url,
  error}` meldet. Der Aufrufer erfährt es damit, aber als rohen `TypeError`
  statt als Aussage, und die Meldung hängt daran, dass ein Wurf aus einem Effekt
  zufällig zu seinem Schreiber zurückfindet. Der Kommentar auf `:614-615`
  beschreibt genau diesen Weg als den, den die Statusprüfung abwenden soll — für
  eine 200-Antwort wendet ihn niemand ab.
- Eine JSON mit `meta.size`, aber ohne `meta.image`, ohne `overrideImageUrl`:
  `#imageUrl.set(undefined)` (`:646`), der Bild-Effekt kehrt an seinem
  `if (!factory || !url) return` (`:500`) um, der Atlas-Effekt an seinem
  `if (atlasJson && imageCoords)` (`:657`), weil ohne Bild keine `imageCoords`
  entstehen. Keine Textur, kein Event, kein Wurf. Still, wie notiert.

`PowerOf2ImageLoader.ts` und `TextureImageLoader.ts` sind in diesem Lauf nie
angefasst worden (`git log a9f7dd1..HEAD` auf beide ist leer).

## Vorgehen

### 1. Der Guard bekommt ein eigenes Modul

Neue Datei `packages/twopoint5d/src/texture/isAtlasJsonResponse.ts`. Sie
übernimmt aus `TextureAtlasLoader.ts` unverändert, samt der Kommentare, die
darüber stehen:

- den Typ `AtlasJsonResponse` (`:26-31`), exportiert
- `isFrameData` (`:35-41`), modul-lokal
- `isAtlasJsonResponse` (`:43-51`), exportiert

`TextureAtlasLoader.ts` importiert beides von dort (`import type
{AtlasJsonResponse}` und `import {isAtlasJsonResponse}`, mit `.js`-Suffix nach
NodeNext) und behält sonst alles.

Die Datei kommt **nicht** in `texture/public-api.ts`. Der Guard ist ein interner
Helfer, und das Repo hat das Muster dafür — `controls/readOption.ts`,
`utils/expectDefined.ts`, ein Dutzend Dateien unter `vertex-objects/`. Ihn dort
einzutragen, machte ihn zu öffentlicher Fläche, die niemand bestellt hat.

### 2. Der Parse-Wurf im Loader erreicht den Fehler-Callback

`TextureAtlasLoader.ts:102`. Der Aufruf `TexturePackerJson.parse(atlasJson,
texCoords)` kommt in ein `try`, dessen `catch` den Fehler an
`onErrorCallback?.(error)` gibt und danach zurückkehrt.

Der `onLoadCallback(...)` auf `:104` bleibt **außerhalb** des `try`. Läge er
darin, würde ein Wurf aus dem Callback des Aufrufers als Ladefehler gemeldet —
genau die Verwechslung, die Schritt 4 an der anderen Stelle abstellt.

Ein Kommentar sagt, warum die Absicherung nötig ist: das Callback läuft im
`load`-Event des Bildes, und von dort erreicht ein Wurf weder den
`onErrorCallback` noch die Promise, die `loadAsync()` darum legt.

### 3. Regressionstest für den Loader

`TextureAtlasLoader.spec.ts`, ein Test in der vorhandenen `describe`-Gruppe:
»a parse that throws rejects instead of leaving the promise open«.

Der Hebel ist `vi.spyOn(TexturePackerJson, 'parse').mockImplementation(() => {
throw new Error('…') })` — nicht eine kaputte JSON, weil der vertiefte Guard
keine mehr durchlässt, aus der `parse()` wirft (siehe Abgleich). Der Test nagelt
den Weg fest, nicht den einen Wurf. Dazu die vorhandenen Stubs
`fileLoaderAnswering(atlasJsonNamingAnImage)` und `imageLoaderAnswering()`, dann
`await expect(loader.loadAsync('atlas.json')).rejects.toThrow(…)`.

Rot zuerst: ohne Schritt 2 läuft dieser Test in den Timeout, weil die Promise
nie settlet. Ein Test, der erst nach dem Fix geschrieben wird, beweist hier
nichts — der Timeout ist der Beweis.

`packages/twopoint5d/vite.config.ts` setzt `restoreMocks: true` (`:13`), ein
eigenes Aufräumen des Spies ist also nicht nötig; das explizite `mockRestore()`
am Testende folgt trotzdem dem Muster der Nachbardateien.

### 4. Ein Fehler hinter dem geglückten Bild-Fetch heißt nicht mehr Bild-Fehler

`TextureResource.ts:508-530`. Die Kette wird auf die zweiparametrige Form
umgestellt:

```ts
(source ? source.acquire(url) : new ImageLoader().loadAsync(url))
  .then(
    (image) => { /* unverändert: create, batch, previous?.dispose() */ },
    (error) => {
      if (aborted) return;
      emit(this, OnError, {source: 'image', url, error});
    },
  )
  .catch((error) => {
    if (aborted) return;
    emit(this, OnError, {source: 'texture', id: this.id, error});
  });
```

Der zweite Parameter von `.then()` sieht ausschließlich die Rejection des
Bild-Ladens — das ist der eine Fall, für den `{source: 'image', url}` stimmt.
Der nachgehängte `.catch` sieht ausschließlich, was aus dem Erfolgszweig
herauskommt: die Textur-Erzeugung, das `batch()` samt jedem abgeleiteten Effekt,
das `dispose()` des Vorgängers. Nichts davon hat eine URL, die gescheitert wäre,
und deshalb trägt die Meldung die `id` der Resource statt einer.

Ein Kommentar hält die Signalize-Semantik fest, die den `.catch`-Zweig überhaupt
erreichbar macht: Propagation läuft inline, ein Effekt, der wirft, wird isoliert,
und sein Fehler kommt am Ende der Zustellung beim Schreiber wieder heraus —
mehrere als ein `AggregateError`.

Der Wert `'texture'` ist neu in der `error`-Payload und additiv: wer auf
`'image'` prüft, prüft danach genau das, was er meinte. Die Entscheidung vom
2026-09-07 zur öffentlichen API deckt ihn. `TextureStore` ist nicht betroffen —
sein `once(store, OnError, …)` in `TextureStore.load()` (`:146-152`) hängt am
Store, und die Fehler einer Resource abonniert man an der Resource.

### 5. Die Resource prüft die Atlas-Antwort wie der Loader

`TextureResource.ts`, Fetch-Effekt (`:605-636`), direkt nach `const atlasJson =
await response.json()` und dem `aborted`-Check:

1. `isAtlasJsonResponse(atlasJson)` aus dem Modul aus Schritt 1. Kommt die Form
   nicht durch: `emit(this, OnError, {source: 'atlas', url: atlasUrl, error: new
   Error(…)})` und zurück, ohne zu setzen. Die Meldung im Ton des Loaders und mit
   dem Präfix der Datei: `[TextureResource] the response of "…" is no texture
   atlas json`.
2. Die Bild-URL auflösen: `this.overrideImageUrl ?? atlasJson.meta.image`. Ist
   das kein String: `emit(…)` mit `[TextureResource] the response of "…" names no
   image and no overrideImageUrl was given` und zurück, ohne zu setzen.
3. Sonst die aufgelöste URL in die JSON legen und diese setzen:
   `this.atlasJson = {...atlasJson, meta: {...atlasJson.meta, image: imageUrl}}`.

Schritt 3 ist wörtlich das Muster des Loaders (`:94-96`), und aus demselben
Grund: der Getter `atlasJson` ist als `TexturePackerJsonData` deklariert, dessen
`meta.image` ein `string` ist. Wer die aufgelöste URL nicht einsetzt, braucht
entweder einen Cast, der den Getter lügen lässt, oder eine Lockerung des
Property-Typs, die jeden Leser bricht. Der Preis des Musters: wird
`overrideImageUrl` nach dem Laden wieder zurückgenommen, fällt die Auflösung auf
die eingesetzte URL zurück statt ins Leere. Das ist die bessere der beiden
Antworten — die andere wäre genau der stille Ausfall, den dieses Paket schließt.

Die Effekte auf `:642-648` und `:653-670` bleiben unverändert. Sie rechnen
weiter `overrideImageUrl ?? atlasJson.meta.image`, und das bleibt richtig: ein
*später* gesetztes Override gewinnt dort nach wie vor, weil
`overrideImageUrlSignal` in ihren Dependencies steht.

**Warum die Resource nicht einfach den `TextureAtlasLoader` benutzt**, obwohl der
Befundtext das nahelegt: der Loader lädt das Bild gleich mit. Die Resource fährt
ihren Bild-Load in einem eigenen, abbrechbaren Effekt über
`imageLoader.acquire(url)` — das ist der Dedup-Cache aus Paket 2, und daran hängt
auch die `release(url)`-Hälfte im Cleanup. Über den Loader zu gehen, umginge
beides. Geteilt wird die Prüfung, nicht der Ladeweg; genau dafür bekommt der
Guard in Schritt 1 sein eigenes Modul.

### 6. Regressionstests für die Resource

`TextureResource.spec.ts`. Die Infrastruktur steht: `vi.spyOn(globalThis,
'fetch')`, `vi.spyOn(ImageLoader.prototype, 'loadAsync')`, `flushMicrotasks()` —
das Muster von `:411-438` und `:443-466` trägt alle vier Tests.

In `describe('atlas fetch')` (`:442`):

- »a 200 response that is no atlas json is reported instead of set« —
  `new Response(JSON.stringify({hello: 'world'}))`. Erwartet: ein `error`-Event
  mit `source: 'atlas'` und der Atlas-URL, dessen `error.message` die Antwort
  benennt, und `resource.atlasJson` bleibt `undefined`.
- »an atlas json that names no image and has no override is reported« —
  `{frames: {'a': {frame: {x: 0, y: 0, w: 8, h: 8}}}, meta: {size: {w: 16, h: 16}}}`.
  Erwartet: ein `error`-Event mit `source: 'atlas'`, und `resource.imageUrl`
  bleibt `undefined`.
- »an atlas json without an image loads with an overrideImageUrl« — die
  Gegenprobe zum vorigen, mit `TextureResource.fromAtlas(…)` plus
  `overrideImageUrl`. Erwartet: kein `error`-Event, und
  `resource.atlasJson.meta.image` trägt die aufgelöste URL.

Für Schritt 4, in einer neuen `describe`-Gruppe »error sources« hinter
`describe('atlas fetch')`:

- »a failure behind a loaded image is not reported as an image failure« — eine
  Atlas-Resource, deren `fetch` und deren `ImageLoader#loadAsync` beide glücken,
  mit `vi.spyOn(TexturePackerJson, 'parse')`, das wirft. Erwartet: ein
  `error`-Event mit `source: 'texture'` und der `id` der Resource — und
  ausdrücklich **keines** mit `source: 'image'`. Die zweite Hälfte der Erwartung
  ist die, die den Befund festhält.

Rot zuerst, alle vier.

### 7. TSDoc nachziehen

- `TextureResource.ts:66-69`: die Beschreibung der `error`-Payload bekommt
  `{source: 'texture', id, error}` — alles, was hinter einem geglückten Bild-Load
  schiefgeht, die Textur-Erzeugung und jeder daraus abgeleitete Wert. Ohne `url`,
  und der Halbsatz sagt warum: keine URL ist gescheitert.
- `TextureStore.ts:54-58`: der Satz »The `atlas` and `image` failures of a
  resource are emitted by `TextureResource` and are subscribed there« nimmt
  `texture` mit auf.

## Nebenbefunde aus diesem Zug

Einer, in die Queue des Plans eingetragen:
`PowerOf2ImageLoader.ts:38` — `canvas.getContext('2d')!.drawImage(…)`. Datei ist
in diesem Lauf nicht angefasst und wird es hier auch nicht, also greift die
Scope-Regel nicht: `→ Audit`.

Aus »Offene Befunde« nichts übernommen. Die vier texture-nahen Einträge, die dort
offen stehen — der leere Progress-Callback (`TextureAtlasLoader.ts:95`), das
public `refCount` (`TextureResource.ts:260`), das `any` in
`TextureAtlasFrameData` (`TextureAtlas.ts:3`) und die TODO-Fehlermeldung
(`FrameBasedAnimations.ts:83`) — teilen die Ursache dieses Pakets nicht. Sie
stehen alle auf `→ Audit` und werden dort abgeräumt, nicht hier.

## Verlauf

- 2026-09-08 Zug 0: Detailplan steht · alle drei Befunde bestehen · zwei
  verschoben (`TextureAtlasLoader.ts:87` → `:102`, `TextureResource.ts:522` →
  `:527`), der dritte auf `:605-670` gewandert und in seinem ersten Ausgang
  präzisiert (der `TypeError` bleibt nicht liegen, er kommt am `set()` heraus) ·
  ein neuer Nebenbefund in die Queue (`PowerOf2ImageLoader.ts:38`, `→ Audit`) ·
  keine Folgen zu verteilen, Restplan unverändert
- 2026-09-08 Zug 1: Implementierer beauftragt · mittlere Stufe (sonnet), Effort
  medium · Report nach `paket-11.impl-1.json`
- 2026-09-08 Zug 2: Report `FERTIG` · geändert `TextureAtlasLoader.ts`,
  `TextureAtlasLoader.spec.ts`, `TextureResource.ts`, `TextureResource.spec.ts`,
  `TextureStore.ts`, neu `isAtlasJsonResponse.ts` · rote Läufe belegt (Loader-Test
  im Timeout, vier Resource-Tests rot) · Arbeitsbaum ist jetzt schmutzig
- 2026-09-08 Zug 3: Reviewer (opus, Effort medium) über
  `paket-11.diff` · alle drei Befunde erfüllt · Qualität: 4 wichtig
  (CHANGELOG fehlt, TSDoc der `atlas`-Payload, Kommentar am `response.ok`-Check,
  kein Test auf dem Image-Rejection-Zweig), 2 klein
- 2026-09-08 Zug 4, Runde 1: offen waren vier wichtige Qualitätsbefunde (fehlender
  CHANGELOG-Eintrag, TSDoc der `atlas`-Payload, Kommentar am `response.ok`-Check,
  kein Test auf dem Image-Rejection-Zweig) · Implementierer sonnet/medium,
  Report `paket-11.impl-2.json` · Nachprüfung durch den Reviewer (opus/medium,
  `paket-11.review-2.json`, Diff `paket-11.diff-runde1`): alle vier geschlossen,
  Mutationsprobe am neuen Test bestanden · offen bleiben drei kleine Befunde
- 2026-09-08 Zug 5: `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0, alle neun
  Schritte grün (`paket-11.verify.log`) · committet als `417b04f`

## Urteil des Reviewers je Befund

- **`TextureAtlasLoader.ts:87`** (Parse-Wurf hängt die Promise) — behoben.
  `TextureAtlasLoader.ts:74-82`: `TexturePackerJson.parse()` steht in einem `try`,
  dessen `catch` `onErrorCallback?.(error)` ruft; `onLoadCallback(...)` bleibt auf
  `:83` außerhalb. Guard und Typ unverändert nach `isAtlasJsonResponse.ts`
  gewandert, nicht in `texture/public-api.ts`. Regressionstest
  `TextureAtlasLoader.spec.ts:130`; der `queueMicrotask`-Umweg im Stub ist nötig,
  weil ein synchron zurückrufender Stub den Wurf im Promise-Executor abfinge.
- **`TextureResource.ts:522`** (Fehler hinter dem geglückten Bild-Fetch heißt
  Bild-Fehler) — behoben. `TextureResource.ts:513-548`: zweiparametrige
  `.then()`-Form, Rejection-Handler meldet `{source: 'image', url, error}`, der
  nachgehängte `.catch` meldet `{source: 'texture', id, error}`. Der Weg trägt:
  der Atlas-Effekt hängt an `#imageCoords`, das im `batch()` geschrieben wird,
  sein Wurf kommt am `batch()` heraus. Tests auf `TextureResource.spec.ts:549`
  und `:573` decken beide Seiten der Verzweigung.
- **`TextureResource.ts:617-639`** (Atlas-JSON läuft ungeprüft durch) — behoben.
  `TextureResource.ts:643-670`: `isAtlasJsonResponse` nach `response.json()` und
  `aborted`-Check, dann die Auflösung der Bild-URL, beide Ausgänge mit
  `{source: 'atlas', url: atlasUrl, error}` und ohne zu setzen. Drei Tests auf
  `:469`, `:492`, `:517`.

## Kleine Befunde, die keine Runde ausgelöst haben

- `packages/twopoint5d/CHANGELOG.md:30` — der Eintrag steht nur unter `### Added`,
  verengt aber zugleich, was ein `source: 'image'`-Event bedeutet. Wer auf
  `'image'` filtert, um einen Bild-Retry zu fahren, liest die Konsequenz nur
  zwischen den Zeilen. Ein eigener Satz unter `### Changed` sagte es direkt.
- `packages/twopoint5d/src/texture/TextureResource.ts:67-81` — der TSDoc-Block ist
  nach dem Wachsen nicht neu umbrochen worden; die Sätze zerreißen mitten im
  Bezug. Dazu eine Doppelung: dass `status` nur bei einer Statusantwort dabeisteht,
  sagt bereits `:68-69`.
- `packages/twopoint5d/src/texture/TextureResource.spec.ts:600` — der Test prüft
  `source === 'texture' && id === 'sprites'`, assertiert aber nicht, dass kein
  `url` an der Payload hängt. Der Typ deklariert `url?: string`; eine spätere
  Änderung könnte wieder eine URL anhängen, ohne dass ein Test es merkt.
