# Paket 12 — Lookbook: Module der Masken-Demos

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: ARCH-001 (low, ohne den Atlas-Teil — der geht mit CONS-002 in Paket 13), BUG-010 (low), BUG-011 (low), READ-001 (low), READ-002 (low), CONS-001 (low), TYPE-001 (low), TYPE-002 (low)
- Ziel: Die Masken-Demos teilen ihre Helfer in einem Modul, rechnen framerate-unabhängig und randkorrekt und kommen ohne wirkungslose Casts aus.
- Modell: mittlere Stufe (`sonnet`)
- Effort: medium
- Pfade: Lookbook-Quellen unter `apps/lookbook/src/`, im Folgenden ohne dieses Präfix; `SM/` steht für `apps/lookbook/src/demos/stage-masks/`. Arbeitsverzeichnis des Laufs: `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad` (im Folgenden `$W`).
- Dateien:
  - neu `SM/helpers.ts`
  - `SM/InkWell.ts`, `SM/CrematoriumWindow.ts`, `SM/MirrorShatter.ts`, `SM/Trench.ts`, `SM/CrawlRig.ts`, `SM/WardC.ts`, `SM/WardRig.ts`, `SM/FoundFootage.ts`, `SM/Camcorder.ts`, `SM/DeepListening.ts`, `SM/RiftMembrane.ts`, `SM/MothChapel.ts`, `SM/PaintedMoor.ts`, `SM/DrownedHouse.ts`, `SM/MirrorBathroom.ts`, `SM/heatHaze.ts`, `SM/SeancePhotographs.ts`, `SM/Sonar.ts`, `SM/WatchingWallpaper.ts`, `SM/Crawlspace.ts`, `SM/PaintingHallway.ts`, `SM/InkVignette.ts`, `SM/RoseWindow.ts`
  - `demos/stage-transitions/glowLayerBuilder.ts` (TYPE-002, gleiche Ursache)
  - `demos/rope-bridge/RopeBridge.ts`, `demos/ui-panels/DungeonScreen.ts`, `pages/demos/stage-masks-resolution.astro` (READ-001, gleiche Ursache)
  - `pages/demos/_stage-masks-heat-haze.json` (Beschreibung der Demo, BUG-010)
  - nicht: `SM/SoftBlobs.ts`, `packages/twopoint5d/**` (auch kein `CHANGELOG.md`: das Lookbook ist keine Library-Oberfläche), keine Guides
