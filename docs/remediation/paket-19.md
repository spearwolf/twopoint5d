# Paket 19 — Drain: Texture-Eingaben, Meldungen und TSDoc

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — 7 Nebenbefunde aus »Offene Befunde« (alle low, `→ Scope`), dazu Stellen gleicher Ursache aus Zug 0 (unten, »Abgleich«)
- Ziel: Der Aseprite-Adapter und die Zufallshilfen des Atlas weisen unvollständige oder unsinnige Eingaben mit Subjekt ab, die Meldungen folgen der Fehlermeldungsregel, und die verbliebenen öffentlichen Member haben TSDoc.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/texture/AsepriteJson.ts` samt `AsepriteJson.spec.ts`
  - `packages/twopoint5d/src/texture/TexturePackerJson.ts` samt `TexturePackerJson.spec.ts`
  - `packages/twopoint5d/src/texture/TextureAtlas.ts` samt `TextureAtlas.spec.ts`
  - `packages/twopoint5d/src/texture/TextureStore.ts` (nur die Konfliktmeldung Z. 947) samt `TextureStore.spec.ts` (Z. 1637, 1655, 3123)
  - `packages/twopoint5d/src/utils/describeValue.ts` samt `describeValue.spec.ts`
  - nur TSDoc: `packages/twopoint5d/src/texture/TileSet.ts`, `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, `packages/twopoint5d/src/utils/Dependencies.ts`
  - Doku: `packages/twopoint5d/docs/sprites.md` (»Aseprite sheets«, Z. 353ff.), `packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md` (§5.2 Z. 298–312, §5.3 Z. 341–345)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`, vier Einträge und ein Abschnitt im Migration Guide, siehe Schritt 12)
- Verify: `pnpm run ci` (exit 0). Zur Fehlersuche einzeln: `pnpm nx test twopoint5d -- src/texture/AsepriteJson.spec.ts` (ebenso `TexturePackerJson.spec.ts`, `TextureAtlas.spec.ts`, `TextureStore.spec.ts`, `src/utils/describeValue.spec.ts`), `pnpm typecheck`, `pnpm lint`
- Commit: `fix(twopoint5d)!: refuse an Aseprite json without an object of frames and of meta, a frame of the layout "Array" without a filename, a frame tag or a slice without a name, slices whose keys, bounds, center or pivot the parser cannot read and two slices of one name, refuse a TexturePacker json without an object of frames and a count of random frames of a TextureAtlas that is no whole number of 0 or more, cut a long key of an object short in error messages, give the conflict message of TextureStore#parse() its article, and document the members of TileSet, FrameBasedAnimations and Dependencies`
- Verlauf:
  - 2026-10-24 Zug 0: Detailplan steht · `TextureStore.ts` Konfliktmeldung nach Z. 947 gewandert (vorher 921), `articleOf()` nach Z. 226 · `describeValue.ts:99` unverändert · `AsepriteJson.ts` Namensschleife Z. 252–260, Dauerprüfung Z. 261–264, `meta`-Zugriff Z. 233–234, Tag-Schleife Z. 268–303, `slicesAt()` Z. 172 unverändert · `TextureAtlas.ts:174/186/195` unverändert · TSDoc-Lücken `TileSet.ts`, `FrameBasedAnimations.ts:13/22`, `Dependencies.ts:1/18–20/56` unverändert · dazu Stellen gleicher Ursache: `data`/`frames` beider Parser, zwei Slices eines Namens, Geschwister-Member der TSDoc-Lücken · Queue-Einträge aus Paket 18 (`FixedFrameLoop`-Tick, `setCanvasSize()`, `FrameLoop#subscriptionCount`/`clear()`) nicht aufgenommen, bleiben für die Drain-Runde des Abschlusses, Einträge 94/95 um weitere Fundstellen ergänzt
  - 2026-10-24 Zug 1: Implementierer Runde 0 beauftragt · Modell sonnet (mittlere Stufe), Effort medium · Brief `paket-19.impl-0.brief.txt`
  - 2026-10-24 Zug 2: Report `paket-19.impl-0.json` (Volltext aus Session `91ddec09-e8bb-45df-8fa4-ee5e36a35374`) FERTIG_MIT_VORBEHALT · rote Läufe in allen fünf Specs (u. a. 33 in `AsepriteJson.spec.ts`, 8 in `TexturePackerJson.spec.ts`), `Infinity` mit im roten Lauf (endete mit `Invalid array length`) · 16 Dateien geändert (`src/texture/` AsepriteJson, TexturePackerJson, TextureAtlas, TextureStore je samt Spec, TileSet, FrameBasedAnimations; `src/utils/` describeValue samt Spec, Dependencies; `docs/sprites.md`, Proposal, `CHANGELOG.md`) · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-19.verify.log`)
  - 2026-10-24 Zug 3: Reviewer (opus, medium) `paket-19.review-0.json` · Freigabe, alle sieben Nebenbefunde und vier »Dazu«-Stellen behoben, kritisch/wichtig keine, klein acht · Diff `paket-19.diff`
  - 2026-10-24 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-10-24 Zug 5: Commit 24f78f5b (16 Dateien), Verify aus Zug 2 (`paket-19.verify.log`, exit=0), keine Änderung seither

## Abgleich

Jede Fundstelle gegen den Stand nach Paket 18 (`39ee32e5`) gelesen.

| Queue-Eintrag | Befund jetzt | Einordnung |
| --- | --- | --- |
| `TextureStore.ts:921` Konfliktmeldung ohne `articleOf()` | Z. 947 in `#checkItems()`: ``conflicts.push(`"${id}" is a "${existing.type}" resource and cannot become "${checked.type}"`)`` — schreibt `is a "image"`; `articleOf()` steht Z. 226, `outOfReachError` (Z. 236) und Z. 993, 1288 benutzen es | verschoben, sonst unverändert |
| `describeValue.ts:99` `describeKey()` ohne Längengrenze | unverändert: `BARE_KEY.test(key) ? key : `"${key}"`` — die Grenze `MAX_STRING_LENGTH` (Z. 5) gilt nur `describeString()` | unverändert |
| `AsepriteJson.ts:226–258` Frame ohne `filename` heißt `"undefined"` | Z. 227–231 legt den Namen als `undefined as string` an; die Doppelprüfung Z. 252–260 meldet zwei davon als »the frame name "undefined" appears twice«, die Dauerprüfung Z. 262–263 als `the duration of the frame "undefined"` | unverändert |
| `AsepriteJson.ts:233–234` `meta` vor der Prüfung gelesen | unverändert: `data.meta.frameTags ?? []` und `data.meta.slices ?? []` lesen `meta` ungeprüft — ein Json ohne `meta` wirft `Cannot read properties of undefined`. Über `TextureStore` nicht erreichbar (`isAtlasJsonResponse()` prüft `meta` vor jedem Adapter), nur bei direktem Aufruf | unverändert |
| `AsepriteJson.ts:274ff.` Tag ohne `name`, `slicesAt()` Z. 172 ohne Formprüfung | unverändert: Z. 268–272 prüft nur `isObject(tag)`, `tag.name` geht ungeprüft in `tagNames` und `animations.add()`; `slicesAt()` liest `slice.keys ?? []`, `candidate.frame`, `slice.name`, kopiert `bounds`/`center`/`pivot` ungeprüft | unverändert |
| `TextureAtlas.ts:174/186/195` `count` ungeprüft | unverändert: `for (let i = 0; i < count; i++)` — `Infinity` läuft bis zum vollen Speicher, `NaN`/negativ ergibt `[]`, `2.5` drei Einträge | unverändert |
| TSDoc `TileSet.ts`, `FrameBasedAnimations.ts:13/22`, `Dependencies.ts:1/18–20/56` | alle neun `TileSet`-Member ohne Block (Z. 140, 144, 169, 173, 177, 181, 193, 197, 209); `AnimName` Z. 13, `FrameBasedAnimDef` Z. 22 samt `frames`/`name`/`id`/`playback`; `DependencyKey` Z. 1, die drei Callback-Typen Z. 18–20 nur mit `//`, Klasse Z. 56 | unverändert |

