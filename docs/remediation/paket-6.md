# Paket 6 — FeatureSprites: Sprite-API und Pass-Meshes arbeiten auf derselben Geometry

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Drain-Paket aus »Offene Befunde«, keine Audit-Findings) · Nebenbefund medium aus
  Paket 4: Sprite-API und Pass-Meshes arbeiten nach einem Tausch des `geometry`-Slots auf
  verschiedenen Geometries · mitgenommen, gleiche Ursache: Nebenbefund low aus Paket 4,
  `#warnFull()` nennt die falsche Geometry
- Ziel: Nach einem Tausch des `geometry`-Slots zeichnen Mesh und Pässe dieselben Sprites, die
  `createSprite()`/`freeSprite()`/`sortBy()`/`spritePool` verwalten, und die Meldung einer vollen
  Geometry nennt die Geometry, die tatsächlich voll ist.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`
  - `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.spec.ts`
  - `packages/twopoint5d/src/sprites/SpritePicker.ts` (nur ein Kommentar)
  - `packages/twopoint5d-testing/test/sprites-grow.test.js`
  - `packages/twopoint5d/docs/sprites.md`
  - `packages/twopoint5d/docs/proposals/fade-flash-axis-billboards.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Weg (Zug 0 entschieden): **Die Pass-Meshes ziehen dem `geometry`-Slot nach.** Der Slot ist die
  Geometry der Sprites: das Mesh zeichnet sie, jedes Pass-Mesh zeichnet sie, und `createSprite()`,
  `freeSprite()`, `sortBy()`, `sortByViewDepth()` und `spritePool` arbeiten auf ihrem Pool — wie
  sie es heute schon tun. Gründe:
  1. Die Alternative — Sprite-API und Pässe sprechen konsequent die gebaute bzw. übergebene
     Geometry an — erfüllt das Ziel nicht: das Mesh selbst zeichnet immer den Slot, nach einem
     Tausch also andere Sprites als die, die die API verwaltet. Beim Material ist das anders: ein
     getauschtes Material ändert nur, *wie* dieselben Sprites gezeichnet werden; eine getauschte
     Geometry *sind* andere Sprites.
  2. Die API liest den Slot schon (`FeatureSprites.ts:307`, `:327`, `:383`, `:400`, `:420`),
     `VertexObjects#update()` lädt den Slot hoch, und `SpritePicker#sync()` folgt dem Slot schon
     (`SpritePicker.ts:218`, `:270`). Nur die Pass-Meshes bleiben zurück — der kleinste Eingriff,
     der alles auf eine Geometry bringt.
  3. Der dokumentierte Vertrag bleibt: der Slot ist tauschbar, was dort steht, gehört dem
     Aufrufer (`docs/sprites.md`, »Ownership«; Entscheidung zum `material`-Slot im Plan), und
     `dispose()` released `#builtGeometry` wie gehabt.
  Keine Kind-Prüfung im Setter: der `material`-Slot hat keine, der Typ verlangt schon
  `FeatureSpritesGeometry<Api>`, und eine neue Ablehnung läge außerhalb dieses Pakets.
