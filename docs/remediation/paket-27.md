# Paket 27 — Drain 3: Verhalten und Tests der Library — Aseprite-Rat, meta.image, Spec-Lücken, ein Cast

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine eigenen — acht Nebenbefunde der Drain-Runde 3 (Reviewer-»klein« und offene
  Abweichungen der Pakete 5, 8, 18, 20), Volltext unten
- Ziel: `AsepriteJson.parse()` rät nur dann zu einem kleineren `repeat`, wenn die Wiederholung die
  Ursache ist, und prüft die Grenze der Frames auch für einen Tag mit eigenem Playback; ein
  `atlasJson` von außen, dessen `meta` kein Objekt oder dessen `meta.image` gesetzt, aber kein
  String ist, wird einmal je Schreiben als Fehler gemeldet; die genannten Specs prüfen, was sie
  prüfen sollen (Grenzen um 8191/8192 Frames, unveränderte Buffer-Werte, Meldung im
  Konstruktor-Test, aufgeschobene Schärfung, `fullscreenerror`); der Cast in
  `transitionEffects.ts:503` entfällt.
- Modell: stärkste Stufe (fünf Module; Schritt 2 baut die Fehlermeldung eines Signal-Effekts um,
  die Reihenfolge der Effekte und »genau einmal gemeldet« sind die Falle)
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/AsepriteJson.ts` (+ `AsepriteJson.spec.ts`)
  - `packages/twopoint5d/src/texture/TextureResource.ts` (+ `TextureResource.spec.ts`,
    `TextureStore.spec.ts`)
  - `packages/twopoint5d/src/display/DisplayFullscreen.ts` (nur TSDoc des Setters `onLandscape`)
    (+ `DisplayFullscreen.spec.ts`)
  - `packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`
  - `packages/twopoint5d/src/stage/transitionEffects.ts`
  - `packages/twopoint5d/docs/sprites.md` (Absatz »Aseprite sheets« `:381-388`)
  - `packages/twopoint5d/CHANGELOG.md` (nur `## [Unreleased]` → `### Fixed`, Zeilen `:75` und `:80`)
- Nicht anfassen: `src/texture/FrameBasedAnimations.ts` (die Konstanten bleiben: `MaxTextureSize`
  8192, `MaxFramesWithDurations` 8191), `fetchAtlasJson.ts`/`isAtlasJsonResponse.ts` (der Weg des
  geholten Jsons meldet schon über `atlasImage`), `docs/textures.md` (beschreibt den Fall nicht —
  vorher mit `grep -n "meta.image\|names no image" packages/twopoint5d/docs/*.md` bestätigen),
  `docs/display.md` und das Proposal `display-fullscreen.md` (§6.2 sagt schon, was Schritt 3
  festhält), jede veröffentlichte CHANGELOG-Sektion, nichts unter `apps/` oder
  `packages/twopoint5d-testing/`.

## Abgleich (Zug 0, 2026-11-01, Stand `9f119a6d`)

| # | Nebenbefund | Stand |
| --- | --- | --- |
| 1 | Aseprite-Rat bei `repeat` 0 | besteht, um eine Zeile verschoben: Zählung `AsepriteJson.ts:458-468`, Meldung `:465`. Dazu gleicher Ursache (die Grenzprüfung kennt nur die Wiederholung als Grund für zu viele Frames): die zweite Meldung `:474-478` (»with their own durations … lower its repeat«) rät dasselbe bei einem Tag, der ohne Wiederholung 8192 Frames spannt, und mit eigenem Playback (`options.playback`) überspringt `:456-457` die Zählung ganz — ein Tag über mehr als 8192 Frames geht dann durch, gegen das TSDoc `:333-334` (»a tag that plays more than `MaxTextureSize` frames at all«); `FrameBasedAnimations#add()` prüft eine Namensliste nicht gegen diese Grenze (`FrameBasedAnimations.ts:408-414` nennt nur `tileCount`) |
| 2 | `meta.image` kein String still | besteht: `imageNamedBy()` `TextureResource.ts:253-260`, Vertrag im TSDoc `:349-351` und `:1407-1409`, festgehalten von `TextureResource.spec.ts:1613` (`errors` `[]`). Dazu gleicher Ursache (die Meta-Prüfung steht im Atlas-Effekt hinter dem Tor »ohne Bild nichts bauen« `:1656-1661`, also meldet sie nur, wenn ein Bild da ist): ein `meta`, das kein Objekt ist, ohne `overrideImageUrl` bleibt ebenso still (`TextureResource.spec.ts:1592`, `errors` `[]`); beide an der Basis von Paket 8 (`fd239a63`) so gebaut, Abweichung von BUG-025 |
| 3 | Aseprite-Specs bei 8192 | besteht: `AsepriteJson.spec.ts:455-476` — die Prüfung auf `MaxFramesWithDurations` (8191) ist nur bei genau 8192 Frames abgedeckt (jede Zahl darüber nimmt schon die Grenze der Datentextur); es fehlt die Seite darunter (8191 mit eigenen Dauern geht durch) und die Reihenfolge darüber (über 8192 mit eigenen Dauern nennt die Datentextur) |
| 4 | aufgeschobene Schärfung ohne Test | besteht, verschoben: der Aufschub steht jetzt `DisplayFullscreen.ts:380-381`, die Bedingung `this.#pending == null` in `#rearm()` `:976-989`; Proposal §6.2 (`docs/proposals/display-fullscreen.md:369-376`) sagt es, das TSDoc des Setters `:360-362` nennt die Bedingung nicht; kein Test ruft im `then` einer Ablehnung erneut `request()` |
| 5 | Buffer-Werte-Prüfung wirkungslos | besteht: `VertexObjectPool.spec.ts:732-744` — `toBuffersData({copy: true})` desselben Pools, die Werte sind gleich, ein Schreiben vor dem Wurf fiele nicht auf |
| 6 | Konstruktor-Test ohne Meldung | besteht: `VertexObjectPool.spec.ts:746-750`, nur `toThrow(RangeError)`; der Wurf kommt aus `VOBufferPool.ts:116` → Setter `:139-142` |
| 7 | Cast `p as Node<'float'>` | besteht: `transitionEffects.ts:503`; `p` geht an `:495` ohne Cast in ein Feld `progress: Node<'float'>` (`:44`), also trägt der Typ ihn auch in der Rückgabe (`TransitionNode.progress: Node<'float'>`, `:471`) |
| 8 | kein Test für `fullscreenerror` | besteht: der Controller hört das Event nicht (`grep fullscreenerror src` leer), die Ablehnung kommt über das Promise (Entscheidung 9 in Paket 5); der Ablehnungs-Test steht jetzt `DisplayFullscreen.spec.ts:210` |

