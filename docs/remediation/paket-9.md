# Paket 9 — Drain: Cache-Server-Test ohne geteilten Pfad in /tmp

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 1 (dort entstand `createCacheServer.test.mjs`, Hash 42a88429)
- Nebenbefund: `scripts/ci/nxCacheServer/createCacheServer.test.mjs:90` prüft
  `<os.tmpdir()>/x` auf Nichtexistenz; eine fremde `/tmp/x` macht `test:scripts` und das
  Gate rot (low)
- Ziel: Der Traversal-Test belegt dasselbe über einen Pfad, den nur er selbst besitzt,
  sodass das Gate nicht mehr vom Inhalt des System-Temp-Verzeichnisses abhängt.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `scripts/ci/nxCacheServer/createCacheServer.test.mjs` — sonst nichts.
  Unberührt bleiben `scripts/ci/nxCacheServer/createCacheServer.mjs`,
  `scripts/ci/nxCacheServer.mjs`, `package.json`, `nx.json`, `docs/architecture.md`,
  `AGENTS.md`, jede `CHANGELOG.md`. Keine Doku beschreibt den Aufbau dieses Tests (per
  `grep` geprüft), also zieht die Änderung keine Doku nach sich.
- Arbeitsverzeichnis (`$A` unten):
  `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad`
- Vorgehen:
  1. **Gegenprobe ablegen.** Den Inhalt des Abschnitts »Gegenprobe« unten wörtlich nach
     `$A/paket-9-gegenprobe.sh` schreiben (außerhalb des Repos, nicht ins Projekt).
  2. **Rot gegen HEAD sehen, vor jeder Änderung.** Beide Kommandos aus dem Repo-Root, Ausgabe
     samt Exit-Code in den Report:

     ```bash
     A=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad
     P="$A/paket-9-tmpdir"; rm -rf "$P" && mkdir -p "$P" && touch "$P/x"
     TMPDIR="$P" node --test --test-reporter=spec scripts/ci/nxCacheServer/createCacheServer.test.mjs; echo "rot-probe exit=$?"
     bash "$A/paket-9-gegenprobe.sh" scripts/ci/nxCacheServer "$A"; echo "gegenprobe exit=$?"
     ```

     Erwartet (in Zug 0 so gemessen): Rot-Probe `exit=1`, `ℹ pass 8`, `ℹ fail 1`,
     fehlgeschlagen `a hash that is not alphanumeric answers 400 and writes nothing outside
     the directory` mit `AssertionError` aus Zeile 90. Gegenprobe
     `gegenprobe=FAILED (exit=1, im Temp-Verzeichnis: [x ])`, `exit=1` — der präparierte
     Server schreibt beim HEAD-Aufbau in das Temp-Verzeichnis selbst. Weicht eines davon ab:
     Status `BLOCKIERT` mit der Ausgabe, nichts ändern.
  3. **`beforeEach` (Zeilen 19–21) ersetzen.** Heute:

     ```js
       // the served directory sits one level down, so a path that escapes it still lands inside root
       dir = path.join(root, 'cache');
       fs.mkdirSync(dir);
     ```

     Danach, exakt so:

     ```js
       // the served directory sits two levels down, so a hash that climbs two levels out of it still lands inside root
       dir = path.join(root, 'parent', 'cache');
       fs.mkdirSync(dir, {recursive: true});
     ```

  4. **Die drei Schlusszeilen des Falls `a hash that is not alphanumeric answers 400 and
     writes nothing outside the directory` (Zeilen 88–90) ersetzen.** Heute:

     ```js
       assert.deepEqual(fs.readdirSync(dir), []);
       assert.deepEqual(fs.readdirSync(root), ['cache']);
       assert.equal(fs.existsSync(path.join(dir, '..', '..', 'x')), false);
     ```

     Danach, exakt so:

     ```js
       assert.deepEqual(fs.readdirSync(dir), []);
       assert.deepEqual(fs.readdirSync(path.dirname(dir)), ['cache']);
       assert.deepEqual(fs.readdirSync(root), ['parent']);
     ```

     Die Schleife mit den Hashes `'..%2F..%2Fx'` und `'a.b'` darüber bleibt wörtlich, der
     Testname bleibt, alle anderen Fälle bleiben unverändert (sie benutzen nur `dir`).
  5. **Grün sehen.** Dieselben zwei Kommandos wie in Schritt 2. Erwartet: Rot-Probe `exit=0`,
     `ℹ pass 9`, `ℹ fail 0`, und `ls -A "$P"` zeigt nur `x`; Gegenprobe `gegenprobe=ok`,
     `exit=0`.
  6. Die geänderte Datei ganz lesen (142 Zeilen), Nebenbefunde melden, nicht beheben. Dann
     das Verify-Kommando unten. Nicht committen.
