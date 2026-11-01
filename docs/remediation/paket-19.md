# Paket 19 — Drain: SpritePicker, writeText, describeValue und Texturen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-Findings — sechs Nebenbefunde aus »Offene Befunde« (»überführt in Paket 19«),
  dazu zwei Stellen gleicher Ursache aus dem Zug 0 (unten »Dazu«)
- Ziel: Der Picker trifft nur, was gezeichnet wird, und weist ein Pass-Material im Slot mit benannter
  Meldung ab, `writeText` erkennt Features wie die übrige Library, `describeValue()` zitiert Strings
  eindeutig in einer Zeile, Aseprite-Frames überleben jeden Namen, und ein Katalog-Eintrag kann
  Mip-Stufen abschalten.
- Modell: stärkste Stufe (opus) — die Pick-Szene baut nach, was three beim Projizieren aus den
  Vorfahren eines Meshes liest (Clipping-Kontexte, Group-Order), mit Browser-Beweis unter WebGPU und
  WebGL 2; `describeValue()` ändert den Wortlaut jeder Meldung, die einen String mit Sonderzeichen
  zitiert, der Blast Radius über die Specs ist nur durch das Gate zu sehen
- Effort: medium — Signaturen, Meldungen und Schritte stehen unten; nichts davon ist nebenläufig oder
  sicherheitsrelevant
- Dateien:
  - `packages/twopoint5d/src/sprites/SpritePicker.ts` (+ `SpritePicker.spec.ts`)
  - `packages/twopoint5d-testing/test/sprites-picking.test.js`
  - `packages/twopoint5d/src/text/writeText.ts` (+ `writeText.spec.ts`)
  - `packages/twopoint5d/src/utils/describeValue.ts` (+ `describeValue.spec.ts`), dazu jede Spec, deren
    erwartete Meldung einen String mit `"`, `\` oder Steuerzeichen roh zitiert (das Gate zeigt sie)
  - `packages/twopoint5d/src/texture/AsepriteJson.ts` (+ `AsepriteJson.spec.ts`)
  - `packages/twopoint5d/src/texture/TextureFactory.ts` (+ `TextureFactory.spec.ts`, ggf.
    `TextureStore.spec.ts`)
  - `apps/lookbook/src/demos/stage-masks/MothChapel.ts` (Katalog-Eintrag `panes`, Zeilen `:186-189`)
  - Doku: `packages/twopoint5d/docs/sprites.md` (»Picking: which sprite is under the pointer«),
    `docs/proposals/gpu-picking.md` (Abweichungsliste, §3.2), `docs/text.md` (»Refusals.«),
    `docs/textures.md` (»Texture classes«), `AGENTS.md` (Regel »Error and warning messages«),
    `packages/twopoint5d/CHANGELOG.md` (`## [Unreleased]`: Added, Changed, Fixed)
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): clip and order a pick as the screen does and refuse a material in the slot it cannot draw from, find the features of writeText by name, quote a string in a message escaped, keep an Aseprite frame or slice named __proto__ and let a texture class turn mip levels off`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · alle sechs Nebenbefunde bestehen, keiner gegenstandslos ·
    SpritePicker: Clipping `isShown()` `:132-139`, `#scene` `:161`, `#gather()` `:274-298` (Paket 9
    hat die Datei verschoben), Pass-Material `#sync()` `:300-325`/`#build()` `:327-337` · `writeText.ts:50`
    unverändert · `describeValue.ts:71-77` unverändert, `describeValue.spec.ts:5-8` hält »unescaped«
    fest · `AsepriteJson.ts:489-492` unverändert, dazu `slicesAt()` `:282`/`:294` · `TextureFactory.ts:58-145`
    unverändert, Workaround `MothChapel.ts:186-189` · Dazu: Group-Order der Pick-Szene (gleiche Ursache
    wie das Clipping) · Folge aus Paket 18 (`src/display/types.ts:72`) → Nachtragspaket 22 · neuer
    Nebenbefund (handgesetzte Anführungszeichen) → »Offene Befunde«, `→ Rückfrage`
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, effort medium), Report nach `paket-19.impl-0.json`
  - 2026-11-01 Zug 2: Report FERTIG · 18 Dateien geändert, keine neu (SpritePicker + Spec, sprites-picking.test.js, writeText, describeValue, AsepriteJson, TextureFactory je + Spec, MothChapel.ts, sprites.md, gpu-picking.md, text.md, textures.md, CHANGELOG.md, AGENTS.md) · rote Läufe belegt (Vitest 4+2+3+2+3, Browser 8) · Arbeitsbaum schmutzig · eigener Verify läuft
  - 2026-11-01 Zug 2: Verify `pnpm run ci` exit=0 (`paket-19.verify.log`, Nx-Cache aus dem grünen Lauf des Implementierers)
  - 2026-11-01 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-19.diff`
  - 2026-11-01 Zug 3: Review: alle 8 Stellen behoben · kritisch 0 · wichtig 2 (`CHANGELOG.md:57` Rückblick im Nachsatz; `gpu-picking.md` §5 »Refusals« ohne die Slot-Ablehnung) · klein 5 (unten) · Diff `paket-19.diff`
  - 2026-11-01 Zug 4 Runde 1: offen die 2 wichtigen Befunde → derselbe Implementierer per Resume (opus, medium), Report nach `paket-19.impl-1.json`
  - 2026-11-01 Zug 4 Runde 1: zurück FERTIG · `CHANGELOG.md:57` Nachsatz im Präsens, `gpu-picking.md` §5 Eintrag mit drei Meldungen, Abweichungsliste »(§3.2, §5)« · Verify `pnpm run ci` exit=0 (`paket-19.verify-1.log`) · Reviewer gezielt (sonnet, medium), Diff `paket-19-r1.diff`
  - 2026-11-01 Zug 4 Runde 1: Review gezielt: beide wichtigen Befunde behoben (`CHANGELOG.md:57`, `gpu-picking.md:279-285` und `:21`), keine neuen · Fortschritt 2 → 0
  - 2026-11-01 Zug 5: Commit 82fe9ab0 (18 Dateien, Trailer `Remediation-Run: 2026-10-31`) · Verify `paket-19.verify-1.log` exit=0

## Abgleich

Alle Fundstellen am Stand 1a8ec51e nachgesehen, jede auch an der Basis d9b648bf (vorbestehend):

| Nebenbefund | Stand | jetzt |
| --- | --- | --- |
| SpritePicker ignoriert `ClippingGroup` | unverändert, verschoben | Pick-Meshes liegen flach in `#scene` (`scene.add(entry.mesh)` `:289`); three 0.187.0 tritt in einen Clipping-Kontext nur beim Abstieg durch eine `ClippingGroup` ein (`StandardDrawingPipeline#project()`, `node_modules/three/src/renderers/common/StandardDrawingPipeline.js:195`) |
| Pass-Material im `material`-Slot | unverändert, verschoben | `#sync()` nimmt `sprites.material!` (`:302`) als Material der Sprites, `#build()` baut das Pick-Material ohne Pass und mit `placement: material.placement` (`:332`) |
| `writeText` prüft Features über Identität | unverändert | `writeText.ts:50` `sprites.kind.features.includes(feature)`; sonst identifiziert die Library Features über den Namen (`requires`, `checkPlacementStandIn()`, `segmentPlacement()`) — die Stelle ist die einzige mit `features.includes` unter `src/` |
| `describeString()` zitiert roh | unverändert | `describeValue.ts:71-77`; `describeValue.spec.ts:5-8` erwartet `"a "b""` (seit f9a6029e, vor der Basis) |
| Aseprite-Frame `"__proto__"` | unverändert | `AsepriteJson.ts:489` `const frames: Record<…> = {}`, `:492` `frames[name] = …` |
| keine Texturklasse für `generateMipmaps` | unverändert | `TextureFactory.ts:58-145`; der Lookbook behilft sich in `MothChapel.ts:186-189` mit `panes.generateMipmaps = false` und einem Kommentar, der nach diesem Paket falsch wäre |