Keine `Folgen:`-Zeile eines erledigten Pakets ist offen (Pakete 25 und 26 »Folgen: keine«, alle
früheren verteilt). In »Offene Befunde« steht nur noch der Eintrag zu den Prosazeilen (`→ Audit`,
andere Ursache) — er bleibt.

## Entscheidungen dieses Zugs 0

1. **Rat nach Ursache, nicht nach Grenze.** Eine Wiederholung ist die Ursache genau dann, wenn
   ein Durchgang des Tags (`n = to - from + 1` Frames) die Grenze hält: dann gilt der bestehende
   Rat »lower its repeat« (und dann ist zwingend `repeat` ≥ 2 ohne eigenes Playback). Spannt der
   Tag selbst mehr Frames als die Grenze, rät die Meldung, ihn zu teilen — gleich welches
   `repeat` und mit eigenem Playback ebenso. Grund: bei `repeat` 0 oder 1 und bei eigenem
   Playback spielt die Wiederholung keine Rolle; senken ändert nichts.
2. **Die Zählung gilt auch mit eigenem Playback**, dann mit `n` Frames (ein Durchgang; das
   Playback lässt `repeat` weg, `framesOfTag()` `:174`). Damit stimmt das TSDoc `:333-334`
   wieder, und ein solcher Tag wird abgelehnt, bevor der erste Frame in `options.target` geht.
3. **`meta.image` abwesend bleibt still, gesetzt und kein String wird gemeldet.** Der Typ
   verlangt einen String; abwesend heißt »nennt kein Bild« und ist der Vertrag von Paket 8
   (`TextureResource.spec.ts:3023`, `errors` `[]`) — er bleibt. Ein Wert eines anderen Typs (auch
   `null`) ist ein kaputtes Json und wird gemeldet, aber nur ohne `overrideImageUrl`: daneben
   wird `meta.image` nicht gelesen (wie beim geholten Json, `:1593`). Ein `meta`, das kein Objekt
   ist, wird immer gemeldet, mit und ohne Override.
4. **Gemeldet aus dem Effekt, der `imageUrl` ableitet, unter einem eigenen Ladeschritt.** Der
   Effekt `:1628-1637` läuft genau einmal je Schreiben von `atlasJson` oder `overrideImageUrl`
   (Abhängigkeiten `[atlasJsonSignal, overrideImageUrlSignal]`), also wird genau einmal gemeldet,
   und ein später gesetzter Override hebt die Meldung im selben Lauf auf. Der Atlas-Effekt läuft
   dagegen auch bei jeder Änderung von `imageCoords`/`imageUrlOfCoords` und löscht `atlasParse` zu
   Beginn jedes Laufs — dort gemeldet, käme der Fehler doppelt oder verschwände sein Eintrag,
   während das Json steht. Der neue Schritt heißt `'atlasJson'` und hält dieselben Subtypen
   zurück wie `atlasParse` (`['atlas', 'frameBasedAnimations']`): ein `getAsync()` des Atlas lehnt
   ab, statt zu warten. Ohne Override kommt auch kein Bild — wie heute bei einem Json ohne
   `meta.image`; das bleibt so (nicht Teil dieses Befunds). Quelle des Events bleibt
   `source: 'texture'` mit `id`, wie beim heutigen Fall neben einem Override und bei einem
   Adapterfehler. Abweichung vom Wortlaut des Befunds (»als atlasParse gemeldet«): der Name des
   Schritts ist intern, sichtbar ist das Event, und das ist dasselbe.
5. **Schritt 3 und 5 sind Abdeckung, kein Bugfix.** Ihre Tests sind vor und nach grün; belegt
   wird ihre Wirkung durch eine Verfälschung im Code (vorübergehend, im Report benannt, danach
   zurückgenommen), unter der sie rot werden. Schritte 1 und 2 sind Verhaltensänderungen mit
   rotem Lauf vor dem Fix.