- Verify (aus dem Repo-Root; `$A/paket-9-gegenprobe.sh` legt Schritt 1 an — fehlt die Datei,
  schreibt B sie aus dem Abschnitt »Gegenprobe« nach):

  ```bash
  A=/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad
  P="$A/paket-9-tmpdir"; rm -rf "$P" && mkdir -p "$P" && touch "$P/x" \
    && TMPDIR="$P" node --test scripts/ci/nxCacheServer/createCacheServer.test.mjs \
    && [ "$(ls -A "$P")" = x ] \
    && bash "$A/paket-9-gegenprobe.sh" scripts/ci/nxCacheServer "$A" \
    && pnpm run ci
  ```

- Commit: `test: keep every path the cache server traversal test checks inside its own temp directory, so a file another process leaves in the system temp directory cannot fail the gate`
- Verlauf:
  - 2026-09-21 Zug 0: Detailplan steht · Nebenbefund unverändert an
    `createCacheServer.test.mjs:90` (einziger Commit auf der Datei 42a88429, an der Basis
    da095c73 fehlt sie → Folge, nicht vorbestehend) · Rot-Probe gegen HEAD mit `x` im
    privaten `TMPDIR`: exit=1, pass 8 / fail 1; ohne `x`: exit=0 · Gegenprobe gegen HEAD
    `FAILED` (Spur `x` im Temp-Verzeichnis), gegen eine Scratch-Kopie der geplanten Fassung
    `ok`, Rot-Probe dort exit=0, pass 9 / fail 0, Prettier grün · keine weiteren Folgen
    offen, »Offene Befunde« ohne offenen Eintrag · Restplan unverändert: Paket 9 ist das
    letzte, danach der Abschluss
  - 2026-09-21 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `$A/paket-9.impl-1.json`
  - 2026-09-21 Zug 2: Report FERTIG · geändert `scripts/ci/nxCacheServer/createCacheServer.test.mjs` (Schritt 3 und 4 wörtlich) · Rot-Probe vorher exit=1 pass 8/fail 1, Gegenprobe FAILED `[x ]`; danach pass 9, gegenprobe=ok · Arbeitsbaum schmutzig (eine Datei) · eigener Verify exit=0 (`$A/paket-9.verify.log`, test:scripts 76/76)
  - 2026-09-21 Zug 3: Reviewer (sonnet, low) — erfüllt, keine kritischen/wichtigen Befunde, 3 klein · Diff `$A/paket-9.diff`, Report `$A/paket-9.review-1.json`
  - 2026-09-21 Zug 4: keine Runde nötig
  - 2026-09-21 Zug 5: Commit 320dd067, Verify aus Zug 2 trägt (keine Änderung seither)

## Abgleich

| Eintrag | Stand an HEAD (89166b69) | Fundstelle |
| --- | --- | --- |
| Traversal-Test prüft `<os.tmpdir()>/x` | unverändert | `scripts/ci/nxCacheServer/createCacheServer.test.mjs:90`: `assert.equal(fs.existsSync(path.join(dir, '..', '..', 'x')), false);` mit `dir = path.join(root, 'cache')` (`:20`) und `root` direkt unter `os.tmpdir()` (`:18`) |

Dieselbe Ursache anderswo — ein Skript-Test, der einen Pfad außerhalb seines eigenen
`mkdtemp`-Verzeichnisses prüft oder beschreibt — gibt es nicht:
`scripts/publishNpmPkg/releaseFiles.test.mjs:15`,
`scripts/makePackageJson/resolveDependencies.test.mjs:12` und
`scripts/makePackageJson/makePackageJson.test.mjs:23` legen je ein eigenes
`fs.mkdtempSync(path.join(os.tmpdir(), …))` an und bleiben mit jedem Pfad darin; kein
Nicht-Test-Skript unter `scripts/` nennt `os.tmpdir()` oder `/tmp`.

