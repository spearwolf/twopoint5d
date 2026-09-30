# Paket 2 — Lint- und Typecheck-Gates schärfen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: TYPE-003 (low), TYPE-022 (low), CFG-001 (low), TYPE-001 (low), TYPE-021 (low)
- Dazu aus Paket 1 (Folgen, Symptome seines eigenen Diffs): zwei Kommentarabsätze, die
  über die Umbruchbreite laufen — `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs:14–22`
  und `packages/twopoint5d/tsconfig.build.json:6–7`
- Ziel: ESLint hält `any` im veröffentlichten Library-Code und unbehandelte Promises in
  `packages/*/src` an und sagt neben der Regel, warum `!` erlaubt bleibt; `scripts/` läuft
  als eigenes Nx-Projekt durch einen `checkJs`-Typecheck; die öffentlichen Typen von
  `Dependencies` und die Signatur von `readOption` tragen kein `any` mehr.
- Modell: mittlere Stufe
- Effort: medium
- Dateien:
  - `eslint.config.mjs`
  - `packages/twopoint5d/src/utils/Dependencies.ts`, `…/utils/Dependencies.spec.ts`
  - `packages/twopoint5d/src/controls/readOption.ts`, neu `…/controls/readOption.spec.ts`
  - `packages/twopoint5d/src/texture/TextureResource.ts` (Zeile 938)
  - `packages/twopoint5d/src/vertex-objects/VertexObjects.ts` (Zeile 22)
  - neu `scripts/tsconfig.json`, neu `scripts/project.json`
  - die 18 Dateien unter `scripts/` mit Typfehlern (Liste in Schritt 5)
  - `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs`,
    `packages/twopoint5d/tsconfig.build.json` (nur Umbruch)
  - `AGENTS.md`, `docs/architecture.md`, `packages/twopoint5d/CHANGELOG.md`
- Verify: `pnpm run ci`
- Commit: `fix: type the callbacks of a Dependencies declaration by the value of their key and let readOption answer in the type of the option it reads and take the default for an option passed as null, hold the published library code to no-explicit-any and the library sources to no-floating-promises and no-misused-promises, say beside the rule why a non-null assertion stays allowed, drop the eslint config block that had no effect, type-check scripts/ as JavaScript through an Nx project of its own, and rewrap two comments that outgrew their width`
- Verlauf:
  - 2026-09-30 Zug 0: Detailplan steht · TYPE-003, TYPE-022, CFG-001, TYPE-001, TYPE-021
    unverändert · Rückfrage zu `no-non-null-assertion` → bleibt aus, mit Grund
    (»Entscheidungen«) · Folge README.md:60 → Paket 8 samt Queue-Eintrag signalize · Folgen
    `findUndeclaredImports.mjs:14–22`, `tsconfig.build.json:6–7` → Paket 2 · Plan: Paket 3
    hängt jetzt an 2, Paket 9 an 2
  - 2026-09-30 Zug 1: Implementierer beauftragt (sonnet, effort medium), Report nach
    `paket-2.impl-0.json`
  - 2026-09-30 Zug 2: Report FERTIG · 32 Dateien (29 geändert, neu `readOption.spec.ts`,
    `scripts/tsconfig.json`, `scripts/project.json`) · Arbeitsbaum schmutzig · Verify exit=0 (`paket-2.verify.log`)
  - 2026-09-30 Zug 3: Reviewer (opus, medium) · alle fünf Findings und beide Umbrüche erfüllt · 3
    wichtig (architecture.md:318 »So does«-Bezug, AGENTS.md:22–23 und :55–57 Umbruch), 8 klein ·
    Diff `paket-2.diff`, Report `paket-2.review-0.json`
  - 2026-09-30 Zug 4 Runde 1: offen 3 wichtig + 7 klein → derselbe Implementierer (resume, sonnet,
    medium), Report nach `paket-2.impl-1.json`
    · zurück: FERTIG, 9 Dateien nachgezogen · Verify exit=0 (`paket-2.verify-1.log`) · Reviewer
    gezielt (opus, medium), Diff `paket-2.r1.diff`
    · Urteil: alle elf Vorbefunde erledigt, drei neue klein (Fortschritt, Kette endet)
  - 2026-09-30 Zug 5: Commit 576d3fc6 (32 Dateien, Trailer Remediation-Run) · Verify
    `paket-2.verify-1.log` exit=0 · Arbeitsbaum sauber

## Reviewer-Urteil

Review in zwei Durchgängen (`paket-2.review-0.json`, nach Runde 1 `paket-2.review-1.json`).

- TYPE-003 · behoben · `eslint.config.mjs:75–81` (`no-explicit-any: error` für den
  veröffentlichten Library-Code), Begründungen für `any` und `!` in `:34–41`, gezielter
  Disable mit Grund in `VertexObjects.ts:22–25`, TSDoc der Klasse weiter vor
  `export declare class` im `.d.ts`
- TYPE-022 · behoben · `eslint.config.mjs:82–92` (`no-floating-promises`,
  `no-misused-promises` mit `projectService`), `TextureResource.ts:938` `void (async …)`,
  `scripts/tsconfig.json` und `scripts/project.json` neu, `nx run scripts:typecheck` grün
