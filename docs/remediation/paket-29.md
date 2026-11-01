# Paket 29 — Abschluss: letzte Überlängen in der Prosa und ein toter Zweig in fetchAsset.ts

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (kein Audit-Finding; zwei Einträge aus »Offene Befunde« mit »überführt in Paket 29«
  und der »klein«-Befund aus Paket 28, Entscheidung »Abschlusspaket 29« im Plan)
- Ziel: Keine Prosazeile in `AGENTS.md`, `docs/architecture.md` und
  `apps/lookbook/assets-src/README.md` liegt über dem Umbruch ihrer Datei, und `fetchAsset.ts` hat
  keinen toten Zweig.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `AGENTS.md`, `docs/architecture.md`, `apps/lookbook/assets-src/README.md`,
  `apps/lookbook/src/demos/utils/fetchAsset.ts`. Keine weitere Datei, kein CHANGELOG (Lookbook und
  Repo-Doku, nichts an der Library), kein Guide.
- Vorgehen: siehe unten, Schritte 1–7. Zeilenangaben gegen `87825336`.
- Verify: `pnpm run ci` — dazu die beiden Proben aus Schritt 6 (Messschleife und Wortdiff) und die
  Probe aus Schritt 5
- Commit: `fix: let fetchJson() pass on as it is what a check throws besides its refusal, and reflow the last prose lines that run past the width of their file`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · Abgleich: `AGENTS.md:157` (92) unverändert ·
    `docs/architecture.md:118` (91) unverändert, `:637` jetzt `:641` (92, verschoben durch Paket 28
    in §5), `:15`/`:17` Tabellenzeilen und `:105` im Codeblock — nach der Regel aus Paket 25
    ausgenommen, gegenstandslos · `assets-src/README.md:490` (103), `:491` (101), `:589` (102),
    `:639` (101), `:642` (101), `:644` (101) unverändert · `fetchAsset.ts:47` toter Zweig
    unverändert · keine offene `Folgen:`-Zeile im Plan, »Offene Befunde« ohne offenen Eintrag ·
    Restplan unverändert (29 ist das letzte Paket, danach der Abschluss)
  - 2026-11-01 Zug 1: Implementierer beauftragt, Modell sonnet (mittlere Stufe), Effort low, Report `paket-29.impl-0.json`
  - 2026-11-01 Zug 2: FERTIG_MIT_VORBEHALT · 4 Dateien geändert (`AGENTS.md`, `docs/architecture.md`, `apps/lookbook/assets-src/README.md`, `apps/lookbook/src/demos/utils/fetchAsset.ts`) · Probe rot (1 failed/3 passed) → grün (4/4) · Messschleife und Wortdiff leer · Verify `pnpm run ci` exit=0 (`paket-29.verify.log`) · Baum schmutzig
  - 2026-11-01 Zug 3: Reviewer (sonnet, low) — alle Schritte 1–7 erfüllt, keine kritischen oder wichtigen Befunde, drei kleine · Diff `paket-29.diff`, Report `paket-29.review-0.json`
  - 2026-11-01 Zug 4: keine Runde nötig
  - 2026-11-01 Zug 5: Commit `b89b79b9`, Verify `paket-29.verify.log` exit=0 (Stand unverändert seit Zug 2)

## Regeln für jede Zeile

- Englisch, im Ton des umgebenden Textes. Keine Finding-IDs, keine Paketnummern, kein Rückblick
  (»no longer«, »now«, »used to«) — die Konventionen im Kopf des Plans gelten.
- **Breite:** `AGENTS.md` und `docs/architecture.md` umbrechen bei **90** Spalten,
  `apps/lookbook/assets-src/README.md` bei **100** (gezählt in Zeichen, nicht Bytes). Ausgenommen
  sind Überschriften, Tabellenzeilen, Codeblöcke und HTML — diese Zeilen bleiben, auch wenn sie
  länger sind.
- **Reiner Umbruch ändert kein Wort.** Die Schritte 1–4 verschieben nur Zeilenumbrüche. Die
  Zielzeilen unten sind fertig gerechnet (Wortfolge gegen das Original geprüft, jede Zeile in der
  Breite, kein Code-Span über eine Zeile verteilt): **genau so übernehmen**, Zeichen für Zeichen,
  samt Einzug. Nicht nachbessern, keine Sätze umstellen, keine anderen Zeilen anfassen.
