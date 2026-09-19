# Paket 14 — texture: gebrochenes Padding, geleerte Animationsdaten, späte Effekt-Registrierung, Textur-Übergabe im Bild-Batch

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (vier Nebenbefunde aus der Queue, Drain-Runde 1; siehe »Nebenbefunde im Volltext«)
- Mitgenommen: ein vorbestehender Nebenbefund gleicher Ursache wie der zu den
  Animations-Effekten (ein abgeleiteter Wert der Resource bleibt stehen, wenn
  seine aktuelle Eingabe keinen mehr ergibt) — der Atlas-Effekt nimmt den
  Atlas weder bei geleertem noch bei unlesbarem `atlasJson` zurück, und eine
  unlesbare JSON wirft beim Schreiber (`TextureResource.ts:764-782`)
- Ziel: `TileSet` rechnet mit gebrochenem Padding exakt, und eine
  `TextureResource` bietet kein TileSet, keinen Atlas und keine Animationen an,
  die ihre aktuellen Eingaben nicht ergeben, registriert in `load()` die
  Effekte ihrer Shape unabhängig von den Werten beim Aufruf und besitzt jede
  Textur, die sie auf ihr Signal legt.
- Modell: stärkste Stufe
- Effort: medium
- Dateien: `packages/twopoint5d/src/texture/TileSet.ts`,
  `packages/twopoint5d/src/texture/TextureResource.ts`, deren Specs
  `TileSet.spec.ts`, `TextureResource.spec.ts`, dazu ein Fall in
  `TextureStore.spec.ts`, `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`; während der Arbeit
  `pnpm nx test twopoint5d -- src/texture`
