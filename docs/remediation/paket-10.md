# Paket 10 — controls: Nachtrag — den Cursor mit dem Pan zurückgeben und Cursor-Regeln nicht auflaufen lassen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Folge von: Paket 5
- Findings: — (Folgen aus Paket 5, kein Audit-Finding)
- Ziel: Ein Pan, der im Maus-Akkord endet, gibt den Cursor sofort zurück, und das Stylesheet einer Root trägt nur Cursor-Regeln, die ein lebendes `PanControl2D` gerade nutzt — ohne die Klasse je Cursor-Wert aufzugeben, die Paket 5 als Schnittstelle eingeführt hat.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `packages/twopoint5d/src/controls/PanControl2D.ts`
  - `packages/twopoint5d/src/display/Stylesheets.ts`
  - `packages/twopoint5d-testing/test/pan-control-cursor.test.js`
  - `packages/twopoint5d-testing/test/pan-control-dispose.test.js`
  - `packages/twopoint5d-testing/test/stylesheets.test.js`
  - `packages/twopoint5d/CHANGELOG.md` (Abschnitt `## [Unreleased]`)
- Vorgehen: siehe Abschnitt »Vorgehen« unten — Schritte 1 bis 7 in dieser
  Reihenfolge, je Korrektheitsfehler erst der Test, dann der rote Lauf, dann der
  Fix.
- Verify: `pnpm run ci`
- Commit: `fix(twopoint5d): give the cursor back when a pan ends in a mouse chord and keep a cursor rule in the stylesheet only while a pan control shows it`
- Verlauf:
  - 2026-09-19 Zug 0: Detailplan steht (gegen `a25e927`) · Akkord-Cursor
    unverändert (`PanControl2D.ts:501-509`) · Cursor-Regeln unverändert
    (`PanControl2D.ts:270-273`, `Stylesheets.ts:49-76`) · dazu als Symptom
    derselben Ursache zwei CHANGELOG-Sätze, die Paket 5 falsch gemacht hat
    (`CHANGELOG.md:183`, `:187`), und der Kommentar zu Assertion (f) in
    `pan-control-dispose.test.js:69-70` · offene Folge aus Paket 6 (`unpick`
    und `"__proto__"`) als echte Folge nachgestellt und als Paket 11 geschnitten,
    hinter Paket 10 · aus »Offene Befunde« nichts übernommen
  - 2026-09-19 Zug 1: Implementierer beauftragt (sonnet, effort medium), Brief `paket-10.impl-1.brief.txt`, Report nach `paket-10.impl-1.json`
  - 2026-09-19 Zug 2: FERTIG (Report aus `paket-10.impl-1-versuch-2.json`, erster Rückgabetext war nur eine Nachzügler-Bestätigung) · geändert: `PanControl2D.ts`, `Stylesheets.ts`, `pan-control-cursor.test.js`, `pan-control-dispose.test.js`, `stylesheets.test.js`, `CHANGELOG.md` · rote Läufe für Schritt 1, 3, 5 belegt · Arbeitsbaum schmutzig
  - 2026-09-19 Zug 3: Review 1 (sonnet, effort medium) · Akkord-Cursor, Cursor-Regeln, CHANGELOG-Sätze behoben · 0 kritisch, 0 wichtig, 3 klein · Diff `paket-10.diff`, Report `paket-10.review-1.json`
  - 2026-09-19 Zug 4: keine Runde nötig
  - 2026-09-19 Zug 5: `NX_SKIP_NX_CACHE=true pnpm run ci` Exit 0 (`paket-10.verify.log`; erster Lauf `paket-10.verify-cached.log` kam ganz aus dem Nx-Cache und zählt nicht) · Commit 041c420

## Abgleich (Stand `a25e927`)