6. **Das TSDoc des Setters `onLandscape` bekommt die fehlende Bedingung** (Schritt 3) — der Test
   hält ein Verhalten fest, das die öffentliche Doku sonst nicht nennt. Guide und Proposal
   bleiben, §6.2 sagt es schon.
7. **CHANGELOG:** beide Zeilen stehen unter `[Unreleased]` → `### Fixed` (von Paket 8) und werden
   ergänzt, keine neue Zeile. `DisplayFullscreen` ist unveröffentlicht, die Specs und der Cast
   sind nicht öffentlich — dafür kein Eintrag.

## Vorgehen

Reihenfolge: erst alle neuen und geänderten Specs der Schritte 1 und 2 schreiben und rot sehen
(Ausgabe in den Report), dann den Code ändern. Einzeldatei-Läufe:
`pnpm nx test twopoint5d -- src/texture/AsepriteJson.spec.ts` usw. (aus dem Repo-Root).

### Schritt 1 — AsepriteJson: Grenze und Rat

`packages/twopoint5d/src/texture/AsepriteJson.ts`

1. In der ersten Schleife über die Tags (`:447-469`): die Zählung läuft für jeden Tag, auch mit
   `override`. `n = tag.to - tag.from + 1` vor das `if`; `count` ist `n`, wenn `override !==
   undefined` oder `repeat === 0`, sonst die bisherige Formel (Ping-Pong
   `n + (repeat - 1) * (n - 1)`, sonst `repeat * n`). `overrides.set()` bleibt im `if (override
   !== undefined)`; die Zählung steht danach für beide Zweige. Den Kommentar `:458-459` so
   anpassen, dass er für beide Zweige gilt.
2. `count > FrameBasedAnimations.MaxTextureSize`:
   - `n <= MaxTextureSize` (die Wiederholung ist die Ursache) → Meldung unverändert:
     `` `AsepriteJson: the tag ${describeValue(tag.name)} plays ${count} frames with a repeat of ${describeValue(tag.repeat)} — an animation holds at most ${FrameBasedAnimations.MaxTextureSize} frames, more fit into no data texture; lower its repeat` ``
   - sonst →
     `` `AsepriteJson: the tag ${describeValue(tag.name)} spans ${n} frames — an animation holds at most ${FrameBasedAnimations.MaxTextureSize} frames, more fit into no data texture; split it into shorter tags` ``
3. In der zweiten Schleife (`:470-478`), Prüfung `!even && indices.length >
   MaxFramesWithDurations`: `n` des Tags dort neu bilden (`tag.to - tag.from + 1`).
   - `n <= MaxFramesWithDurations` → Meldung unverändert (`plays ${indices.length} frames with
     their own durations — an animation with per-frame durations holds at most
     ${MaxFramesWithDurations} frames; lower its repeat`).
   - sonst →
     `` `AsepriteJson: the tag ${describeValue(tag.name)} spans ${n} frames with their own durations — an animation with per-frame durations holds at most ${FrameBasedAnimations.MaxFramesWithDurations} frames; give its frames one duration or split it into shorter tags` ``
4. TSDoc von `parse()` `:333-334`: aus »a tag that plays more than
   `FrameBasedAnimations.MaxTextureSize` frames at all — a repeat no data texture holds —« wird
   sinngemäß »a tag that plays more than `FrameBasedAnimations.MaxTextureSize` frames at all —
   through its repeat, or over a range that long, with a playback of its own as well —«; dazu ein
   Halbsatz, dass die Meldung zu einem kleineren `repeat` nur rät, wo ein Durchgang des Tags
   passt, sonst zum Teilen des Tags. Absatz im Umbruch seiner Nachbarn (≤ 100 Spalten).
5. `packages/twopoint5d/docs/sprites.md:383-385`: der Satz »A tag whose repeat plays more than
   `FrameBasedAnimations.MaxTextureSize` (8192) frames is refused, naming the tag, …« nennt
   ebenso den Tag, der selbst so viele Frames spannt, auch mit eigenem Playback, und dass die
   Meldung je nach Ursache zum kleineren `repeat` oder zum Teilen rät. Absatz neu umbrechen
   (Umbruch der Datei: 100 Spalten).
6. `packages/twopoint5d/CHANGELOG.md:75` (`### Fixed`): ergänzen, dass ein Tag, der selbst mehr
   Frames spannt — auch mit `options.playback` —, ebenso abgelehnt wird, und dass die Meldung
   nur dort zu einem kleineren `repeat` rät, wo ein Durchgang passt, sonst zum Teilen des Tags;
   dasselbe für die Grenze der Frames mit eigenen Dauern. Kein Rückblick (kein »now«, »no
   longer«).

Specs in `packages/twopoint5d/src/texture/AsepriteJson.spec.ts`, neben die Grenz-Specs `:455-505`,
Helfer `sheet(count, meta, durations)` `:16`:

- **neu, rot vor dem Fix:** `test.each` »refuses a tag that spans more frames than a data texture
  holds, whatever its repeat, and advises to split it« über vier Zeilen auf `sheet(8193, {frameTags:
  [{name: 'a', from: 0, to: 8192, direction: 'forward', …}]})`: ohne `repeat`, `repeat: '1'`,
  `repeat: '2'`, ohne `repeat` mit `{playback: {a: 'loop'}}` als zweitem Argument von `parse()`.
  Erwartet je `AsepriteJson: the tag "a" spans 8193 frames — an animation holds at most 8192
  frames, more fit into no data texture; split it into shorter tags`, und mit einem `target`
  (`new TextureAtlas<never>()`) `target.size` 0. Rot vorher: drei Zeilen mit »lower its repeat«,
  die Playback-Zeile ohne Wurf.