**Dazu (Zug 0, vorbestehend, gleiche Ursache wie das Clipping — die Pick-Szene legt die Pick-Meshes
flach ab und übernimmt aus den Vorfahren nur `visible`):** three sortiert die Render-Items zuerst nach
der `groupOrder`, der `renderOrder` der nächsten `Group` über dem Mesh, die die Kamera sieht
(`StandardDrawingPipeline.js:189-193`, `painterSortStable()` in `RenderList.js:14-34`), dann nach der
`renderOrder` des Meshes. Die Pick-Meshes liegen unter keiner Group, ihre `groupOrder` ist immer 0.
Bei gleicher Tiefe gewinnt im Pick (`depthFunc` `LessEqualDepth`) das später gezeichnete Mesh — der
Guide verspricht in `docs/sprites.md:1955-1957` »the sprite drawn later wins, as on the screen: … the
later mesh by `renderOrder`«, was für Meshes unter Groups mit eigener `renderOrder` nicht stimmt. An
d9b648bf ebenso (`scene.add(entry.mesh)` `:275`). Eine Ursache, ein Umbau: dieselbe nachgebaute
Vorfahrenkette trägt Clipping und Group-Order.

**Dazu (Zug 0, vorbestehend, gleiche Ursache wie `"__proto__"`):** `slicesAt()` baut die Slices eines
Frames als Literal `{}` (`AsepriteJson.ts:282`) und setzt `inForce[slice.name] = copy` (`:294`); eine
Slice namens `"__proto__"` verschwindet ebenso. An d9b648bf `:271`/`:279`. Die übrigen Literal-Records
unter `src/` (`SpriteResources.ts:158`, `defineSprite.ts:165`) sind nach Namen aus Feature-Definitionen
im Code geschlüsselt, nicht aus Daten — nicht dazu.

## Entscheidungen dieses Zugs

1. **Clipping und Group-Order über eine Kette je Pick-Eintrag, nicht über geteilte Spiegel.** Jeder
   Eintrag hält eine eigene Kette aus `ClippingGroup`-Spiegeln und einer `Group` (»Holder«), in der das
   Pick-Mesh liegt. Eine geteilte Spiegelstruktur je Quell-Group müsste nach jedem Pick die Kinder aller
   benutzten Spiegel räumen, sonst zeichnet der nächste Pick ein Mesh mit, das nicht in seiner Liste
   steht. Je Eintrag eine Kette: nur ihre Spitze liegt in der Szene, `#scene.clear()` räumt sie wie
   heute die Meshes. Die Spiegel sind feste Objekte, solange die Quelle dieselbe ist: three cacht den
   Clipping-Kontext je `ClippingGroup` in einer `WeakMap` (`ClippingContext#getGroupContext()`), ein
   neuer Spiegel je Pick gäbe jedem Pick einen neuen Kontext und einen neuen Cache-Key.
2. **Die Ebenen bleiben in Weltkoordinaten, der Spiegel teilt das Array der Quelle.** three projiziert
   die Ebenen jeder Group über die View-Matrix der Kamera (`ClippingContext#projectPlanes()`,
   `updateGlobal()` → `camera.matrixWorldInverse`), nicht über die Matrix der Group. Die Pick-Kamera
   trägt dieselbe `matrixWorldInverse` (`#aim()`), also clippt der Pick an denselben Ebenen. Clipping
   greift auch neben dem `outputNode` des Pick-Materials: `NodeMaterial#setup()` legt den Clipping-Knoten
   vor die Ausgabe (`materials/nodes/NodeMaterial.js:507`, `:533`).
3. **Nur, was three anwendet, wird gespiegelt:** eine Group, deren `layers` die Kamera nicht sieht, gibt
   weder Clipping noch Group-Order (`project()` prüft `object.layers.test(camera.layers)` vor beidem);
   eine `ClippingGroup` mit `enabled === false` kein Clipping, wohl aber ihre `renderOrder`
   (`isGroup`). Spiegel und Holder selbst gehen auf alle Layers (`layers.enableAll()`), damit sie unter
   jeder Kamera greifen.
