# Paket 5 — Publish-Pipeline: `workspace:`-Specifier korrekt auflösen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: BUG-096 (low), BUG-097 (low)
- Ziel: Ein pfadförmiger Specifier bricht den Wächter ab, statt als Pfad ins
  veröffentlichte Manifest zu gehen; ein ausgeschriebener Bereich geht
  unverändert raus, wie `docs/architecture.md` es zusagt.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `scripts/makePackageJson/resolveDependencies.mjs`
  - `scripts/makePackageJson/resolveDependencies.test.mjs`
  - `scripts/makePackageJson/findUnpublishableSpecifiers.test.mjs`
  - `package.json` (Root — neue devDependency `semver`)
  - `pnpm-lock.yaml` (Ergebnis des `pnpm add`, mitcommitten)
  - `docs/architecture.md` (§4, die Aufzählung der Auflösungsregeln)
- Verify: `pnpm run ci`
- Commit:

  ```
  fix(scripts): take a workspace: range from the specifier, and only a real one

  A spelled-out workspace: range names the version it wants, so the publish
  manifest takes it straight from the specifier instead of looking the package
  up under packages/ first. Where that package was missing, the root
  manifest's version went out in place of the range the specifier asked for.

  A range semver does not recognize resolves to nothing: the specifier stays,
  and the manifest check refuses a manifest that still carries it. A
  path-shaped specifier such as workspace:../other therefore fails the build
  instead of shipping as a version range.

  semver joins the root devDependencies for validRange.
  ```

- Verlauf:
  - 2026-09-20 Zug 0: Detailplan steht · BUG-096 unverändert an
    `resolveDependencies.mjs:43` (`const range = …`) und `:63` (der
    verschachtelte Ternär) sowie `findUnpublishableSpecifiers.mjs:11` (die
    Präfixprüfung) · BUG-097 unverändert an `resolveDependencies.mjs:60-72`
    (`fs.existsSync`-Zweig plus Root-Fallback), die zugesagte Regel steht an
    `docs/architecture.md:79` · keine offenen `Folgen:` im Plan zu triagieren
    (Paket 1 meldet »Nichts offen«, Pakete 2 bis 4 je »keine«) · von den
    vierzehn Einträgen in »Offene Befunde« teilt keiner die Ursache dieses
    Pakets — alle liegen im Lookbook-CSS oder in `src/map2d/`, dieses Paket
    fasst nur `scripts/` an; alle bleiben liegen · Restplan unverändert ·
    `findUnpublishableSpecifiers.mjs` bleibt im Code unangetastet, nur sein
    Spec wächst (Begründung unter »Abweichungen«) · drei Dateien dazugenommen,
    die der Grobplan nicht nennt: Root-`package.json` und `pnpm-lock.yaml`
    wegen `semver`, `docs/architecture.md` wegen der Regelaufzählung in §4
  - 2026-09-20 Zug 1: Implementierer beauftragt, Modell sonnet, Effort medium,
    Brief `paket-5.impl-1.brief.txt`, Report nach `paket-5.impl-1.json`
  - 2026-09-20 Zug 2: Report `FERTIG`, roter Lauf im Wortlaut dabei (beide neuen
    Tests in `resolveDependencies.test.mjs` fielen vor dem Fix) · sechs Dateien
    geändert: `scripts/makePackageJson/resolveDependencies.mjs`,
    `resolveDependencies.test.mjs`, `findUnpublishableSpecifiers.test.mjs`,
    `package.json`, `pnpm-lock.yaml`, `docs/architecture.md`; keine neuen ·
    Arbeitsbaum jetzt schmutzig · eine Abweichung: `pnpm-lock.yaml` von Hand auf
    den `semver`-Importer-Eintrag reduziert, weil `pnpm add` nebenbei ~40 Zeilen
    Peer-Suffixe umschrieb — Diff jetzt 3 Zeilen,
    `pnpm install --frozen-lockfile --offline` akzeptiert ihn · eigener
    Verify-Lauf `pnpm run ci` exit=0, `paket-5.verify.log`; `test:scripts` 28
    Tests, 5 Suites, 0 fail gegen die Baseline von 25
  - 2026-09-20 Zug 3: Reviewer (Modell sonnet, Effort medium) auf
    `paket-5.diff`, Report `paket-5.review-1.json` · beide Findings behoben,
    kein kritischer und kein wichtiger Befund, zwei kleine
  - 2026-09-20 Zug 4: entfällt — keine Runde, weil nichts Kritisches oder
    Wichtiges offen war
  - 2026-09-20 Zug 5: committet als e7bc31f0, sechs Dateien, ohne zweiten
    Verify-Lauf, weil seit `paket-5.verify.log` (exit=0) keine Zeile Code mehr
    angefasst wurde