- CFG-001 · behoben · der wirkungslose Block `{files: ['**/*.{js,ts}']}` ist aus
  `eslint.config.mjs` entfernt, Liste der gelinteten Dateien vorher/nachher identisch
  (399)
- TYPE-001 · behoben · `Dependencies.ts:1–20` Callbacks als Methoden mit `T = unknown`,
  `DependencyDeclaration` bindet an `Shape[K]` (`:42–55`), kein `any` in den öffentlichen
  Typen; Negativfälle in `Dependencies.spec.ts:108–118`
- TYPE-021 · behoben · `readOption.ts:1–15` mit `NonNullable<O[K]>` und `!= null`,
  `readOption.spec.ts` deckt den `null`-Fall und die Typebene ab
- Umbrüche aus Paket 1 · behoben · `findUndeclaredImports.mjs:17–19`,
  `tsconfig.build.json:4–8`

Kleine Befunde (ohne Runde):

- `AGENTS.md:50` — verwaiste Zeile »whether«, vorbestehend → Queue
- `docs/architecture.md:318–319` — »as« / »well:« ausgefranst umbrochen → Folge im Plan
- `docs/architecture.md:316–319` — »leaves them out« bezieht die drei Specs nur über »as
  well« ein → Folge im Plan
- `scripts/checkDocSnippets/extractSnippets.mjs` — `@typedef` einzeilig mit 108 Zeichen →
  Folge im Plan
- `VertexObjects.ts` — `eslint-disable-next-line` mit 93 Zeichen; die Direktive muss
  einzeilig sein, bleibt
- `Dependencies.ts:6`, `:41` — 91 Zeichen, innerhalb »rund 90«, bleibt
- `CHANGELOG.md:911–913` — »see the next section« hängt an der Reihenfolge → Folge im Plan

## Entscheidungen, die dieses Paket trägt

- **`no-non-null-assertion` bleibt aus** (Nutzer, 2026-09-30, steht in »Entscheidungen«).
  Die Probe mit der Regel auf `error` ergab 240 Treffer im veröffentlichten Code über 30
  Dateien. 166 davon sind `arr[i]!`, das Idiom unter `noUncheckedIndexedAccess`, nur 38
  liegen in den generierten Accessoren, dazu kommen 1.193 in den Specs. Die Regel bleibt
  deshalb auf `0`, und der Kommentar daneben nennt `noUncheckedIndexedAccess` als Grund.
  Ein gezielter Disable in `createVertexObjectPrototype.ts` entfällt damit.
- **`no-explicit-any` gilt für den veröffentlichten Library-Code**, also
  `packages/*/src/**/*.ts` ohne `**/*.spec.ts`, `**/*.bench.ts` und
  `packages/*/src/testing/**` (Nutzer, 2026-09-30). Dort gibt es 8 Treffer: 6 in
  `Dependencies.ts`, die Schritt 2 beseitigt, und 2 in `VertexObjects.ts:22`, die einen
  gezielten Disable bekommen (Schritt 4). Die Specs behalten ihre 288 `any`, davon 273 ×
  `renderer as any` in den Stage-Specs.
- **Die Promise-Regeln gelten für ganz `packages/*/src/**/*.ts`, die Specs eingeschlossen.**
  Die Probe fand in den Specs 0 Treffer und im Library-Code einen einzigen
  (`TextureResource.ts:938`). In einer Spec bedeutet eine nicht abgewartete Assertion einen
  Test, der nichts prüft, deshalb gehören die Specs mit hinein. Beide Regeln brauchen
  Typinformation, die `projectService` liefert. Die Probe lief über `packages/twopoint5d/src`
  in 6,7 s.
- **`scripts/` wird mit `checkJs` geprüft, bei `strict` und mit `noImplicitAny: false`.**
  Mit `noImplicitAny` ergab die Probe 220 Fehler, 165 davon nur fehlende JSDoc-Typen an
  Parametern und Test-Callbacks. Ohne die Option bleiben 55 Fehler, alle aus
  `strictNullChecks`, `useUnknownInCatchVariables` und der Inferenz von Array-Literalen,
  also Stellen, an denen der Check wirklich etwas sagt. Das Browser-Test-Projekt hat einen
  Präzedenzfall dafür: `packages/twopoint5d-testing/tsconfig.json` prüft ebenfalls mit
  `checkJs`, dort sind `noImplicitAny` und `strictNullChecks` aus. Für `scripts/` bleibt
  `strictNullChecks` an, weil die Publish-Pipeline genau davon lebt. `semver` hat keine
  Typen und bleibt deshalb ungetypt (`any`), dafür braucht es kein `@types/semver`.
- **`scripts/` wird ein eigenes Nx-Projekt** (`scripts/project.json`, Name und Tag
  `scripts`, nur das Target `typecheck`). `pnpm typecheck` ist `nx run-many -t typecheck`
  und nimmt das Target damit von selbst mit. `docs/architecture.md` §1 verlangt für jedes
  neue Projekt mindestens einen Tag. Die Alternative, ein `package.json` in `scripts/`,
  scheidet aus: es läge neben Skripten, die ihr Wurzelverzeichnis aus dem eigenen Pfad
  ableiten, und machte `scripts/` zu einem Paket. Für `nx:run-commands` übernimmt Nx
  weder `script` noch `cache` aus den `targetDefaults` von `typecheck` (anderer Executor),
  deshalb stehen beide Angaben ausdrücklich im Target.