- Vorgehen:
  1. **`FeatureSprites.ts` — der `geometry`-Slot als Accessor der Instanz.**
     - Neues privates Feld neben `#builtGeometry` (`:226`):
       ```ts
       // the geometry in the slot, behind the accessor the constructor puts on the instance
       #slotGeometry: FeatureSpritesGeometry<Api> | undefined;
       ```
     - Im Konstruktor direkt nach den Feldzuweisungen hinter `super(geometry, material)`
       (nach `this.name = 'twopoint5d.FeatureSprites';`, `:268`) und **vor** dem `try`, das die
       Pässe baut:
       ```ts
       this.#slotGeometry = geometry;
       // three's Mesh writes and reads the slot inside its own constructor, before the private fields
       // of this class exist, so the accessor that lets the pass meshes follow the slot goes onto the
       // instance here rather than onto the prototype
       Object.defineProperty(this, 'geometry', {
         configurable: true,
         enumerable: true,
         get: () => this.#slotGeometry,
         set: (geometry: FeatureSpritesGeometry<Api> | undefined) => this.#putGeometry(geometry),
       });
       ```
       Kein `get geometry()`/`set geometry()` im Klassenkörper: TypeScript lehnt einen Accessor
       über der Property `geometry` von `Mesh` ab (TS2611), und `Mesh` (three 0.186,
       `src/objects/Mesh.js:67` und `:106`/`:139`) schreibt und liest den Slot im eigenen
       Konstruktor, bevor die privaten Felder existieren — ein Prototyp-Accessor würfe dort einen
       `TypeError`. `declare geometry` (`:213`) bleibt, wie es ist.
     - Neue private Methode, etwa hinter `#warnFull()`:
       ```ts
       // the geometry in the slot is the geometry of the sprites: the mesh and every pass mesh draw it,
       // and createSprite(), freeSprite(), sortBy(), sortByViewDepth() and spritePool work on its pool
       #putGeometry(geometry: FeatureSpritesGeometry<Api> | undefined): void {
         this.#slotGeometry = geometry;
         for (const mesh of Object.values(this.#passes)) {
           // undefined only while the slot is empty, when the mesh itself cannot be drawn either
           mesh.geometry = geometry as FeatureSpritesGeometry<Api>;
         }
       }
       ```
       Den Typ von `FeatureSpritesPass#geometry` **nicht** auf `| undefined` weiten — das wäre
       eine Typänderung der öffentlichen Klasse.
     - `#grow()`: die Zeile `for (const mesh of Object.values(this.#passes)) mesh.geometry = grown;`
       (`:354`) entfällt, `this.geometry = grown` (`:353`) zieht die Pässe über den Setter mit.
       Den Kommentar darüber (`:351–352`) um den Halbsatz ergänzen, dass das Schreiben des Slots
       jedes Pass-Mesh mitnimmt.
     - `dispose()`: `this.geometry = undefined;` (`:623`) bleibt; der Setter findet dort ein
       leeres `#passes` vor (`:612`). Nichts zu ändern.
     - `#warnFull()` (`:368–379`): die Bedingung wird `this.geometry === this.#builtGeometry`
       statt `this.#builtGeometry !== undefined`. Erster Zweig unverändert
       (`Give the sprites a larger capacity — new FeatureSprites(kind, {capacity: ${larger}})`),
       zweiter Zweig neu:
       `` `Build the FeatureSpritesGeometry in the geometry slot with a larger capacity — new FeatureSpritesGeometry(kind, {capacity: ${larger}})` ``.
       Kommentar davor: voll ist die Geometry im Slot — gebaut, übergeben oder vom Aufrufer
       hineingesetzt; nur die gebaute wächst mit der Kapazität der Sprites.
     - TSDoc:
       - `declare geometry` (`:208–212`) neu: »The geometry the sprites draw — `undefined` once
         disposed. Under `grow` a growth replaces it with a larger one and disposes the old one:
         read it from the mesh afresh. A geometry the caller puts into this slot stays the
         caller's, and it is the geometry of the sprites from then on: the mesh and every pass mesh
         draw it, and `createSprite()`, `freeSprite()`, `sortBy()`, `sortByViewDepth()` and
         `spritePool` work on its pool. A handle of the geometry before stays with that one, and
         `freeSprite()` leaves it alone.«
       - Klassen-TSDoc (`:198–206`): hinter »… a material or a geometry the caller puts into a
         slot later.« den Satz »A geometry put into the `geometry` slot is the geometry of the
         sprites from then on, for the mesh, every pass and the sprite API alike.«
       - `FeatureSpritesPass` (`:39–43`): »over the same geometry« wird »over the geometry of the
         sprites — it follows a geometry put into their `geometry` slot —«.
  2. **`SpritePicker.ts:269`** — nur der Kommentar: »a growth, or a geometry the caller puts into
     the slot, gives the sprites a new geometry, which three follows by its id«. Kein Code.
  3. **Regressionstests zuerst, rot sehen** (`pnpm nx test twopoint5d -- src/sprites/FeatureSprites/FeatureSprites.spec.ts`
     vor dem Fix; die Ausgabe des roten Laufs gehört in den Report):
     - In `FeatureSprites.spec.ts` ein neuer Block `describe('another geometry in the slot', …)`
       direkt hinter `describe('another material in the slot', …)` (`:982`). `TexturedSpriteKind`
       zum bestehenden Import aus `'../presets.js'` (`:23`) dazunehmen.
       - `test('every pass mesh draws a geometry put into the slot, and the geometry put back', …)`:
         `new FeatureSprites(TexturedSpriteKind, {capacity: 2, passes: [ShadowPass, ReflectionPass]})`,
         `built = sprites.geometry!`, `other = new FeatureSpritesGeometry(TexturedSpriteKind, 4)`;
         `sprites.geometry = other` → jedes `Object.values(sprites.passes)`-Mesh hat
         `geometry` `toBe(other)`; `sprites.geometry = built` → jedes `toBe(built)`; danach
         `sprites.dispose()`, `other.dispose()`.
       - `test('createSprite(), freeSprite(), sortBy() and spritePool work on the pool of the geometry the passes draw', …)`:
         Sprites mit `passes: [ShadowPass]`, `other` mit Kapazität 4 in den Slot; zwei Sprites
         per `createSprite()`, `a.setPosition(0, 2, 0)`, `b.setPosition(0, 1, 0)`; erwartet
         `sprites.spritePool` `toBe(other.instancedPool)`, `other.instancedPool.usedCount` 2,
         `sprites.sortBy('y')` `true` und danach `other.instancedPool.getVO(0)` `toBe(b)`,
         `sprites.freeSprite(a)` → `usedCount` 1, und `sprites.passes['shadow']!.geometry`
         `toBe(other)` — die letzte Erwartung ist vor dem Fix rot.
     - Im Block `describe('a full pool', …)`:
       - neu `test('names the geometry put into the slot as the one to build larger', …)`:
         `new FeatureSprites(kind, {capacity: 2})`, `other = new FeatureSpritesGeometry(kind, 3)`
         in den Slot, viermal `createSprite()`; `warn.mock.calls[0]![0]` enthält
         `'Build the FeatureSpritesGeometry in the geometry slot with a larger capacity — new FeatureSpritesGeometry(kind, {capacity: 6}) —'`.
         Danach `sprites.dispose()`, `other.dispose()`. Vor dem Fix rot (die Meldung rät zu
         `new FeatureSprites(kind, {capacity: 6})`).
       - der bestehende Test `'names the geometry handed in as the one to build larger'` (`:130–140`)
         erwartet jetzt dieselbe neue Formulierung (`… in the geometry slot …`, Kapazität 6).
     - `FeatureSprites.grow.spec.ts` bleibt; `'the passes draw the new geometry, and their materials stay what they were'`
       (`:113`) bewacht die entfallene Schleife in `#grow()`.
     - `src/sprites/**` steht in `packages/twopoint5d/vite.config.ts:64` auf 100 % für
       statements, branches, functions und lines: Getter, Setter, `#putGeometry()` und beide
       Zweige von `#warnFull()` müssen von Specs erreicht werden — die Tests oben tun das.
  4. **Browser-Test** in `packages/twopoint5d-testing/test/sprites-grow.test.js` (dort liegen
     `TintedKind`, `SPRITES`, `rgbAtX` und die Spiegelebene x = 0 schon; kein neuer Helper in
     zwei Dateien). Das `describe` heißt danach
     `'sprites — another geometry under the mesh: growth and the geometry slot'`. `FeatureSpritesGeometry`
     aus `'@spearwolf/twopoint5d'` importieren. Neuer Fall
     `it('a geometry put into the slot is drawn by the mesh and by its pass, and the geometry it took the place of by neither', …)`
     nach dem Muster des bestehenden Falls: `FeatureSprites(TintedKind, {capacity: 2, textures: {colorMap}, uniforms: {mirrorPlane: [1, 0, 0, 0], reflectionColor: [1, 1, 1, 1]}, passes: [ReflectionPass]})`
     ohne `grow`, die ersten beiden `SPRITES` anlegen, `update()`, rendern (`before`); dann
     `other = new FeatureSpritesGeometry(TintedKind, 4)`, `sprites.geometry = other`, die
     übrigen drei `SPRITES` über `sprites.createSprite()` anlegen, `update()`, rendern (`after`).
     Erwartet: in `before` die ersten beiden an `x` und gespiegelt an `-x`; in `after` die
     letzten drei an `x` **und** an `-x`, an den Stellen der ersten beiden (`x` und `-x`)
     schwarz. Aufräumen: `sprites.dispose()`, `other.dispose()`, `colorMap.dispose()`. Vor dem
     Fix fehlen in `after` die Spiegelbilder der letzten drei, und die der ersten beiden stehen
     noch da.
  5. **Docs**:
     - `packages/twopoint5d/docs/sprites.md:1548–1550`: »or for the `FeatureSpritesGeometry`
       handed in« wird »or for the `FeatureSpritesGeometry` in the `geometry` slot — handed in or
       put there later«.
     - `docs/sprites.md`, Absatz **Ownership.** (`:1591–1601`): hinter »… and lets go of the
       other.« zwei Sätze, die sagen: eine in den `geometry`-Slot gesetzte Geometry ist von da an
       die Geometry der Sprites — Mesh und jedes Pass-Mesh zeichnen sie, `createSprite()`,
       `freeSprite()`, `sortBy()`, `sortByViewDepth()` und `spritePool` arbeiten auf ihrem Pool,
       ein Handle der Geometry davor bleibt bei jener; ein in den `material`-Slot gesetztes
       Material dagegen ändert nur, wie das Mesh zeichnet. Danach der bestehende Satz
       »`placement`, `uniforms`, … whatever the slot holds; …« unverändert.
     - `docs/sprites.md`, »Passes: shadows and reflections«, Regel **Ownership.**
       (`:2169–2174`): ein Satz, dass die Pass-Meshes die Geometry im `geometry`-Slot der Sprites
       zeichnen und einer dort hineingesetzten folgen, wie sie einer Growth folgen.
     - `packages/twopoint5d/docs/proposals/fade-flash-axis-billboards.md:258–259` (Bullet
       »a geometry handed in: …«): wird »a geometry in the slot the mesh did not build — handed in
       or put there later: the same, with `Build the FeatureSpritesGeometry in the geometry slot
       with a larger capacity — new FeatureSpritesGeometry(kind, {capacity: <2 · capacity>}) —`
       as the fix.« Der Bullet davor (»a geometry the mesh built«) bleibt.
     - `packages/twopoint5d/docs/resource-lifecycle.md` bleibt: der Besitz ändert sich nicht.
  6. **`packages/twopoint5d/CHANGELOG.md`, `## [Unreleased]`** (Skill `updating-changelog`):
     - `### Added`, Eintrag der Voll-Warnung (`:14`): »or for the `FeatureSpritesGeometry` handed
       in« wird »or for the `FeatureSpritesGeometry` in the `geometry` slot, handed in or put
       there later« — der Eintrag ist unveröffentlicht.
     - `### Fixed`, neuer Eintrag hinter dem `FeatureSprites#dispose()`-Eintrag (`:87`): »the pass
       meshes of `FeatureSprites` draw the geometry in the `geometry` slot and follow a geometry
       the caller puts there, so the mesh and every pass draw the sprites that `createSprite()`,
       `freeSprite()`, `sortBy()`, `sortByViewDepth()` and `spritePool` work on«.
     - Kein Migration-Guide-Abschnitt: keine Signatur ändert sich, und Pässe, die eine Geometry
       zeichnen, die niemand mehr schreibt und `update()` nicht mehr hochlädt, sind kein
       Verhalten, auf das jemand baut.
