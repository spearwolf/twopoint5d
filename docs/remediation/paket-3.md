# Paket 3 — Megamorphie der Accessoren: Bench richtigstellen, Ergebnis dokumentieren

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: PERF-034 (low) · dazu Symptom aus Paket 1: die Megamorphie-Bench
  gibt allen Writern denselben Quelltext und misst deshalb einen megamorphen
  Aufrufer statt des Inneren der Accessoren (in Zug 0 aufgenommen)
- Ziel: Die Megamorphie-Bench misst, was ihr Kommentar verspricht — jeder Writer
  hat einen Quelltext für sich, eine dritte Variante misst den einen Writer für
  alle Pools —, das Ergebnis (`six pools, six descriptors` innerhalb weniger
  Prozent von `six pools, one descriptor`, also unter dem 1,5-Fachen) steht samt
  Begründung, warum die Accessor-Fabriken geteilt sind, in
  `packages/twopoint5d/docs/architecture.md` und als Kommentar an den Fabriken,
  und PERF-034 ist nach der Entscheidung vom 2026-09-27 ohne Codegen geschlossen.
- Modell: mittlere Stufe
- Effort: low
- Dateien: `packages/twopoint5d/src/vertex-objects/hot-path.bench.ts`,
  `packages/twopoint5d/docs/architecture.md`,
  `packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts` (nur
  ein Kommentar, kein Code)
- Kein CHANGELOG-Eintrag: die Bench erreicht `dist/` nie
  (`packages/twopoint5d/tsconfig.build.json:11` schließt `**/*.bench.ts` aus),
  ein Kommentar und die Architektur-Doku ändern nichts am veröffentlichten Paket.
  Kein Codegen, kein neuer Schalter, keine neue API.