- Vorgehen:
  0. **Proben zuerst, rot sehen.** Das Lookbook hat keine Testoberfläche. Die Belege für BUG-010, BUG-011 und den neuen Generator liegen deshalb als Proben außerhalb des Repos in `$W/paket-12-probe/` (README dort): sie laufen die echten Lookbook-Module unter dem Vitest der Library. Lauf vor jeder Codeänderung:
     ```bash
     cd /home/spw/spaceland/twopoint5d/packages/twopoint5d
     ./node_modules/.bin/vitest run --config $W/paket-12-probe/vitest.config.mjs
     ```
     Erwartet (so im Zug 0 gesehen, `$W/paket-12.zug0-probe.log`): alle vier rot — `helpers.probe.ts` scheitert am fehlenden `SM/helpers.ts`, `heatHaze.probe.ts` sieht vier `OperatorNode`s statt `clamp`, `crawlRig.probe.ts` 5 gegen 4 Flacker-Fenster (18 gegen 40 Umschaltungen im ersten), `footageClock.probe.ts` den dritten Signalverlust bei 42,28 s gegen 38,9 s. Diese Ausgabe gehört in den Report. Die Proben werden nicht ins Repo kopiert und nicht geändert; passt eine nicht zum Plan, steht das im Report.
  1. **`SM/helpers.ts` anlegen** (ARCH-001). Name `helpers.ts`, nicht `shared.ts` wie in der Empfehlung: »shared« ist der Name der Demo `stage-masks-shared` (FoundFootage, Camcorder, InkVignette) — ein `shared.ts` daneben läse sich als ihr Modul. Inhalt, in dieser Reihenfolge, Lookbook-Stil (relative Imports ohne Suffix):
     ```ts
     import {dot, fract, vec3} from 'three/tsl';
     import {CustomBlending, DstColorFactor, type MeshBasicNodeMaterial, type Node, OneFactor, ZeroFactor} from 'three/webgpu';
     ```
     a. Modul-Kommentar oben (TSDoc-Block vor dem ersten Export, Englisch): die Szenen der Masken-Demos importieren aus `helpers.ts`, aus `SoftBlobs.ts` (ein Baustein, keine Szene) und aus den Modulen ihrer eigenen Demo-Seite, nie aus dem Modul einer anderen Demo — eine Szene, die jemand als Vorlage nimmt, bringt nichts Fremdes mit.
     b. `SeededRandom` — der Algorithmus von `InkRandom` (`SM/InkWell.ts:42-58`, mulberry32) bitgleich, mit dessen `next()` und `range(min, max)`; der Mix als modul-lokale Funktion `mix32(state)` und die Schrittweite als `const STEP = 0x6d2b79f5`, damit `randomAt` dieselben teilt:
        ```ts
        /** A small seeded generator (mulberry32): a seeded scene lays out and flickers the same on every run. */
        export class SeededRandom {
          #state: number;
          constructor(seed: number) { this.#state = seed >>> 0; }
          /** The next value, in [0, 1). */
          next(): number { this.#state = (this.#state + STEP) >>> 0; return mix32(this.#state); }
          range(min: number, max: number): number { return min + (max - min) * this.next(); }
        }
        ```
        `mix32(t)`: `t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296;` — Zeile für Zeile aus `InkRandom#next()`.
     c. `export const randomAt = (seed: number, index: number): number => mix32(((seed >>> 0) + Math.imul(index + 1, STEP)) >>> 0);` mit TSDoc: der Wert, den der `index`-te Aufruf von `next()` eines `new SeededRandom(seed)` liefert, von 0 gezählt, ohne die Aufrufe davor; ein Zufall, der an einem Zeitschritt hängt (`Math.floor(time * rate)`) statt am Frame, sodass jede Frame-Rate zur selben Zeit dieselben Werte zieht.
     d. `export function smoothstepCpu(e0: number, e1: number, x: number): number` — Körper wie `SM/CrawlRig.ts:53-56`, TSDoc »smoothstep on the CPU, with the formula of GLSL and WGSL; `e0 < e1`.« Name mit `Cpu`, weil `CrematoriumWindow`, `Crawlspace` u. a. `smoothstep` aus `three/tsl` importieren.
     e. `hash21` aus `SM/FoundFootage.ts:327-335` samt seinem TSDoc (der Grund gegen `sin()`), Rückgabetyp `Node<'float'>` statt des lokalen Alias `FloatNode`.
     f. `multiply()` und `additive()` aus `SM/FoundFootage.ts:301-325` samt TSDoc, unverändert (die Kopie `SM/RiftMembrane.ts:251-262` ist Zeichen für Zeichen dieselbe Funktion).
  2. **Die Szenen auf `helpers.ts` umstellen** (ARCH-001). Jede Kopie fällt in ihrer Datei weg; Imports, die danach ungenutzt sind (`CustomBlending`, `OneFactor`, `ZeroFactor`, `DstColorFactor`, `AddEquation`, `dot`, `fract`, `sin`, …), gehen mit.
     - `SM/InkWell.ts:41-58`: `InkRandom` samt TSDoc fällt weg; `:86` `readonly #rng: SeededRandom;`, `:89` `new SeededRandom(seed)`.
     - `SM/CrematoriumWindow.ts:21`, `SM/MirrorShatter.ts:25`, `SM/Trench.ts:38`: `import {SeededRandom} from './helpers';` statt `InkRandom` aus `./InkWell`; `new InkRandom(` → `new SeededRandom(` (`CrematoriumWindow.ts:134`, `:309`; `MirrorShatter.ts:204`; `Trench.ts:156`, `:280`), Parametertypen `rng: InkRandom` → `rng: SeededRandom` (`MirrorShatter.ts:302`, `:425`). Seeds bleiben, die Folgen sind bitgleich (Probe `helpers.probe.ts`).
     - `SM/CrematoriumWindow.ts:403-406` `smooth()` fällt weg, die Aufrufe `:367`, `:369`, `:384` rufen `smoothstepCpu`. `:187-197` wird `const furnace = additive(new MeshBasicNodeMaterial());` — dieselben Einstellungen (`AddEquation` ist die Vorgabe); der Kommentar `:185-186` bleibt darüber stehen.
     - `SM/WardC.ts:608-612` `smoothstep01()` fällt weg, Aufruf `:588` ruft `smoothstepCpu`.
     - `SM/MothChapel.ts:202` `ease` behält Namen und Aufrufer, sein Körper wird `smoothstepCpu(0, 1, t)`.
     - `SM/CrawlRig.ts:53-56` `smoothstep` fällt weg, Aufrufe `:195-196`, `:208` rufen `smoothstepCpu`. Der Generator `:95`, `:103-107` → Schritt 3.
     - `SM/WardRig.ts:64-74` `mulberry32()` fällt weg; `:117` wird `readonly #random = new SeededRandom(307);` mit dem TSDoc von `:64` darüber, die Aufrufe `:144-146` `this.#random()` → `this.#random.next()`. Dieselbe Folge wie bisher.
     - `SM/FoundFootage.ts`: `#seed` `:109` und `random()` `:111-114` → `readonly #random = new SeededRandom(31);` und `random(): number { return this.#random.next(); }` (Aufrufer `InkVignette`, `ForestLevel` bleiben). `scatter()` `:223-230` fällt weg, `:247` wird `const random = new SeededRandom(seed);`, Aufrufe `random()` → `random.next()`. `multiply()`/`additive()` `:301-325` und `hash21` `:327-335` fallen weg, importiert aus `./helpers` (Aufrufe `:439`, `:495`, `:504`).
     - `SM/Camcorder.ts:30`: `hash21` aus `./helpers`; `FootageClock`, `makeFootageStage`, `VIEW_HEIGHT` weiter aus `./FoundFootage` (dieselbe Demo-Seite).
     - `SM/RiftMembrane.ts`: `#seed` `:67-68` und `random()` `:70-73` → `readonly #random = new SeededRandom(7);` mit dem Kommentar von `:67`, `random()` delegiert wie in FoundFootage. `additive()` `:251-262` fällt weg, `:285` nutzt den aus `./helpers`.
     - `SM/DeepListening.ts:51`: `additive` aus `./helpers`, `makeRiftStage`, `RiftState`, `WORLD` weiter aus `./RiftMembrane`. `scatter()` `:331-338` fällt weg, `:389` und `:518` werden `new SeededRandom(1234)` bzw. `new SeededRandom(4321)`, Aufrufe → `.next()`.
     - `SM/MothChapel.ts`: `#seed` `:229` und `random()` `:241-244` → `readonly #random = new SeededRandom(17);`, `random()` delegiert (Aufrufer `RoseWindow`).
     - `SM/PaintedMoor.ts:237-241` und `:424-428`: die Inline-Generatoren werden `const random = new SeededRandom(20231031);` bzw. `new SeededRandom(777)`, Aufrufe → `random.next()`.
     - Ergebnis: in `SM/` importiert keine Datei mehr aus dem Modul einer anderen Demo. Was bleibt, ist demo-intern und bleibt: `DrownedHouse` → `InkWell` (`makeInkStage`, beide Demo `matte-ink`), `Camcorder`/`InkVignette` → `FoundFootage`, `DeepListening` → `RiftMembrane`, `Crawlspace` → `CrawlRig`, `PaintedMoor` → `PaintingHallway`, `RoseWindow` → `MothChapel`, `MirrorShatter` → `MirrorBathroom`, `Trench` → `Sonar`, `WardC` → `WardRig`.
  3. **Zufall an die Zeit binden** (BUG-011).
     a. `SM/CrawlRig.ts`: `#seed` `:95` und `#random()` `:103-107` fallen weg; neu `readonly #random = new SeededRandom(1);` mit dem Satz »the flicker's timing, the same on every run«. Modulkonstanten neben `CAMERA_LEAD`:
        ```ts
        /** how often the stuttering battery may switch, per second: a clock of its own, so every frame rate shows the same stutter */
        const STUTTER_RATE = 20;
        /** the seed of the stutter, apart from the one that times the flicker */
        const STUTTER_SEED = 101;
        ```
        Der Batterie-Block `:157-168` wird:
        ```ts
        // the battery: a stutter now and then, out for a moment, back — timed from when the flicker
        // was due and not from the frame that noticed it, so every frame rate keeps the same schedule;
        // switched off, the next flicker waits and comes at once when it is switched on again
        if (!this.flicker) this.#nextFlicker = Math.max(this.#nextFlicker, this.time);
        else if (this.time >= this.#nextFlicker) {
          this.#flickerUntil = this.#nextFlicker + 0.9 + this.#random.next() * 0.8;
          this.#nextFlicker = this.#flickerUntil + 8 + this.#random.next() * 9;
        }
        if (this.flicker && this.time < this.#flickerUntil) {
          const left = this.#flickerUntil - this.time;
          // a few hard stutters, and the last half second all but out
          this.power = left < 0.5 ? 0.04 : randomAt(STUTTER_SEED, Math.floor(this.time * STUTTER_RATE)) > 0.45 ? 1 : 0.15;
        } else {
          this.power += (1 - this.power) * (1 - Math.exp(-dt * 12));
        }
        ```
        Die Werte 1, 0.15 und 0.04 bleiben (die Probe liest sie). `rig.flicker` schaltet die GUI um (`pages/demos/stage-masks-flashlight.astro:182`) — daher die erste Zeile.
     b. `SM/FoundFootage.ts` (`FootageClock#update()`): Modulkonstanten
        ```ts
        /** how often the picture jumps while the signal is lost, per second: a clock of its own */
        const JUMP_RATE = 20;
        /** the seed of the jumps, apart from the one of the clock */
        const JUMP_SEED = 103;
        ```
        `:133` wird `this.#nextGlitch += 13 + this.random() * 6;` (`+=` statt `=`: der Überhang des Frames bleibt im Zeitplan, sonst wandert jeder Termin um bis zu einen Frame — Kommentar dazu in einer Zeile). `:139` wird `this.swayY += (randomAt(JUMP_SEED, Math.floor(t * JUMP_RATE)) - 0.5) * 26;`. `figureX` `:143` zieht weiter aus `this.random()` — ein Ereignis, kein Frame.
     c. `SM/MothChapel.ts:771` (Dazu, gleiche Ursache — die Rast zieht pro Frame aus der Folge der Uhr, die auch `RoseWindow` speist): Modulkonstante `/** how often a flying moth settles on the stone, per second: once in 25 s on average */ const SETTLE_RATE = 0.04;` und `const flightOf = (clock: SeanceClock): number => -Math.log(1 - clock.random()) / SETTLE_RATE;` (TSDoc: die Sekunden Flug bis zur nächsten Rast, einmal je Flug gezogen — dieselbe Rate wie ein Wurf pro Frame mit `dt * SETTLE_RATE`, aber unabhängig von der Frame-Rate). `interface Moth` `:634-647` bekommt `/** seconds of flight before it next settles */ flight: number;`, das Literal `:721-732` `flight: 0`; nach der Schleife `:712-735` eine zweite: `for (const moth of this.#moths) moth.flight = flightOf(clock);` mit Kommentar »drawn after every moth is placed: the flights take no draw from the layout«. `:771` wird
        ```ts
        m.flight -= dt;
        if (m.flight <= 0) {
          m.rest = 2 + clock.random() * 5;
          m.flight = flightOf(clock);
        }
        ```
  4. **Steigung im Bild abtasten** (BUG-010), `SM/heatHaze.ts`:
     a. `:71-79` wird (Namen frei, aber die Coverage wird genau fünfmal gelesen, zuerst bei `uv` — die Probe zählt):
        ```ts
        // the coverage here and at four points SLOPE_STEP away (8 px on the card), held inside the
        // picture: outside [0, 1] the coverage of a mask is 0, and a point beyond the edge would read
        // a rim the heat does not have. The difference over the distance between the two points is
        // the slope of the air, in coverage per picture height — over twice SLOPE_STEP inside, and at
        // the edge on the one side that lies in the picture
        const dx = vec2(float(SLOPE_STEP).div(wide), 0);
        const dy = vec2(0, SLOPE_STEP);
        const c = heat.coverage(uv);
        const xPlus = clamp(uv.add(dx), 0, 1);
        const xMinus = clamp(uv.sub(dx), 0, 1);
        const yPlus = clamp(uv.add(dy), 0, 1);
        const yMinus = clamp(uv.sub(dy), 0, 1);
        const slope = vec2(
          heat.coverage(xPlus).sub(heat.coverage(xMinus)).div(xPlus.x.sub(xMinus.x).mul(wide)),
          heat.coverage(yPlus).sub(heat.coverage(yMinus)).div(yPlus.y.sub(yMinus.y)),
        );
        ```
        Abweichung von der Empfehlung (nur `clamp`): geteilt wird durch den tatsächlichen Abstand der geklemmten Punkte, nicht durch `2 * SLOPE_STEP` — sonst halbiert sich die Steigung genau am Rand. Innen ist der Abstand `2 * SLOPE_STEP` (x: `2 · SLOPE_STEP / wide` in uv, mal `wide`), also unverändert; nie 0, solange `SLOPE_STEP / wide < 0.5`. `clamp(vec2, 0, 1)` liefert unter @types/three 0.187 `Node<'vec2'>` (`MathNode.d.ts:695-700`), `.x`/`.y` typen.
     b. TSDoc von `heatHaze()` `:45-58`, im Punkt »It bends both pictures«, ein Satz dazu: die vier Punkte bleiben im Bild — die Coverage einer Maske ist außerhalb `[0, 1]` 0, ein Punkt jenseits des Randes läse einen Rand, den die Hitze nicht hat —, am Rand wird die Steigung einseitig genommen; wer in einem eigenen Effekt die Steigung einer Coverage nimmt, braucht dasselbe.
     c. `pages/demos/_stage-masks-heat-haze.json`, `description`: nach »…so the bend looks the same at any device pixel ratio)« den Einschub », held inside the picture — at its edges the slope is taken on the side that lies inside —« vor »and its slope pushes the uv of both pictures«.
  5. **Ein Hash für alles Korn** (CONS-001), über `hash21` aus `./helpers`:
     - `SM/DrownedHouse.ts:188` → `const grain = hash21(sc.add(vec2(frame.mul(1.37), frame.mul(7.11))));` (die Form von `FoundFootage`).
     - Dazu, gleiche Ursache, dieselbe Folie: `:189` → `const scratchX = hash21(vec2(frame, 3.7)).mul(WORLD_W).add(WORLD.left);`, `:192` → `smoothstep(0.82, 0.86, hash21(vec2(frame, 11.9)))` — zwei verschiedene zweite Koordinaten, damit Lage und Auftreten des Kratzers nicht gekoppelt sind.
     - `SM/MirrorBathroom.ts:136` → wie `DrownedHouse.ts:188`.
     - Dazu, gleiche Ursache: `SM/PaintedMoor.ts:130-131` → `const h1 = hash21(cell);` und `const h2 = hash21(cell.add(vec2(17.3, 5.1)));` (Versatz wie `Camcorder.ts:361`). Die Sterne stehen danach an anderen Stellen ihrer Zellen — gewollt, siehe »Bewusst so«.
  6. **`deltaTime`-Kappungen streichen** (READ-001). `Math.min(deltaTime, 0.1)` fällt an jeder dieser Stellen weg, das `deltaTime` des Displays ist schon auf `maxDeltaTime` (1/30 s) gekappt (`packages/twopoint5d/src/display/Display.ts:391-397`, `:1241-1257`), und keine Seite des Lookbooks setzt `maxDeltaTime`:
     `SM/CrawlRig.ts:110`, `SM/CrematoriumWindow.ts:205`, `:335`, `SM/DeepListening.ts:440`, `:667`, `:757`, `SM/PaintingHallway.ts:267`, `SM/PaintedMoor.ts:452`, `SM/RiftMembrane.ts:84`, `SM/InkVignette.ts:105`, `SM/FoundFootage.ts:117`, `SM/InkWell.ts:97`, `SM/Sonar.ts:89`, `:261`, `SM/RoseWindow.ts:185`, `SM/MirrorBathroom.ts:149`, `SM/Trench.ts:182`, `SM/DrownedHouse.ts:206`, `:370`, `SM/MothChapel.ts:247`, `:751` — und dazu, gleiche Ursache: `pages/demos/stage-masks-resolution.astro:205`, `demos/rope-bridge/RopeBridge.ts:417`, `demos/ui-panels/DungeonScreen.ts:397`.
     Form: wo eine Funktion `const dt = Math.min(deltaTime, 0.1);` schreibt, heißt ihr Parameter danach `dt` und die Zeile entfällt; ein Ausdruck wie `this.time.value += Math.min(deltaTime, 0.1)` wird `+= deltaTime`; ein Listener `this.#update(Math.min(deltaTime, 0.1))` wird `this.#update(deltaTime)`. Keine Zwischenvariable `const dt = deltaTime`. Kein `display.maxDeltaTime` auf einer Seite — keine Demo lebt etwas anderes vor.
  7. **Statische Attribute nicht als dynamisch deklarieren** (READ-002). Position und Rotation sind von Haus aus dynamisch (`packages/twopoint5d/docs/sprites.md:1181-1182`; `InstancePosition.ts:35`, `Rotation.ts:12`):
     `SM/FoundFootage.ts:255` und `:405` — `attributeUsage` fällt ganz weg; `:423` → `{dynamic: ['color']}`; `SM/DrownedHouse.ts:328` → `{dynamic: ['color']}`; `SM/DeepListening.ts:155` → `{dynamic: ['size', 'color']}`; `SM/Crawlspace.ts:519` → `{dynamic: ['size', 'color']}`; dazu (im Audit nicht gelistet, dasselbe Finding) `SM/PaintingHallway.ts:188` → `{dynamic: ['size', 'color']}`.
  8. **Casts auflösen** (TYPE-001, TYPE-002). Unter @types/three 0.187 liefert `uniform(0)` `UniformNode<"float">` = `UniformNode<'float', number>`, `uniform(new VectorN())` `UniformNode<"vecN">` (`UniformNode.d.ts:136-155`); `bloom()` nimmt `UniformNode<"float"> | number` und liefert `BloomNode extends Node<"vec4">` (`examples/jsm/tsl/display/BloomNode.d.ts:3`, `:37-42`).
     a. ` as unknown as UniformNode<…>` streichen, Typ aus der Inferenz: `SM/CrematoriumWindow.ts:115`, `SM/InkWell.ts:84`, `:90`, `SM/MirrorBathroom.ts:92`, `:93`, `SM/DrownedHouse.ts:235`, `SM/MirrorShatter.ts:167`, `:169`, `:176`, `:177`, `SM/heatHaze.ts:60`, `SM/SeancePhotographs.ts:147`, `:149`, `:164`, `SM/Sonar.ts:68`, `:173`. Explizite Feldtypen (`HeatHazeEffect.strength`, der Parameter `scale` von `fogCoverage()` `SeancePhotographs.ts:181`) bleiben und passen.
     b. `SM/MirrorShatter.ts:242` → `bloom(picture, this.bloomStrength, 0.6, 0.55)`; `:245` → `picture.rgb.add(glow.rgb)`. Abweichung von der Empfehlung (die den `bloom()`-Cast kommentiert behalten wollte): unter 0.187 ist er unnötig. `:240` `scenePass as Node<'vec4'>` bleibt, mit der Kommentarzeile aus c.
     c. `SM/WatchingWallpaper.ts:372-389`: der lokale Typ `Vec4` fällt weg. Der Builder verengt einmal, mit Kommentar:
        ```ts
        return (passes: Node[]): Node => {
          // the renderer hands its passes as `Node`; each is the vec4 picture of a Stage2D
          const [room, haunted, glow] = passes as Node<'vec4'>[];
          …
          const masked = createMaskNode(haunted!, glow!, {source, invert});
          const composed = masked.rgb.add(room!.rgb.mul(float(1).sub(masked.a)));
          const light = glow!.rgb.mul(LIGHT_GAIN).add(vec3(AMBIENT, AMBIENT * 0.95, AMBIENT * 1.08));
          …
          return vec4(composed.mul(light).mul(vignette), 1);
        };
        ```
        `createMaskNode()` liefert `Node<'vec4'>` (`packages/twopoint5d/src/stage/maskNodes.ts:66-70`), sein Parameter ist `Node | null | undefined`.
     d. Dazu, gleiche Ursache (lokaler `Vec4`, `as unknown as` hinein und hinaus um einen Builder): `demos/stage-transitions/glowLayerBuilder.ts:10-27` — `type Vec4` fällt weg, `const pictures = passes as Node<'vec4'>[];` mit derselben Kommentarzeile, `composed` als `Node<'vec4'>` über `pictures`, `glow.rgb` ohne Cast, `return output;`. Der Cast der Funktion `as GlowLayerBuilder` `:28` bleibt (er hängt `dispose` an).
     e. Regel für alles in a–d: kein `as unknown as` bleibt in `SM/` und in `glowLayerBuilder.ts`. Erlaubt ist je Builder die eine kommentierte Verengung von `passes`. Reicht @types/three 0.187 an einer Stelle wirklich nicht, steht dort ein einziges `as` (nicht `as unknown as`) mit einem Kommentar, warum, und der Report nennt die Stelle.
  9. **Abschluss.** `pnpm format`, dann diese Greps — jeder ohne Treffer:
     ```bash
     grep -rn "as unknown as" apps/lookbook/src/demos/stage-masks apps/lookbook/src/demos/stage-transitions/glowLayerBuilder.ts
     grep -rn "Math.min(deltaTime" apps/lookbook/src
     grep -rnE "InkRandom|mulberry32|16807|1664525|43758|12\.9898|function smooth\(|smoothstep01|const smoothstep = " apps/lookbook/src/demos/stage-masks
     grep -rnE "attributeUsage: \{dynamic: \[[^]]*'(position|rotation)'" apps/lookbook/src
     grep -rnE "from '\./(InkWell|FoundFootage|RiftMembrane)'" apps/lookbook/src/demos/stage-masks | grep -E "InkRandom|hash21|additive|multiply"
     ```
     Dann die Proben aus Schritt 0 erneut — alle vier grün —, dann das Verify. Beide Ausgaben in den Report.