- Verify: `pnpm run ci`
- Commit: `fix(sprites): FeatureSprites passes draw the geometry in the slot, and a full pool names the geometry that is full`
- Verlauf:
  - 2026-10-21 Zug 0: Detailplan steht · Nebenbefund medium (Sprite-API vs. Pass-Meshes)
    unverändert, Fundstellen `FeatureSprites.ts:279`, `:353–354`, Slot-Leser `:307`, `:327`,
    `:383`, `:400`, `:420` · Nebenbefund low `#warnFull()` unverändert bei `:368–379`, Bedingung
    `:372` · Weg: Pass-Meshes ziehen dem Slot nach (Accessor auf der Instanz) · `SpritePicker.ts`
    folgt dem Slot schon (`:218`, `:270`), nur Kommentar · keine offenen Folgen zu verteilen ·
    Restplan unverändert, nach Paket 6 der Abschluss
  - 2026-10-21 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief
    `paket-6.impl-brief.txt`, Report `paket-6.impl-0.json`
  - 2026-10-21 Zug 2: Report FERTIG · geändert: `FeatureSprites.ts`, `FeatureSprites.spec.ts`,
    `SpritePicker.ts`, `sprites-grow.test.js`, `docs/sprites.md`,
    `docs/proposals/fade-flash-axis-billboards.md`, `CHANGELOG.md` · rot vor dem Fix: 4 Unit-Tests,
    1 Browser-Test · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-6.verify.log`)
  - 2026-10-21 Zug 3: Reviewer beauftragt (opus, effort medium), Diff `paket-6.diff`, Report
    `paket-6.review-0.json`
  - 2026-10-21 Zug 3: Urteil — beide Nebenbefunde behoben, drei kleine Befunde, keiner
    kritisch oder wichtig · Diff `paket-6.diff`
  - 2026-10-21 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-10-21 Zug 5: committet dbc69f47, Verify `paket-6.verify.log` exit=0, 0 Runden

## Urteil des Reviewers

- **Sprite-API vs. Pass-Meshes (medium)** — behoben. Accessor auf der Instanz
  `FeatureSprites.ts:275–284`, `#putGeometry()` `:399–408`, `#grow()` schreibt nur den Slot
  `:368–370`, `dispose()` trifft auf leeres `#passes` (`:640` vor `:651`). Specs
  `FeatureSprites.spec.ts:1023–1066`, Browser-Test `sprites-grow.test.js:126–157`.