- **neu, rot vor dem Fix:** »refuses a tag that spans more frames with their own durations than an
  animation holds, and advises one duration or a split«: `sheet(8192, {frameTags: [{name: 'a',
  from: 0, to: 8191, direction: 'forward'}]}, Array.from({length: 8192}, (_, i) => (i % 2 ? 100 :
  50)))` → `AsepriteJson: the tag "a" spans 8192 frames with their own durations — an animation
  with per-frame durations holds at most 8191 frames; give its frames one duration or split it into
  shorter tags`.
- **neu, Abdeckung (grün vorher):** »takes a repeat that plays 8191 frames with their own
  durations«: Ping-Pong über drei Frames, `repeat: '4095'` (3 + 4094 · 2 = 8191), Dauern `[50, 100,
  50]` → `animation('a').frameCount` 8191.
- **neu, Abdeckung (grün vorher):** »refuses a repeat over 8192 frames with their own durations for
  the data texture first«: `sheet(2, {… repeat: '4097'}, [50, 100])` → die Meldung der
  Datentextur `plays 8194 frames with a repeat of "4097" — … at most 8192 frames …; lower its
  repeat`.
- bestehend `:455-461` (8192 mit eigenen Dauern, `repeat: '4096'`) bleibt wörtlich — dort ist die
  Wiederholung die Ursache. Die übrigen bestehenden Grenz-Specs `:463-505` bleiben ebenso.

### Schritt 2 — TextureResource: ein Json von außen, das sich nicht lesen lässt, wird gemeldet

`packages/twopoint5d/src/texture/TextureResource.ts`

1. `type LoadStep` (`:196`) um `'atlasJson'` erweitern; `SUBTYPES_HELD_BACK_BY_STEP` (`:203-209`)
   bekommt `atlasJson: ['atlas', 'frameBasedAnimations']`. Den Kommentar `:200-202` so ergänzen,
   dass er auch das Json nennt, das sich nicht lesen lässt (es lässt Textur und Koordinaten eines
   Bildes stehen, das ein Override liefert).
2. Neue Modulfunktion neben `imageNamedBy()` (`:253-260`), z. B.
   `unreadableAtlasJsonError(id: string, json: TexturePackerJsonData, overrideImageUrl: string |
   undefined): TypeError | undefined` mit einem Kommentar, warum: ein Json von außen ist typisiert,
   nicht geprüft. Sie antwortet:
   - `meta` kein Objekt (`!isObject(json.meta)`) → `new TypeError(`TextureResource: the atlasJson of
     resource ${describeValue(id)} has a meta of ${describeValue(meta)} — an atlas json carries its
     meta as an object {image, size}`)` — **wörtlich** die heutige Meldung aus `:1677-1679`
     (`TextureResource.spec.ts:1644` hält sie fest);
   - sonst `overrideImageUrl == null` und `meta.image !== undefined` und `typeof meta.image !==
     'string'` → `new TypeError(`TextureResource: the atlasJson of resource ${describeValue(id)} has
     a meta.image of ${describeValue(image)} — an atlas json names its image by url, as a string`)`;
   - sonst `undefined`.
3. Effekt, der `imageUrl` ableitet (`:1628-1637`), neu:
   - als erste Anweisung `context.clearFailure('atlasJson')`;
   - ist ein `atlasJson` da: `imageUrl` wie bisher setzen (`this.overrideImageUrl ??
     imageNamedBy(json)`), danach `unreadableAtlasJsonError(this.id, json, this.overrideImageUrl)`;
     gibt sie einen Fehler, `context.fail('atlasJson', {source: 'texture', id: this.id, error})`.
   - Abhängigkeiten bleiben `[atlasJsonSignal, overrideImageUrlSignal]`; Kommentar: hier, weil
     dieser Effekt einmal je Schreiben läuft — der Atlas-Effekt läuft auch bei jedem neuen Bild.
4. Atlas-Effekt (`:1638-1710`): die Meta-Prüfung im `try` (`:1673-1680`) entfällt. Statt ihrer
   direkt nach `if (!atlasJson) {…}` (`:1652-1655`): `if (!isObject(atlasJson.meta)) { takeBack();
   return; }` mit einem Kommentar: gemeldet hat es der Effekt, der `imageUrl` ableitet, einmal je
   Json; ein Adapter läse `meta.app`. Der Kommentar `:1674-1675` (»before the pick of the adapter
   …«) geht mit der Prüfung. Ein `meta.image`, das kein String ist, neben einem Override erreicht
   den Adapter wie bisher.