- Vorgehen (Zeilen gegen Stand a68c7068; die englischen Texte sind wörtlich zu
  übernehmen, Umbrüche darf Prettier setzen, `printWidth` ist 130):
  1. `hot-path.bench.ts:52–61` — Kommentar und `makeWriter` ersetzen durch:

     ```ts
     // every writer comes from new Function with a source of its own, the way an application has an
     // update loop of its own per sprite type: V8 compiles a source it has already seen only once and
     // hands every function made from it the same inline caches, so writers of one source would share
     // their call sites just as closures of one function literal do. What the first two benches
     // measure is the inside of the generated accessors
     let writers = 0;
     const makeWriter = (): Writer =>
       new Function(
         'vos',
         'n',
         `// writer ${writers++}\nfor (let i = 0; i < vos.length; i++) { const vo = vos[i]; vo.x = i + n; vo.y = n; vo.z = i; }`,
       ) as Writer;
     ```

     `onePools.map(makeWriter)` und `sixPools.map(makeWriter)` (`:75–76`) werden
     `onePools.map(() => makeWriter())` und `sixPools.map(() => makeWriter())`.
     Die Nummer läuft über alle Writer des Moduls, damit auch die Writer der
     beiden Pool-Gruppen keinen Quelltext teilen.
  2. `hot-path.bench.ts:80–83` — der Kommentar über dem sequenziellen Lauf wird:

     ```ts
     // one after the other instead of bench.compare(), which warms up every variant before it measures
     // the first: the one descriptor is timed before an accessor has seen a second prototype
     ```

     Die beiden `bench(...).run(options)` bleiben, wie sie sind — Namen,
     Reihenfolge, `options`.
  3. `hot-path.bench.ts` — direkt nach dem Block `six pools, six descriptors`
     (`:88–91`) und vor der `dispose()`-Schleife (`:93`) einfügen:

     ```ts
     // the same six pools, all written by one writer: its call sites see the vertex objects of six
     // prototypes and go megamorphic, which is what a loop costs that serves more than four descriptors
     const writeAll = makeWriter();
     await bench('six pools, six descriptors, one writer for all', () => {
       n++;
       for (let k = 0; k < 6; k++) writeAll(sixVOs[k]!, n);
     }).run(options);
     ```

     Keine Assertion auf Zeiten (Konvention: Zeitwerte werden archiviert, nicht
     geprüft). Die übrigen Tests der Datei bleiben unberührt.
  4. `createVertexObjectPrototype.ts` — zwischen `:11` (`const indexKey …`) samt
     Leerzeile und `:13` (`const makeAttributeGetter = …`) diesen Kommentar
     einfügen, mit einer Leerzeile davor und keiner danach:

     ```ts
     // every descriptor builds its accessors from the factories below, and V8 gives all closures of one
     // function literal one set of inline caches. A loop over the vertex objects of one pool inlines the
     // accessor and knows the prototype already, so that costs nothing measurable; docs/architecture.md
     // (the section on vertex-objects/) has the numbers and says why the accessors are not generated per
     // descriptor
     ```

     Sonst keine Änderung an dieser Datei — kein Code, keine anderen Kommentare.
  5. `packages/twopoint5d/docs/architecture.md` — im Abschnitt
     `### \`vertex-objects/\` — the performance core` nach dem Absatz, der mit
     »dropping a dirty flag silently renders stale data.« endet (`:73–76`), und
     vor `### \`texture/\`` (`:78`) einen Absatz einfügen:

     ```markdown
     The generated accessors of every descriptor come from the same few factory functions in
     `createVertexObjectPrototype.ts`, and V8 gives all closures of one function literal one set of
     inline caches: the caches inside the accessors see the vertex objects of every descriptor in
     the application. Where it counts, that costs nothing measurable. A loop over the vertex
     objects of one pool sees one prototype, V8 inlines the accessors into its optimized code and
     knows the shape of the object already — in `src/vertex-objects/hot-path.bench.ts`, six pools
     on six descriptors, each written by a loop of its own, run within a few percent of six pools
     on one descriptor. What costs is a call site that sees the vertex objects of more than four
     prototypes: one loop for all six pools takes about eighteen times as long per object there.
     Every pool built from a description builds a descriptor and a prototype of its own, so a loop
     shared by several sprite geometries of one type sees one prototype per geometry; pools handed
     the same `VertexObjectDescriptor` share its prototype. An accessor call V8 does not inline
     does pay for the shared caches, about twice the time per call across six descriptors.
     Accessors generated per descriptor with `new Function` would help only there, and they would
     need `unsafe-eval` in the Content Security Policy of every application that turns them on, so
     the factories are shared on purpose.
     ```

     Umbruch bei höchstens 94 Zeichen wie die Nachbarabsätze (so ist er oben gesetzt). Kein Codeblock,
     keine Tabelle.
  6. Kein CHANGELOG, keine Specs, kein Browser-Test (siehe oben). Nicht
     committen.
- Verify: `pnpm run ci && pnpm bench`, danach die drei Mittelwerte aus
  `packages/twopoint5d/bench-results/results.json` lesen (Werte in ms je
  Iteration, eine Iteration schreibt 60 000 VOs):

  ```bash
  node -e "const r=require('./packages/twopoint5d/bench-results/results.json');const m={};(function w(o){if(Array.isArray(o))o.forEach(w);else if(o&&typeof o==='object'){if(typeof o.name==='string'&&o.latency)m[o.name]=o.latency.mean;Object.values(o).forEach(w)}})(r);const a=m['six pools, one descriptor'],b=m['six pools, six descriptors'],c=m['six pools, six descriptors, one writer for all'];console.log({nsPerVO:[a,b,c].map(x=>x===undefined?'-':(x*1e6/60000).toFixed(2)),sixVsOne:(b/a).toFixed(2),oneWriterVsOne:c===undefined?'-':(c/a).toFixed(2)})"
  ```

  Erwartet (Zug 0, Node 24.21): `sixVsOne` um 1,02, `oneWriterVsOne` um 18.
  Liegt `sixVsOne` bei 1,5 oder darüber, trägt der Messzweig nicht mehr, und
  das Paket wird mit `question` geparkt — dann gilt der Codegen-Zweig der
  Entscheidung, und der braucht einen neuen Detailplan. Die drei Werte in ns/VO
  und beide Quotienten gehören in die `Ergebnis:`-Zeile.
