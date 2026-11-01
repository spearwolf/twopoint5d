# Paket 14 — Proposals auf three 0.187 nachziehen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nachtrag zu Paket 1; keine eigene Finding-ID)
- Folge von: Paket 1
- Ziel: Proposals und Kommentare beschreiben three so, wie 0.187.0 es tut: kein Satz behauptet
  mehr, WebGL 2 lese kein Integer-Target zurück oder ein `grad()` auf einer Textur mit zwei
  `NearestFilter` scheitere unter WebGPU; die Float-Wahl des Pickers ist gegen 0.187.0 begründet,
  und jede Versionsnennung von three in den Proposals ist gegen 0.187.0 geprüft.
- Modell: mittlere Stufe (Sonnet)
- Effort: low
- Dateien:
  - `packages/twopoint5d/docs/proposals/gpu-picking.md`
  - `packages/twopoint5d/docs/proposals/sprite-and-texture-roadmap.md`
  - `packages/twopoint5d/docs/proposals/atlas-frame-sampling.md`
  - `packages/twopoint5d/docs/proposals/wave-and-segment-sprites.md`
  - `packages/twopoint5d/docs/proposals/growing-capacity.md`
  - `packages/twopoint5d/docs/proposals/stage-masks.md`
  - `packages/twopoint5d/src/sprites/features/RepeatingTextureColor.ts` (nur ein Kommentar)
- Verify: `pnpm run ci`
- Commit: `docs(twopoint5d): catch the proposals up with three 0.187.0`

## Worum es geht

Paket 1 hat three auf `~0.187.0` gehoben und die Kommentare im Code, die Guides und die Tests
nachgezogen, die Proposals aber bewusst stehen lassen. Zwei Verhaltensänderungen von three 0.187.0
widerlegen seither Sätze in den Proposals und in einem Code-Kommentar, und der Ablauf einer Hebung
in `docs/architecture.md` §5, Schritt 3, verlangt, dass jede Stelle unter `packages/`, die eine
Version von three nennt, gegen das neue Release geprüft ist. Dieser Abgleich ist erledigt (siehe
»Abgleich«), jede Aussage unten ist im Quelltext von three 0.187.0 belegt. Du schreibst die Texte
ein; du musst nichts neu recherchieren.

Die beiden Änderungen von three 0.187.0:

1. **Integer-Readback unter WebGL 2.** `WebGLTextureUtils#copyTextureToBuffer()` reicht Format und
   Typ der Textur an `readPixels()` weiter, und `#_getBytesPerTexel(glType, glFormat)` kennt
   `RGBA_INTEGER`, `RG_INTEGER` und `RED_INTEGER` (`build/three.webgpu.js:34499-34623`). Ein
   Integer-Target liest unter WebGL 2 also zurück — als RGBA mit 32-Bit-Komponenten
   (`UnsignedIntType`), der einzigen Kombination, die WebGL 2 für `readPixels()` aus einem
   unsigned-integer Target garantiert. Unter WebGPU las es schon zurück (`rgba32uint` →
   `Uint32Array`). Der Picker bleibt beim Float-Target; `SpritePicker.ts:416-418` sagt das schon
   so.
2. **`grad()` auf einer Textur, deren Filter beide `NearestFilter` sind.** three liest eine solche
   Textur unter WebGPU mit `textureLoad` auf Level 0 und bindet keinen Sampler
   (`WGSLNodeBuilder#isUnfilterable()`), und `WGSLNodeBuilder#generateTextureGrad()` nimmt für sie
   jetzt denselben Texel-Lookup wie ein einfaches Sample (`src/renderers/webgpu/nodes/
   WGSLNodeBuilder.js:908-915`, Kommentar dort: »Unfilterable textures have no sampler binding«).
   Der Shader scheitert nicht mehr. `sampleAtlasFrame()` und `RepeatingTextureColor` bleiben, wie
   sie sind; nur ihre Begründungen ändern sich. Paket 1 hat den Kommentar in
   `sampleAtlasFrame.ts:118` schon auf den einen verbleibenden Grund gekürzt.

## Regeln für jede Zeile

