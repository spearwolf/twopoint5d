# Paket 12 — Nachtrag aus der Fix-Bilanz: die kleinen Reviewer-Befunde des Laufs

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nachtragspaket der Drain-Runde 2, Entscheidung vom 2026-09-26: die kleinen
  Reviewer-Befunde der Pakete dieses Laufs sind Folgen und werden hier behoben) · die elf
  Befunde aus dem Block im Plan, dazu aus Zug 0 zwei kleine Reviewer-Befunde, die die Liste
  des Orchestrators ausgelassen hat (Paket 10: stumm fehlende Vorschau; Paket 11: Wächtertest
  nie rot gesehen), und ein vorbestehender Nebenbefund derselben Ursache wie Befund 1
  (`frameRate: '4'` wird angenommen)
- Folge von: Paketen 1, 2, 3, 5, 6, 9, 10, 11 (die Befunde aus den Reviews von 7 und 8 gehören
  zu deren Wurzeln 1 und 2, siehe »Entscheidungen in Zug 0«)
- Ziel: Was die Pakete dieses Laufs an kleinen Befunden hinterlassen haben, ist behoben — die
  Domain texture und ihre Lookbook-Seiten übergeben ohne offene Folge.
- Modell: mittlere Stufe (sonnet)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/TextureStore.ts`, `TextureStore.spec.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts` (nur Kommentare), `TextureResource.spec.ts`
  - `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `FrameBasedAnimations.spec.ts`
  - `packages/twopoint5d/src/sprites/TexturedSprites/TexturedSpritesGeometry.ts` (nur TSDoc)
  - `packages/twopoint5d/CHANGELOG.md`, `packages/twopoint5d/docs/resource-lifecycle.md`
  - neu `apps/lookbook/src/demos/utils/loadTextureCatalog.ts`, neu
    `apps/lookbook/src/demos/utils/showTexturePreview.ts`
  - `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts`, `map2d-rect-visi.ts`, `map2d-tile-sprites.ts`
  - `apps/lookbook/src/pages/demos/animated-billboards.astro`, `textured-sprites.astro`,
    `textured-quads.astro`, `textured-quads-from-tileset.astro`, `textured-quads-from-texture-atlas.astro`
  - `packages/twopoint5d/src/texture/TextureAtlasLoader.spec.ts` nur, falls Schritt 12 den
    Wächtertest grün gegen den Code ohne `?? ''` findet
