# Remediation-Report — twopoint5d, 2026-09-25

Quelle: ./audit.html vom 2026-09-24 · Branch: main · Commits: deeddeea..9eae955d
Scope-Regel: alles, was in den Feature-Domains »Sprites« (`packages/twopoint5d/src/sprites/**` samt der Tests, die sie abdecken) oder »Vertex Objects« (`packages/twopoint5d/src/vertex-objects/**` samt Tests) liegt, jede Severity, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen. Ziel: beide Domains ohne offenes Finding. Befunde in anderen Domains → Audit.

## Lauf
- Ziel: Die Feature-Domains Sprites und Vertex Objects sind ohne offenes Finding.
- 2 Pakete geplant, 4 gefahren. Davon waren 2 Folgepakete aus der Drain-Runde: Review-Nachlese zu den Paketen 1 und 2 sowie eine Importreihenfolge aus Paket 3. Ein Nebenbefund aus der Queue (Typ von `vertexPositionNode`) lief in Paket 3 mit.
- 9 Findings geschlossen, keines entfiel. 4 Commits.
- Im Lauf behobene Nebenbefunde der Domain: der Typalias von `TexturedSpritesMaterial#vertexPositionNode` und das `readonly` der Pool-Felder von `TexturedSpritesGeometry`.
- Das Sprite-Material bekommt pro Instanz einen Farbton (`TexturedSprite#setColor()` wirkt jetzt), Billboards transformierter Meshes zeigen korrekt zur Kamera, und die three.js-Materialparameter werden durchgereicht. `AnimatedSprites` ist generisch über die Geometrie und nimmt nur noch ein `AnimatedSpritesMaterial`.
- Blockiert: keines.
- Ins Audit zurück: 4 Nebenbefunde außerhalb der beiden Domains, keiner mit offener Architekturfrage. Es sind die Pixel-Tests für `Canvas2DStage`/`OrthographicProjection`, der Teardown von `TileSpritesMaterial`, das `readonly` an `TileSpritesGeometry` und ein rückblickender Absatz im Sprite-Proposal.
- Verify-Lücke: Die neuen Pixel-Tests liefen lokal in Firefox und in Chromium über den WebGL2-Fallback. Ein echtes WebGPU-Backend ist für sie nicht belegt.
- Verify am Ende: `pnpm run ci` ✓, wie in der Baseline.
- audit.html: Score 69 → 71 (Code 71 → 74, Harness 67 → 68). 9 Findings geschlossen, 4 neu. Sprites und Vertex Objects: 0 offene Findings.

## Tokenverbrauch

Stand 2026-09-25 17:41, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/63e1010a-9f1d-4e3f-9de0-3c1460fd486e/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             6      18.9M     189.8k  Sprite-Materialien: Billboards, Tint, Paramet…
  2             4      11.2M     110.0k  Sprite-Klassen und Geometrien: ehrliche Typen…
  3             4       8.6M      74.6k  Sprites-Nachlese: Specs, die prüfen, was sie …
  4             4       4.0M      44.0k  Importreihenfolge in TexturedSpritesMaterial
  Steuer        1       4.4M      21.1k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       19      47.1M     439.5k

  Ausgabe je Modell: claude-opus-5-5 393.4k · claude-sonnet-5 43.2k · claude-haiku-4-5-20251001 2.9k
```

## Semver-Empfehlung
minor (unter 1.0.0 breaking): @spearwolf/twopoint5d 0.21.2 → 0.22.0. Der Konstruktor von `AnimatedSprites` nimmt nur noch ein `AnimatedSpritesMaterial` statt jedes `Material`, und damit bricht gültiger fremder Code bei der Typprüfung.
Keine Anhebung vorgenommen.
