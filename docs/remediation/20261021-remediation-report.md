# Remediation-Report — twopoint5d, 2026-10-21

Quelle: ./audit.html vom 2026-10-21 · Branch: main · Commits: 328f7a8e..dbc69f47
Scope-Regel: alles ab medium aufwärts, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen

## Lauf
- Ziel: jedes Finding ab medium aus dem Audit der Display-Auflösung, Sprites, Texturen und Map2D schließen, dazu jeden Befund ab medium, der im Lauf auffällt.
- 4 Pakete geplant, 6 gefahren — davon 1 Folgepaket (Texture: gescheiterte Loads und Bilder ohne natürliche Größe, aus Paket 3), 1 aus der Befund-Queue (FeatureSprites: Pass-Meshes ziehen dem `geometry`-Slot nach, medium, aus Paket 4)
- 24 Findings geschlossen (2 high, 22 medium), 0 entfielen als gegenstandslos, 6 Commits
- Im selben Lauf behoben: 5 Nebenbefunde (1 medium, 4 low mit gleicher Ursache wie ein Paket), 3 Reviewer-Befunde der Stufe »wichtig« auf die eigenen Diffs; nebenbei ein low-Finding des Audits (`AdaptiveResolution` hält die Rückgabeskala je Übernahme neu fest), das mangels eigenem Reviewer-Urteil im Audit stehen bleibt
- Blockiert: keines
- Entscheidungen: `PaletteSwap` unterstützt `colorSpace: 'srgb'`; der `material`- und der `geometry`-Slot von `FeatureSprites` bleiben tauschbar, Eingesetztes gehört dem Aufrufer, die Pass-Meshes ziehen dem Geometry-Slot nach; ein `TextureStore` ohne Renderer lädt die GPU-freien Werte; `CameraBasedVisibility` klemmt die Box ans Frustum, Default-`depth` bleibt 100
- Ins Audit zurück: 16 Befunde (5 Nebenbefunde, 11 kleine Reviewer-Befunde), alle low oder info, keiner mit offener Architekturfrage
- Verify am Ende: `pnpm run ci` exit 0 (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:allocations, test:browser) — wie die Baseline
- audit.html: Score 79 → 88, 24 geschlossen, 16 neu; kein Finding ab medium offen

## Tokenverbrauch

Stand 2026-10-21 18:55, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/2700fbd8-0496-4bd7-9248-d90b950d4db7/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             4      19.8M     228.3k  Display: Auflösungspolitik als reine Funktion…
  2             6      53.1M     287.4k  Map2D und PanControl2D: Tile-Reuse, Sichtbark…
  3             4      23.7M     176.7k  Texture: Store und Atlas laden, warten und ge…
  4             6      74.2M     314.7k  Sprites, Stage, Vertex-Pools: Besitz von GPU-…
  5             6      15.9M     124.5k  Texture nachgezogen: gescheiterte Loads melde…
  6             4      10.0M      79.3k  FeatureSprites: Sprite-API und Pass-Meshes ar…
  Steuer        1       7.7M      31.0k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       31     204.4M       1.2M

  Ausgabe je Modell: claude-opus-5-5 1.2M · claude-sonnet-5-5 67.9k
```

## Semver-Empfehlung
`@spearwolf/twopoint5d` minor (unter 1.0.0 breaking): 0.23.0 → 0.24.0. `SpriteFrameContext#colorSpace(name)` ist ein neues Pflichtmitglied eines öffentlichen Interface — wer einen Stage-Kontext selbst baut, ergänzt es; dazu werfen `DynamicAtlas#add()` für ein noch ladendes Bild, `defineSprite()` für `NineSlice` neben `segmentPlacement()` und `TextureStore#getAsync()` für einen unerreichbaren Subtype, wo sie zuvor still weiterliefen. `[Unreleased]` trägt schon vor diesem Lauf Breaking Changes. Keine Anhebung vorgenommen.
