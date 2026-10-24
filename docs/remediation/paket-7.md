# Paket 7 — TextureResource, Atlas-Parser und Frame-Sampling

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-008 (medium), BUG-010 (medium), BUG-011 (medium), MEM-004 (low), BUG-025 (low), API-005 (low), TYPE-001 (low), TYPE-002 (low)
- Ziel: TextureResource hält, was ihre TSDoc verspricht, die Atlas-Parser prüfen ihre Eingaben vor dem ersten Schreiben, und das Frame-Sampling ist ohne erzwungene Typen sicher.
- Modell: stärkste Stufe — acht Findings über Parser, Typen, öffentliche Oberfläche und die
  reaktiven Effekte von `AtlasTextureResource` (zwei Effekte schreiben dasselbe Signal, das
  Ergebnis muss von ihrer Reihenfolge unabhängig sein); dazu Guide, drei Proposals, CHANGELOG
  mit Migrationshinweis. Breite und die eine subtile Stelle, nicht ein einzelner schwerer Umbau.
- Effort: medium — der Detailplan nennt Signaturen, Meldungen und Testfälle; mehr Effort
  erhöht hier nur die Neigung, über den Plan hinaus zu verbessern.
- Dateien:
  - `packages/twopoint5d/src/texture/TexturePackerJson.ts` (+ `TexturePackerJson.spec.ts`)
  - `packages/twopoint5d/src/texture/AsepriteJson.ts` (+ `AsepriteJson.spec.ts`)
  - `packages/twopoint5d/src/texture/atlasAdapters.ts` (nur Kommentar am Cast)
  - `packages/twopoint5d/src/texture/frameTrimMargins.ts` (+ `frameTrimMargins.spec.ts`)
  - `packages/twopoint5d/src/texture/sampleFrameAt.ts` (+ `sampleFrameAt.spec.ts`)
  - `packages/twopoint5d/src/texture/sampleAtlasFrame.ts` (nur der Aufruf von `sampleFrameAt()`)
  - `packages/twopoint5d/src/texture/public-api.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts` (+ `TextureResource.spec.ts`)
  - `packages/twopoint5d/src/texture/TextureFactory.ts` (nur die Parametertypen von `getOptions()` und `#mergeOptions()`)
  - `packages/twopoint5d/src/texture/TextureStore.spec.ts` (Z. 388, siehe Schritt 7)
  - `packages/twopoint5d/docs/sprites.md` (»Frames out of an atlas« Z. 237–255, »Aseprite sheets« Z. 335–354)
  - `packages/twopoint5d/docs/proposals/wave-and-segment-sprites.md` (§4.2, Codeauszug Z. 323–344)
  - `packages/twopoint5d/docs/proposals/animation-playback-and-aseprite.md` (Abweisungsliste Z. 297–305)
  - `packages/twopoint5d/docs/proposals/atlas-frame-sampling.md` (§2, Z. 76–77)
  - `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`)
- Vorgehen: siehe Abschnitt »Vorgehen« unten, Schritte 1–9.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d)!: refuse a frame of an atlas json that has no frame object or a measure that is no finite number of 0 or more, and a frame of an Aseprite sheet without a duration above 0 in a tag or outside every tag, before the first frame goes into the atlas, give no trim margins to a frame whose trimmed area does not lie within its source size, take the image, the texture and the json of an atlas back when the override of a json without an image is cleared, keep a frozen copy of the texture classes of a resource, let go of the factory a resource built for its renderer once the renderer is cleared, type what the internal frame sampling reads for a mask and an inset, and export frameTrimMargins()`
- Verlauf:
  - 2026-10-23 Zug 0: Detailplan steht · BUG-008 unverändert (`TexturePackerJson.ts:93–104`, Prüfschleife Z. 75–91 prüft nur Namen) · BUG-010 innerhalb der Datei gewandert nach `TextureResource.ts:1463–1503` (Fehlerzweig Z. 1470–1479, dritter Effekt Z. 1493–1503), pinnender Spec jetzt `TextureResource.spec.ts:1288` · BUG-011 unverändert (Setter `TextureResource.ts:502–507`, `cmpTexClasses` Z. 124) · MEM-004 gewandert nach `TextureResource.ts:779–790` · BUG-025 unverändert (`frameTrimMargins.ts:40–59`) · API-005 unverändert (`public-api.ts` ohne `frameTrimMargins`; Verweise `AtlasFrameTable.ts:31`, `FrameTable.ts:96`) · TYPE-001 unverändert (`sampleFrameAt.ts:69`, `:76`) · TYPE-002 unverändert (`atlasAdapters.ts:29`; Dauer nur für Frames in Tags geprüft, `AsepriteJson.ts:271–278`) · offene Folgen im Plan: keine · »Offene Befunde«: keiner mit gleicher Ursache, nichts übernommen · Restplan: keine Änderung — Pakete 8–12 teilen keine Datei mit diesem (`RepeatingTextureColor.ts` bleibt unverändert), Paket 13 findet in `src/texture/public-api.ts` schon einen benannten Export vor
  - 2026-10-23 Zug 1: Implementierer beauftragt (Runde 0), Modell opus, Effort medium, Session-Name paket7-p7-impl-0
  - 2026-10-23 Zug 2: Report FERTIG (`paket-7.impl-0.json`, Session dc873f87-660f-4bad-8142-8d0549e486fd) · 20 Dateien geändert, keine neu (src/texture: TexturePackerJson, AsepriteJson, atlasAdapters, frameTrimMargins, sampleFrameAt, sampleAtlasFrame, public-api, TextureResource, TextureFactory je samt Specs, TextureStore.spec; docs/sprites.md, drei Proposals, CHANGELOG) · rote Läufe belegt (TexturePackerJson 7, AsepriteJson 5 + Flächenfall, frameTrimMargins 6, sampleFrameAt TS2578, TextureResource 4) · Arbeitsbaum schmutzig · `pnpm run ci` exit=0 (`paket-7.verify.log`)
  - 2026-10-23 Zug 3: Reviewer opus/medium (`paket-7.review-0.json`) · alle acht Findings behoben · wichtig: CHANGELOG führt das unveröffentlichte `AsepriteJson`/`asepriteAtlasAdapter` unter `Fixed` (Z. 139–140) statt im `Added`-Eintrag (Z. 21) · wichtig: Commit-Message »has no area« widerspricht der angenommenen Fläche 0 → vom Runner in dieser Datei korrigiert (»has no frame object«) · klein: 4 · Diff `paket-7.diff`
  - 2026-10-23 Zug 4 Runde 1: offen CHANGELOG-Befund (dazu die kleinen Punkte CHANGELOG-Leerzeile und `sprites.md` »each naming the frame«) → derselbe Implementierer per `--resume dc873f87…`, opus/medium · zurück: FERTIG (`paket-7.impl-1.json`), nur `CHANGELOG.md` (Aseprite-Abweisungen in den `Added`-Eintrag, `Fixed` nur `TexturePackerJson.parse()`, eine Leerzeile vor `## [0.23.0]`) und `docs/sprites.md` · `pnpm run ci` exit=0 (`paket-7.verify-1.log`) · Nachprüfung (`paket-7.review-1.json`, Resume des Reviewers): alle vier erledigt, neu klein: »so is« vor Plural in `CHANGELOG.md:21`
  - 2026-10-23 Zug 5: Commit 74c54275 (20 Dateien, +562/−96), Trailer `Remediation-Run: 2026-10-23` · Plan: [x], Ergebnis, Schnittstellen, drei Nebenbefunde in »Offene Befunde«

## Abgleich