- Verify: `pnpm run ci`
- Commit: `fix(texture,sprites,lookbook): let TextureStore#loadAsync() resolve once its parse has begun and reject with the failure it reports whatever an error listener throws, name the catalog url when the static loadAsync() rejects on an unknown default texture class, refuse a frameRate that is a string in FrameBasedAnimations#add(), say in the comments of TextureResource, the TSDoc of TexturedSpritesGeometry, the changelog and the lifecycle doc what the code does, hold the texture specs to what they name, and build the catalog store and the texture preview of the lookbook demos with one helper each`
- Verlauf:
  - 2026-09-26 Zug 0: Detailplan steht · Abgleich gegen `f0000436`: alle elf Befunde bestehen,
    neun an ihrer Stelle, zwei um eine Zeile verschoben (`TextureResource.ts:667` statt `:666`,
    `TextureResource.spec.ts:1044` Kopf des Tests), `docs/resource-lifecycle.md:24-26` statt `:26` ·
    aufgenommen aus Zug 0: Vorschau ohne `<img>` fehlt stumm (Paket 10, klein), Wächtertest
    `path` `undefined` nie rot gesehen (Paket 11, klein), `frameRate: '4'` wird angenommen
    (vorbestehend `fceda80b:…/FrameBasedAnimations.ts:49`, gleiche Ursache wie Befund 1) ·
    offene Folgen im Plan: keine; »Offene Befunde« offen nur vier `→ Audit` und zwei `→ Rückfrage`,
    keiner mit der Ursache dieses Pakets · Restplan: außer 12 kein offenes Paket, keine Umsortierung
  - 2026-09-26 Zug 1: Implementierer beauftragt · sonnet, Effort medium · Brief `paket-12.impl-0.brief.txt`, Report `paket-12.impl-0.json`
  - 2026-09-26 Zug 2: Report FERTIG_MIT_VORBEHALT (nur `TextureStore.ts` ganz gelesen) · 17 Dateien geändert, 2 neu (`apps/lookbook/src/demos/utils/loadTextureCatalog.ts`, `showTexturePreview.ts`) · 5 Regressionstests vor dem Fix rot, Gegenproben zu Schritt 6 und 12 rot · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-12.verify.log`)
  - 2026-09-26 Zug 3: Reviewer opus/medium · Schritte 1–12 erfüllt · 1 wichtig (`CHANGELOG.md:54` verspricht für jeden werfenden `error`-Listener, was nur für die Fetch- und Parse-Fehlschläge gilt), 2 klein (`TexturedSpritesGeometry.ts:34` »does not override« nur halb wahr; `TextureStore.spec.ts:588` `console.warn`-Rauschen ohne Kommentar) · nicht freigegeben · Diff `paket-12.diff`
  - 2026-09-26 Zug 4 Runde 1: offen 1 wichtig + 2 klein · derselbe Implementierer per Resume (sonnet/medium, `paket-12.impl-1.json`) · zurück FERTIG, alle drei Stellen geändert · Verify exit=0 (`paket-12.verify-1.log`) · Diff `paket-12.diff-1`
  - 2026-09-26 Zug 4 Runde 1 Review: opus/medium (`paket-12.review-1.json`) · alle drei behoben, keine neuen Befunde · freigegeben
  - 2026-09-26 Zug 5: Commit `9ec5944e` (19 Pfade, Trailer `Remediation-Run: 2026-09-26`) · Verify `paket-12.verify-1.log` exit=0 · Arbeitsbaum sauber

## Entscheidungen in Zug 0

- **`emitSafe()` in `failed()` von `loadAsync()`** (Befund 4). Die Rejection muss den
  Ladefehler tragen, den die TSDoc verspricht (`loadFailedError`, `cause` = gemeldeter Fehler).
  Mit `emit()` ersetzt ein werfender `error`-Listener sie und schneidet die Listener hinter
  sich ab; `emitStrict()` gäbe den Wurf genau an die Stelle zurück, die ihn nicht nehmen darf.
  `emitSafe()` bedient jeden Listener und meldet den Wurf samt Fehler über `console.warn` —
  die Bibliothek nutzt `emitStrict()` bereits (`TextureResource`, `Display`), der
  prozessweite Aufpreis der geschützten Dispatch-Variante ist also schon bezahlt. Der Test
  prüft die Rejection und den Listener hinter dem werfenden, **nicht** `console.warn`:
  eventize bindet `console.warn` beim Laden des Moduls (`lib/index.mjs:106`), ein
  `vi.spyOn(console, 'warn')` sieht den Aufruf nicht.
- **Settlen vor `parse()`, nicht danach** (Befund 3). Die Empfehlung des Reviewers von
  Paket 6 lautete »direkt nach `this.parse()` settlen«. Das greift zu spät: ein Listener in
  `parse()` (`ready`, `resource:<id>`, `error`) ruft `ac.abort()` bzw. `dispose()` synchron,
  `cutShort()` läuft dann schon *während* `parse()` und rejectet. Deshalb löst der Versuch die
  Abbruch-Listener mit `settle()` unmittelbar vor `parse()` und settlet selbst — `resolve(this)`
  nach `parse()`, `reject(failed('parse', …))` bei einem Wurf. Das gilt für `dispose()` aus
  einem Listener ebenso (der Reviewer nennt beide Fälle): sobald `parse()` begonnen hat, ist
  der Ladevorgang nicht mehr »under way«.
- **Statisches `loadAsync()`: die Katalog-URL in der Meldung, die Klasse in `cause`**
  (Befund 2). Der Befund sagt »nennt weder URL noch Klasse«. Jede Rejection aus
  `loadFailedError()` nennt den Schritt und das, woran der Fehler hängt (URL oder Item-id), und
  trägt die Einzelheiten in `cause` — auch die Item-Variante nennt nur `"a"`, die Klasse steht
  in `cause`. Die Klasse in die Meldung zu ziehen, machte eine Meldung dieser Familie anders als
  alle anderen. Also: ein gemeldeter Fehler ohne `url` und ohne `id` gehört dem Katalog als
  Ganzem und wird an dessen URL gehängt (`failedUrl ?? id ?? url`); die Klasse bleibt in `cause`.
- **`frameRate` als String wird abgelehnt** (Nebenbefund aus Zug 0). Der Test, den Befund 1
  verlangt (`frameRate` als String wird in der Meldung gequotet), fällt mit `'4'` durch, weil
  `'4' > 0` per Coercion wahr ist und `add()` die Animation mit `1 / '4'` baut. Der
  `[Unreleased]`-Eintrag aus Paket 1 (`CHANGELOG.md:205`) verspricht die Ablehnung schon
  (»A `frameRate` that is not a number above 0 … is refused … a `duration` or `frameRate`
  that is a string is quoted«); die `duration` lehnt `'1'` ab (`Number.isFinite`), und Paket 3
  hat dieselbe Linie für `tileCount: "5"` gezogen. Vorbestehend: `fceda80b` prüfte
  `frameRate <= 0`, `'4' <= 0` ist falsch. Gleiche Ursache wie Befund 1 (die Zusage des
  CHANGELOG zu einer `frameRate` als String ist weder getestet noch für Ziffernstrings gehalten),
  deshalb in dieses Paket.
- **Die beiden ausgelassenen kleinen Befunde** (Paket 10: Vorschau fehlt stumm; Paket 11:
  Wächtertest nie rot gesehen) fallen unter dieselbe Entscheidung wie der Rest: »die kleinen
  Reviewer-Befunde, die die Pakete dieses Laufs hinterlassen haben«. Der erste sitzt in genau
  dem Block, den Befund 11 in einen Helfer zieht; der zweite ist ein Prüfschritt ohne
  Codeänderung, solange der Test rot wird.
- **Nicht aufgenommen:** die Testnamen über 130 Zeichen (`TextureStore.spec.ts:1031` aus
  Paket 5, die Tests aus Paket 7) — Zug 0 von Paket 11 hat festgestellt, dass Prettier
  String-Literale stehen lässt und `pnpm lint` grün ist, kein Befund · der `Fixed`-Eintrag zu
  `onResource()` `CHANGELOG.md:265` (»no longer with every later `parse()`«) — der Reviewer von
  Paket 11 hat ihn als Hausstil eines `Fixed`-Eintrags stehen lassen, und `[Unreleased]` trägt
  diese Form in Dutzenden Einträgen · der Wurf eines `error`-Listeners *innerhalb* von
  `parse()` (dort `emit()`): er bricht `parse()` vor dem Schreiben ab und erreicht den Aufrufer
  von `parse()`, bei `loadAsync()` als `cause` einer Parse-Rejection — das ist die
  `emit()`-Semantik von `parse()` und nicht der Befund.
- **Generationsregel:** Die Befunde aus den Reviews von Paket 7 (Test des dritten Arguments)
  und Paket 8 (zwei Kommentare, ein Test, ein CHANGELOG-Satz) sind Wortlaut- und Testbefunde an
  Code, dessen Wurzel Paket 1 bzw. 2 ist; keiner ist ein Defekt, den der Fix von 7 oder 8
  erzeugt hat. Die Kette wächst hier nicht, `Folge von:` nennt die Wurzeln.

## Vorgehen

Code, Kommentare, Doku und CHANGELOG auf Englisch. Keine Finding-IDs, kein Rückblick auf den
Vorzustand (Abschnitt »Konventionen« im Plan). Zuerst die Regressionstests der Schritte 1–3
und 5 schreiben und rot sehen, dann beheben; der rote Lauf gehört in den Report.

### 1. `TextureStore#loadAsync()` — settlen, sobald `parse()` beginnt (Befund 3)

