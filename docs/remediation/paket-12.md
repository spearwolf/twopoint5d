# Paket 12 — DynamicAtlas: Zellen wiederverwenden, nur geänderte Bereiche hochladen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-009 (low), PERF-010 (low), CONS-006 (low)
- Ziel: Der `DynamicAtlas` belegt freigegebene Zellen neu und lädt beim Redraw nur die geänderten
  Rechtecke hoch; das Proposal beschreibt den Fall eines kaputten Bildes ohne `size`.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/texture/DynamicAtlas.ts`
  - `packages/twopoint5d/src/texture/DynamicAtlas.spec.ts`
  - `packages/twopoint5d-testing/test/texture-dynamic-atlas.test.js`
  - `packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md` (§3.1, §3.3, §3.4, §3.5,
    §3.6, §3.7, §8)
  - `packages/twopoint5d/docs/proposals/sprite-and-texture-roadmap.md` (§4.11, eine Zeile)
  - `packages/twopoint5d/docs/sprites.md` (Abschnitt »Atlases built at run time: `DynamicAtlas`«,
    Z. 422–497)
  - `packages/twopoint5d/CHANGELOG.md` (`[Unreleased]`, der `Added`-Eintrag zu `DynamicAtlas`, Z. 35)
  - `apps/lookbook/src/demos/ui-panels/DungeonScreen.ts`, `apps/lookbook/src/pages/demos/ui-panels.astro`
- Verify: `pnpm run ci`
- Commit: `perf(texture): pack a frame of a DynamicAtlas into the cell a removed one gave back, copy only the changed cells into its texture through upload(renderer) once that is called before each render, and say that an image that failed to load is refused without a size and makes drawImage() throw with one`
- Verlauf:
  - 2026-10-22 Zug 0: Detailplan steht · PERF-009 unverändert, gewandert (`remove()` jetzt
    `DynamicAtlas.ts:317–335`, »The cell is not reused« `:319`; `#pack()` `:401–450`) · PERF-010
    unverändert, gewandert (`needsUpdate` in `add()` `:277`, `redraw()` `:312`, `remove()` `:333`,
    `clear()` `:348`; Klassen-TSDoc `:101–103`; Mipmap-Kommentar `:180`) · CONS-006 unverändert an
    `dynamic-atlas-and-bitmap-text.md:210` — der Satz steht in §3.5, nicht in §3.2, wie das Audit
    schreibt; gleiche Ursache aufgenommen: TSDoc `add()` `DynamicAtlas.ts:248–249`, Kommentar
    `:452–457`, `docs/sprites.md:477–479` · Folgen offen: keine (alle `Folgen:` der Pakete 1–11 sind
    »keine«) · aus »Offene Befunde« nichts übernommen: kein Eintrag teilt die Ursache dieses Pakets ·
    Restplan unverändert · Erwartungswerte der Tests 1–8 und der zwei mitgezogenen `remove()`-Tests
    an einer Simulation des spezifizierten Packers geprüft (Test 6 heute nach Runde 4 voll)
  - 2026-10-22 Zug 1: Implementierer beauftragt (Runde 0, stärkste Stufe `claude-opus-5-5`, effort high),
    Report nach `paket-12.impl-0.json`
  - 2026-10-22 Zug 2: Report FERTIG_MIT_VORBEHALT (kein roter Browsertest — `upload()` neu) · 9 Dateien
    geändert, keine neu · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-12.verify.log`)
  - 2026-10-22 Zug 3: Reviewer (`claude-opus-5-5`, effort high) — alle Findings behoben, nichts kritisch
    oder wichtig, fünf klein · Diff `paket-12.diff`, Report `paket-12.review-0.json`
  - 2026-10-22 Zug 4: keine Runde nötig
  - 2026-10-22 Zug 5: Commit `57cf085f` (9 Dateien, +693/−92), getragen vom Verify aus Zug 2 · zwei
    Nebenbefunde in »Offene Befunde« (`dynamic-atlas-and-bitmap-text.md:210`, `:72`)

## Urteil des Reviewers

- **PERF-009** behoben — `#pack()` `DynamicAtlas.ts:527`, `#release()` `:598`, Aufruf in `remove()`
  `:376`; Specs 1–8 und die zwei mitgezogenen `remove()`-Tests mit den Werten dieser Datei; Packer per
  Zufalls-Churn (4 × 20 000 Schritte, `padding`/`extrude` 1/0, 2/1, 0/0, 1/2) ohne Überlappung.
- **PERF-010** behoben — `upload()` `DynamicAtlas.ts:411`, `#changed()` `:682`, `#ensureStaging()`
  `:693`, `WHOLE_UPLOAD_SHARE` `:85`, Kosten im TSDoc von `redraw()` `:336`; Specs 9–18; Browsertest
  `texture-dynamic-atlas.test.js:170`; Lookbook `DungeonScreen.ts:405`, `ui-panels.astro:126`.
- **CONS-006** behoben — `dynamic-atlas-and-bitmap-text.md:238–240`; gleiche Ursache: TSDoc `add()`
  `DynamicAtlas.ts:277–282`, Kommentar `#assertDrawable()` `:636–639`, `docs/sprites.md:483–485`,
  Browsertest `texture-dynamic-atlas.test.js:306`.

Kleine Befunde (keine Runde ausgelöst):

- `DynamicAtlas.ts:435` — `#ensureStaging()` steht vor dem `try` von `upload()`: wirft der Aufbau
  des Staging-Canvas (Node ohne `OffscreenCanvas` und `document`, übergebener Canvas), bleibt die
  Textur unmarkiert und `#dirty` voll; das TSDoc verspricht »no change is lost«. Im Browser praktisch
  nicht erreichbar.
- `DynamicAtlas.ts:330`, `docs/sprites.md:478`, `dynamic-atlas-and-bitmap-text.md:262` — ein
  werfendes `redraw()` lässt das Frame »marked for upload«; nach dem ersten `upload()` wird die Zelle
  stattdessen für das nächste `upload()` vorgemerkt. Unscharf, nicht falsch.