- Bewusst so (Zug 0, mit Grund):
  - **Ein Generator, mulberry32.** ARCH-001 verlangt einen PRNG. Zwei Algorithmen tragen heute gesetzte Kompositionen: mulberry32 (`InkRandom`: Tintenkleckse, Spiegel-Scherben mit Seed 1931, Krematorium, Trench; `mulberry32()` in WardRig) und Park-Miller (`FootageClock`, `RiftState`, `SeanceClock`, `scatter()` ×2, PaintedMoor ×2). mulberry32 behält die statischen Kompositionen der Matte-Demos bitgleich (Probe), nimmt jeden Seed (auch 0) und hat den vollen 32-Bit-Zustand. Die Park-Miller-Szenen behalten ihre Seeds und ziehen danach eine andere, wieder feste Folge: andere Streuung der Waldreihen, Partikel, Motten, Heide-Büsche und Staubflocken. Kein Seed ist im Code als gewählte Komposition markiert (zugesagt ist nur »the same on every run«, `WardRig.ts:64`, `InkWell.ts:41`); statisch ist davon nur die Heide in PaintedMoor, deren Pfad-Ausweichung (`:243-247`) bleibt.
  - **Vorschaubilder bleiben.** Die Demos `stage-masks-shared`, `-rift`, `-frozen`, `-portal` zeigen nach diesem Paket eine andere zufällige Anordnung als ihr Vorschaubild. `pnpm lookbook:generate-previews` braucht einen WebGPU-Adapter, schreibt Binärdateien und gehört nicht zum Gate; das Vorschaubild zeigt einen Moment der Szene, keine zugesagte Anordnung. Nicht laufen lassen.
  - **Atlas-UV-Funktionen gehen an Paket 13.** Der Atlas-Teil von ARCH-001 (je Szene ein eigenes `AtlasJson` samt UV-Rechnung: `frameOf` `FoundFootage.ts:192`, `MothChapel.ts:174`; `frameUv`/`setFrame` `DeepListening.ts:133`/`:142`; `frameGeometry`/`setSpriteFrame` `Crawlspace.ts:217`/`:232`; `setFrame` `WardC.ts:89`, `PaintingHallway.ts:164`) ist genau der Gegenstand von CONS-002 (Paket 13), dessen Empfehlung ihn durch `TextureStore` und `texturePackerAtlasAdapter` ersetzt. Hier umziehen hieße, ihn in Paket 13 wieder abzureißen. Steht als »Dazu« bei Paket 13 im Plan; ARCH-001 schließt erst mit Paket 13.
  - **Grenze des »Dazu«:** gleiche Ursache im Lookbook wird mitgenommen (`glowLayerBuilder.ts`, drei `deltaTime`-Kappungen außerhalb von `SM/`, `MothChapel.ts:771`, `DrownedHouse.ts:189/:192`, `PaintedMoor.ts:130-131`, `PaintingHallway.ts:188`). Dasselbe Muster in der Library (`uniform()`-Casts, Sinus-Hash von `dissolve()`) ist eine eigene Oberfläche mit eigenem CHANGELOG und eigener Prüfung → »Offene Befunde« im Plan.
  - **Kein Regressionstest im Repo.** Das Lookbook hat keine Testoberfläche (`apps/lookbook/package.json`: nur `astro check`; die Script-Tests lesen Lookbook-Quellen als Text). Eine anzulegen wäre eine dritte Testoberfläche neben den zweien in `AGENTS.md` (»Two test surfaces«) — nicht Sache dieses Pakets. Rot/grün belegen die Proben in `$W/paket-12-probe/`.