`packages/twopoint5d/src/texture/TextureStore.ts:527-546` (Ende von `attempt()` und die
`.then()` darunter). Neu:

```ts
        if (settled) return;
        // Once the parse begins, the load is done: parse() runs through in one go, and a listener
        // inside it — of `ready`, of a resource, of `error` — that aborts the signal or disposes the
        // store finds the data parsed. So the promise settles here, before the parse, and not a
        // microtask after it, by when such an abort would already have rejected it
        settle();
        try {
          this.parse(data, {...parseOptions, baseUrl: parseOptions.baseUrl ?? url});
        } catch (error) {
          reject(failed('parse', error));
          return;
        }
        resolve(this);
      };

      // a step before the parse that fails throws out of attempt(); the parse settles the promise
      // itself
      attempt().catch((error: unknown) => {
        if (settled) return;
        settle();
        reject(error);
      });
```

TSDoc nachziehen:

- `TextureStoreLoadOptions#signal` `TextureStore.ts:156-159`, zweiter Satz ersetzen durch:
  `A signal that aborts once the parse has begun — from a listener inside it among others — changes nothing: the promise resolves with the store.`
- `loadAsync()` `TextureStore.ts:446-449`, hinter »…rejects right away and fetches nothing.«
  anfügen: `Once the parse has begun the load is done: a listener inside \`parse()\` that aborts the signal or disposes the store changes nothing, and the promise resolves with the store.`
- `dispose()` `TextureStore.ts:1074-1075`: »So is every {@link TextureStore.loadAsync} still
  under way, and its fetch is aborted« → `So is every {@link TextureStore.loadAsync} still under way — one whose parse has begun is done and resolves —, and its fetch is aborted`

Regressionstests in `describe('loadAsync()')` `TextureStore.spec.ts:544` (Muster: der Test
`resolves with the store once the catalog has parsed` daneben, `settleWithin`, `catalogUrl`):

- `a signal that a ready listener aborts inside the parse leaves the promise resolving with the store`
  — `vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"items":{"a":{"imageUrl":"a.png"}}}'))`,
  `const ac = new AbortController()`, `on(store, TextureStoreEvents.Ready, () => ac.abort())`,
  `expect(await settleWithin(store.loadAsync(catalogUrl, {signal: ac.signal}))).toBe(store)`,
  `expect(await store.whenResource('a')).toBeInstanceOf(TextureResource)`, `store.dispose()`.
  Vor dem Fix: `DOMException` (`AbortError`) statt `store`.
- `a dispose() from a ready listener inside the parse leaves the promise resolving with the store`
  — gleiche Antwort, `on(store, TextureStoreEvents.Ready, () => store.dispose())`,
  `expect(await settleWithin(store.loadAsync(catalogUrl))).toBe(store)`. Vor dem Fix: die
  Meldung `[TextureStore] loadAsync(http://example.test/data.json) was cancelled: this store has been disposed`.

Die bestehenden Tests `a load that resolved|rejected|cut short by dispose() leaves no abort
listener on the caller signal` bleiben unverändert grün (`settle()` löst die Listener auch
auf dem neuen Weg).

### 2. `failed()` in `loadAsync()` — ein werfender `error`-Listener ersetzt die Rejection nicht (Befund 4)

`TextureStore.ts:1` Import um `emitSafe` erweitern:
`import {emit, emitSafe, type EventizedObject, off, on, once, retain} from '@spearwolf/eventize';`

`TextureStore.ts:493-497`:

```ts
      // A step that fails is reported twice: to whoever listens to the store, and to this caller.
      // emitSafe(): every listener hears it, and one that throws is reported on the console by
      // eventize instead of taking the place of the rejection this caller is owed
      const failed = (source: 'fetch' | 'parse', error: unknown, status?: number): Error => {
        emitSafe(this, OnError, status === undefined ? {source, url, error} : {source, url, status, error});
        return loadFailedError(source, url, error);
      };
```

TSDoc von `loadAsync()` `TextureStore.ts:439-444`: hinter »…carries the reported error as its
`cause`.« anfügen: `An \`error\` listener that throws changes nothing of this: every listener hears the event, eventize reports the throw on the console, and the promise rejects as described.`

Regressionstest in `describe('loadAsync()')`:
`an error listener that throws leaves the rejection to the failure it was told about, and the listeners after it hear the event`
— `vi.spyOn(globalThis, 'fetch').mockRejectedValue(fetchError)` mit
`const fetchError = new Error('boom')`; zuerst `on(store, TextureStoreEvents.Error, () => { throw new Error('a listener that throws'); })`,
danach ein zweiter Listener, der die Payloads sammelt;
`const settled = await settleWithin(store.loadAsync(catalogUrl))` →
`(settled as Error).message` ist `[TextureStore] load failed at the fetch step: "http://example.test/data.json"`,
`(settled as Error).cause` ist `fetchError`, der zweite Listener hat genau einen Payload mit
`source: 'fetch'`. `console.warn` **nicht** prüfen (siehe »Entscheidungen in Zug 0«). Vor dem
Fix: Rejection mit `a listener that throws`, der zweite Listener leer.

### 3. Statisches `TextureStore.loadAsync()` — die Katalog-URL für einen Fehler ohne `url` und `id` (Befund 2)

`TextureStore.ts:204-210`:

```ts
    const unsubscribeFromError = on(
      store,
      OnError,
      ({source, url: failedUrl, id, error}: {source: string; url?: string | URL; id?: string; error: unknown}) => {
        // a failure that names neither a url nor an item — a texture class in the
        // defaultTextureClasses of the catalog — belongs to the catalog as a whole
        failure ??= loadFailedError(source, failedUrl ?? id ?? url, error);
      },
    );
```

Kommentar an `loadFailedError` `TextureStore.ts:115-117` ergänzen: »…the url that was being
fetched, or the id of the item that is at fault; an item without a source has no url of its
own« → `… the url that was being fetched, the id of the item that is at fault — an item without a source has no url of its own —, or the url of the catalog for what belongs to it as a whole`