- Englisch, im Ton der umgebenden Proposals. Zeilen umbrechen bei 100 Spalten wie der Absatz
  drumherum; ein umbrochener Absatz bleibt ein Absatz.
- **Kein Rückblick.** Kein »no longer«, kein »since 0.187«, kein »used to«, kein »r186 failed«.
  Die Texte sagen, was three 0.187.0 tut. Die Historie gehört in die Commit-Message.
- Keine Finding-IDs, keine Paketnummern, nirgends.
- Nur die genannten Stellen. Der Code bleibt unverändert — auch der von `RepeatingTextureColor`
  bis auf den Kommentar. Keine Status-Zeile, keine Deviations-Liste eines Proposals bekommt einen
  neuen Eintrag: der Build ist derselbe geblieben, nur seine Begründung.
- Kein CHANGELOG-Eintrag: nichts davon ist öffentliche Oberfläche oder Verhalten. Der Eintrag
  `packages/twopoint5d/CHANGELOG.md:187` steht unter dem veröffentlichten `[0.24.0]` und bleibt
  unangetastet, obwohl er »three's WebGL 2 backend reads no integer target back« sagt — ein
  veröffentlichter Abschnitt ist Historie (Skill `updating-changelog`).
- Die Guides (`docs/sprites.md` u. a.) fasst du nicht an; Paket 1 hat sie nachgezogen.

## Vorgehen

Die Ersatztexte unten sind der Wortlaut. Du darfst den Umbruch an die 100 Spalten anpassen und
Backticks so setzen, wie die Datei es sonst tut; inhaltlich weichst du nicht ab. Findest du beim
Einsetzen, dass ein Satz dem Quelltext von three 0.187.0 widerspricht (`node_modules/.pnpm/
three@0.187.0/node_modules/three/`), setzt du ihn nicht ein, sondern meldest es mit Datei und Zeile.

### 1. `gpu-picking.md` §3.4 »The target« (Zeilen 196-205)

Den ganzen Absatz unter `### 3.4 The target` ersetzen durch:

> A `RenderTarget` of 1 × 1, `FloatType`, RGBA, with a depth buffer, built at the first pick.
> **Float, not integer**: a float holds every whole number up to 2²⁴ exactly — sixteen million
> sprites per mesh and as many meshes in a list; a mesh of more sprites is refused before the draw
> (§5), since two of its slots would read back as one — and is read back as `Float32Array` under
> both backends (`EXT_color_buffer_float`, which three's WebGL 2 backend enables). three 0.187.0
> reads an integer target back under both backends as well, under WebGL 2 as RGBA with 32-bit
> components alone: `WebGLTextureUtils#copyTextureToBuffer()` hands the format and the type of the
> texture on to `readPixels()`, and WebGL 2 guarantees an unsigned integer target no other
> combination. Such a target would raise the bound of §5 to 2³² − 1, and the id every pick material
> writes would become a `uvec4` (`NodeBuilder#getOutputType()` answers `uvec4` for an
> `UnsignedIntType` target). The picker keeps the float target, which reaches 2²⁴ under both
> backends as it is. No blending, and a target is no output target: three applies neither tone
> mapping nor the output color space to it (`Renderer#currentToneMapping`, `#currentColorSpace`).

(Ohne das `>` der Zitatform einsetzen.)

### 2. `gpu-picking.md` — zwei Versionsstempel

- Zeile 115: `(`NodeMaterial#setup()`, three 0.186.1)` → `(`NodeMaterial#setup()`, three 0.187.0)`.
  Belegt: `src/materials/nodes/NodeMaterial.js`, `setup()` setzt `outputNode` nach
  `setupDiffuseColor()`, der Alpha-Test läuft also vorher.
- Zeile 185: `(three 0.186.1, `Matrix4#makePerspective()` and `#makeOrthographic()`)` →
  `(three 0.187.0, …)`, Rest unverändert. Belegt: `src/math/Matrix4.js:1140-1165`; dieselbe Aussage
  trägt `SpritePicker.ts:69` schon mit 0.187.0.

Sonst nichts in dieser Datei ändern.

### 3. `sprite-and-texture-roadmap.md` §4.10, Zeilen 452-453

Aus

> - The target holds the id exactly: a float render target — WebGL 2 reads no integer target back — no
>   blending, no tone mapping, no output color space transform — any of them would turn an id into
>   another id.

wird

> - The target holds the id exactly: a float render target (why float, not integer:
>   [`gpu-picking.md`](gpu-picking.md) §3.4), no blending, no tone mapping, no output color space
>   transform — any of them would turn an id into another id.

### 4. `atlas-frame-sampling.md` — Deviation und §4.2

- Zeilen 9-13, erster Punkt der Deviations-Liste. Aus

  > - the sample takes explicit gradients for a `minFilter` that reads mipmaps, under every wrap, and
  >   for no other filter (§4.2): gradients matter nowhere else, and three (r186) reads a texture whose
  >   filters are both `NearestFilter` with `textureLoad` and binds no sampler for it, while its WGSL
  >   builder still names that sampler in the `textureSampleGrad` of a `grad()` — the shader fails on
  >   WebGPU;

  wird

  > - the sample takes explicit gradients for a `minFilter` that reads mipmaps, under every wrap, and
  >   for no other filter (§4.2): gradients matter nowhere else;

  Das ist kein neuer Eintrag, sondern derselbe mit der Begründung, die stehen bleibt — die Regel
  »keine neue Deviation« oben ist damit eingehalten.
- Zeilen 236-238, Ende des ersten Absatzes von §4.2. Aus

  > … Without
  > mipmaps the sample takes no gradients: none are needed, and three reads a texture whose filters
  > are both `NearestFilter` with `textureLoad`, without the sampler a `grad()` names.

  wird

  > … Without
  > mipmaps the sample takes no gradients: none are needed.

  Der Rest von §4.2 bleibt.

### 5. `wave-and-segment-sprites.md` §4.3, Punkt »Mipmaps — gradients unless both filters are `NearestFilter`.« (Zeilen 411-419)

Nur den Satz ab »It reads the one filter test the key holds« ersetzen. Aus

> It reads the one filter test the key holds — both filters `NearestFilter`,
> which three reads with `textureLoad` and no sampler, where a `.grad()` fails on WebGPU — and takes
> gradients for every other texture.

wird

> It reads the one filter test the key holds — both filters `NearestFilter`,
> which read level 0 alone, so that gradients change nothing there — and takes gradients for every
> other texture.

Die übrigen Sätze des Punktes (`sampleAtlasFrame()` …, `RepeatingTextureColor` cannot …,
»Gradients on a texture without mipmaps …«, »So a mipmapped frame …«) bleiben. Zeile 358 der Datei
(»with `.grad()` unless both filters are `NearestFilter` (§4.3)«) stimmt und bleibt.

### 6. `growing-capacity.md`, Zeile 73

`(`RenderObject#needsGeometryUpdate`, three 0.186.1)` → `(`RenderObject#needsGeometryUpdate`,
three 0.187.0)`. Belegt: `build/three.webgpu.js:6118`, der Getter vergleicht `geometry.id` des
Render-Objekts mit dem des Objekts.

### 7. `stage-masks.md`, Zeile 713

`` `Texture#updateRanges` of three.js 0.186 `` → `` `Texture#updateRanges` of three.js 0.187 ``,
Rest des Satzes unverändert. Belegt: in 0.187.0 liest allein
`src/renderers/webgl/WebGLTextures.js:863` die `updateRanges` einer Textur; `src/renderers/common`,
`src/renderers/webgpu` und `src/renderers/webgl-fallback` lesen nur die von Buffern und
Uniform-Gruppen.

### 8. `RepeatingTextureColor.ts`, Kommentar Zeilen 62-65

Aus

```ts
        // three reads a texture whose filters are both NearestFilter with textureLoad and binds no
        // sampler for it, and a grad() fails on WebGPU; that test is part of the shape of a texture,
        // so a texture swapped in without a rebuild passes it alike. Every other texture takes the
        // gradients — on one without mipmaps they sample what a plain lookup samples
```

wird

```ts
        // a texture whose filters are both NearestFilter reads level 0 alone, so gradients change
        // nothing there: under WebGPU three reads it with textureLoad, and its grad() takes the same
        // lookup (WGSLNodeBuilder#generateTextureGrad() of three 0.187.0). That test is part of the
        // shape of a texture, so a texture swapped in without a rebuild passes it alike. Every other
        // texture takes the gradients — on one without mipmaps they sample what a plain lookup samples
```