5. TSDoc:
   - Klassen-TSDoc `:349-351`: der Spiegelpunkt bleibt wahr (ein solches Json nennt kein Bild);
     ergänzen, dass ein `meta`, das kein Objekt ist, und ein gesetztes `meta.image`, das kein String
     ist, ohne Override gemeldet werden (`error`, `source: 'texture'`) — ein Json ohne `meta.image`
     nicht.
   - Getter `atlasJson`, Punkt `:1407-1409`, neu sinngemäß: »A json whose `meta` is no object is
     reported as an `error` with `source: 'texture'` once it is written, beside an
     `overrideImageUrl` as well, and builds no atlas. A `meta.image` that is set but is no string
     is reported the same way while no `overrideImageUrl` stands beside it, which takes its place
     unread. Without an `overrideImageUrl` either names no image, as a json without `meta.image`
     does — which is not reported.« Im Umbruch der Nachbarn.
6. `packages/twopoint5d/CHANGELOG.md:80` (`### Fixed`) neu sinngemäß: »`AtlasTextureResource` reads
   `meta` and `meta.image` of an `atlasJson` written from outside without a raw throw: a `meta`
   that is no object is reported as an `error` with `source: 'texture'`, beside an
   `overrideImageUrl` as well, and so is a `meta.image` that is set but is no string while no
   `overrideImageUrl` stands beside it — once per write, and a `getAsync()` of its atlas rejects;
   without an `overrideImageUrl` neither names an image«.

Specs in `packages/twopoint5d/src/texture/TextureResource.spec.ts`, Block um `:1592` (Helfer
`loadedAtlasResource()` darüber):

- **geändert, rot vor dem Fix:** `:1592` heißt »an atlasJson written from outside whose meta is no
  object names no image and is reported once«; Erwartungen wie bisher, nur `errors` ist
  `[{source: 'texture', id: 'sprites', error: new TypeError('TextureResource: the atlasJson of
  resource "sprites" has a meta of undefined — an atlas json carries its meta as an object {image,
  size}')}]`.
- **geändert, rot vor dem Fix:** `:1613` heißt »an atlasJson written from outside whose meta.image
  is no string loads no image and is reported once«; `errors` ist `[{source: 'texture', id:
  'sprites', error: new TypeError('TextureResource: the atlasJson of resource "sprites" has a
  meta.image of 42 — an atlas json names its image by url, as a string')}]`.
- **bleibt grün:** `:1629` (neben einem Override `meta` kein Objekt, genau einmal gemeldet, Textur
  `hero.png` bleibt, Atlas weg) und `:3023` (Json ohne `meta.image`, `errors` `[]`).
- **neu, Abdeckung:** »beside an overrideImageUrl, an atlasJson written from outside whose
  meta.image is no string builds its atlas from the image of the override and is not reported«:
  Override `hero.png` setzen, dann `{...atlasJson, meta: {...atlasJson.meta, image: 42}}` schreiben;
  `resource.atlas` ist da, Textur `hero.png`, `errors` `[]`.
- **neu, rot vor dem Fix:** »an overrideImageUrl written after an atlasJson whose meta.image is no
  string builds the atlas, and the report goes out once«: Json mit `image: 42` ohne Override → ein
  Fehler; dann `overrideImageUrl = 'hero.png'` → Atlas und Textur `hero.png` da, `errors` hat
  weiter genau einen Eintrag.

Spec in `packages/twopoint5d/src/texture/TextureStore.spec.ts`, neben `:2710` (Muster dort:
`fetch` und `ImageLoader.prototype.loadAsync` gemockt, `store.getAsync('a', 'atlas')`,
`settleWithin()` `:47`, `messageOf()` im Block):

- **neu, rot vor dem Fix:** »a getAsync() of the atlas rejects once an atlasJson whose meta.image is
  no string is written to its resource, and one asked after an overrideImageUrl resolves«: Json
  mit `meta: {image: 42, size: {w: 100, h: 50}}` schreiben → `getAsync('a', 'atlas')` lehnt ab,
  die Meldung enthält den TypeError-Text (vor dem Fix: bleibt offen); danach `overrideImageUrl =
  'a.png'`, Bild auflösen → ein neues `getAsync('a', 'atlas')` liefert `resource.atlas`.

### Schritt 3 — DisplayFullscreen: aufgeschobene Schärfung neben einem neuen request() der Seite

`packages/twopoint5d/src/display/DisplayFullscreen.spec.ts`, Block `describe('onLandscape')`, direkt
nach »onLandscape = true beside a request() the browser refuses arms once the refusal is in«
(`:1271-1285`; dort auch `orientation`, `make()`, `answerLater()`, `flush`):

- **neu, Abdeckung:** `it.each` über `['grants', 'refuses']` »onLandscape = true beside a request()
  the browser refuses arms nothing while a request() the page calls on that refusal is under way,
  and the answer of that request decides«:
  ```ts
  orientation.type = 'landscape-primary';
  const first = answerLater(defaultTarget);
  const second = answerLater(defaultTarget);
  const fs = make();
  let again: Promise<boolean> | undefined;
  // attached before the setter attaches its arming: it runs first once the refusal is in
  const requested = fs.request().then((active) => {
    if (!active) again = fs.request();
    return active;
  });
  fs.onLandscape = true;

  first.refuse();
  await expect(requested).resolves.toBe(false);
  await flush();
  // the deferred arming found the page's request under way and left it to its answer
  expect(fs.isArmed).toBe(false);
  expect(defaultTarget.listenerCount('pointerup')).toBe(0);
  expect(defaultTarget.requestFullscreen).toHaveBeenCalledTimes(2);

  answer === 'grants' ? second.grant() : second.refuse();
  await expect(again).resolves.toBe(answer === 'grants');
  await flush();
  expect(fs.isArmed).toBe(false);
  expect(emitted.some((props) => props.isArmed)).toBe(false);
  ```
  (Wortlaut der Namen frei, Inhalt nicht.) Beleg: unter der Verfälschung »`this.#pending == null &&`
  in `#rearm()` (`DisplayFullscreen.ts:984`) gestrichen« wird der Test rot; Ausgabe in den
  Report, Verfälschung zurücknehmen.