- Nicht anfassen (geprüft im Zug 0):
  - `SM/SoftBlobs.ts` — Baustein mehrerer Demos und von `demos/stage-transitions/matteMasks.ts`, eigenes Modul mit Grund.
  - Eigene, nicht doppelte Kleinhelfer: `MirrorShatter.ts:109-110` (`easeOut`, `clamp01`), `RoseWindow.ts:32` (`easeInOut`), die beiden `litMaterial()` (`Crawlspace.ts:208`, `PaintingHallway.ts:370` — verschiedene Funktionen), `worldUv` (`DrownedHouse.ts:115`, `Trench.ts:98` — je eigene `WORLD`), `VIEW_WIDTH`/`VIEW_HEIGHT` und die `makeStage`-Fabriken je Demo.
  - `demos/stage-transitions/matteMasks.ts:49` — `Math.sin` auf der CPU in doppelter Genauigkeit, nicht der GPU-Defekt von CONS-001.
  - `pages/demos/stage-masks-matte-threshold.astro:197`/`:201` (`as unknown as number[]`/`string[]` für lil-gui) — eigene Ursache (readonly-Tupel gegen lil-gui), Eintrag in »Offene Befunde«.
  - Die Atlas- und Loader-Funktionen der Szenen (Paket 13), die `fetch`-Aufrufe (BUG-012, Paket 13), die Steuerung der Matte-Seiten (READ-004, Paket 13).