**Dazu (Zug 0), Stellen gleicher Ursache** — vorbestehend, geprüft mit
`git show 7341059f:<pfad>` (Stand vor dem ersten Commit des Laufs):

- `AsepriteJson.parse()` liest auch `data` und `data.frames` ungeprüft
  (`Object.entries(undefined)` wirft roh). Dieselbe Ursache wie der `meta`-Eintrag:
  die Spitze des Json wird gelesen, bevor sie geprüft ist.
- `TexturePackerJson.parse()` hat dieselbe Lücke (`data.meta` Z. 81 bei `data` ohne
  Objekt, `Object.entries(data.frames)` Z. 97). Der Aseprite-Weg erreicht sie nie —
  `AsepriteJson` reicht ein selbst gebautes `{frames, meta}` weiter —, ein direkter
  Aufruf schon. Eine Prüfung, beide Parser.
- Zwei Slices eines Namens: `slicesAt()` schreibt `inForce[slice.name]`, der
  spätere überschreibt den früheren still. Zwei Tags eines Namens weist der Parser
  ab (Z. 275–277, »rename one of them in Aseprite«); `meta.slices` bekommt die
  Prüfungen, die `meta.frameTags` schon hat — dieselbe Ursache wie der Slice-Eintrag.
- TSDoc: in denselben Deklarationen fehlen auch `TileSet#atlas`, `TileSet#baseCoords`
  (Z. 85–86), die Kopfzeile von `TileSetOptions` (Z. 32), `FrameBasedAnimationInfo`
  `id`/`name`/`frameCount`/`playback` (Z. 35–37, 40), die Kopfzeilen von
  `BakeTextureOptions` (Z. 50) und der Klasse `FrameBasedAnimations` (Z. 315),
  `DependencyCallbacks#equals`/`clone`/`copy` (Z. 11–13). Die Regel des Pakets für
  die drei Dateien: jede exportierte Deklaration und jedes öffentliche Member trägt
  einen TSDoc-Block.