Die Codezeilen 66-67 bleiben, Einrückung wie die Zeilen drumherum; `pnpm lint` (Biome) muss grün
bleiben.

### 9. Gegenprobe vor dem Report

```bash
git grep -nE "three 0\.186|three\.js 0\.186|\(r186\)|reads no integer|reads none back|grad\(\)\` fails|grad\(\) fails|grad\(\)\` names" -- packages/twopoint5d/docs/proposals packages/twopoint5d/src
```

darf keine Zeile mehr liefern. `packages/twopoint5d-testing/test/vertex-objects-heap.test.js:20/23`
(»from three 0.186 on«) liegt außerhalb dieses Pakets und bleibt — eine Aussage über einen
Versionsbereich, die unter 0.187.0 weiter gilt.

## Abgleich

Gegen den Code von `HEAD` 154cebcb und den Quelltext von three 0.187.0 in
`node_modules/.pnpm/three@0.187.0`:

- `gpu-picking.md:196-205` (§3.4) — **unverändert**: begründet Float mit dem fehlenden
  Integer-Readback von three 0.186.1; unter 0.187.0 liest WebGL 2 `RGBA_INTEGER` zurück
  (`build/three.webgpu.js:34521-34623`). Die Float-Wahl steht, ihre Begründung nicht.
- `sprite-and-texture-roadmap.md:452` (§4.10) — **unverändert**, Präsens ohne Version, unter 0.187.0
  falsch.
- **Dazu, gleiche Ursache** (Paket 1 hat die beiden Verhaltensänderungen im Code nachgezogen, in
  den Proposals und in einem Kommentar nicht):
  - `atlas-frame-sampling.md:9-13` — Deviation begründet die Gradienten-Regel zusätzlich mit
    »three (r186) … the shader fails on WebGPU«; unter 0.187.0 nimmt
    `WGSLNodeBuilder#generateTextureGrad()` den Texel-Lookup (`WGSLNodeBuilder.js:908-915`).
  - `atlas-frame-sampling.md:236-238` (§4.2) — Präsens, »without the sampler a `grad()` names«
    unterstellt dasselbe Scheitern.
  - `wave-and-segment-sprites.md:416` (§4.3) — Präsens ohne Version: »where a `.grad()` fails on
    WebGPU«, unter 0.187.0 falsch.
  - `src/sprites/features/RepeatingTextureColor.ts:62-65` — derselbe Satz im Code-Kommentar; Paket
    1 hat den Zwilling in `sampleAtlasFrame.ts:118` gekürzt, diesen nicht.
- **Versionsstempel** (`docs/architecture.md` §5, Schritt 3: jede Stelle unter `packages/`, die
  eine three-Version nennt, wird gegen das neue Release geprüft): `gpu-picking.md:115`,
  `gpu-picking.md:185`, `growing-capacity.md:73`, `stage-masks.md:713` — Aussagen unter 0.187.0
  geprüft und wahr (Belege oben bei den Schritten 2, 6, 7), nur der Stempel nennt 0.186.
- Geprüft und ohne Befund: `gpu-picking.md:276` (Render-Lists verfallen nach mehr als 10 Frames,
  `src/renderers/common/RenderLists.js:96-103`), Guides (`docs/sprites.md:1658`, `:1964`, `:2840`),
  `SpritePicker.ts:69` und `:416-418`, `sampleAtlasFrame.ts:118`,
  `pipeline-stages-and-grid-base.md:396`.
- Abgegrenzt: `vertex-objects-heap.test.js:20/23` — Versionsbereich, gilt weiter; Paket 1 hat ihn
  geprüft stehen lassen. `CHANGELOG.md:187` — veröffentlichter Abschnitt.

## Entscheidungen dieses Zugs

- **Scope erweitert um die `grad()`-Stellen und die Stempel.** Prüffrage für ein Symptom: Wären die
  Einträge entstanden, wenn Paket 1 seine Ursache — die Hebung auf 0.187.0 samt Schritt 3 aus §5 —
  zu Ende gebracht hätte? Nein. Ein Nachtragspaket zählt alle Fundstellen derselben Ursache auf,
  statt sie einzeln wiederkommen zu lassen. Kein Finding kommt hinzu.
