# Paket 13 — Lookbook: Demo-Seiten — Start, precompile(), Transitions-Steuerung und Tasten

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des Laufs, hier die
Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-004 (medium), READ-004 (low), RES-003 (low), CONS-003 (low), BUG-013 (low) · CONS-002,
  BUG-012, READ-003 und der Atlas-Teil von ARCH-001 sind im Zug 0 nach Paket 13b geteilt (Asset-Laden
  der Masken-Szenen, siehe Plan)
- Dazu (Zug 0, vorbestehend, gleiche Ursache — an d9b648bf nachgesehen, die Seiten sind seither bis auf
  `stage-masks-resolution.astro:205` unberührt):
  - BUG-013 — jede Seite mit `onInit(async …)`, nicht nur die sechs des Audits: 21 Seiten, Liste in
    Schritt 4
  - CONS-003 — die zehn Seiten mit eigenem `.catch()` an `precompile()` sind Kopien derselben Zeile mit
    drei Wortlauten; alle 13 Aufrufe gehen über einen Helfer (Schritt 5)
  - RES-003/READ-004 — jeder `keydown`-Handler des Slices filtert anders: `rift.astro:124` und
    `spotlight.astro:149` nur Modifier (Pfeiltasten in einem Zahlenfeld von lil-gui werden per
    `preventDefault()` geschluckt, wie RES-003 es für das Game-Menu beschreibt), `frozen.astro:133-135`,
    `shared.astro:97-99`, `portal.astro:122-126`, `flashlight.astro:117-121` ohne `BUTTON`,
    `resolution.astro:236-238` mit; alle über einen Filter (Schritt 3, Schritt 9)
- Ziel: Die Demo-Seiten melden einen gescheiterten Start und ein gescheitertes `precompile()` unter
  ihrem Namen in der Konsole und über dem Canvas, die Galerie zeichnet B und ihre Masken-Stages vorab,
  die vier Matte-Seiten teilen eine Transitions-Steuerung, und jeder Tastenkürzel-Handler lässt die
  Tasten eines lil-gui-Feldes oder -Buttons diesem; das Game-Menu meldet seine Listener beim Dispose ab.
- Modell: stärkste Stufe
- Effort: medium
- Dateien:
  - neu `apps/lookbook/src/demos/utils/demoInit.ts`, `apps/lookbook/src/demos/utils/demoKeys.ts`,
    `apps/lookbook/src/demos/stage-masks/TransitionCycler.ts`
  - `apps/lookbook/src/demos/stage-transitions/matteMasks.ts`
  - `apps/lookbook/src/layouts/VanillaDemo.astro` (eine CSS-Regel)
  - `apps/lookbook/README.md` (»Adding a demo«, Punkt 2)
  - die 21 Seiten aus Schritt 4 unter `apps/lookbook/src/pages/demos/`
  - Proben außerhalb des Repos: `<ARBEITSDIR>/paket-13-probe/` mit
    `ARBEITSDIR=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad`
  - nicht: Library-Code, `CHANGELOG.md` (das Lookbook ist nicht veröffentlicht), Proposals, die
    Szenen-Loader unter `stage-masks/` (Paket 13b)

## Vorgehen

Das Lookbook hat keine Testoberfläche. Rot/grün belegen Proben außerhalb des Repos, wie in Paket 12:
die echten Lookbook-Module unter dem Vitest der Library. **Schritt 0 kommt vor jeder Änderung im
Repo.**