**Nicht aufgenommen, mit Grund:**

- Die Felder der Json-Spiegeltypen (`AsepriteRect.x`, `AsepriteFrameTag.from`,
  `TexturePackerFrameData.frame` …) bleiben ohne eigenen Block: sie bilden ein
  fremdes Format ab, die Deklaration beschreibt sie, und ein `/** The x. */` gäbe dem
  Leser nichts. Außerhalb der drei TSDoc-Dateien wird nichts nachdokumentiert.
- Queue `FixedFrameLoop.ts:238–246` (Tick-Listener vor dem Fortschreiben),
  `Canvas2DStage.ts:261` `setCanvasSize()` ohne TSDoc, `FrameLoop.ts:294/419`
  `subscriptionCount`/`clear()` ohne TSDoc: andere Module (display, stage), keine
  gemeinsame Ursache mit Texture-Eingaben; zusammen ergeben die drei ein eigenes
  Drain-Paket des Abschlusses im selben Bereich. Die beiden TSDoc-Einträge sind im
  Plan um weitere undokumentierte Member derselben Klassen ergänzt.
- `null` an `meta.frameTags`: `?? []` nimmt es heute als »keine Tags«; das bleibt so
  und gilt für `meta.slices` und `keys` ebenso — keine neue Abweisung dafür.

## Vorgehen

Allgemein: jede Abweisung geschieht vor dem ersten `add()` in den Atlas — ein
abgewiesenes Json lässt `options.target` / `target` unverändert, wie die TSDoc beider
Parser es verspricht. Werte in Meldungen über `describeValue()`; ein Name, der nach
der Prüfung ein String ist (Tag, Slice), wird von Hand gequotet (`"${name}"`), wie
die Fehlermeldungsregel in `AGENTS.md` es verlangt. Zahlen über `assertFinite()` aus
`src/utils/`. Bei jedem Korrektheitspunkt zuerst den Regressionstest schreiben und rot
sehen, dann beheben; die roten Läufe gehören in den Report.

1. **`AsepriteJson.parse()` — die Spitze des Json** (`AsepriteJson.ts`, vor Z. 225).
   In dieser Reihenfolge, jeweils `TypeError`:
   - `data` kein Objekt (`!isObject(data)`):
     `AsepriteJson: the json is ${describeValue(data)} — Aseprite writes an object {frames, meta}`
   - `data.frames` weder Liste noch Objekt:
     `AsepriteJson: the json has frames of ${describeValue(frames)} — Aseprite writes the frames as an object ("Hash") or a list ("Array")`
   - `data.meta` kein Objekt:
     `AsepriteJson: the json has a meta of ${describeValue(meta)} — Aseprite writes meta as an object`
     (immer, auch mit `parentCoords`: heute wirft ein Json ohne `meta` in jedem Fall,
     die Menge der angenommenen Eingaben bleibt bis auf einen `meta`-String mit
     `parentCoords` dieselbe; der Rückgabetyp verspricht `AsepriteMetaData`).

2. **`AsepriteJson.parse()` — Frame des Layouts »Array« ohne `filename`.** Die
   Einträge (Z. 227–232) tragen den Namen als `unknown`; in der Schleife Z. 243–251
   direkt nach der `isObject`-Prüfung, nur für `isArray`, ein `filename`, der kein
   String ist → `TypeError`:
   `AsepriteJson: the frame ${index} of the "Array" frames has a filename of ${describeValue(name)} — a frame of that layout is named by its filename, a string`
   Damit kommt die Abweisung vor der Doppelprüfung (Z. 252–260) und der
   Dauerprüfung (Z. 262–263); beide sehen danach nur String-Namen. Wortlaut parallel
   zu `TexturePackerJson.ts:111–115`.