- **`readOption` folgt der Empfehlung wörtlich** (`NonNullable<O[K]>`, Prüfung auf
  `!= null`). Damit nimmt eine Option, die als `null` übergeben wird, den Default, so wie
  eine weggelassene. Heute wird `null` durchgereicht, und `speed: null` ergibt
  `pixelsPerSecond = null`. Den Typen nach kann das nur ein JavaScript-Aufrufer, denn
  `PanControl2DOptions` kennt kein `null`. Die Variante mit `Exclude<O[K], undefined>`
  bräuchte an der Rückgabe einen Cast. Die Verhaltensänderung bekommt eine
  CHANGELOG-Zeile (Schritt 3).
- **`Dependencies`: Callbacks werden als Methoden deklariert.** Mit
  `EqualityCallback<Shape[K]>` als Funktionstyp (so die Empfehlung) kompiliert die
  untypisierte Form nicht mehr, die der eigene Spec (`Dependencies.spec.ts:38–42`) und der
  CHANGELOG zeigen: ohne Typargument ist jeder Wert `unknown`, und unter
  `strictFunctionTypes` passt `(a: number, b: number) => boolean` nicht auf
  `(a: unknown, b: unknown) => boolean`. Methodenparameter vergleicht TypeScript in beide
  Richtungen. Ein Callback für einen engeren Typ passt deshalb auf `unknown`, einer für
  einen fremden Typ (`Vector2` an einem `Matrix4`-Schlüssel) passt in keine Richtung. Die
  Probe im Scratchpad hat alle Fälle aus Schritt 2 gegen `three` bestätigt.

## Vorgehen

Pfade relativ zum Repo-Root. Arbeitsverzeichnis für Zwischenstände:
`/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad`
(im Folgenden `$ARBEITSDIR`), nichts davon ins Repo.

### 1. Den wirkungslosen Block aus `eslint.config.mjs` entfernen

1. Vorher die Liste der gelinteten Dateien festhalten:
   `pnpm exec eslint -f json . | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).map(r=>r.filePath).sort().join('\n')))" > $ARBEITSDIR/paket-2.eslint-files-before.txt`
2. Den Eintrag `{files: ['**/*.{js,ts}']}` (heute `eslint.config.mjs:13–15`) löschen.
3. Dieselbe Liste nach `…-after.txt` schreiben; `diff` der beiden Dateien muss leer sein.
   Die `.ts`-Dateien bleiben drin, weil `tseslint.configs.recommended` und der Block
   `**/*.{js,ts,astro}` sie selbst nennen. Ergebnis und Zeilenzahl kommen in den Report.

### 2. `Dependencies`: die Callbacks an den Werttyp ihres Schlüssels binden

Zuerst rot: in `packages/twopoint5d/src/utils/Dependencies.spec.ts`, im Test `'a
declaration that spells out its key is held against the shape'` (heute Z. 90–105), hinter
den vorhandenen Direktiven einfügen (Imports `Matrix4`, `Vector3` aus `three/webgpu`
ergänzen):

```ts
// @ts-expect-error an equals written for another value type does not fit the key
expect(new Dependencies<{m: Matrix4}>([['m', (a: Vector2, b: Vector2) => a.equals(b)]])).toBeDefined();

// @ts-expect-error the same for callbacks brought as an object
expect(new Dependencies<{m: Matrix4}>([['m', {equals: (a: Vector2, b: Vector2) => a.equals(b)}]])).toBeDefined();

// @ts-expect-error complete callbacks have to fit a value type of the shape
expect(new Dependencies<{m: Matrix4}>([Dependencies.cloneable<Vector3>('m')])).toBeDefined();
```

Dazu ein Positivfall, der ohne Direktive kompilieren muss (die Form aus dem CHANGELOG):
`new Dependencies(['centerX', Dependencies.cloneable<Matrix4>('matrixWorld')])`. Der
Testname darf sich weiten, etwa `'… is held against the shape, its callbacks against the
value of its key'`. Die Zeilen umbrechen, wo Prettier das verlangt.

Roter Lauf: `pnpm --filter @spearwolf/twopoint5d typecheck` → drei Mal TS2578 (»Unused
'@ts-expect-error' directive«). Die Ausgabe kommt in den Report.

Dann `packages/twopoint5d/src/utils/Dependencies.ts:1–11, 34–40, 65`:

```ts
export type DependencyKey = string;

/**
 * The callbacks that judge the value behind one key. They are declared as methods, whose
 * parameters TypeScript compares in both directions: a callback written for a narrower value
 * still fits a key typed `unknown` — every key of a `Dependencies` declared without a shape —
 * while one written for an unrelated type fits no key of the shape it is held against.
 */
export interface DependencyCallbacks<T = unknown> {
  equals(a: T, b: T): boolean;
  clone?(source: T): T;
  copy?(source: T, target: T): void;
}

export type EqualityCallback<T = unknown> = DependencyCallbacks<T>['equals'];
export type CloneCallback<T> = NonNullable<DependencyCallbacks<T>['clone']>;
export type CopyCallback<T> = NonNullable<DependencyCallbacks<T>['copy']>;
```