0. **Proben anlegen und rot sehen.** Verzeichnis `<ARBEITSDIR>/paket-13-probe/`, nicht ins Repo
   kopieren.
   - `vitest.config.mjs` wie `<ARBEITSDIR>/paket-12-probe/vitest.config.mjs` (Alias `~demos` auf
     `/home/spw/spaceland/twopoint5d/apps/lookbook/src/demos`, `three/tsl` und `three/webgpu` auf die
     three-Kopie des Lookbooks), `test: {include: ['*.probe.ts'], environment: 'node'}`.
   - `README.md` mit Zweck, Kommando und Stand, wie dort.
   - `demoInit.probe.ts` — stubbt `globalThis.document` (`querySelector('demo-ui')` liefert ein
     Fake-Element mit `append()`, das die angehängten Kinder sammelt; `createElement()` ein Objekt mit
     `className`, `textContent`, `setAttribute()`; `body.append()`), spioniert `console.error` aus und
     nimmt als Display ein Objekt `{onInit(listener) {…; return () => {};}}`, das den Listener festhält.
     Fälle:
     - `onDemoInit(display, 'stage-masks-frozen', init)` mit einem `init`, das mit
       `new Error('MothChapel: /lookbook/assets/stage-masks/frozen/window.json answered 404 Not Found')`
       ablehnt: der festgehaltene Listener, aufgerufen mit `{renderer: {}}`, resolved (kein Wurf);
       `console.error` einmal, erstes Argument `'stage-masks-frozen: the demo failed to start'`, zweites
       der Fehler; `<demo-ui>` hat genau ein Kind mit `className` `'demo-failure'`, `role` `'alert'` und
       einem `textContent`, das mit `'stage-masks-frozen failed to start: MothChapel: '` beginnt
     - dasselbe ohne `<demo-ui>` (`querySelector` liefert `null`): das Kind landet in `document.body`
     - ein `init`, das resolved: kein `console.error`, kein Kind
     - `onDemoInit()` antwortet, was `display.onInit()` antwortet
     - `catchPrecompile('stage-masks-rift', Promise.reject(error))` resolved mit `undefined`,
       `console.error` mit `'stage-masks-rift: precompile() failed, the shaders build on first use'` und
       dem Fehler; mit einem resolvenden Promise kein `console.error`
   - `demoKeys.probe.ts` — stubbt `globalThis.HTMLElement` als Klasse mit `tagName`,
     `isContentEditable` und `getAttribute(name)` aus einer Attributtabelle; Events sind Objekte mit
     `code`, `ctrlKey`, `metaKey`, `altKey`, `target`. Tabelle für `ignoredKey(event)`:
     - `true`: `KeyS` mit `ctrlKey`, mit `metaKey`, mit `altKey`; `ArrowLeft` und `KeyS` in `INPUT`
       ohne `type`, mit `type` `text`, mit `type` `number`; in `TEXTAREA`; in `SELECT`; in einem `DIV`
       mit `isContentEditable`; `Space`, `Enter`, `NumpadEnter` auf `BUTTON`; `Space` auf `INPUT`
       `checkbox` und auf `INPUT` `color`
     - `false`: `KeyS` und `Space` auf einem `CANVAS`; ein `target`, das kein `HTMLElement` ist (das
       Fenster); `ArrowLeft` und `KeyS` auf `BUTTON`; `KeyS` und `ArrowUp` auf `INPUT` `checkbox`
   - `galleryMattes.probe.ts` — `new GalleryMattes()` aus `~demos/stage-transitions/matteMasks`:
     `maskStages` hat zwei verschiedene Einträge, und ihre Menge ist genau die Menge
     `mask.stage` über `effect.masks` aller Effekte in `mattes.effects`; danach `mattes.dispose()`.
     Voraussetzung: `packages/twopoint5d/dist` ist gebaut (`pnpm build:twopoint5d`, falls er fehlt —
     nie parallel zu `pnpm run ci`). Lässt sich `GalleryMattes` unter Node nicht bauen, entfällt diese
     Probe, und der Report sagt es mit der Fehlermeldung
   - `transitionCycler.probe.ts` — der Vertrag aus Schritt 7 an Fakes: `globalThis.window` mit
     `addEventListener`/`removeEventListener`, die die Handler sammeln; ein Display mit
     `onRenderFrame(listener)`, das den Listener festhält und ein Unsubscribe liefert, das ihn
     vergisst; ein Director mit `stack` und `replace(from, to, opts)`, das ein Fake-Transition-Objekt
     (`from`, `to`, `manual`, `progress`, `elapsed`, `duration`, `cancel(jumpTo)`, `finished`) liefert,
     dessen `finished` der Test von Hand auflöst; ein lil-gui-Fake, dessen `add()` eine Kette
     `name()/onChange()/listen()/disable()` liefert und die Aufrufe protokolliert. Fälle: `play()` ruft
     `replace(stages[0], stages[1])` mit `effect()`, `settings.duration`, `settings.easing`,
     `manual: false`; zweites `play()` während des Laufs tut nichts; `onBegin` vor `effect()`, beide
     vor `replace()`; `settings.scrub = true; setScrub()` bricht einen Lauf mit `cancel('end')` ab und
     beginnt einen mit `manual: true` und `progress = settings.progress`; `scrub = false; setScrub()`
     bricht ihn bei `progress` 0.6 mit `'end'`, bei 0.4 mit `'start'` ab; `restart()` ohne Lauf von Hand
     tut nichts, mit einem bricht es ihn mit `'start'` ab und beginnt einen neuen von Hand; `onEnd` nur
     für den Lauf, der noch `running` ist; der Zyklus beginnt nach `hold` Sekunden Frame-Zeit, nicht
     während `scrub`; Space ruft `play()`, `KeyS` schaltet `settings.scrub` um, `keys.KeyK` wird gerufen,
     ein Event mit `ctrlKey` oder `repeat` tut nichts; nach `dispose()` ist der Key-Handler abgemeldet,
     der Frame-Listener vergessen, und ein später aufgelöstes `finished` ruft kein `onEnd`
   - Lauf: `cd /home/spw/spaceland/twopoint5d/packages/twopoint5d && ./node_modules/.bin/vitest run
     --config <ARBEITSDIR>/paket-13-probe/vitest.config.mjs > <ARBEITSDIR>/paket-13.probe-red.log 2>&1`.
     Erwartet rot: die drei neuen Module fehlen, `maskStages` ist `undefined`. Der rote Lauf gehört in
     den Report.

1. **`apps/lookbook/src/demos/utils/demoInit.ts` (neu).** Imports `import type {Display,
   DisplayEventProps} from '@spearwolf/twopoint5d';`, sonst nichts.
   - `export function onDemoInit(display: Display, demo: string, init: (props: DisplayEventProps) =>
     Promise<void>): () => void` — gibt zurück, was `display.onInit(listener)` liefert. Der Listener:
     `try { await init(props); } catch (error) { showDemoFailure(demo, error); }`.
   - modul-lokal `function showDemoFailure(demo: string, error: unknown): void`:
     `console.error(`${demo}: the demo failed to start`, error)`; dann ein `<p>` mit `className`
     `'demo-failure'`, `role="alert"` und `textContent`
     `` `${demo} failed to start: ${error instanceof Error ? error.message : String(error)}. The console has the details.` ``,
     angehängt an `document.querySelector('demo-ui') ?? document.body` (`first-sprite.astro` hat kein
     `<demo-ui>`; `getDemoUi()` würde dort werfen und die Ablehnung zurückbringen).
   - `export function catchPrecompile(demo: string, precompile: Promise<void>): Promise<void>` —
     `precompile.catch((error: unknown) => { console.error(`${demo}: precompile() failed, the shaders build on first use`, error); })`.
   - Jede `console.error`-Zeile mit einem `biome-ignore` darüber, wie auf den Seiten heute: in
     `showDemoFailure` `// biome-ignore lint/suspicious/noConsole: a demo that fails to start names the error in the devtools, beside the line over its canvas`,
     in `catchPrecompile` der Wortlaut der Seiten,
     `// biome-ignore lint/suspicious/noConsole: a failed precompile() is worth a line in the devtools, the page goes on`.
   - TSDoc an beiden Exporten, Englisch, mit dem Warum: `Display` emittiert `OnDisplayInit` und wartet
     das Promise eines async Listeners nicht ab, eine Ablehnung hört sonst niemand, der Canvas bleibt in
     der Clear-Farbe und die GUI erscheint nicht; ein `precompile()`, das scheitert, lässt die Seite
     laufen, die Shader bauen beim ersten Gebrauch. Beim Preview-Generator steht die Zeile in der
     Konsole, die er bei einem Timeout mit ausgibt.
2. **CSS in `apps/lookbook/src/layouts/VanillaDemo.astro`**, im `<style is:global>` außerhalb des
   `@layer` hinter den lil-gui-Regeln, mit einem Kommentar wie die Nachbarregeln:
   `.demo-failure { position: fixed; left: 1rem; bottom: 1rem; z-index: var(--demo-layer-ui); max-width: min(36rem, calc(100% - 2rem)); margin: 0; padding: 0.75rem 1rem; border-radius: 0.5rem; background: rgb(0 0 0 / 0.82); color: #ffb3a7; font: 13px / 1.45 ui-monospace, 'SFMono-Regular', Menlo, monospace; }`.