## Urteil des Reviewers

- **BUG-096 behoben** — `scripts/makePackageJson/resolveDependencies.mjs:61-73`
  gibt `undefined` zurück, sobald `range === ''` oder
  `validRange(range) == null`; der Specifier bleibt stehen und
  `findUnpublishableSpecifiers.mjs:11` holt ihn ab. Belegt durch
  `resolveDependencies.test.mjs:192-196` (`workspace:../other`,
  `workspace:banana`, `workspace:`) und den dokumentierenden Test
  `findUnpublishableSpecifiers.test.mjs:97-103`.
- **BUG-097 behoben** — der ausgeschriebene Bereich kommt aus
  `resolveDependencies.mjs:58-76` zurück, bevor der `packages/`-Lookup und der
  Root-Fallback (Zeile 89) ihn sehen. Belegt durch
  `resolveDependencies.test.mjs:187-190`. `docs/architecture.md:79` sagt wieder
  die Wahrheit.
- Konventionen eingehalten: keine Finding-ID irgendwo außerhalb von Plan und
  Paketdateien, kein Rückblick auf den Vorzustand in Code oder Doku, Englisch,
  Conventional Commits.

### Kleine Befunde (keine Runde ausgelöst, nicht behoben)

- `scripts/makePackageJson/resolveDependencies.mjs:61` — der Kommentar sagt
  nicht, *warum* `range === ''` vor dem `validRange`-Aufruf steht
  (`validRange('')` liefert `'*'`). Wer den Check für redundant hält und ihn
  wegvereinfacht, läuft in den Test mit `workspace:`; ein halber Satz im
  Kommentar spart diesen Umweg.
- `scripts/makePackageJson/resolveDependencies.mjs:74-75` — zurück geht der
  Rohwert, nicht der von `validRange` normalisierte. `workspace: ^1` mit
  führendem Leerzeichen gilt als gültiger Bereich und ginge mit dem Leerzeichen
  ins Manifest. Konsistent mit »ships as it is«, praktisch ohne Fall im Repo.

## Vorgehen

Beides sind Korrektheitsfehler, also gilt die Reihenfolge: **erst die Tests,
rot sehen, die Ausgabe des roten Laufs in den Report, dann der Code.** Die
schnelle Schleife während der Arbeit ist `pnpm run test:scripts` (`node --test`
über `scripts/**/*.test.mjs`, Laufzeit unter einer Sekunde); Vitest ist an
diesen Dateien nicht beteiligt. Das Gate vor dem Commit bleibt `pnpm run ci`.

Die Baseline zum Vergleich: `pnpm run test:scripts` meldet heute 25 Tests, 5
Suites, 0 fail.

### Schritt 0 — `semver` in die Root-devDependencies

```bash
pnpm add -D -w semver@^7.8.5
```

Erreicht die Registry nicht, geht derselbe Aufruf mit `--offline`: `semver`
liegt in den Versionen 7.8.4 und 7.8.5 bereits im lokalen Store und in
`pnpm-lock.yaml` (als transitive Abhängigkeit, ohne eigene Abhängigkeiten).

Danach steht in der Root-`package.json` unter `devDependencies` alphabetisch
zwischen `rimraf` und `sinon`:

```json
    "semver": "^7.8.5",
```

`semver` gehört **nicht** in den `catalog:`-Block von `pnpm-workspace.yaml`.
Der Katalog trägt Versionen, die sich mehrere Pakete teilen (`three`,
`@types/three`, die spearwolf-Pakete). Hier ist es Werkzeug der Root-Skripte,
genau wie `yaml`, das `makePackageJson.mjs` schon heute so bezieht.

`pnpm-lock.yaml` wird mitcommittet — eine Änderung an `package.json` ohne ihn
ist ein halber Commit. Prettier fasst die Datei nicht an, sie steht in
`.prettierignore`.

### Schritt 1 — die Tests, bevor es etwas zu testen gibt

In `scripts/makePackageJson/resolveDependencies.test.mjs` zwei neue `it(…)` in
das bestehende `describe('resolveDependencies')`. Der vorhandene Helfer
`resolve(section, pnpmWorkspaceConfig, sharedDependencies = {})` reicht für
beide; das Fixture legt in `before()` bereits `packages/other` (Version
`2.3.4-dev`) und `packages/self` an, ein Paket namens `@scope/missing` gibt es
dort bewusst nicht.