- Commit: `fix(texture): lay tiles out by the whole of a fractional padding, take back the animations and atlas that cleared or unreadable data no longer yields, register a resource's effects by its shape instead of by the values it holds at load() and own a texture before it is published`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht (HEAD `121a8fa9`) · Padding
    unverändert, nach `TileSet.ts:189-190` gewandert · Animationsdaten
    unverändert, jetzt `TextureResource.ts:634`, `:787` · Registrierung nach
    Wert unverändert, jetzt `:583`, `:666` · Textur-Übergabe unverändert, jetzt
    `:543-552` · alle vier in Node gegen `dist` nachgestellt (Skripte
    `repro-p14*.mjs` im Arbeitsverzeichnis des Laufs; laufen gegen `dist`,
    zeigen nach dem Fix erst nach `pnpm build:twopoint5d` den neuen Stand) · Atlas-Rücknahme als
    gleiche Ursache mitgenommen · ein neuer vorbestehender Befund
    (`imageUrl = undefined`) → Queue mit `→ Rückfrage` · keine offenen Folgen
    zu verteilen · Audit-Überschneidungen: MEM-001 (Übergabe) deckungsgleich,
    API-047 teilweise
  - 2026-09-19 Zug 1: Implementierer beauftragt (opus, effort medium, `paket-14.impl-1.json`)
  - 2026-09-19 Zug 2: FERTIG · `TileSet.ts`, `TextureResource.ts`, `TileSet.spec.ts`, `TextureResource.spec.ts`, `TextureStore.spec.ts`, `CHANGELOG.md` · roter Lauf 14 rot / 247 grün (2 Wächter grün) · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-14.diff`
  - 2026-09-19 Zug 3: Urteil — alle vier Nebenbefunde und die Atlas-Rücknahme behoben · 0 kritisch, 0 wichtig, 3 klein (`paket-14.review-1.json`)
  - 2026-09-19 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-09-19 Zug 5: `pnpm run ci` Exit 0 (`paket-14.verify.log`) · committet `ced8c118`

## Abgleich

Stand HEAD `121a8fa9`, `dist` aus demselben Stand (gebaut 22:05, byte-gleich in
den betroffenen Zeilen). Nachgestellt mit Skripten gegen
`packages/twopoint5d/dist/lib/texture/*.js`, Bildquelle über `imageLoader`
(acquire/release), Stub-Factory wie in `TextureResource.spec.ts`.

| Befund | Urteil | Fundstelle jetzt | Nachstellung |
| --- | --- | --- | --- |
| Padding `<< 1` | unverändert, verschoben | `TileSet.ts:189-190` | Bild 100×10, Kachel 10×10, `padding: 1.5` → 8 Kacheln bei x = 1.5, 13.5, 25.5 … (Schritt 12); exakt wären 7 Kacheln bei 1.5, 14.5, 27.5 … (Schritt 13) |
| Animationen bleiben bei `frameBasedAnimationsData = undefined` | unverändert, verschoben | `TextureResource.ts:631-663` (TileSet), `:784-812` (Atlas) | beide Shapes: nach `frameBasedAnimationsData = undefined` liefert `resource.frameBasedAnimations` dasselbe Objekt wie vorher |
| Registrierung hängt am Wert bei `load()` | unverändert, verschoben | `TextureResource.ts:583` (`if (this.tileSetOptions)`), `:666` (`if (this.atlasUrl)`) | TileSet: Optionen vor `load()` geleert, danach gesetzt → Textur da, `tileSet` bleibt `undefined`. Atlas: `atlasUrl` vor `load()` geleert → weder ein später gesetztes `atlasJson` noch ein wieder gesetztes `atlasUrl` ergibt je `imageUrl`, Textur oder Atlas |
| Übergabe von `#ownTexture` hinter dem `batch()` | unverändert, verschoben | `TextureResource.ts:543-552` | (a) werfender `texture`-Subscriber: `error` mit `source: 'texture'`, die veröffentlichte Textur ist nach `resource.dispose()` nicht freigegeben. (b) Atlas-JSON `{frames: {a: {}}}` von außen: die Textur `bad.png` wird nie freigegeben, auch nicht, als die nächste Textur sie ersetzt. (c) `resource.dispose()` in einem `texture`-Subscriber beim zweiten Bild: das neue Bild bleibt unfreigegeben (`a.png:true`, `b.png:false`) |

Zur Übergabe: Das Audit führt denselben Sachverhalt als **MEM-001** (medium,
außerhalb der BUG-Serie, Fundstelle `TextureResource.ts:520-534, 543-552`).
Wie ARCH-004 in Paket 13 bleibt er hier, weil die Drain-Runde ihn nach der
Scope-Regel eingeplant hat; MEM-001 wird nicht als Finding geführt, der
Abschluss kann es mit dem Hash dieses Pakets als behoben buchen. Der Weg unten
ist die Empfehlung von MEM-001 wörtlich.

Zur Registrierung: **API-047** (low, außerhalb der BUG-Serie) empfiehlt, die
Shape-Signale im Konstruktor anzulegen, und nebenbei, die Guards auf
`this.type` zu stellen. Dieses Paket stellt die Guards auf das Vorhandensein
der Shape-Signale, nicht auf `this.type`: der öffentliche Konstruktor
`new TextureResource(id, 'tileset')` legt die Signale nicht an, ein
Typ-Guard gäbe `undefined` als Abhängigkeit an `createEffect`. Der Kern von
API-047 (Signale im Konstruktor, oder Konstruktor privat) bleibt offen; der
Abschluss bucht API-047 **nicht** als behoben.

## Triage

- Folgen aus erledigten Paketen: keine offen. Die jüngsten `Folgen:`-Zeilen
  (Pakete 13, 18) sind leer; alle früheren sind verteilt und committet.
- Aus »Offene Befunde« gehören genau die vier `→ Paket 14`-Einträge hierher.
  Die zwei anderen texture-Einträge (`TileSet.ts:67` → Audit TYPE,
  `TileSetLoader.ts:33` → Audit CONS) haben eine andere Ursache und bleiben
  liegen.
- **Mitgenommen — Atlas-Rücknahme.** Nachgestellt: `atlasJson = undefined` auf
  einer geladenen Atlas-Resource lässt `atlas` und `frameBasedAnimations` der
  alten JSON stehen; `atlasJson = {frames: {a: {}}, meta: {image, size}}` mit
  dem schon geladenen Bild wirft `TypeError: Cannot read properties of
  undefined (reading 'x')` beim Schreiber und lässt beides ebenfalls stehen.
  Vorbestehend: `git show e352b56:packages/twopoint5d/src/texture/TextureResource.ts`,
  Zeilen 706–714, dieselbe Form. Gleiche Ursache wie der Befund zu den
  Animations-Effekten: die abgeleiteten Werte der Resource werden nur bei
  Erfolg geschrieben und nie zurückgenommen — Paket 9 hat das für den
  TileSet-Effekt behoben, der Befund aus der Queue nennt die beiden
  Animations-Effekte, der Atlas-Effekt ist der letzte dieser Art. Ohne ihn
  bliebe die Ursache halb behoben, und die Drain-Runde müsste für dieselbe
  Datei ein weiteres Paket schneiden. Die Klassen-TSDoc
  (`TextureResource.ts:76-78`) verspricht für »any value derived from it, such
  as an atlas« schon heute ein `error` mit `source: 'texture'` statt eines
  Throws.
- **Neu in der Queue — geleertes `imageUrl`.** `imageUrl = undefined` lässt
  Textur, `imageCoords` und alles daraus Gebaute stehen (Bild-Effekt
  `TextureResource.ts:525`, vorbestehend seit `e352b56:507`); erreichbar über
  `TextureStore#parse()` mit einem `tileSet`-Item ohne `imageUrl`
  (`TextureStore.ts:468`). Nicht mitgenommen: die Textur zurückzunehmen hieße,
  eine GPU-Textur freizugeben, die ein Aufrufer noch halten kann — ob ein
  geleertes Bild das tun soll oder die letzte Textur stehen bleibt, ist
  nirgends festgelegt. Urteil `→ Rückfrage`, severity low.
- Geprüft und verworfen: `atlasUrl = undefined` lässt die zuletzt geholte JSON
  auf `atlasJson` stehen. Kein Defekt — `atlasJson` ist selbst eine Eingabe
  (Klassen-TSDoc »`atlasJson` is both«) und hält noch einen Wert, der Atlas
  daraus entspricht also den aktuellen Eingaben.

## Entscheidungen dieses Pakets

- **Padding:** `padding * 2` statt `padding << 1`. Die TSDoc von
  `TileSetOptions.padding` (»a finite number of 0 or more«) erlaubt Brüche,
  `assertOption` hat den Wert vor der Stelle schon als endlich und ≥ 0
  geprüft. Für ganzzahlige Paddings ändert sich nichts.
- **Guard nach Shape-Signal**, nicht nach Wert und nicht nach `this.type` —
  Grund oben unter API-047.
- **Animationen:** ohne Basis (TileSet bzw. Atlas) oder ohne Daten schreibt
  der Effekt `undefined`. Die Brücke `publish` räumt dann das retained Event
  (`retainClear`), wie Paket 9 es für die TileSet-Rücknahme eingeführt hat —
  kein neues Verhalten der Events, nur ein weiterer Anlass.
- **Atlas-Rücknahme:** geleertes `atlasJson` → Atlas und Animationen sofort
  zurück, die Textur bleibt (wie bei geleerten `tileSetOptions`, wo die Textur
  ebenfalls bleibt). Unlesbare JSON → Atlas und Animationen zurück, `error`
  mit `{source: 'texture', id, error}` (Klassen-TSDoc Zeile 76-78, gleiche
  Quelle wie die TileSet-Abweisung aus Paket 9), kein Throw beim Schreiber.
  Die Regel »während das Bild unterwegs ist, bleibt der Atlas des vorigen
  stehen« (`TextureResource.ts:769-775`) bleibt unberührt: der Parse läuft
  weiter erst, wenn das Bild da ist, das die JSON nennt.
- **Übergabe:** Empfehlung von MEM-001 wörtlich — Ownership vor dem Batch
  übernehmen, Vorgänger im `finally` freigeben. Nicht die kleinere Variante
  »Übergabe ins `finally`«: sie verliert die neue Textur, wenn ein Subscriber
  die Resource im Batch disposed (Nachstellung (c)), weil `dispose()` dann den
  Vorgänger freigibt und die Übergabe danach eine neue Textur an eine tote
  Resource hängt.
- **Kein Browsertest:** reine Arithmetik der Kachelkoordinaten und
  Signal-/Ownership-Logik ohne GPU-Aufruf; die Stub-Factory der Spec misst die
  Freigabe direkt. Kein Demo und kein Browsertest nutzt ein TileSet-`padding`
  (geprüft per grep in `apps/lookbook/src` und `packages/twopoint5d-testing`).
- **Kein Migration Guide:** keine Signatur ändert sich. Dass der Setter
  `atlasJson` bei unlesbarer JSON nicht mehr wirft, folgt dem Muster von
  Paket 9 (`tileSetOptions`), das ebenfalls nur unter `### Fixed` steht
  (`CHANGELOG.md:219`).
- **Nicht im Paket:** `TextureStore.ts` bleibt unverändert — `TextureStore#on()`
  filtert `undefined` aus Tupel und Einzelwert schon (`TextureStore.ts:624`,
  `:640`). Kein Umbau von `load()` in Registrierer (READ-011), kein
  gemeinsamer Animations-Helfer: beide Schleifen bekommen dieselbe Änderung am
  Guard und bleiben sonst, wie sie sind. Keine Prüfung von `meta` in der
  JSON: `TexturePackerJsonData` verlangt `meta`, eine JSON ohne `meta` ist
  Eingabevalidierung (SEC-001), nicht Gegenstand dieses Pakets.

## Vorgehen

Vor dem ersten Edit: `packages/twopoint5d/src/texture/TextureResource.ts` und
`TileSet.ts` ganz lesen. Skill `using-signalize` laden — `batch()`, die
Isolation werfender Effekte und `onChange`-Listener samt Rethrow am Batch-Ende
und die Priorität abgeleiteter Effekte tragen jeden Schritt unten. Zeilen
beziehen sich auf HEAD `121a8fa9`.

1. **TileSet — Padding** (`TileSet.ts:189-190`): beide Zeilen auf
   `this.tileWidth + padding * 2` bzw. `this.tileHeight + padding * 2`.
   Sonst nichts an der Datei.

2. **TextureResource — Guard nach Shape** (`load()`, `:583-587` und
   `:666-672`):
   - TileSet-Zweig: statt `if (this.tileSetOptions)` die drei Signale
     `#tileSetOptions`, `#tileSet`, `#atlas` in lokale Konstanten lesen und
     auf deren Vorhandensein prüfen; die Non-Null-Assertions (`!`) entfallen.
   - Atlas-Zweig: ebenso statt `if (this.atlasUrl)` die Signale `#atlasUrl`,
     `#atlasJson`, `#fetchedAtlasJson`, `#overrideImageUrl`, `#atlas`;
     `touch(atlasUrlSignal)` am Ende bleibt (der Fetch-Effekt kehrt ohne URL
     sofort zurück, `:677`).
   - Die Lokalen beider Zweige dürfen nicht kollidieren, falls sie aus den
     Blöcken herausgezogen werden (beide heißen heute `atlasSignal`).
   - Die Kommentare `:584` und `:667` (»creates these signals in the same
     batch() that received the value the guard just read«) ersetzen durch
     den Grund des neuen Guards: die Shape entscheidet, welche Effekte laufen,
     nicht der Wert beim Aufruf; die Signale legt nur `fromTileSet()` bzw.
     `fromAtlas()` an, ein direkt gebauter `new TextureResource(id, type)`
     hat keine und bekommt deshalb keine dieser Effekte.

3. **TextureResource — Animations-Effekte** (`:631-663` TileSet, `:784-812`
   Atlas): Basis (`this.tileSet` bzw. `this.atlas`) und
   `this.frameBasedAnimationsData` am Anfang lesen; fehlt eines von beiden,
   `this.#frameBasedAnimations.set(undefined)` und zurück. Der Rest der
   Schleife bleibt unverändert. Ein kurzer Kommentar sagt, warum: Animationen
   entstehen nur aus der aktuellen Basis und den aktuellen Daten, und ein
   Wert, der zurückgenommen wird, räumt das retained Event.

4. **TextureResource — Atlas-Effekt** (`:764-782`), neue Reihenfolge im
   Effekt:
   1. `atlasJson` fehlt → `atlasSignal.set(undefined)`,
      `this.#frameBasedAnimations.set(undefined)`, zurück. (Die Animationen
      direkt mit, aus demselben Grund wie im TileSet-Effekt `:611-615`: im
      Batch läuft der Animations-Effekt danach, ein `error`-Listener fände sie
      sonst noch.)
   2. `imageCoords` fehlt → zurück (wie heute).
   3. URL-Guard mit `#imageUrlOfCoords` → zurück (unverändert samt
      Kommentar).
   4. `TexturePackerJson.parse(atlasJson, imageCoords)` in `try`. Bei einem
      Throw: Atlas und Animationen wie in 4.1 zurücknehmen und
      `emit(this, OnError, {source: 'texture', id: this.id, error})`; nicht
      weiterwerfen. Sonst `atlasSignal.set(atlas)` wie heute.
   Abhängigkeiten und Priorität (`[atlasJsonSignal, this.#imageCoords,
   this.#imageUrlOfCoords]`, `DERIVED_FROM_IMAGE_PRIORITY`) bleiben.

5. **TextureResource — Übergabe vor dem Batch** (`:538-552`):

   ```ts
   texture = factory.create(image, ...(classes ?? []));
   texture.name = this.id;
   const previous = this.#ownTexture;
   this.#ownTexture = texture;
   try {
     batch(() => { /* die drei set() unverändert */ });
   } finally {
     previous?.dispose();
   }
   ```

   Kommentar an der Stelle: die Resource besitzt die Textur, bevor sie sie
   veröffentlicht — ein Effekt oder Subscriber, der im Batch wirft oder die
   Resource disposed, kann die Übergabe nicht mehr überspringen; der
   Vorgänger fällt erst nach dem Batch, wenn die neue Textur auf dem Signal
   steht (der Satz aus `:548-549` bleibt sinngemäß wahr). `.catch` (`:561-570`)
   bleibt und meldet weiter `{source: 'texture', id, error}`.

6. **Kommentare und TSDoc in `TextureResource.ts` nachziehen** — was sonst lügt:
   - `.catch`-Kommentar `:562-567`: das Beispiel »an effect derived from the
     image that throws, the atlas effect« stimmt nach Schritt 4 nicht mehr;
     als Auslöser bleiben Texturerzeugung und ein Subscriber eines Events,
     der wirft.
   - TileSet-Effekt `:615-618`: »or the image effect, whose batch would then
     skip handing over the texture« stimmt nach Schritt 5 nicht mehr; den
     Nebensatz streichen oder durch »or the image effect, whose load would
     then end as a texture failure« ersetzen.
   - Klassen-TSDoc der Events `:76-80`: nach dem Satz zur TileSet-Abweisung
     dasselbe für ein Atlas: eine `atlasJson`, die `TexturePackerJson` nicht
     lesen kann, wird hier gemeldet, sobald das Bild da ist, das sie nennt;
     der Schreiber wirft nicht.
   - Klassen-TSDoc `:185-188`: die Rücknahme um beide neuen Anlässe ergänzen —
     eine Atlas-Resource nimmt `atlas` und `frameBasedAnimations` zurück,
     solange ihr `atlasJson` geleert oder unlesbar ist (die Textur bleibt);
     jede Resource nimmt `frameBasedAnimations` zurück, solange
     `frameBasedAnimationsData` geleert ist. Getter und retained Events wie
     beschrieben.
   - TSDoc von `load()` `:476-486`: ein Satz, dass die Effekte nach der Shape
     der Resource registriert werden, gleich welche Werte sie beim Aufruf
     hält — ein Wert, der später kommt, erreicht sie.
   - TSDoc des Getters `atlasJson` `:320-324`: ein Satz zu geleerter und
     unlesbarer JSON (Atlas und Animationen zurück, `error`, kein Throw).

7. **Regressionstests — zuerst rot sehen, dann Schritte 1–5.** Namen
   verbindlich, Aufbau frei; Stub-Factory `makeTextureFactory()` und
   `ImageLoader`-Spy bzw. `imageLoader`-Injektion wie die bestehenden Tests,
   Atlas-Fetch wie im Block `atlas fetch`.
   - `TileSet.spec.ts`, Block `TileSet`:
     - `a fractional padding steps each tile by twice the padding` — Bild
       26×26, Kachel 10×10, `padding: 1.5`: 4 Kacheln, Koordinaten (1.5, 1.5),
       (14.5, 1.5), (1.5, 14.5), (14.5, 14.5). Vor dem Fix: 13.5 statt 14.5.
     - `a fractional padding lays out as many tiles as fit` — Bild 100×10,
       Kachel 10×10, `padding: 1.5`: `tileCount` 7, letzte Kachel bei
       x = 79.5. Vor dem Fix: 8 Kacheln.
   - `TextureResource.spec.ts`, Block `frame based animations`:
     - `a tile set resource takes its animations back when its animation data is cleared`
       — Getter `undefined`, ein danach angemeldeter
       `on(resource, 'frameBasedAnimations', …)` bekommt nichts.
     - `an atlas resource takes its animations back when its animation data is cleared`
     - `animations cleared with their data come back with new data` (Wächter,
       vor dem Fix grün)
   - `TextureResource.spec.ts`, Block `load()`:
     - `a tile set resource whose options were cleared before load() builds its tile set once they are set again`
     - `an atlas resource whose atlasUrl was cleared before load() fetches once it is set again`
     - `an atlas resource without an atlasUrl at load() builds its atlas from an atlasJson written later`
   - `TextureResource.spec.ts`, Block `texture ownership`:
     - `a subscriber of the texture that throws leaves the texture to the resource`
       — `error` mit `source: 'texture'` kommt an; `resource.dispose()` gibt
       die veröffentlichte Textur frei.
     - `a texture published by a batch that threw is released by its successor`
       — zweites Bild nach dem werfenden ersten: die erste Textur ist frei.
     - `a resource disposed by a subscriber of its new texture releases both textures`
       — Nachstellung (c): zweites Bild, der `texture`-Subscriber ruft
       `resource.dispose()`; beide Texturen frei.
   - `TextureResource.spec.ts`, neuer Block
     `an atlas json that is cleared or cannot be read`:
     - `clearing the atlasJson takes the atlas and its animations back and keeps the texture`
       — Getter `atlas` und `frameBasedAnimations` `undefined`, retained
       Events geräumt, `texture` unverändert.
     - `an atlasJson that TexturePackerJson cannot read is reported and takes the atlas back`
       — `atlasJson = {frames: {a: {}}, meta: {image: <das geladene Bild>, size: {w, h}}}`:
       der Setter wirft nicht, `error` mit `{source: 'texture', id}`,
       `atlas` und `frameBasedAnimations` `undefined`.
     - `an unreadable atlasJson naming another image is reported once that image is there`
       — bis zum Bild steht der vorige Atlas (Regel `:769-775`), danach
       Rücknahme und genau ein `error`.
     - `a readable atlasJson after an unreadable one brings the atlas back`
       (Wächter)
   - `TextureStore.spec.ts`, bei den `parse()`-Tests zu vorhandenen
     Resources:
     - `a parse() without animation data takes the animations of a known resource back`
       — Tile-Set-Item mit `frameBasedAnimations`, zweites `parse()` ohne
       (Pfad `TextureStore.ts:471`).
   Der rote Lauf (Kommando und Zahl der roten Tests) gehört in den Report.

   Zwei Fallen beim Aufbau: Eine geholte JSON prüft `isAtlasJsonResponse()`
   (`isAtlasJsonResponse.ts`) vor dem Parse — sie braucht `meta.size` mit
   `w`/`h` und je Frame ein `frame` mit Zahlen, eine unlesbare wird dort als
   `error` mit `source: 'atlas'` abgewiesen und erreicht den Atlas-Effekt nie.
   Die unlesbare JSON der Atlas-Tests kommt deshalb über den Setter
   `atlasJson`. Und nach Schritt 4 wirft der Atlas-Effekt nicht mehr: die
   Übergabe-Tests lösen den Throw im Batch über einen werfenden
   `texture`-Subscriber aus, nicht über eine unlesbare JSON.

8. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` →
   `### Fixed`, hinter der Zeile zur TileSet-Rücknahme `:219`; Skill
   `updating-changelog` laden). Je ein Eintrag im Ton der Nachbarzeilen, ohne
   Rückblick auf den Vorzustand:
   - `TileSet` legt Kacheln mit gebrochenem `padding` um das ganze doppelte
     Padding auseinander.
   - `TextureResource` nimmt `frameBasedAnimations` zurück, sobald
     `frameBasedAnimationsData` geleert ist — auch über ein `parse()` ohne
     Animationsdaten; Getter `undefined`, retained Event geräumt.
   - Eine Atlas-`TextureResource`, deren `atlasJson` geleert ist oder sich
     nicht lesen lässt, bietet keinen Atlas und keine Animationen daraus an;
     eine unlesbare JSON geht als `error` mit `source: 'texture'` hinaus, der
     Setter wirft nicht; die Textur bleibt.
   - `TextureResource#load()` registriert die Effekte einer Tile-Set- bzw.
     Atlas-Resource auch dann, wenn `tileSetOptions` bzw. `atlasUrl` beim
     Aufruf leer sind; ein später gesetzter Wert baut TileSet bzw. Atlas.
   - `TextureResource` besitzt eine Textur, bevor sie sie veröffentlicht: ein
     Subscriber, der wirft oder die Resource disposed, lässt keine Textur
     zurück, die nie freigegeben wird.