Gegen `HEAD` 793015fa. Paket 6 hat `TextureResource.ts` umgebaut (TSDoc der Accessoren,
`#publishImageWithTexture()`), die Fundstellen von BUG-010 und MEM-004 sind dadurch nach unten
gewandert; der Sachverhalt ist bei allen acht Findings unverändert.

| Finding | Fundstelle jetzt | Befund |
| --- | --- | --- |
| BUG-008 | `TexturePackerJson.ts:93–104`; `AsepriteJson.ts:309–313` | Prüfschleife Z. 75–91 prüft nur Namen; `frame` und seine Zahlen erst in der Add-Schleife (`frame.x` auf `undefined`, NaN still durch). `parentCoords ??= …meta.size…` Z. 69 ungeprüft. Aseprite reicht seine Frames an `TexturePackerJson.parse()` weiter, das Versprechen »a refused sheet leaves `options.target` as it was« (TSDoc Z. 214–215) hält deshalb nicht. Der Fetch-Pfad (`isAtlasJsonResponse.ts:22–53`) prüft nur `typeof … === 'number'` — `1e999` (Infinity) und negative Werte kommen durch, direkt übergebene Objekte (`atlasJson`-Setter, `TexturePackerJson.parse()`, Adapter) gar nicht. |
| BUG-010 | `TextureResource.ts:1470–1479` (Fehlerzweig des zweiten Atlas-Effekts), `:1493–1503` (dritter Effekt) | Fehlerzweig meldet `atlasImage` und lässt `atlasJson` mit `meta.image = <alter Override>` stehen; der dritte Effekt setzt `imageUrl` daraus wieder auf den alten Override. Schon so in v0.23.0 (`git show v0.23.0:…/TextureResource.ts` Z. 1007–1047). Spec `TextureResource.spec.ts:1288–1320` pinnt `imageUrl === 'override.png'`. |
| BUG-011 | `TextureResource.ts:502–507`, `cmpTexClasses` Z. 124–129 | Setter speichert die Referenz; `a === b` schlägt zu. Dieselbe Lücke über den Getter: wer das gelesene Array mutiert, ändert den gespeicherten Wert ohne Rebuild. In v0.23.0 identisch. |
| MEM-004 | `TextureResource.ts:779–790` | `if (!renderer || …) return;` — Fallback-Factory und `fallback` bleiben stehen. In v0.23.0 identisch. `TextureStore` setzt die Factory beim Leeren auf `undefined` (`TextureStore.ts:484–485`). |
| BUG-025 | `frameTrimMargins.ts:40–59` | Prüft nur Endlichkeit und `W > 0`, `H > 0`. |
| API-005 | `public-api.ts:1–19` | `frameTrimMargins`/`FrameTrimMargins` nicht exportiert; TSDoc von `AtlasFrameTable` (Z. 31), `FrameTable#bakeDataTexture()` (Z. 96), `FrameBasedAnimations` verweist darauf. Öffentlich trägt die Regel schon `prepareSpriteFrame()` (`sprites/features/AtlasFrame.ts:28–34`) und `AtlasFrameApi.setTexTrim()`. War nie exportiert (`git log -S`). |
| TYPE-001 | `sampleFrameAt.ts:69`, `:76` | `margins!`, `drawnTexels!`. Aufrufer: `sampleAtlasFrame.ts:123–137` (liefert beide immer), `sprites/features/RepeatingTextureColor.ts:59–72` (liefert `drawnTexels`, keine `margins`, `trim: 'stretch'`). |
| TYPE-002 | `atlasAdapters.ts:28–31` | `json as AsepriteJsonData`; Dauer-Prüfung nur für Frames in Tags (`AsepriteJson.ts:271–278`). `atlasAdapters.ts` und `AsepriteJson.ts` sind in v0.23.0 nicht enthalten (`[Unreleased]` → `### Added`). |

Offene Folgen im Plan: keine (Pakete 14, 15, 16: `—`/`keine`). »Offene Befunde«: der einzige
Eintrag im Texture-Modul (`TextureStore.ts:921`, Artikel der Konfliktmeldung von Hand) hat eine
andere Ursache als dieses Paket und bleibt in der Queue.

## Entscheidungen in Zug 0

- **BUG-010**: gilt die Entscheidung vom 2026-10-23 (Klassen-TSDoc gilt, Spec wird angepasst).
  Umsetzung: der Fehlerzweig nimmt `atlasJson` und `imageUrl` in einem Batch zurück. Damit endet
  »gefetchter Json ohne Bild, Override wieder geleert« im selben Zustand wie »gefetchter Json ohne
  Bild, nie ein Override« (Spec Z. 987: `imageUrl` undefined, `atlasJson` nie gesetzt). `atlasJson`
  mit einem Json ohne `meta.image` stehen zu lassen ginge nur über einen Cast, den der Kommentar
  Z. 1480–1486 ausdrücklich ablehnt.
- **BUG-011**: eingefrorene Kopie (`Object.freeze([...value])`) statt `slice()`, Getter-Typ
  `readonly TextureOptionClasses[] | undefined`. Grund: mit `slice()` bliebe die Lücke über den
  Getter offen (gelesenes Array mutieren, zurückschreiben, kein Rebuild); `tileSetOptions` ist das
  Vorbild (eingefrorene Kopie, `Readonly<…>`-Getter, 0.22.0 mit Migration Guide). Der Typbruch ist
  klein und fällt unter »Kleine API-Brüche wie empfohlen, je mit Changelog-Migrationshinweis«
  (Entscheidungen 2026-10-23).
- **BUG-008**: `x`, `y`, `w`, `h` endlich und **≥ 0** (nicht > 0). Grund: dieselbe Regel wie die
  Zeichen von `BitmapFont` (`AT_LEAST_ZERO`, `BitmapFont.ts:107/227`); ein Packer darf für ein
  ganz transparentes Sprite eine Fläche von 0 schreiben, und eine Breite 0 erzeugt kein NaN.
  `meta.size` (nur ohne `parentCoords`) dagegen **> 0**: durch sie wird geteilt
  (`assertPositiveFinite()`).
- **TYPE-001**: `drawnTexels` wird Pflichtfeld von `FrameToSample` (beide Aufrufer liefern es;
  `inset > 0` ist eine Laufzeitbedingung, die kein Typ unterscheiden kann). `margins` wandert in
  eine diskriminierte Union von `FrameSampleOptions` am Diskriminanten `trim`. Grund: `trim` und
  die Ränder, nach denen maskiert wird, stehen dann an einer Stelle, und TypeScript verengt sie im
  `if (options.trim === 'mask')`. Ein Pflichtfeld `margins` in `FrameToSample` hätte
  `RepeatingTextureColor` einen Platzhalter abverlangt (`SpriteFrameNodes#trim` ist optional, die
  Feature streckt immer). `expectDefined()` wäre nur eine Laufzeitprüfung.
- **TYPE-002**: weder `AtlasAdapter` auf `unknown` umstellen noch »`duration` kann fehlen« in die
  TSDoc schreiben. `AtlasAdapter` ist öffentlich und ein Funktionstyp: unter `strictFunctionTypes`
  ist ein registrierter Adapter `(json: TexturePackerJsonData, …) => …` nicht mehr zuweisbar, das
  bräche jeden eigenen Adapter. »Kann fehlen« widerspräche dem Typ `duration: number`. Stattdessen
  prüft `AsepriteJson.parse()` die Dauer **jedes** Frames und `meta.frameTags` als Liste — die
  Empfehlung »die Aseprite-Form prüfen«, an der Stelle, die Adapter und direkte Aufrufer teilen;
  der Cast bekommt einen Kommentar, der sagt, was ihn trägt. Die Dauer-Prüfung geht dabei über
  `assertPositiveFinite()` (AGENTS.md: Zahlenprüfungen über `assertFinite()`/
  `assertPositiveFinite()`); `AsepriteJson` ist unveröffentlicht, die neue Meldung bricht nichts.
