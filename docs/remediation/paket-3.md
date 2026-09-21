# Paket 3 — Display-Abbau: Canvas wiederverwendbar halten, Doku und Test-Kommentare nachziehen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des Laufs, hier die
Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: keine Audit-IDs — das Paket stammt aus der Drain-Runde. Inhalt: Nebenbefund
  »Canvas nach `dispose()`« (medium, geschätzt), zwei Doku-Nebenbefunde aus Paket 2, die
  Reviewer-klein-Folgen aus Paket 1 und Paket 2, dazu in Zug 0 aufgenommen: drei
  Kurzbeschreibungen »Display owns the canvas« (dieselbe Ursache wie der Canvas-Befund)
- Ziel: Ein Canvas trägt nach `Display#dispose()` einen neuen `Display`, und Doku, TSDoc und
  Test-Kommentare rund um den Abbau sagen, was der Code tut.
- Modell: stärkste Stufe
- Effort: high
- Dateien:
  - `packages/twopoint5d/src/display/Display.ts`
  - `packages/twopoint5d-testing/test/display-dispose.test.js`
  - `packages/twopoint5d-testing/test/vertex-objects-heap.test.js`
  - `packages/twopoint5d/docs/resource-lifecycle.md` (nur §5)
  - `packages/twopoint5d/docs/architecture.md`
  - `packages/twopoint5d/src/stage/README.md`
  - `docs/architecture.md`
  - `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci` — in Runde 2 `NX_SKIP_NX_CACHE=true pnpm run ci` (Grund unter »Runde 2«)
- Einzellauf für den roten Lauf (vor dem Fix, nach dem Schreiben der Tests):
  `pnpm build:twopoint5d && pnpm --dir packages/twopoint5d-testing exec web-test-runner test/display-dispose.test.js`
  — die Browser-Tests importieren die gebaute Bibliothek aus `dist/`, ohne Build prüfen sie
  den alten Stand. Rot erwartet auf Chromium (dort läuft das WebGL2-Backend); auf Firefox
  (WebGPU) dürfen die beiden ersten neuen Fälle schon vor dem Fix grün sein, der dritte wird
  dort übersprungen.
- Commit: `fix(display): let a canvas handed to a display carry the next one after dispose(), keeping the WebGL context three gives up on release restorable and letting the next display on that canvas wait for the release and bring the context back before its init, and make the teardown docs, TSDoc and heap test comments say what the code does`
  (in Zug 0 der Wiederaufnahme angepasst: Runde 1 hat die Wiederherstellung zum Nachfolger
  verlegt, die Message aus Runde 0 sagte »restoring … on release«)