## Nebenbefunde im Volltext

Aus »Offene Befunde« des Plans, Zeilen wie dort eingetragen (Zeilenangaben dort
aus dem Stand ihres Pakets; aktuelle Fundstellen oben unter »Abgleich«):

**Padding** · low · `packages/twopoint5d/src/texture/TileSet.ts:147-148` —
`padding << 1` schneidet einen gebrochenen `padding` ab (`1.5 << 1` ist 2,
nicht 3): die Schrittweite von Kachel zu Kachel ist dann 1 px zu klein, jede
weitere Spalte und Zeile verrutscht um 1 px gegen das Bild · aus Paket 3
(Zug 0, vorbestehend seit e352b56).

**Animationsdaten** · low · `packages/twopoint5d/src/texture/TextureResource.ts:599`,
`:752` (Stand `4e45acc`) — die Animations-Effekte schreiben nur bei
`tileSet && this.frameBasedAnimationsData` bzw. `atlas && …`;
`frameBasedAnimationsData = undefined` (etwa `TextureStore#parse()` mit einem
Item ohne Animationsdaten, `TextureStore.ts:471`) lässt die alten
`frameBasedAnimations` stehen · aus Paket 9.

**Registrierung** · low · `packages/twopoint5d/src/texture/TextureResource.ts:578`,
`:631` (Stand `4e45acc`) — ob `load()` den TileSet- bzw. Atlas-Effekt
registriert, hängt am Wert bei `load()` (`if (this.tileSetOptions)`,
`if (this.atlasUrl)`); wird der Wert vor `load()` geleert und später wieder
gesetzt, baut die Resource nie ein TileSet bzw. einen Atlas · aus Paket 9.