- `sprite-and-texture-roadmap.md:481` — »`add()` marks the texture for upload« gilt nur bis zum
  ersten `upload()`.
- `dynamic-atlas-and-bitmap-text.md:597–599` — §6 nach dem Nachtrag nicht neu umbrochen, eine
  auffällig kurze Zeile.
- Commit-Typ `perf` trotz neuer öffentlicher Methode; vertretbar, `DynamicAtlas` ist unveröffentlicht.

Abweichungen des Implementierers: `ui-panels.astro:126` reicht den `renderer` aus
`display.onInit()` statt `display.renderer` (dasselbe Objekt, `Display#renderer` ist
`WebGPURenderer | undefined`); Proposal §6 und der Kommentar in `DungeonScreen#dispose()` nennen die
Staging-Ressourcen mit.

## Abgleich gegen den Code nach `1c42f02d`

- **PERF-009** besteht. `remove()` (`DynamicAtlas.ts:325–335`) räumt die Zelle (`#clearCell`),
  löscht sie aus `#cells` und gibt den Namen frei, gibt aber keinen Platz zurück; das TSDoc sagt es
  (`:319` »The cell is not reused, shelves fragment«). `#pack()` (`:401–450`) legt nur ans Ende eines
  Shelfs (`shelf.x`) oder auf ein neues Shelf. Ein Label, dessen Breite wechselt (`remove()` +
  `add()`), frisst den Canvas, bis `add()` mit »is full« wirft. Paket 11 hat `remove()` so
  festgelegt, dass das Frame seine Id behält und `atlas.get(id)` es weiter liefert, es aber aus
  Zufallsziehung und Komplettauswahl fällt; die Voll-Meldung zählt `#cells.size` (`:436`).
- **PERF-010** besteht. Jede Änderung setzt `this.#texture.needsUpdate = true` (`:277`, `:312`,
  `:333`, `:348`), three lädt den ganzen Canvas hoch. Das Klassen-TSDoc (`:101–103`) und §3.3 des
  Proposals sagen es so.
- **CONS-006** besteht. `dynamic-atlas-and-bitmap-text.md:210–211`: »An image that failed to load
  makes `drawImage()` throw an `InvalidStateError`: no frame is added and no cell is taken.« Gilt nur
  mit `size`: ein fertig geladenes, kaputtes Bildelement hat `complete === true` und
  `naturalWidth === 0`; ohne `size` lehnt `#naturalSize()` (`:473–481`) es vorher mit der Meldung zur
  fehlenden natürlichen Größe ab, mit `size` läuft es in `#draw()` und `drawImage()` wirft. Dieselbe
  ungeteilte Aussage steht im `@throws {DOMException}` von `add()` (`:248–249`), im Kommentar über
  `#assertDrawable()` (`:456–457`) und in `docs/sprites.md:478–479`. Der Satz zu `redraw()` (`:294`,
  Proposal `:232`) stimmt, er zeichnet immer in der Größe des Frames.

## Gewählter Weg und Gründe

- **PERF-009 über Free-Spans je Shelf (erste Option der Empfehlung), kein `compact()`.** `compact()`
  müsste lebende Frames verschieben und ihre `TextureCoords` in place umschreiben; jede vorbereitete
  Sprite-Kopie (`prepareSpriteFrame()`, `AtlasFrameTable`) hielte dann veraltete Werte, und §3.4
  verspricht »Nothing is ever moved, so a frame keeps its coords until `clear()`«. Free-Spans halten
  dieses Versprechen. Benachbarte freie Spans verschmelzen, ein Span am Shelf-Ende fällt ans Ende
  zurück, und ein leeres letztes Shelf verschwindet, damit ein höheres Frame dort wieder ein Shelf
  öffnen kann — sonst fragmentiert der Wechsel von Breite *und* Höhe weiter.
- **Folge aus Paket 11:** ein entferntes Frame behält Id und `coords`. Wird seine Zelle neu belegt,
  zeigt `atlas.get(alteId)` das Bild des neuen Frames. Das TSDoc von `remove()`, §3.6, `sprites.md`
  und der CHANGELOG sagen es; die Bibliothek verhindert es nicht (das Frame ist reine Daten, und eine
  Sperre der Zelle hieße wieder: kein Platz zurück).
- **PERF-010 über eine Staging-Textur und `renderer.copyTextureToTexture()`** (zweite Variante der
  Empfehlung). Geprüft gegen three 0.186.1:
  - `Texture#updateRanges` wertet nur der klassische `WebGLRenderer` aus, und nur für
    Daten-Texturen (`src/renderers/webgl/WebGLTextures.js:801`); weder das WebGPU-Backend noch der
    WebGL-2-Fallback von `WebGPURenderer` kennen einen Teil-Upload eines Bildes —
    `WebGPUTextureUtils#_copyImageToTexture()` kopiert immer die ganze Größe des Deskriptors.
  - `copyExternalImageToTexture()` mit `source.origin` direkt auf die GPU-Textur bräuchte
    `renderer.backend.get(texture)` — three-Interna, die Paket 6 aus dem Produktionscode genommen hat
    (`src/testing/threeInternals.ts` ist nur für Specs). Ausgeschlossen.
  - `Renderer#copyTextureToTexture(src, dst, srcRegion: Box2, dstPosition: Vector2)` ist öffentlich,
    läuft auf beiden Backends (WebGPU: `encoder.copyTextureToTexture`, three legt jede Bildtextur mit
    `COPY_SRC | COPY_DST` an, `WebGPUTextureUtils.js:370`; WebGL 2: Framebuffer + `copyTexSubImage2D`,
    `WebGLTextureUtils.js:827ff.`) und lädt die Quelle vorher selbst hoch (`Renderer.js:3203`). Die
    Staging-Textur trägt dieselben Einstellungen wie die Atlas-Textur (sRGB, `flipY` aus, straight
    alpha), also dasselbe GPU-Format, und die Kopie ist Texel für Texel.
