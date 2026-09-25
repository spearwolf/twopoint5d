# Remediation-Report — twopoint5d (Feature map2d), 2026-09-25

Quelle: ./audit.html vom 2026-09-25 · Branch: main · Commits: c152bab6..480b8fc3
Scope-Regel: alles aus dem Feature map2d — Komponente `map2d` oder Location unter `packages/twopoint5d/src/map2d/`, den map2d-Browsertests oder den map2d-Demos der Lookbook —, jede Severity einschließlich info und Optimierungspotenzial. Nebenbefunde in map2d, vertex-objects oder sprites → Scope; Nebenbefunde anderswo → Audit. Folgen dieses Laufs werden immer hier behoben, gleich in welchem Modul.

## Lauf
- Ziel: das Feature map2d ohne offenes Finding hinterlassen, einschließlich seiner Einträge im Optimierungspotenzial.
- 5 Pakete geplant, 7 gefahren — davon 1 Folgepaket (kleine Befunde der Reviews), 1 aus der Befund-Queue
- 34 Findings geschlossen, 0 entfielen als gegenstandslos, 7 Commits
- Blockiert: keines
- Ins Audit zurück: 0 Nebenbefunde; 1 Folge zur Zeilenoptik zweier Doku-Absätze außerhalb von map2d (`AGENTS.md`, Lookbook-README), info
- Verify am Ende: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser) — wie die Baseline
- audit.html: Score 71 → 73, 34 geschlossen, 1 neu; map2d ohne offenes Finding

Außer den 34 Findings behoben: drei Defekte, die schon vor dem Lauf im Code steckten — die Frustum-Probe von `CameraBasedVisibility` rechnete ohne `camera.coordinateSystem` und `camera.reversedDepth`, `ChunkQuadTreeNode.subdivide()` rekursierte bei Chunks ohne Ausdehnung ohne Ende, die TSDoc an `CameraBasedVisibilityHelpers#show` versprach einen Knoten ohne Szene — und eine Endlosschleife in `findAxis` bei einer `NaN`-Kante, die der Präfixsummen-Umbau desselben Laufs eingeführt hatte.

## Tokenverbrauch
Stand 2026-09-25 20:22, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/387fd4e2-8d90-4d45-ac3c-b786b7534925/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             4      10.0M     102.2k  Tile-Lebenszyklus zwischen Map2D, Streamer, R…
  2             6      43.5M     269.7k  CameraBasedVisibility: Frustum-Box, Kamera-Ve…
  3             4       8.1M      70.8k  Spatial-Hash-Grid, Tile-Koordinaten und Recta…
  4             6      15.1M     156.0k  Datenprovider: ChunkQuadTree und RepeatingTil…
  5             4      12.6M      96.7k  TileSprites-Material und -Geometrie, map2d-Br…
  6             4      10.3M     103.0k  Nebenbefunde: Frustum im Koordinatensystem de…
  7             4       9.6M      89.7k  Folgen aus den Reviews: TSDoc, Spec-Abdeckung…
  Steuer        1       8.6M      35.3k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       33     117.8M     923.4k

  Ausgabe je Modell: claude-opus-5-5 762.5k · claude-sonnet-5 160.9k
```

## Semver-Empfehlung
minor (unter 1.0.0 breaking): 0.21.2 → 0.22.0. `CameraBasedVisibility` führt die Projektion der Kamera nicht mehr nach, und `map2dTileCoords` ist nur noch lesbar — ein Aufrufer, der sich auf das eine verlässt oder das andere schreibt, muss seinen Code anfassen.
Keine Anhebung vorgenommen.