- Commit:

  ```text
  test(vertex-objects): give every writer of the accessor bench a source of its own

  V8 compiles a source text it has already seen only once and hands every
  function made from it one set of inline caches. The six writers of the
  bench across vertex object descriptors shared one source, so they shared
  their call sites, and the bench timed a megamorphic caller rather than the
  generated accessors: 55 against 3 ns per vertex object. With a source per
  writer, six descriptors run within 2 % of one. A third variant times one
  writer for all six pools on purpose.

  docs/architecture.md says what the bench shows and why the accessor
  factories are shared rather than generated per descriptor, and a comment
  at the factories points there.
  ```

  Die Zahlen im Body stammen aus Zug 0. Zeigt der eigene Bench-Lauf aus dem
  Verify einen `sixVsOne` über 1,02, wird »within 2 %« durch den gemessenen
  Abstand ersetzt, auf ganze Prozent aufgerundet; »55 against 3« bleibt, es ist
  die Zahl aus Paket 1. Trailer `Remediation-Run: 2026-09-27` wie in jedem Paket.

- Verlauf:
  - 2026-09-27 Zug 0: Detailplan steht · PERF-034 umgeformt: die Fabriken sind
    unverändert geteilt (`createVertexObjectPrototype.ts:13`, `:25`, `:37`,
    `:90`, `:110`, numerischer Index seit Paket 1), der gemessene Faktor 18 ist
    ein Artefakt der Bench (V8-Eval-Cache teilt die Feedback-Vektoren
    gleichlautender `new Function`-Writer), korrigiert 1,02 → Messzweig der
    Entscheidung, kein Codegen · Symptom aus Paket 1 (Bench) in dieses Paket
    aufgenommen · Folgen unter Paket 1 erledigt bzw. gegenstandslos, unter 2,
    2b, 4 keine offen · Queue: `setColor`-Eintrag bleibt in der Queue (Paket 3
    ändert keine Setter-Fabrik), neuer Nebenbefund `VOBufferPool.ts:82`
    (Descriptor je Pool) → Queue, → Scope · Restplan: nach Paket 3 kein offenes
    Paket, Reihenfolge und Schnitt unverändert · Belege
    `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/c349c58b-17a9-4093-b8e9-329168c9e618/scratchpad/paket-3.zug0/` und `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/c349c58b-17a9-4093-b8e9-329168c9e618/scratchpad/paket-3.zug0-bench.log`

  - 2026-09-27 Zug 1: Implementierer beauftragt (sonnet, effort low), Report nach `paket-3.impl-0.json`
  - 2026-09-27 Zug 2: Report FERTIG · geändert `hot-path.bench.ts`, `docs/architecture.md`, `createVertexObjectPrototype.ts` (Kommentar) · Baum schmutzig · Verify `pnpm run ci && pnpm bench` exit=0 (`paket-3.verify.log`) · 3,05 / 3,11 / 54,62 ns/VO, sixVsOne 1,02, oneWriterVsOne 17,93
  - 2026-09-27 Zug 3: Reviewer (sonnet, low) — PERF-034 erfüllt, Bench-Symptom aus Paket 1 behoben, keine kritischen/wichtigen Befunde, 1 klein · Diff `paket-3.diff`, Report `paket-3.review-0.json`
  - 2026-09-27 Zug 4: entfällt (0 Runden)
  - 2026-09-27 Zug 5: Commit b602f73c, Verify aus Zug 2 (keine Änderung seither)

## Urteil des Reviewers

- PERF-034: behoben (Messzweig) — `hot-path.bench.ts:56–63` (`makeWriter` mit eigenem Quelltext je Writer), `:88–94` (dritte Variante), `docs/architecture.md:78–92`, `createVertexObjectPrototype.ts:13–17`
- Symptom aus Paket 1 (Bench mit geteiltem Writer-Quelltext): behoben, `hot-path.bench.ts:56–63`
- klein: `docs/architecture.md:89–90` »An accessor call V8 does not inline does pay …« liest sich holprig (Relativsatz ohne »that«); grammatisch korrekt, wörtlich aus dem Detailplan übernommen, nicht geändert

## Entscheidung in Zug 0: der Messzweig gilt, kein Codegen

