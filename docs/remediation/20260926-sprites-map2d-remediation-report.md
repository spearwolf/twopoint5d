# Remediation-Report — twopoint5d (Domains sprites und map2d), 2026-09-26

Quelle: ./audit.html vom 2026-09-26 · Branch: main · Commits: 324ab4a1..840e2c0e
Scope-Regel: alles in den Domains sprites und map2d, jede Severity einschließlich info, jede Kategorie — sofern der Befund in `packages/twopoint5d/src/sprites/`, `packages/twopoint5d/src/map2d/`, deren Specs und Browser-Tests oder den zugehörigen Lookbook-Demos liegt; gilt auch für Befunde, die erst im Lauf auffallen. Alles andere geht als neues Finding ins Audit.

## Lauf
- Ziel: die Domains sprites und map2d im Audit ohne offenes Finding
- 1 Paket geplant, 6 gefahren — davon 1 in Zug 0 abgetrennt, 2 aus der Befund-Queue, 2 Folgepakete aus kleinen Review-Befunden
- 3 Findings geschlossen, eines auf seinen Anteil außerhalb von sprites eingeengt (Browser-Tests der Stage und das verlorene `keyup` von PanControl2D), 6 Commits
- Neu gebaut: getrimmte TexturePacker-Frames liegen im Quad ihres ungetrimmten Sprites (`texTrim` an `TexturedSprite`, drittes Texel je Frame im `animsMap`), eine Animation mit Dauer 0 zeigt ihren ersten Frame, neue Sprites erben nichts von ihrem Slot-Vorgänger, `TileSpritesFactory#createTile()` nennt sich in seinen Fehlern; die GPU-Pfade dazu sind mit Pixelproben in Chromium und Firefox belegt
- Blockiert: keines
- Ins Audit zurück: 2 Nebenbefunde außerhalb der beiden Domains (texture, stage), keiner mit offener Architekturfrage
- Verify am Ende: `pnpm run ci` ✓, wie in der Baseline
- audit.html: Score 78 → 78, 3 geschlossen, 2 neu; sprites und map2d ohne offenes Finding

## Tokenverbrauch
Stand 2026-09-26 16:09, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0cde42d5-f02f-4e8e-b346-766a21beec2d/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             6      38.8M     275.5k  Sprites: getrimmte Frames, Standbild-Animatio…
  1a            4       4.7M      47.8k  map2d-Specs: Grenzfehler an ihrer Meldung prü…
  2             4       8.3M      69.1k  Sprites und map2d: Slot-Reset neuer Sprites, …
  3             4       3.1M      30.6k  map2d: die Zusagen im @throws von TileSprites…
  4             4       4.4M      56.2k  Sprites und map2d: die kleinen Review-Befunde…
  5             5       3.3M      33.0k  Sprites: der Testname zum Slot-Reset von crea…
  Steuer        1       4.9M      24.9k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       28      67.5M     536.9k

  Ausgabe je Modell: claude-opus-5-5 487.6k · claude-sonnet-5 42.0k · claude-haiku-4-5-20251001 7.4k
```

## Semver-Empfehlung
minor (unter 1.0.0 breaking): 0.21.2 → 0.22.0. Die Instanzpuffer von `TexturedSprites` tragen vier Werte mehr (`texTrim`), eine eigene Klasse, die `TexturedSprite` implementiert, braucht die neuen Felder, und ein Bake mit getrimmtem Frame legt drei Texel je Frame ins `animsMap`.
Keine Anhebung vorgenommen.