3. **`apps/lookbook/src/demos/utils/demoKeys.ts` (neu)** —
   `export function ignoredKey(event: KeyboardEvent): boolean`, Reihenfolge:
   1. `event.ctrlKey || event.metaKey || event.altKey` → `true` (ein Kürzel des Browsers)
   2. `event.target` kein `HTMLElement` (das Fenster, das Dokument) → `false`
   3. `target.isContentEditable`, `tagName` `TEXTAREA` oder `SELECT` → `true`
   4. `tagName` `BUTTON`, oder `INPUT` mit `type` in einem modul-lokalen
      `PRESSED_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image'])`
      → `true` genau für `event.code` `Space`, `Enter`, `NumpadEnter` (die Tasten, die ihn drücken),
      sonst `false`: ein Pfeil auf einem fokussierten Button steuert weiter die Demo
   5. jedes andere `INPUT` → `true` (`type` über
      `(target.getAttribute('type') ?? 'text').toLowerCase()`, ein `<input>` ohne `type` ist ein
      Textfeld)
   6. sonst `false`

   `event.repeat` bleibt Sache der Seite: Bewegungstasten brauchen die Wiederholung für ihr
   `preventDefault()`. Keyup-Handler filtern nicht — eine Taste, die in einem Feld losgelassen wird,
   lässt die gehaltene Eingabe trotzdem los. TSDoc mit genau dieser Regel und dem Grund (lil-gui baut
   Zahlen- und Textfelder als `<input type="text">`, Checkboxen als `<input type="checkbox">`, Funktionen
   und Ordnertitel als `<button>`).
4. **`onDemoInit()` auf jeder Seite mit `onInit(async …)`.** Demo-Name = Dateiname ohne `.astro` (=
   Route). Nur der Aufruf ändert sich, der Rumpf bleibt:
   `display.onInit(async ({renderer}) => {` → `onDemoInit(display, '<name>', async ({renderer}) => {`
   und `});` am Ende des Listeners → `});` (unverändert, da `onDemoInit` dieselbe Klammerung hat).
   `textured-sprites.astro:38` ruft `demo.onInit(` an einem `PerspectiveOrbitDemo` (eine `Display`) →
   `onDemoInit(demo, 'textured-sprites', …)`. `crosses.astro:34` (`demo.onInit(() => {`, synchron)
   bleibt. Die Seiten: `boomer-shooter-corridor`, `first-sprite`, `platformer`, `rope-bridge`,
   `sine-scroller`, `textured-sprites`, `ui-panels`, `stage-masks-flashlight`, `stage-masks-frozen`,
   `stage-masks-heat-haze`, `stage-masks-matte-3d`, `stage-masks-matte-ink`,
   `stage-masks-matte-threshold`, `stage-masks-portal`, `stage-masks-resolution`, `stage-masks-rift`,
   `stage-masks-shared`, `stage-masks-spotlight`, `stage-masks-without-director`,
   `stage-transitions-gallery`, `stage-transitions-game-menu`. Import
   `import {…} from '~demos/utils/demoInit';` bei den übrigen `~demos/utils/…`-Imports.
   `first-sprite.astro` ist die Lehrseite: über dem Aufruf ein Kommentar im Ton der Seite, dass ein
   Ladefehler unter dem Namen der Demo in der Konsole und über dem Canvas steht, weil `Display` das
   Promise eines async Listeners nicht abwartet.
5. **`catchPrecompile()` an jedem `director.precompile()`** — die 13 Stellen:
   `stage-masks-resolution.astro:253-258`, `-rift:197`, `-shared:129-134`, `-flashlight:193-196`,
   `-frozen:156-159`, `-portal:199-204`, `-spotlight:224`, `-matte-3d:242-248`,
   `-matte-threshold:273-278`, `-matte-ink:224-229`, `-heat-haze:177-182`,
   `stage-transitions-gallery.astro:100-105`, `stage-transitions-game-menu.astro:155`. Form:
   `const precompiled = catchPrecompile('<name>', director.precompile(renderer, shapes, {…}));`; das
   eigene `.catch()` samt `biome-ignore` und `console.error` entfällt. `matte-3d` hängt sein
   `.finally(() => shatter.afterPrecompile())` an das Ergebnis von `catchPrecompile()`. Kommentare
   über den Aufrufen bleiben.
6. **BUG-004.** In `matteMasks.ts` an `GalleryMattes` ein Getter
   `get maskStages(): readonly Stage2D[] { return [this.#ink.stage, this.#noise.stage]; }` mit TSDoc:
   die Masken-Stages beider Mattes, für `layers` von `precompile()` — keine liegt im Stack, also baut
   nur ein Zeichnen vorab ihre Materialien vor der ersten Transition durch sie. In
   `stage-transitions-gallery.astro` der Aufruf
   `catchPrecompile('stage-transitions-gallery', director.precompile(renderer, [['layer', 'layer'], ...[...effects.values()].map((effect): StageDirectorShape => [effect, 'layer'])], {layers: [b.stage, ...mattes.maskStages]}))`;
   der Kommentar `:98-99` sagt danach dazu, dass B, das noch nicht im Stack liegt, und die beiden
   Masken-Stages einmal vorab zeichnen. Der Kommentar `matteMasks.ts:62` (»precompile() draws the mask
   stage before its first update«) ist damit wahr und bleibt.