- **API-005**: exportieren (erste Option der Empfehlung), nicht umformulieren. Grund: die Regel
  steht öffentlich schon an `prepareSpriteFrame()` und `setTexTrim()`, wer ein eigenes Feature
  oder Material schreibt, braucht sie als Funktion; vier TSDoc-Stellen, die die Regel
  wiederholen, liefen nach BUG-025 auseinander. Benannter Export (Entscheidung 2026-10-23:
  `public-api.ts` von texture auf benannte Exporte — Paket 13 baut darauf auf).

## Vorgehen

Reihenfolge ist die der Abhängigkeiten: erst die Parser (1–3), dann Ränder und Export (4–5),
dann das Sampling (6), dann `TextureResource` (7–8), zuletzt Doku und CHANGELOG (9). Für jeden
Korrektheitsfehler zuerst den Regressionstest, rot sehen, dann beheben (Liste »Regressionstests«
unten). Meldungen beginnen mit ihrem Subjekt (AGENTS.md »Error and warning messages«); ein
abgewiesener Wert geht durch `describeValue()`, ein als String getippter Frame-Name wird von Hand
in `"…"` gesetzt.

### 1. `TexturePackerJson.parse()` prüft jeden Frame vor dem ersten `add()` (BUG-008)

`packages/twopoint5d/src/texture/TexturePackerJson.ts`:

1. Z. 69: nur wenn kein `parentCoords` übergeben ist, vor dem `new TextureCoords(…)` prüfen:
   - `data.meta` ist kein Objekt oder `data.meta.size` ist kein Objekt (`isObject()` aus
     `../utils/isObject.js`) → `TypeError`:
     `TexturePackerJson: the json has a meta.size of ${describeValue(size)} — without parentCoords the frames are laid out in meta.size, an object {w, h}`
     (`size` ist `undefined`, wenn schon `meta` fehlt).
   - `assertPositiveFinite(size.w, 'TexturePackerJson', 'the w of meta.size')`, ebenso `h`
     (`../utils/assertPositiveFinite.js`; schreibt `TexturePackerJson: the w of meta.size must be a finite number above 0, got 0`).
2. Z. 71–73, die Einträge: ein Eintrag des Formats »JSON Array«, der kein Objekt ist, darf nicht
   schon beim Lesen von `filename` werfen — den Namen nur aus einem Objekt lesen.
3. Prüfschleife Z. 75–91, je Eintrag in dieser Reihenfolge (alles vor dem ersten `add()`):
   1. Eintrag kein Objekt → `TypeError`. Hash: `TexturePackerJson: the frame "a" is ${describeValue(entry)} — a frame of the json is an object`; Array: `TexturePackerJson: the frame ${index} of the "JSON Array" frames is ${describeValue(entry)} — a frame of the json is an object`.
   2. die bestehenden Namensprüfungen (unverändert).
   3. `frame` kein Objekt → `TypeError`: `TexturePackerJson: the frame "a" has a frame of ${describeValue(frame)} — its area in the image is an object {x, y, w, h}`.
   4. für `x`, `y`, `w`, `h` je `assertFinite(value, 'TexturePackerJson', \`the ${key} of the frame "${name}"\`)`
      und danach, wenn `value < 0`, `RangeError`:
      `TexturePackerJson: the ${key} of the frame "${name}" must be a finite number of 0 or more, got ${describeValue(value)}`
      — derselbe Wortlaut wie `BitmapFont.ts:227–231`.
4. Die Add-Schleife Z. 93–104 bleibt; sie liest nur noch Geprüftes.
5. TSDoc Z. 57–60 ersetzen durch je ein `@throws` mit dem Satz »the `target` stays as it was«:
   `{TypeError}` für einen Frame, der kein Objekt ist, ein `frame`, das kein Objekt ist, einen
   `filename` des Formats »JSON Array«, der kein String ist, und — ohne `parentCoords` — ein
   fehlendes `meta.size`; `{RangeError}` für `x`, `y`, `w`, `h`, die keine endliche Zahl von 0 oder
   mehr sind, und — ohne `parentCoords` — ein `w`/`h` von `meta.size`, das keine endliche Zahl über
   0 ist; `{Error}` für einen doppelten oder im `target` schon vergebenen Namen.

Nicht im Umfang: `data.frames`, das weder Objekt noch Array ist (wirft vor jedem Schreiben, die
Typen verbieten es, der Fetch-Pfad prüft es), und ein Frame, der über `meta.size` hinausreicht
(nicht Teil des Findings).

### 2. `AsepriteJson.parse()` prüft jeden Frame und die Tag-Liste (TYPE-002, BUG-008)

`packages/twopoint5d/src/texture/AsepriteJson.ts`. Die eigenen Prüfungen lesen die Einträge vor
`TexturePackerJson.parse()`; sie dürfen an einem Eintrag, der kein Objekt ist, nicht roh werfen.

1. Z. 221–223: wie in Schritt 1.2 — `filename` nur aus einem Objekt lesen.
2. Vor der Namensschleife Z. 230–238: Eintrag kein Objekt → `TypeError`. Hash:
   `AsepriteJson: the frame "a" is ${describeValue(entry)} — a frame of the json is an object`;
   Array: `AsepriteJson: the frame ${index} of the "Array" frames is ${describeValue(entry)} — a frame of the json is an object`
   (Aseprite nennt das Layout »Array«, nicht »JSON Array«).
3. Nach der Namensschleife, neue Schleife über **alle** Einträge:
   `assertPositiveFinite(duration, 'AsepriteJson', \`the duration of the frame "${name}"\`)` →
   `AsepriteJson: the duration of the frame "f1" must be a finite number above 0, got 0`
   (`RangeError`). Die Dauer-Prüfung in der Tag-Schleife Z. 271–278 entfällt — die neue deckt sie.
4. Z. 224: `meta.frameTags`, wenn vorhanden, kein Array → `TypeError`:
   `AsepriteJson: meta.frameTags is ${describeValue(tags)} — Aseprite writes the frame tags as a list`;
   in der Tag-Schleife zuerst: ein Tag, der kein Objekt ist → `TypeError`:
   `AsepriteJson: the frame tag ${index} is ${describeValue(tag)} — a frame tag is an object`.
   `meta.slices` bleibt wie es ist (nicht Teil des Findings).
5. TSDoc Z. 209–215: »a frame without a duration above zero« wird »a frame — in a tag or outside
   every tag — without a duration above zero, with a `RangeError`«; dazu »a frame or a frame tag
   that is no object, and `meta.frameTags` that is no list, with a `TypeError`«. Der Satz »Every
   check runs before the first frame is added: a refused sheet leaves `options.target` as it was«
   bleibt und stimmt jetzt, weil Schritt 1 die Rechtecke vor dem ersten `add()` prüft.
6. `atlasAdapters.ts:28–31`: Cast bleibt; darüber ein Kommentar, *warum* er trägt — der Cast
   behauptet eine Dauer an jedem Frame und `meta.frameTags` als Liste von Tags, und
   `AsepriteJson.parse()` prüft beides, bevor es einen Frame hinzufügt; ein Json, der kein
   Aseprite-Sheet ist, wird dort abgewiesen. Nur nennen, was `parse()` wirklich prüft.
7. Spec `AsepriteJson.spec.ts:279–285` (`refuses a frame of a tag without a duration above 0`) auf
   die neue Meldung und `RangeError` umstellen.