3. **`AsepriteJson.parse()` — Tag ohne `name`.** In der Schleife Z. 268–272, nach
   `isObject(tag)`: `typeof tag.name !== 'string'` → `TypeError`:
   `AsepriteJson: the frame tag ${index} has a name of ${describeValue(tag.name)} — a frame tag is named by a string`
   Jeder Tag ist damit geformt, bevor Z. 274ff. `tag.name` in Meldungen und in
   `tagNames` liest. Der leere String bleibt zulässig (keine neue Regel).

4. **`AsepriteJson.parse()` — `meta.slices` prüfen**, als eigener Schritt bei den
   übrigen Prüfungen (nach den Tags, vor `TexturePackerJson.parse()` Z. 333), so dass
   `slicesAt()` nur Geprüftes liest. `slices = meta.slices ?? []`, dann:
   - keine Liste → `TypeError`: `AsepriteJson: meta.slices is ${describeValue(slices)} — Aseprite writes the slices as a list`
   - je Slice an Index `i`: kein Objekt → `TypeError` `AsepriteJson: the slice ${i} is ${describeValue(slice)} — a slice is an object`;
     `name` kein String → `TypeError` `AsepriteJson: the slice ${i} has a name of ${describeValue(name)} — a slice is named by a string`
   - zwei Slices eines Namens → `Error`: `AsepriteJson: two slices are named "${name}" — rename one of them in Aseprite` (wie Z. 276 für Tags)
   - `keys`: `null`/`undefined` bleibt »keine Keys« (der Slice gilt an keinem Frame, wie
     heute `?? []`); sonst keine Liste → `TypeError` `AsepriteJson: the slice "${name}" has keys of ${describeValue(keys)} — Aseprite writes the keys of a slice as a list`
   - je Key an Index `k`: kein Objekt → `TypeError` `AsepriteJson: the key ${k} of the slice "${name}" is ${describeValue(key)} — a key of a slice is an object`;
     `frame` keine ganze Zahl ≥ 0 → `RangeError` `AsepriteJson: the frame of the key ${k} of the slice "${name}" must be a whole number of 0 or more, got ${describeValue(frame)}`
     (ein `frame` jenseits der Frames bleibt zulässig: der Key gilt dann an keinem Frame)
   - `bounds` (Pflicht) und `center` (`null`/`undefined` = fehlt) je ein Rechteck,
     `field` unten ist `bounds` bzw. `center`:
     kein Objekt → `TypeError` `AsepriteJson: the ${field} of the key ${k} of the slice "${name}" is ${describeValue(value)} — a rectangle of a slice is an object {x, y, w, h}`;
     `x`, `y` über `assertFinite(v, 'AsepriteJson', `the x of the ${field} of the key ${k} of the slice "${name}"`)`;
     `w`, `h` ebenso über `assertFinite()` und dazu unter 0 → `RangeError` `AsepriteJson: the w of the ${field} of the key ${k} of the slice "${name}" must be a finite number of 0 or more, got ${describeValue(v)}` (Muster `TexturePackerJson.ts:130–137`)
   - `pivot` (`null`/`undefined` = fehlt): kein Objekt → `TypeError` `AsepriteJson: the pivot of the key ${k} of the slice "${name}" is ${describeValue(value)} — a pivot is an object {x, y}`; `x`, `y` über `assertFinite()` (jedes Vorzeichen: Aseprite setzt einen Pivot auch außerhalb der Bounds)

   Grund der Zahlenprüfung: `NineSlice#setSliceFrame()` (`src/sprites/features/NineSlice.ts:156–168`)
   und `Anchor#setAnchorFromPivot()` rechnen mit `bounds`, `center` und `pivot` über
   `sliceOf()` (`src/sprites/features/frameSlices.ts`) ohne eigene Prüfung — ein `NaN`
   landete in den Attributen. `x`/`y` von `bounds` und `center` dürfen negativ sein
   (ein Slice darf über den Rand der Leinwand reichen). Ein lokaler Helfer im Modul für
   Rechteck und Punkt ist erwünscht; keine neue Datei in `src/utils/`.
   `slicesAt()` bleibt in seiner Logik unverändert (`?? []` an `keys` bleibt).
   Die vorhandenen Fixtures (`src/texture/fixtures/aseprite/`, `apps/lookbook/public/assets/platformer/*.json`,
   `apps/lookbook/public/assets/ui-panels/panels.aseprite.json`) bestehen alle Prüfungen
   (in Zug 0 nachgezählt: keine doppelten Namen, jeder Key mit ganzer `frame` und `bounds`).