- TSDoc des Setters `onLandscape` (`DisplayFullscreen.ts:360-362`): an »… it arms once that answer
  is in — where the screen is still landscape, the target out of fullscreen and no other element
  in fullscreen« anfügen sinngemäß », and no newer request or exit is under way: a `request()` of
  the page called on that answer decides with its own, and its refusal arms nothing«. Absatz im
  Umbruch der Nachbarn.

### Schritt 4 — DisplayFullscreen: `fullscreenerror`

`packages/twopoint5d/src/display/DisplayFullscreen.spec.ts`, Block `describe('request()')`, nach »a
refused request resolves false, emits nothing and warns once per page« (`:210-220`):

- **neu, Abdeckung:** »a fullscreenerror the browser fires beside the refusal of a request is not
  heard as a second refusal: the request resolves false, emits nothing and warns once«:
  `defaultTarget.requestFullscreen.mockImplementation(() => { defaultTarget.dispatch('fullscreenerror');
  doc.dispatch('fullscreenerror'); return Promise.reject(new TypeError('Permissions check failed'));
  })` (das Stub lässt nichts aufsteigen, daher beide Ziele); erwartet `resolves.toBe(false)`,
  `emitted` `[]`, `warn` genau einmal. Beleg: unter einer Verfälschung, die das Event hört (etwa
  ein Listener am Dokument im Konstruktor, der die Ablehnungswarnung ein zweites Mal ausgibt
  oder den Zustand neu liest und meldet), wird der Test rot; Verfälschung im Report nennen,
  zurücknehmen.
- **neu, Abdeckung:** »a fullscreenerror of another element changes nothing: no event, no
  warning«: `const fs = make(); await fs.request();` (gewährt), `emitted`-Länge merken,
  `doc.dispatch('fullscreenerror')`, Mikrotasks abwarten → `fs.isActive` `true`, `emitted`-Länge
  unverändert, `warn` nicht gerufen.

### Schritt 5 — VertexObjectPool-Specs prüfen, was sie behaupten

`packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts`

- `:732-744` »fromBuffersData() refuses buffers data whose usedCount is no number, and leaves the
  pool as it was«: nach `toBuffersData({copy: true})` jede kopierte Typed-Array-Liste mit einem
  Wert füllen, den der Pool nicht hält (z. B. `for (const array of
  Object.values(buffersData.buffers)) array.fill(7);`, vorher prüfen, dass die Pool-Werte nicht
  schon 7 sind), sonst unverändert. Beleg: unter der Verfälschung »`this.usedCount =
  buffersData.usedCount;` in `VOBufferPool#fromBuffersData()` (`VOBufferPool.ts:325`) hinter die
  Schreibschleife verschoben« wird der Test rot, mit den alten Daten bliebe er grün; Ausgabe in
  den Report, zurücknehmen.
- `:746-750` »the constructor refuses buffers data whose usedCount is no number«: zusätzlich zur
  Klasse die Meldung, wie der Nachbar `:713-719`: `expect(build).toThrow(RangeError);
  expect(build).toThrow('VOBufferPool#usedCount must be a whole number, Infinity or -Infinity, got
  undefined');`. Beleg: unter einer vorübergehend geänderten Meldung im Setter
  (`VOBufferPool.ts:141`) wird der Test rot.

### Schritt 6 — der Cast in transitionEffects

`packages/twopoint5d/src/stage/transitionEffects.ts:503`: `return {node, progress: p as
Node<'float'>};` → `return {node, progress: p};`. `pnpm typecheck` hält es (an `:495` geht derselbe
Wert ohne Cast in ein `Node<'float'>`-Feld). Bleibt `Node` danach im Modul ungenutzt, den Import
mitziehen (er wird an `:44`, `:142`, `:471` weiter gebraucht — prüfen, nicht raten).

### Am Ende

- Jede geänderte Datei ganz lesen (bei `TextureResource.ts` und `DisplayFullscreen.ts` die
  geänderten Funktionen samt Nachbarn) und melden, was darin falsch ist und nicht zum Paket
  gehört.
- `grep -n "lower its repeat" packages/twopoint5d/src packages/twopoint5d/docs -r` — jeder Treffer
  steht in einem Zweig, in dem ein Durchgang des Tags die Grenze hält.

## Verify

`pnpm run ci` (aus dem Repo-Root; hält eine Sperre, nie parallel zu einem zweiten Gate).

## Commit

`fix(twopoint5d): advise splitting an Aseprite tag that spans more frames than an animation holds, with a playback of its own as well, report an atlas json written from outside whose meta or meta.image cannot be read, hold the vertex pool and fullscreen specs to what they claim and drop a cast transitionEffects does not need`

## Verlauf