7. **READ-004 — `apps/lookbook/src/demos/stage-masks/TransitionCycler.ts` (neu).** Imports nur Typen aus
   `@spearwolf/twopoint5d` (`Display`, `IStage`, `StageDirector`, `StageTransition`,
   `StageTransitionEasing`, `StageTransitionEffect`) und `lil-gui` (`import type GUI from 'lil-gui'`),
   dazu `ignoredKey` aus `~demos/utils/demoKeys`.

   ```ts
   export interface TransitionCyclerSettings {
     duration: number;
     easing: StageTransitionEasing;
     cycle: boolean;
     scrub: boolean;
     progress: number;
   }

   export interface TransitionCyclerOptions {
     display: Display;
     director: StageDirector;
     /** the two pictures the slot changes between; the first one is in the slot at the start */
     stages: readonly [IStage, IStage];
     /** their names in the readout "in the slot", in the order of `stages` */
     names: readonly [string, string];
     /** the settings the GUI writes: the page's own object, which may carry more */
     settings: TransitionCyclerSettings;
     /** how long a picture holds before the next run while `cycle` is on, in seconds */
     hold: number;
     /** the effect of a run, asked as the run begins, after `onBegin` */
     effect: () => StageTransitionEffect;
     /** the progress the readout shows: that of the mask the effect of the run reads */
     progress: () => number;
     /** the name of that readout, as `heat.progress` */
     progressName: string;
     /** called as a run begins, before `effect()` and `replace()` */
     onBegin?: (from: IStage, to: IStage) => void;
     /** called as the run on the screen ends, before the readouts are written */
     onEnd?: () => void;
     /** further shortcuts of the page by `KeyboardEvent.code`, beside Space, Enter and S */
     keys?: Readonly<Record<string, () => void>>;
   }
   ```

   `export class TransitionCycler` mit `constructor(options: TransitionCyclerOptions)`, alle Felder
   `#private`:
   - Konstruktor: `#readout = {slot: names[0], time: '—', progress: progress().toFixed(3)}`, merkt sich
     die gezeigten Werte wie `stage-masks-matte-ink.astro:86-89`; abonniert
     `display.onRenderFrame(({deltaTime}) => …)` (Unsubscribe merken) und
     `window.addEventListener('keydown', #onKeyDown)`.
   - Frame: `if (settings.cycle && !settings.scrub && !#running) { #hold -= deltaTime; if (#hold <= 0) #begin(false); }`,
     dann `#describe()`.
   - `#describe()`: schreibt `slot`, `time` und `progress` nur, wenn sich der gezeigte Wert ändert, wie
     `stage-masks-matte-3d.astro:104-122` — `slot` aus `running ? running.from/to : director.stack[0]`
     über die Namen (`from → to` während eines Laufs), `time` in Tausendsteln (-1 kein Lauf → `'—'`, -2
     Lauf von Hand → `'by hand'`), `progress` aus `options.progress()` in Tausendsteln.
   - `#begin(manual: boolean): void`: `from = director.stack[0] === stages[1] ? stages[1] : stages[0]`,
     `to` der andere; `onBegin?.(from, to)`;
     `director.replace(from, to, {effect: effect(), duration: settings.duration, easing: settings.easing, manual})`;
     bei `manual` `transition.progress = settings.progress`; `#running = transition`;
     `transition.finished.then((t) => { if (#disposed) return; if (#running === t) { #running = undefined; onEnd?.(); } #hold = hold; #describe(); })`.
   - `get running(): StageTransition | undefined`.
   - `play()`: `if (#running || settings.scrub) return; #begin(false);`
   - `setScrub()`: folgt `settings.scrub` — an: `#running?.cancel('end'); #running = undefined; #begin(true);`;
     aus, mit einem Lauf von Hand: `cancel(progress >= 0.5 ? 'end' : 'start')`.
   - `restart()`: `if (!#running?.manual) return; #running.cancel('start'); #running = undefined; #begin(true);`
     — ein Lauf von Hand beginnt mit den neuen Optionen neu, an derselben Stelle des Reglers, in
     derselben Richtung (`cancel('start')` lässt `from` im Slot, `StageTransition#cancel()`); ein Lauf
     der Uhr behält seine.
   - `holdAt(progress: number)`: `settings.cycle = false; settings.progress = progress; settings.scrub = true; setScrub();`
     — für die Karte des Lookbooks.
   - `addControls(gui: GUI, duration: {min: number; max: number}): void` hängt in dieser Reihenfolge an:
     `duration` (`min`, `max`, `0.1`, Name `'duration (s)'`), `easing`
     (`['linear', 'ease-in', 'ease-out', 'ease-in-out']`), `{play: () => this.play()}` als
     `'play (space)'`, `cycle` als `'cycle by itself'`, `scrub` als `'scrub by hand (s)'` mit
     `.onChange(() => this.setScrub()).listen()`, `progress` (`0`, `1`, `0.001`, Name
     `'transition.progress'`, `onChange`: `if (#running?.manual) #running.progress = settings.progress`),
     dann die drei Readouts `'in the slot'`, `'time / duration'`, `progressName`, je
     `.disable().listen()`.
   - `#onKeyDown(event)`: `if (ignoredKey(event) || event.repeat) return;` Space oder Enter →
     `event.preventDefault(); play();`, `KeyS` → `settings.scrub = !settings.scrub; setScrub();`, sonst
     `keys?.[event.code]?.()`.
   - `dispose()`: `#disposed = true`, Key-Listener ab, Frame-Abo ab; ein danach aufgelöstes `finished`
     tut nichts.
   - Klassen-TSDoc, Englisch: wofür (die Transitions-Steuerung der Matte-Seiten: ein Slot, zwei Bilder,
     abspielen, von Hand scrubben, im Kreis), dass die Seite Effekt, Bilder und Hooks liefert.

   Die vier Seiten nehmen die Steuerung auf; was sie davor selbst taten, entfällt (`running`, `hold`,
   `readout` der drei Standard-Werte, `describe`, `begin`, `play`, `setScrub`, die Standard-Controller,
   `onKeyDown` samt `FORM_TAGS`, im `onDispose` `window.removeEventListener('keydown', …)`, das durch
   `cycler.dispose()` ersetzt wird, vor `gui.destroy()`). Eigene Controller hängt die Seite vor
   `cycler.addControls()` an, eigene Readouts danach, und schreibt sie wie der Cycler nur bei Änderung.
   Die Vorschau ruft `cycler.holdAt()` mit dem `progress`, den die Seite heute in ihrem Vorschau-Block
   setzt (je Seite unten). Auf allen vier Seiten `display`, `director`,
   `settings` (das Objekt der Seite) und `hold: HOLD`. Je Seite:
   - `stage-masks-heat-haze.astro`: `stages: [snow.stage, ash.stage]`, `names: ['snow', 'ash']`,
     `hold: HOLD`, `effect: () => haze`, `progress: () => heat.mask.progress`,
     `progressName: 'heat.progress'`; `strength` vor, Readout `bend` (`strength·sin πp` wie `:81`) nach
     `addControls(gui, {min: 1, max: 12})`; Vorschau `holdAt(0.42)`.
   - `stage-masks-matte-3d.astro`: `runningMask` bleibt auf der Seite;
     `onBegin: () => { shatter.setScene(settings.scene); runningMask = settings.reads === 'look (luminance)' ? byLook : byCoverage; shatter.follow(runningMask); }`,
     `effect: () => (runningMask === byLook ? throughLook : throughCoverage)`,
     `progress: () => runningMask.progress`, `progressName: 'mask.progress'`,
     `stages: [bathroom.stage, reflection.stage]`, `names: ['the bathroom', 'the reflection']`; `scene` und `reads` vor den Standard-Controllern mit
     `.onChange(() => cycler.restart())` (ersetzt `restartScrub`), `bloom` dazwischen wie heute;
     Readouts `mask` und `reads` nach `addControls(gui, {min: 0.6, max: 10})`; Vorschau `holdAt(0.42)`.
   - `stage-masks-matte-ink.astro`: `stages: [title.stage, hall.stage]`,
     `names: ['title card', 'the drowned hall']`, `effect: () => inkIn`, `progress: () => ink.progress`,
     `progressName: 'ink.progress'`,
     `onBegin: (_from, to) => { if (!isPreview) layout.scatter(); edge.running = true; if (to === title.stage) hall.pointer = undefined; }`,
     `onEnd: () => { edge.running = false; }`; die Seite meldet `display.onRenderFrame(({deltaTime}) => layout.advance(deltaTime))`
     **vor** dem Bau des Cyclers an (die Uhr der Tinte läuft vor dem Zyklus, wie heute in einem
     Handler); `wetEdge` vor `addControls(gui, {min: 0.4, max: 8})`; Vorschau `holdAt(0.55)`.
   - `stage-masks-matte-threshold.astro`: `runningSoftness` bleibt auf der Seite;
     `stages: [survey.stage, thing.stage]`, `names: ['survey', 'the thing']`,
     `onBegin: (_from, to) => { if (to === thing.stage) thing.wake(); runningSoftness = settings.softness; hud.softness.value = runningSoftness; hud.running = true; }`,
     `onEnd: () => { hud.running = false; }`, `effect: () => effects.get(runningSoftness)!`,
     `progress: () => ping.progress`, `progressName: 'ping.progress'`, `keys: {KeyK: nextKind}` mit
     `nextKind` aus `:262-263`; `softness` mit `.onChange(() => cycler.restart())` (ersetzt
     `setSoftness`), `kind` und `scope` vor `addControls(gui, {min: 0.5, max: 10})`, Readout
     `softness` danach; `field.update(deltaTime)` meldet die Seite vor dem Cycler an, `onFrame`
     (Caption) bleibt; Vorschau: `settings.kind`/`field.kind` wie heute, dann `holdAt(0.5)`.

   Die beiden Casts `SOFTNESS as unknown as number[]` und `SONAR_KINDS as unknown as string[]`
   (`:197`, `:201`) bleiben stehen — sie stehen unter »Offene Befunde« mit anderer Ursache.