### 3. Spec-Fälle der Parser

Neue Fälle in `TexturePackerJson.spec.ts` und `AsepriteJson.spec.ts` siehe »Regressionstests«.

### 4. `frameTrimMargins()` verwirft eine entartete Trim-Fläche (BUG-025)

`packages/twopoint5d/src/texture/frameTrimMargins.ts:40–49`: die Bedingung um
`w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= W && y + h <= H` erweitern; sonst vier Nullen wie
bei den anderen ungültigen Daten. Weiter nur Guards, kein Destructuring mit Defaults, keine
Allokation — `AtlasFrame#setFrame()` und `AtlasFrameTable#update()` rufen es auf dem Hot Path, und
`sprites/hot-path-allocations.spec.ts` sowie `texture/hot-path-allocations.spec.ts` messen das.
TSDoc Z. 15–16 wird zu: »A frame without both rectangles, with a value in them that is no finite
number, with a `sourceSize` whose width or height is not above 0, or with a `spriteSourceSize`
that does not lie within the `sourceSize` — a `w` or `h` not above 0, an `x` or `y` below 0,
`x + w` beyond the width or `y + h` beyond the height — gets four zeros: the margins of a frame
always leave a trimmed area above 0.«

`sampleFrameAt.ts:69` (zweite Fundstelle des Findings) bekommt keinen Guard im Shader: jeder Pfad
der Library, der Ränder in den Shader schreibt — `AtlasFrameTable`, `FrameTable`,
`FrameBasedAnimations#add()`, `AtlasFrame#setFrame()`, `prepareSpriteFrame()` — geht durch
`frameTrimMargins()`; `RepeatingTextureColor` liest keine Ränder (`trim: 'stretch'`), und ein von
Hand geschriebenes `setTexTrim()` ist der Wert des Aufrufers.

### 5. `frameTrimMargins` exportieren (API-005)

`packages/twopoint5d/src/texture/public-api.ts`: benannter Export
`export {frameTrimMargins, type FrameTrimMargins} from './frameTrimMargins.js';`, einsortiert nach
`./FrameTable.js` (Biome sortiert ggf. selbst). Die TSDoc-Verweise in `AtlasFrameTable.ts:31`,
`FrameTable.ts:96` und `FrameBasedAnimations.ts` bleiben, sie zeigen jetzt auf einen öffentlichen
Namen. Guide und `ts check`-Block in Schritt 9.

### 6. `sampleFrameAt()` ohne `!` (TYPE-001)

`packages/twopoint5d/src/texture/sampleFrameAt.ts`:

1. `FrameToSample`: `margins` entfällt, `drawnTexels` wird Pflichtfeld (`readonly drawnTexels: Node<'vec2'>`), TSDoc des Felds bleibt.
2. `FrameSampleOptions` wird ein Typ mit Union am Diskriminanten `trim`:
   ```ts
   interface FrameSampleCommonOptions {
     /** One wrap per axis, `[u, v]`. */
     readonly wrap: readonly [u: AtlasFrameWrap, v: AtlasFrameWrap];
     /** Texels of the frame as drawn the lookup keeps away from each edge; 0 for none. */
     readonly inset: number;
   }

   /** What {@link sampleFrameAt} does with a position. @internal */
   export type FrameSampleOptions = FrameSampleCommonOptions &
     (
       | {/** The trimmed area fills the whole position. */ readonly trim: 'stretch'}
       | {
           /**
            * The position stands for the untrimmed sprite, the trimmed area is the part of it the
            * packer cut the frame out of, and outside that part the result is `vec4(0)`.
            */
           readonly trim: 'mask';
           /** `[left, top, right, bottom]`, the margins a packer cut off, as `frameTrimMargins()` answers them. */
           readonly margins: Node<'vec4'>;
         }
     );
   ```
   Die TSDoc-Aufteilung darf der Implementierer an Biome und Lesbarkeit anpassen; der Typvertrag
   ist: `trim: 'mask'` ohne `margins` compiliert nicht, ein Frame ohne `drawnTexels` auch nicht.
3. Rumpf: `const {texCoords, flipDiagonal, drawnTexels} = frame;` und im Zweig
   `if (options.trim === 'mask') { const {margins} = options; … }` — kein `!` mehr.
4. `sampleAtlasFrame.ts:123–137`: `margins` aus dem Frame-Objekt nehmen und in die Optionen legen,
   nur für `'mask'`:
   `trim === 'mask' ? {wrap: [wrapU, wrapV], trim, margins, inset} : {wrap: [wrapU, wrapV], trim, inset}`.
   Der Graph bleibt derselbe (unter `'stretch'` las ihn schon vorher niemand); die Specs von
   `sampleAtlasFrame` und `texture-atlas-frame-sampling.test.js` halten das.
5. `sprites/features/RepeatingTextureColor.ts` bleibt unverändert — sein Aufruf passt in die neuen Typen.
6. `sampleFrameAt.spec.ts`: `frame()` Z. 11–16 ohne `margins`; die beiden `'mask'`-Fälle
   Z. 72–87 geben `margins: vec4Of(0.25, 0, 0.25, 0)` in den Optionen mit. Dazu der Typfall aus
   »Regressionstests«.

### 7. `textureClasses` als eingefrorene Kopie (BUG-011)

`packages/twopoint5d/src/texture/TextureResource.ts`:

1. Signal Z. 392, `cmpTexClasses` Z. 124 und der Parameter `classes` von
   `#publishImageWithTexture()` Z. 897 auf `readonly TextureOptionClasses[] | undefined`.
2. Getter Z. 498: Rückgabetyp `readonly TextureOptionClasses[] | undefined`. Setter Z. 502:
   Parameter `readonly TextureOptionClasses[] | undefined`; ein leeres Array bleibt `undefined`,
   sonst `Object.freeze([...value])` speichern.
3. TSDoc Z. 493–497: »stores a frozen copy of what is written: a change to the array handed in
   does not reach the resource, and writing it again after a change builds the texture with the
   new classes. The getter answers that copy; to change the classes, write a new array.« Satz
   zum Verhalten nach `dispose()` bleibt.
4. `fromImage()`/`fromTileSet()`/`fromAtlas()` Z. 323–370: Parameter `textureClasses` auf
   `readonly TextureOptionClasses[]` (erweitert, bricht nichts); `?.slice()` entfällt, der Setter
   kopiert. Spec `the static factories leave the textureClasses they are given alone`
   (`TextureResource.spec.ts:2736`) muss grün bleiben.
5. `TextureFactory.ts:233` `getOptions(classNames: readonly TextureOptionClasses[])` und
   `#mergeOptions()` Z. 244 ebenso — nur erweitert; `TextureStore.spec.ts:2446/2457` reichen den
   Getter dorthin.
6. `TextureStore.spec.ts:388`: `resource?.textureClasses?.sort()` sortiert in place — auf dem
   eingefrorenen Array ein `TypeError`, auf `readonly` ein Typfehler. Umstellen auf
   `[...(resource?.textureClasses ?? [])].sort()`.

### 8. `AtlasTextureResource` und der Fallback der Factory (BUG-010, MEM-004)

`packages/twopoint5d/src/texture/TextureResource.ts`:

1. **BUG-010**, Fehlerzweig Z. 1470–1479: vor dem `return` in einem `batch()`
   `atlasJsonSignal.set(undefined)` und `context.imageUrl.set(undefined)`; das `context.fail(…)`
   bleibt und steht nach dem Batch, wie im Atlas-Effekt `takeBack()` vor `context.fail()` steht
   (Z. 1557–1558). Der Kommentar Z. 1471–1472 (»the
   json that is published stays as it was …«) ist dann falsch und wird ersetzt durch das *Warum*:
   Json und `imageUrl` gehen zusammen zurück, damit nichts an der Ressource das Bild eines
   Overrides nennt, den es nicht mehr gibt — derselbe Zustand wie bei einem gefetchten Json ohne
   Bild, der nie einen Override hatte. Der dritte Effekt Z. 1493–1503 bleibt: läuft er vor dem
   zweiten, setzt er denselben alten Wert (keine Änderung), und der zweite nimmt beides zurück;
   läuft er danach, findet er kein `atlasJson` und tut nichts. Das Ergebnis hängt nicht von der
   Reihenfolge ab — der Regressionstest prüft den Endzustand.
   Der Atlas-Effekt nimmt `atlas`, `adapterAnimations` und `frameBasedAnimations` über sein
   `takeBack()` zurück (kein `atlasJson`), der Bild-Effekt `imageCoords` und `texture` über
   `#takeBackImage()` (kein `imageUrl`) und gibt die Textur frei.
2. **BUG-010**, TSDoc: Klasse Z. 303–304 — »An atlas resource whose json names no image, with no
   `overrideImageUrl` to fall back on — never set, or cleared again —, has no `imageUrl` either
   and does the same; a json it fetched is taken back with it.« `imageUrl`-Getter Z. 446–451 —
   »… the `overrideImageUrl` while one is set; `undefined` while neither names one.«
   `atlasJson`-Getter Z. 1305–1327 — neuer Punkt: »A json fetched from `atlasUrl` that names no
   image, while no `overrideImageUrl` is set, is not offered: `atlasJson` answers `undefined`, and
   the failure is an `error` with `source: 'atlas'`.«
3. **BUG-010**, Spec `TextureResource.spec.ts:1288–1320` umschreiben (siehe »Regressionstests«).
4. **MEM-004**, Fallback-Effekt Z. 780–790:
   ```ts
   const renderer = this.#renderer.get();
   if (!renderer) {
     if (fallback !== undefined && this.#textureFactory.value === fallback.factory) this.textureFactory = undefined;
     fallback = undefined;
     return;
   }
   if (renderer === fallback?.renderer) return;
   // … Rest unverändert
   ```
   mit einem Kommentar zum *Warum* (die Factory hält den Renderer, und jede spätere Textur würde
   noch für den alten gebaut). Eine von außen geschriebene Factory bleibt stehen. Die Textur bleibt,
   solange das Bild dasselbe ist — das ist das dokumentierte Verhalten einer geleerten
   `textureFactory` (Klassen-TSDoc Z. 318–319).
5. **MEM-004**, TSDoc `renderer` Z. 542–548 ergänzen: »Clearing it takes the factory built for it
   back — a factory written from outside stays —, so the resource no longer holds the renderer;
   the texture stays for as long as the image stays the same, as with a cleared
   `textureFactory`, and a new texture waits for a factory.« Den Kommentarblock Z. 772–776 um
   denselben Satz ergänzen.

### 9. Doku und CHANGELOG

1. `docs/sprites.md` »Frames out of an atlas« (Z. 237–255):
   - nach dem Satz zu `TexturePackerJson` (Z. 243–244): was es abweist — einen Frame, der kein
     Objekt ist oder kein `frame` hat, eine Zahl von `frame`, die keine endliche Zahl von 0 oder
     mehr ist (`RangeError`), und ohne `parentCoords` ein `meta.size`, das keine Fläche über 0
     hat —, je mit dem Frame benannt, bevor der erste Frame in den Atlas geht: ein abgewiesener
     Json lässt den `target`, wie er war.
   - Z. 241–242 (»the margins come from TexturePacker data and are zero for every other«) um
     »and zero for a frame whose `spriteSourceSize` does not lie within its `sourceSize`«
     ergänzen, dann ein Satz: `frameTrimMargins(data, target?)` rechnet sie nach derselben Regel,
     für ein Feature oder Material eigener Bauart; mit eigenem `target` alloziert der Aufruf
     nichts. Dazu ein `ts check`-Block, der für sich steht:
     ```ts check
     import {frameTrimMargins, type FrameTrimMargins, type TextureAtlasFrame} from '@spearwolf/twopoint5d';

     declare const frame: TextureAtlasFrame<unknown>;

     const margins: FrameTrimMargins = frameTrimMargins(frame.data);
     ```
     (Typname `TextureAtlasFrame` gegen den Export prüfen; `pnpm typecheck` compiliert den Block
     gegen die gebaute Library.)
2. `docs/sprites.md` »Aseprite sheets« (Z. 335–354): ein Satz — jeder Frame trägt seine Dauer,
   Aseprite schreibt eine über 0 für jeden Frame; ein Frame ohne sie, in einem Tag oder nicht,
   wird mit einem `RangeError` abgewiesen, mit Namen, bevor der erste Frame in den Atlas geht.
3. `docs/proposals/wave-and-segment-sprites.md` §4.2, Codeauszug Z. 323–344: `FrameToSample` und
   die Optionen in der Form aus Schritt 6 (Auszug, kein `ts check`). Die Aufzählung darunter
   (Z. 346–362) bleibt; sie nennt die Ränder als etwas, das `sampleAtlasFrame()` aus der Tabelle
   liest — ggf. »and hands the margins on with `trim: 'mask'`«.
4. `docs/proposals/animation-playback-and-aseprite.md` Z. 297–305: »a frame of a tag without a
   `duration` above 0« → »a frame without a `duration` above 0, in a tag or outside every tag«,
   Beispielmeldung auf `AsepriteJson: the duration of the frame "x" must be a finite number above 0, got 0`
   (`RangeError`); dazu »`meta.frameTags` that is no list, and a tag that is no object« mit
   `TypeError`.
5. `docs/proposals/atlas-frame-sampling.md` §2 Z. 76–77: Punkt zu `frameTrimMargins()` um
   »exported, with its type `FrameTrimMargins`; four zeros for a frame whose `spriteSourceSize`
   does not lie within its `sourceSize`« ergänzen.
6. `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` (Skill `updating-changelog`; nichts in
   veröffentlichten Abschnitten ändern):
   - `### Added`: `frameTrimMargins(data, target?)` und `FrameTrimMargins` exportiert — die
     Trim-Ränder eines Frames nach der Regel, die `AtlasFrame#setFrame()`, `prepareSpriteFrame()`,
     `AtlasFrameTable`, `FrameTable` und `FrameBasedAnimations#bakeDataTexture()` schreiben.
   - `### Changed`: `TextureResource#textureClasses` speichert eine eingefrorene Kopie, der Getter
     ist `readonly TextureOptionClasses[] | undefined`; ein geändertes Array, wieder geschrieben,
     baut die Textur mit den neuen Klassen; `fromImage()`/`fromTileSet()`/`fromAtlas()` und
     `TextureFactory#getOptions()` nehmen `readonly`-Arrays. »See the Migration Guide«.
   - `### Fixed`: den bestehenden Eintrag zu `TexturePackerJson.parse()` (Z. 136 der Datei, »refuses
     a frame of the "JSON Array" format whose `filename` is no string …«) um die neuen Abweisungen
     erweitern oder einen eigenen daneben setzen — `AsepriteJson.parse()` erbt sie, und sein
     `options.target` bleibt bei einer Abweisung stehen.
   - `### Fixed`: `frameTrimMargins()` (und damit Sprites, Tabellen, Animationen) gibt einem Frame,
     dessen `spriteSourceSize` nicht in `sourceSize` liegt, keine Ränder — vorher Inf/NaN im Shader.
   - `### Fixed`: ein `AtlasTextureResource`, dessen gefetchter Json kein Bild nennt, nimmt beim
     Leeren von `overrideImageUrl` `imageUrl`, `imageCoords`, `texture` (freigegeben), `atlas`,
     `frameBasedAnimations` und `atlasJson` zurück, wie die Klassen-TSDoc sagt.
   - `### Fixed`: eine eigenständige `TextureResource` lässt die Factory los, die sie für ihren
     `renderer` gebaut hat, sobald `renderer` geleert wird, und hält den Renderer nicht mehr.
   - `AsepriteJson` ist unveröffentlicht: der `### Added`-Eintrag (Z. 21 der Datei) nennt »a frame
     without a duration« schon ohne Einschränkung; nur anpassen, falls er etwas sagt, das nicht mehr
     stimmt. Keine eigene Zeile für die interne `sampleFrameAt()`.
   - `### Migration Guide`: neuer Unterabschnitt `#### The texture classes of a TextureResource`
     — was sich ändert (eingefrorene Kopie, `readonly`-Getter), was bricht (ein `push()`/`sort()`
     auf dem Getter wirft in Strict-Mode-Code, eine Zuweisung an eine Variable vom Typ
     `TextureOptionClasses[]` compiliert nicht), was zu tun ist (ein neues Array schreiben), mit
     einem `ts check`-Block, z. B.
     `resource.textureClasses = [...(resource.textureClasses ?? []), 'linear'];`.