**Test 1 — BUG-097.** Direkt hinter den bestehenden Test »a workspace:
dependency with a range ships that range« (heute Zeile 48–50), damit die beiden
Fälle nebeneinander stehen:

```js
  it('a workspace: dependency with a range ships that range even when no package carries the name', () => {
    const section = resolve({'@scope/missing': 'workspace:^2.0.0'}, {}, {'@scope/missing': '^9.9.9'});
    assert.deepEqual(section, {'@scope/missing': '^2.0.0'});
  });
```

Rot sieht das heute so aus: `Expected values to be strictly deep-equal` mit
`{'@scope/missing': '^9.9.9'}` statt `'^2.0.0'` — der Root-Fallback aus Zeile
68 greift, weil `packages/missing/package.json` fehlt.

**Test 2 — BUG-096.** Direkt dahinter:

```js
  it('a workspace: specifier whose range is no version range stays as it is', () => {
    assert.deepEqual(resolve({'@scope/other': 'workspace:../other'}, {}), {'@scope/other': 'workspace:../other'});
    assert.deepEqual(resolve({'@scope/other': 'workspace:banana'}, {}), {'@scope/other': 'workspace:banana'});
    assert.deepEqual(resolve({'@scope/other': 'workspace:'}, {}), {'@scope/other': 'workspace:'});
  });
```

Die erste Assertion ist heute rot: `'../other'` steht im Ergebnis, weil Zeile
63 jeden nicht erkannten Bereich durchreicht. Die zweite ebenso (`'banana'`).
Die dritte ist heute grün und bleibt es — der leere Bereich fällt durch
`if (pkgVersion)` in `resolveDependencies()` heraus, weil `''` falsy ist. Sie
steht trotzdem dabei, weil Schritt 2 genau diesen Pfad verlegt und die Zusage
danach absichtlich statt zufällig gilt.

In `scripts/makePackageJson/findUnpublishableSpecifiers.test.mjs` ein
**dokumentierender** Test — kein Regressionstest, er ist vor und nach der
Änderung grün, und im Report wird für ihn kein roter Lauf behauptet. Er hält
die zweite Hälfte des gewählten Wegs fest: was die Auflösung stehenlässt, holt
der Wächter ab.

```js
  it('names a path-shaped workspace: specifier the resolution left standing', () => {
    const manifest = {dependencies: {'@scope/other': 'workspace:../other'}};

    assert.deepEqual(findUnpublishableSpecifiers(manifest), [
      {section: 'dependencies', name: '@scope/other', specifier: 'workspace:../other'},
    ]);
  });
```

### Schritt 2 — `resolvePackageVersion()` umbauen

In `scripts/makePackageJson/resolveDependencies.mjs`. Der Import kommt zu den
beiden bestehenden dazu, alphabetisch dahinter:

```js
import {validRange} from 'semver';
```

Der Named Import aus dem CJS-Paket funktioniert unter Node ESM, geprüft.

Die Änderung sitzt zwischen dem Alias-Zweig (heute Zeile 44–55, bleibt
unverändert) und dem Paket-Lookup (heute ab Zeile 57). Dort kommt ein neuer
Block hinein:

```js
  if (range !== '*' && range !== '^' && range !== '~') {
    // a spelled-out range names the version it wants; the package under packages/ only
    // supplies one for `*`, `^` and `~`, so it is not looked up for this one
    if (range === '' || validRange(range) == null) {
      // anything else would go into the published manifest as a version range and is none —
      // the specifier stays and the manifest check refuses it
      console.warn('oops.. workspace range is not a version range:', pkgName, '->', specifier, 'referenced from:', referencedFrom);
      return undefined;
    }
    console.log('resolve package version', pkgName, '->', range);
    return range;
  }
```

Zwei Dinge daran sind Absicht und dürfen nicht wegvereinfacht werden:

- `range === ''` steht **vor** dem `validRange`-Aufruf, weil
  `validRange('')` den Wert `'*'` liefert und den leeren Bereich sonst für
  gültig hielte. Geprüft an `semver@7.8.5`.
- `validRange(range) == null` mit doppeltem Gleich, damit `undefined` und
  `null` gleich behandelt werden.

Dahinter wird der Lookup-Block schmaler, weil `range` dort nur noch `'*'`,
`'^'` oder `'~'` sein kann — der verschachtelte Ternär aus Zeile 63 fällt weg:

```js
  const pkgNameWithoutScope = pkgName.replace(/^@[^/]+\//, '');
  const pkgJsonPath = path.resolve(workspaceRoot, `packages/${pkgNameWithoutScope}/package.json`);

  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const version = pkgJson.version.replace(/-dev$/, '');
    const pkgVersion = range === '*' ? `^${version}` : `${range}${version}`;
    console.log('resolve package version', pkgName, '->', pkgVersion);
    return pkgVersion;
  }
```