| Fundstelle | Urteil | Was dort jetzt steht |
| --- | --- | --- |
| Akkord-Zweig in `#onPointerMove` | unverändert | `PanControl2D.ts:501-509`: Kommentar, dann `if (event.pointerType === MOUSE && (event.buttons & this.mouseButton) === 0) { this.#endPointer(event.pointerId, true); }` und getrennt `if (event.pointerType === MOUSE && event.buttons === 0) { this.#restoreCursorStyle(); }`. Im Akkord (`buttons` ≠ 0, Pan-Bit 0) endet der Pan, der Cursor bleibt versteckt, bis der `pointerup` der letzten Taste kommt (`#onPointerUp`, `:435-437`). |
| Cursor-Regel je Wert | unverändert | `PanControl2D.ts:270-273`: `#installCursorPanStyleRules` ruft `Stylesheets.installRule(cursorRuleName(cursor), \`cursor: ${cursor}\`, this.#styleSheetRoot)`; `Stylesheets.ts:49-76` legt je neuem Namen eine Regel an und kennt kein Entfernen; `dispose()` (`PanControl2D.ts:591-601`) gibt keine Regel frei. |
| CHANGELOG `Unreleased` › Fixed, `Stylesheets.installRule()` | durch Paket 5 falsch geworden | `CHANGELOG.md:183`: »The sheet no longer grows by a rule per `Display`, per created container, per fullscreen toggle and per value written to `PanControl2D#cursorPanStyle`« — seit Paket 5 legt `installRule` für jeden neuen Cursor-Wert eine Regel an; der letzte Teil stimmt für `installRule` nicht mehr. |
| CHANGELOG `Unreleased` › Fixed, `PanControl2D#dispose()` | durch Paket 5 falsch geworden | `CHANGELOG.md:187`, letzter Satz: »A write to `cursorPanStyle` on a disposed control does nothing rather than rewriting the cursor rule every control of the module shares« — eine geteilte Regel für alle Controls gibt es seit Paket 5 nicht mehr. |
| `pan-control-dispose.test.js`, Assertion (f) | wird durch dieses Paket falsch | `:69-70`: »has no subject: the control takes no slot from a pool or a factory« — nach diesem Paket leiht sich das Control eine Regel bei `Stylesheets` und gibt sie in `dispose()` zurück. |

## Entscheidungen in Zug 0

1. **Zählung beim Eigentümer der Regel, nicht beim Control.** `Stylesheets`
   bekommt ein Paar `retainRule()` ↔ `releaseRule()`, das je Root und Name die
   Nutzer zählt. Grund: `docs/resource-lifecycle.md` §1 (»What was borrowed is
   given back … Every acquiring call has a releasing counterpart, and
   `dispose()` is the last place to honour the pairing«) und die TSDoc von
   `PanControl2D` selbst nennt das Stylesheet »not its own«. Ein bloßes
   `removeRule()` mit Zählung im Control hätte das Control Regeln aus einem
   fremden Sheet löschen lassen, und zwei Buchhaltungen (Control-Zähler je
   Root, `Stylesheets`-Einträge je Sheet) müssten synchron bleiben.
2. **`installRule()` pinnt.** Eine Regel, die `installRule()` (und damit
   `addRule()`, also `Display`) gelegt hat, verlässt das Sheet nie, auch wenn
   derselbe Name zusätzlich retained und wieder released wird. So ändert sich
   für `Display` nichts, und `releaseRule()` kann keine Regel löschen, auf die
   sich ein `installRule()`-Aufrufer verlässt.
3. **Rein additiv, kein Breaking Change, kein Migration-Guide-Abschnitt.** Zwei
   neue öffentliche Statics; `installRule()`/`addRule()`/`getGlobalSheet()`
   behalten Signatur und Verhalten. Die Klasse je Cursor-Wert
   (`PanControl2D-<kodierter Wert>-<postfix>`) bleibt, wie Paket 5 sie als
   Schnittstelle eingetragen hat.