- Verify: `pnpm run ci && (cd packages/twopoint5d && ./node_modules/.bin/vitest run --config /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-12-probe/vitest.config.mjs)` — das Gate baut `dist/`, die Proben importieren es danach
- Commit: `fix(lookbook): share one seeded random and the shader helpers among the stage mask demos, keep their flicker off the frame rate, take the slope of the heat haze inside the picture and drop casts and delta caps that change nothing`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · `SM/` seit d9b648bf unberührt, alle Fundstellen an ihren Zeilen · ARCH-001 unverändert (zehn Fundstellen), Atlas-Teil an Paket 13 (CONS-002) · BUG-010 unverändert `heatHaze.ts:76-78` · BUG-011 unverändert `CrawlRig.ts:165`, `FoundFootage.ts:139`, dazu `MothChapel.ts:771` · READ-001 unverändert, 21 Stellen in `SM/` statt 12, dazu drei außerhalb · READ-002 unverändert, dazu `PaintingHallway.ts:188` · CONS-001 unverändert, dazu `DrownedHouse.ts:189/:192`, `PaintedMoor.ts:130-131` · TYPE-001 unverändert, `MirrorShatter.ts:242/:245` unter 0.187 ohne Cast lösbar · TYPE-002 unverändert, dazu `stage-transitions/glowLayerBuilder.ts` · Proben `$W/paket-12-probe/` angelegt, alle vier rot (`$W/paket-12.zug0-probe.log`) · keine offene `Folgen:`-Zeile im Plan · kein Eintrag in »Offene Befunde« teilt eine Ursache · drei neue Nebenbefunde nach »Offene Befunde« · Restplan: Paket 13 bekommt den Atlas-Teil von ARCH-001, Reihenfolge unverändert
  - 2026-11-01 Zug 1: Implementierer beauftragt (Runde 0, `sonnet`, effort medium, Report `$W/paket-12.impl-0.json`)
  - 2026-11-01 Zug 2: Report FERTIG_MIT_VORBEHALT (geänderte Dateien nicht ganz gelesen) · 28 Dateien (neu `SM/helpers.ts`, 22 weitere in `SM/`, `glowLayerBuilder.ts`, `RopeBridge.ts`, `DungeonScreen.ts`, `stage-masks-resolution.astro`, `_stage-masks-heat-haze.json`) · Proben vorher alle vier rot, nachher 33/33 · Arbeitsbaum schmutzig · Verify exit=0 (`$W/paket-12.verify.log`)
  - 2026-11-01 Zug 3: Reviewer beauftragt (`sonnet`, effort medium), Diff `$W/paket-12.diff`
  - 2026-11-01 Zug 3: Review `$W/paket-12.review-0.json` — alle acht Findings behoben, 0 kritisch, 0 wichtig, 4 klein · keine Fehlerkette (0 Runden)
  - 2026-11-01 Zug 5: committet 0beb1f44 (29 Pfade unter `apps/lookbook/src/`), Verify aus Zug 2 (`$W/paket-12.verify.log`, exit=0, keine Änderung seither), Trailer `Remediation-Run: 2026-10-31`