4. **Der Slot wird vollständig geprüft, nicht nur auf einen Pass.** Ursache des Befunds ist, dass
   `#sync()` den Slot ungeprüft als Material der Sprites nimmt. Ein Material einer anderen Art und ein
   leerer oder fremder Slot (kein `FeatureSpritesMaterial`) scheitern heute an derselben Stelle mit
   einem `TypeError` ohne Subjekt (`material.resources` von `undefined`, oder »the resources handed in
   lack …« aus `FeatureSpritesMaterial`). Eine Prüfung, drei Meldungen, dieselben Bedingungen wie
   `resolveParts()` im Konstruktor von `FeatureSprites` (`FeatureSprites.ts:203-214`). Abgelehnt, nicht
   übersprungen: three zeichnet das Mesh mit dem Slot, der Pick kann es nicht nachzeichnen.
5. **Abweisen statt mit dem Pass zeichnen.** Ein Pick-Material mit `pass: material.pass` träfe das,
   was ein Pass-Material im Slot zeichnet; aber der Picker zeichnet laut TSDoc »only the sprites … not
   their passes«, und der Konstruktor von `FeatureSprites` weist dasselbe Material mit demselben Grund
   ab. Das Ziel im Plan sagt »abweisen«.
6. **`describeValue()` escaped wie ein JSON-String, plus die Zeichen, die JSON durchlässt.** Escaped
   werden `"`, `\`, jedes Steuerzeichen (`\p{Cc}`: C0, DEL, C1 — U+0085 ist in manchen Umgebungen ein
   Zeilenumbruch), U+2028, U+2029 und jedes einzelne Surrogat (`\p{Cs}` unter dem Flag `u`; ein
   vollständiges Paar bleibt ein Zeichen). Kurzformen `\"`, `\\`, `\b`, `\t`, `\n`, `\f`, `\r`, sonst
   `\uXXXX` mit vier kleinen Hex-Ziffern. Geschnitten wird vor dem Escapen: die 120 UTF-16-Einheiten
   zählen weiter den rohen String. In Node 26 nachgeprüft (Regex unten in Schritt 5).
   `JSON.stringify()` scheidet aus: es lässt U+2028/U+2029, DEL und C1 roh.
7. **Handgesetzte Anführungszeichen bleiben.** AGENTS.md erlaubt sie für Namen vom Typ `string`
   (233 Stellen `"${…}"` in 43 Dateien unter `src/` ohne Specs). Ein Sweep kippt die Regel und sprengt
   das Paket; der Satz »which writes the same« in AGENTS.md wird nach diesem Paket falsch und wird
   eingeschränkt (Schritt 5). Die verbleibende Mehrdeutigkeit handgesetzter Namen steht als neuer
   Nebenbefund mit `→ Rückfrage` in »Offene Befunde«.
8. **`defineProperty` statt `Object.create(null)` in `AsepriteJson`.** `frameData.slices` geht an den
   Aufrufer (`AsepriteFrameData.slices`, `docs/sprites.md:445` `data.slices['hitbox']`); ein Record ohne
   Prototyp verlöre `hasOwnProperty()`/`toString()`. `BitmapFont.frozenCopy()` (`src/text/BitmapFont.ts:107-128`)
   macht es ebenso. Für `frames` (nur an `TexturePackerJson.parse()` gereicht, das `Object.entries()`
   liest, `TexturePackerJson.ts:119`) derselbe Helfer, eine Regel für die Datei.
9. **Zwei Klassen `mipmaps`/`no-mipmaps`, Breite 500**, wie `flipy`/`no-flipy`. `nearest` schaltet die
   Mip-Stufen nicht mit ab: das änderte das Bild jeder heutigen `nearest`-Textur. Keine Seed-Vorgabe:
   eine Textur ohne Mipmap-Klasse behält ihren Wert, wie bei `wrapS`/`wrapT`.
10. **Der Lookbook zieht mit.** Der Kommentar `MothChapel.ts:186-188` (»No texture class writes
    generateMipmaps«) wird mit diesem Paket falsch; der Eintrag `panes` nimmt die Klasse, Zeile und
    Kommentar fallen. Paket 21 berührt `MothChapel.ts` nicht.
11. **CHANGELOG:** Picker-Ablehnung unter `Changed` neben dem Eintrag »`new FeatureSprites()` refuses a
    `material` built for a pass« (`CHANGELOG.md:56`), weil ein Pick, der mit einem Pass-Material im Slot
    bisher auflöste, jetzt ablehnt; die Klassen unter `Added`; Clipping/Group-Order, `writeText`,
    `describeValue()` und Aseprite unter `Fixed`. Nichts davon **BREAKING**, kein `!` im Commit.

## Vorgehen

Bei jedem Korrektheitsfehler zuerst der Regressionstest, rot sehen, dann der Fix; die roten Läufe
gehören in den Report. Fünf Fixes mit eigenem Test: Schritt 3 (Vitest und Browser), 4, 5, 6, 7.

### Schritt 1 — SpritePicker: die Pick-Szene baut die Vorfahren nach

In `packages/twopoint5d/src/sprites/SpritePicker.ts`:

1. Import aus `'three/webgpu'` um `ClippingGroup`, `Group` und `type Layers` ergänzen.
2. Neben `PickEntry`:

   ```ts
   /** The mirror of a ClippingGroup above the sprites, in the scene of the pick. */
   interface ClippingMirror {
     readonly source: ClippingGroup;
     readonly mirror: ClippingGroup;
   }
   ```

   `PickEntry` bekommt `readonly holder: Group` (TSDoc: the group the pick mesh lies in; it carries the
   group order three takes from the nearest group above the sprites) und `readonly clipping:
   ClippingMirror[]` (TSDoc: the mirrors of the ClippingGroups that clip the sprites, root first; the
   chain ends in {@link holder}).