```ts
export type DependencyDeclaration<Shape> =
  | (keyof Shape & DependencyKey)
  | {
      [K in keyof Shape & DependencyKey]:
        | [name: K, equals: EqualityCallback<Shape[K]>]
        | [name: K, callbacks: DependencyCallbacks<Shape[K]>];
    }[keyof Shape & DependencyKey]
  | {
      [K in keyof Shape & DependencyKey]: [name: DependencyKey, callbacks: Required<DependencyCallbacks<Shape[K]>>];
    }[keyof Shape & DependencyKey];
```

- `readonly #props: [DependencyKey, DependencyCallbacks | undefined][];` (ohne `<any>`).
  Konstruktor, `update()`, `equals()` bleiben, wie sie sind: in der Probe kompilierten sie
  unverändert, einschließlich `const callbacks: DependencyCallbacks = {equals};` und
  `p as [DependencyKey, DependencyCallbacks]`.
- Die aliase `EqualityCallback`, `CloneCallback`, `CopyCallback` bleiben exportiert, die
  Namen ändern sich nicht. Sie leiten sich jetzt von den Methoden ab, damit auch ein
  `EqualityCallback` in einem Paar in beide Richtungen verglichen wird. Das gehört in einen
  Satz Kommentar über den dreien.
- TSDoc nachziehen. Die TSDoc von `DependencyDeclaration` (Z. 27–33) und die des
  Konstruktors (Z. 69–80) sagen heute, ein Paar mit vollständigen Callbacks werde »not held
  against the shape«. Künftig gilt das nur noch für seinen Namen. Seine Callbacks müssen zu
  einem Werttyp des Shapes passen, und ein Paar mit ausgeschriebenem Namen muss zum Werttyp
  genau dieses Schlüssels passen.

Die Probe hat außerdem gezeigt: Bei einem Shape mit **mehr als einem** Schlüssel bekommt
ein Callback, der inline ohne Parametertypen steht
(`['v', (a, b) => a.equals(b)]` in `Dependencies<{m: Matrix4; v: Vector2}>`), seine
Parametertypen nicht mehr aus der Deklarationsliste und fällt unter `noImplicitAny` mit
TS7006 durch. Bisher waren seine Parameter `any`. Bei einem Shape mit einem Schlüssel und
ohne Shape funktioniert die Inferenz weiter. Das gehört in den Migration Guide (Schritt 7).

### 3. `readOption`: den Rückgabetyp aus dem Optionstyp ableiten

Zuerst rot, mit neuer Datei `packages/twopoint5d/src/controls/readOption.spec.ts` (Vitest,
Stil wie `Dependencies.spec.ts`). Sie prüft:

- Eine gesetzte Option kommt zurück.
- Der Default kommt bei `options` gleich `undefined`, `options` gleich `null`, bei einem
  fehlenden Schlüssel und bei einem Wert `undefined`.
- **Auch bei einem Wert `null` kommt der Default.** Das ist der Laufzeitteil, der vor dem
  Fix rot ist. Die Optionen dafür in einem Typ mit `| null` deklarieren, damit der Test ohne
  Cast kompiliert.
- Typebene: `// @ts-expect-error the default has to be of the option's type` über
  `readOption(opts, 'speed', 'fast')` mit `opts: {speed?: number}`, und
  `// @ts-expect-error the key has to be one of the options` über
  `readOption(opts, 'sped', 100)`.

Roter Lauf: `pnpm nx test twopoint5d -- src/controls/readOption.spec.ts` (null-Fall rot)
und `pnpm --filter @spearwolf/twopoint5d typecheck` (TS2578 für die erste Direktive).

Dann `packages/twopoint5d/src/controls/readOption.ts` ganz ersetzen:

```ts
export const readOption = <O extends object, K extends keyof O>(
  options: O | null | undefined,
  propName: K,
  defValue: NonNullable<O[K]>,
): NonNullable<O[K]> => {
  if (options != null && propName in options) {
    const val = options[propName];
    if (val != null) return val;
  }
  return defValue;
};
```

Dazu eine TSDoc-Zeile: eine Option, die fehlt, `undefined` oder `null` ist, liefert den
Default. Die zehn Aufrufer in `PanControl2D.ts:259–276` kompilieren unverändert, das hat die
Probe mit allen zehn Aufrufformen bestätigt. `readOption` ist nicht exportiert
(`controls/public-api.ts`).

### 4. ESLint: `any`, Promises und der Grund für `!`

In `eslint.config.mjs`:

1. Im Block `files: ['**/*.{ts,astro}']` bleiben beide Regeln auf `0`, bekommen aber je einen
   Kommentar, umbrochen bei 88–90 Zeichen:
   - Über `'@typescript-eslint/no-explicit-any': 0`: `any` bleibt außerhalb des
     veröffentlichten Library-Codes erlaubt. Die Specs setzen den Renderer mit `as any` ein,
     und die Lookbook-Demos sind keine API. Für den Library-Code gilt der Block weiter unten.
   - Über `'@typescript-eslint/no-non-null-assertion': 0`: unter `noUncheckedIndexedAccess`
     (Root-`tsconfig.json`) trägt ein Index-Zugriff `undefined` in seinem Typ. `arr[i]!` in
     einer Schleife, die durch `arr.length` begrenzt ist, ist der Weg, mit dem die Hot Paths
     sagen, dass der Index im Bereich liegt, ohne einen Branch pro Element.
2. Zwei neue Blöcke **ans Ende** des Arrays:

   ```js
   {
     // the published library code: its types reach every consumer, so an `any` there needs
     // its reason on the spot; specs, benches and src/testing/ never ship
     files: ['packages/*/src/**/*.ts'],
     ignores: ['**/*.spec.ts', '**/*.bench.ts', 'packages/*/src/testing/**'],
     rules: {'@typescript-eslint/no-explicit-any': 'error'},
   },
   {
     // a promise nobody awaits or catches loses its rejection, in a spec as much as in the
     // library; both rules need the type of the expression, which the project service reads
     // from the nearest tsconfig.json
     files: ['packages/*/src/**/*.ts'],
     languageOptions: {parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname}},
     rules: {
       '@typescript-eslint/no-floating-promises': 'error',
       '@typescript-eslint/no-misused-promises': 'error',
     },
   },
   ```

   Die Kommentartexte dürfen umformuliert werden, solange sie den Grund sagen und keinen
   Vorzustand erwähnen.
3. `packages/twopoint5d/src/texture/TextureResource.ts:938`: `(async () => {` wird zu
   `void (async () => {`. Der Kommentar darüber (Z. 935–937, »No closing .catch() here
   either …«) bleibt stehen und begründet das `void` schon.
4. `packages/twopoint5d/src/vertex-objects/VertexObjects.ts:22`: `extends Mesh<any, any>`
   bleibt, und darüber kommt ein gezielter Disable. Die Probe mit
   `Mesh<GeoType, Material | Material[]>` scheitert an den `declare`-Feldern Z. 25–26 mit
   TS2416. Three typt `geometry` und `material` als immer vorhanden, die beiden Felder
   erweitern sie um `undefined`, und das geht nur gegen `any`. Zwischen TSDoc und Klasse
   kommt, Wortlaut frei im selben Sinn:

   ```ts
   // three's Mesh types `geometry` and `material` as always present; the `declare` fields
   // below add `undefined`, the state of a mesh that gave both up, and only `any` as the
   // type arguments of Mesh leaves room for that
   // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fields below widen them
   ```

   Die Direktive muss einzeilig sein, ESLint weist eine mehrzeilige zurück. Nach
   `pnpm build:twopoint5d` prüfen, dass die TSDoc der Klasse in
   `packages/twopoint5d/dist/lib/vertex-objects/VertexObjects.d.ts` noch vor
   `export declare class VertexObjects` steht.
5. `pnpm lint` grün. Roter Beleg: `pnpm lint` direkt nach Schritt 2 dieses Abschnitts und
   vor 3 und 4 meldet `TextureResource.ts:938` (`no-floating-promises`) und zwei Mal
   `VertexObjects.ts:22` (`no-explicit-any`). Diese Ausgabe kommt in den Report.

### 5. `scripts/` als Nx-Projekt mit `checkJs`-Typecheck

1. Neu `scripts/tsconfig.json`:

   ```jsonc
   {
     // Type-checks the Node scripts as what they are: JavaScript that Node runs without a
     // build step. Checked are their JSDoc types and their use of the Node API and of the
     // packages they import. `noImplicitAny` stays off: it would ask for a JSDoc type on
     // every parameter, every test callback included, and a script spells a type out where
     // it says something the name does not.
     "extends": "../tsconfig.json",
     "compilerOptions": {
       "allowJs": true,
       "checkJs": true,
       "noEmit": true,
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "noImplicitAny": false,
       "types": ["node"]
     },
     "include": ["**/*.mjs"]
   }
   ```

2. Neu `scripts/project.json` (Stil wie `packages/twopoint5d/project.json`, ohne `$schema`):

   ```json
   {
     "name": "scripts",
     "tags": ["scripts"],
     "root": "scripts",
     "targets": {
       "typecheck": {
         "executor": "nx:run-commands",
         "options": {"command": "pnpm exec tsc -p scripts/tsconfig.json"},
         "cache": true,
         "inputs": [
           "{projectRoot}/**/*.mjs",
           "sharedTsconfigs",
           {"externalDependencies": ["typescript", "@types/node", "yaml"]}
         ]
       }
     }
   }
   ```

   Prüfen mit `NX_DAEMON=false pnpm nx show project scripts --json`: Das Target zeigt
   `nx:run-commands` mit genau diesem `command`, ohne `script`, und `cache: true`. Mit
   `NX_DAEMON=false pnpm nx show target inputs scripts:typecheck --json` sieht man, dass
   `scripts/tsconfig.json`, `tsconfig.json` und die `.mjs`-Dateien einschließlich der
   `*.test.mjs` erfasst sind.