## Urteil des Reviewers (Zug 3)

- ARCH-001 (ohne Atlas-Teil): behoben — `SM/helpers.ts` mit `SeededRandom`, `randomAt`, `smoothstepCpu`, `hash21`, `multiply`, `additive`; `InkRandom` fort, `smoothstep`-Kopien in `CrawlRig`, `CrematoriumWindow`, `WardC`, `MothChapel` (`ease`) rufen `smoothstepCpu`; Atlas-Teil offen bis Paket 13
- BUG-010: behoben — `heatHaze.ts` klemmt die vier Abtastpunkte mit `clamp` und teilt durch den Abstand der geklemmten Punkte; TSDoc und `_stage-masks-heat-haze.json` ergänzt
- BUG-011: behoben — `CrawlRig.ts:84-93`, `:159-171` (`STUTTER_RATE`, `randomAt`, Zeitplan ab `#nextFlicker`); `FoundFootage.ts:55-57`, `:133-134` (`JUMP_RATE`, Termin mit `+=`); `MothChapel.ts` (`SETTLE_RATE`, `flightOf`)
- READ-001: behoben — `Math.min(deltaTime` im Lookbook ohne Treffer, auch `RopeBridge.ts`, `DungeonScreen.ts`, `stage-masks-resolution.astro`
- READ-002: behoben — kein `position`/`rotation` mehr in `attributeUsage` (`FoundFootage`, `DrownedHouse`, `DeepListening`, `Crawlspace`, `PaintingHallway`)
- CONS-001: behoben — `DrownedHouse`, `MirrorBathroom`, `PaintedMoor` über `hash21`
- TYPE-001: behoben — alle `uniform()`-Casts fort, `bloom()` in `MirrorShatter` ohne Cast; `scenePass as Node<'vec4'>` bleibt mit Kommentar
- TYPE-002: behoben — `Vec4` in `WatchingWallpaper` fort, kommentierte Verengung `passes as Node<'vec4'>[]`; `glowLayerBuilder.ts` ebenso, `as GlowLayerBuilder` bleibt; `as unknown as` ohne Treffer

Kleine Befunde (keine Runde):
- `Trench.ts:36-38`, `PaintedMoor.ts:31`: relative Imports nicht hinter `three/*` und `~demos/*` einsortiert
- `helpers.ts`: Modul-TSDoc steht als zweiter Doc-Block vor `STEP` (besser `/* … */` oder `@packageDocumentation`)
- `heatHaze.ts` TSDoc »It bends both pictures«: Gedankenstrich vor Komma, sehr lange Zeile
- `helpers.ts`: `SeededRandom.range()` ohne TSDoc

Nebenbefunde des Implementierers (beide vorbestehend, nach »Offene Befunde«): `fitIntoRectangle.spec.ts:331-408` — der Helfer `fit` löst `noFocusedTests` aus (an d9b648bf `:315ff.` schon so); `ProjectionPlane.spec.ts:16` `noIdenticalTestTitle`. `TextureCoords.spec.ts:109` stand schon in der Queue.

## Abgleich (Zug 0, gegen 06c8ccb7)

`apps/lookbook/src/demos/stage-masks/` ist seit d9b648bf unberührt (`git log d9b648bf..HEAD -- apps/lookbook/src/demos/stage-masks/` leer); seit Laufbeginn hat sich im Lookbook nur `README.md` und `package.json` bewegt. three und @types/three stehen auf 0.187.0 — das ändert die Lage für TYPE-001 (`bloom()`), nicht für die übrigen.

- **ARCH-001** — unverändert. `import {InkRandom} from './InkWell'` in `CrematoriumWindow.ts:21`, `MirrorShatter.ts:25`, `Trench.ts:38` (das Audit nannte Trench nicht); PRNG-Kopien `CrawlRig.ts:95/:103-107` (LCG), `FoundFootage.ts:109-114`, `RiftMembrane.ts:67-73`, `MothChapel.ts:229/:241-244` (Park-Miller, die beiden letzten im Audit nicht genannt), `scatter()` `FoundFootage.ts:223-230`, `DeepListening.ts:331-338`, inline `PaintedMoor.ts:237-241`, `:424-428`, `mulberry32()` `WardRig.ts:64-74`; smoothstep-Kopien `CrawlRig.ts:53`, `CrematoriumWindow.ts:403`, `WardC.ts:609`, `MothChapel.ts:202` (`ease`); Blend-Helfer `FoundFootage.ts:302/:315`, `RiftMembrane.ts:252`, inline `CrematoriumWindow.ts:187-197`; `Camcorder.ts:30` holt `hash21` aus FoundFootage.
- **BUG-010** — unverändert `heatHaze.ts:76-78` (Abtastung), `:101` (Klemmung nur des Endpunkts). Probe rot: die vier Punkte sind `OperatorNode:+`/`:-`.
- **BUG-011** — unverändert `CrawlRig.ts:165`, `FoundFootage.ts:139`. Probe rot: Batterie 5 Fenster bei 60 Hz, 4 bei 144 Hz, Umschaltungen 18/33/14/28 gegen 40/43/37/85; Signalverlust 97 gegen 231 Sprünge, Termine ab dem dritten verschoben (42,28 gegen 38,9 s), `figureX` verschieden. Dazu `MothChapel.ts:771`: ein Wurf pro Frame und fliegender Motte aus der Folge, aus der auch `RoseWindow` (`:137-164`) zieht. Zusätzlich gefunden: auch die Ereignis-Termine wandern um bis zu einen Frame je Ereignis (`CrawlRig.ts:159` rechnet von `this.time`, `FoundFootage.ts:133` setzt `=`) — gleiche Ursache, in Schritt 3 mitbehoben.
- **READ-001** — unverändert; 21 Stellen in `SM/` (Audit: 12 — es fehlten `PaintingHallway.ts:267`, `PaintedMoor.ts:452`, `RiftMembrane.ts:84`, `Sonar.ts:89/:261`, `RoseWindow.ts:185`, `Trench.ts:182`, `MothChapel.ts:247/:751`), dazu `stage-masks-resolution.astro:205`, `RopeBridge.ts:417`, `DungeonScreen.ts:397`, alle von `OnStageUpdateFrame` bzw. `onRenderFrame` des Displays gespeist (`StageRenderer.ts:449-450`), alle an d9b648bf vorhanden.
- **READ-002** — unverändert an allen sechs Stellen; dazu `PaintingHallway.ts:188` (`position`, `rotation`).
- **CONS-001** — unverändert `DrownedHouse.ts:188`, `MirrorBathroom.ts:136`; dazu in derselben Folie `DrownedHouse.ts:189/:192` (Sinus eines Frame-Zählers) und `PaintedMoor.ts:130-131` (Sternzellen, Argumente bis ~2·10⁴).
- **TYPE-001** — unverändert an allen elf Stellen. Unter 0.187: `uniform(0)` → `UniformNode<"float">` (= `<'float', number>`), `bloom(node, UniformNode<"float"> | number)` → `BloomNode extends Node<"vec4">`; damit sind auch `MirrorShatter.ts:242/:245` lösbar.
- **TYPE-002** — unverändert `WatchingWallpaper.ts:373-387`, `SeancePhotographs.ts:147/:149/:164`, `Sonar.ts:68/:173`; dazu `stage-transitions/glowLayerBuilder.ts:10/:21/:22/:24/:27` (an d9b648bf `:24/:27`, im Audit nur in der Dateiliste der Methodik).
- **Folgen und Offene Befunde** — keine offene `Folgen:`-Zeile (alle verteilt oder »keine«); kein Eintrag in »Offene Befunde« liegt im Lookbook. Neu nach »Offene Befunde«: die wirkungslosen `uniform()`-Casts der Library, der Sinus-Hash von `dissolve()`, die lil-gui-Casts in `stage-masks-matte-threshold.astro`.