3. Modulfunktion (nicht exportiert):

   ```ts
   // what three takes from the ancestors of a mesh as it projects the scene (three 0.187.0,
   // StandardDrawingPipeline#project()): every group the camera sees sets the group order of what
   // lies below it, the nearest one last, and every enabled ClippingGroup among them adds its
   // planes, root first. Fills `clipping` and answers the group order
   function readAncestry(object: Object3D, layers: Layers, clipping: ClippingGroup[]): number
   ```

   `clipping.length = 0`; Schleife `for (let node = object.parent; node != null; node = node.parent)`:
   `if (!node.layers.test(layers)) continue;` — `if ((node as Group).isGroup === true) groupOrder ??=
   node.renderOrder;` — `if ((node as ClippingGroup).isClippingGroup === true && (node as
   ClippingGroup).enabled) clipping.push(node as ClippingGroup);` Danach `clipping.reverse()` (in place)
   und `return groupOrder ?? 0`.
4. Modulfunktion `makeChainLink<T extends Group>(group: T): T` — setzt `name = 'twopoint5d.SpritePicker'`,
   `layers.enableAll()`, `matrixAutoUpdate = false`, `matrixWorldAutoUpdate = false` und gibt die Group
   zurück. Kommentar: only the groups the camera sees are mirrored, so a link applies under every camera;
   the scene of the pick keeps its matrices as they are, the groups carry none that counts — the planes
   are in world space and the pick mesh carries the world matrix of its sprites.
5. Feld `readonly #clippingScratch: ClippingGroup[] = []` neben `#spareHandles` (Kommentar: filled by
   readAncestry() for each mesh of a pick).
6. `#build()`: nach dem Mesh `const holder = makeChainLink(new Group()); holder.add(mesh);`, im Eintrag
   `holder` und `clipping: []`.
7. Neue Methode `#place(entry: PickEntry, sprites: FeatureSprites, camera: Camera): void`, TSDoc: Lays
   the chain of `entry` into the scene of the pick, under mirrors of the ClippingGroups above `sprites`
   and with their group order. Inhalt:
   - `const applied = this.#clippingScratch; const groupOrder = readAncestry(sprites, camera.layers,
     applied);`
   - `for (let i = 0; i < applied.length; i++) if (entry.clipping[i]?.source !== applied[i])
     entry.clipping[i] = {source: applied[i]!, mirror: makeChainLink(new ClippingGroup())};` danach
     `entry.clipping.length = applied.length;`
   - `let parent: Object3D = this.#scene;` — für jeden Spiegel: `mirror.clippingPlanes =
     source.clippingPlanes; mirror.clipIntersection = source.clipIntersection;` (Kommentar: the planes
     are shared, not copied — three reads them at every draw), `if (mirror.parent !== parent)
     parent.add(mirror); parent = mirror;`
   - `if (entry.holder.parent !== parent) parent.add(entry.holder); entry.holder.renderOrder =
     groupOrder;`
8. `#gather(list, drawn, camera)` bekommt die Kamera; `#pick()` reicht sie durch. In `#gather()` ersetzt
   `this.#place(entry, sprites, camera)` die Zeile `scene.add(entry.mesh)` (`:289`). Die Reihenfolge der
   Spitzen in der Szene bleibt die Reihenfolge der Liste.
9. `#release()`: `entry.mesh.removeFromParent()` wird `(entry.clipping[0]?.mirror ??
   entry.holder).removeFromParent();` (Kommentar: the chain stays linked; only its top lies in the
   scene). `entry.mesh.dispose()` und `entry.material.dispose()` bleiben.
10. TSDoc von `pick()` (`:186-214`): nach »Only the sprites are drawn, not their passes.« einfügen: »A
    mesh under a `ClippingGroup` is clipped in the pick as on the screen, and at one depth the mesh drawn
    later wins — by the `renderOrder` of the nearest group above it, then by its own, as three sorts
    them.« Der Kommentar über `isShown()` (`:132-133`) bleibt.

### Schritt 2 — SpritePicker: den `material`-Slot prüfen

1. Modulfunktion (nicht exportiert) neben `checkArguments()`:

   ```ts
   // the material three draws the mesh with, as the pick builds its own from it: the material of the
   // sprites, of their kind and without a pass — the conditions new FeatureSprites() puts on one
   function slotMaterialOf(sprites: FeatureSprites, k: number): FeatureSpritesMaterial
   ```

   Meldungen, alle `TypeError`, in dieser Reihenfolge geprüft:
   - kein `FeatureSpritesMaterial` (auch `undefined`): `` `${WHERE}: the entry ${k} of the list holds ${describeThreeValue(material, 'isMaterial')} in its material slot — the picker builds its pick material from the FeatureSpritesMaterial of the sprites` ``
   - `material.kind !== sprites.kind`: `` `${WHERE}: the entry ${k} of the list holds a material built for another sprite kind in its material slot` ``
   - `material.pass != null`: `` `${WHERE}: the entry ${k} of the list holds a material built for pass "${material.pass.name}" in its material slot — the picker draws the sprites themselves; put a material built without a pass there` ``
2. In `#gather()` nach der `MAX_SPRITES_PER_MESH`-Prüfung und vor `#sync()`: `const material =
   slotMaterialOf(sprites, k);`. Die Auslassung `sprites.material?.visible === false` (`:280`) bleibt
   davor: ein Mesh, das three nicht zeichnet, wird nicht geprüft.
3. `#sync(sprites, material, meshNumber)` nimmt das geprüfte Material; Zeile `:301-302` (»the mesh is not
   disposed … so it has its material«, `sprites.material!`) fällt.
4. `@throws` von `pick()` um »a `TypeError` for an entry whose material slot holds no
   `FeatureSpritesMaterial`, one of another kind or one built for a pass« ergänzen.

### Schritt 3 — Tests des Pickers

