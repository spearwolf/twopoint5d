# Remediation-Plan — @spearwolf/twopoint5d

Quelle: ./audit.html vom 2026-09-19 · Branch: main · erstellt: 2026-09-20
Baseline: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:ci, test:browser — alles grün, exit=0)
Arbeitsverzeichnis: /tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ecdab9e-7f9f-4c42-ae2e-2cfd00b2febc/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Stand: 2026-09-20 · Lauf abgeschlossen. Alle 16 Pakete committet (`e7a112b3..5a0ae0e4`), »Offene Befunde« leer, keine unverteilte `Folgen:`-Zeile, nichts blockiert. Abschluss gefahren: `pnpm run ci` grün, die CHANGELOG-Zeile zu `Canvas2DStage#setContainerSize()` nachgezogen, `./audit.html` nachgeführt (27 geschlossen, 23 neu, Score 5 → 13,5), Report unter `docs/remediation/20260920-remediation-report.md`. Die Tokentabelle ist dorthin umgezogen.
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 27 von 142 Findings (1 medium, 17 low, 9 info) — alle MEM-\*, CONS-\* und IMPL-002 aus »Code & Laufzeit« plus BUG-096/097 aus dem Harness · ausgenommen: alles andere, inklusive `acknowledged`
Scope-Regel: alles, was im Lauf auffällt, wird in diesem Lauf behoben — jede Severity, jede Kategorie, notfalls in zusätzlichen Paketen. Nichts wandert ungefixt ins Audit zurück.
Kaltstarts: 10 Pakete × mindestens 3 Agenten ≈ 30, je Nachrunde zwei mehr · 2,7 Findings je Paket — unter dem Zielkorridor 5–8, der Schnitt ist zu fein und kostet Laufzeit ohne Gegenwert; die Drain-Pakete werden gröber geschnitten. Paket 10 trägt vier triagierte Folgen aus zwei Ketten in einem Paket, statt zwei Zwergpakete zu schneiden

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` blockiert.

## Wiederaufnahme

Der Lauf wurde am 2026-09-20 um 10:53 auf Wunsch des Nutzers angehalten, vor
Paket 3 und an einer sauberen Naht: Paket 1 und 2 sind committet, nichts stand
auf `[~]`, der Arbeitsbaum war bis auf diese Datei und `docs/remediation/
paket-*.md` leer. Fortsetzen heißt deshalb schlicht: Skript starten, es steigt
bei Paket 3 ein.

```bash
cd /home/spw/spaceland/twopoint5d
ORCHESTRATOR_SESSION=<UUID-Abschnitt des eigenen Scratchpad-Pfads> \
  ~/.claude/skills/js-ts-audit-remediation/scripts/remediate.sh
```

Vorbedingungen, die das Skript selbst prüft und bei denen es sonst mit Exit 40
gar nicht erst anläuft: Branch `main`, sauberer Arbeitsbaum, kein Paket auf
`[~]`, keine laufende tmux-Session `remediate-twopoint5d`.

**Das Arbeitsverzeichnis im Kopf dieser Datei ist flüchtig.** Es hängt am
Scratchpad der Session, die den Lauf gestartet hat, und liegt unter `/tmp`.
Diffs, Verify-Logs und die Ergebnis-JSONs der bisherigen Runner sind damit
verloren, sobald dort aufgeräumt wird — die Commits und die Paketdateien nicht.
Eine neue Session trägt ihren eigenen Pfad in die Kopfzeile ein; für die
Tokenzählung am Ende fehlen dann die alten Posten, und die Tabelle sagt das in
ihrer letzten Zeile selbst.

### Zwei Fallen, die dieser Lauf schon getreten hat

**Zug 0 vergisst das Feierabendzeichen.** In Paket 1 schrieb der Planer seinen
Detailplan fertig, trug die `Detail:`-Zeile nach — und setzte
`<arbeitsdir>/paket-<N>.zug0.done` nicht. Die Schleife wartete 49 Minuten auf
ein Signal, das nicht mehr kam; die Frist aus `ZUG0_TIMEOUT` griff nicht, weil
ein offener Remote-Control-Kanal als »der Nutzer ist erreichbar« zählt. Das
Bild täuscht: von außen sieht ein wartendes Fenster aus wie ein arbeitendes.

Erkennen: `docs/remediation/paket-<N>.md` existiert und ist seit Minuten
unverändert, die Marke steht auf `[~]`, aber `<arbeitsdir>/paket-<N>.zug0.done`
fehlt. Prüfen, bevor man eingreift — die Paketdatei muss bis `## Verify` und
`## Commit` vollständig sein, unter »Entscheidungen« dürfen keine Zeilen
stehen, die der Planer sich selbst beantwortet hat, und im Pane darf keine
Frage offen sein. Stimmt das alles, ist ein `touch` auf die `.done`-Datei der
richtige Handgriff; die Schleife schließt das Fenster und läuft weiter.

**Ein manuell beendeter tmux-Server bucht `ende exit=0`.** Der Trap kann nicht
unterscheiden, ob das Backlog leer ist oder jemand die Session abgeräumt hat.
Diese Zeile im Journal heißt also nicht zwingend »fahr den Abschluss«. Was
zählt, sind die Marken in dieser Datei: solange ein `[ ]` dasteht oder »Offene
Befunde« Einträge hat, ist der Lauf nicht fertig.

### Was beim Fortsetzen anders geschnitten wird

Der Paketschnitt dieses Laufs ist zu fein — 3,0 Findings je Paket gegen einen
Zielkorridor von fünf bis acht, siehe die Zeile `Kaltstarts:` im Kopf. Die
sieben verbliebenen Pakete bleiben, wie sie sind; sie umzubauen kostet mehr,
als es einspart. **Die Pakete der Drain-Runde werden gröber geschnitten:** die
acht Lookbook-Befunde unter »Offene Befunde« teilen sich Domäne und Diff-Fläche
und gehören in ein Paket, nicht in drei.

## Entscheidungen

- BUG-096 und BUG-097 kommen in den Lauf, obwohl sie im Harness-Domain liegen: in
  »Code & Laufzeit« gibt es keine BUG-Findings, und ein Lauf mit dem Ziel
  »bugfrei« lässt die einzigen zwei offenen BUG-Einträge nicht stehen (2026-09-20)
- Die neun CONS-Findings der Severity `info` kommen mit — sie teilen sich die
  Dateien mit den low-Findings, der Reviewer liest dieselben Diffs ohnehin (2026-09-20)
- Fehlkonfigurationen werfen, statt stumm weiterzulaufen: die Setter für
  `tileWidth`/`tileHeight`, `updateCamera()` bei falschem Kameratyp und der
  `FixedFrameLoop`-Konstruktor bei disposetem Display bekommen je einen Error
  mit Namen des Aufrufs und des Zustands. Aufrufer im Repo werden mitgezogen;
  die Semver-Folge weist der Abschlussreport aus (2026-09-20)
- Der Default-Animationsname in `FrameBasedAnimations.add()` wird ein
  Auto-Counter (`anim_0`, `anim_1`), kein `Symbol` mehr — anonyme Animationen
  sind weder auffindbar noch löschbar (2026-09-20)

## Konventionen

Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise, Commit-Messages:

- Inline-Kommentare sind erwünscht, wo sie erklären, *warum* etwas so ist.
- Keine Finding-IDs, auch nicht in der Commit-Message. Sie gehören diesem einen
  Audit, sind danach tot, und die Commit-Message überdauert den Lauf. Sie leben
  in diesem Plan und sonst nirgends; die Verbindung zwischen Finding und Commit
  trägt das Feld `Hash:` unter dem Paket — in genau der Richtung, in der jemand
  sie später sucht. Eine Commit-Message sagt in eigenen Worten, was sie ändert.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.

Projektspezifisch, aus `AGENTS.md` und den verlinkten Dokumenten:

- **Sprache.** Code, Kommentare, TSDoc, Doku und Commit-Messages auf Englisch.
  Commits folgen Conventional Commits.
- **Imports.** Relative Imports tragen den `.js`-Suffix (NodeNext), Typen
  kommen über `import type` — der Lint erzwingt beides.
- **Öffentliche Oberfläche.** Ein neues öffentliches Symbol ist erst
  veröffentlicht, wenn es in der `public-api.ts` seines Moduls steht.
- **`dispose()` und Ownership** folgen
  `packages/twopoint5d/docs/resource-lifecycle.md`. Die Regeln dort sind
  bindend; §6 (Checkliste) und §7 (Assertions) gelten für jedes `dispose()`,
  das in diesem Lauf entsteht.
- **Zwei Testflächen.** `*.spec.ts` neben der Quelle (Vitest, Logik) und
  `*.test.js` in `packages/twopoint5d-testing/test/` (echte Browser,
  visuell/WebGL). Eine Änderung an Rendering- oder GPU-Buffer-Code braucht
  beide.
- **Gate.** `pnpm run ci` ist das Verify-Kommando vor jedem Commit — nicht die
  Einzelziele. Ein einzelner Vitest-Lauf während der Arbeit geht über
  `pnpm nx test twopoint5d -- src/path/to/file.spec.ts`.
- **Geteilte Dependency-Versionen** stehen im `catalog:`-Block von
  `pnpm-workspace.yaml`, nie in einer einzelnen `package.json`.
- **Niemals** `pnpm publishNpmPkg` oder `scripts/publishNpmPkg.mjs` ausführen.

## Vorbestehende Fehler

Keine. Die Baseline war auf ganzer Breite grün.

## Offene Befunde

Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `apps/lookbook/src/images/so-mi-gradient-back-gr.webp` — das Bild wird
  über `index.astro:8` importiert und nur an eine `define:vars`-Variable
  gereicht, die ausschließlich in auskommentierten CSS-Zeilen vorkommt; es
  landet im Build, ohne je dargestellt zu werden. Mit Paket 1 fällt auch
  dieser letzte formale Verweis. Aus Paket 1, Zug 0 · → Scope (info) ·
  **gegenstandslos**, festgestellt in Zug 0 von Paket 11: Paket 1 hat den
  Import entfernt, `index.astro` zieht heute nur noch
  `ball-pattern-dark-blueish-4x-30deck-doubled.webp` ein, und das Bild landet
  nicht mehr im Build. Die ungenutzte Datei bleibt liegen — Begründung in
  `docs/remediation/paket-11.md`
- [x] `apps/lookbook/src/pages/demos/map2d-rect-visi.astro:16,20` — zwei
  getrennte `body`-Regeln im selben `<style>`-Block, dieselbe Ursache wie die
  acht Demos oben; vorbestehend aus `c3c8edb7`, also vor dem ersten
  Paket-Commit dieses Laufs. Aus Paket 11, Zug 0 · → Scope (info) · → Paket 11
- [x] `apps/lookbook/src/pages/demos/map2d-tile-sprites.astro:12,16` — zwei
  getrennte `body`-Regeln im selben `<style>`-Block, dieselbe Ursache wie die
  acht Demos oben; vorbestehend aus `c3c8edb7`. Aus Paket 11, Zug 0 ·
  → Scope (info) · → Paket 11
- [x] `apps/lookbook/src/pages/demos/animated-sprites.astro:42` und
  `textured-sprites.astro:43` — `display: inline-fl;` ist kein gültiger Wert,
  der Browser verwirft die Deklaration, und `.actionBtn` bleibt ein
  Block-`div`. Gemeint war `inline-flex`. Aus Paket 1, Zug 2 · → Scope (low) · → Paket 11
- [x] Zwei getrennte `body`-Regeln im selben `<style>`-Block, in acht weiteren
  Demos unter `apps/lookbook/src/pages/demos/`:
  `animated-billboards.astro:17,21`, `instanced-quads.astro:13,17`,
  `map2d-cam-visi.astro:29,33`, `textured-quads.astro:15,20`,
  `textured-quads-from-texture-atlas.astro:15,19`,
  `textured-quads-from-tileset.astro:17,21`,
  `textured-quads-po2image-loader.astro:15,19`, `textured-sprites.astro:17,21`.
  Dazu `display-multi.astro:133,137,155` mit dreimal `body` plus `html, body`
  und `body, .gridContainer`. Aus Paket 1, Zug 2 · → Scope (info) · → Paket 11