TSDoc des statischen `loadAsync()` `TextureStore.ts:193-194`: hinter »The promise rejects with
the first of them,« einfügen, sodass der Satz lautet:
`The promise rejects with the first of them — naming the url that failed, the id of the item at fault or, for what belongs to the catalog as a whole such as a texture class in its \`defaultTextureClasses\`, the url of the catalog, with the reported error as its \`cause\` —, and with an \`AbortError\` once \`options.signal\` aborts; the store built for the attempt is disposed by then.`

Regressionstest in `describe('parse() checks catalog data before it writes anything')`
`TextureStore.spec.ts:2345`, direkt hinter `TextureStore.loadAsync() rejects a catalog that names an unknown texture class, naming the parse step` (`:2500`):
`TextureStore.loadAsync() rejects a catalog whose defaultTextureClasses name an unknown texture class, naming the catalog url, with the class in the cause`
— `vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({defaultTextureClasses: ['nearset'], items: {}})))`,
`const settled = await settleWithin(TextureStore.loadAsync('http://example.test/data.json'))` →
`(settled as Error).message` ist `[TextureStore] load failed at the parse step: "http://example.test/data.json"`,
`((settled as Error).cause as Error).message` ist
`[TextureStore] defaultTextureClasses names "nearset", which no TextureFactory knows — left out`.
Vor dem Fix: `[TextureStore] load failed at the parse step`. Der Test daneben (Item `"a"`)
bleibt unverändert.

### 4. `TextureStore.spec.ts` — veralteter Testname, doppelter Test (Befund 6)

- `:1885` `awaits whenReady() before resolving — resource is present after await` umbenennen in
  `resolves with a store that already holds the resources of the catalog`; Körper unverändert.
- `:803-817` `on a disposed store it does not fetch` (im `describe` des deprecated
  `load()` `:735`) löschen: `:790` `on a disposed store it resolves right away and fetches nothing`
  prüft dasselbe `fetchMock` und dazu das Ergebnis.

### 5. `FrameBasedAnimations` — `frameRate` als String, Meldungstests über mehrere Werte (Befund 1 samt Nebenbefund)

`packages/twopoint5d/src/texture/FrameBasedAnimations.ts:59-69`:

```ts
const calculateDurationFromFrameRate = (frameCount: number, frameRate: number, name: AnimName | undefined): number => {
  // The type first: a string such as `"12"` passes `> 0` by coercion and would divide as a number,
  // where a duration of `"1"` is refused. And `!(frameRate > 0)` rather than `frameRate <= 0` —
  // every comparison with `NaN` is false, and only this form refuses a `NaN` here, where the error
  // can name the frameRate instead of the duration it would turn into
  if (typeof frameRate !== 'number' || !(frameRate > 0)) {
    throw new Error(
      `FrameBasedAnimations: add() got a frameRate of ${describeValue(frameRate)} for the animation \`${animNameInError(name)}\` — a frameRate is a number above zero`,
    );
  }
  return frameCount / frameRate;
};
```

`FrameBasedAnimations.spec.ts`:

- `:99` `a duration that is a string is quoted in the message` wird ein `test.each`:
  ```ts
  test.each([
    ['duration', {duration: '1'}, /got a duration of "1" for the animation `text`/],
    ['frameRate', {frameRate: '4'}, /got a frameRate of "4" for the animation `text`/],
  ] as const)('a %s that is a string is quoted in the message', (_field, timing, message) => {
    const animations = new FrameBasedAnimations();
    const frames = [new TextureCoords(0, 0, 32, 32)];

    expect(() => animations.add('text', timing as never, frames)).toThrow(message);
    expect(animations.hasAnimation('text')).toBe(false);
  });
  ```
  Vor dem Fix rot für `frameRate` (kein Wurf).
- `:185` `a third argument that is no TextureAtlas, no TileSet and no array is refused with the value and the animation`
  wird ein `test.each` über drei Werte:
  ```ts
  test.each([
    [5, '5'],
    ['frames', '"frames"'],
    [{}, '[object Object]'],
  ] as const)('a third argument of %s that is no TextureAtlas, no TileSet and no array is refused with the value and the animation', (value, described) => {
    const animations = new FrameBasedAnimations();

    expect(() => {
      animations.add('odd', 1, value as never);
    }).toThrow(
      `FrameBasedAnimations: add() got a third argument of ${described} for the animation \`odd\` — the third argument is a TextureAtlas, a TileSet or an array of frames`,
    );
    expect(animations.hasAnimation('odd')).toBe(false);
  });
  ```
  Grün vor und nach dem Fix (Abdeckung, kein Regressionstest).

### 6. `TextureResource.spec.ts` — der werfende Atlas-Subscriber hinterlässt keinen Record (Befund 5)

- Import ergänzen: `import {loadFailureFor} from './internals.js';` (alphabetisch zwischen
  `./FrameBasedAnimations.js` und `./TextureResource.js`; `internals.ts` ist modulintern, eine
  Spec desselben Moduls darf es lesen).
- Test `:1044` `a subscriber of the atlas that throws while a fetched json is published is no failure of the fetch`:
  hinter `expect(errors).toMatchObject([{source: 'texture', id: 'sprites'}]);` einfügen
  `expect(resource[loadFailureFor](['atlas']), 'no record holds the atlas back').toBeUndefined();`
- Gegenprobe, nicht committen: in `TextureResource.ts:954` das
  `emit(this, OnError, {source: 'texture', id: this.id, error});` vorübergehend durch
  `this.#fail('atlasFetch', {source: 'texture', id: this.id, error});` ersetzen, den Test rot
  sehen, zurücksetzen. Ergebnis in den Report.

### 7. `TextureResource.ts` — Kommentare an den Effekten (Befund 7)

Nur Kommentare, kein Code.

- `:663-669` Standalone-Fallback: die leere `//`-Zeile `:667` durch eine echte Leerzeile
  ersetzen, sodass der Absatz über den Fallback für den Block steht und der Kommentar
  `// the factory this fallback built and the renderer it built it for` direkt über
  `let fallback` bleibt.