**Vitest, `packages/twopoint5d/src/sprites/SpritePicker.spec.ts`:**

- Mock `makeRenderer()` (`:68ff.`): `children` sammelt jedes Mesh unter der Szene in Traversal-Reihenfolge
  (`scene.traverse((node) => { if ((node as Mesh).isMesh === true) children.push(node); })`), neues
  Feld `tops: [...scene.children]` in `Rendered` (`:41`). Jede bestehende Lesestelle von `children`
  bleibt damit gültig; keine bestehende Erwartung ändert sich.
- Neues `describe('the ancestors of a mesh', …)`:
  1. `a mesh under ClippingGroups lies under a mirror of each that the camera sees and that is enabled, root first, with its planes and clipIntersection` — Quelle: `outer` (`clippingPlanes: [plane]`, `clipIntersection: true`) → `off` (`enabled = false`) → `hidden` (`layers.set(5)`) → Sprites. Prüfen am Pick-Mesh nach dem Pick: `mesh.parent` ist der Holder (`isClippingGroup` nicht gesetzt), dessen `parent` ein Spiegel mit `clippingPlanes` *identisch* (`toBe`) zu `outer.clippingPlanes` und `clipIntersection === true`, dessen `parent` `null` (nach `#scene.clear()`); `rendered[0].tops` ist `[dieser Spiegel]`.
  2. `the group of a pick mesh carries the renderOrder of the nearest group above the sprites that the camera sees, and 0 without one` — `Group` mit `renderOrder 3` über einer `Group` mit `renderOrder 7` auf Layer 5 über den Sprites → Holder `renderOrder 3`; Sprites direkt in der Szene → 0.
  3. `keeps its mirrors over picks and follows a mesh into another ClippingGroup and out of every one` — zwei Picks: derselbe Spiegel (`toBe`); Sprites in eine andere `ClippingGroup` umgehängt → neuer Spiegel mit deren Ebenen; aus jeder genommen → `tops` ist `[holder]`.
  4. `refuses an entry whose material slot holds a material built for a pass, one of another kind or none, naming the entry` — `sprites.material = new FeatureSpritesMaterial(kind, {pass, resources: sprites.material.resources})`, ein Material einer zweiten Art, `undefined`; je `rejects.toThrow(new TypeError(<Meldung aus Schritt 2>))`; danach mit dem ursprünglichen Material zurück im Slot ein Pick, der zeichnet. Rot vor dem Fix: kein Wurf bzw. ein Wurf mit anderer Meldung.

**Browser, `packages/twopoint5d-testing/test/sprites-picking.test.js`** (läuft unter WebGPU und WebGL 2;
Helfer der Datei — `makeSprites()`, `pointerAt()`, `makeFlatCamera()`, `release()` — weiterverwenden):

  5. `does not hit a sprite where a ClippingGroup above it clips it away, but what lies behind, and hits it where the plane keeps it` — vorderes Sprite unter einer `ClippingGroup` mit `new Plane(new Vector3(1, 0, 0), 0)` (behält `x > 0`), hinteres ohne; Pick links der Mitte → hinteres, rechts → vorderes. Rot vor dem Fix (links das vordere).
  6. `picks the mesh drawn later at one depth by the renderOrder of the group above it before its own` — zwei Meshes in einer Ebene, überlappend: A mit `renderOrder 1` unter einer `Group` mit `renderOrder 0`, B mit `renderOrder 0` unter einer `Group` mit `renderOrder 1`; three zeichnet B nach A, der Pick nennt B. Rot vor dem Fix (A).
  7. `builds nothing more over 50 picks of a mesh under a ClippingGroup` — wie der bestehende Test `:460`, `programs`/`uniformBuffers` nach dem ersten Pick stabil (hält den Spiegel-Cache aus Entscheidung 1).

### Schritt 4 — writeText erkennt Features am Namen

In `packages/twopoint5d/src/text/writeText.ts`:

1. `:50`: `const missing = REQUIRED.filter(([feature]) => !sprites.kind.features.some(({name}) => name ===
   feature.name)).map(([, name]) => name);` — Kommentar über `REQUIRED` (`:28`) ergänzen: judged by the
   name of the feature, as `requires` and the segment placement judge one: a copy such as
   `defineFeature({...QuadSize})` carries the same API. Die Meldung `:53` bleibt wörtlich.
2. TSDoc `@throws` von `writeText()` (`:131`) und `rewriteText()` (`:175`): »for sprites whose kind holds
   no feature named as `InstancePosition`, `QuadSize` or `AtlasFrame` — judged by the name, so a copy of
   one counts —, …« (Rest des Satzes wie heute).
3. `docs/text.md:174-176`: nach »… is refused with a `TypeError` before a sprite is created, naming
   every feature missing.« den Satz »The features are judged by name, so a copy such as
   `defineFeature({...QuadSize})` counts.« einfügen; der Rest des Absatzes bleibt.
4. `src/text/writeText.spec.ts`: `takes a kind whose features are copies of InstancePosition, QuadSize and AtlasFrame, judged by name` für `writeText` und für `rewriteText`; Kopien nach dem Muster von `src/sprites/features/segments.spec.ts:166-170`. Rot vor dem Fix (`lack the features …`).

### Schritt 5 — describeValue zitiert einen String escaped

In `packages/twopoint5d/src/utils/describeValue.ts`:

1. Neben `MAX_STRING_LENGTH`:

   ```ts
   // what would end the quotes, break the line or stand as half a char: a quote, a backslash, a control
   // char (C0, DEL, C1), a line or paragraph separator and a lone surrogate — a pair stays one char
   const ESCAPED = /["\\\p{Cc}  \p{Cs}]/gu;
   const SHORT_ESCAPES: ReadonlyMap<string, string> = new Map([
     ['"', '\\"'], ['\\', '\\\\'], ['\b', '\\b'], ['\t', '\\t'], ['\n', '\\n'], ['\f', '\\f'], ['\r', '\\r'],
   ]);
   const escapeChar = (char: string): string =>
     SHORT_ESCAPES.get(char) ?? `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
   ```

   (Formatierung nach Biome.) In `describeString()` (`:71-77`) beide Rückgaben über
   `value.replace(ESCAPED, escapeChar)` bzw. `value.slice(0, end).replace(ESCAPED, escapeChar)`; der Schnitt
   bleibt vor dem Escapen. Nachgeprüft in Node: `a "b"` → `"a \"b\""`, `a\nb` → `"a\nb"`, U+0007 →
   `"\u0007"`, U+007F → `"\u007f"`, U+0085 → `"\u0085"`, U+2028 → `" "`, U+D800 → `"\ud800"`,
   `x` U+DC00 `y` → `"x\udc00y"`, 😀 und `é` bleiben.
2. TSDoc von `describeValue()` (`:9-29`): nach »a string in double quotes (`"16"` is not `16`)« ergänzen
   », with a quote, a backslash, a control char, a line or paragraph separator and a lone surrogate
   escaped as in a JSON string (`"a\"b\n"`, `" "`), so that a quoted string stays on one line and
   ends at its closing quote«; der Satz zum Schnitt sagt dazu, dass die 120 Einheiten am rohen String
   gezählt werden. `describeKey()` nutzt `describeString()` und escaped damit Keys mit.
3. `describeValue.spec.ts:5-8`: Test umbenennen in `shows a string in double quotes, with a quote, a backslash, a control char, a line or paragraph separator and a lone surrogate escaped as in a JSON string` und mit den Fällen aus Punkt 1 füllen; neu `escapes a key of an object as it escapes a string` (`{'a"b': 1}` → `{"a\"b": 1}`) und `cuts a string short before it escapes it` (121 Einheiten mit `"` an Index 5: 120 rohe Einheiten, das `"` escaped, `…`). Rot vor dem Fix.
4. Specs, deren erwartete Meldung einen String mit diesen Zeichen roh zitiert, mitziehen (das Gate zeigt
   sie); das sind Tests gegen altes Verhalten, keine Nebenbefunde.
5. `AGENTS.md:132-138`: »it writes a string in double quotes« → »it writes a string in double quotes,
   with a quote, a backslash, a control char, a line or paragraph separator and a lone surrogate escaped
   as in a JSON string«; »(`"${name}"`), which writes the same.« → »(`"${name}"`), which writes the same
   for a name without a char `describeValue()` escapes.«

### Schritt 6 — AsepriteJson hält jeden Namen

In `packages/twopoint5d/src/texture/AsepriteJson.ts`:

1. Modulfunktion `setOwn<T>(record: Record<string, T>, key: string, value: T): void` mit
   `Object.defineProperty(record, key, {value, enumerable: true, writable: true, configurable: true})`;
   Kommentar: a key named __proto__ stays an entry of its own — defineProperty defines, an assignment
   would set the prototype — as `BitmapFont` keeps one.
2. `:294` `inForce[slice.name] = copy` → `setOwn(inForce, slice.name, copy)`; `:492` `frames[name] = {…}`
   → `setOwn(frames, name, {…})`.
3. `src/texture/AsepriteJson.spec.ts`: `keeps a frame named __proto__, in the layout "Hash" and in the layout "Array"` (Atlas kennt `__proto__`, `frameId('__proto__')` definiert, Daten mit `index`) und `keeps a slice named __proto__ in the slices of a frame` (`Object.hasOwn(data.slices, '__proto__')`, Prototyp von `data.slices` bleibt `Object.prototype`). Rot vor dem Fix.

### Schritt 7 — Texturklassen `mipmaps` und `no-mipmaps`

In `packages/twopoint5d/src/texture/TextureFactory.ts`:

1. `TextureOptions` (`:24-53`) bekommt nach `flipY`:

   ```ts
   /**
    * Whether three.js builds the mip levels of the texture. No class of the factory's seed writes it: a
    * texture without a mipmap class keeps what it has, `true` for a new one.
    */
   generateMipmaps: boolean;
   ```

2. `TextureClasses` nach `'no-flipy'`: `mipmaps: {generateMipmaps: true}`, `'no-mipmaps': {generateMipmaps:
   false}`; `TextureClassPriority` beide `500`.
3. `src/texture/TextureFactory.spec.ts`: `no-mipmaps turns the mip levels of a texture off, mipmaps on, and a texture without either keeps its own` (über `create()` und `update()`, Reihenfolge zweier gleich breiter Klassen: die zuletzt genannte gewinnt). Rot vor dem Fix (Typfehler bzw. `generateMipmaps` bleibt `true`). Falls `TextureStore.spec.ts` Katalog-Klassen einzeln prüft, dort ein Eintrag mit `texture: ['no-mipmaps']`.
4. `docs/textures.md` Tabelle (`:59-72`) nach der `flipy`-Zeile: `` | `mipmaps`, `no-mipmaps` | `generateMipmaps`, `true` or `false` | ``. Unter »Which classes a texture needs.« (`:76ff.`) ein Punkt: »A texture of data — ids, a palette, a lookup table — names `nearest` and `no-mipmaps`. three.js builds mip levels for every texture unless told otherwise; under WebGPU it reads a `nearest` texture drawn smaller from them (the sampler takes its `mipmapFilter` from `minFilter`), under WebGL 2 from level 0 alone. Without mip levels both read the texels as they are.« Beleg: `node_modules/three/build/three.webgpu.js:40911` (three 0.187.0).
5. `apps/lookbook/src/demos/stage-masks/MothChapel.ts`: Katalog-Eintrag `panes` (`:148`) `texture:
   ['nearest', 'no-mipmaps']`, der Kommentar darüber (`:146-147`) nennt den Grund aus `:186-188` (ids,
   neighbouring panes under WebGPU); `:186-189` (Kommentar und `panes.generateMipmaps = false`) fallen.

### Schritt 8 — Doku und CHANGELOG

1. `packages/twopoint5d/docs/sprites.md`, »Picking«:
   - Punkt »The nearest sprite wins« (`:1955-1959`): »the later mesh by `renderOrder`« → »the later mesh
     by the `renderOrder` of the nearest group above it, then by its own, as three sorts them«; dazu
     »A mesh under a `ClippingGroup` is clipped in its pick as on the screen: a click where the planes
     cut a sprite away lands on what lies behind.«
   - Satz `:1987-1988` »A camera, a pointer or a list of the wrong shape is refused …« um »and so is a
     mesh whose material slot holds a material the picker cannot draw from — none, one of another kind,
     one built for a pass«.
2. `packages/twopoint5d/docs/proposals/gpu-picking.md` (implementiert; nach `docs/proposals/README.md`
   »Reading an implemented proposal« sagen die Abschnitte, was gebaut ist, und die Abweichungsliste nennt
   jede Stelle, an der der Bau den Entwurf verlassen hat):
   - §3.2, nach »… `layers` and `renderOrder`.«: »Each pick mesh lies in a `Group` of its own, which
     carries the `renderOrder` of the nearest group above the sprites that the camera sees — three's
     group order —, under a mirror of every enabled `ClippingGroup` above the sprites that the camera
     sees, root first, which shares its `clippingPlanes` and `clipIntersection`: the pick clips and
     orders as the screen does. The planes lie in world space, and the camera of the pick has the view of
     the caller's camera.« Den Satz »`matrixAutoUpdate` and `matrixWorldAutoUpdate` are off on the mesh
     and the scene« um »and the groups« ergänzen.
   - §3.2, Absatz »A listed mesh is **left out** …«, angehängt: »A listed mesh whose material slot holds
     no `FeatureSpritesMaterial`, one of another kind or one built for a pass is **refused** with a
     `TypeError` that names its entry: the pick could not draw it as the screen does.«
   - Abweichungsliste, zwei Einträge am Ende: »the pick meshes lie under mirrors of the ClippingGroups
     above the sprites and in a group with their group order, so a pick clips and orders as the screen
     does (§3.2);« und »a mesh whose material slot holds no material of its kind without a pass is
     refused (§3.2);« (Satzzeichen der Liste angleichen: der letzte Eintrag endet mit Punkt).
3. `packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]` (Skill `updating-changelog`):
   - `Added`: die Texturklassen `mipmaps` und `no-mipmaps`, die `generateMipmaps` schreiben, und
     `TextureOptions#generateMipmaps`.
   - `Changed`, direkt nach `:56`: `SpritePicker#pick()` refuses a mesh whose material slot holds a
     material built for a pass, one of another sprite kind or none with a `TypeError` that names the
     entry — a pick drew the sprites of such a mesh through another graph than the screen.
   - `Fixed`: a pick of `SpritePicker` clips a mesh under a `ClippingGroup` as the screen does and,
     at one depth, orders meshes by the `renderOrder` of the nearest group above them first ·
     `writeText()`/`rewriteText()` take a kind whose `InstancePosition`, `QuadSize` or `AtlasFrame` is
     a copy, judged by name · a refused string in an error message is quoted with its quotes,
     backslashes, control chars, line and paragraph separators and lone surrogates escaped as in a
     JSON string, so it stays on one line and ends at its closing quote · `AsepriteJson.parse()` keeps a
     frame and a slice named `__proto__`.
   Kein Rückblick im Wortlaut (Konvention des Plans).