3. Roter Lauf: `pnpm nx typecheck scripts` → 55 Fehler in 18 Dateien (Ausgabe in den
   Report). Stand der Probe, Fehler je Datei:
   `publishNpmPkg.mjs` 9 · `checkDocSnippets/extractSnippets.mjs` 7 ·
   `checkDocSnippets/compileSnippets.test.mjs` 7 · `checkPeerDependenciesOnly.mjs` 5 ·
   `ci/nxCacheServer/createCacheServer.mjs` 4 · `lookbook/rainbowLineScript.test.mjs` 3 ·
   `ci/nxCacheServer.mjs` 3 · `publishNpmPkg/npmCommand.test.mjs` 2 ·
   `makePackageJson/makePackageJson.test.mjs` 2 · `makePackageJson.mjs` 2 ·
   `lookbook/demoMetadata.test.mjs` 2 · `ci/nxCacheServer/createCacheServer.test.mjs` 2 ·
   `checkDocSnippets/extractSnippets.test.mjs` 2 · `publishNpmPkg/publishedVersions.test.mjs` 1
   · `makePackageJson/resolveDependencies.mjs` 1 ·
   `checkPeerDependenciesOnly/findUndeclaredImports.test.mjs` 1 · `checkNameableTypes.mjs` 1
   · `checkDocSnippets.mjs` 1 (alle unter `scripts/`). Nach Art: 16 × TS18046 (`catch`-
   Variable `unknown`), 15 × TS2345, 9 × TS2532, 6 × TS2339, 5 × TS18048, 2 × TS2531, je
   1 × TS4111 und TS2353.
4. Die Fehler beheben. **Das Laufzeitverhalten ändert sich dabei nicht**, denn `scripts/`
   ist die Publish-Pipeline (AGENTS.md). Erlaubt sind:
   - JSDoc-Annotationen, z. B. `/** @type {Array<{…}>} */` an einem leeren Array-Literal,
     das sonst als `never[]` inferiert wird (`publishNpmPkg.mjs:64`,
     `publishedVersions.test.mjs:15`), oder `@param` bzw. `@typedef` an einer Funktion,
     deren Aufrufer sonst gegen den aus dem Default-Parameter inferierten Typ laufen
     (`makePackageJson.test.mjs:22/62`, `npmCommand.test.mjs:8/27`,
     `findUndeclaredImports.test.mjs:54`),
   - JSDoc-Casts `/** @type {X} */ (expr)`, wo ein Wert sicher gesetzt ist und das der
     Compiler nicht sieht,
   - Narrowing ohne neuen Pfad (`if (x == null) throw …` nur dort, wo der Pfad heute an
     derselben Stelle mit einem TypeError abbräche),
   - Bracket-Zugriff `process.env['NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN']`
     (`ci/nxCacheServer.mjs:16`, TS4111),
   - für `catch`-Variablen, deren `.message` oder `.code` gelesen wird:
     `error instanceof Error ? error.message : String(error)`. Das gibt für jedes Error
     dieselbe Ausgabe wie heute. Ein JSDoc-Cast auf `NodeJS.ErrnoException` ist nur dort
     erlaubt, wo der `try`-Block ausschließlich Node-API aufruft. Exit-Codes und Meldungen
     für ein Error bleiben Byte für Byte gleich.

   Nicht erlaubt: Umbauten, Umbenennungen, neue Prüfungen, die weitere Findings aus
   `scripts/` vorwegnehmen. Die Pakete 3 (`scripts/ci/`) und 4 (`checkNameableTypes`,
   `checkDocSnippets*`, `makePackageJson/`, `publishNpmPkg/`) arbeiten dort später. Zeigt
   eine Stelle einen echten Fehler, bei dem das Skript heute falsch arbeitet, wird er
   behoben, und zwar mit Regressionstest in der zugehörigen `*.test.mjs`, rot vor dem Fix.
   Im Report steht er als eigener Punkt. Die Probe hat keinen solchen Fall gezeigt.
5. `pnpm nx typecheck scripts` grün, `pnpm test:scripts` grün.

### 6. Folgen aus Paket 1: zwei Kommentare neu umbrechen

- `scripts/checkPeerDependenciesOnly/findUndeclaredImports.mjs:14–22`: den TSDoc-Absatz
  von `findUndeclaredImports` neu umbrechen, keine Zeile über 90 Zeichen. Zeile 17 hat
  heute 134. Der Wortlaut bleibt.
- `packages/twopoint5d/tsconfig.build.json:6–7`: die beiden Kommentarzeilen mit 92 und 93
  Zeichen neu umbrechen, Wortlaut bleibt.

### 7. Doku und CHANGELOG

- `AGENTS.md`:
  - In der Tabelle »Projects« eine Zeile `scripts`: die Node-Skripte (Publish-Pipeline,
    CI-Cache-Server, die Checks des Repos), als Nx-Projekt nur ihr Typecheck.
  - Im Satz über die Nx-Tags `scripts` ergänzen (der Typecheck von `scripts/`).
  - Der Punkt `pnpm test:scripts` sagt heute »no Nx project owns them, so `pnpm test`
    does not run them«. Neu: das Nx-Projekt `scripts` hat kein `test`-Target, deshalb lässt
    `pnpm test` sie aus.
  - Im Punkt `pnpm typecheck` ergänzen: die Skripte unter `scripts/` als JavaScript
    (`checkJs`).