## Entscheidungen in Zug 0

- **Das Verzeichnis wandert tiefer, der Hash bleibt.** Der Plan schlug »einen eindeutigen
  Namen unter `root`« vor. Umgesetzt wird dieselbe Idee vollständig: `dir` liegt zwei
  Ebenen unter `root`, damit landet alles, was `'..%2F..%2Fx'` erreichen könnte, in
  `root` — und die drei Listings `dir`, `path.dirname(dir)`, `root` zusammen belegen
  »nichts außerhalb des Verzeichnisses geschrieben« lückenlos für jeden Pfad, den die
  beiden Test-Hashes benennen. Ein eindeutiger Name direkt in `os.tmpdir()` (etwa ein
  Hash `..%2F..%2F<basename(root)>%2Fx`) läge weiter im geteilten Verzeichnis und wäre
  schwerer zu lesen. Den Hash auf eine Ebene zu kürzen (`..%2Fx`) hätte den Test ebenfalls
  unabhängig gemacht, aber das Muster aufgegeben, nach dem ein Angreifer tatsächlich
  klettert.
- **Drei getrennte `readdirSync` statt eines rekursiven Listings.** Sie folgen der Form der
  heutigen Zeilen 88–89, und ein Fehlschlag nennt die Ebene, auf der etwas liegt.
  `readdirSync(…, {recursive: true})` gäbe es in Node 24 (`engines`: `^24.16.0 || >=26.3.0`),
  brächte aber nur eine Zeile weniger.
- **Name `parent`.** Neutral, sagt, was das Verzeichnis ist; keine weitere Bedeutung.
- **Kein dauerhafter Meta-Test**, der `node --test` unter einem präparierten `TMPDIR`
  startet. Nach der Änderung nennt der Test keinen Pfad außerhalb von `root` mehr; das ist
  in drei Zeilen sichtbar und für den Reviewer prüfbar. Rot-Probe und Gegenprobe belegen
  den Fix einmalig, im Arbeitsverzeichnis.
- **Regressionsbeleg.** Der Fehler steckt im Test selbst, also ist der bestehende Fall der
  Regressionstest: unter der Rot-Probe (fremde `x` im `TMPDIR`) vor dem Fix rot, danach
  grün. Die Gegenprobe zeigt zusätzlich, dass der Test einen tatsächlichen Ausbruch
  weiterhin meldet — gegen HEAD landet diese Spur im Temp-Verzeichnis selbst, danach in
  `root`, das `afterEach` wieder entfernt.
- **`TMPDIR` statt `/tmp`.** Beide Proben setzen `TMPDIR` auf ein Verzeichnis im
  Arbeitsverzeichnis; `os.tmpdir()` liest es unter POSIX. Niemand legt eine Datei in das
  echte `/tmp`.
- **Modell mittlere Stufe, Effort low.** Der Code ist Transkription (zwei Stellen, exakter
  Text), aber der Auftrag hängt an einer Reihenfolge — Rot-Probe vor dem Edit, Gegenprobe
  danach — und an einem Report mit Belegen; das ist die Untergrenze für einen Bugfix samt
  Regressionsbeleg. Effort low, weil jeder Wert im Plan steht und nichts zu verbessern ist.
  Reviewer: klein und mechanisch, mittlere Stufe.
- **Nicht zu erwarten, was erst ein Push belegt.** Die Änderung läuft vollständig lokal
  (`test:scripts` im Gate); in CI ändert sich nur, dass der Fall dort ebenfalls nicht mehr
  von `$RUNNER_TEMP`/`/tmp` abhängt.

## Nebenbefund im Volltext

**Folge von Paket 1 · low · `scripts/ci/nxCacheServer/createCacheServer.test.mjs:90`** —
`a hash that is not alphanumeric …` prüft `path.join(dir, '..', '..', 'x')`, also
`<os.tmpdir()>/x`, auf Nichtexistenz; eine fremde Datei `/tmp/x` macht `test:scripts` und
damit das Gate rot (in Paket 8 so passiert). Der Traversal-Beleg braucht einen Pfad, den nur
der Test besitzt, etwa einen eindeutigen Namen unter `root`. Urteil an der Scope-Regel:
→ Scope (Test-Harness, Lint-/Typecheck-Gate), beschlossen 2026-09-21 → Paket 9.