## Nicht anfassen

- Die 233 handgesetzten `"${…}"` unter `src/` (Entscheidung 7, Nebenbefund in »Offene Befunde«).
- `SpriteResources.ts:158`, `defineSprite.ts:165` (Namen aus dem Code, nicht aus Daten).
- Die Casts `uniform(0) as unknown as UniformNode<'float', number>` (`SpritePicker.ts:328`) und
  `… as unknown as Node` (`:340`): Paket 20.
- `Camcorder.ts:68`, `SoftBlobs.ts:81` im Lookbook: Texturen von Hand, ohne Store.
- Die Sortierung jenseits der Group-Order (Material-Id und Objekt-Id der Pick-Meshes): der Guide
  verspricht sie nicht.

## Findings im Volltext

Aus »Offene Befunde« von `./remediation-plan.md`, wörtlich:

**`packages/twopoint5d/src/sprites/SpritePicker.ts:118-125`/`:147`/`:260ff.` · low · aus Paket 9 (Zug 0)**
— `isShown()`, `#scene`, `#gather()` — die Pick-Meshes liegen in der Szene des Pickers, außerhalb jeder
`ClippingGroup`, unter der die Sprites liegen; three 0.187.0 clippt über die `ClippingGroup`-Vorfahren
eines Objekts, `isShown()` übernimmt von den Vorfahren nur `visible`, also trifft ein Pick ein Sprite,
wo der Draw es weggeclippt hat (nach Lesen des Codes, nicht ausgeführt); vorbestehend (an d9b648bf kein
`ClippingGroup` in der Datei).

**`packages/twopoint5d/src/sprites/SpritePicker.ts:288`/`:299` · low · aus Paket 9 (Zug 0)** —
`#sync()` — ein für einen Pass gebautes Material, das der Aufrufer in den `material`-Slot der Sprites
legt, wird beim Pick als Material der Sprites genommen: das Pick-Material entsteht ohne den Pass und
bekommt `material.placement` des Pass-Materials, das `checkPlacementStandIn()` beim ersten `pick()` ohne
Hinweis auf Slot oder Pass ablehnen kann; Paket 9 schließt nur den Konstruktor (`resolveParts()`), der
Slot gehört dem Aufrufer (nach Lesen des Codes, nicht ausgeführt); vorbestehend.