## Findings im Volltext

**ARCH-001 · low · apps/lookbook/src/demos/stage-masks/InkWell.ts:42** — Gemeinsame Helfer der Masken-Demos in ein Modul ziehen
Weitere Fundstellen: `CrematoriumWindow.ts:21`, `MirrorShatter.ts:25`, `CrawlRig.ts:103`, `FoundFootage.ts:111`, `FoundFootage.ts:224`, `DeepListening.ts:332`, `FoundFootage.ts:315`, `CrematoriumWindow.ts:403`, `CrawlRig.ts:53`
Die Szenenmodule teilen Helfer kreuz und quer. `InkRandom` liegt in der Tinten-Demo InkWell und wird von der Krematoriums- und der Spiegel-Demo importiert. Daneben gibt es drei weitere PRNGs: eine LCG in `CrawlRig#random`, Park-Miller in `FootageClock.random` und zweimal als `scatter()` in FoundFootage und DeepListening. Es gibt zwei `smoothstep`/`smooth`-Kopien und zwei `additive()`-Materialhelfer (FoundFootage.ts:315 und der aus RiftMembrane, den DeepListening importiert). `Camcorder` hängt für `hash21` und `makeFootageStage` an FoundFootage. Eine Änderung an einer Demo kann so eine andere verschieben, und wer eine Szene als Vorlage nimmt, muss Helfer aus fremden Szenen mitschleppen.
Beleg: `import {InkRandom} from './InkWell';`
Empfehlung: Ein Modul `demos/stage-masks/shared.ts` (oder unter `~demos/utils/`) mit einem PRNG, `smoothstep`, `hash21`, den Blend-Helfern und den Atlas-UV-Funktionen; die Szenen importieren nur von dort.

**BUG-010 · low · apps/lookbook/src/demos/stage-masks/heatHaze.ts:76** — Steigung der Hitze am Bildrand einseitig abtasten
Weitere Fundstelle: `heatHaze.ts:101`
`heatHaze()` tastet die Coverage bei `uv ± dx` und `uv ± dy` ab, ohne die Abtastpunkte in [0, 1] zu halten. Laut stages.md (»An effect that reads a mask«) ist `coverage(uv)` außerhalb von [0, 1] gleich 0. In einem Randstreifen von SLOPE_STEP (8 px auf der 700-px-Karte) liest der Effekt deshalb eine künstliche Kante: bei Coverage c am Rand wird slope ≈ c / (2·SLOPE_STEP) ≈ 44·c, die Biegung slope·REFRACTION ≈ 0,2·c Bildhöhen mal `amount`. Die Säule steigt oben aus dem Bild und schließt spät auch die Seiten und den Boden; mitten im Lauf und spät (sin(π·0,8) ≈ 0,6) zieht der Streifen am oberen Rand deshalb rechnerisch Inhalt aus bis zu ~15 % Bildhöhe weiter unten heran. Das ist ein sichtbarer Schmierstreifen, und der Effekt ist das Vorzeigebeispiel für »ein Effekt, der eine Maske liest«.
Beleg: `heat.coverage(uv.add(dx)).sub(heat.coverage(uv.sub(dx))), heat.coverage(uv.add(dy)).sub(heat.coverage(uv.sub(dy)))`
Empfehlung: Die vier Abtastpunkte vor `coverage()` mit `clamp(…, 0, 1)` ins Bild holen, damit die Steigung am Rand einseitig wird statt gegen 0 zu laufen. Am besten einen Satz dazu in den JSDoc, weil Nutzer genau dieses Gradient-Muster kopieren.

**BUG-011 · low · apps/lookbook/src/demos/stage-masks/CrawlRig.ts:165** — Zufall pro Frame durch Zufall pro Zeitschritt ersetzen
Weitere Fundstelle: `FoundFootage.ts:139`
Zwei Uhren ziehen in jedem Frame eine neue Zufallszahl: die Batterie der Taschenlampe (`this.power = … this.#random() > 0.45 ? 1 : 0.15`) und der Ruck der Kamera im Signalverlust (`this.swayY += (this.random() - 0.5) * 26`). Bei 144 Hz flackert und springt das Bild 2,4-mal so oft wie bei 60 Hz, und das Stottern verwischt zu einem gleichmäßigen Dimmen. Weil dieselbe Folge auch die nächsten Flacker- und Glitch-Termine, `figureX`, die Tropfen von `InkVignette` und das Blinzeln des ForestLevel speist, hängt auch der Zeitplan von der Frame-Rate ab. Der Kommentar in CrawlRig.ts:104 »the same flicker on every run« stimmt deshalb nur bei identischem Frame-Timing. Alles andere in den Szenen ist sauber zeitbasiert, über `1 - Math.exp(-dt * k)` oder Funktionen von `t`.
Beleg: `this.power = left < 0.5 ? 0.04 : this.#random() > 0.45 ? 1 : 0.15;`
Empfehlung: Den Zufall an ein festes Zeitraster binden, etwa einen neuen Wert alle 1/20 s, solange `floor(time * 20)` sich ändert, oder eine Hash-Funktion von `floor(time * rate)`. Dann sind Stotterrate und Zeitplan unabhängig von der Frame-Rate, und der Determinismus-Kommentar stimmt wieder.