- **Der Renderer kommt über eine neue öffentliche Methode `upload(renderer: WebGPURenderer): void`.**
  Der Atlas kennt keinen Renderer, und three hat für eine Bildtextur keinen Hook vor dem Render, der
  den Renderer reicht (`texture.onUpdate` läuft erst nach einem vollen Upload). Die Bibliothek tippt
  Renderer-Parameter durchweg als `WebGPURenderer` (41 Stellen), daher dieser Typ.
- **Opt-in durch den ersten Aufruf, keine Option im Konstruktor.** Vor dem ersten `upload()` markiert
  jede Änderung die ganze Textur wie bisher — wer `upload()` nie ruft, merkt nichts, und der
  Browsertest »shows a frame added after the first render, and a redraw, in the next render« bleibt
  gültig. Ab dem ersten Aufruf warten `add()`, `redraw()` und `remove()` auf das nächste `upload()`.
  Ein einziger Aufruf pro Frame schaltet es ein; eine zweite Stelle (Option + Aufruf), die
  auseinanderlaufen kann, gibt es nicht.
- **`clear()` markiert immer die ganze Textur**, auch nach dem ersten `upload()`: der ganze Canvas hat
  sich geändert, eine Kopie je Zelle wäre teurer.
- **Schwelle zum ganzen Upload:** kosten die Kopien (`Zahl der Zellen × Fläche des Staging-Canvas`)
  die Hälfte der Atlasfläche oder mehr, markiert `upload()` stattdessen die ganze Textur. Eine
  Übertragung ohne Submit je Zelle ist dann billiger. Modulkonstante `WHOLE_UPLOAD_SHARE = 0.5`.
- **Ein Staging-Canvas für alle Zellen, eine Kopie je Zelle.** Er wächst auf die größte geänderte
  Zelle (samt Extrusion) und schrumpft nicht (bis `dispose()`). Mehrere Zellen in einen Staging-Upload
  zu packen bräuchte einen zweiten Packer; der Gewinn gegen einige kleine Uploads ist gering.
- **Keine Allokations-Spec für `upload()`.** `redraw()` alloziert seine Closures
  (`#inCanvasPixels(() => …)`) ohnehin, und `upload()` allein lässt sich ohne vorheriges `redraw()`
  nicht mit geänderten Zellen messen. `upload()` hält trotzdem seine Scratch-Objekte (`Box2`,
  `Vector2`, Array der Zellen) und alloziert im eingeschwungenen Zustand nichts.
- **Unveröffentlicht:** `DynamicAtlas` steht nur unter `[Unreleased]` (`CHANGELOG.md:35`, nicht in
  `0.23.0`). Die Änderungen gehen in die `Added`-Zeile, kein Migration Guide, kein `!` im Commit —
  wie bei Paket 4, 7 und 10.
- **Kein Split in 12a/12b**: PERF-009 und PERF-010 ändern dieselben Methoden (`add()`, `remove()`,
  `#pack()`) und dieselben Doku-Absätze; die Schleife läuft auf `paket-12.md`.
- **Lookbook zieht mit:** `ui-panels` zeichnet HP-/MP-Labels per `redraw()` in einen 512 × 512-Atlas
  (`DungeonScreen.ts:888`, `:893`) — genau der Fall des Findings. Das Lookbook ist die gelebte Doku;
  drei Zeilen zeigen den Aufruf. Das Bild bleibt gleich, die Preview wird nicht neu erzeugt.

## Vorgehen

Vorab: `AGENTS.md` lesen, dazu `DynamicAtlas.ts`, `TextureAtlas.ts`, `internals.ts`,
`DynamicAtlas.spec.ts`, `src/testing/fakeCanvas.ts` und `texture-dynamic-atlas.test.js` ganz.
Für den CHANGELOG den Skill `updating-changelog` laden. Neue Prosazeilen in Markdown höchstens
100 Zeichen, Kommentarzeilen im Code höchstens 130. Meldungen folgen der Regel »Error and warning
messages« in `AGENTS.md` (`DynamicAtlas: …`).

### 1. Rote Tests zuerst (`DynamicAtlas.spec.ts`)

Vor jeder Änderung an `DynamicAtlas.ts` schreiben und rot laufen sehen; die Ausgabe des roten Laufs
(`pnpm nx test twopoint5d -- src/texture/DynamicAtlas.spec.ts`, für die `upload()`-Tests auch
`pnpm nx typecheck twopoint5d`) gehört in den Report. Mindestens diese, Namen wörtlich:

`describe('packing on shelves')` bzw. `describe('remove()')`:

1. `a removed cell is taken by the next frame that fits into it` — `atlasOn(64, 32)`, `add('a', noop,
   {width: 10, height: 8})`, `add('b', …gleich…)`, `remove('a')`, `add('c', noop, {width: 10,
   height: 8})` → `rectOf(atlas, 'c')` ist `{x: 1, y: 1, w: 10, h: 8}`.
2. `a narrower frame takes the left part of a freed cell, and the rest stays free for another` —
   `atlasOn(64, 32)`, `a` 20 × 8, `b` 10 × 8, `remove('a')`, `add('c', 8 × 8)` → `{x: 1, y: 1}`,
   `add('d', 8 × 8)` → `{x: 10, y: 1}` (Span `[1, 22)`, je Zelle Breite + Padding 1).
3. `freed neighbours merge, and a frame as wide as both together takes their place` — `a`, `b`, `c`
   je 10 × 8, `remove('a')`, `remove('b')`, `add('wide', {width: 21, height: 8})` → `{x: 1, y: 1}`.
4. `a cell freed at the end of a shelf gives its room back to the shelf` — `atlasOn(32, 32)`, `a`
   10 × 8, `b` 10 × 8, `remove('b')`, `add('c', {width: 19, height: 8})` → `{x: 12, y: 1}` (passt nur,
   wenn `shelf.x` auf 12 zurückgefallen ist).