Die Entscheidung vom 2026-09-27 verlangt: zuerst messen, bei mindestens dem
1,5-Fachen Accessoren pro Descriptor per `new Function` als Opt-in, darunter
das Messergebnis dokumentieren und PERF-034 schließen. Paket 1 hat 3,06 gegen
55,09 ns/VO gemessen, Faktor 18. Diese Zahl misst nicht die Accessoren.

**Der Mechanismus.** V8 legt Quelltext, den `new Function` schon einmal
übersetzt hat, im Eval-Cache ab und gibt jeder weiteren Funktion aus demselben
Text dieselbe `SharedFunctionInfo` samt demselben Feedback-Vektor. Nachgewiesen
mit `%DebugPrint` (Node 24.21): drei `new Function('o', 'return o.x;')` —
Nummer zwei und drei teilen `shared_info` und `feedback vector`; drei Quelltexte
mit je eigener Kommentarzeile haben drei Vektoren
(`/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/c349c58b-17a9-4093-b8e9-329168c9e618/scratchpad/paket-3.zug0/feedback.log`, Skript `feedback.mjs` daneben). Die
Bench aus Paket 1 baut ihre sechs Writer aus einem einzigen Quelltext
(`hot-path.bench.ts:56–61`); die Writer der sechs Descriptoren teilen damit
ihre Aufrufstellen, und `vo.x = …` sieht sechs Prototypen — der Aufrufer ist
megamorph, nicht nur das Innere der Accessoren. Der Kommentar der Bench
(`:52–55`) behauptet das Gegenteil.

**Die Zahlen.** Belege in `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/c349c58b-17a9-4093-b8e9-329168c9e618/scratchpad/paket-3.zug0/`.

| Variante (sechs Pools à 10 000 VOs) | Vitest-Bench, Quellen des Repos | Node auf `dist/` |
| --- | --- | --- |
| ein Descriptor, je Pool ein Writer | 3,04 ns/VO | 3,06 |
| sechs Descriptoren, je Pool ein Writer mit eigenem Quelltext | 3,09 (×1,02) | 3,09 |
| sechs Descriptoren, ein Writer für alle | 54,3 (×17,9) | — |
| sechs Descriptoren, Writer aus einem Quelltext (Bench von Paket 1) | 55,1 (`paket-3.zug0-bench.log`, ×18,1) | 47,1 |
| sechs Descriptoren, eigene Writer, Accessoren je Descriptor per `new Function` (Scratch-Prototyp) | — | 3,08 |
| sechs Descriptoren, Writer aus einem Quelltext, Accessoren je Descriptor generiert | — | 23,2 |
| ohne Inlining (`--no-turbo-inlining`): ein Descriptor / sechs geteilt / sechs generiert | — | 20,3 / 40,0 / 17,5 |

Vitest-Werte aus einer Scratch-Kopie der Bench mit eigenem Quelltext je Writer
und der dritten Variante (`paket-3.zug0/megamorph.bench.ts`, Importe auf die
absoluten Pfade unter `src/vertex-objects/` umgeschrieben), gelaufen aus
`packages/twopoint5d` mit `pnpm vitest bench --run --dir D`, wobei die Kopie
unter `D/src/` lag — das `include` der Bench-Konfiguration ist
`src/**/*.bench.ts`; zweimal wiederholt, Abweichung unter 1 %. Die
Node-Werte aus `megamorph.mjs` gegen `dist/` von 785c4305 (Bibliothekscode seit
dem unverändert), jede Variante in einem eigenen Prozess.

**Das Urteil.** Hat jeder Pool seinen eigenen Aufrufer — die Lage, die die Bench
messen soll und die eine Anwendung mit einer Update-Schleife je Sprite-Typ hat
—, inlinet TurboFan den Accessor und kennt die Map des Empfängers aus der
Map-Prüfung des Aufrufers; die megamorphen Caches im Accessor spielen dann keine
Rolle. Faktor 1,02, deutlich unter 1,5: der Messzweig der Entscheidung gilt.
Codegen hilft nur, wo nicht inlinet wird (40,0 → 17,5 ns/VO) oder wo der
Aufrufer ohnehin megamorph ist (47,1 → 23,2), und kostet dafür `unsafe-eval`
und eine zweite Implementierung jedes Accessor-Typs. Das ist keine Umkehr der
Entscheidung, sondern ihr zweiter Zweig, angewandt mit einer Bench, die misst,
was sie verspricht; die Rohzahl aus Paket 1 bleibt im Plan stehen und ist hier
eingeordnet.

