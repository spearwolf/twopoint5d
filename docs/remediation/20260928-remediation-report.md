# Remediation-Report — twopoint5d, 2026-09-28

Quelle: ./audit.html vom 2026-09-27 · Branch: main · Commits: 93628b3c..28d2cff0
Scope-Regel: alles, was in den Feature-Domänen Vertex Objects, Sprites oder Map2D liegt (`packages/twopoint5d/src/vertex-objects/`, `src/sprites/`, `src/map2d/` samt deren Doku), jede Severity inklusive info, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen. Ziel: diese Domänen frei von Issues.

## Lauf
- Ziel: die Feature-Domänen Vertex Objects, Sprites und Map2D samt ihren Punkten unter »Optimierungspotenzial« frei von Audit-Findings bekommen.
- 4 Pakete geplant, 10 gefahren — davon 3 Folgepakete (eine Abspaltung in der Planung, zwei Folgen eigener Änderungen: reihenfolgeabhängige und unter Coverage-Last rote Allokations-Specs) und 3 aus der Befund-Queue (zwei Drain-Runden)
- 26 Findings geschlossen, keines entfiel als gegenstandslos, 10 Commits
- Blockiert: keines. Der erste Umsetzungs-Runner von Paket 1 meldete einen Commit, den es nicht gab; die Gegenprobe der Schleife fing das ab, das Paket lief danach mit höherem Effort sauber durch.
- Ins Audit zurück: 1 Nebenbefund aus der dritten Drain-Runde (`Map2D#tileStreamer`-Setter nicht atomar, wenn `clearTiles()` wirft), keiner mit offener Architekturfrage; dazu 9 kleine Reviewer-Hinweise (1 low, 8 info — Kommentare, Umbrüche, zwei Mikro-Optimierungen). In den Zieldomänen bleiben damit 8 Einträge offen, davon 2 low; die Fläche Map2D hat über drei Drain-Runden nachgeliefert und verdient beim nächsten Mal einen eigenen kurzen Lauf.
- Verify am Ende: `pnpm run ci` ✓ — wie die Baseline
- audit.html: Score 70 → 72 (Code 73 → 78), 26 geschlossen, 10 neu

## Tokenverbrauch
Stand 2026-09-28 19:12, gezählt aus den Reportdateien in `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/3ddcbb68-4337-4729-910b-a8a13084a09c/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             6      12.5M     109.2k  Vertex Objects: Descriptor-Validierung, Sette…
  2             6      69.3M     375.1k  Sprites: Setter-Semantik, AnimatedSprites ang…
  3             6      41.5M     361.3k  Map2D: CameraBasedVisibility — Kamera samt El…
  3b            6     154.9M     723.0k  Map2D: Sichtbarkeit ohne kurzlebige Allokatio…
  4             8      74.1M     427.9k  Map2D: Streamer, Tile-Factory, Spatial Hash, …
  5             7      65.7M     530.1k  Map2D: die Neuberechnung des geneigten Blicks…
  6             6      28.2M     217.1k  Map2D-Sichtbarkeit und Allokations-Specs: Gre…
  7             4      18.1M     161.5k  Map2D-Streaming und Spatial Hash robust, Spri…
  8             4      11.2M     125.4k  Sprites: die Allokations-Specs der Sprite-Set…
  9             4      12.9M      96.2k  Map2D: letzte Ränder an CameraBasedVisibility…
  Steuer        1      15.9M      48.6k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       58     504.2M       3.2M

  Ausgabe je Modell: claude-opus-5-5 3.1M · claude-sonnet-5 81.4k
```

## Semver-Empfehlung
minor (unter 1.0.0 trägt minor den Bruch): 0.21.2 → 0.22.0. `AnimatedSprites` baut, besitzt und entsorgt Geometry und Material jetzt wie `TexturedSprites` (neue Konstruktor-Signatur); dazu behalten `setPosition(x, y)`/`setColor(r, g, b)` z bzw. Alpha, `CameraBasedVisibility` kappt standardmäßig bei `maxVisibleTiles`, und ungültige Vertex-Layouts, `frustumBoxScale`-, `depth`- und `aabb`-Werte werfen.
Keine Anhebung vorgenommen.