- [x] Totes `background-color` unmittelbar vor einem `background:`-Shorthand im
  selben `body`-Block, das der Shorthand überschreibt, unter
  `apps/lookbook/src/pages/demos/`: `animated-sprites.astro:21`,
  `instanced-quads.astro:18`, `textured-quads.astro:21`,
  `textured-quads-from-tileset.astro:22`,
  `textured-quads-po2image-loader.astro:20`, `textured-sprites.astro:22`.
  Aus Paket 1, Zug 2 · → Scope (info) · → Paket 11
- [x] `apps/lookbook/src/pages/index.astro:42-46` — `.back-pattern` beschreibt
  in `background-repeat`, `background-size` und `background-position` je zwei
  Ebenen, es gibt aber nur ein `background-image`. Die Zweitwerte laufen ins
  Leere. Aus Paket 1, Zug 2 · → Scope (info) · → Paket 11
- [x] `apps/lookbook/src/components/TagCloudFilter.astro:14,98` — der
  Klassenname `tag-catgeory-description` ist verschrieben. Er steht an beiden
  Stellen gleich und wirkt deshalb; falsch geschrieben bleibt er.
  Aus Paket 1, Zug 2 · → Scope (info) · → Paket 11
- [x] `apps/lookbook/src/pages/demos/instanced-quads.astro:23` — die Datei
  mischt zwei Import-Stile: `VertexObjectPool` im `import type`-Block, `VO` als
  Inline-`type` im Value-Import. Der Lint akzeptiert beides.
  Aus Paket 1, Zug 3 · → Scope (info) · → Paket 11
- [x] `package.json:9` — `eslint-plugin-astro` verlangt
  `node ^22.22.3 || ^24.16.0 || >=26.3.0`, die Root-`engines` sagen `>=24`. Auf
  Node 24.0–24.15 gibt das eine Engine-Warnung; ohne `engine-strict` bricht
  nichts, CI und lokaler Rechner liegen darüber. Aus Paket 1, Zug 3 · → Scope (info) · → Paket 11
- [x] `packages/twopoint5d/src/stage/Canvas2DStage.ts:211` — die TSDoc von
  `dispose()` führt `stageRenderer` unter den Feldern auf, die »die Werte
  behalten, mit denen die Stage zurückgelassen wurde«. Das Feld behält seinen
  Wert, die Instanz darin ist aber disposed und zu nichts mehr zu gebrauchen.
  Dieselbe Halbwahrheit, die Paket 2 für das Nachbarfeld `stage` korrigiert
  hat; sie stand schon vorher dort. Aus Paket 2, Zug 2 · → Scope (info) · → Paket 13
- [x] `packages/twopoint5d/src/stage/ParallaxProjection.ts:153` — `getZoom()`
  trägt ein `// TODO add jsdoc` statt einer TSDoc; die Methode ist öffentlich und
  rechnet den Zoomfaktor für eine Distanz zur Projektionsebene. Der TODO stand
  schon vor dem ersten Commit dieses Laufs. Aus Paket 8, Zug 2 · → Scope (info) · → Paket 13
- [x] `packages/twopoint5d/src/map2d/Map2DTileStreamer.spec.ts:253` — der
  Fake-Visibilitor im Test »places the renderers at the offset of the
  visibilitor…« liefert neben `offset` auch `translate: new Vector3(7, 3, 11)`.
  `Map2DTileStreamer#update()` liest `translate` nirgends; der Wert suggeriert
  eine Wirkung, die es nicht gibt. Aus Paket 3, Zug 2 · → Scope (info) · → Paket 12
- [x] `packages/twopoint5d/src/map2d/RepeatingTilesProvider.ts:65` —
  `if (!this.tileIds)` liest einen Getter vom Typ `number[][]`; zur Laufzeit
  ist das Feld dort noch `undefined`, der Typ sagt also das Gegenteil dessen,
  was der Ausdruck prüft. Funktioniert, ist laut Typsystem aber tot und fällt
  beim nächsten Umbau still weg. Aus Paket 3, Zug 2 · → Scope (info) · → Paket 12
- [x] `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:44-60`
  — `update()` prüft `show` nicht und baut bei jedem Aufruf einen neuen
  `Box3Helper` samt Geometrie, während der vorige über `#helpers.remove()`
  fällt. `apps/lookbook/src/demos/map2d-rect-visi.ts:111` geht diesen Pfad in
  jedem Frame, ohne `show` je auf `true` zu setzen: die Demo zeigt Knoten, die
  laut `show` nicht da sind, und allokiert eine Geometrie pro Frame. Das
  Schwestermodul `CameraBasedVisibilityHelpers` gated seinen `update()` mit
  `if (!this.#show) return;`. Aus Paket 4, Zug 0 · → Scope (low) · → Paket 12

- [x] `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:52-60`
  — `set show` ruft `update()`, **bevor** es `#show` schreibt. Heute harmlos,
  weil `update()` `#show` nicht liest. Sobald der Eintrag darüber behoben wird
  und `update()` sein `show`-Gate bekommt, baut ein `show = true` nichts mehr:
  die beiden hängen zusammen und müssen zusammen gefixt werden. Das
  Schwestermodul schreibt `#show` zuerst. Aus Paket 4, Zug 2 · → Scope (low) · → Paket 12
- [x] `packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts:75` —
  `remove(scene)` nimmt jede Szene an und ruft
  `#helpers.removeFromScene(scene)` darauf, ohne gegen die gehandelte zu
  prüfen; das Schwestermodul `CameraBasedVisibilityHelpers` weist eine fremde
  Szene ab. Vom Interface-TSDoc in `types.ts` formal gedeckt, das eine fremde
  Szene der Implementierung freistellt — aber eine Asymmetrie zwischen zwei
  Klassen desselben Interfaces, mit der ein Aufrufer nicht rechnet.
  Aus Paket 4, Zug 2 · → Scope (info) · → Paket 12
- [x] `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:74-80` — wirft
  `TexturePackerJson.parse()` im `load`-Callback des Bildes, geht der Fehler an
  `onErrorCallback` und die `Texture`, die `TextureImageLoader` eine Zeile
  vorher gebaut und herausgegeben hat, wird von niemandem mehr disposed: der
  Atlas-Loader gibt sie im `catch` nicht frei, und der Aufrufer hat sie nie
  gesehen. Ein Leak pro fehlerhafter Atlas-Json. Aus Paket 7, Zug 2 · → Scope (low) · → Paket 13
- [x] `packages/twopoint5d/src/texture/TextureAtlasLoader.ts:88-91` — der
  Progress-Callback an `THREE.FileLoader` hat einen leeren Rumpf mit einer
  TODO-Notiz und einer auskommentierten `console.log`-Zeile. Entweder der
  optionale Parameter kommt oder die Notiz geht.
  Aus Paket 7, Zug 2 · → Scope (info) · → Paket 13
- [x] `packages/twopoint5d/src/stage/Stage2D.ts:207` — eine auf `Stage2D#camera`
  gesetzte Kamera falschen Typs lässt `resize()` mit dem `TypeError` aus
  `updateCamera()` abbrechen, nachdem `#containerWidth`/`-Height` und
  `#width`/`#height` schon geschrieben sind und bevor `OnStageResize` heraus ist.
  Ein zweites `resize()` mit derselben Größe ist ein No-op, die Stage meldet also
  eine Sicht, die nie angekündigt wurde. Aus Paket 10, Zug 2 · → Scope (low) · → Paket 13
- [x] `packages/twopoint5d/src/stage/Stage2D.ts:361` — eine Zeile der
  `dispose()`-TSDoc (»A `dispose` event goes out to every subscriber …«) ist etwa
  doppelt so lang wie ihre Nachbarzeilen, der Umbruch fehlt.
  Aus Paket 10, Zug 2 · → Scope (info) · → Paket 13
- [x] `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:192` — der Filter
  `(name) => typeof name === 'string'` im Atlas-Zweig von `add()` überschattet
  das äußere `name`, das weiter unten neu zugewiesen wird.
  Aus Paket 10, Zug 2 · → Scope (info) · → Paket 13
- [x] `packages/twopoint5d/src/texture/FrameBasedAnimations.ts`, Atlas-Zweig von
  `add()` — ein Atlas oder eine `frameNameQuery` ohne Treffer registriert eine
  Animation mit null Frames ohne Fehler, und `duration` wird nicht gegen negative
  Werte oder `NaN` geprüft. Die Datentextur bekommt in beiden Fällen Einträge,
  mit denen ein Shader nichts anfangen kann. Aus Paket 10, Zug 2 · → Scope (low) · → Paket 13
- [x] `packages/twopoint5d/src/map2d/HelpersManager.ts:79-81` —
  `removeFromScene(scene)` räumt neben der übergebenen Szene immer auch `root`
  ab, und `root` ist die Wurzel über der eigenen Szene. Ein Aufruf mit einer
  fremden Szene reißt damit den eigenen Satz herunter und disposed ihn. Die
  Methode ist öffentlich, ihr TSDoc beschreibt das Verhalten korrekt — ein
  Fallstrick bleibt es trotzdem: beide mitgelieferten Helfer schirmen ihn seit
  Paket 12 ab, jede fremde `IMap2DVisibilitorHelpers`-Implementierung, die
  `removeFromScene()` direkt ruft, tritt weiter hinein. Vorbestehend aus
  `f8d255e3`. Aus Paket 12, Zug 2 · → Scope (low) · → Paket 15
- [x] `packages/twopoint5d/src/map2d/HelpersManager.ts:55` — `remove()` trägt
  weder Rückgabetyp noch TSDoc, als einzige Methode der Klasse. Vorbestehend aus
  `f8d255e3`. Aus Paket 12, Zug 2 · → Scope (info) · → Paket 15
- [x] `apps/lookbook/src/demos/map2d-rect-visi.ts:67-68` — die Demo baut Helfer
  und `Map2D` auf und disposed nichts davon, auch nicht beim Verlassen der Seite.
  Für eine Lookbook-Demo vertretbar, aber jede andere Demo derselben Art erbt
  dasselbe Muster. Aus Paket 12, Zug 2 · → Scope (info) · → Paket 15
- [x] `apps/lookbook/src/pages/demos/display-multi.astro:184` — der Selektor
  `.gridCell.canvasContainer:hover` trifft nie, weil kein Element beide Klassen
  trägt; wirksam ist allein der Zweig `.gridCell:hover .canvasContainer`.
  Aus Paket 11, Zug 2 · → Scope (info) · → Paket 15
- [x] `apps/lookbook/src/pages/demos/textured-sprites.astro:26` — die Regel
  `em { … }` ist toter Code: die Seite hat kein `<em>` im Markup, und Astro
  scoped die Regel auf das eigene Template. Aus Paket 11, Zug 2 · → Scope (info) · → Paket 15
- [x] `packages/twopoint5d/src/stage/ParallaxProjection.ts:154` und
  `OrthographicProjection.ts:152` — die beiden `getZoom()` beantworten unter
  demselben Namen aus `IProjection` zwei verschiedene Fragen: die parallaktische
  rechnet `1 - d/D` (1 an der Kamera, 0 auf der Projektionsebene, negativ
  dahinter), die orthografische gibt konstant `1` mit der Begründung, der
  Zoomfaktor sei bei orthografischer Sicht immer derselbe. Wer gegen `IProjection`
  programmiert, bekommt von der einen einen Parallax-Faktor und von der anderen
  einen Skalierungsfaktor. Außerhalb der beiden Specs ruft die Methode im
  Repository niemand. Vorbestehend aus `e7a112b3^`. Aus Paket 13, Zug 0 ·
  → Rückfrage (low): der Fix ändert entweder den Rückgabewert einer
  veröffentlichten Interface-Methode oder schneidet `IProjection` neu, und beides
  reicht über ein Paket hinaus · → Audit — Stand 2026-09-20 noch nicht als Finding
  in der `./audit.html` eingetragen, nachgesehen in Zug 0 von Paket 15; der
  Abschluss trägt es nach
- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:285-305` — dieselbe halb
  geschriebene Transaktion eine Ebene über `Stage2D`: `resize()` schreibt `width`
  und `height` vor der Schleife über die Stages, `resizeStage()` schreibt
  `stageItem.width`/`height` vor `stage.resize()`, und wirft eine Stage, bleibt
  beides stehen. Der Guard in Zeile 286 macht den zweiten Aufruf mit denselben
  Zahlen zum No-op, und die Schleife bricht ab, bevor die übrigen Stages ihre Größe
  gesehen haben — die Erholung, die `Stage2D` seit Paket 13 zusagt, kommt über
  diesen Weg nicht an. Vorbestehend, geprüft in `e7a112b3^`. Aus Paket 13, Zug 4 ·
  → Scope (low) · → Paket 15
- [x] `packages/twopoint5d/src/stage/Canvas2DStage.ts:212-214` — dieselbe
  Halbwahrheit, die Paket 2 für `stage` und Paket 13 für `stageRenderer`
  ausgeräumt hat, steckt noch in `width` und `height`: die TSDoc von `dispose()`
  führt beide unter den Feldern, die »keep the values the stage was left with«,
  aber beide Getter lesen `canvas.width`/`canvas.height` (Zeile 41-47). Der Canvas
  gehört dem Aufrufer, die beiden antworten nach einem `dispose()` also mit dem,
  was er später an seinem Canvas einstellt. Vorbestehend, die Zeile stand so in
  `e7a112b3^`. Aus Paket 13, Zug 2 · → Scope (info) · → Paket 15
- [x] `packages/twopoint5d/src/stage/ParallaxProjection.ts:164` — der Parameter von
  `getZoom()` heißt `distanceToProjectionPlane` und ist gerade nicht die Distanz zur
  Projektionsebene, sondern die zur Kamera; das gleichnamige Feld der Projektion
  steht daneben und meint etwas anderes. Die TSDoc aus Paket 13 beschreibt das,
  umbenannt wurde nichts — ein öffentlicher Parametername kippt mehr als ein Paket.
  Verwandt mit dem `getZoom()`-Eintrag darüber, aber eine eigene Sache.
  Vorbestehend aus `e7a112b3^:134`. Aus Paket 13, Zug 2 · → Scope (info) · → Paket 15
- [x] `apps/lookbook/src/pages/demos/display-multi.astro:106-130` — dasselbe
  Muster, das Paket 15 für `map2d-rect-visi.ts` ausgeräumt hat: die Schleife baut
  pro Canvas ein `Display`, einen `StageRenderer`, eine `TextureFactory`, eine
  Textur, ein `SpriteMaterial` und einen `Sprite` und gibt nichts davon je frei —
  sechs Displays auf einer Seite, sechsmal derselbe Satz. Der Aufräumpfad aus
  Paket 15 (`once(demo, OnDisplayDispose, …)` bzw. `Display#onDispose()`) ist die
  Vorlage. Vorbestehend. Aus Paket 15, Zug 2 · → Scope (info) · → Audit (dritte Drain-Runde)
- [x] `apps/lookbook/src/pages/demos/display-multi.astro:21` — die Klasse `debug`
  am zweiten `.canvasContainer` hat im `<style>`-Block dieser Seite keine Regel;
  ob ein globales Stylesheet sie trägt, ist nicht nachgesehen. Vorbestehend.
  Aus Paket 15, Zug 2 · → Scope (info) · → Audit (dritte Drain-Runde)
- [x] `packages/twopoint5d/src/stage/Canvas2DStage.ts:135,149,158,173,190` —
  `updateTexture()`, `setContainerSize()`, `setCanvasSize()`, `render()` und
  `dispatchEvent()` tragen keinen Rückgabetyp, anders als der Rest der Klasse und
  der Module ringsum. Vorbestehend. Aus Paket 15, Zug 2 · → Scope (info) · → Audit (dritte Drain-Runde)
- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:880` — `add()` ruft
  `resizeStage(si, this.width, this.height)` nach `stages.push(si)` und nach dem
  Setzen des Kamera-Listeners, aber vor `emit(this, OnStageAdded, …)`. Weist die
  Stage die Größe ab, steht sie in `stages`, `OnStageAdded` bleibt aus, und der
  Aufrufer bekommt einen Fehler statt `this` — eine halb hinzugefügte Stage, die
  kein Ereignis angekündigt hat. Vorbestehend. Aus Paket 16, Zug 2 ·
  → Scope (low) · umgewertet → Audit: dritte Drain-Runde, und es ist der
  dritte Nachschlag derselben Fläche — die Transaktionen in `StageRenderer`
  brauchen einen eigenen Lauf, nicht ein weiteres Paket in diesem

## Pakete

### [x] 1. ESLint auf die Skripte in `.astro`-Dateien ausdehnen

- Findings: CONS-034 (low), CONS-033 (info)
- Ziel: Die `no-console`-Regel erreicht die Lookbook-Demos, und die
  Debug-Ausgabe der Crosses-Demo verschwindet samt der doppelten `body`-Regel.
- Detail: `docs/remediation/paket-1.md`
- Bereich: `eslint.config.*`, `apps/lookbook/src/pages/demos/crosses.astro`
- Hängt ab von: —
- Anmerkung: Steht vorn, weil die Lint-Ausdehnung ein Gate verschärft. Was sie
  quer durch den Lookbook neu aufdeckt, fällt unter die Scope-Regel und wird in
  diesem Paket oder einem Folgepaket behoben, nicht stumm per Ausnahme
  stillgelegt.
- Hash: e7a112b3
- Ergebnis: 1 Runde · CONS-034 und CONS-033 behoben, vom Reviewer je mit
  Fundstelle bestätigt · Regressionstest entfällt (kein Korrektheitsfehler; das
  Gate ist der Lint-Lauf selbst, der vor der Änderung 34 Befunde meldete und
  danach null) · klein: gemischte Import-Stile in `instanced-quads.astro`,
  Engine-Range des neuen Plugins, die Commit-Message nennt die Aufräumschritte
  nicht
- Nebenbefunde: → Queue (6 Einträge, alle aus dem Lookbook-CSS und einem
  Klassennamen; keiner teilt die Ursache dieses Pakets)
- Folgen: `docs/architecture.md:54` — die Aussage, `no-console` gelte nur in
  `.ts`/`.js`, wurde im selben Commit mitgezogen und nennt jetzt auch die
  `<script>`-Blöcke der `.astro`-Dateien samt Mechanismus. Nichts offen.
- Schnittstellen: keine Laufzeit-Oberfläche bewegt. Für die Werkzeugkette gilt:
  ESLint lintet ab jetzt die `<script>`-Blöcke der `.astro`-Dateien, weil
  `eslint.config.mjs` `astro.configs['flat/recommended']` spreadet und der
  Processor `astro/astro` jeden Block als virtuelle Datei `<name>.astro/0.ts`
  einreicht — die bestehenden Blöcke `files: ['**/*.{js,ts}']` und
  `files: ['**/*.ts']` greifen darauf von selbst. Ein neuer Regelblock auf
  `'**/*.astro'` erreicht nur das Frontmatter. `eslint-plugin-astro@^3.2.1`
  steht in den Root-`devDependencies`, nicht im `catalog:`. Wer eine
  `.astro`-Datei anfasst, hält sich an `no-console`, `consistent-type-imports`
  und die Suffix-Regel — mit `moduleResolution: "Bundler"` im Lookbook heißt
  das: relative Importe dort suffixlos, nicht auf `.js`.

### [x] 2. Stage2D: PassNode freigeben und der Klasse ein `dispose()` geben

- Findings: MEM-005 (medium), CONS-031 (info), CONS-041 (info)
- Ziel: Ein Stage2D gibt das RenderTarget frei, das es selbst allokiert hat,
  statt bei jedem Rebuild ein neues zu sammeln.
- Detail: `docs/remediation/paket-2.md`
- Bereich: `packages/twopoint5d/src/stage/` — `Stage2D.ts` (+ Spec),
  `StageRenderer.ts`, `Canvas2DStage.ts` (+ Spec), `README.md`; dazu
  `packages/twopoint5d-testing/test/stage-pipeline.test.js` und das CHANGELOG
- Hängt ab von: —
- Anmerkung: Das schwerste Paket des Laufs. `dispose()` nach der Checkliste in
  `resource-lifecycle.md` §6, die Assertions aus §7 als Spec. Berührt
  GPU-Ressourcen, braucht deshalb beide Testflächen. Zug 0 hat zwei Stellen
  dazugenommen: `StageRenderer.ts:517` fragt nach derselben Regel nach der
  Container-Fläche wie die Fundstelle von CONS-041, und `Canvas2DStage` baut
  sich im Konstruktor selbst ein `Stage2D`, das es ab jetzt freigeben muss.
- Hash: 6369ae7f
- Ergebnis: 4 Runden · MEM-005, CONS-031 und CONS-041 behoben, von vier
  Reviewern je mit Fundstelle bestätigt · Regressionstest: neun Tests in
  `Stage2D.spec.ts` waren vor dem Fix rot, darunter »gives the same node back
  while scene and camera stay«, »builds a new node for a new camera and
  releases the one before« und sechs mit `TypeError: stage.dispose is not a
  function`; an echter GPU »Mode D: a rebuild without a camera change keeps
  the pass node and its render target« in
  `packages/twopoint5d-testing/test/stage-pipeline.test.js` · die Runden 2 bis
  4 waren reine Doku-Nachzüge: TSDoc, README, CHANGELOG und Migration Guide
  hatten die neue Regel je an einer Stelle noch nicht · klein und
  stehengelassen: eine überlange TSDoc-Zeile in `Stage2D.ts` um `:355`, die
  Aufzählung der Member führt `scene` und `name` in einem Satz sowohl unter
  »behalten ihre Werte« als auch unter »nehmen neue an«, und das neue
  `IPassProvider`-Beispiel im README baut nach seinem `dispose()` wieder einen
  Knoten, statt zu werfen wie `Stage2D`
- Nebenbefunde: → Queue (1 Eintrag, die TSDoc-Zeile zu `stageRenderer` in
  `Canvas2DStage.ts`; sie teilt die Ursache mit einer Stelle dieses Pakets,
  war aber auch ohne es falsch)
- Folgen: keine. Was die Änderung an Doku und TSDoc umgeworfen hat, ist in den
  Runden 2 bis 4 mitgezogen worden.
- Schnittstellen: `Stage2D#dispose()` und `Stage2D#isDisposed` sind neu; beide
  kommen über die bereits exportierte Klasse heraus, kein neuer Eintrag in der
  `public-api.ts` nötig. `Stage2D#asPassNode(renderer)` gibt denselben Knoten
  zurück, solange `scene` und `camera` dieselben Instanzen sind, gibt den
  vorigen beim nächsten Aufruf nach einem Wechsel frei und wirft nach
  `dispose()`; der Knoten gehört der Stage, ein Aufrufer disposed ihn nicht —
  dieselbe Zusage steht jetzt in der TSDoc von `IPassProvider`. Nach
  `dispose()` sind `renderTo()`, `updateFrame()`, `resize()`,
  `updateProjection()` und die Setter `projection` und `camera` stille
  No-Ops, während `name`, `needsUpdate`, `isFirstFrame` und `scene` weiter
  Schreibzugriffe annehmen. Eine Stage muss aus jedem `StageRenderer` entfernt
  sein, bevor sie disposed wird — sonst rendert der Renderer den freigegebenen
  Knoten weiter und der nächste Rebuild wirft im Frame-Loop.
  `Canvas2DStage#dispose()` disposed die `Stage2D` aus seinem Konstruktor,
  nach `stageRenderer.dispose()`. `Stage2D` und `StageRenderer` beurteilen
  einen Container ohne Fläche über `isPositiveFinite` statt `=== 0`. `IStage`
  hat weiterhin kein `dispose()`, und `StageRenderer.add()` weist eine
  disposete Stage nicht ab.

### [x] 3. map2d: Pool-Slots und das Kachelgitter gegen stumme Ausfälle sichern

- Findings: MEM-002 (low), MEM-003 (low), CONS-023 (low), CONS-035 (info), CONS-039 (info)
- Ziel: Ein fehlkonfiguriertes Tile-Setup wirft beim ersten Aufruf, statt
  Pool-Slots zu verlieren und danach stumm nichts mehr zu rendern.
- Detail: `docs/remediation/paket-3.md`
- Bereich: `packages/twopoint5d/src/map2d/` — `Map2DTileStreamer.ts`,
  `Map2DTileCoordsUtil.ts`, `Map2DSpatialHashGrid.ts`, `Map2DTileRenderer.ts`,
  `TileSprites/TileSpritesFactory.ts`, `RepeatingTilesProvider.ts`; dazu
  `packages/twopoint5d/src/utils/assertPositiveFinite.ts` (neu) und das CHANGELOG