- `:702-703` im Bild-Effekt: `// a new run is a new attempt; a run without a factory is a "not yet", one without a url`
  / `// takes the image back` ersetzen durch `// a new run is a new attempt at the image step`.
  Der Kommentar `:708-709` (»no url, no image … No factory is a "not yet" instead …«) bleibt
  und ist dann der einzige zu Url und Factory.
- `:722-723` ersetzen durch:
  ```ts
        // No closing .catch(): what either handler below still throws comes from a listener, is no
        // failure of this step and ends as an unhandled rejection — an error listener that throws,
        // or a dispose listener of the texture this run replaces. The latter throws out of the
        // `finally` below before a throw that the batch handed back has gone out as an `error`
        // event, and takes its place
  ```
- Fetch-Effekt `:896`: direkt über `(async () => {` einfügen:
  ```ts
        // No closing .catch() here either: once the try below is over, what still throws — the
        // #fail() of a fetch without a result, or the emit() of a throw while publishing — comes
        // from an error listener that throws itself, is no failure of this step and ends as an
        // unhandled rejection, as in the image effect
  ```

### 8. `CHANGELOG.md` (`packages/twopoint5d/CHANGELOG.md`, nur `[Unreleased]`) — Befund 8 und die Verhaltensänderungen

Skill `updating-changelog` laden. Released-Abschnitte bleiben unberührt.

- `:54` (Added, `TextureStore#loadAsync()`): hinter »…and the promise resolves.« einfügen:
  `Once the parse has begun the load is done: a listener inside \`parse()\` that aborts \`signal\` or disposes the store leaves the promise resolving with the store. An \`error\` listener that throws does not change how the promise settles: every listener hears the event, and eventize reports the throw on the console.`
  und im Satz über die statische Methode »…counts every error the attempt reports as a failure
  — nobody can listen to that store before the method returns it —, and disposes the store
  before it rejects« → `… counts every error the attempt reports as a failure — nobody can listen to that store before the method returns it —, names the url, the item or, for a texture class in \`defaultTextureClasses\`, the url of the catalog in its rejection, and disposes the store before it rejects`
- `:95` (Changed, geleertes `imageUrl`): ans Ende anfügen
  `. An atlas \`TextureResource\` whose \`atlasJson\` names no image, with no \`overrideImageUrl\` to fall back on, has no \`imageUrl\` either and takes back its \`imageCoords\`, its \`texture\`, its \`atlas\` and the \`frameBasedAnimations\` the same way`
  (der Eintrag endet ohne Punkt, der neue Satz auch).
- `:205` (Changed, `FrameBasedAnimations#add()`): »A `frameRate` that is not a number above 0,
  `NaN` among them, is refused« → `A \`frameRate\` that is not a number above 0 — \`NaN\` and a string such as \`"12"\` among them — is refused`
- `:247`: »The instance `load()` goes on resolving with the store however the attempt ends.« →
  `The instance \`load()\` resolves with the store however the attempt ends.`
- `:248`: »its messages go on naming `get()`« → `its messages name \`get()\``
- `:357`: »and the throw goes on afterwards« → `and the throw reaches the code that wrote the value once every subscriber has heard it`
- Migration Guide `:884-885` (»A TextureResource whose imageUrl is cleared releases its
  texture«): »An image or a tile set resource releases the texture it built once its `imageUrl`
  is cleared, and« → `An image or a tile set resource releases the texture it built once its \`imageUrl\` is cleared, an atlas resource once its \`atlasJson\` names no image and no \`overrideImageUrl\` is set, and`
  (Zeilenumbruch wie der Absatz, rund 100 Zeichen).
- `:897-901` »After«-Block: vor `const texture = …` die Zeile
  `const image = await new ImageLoader().loadAsync(resource.imageUrl!);` einfügen. Der Block
  ist ein schlichtes `ts`-Excerpt, kein `ts check`, und bleibt es.

### 9. `docs/resource-lifecycle.md:23-26` — der Einschub (Befund 9)

»… [`TextureResource`](../src/texture/TextureResource.ts) is the other case — it keeps the
texture it built and disposes it itself — when a successor takes its place, when its `imageUrl`
is cleared and on `dispose()` —, and a subscriber of `TextureStore` only borrows it.« →

```markdown
them disposes what came back. [`TextureResource`](../src/texture/TextureResource.ts) is
the other case: it keeps the texture it built and disposes it itself when a successor
takes its place, when its `imageUrl` is cleared and on `dispose()`, and a subscriber of
`TextureStore` only borrows it.
```

### 10. `TexturedSpritesGeometry.ts:29-32` — der Vorrang im TSDoc von `attributeUsage` (Befund 10)

```ts
  /**
   * The attributes that take another usage type than the sprite description declares;
   * `texFlipDiagonal` takes the usage named for `texCoords`, since `setFrame()` writes the two together.
   * A list that names `texFlipDiagonal` itself does not override that: of `dynamic`, `stream` and
   * `static`, the first that names it — directly or through `texCoords` — decides.
   */
```

Grundlage: `cloneVertexObjectDescription.ts` `resolveUsageLookup()` fügt das Alias in die Menge
der Liste ein, die `texCoords` nennt, und die Auflösung je Attribut prüft `dynamics`, dann
`streams`, dann `statics`.

### 11. Lookbook — ein Helfer für den Katalog-Store, einer für die Vorschau (Befund 11 samt Paket-10-Befund)

Neu `apps/lookbook/src/demos/utils/loadTextureCatalog.ts`:

```ts
import {TextureStore} from '@spearwolf/twopoint5d';
import type {WebGPURenderer} from 'three/webgpu';
import assetsUrl from './assetsUrl.js';

/**
 * A store with the catalog of the lookbook, `public/assets/textures.json`, which names the image,
 * tile set and texture classes of each item. The store belongs to the caller, who disposes it; a
 * load that fails disposes the store it built before the error reaches the caller.
 */
export async function loadTextureCatalog(renderer: WebGPURenderer): Promise<TextureStore> {
  const store = new TextureStore(renderer);
  try {
    await store.loadAsync(assetsUrl('textures.json'));
  } catch (error) {
    store.dispose();
    throw error;
  }
  return store;
}
```

