# Remediation-Report — twopoint5d, 2026-09-29

Quelle: ./audit.html vom 2026-09-28 · Branch: main · Commits: 801906f3..35e7942e
Scope-Regel: jedes Finding, dessen Ort in den Features Vertex Objects, Texturen & Atlanten, Display & Frame-Loop, Sprites oder Map2D liegt (`packages/twopoint5d/src/{vertex-objects,texture,display,sprites,map2d}/`), jede Severity einschließlich info, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen. Ziel ist, dass diese Features ohne offenes Finding dastehen.

## Lauf
- Ziel: Die fünf Features Vertex Objects, Texturen & Atlanten, Display & Frame-Loop, Sprites und Map2D stehen ohne offenes Finding da.
- 3 Pakete geplant, 5 gefahren — davon 1 Folgepaket (Guard-Duplikate, Migration-Guide-Beispiel und Kommentarform aus den Paketen 1 und 4), 1 aus der Befund-Queue (8 Nebenbefunde aus den Paketen 1–3)
- 24 Findings geschlossen, 0 entfielen als gegenstandslos, 5 Commits
- Nebenbei behoben: 13 Nebenbefunde (4 in Paket 1 wegen gemeinsamer Ursache, 1 in Paket 2, 8 in Paket 4), 7 selbst verursachte Befunde (3 aus der Nachrunde von Paket 2, 4 in Paket 5; eine fünfte Folge hatte Paket 2 schon mitgenommen)
- Blockiert: keines
- Ins Audit zurück: 0 Nebenbefunde
- Verify am Ende: `pnpm run ci` ✓ (Baseline ✓)
- audit.html: Score 72 → 75 (Code 78 → 84, Harness 67 → 68), 24 geschlossen, 0 neu — in den fünf Features steht kein offenes Finding mehr

Entscheidungen des Nutzers vor dem Lauf: `FixedFrameLoop` akkumuliert das ungekappte Delta (`rawDeltaTime`), `maxDeltaTime` bleibt 1/30; `Display` misst per `ResizeObserver` und Media Query statt in jedem Frame, ein eigener `resize()`-Aufruf misst immer; Bakes prüfen gegen 8192 Texel oder das Limit des übergebenen Renderers; `TextureAtlas` und `TileSet` typisieren ihre Frame-Daten über einen Typparameter.

## Tokenverbrauch

Stand 2026-09-29 10:07, gezählt aus den Reportdateien in `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/9557ea1f-34da-4544-9cc6-16c7aee7f554/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             4      31.6M     216.2k  Texturen & Atlanten: Listener-Robustheit, Atl…
  2             6      49.1M     365.6k  Display & Frame-Loop: Resize per Observer, De…
  3             4      13.0M      95.6k  Map2D, Sprites, Vertex Objects: Atomarer Stre…
  4             4       6.4M      61.6k  Drain: Nebenbefunde aus Texturen, Display und…
  5             4       4.3M      44.8k  Folgen: Guard-Duplikate, Migration Guide und …
  Steuer        1       4.1M      24.0k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       23     108.4M     807.7k

  Ausgabe je Modell: claude-opus-5-5 762.8k · claude-sonnet-5-5 45.0k
```

## Semver-Empfehlung
minor (unter 1.0.0 breaking): `@spearwolf/twopoint5d` 0.21.2 → 0.22.0. Die Frame-Daten von `TextureAtlas` und `TileSet` sind über einen Typparameter typisiert und nicht mehr `any`; Code, der `frame.data.x` ohne Narrowing liest, typprüft nicht mehr. Dazu kommen `DisplayEventProps#rawDeltaTime` als Pflichtfeld sowie `TileSet#tileCount` und `#firstFrameId` als reine Getter.
Keine Anhebung vorgenommen.