- `docs/architecture.md`:
  - §1: in die Projekttabelle `scripts | scripts | scripts | …`.
  - §2: am Punkt `typecheck` ein Halbsatz, dass `scripts` kein Manifest hat und sein
    `project.json` `tsc` über `nx:run-commands` aufruft und seine Inputs selbst nennt.
  - §3: den `lint`-Punkt um die Regeln aus Schritt 4 ergänzen, also die Promise-Regeln mit
    Typinformation auf `packages/*/src` samt Specs, `no-explicit-any` im veröffentlichten
    Library-Code und dass `!` erlaubt bleibt, mit Verweis auf den Kommentar in
    `eslint.config.mjs`. Den `typecheck`-Punkt um die Skripte ergänzen (`checkJs`,
    `noImplicitAny` aus, `strictNullChecks` an).
  - §6 sagt heute »no Nx project owns them«. Neu wie in AGENTS.md.
- `packages/twopoint5d/CHANGELOG.md`, Block `[Unreleased]`, mit Skill
  `updating-changelog`:
  - Changed: den vorhandenen `Dependencies`-Eintrag (heute Z. 209) an Ort und Stelle
    fortschreiben, statt einen zweiten danebenzustellen, der ihm widerspricht. Die Callbacks
    einer Deklaration werden gegen den Werttyp ihres Schlüssels geprüft. Ein Paar mit
    vollständigen Callbacks (`Dependencies.cloneable()`) muss zu einem Werttyp des Shapes
    passen, nur sein Name bleibt ungeprüft. `EqualityCallback` und `DependencyCallbacks`
    haben `unknown` als Default. `DependencyCallbacks` deklariert seine Callbacks als
    Methoden, damit ohne Typargument getypte Callbacks weiter passen.
  - Changed: `PanControl2D` nimmt für eine Option, die als `null` übergeben wird, den
    Default, wie für eine weggelassene.
  - Migration Guide: ein H4 zu den Inline-Callbacks ohne Parametertypen bei einem Shape mit
    mehreren Schlüsseln (Schritt 2, letzter Absatz), mit **Before**/**After** wie die
    Nachbarabschnitte. Dazu passt der Abschnitt um `DependencyDeclaration` (heute Z.
    900–912).

### 8. Verify

`pnpm run ci`. Baseline laut Plan: vollständig grün.

## Abgleich

Stand gegen `HEAD` 5738b5e5, 2026-09-30:

- **TYPE-003** — unverändert. `eslint.config.mjs:37–38` setzen beide Regeln für
  `**/*.{ts,astro}` auf `0`. Die Probe mit beiden auf `error` für `packages/*/src/**/*.ts`
  ergab für `no-explicit-any` 8 Treffer im veröffentlichten Code und 288 in den Specs, für
  `no-non-null-assertion` 240 im veröffentlichten Code und 1.193 in den Specs. Die
  Entscheidung vom 2026-09-30 ist deshalb neu gefasst (siehe oben).
- **TYPE-022** — unverändert. `eslint.config.mjs:17` zieht nur
  `tseslint.configs.recommended` ein, ohne Typinformation. Kein tsconfig erfasst `scripts/`,
  `checkJs` hat nur `packages/twopoint5d-testing/tsconfig.json`. Probe:
  `no-floating-promises` findet 1 Stelle (`TextureResource.ts:938`), `no-misused-promises`
  keine. `checkJs` über `scripts/**/*.mjs` ergibt 220 Fehler mit `noImplicitAny` und 55
  ohne.
- **CFG-001** — unverändert, `eslint.config.mjs:13–15`.
- **TYPE-001** — unverändert: `Dependencies.ts:3` (`EqualityCallback<T = any>`), `:7`
  (`DependencyCallbacks<T = any>`), `:38` (zwei Mal `<any>`), `:40`, `:65`.
- **TYPE-021** — unverändert, `readOption.ts:8` (`val as unknown as ValueType`). Aufrufer
  gibt es nur in `PanControl2D.ts:259–276` (zehn). Nicht exportiert.

Triage der Folgen aus Paket 1 (`Folgen:` im Plan):

- `packages/twopoint5d/README.md:60` (optionaler Peer `@types/three` fehlt) → Paket 8. Sein
  »Hängt ab von: 1« nennt genau diese Peer-Liste schon, und `packages/twopoint5d/README.md`
  gehört zu seinem Bereich. Der Nebenbefund zu `@spearwolf/signalize` aus der Queue sitzt
  im selben Satz und geht mit.
- `findUndeclaredImports.mjs:14–22` und `tsconfig.build.json:6–7` → hierher (Schritt 6).
  Das sind Symptome aus Paket 1: Umbruch in seinen eigenen Kommentaren. Ein eigenes
  Nachtragspaket kostete vier Kaltstarts für zwei Kommentarabsätze. Paket 2 bringt
  `scripts/` ohnehin unter `checkJs` und arbeitet an den tsconfigs.

Queue »Offene Befunde«: `apps/lookbook/package.json:18` (`astro-rainbow-line` 2.x) hat
eine andere Ursache und bleibt liegen. `packages/twopoint5d/README.md:60` geht nach
Paket 8, siehe oben.

## Findings im Volltext

**TYPE-003 · low · eslint.config.mjs:37** (auch `:38`) — `no-explicit-any` und
`no-non-null-assertion` für den Library-Code wieder einschalten
Der `.ts`/`.astro`-Block von `eslint.config.mjs` setzt `@typescript-eslint/no-explicit-any`
und `@typescript-eslint/no-non-null-assertion` auf 0, für die ganze Bibliothek unter
`packages/twopoint5d/src`, nicht nur für Demos und Tests. Der Produktcode trägt heute nur 8
explizite `any`; ein neues fällt aber keinem Gate mehr auf, auch nicht in der öffentlichen
API, deren Typqualität `checkNameableTypes.mjs` sonst eigens absichert. Die
Non-Null-Assertions sind in den generierten Accessoren von `vertex-objects` bewusst gesetzt,
dort bräuchte es einen gezielten Disable.
Empfehlung: Die beiden Regeln zumindest für `packages/*/src/**` wieder aktivieren, oder
falls die Deaktivierung bewusst ist, den Grund als Kommentar neben der Regel festhalten,
damit ein `any` in der öffentlichen API nicht mehr unbemerkt durchrutscht.

**TYPE-022 · low · eslint.config.mjs:16** — Typbasierte Promise-Regeln ins Lint und die
Skripte in den Typecheck aufnehmen
Das Lint nutzt nur `tseslint.configs.recommended`, ohne `no-floating-promises` und
`no-misused-promises`, und das in einer stark async- und signal-lastigen Library. Die knapp
1k Zeilen Publish-Pipeline unter `scripts/` erfasst kein Typecheck (`checkJs` fehlt), obwohl
dort schon JSDoc-Typen stehen.
Empfehlung: Die beiden Promise-Regeln für `packages/twopoint5d/src` aktivieren und eine
tsconfig mit `checkJs` für `scripts/` in `pnpm typecheck` aufnehmen.

**CFG-001 · low · eslint.config.mjs:14** — Wirkungslosen `{files: [...]}`-Block in
eslint.config.mjs entfernen oder korrigieren
Der Eintrag `{files: ['**/*.{js,ts}']}` ganz ohne `rules`/`languageOptions` unmittelbar vor
`pluginJs.configs.recommended` und `...tseslint.configs.recommended` sieht aus, als solle er
die beiden folgenden Configs auf `.js`/`.ts`-Dateien eingrenzen. In ESLint Flat Config gilt
`files` aber nur für das eigene Config-Objekt, nie für nachfolgende Einträge im Array — der
Block hat keinerlei Wirkung. `pluginJs.configs.recommended` und
`tseslint.configs.recommended` greifen unverändert nach ihren eigenen, unbeeinflussten
Regeln.
Empfehlung: Den wirkungslosen Block entfernen, oder falls die Eingrenzung wirklich gewollt
ist, `pluginJs.configs.recommended`/`tseslint.configs.recommended` selbst mit einem
`files`-Feld versehen (z. B. per Objekt-Spread).