## Regressionstests

Alle vor dem Fix rot laufen lassen und den roten Lauf in den Report schreiben; Namen dürfen
sprachlich angepasst werden, der Inhalt nicht.

| Finding | Datei | Fall | rot vor dem Fix, weil |
| --- | --- | --- | --- |
| BUG-008 | `TexturePackerJson.spec.ts` | `refuses a frame without its area with a TypeError naming it, and leaves the target as it was` (Hash: `a` gültig, `b` ohne `frame`; `target` mit einem Frame `x` vorher) | `frame.x` auf `undefined` roh, `a` steht schon im `target` |
| BUG-008 | `TexturePackerJson.spec.ts` | `refuses a measure of a frame that is no finite number of 0 or more with a RangeError naming the frame and the field` (je ein Fall `x: NaN`, `w: -1`, `h: Infinity`, `y: '4'`) | kein Wurf, NaN-Koordinaten |
| BUG-008 | `TexturePackerJson.spec.ts` | `refuses an entry that is no object` (Hash `{a: null}`, Array `[null]`) | roher `TypeError` ohne Subjekt |
| BUG-008 | `TexturePackerJson.spec.ts` | `without parentCoords, refuses a meta.size without an area above 0` (`{w: 0, h: 16}`, `{w: NaN, h: 16}`, `meta` ohne `size`) | kein Wurf bzw. roher `TypeError` |
| BUG-008 | `TexturePackerJson.spec.ts` | Charakterisierung: `takes a frame of no area` (`w: 0`) und `takes a meta.size it does not read when parentCoords are given` | grün vorher und nachher |
| BUG-008 | `AsepriteJson.spec.ts` | `refuses a sheet with a frame without its area and leaves options.target as it was` | `TexturePackerJson` hat `a` schon in den `target` gelegt |
| TYPE-002 | `AsepriteJson.spec.ts` | `refuses a frame outside every tag without a duration above 0, with a RangeError naming it, before the first frame reaches options.target` | kein Wurf |
| TYPE-002 | `AsepriteJson.spec.ts` | `refuses meta.frameTags that is no list, and a frame tag that is no object` | roher `TypeError` (`… is not iterable` / `null.name`) |
| TYPE-002 | `AsepriteJson.spec.ts` oder `atlasAdapters`-Spec | `asepriteAtlasAdapter refuses a json whose frames carry no duration` | kein Wurf |
| BUG-025 | `frameTrimMargins.spec.ts` | `gives four zeros to a spriteSourceSize that does not lie within the sourceSize` (`w: 0`, `h: 0`, `x: -1`, `y: -1`, `x + w > W`, `y + h > H`) | Ränder ≠ 0, Summe ≥ 1 |
| BUG-025 | `frameTrimMargins.spec.ts` | Charakterisierung: `keeps the margins of a trimmed area that reaches the edges of the sourceSize` (`x + w === W`, `y + h === H`) | grün vorher und nachher |
| API-005 | `docs/sprites.md` `ts check`-Block | `import {frameTrimMargins, type FrameTrimMargins} from '@spearwolf/twopoint5d'` | `pnpm typecheck`: kein solcher Export (TS2305) |
| TYPE-001 | `sampleFrameAt.spec.ts` | Typfall `types the margins as part of trim mask and the drawn texels as part of every frame`: `// @ts-expect-error` vor `const noMargins: FrameSampleOptions = {wrap: ['clamp', 'clamp'], inset: 0, trim: 'mask'}` und vor einem `FrameToSample` ohne `drawnTexels`; zur Laufzeit nur ein trivialer `expect` auf die beiden Objekte, kein Aufruf von `sampleFrameAt()` ohne Ränder | `pnpm typecheck`: TS2578 (»Unused '@ts-expect-error' directive«) an beiden Zeilen |
| BUG-011 | `TextureResource.spec.ts` | `an array of textureClasses changed and written again builds the texture with the new classes` (`classes.push('linear'); resource.textureClasses = classes;` → neue Textur mit `magFilter` `LinearFilter`, alte freigegeben) | kein Rebuild |
| BUG-011 | `TextureResource.spec.ts` | `keeps a frozen copy of the textureClasses written to it` (`!== written`, `Object.isFrozen()`, Änderung am geschriebenen Array erreicht den Getter nicht) | Referenz, nicht eingefroren |
| BUG-010 | `TextureResource.spec.ts:1288` | umschreiben zu `a json without an image takes the image, the texture, the atlas and the json back when the override is cleared again, and reports it`: nach `overrideImageUrl = undefined` → ein `error` (`source: 'atlas'`, `url: 'atlas.json'`), `imageUrl`, `imageCoords`, `texture`, `atlas`, `frameBasedAnimations`, `atlasJson` je `undefined`, die gebaute Textur `disposed` (`makeTextureFactory()` liefert `textures`); danach `overrideImageUrl = 'other.png'` → `imageUrl` `'other.png'`, `atlas` wieder da, `atlasJson?.meta.image` `'other.png'`, weiterhin ein `error` | `imageUrl` bleibt `'override.png'`, Textur und Atlas bleiben |
| MEM-004 | `TextureResource.spec.ts` | `a renderer that is cleared takes back the factory the resource built for it, and the texture of the image stays` (dazu: derselbe Renderer wieder gesetzt → eine **neue** Factory) | `textureFactory` bleibt die alte |
| MEM-004 | `TextureResource.spec.ts` | `a renderer that is cleared leaves a factory written from outside standing` | Charakterisierung, grün vorher und nachher |

Bestehende Specs, die sich mit der Änderung bewegen (mitziehen, nicht als Regression werten):
`AsepriteJson.spec.ts:279` (Meldung/Klasse), `sampleFrameAt.spec.ts:11–16` und `:72–87`
(Ränder in den Optionen), `TextureStore.spec.ts:388` (`sort()` auf einer Kopie).

## Für die `Schnittstellen:`-Zeile im Plan (Zug 5)

- `frameTrimMargins(data: unknown, target?: FrameTrimMargins): FrameTrimMargins` und Typ
  `FrameTrimMargins` öffentlich (benannter Export in `src/texture/public-api.ts`); vier Nullen auch
  für eine `spriteSourceSize` außerhalb von `sourceSize`