- Hängt ab von: —
- Anmerkung: Zug 0 hat zwei Stellen dazugenommen. `Map2DSpatialHashGrid.ts:23`
  trägt denselben 0-Default und reicht ihn an dieselbe `Map2DTileCoordsUtil`
  durch — ohne Angleichung wirft `new Map2DSpatialHashGrid()` ab diesem Paket
  im Konstruktor. Und die Verschärfung bewegt die öffentliche Oberfläche, also
  braucht sie `Changed`, `Fixed` und einen Migrationsabschnitt im CHANGELOG.
  `Map2D.ts` bleibt dagegen unangetastet: seine Setter reichen an den Streamer
  durch, dessen Guard wirft.
- Hash: 5c8ee91e
- Ergebnis: 2 Runden · MEM-002, MEM-003, CONS-023, CONS-035 und CONS-039
  behoben, von zwei Reviewern je mit Fundstelle bestätigt · Regressionstests:
  »a factory without a tile set leaves the instanced pool as it found it« in
  `TileSprites/TileSpritesFactory.spec.ts` (vor dem Fix rot mit »usedCount
  after a throw: expected 1 to be +0«) und »a coordinate the renderer already
  holds writes the tile it holds on« in `Map2DTileRenderer.spec.ts` (vor dem
  Fix rot, weil der zweite `addTile()` ein zweites `createTile()` auslöste) ·
  Runde 1 war ein reiner Kommentar-Nachzug: die Begründung des
  `clearTiles()`-Aufrufs in `Map2D.ts` beschrieb den Leak, den der neue Guard
  jetzt verhindert · klein und stehengelassen: fünf Stellen, aufgezählt in der
  Paketdatei — TSDoc von `IMap2DTileRenderer#addTile()`, ein Test im
  `Map2DSpatialHashGrid.spec.ts`, der nur belegt dass nichts wirft, das
  fehlende `describeValue()` in der neuen Fehlermeldung, zwei `!` an den
  privaten Feldern der `Map2DTileCoordsUtil` und ein zweiter, ungenannter Grund
  im neuen `Map2D.ts`-Kommentar
- Nebenbefunde: → Queue (2 Einträge, beide an `git show 3b673f63:<pfad>` als
  vorbestehend geprüft; keiner teilt die Ursache dieses Pakets)
- Folgen: keine. Kein Aufrufer im Repository übergibt 0 oder einen
  nicht-finiten Wert an die drei Konstruktoren oder die Setter — geprüft über
  Bibliothek, Specs, `packages/twopoint5d-testing/test/` und `apps/lookbook/`.
  Die argumentlosen Aufrufe (`new Map2D()` in beiden Demos, in `Map2D.spec.ts`
  und in drei Browser-Tests, `new Map2DTileCoordsUtil()` in
  `CameraBasedVisibility.ts:155` und `CameraBasedVisibilityHelpers.spec.ts:31`)
  bekommen das 1×1-Gitter und laufen unverändert. Für den Abschlussreport
  bleibt die Semver-Folge: ein vormals erlaubtes Aufrufmuster wirft jetzt, der
  Migrationsabschnitt im CHANGELOG hält es fest.
- Schnittstellen: `tileWidth` und `tileHeight` weisen einen Wert, der keine
  finite Zahl über 0 ist, mit einem `RangeError` ab — in
  `Map2DTileCoordsUtil` (dort ab jetzt Accessoren statt öffentlicher Felder,
  Konstruktor schreibt durch sie hindurch), in den Settern und im Konstruktor
  von `Map2DTileStreamer` und im Konstruktor von `Map2DSpatialHashGrid`;
  `Map2D` erbt den Wurf über seinen Streamer. Die Meldung nennt Klasse,
  Eigenschaft und Wert. Der Default von `Map2DTileStreamer` und
  `Map2DSpatialHashGrid` ist ein 1×1-Gitter. `xOffset` und `yOffset` bleiben
  ungeprüfte öffentliche Felder. Neu und **intern** (nicht in einer
  `public-api.ts`): `assertPositiveFinite(value, subject, name)` in
  `packages/twopoint5d/src/utils/assertPositiveFinite.ts`, aufgesetzt auf
  `isPositiveFinite` — das ist ab jetzt der Weg, eine Größe abzuweisen, durch
  die später geteilt wird. `Map2DTileRenderer#addTile()` schreibt für eine
  Koordinate, die der Renderer schon hält, das gehaltene Tile über
  `updateTile()` fort und erhöht `#dataSerial`, statt ein zweites Tile zu
  bauen; `destroyTile()` läuft auf diesem Pfad nicht.
  `TileSpritesFactory#createTile()` löst Tile-Set und Atlas-Frame auf, bevor
  es einen Slot aus dem Instanced-Pool nimmt — wer eine eigene
  `IMapTileFactory` schreibt, hält sich an dieselbe Reihenfolge, denn auf
  diesem Pfad liegt keine Gegenbuchung zu `createVO()` in Reichweite.

### [x] 4. map2d: Den Visibility-Helfern ein `dispose()` geben

- Findings: MEM-004 (low), CONS-036 (info), CONS-022 (low)
- Ziel: Wer eine Helpers-Instanz fallen lässt, hinterlässt keine GPU-Geometrie,
  auf die nichts mehr zeigt.
- Detail: `docs/remediation/paket-4.md`
- Bereich: `packages/twopoint5d/src/map2d/` — `types.ts`,
  `CameraBasedVisibilityHelpers.ts` (+ Spec),
  `RectangularVisibilityAreaHelpers.ts` (+ Spec); dazu
  `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js` und das
  CHANGELOG
- Hängt ab von: —
- Anmerkung: `dispose()` kommt in das Interface `IMap2DVisibilitorHelpers` und
  in beide Implementierungen; Assertions (a), (c), (d) aus §7 des
  Lifecycle-Dokuments gehören dazu. Zug 0 hat drei Stellen dazugenommen:
  Assertion (b) — beide Klassen bekommen Szene und Visibilitor hereingereicht
  und lassen beide stehen —, die Browser-Testfläche, weil GPU-Geometrie
  freigegeben wird, und das CHANGELOG samt Migrationsabschnitt, weil ein
  Pflichtmitglied in einem exportierten Interface die öffentliche Oberfläche
  bewegt. `HelpersManager` bleibt unangetastet: er besitzt keine eigene
  Ressource und gibt über `scene = undefined` alles her.
- Hash: 51ab0388
- Ergebnis: 2 Runden · MEM-004, CONS-036 und CONS-022 behoben, von zwei
  Reviewern je mit Fundstelle bestätigt · Regressionstest: acht Assertionen in
  einem neuen `describe('dispose()')` je in
  `CameraBasedVisibilityHelpers.spec.ts` und
  `RectangularVisibilityAreaHelpers.spec.ts` — »releases the geometry and the
  material of every node it built«, »leaves the scene it was handed and the
  visibility it reads alone«, »stays down after dispose()« und »a second
  dispose() releases nothing a second time«, alle acht vor dem Fix rot mit
  `TypeError: helpers.dispose is not a function`; an echter GPU »dispose()
  takes the whole set down and releases what it built« in
  `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js`, ebenso
  rot · Runde 1 war ein reiner Doku-Nachzug: der CHANGELOG-Eintrag schrieb
  `isDisposed` dem Interface zu, das nur `dispose()` führt, und der Migration
  Guide sagte nicht, warum ein leerer Rumpf dort genügt, wo nichts zu besitzen
  ist · klein und stehengelassen: drei Stellen, aufgezählt in der Paketdatei —
  die strenge Zusage im Interface-TSDoc gegen das lockere Beispiel im Migration
  Guide, `isDisposed` fehlt dem Interface, und der einzige Aufrufer im
  Repository (`apps/lookbook/src/demos/map2d-rect-visi.ts:66`) hat keinen
  Teardown-Hook, an den ein `dispose()` gehörte
- Nebenbefunde: → Queue (2 Einträge, beide an
  `git show 3b673f63:packages/twopoint5d/src/map2d/RectangularVisibilityAreaHelpers.ts`
  als vorbestehend geprüft; keiner teilt die Ursache dieses Pakets)
- Folgen: keine. Das neue Pflichtmitglied im Interface trifft nur die beiden
  mitgelieferten Implementierungen — `IMap2DVisibilitorHelpers` wird im
  Repository von niemandem sonst implementiert und von keiner Stelle als
  Parameter- oder Feldtyp angenommen, geprüft über Bibliothek, Specs,
  `packages/twopoint5d-testing/test/` und `apps/lookbook/`. Für den
  Abschlussreport bleibt die Semver-Folge: ein Pflichtmitglied in einem
  exportierten Interface bricht jede fremde Implementierung, der
  Migrationsabschnitt im CHANGELOG hält den Handgriff fest.
- Schnittstellen: `IMap2DVisibilitorHelpers` führt `dispose(): void` als
  Pflichtmitglied — eine eigene Implementierung braucht es, notfalls mit leerem
  Rumpf. `isDisposed` steht **nicht** im Interface, nur auf den beiden Klassen
  `CameraBasedVisibilityHelpers` und `RectangularVisibilityAreaHelpers`; wer
  gegen den Interface-Typ programmiert, kann »ausgeschaltet« und »tot« nicht
  auseinanderhalten und braucht es auch nicht, weil nach `dispose()` alle vier
  Member stille No-Ops sind. In beiden Klassen gilt: `dispose()` schreibt
  `#show` direkt (nicht über den Setter), gibt den Satz über
  `#helpers.scene = undefined` an den `HelpersManager` zurück, der jeden Knoten
  aus Szene und Root nimmt und sein `dispose()` ruft, und ist idempotent.
  Danach ist `isDisposed` `true`, `show` antwortet `false`, und ein Schreiben
  auf `show`, `add()`, `remove()`, `update()` und ein zweites `dispose()` tun
  nichts; die öffentlichen Felder nehmen weiter Werte an, ohne Wirkung. Was
  hereingereicht wurde — Szene, Visibilitor, Visibility Area — bleibt dem
  Aufrufer und wird nicht disposed. `HelpersManager` hat weiterhin kein
  `dispose()`; `scene = undefined` ist dort der ganze Weg.
  `CameraBasedVisibilityHelpers#makePointOnPlane(point)` nimmt den `Vector2`
  ab jetzt pflichtig — `private`, die öffentliche Oberfläche bewegt sich
  dadurch nicht.

### [x] 5. Publish-Pipeline: `workspace:`-Specifier korrekt auflösen

- Findings: BUG-096 (low), BUG-097 (low)
- Ziel: Ein pfadförmiger Specifier bricht den Wächter ab, statt als Pfad ins
  veröffentlichte Manifest zu gehen; ein ausgeschriebener Bereich geht
  unverändert raus, wie `docs/architecture.md` es zusagt.
- Detail: `docs/remediation/paket-5.md`
- Bereich: `scripts/makePackageJson/resolveDependencies.mjs` (+ `.test.mjs`),
  `findUnpublishableSpecifiers.test.mjs`; dazu die Root-`package.json` samt
  `pnpm-lock.yaml` und `docs/architecture.md` §4
- Hängt ab von: —
- Anmerkung: Verifikation läuft über `pnpm test:scripts` (`node --test`), nicht
  über Vitest; das Gate vor dem Commit bleibt `pnpm run ci`.
  `scripts/publishNpmPkg.mjs` wird in keinem Zug ausgeführt. Zug 0 hat drei
  Dateien dazugenommen: `semver` kommt als Root-devDependency herein, weil die
  Prüfung eines ausgeschriebenen Bereichs `validRange` braucht und ein eigener
  Prüfer semver nachbauen müsste, und `docs/architecture.md` §4 zählt die
  Auflösungsregeln auf, die sich dadurch ändern. `findUnpublishableSpecifiers.mjs`
  bleibt im Code unangetastet: die Prüfung gehört an die Stelle, die den Wert
  erzeugt, nicht in den Wächter, der sonst `file:`, `git+https:`, `npm:` und
  Dist-Tags mit abweisen würde.