- 2026-11-01 Zug 0: Detailplan steht · alle acht Nebenbefunde bestehen (Aseprite `:465`, `imageNamedBy()`
  `TextureResource.ts:253-260`, Specs `AsepriteJson.spec.ts:455-476`, Aufschub
  `DisplayFullscreen.ts:381`, `VertexObjectPool.spec.ts:732-744`/`:746-750`,
  `transitionEffects.ts:503`, `fullscreenerror` ohne Listener), keiner gegenstandslos · dazu
  gleicher Ursache: Durations-Meldung `AsepriteJson.ts:474-478`, Playback-Lücke `:456-457`,
  `meta` kein Objekt ohne Override (`TextureResource.spec.ts:1592`), TSDoc `onLandscape`
  `:360-362` · keine offene Folge zu verteilen; der Eintrag »Prosazeilen« in »Offene Befunde«
  bleibt (→ Audit, andere Ursache)
- 2026-11-01 Zug 1: Implementierer beauftragt (opus, Effort medium), Brief `paket-27.impl-0.brief.txt` · erster Start nie gelaufen (relativer Briefpfad, `paket-27.impl-0.json` leer, Exit 1) · zweiter Anlauf `paket-27.impl-0-versuch-2.json`
- 2026-11-01 Zug 2: Report FERTIG (session `8375094a`), 11 Dateien geändert (AsepriteJson, TextureResource, TextureStore.spec, DisplayFullscreen TSDoc+Spec, VertexObjectPool.spec, transitionEffects, sprites.md, CHANGELOG), rote Läufe und Verfälschungen belegt, Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-27.verify.log`)
- 2026-11-01 Zug 3: Reviewer beauftragt (opus, medium), Diff `paket-27.diff`, Report `paket-27.review-0.json` · Urteil: abnahmefähig, alle acht Befunde und Schritte 1–6 erfüllt, kein kritischer, kein wichtiger, fünf kleine
- 2026-11-01 Zug 4: entfällt (nichts offen außer »klein«)
- 2026-11-01 Zug 5: Commit `ef8d23ab` (11 Dateien), Verify `paket-27.verify.log` exit=0 auf demselben Stand

## Urteil des Reviewers (Zug 3, `paket-27.review-0.json`)

| # | Urteil | Fundstelle |
| --- | --- | --- |
| 1 | erfüllt | `AsepriteJson.ts:457-471` (Zählung für jeden Tag, auch mit Override; Rat nach `n <= MaxTextureSize`), Durations-Prüfung `:478-483` |
| 2 | erfüllt | `TextureResource.ts:264-286` (`unreadableAtlasJsonError`), Effekt `:1660-1674`; fehlendes `meta.image` bleibt still |
| 3 | erfüllt | `AsepriteJson.spec.ts:499-513` (8191 mit eigenen Dauern geht durch, 8194 nennt die Datentextur) |
| 4 | erfüllt | `DisplayFullscreen.spec.ts:1316-1346`, TSDoc `DisplayFullscreen.ts:361-363` |
| 5 | erfüllt | `VertexObjectPool.spec.ts:738-740` (Kopie mit 7 gefüllt, Pool hält keine 7) |
| 6 | erfüllt | `VertexObjectPool.spec.ts:753`, Meldung wörtlich wie `VOBufferPool.ts:142` |
| 7 | erfüllt | `transitionEffects.ts:503` `{node, progress: p}`, Import `Node` bleibt gebraucht |
| 8 | erfüllt | `DisplayFullscreen.spec.ts:222-249`, zwei Tests |

Kleine Befunde (lösen keine Runde aus):

1. `packages/twopoint5d/src/texture/TextureResource.spec.ts:1680` — der Testname sagt »is reported once as a json its adapter cannot read«; gemeldet wird vom Effekt, der `imageUrl` ableitet, beim Schreiben. Vorschlag: »… is reported once and builds no atlas«.
2. `packages/twopoint5d/CHANGELOG.md:75` — »and so it refuses a tag that spans more frames itself« liest sich als Folgerung, gemeint ist »likewise«; der Eintrag ist ein sehr langer Satz.
3. `packages/twopoint5d/docs/sprites.md:383-387` — drei Gedankenstriche in einem Satz, zwei Einschübe hintereinander; »with a playback of its own« steht vor dem Satz, der `playback` einführt. Zwei Sätze wären lesbarer.
4. `packages/twopoint5d/src/texture/TextureStore.spec.ts:2741` — `expect(messageOf(settled)).toBe(resource.atlas)` liest sich, als hätte der Atlas eine Meldung; direkter `expect(settled).toBe(resource.atlas)` (das `toBeDefined()` davor entfiele).
5. `packages/twopoint5d/src/display/DisplayFullscreen.spec.ts:242-243` — zwei `await Promise.resolve()` von Hand, wo der Block `onLandscape` `flush()` hat.

Abweichungen des Implementierers (vom Reviewer gebilligt): TextureStore-Spec prüft die Meldung `TextureStore: getAsync("a", "atlas") failed at the texture step` wörtlich und den TypeError über `cause.message` (der Store hängt ihn als `cause` an); `{...options, target}` als zweites Argument in der Playback-Zeile; `if/else` statt Ternär (Lint); `biome check --write` über die geänderten `.ts`-Dateien.

## Findings im Volltext

Die acht Nebenbefunde, wie sie im Plan stehen:

1. **`packages/twopoint5d/src/texture/AsepriteJson.ts:464-469`** — Bei repeat === 0 wird ein
   Loop-Tag über 8192 Frames mit dem unpassenden Rat »lower its repeat« abgelehnt. (aus
   paket-8.md)
2. **`packages/twopoint5d/src/texture/TextureResource.ts:251-258` (imageNamedBy(), laut Review)** —
   BUG-025: ein meta.image eines Jsons von außen, das kein String ist, wird nicht als atlasParse
   gemeldet, sondern still wie ein fehlendes Bild behandelt. (aus paket-8.md)
3. **ohne Zeile** — Drei Aseprite-Specs von 9000 auf 8192 Frames gezogen; die Prüfung auf
   MaxFramesWithDurations greift in den Specs nur noch bei genau 8192 gespielten Frames. (aus
   remediation-plan.md, Paket 8, Ergebnis)
4. **`packages/twopoint5d/src/display/DisplayFullscreen.ts:358`** — Eine aufgeschobene Schärfung
   entfällt, wenn die Seite nach einer Ablehnung synchron erneut request() ruft; entspricht §6.2,
   aber ohne Test. (aus paket-18.md)
5. **`packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:732-743`** — Prüfung
   »Buffer-Werte unverändert« greift nicht, weil die Daten per toBuffersData({copy: true}) aus
   demselben Pool stammen. (aus paket-20.md)
6. **`packages/twopoint5d/src/vertex-objects/VertexObjectPool.spec.ts:746-750`** — Konstruktor-Test
   prüft nur die Klasse RangeError, nicht die Meldung. (aus paket-20.md)
7. **`packages/twopoint5d/src/stage/transitionEffects.ts:503`** — Geprüfter Upcast `progress: p as
   Node<'float'>` bleibt, obwohl derselbe Wert bei :495 ohne Cast durchgeht. (aus paket-20.md)
8. **ohne Zeile** — Kein Test für das fullscreenerror-Event (Entscheidung 9, Abweichung von der
   Empfehlung zu TEST-001); getestet ist nur die Ablehnung über das Promise
   (DisplayFullscreen.spec.ts:157 laut Zug 0). (aus paket-5.md)

Die Audit-Findings, auf die sich 1–3 und 8 zurückführen (Original aus `audit.html`, alle mit
Paket 5 bzw. 8 geschlossen; hier nur als Hintergrund):

**RES-006 · low · packages/twopoint5d/src/texture/AsepriteJson.ts:180** — Obergrenze für `repeat`
eines Aseprite-Tags setzen. `framesOfTag()` baut für ein Tag mit `repeat` r ≥ 1 ein Indexarray der
Länge r × Frames. `repeatOf()` prüft nur Ganzzahl ≥ 0, keine Obergrenze. Das Limit
`MaxFramesWithDurations` greift nur bei ungleichen Dauern; bei gleichen Dauern wird jedes beliebig
große `repeat` (etwa `"1000000000"`) materialisiert, die Schleife läuft r-mal und `indices.map` plus
`frameNames` allozieren erneut — der Parse hängt oder läuft in Out-of-Memory, obwohl 'once' mit
einer Gesamtdauer genügen würde.
Empfehlung: `repeat` gegen eine sinnvolle Höchstzahl (oder Gesamtframezahl) prüfen und mit klarer
Fehlermeldung ablehnen, bevor `indices` gebaut wird.

**BUG-025 · low · packages/twopoint5d/src/texture/TextureResource.ts:1576** — `meta` eines von
außen geschriebenen `atlasJson` vor dem Lesen prüfen. Das TSDoc von `atlasJson` verspricht, dass ein
nicht lesbares Json als `error` (source 'texture') gemeldet wird und das Schreiben nicht wirft. Der
Effekt, der `imageUrl` ableitet, und der Atlas-Effekt lesen aber `atlasJson.meta.image` ungeschützt
(Zeile 1612 liegt vor dem `try`). Ein Json ohne `meta` (JS-Aufrufer, Cast) löst einen rohen
TypeError im Effekt aus, der über den globalen Fehlerkanal von signalize läuft; ein nicht-String als
`meta.image` landet ungeprüft als `imageUrl` und geht an den Image-Loader.
Empfehlung: `meta` und `meta.image` im `atlasJson`-Setter oder in beiden Effekten prüfen und den
Fall als `fail('atlasParse', …)` melden wie einen Adapterfehler.

**TEST-001 · medium · packages/twopoint5d/src/display/DisplayFullscreen.spec.ts:336** —
DisplayFullscreen: Dispose und Exit während eines offenen Requests testen. Die Spec deckt dispose()
nur im Ruhezustand ab, und die Wettläufe sind ungetestet. […] Kein Test lässt einen Request oder ein
`orientation.lock()` erst nach `dispose()` auflösen; ebenso fehlen exit() bei offenem Request, zwei
gleichzeitige request()-Aufrufe und das `fullscreenerror`-Event.
Empfehlung: Je einen Test für: dispose() bei hängendem requestFullscreen und danach grant();
dispose() bei hängendem orientation.lock; exit() bei hängendem Request; zwei request()
hintereinander (teilen sich den Promise?); document 'fullscreenerror' führt zu false und Warnung.
— Paket 5 hat alles außer `fullscreenerror` getestet; der Controller hört das Event bewusst nicht
(die Antwort kommt über das Promise). Schritt 4 hält genau das fest.