Neu `apps/lookbook/src/demos/utils/showTexturePreview.ts`:

```ts
import type {Texture} from 'three/webgpu';

/**
 * Show a copy of the image of `texture` in the `#texture-preview` element of the page. A copy: an
 * `<img>` in the layout answers width and height as its CSS sizes it, and three.js reads the size
 * of the texture from there.
 */
export function showTexturePreview(texture: Texture): void {
  const preview = document.getElementById('texture-preview');
  if (!preview) {
    throw new Error('[lookbook] showTexturePreview(): the page has no #texture-preview element');
  }
  if (!(texture.image instanceof HTMLImageElement)) {
    // eslint-disable-next-line no-console
    console.warn(`[lookbook] showTexturePreview(): the image of the texture "${texture.name}" is no <img>, there is nothing to copy`, texture.image);
    return;
  }
  preview.appendChild(texture.image.cloneNode());
}
```

Der `renderer` aller acht Aufrufstellen kommt aus den Event-Props des Displays
(`packages/twopoint5d/src/display/types.ts:6`, `renderer: WebGPURenderer`), der Parametertyp
passt also überall. Prettier bricht die lange `console.warn`-Zeile selbst um (`pnpm format`).

Die acht Katalog-Stellen — je die drei Zeilen `const store = new TextureStore(renderer);`,
`// the catalog of the lookbook, public/assets/textures.json, names …`,
`await store.loadAsync(assetsUrl('textures.json'));` — werden zu
`const store = await loadTextureCatalog(renderer);`:

| Datei | Zeilen | Import |
| --- | --- | --- |
| `apps/lookbook/src/demos/map2d/map2d-cam-visi.ts` | `:48-50` | `import {loadTextureCatalog} from '../utils/loadTextureCatalog';` |
| `apps/lookbook/src/demos/map2d/map2d-rect-visi.ts` | `:75-77` | wie oben |
| `apps/lookbook/src/demos/map2d/map2d-tile-sprites.ts` | `:36-38` | wie oben |
| `apps/lookbook/src/pages/demos/animated-billboards.astro` | `:60-62` | `import {loadTextureCatalog} from '~demos/utils/loadTextureCatalog';` |
| `apps/lookbook/src/pages/demos/textured-sprites.astro` | `:51-53` | wie oben |
| `apps/lookbook/src/pages/demos/textured-quads.astro` | `:126-128` | wie oben |
| `apps/lookbook/src/pages/demos/textured-quads-from-tileset.astro` | `:120-122` | wie oben |
| `apps/lookbook/src/pages/demos/textured-quads-from-texture-atlas.astro` | `:93-95` | wie oben |

Die drei Vorschau-Blöcke — Kommentar »a copy: an <img> …«, `if (texture.image instanceof HTMLImageElement) { … appendChild(texture.image.cloneNode()); }`
— werden zu

```ts
    // the <div id="texture-preview"> is written by the markup of this very page
    showTexturePreview(texture);
```

in `textured-quads.astro:132-139`, `textured-quads-from-texture-atlas.astro:99-106`,
`textured-quads-from-tileset.astro:126-133`; Import `import {showTexturePreview} from '~demos/utils/showTexturePreview';`.

Danach ungenutzte Imports entfernen — `TextureStore` aus `@spearwolf/twopoint5d` in allen acht
Dateien, `assetsUrl`, wo sonst niemand ihn braucht (`animated-billboards.astro:93` braucht ihn
weiter); `pnpm lint` meldet jeden. Die `store.dispose()`-Aufrufe der Demos bleiben, wie sie sind.

Sichtprüfung wie in Paket 10: `pnpm lookbook`, die acht Routen
`/lookbook/demos/map2d-cam-visi`, `map2d-rect-visi`, `map2d-tile-sprites`,
`animated-billboards`, `textured-sprites`, `textured-quads`, `textured-quads-from-tileset`,
`textured-quads-from-texture-atlas` laden; je kein Fehler in der Konsole, die drei
`textured-quads*`-Seiten zeigen ihr Bild in der Vorschau. Beleg in den Report. Den Dev-Server
über die Prozessgruppe des Prozesses `astro dev` beenden, nicht über den Nx-Wrapper (Hinweis
aus Paket 10), danach ist Port 4321 frei.

### 12. Wächtertest `path` `undefined` gegen den Code ohne `?? ''` (Paket-11-Befund)

Gegenprobe, nicht committen: `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:82`
`const jsonUrl = (this.fileLoader.path ?? '') + url;` vorübergehend zu
`const jsonUrl = this.fileLoader.path + url;` machen,
`pnpm nx test twopoint5d -- src/texture/TextureAtlasLoader.spec.ts` laufen lassen,
`a path a caller set to undefined at runtime leaves the bare url in the message`
(`TextureAtlasLoader.spec.ts:336`) muss rot werden (`"undefined…"` in der Meldung);
zurücksetzen. Bleibt er grün, den Test so schärfen, dass er genau diesen Unterschied prüft
(Meldung exakt statt per Teilstring), die Gegenprobe wiederholen und beides in den Report.

### 13. Verify

`pnpm run ci` aus dem Repo-Root. Zwischendurch reicht
`pnpm nx test twopoint5d -- src/texture` für die Specs und `pnpm typecheck` für Lookbook und
Library.

## Nicht in diesem Paket

- Die übrigen Einträge in »Offene Befunde« (vier `→ Audit`, zwei `→ Rückfrage`): keiner teilt
  die Ursache dieses Pakets; die `→ Rückfrage` gehen nach der Entscheidung vom 2026-09-26 mit
  ihrer Frage ins Audit.
- `animated-sprites.astro` lädt einen eigenen Katalog (`nobingers.json`) mit eigenem
  `error`-Listener und bleibt, wie er ist.