8. **RES-003 — `stage-transitions-game-menu.astro`.** `const canvas = getFullscreenCanvas();` einmal;
   die drei Listener als benannte Konstanten `onKeyDown`, `onKeyUp`, `onClick` (= `start`);
   `onKeyDown` beginnt mit `if (ignoredKey(event)) return;`, der Rest wie `:123-131`; `onKeyUp`
   unverändert ohne Filter; im `display.onDispose()` vor `gui.destroy()`
   `window.removeEventListener('keydown', onKeyDown)`, `…('keyup', onKeyUp)`,
   `canvas.removeEventListener('click', onClick)`. Space auf dem fokussierten Button »start (enter)«
   drückt ihn damit genau einmal.
9. **Die übrigen Tasten-Handler des Slices über `ignoredKey()`** — erste Zeile des `keydown`-Handlers:
   - `stage-masks-frozen.astro:134-135`, `-shared:98-99`, `-resolution:237-238`:
     `if (ignoredKey(event) || event.repeat) return;` statt Modifier-Zeile und `tagName`-Zeile
   - `-portal:122-128`, `-flashlight:117-123`: die lokale `ignored`-Funktion entfällt,
     `if (ignoredKey(event)) return;`
   - `-rift:124-126`, `-spotlight:149-151`: `withModifier` entfällt, `if (ignoredKey(event)) return;`

   `event.repeat`-Prüfungen weiter unten in den Handlern bleiben, Keyup-Handler bleiben.
10. **`apps/lookbook/README.md`, »Adding a demo«, Punkt 2** — am Ende ein Absatz, Englisch, im Ton des
    README: ein `onInit`, das wartet, geht über `onDemoInit(display, '<name>', …)` aus
    `src/demos/utils/demoInit.ts`, das einen Fehler unter dem Namen der Demo in der Konsole und über
    dem Canvas zeigt; ein `director.precompile()` über `catchPrecompile('<name>', …)` aus derselben
    Datei; ein Tastenkürzel fragt zuerst `ignoredKey(event)` aus `src/demos/utils/demoKeys.ts`, sodass
    eine Taste in einem Feld von lil-gui oder auf einem seiner Buttons dort bleibt.
11. **Proben grün, dann das Gate.** Proben wie in Schritt 0, Ausgabe nach
    `<ARBEITSDIR>/paket-13.probe-green.log`, dann `pnpm run ci`. Vorher `pnpm format`, falls Biome die
    Formatierung meldet. Die Seiten jede ganz lesen, bevor du sie verlässt.

- Verify: `pnpm run ci`; dazu die Proben: `cd /home/spw/spaceland/twopoint5d/packages/twopoint5d &&
  ./node_modules/.bin/vitest run --config
  /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-13-probe/vitest.config.mjs`
  (nach dem Gate, `dist` ist dann gebaut)