Der Root-Fallback darunter (heute Zeile 68–72) und die abschließende Warnung
(Zeile 74–75) bleiben, wie sie sind: sie bedienen ab jetzt nur noch `'*'`,
`'^'` und `'~'`, und für die ist der Fallback richtig.

Unangetastet bleiben außerdem der gesamte `catalog:`-Zweig, die Zeile
`const range = …` (heute 43) und die TSDoc über `resolveDependencies()` — sie
sagt »A specifier nothing resolves stays as it is«, und das stimmt nach der
Änderung genauso wie vorher.

`no-console` greift hier nicht: die Regel steht in `eslint.config.mjs` auf
`**/*.{js,ts}`, diese Datei ist `.mjs`. Prettier formatiert sie dagegen sehr
wohl — `printWidth` 130, `singleQuote`, `bracketSpacing: false`. Die lange
`console.warn`-Zeile oben ist 131 Zeichen breit und wird von Prettier
umbrochen; `pnpm run format` vor dem Verify erspart einen roten Lint-Lauf.

### Schritt 3 — `docs/architecture.md` §4

Die Aufzählung der Auflösungsregeln (Zeile 76–81) beschreibt heute drei Fälle
und lässt offen, was mit einem Bereich geschieht, den niemand als Bereich
lesen kann. Der Satz in der Klammer, heute Zeile 78–79:

```
operator, `workspace:*` becomes a caret range, a spelled-out range ships as it is). If a
```

wird zu:

```
operator, `workspace:*` becomes a caret range, a spelled-out range ships as it is — but
only if it is a version range, and anything else leaves the specifier standing). If a
```

Der Folgesatz (»If a `catalog:` or `workspace:` specifier is left in the
manifest afterwards, the build fails«) trägt den Rest bereits und bleibt
unverändert. Zeilenlänge der Datei beibehalten (sie bricht um 88 Zeichen);
Prettier fasst `*.md` nicht an, es steht in `.prettierignore`.

Kein CHANGELOG-Eintrag. `packages/twopoint5d/CHANGELOG.md` führt die
veröffentlichte Oberfläche der Bibliothek; hier ändert sich das Werkzeug, das
das Manifest baut, und kein Manifest im Repository nutzt eine der beiden
betroffenen Formen (`grep '"workspace:' **/package.json` findet genau zweimal
`workspace:*`, in `apps/lookbook` und `packages/twopoint5d-testing`). Der
direkte Präzedenzfall e90de130 — ein Fix an genau diesen Skripten — hat
`docs/architecture.md` und die Skripte angefasst und das CHANGELOG nicht.

### Schritt 4 — Verify

`pnpm run ci` von der Repo-Wurzel, vollständig. `test:scripts` steht darin
zwischen `lintPkg` und `test:ci`. **Niemals** `pnpm publishNpmPkg` oder
`scripts/publishNpmPkg.mjs` ausführen — auch nicht zum Probieren.

## Nebenbefunde und Entscheidungen dieses Zugs

- **Keine offenen `Folgen:` zu triagieren.** Paket 1 meldet »Nichts offen«,
  die Pakete 2, 3 und 4 je »keine«.
- **Kein Eintrag aus »Offene Befunde« kommt mit.** Die vierzehn Einträge
  liegen im Lookbook (CSS, Klassennamen, Import-Stil, Engine-Range) und in
  `packages/twopoint5d/src/map2d/` bzw. `src/stage/`. Dieses Paket fasst
  `scripts/`, die Root-`package.json` und `docs/architecture.md` an; keine
  gemeinsame Ursache, keine gemeinsame Diff-Fläche. Alle bleiben für die
  Drain-Runde liegen.
- **Kein neuer Nebenbefund.** Beide Module wurden ganz gelesen
  (`resolveDependencies.mjs` 76 Zeilen, `findUnpublishableSpecifiers.mjs` 17),
  dazu `scripts/makePackageJson.mjs` als einziger Aufrufer. Was darin auffällt,
  gehört zu den beiden Findings.
- **Restplan unverändert.** Die Pakete 6 bis 9 liegen in
  `packages/twopoint5d/src/display/`, `src/texture/`, `src/stage/` und
  `src/vertex-objects/` — keine Überschneidung mit den Dateien dieses Pakets,
  keine Umsortierung nötig. Die Abhängigkeit von Paket 8 auf Paket 2 ist
  erfüllt (Paket 2 committet als 6369ae7f).