- Der Wurf eines `error`-Listeners innerhalb von `parse()` (siehe »Entscheidungen in Zug 0«).
- Keine Verhaltensänderung an `TextureResource` außer den Kommentaren in Schritt 7.

## Abgleich (Zug 0, 2026-09-26, gegen `f0000436`)

| # | Befund aus dem Plan | Stand | Fundstelle jetzt |
| --- | --- | --- | --- |
| 1 | `FrameBasedAnimations.spec.ts:99,185` Meldungstests decken je einen Wert | unverändert | `:99` testet nur `duration: '1'`, `:185` nur `5`; dazu: `frameRate: '4'` wird angenommen, `FrameBasedAnimations.ts:63` (`!(frameRate > 0)`, `'4' > 0` ist wahr) |
| 2 | `TextureStore.ts:208,650-656` statisches `loadAsync()` ohne URL und Klasse | unverändert | `:208` `failedUrl ?? id`, `:650-656` Event ohne `url` und `id` → Meldung `load failed at the parse step` |
| 3 | `TextureStore.ts:529,536-541,158` Abbruch aus einem Listener in `parse()` | unverändert | `:529` `this.parse(…)`, `:535-546` `.then()` settlet einen Microtask später, `:487` `onAbort` rejectet schon während `parse()`; TSDoc `:158` |
| 4 | `TextureStore.ts:495` werfender `error`-Listener ersetzt die Rejection | unverändert | `:495` `emit(this, OnError, …)` in `failed()` |
| 5 | `TextureResource.spec.ts:1044` prüft nur die `source` | unverändert | Test `:1044`, Assertion `:1082`; kein Import von `internals.js` in der Spec |
| 6 | `TextureStore.spec.ts:1885,790,803` Testname, doppelter Test | unverändert | `:1885`, `:790`, `:803` |
| 7 | `TextureResource.ts:666,702-709,722-723,765,945-955` Kommentare | um eine Zeile verschoben | leere `//`-Zeile `:667`; doppelte Kommentare `:702-703`/`:708-709`; `:722-723`; `finally` mit `previous?.dispose()` `:764-766`; Fetch-Effekt `#fail`/`emit` hinter dem `try` `:945-955` ohne Hinweis |
| 8 | `CHANGELOG.md:95,247-248,357,884,899` | unverändert | `:95` ohne Atlas-Shape, `:247` »goes on resolving«, `:248` »go on naming«, `:357` »the throw goes on afterwards«, `:884` ohne Atlas-Shape, `:899` `image` undefiniert |
| 9 | `docs/resource-lifecycle.md:26` Einschub | an seiner Stelle | `:23-26`, »… on `dispose()` —, and …« |
| 10 | `TexturedSpritesGeometry.ts:31` Vorrang verschwiegen | unverändert | TSDoc `:29-32`, Vorrang aus `cloneVertexObjectDescription.ts` `resolveUsageLookup()` |
| 11 | Lookbook: Katalog-Store und Vorschau elfmal wortgleich | unverändert | acht Katalog-Stellen, drei Vorschau-Blöcke (Tabelle in Schritt 11) |
| + | Paket 10, klein: Vorschau fehlt stumm | unverändert | die drei Vorschau-Blöcke, `if (texture.image instanceof HTMLImageElement)` ohne `else` |
| + | Paket 11, klein: Wächtertest nie rot gesehen | offen | `TextureAtlasLoader.spec.ts:336`, Code `TextureAtlasLoader.ts:82` |

## Befunde im Volltext

Aus den Reviewer-Notizen der Paketdateien, gegen `f0000436` bestätigt.

**Paket 1 · `FrameBasedAnimations.spec.ts:99`** — der CHANGELOG nennt das Quoten auch für eine
`frameRate` als String, getestet ist nur `duration: '1'`.

**Paket 7 · `FrameBasedAnimations.spec.ts:185`** — der Test für den dritten Parameter deckt nur
den Wert `5` (`describeValue` anderswo getestet).

**Paket 3 · `TextureStore.ts:182` (jetzt `:208`)** — das statische `TextureStore.load()` (jetzt
`loadAsync()`) rejectet auf die Meldung zu unbekannten `defaultTextureClasses` nur mit
`[TextureStore] load failed at the parse step`: das Event trägt weder `url` noch `id`,
Katalog-URL und Name stehen nur in `cause`.

**Paket 6 · `TextureStore.ts:514` (jetzt `:529`, `:535-546`)** — zwischen dem Ende von `parse()`
und `resolve()` liegen Microtasks; ein `ac.abort()` oder `store.dispose()` aus einem Listener
innerhalb von `parse()` (`ready`, ein `on()`-Callback) lässt `loadAsync()` rejecten, obwohl
geparst wurde — gegen die TSDoc von `TextureStoreLoadOptions#signal` (»a signal that aborts
once the data is parsed changes nothing«). Lösung des Reviewers: direkt nach `this.parse()` in
`attempt()` settlen (in Zug 0 präzisiert: davor, siehe »Entscheidungen«).

**Paket 6 · `TextureStore.ts:474` (jetzt `:495`)** — wirft ein `error`-Listener in `failed()`,
rejectet `loadAsync()` mit dessen Fehler statt mit `loadFailedError`; der Alias ist nicht
betroffen.

**Paket 8 · `TextureResource.spec.ts:1023-1065` (jetzt `:1044`)** — der Test prüft nur die
`source`, nicht das Fehlen des Records; ein `#fail('atlasFetch', {source: 'texture'})` wäre
ebenfalls grün.

**Paket 6 · `TextureStore.spec.ts:1847` (jetzt `:1885`)** — der Testname »awaits whenReady()
before resolving« beschreibt eine Implementierung, die die statische Form nicht mehr hat.
**`:791` und `:804` (jetzt `:790`, `:803`)** — zwei Tests prüfen fast dasselbe (disposed Store
fetcht nicht).