5. `a last shelf left empty leaves the shelves, and a taller frame opens one in its place` —
   `atlasOn(32, 32)`, `a` 10 × 8 (Shelf 1), `tall` 10 × 12 (Shelf 2 bei `y: 10`), `remove('tall')`,
   `add('taller', {width: 10, height: 20})` → `{x: 1, y: 10}`; ohne Abbau wäre unter dem leeren
   Shelf 2 kein Platz.
6. `frames whose width changes through remove() and add() do not fill the atlas` — `atlasOn(64, 32)`,
   vier Labels, dann 1000 Runden: je Label `remove(name)` und `add(name, noop, {width: 8 + (round
   % 7), height: 6})`; kein Wurf, am Ende `atlas.atlas.frameNames().length === 4`. Vor dem Fix rot
   (»is full«).
7. `a frame let go of shows what is packed into its cell later` — `const old = add('a', 10 × 8)`,
   `const id = atlas.atlas.frameId('a')`, `remove('a')`, `const next = add('b', 10 × 8)` →
   `atlas.atlas.get(id)` ist `old`, und `old.coords` deckt dieselbe Fläche wie `next.coords`
   (`old.data.frame` und `next.data.frame` gleich).
8. `a callback that throws gives a freed cell back as it was` — `a` 10 × 8, `b` 10 × 8, `remove('a')`,
   `add('x', () => { throw … }, 10 × 8)` wirft, danach `add('y', 10 × 8)` → `{x: 1, y: 1}`.

Bestehende Tests, die das alte Verhalten festhalten, werden mitgezogen:

- `remove()` › `clears the cell and lets go of the name, but not of the space` →
  umbenennen in `clears the cell, lets go of the name and gives the cell to the next frame that fits`;
  der `clearRect` bleibt `[1, 1, 12, 10]`, das erneute `add('a', …)` landet bei
  `{x: 2, y: 2, w: 10, h: 8}` (Shelf geleert und abgebaut, neues Shelf an derselben Stelle).
- `remove()` › `the message of a full atlas counts the frames it holds`: nach `remove('a')` passt ein
  1 × 1 in die frei gewordene Zelle. Das neue Frame muss breiter sein als die freie Zelle:
  `add('more', noop, {width: 7, height: 14})`, erwartete Meldung
  `DynamicAtlas: the atlas of 16 × 16 is full — the frame "more" of 7 × 14 does not fit beside the 1 frame packed into it; build a larger one — new DynamicAtlas({width: 32, height: 32}) — or clear() it`.

Neues `describe('upload()')` mit einem Fake-Renderer
(`const renderer = {copyTextureToTexture: vi.fn()} as unknown as WebGPURenderer`) und
`vi.stubGlobal('OffscreenCanvas', FakeCanvas)` für den Staging-Canvas:

9. `the texture is marked from its construction on, so the first render uploads the canvas at its size`
   — `atlas.texture.version` ist direkt nach `new DynamicAtlas(…)` größer als 0 (three's
   `CanvasTexture` markiert sich im Konstruktor; der Test hält fest, worauf `upload()` baut).
10. `the first call copies nothing, and from then on add(), redraw() and remove() leave the texture unmarked`
    — `add('a')`, `upload(renderer)` → `copyTextureToTexture` nicht gerufen; `version` merken, dann
    `redraw('a', noop)`, `add('b', …)`, `remove('a')` → `version` unverändert.
11. `copies each changed cell, its extruded edges included, from a staging texture to its place` —
    `atlasOn(64, 32, {extrude: 1})`, `upload(renderer)`, `add('a', noop, {width: 10, height: 8})`,
    `upload(renderer)` → genau ein Aufruf mit `(staging, atlas.texture, Box2 min (0, 0) max (12, 10),
    Vector2 (1, 1))`; `staging` ist eine `CanvasTexture` mit `flipY === false`, `colorSpace ===
    SRGBColorSpace`, `premultiplyAlpha === false`, `generateMipmaps === false`, Name
    `'twopoint5d.DynamicAtlas.staging'`; der Staging-Kontext zeichnete vorher
    `drawImage(atlasCanvas, 1, 1, 12, 10, 0, 0, 12, 10)` mit `globalCompositeOperation === 'copy'`,
    `imageSmoothingEnabled === false`, Translation `[0, 0]`, `globalAlpha === 1`.
12. `copies a cell changed twice once, and nothing at the next call without a change` — zwei
    `redraw('a')` → ein Aufruf; zweites `upload()` → kein weiterer Aufruf.
13. `copies the cell a remove() cleared` — `remove('a')`, `upload()` → ein Aufruf für die Zelle von
    `a`.
14. `marks the whole texture instead where the copies would cover half the atlas or more, and copies nothing`
    — `atlasOn(16, 16)`, erstes `upload()`, dann vier Frames 6 × 6 per `add()` (4 × 36 = 144 ≥ 128);
    `upload()` → `version` gestiegen, kein Aufruf.
15. `marks the whole texture at clear(), and drops the cells changed before` — nach dem ersten
    `upload()`: `redraw('a')`, `clear()` → `version` gestiegen; `upload()` → kein Aufruf.
16. `grows the staging canvas to the largest changed cell and builds its texture anew` —
    `atlasOn(64, 32)`, erstes `upload()`, `add()` einer Zelle 4 × 4 und `upload()`, dann `add()` einer
    10 × 8 und `upload()`: die erste Staging-Textur wird disposed (`sandbox.spy`), die zweite Kopie
    läuft über eine neue, deren Canvas mindestens 10 × 8 misst.
17. `an upload that throws marks the whole texture, so no change is lost, and the error goes on` —
    `copyTextureToTexture` wirft; `upload()` wirft denselben Fehler, `version` gestiegen, das nächste
    `upload()` kopiert nichts.

`describe('dispose()')` ergänzen:

18. `releases the staging texture and shrinks the staging canvas, and upload() does nothing afterwards`
    — nach einer Kopie `dispose()`: Staging-Textur `dispose` einmal gerufen, Staging-Canvas 0 × 0;
    `upload(renderer)` danach wirft nicht und ruft nichts. Der Test `behaves as documented after
    dispose()` bekommt `expect(() => atlas.upload(renderer)).not.toThrow()`.

Der Test `the texture` › `is marked for upload by every add(), redraw(), remove() and clear()` bleibt
unverändert: er läuft ohne `upload()`.

### 2. PERF-009 — freie Zellen (`DynamicAtlas.ts`)

Datenmodell (ersetzt `Shelf` und `FrameRect` an `:49–62`):

```ts
// a row of cells, as high as the cell that opened it; `x` is where its tail begins, `free` the cells given
// back left of it, ascending, none touching another or the tail
interface Shelf {
  readonly y: number;
  readonly height: number;
  x: number;
  readonly free: FreeSpan[];
}

// [start, end) in canvas pixels: a cell given back and the padding behind it
interface FreeSpan {
  start: number;
  end: number;
}

// where a frame lies in the canvas, its extruded edges not included, and the shelf of its cell
interface FrameRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly shelf: Shelf;
}
```

`#pack(name, width, height)` antwortet `{x, y, shelf, undo}` (`x`, `y` die linke obere Ecke der
Zelle samt Extrusion, wie jetzt). Auswahl:

- Ein Shelf passt, wenn `shelf.height >= cellHeight` und es einen Span mit
  `span.end - span.start >= cellWidth + padding` hat oder das Ende passt
  (`shelf.x + cellWidth + padding <= this.width`, wie jetzt).
- Unter den passenden das mit der kleinsten Höhe, bei gleicher Höhe das erste (die bisherige Regel).
- Im gewählten Shelf der linkeste passende Span (First-Fit): `x = span.start`,
  `span.start += cellWidth + padding`, der Span fällt weg, wenn `start === end`. Sonst das Ende wie
  jetzt. Ohne passendes Shelf ein neues Shelf wie jetzt (`free: []`), sonst die Voll-Meldung wie
  jetzt (zählt `#cells.size`).
- `undo` stellt exakt her, was die Belegung änderte: den alten `start` des Spans bzw. den Span an
  seinem Index wieder eingefügt; `shelf.x` zurück; das neue Shelf heraus.

`add()` legt den `FrameRect` mit `shelf` an (`:265`); `rollback.shelf` aus `#pack()`.

Neue private Methode `#release(rect: FrameRect): void`, gerufen von `remove()` nach `#clearCell(rect)`
und `#cells.delete(frame)`:

1. `start = rect.x - extrude`, `end = start + rect.w + 2 * extrude + padding`.
2. Sortiert in `rect.shelf.free` einfügen; mit dem linken Nachbarn verschmelzen, wenn dessen
   `end === start`, mit dem rechten, wenn `end === dessen start`.
3. Ist das `end` des (verschmolzenen) Spans gleich `shelf.x`: `shelf.x = span.start`, Span entfernen.
4. Solange das letzte Shelf in `#shelves` leer ist (`x === padding` und `free.length === 0`):
   `#shelves.pop()`.

`clear()` setzt `#shelves = []` wie jetzt; die Spans gehen mit.

### 3. PERF-010 — `upload(renderer)` (`DynamicAtlas.ts`)

Importe: `Box2`, `Vector2` und `type WebGPURenderer` aus `'three/webgpu'`.

Neue Felder:

```ts
// set by the first upload(): from then on add(), redraw() and remove() leave the texture to the next upload()
#regionUploads = false;
// the cells changed since the last upload(), each once
readonly #dirty: FrameRect[] = [];
#staging: {canvas: HTMLCanvasElement | OffscreenCanvas; context: DynamicAtlasContext; texture: CanvasTexture<HTMLCanvasElement | OffscreenCanvas>} | undefined;
readonly #srcRegion = new Box2();
readonly #dstPosition = new Vector2();
```

Modulkonstante mit Kommentar:

```ts
// where the copies of upload() would move half the atlas or more, one whole upload is cheaper: a single
// transfer, and no submit for each cell
const WHOLE_UPLOAD_SHARE = 0.5;
```

Private `#changed(rect: FrameRect): void`: ohne `#regionUploads` → `this.#texture.needsUpdate =
true`; sonst `rect` an `#dirty` anhängen, falls `!this.#dirty.includes(rect)`. Aufrufer:

- `add()`: statt `needsUpdate` (`:277`) `this.#changed(rect)`.
- `redraw()`: im `finally` (`:310–313`) `this.#changed(rect)`, Kommentar bleibt sinngemäß.
- `remove()`: statt `needsUpdate` (`:333`) `this.#changed(rect)`.
- `clear()`: `needsUpdate = true` bleibt, dazu `this.#dirty.length = 0`.

`upload(renderer: WebGPURenderer): void`, öffentlich, zwischen `clear()` und `dispose()`:

1. `if (this.#disposed) return;` (`resource-lifecycle.md` §3, mutierende Methode → No-op).
2. Ohne `#regionUploads`: `#regionUploads = true`, return.
3. `#dirty` leer → return.
4. `needW`, `needH` = Maximum von `rect.w + 2 * extrude` bzw. `rect.h + 2 * extrude` über `#dirty`;
   `stageW = max(needW, Staging-Breite oder 0)`, `stageH` entsprechend.
5. `if (this.#dirty.length * stageW * stageH >= WHOLE_UPLOAD_SHARE * this.width * this.height)`:
   `needsUpdate = true`, `#dirty.length = 0`, return.