- **`#warnFull()` (low)** — behoben. Bedingung `this.geometry === this.#builtGeometry`
  (`FeatureSprites.ts:389–392`), Specs `FeatureSprites.spec.ts:129–153`.

Kleine Befunde (lösen keine Runde aus):
- `FeatureSprites.ts:41` — TSDoc-Zeile zu `FeatureSpritesPass` 155 Zeichen (`lineWidth` 130), Biome
  umbricht Kommentare nicht.
- `docs/sprites.md:1600` und `:2177` — eingefügte Sätze stehen außerhalb des Absatzumbruchs
  (≈ 140–148 Zeichen gegen ≈ 100).
- `FeatureSprites.spec.ts:1046` — `sortByViewDepth()` auf der eingesetzten Geometry ohne eigene
  Erwartung, obwohl TSDoc, Doku und CHANGELOG sie nennen (liest denselben Slot).

Folgen laut Implementierer, beide ohne neuen Eintrag: das Pick-Mesh des `SpritePicker` hält die
alte Geometry bis zum nächsten Pick (RES-005, low, schon im Audit, siehe »Nicht mitgenommen«);
ein vom Aufrufer auf `undefined` gesetzter Slot setzt auch die Pass-Meshes auf `undefined` — das
Mesh selbst ist dann ebenso nicht zeichenbar, vom Detailplan so vorgesehen.