**Was das Paket liefert.** Die korrigierte Bench (Nachtrag zu Paket 1), die
dritte Variante als dokumentierter Beleg dafür, was tatsächlich kostet, und die
Dokumentation an zwei Stellen: in der Architektur-Doku für Menschen, im
Kommentar an der Fundstelle des Audits, damit ein Folgeaudit die Begründung
dort findet, wo es sucht.

**Abweichung von der Audit-Empfehlung.** Das Audit empfiehlt, im Profil zu
prüfen und bei Bestätigung pro Descriptor zu generieren, »mindestens aber« den
numerischen Index (erledigt in Paket 1). Die Prüfung ist hier mit der Bench
geschehen, nicht im DevTools-Profil einer realen Szene — dieselbe V8-Engine,
und die Bench ist das, was CI archiviert. Die Wirkung, die das Audit mit ×2,4
beschreibt, liegt beim Aufrufer, nicht in den Fabriken; siehe den neuen
Nebenbefund.

## Abgleich

- **PERF-034** — umgeformt, Sachverhalt besteht in der Form, nicht in der
  Wirkung. Die vier Fabriken des Audits sind heute fünf:
  `makeAttributeGetter` (`createVertexObjectPrototype.ts:13`),
  `makeAttributeSetter` (`:25`), `makeAttributeValuesGetter` (`:37`),
  `makeAttributeValueSetter` (`:90`), `makeFixedAttributeValueSetter` (`:110`),
  dazu der geteilte Helfer `writeValues` (`:70`). Alle Descriptoren teilen sie;
  seit Paket 1 greifen sie über `bufferList[bufferIndex]` statt über
  `buffers.get(name)` zu (der Map-Load des Audits ist weg), seit Paket 2b liegen
  die Offsets auf 4-Byte-Grenzen — beides ändert an der Teilung nichts. Die
  gemessene Wirkung im Normalfall: keine (siehe oben).
- **Symptom aus Paket 1** — `hot-path.bench.ts:52–61` (`makeWriter`, ein
  Quelltext für alle Writer) und der Kommentar `:52–55`, der eigene
  Aufrufstellen behauptet. Paket 1 ist committet (92facd32); die Regel will ein
  Nachtragspaket. Es ist hier mit Paket 3 zusammengelegt: dieselbe Datei steht
  im Bereich von Paket 3, Paket 3 ist Eigentümer der Messung (»Paket 3 misst
  dort gleich«, Folgen unter Paket 1), und ohne die Korrektur wäre der
  Codegen-Zweig auf ein Artefakt hin gebaut worden.

## Triage

- **Folgen unter Paket 1:** (a) modullokale Kopien von `voBuffer`/`voIndex` für
  einen Codegen — gegenstandslos, es gibt keinen Codegen; die Kopien in
  `createVertexObjectPrototype.ts:10–11` bleiben unberührt. (b) sequenzielle
  Messung per `bench(...).run()` — bleibt, Schritt 2 schreibt nur den Kommentar
  auf das, was sich belegen lässt. (c) neu: der geteilte Quelltext der Writer —
  Symptom, in dieses Paket aufgenommen.
- **Folgen unter Paket 2** gingen an Paket 4 (erledigt), unter 2b und 4 stehen
  keine.
- **Queue `createVertexObjectPrototype.ts:90`** (Rest-Parameter-Array im
  generierten `set…()` ab fünf Werten): eigene Ursache (Rest-Parameter, nicht
  die Teilung der Fabriken), Paket 3 ändert keine Fabrik → bleibt in der Queue.