6. `#ensureStaging(stageW, stageH)`.
7. In `try`: je Zelle (`cx = rect.x - e`, `cy = rect.y - e`, `cw = rect.w + 2e`, `ch = rect.h + 2e`):
   auf dem Staging-Kontext `save()`, `setTransform(1, 0, 0, 1, 0, 0)`, `globalAlpha = 1`,
   `globalCompositeOperation = 'copy'`, `imageSmoothingEnabled = false`,
   `drawImage(this.#canvas, cx, cy, cw, ch, 0, 0, cw, ch)`, `restore()`;
   `staging.texture.needsUpdate = true`; `#srcRegion.min.set(0, 0)`, `#srcRegion.max.set(cw, ch)`,
   `#dstPosition.set(cx, cy)`;
   `renderer.copyTextureToTexture(staging.texture, this.#texture, this.#srcRegion, this.#dstPosition)`.
   Im `catch`: `this.#texture.needsUpdate = true`, rethrow. Im `finally`: `this.#dirty.length = 0`.

Die Reihenfolge Upload der Staging-Textur → Kopie → nächster Upload ist auf beiden Backends
geordnet (WebGPU: Queue-Operationen in Aufrufreihenfolge, three submitted jede Kopie sofort; WebGL:
GL-Befehlsfolge) — ein Staging-Canvas für alle Zellen reicht. Kommentar dazu an die Schleife.

`#ensureStaging(width, height)`: reicht der vorhandene Staging-Canvas in beiden Maßen, nichts tun.
Sonst die alte Staging-Textur `dispose()`n und den alten Canvas auf 0 × 0 setzen, dann
`buildCanvas(width, height)` (der vorhandene Helfer), Kontext über `getContext('2d')` mit
`expectDefined(…, 'the 2D context of a canvas of its own')` aus `src/utils/expectDefined.ts` (ein
frisch gebauter Canvas gibt immer einen; ein `null` ist eine gebrochene Invariante, keine
Ablehnung), und eine `CanvasTexture` mit Name `'twopoint5d.DynamicAtlas.staging'`, `flipY = false`,
`colorSpace = SRGBColorSpace`, `premultiplyAlpha = false`, `generateMipmaps = false`,
`magFilter`/`minFilter = NearestFilter`. Kommentar: dieselben Einstellungen wie die Atlas-Textur
geben dasselbe GPU-Format, und die Kopie bleibt Texel für Texel.

`dispose()`: zusätzlich `#staging?.texture.dispose()`, Staging-Canvas auf 0 × 0, `#staging =
undefined`, `#dirty.length = 0`.

### 4. TSDoc und Kommentare in `DynamicAtlas.ts`

- Klassen-TSDoc `:101–106`, zweiter und dritter Absatz ersetzen durch:

  > The texture is read upright (`flipY = false`, as every atlas of the library), in sRGB, with
  > straight alpha and without mipmaps. `add()`, `redraw()` and `remove()` mark it for upload — the
  > renderer uploads the whole canvas once with the next render that uses it — until {@link upload}
  > is called for the first time; from then on they leave it to the next `upload()`, which copies the
  > changed cells alone. `clear()` marks the whole canvas either way.
  >
  > The atlas owns its texture, a canvas it built itself and the staging canvas and texture of
  > {@link upload}; {@link dispose} releases them. A canvas handed in stays the caller's.

- Kommentar `:180`: `// a change uploads the whole canvas or copies its changed cells, and the small mip levels of a packed atlas mix its frames`.
- `redraw()`-TSDoc um einen Absatz ergänzen: »A frame redrawn every frame — a counter, a timer — wants
  {@link upload} before each render: it copies the cell alone, where the whole canvas goes up
  otherwise, 16 MiB at 2048 × 2048.«
- `remove()`-TSDoc ersetzen durch:

  > Clears the cell of the frame `name`, lets go of the name — {@link atlas} finds it no longer, and
  > `add()` may take it again — and gives the cell back: the next frame that fits is packed into it, a
  > narrower one into its left part. The frame keeps its id, and `atlas.get(id)` still answers it —
  > its coords show the cell, cleared until another frame is packed into it and that frame
  > afterwards —, but it leaves the random draws of the atlas — `randomFrame()` and its siblings —
  > and a table of every frame — `frameTable(atlas)`, `atlasFrameTable(atlas)` —, and the message of
  > a full atlas counts only the frames it holds. Answers `false` for a name the atlas does not hold,
  > and once the atlas is disposed.

- `upload()`-TSDoc:

  > Copies the cells changed since the last call into the texture as `renderer` holds it, each from a
  > staging texture through `renderer.copyTextureToTexture()`; call it once per frame, before the
  > render. The first call copies nothing — every change before it has marked the whole texture — and
  > from then on `add()`, `redraw()` and `remove()` leave the texture to the next call, so a change
  > shows only after it. Where the copies would cover half the atlas or more, it marks the whole
  > texture instead; `clear()` marks it either way. A copy that throws marks the whole texture, so no
  > change is lost, and the error goes on to the caller.
  >
  > The renderer is the one that draws the texture, initialised: another renderer gets the canvas
  > as it is with its first render and none of the copies after. Without this call every change
  > uploads the whole canvas with the next render — 16 MiB at 2048 × 2048. Does nothing once the atlas
  > is disposed.

- `dispose()`-TSDoc: »Disposes the texture and the staging texture of {@link upload}, and shrinks a
  canvas the atlas built itself and the staging canvas to 0 × 0; …«, Rest wie jetzt, dazu
  »`upload()` does nothing«.
- `#pack()`-Kommentar `:401–402`: »Takes a cell for a frame of `width` × `height` — the leftmost
  freed cell it fits into on the lowest shelf that has room, else the tail of that shelf, else a new
  shelf — and answers its top left corner, its shelf and the way to give it back. Throws, changing
  nothing, for a frame that does not fit«.

### 5. CONS-006 — das kaputte Bild an allen vier Stellen

- `dynamic-atlas-and-bitmap-text.md:210–211` ersetzen durch: »An image that failed to load has no
  natural size either: without a `size` `add()` refuses it with the message above, and with a `size`
  `drawImage()` throws an `InvalidStateError` — no frame is added and no cell is taken in either
  case.«