4. **Akkord: die beiden Maus-Zweige in `#onPointerMove` werden einer.**
   `buttons === 0` ist ein Sonderfall von »Pan-Bit ist 0«; nach
   `#endPointer(event.pointerId, true)` ruft der eine Zweig
   `#restoreCursorUnlessMouseDown()` — dieselbe Rückgabe, die `#onPointerUp`
   und `#onPointerCancel` machen. Der Unterschied zum bisherigen
   `#restoreCursorStyle()` bei `buttons === 0` zeigt sich nur, wenn ein
   *anderer* Maus-Pointer (andere `pointerId`, `pointerType` `'mouse'`) in
   `#pointersDown` steht; Browser führen die Maus unter einer einzigen id, und
   kein Browsertest verwendet für die Maus eine andere id als 1 (geprüft:
   einzige abweichende id ist `7` für Touch in `pan-control-input.test.js:157`).
5. **`unsubscribe()` gibt die Regel nicht zurück**, nur `dispose()`: ein
   Control, das `unsubscribe()` hinter sich hat, kann per `subscribe()`
   zurückkommen und braucht dann seine Regel.
6. **Retain vor Release** beim Wertwechsel: `''` und `'auto'` teilen eine Regel
   (`cursorPanStyle || 'auto'`); zuerst freigeben würde sie aus dem Sheet
   nehmen und sofort neu anlegen.

## Vorgehen

Konventionen aus `./remediation-plan.md` gelten (Englisch in Code, Kommentaren,
Doku; keine Finding-IDs; kein Rückblick auf den Vorzustand in Code, Kommentar,
TSDoc oder CHANGELOG). Browsertests laufen gegen `dist`: für einen roten Lauf
erst `pnpm build:twopoint5d`, dann gezielt
`pnpm --dir packages/twopoint5d-testing exec web-test-runner test/<datei>.test.js`.
Die Ausgabe jedes roten Laufs gehört in den Report.

### Schritt 1 — Regressionstest Akkord (rot sehen)

In `packages/twopoint5d-testing/test/pan-control-cursor.test.js`
`import {on} from '@spearwolf/eventize';` ergänzen und im bestehenden
`describe` einen Fall anlegen:

- `it('a pan that ends in a mouse chord gives the cursor back at once', …)`:
  `const {control, target} = makeControl('grabbing');` · `restoreCursor`
  zählen über `on(control, 'restoreCursor', () => { restores += 1; })` ·
  `pointer('pointerdown', {x: 10, y: 10, buttons: 1})`,
  `pointer('pointermove', {x: 30, y: 10, buttons: 1})` → erwartet
  `target.classList.length` 1 · `pointer('pointermove', {x: 60, y: 10, buttons: 2})`
  (die rechte Taste ist dazugekommen, die linke losgelassen; der Browser meldet
  das als `pointermove`) → erwartet `target.classList.length` 0 und
  `restores` 1 · `pointer('pointermove', {x: 70, y: 10, buttons: 3})` (die
  Pan-Taste geht im Akkord wieder runter; ein Akkord bringt kein `pointerdown`,
  der Pan bleibt vorbei) → `target.classList.length` bleibt 0 ·
  `pointer('pointerup', {x: 90, y: 10, buttons: 0})` → `restores` bleibt 1.
- Vor dem Fix: nach dem Move mit `buttons: 2` ist `classList.length` 1 → rot.

### Schritt 2 — Fix Akkord

`packages/twopoint5d/src/controls/PanControl2D.ts`, `#onPointerMove`
(`:501-509`): die beiden Maus-Zweige zu einem zusammenziehen —

```ts
if (event.pointerType === MOUSE && (event.buttons & this.mouseButton) === 0) {
  this.#endPointer(event.pointerId, true);
  this.#restoreCursorUnlessMouseDown();
}
```

Der Kommentar darüber bleibt inhaltlich (drei Wege, wie die Pan-Taste ohne
`pointerup` hochgeht; die Position dieses Moves zählt nicht) und bekommt einen
Satz dazu: der Cursor geht mit dem Pan zurück, wie bei einem `pointerup`, und
auch der Fall ohne jede Taste (`buttons === 0`) läuft hier durch. Grund für das
Zusammenziehen: Entscheidung 4 oben. Schritt 1 grün sehen; die bestehenden
Fälle in `pan-control-input.test.js` (`reports restoreCursor only for a cursor
it hid`, `a pan button let go during a drag ends the pan where it was let go`)
bleiben grün.

