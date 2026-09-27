# Remediation-Report — twopoint5d, 2026-09-27

Quelle: ./audit.html vom 2026-09-26 · Branch: main · Commits: 92facd32..5e4ede07
Scope-Regel: jedes Performance-Problem im Code unter `packages/twopoint5d/src/vertex-objects/` sowie jede fehlende Test- oder Bench-Absicherung des rAF-Hot-Paths (vertex-objects, sprites, map2d) — gilt auch für Befunde, die erst im Lauf auffallen. Ziel: die Domain vertex-objects ist danach frei von Performance-Findings.

## Lauf
- Ziel: die Feature-Domain vertex-objects frei von Performance-Findings machen und ihren Hot Path samt sprites und map2d mit Allokationsspecs und Benchmarks absichern
- 2 Pakete geplant, 7 gefahren — davon 1 Folgepaket (Messhelfer der Allokationsspecs), 2 aus der Befund-Queue, 2 in Zug 0 abgespalten (Stride-Ausrichtung, Megamorphie-Messung)
- 12 Findings geschlossen, 0 entfielen als gegenstandslos, 7 Commits
- Die Megamorphie der Accessoren ist gemessen und ohne Codegenerierung geschlossen: mit eigenem Quelltext je Writer liegen sechs Descriptoren bei ×1,02 gegenüber einem. Der Faktor 18 der ersten Messung war ein Artefakt der Bench. Pools derselben Description teilen sich seither Descriptor und Prototyp.
- Per Nutzerentscheidung mitbehoben, obwohl vorbestehend: das WebGPU-Update von 8-/16-Bit-Integer-Attributen ohne `normalized` und die nicht auf 4 Byte ausgerichteten Attribut-Offsets interleavter Sub-32-Bit-Buffer
- Blockiert: keines
- Ins Audit zurück: 5 Nebenbefunde (vorbestehend, außerhalb der Scope-Regel), davon 0 mit offener Architekturfrage; dazu 6 kleine Reviewer-Befunde als neue low/info-Findings
- Verify am Ende: `pnpm run ci` ✓ (exit 0, wie die Baseline)
- audit.html: Score 69 → 70, 12 geschlossen, 11 neu

## Tokenverbrauch
Stand 2026-09-27 22:53, gezählt aus den Reportdateien in `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/c349c58b-17a9-4093-b8e9-329168c9e618/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             5      36.5M     234.8k  Hot-Path-Benches und Accessor-/VO-Erzeugung o…
  2             9     150.6M     822.2k  Upload-Pfad: schmale, disjunkte und allokatio…
  2b            6      39.5M     270.7k  Stride-Ausrichtung: jedes Attribut auf ganze …
  3             4       8.5M      93.4k  Megamorphie der Accessoren: Bench richtigstel…
  4             5      22.2M     160.8k  Nachtrag zu Paket 1: Allokationsmessung ohne …
  5             7      24.5M     207.8k  Drain: generierte Setter und Sprite-Methoden …
  5b            4      20.0M     134.3k  Ein Descriptor je Description: Pools derselbe…
  Steuer        1      10.5M      34.0k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       41     312.2M       2.0M

  Ausgabe je Modell: claude-opus-5-5 1.9M · claude-sonnet-5 45.0k
```

## Semver-Empfehlung
minor (0.x): `@spearwolf/twopoint5d` 0.21.2 → 0.22.0. Attribute vom Typ `float16`, `int16`, `uint16`, `int8`, `uint8` und `uint8clamped` belegen je Vertex ein Vielfaches von 4 Byte. Buffers-Daten aus einem Layout ohne dieses Padding weisen die Pool-Konstruktoren mit einem `RangeError` ab, und das ist ein Breaking Change, der unter 1.0.0 Minor hebt. Dazu kommen der neue Export `VertexObjectPool#touchVO()` und aufzählbare `voBuffer`/`voIndex` auf Vertex-Objekten. Keine Anhebung vorgenommen.