- Coverage: `src/display/` hat in `packages/twopoint5d/vite.config.ts` keine eigene Schwelle,
  zählt aber in die globale (83/78/82/83). Die neuen Zeilen deckt nur die Browser-Suite ab;
  fällt `pnpm test:coverage` deshalb unter die globale Schwelle, wird das gemeldet, nicht die
  Schwelle gesenkt.
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · Canvas-Befund unverändert (`Display.ts:938`, three
    `WebGLBackend.js:2834`) · Doku-Nebenbefunde aus Paket 2 unverändert · Folgen aus Paket 1
    und 2 unverändert, README-Pfad korrigiert auf `packages/twopoint5d/src/stage/README.md` ·
    Abschnittsverweise `resource-lifecycle.md:5-6`/`:55` aus dem Paket genommen (= DOC-034,
    außerhalb des Scopes) · »owns the canvas« an drei Stellen aufgenommen · keine neuen Folgen
    aus Paket 1 oder 2 zu verteilen · »Offene Befunde« (3 Einträge, → Audit) teilen die Ursache
    nicht und bleiben liegen
    · Restplan: nach Paket 3 kein offenes Paket, Reihenfolge und Schnitt unverändert
  - 2026-09-21 Zug 1: Implementierer beauftragt, Opus, Effort high (`paket-3.impl-0.json`)
  - 2026-09-21 Zug 2: Report FERTIG · 8 Dateien geändert (Display.ts, display-dispose.test.js, vertex-objects-heap.test.js, resource-lifecycle.md, packages/twopoint5d/docs/architecture.md, stage/README.md, docs/architecture.md, CHANGELOG.md) · roter Lauf c/d/e auf Chromium, Firefox c/d grün, e übersprungen · Arbeitsbaum schmutzig · Verify `pnpm run ci` exit=0 (`paket-3.verify.log`, Nx-Cache), ohne Cache exit=0 (`paket-3.verify-nocache.log`)
  - 2026-09-21 Zug 3: Reviewer (Opus, high) — alle 9 Einträge behoben; 1 wichtig (Kontext wird bei jedem Release wiederhergestellt, auch ohne Nachfolger → lebende WebGL-Kontexte bis zum GC, Chromium-Limit ~16), 8 klein · Diff `paket-3.diff`, Report `paket-3.review-0.json`
  - 2026-09-21 Zug 4 Runde 1: offen 1 wichtig (+ 5 klein mitgegeben) → derselbe Implementierer per Resume (`paket-3.impl-1.json`) · zurück FERTIG: Wiederherstellung wandert zum Nachfolger (`disposeKeepingContextRestorable()`, `takeOverCanvas()`, `restoreContext()`), neuer Test »keeps its WebGL context lost while no display follows« (vor dem Umbau rot auf Chromium), Warnung jetzt `new Display(): …` · Verify ohne Cache exit=0 (`paket-3.verify-1.log`) · Reviewer gezielt (`paket-3.review-1.json`, Diff `paket-3.diff-1`)
  - 2026-09-21 Zug 4 nach Runde 1: Reviewer — wichtig behoben, 5 klein erledigt; neu 1 wichtig: der Pfad »Nachfolger lange nach der Freigabe« ist ungetestet (`display-dispose.test.js:407-443`, beide positiven Fälle bauen den Nachfolger im selben Tick wie `dispose()`) · offene Befunde 1 → 1, ersetzt statt gesenkt → Bremsregel, Paket blockiert
  - 2026-09-21 Arbeitsbaum gesichert: `stash@{0}` »paket-3-abgebrochen« (8 Dateien, Stand nach Runde 1, `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0)
  - 2026-09-21 Zug 0 (Wiederaufnahme nach Entscheidung vom 2026-09-21): Detailplan Runde 2
    steht (Abschnitt »Runde 2«) · `HEAD` `cf337e90` = Basis des Stashs, Untracked-Teil leer ·
    offener Befund unverändert (Stash `display-dispose.test.js:407-443`, `:487-509`) · übrige
    Einträge behoben laut Review 0/1 · »Offene Befunde« 7 Einträge, keiner in Runde 2
    (`vertex-objects-heap.test.js:130` vorbestehend, `0ba859d7` Zeile 113) · keine Folgen zu
    verteilen · Commit-Message angepasst · Restplan unverändert, kein weiteres offenes Paket
  - 2026-09-21 B: `stash@{0}` »paket-3-abgebrochen« angewendet (8 Dateien, Arbeitsbaum = Stash),
    Stash bleibt liegen
  - 2026-09-21 Zug 4 Runde 2 / Zug 1: Implementierer per Resume `2e4e4f56-…`, Opus, Effort high
    (`paket-3.impl-2.json`)
  - 2026-09-21 Zug 4 Runde 2 / Zug 2: Report FERTIG · nur `display-dispose.test.js` gegen den
    Stash (+30 −6) · Mutationsprobe (`lost == null && ` gestrichen, Parameter als `_lost`, sonst
    TS6133) rot genau im neuen Fall auf Chromium (`paket-3.impl.mutation-2.log`, exit=1), Firefox
    grün; zurückgenommen, grün (`paket-3.impl.green-2.log`) · Verify
    `NX_SKIP_NX_CACHE=true pnpm run ci` exit=0 (`paket-3.verify-2.log`)
  - 2026-09-21 Zug 4 Runde 2 / Zug 3: Reviewer gezielt (Opus, high) — offener Befund behoben
    (`display-dispose.test.js:428-449`), 1 klein · Diff `paket-3.diff-2`, Delta
    `paket-3.diff-2.delta`, Report `paket-3.review-2.json` · offene Befunde 1 → 0
  - 2026-09-21 Zug 5: Commit `1087d55d` (8 Dateien, Trailer `Remediation-Run: 2026-09-21`),
    Verify `paket-3.verify-2.log` exit=0 ohne Codeänderung seither · Stash
    »paket-3-abgebrochen« gelöscht

## Runde 2 — Wiederaufnahme nach der Blockade

Grundlage ist die Entscheidung vom 2026-09-21 im Plan: Stash anwenden, den fehlenden Testfall
ergänzen, den ersten Fall umbenennen, Verify, gezielter Review, Commit, kein Umbau. Die
Abschnitte ab »Der Befund und warum dieser Weg« beschreiben Runde 0, »Stand bei Blockade«
beschreibt Runde 1; beides ist umgesetzt und liegt im Stash. Für Runde 2 gilt dieser Abschnitt.

### Abgleich (Zug 0, 2026-09-21)

- `HEAD` ist `cf337e90` und zugleich die Basis des Stashs (`git rev-parse stash@{0}^`). Der
  Arbeitsbaum ist sauber bis auf Plan und Paketdateien, der Untracked-Teil des Stashs ist leer:
  `git stash apply` läuft ohne Konflikt.
- Offener Befund, unverändert: Im Stand des Stashs bauen beide positiven Canvas-Fälle den
  Nachfolger im selben Tick wie `dispose()` (`display-dispose.test.js:407-425` und `:427-443`).
  Der Fall »keeps its WebGL context lost while no display follows« (`:487-509`) wartet die
  Freigabe ab, baut aber keinen Nachfolger. Ungetestet bleibt damit der Pfad, den Runde 1
  geöffnet hat: Der Eintrag in `canvasReleases` überlebt die Freigabe (`Display.ts:1124-1129`,
  Bedingung `lost == null && …` in Zeile 1128), und erst `takeOverCanvas()` (`:183-192`) stellt
  den Kontext wieder her.
- Alle übrigen Einträge sind laut Review 0 und 1 behoben, Fundstellen unter »Reviewer-Urteil je
  Eintrag«.

### Entschieden in Zug 0, mit Grund

- **Resume statt frischem Prozess.** Die Fehlerkette sähe für Runde 2 einen frischen
  Implementierer eine Stufe höher vor. Die Stufe ist aber schon die stärkste, und offen ist ein
  fehlender Test, kein wiederholt gescheiterter Weg. Der Implementierer aus Runde 0 und 1 hat
  `whenReleased()`, `expectLiveBackend()` und die Freigabelogik selbst gebaut. Seine Session
  `2e4e4f56-bf32-4bff-a360-3ecc47a5acbf` liegt noch vor
  (`~/.claude/projects/-home-spw-spaceland-twopoint5d/2e4e4f56-bf32-4bff-a360-3ecc47a5acbf.jsonl`,
  zuletzt 19:52). Der Prompt-Cache ist nach drei Stunden kalt, der Resume zahlt also den vollen
  Aufbau. Gewählt ist er trotzdem, weil der Kontext hier mehr wiegt als die Token.
- **Mutationsprobe statt rotem Lauf.** Runde 2 behebt nichts: Der Code im Stash ist richtig,
  einen Stand »vor dem Fix« gibt es nicht. Dass der neue Fall den Pfad wirklich bewacht, belegt
  er rot gegen genau den Fehler, den der Reviewer beschreibt, und grün ohne ihn. Der Fehler: Der
  Eintrag geht mit dem Ende jeder Freigabe.
- **Die zwei kleinen Befunde aus Review 1 bleiben klein.** Der erste: Nach einem Timeout löscht
  `takeOverCanvas()` den Eintrag, obwohl der Kontext tot bleibt. Ihn zu beheben hieße, das
  Verhalten zu ändern, und die Entscheidung sagt »kein Umbau«. Der zweite: Die Texte sagen nicht,
  dass nur ein `Display` den Kontext zurückholt. Aber `stage/README.md` (Stash `:477-482`: »Under
  WebGL its context stays lost until then«) und der CHANGELOG-Eintrag (»leaves it lost until a
  `Display` is built on the canvas again«) sagen schon, dass der Kontext bis zum nächsten
  `Display` verloren bleibt; der Halbsatz brächte nur die Folgerung daraus. Beide stehen unter
  »Kleine Befunde der Reviewer« und lösen keine Runde aus.
- **Kein Nebenbefund in diese Runde.** `vertex-objects-heap.test.js:130` (`→ Scope`) ist
  vorbestehend: `git show 0ba859d7:packages/twopoint5d-testing/test/vertex-objects-heap.test.js`
  zeigt in Zeile 113 `material = undefined;` ohne `dispose()`. Er teilt die Ursache nicht — es
  geht um den Teardown eines Tests, nicht um die Übergabe eines Canvas — und bleibt für die
  Drain-Runde des Abschlusses. Die Entscheidung vom 2026-09-21 schneidet Runde 2 ohnehin auf den
  Test zu.
- **Verify ohne Nx-Cache.** So ist der Stand im Stash verifiziert, und die Browser-Suite ist der
  einzige Lauf, der den neuen Fall sieht; ein Cache-Treffer auf `test:browser` bewiese nichts.
- **Modell und Effort bleiben `opus`/`high`**, auch für den Reviewer: Beim Resume sind sie
  Pflicht, sonst ist der Cache verloren. Der Reviewer urteilt über asynchrone Freigabe und die
  Frage, ob ein Test einen Pfad wirklich bewacht.

### Ablauf für B

`$A` ist das Arbeitsverzeichnis aus dem Plan-Kopf.

1. **Stash anwenden, nicht poppen.** Den Eintrag über seine Nachricht finden, nicht über den
   Index:

   ```bash
   ref=$(git stash list --format='%gd %gs' | awk '/paket-3-abgebrochen$/ {print $1; exit}')
   git stash apply "$ref"
   git diff --stat HEAD      # die 8 Dateien aus »Verlauf«, Zug 2
   git diff --quiet "$ref" && echo "Arbeitsbaum = Stash"
   ```

   Der Stash bleibt bis nach dem Commit liegen, als Rückfall.
2. **Zug 1: Implementierer per Resume, Runde 2.** Flags exakt wie in Runde 0 und 1, nur Name und
   Dateien tragen die 2:

   ```bash
   setsid bash -c "claude -p --resume 2e4e4f56-bf32-4bff-a360-3ecc47a5acbf \"\$(cat '$A/paket-3.impl-2.brief.txt')\" --model opus --effort high --permission-mode bypassPermissions --name remediate-p3-impl-2 --output-format json > '$A/paket-3.impl-2.json' 2> '$A/paket-3.impl-2.stderr'; echo \$? > '$A/paket-3.impl-2.exit'" < /dev/null > /dev/null 2>&1 &
   ```

   Der Brief in `$A/paket-3.impl-2.brief.txt`, wörtlich:

   > Runde 2 von Paket 3, nach einer Pause. Der Arbeitsbaum steht wieder auf deinem Stand nach
   > Runde 1: aus dem Stash angewendet, `NX_SKIP_NX_CACHE=true pnpm run ci` war darauf grün.
   >
   > Der Reviewer hat nach Runde 1 einen offenen Befund gemeldet, Gewicht wichtig: Kein Test baut
   > den Nachfolger-Display erst nach dem Ende der Freigabe. Genau diesen Pfad hat Runde 1
   > eingeführt — der Eintrag in `canvasReleases` überlebt die Freigabe, erst `takeOverCanvas()`
   > stellt den Kontext wieder her. Ein Fehler dort ließe alle Canvas-Fälle grün.
   >
   > Lies in `docs/remediation/paket-3.md` den Abschnitt »Runde 2 — Wiederaufnahme nach der
   > Blockade«, Unterabschnitt »Auftrag an den Implementierer«. Das ist der ganze Auftrag: ein
   > Fall umbenannt, ein Fall neu, der Kopfkommentar, die Mutationsprobe. Kein Umbau; `Display.ts`
   > bleibt, wie es ist. Die Konventionen aus dem Kopf von `./remediation-plan.md` gelten weiter.
   >
   > Verify: `NX_SKIP_NX_CACHE=true pnpm run ci`
   >
   > Rückgabe wie in Runde 0 und 1: Status (`FERTIG` | `FERTIG_MIT_VORBEHALT` | `BLOCKIERT` |
   > `KONTEXT_FEHLT`), Dateien, Regressionstest (hier: Name des neuen Falls, Kommando und Ausgabe
   > der Mutationsprobe), Verify, Abweichungen, Nebenbefunde, Folgen. Nicht committen. Der
   > Rückgabetext ist der Report, es gibt keine Adresse für etwas anderes; fehlt dir etwas, gib
   > `KONTEXT_FEHLT` zurück statt einer Frage.

   Findet die CLI die Session nicht, startet derselbe Aufruf ohne `--resume` als frischer
   Prozess, Ausgabe nach `paket-3.impl-2-versuch-2.json`. Dann mit vollem Brief nach Zug 1 in
   `runner.md` und `--effort medium`: der Auftrag steht wörtlich hier, und es gibt keinen Cache
   zu halten.
3. **Zug 2.** Verify selbst: `NX_SKIP_NX_CACHE=true pnpm run ci` nach `$A/paket-3.verify-2.log`,
   Exit-Code angehängt. Dazu zwei Proben am Report:
   - `git diff --stat "$ref"` nennt nur `packages/twopoint5d-testing/test/display-dispose.test.js`.
     Jede weitere Datei, auch ein Rest der Mutation in `Display.ts`, geht zurück an den
     Implementierer.
   - `$A/paket-3.impl.mutation-2.log` existiert und zeigt den neuen Fall rot auf Chromium.
     Fehlt die Probe oder ist der Fall darin grün, ist die Runde nicht fertig.
4. **Zug 3.** Diff wie in `runner.md` nach `$A/paket-3.diff-2`, dazu das Delta dieser Runde:
   `git diff -U10 "$ref" -- . ':(exclude)remediation-plan.md' ':(exclude)docs/remediation' > "$A/paket-3.diff-2.delta"`.
   Reviewer `--model opus --effort high`, Report nach `$A/paket-3.review-2.json`, gezielt auf den
   offenen Befund aus Review 1; Brief mit beiden Diff-Pfaden, dieser Paketdatei, den Konventionen,
   dem eigenen Verify-Ergebnis und dem Pfad zur Mutationsprobe.
5. **Bremsregel.** Vor Runde 2 ist 1 Befund offen. Offen danach: nicht erfüllt, `kritisch` oder
   `wichtig` aus `paket-3.review-2.json`. Bei 0 geht es zu Zug 5. Bei 1 oder mehr ist Runde 2 die
   letzte: blockieren wie nach Runde 1, sichern als `paket-3-abgebrochen-2`; der alte Stash
   bleibt liegen.
6. **Zug 5.** Commit mit der Message oben und dem Trailer `Remediation-Run: 2026-09-21`,
   gezielt die Pfade aus `paket-3.diff-2`. Danach `ref` neu ermitteln (der Index kann sich
   verschoben haben) und `git stash drop "$ref"`. Rückgabe mit `rounds: 2`. Im Plan unter Paket 3
   die Zeile »Wiederaufnahme« durch `Ergebnis:` ersetzen; Regressionstests beim Namen: die aus
   Runde 0 und 1 (rot vor dem Fix) und der neue Fall (rot unter der Mutationsprobe).

### Auftrag an den Implementierer

Geändert wird nur `packages/twopoint5d-testing/test/display-dispose.test.js`. `Display.ts` und
alle anderen Dateien bleiben, wie sie nach Runde 1 stehen; die Mutation in Schritt d wird
vollständig zurückgenommen.

a. **Umbenennen.** `it('a canvas that was handed in carries a second display once the first one
   is released', …)` heißt künftig
   `it('a canvas that was handed in carries a second display built while the first one is being released', …)`.
   Der Rumpf bleibt unverändert.

b. **Neuer Fall**, direkt nach dem umbenannten und vor
   `it('a canvas that was handed in carries a second display when dispose() lands in the init of the first one', …)`:

   ```js
     it('a canvas that was handed in carries a second display built after the first one has been released', async () => {
       host = makeContainer();
       const canvas = document.createElement('canvas');
       host.appendChild(canvas);

       previous = new Display(canvas);
       await previous.start();
       await previous.nextFrame();

       const released = whenReleased(previous.renderer);
       previous.dispose();
       await released;
       // the release is through and the canvas has sat without a display for a few tasks: only the
       // display built now can bring its WebGL context back
       await new Promise((resolve) => setTimeout(resolve, 100));

       display = new Display(canvas);
       await display.start();
       await display.nextFrame();

       await expectLiveBackend(display);
     });
   ```

   Kein `this.skip()`: Der Fall läuft auf beiden Browsern. Unter WebGPU geht beim Freigeben
   nichts verloren, und der Fall belegt dort, dass ein Canvas nach abgeschlossener Freigabe einen
   neuen `Display` trägt.

c. **Kopfkommentar**, Absatz zu Assertion (a). Die Zeilen von »a destroyed device, or a lost
   WebGL context. The four cases after those …« bis »… The rest of this file is about the
   contract afterwards.« (im Stash Zeilen 90-94) werden ersetzt durch:

   ```js
     // a destroyed device, or a lost WebGL context. The five cases after those follow a canvas that
     // was handed in: it is the caller's, and after the display on it has been disposed it carries
     // the next one — built while the release runs, built once the release is through, built after
     // a dispose() inside the init, and, bounded in time, when the WebGL context does not come
     // back — while its WebGL context stays lost as long as no display follows. The rest of this
     // file is about the contract afterwards.
   ```

   Keine Zeile wird breiter als 99 Zeichen, die längste Zeile im Absatz heute.

d. **Mutationsprobe**, nach a bis c:
   1. In `packages/twopoint5d/src/display/Display.ts`, `#releaseRenderer()`, im Callback von
      `void released.then((lost) => { … })` aus
      `if (lost == null && canvasReleases.get(canvas) === release) canvasReleases.delete(canvas);`
      das `lost == null && ` streichen. Der Eintrag geht dann mit dem Ende jeder Freigabe.
   2. Bauen und die Datei laufen lassen:

      ```bash
      A=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0c5913dd-6536-4b42-94b0-31ab542295ab/scratchpad
      pnpm build:twopoint5d && pnpm --dir packages/twopoint5d-testing exec web-test-runner test/display-dispose.test.js > "$A/paket-3.impl.mutation-2.log" 2>&1; echo "exit=$?" >> "$A/paket-3.impl.mutation-2.log"
      ```

      Erwartet auf Chromium (WebGL2): rot ist genau der neue Fall — über die Assertion
      `the context of the second display`, über ein abgelehntes `start()` oder über das Timeout
      der Suite, weil das Init auf dem verlorenen Kontext nicht zurückkommt; jedes zählt. Alle
      übrigen Fälle stehen wie vor der Mutation, der vorbestehend übersprungene Fall »releases the
      renderer only after the GPU has run the work submitted to it« eingeschlossen. Auf Firefox
      (WebGPU) ist der neue Fall grün.
   3. Die Mutation zurücknehmen. `git diff --stat 'stash@{0}'` nennt danach nur noch
      `display-dispose.test.js`.
   4. Bauen und die Datei noch einmal laufen lassen, Ausgabe nach `$A/paket-3.impl.green-2.log`:
      grün auf beiden Browsern.

   Bleibt der neue Fall unter der Mutation grün, bewacht er den Pfad nicht. Dann weder Mutation
   noch Fall zurechtbiegen, sondern mit Log als `FERTIG_MIT_VORBEHALT` melden.

e. `NX_SKIP_NX_CACHE=true pnpm run ci`, Ergebnis in den Report.

Nicht in Runde 2: die zwei kleinen Befunde aus Review 1 (siehe oben), der Teardown in
`vertex-objects-heap.test.js`, jede Zeile in `Display.ts`.

## Der Befund und warum dieser Weg

`Renderer.dispose()` ruft in three 0.185.1 `WebGLBackend.dispose()`, und das gibt den
Kontext mit `WEBGL_lose_context.loseContext()` auf
(`node_modules/.pnpm/three@0.185.1/node_modules/three/src/renderers/webgl-fallback/WebGLBackend.js:2833-2836`);
seinen eigenen `webglcontextlost`-Listener nimmt es im selben Zug wieder ab. Ein Canvas hat
genau einen WebGL-Kontext für sein ganzes Leben: das nächste `getContext('webgl2', …)` —
`WebGLBackend.init()`, Zeile 228 — bekommt denselben, verlorenen Kontext. Ein zweiter
`Display` auf einem übergebenen Canvas zeichnet deshalb unter WebGL ins Leere.

Seit Paket 1 wartet die Freigabe auf das laufende Init. Beim Remount unter React
StrictMode (`new Display(canvas)`, `dispose()`, `new Display(canvas)` im selben Tick)
initialisieren beide Renderer gleichzeitig auf demselben Kontext, und das
`loseContext()` des ersten trifft den zweiten.

Unter WebGPU holt three den Kontext erst beim ersten Render (`WebGPUBackend.js:325-365`,
`get context()`) und konfiguriert ihn für das eigene Device; dort verliert niemand etwas.
Eintrag und Warten (Schritte 3 und 4) gelten trotzdem für beide Backends: eine Regel statt zwei, und kein
zweiter Renderer konfiguriert einen Canvas, den ein anderer noch präsentiert.

Entschieden in Zug 0, mit Grund:

- **Kontext wiederherstellen statt Verlust verhindern.** Der Weg über `preventDefault()` auf
  `webglcontextlost` und danach `restoreContext()` ist die Web-API dafür; ein wiederhergestellter
  Kontext ist leer, also auch frei von den Vertex-Array-Objekten, die three nie löscht
  (Befund aus Paket 2). Die Alternative — three das Extension-Objekt vorenthalten, damit kein
  `loseContext()` läuft — griffe in den privaten Cache `backend.extensions.extensions` und
  hinterließe einen lebenden Kontext mit fremdem GL-Zustand.
- **Nur der als erstes Argument übergebene Canvas.** Er gehört laut
  `resource-lifecycle.md` §1 dem Aufrufer (»not disposed, not cleared, not modified«). Den
  Canvas eines übergebenen Renderers übernimmt der `Display` samt Renderer (Konstruktor-TSDoc,
  §1 »take-over«); den eigenen Canvas im selbst gebauten Container wirft er weg. Dort
  wiederherzustellen hieße, einen frischen GL-Kontext für einen Canvas anzulegen, den niemand
  mehr benutzt. Das Warten in Schritt 4 prüft trotzdem jeden neuen `Display` gegen seinen
  `renderer.domElement`, gleich über welchen Konstruktorpfad.
- **Warten mit Obergrenze, 2000 ms.** Scheitert die Wiederherstellung, meldet Chromium das nur
  als GL-Fehler, ohne Event. Ohne Obergrenze hinge der nächste `Display` für immer in seinem
  Init, und `start()` käme nie zurück — eine Sackgasse, die der Aufrufer nicht sieht. Mit
  Obergrenze startet er auf dem verlorenen Kontext, und ein scheiterndes Init erreicht ihn über
  `start()` und das `error`-Event. Eine Wiederherstellung dauert Millisekunden; 2000 ms lassen
  einem ausgelasteten CI-Runner mit Software-GL genug Luft.
- **`dispose()` selbst bleibt Zeichen für Zeichen, wie es ist.** Alles geschieht in
  `#releaseRenderer()`, im Konstruktor und in modulweiten Helfern. Grund: `resource-lifecycle.md`
  §4 zitiert den Rumpf von `Display.dispose()` wörtlich (Zeilen 155-176), und die Entscheidung
  vom 2026-09-21 im Plan hält `dispose()` synchron mit unveränderter Signatur. Wird der Rumpf
  doch angefasst, zieht der Auszug in §4 mit.
- **Kein Abbruch eines Inits, das noch wartet.** Wird ein `Display` disposed, während sein
  Renderer noch auf die Freigabe des Vorgängers wartet (Schritt 4), läuft sein Init danach trotzdem, und
  seine eigene Freigabe folgt wie in jedem anderen Fall. Das hält die Regel »`dispose()` wartet
  auf das Init« ohne Ausnahme.
- **Nicht in diesem Paket:** die Abschnittsverweise `resource-lifecycle.md:5-6` und `:55`
  (»Section 7 is the checklist, section 8 the tests«, »Assertion (f) in section 8«). Sie sind
  deckungsgleich mit dem Audit-Finding DOC-034 (low, carried-over), und der Scope ist per ID
  gewählt, »ausgenommen: alle übrigen«. Sie bleiben, wie sie sind. Ebenso MEM-018 (Klassen und
  Inline-Styles auf dem übergebenen Canvas nach `dispose()`): eigenes Audit-Finding außerhalb
  des Scopes. Die neuen Texte behaupten deshalb nicht, der Canvas komme unverändert zurück —
  nur, dass er einen neuen `Display` trägt.

## Vorgehen

Konventionen aus dem Plan-Kopf gelten für jede Zeile, Kommentare und Doku eingeschlossen:
keine Finding-IDs, kein Rückblick auf den Vorzustand, Kommentare erklären das Warum, Code
und Doku auf Englisch.

### 1. Regressionstests zuerst — `packages/twopoint5d-testing/test/display-dispose.test.js`

Drei neue Fälle, eingefügt direkt nach `it('releases the renderer only after the GPU has run
the work submitted to it', …)` (endet in Zeile 364), vor `it('a second dispose() throws
nothing and emits nothing', …)`.

a. Eine zweite Variable neben `display` und `host` im `describe`, damit das Teardown auch den
   ersten Display eines Falls erwischt, der nicht bis zu dessen `dispose()` kam:

   ```js
   /** @type {Display | undefined} */
   let previous;
   ```

   `afterEach` disposed `previous` vor `display`, im Stil der vorhandenen Zeilen, und setzt
   es auf `undefined`.

b. Ein Helfer auf Dateiebene unter `makeContainer()`:

   ```js
   /** Resolves once renderer.dispose() has run — the release of a display happens after its dispose() has returned. */
   function whenReleased(renderer) { … }
   ```

   Er ersetzt `renderer.dispose` wie die vorhandenen Fälle (`realDispose` binden, aufrufen,
   danach auflösen). Die beiden vorhandenen Fälle mit eigener Ersetzung bleiben unangetastet.

c. `it('a canvas that was handed in carries a second display once the first one is released', …)`

   1. `host = makeContainer()`, `canvas = document.createElement('canvas')`,
      `host.appendChild(canvas)`.
   2. `previous = new Display(canvas)`, `await previous.start()`, `await previous.nextFrame()`.
   3. `const released = whenReleased(previous.renderer)`, dann `previous.dispose()`.
   4. `display = new Display(canvas)`, `await display.start()`, `await released`,
      `await display.nextFrame()`.
   5. Prüfung auf dem Backend von `display.renderer`, gelesen erst jetzt (three kann im Init auf
      WebGL zurückfallen), Typ-Cast per JSDoc wie in Zeile 259-262:
      - WebGL: `expect(backend.gl.isContextLost(), 'the context of the second display').to.equal(false)`
      - WebGPU: `Promise.race` aus `backend.device.lost.then(() => 'lost')` und
        `display.nextFrame().then(() => 'frame')`, erwartet `'frame'` mit der Meldung
        `'the device of the second display'`.

   Die Prüfung beider Backends in eine Funktion auf Dateiebene
   `expectLiveBackend(display)` (async), die d. auch benutzt.

d. `it('a canvas that was handed in carries a second display when dispose() lands in the init of the first one', …)`

   Das Remount unter React StrictMode. Wie c., aber ohne `start()`/`nextFrame()` für
   `previous`: `previous = new Display(canvas)`, sofort `const released =
   whenReleased(previous.renderer)`, `previous.dispose()`, `display = new Display(canvas)`,
   `await display.start()`, `await released`, `await display.nextFrame()`, dann
   `await expectLiveBackend(display)`.

e. `it('a WebGL context that does not come back holds the next display on its canvas up for a bounded time', async function () { … })`

   1. Canvas wie in c., `previous = new Display(canvas)`, `await previous.start()`.
   2. `if (!previous.isWebGLBackend) this.skip();` — die Wiederherstellung gibt es nur unter
      WebGL.
   3. Das Extension-Objekt des Kontexts, das `Display` in der Freigabe benutzt, bekommt ein
      eigenes `restoreContext`, das nichts tut. `gl.getExtension()` gibt für denselben Kontext
      immer dasselbe Objekt zurück, deshalb trifft die Ersetzung auch den Aufruf im Display:

      ```js
      // the browser keeps the context lost: restoreContext() on this extension object does nothing
      gl.getExtension('WEBGL_lose_context').restoreContext = () => {};
      ```

   4. `console.warn` für die Dauer des Falls ersetzen und die Argumente als Zeichenketten
      sammeln; in `try`/`finally` zurücksetzen.
   5. `previous.dispose()`, `display = new Display(canvas)`, dann
      `await display.start().then(() => 'resolved', () => 'rejected')` — beides ist ein
      Ausgang: der zweite Display startet auf dem verlorenen Kontext, und was zählt, ist dass
      `start()` überhaupt zurückkommt. Ohne Obergrenze liefe der Fall in das Timeout der Suite.
   6. `expect(warnings.some((w) => w.includes('Display#dispose()')), 'a warning names the release').to.equal(true)`.

f. Den Kopfkommentar der Datei (Zeilen 46-53, Absatz zu Assertion (a)) um einen Satz
   ergänzen, hinter »a destroyed device, or a lost WebGL context.«:

   > The three cases after those follow a canvas that was handed in: it is the caller's, and
   > once the display on it has been released it carries the next one — after a display that
   > ran, after a dispose() inside the init, and, bounded in time, when the WebGL context does
   > not come back.

   Umbruch wie der Rest des Kommentars.

Den roten Lauf mit dem Einzellauf-Kommando oben zeigen, bevor Schritt 2 beginnt: c., d. und
e. rot auf Chromium. Die Ausgabe gehört in den Report.

### 2. Modulweite Teile in `Display.ts`, nach `drainSubmittedWork()` (endet Zeile 64)

a. Konstante mit Warum-Kommentar:

   ```ts
   // A WebGL context the browser has not brought back after this long is not coming back, and
   // the display waiting for the canvas starts on it anyway: a failed init reaches its caller
   // through start() and the error event, a wait without end reaches nobody
   const CONTEXT_RESTORE_TIMEOUT_MS = 2000;
   ```

b. Die Freigaben, auf die ein neuer Display auf demselben Canvas wartet:

   ```ts
   // The release of a renderer runs on after dispose() has returned, and the canvas handed to
   // that display is not free before the release is through: a renderer initialized on it in
   // the meantime would share the WebGL context of the one being released and lose it with it.
   // A display built on the canvas waits for the entry first
   const canvasReleases = new WeakMap<HTMLCanvasElement, Promise<void>>();
   ```

c. Neue Funktion `disposeAndRestoreContext(renderer: WebGPURenderer): Promise<void>`, mit
   einem Kommentar darüber, der sagt: ein Canvas behält seinen einen WebGL-Kontext für immer
   und beantwortet jedes spätere `getContext('webgl2')` mit ihm; `WebGLBackend.dispose()` gibt
   ihn mit `WEBGL_lose_context.loseContext()` auf; ein Canvas, der an seinen Aufrufer
   zurückgeht, bekommt den Kontext deshalb wieder, bevor die Freigabe fertig ist. Verhalten:

   1. Backend lesen wie in `drainSubmittedWork()` (die three-Typen kennen `gl` nicht):
      `renderer.backend as {isWebGLBackend?: boolean; gl?: WebGL2RenderingContext | null} | undefined`.
   2. Kein WebGL-Backend, kein `gl`, `gl.isContextLost()` schon `true`, oder
      `gl.getExtension('WEBGL_lose_context')` gibt `null` → `renderer.dispose()` und fertig.
      Das Extension-Objekt wird hier geholt, **vor** `renderer.dispose()`: ein verlorener Kontext
      beantwortet `getExtension()` mit `null`. Ohne Extension ruft three kein `loseContext()`.
   3. Sonst, **vor** `renderer.dispose()`, auf `renderer.domElement`:
      - ein Listener für `webglcontextlost`, der `event.preventDefault()` ruft — nur ein
        Verlust, dessen Default verhindert wurde, darf wiederhergestellt werden — und
        `extension.restoreContext()` per `setTimeout(…, 0)` anstößt. Kommentar dazu: der Browser
        entscheidet erst nach dem Dispatch des Events, ob der Kontext zurückkommen darf, ein
        `restoreContext()` im Handler selbst wird abgewiesen.
      - ein Listener für `webglcontextrestored`, der die Wartezeit beendet.
      - ein Timer über `CONTEXT_RESTORE_TIMEOUT_MS`, der die Wartezeit ebenfalls beendet und
        dann einmal warnt:

        ```ts
        // eslint-disable-next-line no-console
        console.warn(
          `Display#dispose(): the WebGL context of the canvas did not come back within ${CONTEXT_RESTORE_TIMEOUT_MS} ms; the next display on it starts anyway`,
        );
        ```

   4. `renderer.dispose()`, dann auf das Ende der Wartezeit warten.
   5. In jedem Ausgang — wiederhergestellt, Timeout, oder `renderer.dispose()` wirft — beide
      Listener ab und den Timer gelöscht (`try`/`finally`). Ein Listener, der liegen bliebe,
      griffe beim nächsten Kontextverlust des Nachfolgers ein. Ein Wurf von `renderer.dispose()`
      geht unverändert weiter nach oben.

### 3. Freigabe in `#releaseRenderer()` (Zeilen 929-950) und ein Feld

a. Neues privates Feld neben `#ownContainer` (Zeile 388), mit Kommentar:

   ```ts
   // The canvas handed to the constructor as its first argument. It is the caller's, and the
   // release of the renderer hands it back able to carry the next display — see #releaseRenderer()
   #callersCanvas?: HTMLCanvasElement;
   ```

   Gesetzt im Konstruktor im Zweig `domElementOrRenderer.tagName === 'CANVAS'` (Zeile 430-431).

b. `#releaseRenderer(renderer)`:
   - `const handBack = this.#callersCanvas != null && renderer.domElement === this.#callersCanvas;`
     — synchron am Anfang (ein `createRenderer`, das den Canvas ignoriert, bekommt keinen fremden
     Canvas wiederhergestellt).
   - Die bestehende Kette bleibt in Aufbau und Kommentaren erhalten; im Erfolgszweig nach
     `await drainSubmittedWork(renderer)`: bei `handBack` `await disposeAndRestoreContext(renderer)`,
     sonst `renderer.dispose()` wie bisher. Der Ablehnungszweig (gescheitertes Init) und das
     abschließende `.catch` mit `console.error` bleiben, wie sie sind.
   - Das Ergebnis der Kette — ein `Promise<void>`, das dank `.catch` nie ablehnt — heißt
     `released`, das `void` davor fällt weg.
   - Bei `handBack`: `canvasReleases.set(canvas, released)` synchron, noch in `dispose()`, damit
     ein im selben Tick gebauter Display den Eintrag sieht. Danach
     `void released.then(() => { if (canvasReleases.get(canvas) === released) canvasReleases.delete(canvas); })`
     — nur der eigene Eintrag geht, der eines Nachfolgers, der sich schon eingetragen hat,
     bleibt.
   - Den Kommentar über der Kette (Zeilen 930-933) um die Rückgabe des Canvas ergänzen.

### 4. Konstruktor wartet auf eine laufende Freigabe (Zeile 485-487)

```ts
// Both construction paths end with a renderer and both have to wait for the same promise.
// One assignment, so a path that gets added later cannot leave the field empty. A canvas whose
// previous display is still releasing its renderer is not free yet: the init starts once that
// release is through
const renderer = this.renderer!;
const previousRelease = canvasReleases.get(renderer.domElement);
this.#waitForRenderer = previousRelease != null ? previousRelease.then(() => renderer.init()) : renderer.init();
```

Ohne laufende Freigabe ist `#waitForRenderer` weiterhin genau das Promise von
`renderer.init()` — der Fall »a dispose() before the renderer is ready leaves the frame loop
empty« (Zeile 193-227) hängt daran. Die Namen `renderer`/`previousRelease` sind frei wählbar,
solange nichts Bestehendes überschattet wird (weiter unten in Zeile 491 steht `const
{domElement: canvas} = this.renderer!`).

### 5. Kommentar Zeile 447-448 richtigstellen

Der Satz sagt heute, auch der `domElement` eines übergebenen Renderers gehöre dem Aufrufer;
der Konstruktor-TSDoc sagt, der Display übernehme ihn. Neu:

```ts
        // only what was built here: a canvas that arrived as an argument belongs to the caller,
        // and the domElement of a renderer that arrived as one stays where the caller put it
```

### 6. TSDoc in `Display.ts`

a. Klassen-TSDoc, Punkt 3 der Lifecycle-Liste (Zeilen 84-90): am Ende anfügen, im Umbruch
   des Absatzes:

   > A canvas handed to the constructor carries a new display after that release; one built
   > on it earlier waits for it.

b. Konstruktor-TSDoc (Zeilen 390-401) ganz ersetzen — der zweite Absatz repariert zugleich den
   Satzbau, dessen »and after {@link Display.dispose} releases it« kein Subjekt hat:

   ```ts
     /**
      * Create a display around a canvas, around a container element that gets a canvas of its own,
      * or around a `WebGPURenderer` that is already built.
      *
      * A canvas handed in here stays the caller's. If a display disposed before this one is still
      * releasing the renderer it had on that canvas, the renderer of this display starts its init
      * once that release is through — see {@link Display.dispose}.
      *
      * A renderer handed in here is adopted, not borrowed: the display takes it and its
      * `domElement` as its own. {@link Display.dispose} releases it with `renderer.dispose()`, once
      * its init is through and the GPU has run the work submitted to it. A renderer that has to
      * outlive this display therefore does not belong in here.
      *
      * @param domElementOrRenderer a `<canvas>`, any other `HTMLElement` to host a canvas, or a
      *   ready-made `WebGPURenderer`
      */
   ```

c. `dispose()`-TSDoc (Zeilen 896-907): zwischen den ersten Absatz (»Before it returns …«) und
   den Absatz »A `dispose()` while the renderer is still initializing …« kommt:

   ```ts
      *
      * A canvas handed to the constructor goes back to the caller able to carry a new display.
      * Under the WebGL backend `renderer.dispose()` loses the context of that canvas, and a canvas
      * keeps its one WebGL context for good, so the release restores the context before it is
      * through. A `Display` built on the same canvas in the meantime starts the init of its
      * renderer after that. A context the browser has not brought back within two seconds ends the
      * wait with a warning on the console.
   ```

### 7. `packages/twopoint5d/src/stage/README.md:474-477` ersetzen

```markdown
- `Display.dispose()` releases its `WebGPURenderer` — the one it built as well as one
  handed to its constructor — and gives up the field, so `Display#canvas` throws afterwards.
  The field is gone as soon as `dispose()` returns; the renderer itself is released once its
  init is through and the GPU has run the work submitted to it. A renderer whose init failed
  has built nothing, and `renderer.dispose()` is not called on it. A canvas handed to the
  constructor stays the caller's and carries a new `Display` afterwards: one built on it
  while the release is still running starts its renderer once the release is through.
```

Dazu in derselben Datei die beiden Kurzbeschreibungen:

- Zeile 13, rechts neben dem Kasten: `owns canvas + WebGPURenderer` →
  `owns WebGPURenderer + its canvas` (der Kasten selbst bleibt, wie er ist).
- Zeile 44, Tabellenzeile `Display`, Rolle: `Owns the canvas + \`WebGPURenderer\`, drives …` →
  ``Owns the `WebGPURenderer` and its canvas (a canvas handed to the constructor stays the caller's), drives the frame loop, emits resize/render events. Source of truth for size + time.``

### 8. `packages/twopoint5d/docs/architecture.md:87-88` ersetzen

```markdown
`Display` owns the three.js renderer (WebGL or WebGPU —
`isWebGLRenderer` / `isWebGPURenderer` discriminate) and its canvas, unless the canvas was
handed to the constructor, and drives the frame loop.
```

Zeile 89 (`Chronometer` …) schließt unverändert an. Breite höchstens 88 Zeichen.

### 9. `packages/twopoint5d/docs/resource-lifecycle.md` §5

Am Ende von §5, nach dem Absatz »A `Mesh` that gives up its geometry or material calls
`removeFromParent()` first …« (endet Zeile 226), vor `## 6.`, ein neuer Absatz, umbrochen bei
höchstens 88 Zeichen wie der Rest der Datei:

```markdown
**A shared material holds on to every mesh drawn with it.** three keeps a `RenderObject`
for every mesh it renders with a material, held by the dispose listener it puts on that
material. The `RenderObject` holds the mesh, its geometry — disposed or not — with the
typed arrays behind it, and a uniform group. Neither `geometry.dispose()` nor
`renderer.dispose()` lets it go; `material.dispose()` does, and so does a change of its
cache key. A long-lived material that many short-lived meshes share therefore grows by one
`RenderObject` per mesh until it is disposed itself — dispose it along with the last of
them, or accept the growth. `vertex-objects-heap.test.js` in `packages/twopoint5d-testing`
measures it.
```

Die Zeilen 5-6 und 55 dieser Datei bleiben unangetastet (siehe oben, DOC-034).

### 10. `packages/twopoint5d-testing/test/vertex-objects-heap.test.js`

a. Zeilen 18-22, erster Spiegelstrich des Kopfkommentars, ersetzen — der Satz »all of it goes
   once the material is garbage collected« stimmt für die Uniform-Gruppe nicht, die hält
   zusätzlich `renderer.info.memoryMap` (three `Info.js:377-381`, geleert von
   `destroyUniformBuffer()` beim Freigeben des `RenderObject` und von `Info#dispose()`):

   ```js
   // - every mesh rendered with the shared material gets a `RenderObject`, held by its dispose
   //   listener on the material. It keeps the mesh, the disposed geometry and its own uniform group.
   //   `geometry.dispose()` leaves the listener in place; three releases the `RenderObject` on
   //   `material.dispose()` or when its cache key changes. A material that is only garbage
   //   collected takes the `RenderObject` along, but not its uniform group: the renderer's
   //   `info.memoryMap` keeps that until `material.dispose()` or `renderer.dispose()`.
   ```

b. Zeilen 30-31, der Satz über den Rest, ersetzen — die Snapshots ordnen nur ≈ 1,6 der 3 KB
   je Runde dem Vertex-Array-Cache zu, »JIT code« ist dort nicht belegt:

   ```js
   // Disposing the material every 20 rounds leaves about 3 KB per round (2.2 % over 80 rounds);
   // the snapshots trace about 1.6 KB of it to the vertex-array cache and name no owner for the
   // rest. Runs repeat to within 0.01 points; the limit sits three points
   ```

   Der Rest des Satzes (»above them, so a shift in three or V8 …«) schließt an; den Umbruch der
   folgenden Zeilen so nachziehen, dass keine Kommentarzeile breiter wird als die längste
   heute im Block. Zeile 16 (»and JIT code the page compiles meanwhile counts too«) bleibt.

c. Zeile 98: Die Datei läuft nur auf Chromium (Zeile 89-95 überspringt Firefox), und dort läuft
   das WebGL2-Backend — ein »cold webgpu start« findet nie statt. Neu:

   ```js
     // the display comes up in the hook — renderer init included — and hooks have their own budget
   ```

   Die gleichlautenden Zeilen in den anderen 13 Testdateien bleiben: sie laufen auch auf
   Firefox, und dort begründet der WebGPU-Start das Timeout.

d. Zeile 164, Meldung der Assertion: `'geometries given up their renderer slot'` →
   `'geometries the renderer still counts after the rounds'`.

### 11. `docs/architecture.md:264-267` ersetzen

Zeile 265 hat 89 Zeichen (die Datei bricht bei 88), und »tears a display down in its
teardown« sagt dasselbe zweimal:

```markdown
A browser test takes its display down with `dispose()` alone: `Display#dispose()`
stops the loop right away and releases the renderer only once the GPU has run the work
submitted to it. Firefox 155 under WebGPU needs that to keep drawing frames for the
tests that follow.
```

### 12. `packages/twopoint5d/CHANGELOG.md`

Unter `## [Unreleased]` → `### Fixed` ein neuer Eintrag direkt nach dem Eintrag, der in Zeile
231 mit ``- fix `Display#dispose()` for a renderer that is still initializing`` beginnt, im Stil
seiner Nachbarn (eine Zeile, kein Punkt am Ende):

```markdown
- fix `Display#dispose()` for a canvas handed to the constructor: the canvas carries a new `Display` afterwards. Under the WebGL backend three loses the context of the canvas as it releases the renderer, and a canvas keeps its one WebGL context for good, so the release restores that context before it is through; a `Display` built on the canvas while the release is still running — a remount under React StrictMode — initializes its renderer once it is. A context that has not come back after two seconds ends the wait with a console warning
```

Keine Migrations-Notiz: keine Signatur ändert sich.

### Bekannt, nicht in diesem Paket

Stehen in `Display.ts`, liegen schon in »Offene Befunde« oder im Audit und werden hier weder
behoben noch neu gemeldet: das TSDoc von `frameNo` (»Starts at 1«, Zeile 270), die TSDoc-Sätze
an `resizePollIntervalMs` (Zeile 194) und an der `deltaTime`-Obergrenze (Zeile 582), das
`// TODO check if this is still needed` in Zeile 457, sowie MEM-018 (Klassen und Styles auf dem
übergebenen Canvas) und DOC-034 (Abschnittsverweise in `resource-lifecycle.md`).

## Abgleich der Einträge

| Eintrag | Herkunft | Urteil | Fundstelle jetzt |
| --- | --- | --- | --- |
| Canvas trägt nach `dispose()` keinen zweiten Display (WebGL) | Nebenbefund Paket 1, Zug 0 | unverändert, im Code bestätigt | `Display.ts:938` (`renderer.dispose()` in `#releaseRenderer`, Methode ab `:929`); three `WebGLBackend.js:2834` |
| Abschnittsverweise `resource-lifecycle.md:5-6`, `:55` | Nebenbefund Paket 1 | unverändert, **aus dem Paket genommen**: deckungsgleich mit DOC-034, außerhalb des gewählten Scopes | `resource-lifecycle.md:5-6`, `:55` |
| §5 nennt das `RenderObject` am geteilten Material nicht | Nebenbefund Paket 2 | unverändert | `resource-lifecycle.md:183-226` |
| »cold webgpu start« im Heap-Test | Nebenbefund Paket 2 | unverändert | `vertex-objects-heap.test.js:98` |
| Assertion-Meldung »geometries given up their renderer slot« | Nebenbefund Paket 2 | unverändert | `vertex-objects-heap.test.js:164` |
| Zeile mit 89 Zeichen und Doppelung | Folge von 1 | unverändert | `docs/architecture.md:264-265` (Zeile 265: 89 Zeichen) |
| Satzbau Konstruktor-TSDoc | Folge von 1 | unverändert | `Display.ts:394-397` |
| Stage-README nennt »Init gescheitert« nicht | Folge von 1 | unverändert, **Pfad korrigiert** | `packages/twopoint5d/src/stage/README.md:474-477` (der Plan nannte `src/display/stage/README.md`) |
| V2-Rest »vertex-array cache plus JIT code« / Uniform-Gruppe | Folge von 2 | unverändert | `vertex-objects-heap.test.js:18-22`, `:30-31` |
| Commit-Message von `cf337e90` sagt »as the cause« | Reviewer-klein Paket 2 | entfällt: die Historie wird nicht umgeschrieben | — |
| »Display owns the canvas« | neu in Zug 0, vorbestehend (`git show 0ba859d7:…` zeigt alle drei) | ins Paket: dieselbe Ursache wie der Canvas-Befund, und nach Schritt 3 widerspräche die Kurzbeschreibung dem TSDoc | `packages/twopoint5d/docs/architecture.md:87`, `stage/README.md:13`, `:44` |

## Findings im Volltext

**Canvas nach `dispose()` · medium (geschätzt) · `packages/twopoint5d/src/display/Display.ts:938`
(`#releaseRenderer`)** — Ein Canvas, der einem `Display` übergeben wurde, trägt nach dessen
`dispose()` im WebGL-Backend keinen zweiten Display: three verliert in `WebGLBackend.dispose()`
den Kontext (`loseContext()`, three 0.185.1 `WebGLBackend.js:2833-2834`), derselbe Canvas liefert
danach denselben, verlorenen Kontext; seit Paket 1 auch bei `dispose()` während des Init (Remount
unter React StrictMode auf demselben `<canvas>`) — im Code gelesen, nicht im Browser gesehen (aus
Paket 1, Zug 0; Reichweite von diesem Lauf geöffnet).

**`resource-lifecycle.md` §5 · low** — nennt nicht, dass ein langlebiges, geteiltes Material in
three je gerendertem Mesh ein `RenderObject` samt entsorgter Geometrie und Typed Arrays
festhält, bis `material.dispose()` läuft (aus Paket 2, Reviewer).

**`vertex-objects-heap.test.js:98` · low** — »a cold webgpu start — adapter plus device —
happens in the hook« stimmt für Chromium nicht, dort läuft WebGL2 (aus Paket 2).

**`vertex-objects-heap.test.js:164` · low** — Assertion-Meldung »geometries given up their
renderer slot« grammatisch schief (aus Paket 2).

**Folge von 1 · Reviewer-klein** — `docs/architecture.md:264-265` Zeile mit 89 Zeichen und
Doppelung; Satzbau im Konstruktor-TSDoc `packages/twopoint5d/src/display/Display.ts:395-396`;
`stage/README.md:474-477` nennt die Ausnahme »Init gescheitert« nicht.

**Folge von 2 · Reviewer-klein** — Kommentar `vertex-objects-heap.test.js:12-33`: der V2-Rest
(»the vertex-array cache plus JIT code«) deckt im Snapshot nur ≈ 1,6 von 3 KB je Runde; »all of
it goes once the material is garbage collected« gilt nicht für die Uniform-Gruppe (hängt auch in
`Info.memoryMap`).

**Zug 0 · low · `packages/twopoint5d/docs/architecture.md:87`, `packages/twopoint5d/src/stage/README.md:13`,
`:44`** — die Kurzbeschreibungen sagen, `Display` besitze den Canvas; ein an den Konstruktor
übergebener Canvas gehört nach `resource-lifecycle.md` §1 dem Aufrufer, und das TSDoc sagt es
nach diesem Paket ausdrücklich.

## Stand bei Blockade (2026-09-21)

Offener Befund (`wichtig`, Reviewer Runde 1, `paket-3.review-1.json`): Kein Test baut den
Nachfolger erst **nach** dem Ende der Freigabe (`await released`, dann ein paar Tasks, dann
`new Display(canvas)`). Genau diesen Pfad hat Runde 1 eingeführt — der Eintrag in
`canvasReleases` bleibt über das Ende der Freigabe stehen, erst `takeOverCanvas()` stellt den
verlorenen Kontext wieder her. Ein Fehler dort ließe alle vier Canvas-Fälle grün. Vorschlag des
Reviewers: fünfter Fall nach dem Muster `previous.dispose(); await released; await new
Promise((r) => setTimeout(r, 100)); display = new Display(canvas); await display.start(); await
display.nextFrame(); await expectLiveBackend(display);` und den ersten Fall in »… while the first
one is being released« umbenennen. Nur Test, kein Umbau — ein Resume des Implementierers
(`session_id` 2e4e4f56-bf32-4bff-a360-3ecc47a5acbf) mit diesem Befund dürfte ihn schließen.

Zum Wiederaufnehmen: `git stash pop` auf `paket-3-abgebrochen`; der Stand ist grün.
(Erledigt in Runde 2, Stash nach dem Commit gelöscht.)

### Reviewer-Urteil je Eintrag (Stand im Commit `1087d55d`)

Review 2 (`paket-3.review-2.json`): der offene Befund aus Review 1 ist behoben — neuer Fall
»a canvas that was handed in carries a second display built after the first one has been
released« (`display-dispose.test.js:428-449`), rot auf Chromium unter der Mutationsprobe
(`lost == null && ` in `#releaseRenderer()` gestrichen, `paket-3.impl.mutation-2.log`), grün
ohne; der erste Fall heißt jetzt »… built while the first one is being released« (`:408`),
der Kopfkommentar (`:84-94`) zählt die fünf Canvas-Fälle in ihrer Reihenfolge. Die zweite
Fehlerform (`takeOverCanvas()` vergisst die Wiederherstellung bei abgeschlossener Freigabe)
deckt der Fall laut Reviewer vom Aufbau her ab, abgeleitet, nicht gemessen.

Alle Einträge aus »Findings im Volltext« behoben (Review 0, Fundstellen dort): Canvas nach
`dispose()` (`Display.ts`, Tests c/d/e rot vor dem Fix auf Chromium, dazu Runde 1 »keeps its
WebGL context lost while no display follows«, rot vor dem Umbau) · `resource-lifecycle.md` §5
`:228-236` · `vertex-objects-heap.test.js:100` und `:166` · `docs/architecture.md:264-267` ·
Konstruktor-TSDoc · `stage/README.md:477-482` · Heap-Kommentar `:18-23`, `:31-35` · »owns the
canvas« `packages/twopoint5d/docs/architecture.md:87-89`, `stage/README.md:13`, `:44`.

### Kleine Befunde der Reviewer

- Review 0 (in Runde 1 erledigt): `#callersCanvas` nie geleert; Kommentar »read before anything
  is awaited« begründet den Zeitpunkt nicht; »one built on it earlier« missverständlich; zwei
  90-Zeichen-Zeilen in `resource-lifecycle.md` §5; `setTimeout`-`restoreContext()` nach Ende
  der Wartezeit.
- Review 0, bleibt: three initialisiert bei `setAnimationLoop()`/`renderAsync()` selbst und
  umgeht so das Warten des Konstruktors; Fall e belegt die Obergrenze nur über die Warnung.
- Review 1: nach einem Timeout löscht `takeOverCanvas()` den Eintrag, obwohl der Kontext tot
  bleibt — ein dritter Display versucht keine Wiederherstellung mehr (`Display.ts:183-192`);
  `stage/README.md:477-482` und CHANGELOG sagen nicht, dass nur ein `Display` den Kontext
  zurückholt (ein eigener Renderer auf dem Canvas bekommt einen verlorenen).
- Review 2: Kommentar im neuen Fall (`display-dispose.test.js:442-443`) spricht nur vom
  WebGL-Kontext, der Fall läuft auch unter WebGPU (dort ohne Wiederherstellung grün, bewacht
  wird der Pfad nur auf Chromium/WebGL2); »for a few tasks« ist ein einziger 100-ms-Timeout.

### Urteilsbegründung der Nebenbefunde

- `vertex-objects-heap.test.js:130` ohne `material.dispose()`: Browser-Test zum Dispose von
  vertex-objects → Scope-Regel greift.
- `stage/README.md` Abschnittsverweise, `styleImageRendering`-TSDoc, Überlängen in
  `resource-lifecycle.md`: betreffen nicht den Abbau → Audit.