### Schritt 3 — Tests für `Stylesheets.retainRule()`/`releaseRule()` (rot sehen)

In `packages/twopoint5d-testing/test/stylesheets.test.js`, im bestehenden
`describe('Stylesheets', …)`, mit den vorhandenen Helfern `uniqueName`,
`ruleCount`, `findRule`, `makeShadowRoot`. Jeder Fall mit Regelzählung arbeitet
in einer eigenen Shadow-Root, damit die Zahl exakt ist:

- `a rule retained twice stays until it is released twice` — `root =
  makeShadowRoot()`; `className = Stylesheets.retainRule(name, 'cursor: pointer;', root)`
  zweimal; `releaseRule(name, root)` → `findRule(className, root)` existiert;
  noch ein `releaseRule(name, root)` → existiert nicht, `ruleCount(root)` 0.
- `releasing a rule leaves the rules after it in place` — `retainRule(a, 'cursor: pointer;', root)`,
  `classNameB = retainRule(b, 'cursor: crosshair;', root)`, `releaseRule(a, root)`
  → `ruleCount(root)` 1, `findRule(classNameB, root)?.style.cursor` `'crosshair'`.
- `a rule installRule put there stays after its last release` —
  `installRule(name, 'cursor: pointer;', root)`, `retainRule(name, 'cursor: pointer;', root)`,
  `releaseRule(name, root)` → Regel existiert, `ruleCount(root)` 1.
- `a release without a retain changes nothing` — in einer frischen Shadow-Root
  `releaseRule(uniqueName('never-retained'), root)` wirft nicht und legt kein
  Sheet an (`root.querySelector('style')` ist `null`); in einer zweiten Root:
  `retainRule(name, …, root)`, zweimal `releaseRule(name, root)` → der zweite
  Aufruf wirft nicht, `ruleCount(root)` 0.
- `a retain with a different css rewrites the rule` — `retainRule(name, 'cursor: pointer;', root)`,
  `className = retainRule(name, 'cursor: crosshair;', root)` → `ruleCount(root)` 1,
  `findRule(className, root)?.style.cursor` `'crosshair'`.
- `retainRule returns the class name installRule returns for the name` —
  `retainRule(name, css)` und `installRule(name, css)` liefern denselben String.

Vor dem Fix rot mit `Stylesheets.retainRule is not a function` (neue API; das
ist der erwartete rote Lauf für diesen Schritt).

### Schritt 4 — `Stylesheets` zählt die Nutzer einer Regel

`packages/twopoint5d/src/display/Stylesheets.ts`:

1. Den Eintrag je Regel erweitern (`:10-12`): ein Interface
   `InstalledRule {rule: CSSStyleRule; css: string; users: number; pinned: boolean}`
   (modul-intern, nicht exportiert), `installedRules` als
   `WeakMap<CSSStyleSheet, Map<string, InstalledRule>>`. Kommentar: `users`
   zählt die `retainRule()`-Aufrufe ohne ihr `releaseRule()`, `pinned` heißt,
   `installRule()` hat die Regel gelegt und sie bleibt für immer.
2. Den bisherigen Rumpf von `installRule` (Sheet holen, Map anlegen,
   vorhandene Regel mit gleichem `css` zurückgeben bzw. per
   `rule.style.cssText` umschreiben, sonst `insertRule` am Ende) in eine
   modul-interne Funktion `putRule(name: string, css: string, root: HTMLElement | ShadowRoot): InstalledRule`
   ziehen; ein neuer Eintrag startet mit `users: 0, pinned: false`. Der
   Klassenname bleibt `` `${name}-${postFixID}` ``.
3. `installRule(name, css, root = document.head): string` — `putRule(…).pinned = true;`
   dann den Klassennamen zurückgeben. TSDoc um einen Satz ergänzen: eine hier
   gelegte Regel bleibt für immer im Sheet, `releaseRule()` nimmt sie nicht
   heraus.