- `DynamicAtlas.ts:248–249`: `@throws {DOMException} an \`InvalidStateError\` from \`drawImage()\` for
  an image element that failed to load, given a \`size\` — without one it has no natural size and is
  refused as above; no frame is added and no cell is taken.` Im `@throws {Error}` (`:245–247`):
  »an image element without a natural size and without a `size` — one that failed to load among
  them —«.
- Kommentar `:452–457`, letzter Halbsatz: »…, and one that failed to load is refused by
  `#naturalSize()` without a size and makes `drawImage()` throw with one«.
- `docs/sprites.md:478–479`: »One that failed to load has no natural size either: `add()` refuses it
  without a size and takes no cell for it, `drawImage()` throws for it with one, and `redraw()` leaves
  the frame cleared.«
- Browsertest `refuses an image element that failed to load, and takes no cell for it` umbenennen in
  `refuses an image element that failed to load — without a size for want of a natural size, with one in drawImage() — and takes no cell for it`
  und vorn ergänzen: `atlas.add('broken', broken)` ohne `size` wirft einen `Error` mit `name ===
  'Error'` und einer Meldung, die `has no natural size` enthält; `atlas.atlas.size === 0`.

### 6. Doku

`docs/proposals/dynamic-atlas-and-bitmap-text.md`:

- §3.1, API-Block: nach `clear(): void;` die Zeile `upload(renderer: WebGPURenderer): void;`
  (Kommentar darüber: `/** Copies the changed cells into the texture of the renderer — once called, before each render. */`).
- §3.3, Tabellenzeile `generateMipmaps`: »a change uploads the whole canvas or copies cells into it;
  building the mip chain each time costs, and the small levels of a packed atlas mix neighbouring
  frames anyway«. Den letzten Absatz (`:162–164`) ersetzen: ohne `upload()` markiert jede Änderung
  die Textur, der Renderer lädt den ganzen Canvas einmal mit dem nächsten Render (16 MiB bei
  2048 × 2048); `upload(renderer)` einmal pro Frame vor dem Render schaltet mit dem ersten Aufruf auf
  Kopien um — Staging-Canvas und -Textur gleicher Einstellungen, `renderer.copyTextureToTexture()` je
  Zelle samt Extrusion, ganze Textur ab der Hälfte der Atlasfläche und bei `clear()`, ein Wurf
  markiert die ganze Textur. Ein Satz, warum kein `updateRanges` (three wertet es für Bildtexturen
  in `WebGPURenderer` nicht aus) und keine Backend-Interna.
- §3.4: den Absatz `:172–175` ergänzen: eine von `remove()` zurückgegebene Zelle ist ein freier Span
  ihres Shelfs; ein Frame geht auf das niedrigste passende Shelf (Span oder Ende), dort in den
  linkesten passenden Span, sonst ans Ende; Nachbarspans verschmelzen, ein Span am Ende fällt ans Ende
  zurück, ein leeres letztes Shelf verschwindet. »Nothing is ever moved …« bleibt.
- §3.5: CONS-006 wie in Schritt 5.
- §3.6, `remove()`-Punkt (`:241–248`): »The cell is **not** reused …« ersetzen — die Zelle geht an das
  nächste Frame, das hineinpasst; `atlas.get(id)` des entfernten Frames zeigt eine geräumte Fläche,
  bis ein anderes Frame dort liegt, und danach dessen Bild. Rest (Zufallsziehung, Tabellen,
  Voll-Meldung, `true`/`false`) bleibt.
- §3.7: die Staging-Ressourcen gehören dem Atlas, `dispose()` gibt sie frei; `upload()` nach
  `dispose()` tut nichts.
- §8: im Spec-Punkt »`remove()` frees the name not the space« → »`remove()` frees the name and the
  cell, freed cells taken, merged, given back to the tail, an empty last shelf dropped«; »`needsUpdate`
  per call« → »`needsUpdate` per call without `upload()`, the copies of `upload()` and its whole
  upload«; im Browser-Punkt ergänzen: »after `upload()` a redraw, a remove and an add into the freed
  cell reach the next render through copies of their cells, the texture unmarked«.

`docs/proposals/sprite-and-texture-roadmap.md:481`: »`remove()` frees nothing (shelves fragment)« →
»`remove()` frees the cell for the next frame that fits«.

`docs/sprites.md`, Abschnitt `DynamicAtlas`:

- `ts check`-Block: `import type {WebGPURenderer} from 'three/webgpu';` ergänzen und am Ende
  ```ts
  // once per frame, before the render: from the first call on a change waits for it, which copies the changed cells alone
  export const beforeRender = (renderer: WebGPURenderer) => ui.upload(renderer);
  ```
- **Packing**: Satz ergänzen — eine Zelle, die `remove()` zurückgab, nimmt das nächste Frame, das
  hineinpasst, ein schmaleres ihren linken Teil.
- **`remove(name)`** (`:479–483`): »lets go of the name, not of its space — a shelf packer fragments«
  ersetzen durch: räumt das Frame, gibt Namen und Zelle frei; `atlas.get(id)` zeigt die Zelle —
  geräumt, bis ein anderes Frame dort liegt, dann dessen Bild. Rest bleibt.
- **The texture** (`:490–492`): »Every change marks it for upload, and the next render uploads the
  whole canvas once.« ersetzen durch einen Absatz zu beiden Wegen: ohne `upload()` lädt der nächste
  Render den ganzen Canvas (16 MiB bei 2048 × 2048); `upload(renderer)` einmal pro Frame vor dem
  Render — z. B. im `OnStageUpdateFrame` eines `Stage2D`, das ein `StageRenderer` vor seinem Render
  sendet, mit `display.renderer` — kopiert ab dem ersten Aufruf nur die geänderten Zellen; ab der
  Hälfte der Atlasfläche und bei `clear()` die ganze Textur.
- **Ownership**: Staging-Canvas und -Textur gehören dem Atlas; nach `dispose()` tut `upload()`
  nichts.
- CONS-006 wie in Schritt 5.

`packages/twopoint5d/CHANGELOG.md:35` (unveröffentlicht, nur diese Zeile umschreiben):