## Abgleich

- **Sprite-API vs. Pass-Meshes (medium, aus Paket 4)** — unverändert. Die Pass-Meshes bekommen
  ihre Geometry nur im Konstruktor (`FeatureSprites.ts:279`, `new FeatureSpritesPass(geometry, …)`)
  und in `#grow()` (`:354`). `spritePool` (`:307–309`), `createSprite()` (`:326–334`),
  `freeSprite()` (`:382–384`), `sortBy()` (`:399–403`) und — im Eintrag nicht genannt, gleiche
  Ursache — `sortByViewDepth()` (`:419–421`) lesen den Slot. `VertexObjects#update()`
  (`src/vertex-objects/VertexObjects.ts`, `update()`) lädt nur die Geometry im Slot hoch. Nach
  `sprites.geometry = other` zeichnen die Pässe also eine Geometry, die keine Methode mehr
  schreibt und kein `update()` mehr hochlädt. Vorbestehend: `git show 7fee62de:…/FeatureSprites.ts`
  baut die Pässe bei `:265` über die Konstruktor-Geometry, die Slot-Leser stehen bei `:294`,
  `:312`, `:361`, `:378`, `:398`.
- **`#warnFull()` (low, aus Paket 4)** — unverändert bei `:368–379`. Die Bedingung
  `this.#builtGeometry !== undefined` (`:372`) fragt, ob die Sprites eine Geometry gebaut haben,
  nicht, ob die volle die gebaute ist; mit einer gebauten Geometry und einer eingesetzten im Slot
  rät die Meldung zu `new FeatureSprites(kind, {capacity})`, voll ist aber die eingesetzte.
  Gleiche Ursache wie oben (die Sprites behandeln die gebaute Geometry als »ihre«, wo der Slot
  gilt) — deshalb in diesem Paket.