4. Neu, direkt nach `installRule`:
   `static retainRule(name: string, css: string, root: HTMLElement | ShadowRoot = document.head): string`
   — `putRule(…).users += 1;` Klassennamen zurückgeben. TSDoc: installiert die
   Regel wie `installRule()` (ein Name trägt je Root genau eine Regel, ein
   anderes `css` schreibt sie um) und zählt einen Nutzer mehr; jeder Aufruf wird
   mit einem `releaseRule()` gepaart, sobald der Nutzer die Klasse nicht mehr
   zeigt; `@returns` derselbe Klassenname, den `installRule()` für den Namen
   liefert.
5. Neu: `static releaseRule(name: string, root: HTMLElement | ShadowRoot = document.head): void`
   — `const sheet = sheets.get(root)` (nicht `getGlobalSheet()`: ein Release ist
   kein Grund, ein Sheet anzulegen); kein Sheet, kein Eintrag oder
   `users === 0` → zurück, ohne zu werfen. Sonst `users -= 1`; ist danach
   `users > 0` oder `pinned`, zurück. Sonst den Index der Regel per
   `Array.from(sheet.cssRules).indexOf(installed.rule)` suchen, bei `>= 0`
   `sheet.deleteRule(index)`, und den Eintrag aus der Map löschen (ein späteres
   `retainRule()` legt die Regel neu an). TSDoc: gibt eine per `retainRule()`
   genommene Regel zurück; gibt der letzte Nutzer sie zurück, verlässt sie das
   Sheet, außer `installRule()` hat sie ebenfalls gelegt; ein Release ohne
   offenen Retain oder in einer Root, in die dieses Modul nie geschrieben hat,
   tut nichts. Kommentar an der Index-Suche: der Index wird beim Löschen
   gesucht, weil andere Regeln davor eingefügt oder entfernt worden sein
   können.
6. `addRule()` und `getGlobalSheet()` bleiben unverändert (`addRule` läuft über
   `installRule` und pinnt damit).

Schritt 3 grün sehen; die vier bestehenden Fälle der Datei bleiben grün.

### Schritt 5 — Tests: Cursor-Regeln kommen zurück (rot sehen)

In `packages/twopoint5d-testing/test/pan-control-cursor.test.js`
`Stylesheets` mit importieren und einen zweiten `describe` anlegen,
`describe('PanControl2D — the cursor rules it keeps in the stylesheet', …)`,
mit eigener Shadow-Root je Fall (Host an `document.body`, im `afterEach`
entfernt; Controls im `afterEach` disposed). Helfer:

```js
function cursorRules(root) {
  return Array.from(Stylesheets.getGlobalSheet(root).cssRules).filter((rule) =>
    rule.selectorText?.startsWith('.PanControl2D-'),
  );
}
```

Controls je Fall: `new PanControl2D({state: makeState(), cursorStylesTarget: target, coordsTarget: target, styleSheetRoot: root, cursorPanStyle})`,
`target` ein `div` mit 100×100 px in der Shadow-Root.

- `a control that writes one cursor style after another keeps only the rule of the current one`
  — Control `'grab'`, dann `cursorPanStyle = 'move'`, dann `'crosshair'` →
  `cursorRules(root).length` 1, `cursorRules(root)[0].style.cursor`
  `'crosshair'`. Vor dem Fix 3 → rot.
- `a rule two controls show stays until the last of them is disposed` — zwei
  Controls `'grabbing'` → 1 Regel; erstes `dispose()` → 1 Regel; zweites
  `dispose()` → 0. Vor dem Fix 1 nach beiden → rot.
- `a control that moves off a style leaves the rule to the control still showing it`
  — A und B `'grabbing'`; `pointer('pointerdown', {x: 10, y: 10})`,
  `pointer('pointermove', {x: 20, y: 10})`; `B.cursorPanStyle = 'move'` →
  `getComputedStyle(targetA).cursor` `'grabbing'`, `getComputedStyle(targetB).cursor`
  `'move'`, `cursorRules(root).length` 2. Wächter (auch vor dem Fix grün, im
  Report so benennen).