- `TextureResource#textureClasses`: Getter `readonly TextureOptionClasses[] | undefined`, Setter
  nimmt `readonly`, speichert `Object.freeze([...value])`; `fromImage()`/`fromTileSet()`/
  `fromAtlas()` nehmen `readonly TextureOptionClasses[]`; `TextureFactory#getOptions()` nimmt
  `readonly TextureOptionClasses[]`
- `TexturePackerJson.parse()` wirft `TypeError` (Eintrag/`frame` kein Objekt, `meta.size` fehlt
  ohne `parentCoords`) und `RangeError` (`x`/`y`/`w`/`h` keine endliche Zahl ≥ 0, `meta.size`
  keine Fläche > 0 ohne `parentCoords`) vor dem ersten `add()`
- `AsepriteJson.parse()` wirft `RangeError` für jeden Frame ohne Dauer > 0
  (`AsepriteJson: the duration of the frame "x" must be a finite number above 0, got 0`),
  `TypeError` für `meta.frameTags` ohne Liste und Tags/Frames, die keine Objekte sind
- intern: `FrameToSample` ohne `margins`, `drawnTexels` pflichtig; `FrameSampleOptions` ist eine
  Union, `margins` steht bei `trim: 'mask'`
- `AtlasTextureResource`: gefetchter Json ohne Bild und ohne Override → `atlasJson` und
  `imageUrl` `undefined`; `TextureResource#renderer = undefined` nimmt die selbstgebaute Factory
  zurück

## Urteil des Reviewers (Zug 3, Nachprüfung in Runde 1)

| Finding | Urteil | Fundstelle (Commit 74c54275) |
| --- | --- | --- |
| BUG-008 | behoben | `TexturePackerJson.ts:80–90` (`meta.size` ohne `parentCoords`), Prüfschleife bis `:140`, Add-Schleife `:143` liest nur Geprüftes; Aseprite erbt es (`AsepriteJson.spec.ts` »refuses a sheet with a frame without its area …«) |
| BUG-010 | behoben | `TextureResource.ts:1500–1503` nimmt `atlasJson` und `imageUrl` in einem `batch()` vor `context.fail()` zurück; Ergebnis unabhängig von der Effekt-Reihenfolge; Spec `TextureResource.spec.ts:1289` |
| BUG-011 | behoben | `TextureResource.ts:515` `Object.freeze([...value])`, Getter `:510` `readonly`; Specs `:1796`, `:1824`; `TextureStore.spec.ts:388` sortiert eine Kopie |
| MEM-004 | behoben | `TextureResource.ts:798–803`; Specs `:2411`, `:2440` |
| BUG-025 | behoben | `frameTrimMargins.ts:52–59`; Spec `frameTrimMargins.spec.ts:40` |
| API-005 | behoben | `public-api.ts:7`; `ts check`-Block `docs/sprites.md:247–253` |
| TYPE-001 | behoben | `sampleFrameAt.ts:13`, `:39`, `:78`; Aufrufer `sampleAtlasFrame.ts:135`; Typfall `sampleFrameAt.spec.ts:98` |
| TYPE-002 | behoben | `AsepriteJson.ts:236`, `:263`, `:270`; Cast-Kommentar `atlasAdapters.ts:29–31`; Specs `AsepriteJson.spec.ts:288`, `:324`, `:333` |

Abweichungen vom Detailplan, vom Reviewer als tragend bewertet: `FrameSampleOptions` als Union zweier
benannter Interfaces statt Intersection; Setter `textureClasses` macht aus einem Nicht-Array
`undefined`; TSDoc von `AsepriteJson.parse()` verweist auf die Abweisungen von
`TexturePackerJson.parse()`; die Prüfschleife von `TexturePackerJson.parse()` füllt ein Array
`checked`, das die Add-Schleife liest; `meta.frameTags` wird vor den Frame-Objekten geprüft.

Kleine Befunde (ohne Runde):
- `packages/twopoint5d/CHANGELOG.md:21` — »so is« vor einer Aufzählung im Plural, richtig »so are«.
- `packages/twopoint5d/src/texture/AsepriteJson.ts:263` — die Dauerprüfung läuft vor den Prüfungen
  von `TexturePackerJson`; ein Frame im Layout »Array« ohne `filename` wird als `the duration of the
  frame "undefined"` gemeldet. Ursache ist die vorbestehende Namensschleife, als Nebenbefund in
  »Offene Befunde«.
- `packages/twopoint5d/docs/proposals/wave-and-segment-sprites.md` (Codeauszug §4.2) — `wrap` ohne
  die Labels `[u:, v:]` des Codes; Auszug, kosmetisch.

Nebenbefunde (Urteil `→ Scope`, Scope-Regel »alles«; alle drei am Laufbeginn schon so, geprüft mit
`git show 9b72e4bd~1:packages/twopoint5d/src/texture/AsepriteJson.ts`): Namensschleife mit
`"undefined"`, `meta` vor der Prüfung gelesen, Tag-Namen und `meta.slices` ohne Formprüfung —
Einträge in »Offene Befunde« des Plans.

## Findings im Volltext

**BUG-008 · medium · packages/twopoint5d/src/texture/TexturePackerJson.ts:94** (auch `AsepriteJson.ts:309`) — Frame-Rechtecke in TexturePackerJson.parse() vor dem ersten add() prüfen
parse() prüft vor dem Hinzufügen nur die Frame-Namen. Ein Eintrag ohne `frame` wirft erst in der Schleife ein TypeError (`frame.x` auf undefined), nachdem die Einträge davor schon im `target` stehen. Ein Eintrag mit nicht-numerischen oder nicht-endlichen `x/y/w/h` (JSON aus einem Katalog) erzeugt still TextureCoords mit NaN, die erst als kaputte Quads im Shader auffallen. Damit stimmt die Zusage nicht, die AsepriteJson.parse() in seinem TSDoc macht (»a refused sheet leaves options.target as it was«) und die TexturePackerJson.parse() für Namen macht; außerdem bricht die Fehlermeldung die Projektregel (Subjekt zuerst, assertFinite() für Zahlen) mit einer rohen TypeError-Meldung.
Beleg: `const {frame, rotated} = frameData;` … `new TextureCoords(parentCoords, frame.x, frame.y, frame.w, frame.h)` — kein Check von `frame` oder seinen Zahlen
Empfehlung: In der Prüfschleife vor dem ersten add() je Eintrag `frame` als Objekt und x/y/w/h mit assertFinite() (w/h mit assertPositiveFinite() oder >= 0) prüfen, mit Subjekt `TexturePackerJson: the frame "name" …`; erst danach hinzufügen. Zusätzlich `meta.size` prüfen, wenn kein parentCoords gegeben ist.