5. **TSDoc von `AsepriteJson.parse()`** (Z. 211–219): der Absatz »Refused …« nennt
   die neuen Abweisungen samt Fehlerklasse — Json, `frames` und `meta` ohne Objekt,
   Frame des Layouts »Array« ohne String-`filename`, Tag ohne String-`name` (je
   `TypeError`); `meta.slices` ohne Liste, Slice ohne Objekt oder String-`name`, Keys
   ohne Liste, Key ohne Objekt, `bounds`/`center`/`pivot` ohne Objekt (`TypeError`);
   ein `frame` eines Keys, das keine ganze Zahl ≥ 0 ist, und eine Koordinate, die keine
   endliche Zahl ist oder als `w`/`h` unter 0 liegt (`RangeError`); zwei Slices eines
   Namens (`Error`). Der Satz »Every check runs before the first frame is added« bleibt.

6. **`TexturePackerJson.parse()`** (`TexturePackerJson.ts`): am Anfang `data` kein
   Objekt → `TypeError` `TexturePackerJson: the json is ${describeValue(data)} — a texture atlas json is an object {frames, meta}`;
   vor dem Aufbau der Einträge (Z. 92–97) `data.frames` weder Liste noch Objekt →
   `TypeError` `TexturePackerJson: the json has frames of ${describeValue(frames)} — the frames are an object ("JSON Hash") or a list ("JSON Array")`.
   Die bestehende `meta.size`-Prüfung ohne `parentCoords` bleibt, wie sie ist. Die
   `@throws {TypeError}` der TSDoc (Z. 64–66) nennt beide Fälle.

7. **`TextureAtlas#randomFrameIds()`, `#randomFrames()`, `#randomFrameNames()`**
   (Z. 174, 186, 195): vor der Schleife ein `count`, der keine ganze Zahl ≥ 0 ist
   (`typeof count !== 'number' || !Number.isInteger(count) || count < 0`), →
   `RangeError` mit dem Aufruf als Subjekt:
   `TextureAtlas#randomFrameIds(): count must be a whole number of 0 or more, got ${describeValue(count)}`
   (entsprechend `#randomFrames()`, `#randomFrameNames()`). Ein lokaler Helfer im
   Modul (Muster `RepeatingTilesProvider.ts:17–24`); keine neue Datei in `src/utils/`.
   `0` antwortet `[]`. Je Methode TSDoc mit `@throws {RangeError}`. Der rote Lauf
   läuft ohne den Fall `Infinity` (er liefe vor dem Fix bis zum vollen Speicher);
   `Infinity` steht nach dem Fix in derselben Tabelle wie `NaN`, `-1`, `2.5` und
   `'3'` — der Report sagt das.

8. **`TextureStore#parse()` Konfliktmeldung** (`TextureStore.ts:947`): Artikel über
   `articleOf()`:
   ``conflicts.push(`"${id}" is ${articleOf(existing.type)} "${existing.type}" resource and cannot become "${checked.type}"`)``
   Der Rest des Wortlauts bleibt. `TextureStore.spec.ts` Z. 1637, 1655, 3123 auf
   `"b" is an "image" resource …` bzw. `"a" is an "image" resource …` umstellen —
   die Specs rot sehen, bevor die Zeile 947 sich ändert. Kein CHANGELOG-Eintrag (der
   Wortlaut ist in keinem Eintrag zitiert, `CHANGELOG.md:115` nennt nur die Klasse).

9. **`describeKey()`** (`describeValue.ts:99–101`): ein Schlüssel über
   `MAX_STRING_LENGTH` Einheiten geht durch `describeString()` — gekürzt wie ein
   String und immer in Anführungszeichen, auch wenn er ein bloßer Bezeichner wäre:
   `key.length <= MAX_STRING_LENGTH && BARE_KEY.test(key) ? key : describeString(key)`.
   Ein bloßer Schlüssel bis 120 Einheiten bleibt bloß, ein gequoteter bis 120 bleibt
   ganz. Die TSDoc von `describeValue()` (Z. 16–18) nennt die Schlüssel mit. Specs in
   `describeValue.spec.ts`: ein bloßer Schlüssel von 121 Zeichen (gekürzt, gequotet),
   einer mit Leerzeichen über 120 (gekürzt), einer von genau 120 (bloß, ganz), ein
   Surrogatpaar an Einheit 120 eines Schlüssels.