In `packages/twopoint5d-testing/test/pan-control-dispose.test.js`
(Assertion (d) und (f) nach `docs/resource-lifecycle.md` §8): `Stylesheets`
mit importieren, den Kommentar zu Assertion (f) (`:69-70`) ersetzen — sie hat
jetzt ein Subjekt: die Cursor-Regel, die das Control bei `Stylesheets` retained
— und einen Fall anlegen:

- `gives its cursor rule back, and only once` — `Stylesheets.releaseRule`
  per Hand umhüllen (die Testumgebung hat kein sinon): Original merken,
  `Stylesheets.releaseRule = (...args) => { calls.push(args); return release.apply(Stylesheets, args); }`,
  im `finally` zurücksetzen. `control = new PanControl2D({state: makeState(), cursorPanStyle: 'grabbing'})`,
  `control.dispose()` zweimal → `calls.length` 1, `calls[0][0]`
  `'PanControl2D-grabbing'`, `calls[0][1]` `document.head`. Vor dem Fix 0 → rot.

`build:twopoint5d` zwischen Schritt 4 und dem roten Lauf hier nicht
vergessen: die neuen Statics müssen im `dist` stehen, sonst ist der rote Lauf
ein `TypeError` statt der fehlenden Freigabe.

### Schritt 6 — `PanControl2D` leiht die Cursor-Regel und gibt sie zurück

`packages/twopoint5d/src/controls/PanControl2D.ts`:

1. Neben `#cursorPanClass` (`:177`) ein Feld `#cursorPanRuleName?: string` —
   der Name der Regel, die dieses Control gerade bei `Stylesheets` hält.
2. `#installCursorPanStyleRules` (`:270-273`) entfällt. Der Setter
   `cursorPanStyle` (`:250-268`) macht bei geändertem Wert: vorigen
   Klassennamen **und** vorigen Regelnamen merken; `#cursorPanStyle = value`;
   `const cursor = value || 'auto';` `#cursorPanRuleName = cursorRuleName(cursor)`;
   `#cursorPanClass = Stylesheets.retainRule(this.#cursorPanRuleName, \`cursor: ${cursor}\`, this.#styleSheetRoot)`;
   der Klassentausch am Target wie bisher; **danach**, falls ein voriger
   Regelname da ist, `Stylesheets.releaseRule(prevRuleName, this.#styleSheetRoot)`.
   Kommentar an der Reihenfolge: erst die neue Regel nehmen, dann die alte
   zurückgeben — `''` und `'auto'` teilen eine Regel, und andersherum verließe
   sie das Sheet, um sofort neu angelegt zu werden. `Stylesheets.retainRule`
   und `Stylesheets.releaseRule` als statische Aufrufe über die Klasse, nicht
   über eine lokale Kopie (der Dispose-Test aus Schritt 5 umhüllt die Static).
3. `dispose()` (`:591-601`): nach `super.dispose()` und vor `off(this)` —
   `if (this.#cursorPanRuleName != null) { Stylesheets.releaseRule(this.#cursorPanRuleName, this.#styleSheetRoot); this.#cursorPanRuleName = undefined; }`.
   Kommentar: nach `super.dispose()`, weil die Cursor-Klasse dann schon vom
   Target ist (über `unsubscribe()` → `#restoreCursorStyle()`), und kein
   Element auf eine Regel zeigt, die das Sheet verlässt. `unsubscribe()` gibt
   die Regel nicht zurück (Entscheidung 5).
4. TSDoc angleichen:
   - Setter `cursorPanStyle` (`:239-249`): nach »a write moves only this
     control onto another rule« den Satz, dass das Control die vorige Regel
     zurückgibt und eine Regel, die kein lebendes Control mehr zeigt, das
     Stylesheet verlässt. Der Absatz zum disposed Control bleibt, mit
     »retains no more rules« statt »installs no more rules«.
   - `dispose()` (`:571-590`): ein Satz, dass `dispose()` die Cursor-Regel
     zurückgibt; sie bleibt im Stylesheet, solange ein anderes Control in
     derselben Root denselben Stil zeigt. Der Satz »A write to
     `cursorPanStyle` is refused: a disposed control installs no more rules
     into a stylesheet that is not its own« entsprechend mit »retains«.