Warum der Fall überhaupt nach `<os.tmpdir()>/x` schaut: der Server reicht `match[1]`
undekodiert an `path.join` weiter (`createCacheServer.mjs:34-38`), und der Guard
`/^[A-Za-z0-9]+$/` (`:36`) weist `'..%2F..%2Fx'` ab. Die Zeile 90 sichert den Fall, dass
eine spätere Fassung den Hash dekodiert und der Guard fehlt oder zu spät greift — dann würde
`../../x` von `root/cache` aus in `os.tmpdir()` landen.

## Gegenprobe

Wörtlich nach `$A/paket-9-gegenprobe.sh` (Schritt 1). Aufruf:
`bash "$A/paket-9-gegenprobe.sh" <verzeichnis-mit-beiden-dateien> "$A"`. Exit 0 und
`gegenprobe=ok` nur, wenn der Test genau einen Fehlschlag meldet, den Traversal-Fall, und das
Temp-Verzeichnis danach leer ist. Das Skript arbeitet an Kopien unter
`$A/paket-9-gegenprobe/` und fasst das Repo nicht an.

```bash
#!/usr/bin/env bash
# Gegenprobe zu Paket 9: eine präparierte Kopie des Servers schreibt, was ein ausbrechender Hash
# benennt, bevor ihr Guard 400 antwortet. Der Test muss genau das melden (ein Fehlschlag, der
# Traversal-Fall), und nichts davon darf im Temp-Verzeichnis selbst landen.
# $1 = Verzeichnis mit createCacheServer.mjs und createCacheServer.test.mjs, $2 = Arbeitsverzeichnis
set -u
C="$2/paket-9-gegenprobe"
rm -rf "$C" && mkdir -p "$C/src" "$C/tmp"
cp "$1"/createCacheServer.mjs "$1"/createCacheServer.test.mjs "$C/src/"
sed -i "s|^    const hash = match\[1\];\$|&\n    const decoded = decodeURIComponent(hash);\n    if (decoded.includes('/')) fs.writeFileSync(path.join(dir, decoded), '');|" "$C/src/createCacheServer.mjs"
[ "$(grep -c 'decodeURIComponent' "$C/src/createCacheServer.mjs")" = 1 ] || { echo "gegenprobe=PATCH_FEHLT"; exit 2; }
TMPDIR="$C/tmp" node --test --test-reporter=spec "$C/src/createCacheServer.test.mjs" > "$C/run.log" 2>&1
code=$?
if [ "$code" = 1 ] && grep -q '^ℹ fail 1$' "$C/run.log" && grep -q '✖ a hash that is not alphanumeric' "$C/run.log" && [ -z "$(ls -A "$C/tmp")" ]; then
  echo "gegenprobe=ok"
else
  echo "gegenprobe=FAILED (exit=$code, im Temp-Verzeichnis: [$(ls -A "$C/tmp" | tr '\n' ' ')])"
  exit 1
fi
```

Gemessen in Zug 0 (Node v24.21.0): gegen HEAD
`gegenprobe=FAILED (exit=1, im Temp-Verzeichnis: [x ])`, Exit 1; gegen eine Scratch-Kopie
mit den Ersetzungen aus Schritt 3 und 4 `gegenprobe=ok`, Exit 0. `exit=2` mit
`PATCH_FEHLT` hieße, dass die Zeile `    const hash = match[1];` in `createCacheServer.mjs`
nicht mehr so dasteht — dann ist die Probe wertlos und das Paket `BLOCKIERT`, statt die
Probe umzuschreiben.

## Reviewer-Urteil

- Nebenbefund `<os.tmpdir()>/x`: **behoben** — `createCacheServer.test.mjs:17-21` (`dir = root/parent/cache`) und
  `:88-90` (Listings `dir`, `parent`, `root`); nichts mehr in `os.tmpdir()` selbst geprüft.
- Klein: (1) Kommentar Zeile 19 rund 115 Zeichen, von Prettier nicht beanstandet und so vorgegeben;
  (2) Regressionsbeleg nur über einmalige Rot-/Gegenprobe, bewusst so entschieden; (3) Ausbrüche
  tiefer als zwei Ebenen träfen wieder das echte Temp-Verzeichnis — die Test-Hashes klettern nicht
  tiefer.