10. **TSDoc** — Ton und Tiefe wie die Nachbarn in denselben Dateien (Zweck,
    Einheiten, Verhalten an den Rändern; Vorbild `TileSet#tileCount`,
    `TileSet#firstFrameId`, `Dependencies#clear()`):
    - `TileSet.ts`: `TileSetOptions` (Kopfzeile), `atlas` (der Atlas der Tiles —
      übergeben oder vom Konstruktor gebaut), `baseCoords` (die Fläche, in der die
      Tiles liegen), `tileWidth`/`tileHeight` (Option oder Breite/Höhe der
      `baseCoords`, in deren Einheiten), `tileCountLimit` (die Option `tileCount`,
      `Infinity` ohne sie — die Zahl der Tiles steht in `tileCount`), `margin`/
      `padding`/`spacing` (Option oder 0), `randomTileId()` (eine Tile-Id von
      `firstId` bis `lastId`, gleich verteilt), `randomFrameId()` (die Frame-Id eines
      zufälligen Tiles, `firstFrameId` bis `lastFrameId`), `randomFrame()` (dessen
      Frame).
    - `FrameBasedAnimations.ts`: `AnimName` (Name einer Animation, String oder
      Symbol; ohne Namen vergibt `add()` `anim_0`, `anim_1` …), `FrameBasedAnimDef`
      (der Datensatz, den `FrameBasedAnimations` je registrierter Animation hält;
      gelesen wird eine Animation über `animation()`, die eine
      `FrameBasedAnimationInfo` antwortet) samt `frames`, `name`, `id`, `playback`;
      `FrameBasedAnimationInfo` `id`, `name`, `frameCount`, `playback`;
      `BakeTextureOptions` (Kopfzeile: die Optionen von `bakeDataTexture()`); die
      Klasse `FrameBasedAnimations` (registriert Animationen über Frames eines Atlas,
      eines `TileSet` oder einer Liste von `TextureCoords` und backt sie in eine
      Datentextur, die `AnimatedFrames` liest). Die Id ist die, die `add()` antwortet:
      `0` für die erste registrierte Animation, je weitere eins mehr — `add()` vergibt
      `this.#names.length` (Z. 514), ein `add()`, das wirft, verbraucht keine; dieselbe
      Id liest `animation(id)` und schreibt ein Sprite als `animId`.
    - `Dependencies.ts`: `DependencyKey`, `DependencyCallbacks#equals`/`clone`/`copy`,
      `EqualityCallback`/`CloneCallback`/`CopyCallback` (je ein TSDoc-Block; der
      `//`-Kommentar zur Herleitung bleibt als Begründung stehen oder geht in die
      Blöcke), die Klasse `Dependencies` (merkt sich die Werte, aus denen etwas
      zuletzt berechnet wurde, und sagt, ob neue davon abweichen — der Wächter einer
      Neuberechnung; Nutzer in der Library: `CameraBasedVisibility.ts:419`,
      `RectangularVisibilityArea.ts:44`).
    Kein Verhalten ändert sich in diesen drei Dateien; kein CHANGELOG-Eintrag.

11. **Doku.**
    - `docs/sprites.md` »Aseprite sheets«: ein Satz nach dem Absatz zu Dauern und
      Playback — ein Json, das Aseprite so nicht schreibt (ohne `frames` oder `meta`,
      ein Frame des Layouts »Array« ohne `filename`, ein Tag oder ein Slice ohne
      `name`, Slice-Keys, `bounds`, `center` oder `pivot`, die der Parser nicht lesen
      kann, zwei Slices eines Namens), wird vor dem ersten Frame abgewiesen und nennt,
      was falsch ist. Ohne Fehlerklassen-Liste; der Guide beschreibt den Code, wie er ist.
    - Proposal `animation-playback-and-aseprite.md` §5.2 (Z. 298–312): ein Bullet mit
      den neuen Abweisungen und ihren Klassen (wie Schritt 5); §5.3 Z. 344–345: der Satz
      »`meta.slices` stays in `meta` unchanged« bekommt, dass die Slices vorher geprüft
      werden (Verweis auf §5.2).
    - Die Konvention »kein Rückblick« gilt: keine Formulierung wie »now refuses«.