**Paket 8 · `TextureResource.ts:636-637` (jetzt `:722-723`)** — der Kommentar sagt, was aus den
Handlern noch wirft, komme nur von einem werfenden `error`-Listener; auch `previous?.dispose()`
im `finally` (jetzt `:765`) kann werfen (Dispose-Listener von three) und verdrängt dann den
festgehaltenen Wurf. **`:883-893`, `:681-683` (jetzt `:945-955`)** — `#fail` und
`emit(OnError)` stehen außerhalb jedes `try`; dem Fetch-Effekt fehlt der Hinweis, den der
Bild-Effekt trägt.

**Paket 5 · `TextureResource.ts:676-683` (jetzt `:702-709`)** — zwei Kommentare untereinander
sagen fast dasselbe (»a run without a factory is a "not yet"«).

**Paket 11 · Standalone-Fallback in `TextureResource.ts` (jetzt `:663-669`)** — die beiden
Kommentare trennt eine leere `//`-Zeile, keine echte Leerzeile.

**Paket 5 · `CHANGELOG.md:89`, `:865-885` (jetzt `:95`, `:884`)** — `Changed`-Eintrag und
Migration Guide nennen nur Image- und Tile-Set-Resources; die Rücknahme auf der Atlas-Shape
(Json ohne Bild, kein `overrideImageUrl`) steht nur in der Klassen-TSDoc. **`:878-882` (jetzt
`:899`)** — im »After«-Block des Migration Guide ist `image` nicht definiert.

**Paket 6 · `CHANGELOG.md:245-246` (jetzt `:247-248`)** — »goes on resolving«, »go on naming«
lehnen sich an den Vorzustand an; im Präsens trägt es ohne Vorwissen.

**Paket 8 · `CHANGELOG.md:329` (jetzt `:357`)** — »and the throw goes on afterwards« sagt nicht,
wohin (an den Schreiber des Werts).

**Paket 5 · `docs/resource-lifecycle.md:25-26`** — der Einschub endet auf »`dispose()` —, and
…«, liest sich holprig.

**Paket 9 · `TexturedSpritesGeometry.ts:31`** — die TSDoc sagt ohne Einschränkung
»`texFlipDiagonal` takes the usage named for `texCoords`«; nennt ein Aufrufer `texFlipDiagonal`
selbst in einer anderen Liste, entscheidet der Vorrang dynamic > stream > static zwischen
eigener Angabe und Alias. Laufzeitverhalten richtig.

**Paket 10 · Lookbook** — das Katalog-Muster samt Kommentar steht (heute) achtmal, der
Vorschau-Block dreimal wortgleich. **Dazu:** ist `texture.image` kein `HTMLImageElement`, fehlt
die Vorschau stumm — bei PNG-Assets nicht erreichbar.

**Paket 11 · `TextureAtlasLoader.spec.ts`** — der Wächtertest für `path` `undefined` wurde nicht
gegen den Code ohne `?? ''` rot gesehen.

**Zug 0 · `FrameBasedAnimations.ts:63`** — `calculateDurationFromFrameRate()` prüft
`!(frameRate > 0)`; ein String wie `'4'` besteht per Coercion, `add()` baut die Animation mit
`frameCount / '4'`, während eine `duration` von `'1'` abgelehnt wird und
`CHANGELOG.md:205` die Ablehnung samt Quoten verspricht · vorbestehend
(`fceda80b:…/FrameBasedAnimations.ts:49` `frameRate <= 0`) · low → Scope, gleiche Ursache wie
der Befund aus Paket 1.

## Urteil des Reviewers (Zug 3 und Runde 1)

| Schritt | Befund | Urteil | Fundstelle |
| --- | --- | --- | --- |
| 1 | Settlen vor `parse()` (Abbruch/`dispose()` aus Listener) | behoben | `TextureStore.ts:541-560`, `:161-162`, `:465-467`, `:1089-1092`; `TextureStore.spec.ts:568-586` |
| 2 | `emitSafe()` in `failed()` | behoben | `TextureStore.ts:1`, `:505-511`, `:452-454`; `TextureStore.spec.ts:588-606` |
| 3 | statisches `loadAsync()` nennt die Katalog-URL | behoben | `TextureStore.ts:208-216`, `:115-118`, `:193-199`; `TextureStore.spec.ts:2537-2549` |
| 4 | veralteter Testname, doppelter Test | behoben | `TextureStore.spec.ts:1910`, `:832-845` |
| 5 | `frameRate` als String, Meldungstests über mehrere Werte | behoben | `FrameBasedAnimations.ts:59-68`; `FrameBasedAnimations.spec.ts:99-108`, `:189-205` |
| 6 | Atlas-Subscriber hinterlässt keinen Record | behoben (Gegenprobe rot) | `TextureResource.spec.ts:8`, `:1081` |
| 7 | Kommentare in `TextureResource` | behoben | `TextureResource.ts:667`, `:702`, `:721-725`, `:896-899` |
| 8 | CHANGELOG | behoben (in Runde 1 `:54` eingegrenzt) | `CHANGELOG.md:54`, `:95`, `:205`, `:247-248`, `:357`, `:884-886`, `:899` |
| 9 | `resource-lifecycle.md` Einschub | behoben | `docs/resource-lifecycle.md:23-26` |
| 10 | TSDoc `attributeUsage` | behoben (in Runde 1 präzisiert) | `TexturedSpritesGeometry.ts:31-36` |
| 11 | Lookbook-Helfer, Warnung bei fehlender Vorschau | behoben | `apps/lookbook/src/demos/utils/loadTextureCatalog.ts`, `showTexturePreview.ts` |
| 12 | Wächtertest `path` `undefined` | erfüllt ohne Codeänderung (Gegenprobe rot) | `TextureAtlasLoader.spec.ts` unverändert |

Kleine Befunde (offen, lösen keine Runde aus):

- `packages/twopoint5d/CHANGELOG.md:54` — »the failures above« lässt sich zur Not auch auf die kurz davor genannten Item-Events beziehen; »one of the four failures that reject« wäre eindeutiger (Hinweis des Reviewers in Runde 1, von ihm nicht als Befund gewertet).