- Hash: e7bc31f0
- Ergebnis: 1 Runde · BUG-096 und BUG-097 behoben · Regressionstests
  `a workspace: dependency with a range ships that range even when no package
  carries the name` und `a workspace: specifier whose range is no version range
  stays as it is` in `scripts/makePackageJson/resolveDependencies.test.mjs`,
  beide vor dem Fix rot · dazu der dokumentierende Test
  `names a path-shaped workspace: specifier the resolution left standing` in
  `findUnpublishableSpecifiers.test.mjs`, der vorher wie nachher grün ist ·
  `pnpm run test:scripts` steht bei 28 Tests, 5 Suites, 0 fail · klein: der
  Kommentar an `resolveDependencies.mjs:61` begründet die Reihenfolge von
  `range === ''` und `validRange` nicht; ein gültiger Bereich geht als Rohwert
  statt normalisiert heraus
- Nebenbefunde: keine
- Folgen: keine
- Schnittstellen: `semver` ist neue devDependency der Root-`package.json`
  (`^7.8.5`, bewusst nicht im `catalog:` von `pnpm-workspace.yaml` — Werkzeug
  der Root-Skripte, wie `yaml`). Sie taucht dadurch in der
  `sharedDependencies`-Map aus `makePackageJson.mjs:19` auf.
  `resolvePackageVersion()` in `scripts/makePackageJson/resolveDependencies.mjs`
  behält seine Signatur, liefert aber für einen `workspace:`-Bereich, den
  `semver.validRange` nicht kennt, `undefined` — der Specifier bleibt im
  Manifest stehen und `findUnpublishableSpecifiers()` lässt den Build daran
  scheitern.

### [x] 6. display: Ein disposetes Display abweisen und die Ownership-Texte geraderücken

- Findings: CONS-027 (low), CONS-040 (info), CONS-021 (low)
- Ziel: Eine FixedFrameLoop über einem toten Display entsteht gar nicht erst,
  statt lebendig auszusehen und nichts zu tun.
- Detail: `docs/remediation/paket-6.md`
- Bereich: `packages/twopoint5d/src/display/FixedFrameLoop.ts` (+ Spec),
  `Stylesheets.ts`, `packages/twopoint5d-testing/test/display-adopt-renderer.test.js`;
  dazu das CHANGELOG
- Hängt ab von: —
- Anmerkung: Alle drei Findings stehen unverändert da; nur die Fundstelle von
  CONS-027 ist gewandert — der Konstruktor liegt heute auf
  `FixedFrameLoop.ts:181-198`. Zug 0 hat eine Datei dazugenommen: das CHANGELOG
  braucht `Changed` und einen Migrationsabschnitt, weil der neue Wurf ein
  bisher erlaubtes Aufrufmuster abweist. Aufrufer gibt es im Repository keine —
  `new FixedFrameLoop` taucht außerhalb der eigenen Spec nirgends auf. Kein
  Nebenbefund aus der Queue kommt herein: keiner teilt die Ursache dieses
  Pakets, auch nicht die `dispose()`-TSDoc in `Canvas2DStage.ts:211`, die
  thematisch danach klingt (Begründung in der Paketdatei).
- Hash: 7675e843
- Ergebnis: 1 Runde · CONS-027, CONS-040 und CONS-021 behoben, vom Reviewer je
  mit Fundstelle bestätigt · Regressionstest
  `a display that has been disposed > the constructor refuses it and builds no
  loop` in `packages/twopoint5d/src/display/FixedFrameLoop.spec.ts`, vor dem
  Guard rot mit »AssertionError: expected [Function] to throw an error« (1
  failed | 41 passed), danach 42 von 42 · der Reviewer hat die Aufrufersuche
  eigenständig über `.ts`, `.js`, `.astro`, `.md` und `.mdx` wiederholt und
  keinen Aufrufer außerhalb der Spec gefunden · klein und stehengelassen: die
  Fehlermeldung sagt »Build the loop while the display is alive, or hand it a
  live display« und damit zweimal dasselbe, und der Nachsatz des
  CHANGELOG-Eintrags über `isDisposed === false` beschreibt einen Zustand, den
  es nach dieser Änderung nicht mehr gibt — beide wörtlich aus dem Detailplan
- Nebenbefunde: keine
- Folgen: keine. Kein Aufrufer im Repository baut eine `FixedFrameLoop`
  außerhalb der eigenen Spec; die bestehenden `makeFakeDisplay()`-Aufrufe dort
  bleiben über den Default `isDisposed = false` am Leben. Für den
  Abschlussreport bleibt die Semver-Folge: ein vormals erlaubtes Aufrufmuster
  wirft jetzt, der Migrationsabschnitt im CHANGELOG hält es fest.
- Schnittstellen: `new FixedFrameLoop(display)` wirft einen `Error`, wenn
  `display.isDisposed` `true` ist — die Meldung nennt Klasse und Zustand, und
  es entsteht kein Loop, dessen Subscriptions danach aufzuräumen wären. Der
  Guard steht vor `eventize(this)`; wer einen Loop über einem fremden Display
  baut, fragt `Display#isDisposed` zuerst. `Display` selbst ist unangetastet,
  `isDisposed` wird dort nur gelesen. `FrameLoop` und `Chronometer` nehmen
  weiterhin kein Display entgegen und weisen nichts ab.
  `Stylesheets.releaseRule()` behält Signatur und Verhalten auf jedem Pfad;
  nur die Reihenfolge der Lookups ist eine andere.

### [x] 7. texture: Animationsnamen, Guard-Meldung und die Loader-Signaturen

- Findings: CONS-003 (low), IMPL-002 (low), CONS-032 (low), CONS-044 (info)
- Ziel: Eine ohne Namen angelegte Animation bleibt auffindbar, und der
  Größen-Guard erklärt dem Aufrufer, was er überschritten hat.
- Detail: `docs/remediation/paket-7.md`
- Bereich: `packages/twopoint5d/src/texture/` — `FrameBasedAnimations.ts`
  (+ Spec), `TileSetLoader.ts`, `TextureImageLoader.ts`,
  `TextureAtlasLoader.ts`, `TextureResource.ts`, `TextureImageLoader.spec.ts`;
  dazu das CHANGELOG
- Hängt ab von: —
- Anmerkung: Alle vier Findings stehen unverändert an ihrer Fundstelle. Zug 0
  hat zwei Dateien dazugenommen: `TextureAtlasLoader.ts` trägt als dritter
  Loader desselben Moduls einen dritten Vertrag für `textureClasses` und teilt
  damit die Ursache von CONS-032 (als vorbestehend geprüft), und das CHANGELOG
  braucht `Changed`, weil der Default-Animationsname und die Loader-Signaturen
  die öffentliche Oberfläche bewegen. Kein Migrationsabschnitt und keine
  Browser-Testfläche: keine der Änderungen bricht einen Aufrufer, und das
  Layout der Datentextur bleibt dasselbe (Begründungen in der Paketdatei). Kein
  Nebenbefund aus der Queue kommt herein — keiner liegt in `texture/`.
- Hash: 0e8ceaa1
- Ergebnis: 1 Runde · CONS-003, IMPL-002, CONS-032 und CONS-044 behoben, je mit
  Fundstelle im Reviewer-Urteil · Regressionstests
  `an animation added without a name gets one it can be found under`,
  `a second animation without a name gets the next name of the counter`,
  `a name the caller already took is stepped over, not overwritten` und
  `a data texture over the maximum is refused with the numbers that were asked for`
  (alle vier vor dem Fix rot) sowie
  `a load without texture classes reaches the factory with none` (vor dem Fix
  brach der Typecheck an der pflichtigen Signatur ab) · kein kritischer und
  kein wichtiger Befund des Reviewers · klein: der CHANGELOG-Eintrag verspricht
  den »must be unique«-Fall für einen vom Zähler bereits vergebenen Namen, und
  genau dieser Fall hat keinen Test · klein: `#anonymousCounter++` steht zweimal
  als Seiteneffekt in derselben Template-Zeile
- Nebenbefunde: → Queue
- Folgen: `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:161-167` —
  `add()` vergibt den Auto-Namen, bevor es `frames` und `duration` prüft, also
  bleibt der Zähler nach einem Wurf vorgerückt und die nächste anonyme
  Animation heißt `anim_1`, obwohl `anim_0` nie registriert wurde; harmlos,
  weil der Name nur eindeutig sein muss und `#nextAnonymousName()` Lücken
  ohnehin überspringt. Dieselbe Stelle: `if (name)` behandelt den leeren String
  als »kein Name«, der damit jetzt `anim_N` bekommt statt eines Symbols — von
  der Paketdatei so gewollt, der Zweig bleibt unangetastet · triagiert in Zug 0
  von Paket 9: die Namensvergabe vor der Prüfung ist ein Symptom und geht an
  Paket 10, der leere String bleibt, wie er ist
- Schnittstellen: `FrameBasedAnimations#add()` ohne Namen registriert die
  Animation unter `anim_0`, `anim_1` und so weiter — ein String im selben
  Lookup, den `hasAnimation()` und `animId()` bedienen; `AnimName` bleibt
  `string | symbol`, ein Aufrufer darf weiterhin selbst ein Symbol übergeben.
  Der Vertrag für `textureClasses` ist in allen drei Loadern derselbe:
  `load(url, textureClasses: Array<TextureOptionClasses> | null | undefined, onLoadCallback, …)`
  und `loadAsync(url, textureClasses?: Array<TextureOptionClasses> | null, …)`
  bei `TileSetLoader`, `TextureImageLoader` und `TextureAtlasLoader`; ein
  fehlender Wert heißt an jedem der drei »leere Liste«. Eine Lockerung, kein
  Aufrufer bricht

### [x] 8. stage: Projektionen und Canvas2DStage in den Gleichschritt bringen

- Findings: CONS-025 (low), CONS-043 (info), CONS-026 (low)
- Ziel: `updateCamera()` wendet dieselben Specs an wie `createCamera()`, und
  die Canvas2DStage hält Stage- und Renderer-Größe zusammen.
- Detail: `docs/remediation/paket-8.md`
- Bereich: `packages/twopoint5d/src/stage/` — `ParallaxProjection.ts`,
  `OrthographicProjection.ts`, `Canvas2DStage.ts`, je mit Spec; dazu das
  CHANGELOG
- Hängt ab von: Paket 2 (beide fassen die Stage-Kamerapfade an; Paket 2
  committet zuerst, damit die Diffs sich nicht überlagern) — committet als
  `6369ae7f`
- Anmerkung: Alle drei Findings stehen unverändert da; die Fundstellen von
  CONS-025 sind gewandert, weil Paket 2 `Stage2D` verlängert hat. Das
  Kamera-Setup wandert in ein gemeinsames `#applyToCamera()`, der Guard über
  `isPerspectiveCamera`/`isOrthographicCamera` sitzt in `updateCamera()`, das
  seinen Parameter auf `Camera` weitet — die heutige Verengung ist das Loch,
  durch das eine falsche Kamera stumm durchgeht. Zug 0 hat vier Dateien
  dazugenommen: die drei Specs, weil `updateCamera()` bis auf Randfälle
  ungetestet ist, und das CHANGELOG, das `Changed`, `Fixed` und einen
  Migrationsabschnitt braucht — die Projektion führt ab jetzt auch eine an
  `Stage2D#camera` gehängte Kamera. `Stage2D.ts` und `ProjectionPlane.ts`
  bleiben unangetastet, und keine Browser-Testfläche kommt hinzu
  (Begründungen in der Paketdatei). Kein Nebenbefund aus der Queue kommt
  herein: der einzige in `stage/` ist die `dispose()`-TSDoc in
  `Canvas2DStage.ts:211`, die eine andere Ursache hat.