- Commit: `fix(lookbook): show a demo that fails to start over its canvas, catch every failed precompile(), draw the mask stages of the gallery ahead, drive the matte demos through one transition cycler and leave the keys of a field or button to it`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · BUG-004 unverändert (`stage-transitions-gallery.astro:100-105`,
    `matteMasks.ts:143-155` ohne Getter) · READ-004 unverändert (`heat-haze:90-132`,
    `matte-3d:134-191`, `matte-ink:111-163`, `matte-threshold:134-193`) · RES-003 unverändert
    (`game-menu:122`/`:133`/`:137`, `onDispose` `:166-176`) · CONS-003 unverändert (`rift:197`,
    `spotlight:224`, `game-menu:155`) · BUG-013 unverändert, um eine Zeile verschoben (`frozen:44-45`,
    `flashlight:56-57`, `portal:46-47`, `spotlight:60-61`, `gallery:63-64`, `game-menu:48-49`) ·
    geteilt: CONS-002, BUG-012, READ-003, Atlas-Teil ARCH-001 → Paket 13b · Dazu: 15 weitere Seiten
    mit async `onInit`, 10 weitere `precompile()`-Stellen, 7 weitere Tasten-Handler · keine offene
    Folge · Offene Befunde: keiner teilt eine Ursache, Eintrag `matte-threshold.astro:197/:201`
    bleibt (Begründung unten)
  - 2026-11-01 Zug 1: Implementierer beauftragt (opus, effort medium, `paket-13.impl-0.json`)
  - 2026-11-01 Zug 2: Report FERTIG_MIT_VORBEHALT (`stages` als `StageDirectorLayer`-Tupel statt `IStage`, `replace()` verlangt es) · neu `demoInit.ts`, `demoKeys.ts`, `TransitionCycler.ts`, geändert `matteMasks.ts`, `VanillaDemo.astro`, `apps/lookbook/README.md`, 21 Seiten · Proben rot (`paket-13.probe-red.log`, 4/4 Dateien) → grün 47/47 · Arbeitsbaum schmutzig · Verify läuft (`paket-13.verify.log`)
  - 2026-11-01 Zug 2: Verify des Runners exit=0 (Gate grün, Proben 4 Dateien / 47 Tests grün), Log `paket-13.verify.log`
  - 2026-11-01 Zug 3: Reviewer (opus, effort medium, `paket-13.review-0.json`) »Gesamt: ok«, alle fünf Findings behoben, zwei kleine Befunde · Diff `paket-13.diff`
  - 2026-11-01 Zug 4: keine Runde (nur kleine Befunde)
  - 2026-11-01 Zug 5: Commit 353a7dbd (27 Dateien), Verify aus Zug 2 trägt ihn · Plan auf `[x]`, sechs Nebenbefunde (fünf Einträge) in »Offene Befunde«

## Entscheidungen des Zugs 0, mit Grund

- **Teilung 13 / 13b.** Die acht Findings des Grobplans sind zwei Ursachen-Familien in zwei
  Dateigruppen: was die Seiten beim Start und im Betrieb tun (hier), und wie die zwölf Szenen-Module
  unter `stage-masks/` ihre Assets laden (13b: CONS-002, BUG-012, READ-003, der Atlas-Teil von
  ARCH-001). Zusammen wären es rund 40 Dateien ohne Testoberfläche in einem Diff; getrennt prüft der
  Reviewer jede Hälfte für sich. 13 bleibt das laufende Paket, wie 11 beim Schnitt von 11b. 13b hängt
  an 13, weil beide dieselben Seiten anfassen (13 den Rahmen von `onInit`, 13b die Dispose-Zeilen) und
  `onDemoInit()` die Ladefehler zeigt, die 13b mit Datei und Status benennt.
- **BUG-013 auf allen 21 Seiten, nicht auf sechs.** Die Ursache — ein async Listener von
  `OnDisplayInit`, dessen Promise `Display` nicht abwartet (`Display.ts:1123` emittiert synchron;
  nur ein synchroner Wurf erreicht `start()`, TSDoc `:198-202`) — steckt in jeder
  Seite mit `onInit(async …)`, auch außerhalb des Masken-Slices. Ein Helfer für alle statt `try/catch`
  je Seite: die zweite Option der Empfehlung, und sie hält die nächste Seite von der Kopie fern.
  `first-sprite.astro` geht mit, mit Kommentar, weil sie als Vorlage gelesen wird.
- **Sichtbare Meldung mit Fallback auf `document.body`.** `first-sprite.astro` hat kein `<demo-ui>`;
  `getDemoUi()` würfe im `catch` und brächte genau die unbehandelte Ablehnung zurück. Unter
  `?preview=1` ist `<demo-ui>` versteckt; der Preview-Generator sieht den Fehler als Konsolenzeile und
  läuft in seinen Timeout (`scripts/lookbook/generateDemoPreviews.mjs:84`), statt ein Bild einer
  kaputten Demo zu schreiben — `preview.ready()` wird im Fehlerfall bewusst nicht gerufen.
- **CONS-003 über einen Helfer an allen 13 Stellen.** Die zehn vorhandenen `.catch()` sind Kopien mit
  drei Wortlauten (»on first use«, »on their first frame«, »the first frame builds the shader
  instead«); vereinheitlicht auf »the shaders build on first use«, den Wortlaut von acht Seiten.
- **BUG-004: `layers: [b.stage, ...mattes.maskStages]`, wie empfohlen, ohne A und Label.** A und das
  Label liegen im Stack und zeichnen im ersten Frame der Seite, vor jeder Transition; was dort baut,
  ist der Start, kein Ruckler einer Transition. B liegt nicht im Stack und baut sonst im ersten Frame
  der ersten Transition, die Masken-Stages ebenso. Der Getter heißt `maskStages`, weil die Seite die
  Stages für `layers` braucht, nicht die `StageMask`s.
- **Ein Tastenfilter für jeden Handler des Slices, Buttons nur für Space und Enter.** Der Filter von
  `heat-haze` nimmt `BUTTON` ganz aus; übernommen hieße das: nach einem Klick auf einen Button von
  lil-gui behält er den Fokus, und die Pfeiltasten von `rift`, `spotlight`, `portal`, `flashlight` und
  dem Game-Menu bewegten nichts mehr, bis man in den Canvas klickt. Ein Button und eine Checkbox
  gehören nur die Tasten, die sie drücken; ein Text- oder Zahlenfeld, ein Select und ein editierbares
  Element jede. Das ändert das Verhalten auf allen zwölf Seiten in dieselbe Richtung: Space auf einem
  Button drückt nur ihn (vorher auf neun Seiten zusätzlich das Kürzel), `KeyS` auf einer Checkbox
  gehört der Demo (vorher verschluckt).