- **`sharedDependencies` wächst um `semver`.** `makePackageJson.mjs:19` baut
  diese Map aus `dependencies` und `devDependencies` der Root-`package.json`.
  Wirksam wird der neue Eintrag nur für ein Paket, das `semver` mit `*` oder
  `workspace:^`/`workspace:~` führt und es nicht unter `packages/` findet —
  kein Paket im Repository tut das.

### Warum `semver` und nicht selbstgebaut

Die Empfehlung zu BUG-096 nennt `semver.validRange` in beiden angebotenen
Varianten. Ein eigener Prüfer müsste Hyphen-Ranges (`1.2.3 - 2.3.4`),
x-Ranges (`1.x`), zusammengesetzte Comparator-Sets (`>=1.2.3 <2.0.0`),
Prerelease-Tags und `||` treffen — das ist semver nachbauen, und ein zu
strenger Nachbau weist einen gültigen Bereich ab. Die Kosten der echten
Abhängigkeit sind klein: `semver@7.8.5` hat keine eigenen Abhängigkeiten,
liegt bereits im Store und in `pnpm-lock.yaml`, ist Dev-Werkzeug der
Root-Skripte und erreicht das veröffentlichte Manifest nicht (das entsteht aus
`packages/twopoint5d/package.json`, nicht aus der Root-Datei).

## Findings im Volltext

**BUG-096 · low · scripts/makePackageJson/resolveDependencies.mjs:43, 63;
findUnpublishableSpecifiers.mjs:11** — Einen pfadförmigen
`workspace:`-Specifier nicht als Versionsbereich veröffentlichen

Ein Specifier wie `workspace:../other` gilt als ausgeschriebener Bereich und
geht als `../other` ins veröffentlichte Manifest. Der Wächter prüft nur das
Präfix `catalog:`/`workspace:` und lässt es durch. Heute nutzt kein Manifest im
Repo diese Form. Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: Einen `range`, der kein gültiger semver-Bereich ist, verwerfen
(Specifier bleibt stehen, der Wächter bricht ab), oder im Wächter zusätzlich
`semver.validRange` prüfen. Test mit `workspace:../x`.

**BUG-097 · low · scripts/makePackageJson/resolveDependencies.mjs:60-72
(vgl. docs/architecture.md:77)** — Einen ausgeschriebenen `workspace:`-Bereich
nicht durch die Root-Version ersetzen

Fehlt das genannte Workspace-Paket unter `packages/`, greift der Root-Fallback
auch für einen ausgeschriebenen Bereich (`workspace:^2.0.0`) und liefert
`sharedDependencies[pkgName]`. `docs/architecture.md` sagt »a spelled-out range
ships as it is«. Aufgefallen im Remediation-Lauf vom 2026-09-19.

Empfehlung: Einen ausgeschriebenen Bereich vor dem Paket-Lookup zurückgeben;
Test für ein fehlendes Paket mit `workspace:^2.0.0`.

## Abweichungen von der Empfehlung des Audits

- **BUG-096: die erste der beiden angebotenen Varianten, nicht die zweite.**
  Die Prüfung sitzt in `resolveDependencies.mjs`, wo feststeht, dass der Wert
  ein aufgelöster Workspace-Bereich ist; `findUnpublishableSpecifiers.mjs`
  bleibt im Code unverändert. Ein `semver.validRange`-Test im Wächter träfe
  jeden Specifier des Manifests und würde Formen abweisen, die npm
  ausdrücklich installiert: `file:../x`, `link:`, `git+https://…`,
  `npm:alias@^1`, Tarball-URLs und Dist-Tags wie `latest` liefern alle `null`.
  Der Wächter ist das grobe Netz am Ende der Kette und soll grob bleiben; die
  Prüfung gehört an die Stelle, die den Wert erzeugt.
- **Die Fundstelle `findUnpublishableSpecifiers.mjs:11` aus BUG-096 bleibt
  damit unberührt** — sie ist die Stelle, die den stehengelassenen Specifier
  abholt, und tut das bereits richtig. Belegt wird das mit dem
  dokumentierenden Test aus Schritt 1.
- **BUG-097 genau wie empfohlen**, mit einer Nebenwirkung, die dazugehört: der
  vorgezogene Rückgabezweig macht den Ternär in Zeile 63 gegenstandslos, weil
  `range` unter dem Lookup nur noch `'*'`, `'^'` oder `'~'` sein kann. Der
  Zweig für ein **vorhandenes** Paket mit ausgeschriebenem Bereich liefert
  denselben Wert wie heute (den Bereich selbst); der bestehende Test »a
  workspace: dependency with a range ships that range« bleibt grün.