- Hash: d5dcd2ab
- Ergebnis: 1 Runde · CONS-025, CONS-026 und CONS-043 behoben, je mit
  Fundstelle im Reviewer-Urteil · Regressionstests
  `carries the near and the far of the specs onto a camera it updates`,
  `moves a camera it updates to the distance the specs now name` (in beiden
  Projektionsspecs), `aims a camera it updates at the projection plane` (in
  beiden), `refuses a camera that is no PerspectiveCamera`,
  `refuses a camera that is no OrthographicCamera` und
  `drives the stage renderer when the container size is set` — acht Fälle, alle
  vor dem Fix rot (8 failed | 260 passed) · kein kritischer und kein wichtiger
  Befund des Reviewers · Abweichung vom Detailplan, vom Reviewer geprüft und
  getragen: die beiden Orientierungstests je Projektionsspec stehen auf der
  Projektionsebene `'xz|top-left'` statt `'xy|bottom-left'`, weil die Rotation
  auf `'xy|bottom-left'` die Identität ist und der Test dort nicht rot werden
  kann; `projectionFor` hat dafür einen Parameter `projectionPlane` mit
  `'xy|bottom-left'` als Default bekommen · die beiden Tests
  `leaves the orientation where it is when it updates the same camera twice`
  sind vorher wie nachher grün: sie halten den Identitäts-Reset fest, nicht den
  behobenen Fehler; der Implementierer hat gegengeprüft, dass beide ohne
  `camera.quaternion.identity()` rot werden · klein: der `Fixed`-Eintrag im
  CHANGELOG sagt »instead of staying `0`« und benennt damit den Vorzustand —
  bleibt stehen, weil eine `Fixed`-Zeile dem Konsumenten sagt, was sich für ihn
  ändert, und das die Gangart dieses CHANGELOGs ist
- Nebenbefunde: → Queue
- Folgen: `packages/twopoint5d/src/stage/Stage2D.ts:124` — die TSDoc des Setters
  `camera` sagt »A camera assigned here takes precedence over the projection's«;
  das stimmt für den Vorrang, verschweigt aber, dass die Projektion diese Kamera
  ab jetzt bei jedem `updateProjection()` und jedem Resize an die
  Projektionsebene zurücksetzt. Der Hinweis steht in CHANGELOG und
  Migrationsabschnitt, nicht dort, wo ein Konsument beim Zuweisen nachliest ·
  `packages/twopoint5d/src/stage/ParallaxProjection.ts:139` und
  `OrthographicProjection.ts:135` — `#applyToCamera()` ruft
  `expectDefined(this.projectionPlane, …)`, also wirft `updateCamera()` ab jetzt
  auf einer Projektion ohne Plane; `createCamera()` warf dort schon vorher, und
  im Repo gibt es außer `Stage2D.ts:207` keinen Aufrufer, der Fall steht aber in
  keinem CHANGELOG-Eintrag eigens ·
  `packages/twopoint5d/src/stage/Canvas2DStage.ts:149-156` —
  `StageRenderer#resize()` (`StageRenderer.ts:285`) kehrt bei unveränderter Größe
  früh zurück, also reicht `setContainerSize()` mit der Größe, die der Renderer
  schon trägt, kein `stage.resize()` mehr durch; unschädlich, weil
  `setCanvasSize()` die Stage über `updateProjection(true)` selbst treibt, aber
  eine Verhaltensänderung ohne CHANGELOG-Zeile · alle drei triagiert in Zug 0
  von Paket 9: Symptome derselben Umstellung, → Paket 10
- Schnittstellen: `ParallaxProjection#updateCamera(camera: Camera)` und
  `OrthographicProjection#updateCamera(camera: Camera)` nehmen den Typ, den
  `IProjection` nennt — eine Lockerung, kein Aufrufer bricht. Beide wenden
  dasselbe Setup an wie `createCamera()`: `fov` und `aspect` bzw.
  `left`/`right`/`top`/`bottom`, dann `near` und `far`, dann die Orientierung der
  Projektionsebene (die Quaternion wird dafür zuerst auf die Identität gesetzt,
  weil `ProjectionPlane#applyRotation()` relativ multipliziert) und zuletzt die
  Position in `distanceToProjectionPlane`. Eine Kamera des falschen Typs wird mit
  einem `TypeError` abgewiesen, der Klasse, Aufruf und erhaltenen Typ nennt —
  geprüft über `isPerspectiveCamera` bzw. `isOrthographicCamera`. Wer eine Kamera
  an einer `Stage2D` selbst steuern will, gibt der Stage keine Projektion; sonst
  holt jeder Resize sie an die Projektionsebene zurück. `#applyToCamera()` ist
  privat und kein neues öffentliches Symbol; `createCamera()` behält seinen
  verengten Rückgabetyp. `Canvas2DStage#setContainerSize(width, height)` behält
  Signatur und `#disposed`-Guard, geht aber über
  `stageRenderer.resize(width, height)`: `stageRenderer.width` und `.height`
  tragen danach die Containergröße. `Stage2D.ts` und `ProjectionPlane.ts` sind
  unangetastet

### [x] 9. vertex-objects: Geometrie-Name, Ownership-TSDoc und Regelreihenfolge

- Findings: CONS-024 (low), CONS-038 (low)
- Ziel: Eine kopierte Geometrie behält ihren Namen, und die Ownership-Texte
  beschreiben, was tatsächlich passiert.
- Detail: `docs/remediation/paket-9.md`
- Bereich: `packages/twopoint5d/src/vertex-objects/` —
  `InstancedVOBufferGeometry.ts`, `GeometryAttributeSlots.ts`,
  `asInstancedCopySource.ts`, `asThreeTypedArray.ts`,
  `VertexObjectDescriptor.ts`, `vertex-buffers-geometry-updates.spec.ts`,
  `VertexObjectDescriptor.spec.ts`; dazu `packages/twopoint5d/src/sprites/matrixColumn.ts`
  und das CHANGELOG
- Hängt ab von: —
- Anmerkung: Beide Findings stehen unverändert da, beide Hälften von CONS-024 an
  der Quelle von three 0.185.1 belegt. Zug 0 hat fünf Stellen dazugenommen, die
  dieselbe falsche Ownership-Prämisse tragen und die das Finding nicht nennt:
  `InstancedVOBufferGeometry.ts:548-549`, `GeometryAttributeSlots.ts:60` und die
  beiden CHANGELOG-Einträge auf `:66` und `:178`, dazu das dritte veraltete
  Versionszitat in `sprites/matrixColumn.ts:5`. Die vom Finding genannte
  `#vacatedSlots`-TSDoc trägt die Prämisse dagegen nicht und bleibt. CONS-038
  bekommt zwei Schleifen statt eines umformulierten TSDoc, und CONS-038 bekommt
  keinen CHANGELOG-Eintrag (Begründungen in der Paketdatei). Keine
  Browser-Testfläche: es bewegt sich kein Buffer. Kein Nebenbefund aus der Queue
  kommt herein — keiner liegt in `vertex-objects/`.
- Hash: 1ac62496
- Ergebnis: 1 Runde · CONS-024 in allen drei Hälften behoben (Name hinter dem
  `copy()` auf `InstancedVOBufferGeometry.ts:125`, die Ownership-Begründung an
  allen fünf Stellen auf »`copy()` klont«, die drei Versionszitate auf
  `three 0.185.1` bzw. `@types/three@0.185.4`), CONS-038 behoben (zwei Schleifen
  in `VertexObjectDescriptor.ts:78-91`, Meldungen und TSDoc wortgleich) ·
  Regressionstests `keeps the name of its class when it is built from a
  BufferGeometry` und `takes no name from the geometry it is built from` in
  `vertex-buffers-geometry-updates.spec.ts` sowie `the size of a later attribute
  before the components of an earlier one` in `VertexObjectDescriptor.spec.ts` —
  alle drei vor dem Fix rot · Reviewer ohne Befund, auch ohne kleinen
- Nebenbefunde: keine
- Folgen: keine — Implementierer und Reviewer haben `packages`, `apps` und
  `docs` nach der Prämisse »belong to the caller« und nach `0.183.1`
  durchsucht, es bleibt keine Fundstelle offen
- Schnittstellen: `new InstancedVOBufferGeometry(pool, capacity, geometry)`
  antwortet auf `name` mit `'InstancedVOBufferGeometry'` und übernimmt keinen
  Namen aus der übergebenen Geometrie. `VertexObjectDescriptor` meldet bei einer
  Beschreibung, die mehrere Regeln zugleich bricht, die Regel mit der
  niedrigsten Nummer — eine Größe unter 1 also vor zu vielen Komponenten. Die
  Fehlermeldungen selbst sind unverändert, keine Signatur bewegt sich

### [x] 10. Nachzug: die Kamera-Umstellung zu Ende dokumentieren und den Auto-Namen erst nach der Prüfung vergeben

- Findings: keine — vier Symptome aus den `Folgen:`-Zeilen der Pakete 7 und 8,
  triagiert in Zug 0 von Paket 9
- Folge von: Paket 7, Paket 8
- Ziel: Was die beiden Umbauten an Doku und Reihenfolge umgeworfen haben, sagt
  wieder, was der Code tut.
- Detail: `docs/remediation/paket-10.md`
- Bereich: `packages/twopoint5d/src/stage/` — `Stage2D.ts:124` (TSDoc des
  `camera`-Setters), dazu die CHANGELOG-Zeilen zum Wurf von `updateCamera()`
  ohne Projektionsebene (`ParallaxProjection.ts:139`,
  `OrthographicProjection.ts:135`) und zum `setContainerSize()`, das bei
  unveränderter Größe kein `stage.resize()` mehr durchreicht
  (`Canvas2DStage.ts:149-156`); `packages/twopoint5d/src/texture/FrameBasedAnimations.ts:161-167`
  (+ Spec) für die Namensvergabe nach der Prüfung von `frames` und `duration`
- Hängt ab von: —
- Anmerkung: Zwei Ursachen in einem Paket, mit Absicht. Getrennt wären es ein
  Drei-Zeilen- und ein Ein-Zeilen-Paket, jedes mit drei Agenten-Kaltstarts und
  einem vollen `pnpm run ci` — der Kopf dieser Datei sagt selbst, dass der
  Schnitt dieses Laufs zu fein ist. Die Generationszählung bleibt lesbar, weil
  `Folge von:` beide Wurzeln nennt; erzeugt dieses Paket seinerseits eine Folge,
  ist das für beide Ketten die dritte Generation und wird vorgelegt. Die
  zweite Hälfte der Folge aus Paket 7 — `if (name)` behandelt den leeren String
  als »kein Name« — ist dort ausdrücklich so gewollt und bleibt unangetastet.
  Alle vier Symptome stehen an ihrer Fundstelle, zwei Zeilennummern sind
  gewandert. Zug 0 hat eine Datei dazugenommen: `Stage2D.spec.ts`, weil die neue
  TSDoc-Aussage sonst dieselbe Aussage ohne Absicherung wäre, an der dieses Paket
  hängt. Kein Nebenbefund aus »Offene Befunde« kommt herein — die drei in
  berührten Dateien (`Canvas2DStage.ts:211`, `ParallaxProjection.ts:153`,
  `TextureAtlasLoader.ts:74-80`) tragen je eine andere Ursache, Begründungen in
  der Paketdatei.
- Hash: d7cea23c
- Ergebnis: 1 Runde · alle fünf Schritte des Detailplans erfüllt, Reviewer ohne
  kritischen und ohne wichtigen Befund · Regressionstest
  `an add that throws spends no name of the counter` (vor dem Fix rot:
  `animId('anim_0')` warf, weil der abgewiesene `add()` den Namen verbraucht
  hatte) · dazu der schon vorher grüne Test
  `lets the projection place a camera it was given`, der die neue TSDoc-Aussage
  absichert · klein: »every `updateProjection()`« in der neuen TSDoc ist eine
  Spur zu weit gefasst, kein Test für den Wurf ohne Projektionsebene und für den
  Frühausstieg von `setContainerSize()`, nacktes `toThrow()` im
  Regressionstest, Commit-Message ohne Scope — Begründungen in der Paketdatei
- Nebenbefunde: → Queue (4)
- Folgen: keine
- Schnittstellen: `FrameBasedAnimations#add()` vergibt den Auto-Namen
  (`anim_0`, `anim_1`, …) erst, nachdem Frames und Dauer aufgelöst sind — ein
  `add()`, das wirft, verbraucht keinen Namen mehr, und der Zähler folgt den
  registrierten Animationen. Signatur und Rückgabe sind unverändert, die
  Eindeutigkeitsprüfung für einen übergebenen Namen bleibt vorn, und der leere
  String gilt weiterhin als »kein Name«.

### [x] 11. Lookbook: CSS, das der Browser verwirft, und ein Bild, das niemand sieht

- Nebenbefund: 9 Einträge aus der Queue (1 low, 8 info) — die acht beim Schnitt
  vorgesehenen minus dem Bild, das Zug 0 als gegenstandslos ausgewiesen hat,
  plus zwei Fundstellen derselben Ursache aus dem Abgleich