**Übergabe** · low · `packages/twopoint5d/src/texture/TextureResource.ts:538-547`
— die Übergabe von `#ownTexture` steht hinter dem `batch()` des
Bild-Effekts; wirft darin ein abgeleiteter Effekt — der Atlas-Effekt auf einem
von außen gesetzten `atlasJson`, dessen Frames `TexturePackerJson.parse()`
nicht lesen kann (`{frames: {a: {}}}`) —, re-raised `batch()` und die
Übergabe fällt aus: die neue Textur steht auf dem Signal, gehört niemandem und
wird nie freigegeben, der Vorgänger lebt bis `dispose()` · aus Paket 9 (Zug 0,
vorbestehend seit e352b56; den TileSet-Weg schließt Paket 9).

**Audit MEM-001** (medium, zum Vergleich, nicht als Finding geführt) —
»Textur-Ownership vor dem batch() festhalten, der sie veröffentlicht«: Wirft
ein Effekt oder eine onChange-Bridge innerhalb des `batch()`, wird das nach der
Auslieferung aus `batch()` heraus rethrown. Die Werte sind dann geschrieben —
`#texture` trägt die neue Textur —, aber die Übergabe läuft nie:
`#ownTexture` zeigt weiter auf den Vorgänger. `dispose()` gibt später den
Vorgänger frei und nie die Textur, die tatsächlich auf dem Signal liegt.
Auslöser: ein Subscriber auf `texture`/`atlas`/`imageCoords`, der wirft.
Empfehlung: `const previous = this.#ownTexture; this.#ownTexture = texture;
try { batch(…) } finally { previous?.dispose(); }` — Spec: ein werfender
`texture`-Subscriber, Assertion auf Dispose der aktuellen Textur.