- Ein Listenpunkt behält seinen Einzug (zwei Leerzeichen in `AGENTS.md`).

## Schritte

### 1. `AGENTS.md:153-157` → sechs Zeilen (Breite 90)

Der Listenpunkt »**Shared dependency versions.**« endet heute mit `:157` (92 Zeichen):
`  bump are in [monorepo architecture §5](docs/architecture.md#5-shared-dependency-versions).`
Ein Umbruch ab `:157` allein ließe eine Kurzzeile von 36 Zeichen mitten im Absatz stehen, weil das
Link-Ziel nicht umbrechen darf. Deshalb wird ab `:153` neu umbrochen und der Link steht ganz auf
der letzten Zeile (die Zeilen `:148-152` bleiben unverändert). Die fünf Zeilen `:153-157`

```text
  the library; `@types/three` is an optional one (only a TypeScript consumer needs it).
  The catalog range lands verbatim in the published manifest, and a 0.x minor of `three`
  breaks, so `three` stays on the tilde — and every `three` bump is a release: until the
  library publishes, a consumer on the newer `three` meets a peer conflict. The steps of a
  bump are in [monorepo architecture §5](docs/architecture.md#5-shared-dependency-versions).
```

werden durch genau diese sechs ersetzt:

```text
  the library; `@types/three` is an optional one (only a TypeScript consumer
  needs it). The catalog range lands verbatim in the published manifest,
  and a 0.x minor of `three` breaks, so `three` stays on the tilde — and
  every `three` bump is a release: until the library publishes, a consumer
  on the newer `three` meets a peer conflict. The steps of a bump are in
  [monorepo architecture §5](docs/architecture.md#5-shared-dependency-versions).
```

Danach folgt unverändert `- **Each package declares what it uses.** …`.

### 2. `docs/architecture.md:118-119` (Breite 90)

`:118` hat 91 Zeichen; nur das letzte Wort »with« wandert in die nächste Zeile. Die zwei Zeilen

```text
SIGINT for "stop at once". It hands on SIGTERM and SIGHUP; a run is stopped by its pid with
SIGTERM, while a SIGINT to the pid of the lock alone stops nothing.
```

werden zu

```text
SIGINT for "stop at once". It hands on SIGTERM and SIGHUP; a run is stopped by its pid
with SIGTERM, while a SIGINT to the pid of the lock alone stops nothing.
```

Die Zeilen davor (`:110-117`) bleiben.

### 3. `docs/architecture.md:641-642` (Breite 90)

`:641` hat 92 Zeichen; nur das letzte Wort »spec« wandert in die nächste Zeile. Die zwei Zeilen

```text
as its arguments fit; `decidePublish()` carries its decision and its spec covers it. No spec
runs `checkDocSnippets.mjs`, which reads git and the file system.
```

werden zu

```text
as its arguments fit; `decidePublish()` carries its decision and its spec covers it. No
spec runs `checkDocSnippets.mjs`, which reads git and the file system.
```

### 4. `apps/lookbook/assets-src/README.md` — drei Absätze (Breite 100)

**4a. Abschnitt `### found-footage`, Absatz `:490-497`** (`:490` 103, `:491` 101 Zeichen). Der
ganze Absatz — acht Zeilen von `"Found Footage", the art of the demo …` bis
`the green of a camcorder's night shot. No font is used.` — wird durch genau diese neun Zeilen
ersetzt (der Code-Span der Generator-Datei beginnt die zweite Zeile, wie im Abschnitt `### portal`):

```text
"Found Footage", the art of the demo `stage-masks-shared`, from
`stage-masks/found-footage/footage.mjs` with `birch.mjs`, `props.mjs` and `ground.mjs`. (The
directory is not named after the demo: `shared/` is kept for art several demos use.) The birch
trunks are shaded pixel by pixel in JavaScript — a cylinder lit from the camera, bark noise,
lenticels, black patches, the chevrons where branches fell off, a fissured base with moss — over
twigs drawn as SVG, and the carvings are SVG strokes turned into a cut with a lit and a dark lip.
The props and the litter of the floor are SVG rasterised by sharp's librsvg. Everything is drawn at
2 texels per unit in neutral greys: the demo tints it to the green of a camcorder's night shot. No
font is used.
```