- **Queue `TexturedSprite.ts:108`** (`setColor()`-Boxing, »Kandidat Paket 3«):
  Paket 3 ändert keine Setter-Fabrik, der Kandidatenhinweis hängt am
  Codegen-Zweig, der entfällt → bleibt in der Queue für die Drain-Runde. Die
  Schwankung 0–128 B je nach Testreihenfolge passt zu einem Aufruf, der je nach
  JIT-Zustand nicht inlinet wird und seine Gleitkommawerte dann geboxt übergibt;
  gemessen ist das nicht.
- **Queue `VertexObjectBuffer.ts:682`**, die drei `→ Audit`-Einträge: andere
  Ursachen, unberührt.
- **Neuer Nebenbefund** `VOBufferPool.ts:82`: jeder Pool, der eine Description
  bekommt, baut einen eigenen `VertexObjectDescriptor` und damit einen eigenen
  Prototyp; `TexturedSpritesGeometry` (`TexturedSpritesGeometry.ts:61–75`) und
  `AnimatedSpritesGeometry` (`AnimatedSpritesGeometry.ts:24`) übergeben die
  Description-Konstante, also hat jede Sprite-Geometrie eigene VO-Maps. Code,
  der mehrere Geometrien eines Typs bedient — eine Update-Schleife über mehrere
  Ebenen, die Methoden auf dem `basePrototype` wie `TexturedSprite#setPosition()`
  —, sieht ab fünf Geometrien mehr als vier Maps und wird megamorph; die dritte
  Bench-Variante misst den Mechanismus mit ×18. Vorbestehend (`git show
  05d723d7:packages/twopoint5d/src/vertex-objects/VOBufferPool.ts`, Z. 82
  gleichlautend). Urteil `→ Scope`: Performance-Problem im Code unter
  `vertex-objects/`. Nicht in dieses Paket: ein Descriptor je Description
  (etwa ein Cache) wäre ein anderer Lösungsweg für die Wirkung, die PERF-034
  beschreibt, und ändert, wann Änderungen an einer Description noch greifen —
  das schneidet die Drain-Runde mit allen Befunden vor Augen. Der Absatz aus
  Schritt 5 beschreibt das heutige Verhalten; wer es ändert, ändert ihn mit.
  Severity geschätzt `low`, wie PERF-034 für dieselbe Größenordnung.

## Findings im Volltext

**PERF-034 · low · packages/twopoint5d/src/vertex-objects/createVertexObjectPrototype.ts:6** — Megamorphe Inline-Caches der geteilten Accessor-Fabriken messen und bei Bedarf pro Descriptor erzeugen

Weitere Fundstellen laut Audit: `createVertexObjectPrototype.ts:17`, `:80`, `:99` (Stand des Audits; heute `:13`, `:25`, `:37`, `:90`, `:110`).

Alle Accessoren aller Descriptoren stammen aus denselben vier Fabrik-Funktionen. V8 teilt den Feedback-Vektor zwischen Closures desselben Funktionsliterals. Die Inline-Caches für `this[voBuffer]`, `.buffers` und `typedArray[idx]` sehen damit die VO-Maps aller Descriptoren der Anwendung (eine Map je Prototyp) und alle Typed-Array-Element-Kinds; ab fünf VO-Typen werden sie megamorph. Die Bibliothek bringt selbst schon TexturedSprite, AnimatedSprite, TileSprite und die zugehörigen Basis-Descriptoren mit. Micro-Benchmark (Node/V8, 10 000 VOs je Descriptor, getrennte Callsites je Descriptor im Aufrufer): 44,6 ns/VO bei sechs Descriptoren gegenüber 18,6 ns/VO bei einem, also ×2,4. In absoluten Zahlen sind das etwa 0,25 ms mehr pro Frame und 10 000 Sprites.

Empfehlung: Zuerst in einer realen Szene mit mehreren Sprite-Typen im DevTools-Profil prüfen. Bestätigt sich der Effekt, die Accessoren pro Descriptor als eigene Funktionsliterale erzeugen, etwa per Codegenerierung mit `new Function`, wegen CSP (`unsafe-eval`) als Opt-in. Mindestens aber den numerischen Buffer-Index aus der Empfehlung zu den Map-Lookups nutzen, der den Map-Load aus dem polymorphen Pfad nimmt.

Aufwand laut Audit: M · Komponente: vertex-objects · Paket: @spearwolf/twopoint5d