- »`remove()` clears it and frees its name but not its space — the frame keeps its id, `atlas.get(id)`
  still answers it, and it leaves …« → »`remove()` clears it and frees its name and its cell, which
  the next frame that fits takes — the frame keeps its id, `atlas.get(id)` still answers it and shows
  what is packed into the cell later, and it leaves …«.
- »every change marks it for upload« → »every change marks it for upload until `upload(renderer)`,
  called once per frame before the render, is called for the first time; from then on a change waits
  for the next call, which copies the changed cells alone into the texture from a staging texture
  through `renderer.copyTextureToTexture()`, and marks the whole texture where they cover half the
  atlas or more«.
- »`dispose()` releases the texture and a canvas of its own« → »… a canvas of its own and the staging
  canvas and texture«.

### 7. Lookbook

- `DungeonScreen.ts`: `update(deltaTime: number, renderer: WebGPURenderer): void` (Import `type
  WebGPURenderer` aus `'three/webgpu'`); nach der Schleife über die Meshes `this.#atlas.upload(renderer);`.
  TSDoc: »Moves everything that moves, then uploads what changed — the meshes, and the cells of the
  atlas its labels redraw. Once per frame, before rendering.«
- `ui-panels.astro:126`: `on(stage, OnStageUpdateFrame, ({deltaTime}) => screen.update(deltaTime, display.renderer));`
- Weitere Aufrufer von `DungeonScreen#update()` mit `grep -rn "\.update(" apps/lookbook/src` prüfen
  und mitziehen.

### 8. Browsertest (`texture-dynamic-atlas.test.js`, läuft unter WebGPU und WebGL 2)

Neuer Test `after upload(), a redraw, a remove and an add into the freed cell reach the next render through copies of their cells`:

1. `atlas = new DynamicAtlas({width: 32, height: 32, filter: 'nearest'})`, `left` rot und `right` grün
   je 4 × 4 per Callback, `FeatureSprites` wie im Test darüber, `left` bei `x = -3`, `right` bei
   `x = 3`; `atlas.upload(display.renderer)` (der erste Aufruf); `render()` → rot links, grün rechts.
2. `const version = atlas.texture.version`; `atlas.redraw('left', blau)`;
   `atlas.upload(display.renderer)`; `expect(atlas.texture.version).to.equal(version)`; `render()` →
   blau links, grün rechts (der Nachbar bleibt).
3. `atlas.remove('right')`; `const again = atlas.add('again', gelb, {width: 4, height: 4})`;
   `expect(again.data.frame).to.deep.equal(right.data.frame)`; `atlas.upload(display.renderer)`;
   `version` unverändert; `render()` → gelb rechts (das Sprite zeigt weiter die Koordinaten von
   `right`, also die neu belegte Zelle), blau links.

Weicht ein Farbwert unter WebGL 2 über die Toleranz von `isNearColor()` ab (die Kopie läuft dort
über ein sRGB-Framebuffer und `copyTexSubImage2D`), ist das ein Befund für den Report — die Toleranz
wird nicht aufgeweitet.

### 9. Abschluss

`pnpm format`, dann `pnpm run ci`. Nicht committen.

## Findings im Volltext

**PERF-009 · low · packages/twopoint5d/src/texture/DynamicAtlas.ts:313** (auch `:388`) — Freigegebene
Zellen im `DynamicAtlas` wiederverwenden
`remove()` gibt eine Zelle nie zurück, und `#pack()` legt Frames nur rechts an das Shelf-Ende oder
auf ein neues Shelf. Der typische Einsatz — Labels, deren Text und damit Breite wechselt — läuft als
`remove()` + `add()` und frisst den Canvas auf, bis `add()` mit »atlas is full« wirft; der einzige
Ausweg `clear()` macht alle Frames, Tabellen und vorbereiteten Frames gleichzeitig stale. `redraw()`
hilft nur bei gleicher Größe.
Empfehlung: Freie Zellen je Shelf in einer Free-List halten und in `#pack()` zuerst eine freie Zelle
passender Breite/Höhe nehmen (First-Fit auf dem Shelf); alternativ ein `compact()`, das die lebenden
Frames neu packt und ihre `TextureCoords` in place aktualisiert, damit Sprites und Tabellen ihnen
folgen.
Effort: M

**PERF-010 · low · packages/twopoint5d/src/texture/DynamicAtlas.ts:302** (auch `:270`, `:321`) — Nur
den geänderten Bereich des `DynamicAtlas` hochladen
Jede Änderung setzt `texture.needsUpdate = true`, und der Renderer lädt den ganzen Canvas hoch. Ein
Label, das per `redraw()` pro Frame aktualisiert wird (Zähler, Timer), kostet bei 2048 × 2048 rund
16 MiB Upload pro Bild — unabhängig davon, dass nur eine Zelle von wenigen Hundert Texeln sich
geändert hat. Die Klasse dokumentiert das, bietet aber keinen Weg darum herum.
Empfehlung: Dirty-Rects der Zellen sammeln und mit der nächsten Render-Runde nur diese per
`copyExternalImageToTexture`/`texSubImage2D` hochladen (z. B. über einen kleinen Upload-Hook am
Renderer oder `renderer.copyTextureToTexture` aus einer Staging-Textur); mindestens im TSDoc von
`redraw()` die Kosten pro Aufruf in Zahlen nennen.
Effort: L

**CONS-006 · low · packages/twopoint5d/docs/proposals/dynamic-atlas-and-bitmap-text.md:210** —
Proposal DynamicAtlas §3.2: kaputtes Bild ohne `size` beschreiben
§3.2 »An image that failed to load makes `drawImage()` throw« gilt nur mit `size`; ohne `size` lehnt
`add()` ein kaputtes Bild vorher mit der Meldung zur fehlenden natürlichen Größe ab. Aufgefallen im
Remediation-Lauf vom 2026-10-21.
Empfehlung: Den Satz auf beide Fälle erweitern.
Effort: S