**4b. Abschnitt `### matte-3d`, Absatz `:589-603`** (`:589` 102 Zeichen). Der ganze Absatz —
fünfzehn Zeilen von `"Mirror, Mirror", the art of the demo …` bis `… the demo builds them as
meshes at run time.` — wird durch genau diese vierzehn Zeilen ersetzt:

```text
"Mirror, Mirror", the art of the demo `stage-masks-matte-3d`, from
`stage-masks/matte-3d/matte-3d.mjs` and `blender_bathroom.py`. Not drawn but **rendered**: Blender
builds a cramped antique bathroom from primitives and procedural materials and renders it with
Cycles twice, from one camera, so the two pictures lie exactly over each other. The camera looks
straight at the wall of the medicine cabinet and frames lower by a lens shift, not a tilt, so the
glass of the mirror is an exact rectangle in the picture and the mirror shows the room behind the
viewer by a real reflection. Cycles renders on a GPU when it finds one (OptiX, CUDA, HIP, oneAPI,
Metal) and on the CPU otherwise, with a fixed seed and OpenImageDenoise. The picture is the same on
every run, the bytes are not: a GPU schedules its samples a little differently each time, and two
renders differ by a few levels in a few pixels (a mean of 0.004 of 255) — the one exception to the
byte-for-byte rule above. The PNGs land in `stage-masks/matte-3d/.render-cache/` (ignored by git),
and `--skip-render` reuses them. Units of the stage throughout: origin in the middle of the picture,
y up, 2 texels per unit, both images loaded with the default `flipY`. The shards, the panes and the
ouroboros of the mask are no asset: the demo builds them as meshes at run time.
```

**4c. Abschnitt `### portal`, Absatz `:638-646`** (`:639` 101, `:642` 101, `:644` 101 Zeichen).
`:638` (`"The Painting in the Hallway", the art of the demo `stage-masks-portal`, from`) bleibt. Die
acht Zeilen `:639-646` — von `` `stage-masks/portal/portal.mjs` with `kit.mjs` … `` bis `of the
moor in the painting are no asset: the demo works them out per pixel at run time.` — werden durch
genau diese neun ersetzt:

```text
`stage-masks/portal/portal.mjs` with `kit.mjs` (the numbers of the hallway, a tiling value noise,
the float image), `hall.mjs` (wall, floor, doors, frame) and `sprites.mjs` (the atlas). The hallway
is a box in units of the stage — x across (±180), y up (floor −200, ceiling 220), z along the
hallway — and the demo builds it from planes and lights it per pixel by its sconces, so the wall,
the floor and the doors are unlit albedo. The patterns are worked out per pixel, 2 × 2 samples per
texel, over SVG rasterised by sharp's librsvg; the frame is a height field shaded in JavaScript. No
font is used: the door numbers are strokes of the spotlight's stroke font. The sky, the ridges, the
heath and the mist of the moor in the painting are no asset: the demo works them out per pixel at
run time.
```

Die Tabelle danach (`| file | size | what |`) bleibt, ebenso die Leerzeile davor.

### 5. `apps/lookbook/src/demos/utils/fetchAsset.ts` — der tote Zweig

**Was dort steht** (`:44-49`):

```ts
  try {
    return check(value, '');
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`${subject}: ${url} is not what ${subject} reads: ${message}`, {cause});
  }
```

Der Zweig `String(cause)` ist tot: jede Prüfung, die `fetchJson()` bekommt, ist aus den
Kombinatoren in `checkJson.ts` gebaut, und die werfen nur über `refuse()` einen `TypeError` — so
verspricht es auch das TSDoc von `JsonCheck` (`checkJson.ts:9-14`: »or throws a `TypeError`«).

**Ersetzen durch** — nur eine Ablehnung der Prüfung (ein `TypeError`) wird als »is not what … reads«
gemeldet; was eine Prüfung sonst wirft, ist ein Fehler der Prüfung, nicht der Datei, und geht
unverändert weiter:

```ts
  try {
    return check(value, '');
  } catch (cause) {
    // a check refuses with a TypeError (see `JsonCheck`); anything else is a fault of the check,
    // not of the file, and passes on as it is
    if (!(cause instanceof TypeError)) throw cause;
    throw new Error(`${subject}: ${url} is not what ${subject} reads: ${cause.message}`, {cause});
  }
```

**TSDoc von `fetchJson()` nachziehen** (`:31-34`). Die vier Zeilen

```text
 * the check as its `cause`, and the message names the field that does not fit. The layout files of
 * the demos are written by the generators under `assets-src/`, committed with their demo, and
 * `assets-src/README.md` is their contract; what the library reads — the atlases — the
 * `TextureStore` checks itself.
```

werden zu genau diesen fünf (der neue Satz steht nach »does not fit.«, `:33-35` sind die alten
`:32-34`, unverändert):

```text
 * the check as its `cause`, and the message names the field that does not fit. Anything else a
 * check throws is a fault of the check, not of the file, and rejects as it is. The layout files of
 * the demos are written by the generators under `assets-src/`, committed with their demo, and
 * `assets-src/README.md` is their contract; what the library reads — the atlases — the
 * `TextureStore` checks itself.
```

Sonst nichts an der Datei. `checkJson.ts` bleibt unverändert.

**Beleg rot/grün** (das Lookbook hat keine Testoberfläche — Entscheidung »Drain-Runde 3«; die
Probe liegt deshalb außerhalb des Repos, wie in Paket 28). Im Arbeitsverzeichnis des Laufs
`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad`:

1. `mkdir paket-29-probe`, dorthin `paket-28-probe/vitest.config.mjs` kopieren (die erste
   Kommentarzeile auf »Probes of Paket 29« ändern, sonst nichts) und `paket-28-probe/fetchJson.probe.ts`
   kopieren. Nichts davon ins Repo.
2. In `paket-29-probe/fetchJson.probe.ts` diesen Test anhängen:

   ```ts
   it('what a check throws besides its refusal rejects as it is', async () => {
     vi.stubGlobal('fetch', answer('{"eyes": []}'));
     const fault = new RangeError('a fault of the check');
     const check = (): Scene => {
       throw fault;
     };
     await expect(fetchJson('Scene', '/a/layout.json', check)).rejects.toBe(fault);
   });
   ```

3. **Vor** der Änderung an `fetchAsset.ts` laufen lassen und die Ausgabe sichern — erwartet: der
   neue Test rot (die Ablehnung ist ein `Error` mit »is not what Scene reads: a fault of the
   check«, nicht `fault`), die drei übernommenen grün:

   ```bash
   cd /home/spw/spaceland/twopoint5d/packages/twopoint5d
   ./node_modules/.bin/vitest run --config /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-29-probe/vitest.config.mjs > /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-29.probe-red.log 2>&1; echo "exit=$?" >> /tmp/claude-1000/-home-spw-spaceland-twopoint5d/f2ceb44b-2a2b-4207-84a8-8147bb2eb3fa/scratchpad/paket-29.probe-red.log
   ```

4. Nach der Änderung dasselbe nach `paket-29.probe-green.log` — erwartet: alle vier grün, exit=0.
   Die drei übernommenen Tests belegen, dass Meldung und `cause` einer Ablehnung gleich bleiben.

### 6. Messen

Im Repo-Root, nach den Schritten 1–5:

```bash
scan() { w=$1; shift; for f in "$@"; do awk -v f="$f" -v w="$w" '/^ *(```|~~~)/{c=!c; next} c{next} /^ *\|/||/^#/||/^ *</{next} /^    [^-*0-9 ]/{next} length($0)>w {print f":"NR" ("length($0)")"}' "$f"; done; }
scan 90 AGENTS.md docs/architecture.md
scan 100 apps/lookbook/assets-src/README.md
git diff --word-diff=porcelain -- '*.md' | grep '^[-+][^-+]'
```

Erwartet: **keine Ausgabe** — weder von der Messschleife (heute meldet sie genau die neun Zeilen
aus dem Abgleich) noch vom Wortdiff (reiner Umbruch). `gawk` zählt unter der UTF-8-Locale Zeichen.

### 7. Nicht anfassen

- Keine anderen Absätze dieser Dateien, auch nicht Zeilen unter der Breite, die kürzer wirken
  (`docs/architecture.md:115` mit 77 Zeichen bleibt).
- Tabellenzeilen über der Breite (`AGENTS.md:15`/`:16`/`:18`, `docs/architecture.md:15`/`:17`, die
  Tabellen in `assets-src/README.md`) und die Zeile im Codeblock `docs/architecture.md:105` bleiben.
- Keine weiteren Nebenbefunde: Paket 29 nimmt nach der Entscheidung »Abschlusspaket 29« keine auf.
  Was beim Lesen auffällt, steht im Report unter »Nebenbefunde« und geht mit `→ Audit` in die Queue.

## Abgleich (Zug 0, 2026-11-01, gegen `87825336`)

Gemessen mit der Schleife aus Schritt 6 an der exakten Breite (90/100), dazu zeichengenau mit
Python über alle Zeilen der drei Dateien:

| Stelle aus der Queue | Jetzt | Einordnung |
| --- | --- | --- |
| `AGENTS.md:157` | `:157`, 92 Zeichen | unverändert |
| `docs/architecture.md:118` | `:118`, 91 | unverändert |
| `docs/architecture.md:637` | `:641`, 92 — dieselbe Zeile (`git show 5edbc74f:docs/architecture.md`, Zeile 637), verschoben um vier Zeilen durch Paket 28 in §5 | verschoben |
| `docs/architecture.md:641` (aus Paket 28) | `:641`, 92 — derselbe Eintrag wie `:637` | doppelt genannt, ein Schritt |
| `docs/architecture.md:15`, `:17` (aus Paket 28) | Tabellenzeilen (136 bzw. 92) | gegenstandslos: Tabellenzeilen sind nach der Regel aus Paket 25 ausgenommen |
| `docs/architecture.md:105` (aus Paket 28) | im Codeblock (`ci:checks = lint → …`, 98) | gegenstandslos: Codeblöcke sind ausgenommen |
| `assets-src/README.md:490`, `:491` | 103, 101 | unverändert |
| `assets-src/README.md:589` | 102 | unverändert |
| `assets-src/README.md:639`, `:642`, `:644` | je 101 | unverändert |
| `fetchAsset.ts` »toter `String(cause)`-Zweig« (Paket 28, klein) | `:47` | unverändert |

Die Messung findet in den drei Dateien keine weitere Prosazeile über der Breite.

**Triage:** Keine offene `Folgen:`-Zeile im Plan (alle älteren sind verteilt, 25–28 ohne Folgen);
»Offene Befunde« hat keinen offenen Eintrag. Nichts zu verteilen.

**Restplan:** 29 ist das letzte Paket; danach der Abschluss. Keine Änderung.

## Entscheidungen im Zug 0 (mit Grund)

- **`AGENTS.md:157` ab `:153` umbrochen, Link ganz auf einer Zeile.** Die Regel aus Paket 25
  (»ab der genannten Zeile bis zur Breite füllen«) ergäbe hier `  bump are in [monorepo
  architecture` (36 Zeichen) mitten im Absatz, gegen dieselbe Regel (»kein Absatz endet mit einer
  Kurzzeile mitten im Text«): das Link-Ziel `§5](docs/architecture.md#5-shared-dependency-versions).`
  ist 55 Zeichen lang und darf nicht brechen, und `:156` ist schon voll. Ein ausgeglichener Umbruch
  ab `:153` mit dem Link als letzter Zeile (eine Zeile, die nur einen Link trägt, kennt die Doku
  aus `resource-lifecycle.md:81`) hält alle Zeilen zwischen 72 und 80 Zeichen und lässt
  `:148-152` stehen. Variante mit gebrochenem Linktext verworfen: sie lässt den Linktext über zwei
  Zeilen laufen und ist im Rohtext nicht mehr per Suche zu finden.
- **README-Absätze bis zum Absatzende umbrochen.** Der Umbruch ab der überlangen Zeile trifft in
  keinem der drei Absätze wieder auf einen bestehenden Zeilenumbruch; jeder läuft bis zum Ende
  durch (Regel aus Paket 25). 4a und 4c werden je eine Zeile länger, 4b eine kürzer.
- **`fetchJson()` fängt nur den `TypeError`.** Abweichung vom bloßen Streichen des Zweigs: ein
  `catch` liefert `unknown`, `cause.message` braucht eine Verengung. Die drei Wege — Cast
  `(cause as Error)`, Verengung auf `Error`, Verengung auf `TypeError` — unterscheiden sich darin,
  was als »Datei passt nicht« gemeldet wird. Nur `TypeError` ist die Ablehnung, die `JsonCheck`
  verspricht; ein anderer Fehler aus einer Prüfung wäre ein Fehler im Code der Prüfung, und die
  Meldung »<url> is not what <subject> reads« wäre für ihn falsch. Der Cast fällt weg, weil der
  Lauf Casts abbaut (Pakete 20, 21b). Die Weiterleitung ist kein toter Zweig: `fetchJson()` nimmt
  jede Funktion vom Typ `JsonCheck<T>`, nicht nur die Kombinatoren.
- **Modell und Effort:** mittlere Stufe, weil das Paket aus Prosa arbeitet und eine Probe rot/grün
  führt; `low`, weil jeder Zielwortlaut vorgegeben ist — ein höherer Effort lädt zum Verbessern
  von Sätzen ein, die das Paket nicht nennt. Der Reviewer: mittlere Stufe (kleiner, mechanischer
  Diff).

## Befunde im Volltext

**Offene Befunde, Eintrag 1** (aus Paket 25, Runde 0, Implementierer · info) —
`AGENTS.md:157`, `docs/architecture.md:118`/`:637`, `apps/lookbook/assets-src/README.md:490`/`:491`/`:589`/`:639`/`:642`/`:644` —
Prosazeilen 91–103 Spalten über dem Umbruch ihrer Datei (90 bzw. 100), in Absätzen, die Paket 25
nicht anfasst; vorbestehend. Ursprünglich `→ Audit` (Entscheidung »Drain-Runde 3«), stattdessen
überführt in Paket 29 (2026-11-01, Orchestrator: drei triviale Stellen, Release ohne offenes
Issue).

**Offene Befunde, Eintrag 2** (aus Paket 28, Runde 0, Implementierer · info) —
`docs/architecture.md:15`/`:17`/`:105`/`:641` — Prosazeilen über 90 Spalten außerhalb der Absätze
von Paket 28 (gleiche Art wie Eintrag 1 zu `:118`/`:637`); vorbestehend. Ursprünglich `→ Audit`,
stattdessen überführt in Paket 29 (2026-11-01, Orchestrator).

**Paket 28, »klein« des Reviewers** — toter `String(cause)`-Zweig in `fetchJson()`
(`apps/lookbook/src/demos/utils/fetchAsset.ts`), die Prüfungen werfen nur `TypeError`.

## Urteil des Reviewers (Zug 3)

- Schritt 1 `AGENTS.md:153-158`: erfüllt, sechs Zielzeilen, Link auf der letzten.
- Schritt 2 `docs/architecture.md:118-119`: erfüllt.
- Schritt 3 `docs/architecture.md:641-642`: erfüllt.
- Schritt 4 `apps/lookbook/assets-src/README.md` (found-footage ab 490, matte-3d ab 589, portal ab 639): erfüllt, jede Zeile gegen die Zielblöcke geprüft, Tabellen unberührt.
- Schritt 5 `apps/lookbook/src/demos/utils/fetchAsset.ts:47`: erfüllt, `if (!(cause instanceof TypeError)) throw cause;`, TSDoc-Satz um Zeile 31.
- Schritte 6/7: eingehalten, genau vier Dateien, kein CHANGELOG.

Kleine Befunde: (1) ein `TypeError` aus einem Bug im Check selbst wird weiter als Ablehnung umhüllt — so vorgegeben, `checkJson.ts` wirft für Ablehnungen `TypeError`; (2) die Commit-Message liest sich holprig, Stil passt zu den letzten Commits; (3) Code-Kommentar »passes on as it is«, TSDoc »rejects as it is« — beides vertretbar.

Nebenbefund: Liste »Webkit WebGL2: 3« im Log von `test:browser` → Audit (in »Offene Befunde«; Paket 29 nimmt keine Nebenbefunde auf).