Schritt 5 grün sehen; `pan-control-stylesheet-root.test.js` und die übrigen
`pan-control-*.test.js` bleiben grün.

### Schritt 7 — CHANGELOG (Skill `updating-changelog`)

`packages/twopoint5d/CHANGELOG.md`, nur `## [Unreleased]`:

- `### Added` (ab `:10`): ein Eintrag für `Stylesheets.retainRule()` und
  `Stylesheets.releaseRule()` — eine Regel, die mehrere Nutzer teilen, gezählt
  je Root; sie verlässt das Stylesheet, wenn der letzte Nutzer sie zurückgibt,
  außer `installRule()` hat sie ebenfalls gelegt.
- `### Changed`, `:141` (»every cursor style of `PanControl2D` has a style rule
  of its own …«): ergänzen, dass eine Cursor-Regel nur im Stylesheet steht,
  solange ein Control sie zeigt — ein Write auf `cursorPanStyle` und
  `dispose()` geben die Regel des Controls zurück.
- `### Fixed`, `:183` (`Stylesheets.installRule()`): den Teil »and per value
  written to `PanControl2D#cursorPanStyle`« streichen; das beschreibt jetzt
  der Eintrag aus `:141`.
- `### Fixed`, `:187` (`PanControl2D#dispose()`): den letzten Satz so fassen,
  dass ein disposed Control keine Regeln mehr aus einem Stylesheet nimmt, das
  nicht seins ist, und dass `dispose()` die Cursor-Regel des Controls
  zurückgibt — ohne die geteilte Regel »every control of the module shares«.
- `### Fixed`, `:224` (Pointer-Handling von `PanControl2D`): am Ende ergänzen,
  dass der Cursor dort mit zurückkommt, wo die Pan-Taste im Akkord hochgeht.

Kein Migration-Guide-Abschnitt (Entscheidung 3). Formulierungen ohne
Rückblick (»no longer«, »now«) in den neuen und geänderten Sätzen.

## Fundstellen im Volltext

Aus dem Plan, `Folgen:` unter Paket 5 und Block von Paket 10:

**Akkord-Cursor · low · `packages/twopoint5d/src/controls/PanControl2D.ts:504-506`**
— der Akkord-Zweig in `#onPointerMove` beendet den Pan mit
`#endPointer(event.pointerId, true)`, sobald die Pan-Taste losgelassen ist und
eine andere Taste unten bleibt, gibt den Cursor aber nicht zurück; das tut erst
der Zweig `buttons === 0` (`:507-509`). Bis alle Tasten oben sind, bleibt der
Cursor versteckt, obwohl nichts mehr schwenkt und die Pan-Taste den Pan nicht
wieder aufnimmt (ein Akkord löst kein `pointerdown` aus) — `#onPointerUp` und
`#onPointerCancel` rufen dafür `#restoreCursorUnlessMouseDown()`.
Einordnung: Symptom — Paket 5 hat das Ende eines Pointers sauber gemacht und
die Cursor-Rückgabe an einem der drei Wege nicht mitgenommen.

**Cursor-Regeln laufen auf · low · `packages/twopoint5d/src/controls/PanControl2D.ts:270-273` mit `packages/twopoint5d/src/display/Stylesheets.ts:49-76`**
— `#installCursorPanStyleRules` legt je Cursor-Wert eine Regel
`PanControl2D-<kodierter Wert>` in der Root an; weder ein Wertwechsel noch
`dispose()` gibt eine frei, und `Stylesheets` kennt kein Entfernen. Laufend
wechselnde Werte (`url(...)` mit Query) lassen das Stylesheet der Root ohne
Grenze wachsen.
Einordnung: echte Folge — die Regel je Cursor-Wert ist mit Paket 5 neu; davor
schrieb jede Root eine einzige Regel `PanControl2D` um
(`git show b7dd540:packages/twopoint5d/src/controls/PanControl2D.ts`, Zeile 204).

Bezugs-Findings aus Paket 5 (behoben, nur Kontext):