**READ-001 · low · apps/lookbook/src/demos/stage-masks/CrawlRig.ts:110** — Doppelte deltaTime-Kappung entfernen
Weitere Fundstellen: `CrematoriumWindow.ts:205`, `:335`, `DeepListening.ts:440`, `:667`, `:757`, `DrownedHouse.ts:206`, `:370`, `FoundFootage.ts:117`, `InkVignette.ts:105`, `InkWell.ts:97`, `MirrorBathroom.ts:149`
Zwölf Update-Pfade kappen `deltaTime` mit `Math.min(deltaTime, 0.1)`. Das `deltaTime` aus `OnStageUpdateFrame` kommt aber vom `Display`, dessen `maxDeltaTime` es schon auf 1/30 s kappt (Display.ts:1221, Default). Die eigene Kappung auf 0,1 s greift damit nie. Andere Pfade derselben Klassen nehmen das rohe `deltaTime` (Crawlspace.ts:387-390, Crawlspace.ts:571/576, DeepListening.ts:459-460, FoundFootage.ts:547). Als Live-Doku legt diese Mischung nahe, ein Nutzer müsse `deltaTime` selbst gegen Spikes absichern und tue das nur an manchen Stellen.
Beleg: `on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(Math.min(deltaTime, 0.1)));`
Empfehlung: Die Kappungen streichen und sich auf `Display.maxDeltaTime` verlassen. Soll eine Demo bewusst etwas anderes vorleben, gehört `display.maxDeltaTime` einmal auf die Seite, mit einem Satz Begründung.

**READ-002 · low · apps/lookbook/src/demos/stage-masks/FoundFootage.ts:255** — Default-dynamische Attribute aus `attributeUsage` streichen
Weitere Fundstellen: `FoundFootage.ts:405`, `:423`, `Crawlspace.ts:519`, `DrownedHouse.ts:328`, `DeepListening.ts:155`
Laut sprites.md (»Uploads: static and dynamic attributes«) sind Position und Rotation von Haus aus dynamisch. Trotzdem listen mehrere Pools `position` bzw. `rotation` in `attributeUsage.dynamic`; bei der Figur und den ParallaxRows ist `{dynamic: ['position']}` sogar der einzige Eintrag. Laut Guide teilt eine Geometrie mit `attributeUsage` ihren Prototyp mit keiner anderen, der Eintrag kostet also das Teilen und bewirkt nichts. Als Doku-Beispiel suggeriert er, eine bewegte Position müsse man deklarieren.
Beleg: `attributeUsage: {dynamic: ['position']},`
Empfehlung: `position` und `rotation` aus den Listen streichen; wo nichts übrig bleibt, die Option ganz weglassen. Nur `size` und `color` bleiben dort, wo sie sich pro Frame ändern.

**CONS-001 · low · apps/lookbook/src/demos/stage-masks/DrownedHouse.ts:188** — Filmkorn über `hash21()` statt Sinus-Hash erzeugen
Weitere Fundstelle: `MirrorBathroom.ts:136`
FoundFootage.ts:327-335 begründet `hash21()` ausdrücklich: Ein `sin()` großer Bildschirmkoordinaten hinterlässt auf manchen GPUs diagonale Streifen im Korn. Die TitleCard und die MirrorScene erzeugen ihr Korn trotzdem mit genau diesem Hash, `fract(sin(sc.x·12.9898 + sc.y·78.233 + …)·43758.5453)`, über `screenCoordinate`. Auf einem 4K-Canvas laufen die Koordinaten bis über 3800. Die Demos derselben Mappe widersprechen sich also in einer Frage, die eine von ihnen als sichtbaren Defekt beschreibt.
Beleg: `const grain = fract(sin(sc.x.mul(12.9898).add(sc.y.mul(78.233)).add(frame.mul(3.7))).mul(43758.5453));`
Empfehlung: `hash21(sc.add(vec2(frame.mul(1.37), frame.mul(7.11))))` aus FoundFootage verwenden. Liegt der Helfer in einem gemeinsamen Modul (siehe den Befund zu den gemeinsamen Helfern), nutzen ihn alle drei Szenen.

**TYPE-001 · low · apps/lookbook/src/demos/stage-masks/InkWell.ts:84** — Wirkungslose `as unknown as UniformNode`-Casts entfernen
Weitere Fundstellen: `InkWell.ts:90`, `CrematoriumWindow.ts:115`, `DrownedHouse.ts:235`, `heatHaze.ts:60`, `MirrorBathroom.ts:92`, `:93`, `MirrorShatter.ts:167`, `:169`, `:176`, `:177`
`uniform(0)` liefert nach @types/three 0.186 schon `UniformNode<'float', number>`, `uniform(new Vector2())` schon `UniformNode<'vec2', Vector2>`, `uniform(new Vector4())` schon `UniformNode<'vec4', Vector4>` (Overloads in UniformNode.d.ts:130-147). Die doppelten Casts auf genau diese Typen ändern also nichts, schalten aber die Typprüfung an der Stelle ab und würden einen echten Typfehler bei einer späteren Änderung verdecken. Andere Klassen desselben Slices deklarieren `uniform(0)` ohne Cast (Crawlspace.ts:493, DeepListening.ts:350, FoundFootage.ts:88). Nötig ist einzig der Cast bei `bloom(picture, this.bloomStrength as unknown as number, …)` (MirrorShatter.ts:242): Die Typen nennen dort `number`, `BloomNode` übernimmt zur Laufzeit aber einen Node (BloomNode.js:86).
Beleg: `readonly time = uniform(0) as unknown as UniformNode<'float', number>;`
Empfehlung: Die Casts streichen und, wo ein Feld exportiert wird, den Typ aus der Inferenz übernehmen. Den `bloom()`-Cast mit einem Kommentar versehen, der sagt, warum er nötig ist.

**TYPE-002 · low · apps/lookbook/src/demos/stage-masks/WatchingWallpaper.ts:373** — `as unknown as`-Casts um TSL-Knoten in den Masken-Demos auflösen
Weitere Fundstellen: `WatchingWallpaper.ts:377`, `:379`, `:382`, `:387`, `SeancePhotographs.ts:147`, `:149`, `:164`, `Sonar.ts:68`, `:173`
Der Builder von »Masks without a director« erfindet einen lokalen Typ `Vec4` und zwingt das Ergebnis von `createMaskNode()` (laut Signatur `Node<'vec4'>`) sowie die Eingangsknoten per `as unknown as Vec4` hinein, das Ergebnis per `as unknown as Node` wieder heraus. `SeancePhotographs` und `Sonar` casten `uniform(0)` doppelt auf `UniformNode<…>`, obwohl `MothChapel.ts:212` dieselbe Zuweisung ohne Cast schafft. Die Demo ist die Live-Doku von `createMaskNode()`: wer sie kopiert, übernimmt Casts, die jeden Typfehler der Komposition verschlucken.
Beleg: `const masked = createMaskNode(haunted!, glow!, {source, invert}) as unknown as Vec4;`
Empfehlung: Mit `Node<'vec4'>` und den Swizzles `.rgb`/`.a` der three-Typen arbeiten; wo die three-Typen wirklich nicht reichen, einen einzigen, kommentierten Helper-Cast an einer Stelle bündeln. Die `uniform()`-Casts streichen oder mit einem typisierten `uniform<number>(0)` ersetzen.
