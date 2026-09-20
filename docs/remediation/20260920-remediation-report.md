# Remediation-Report — @spearwolf/twopoint5d, 2026-09-20

Quelle: ./audit.html vom 2026-09-19 · Branch: main · Commits: e7a112b3..5a0ae0e4
Scope-Regel: alles, was im Lauf auffällt, wird in diesem Lauf behoben — jede Severity, jede Kategorie, notfalls in zusätzlichen Paketen. Nichts wandert ungefixt ins Audit zurück.

## Lauf

- Ziel: Die Speicher- und Konsistenz-Serien aus »Code & Laufzeit« schließen und die beiden
  offenen BUG-Einträge des Harness dazu — ein Lauf, nach dem kein stummer Ausfall mehr in
  einer Fehlkonfiguration stecken bleibt.
- 9 Pakete geplant, 16 gefahren — davon 3 Folgepakete (10, 14, 16) und 4 aus der Befund-Queue (11, 12, 13, 15)
- 27 Findings geschlossen, 0 entfielen als gegenstandslos, 16 Commits
- Blockiert: keines. Kein Paket stand je auf `[!]`, keines auf `[r]`.
- Ins Audit zurück: 23 Nebenbefunde, davon 1 mit offener Architekturfrage — `getZoom()`
  beantwortet auf `IProjection` zwei verschiedene Fragen, und beide Auswege ändern eine
  veröffentlichte Methode. 4 stammen aus der Befund-Queue, 19 sind kleine Befunde der
  Reviewer, die keine Nachrunde ausgelöst haben.
- Verify am Ende: `pnpm run ci` ✓ exit=0 — dieselbe Breite wie die Baseline (clean, lint,
  build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:ci,
  test:browser), und wie sie auf ganzer Linie grün.
- audit.html: Score 5 → 13,5 (Code & Laufzeit 54,5 → 62, Projekt-Harness 50,5 → 51,5),
  27 geschlossen, 23 neu, 138 Findings im Backlog.

Was der Lauf über sich selbst gelernt hat: der Paketschnitt war zu fein. Neun Pakete für
27 Findings sind 3,0 je Paket gegen einen Zielkorridor von fünf bis acht, und jedes Paket
kostet denselben Satz Kaltstarts, ob drei Findings darin stecken oder acht. Die vier Pakete
der Drain-Runden wurden deshalb gröber geschnitten — 7,0 Findings je Paket — und liefen
schneller durch als die feinen davor. Dreimal hat derselbe Bereich nachgeliefert: die
Transaktionen im `StageRenderer` — Größe, Stage-Aufnahme, und die Meldung, die zählt, was
sie nicht gezählt hat. Der vierte Nachschlag steht im Audit statt in einem siebzehnten
Paket; dieser Bereich verdient einen eigenen Lauf.

## Stand 2026-09-20 16:11, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ecdab9e-7f9f-4c42-ae2e-2cfd00b2febc/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             4       9.9M      98.3k  ESLint auf die Skripte in .astro-Dateien ausd…
  2            10      32.5M     256.3k  Stage2D: PassNode freigeben und der Klasse ei…
  3             6      17.9M     131.4k  map2d: Pool-Slots und das Kachelgitter gegen …
  4             6      14.6M     138.1k  map2d: Den Visibility-Helfern ein dispose() g…
  5             4       7.4M      61.8k  Publish-Pipeline: workspace:-Specifier korrek…
  6             4       8.9M      61.2k  display: Ein disposetes Display abweisen und …
  7             4       8.9M      80.4k  texture: Animationsnamen, Guard-Meldung und d…
  8             4      10.4M      98.7k  stage: Projektionen und Canvas2DStage in den …
  9             4      10.1M      84.0k  vertex-objects: Geometrie-Name, Ownership-TSD…
  10            4       9.3M      80.4k  Nachzug: die Kamera-Umstellung zu Ende dokume…
  11            4       9.3M      72.0k  Lookbook: CSS, das der Browser verwirft, und …
  12            4      14.5M     102.5k  map2d: Die beiden Visibility-Helfer auf dasse…
  13            6      30.2M     198.1k  texture und stage: Ein Leak im Atlas-Pfad, ei…
  14            4       4.9M      48.7k  Nachzug: die Node-Untergrenze in Doku und Too…
  15            6      19.3M     138.4k  Aufräumrunde: HelpersManager, tote Lookbook-R…
  16            4       8.5M      79.8k  Nachzug: den Rollback von StageRenderer#resiz…
  Steuer        2      20.5M     109.7k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       80     237.2M       1.8M

  Ausgabe je Modell: claude-opus-5 1.7M · claude-sonnet-5 188.1k
```

## Semver-Empfehlung

minor: `@spearwolf/twopoint5d` 0.21.2 → 0.22.0. Das Interface `IMap2DVisibilitorHelpers`
hat mit `dispose()` ein Pflichtmitglied bekommen — eine fremde Implementierung typprüft
nicht mehr, und unter `1.0.0` hebt ein Bruch den Minor. Dazu kommen sechs Stellen, die
jetzt werfen, wo vorher still weitergelaufen wurde: die Setter für `tileWidth`/`tileHeight`,
der `FixedFrameLoop`-Konstruktor über einem disposeten Display, `updateCamera()` auf einer
Projektion ohne Projektionsebene, `FrameBasedAnimations#add()` ohne Frames oder mit
ungültiger Dauer, `TextureAtlas#add()` bei einem vergebenen Frame-Namen und
`Canvas2DStage#setContainerSize()`, das den Wurf einer Stage durchreicht.

patch: `@spearwolf/twopoint5d-testing` 0.1.0 → 0.1.1. Nur Tests bewegt, keine Oberfläche.

Die `engines.node` der Root-`package.json` ist auf `^24.16.0 || >=26.3.0` verschärft
worden; die Root ist `private`, kein veröffentlichtes Paket führt ein `engines`-Feld, also
trägt die Verschärfung keine Semver-Folge nach außen.

Keine Anhebung vorgenommen.