**BUG-085 · medium** — pointercancel behandeln und eine bereits gedrückte
pointerId neu verankern. Empfehlung u. a.: »in `#onPointerMove` bei
`pointerType === MOUSE && buttons === 0` den Eintrag ebenfalls löschen«.

**BUG-087 · low** — Zwei PanControl2D-Instanzen nicht gegenseitig die
Cursor-Regel überschreiben lassen. Empfehlung: »Den Regelnamen vom Wert
ableiten: ``Stylesheets.installRule(`PanControl2D-${slug(this.#cursorPanStyle)}`, …)``,
damit jeder Cursor-Stil eine eigene Klasse bekommt«.

## Triage in Zug 0

- Offene Folge aus Paket 6 (`packages/twopoint5d/src/utils/unpick.ts:9`,
  `result[key] = o[key]` mit einem eigenen Key `"__proto__"`): **echte Folge**,
  nachgestellt — vor dem Lauf (`git show e352b56:packages/twopoint5d/src/utils/unpick.ts`)
  baute `unpick` das Ergebnis mit `Object.fromEntries`, das `"__proto__"` als
  eigene Datenproperty anlegt; seit `a25e927` setzt die Zuweisung den Prototyp
  des Ergebnisses (Node: `unpick(JSON.parse('{"__proto__": {"polluted": 1}, "a": 2}'))`
  hat danach kein eigenes `"__proto__"` und erbt `polluted`). Eigene Ursache
  (Zuweisung statt Definition), andere Datei, anderes Modul → nicht in dieses
  Paket, sondern Paket 11 im Plan, `Folge von: Paket 6`, hinter Paket 10.
- »Offene Befunde«: kein Eintrag mit derselben Ursache. Der einzige in dieser
  Datei, `PanControl2D.ts:286` (`#isFirstPanViewUpdate` im `panView`-Setter),
  betrifft das erste `update`-Event, nicht Cursor oder Pointer-Ende → bleibt in
  der Queue.

## Urteil des Reviewers (Review 1)

- Akkord-Cursor: behoben — `PanControl2D.ts:513-516`, ein Maus-Zweig, nach `#endPointer` `#restoreCursorUnlessMouseDown()`; Test `a pan that ends in a mouse chord gives the cursor back at once` in `pan-control-cursor.test.js`
- Cursor-Regeln: behoben — `Stylesheets.ts:27` (`putRule`), `:88` (`installRule` pinnt), `:106` (`retainRule`), `:120` (`releaseRule`); `PanControl2D.ts:258-279` (Setter, Retain vor Release), `:611-614` (`dispose()` gibt genau einmal zurück)
- CHANGELOG: `CHANGELOG.md:32` (Added), `:142` (Changed), `:184`, `:188`, `:225` (Fixed); Kommentar zu Assertion (f) in `pan-control-dispose.test.js:69-71`, Test `gives its cursor rule back, and only once` ab `:204`

Kleine Befunde (keine Runde):
- Entscheidung 5 (`unsubscribe()` gibt die Regel nicht zurück) hat keinen Test
- `Stylesheets.ts:125`: `sheet == null || rules == null` neben `installed == null` redundant (dient dem Typ-Narrowing)
- `CHANGELOG.md:225`: das angehängte »and the cursor comes back with it« macht den Bezug von »it« unscharf

## Anmerkungen aus dem Report

- Abweichungen: `putRule` nutzt einen Helfer `classNameOf(name)`; die Paketdatei nennt `resource-lifecycle.md` §8, die Tests stehen dort in §7; vier bestehende `[Unreleased]`-Bullets auf Anweisung von Schritt 7 umformuliert, gegen die Grundregel des Skills `updating-changelog`
- Nebenbefunde, Urteile: `addRule()`-TSDoc und `dispose()`-TSDoc sowie die Abschnittszählung in `resource-lifecycle.md` sind Doku, keine Korrektheitsdefekte → Audit (DOC); die Deprecation-Diagnosen zu `keyCodes`/`keyCode` (`PanControl2D.ts:228`, `:543-544`) sind gewollt (Entscheidung zum `keyCodes`-Fallback) und kein Befund