- Ziel: Jede Deklaration im Lookbook wirkt, und was nicht wirkt, steht nicht mehr da.
- Detail: `docs/remediation/paket-11.md`
- Bereich: `apps/lookbook/` — zwölf Demos unter `src/pages/demos/`, dazu
  `src/pages/index.astro`, `src/components/TagCloudFilter.astro` und die
  `engines` der Root-`package.json`
- Hängt ab von: —
- Anmerkung: Der grob geschnittene Ersatz für drei Kosmetikpakete — alle
  Einträge teilen Domäne und Diff-Fläche, der Reviewer liest ohnehin dieselben
  Dateien. Zwei Fälle sind mehr als Kosmetik: `display: inline-fl` lässt
  `.actionBtn` ein Block-`div` bleiben, und der verschriebene Klassenname
  `tag-catgeory-description` wirkt nur, weil er an beiden Stellen gleich falsch
  steht — wer eine davon korrigiert, bricht das Styling. Die Engine-Range
  gehört nicht zum Lookbook, aber in denselben Aufräumgang: sie stammt aus
  demselben Paket, das den Lint dorthin ausgedehnt hat. Das Bild im Titel
  bleibt liegen: Paket 1 hat seinen Import entfernt, damit landet es nicht mehr
  im Build, und eine ungenutzte Asset-Datei war nie der Befund.
- Anmerkung zum Verify: Für Lookbook-CSS gibt es im Repository keine
  Testfläche — kein Regressionstest, der Beleg ist der grüne `pnpm run ci`
  samt `astro build`, `astro check` und `prettier --check`.
- Hash: 19e183e2
- Ergebnis: 1 Runde · alle 9 Queue-Einträge behoben, vom Reviewer je mit
  Fundstelle bestätigt · kein Regressionstest (keine Testfläche für
  Lookbook-CSS, Beleg ist `pnpm run ci` exit=0) · klein: die Doku nennt die
  Node-Untergrenze gerundet
- Nebenbefunde: keine neuen; die beiden Lookbook-Funde des Implementierers →
  Queue
- Folgen: `AGENTS.md:28`, `README.md:75` und `docs/architecture.md:108` nennen
  »Node ≥24« bzw. »v24 or newer«, `.nvmrc` und `mise.toml` stehen auf `24` —
  die `engines` verlangen jetzt 24.16. Bricht nichts, ist aber gröber als die
  Quelle, auf die `AGENTS.md` ausdrücklich verweist · triagiert in Zug 0 von
  Paket 12: Symptom dieses Pakets, das seine Doku nicht mitgezogen hat, und
  Paket 11 ist committet — also ein Nachtrag, → Paket 14
- Schnittstellen: `engines.node` der Root-`package.json` ist
  `^24.16.0 || >=26.3.0`; die CSS-Klasse des Lookbook-Tag-Filters heißt
  `tag-category-description`.

### [x] 12. map2d: Die beiden Visibility-Helfer auf dasselbe Verhalten bringen

- Nebenbefund: 5 Einträge aus der Queue (2 low, 3 info)
- Ziel: `show = false` hält den rechteckigen Helfer wirklich an, statt pro Frame
  eine Geometrie zu allokieren, die laut eigenem Zustand gar nicht da ist.
- Detail: `docs/remediation/paket-12.md`
- Bereich: `packages/twopoint5d/src/map2d/` —
  `RectangularVisibilityAreaHelpers.ts` (+ Spec), `RepeatingTilesProvider.ts`
  (+ Spec), `Map2DTileStreamer.spec.ts`; dazu
  `apps/lookbook/src/demos/map2d-rect-visi.ts`,
  `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js` und das
  CHANGELOG; zum Gegenlesen `CameraBasedVisibilityHelpers.ts`, `HelpersManager.ts`
- Hängt ab von: —
- Anmerkung: Zwei der Einträge hängen zwingend zusammen — `update()` bekommt
  sein `show`-Gate, und im selben Zug muss `set show` `#show` vor dem
  `update()`-Aufruf schreiben, sonst schaltet ein `show = true` nichts mehr ein.
  Getrennt behoben wäre der erste Fix ein Regressionsrisiko. Das Schwestermodul
  `CameraBasedVisibilityHelpers` ist an allen drei Stellen die Vorlage.
- Anmerkung zur Namensfalle: Der Befund zeigt auf
  `apps/lookbook/src/demos/map2d-rect-visi.ts:111`. Daneben liegt
  `apps/lookbook/src/pages/demos/map2d-rect-visi.astro` — gleicher Name,
  anderes Verzeichnis, andere Datei, und die gehört Paket 11. Die beiden Pakete
  überschneiden sich nicht.
- Anmerkung: Zug 0 hat drei Stellen dazugenommen. Der rechteckige Helfer behält
  seinen Knoten über Updates hinweg, wie das Schwestermodul seine Pools behält —
  sonst allokiert die Demo nach ihrem `show = true` weiter eine Geometrie pro
  Frame, also genau das, was der Eintrag benennt. Der einzige Aufrufer im
  Repository (`apps/lookbook/src/demos/map2d-rect-visi.ts:67`) bekommt dieses
  `show = true`, sonst zeigt die Demo nach dem Gate nichts mehr. Und ein Fall an
  echter GPU kommt dazu, weil sich ändert, wann eine Liniengeometrie entsteht und
  wann sie fällt. `types.ts` bleibt unangetastet (Begründung in der Paketdatei),
  und der Eintrag zu `remove()` ist kein Schönheitsfehler: über die Wurzel im
  `HelpersManager` reißt eine fremde Szene heute den eigenen Knoten herunter.
- Hash: 56212f45
- Ergebnis: 1 Runde · alle fünf Queue-Einträge behoben, vom Reviewer je mit
  Fundstelle bestätigt · Regressionstests in
  `RectangularVisibilityAreaHelpers.spec.ts`: `builds nothing while show is off`,
  `a scene this helper was never handed keeps its node where it is` und
  `a second update() writes into the node that stands` — alle drei vor dem Fix rot
  · dazu `switching show back on builds the helper again` (hält die Reihenfolge im
  `show`-Setter) und an echter GPU
  `the rectangular helper keeps its node across frames and takes it down with show`
  in `packages/twopoint5d-testing/test/map2d-visibility-helpers.test.js` · klein:
  der TSDoc-Satz an `show` legt nahe, ein nachgereichtes `add()` baue den Knoten
  von allein; der Spec macht einen Knoten über `as unknown as {…}` statt
  `as Box3Helper` auf
- Nebenbefunde: → Queue (3 Einträge: `HelpersManager.ts:79-81` und `:55`,
  `apps/lookbook/src/demos/map2d-rect-visi.ts:67-68`)
- Folgen: keine
- Schnittstellen: `RectangularVisibilityAreaHelpers#update()` baut nur, solange
  `show` `true` ist **und** eine Szene über `add()` dasteht — ein Aufrufer, der
  jeden Frame `update()` ruft, muss `show = true` setzen, sonst bleibt alles
  unten. Der gebaute `Box3Helper` bleibt über Updates hinweg dieselbe Instanz und
  folgt der in place geschriebenen `Box3`; `viewRectHelperColor` wird bei jedem
  `update()` auf das Material kopiert, wirkt also auch nach dem Bau noch.
  `remove(scene)` mit einer Szene, die der Helfer nie bekommen hat, ist ein
  No-op. `RepeatingTilesProvider` gibt für jede nicht erkannte Form (kein
  Argument, leeres Array, fremde Gestalt) `tileIds === [[]]` — Verhalten
  unverändert, jetzt in einer geschlossenen `else`-Kette

### [x] 13. texture und stage: Ein Leak im Atlas-Pfad, ein halber Resize und was die TSDoc verschweigt

- Nebenbefund: 8 Einträge aus der Queue (3 low, 5 info)
- Ziel: Ein fehlgeschlagener Atlas-Load lässt keine Textur zurück, ein
  abgebrochenes `resize()` keine Stage, die eine nie angekündigte Sicht meldet.
- Detail: `docs/remediation/paket-13.md`
- Bereich: `packages/twopoint5d/src/texture/` — `TextureAtlasLoader.ts`,
  `FrameBasedAnimations.ts` (+ Spec); `packages/twopoint5d/src/stage/` —
  `Stage2D.ts` (+ Spec), `Canvas2DStage.ts`, `ParallaxProjection.ts`
- Hängt ab von: —
- Anmerkung: Zwei Domänen in einem Paket, mit Absicht — getrennt wären es zwei
  Pakete mit je vier Einträgen, sechs Agenten-Kaltstarts und zwei vollen
  `pnpm run ci`-Läufen für eine Diff-Fläche, die ein Reviewer in einem Durchgang
  hält. Drei Einträge sind Korrektheit und brauchen je einen fehlschlagenden
  Test zuerst: die nicht freigegebene `Texture` im `catch` des Atlas-Loaders,
  der `resize()`-Abbruch mit halb geschriebenen Maßen, und der Atlas-Zweig von
  `add()`, der eine Animation mit null Frames widerspruchslos registriert. Die
  übrigen fünf sind TSDoc und ein Shadowing.
- Hash: ff393ae7
- Ergebnis: 2 Runden · alle acht Einträge behoben, vom Reviewer je mit Fundstelle
  bestätigt · drei Regressionstests, alle vor dem Fix rot: `a parse that throws
  releases the texture the image loader handed out` (0 statt 1 `dispose()`), `a
  resize the projection refuses leaves the stage the size it had` samt `a resize
  refused once goes through when the camera fits` (Sicht 640×320 statt 640×480,
  `OnStageResize` blieb aus) und vier Tests um die beiden neuen `add()`-Guards ·
  Runde 1 galt einer CHANGELOG-Zeile, die eine Erholung zusagte, die über einen
  `StageRenderer` nicht eintritt · klein: die Meldung bei `{frameRate: NaN}` nennt
  die `duration` statt der `frameRate` (Wortlaut steht so im Detailplan), die
  Commit-Message nannte den brechenden `add()`-Guard nicht (vor dem Commit ergänzt)
- Nebenbefunde: → Queue (3 Einträge: die halb geschriebene Resize-Transaktion im
  `StageRenderer`, die `width`/`height`-Halbwahrheit in der `dispose()`-TSDoc von
  `Canvas2DStage`, der irreführende Parametername von `ParallaxProjection#getZoom()`
  — keiner teilt die Ursache dieses Pakets, alle drei vorbestehend)
- Folgen: keine. Was die Änderung umgeworfen hat, ist mitgezogen: der bestehende
  Test `a parse that throws rejects instead of leaving the promise open` reichte
  eine Textur ohne `dispose()` herein und trägt jetzt eines, die Klassen-TSDoc von
  `TextureResource` (82-85) nennt den neuen `error`-Fall, und
  `animated-billboards.astro:73` als einziger `add()`-Aufrufer außerhalb der Specs
  übergibt acht Kachel-Ids und eine Dauer von 1 — von beiden Guards unberührt
- Schnittstellen: `FrameBasedAnimations#add()` weist eine Animation ohne Frames ab
  — eine `frameNameQuery` ohne Treffer, ein leerer Kachelbereich, eine leere
  Frame-Liste — und eine `duration`, die keine endliche Zahl ab null ist; negative
  Werte, `Infinity` und `NaN` (auch das aus `{frameRate: NaN}`) fallen darunter,
  eine Dauer von null bleibt als Standbild erlaubt. Beide Guards stehen vor der
  Namensvergabe, verbrauchen also keinen Namen des Auto-Zählers, und jede Meldung
  nennt Fall und Animation. Wer eine Query aus Daten baut, fragt
  `TextureAtlas#frameNames(query)` vorher; über einen `TextureResource` läuft der
  Fall als `error`-Event mit `{source: 'frameBasedAnimations', id, animation,
  error}` und überspringt nur diesen einen Eintrag. `Stage2D#resize()` und
  `#updateProjection()` lassen `width`, `height`, `containerWidth`,
  `containerHeight` und `needsUpdate` unverändert, wenn `updateCamera()` die Kamera
  mit einem `TypeError` abweist — der Wurf geht weiter, und derselbe Aufruf greift,
  sobald die Kamera passt. Über einen `StageRenderer` gilt das nicht: der schreibt
  seine eigene Größe und die jedes Stage-Items, bevor er den Aufruf durchreicht.
  `TextureAtlasLoader` gibt die Textur frei, wenn die Atlas-Json nicht gelesen
  werden kann, und übergibt `undefined` als `onProgress` an `FileLoader#load()`