- **Die Begründung nach 0.187.0 statt einem Vermerk neben der alten.** Die Proposal-README
  (»Reading an implemented proposal«, »Neither describes code that no longer exists«) und die
  Konvention »Kein Rückblick« verlangen, dass ein umgesetztes Proposal sagt, was gilt. Eine Aussage
  über 0.186.1 neben der Peer-Range `~0.187.0` wäre Historie. Die Float-Wahl selbst bleibt, so wie
  der Code (`SpritePicker.ts:416-418`) sie hält; ein Umbau auf ein Integer-Target ist nicht Teil
  dieses Laufs.
- **Kein Eintrag in den Deviations-Listen**: der Build hat sich nicht bewegt, nur der Grund.
- **Restplan unverändert.** Paket 14 bleibt vor 3 und vor 9: Paket 9 liest das Picking-Proposal
  und arbeitet in `src/sprites/`, kein Finding des Audits zeigt auf `RepeatingTextureColor.ts`
  (dort nur im Datei-Inventar); der Kommentar ist vor Paket 9 committet. Keine Folge und kein
  Nebenbefund ändert Reihenfolge oder Schnitt der offenen Pakete.
- **Modell mittlere Stufe, Effort low**: der Wortlaut steht hier, es bleibt Einsetzen und Umbruch
  in sieben Dateien. Die günstigste Stufe wäre für reine Transkription angemessen, aber die Regel
  »kein Rückblick« und der 100-Spalten-Umbruch in fremdem Ton kosten dort eher eine Runde.

## Verlauf

- 2026-10-31 Zug 0: Detailplan steht · beide Fundstellen des Plans unverändert
  (`gpu-picking.md:196-205`, `sprite-and-texture-roadmap.md:452`) · dazu gleiche Ursache:
  `atlas-frame-sampling.md:9-13` und `:236-238`, `wave-and-segment-sprites.md:416`,
  `RepeatingTextureColor.ts:62-65` (grad() auf NearestFilter) · Stempel 0.186 → 0.187.0 in
  `gpu-picking.md:115`/`:185`, `growing-capacity.md:73`, `stage-masks.md:713` · Folgen: keine
  offenen (Paket 1 → hier, Paket 2 keine) · Offene Befunde: 3 Dependency-Advisories, andere
  Ursache, liegen gelassen · Restplan unverändert
- 2026-10-31 Zug 1: Implementierer beauftragt, Sonnet, Effort low
- 2026-10-31 Zug 2: Report FERTIG · 7 Dateien geändert (6 Proposals, RepeatingTextureColor.ts Kommentar) · Baum schmutzig · `pnpm run ci` exit=0
- 2026-10-31 Zug 3: Reviewer (Sonnet, low): alle Schritte 1–9 erfüllt, kein kritischer/wichtiger Befund · Diff `paket-14.diff` im Arbeitsverzeichnis
- 2026-10-31 Zug 4: keine Runde nötig
- 2026-10-31 Zug 5: Commit 46528b84 `docs(twopoint5d): catch the proposals up with three 0.187.0` (Body trägt die Historie, Hinweis des Reviewers) · `pnpm run ci` exit=0

## Urteil des Reviewers

- Schritte 1–9 erfüllt: `gpu-picking.md` §3.4 und Stempel :115/:185, Roadmap §4.10, `atlas-frame-sampling.md` Deviation und §4.2, `wave-and-segment-sprites.md` §4.3, `growing-capacity.md:73`, `stage-masks.md:713`, `RepeatingTextureColor.ts:62-66` (nur Kommentar), Gegenprobe 0 Treffer.
- Klein: Umbruch in `wave-and-segment-sprites.md` §4.3 ragged; »both filters `NearestFilter`, which read level 0 alone« bezieht »which« grammatisch auf die Filter statt die Textur (Wortlaut der Paketdatei); `uvec4`-Aussage zu `NodeBuilder#getOutputType()` nur teilweise nachverfolgt, plausibel.