- **READ-004 wie empfohlen, Readouts nur bei Änderung.** Die Empfehlung (`TransitionCycler` unter
  `stage-masks/`) passt auf den Code, wie er steht; Paket 12 hat dort `helpers.ts` angelegt, der
  Cycler bekommt eine eigene Datei, weil er eine Klasse mit Zustand ist und kein Helfer. Von den zwei
  Arten, die Readouts zu schreiben, gewinnt die von `matte-3d`/`matte-ink` (nur bei Änderung): sie baut
  keine Strings pro Frame. Die Reihenfolge der GUI ändert sich auf zwei Seiten — `wetEdge` (ink) und
  `scope` (threshold) rücken vor `duration` —, weil der Cycler die Standard-Controller als Block
  anhängt; ein Block mit Einschubstelle wäre für zwei Zeilen mehr API als Gewinn.
  `setSoftness()` der Threshold-Seite prüft vor dem Neustart `director.stack[0] !== toward`; nach
  `cancel('start')` liegt laut `StageTransition#cancel()` immer `from` im Slot, die Prüfung greift nie
  und entfällt mit `restart()`.
- **Proben statt Regressionstests im Repo**, wie in Paket 12: das Lookbook hat keine Testoberfläche,
  und eine Browser-Probe gegen den Dev-Server stünde in keinem Verhältnis zu low-Befunden. Was die
  Proben nicht erreichen — die Verdrahtung in den `.astro`-Seiten (`layers` der Galerie, das Abmelden
  im Game-Menu) —, prüft der Reviewer am Diff gegen diesen Plan; `astro check` im Gate hält die Typen.
- **Modell stärkste Stufe.** 21 Seiten und drei neue Module ohne Test, der eine verrutschte Zeile
  fängt; die Parität der vier Matte-Seiten hängt an Reihenfolgen (`onBegin` vor `effect()`, Frame-
  Handler der Seite vor dem Cycler). Effort `medium`: Signaturen, Werte und Schritte stehen hier.

## Abgleich der offenen Befunde und Folgen

- `Folgen:` der erledigten Pakete: keine offen (die von 1, 4, 5 und 11 sind verteilt, 12 hat keine).
- »Offene Befunde«: nur ein Eintrag betrifft das Lookbook,
  `stage-masks-matte-threshold.astro:197/:201` (`as unknown as` für lil-gui). Ursache: `as const`-Tupel
  gegen die veränderbaren Listen von lil-gui — keine der Ursachen dieses Pakets. Die Zeilen bleiben
  auf der Seite stehen (die Controller `softness` und `kind` sind seitenspezifisch und wandern nicht in
  den Cycler) und verschieben sich mit Schritt 7; der Eintrag bleibt in der Queue.
- Neu im Zug 0 aufgefallen und hier aufgenommen: die »Dazu«-Punkte oben, alle vorbestehend (an
  d9b648bf derselbe Code) mit gleicher Ursache. Kein neuer Eintrag für »Offene Befunde«.

## Restplan

- 13b neu hinter 13 (Begründung oben). Sonst ändert sich nichts: hinter 13b steht kein offenes Paket;
  der Abschluss mit der Drain-Runde folgt.

## Findings im Volltext

**BUG-004 · medium · apps/lookbook/src/pages/demos/stage-transitions-gallery.astro:101** — Masken-Stages
und zweite Szene in `precompile()` der Galerie unter `layers` mitgeben
Die Galerie kompiliert alle Effekt-Shapes, gibt aber kein `options.layers` mit. Laut
`StageDirector#precompile()` (StageDirector.ts:1055-1062) und Guide §»No hitch: precompile() with masks«
zeichnen nur die Stages aus `layers` vorab; die Mask-Stages von `GalleryMattes` (Ink-Blots, Boiling
Noise) und `b.stage`, das noch nicht im Stack liegt, bauen ihre Materialien also erst im ersten Frame
ihrer Transition. Der Kommentar verspricht das Gegenteil (»the gallery shows each one without the hitch
of its first shader build«), und `matteMasks.ts:62` lädt den Blob-Pool eigens hoch, weil `precompile()`
ihn vorab zeichnen soll — was hier nie passiert. Wer die Seite als Vorlage nimmt, lernt die Shape-Liste
ohne `layers`.
Beleg: `director.precompile(renderer, [['layer', 'layer'], ...[...effects.values()].map(...)])` — ohne
drittes Argument
Empfehlung: `{layers: [b.stage, ...mattes.maskStages]}` übergeben; dafür in `GalleryMattes` einen Getter
`maskStages` (bzw. `stages`) auf die beiden Mask-Stages exportieren.

**READ-004 · low · apps/lookbook/src/pages/demos/stage-masks-heat-haze.astro:90** (auch
`stage-masks-matte-3d.astro:134`, `stage-masks-matte-ink.astro:111`,
`stage-masks-matte-threshold.astro:134`) — Transitions-Steuerung der Matte-Seiten in einen gemeinsamen
Helper ziehen
Vier Seiten tragen dieselbe Steuerung in eigener Kopie: `running`/`hold`, `begin(manual)` mit
`director.replace()` und `finished.then(...)`, `play()`, `setScrub()` mit
`cancel('end')`/`cancel(progress >= 0.5 ? 'end' : 'start')`, den Cycle im `onRenderFrame`, den
Keydown-Handler für Space/Enter/S, den `isPreview`-Block und die GUI-Zeilen für
duration/easing/play/cycle/scrub/progress — je rund 80 Zeilen. Die Kopien laufen bereits auseinander:
`heat-haze` nimmt `BUTTON` aus den Tastenkürzeln aus (Space auf einem fokussierten lil-gui-Button
drückt ihn), die drei anderen nicht; `matte-3d` und `matte-ink` schreiben die Readouts nur bei
Änderung, `heat-haze` und `matte-threshold` jeden Frame. Eine Korrektur an der Scrub-Logik muss viermal
gleich gelingen.
Beleg: `running?.cancel('end');\n running = undefined;\n begin(true);` (identisch in allen vier Seiten)
Empfehlung: Einen `TransitionCycler` unter `apps/lookbook/src/demos/stage-masks/` anlegen, der
Stack-Lesen, `begin/play/scrub/cancel`, Hold-Zyklus, Tastenfilter und die Standard-GUI-Controller
kapselt; die Seiten liefern nur Effekt, die beiden Szenen und ihre Zusatz-Hooks (`wake()`, `scatter()`,
`follow()`).