- **`SpritePicker.ts`** (im Bereich des Plans) — liest `sprites.spritePool` (`:218`) und
  `sprites.geometry` (`:270`, `:293`), folgt dem Slot also schon bei jedem Pick. Keine
  Codeänderung, nur der Kommentar `:269`.

## Triage

- `Folgen:` der erledigten Pakete: Paket 1, 2, 4, 5 `—`; Paket 3 ist an Paket 5 verteilt und dort
  erledigt (0e133345). Nichts zu verteilen.
- »Offene Befunde«: die beiden `FeatureSprites`-Einträge gehören diesem Paket (Drain,
  2026-10-21). Die übrigen offenen Einträge — `AdaptiveResolution.ts:211`, `:266`, `:74`,
  `makeTopDownCamera()` in den map2d-Specs, `docs/architecture.md:160–162` — haben andere
  Ursachen und bleiben für den Abschluss; ihre Urteile (`→ Audit`) stehen.

## Nicht mitgenommen

- **RES-005 (low, Audit)** — das Pick-Mesh des `SpritePicker` hält nach einer Growth die alte
  Geometry bis zum nächsten Pick fest; nach einem Slot-Tausch gilt dasselbe. Eigene Ursache (der
  Picker gleicht erst in `#sync()` ab, `SpritePicker.ts:270`), schon als Finding im Audit, unter
  der Scope-Regel (low). Kein Event `geometrychange` in diesem Paket.
- Eine Kind-Prüfung im Setter des Slots — Begründung beim Weg oben.

## Findings im Volltext

**Nebenbefund · medium · `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts`
(`createSprite()`, `freeSprite()`, `sortBy()`, `spritePool`)** — arbeiten auf der Geometry im Slot,
die Pass-Meshes zeichnen die gebaute; nach `sprites.geometry = other` zeichnen Mesh und Pässe
verschiedene Sprites, dieselbe Divergenz, die das Audit für das Material als medium führte (aus
Paket 4, → Scope).

**Nebenbefund · low · `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:368`** —
`#warnFull()` rät bei einer vom Aufrufer in den `geometry`-Slot gesetzten, vollen Geometry zu
»a larger capacity — new FeatureSprites(…)«, voll ist aber die eingesetzte (aus Paket 4,
→ Audit; mitgenommen wegen gleicher Ursache).

Zum Vergleich das Audit-Finding, an dem die Entscheidung zum `material`-Slot hing:

**RES-001 · medium · `packages/twopoint5d/src/sprites/FeatureSprites/FeatureSprites.ts:599`**
(erledigt in Paket 4, fd3f7540) — `FeatureSprites` merkt sich nur die Flags
`#ownsMaterial`/`#ownsGeometry`, released in `dispose()` aber das, was gerade in den öffentlich
beschreibbaren three-Slots `material`/`geometry` steht. […] Zusätzlich lesen die Pass-Materialien
weiter die alten Resources, während `setUniform()`/`bindUniform()` ins neue Material schreiben.
Empfehlung: Das gebaute Material und die gebaute Geometry in privaten Feldern halten und in
`dispose()`/`#grow()` genau diese releasen. Außerdem entscheiden, ob der Material-Slot tauschbar
sein soll: wenn nicht, `material` als Accessor mit TypeError beim Setzen ausführen (und den
Tausch-Pfad im Picker streichen); wenn ja, Pässe und Bindings beim Tausch nachziehen und das in
`docs/sprites.md` festhalten. Einen Test ergänzen, der nach einem Tausch ohne Zurücktauschen
disposed.