**TYPE-001 · low · packages/twopoint5d/src/utils/Dependencies.ts:3** (auch `:7`, `:38`,
`:40`, `:65`) — `any` aus den öffentlichen Typen von `Dependencies` entfernen
`EqualityCallback<T = any>` und `DependencyCallbacks<T = any>` sind exportierte Typen mit
`any` als Default; `DependencyDeclaration` bindet die Callbacks jeder Deklaration an
`DependencyCallbacks<any>` bzw. `EqualityCallback<any>`. Ein `equals`-Callback, der für
einen Schlüssel vom Typ `Matrix4` einen `Vector2` erwartet, kompiliert deshalb, obwohl der
Shape den Werttyp je Schlüssel kennt. Die Klasse ist über `utils/public-api.ts` Teil der
Paket-API.
Beleg: `[name: K, equals: EqualityCallback<any>] | [name: K, callbacks: DependencyCallbacks<any>];`
Empfehlung: Die Callbacks einer benannten Deklaration an `Shape[K]` binden
(`EqualityCallback<Shape[K]>`, `DependencyCallbacks<Shape[K]>`) und die Defaults auf
`unknown` setzen; intern genügt `DependencyCallbacks<unknown>` mit einem Cast an der einen
Stelle, an der die Werte aus der `Map` kommen.

**TYPE-021 · low · packages/twopoint5d/src/controls/readOption.ts:8** — readOption den
Rückgabetyp aus dem Optionstyp ableiten lassen
`val as unknown as ValueType` lässt `ValueType` allein aus `defValue` folgen.
`readOption(opts, 'x', 'str')` liefert `string`, egal welchen Typ `opts.x` hat.
Empfehlung: `<O, K extends keyof O>(options: O, propName: K, defValue: NonNullable<O[K]>): NonNullable<O[K]>`.