**RES-003 · low · apps/lookbook/src/pages/demos/stage-transitions-game-menu.astro:122** (auch `:133`,
`:137`) — Tasten- und Klick-Listener der Game-Menu-Seite in `display.onDispose()` abmelden
Als einzige Seite des Slices meldet `stage-transitions-game-menu` ihre `keydown`-/`keyup`-Listener auf
`window` und den `click` auf dem Canvas als anonyme Funktionen an und im `onDispose` nie ab. Nach
`display.dispose()` ruft Enter/Klick weiter `start()` → `director.replace()` auf einem disposten
Director, Escape `director.push()`. Der Handler filtert außerdem weder Modifier noch Formularfelder wie
alle anderen Seiten: Pfeiltasten in einem lil-gui-Zahlenfeld werden per `preventDefault()` geschluckt,
ein `q` im Feld beendet das Spiel, Space auf der fokussierten Start-Schaltfläche löst `start()` doppelt
aus. Die Seite ist die Live-Doku zu »From the menu into the game«. Weil das Lookbook ohne Client-Router
navigiert (voller Dokumentwechsel), wirkt das Leck heute nicht; es steckt im Vorbild-Code, den Nutzer
in eine SPA übernehmen.
Beleg: `window.addEventListener('keydown', (event) => {` … `getFullscreenCanvas().addEventListener('click', start);`
— der `onDispose`-Block entfernt keinen davon
Empfehlung: Handler als benannte Konstanten anlegen, im `display.onDispose()` entfernen (oder ein
`AbortController`-Signal an alle drei `addEventListener` geben und im Dispose `abort()` rufen) und
denselben `ignored(event)`-Filter wie die Masken-Seiten verwenden.

**CONS-003 · low · apps/lookbook/src/pages/demos/stage-masks-rift.astro:197** (auch
`stage-masks-spotlight.astro:224`, `stage-transitions-game-menu.astro:155`) — Rejection von
`director.precompile()` auf allen Seiten abfangen
Elf Seiten hängen an `precompile()` ein `.catch()` mit einer `console.error`-Zeile und lassen die Seite
weiterlaufen. `rift`, `spotlight` und `game-menu` nicht: schlägt `precompile()` fehl, wirft das
`await precompiled` im async `onInit`-Listener, dessen Promise niemand awaitet — eine unbehandelte
Rejection ohne Demo-Namen, und `preview.ready()` wird nie aufgerufen, sodass
`pnpm lookbook:generate-previews` für die Demo ins Leere wartet.
Beleg: `const precompiled = director.precompile(renderer, shapes, {layers: [membrane.stage]});` …
`await precompiled;`
Empfehlung: Dasselbe `.catch((error) => console.error('<demo>: precompile() failed, …', error))` wie auf
den übrigen Seiten anhängen — idealerweise über einen gemeinsamen Helper, der den Demo-Namen bekommt.

**BUG-013 · low · apps/lookbook/src/pages/demos/stage-masks-frozen.astro:45** (auch
`stage-masks-flashlight.astro:57`, `stage-masks-portal.astro:47`, `stage-masks-spotlight.astro:61`,
`stage-transitions-gallery.astro:64`, `stage-transitions-game-menu.astro:49`) — Fehlschlag des
Asset-Ladens im `onInit` sichtbar machen
Alle Seiten laden ihre Assets mit `await load…Assets(renderer)` in einem async Listener von
`display.onInit()`. `Display` emittiert `OnDisplayInit` synchron und awaitet das Promise des Listeners
nicht; ein 404 oder ein kaputtes JSON wird so zu einer unbehandelten Rejection, der Canvas bleibt in der
Clear-Farbe, die GUI erscheint nicht, und nichts auf der Seite sagt, was fehlt. Bei den Seiten mit
`deferPreview()` wartet zusätzlich der Preview-Generator vergeblich.
Beleg: `display.onInit(async ({renderer}) => {\n const assets = await loadChapelAssets(renderer);`
Empfehlung: Den Body des Listeners in `try/catch` fassen oder einen gemeinsamen
`onInitAsync(display, demoName, fn)`-Helper einführen, der Fehler mit Demo-Namen loggt und eine
Fehlermeldung in `getDemoUi()` setzt.

## Urteil des Reviewers (Zug 3, `paket-13.review-0.json`)

- BUG-004 — behoben: `matteMasks.ts:144-150` (Getter `maskStages`), `stage-transitions-gallery.astro:100-110` (`layers: [b.stage, ...mattes.maskStages]` über `catchPrecompile`)
- READ-004 — behoben: `apps/lookbook/src/demos/stage-masks/TransitionCycler.ts` (`onBegin` vor `effect()` vor `replace()` `:205-216`, `finished.then` mit `#disposed` `:218-226`), übernommen von `heat-haze`, `matte-3d`, `matte-ink`, `matte-threshold` mit den geplanten Werten
- RES-003 — behoben: `stage-transitions-game-menu.astro:124-144` (benannte Listener, `ignoredKey`), `:177-181` (Abmeldung vor `gui.destroy()`)
- CONS-003 — behoben: alle 13 `precompile()`-Aufrufe über `catchPrecompile`, einheitlicher Wortlaut
- BUG-013 — behoben: `apps/lookbook/src/demos/utils/demoInit.ts:14-37` auf allen 21 Seiten; `first-sprite.astro:46-48` mit Kommentar; `.demo-failure` in `VanillaDemo.astro:126-143`
- Dazu, Tastenfilter: `apps/lookbook/src/demos/utils/demoKeys.ts` nach Schritt 3, alle zwölf Handler fragen ihn zuerst
- README Schritt 10: `apps/lookbook/README.md:62-68`

Kleine Befunde (keine Runde):
- `TransitionCycler.ts:78` — `onBegin` als `(from: IStage, to: IStage)` typisiert, bekommt `StageDirectorLayer`; einheitlicher wäre `StageDirectorLayer` auch dort und bei `#shownFrom`/`#shownTo`
- `stage-masks-matte-ink.astro` — `edge.running = true` und `hall.pointer = undefined` laufen in `onBegin` vor `replace()`; so geplant, ohne sichtbare Wirkung

## Nebenbefunde des Implementierers, mit Urteil

Alle vorbestehend in Dateien, die das Paket nur am `onInit`-Rahmen berührt hat; keiner teilt eine Ursache dieses Pakets (Start, `precompile()`, Cycler, Tastenfilter), daher Queue statt Mitnahme. Urteil `→ Scope` nach der Scope-Regel (alles, jede Severity). Der Befund `sine-scroller.astro:102-105` (`loadFont()` ohne `response.ok`) steht bereits im Bereich von Paket 13b und bekommt keinen eigenen Eintrag.