**BUG-010 · medium · packages/twopoint5d/src/texture/TextureResource.ts:1425** (auch Z. 1414, Z. 303; jetzt Z. 1470–1479, 1493–1503, 303–304) — Geleerten `overrideImageUrl` eines Atlas ohne `meta.image` wie dokumentiert zurücknehmen
Der zweite Atlas-Effekt schreibt den Override in `atlasJson.meta.image`. Wird der `overrideImageUrl` bei einem gefetchten JSON ohne `meta.image` wieder geleert, meldet dieser Effekt `atlasImage` und lässt `atlasJson` stehen; der dritte Effekt liest dann `this.overrideImageUrl ?? this.atlasJson.meta.image` — also den alten Override. `imageUrl`, `imageCoords`, `texture` und `atlas` des alten Override-Bildes bleiben veröffentlicht, während `getAsync()` wegen des `atlasImage`-Failures für jeden Subtyp rejected. Die Klassen-TSDoc (Z. 303–304) sagt, eine solche Ressource habe keine `imageUrl` und nehme Koordinaten und Textur zurück; der `imageUrl`-Getter sagt, er nenne das Bild des JSON oder den gesetzten Override. Der Spec `a json without an image reports an override that is cleared again` (TextureResource.spec.ts:1288) pinnt dagegen `imageUrl === 'override.png'`.
Beleg: `context.imageUrl.set(this.overrideImageUrl ?? this.atlasJson.meta.image);` — `meta.image` ist hier der zuvor eingesetzte Override
Empfehlung: Entscheiden, welche Seite gilt: Entweder im Fehlerzweig des zweiten Effekts `imageUrl` leeren (dann nimmt der Image-Effekt Textur und Koordinaten zurück, wie die Klassen-TSDoc sagt) und den Spec anpassen, oder die TSDoc an Klasse und `imageUrl`-Getter auf das tatsächliche Verhalten umschreiben.
Entschieden 2026-10-23: die Klassen-TSDoc gilt, der Spec wird angepasst.

**BUG-011 · medium · packages/twopoint5d/src/texture/TextureResource.ts:469** (auch Z. 124; jetzt Z. 502–507, 124–129) — `textureClasses` beim Schreiben kopieren
Der Setter speichert das übergebene Array als Referenz, `cmpTexClasses` vergleicht zuerst per `a === b`. Wer ein geschriebenes Array mutiert und erneut zuweist (`classes.push('linear'); resource.textureClasses = classes`), löst keinen Rebuild aus — die Textur behält die alten Filter, während der Getter schon die neuen Klassen zeigt. `tileSetOptions` friert für genau diesen Fall eine Kopie ein (Z. 1085), `fromImage()`/`fromTileSet()`/`fromAtlas()` kopieren per `slice()`, nur der direkte Setter nicht.
Beleg: `set textureClasses(value) { … this.#textureClasses.set(value); }` mit `compare: cmpTexClasses` und `if (a === b) return true;`
Empfehlung: Im Setter `value.slice()` (oder `Object.freeze([...value])`) speichern, analog zu `tileSetOptions`, und das im TSDoc des Setters festhalten.

**MEM-004 · low · packages/twopoint5d/src/texture/TextureResource.ts:743** (jetzt Z. 779–790) — Fallback-Factory loslassen, wenn der `renderer` einer Ressource geleert wird
Eine eigenständige Ressource baut für ihren `renderer` eine `TextureFactory`, die den Renderer in einer Closure hält. Wird `renderer` auf `undefined` gesetzt, kehrt der Effekt früh zurück: `fallback` und `textureFactory` bleiben stehen. Die Ressource baut weiter Texturen mit der Factory des alten Renderers und hält diesen erreichbar, auch nachdem z. B. ein `Display` ihn disposed hat. `TextureStore` macht es anders: `renderer = undefined` setzt dort `textureFactory` auf `undefined` (TextureStore.ts:411).
Beleg: `const renderer = this.#renderer.get(); if (!renderer || renderer === fallback?.renderer) return;`
Empfehlung: Beim Leeren des Renderers die selbstgebaute Factory zurücknehmen (`if (!renderer) { if (this.#textureFactory.value === fallback?.factory) this.textureFactory = undefined; fallback = undefined; return; }`) und das im TSDoc von `renderer` festhalten.

**BUG-025 · low · packages/twopoint5d/src/texture/frameTrimMargins.ts:50** (auch `sampleFrameAt.ts:69`) — Entartete Trim-Fläche (Summe der Ränder >= 1) abfangen
frameTrimMargins() prüft nur, dass die Zahlen endlich und die Quellgröße positiv sind. Ein Eintrag mit `spriteSourceSize.w = 0`, mit `x + w > sourceSize.w` oder ein Aseprite-Frame mit abweichender `sourceSize` liefert Ränder, deren Summe 1 erreicht oder überschreitet. Im Shader ist `area = 1 - margins.xy - margins.zw` dann 0 oder negativ, und `div(…, area)` ergibt Inf/NaN oder gespiegelte Bereiche; mit trim 'mask' bleibt der Frame leer oder flackert, ohne Fehlermeldung.
Empfehlung: In frameTrimMargins() Ränder verwerfen (vier Nullen, wie bei den anderen ungültigen Daten), wenn `w <= 0`, `h <= 0`, `x < 0`, `y < 0`, `x + w > W` oder `y + h > H`; die Regel im TSDoc ergänzen.

**API-005 · low · packages/twopoint5d/src/texture/public-api.ts:1** (auch `AtlasFrameTable.ts:31`, `FrameTable.ts:96`, `frameTrimMargins.ts:7`) — In öffentlichem TSDoc genannte `frameTrimMargins()` exportieren oder anders benennen
Das TSDoc von AtlasFrameTable, FrameTable und FrameBasedAnimations#bakeDataTexture() verweist für die Trim-Ränder auf `frameTrimMargins()`, die Funktion steht aber nicht in public-api.ts. Ein Nutzer, der ein eigenes Material gegen das Texel-Layout schreibt, kann die Ränder daher nicht nach derselben Regel berechnen, und der Verweis ist im Editor ein toter Name.
Empfehlung: frameTrimMargins und den Typ FrameTrimMargins in public-api.ts exportieren (dann Guide ergänzen) oder die TSDoc-Stellen so umformulieren, dass sie die Regel (`spriteSourceSize`/`sourceSize`) selbst nennen.

**TYPE-001 · low · packages/twopoint5d/src/texture/sampleFrameAt.ts:69** (auch Z. 76) — Bedingt erforderliche Felder von FrameToSample typisieren statt mit `!` zu erzwingen
`margins` und `drawnTexels` sind optional deklariert, werden aber bei `trim: 'mask'` beziehungsweise `inset > 0` mit `!` gelesen. Ein interner Aufrufer, der eines vergisst, bekommt keinen Compilefehler, sondern einen TypeError beim Graph-Bau (`undefined.xy`) ohne Subjekt in der Meldung.
Beleg: `sub(sub(vec2(1, 1), margins!.xy), margins!.zw)`; `div(options.inset, drawnTexels!)`
Empfehlung: Die Optionen als Union modellieren (`trim: 'mask'` verlangt `margins`, `inset > 0` verlangt `drawnTexels`) oder beide Felder pflichtig machen und sampleAtlasFrame() sie immer liefern lassen; alternativ vor der Nutzung mit expectDefined() prüfen.

**TYPE-002 · low · packages/twopoint5d/src/texture/atlasAdapters.ts:29** — Cast von TexturePackerJsonData auf AsepriteJsonData im Adapter prüfen oder dokumentieren
Der Adapter bekommt ein `TexturePackerJsonData` und castet es mit `as AsepriteJsonData`. Der Cast behauptet pro Frame ein `duration` und optional `meta.frameTags`; geprüft wird zur Laufzeit nur für Frames innerhalb von Tags (AsepriteJson.ts:272). Ein Atlas, dessen `meta.app` Aseprite nennt (oder der den Adapter per Name wählt) und dessen Frames kein `duration` tragen, wird akzeptiert, solange er keine Tags hat; das Ergebnis trägt dann Frames, die als `AsepriteFrameData` getypt sind, aber kein `duration` haben.
Beleg: `AsepriteJson.parse(json as AsepriteJsonData, {parentCoords})`
Empfehlung: AtlasAdapter auf `unknown`/eine Basis-Json-Form umstellen und die Aseprite-Form im Adapter prüfen, oder den Fall im TSDoc von AsepriteFrameData (`duration` kann fehlen) festhalten.