12. **CHANGELOG** (`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`, Skill
    `updating-changelog`):
    - `### Added`, Eintrag zu `AsepriteJson.parse()` (Z. 21): `AsepriteJson` ist
      unveröffentlicht, die neuen Abweisungen gehören in diesen Satz (»… so is …«),
      nicht unter `Fixed` oder `Changed`.
    - `### Fixed`, Eintrag zu `TexturePackerJson.parse()` (Z. 166–167): Json und
      `frames` ohne Objekt mit `TypeError` ergänzen.
    - `### Changed`, Eintrag »error messages cut a string of more than 120 UTF-16 units
      short …« (Z. 121): ein Schlüssel eines Objekts ebenso, in Anführungszeichen.
    - `### Changed`, neuer Eintrag: `TextureAtlas#randomFrameIds()`, `#randomFrames()`
      und `#randomFrameNames()` werfen einen `RangeError`, der den Aufruf nennt, für
      einen `count`, der keine ganze Zahl von 0 an ist (**BREAKING**: ein gebrochener
      `count` gab Einträge zurück). See the Migration Guide.
    - `### Migration Guide`, neuer Abschnitt am Ende (nach »A Canvas2DStage given a fit
      or a size it cannot show«, Z. 985ff.): `#### A count of random frames that is no whole number`,
      ein Satz, dann **Before** (` ```ts `, `atlas.randomFrames(n / 2)`) und **After**
      (` ```ts check `, eigenständig: `import {TextureAtlas} from '@spearwolf/twopoint5d';`,
      `declare const atlas: TextureAtlas;`, `atlas.randomFrames(Math.floor(n / 2))`) im
      Stil von »The frame rate of a FrameLoop« (Z. 941ff.).

## Nebenbefunde im Volltext

Aus »Offene Befunde« in `./remediation-plan.md`, wie sie dort stehen:

**`packages/twopoint5d/src/texture/TextureStore.ts:921`** (in `#checkItems()`, seit Paket 6; vorher Z. 831) — die Konfliktmeldung von `parse()` setzt ihren Artikel von Hand und schreibt `"b" is a "image" resource`; `articleOf()` steht im selben Modul (Z. 200) und wird von `outOfReachError` schon benutzt · Paket 6 · low → Scope

**`packages/twopoint5d/src/utils/describeValue.ts:99` `describeKey()`** — ein Objektschlüssel geht ungekürzt in die Meldung, bar wie in Anführungszeichen; die Längengrenze für Strings gilt nur Werten · Paket 6 · low → Scope

**`packages/twopoint5d/src/texture/AsepriteJson.ts:226–258`** (Namensschleife) — ein Frame des Layouts »Array« ohne `filename` heißt in den Meldungen `"undefined"`; zwei davon ergeben »the frame name "undefined" appears twice« statt der `filename`-Abweisung von `TexturePackerJson`, und die Dauerprüfung Z. 262–263 (seit Paket 7 für jeden Frame) meldet ihn als `the duration of the frame "undefined"`; die Namensschleife war am Laufbeginn schon so · Paket 7 · low → Scope

**`packages/twopoint5d/src/texture/AsepriteJson.ts:233–234`** — `data.meta.frameTags` und `data.meta.slices` werden gelesen, bevor `TexturePackerJson` `meta` prüft: ein Json ohne `meta` wirft einen rohen `TypeError` ohne Subjekt · Paket 7 · low → Scope

**`packages/twopoint5d/src/texture/AsepriteJson.ts:274ff.`** (Tag-Schleife) und `slicesAt()` Z. 172 — ein Tag ohne `name` als String geht unbemerkt durch und wird als Animation `undefined` angelegt; `meta.slices` (`slice.keys ?? []`, `slice.name`) ohne Formprüfung · Paket 7 · low → Scope

**`packages/twopoint5d/src/texture/TextureAtlas.ts:174`, `:186`, `:195`** `randomFrameIds(count)`, `randomFrames(count)`, `randomFrameNames(count)` — prüfen `count` nicht: `Infinity` läuft ohne Ende bis zum vollen Speicher, `NaN` und negative Werte geben still `[]`; am Laufbeginn schon so · Paket 13 · low → Scope

**öffentliche Member ohne TSDoc außerhalb der Liste des Audits:** `packages/twopoint5d/src/texture/TileSet.ts:140`, `:144`, `:169`, `:173`, `:177`, `:181`, `:193`, `:197`, `:209` (`tileWidth`, `tileHeight`, `tileCountLimit`, `margin`, `padding`, `spacing`, `randomTileId()`, `randomFrameId()`, `randomFrame()`), `src/texture/FrameBasedAnimations.ts:13`, `:22` (`AnimName`, `FrameBasedAnimDef` samt `frames`, `name`, `id`, `playback`), `src/utils/Dependencies.ts:1`, `:18–20`, `:56` (`DependencyKey`, `EqualityCallback`/`CloneCallback`/`CopyCallback` nur mit `//`, Klasse `Dependencies`) · Paket 13 · low → Scope