### [x] 14. Nachzug: die Node-Untergrenze in Doku und Toolchain angleichen

- Findings: keine — eine Folge aus der `Folgen:`-Zeile von Paket 11, triagiert in
  Zug 0 von Paket 12
- Folge von: Paket 11
- Ziel: Wer die Node-Anforderung nachliest, findet überall die Zahl, die
  `engines` verlangt.
- Detail: `docs/remediation/paket-14.md`
- Bereich: `AGENTS.md:28`, `README.md:75`, `docs/architecture.md:108-109` — die
  Zeilennummer in `architecture.md` war um zwei verschoben, der Abgleich in Zug 0
  hat sie nachgezogen; `.nvmrc` und `mise.toml` bleiben unangetastet
- Hängt ab von: —
- Anmerkung: `engines.node` steht seit Paket 11 auf `^24.16.0 || >=26.3.0`.
  `AGENTS.md` und `README.md` runden auf »Node ≥24« bzw. »v24 or newer« ab, und
  `docs/architecture.md` sagt, `.nvmrc` und `mise.toml` wiederholten dieselben
  Zahlen — beide tragen `24`, und `>=26.3.0` steht dort überhaupt nicht. Es
  bricht nichts, weil `nvm`, `fnm` und `mise` die `24` auf die neueste 24.x
  auflösen; der Satz in `architecture.md` stimmt trotzdem nicht mehr, und
  `AGENTS.md` verweist ausdrücklich auf `engines` als Quelle. Zug 0 dieses
  Pakets entscheidet, ob die beiden Versionsmanager-Dateien die genaue
  Untergrenze tragen oder ob die Doku sagt, warum sie gröber bleiben dürfen.
- Entschieden in Zug 0: `.nvmrc`, `mise.toml` und die beiden CI-Workflows
  bleiben bei `24`, `docs/architecture.md` schreibt den Grund auf. Keines der
  drei Formate kennt ein `||`, und eine genauere Zahl wäre eine
  Verschlechterung: `24.16` nagelt die Minor-Linie fest, während `^24.16.0`
  jede 24er ab 24.16 zulässt. Ausführlich in der Paketdatei.
- Hash: 6f897686
- Ergebnis: 1 Runde · Ziel erreicht, vom Reviewer je Stelle mit Fundstelle
  bestätigt (`AGENTS.md:28`, `README.md:75`, `docs/architecture.md:108-114`) ·
  kein Regressionstest, weil kein Korrektheitsfehler im Code — das Gate war
  `pnpm run ci`, exit=0 · klein: die pnpm-Angabe steht in `README.md:75` als
  »v10.22 or newer«, in `AGENTS.md:28` und `docs/architecture.md:109` als
  `>=10.22.0`; »the 25.x line is out« ließe sich als »erschienen« statt
  »ausgeschlossen« lesen — beides im vorgegebenen Wortlaut, beides in der
  Paketdatei vermerkt
- Nebenbefunde: keine
- Folgen: keine

### [x] 15. Aufräumrunde: HelpersManager, tote Lookbook-Regeln und die halb geschriebene Resize-Transaktion

- Nebenbefund: 8 Einträge aus der zweiten Drain-Runde (2 low, 6 info)
- Ziel: Ein Resize, das an einer Stage scheitert, lässt den Renderer nicht mit
  Maßen zurück, die keine Stage je gesehen hat.
- Detail: `docs/remediation/paket-15.md`
- Bereich: `packages/twopoint5d/src/stage/` — `StageRenderer.ts` (+ Spec),
  `Canvas2DStage.ts`, `ParallaxProjection.ts`, dazu aus Zug 0 `IProjection.ts` und
  `OrthographicProjection.ts` (derselbe Parametername steht in allen dreien, und
  einzeln umbenannt bricht er den Interface-Abgleich);
  `packages/twopoint5d/src/map2d/HelpersManager.ts` (+ Spec);
  `apps/lookbook/src/demos/map2d-rect-visi.ts` und
  `apps/lookbook/src/pages/demos/` — `display-multi.astro`,
  `textured-sprites.astro`; dazu `packages/twopoint5d/CHANGELOG.md`
- Hängt ab von: —
- Anmerkung: Das letzte Paket des Laufs, bewusst als ein Stück geschnitten. Drei
  Flächen, acht Einträge, keine gemeinsame Ursache — aber auch kein
  Severity-Sprung, keine Abhängigkeit und eine Diff-Fläche, die ein Reviewer in
  einem Durchgang hält. Jedes zusätzliche Paket wäre ein weiterer Satz
  Kaltstarts und eine weitere Gelegenheit, Nebenbefunde nachzuliefern; die
  Aufräumrunde soll enden, nicht sich fortpflanzen. Der einzige Eintrag mit
  Korrektheitskern ist die Transaktion in `StageRenderer#resize()` und
  `#resizeStage()`: sie braucht einen fehlschlagenden Test zuerst, nach dem
  Muster, das `Stage2D` in Paket 13 bekommen hat — wirft eine Stage, sollen
  Renderer und die übrigen Stages nicht mit halb geschriebenen Maßen
  zurückbleiben. Der `HelpersManager#removeFromScene()`-Fallstrick bleibt ein
  Fallstrick, solange `root` mit abgeräumt wird; hier geht es darum, dass eine
  fremde Szene den eigenen Satz nicht mehr herunterreißt. Nicht in diesem Paket:
  die widersprüchliche `getZoom()`-Semantik der beiden Projektionen — sie geht
  mit ihrer Frage ins Audit.
- Hash: 6073b0a2
- Ergebnis: 2 Runden · alle acht Einträge behoben, je mit Fundstelle im
  Reviewer-Urteil (`docs/remediation/paket-15.md`) · Regressionstests
  `leaves the renderer the size it had when a stage refuses it` und
  `asks every stage for its size even when one of them refuses`
  (`StageRenderer.spec.ts`) sowie
  `a scene this manager was never given keeps the nodes in the root`
  (`HelpersManager.spec.ts`) — alle drei vor dem Fix rot · Runde 1 räumte einen
  `wichtig`-Befund aus: CHANGELOG und TSDoc versprachen ein Rollback der
  Stage-Item-Maße, das der Code nicht leistet; korrigiert wurden die Sätze,
  nicht der Code · fünf kleine Befunde in der Paketdatei
- Nebenbefunde: → Queue
- Folgen: `packages/twopoint5d/src/stage/StageRenderer.ts:296` — die
  Größenschranke von `resize()` kann eine Stage auf einer Größe stehen lassen,
  die der Renderer nach einem Rollback nicht mehr führt: weist Stage 2 `320x240`
  ab, fällt der Renderer auf `0x0` zurück, Stage 1 bleibt auf `320x240`, und ein
  folgendes `resize(0, 0)` kehrt am Guard um · `StageRenderer.ts:333` — die
  `AggregateError`-Meldung zählt einen Fehler aus dem Render-Target-`try`
  (`:305-310`) als abweisende Stage mit, `CHANGELOG.md:261` übernimmt die
  Zählweise · beide triagiert im Abschluss: Symptome derselben Umstellung,
  → Paket 16
- Schnittstellen: `StageRenderer#resize(width, height)` fragt jede Stage nach
  ihrer Größe, auch wenn eine davor wirft, und nimmt `width`/`height` des
  Renderers zurück, sobald etwas geworfen hat — genau ein Fehler kommt
  unverändert heraus, mehrere als `AggregateError`. Ein `StageItem` trägt die
  neue Größe erst, wenn seine Stage sie angenommen hat; derselbe Aufruf greift
  erneut, sobald die abweisende Stage sie nimmt. `resizeStage()` behält
  Sichtbarkeit (`protected`) und Signatur. `HelpersManager#removeFromScene(scene)`
  zieht die Wurzel nur für die Szene mit herunter, die der Manager hält; eine
  fremde Szene wird auf ihre eigenen Knoten durchsucht und sonst in Ruhe
  gelassen. `remove()` hat den Rückgabetyp `void`. `IProjection#getZoom()` und
  beide Implementierungen nennen ihren Parameter `distanceToCamera` — ein Typ,
  der die Signatur abschreibt, sieht den neuen Namen; Aufrufer rufen positional
  und bleiben unberührt.

### [x] 16. Nachzug: den Rollback von `StageRenderer#resize()` zu Ende führen

- Folge von: Paket 15
- Findings: keine — zwei Symptome aus der `Folgen:`-Zeile von Paket 15
- Ziel: Scheitert eine Stage an der Größenschranke, trägt hinterher keine
  andere Stage eine Größe, die der Renderer selbst nicht mehr führt.
- Detail: `docs/remediation/paket-16.md`
- Bereich: `packages/twopoint5d/src/stage/StageRenderer.ts` (+ Spec) und die
  Zählweise der `AggregateError`-Meldung samt der Zeile, die sie in
  `packages/twopoint5d/CHANGELOG.md` beschreibt
- Hängt ab von: —
- Anmerkung: Zwei Einträge, weit unter dem Zielkorridor, und das mit Absicht —
  es sind Folgen des eigenen Laufs, und für die gibt es keine Wahl zwischen
  Paket und Audit. Eine andere Fläche, an die sie sich hängen könnten, ist
  nicht mehr offen. Das erste Symptom ist der eigentliche Fall: der Rollback auf
  `0x0` lässt Stage 1 auf `320x240` stehen, und der Guard in `:286` macht den
  korrigierenden zweiten Aufruf zum No-op — also braucht es einen
  fehlschlagenden Test zuerst, der genau diese Reihenfolge fährt. Das zweite ist
  eine Zählung: ein Fehler aus dem Render-Target-`try` ist keine abweisende
  Stage, und die CHANGELOG-Zeile, die das behauptet, wird im selben Zug
  richtiggestellt. Dieses Paket soll die Kette schließen: was es selbst noch
  auslöst, geht mit Begründung ins Audit statt in ein Paket 17.
- Hash: 5a0ae0e4
- Ergebnis: 1 Runde · beide Symptome behoben · Regressionstests
  `asks a stage for the size the renderer fell back to` und `counts only the
  stages that refused the size, not the render target` (beide vor dem Fix rot)
  · klein: die Assertions auf `sr.width`/`sr.height` im ersten Test gelten mit
  und ohne Fix, der zweite prüft die Reihenfolge in `errors` nicht, und für die
  Zusage aus Paket 13 gibt es keinen Test
- Nebenbefunde: → Queue
- Folgen: `packages/twopoint5d/CHANGELOG.md:255` — der
  `Canvas2DStage#setContainerSize()`-Eintrag aus Paket 13 sagt, die Größe des
  Renderers allein entscheide, ob sich etwas bewegt; es entscheiden jetzt
  `width`/`height` und die Größen der `StageItem`s. Die Zusage des Eintrags
  selbst bleibt wahr, die Verallgemeinerung darüber greift zu weit.
  **Unverteilt** — der Detailplan hat die Zeile ausgenommen, der Reviewer stuft
  sie als `klein` ein, und hinter Paket 16 gibt es keinen Zug 0 mehr, der sie
  triagieren könnte: der Abschluss entscheidet sie in der Drain-Runde mit allen
  Befunden vor Augen. Ein Paket 17 dafür zu schneiden wäre die dritte
  Generation der Kette. · Entschieden im Abschluss: die Zeile wird beim
  CHANGELOG-Schritt mitgezogen, im selben Commit, der den Eintrag dieses Laufs
  trägt — kein Paket 17.
- Schnittstellen: `StageRenderer#resize(width, height)` führt den Aufruf aus,
  solange ein `StageItem` eine andere Größe trägt als der Renderer — ein Aufruf
  mit der Größe, die der Renderer gerade führt, erreicht also die Stages, die
  sie noch schulden, und kann dabei werfen. `Canvas2DStage#setContainerSize()`
  reicht das durch und kann damit auch bei unveränderter Größe werfen;
  Signatur und Rückgabewert bleiben. Die Meldung des `AggregateError` zählt
  ausschließlich Stages; ein abweisendes Render-Target steht in `errors`, nicht
  in der Zahl, und wird in der Meldung eigens genannt. Ein direktes
  `stage.resize(…)` von außen bewegt kein `StageItem` — ein Aufruf mit der
  Renderer-Größe kehrt danach weiterhin an der Schranke um.