**`packages/twopoint5d/src/utils/describeValue.ts:71-77` · info · aus Paket 9 (Zug 0)** —
`describeString()` — setzt einen String roh zwischen doppelte Anführungszeichen: ein Zeilenumbruch, ein
`"` oder ein einzelnes Surrogat darin landet so in jeder Meldung, die ihn zitiert, und eine zitierte
Zeichenkette kann über Zeilen laufen oder wie zwei Werte aussehen — die Folge, die die Beschreibung von
CONS-011 den handgesetzten Anführungszeichen zuschreibt, bleibt nach dem Umstieg auf `describeValue()`;
eine Änderung dort berührt jede Meldung der Library; vorbestehend.

**`packages/twopoint5d/src/text/writeText.ts:50` · low · aus Paket 9 (Runde 0)** — `prepare()` — prüft
`InstancePosition`, `QuadSize` und `AtlasFrame` über Identität (`sprites.kind.features.includes(feature)`);
eine Kopie wie `defineFeature({...QuadSize})` mit derselben API wird als fehlend abgelehnt — Gegenrichtung
zur Namensprüfung der Segment-Placement; vorbestehend.

**`packages/twopoint5d/src/texture/AsepriteJson.ts:489-492` · low · aus Paket 11 (Runde 0)** — `frames`
ist ein Literal `{}`, gefüllt über `frames[name] = …`; ein Frame namens `"__proto__"` setzt den Prototyp
statt einen Frame anzulegen und verschwindet still (`BitmapFont.frozenCopy()` umgeht das mit
`defineProperty`); vorbestehend (an d9b648bf `:459`).

**`packages/twopoint5d/src/texture/TextureFactory.ts:58-145` · low · aus Paket 13b (Zug 0)** —
`TextureClasses` — keine Texturklasse schreibt `generateMipmaps`, ein Katalog-Eintrag kann die Mip-Stufen
seiner Textur nicht abschalten; three 0.187 erzeugt sie bei `generateMipmaps === true`
(`three.webgpu.js:10706`) und setzt unter WebGPU `mipmapFilter` aus `minFilter` (`:40911`, `NearestFilter`
→ `'nearest'`), also liest eine `nearest`-Textur bei Verkleinerung unter WebGPU aus Mip-Stufen, unter
WebGL 2 nicht; eine Id- oder Datentextur aus dem Store (`MothChapel` `panes`, Paket 13b) muss
`generateMipmaps` am geliehenen Objekt setzen (nach Lesen des Codes, nicht ausgeführt); vorbestehend (an
d9b648bf dieselbe Klassenliste ohne `generateMipmaps`).

## Review

Urteil des Reviewers (`paket-19.review-0.json`, Runde 1 gezielt `paket-19.review-1.json`):

| Stelle | Urteil | Fundstelle |
| --- | --- | --- |
| SpritePicker ignoriert `ClippingGroup` | behoben | `readAncestry()` `SpritePicker.ts:161` (Layers-Test vor Group-Order und Clipping, nur `enabled`, Wurzel zuerst, gegen `StandardDrawingPipeline.js:182-197`), `#place()` `:378`, `#release()` `:452`; Specs `SpritePicker.spec.ts` »the ancestors of a mesh«, Browser `sprites-picking.test.js:132ff.`/`:168ff.` |
| Pass-Material im `material`-Slot | behoben | `slotMaterialOf()` `SpritePicker.ts:595`, gerufen in `#gather()` `:336`; drei Meldungen; `gpu-picking.md` §3.2 und §5 (`:279-285`) |
| `writeText` prüft Features über Identität | behoben | `writeText.ts:52`, Tests für `writeText` und `rewriteText` mit `CopiedKind` |
| `describeString()` zitiert roh | behoben | `describeValue.ts:9-24` (`ESCAPED`, `escapeChar`), `:88`, `:93`; geschnitten vor dem Escapen |
| Aseprite-Frame `"__proto__"` | behoben | `setOwn()` `AsepriteJson.ts:498`, Layouts »Hash« und »Array« getestet |
| keine Texturklasse für `generateMipmaps` | behoben | `TextureFactory.ts:114-119`, Breite `:211-212`, `TextureOptions#generateMipmaps`; `MothChapel.ts:149` nimmt die Klasse |
| Dazu: Group-Order der Pick-Szene | behoben | Holder trägt die `renderOrder` der nächsten sichtbaren Group (`SpritePicker.ts:378ff.`), Browser `sprites-picking.test.js:148` |
| Dazu: Slice `"__proto__"` | behoben | `setOwn(inForce, …)` `AsepriteJson.ts:300` |

Abweichungen des Implementierers (angenommen): `#place()` nimmt einen Spiegel, dessen `ClippingGroup` nicht mehr clippt, per `removeFromParent()` aus der Kette; die Erwartung in `SpritePicker.spec.ts:569` lautet `pickMesh.parent?.parent` ist `null` (das Pick-Mesh liegt dauerhaft im Holder); U+2028/U+2029 als `\u2028`/`\u2029` geschrieben; `TextureStore.spec.ts` unverändert; CHANGELOG-Nachsatz (Schritt 8.3) in Runde 1 auf »— the pick cannot draw such a mesh as the screen does« geändert, weil der vorgegebene Wortlaut zurückblickte und nur für das Pass-Material stimmte.

Kleine Befunde (lösen keine Runde aus):

- `packages/twopoint5d/docs/proposals/gpu-picking.md:279-281` »Ownership« nennt Holder-Group und `ClippingGroup`-Spiegel je Eintrag nicht (keine GPU-Ressourcen, Aufzählung trotzdem unvollständig).
- `packages/twopoint5d/docs/textures.md:101-103` »What is left alone« nennt nur die Wrap-Werte; `generateMipmaps` verhält sich ebenso (steht im TSDoc, nicht im Guide).
- `AGENTS.md:140` — »A three.js object refused for its class is named« steht nach dem Umbruch als halbe Zeile mitten im Absatz (kosmetisch).
- `packages/twopoint5d/src/text/writeText.ts:28-30` — der Kommentar spricht von »the names they are exported under« und direkt danach von »the name of the feature«; welcher Name wofür da ist, verwischt.