## Urteil des Reviewers (`paket-14.review-1.json`)

- **Padding:** behoben — `TileSet.ts:189-190` (`padding * 2`), Tests mit den Werten des Plans.
- **Animationsdaten:** behoben — beide Animations-Effekte in `TextureResource.ts` (TileSet-Zweig um `:640-650`, Atlas-Zweig um `:835-845`) schreiben `undefined` ohne Basis oder Daten; dazu der `parse()`-Fall in `TextureStore.spec.ts`.
- **Registrierung nach Shape:** behoben — Guards in `load()` (`TextureResource.ts:600-609` und Atlas-Zweig) prüfen die Shape-Signale, `!` entfallen, `touch(atlasUrlSignal)` bleibt.
- **Textur-Übergabe:** behoben — `TextureResource.ts:552-570`, Ownership vor dem `batch()`, Vorgänger im `finally`; Nachstellungen (a), (b), (c) als Specs. Deckt MEM-001.
- **Atlas-Rücknahme (mitgenommen):** behoben — Atlas-Effekt in der Reihenfolge des Plans, `takeBack()` bei geleerter und unlesbarer JSON, `error` mit `source: 'texture'`, kein Throw.
- Alle 16 Testnamen wörtlich wie im Plan; CHANGELOG fünf Einträge unter `### Fixed`; Commit-Message ohne ID.

Kleine Befunde (keine Runde):
- `TextureResource.ts:553-554` — Kommentar »cannot skip the handover any more« blickt auf den Vorzustand zurück; »cannot skip the handover« genügt.
- `TextureResource.spec.ts`, Block `an atlas json that is cleared or cannot be read`, Helfer `writeUnreadable` — `try/catch` nach dem Fix toter Code, Kommentar beschreibt den Übergang; direkte Zuweisung genügt.
- Klassen-TSDoc `TextureResource.ts:180-182` — »while its `atlasJson` … cannot be read« gilt erst, wenn das genannte Bild da ist; Getter- und Events-TSDoc sagen es richtig.

Vom Implementierer gemeldet, nicht in die Queue: ein von außen gesetztes `atlasJson` ohne `meta` wirft weiter beim Setter (Bild-Effekt und URL-Guard lesen `meta` außerhalb des `try`); die neue Setter-TSDoc »writing it does not throw« bezieht sich auf unlesbare Frames. Bewusst ausgenommen (Entscheidungen dieses Pakets: Eingabevalidierung, im Audit als SEC-001).