Maßstab der TSDoc (aus dem Audit, Empfehlung zu den undokumentierten Exporten):
»Je Export ein TSDoc-Block mit Zweck, Einheiten und Verhalten an den Rändern, im Stil
der übrigen Library.«

## Urteil des Reviewers (Zug 3, `paket-19.review-0.json`)

Erfüllung:
- Konfliktmeldung `TextureStore#parse()`: behoben — `src/texture/TextureStore.ts:947` über `articleOf()`, Specs `TextureStore.spec.ts:1637/1655/3123`
- `describeKey()` ohne Längengrenze: behoben — `src/utils/describeValue.ts:101`, TSDoc Z. 17–19, Specs Block »a key of an object«
- Frame des Layouts »Array« ohne `filename`: behoben — `src/texture/AsepriteJson.ts:349–353`, vor Doppel- und Dauerprüfung
- `meta` vor der Prüfung gelesen: behoben — `AsepriteJson.ts:320–323` (auch mit `parentCoords`), `frameTags`/`slices` danach Z. 330–331
- Tag ohne `name`, `slicesAt()` ohne Formprüfung: behoben — `AsepriteJson.ts:375–379`; `assertSlices()` Z. 194–245, Aufruf Z. 434 vor `TexturePackerJson.parse()`
- `count` der Zufallshilfen: behoben — `assertCount()` `src/texture/TextureAtlas.ts:8–12`, Aufrufe Z. 186, 202, 216, `@throws {RangeError}`
- TSDoc `TileSet`/`FrameBasedAnimations`/`Dependencies`: behoben — `TileSet.ts:149–230`, `FrameBasedAnimations.ts:13ff.`, `Dependencies.ts:1`, `:22–27`, `:59–64`
- Dazu, Spitze des Json: behoben — `AsepriteJson.ts:309–318`, `TexturePackerJson.ts:80–90`, `@throws` Z. 64
- Dazu, zwei Slices eines Namens: behoben — `AsepriteJson.ts:206–208`
- Dazu, Zahlen von `bounds`/`center`/`pivot`: behoben — `assertSliceRect()` `AsepriteJson.ts:174–190`, Pivot Z. 232–240
- Dazu, TSDoc-Lücken: behoben — `TileSet.ts:86–95` u. a., `FrameBasedAnimationInfo`, `BakeTextureOptions`, Klasse `FrameBasedAnimations`, `Dependencies.ts:12–16`
- Doku/CHANGELOG: `docs/sprites.md:376`, Proposal §5.2 und §5.3 Z. 354, CHANGELOG Z. 21, 121, 142, 167, Migration Guide Z. 1010–1029

Kleine Befunde (keine Runde):
- `src/texture/AsepriteJson.ts:301–302` — »Refused«-Absatz der TSDoc bricht holprig um
- `src/texture/TexturePackerJson.ts:64` — `@throws {TypeError}`-Zeile weit über ~100 Spalten
- `docs/sprites.md:376` — neuer Absatz als eine Zeile von ~330 Zeichen
- `src/texture/TileSet.ts` (Kopf `TileSetOptions`, `tileWidth`, `tileHeight`, `margin`, `padding`, `spacing`, `randomFrameId`) und `src/utils/Dependencies.ts:14` — einzeilige TSDoc-Blöcke über 110–140 Zeichen
- `src/texture/TexturePackerJson.ts:104–107` — geprüft wird `jsonFrames`, gelesen danach wieder `data.frames`
- `src/texture/AsepriteJson.spec.ts` (Fall »two slices of one name«) — `toThrow(Error)` nagelt die Klasse nicht gegen `TypeError` fest
- `CHANGELOG.md:142` — Nachsatz zum Bruch beschreibt den Vorzustand ausführlicher als geplant
- Meldung »the bounds of … is undefined« — Plural mit »is«, Wortlaut aus Schritt 4

Abweichungen laut Implementierer: Tag mit leerem Namen bekommt von `FrameBasedAnimations#add()` `anim_0`, die Spec prüft `animation('anim_0')`; `entries` bleibt als `[name: string, …]` getypt mit Cast beim Lesen von `filename`; Migration Guide mit zusätzlichem `declare const n: number;`.
