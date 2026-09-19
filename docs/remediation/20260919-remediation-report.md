# Remediation-Report — @spearwolf/twopoint5d, 2026-09-19

Quelle: ./audit.html vom 2026-09-19 · Branch: main · Commits: f1c0e58..160b26ad
Scope-Regel: alle Bugs und Korrektheitsdefekte (BUG-Serie), jede Severity — gilt auch für Befunde, die erst im Lauf auffallen; Nicht-Bugs (API, DOC, PERF, TEST, CONS …) gehen ins Audit

## Lauf
- Ziel: Alle Korrektheitsdefekte des Audits schließen, samt dem, was ihre Behebung nach sich zieht, ohne Breaking Change bei den Entscheidungen, die der Nutzer offen gelassen hat.
- 7 Pakete geplant, 19 gefahren — davon 5 Folgepakete (aus Paket 2, 4, 6, 10 und 12) und 7 aus der Befund-Queue (zwei Drain-Runden)
- 35 Findings geschlossen (die 33 im Scope, dazu zwei Findings außerhalb der BUG-Serie, die ein Queue-Paket mit derselben Fundstelle behoben hat), keines entfiel als gegenstandslos, 19 Commits
- Blockiert: keines. Paket 9 stand zwischenzeitlich, weil der Browsertest an einem Fehler des GPU-Treibers scheiterte (`NV_ERR_STATE_IN_USE`), nicht am Code; nach einem Neustart der Maschine lief das Gate grün, der Stand wurde ohne neuen Runner committet
- Ins Audit zurück: 29 Nebenbefunde aus der Queue (3 davon standen dort schon und wurden nicht doppelt eingetragen), davon 5 mit offener Vertragsfrage — ob `Stage2D` eine fremde Kamera nachführt, ob `computeVisibleTiles()` die Kamera des Aufrufers ändern darf, ob eine Vertex-Object-Description nach dem Bau eingefroren ist, ob generierte Accessoren den `basePrototype` überschatten dürfen, ob ein geleertes Bild seine Textur zurücknimmt; dazu kleine Reviewer-Befunde mit Fundstelle
- Verify am Ende: `pnpm run ci` ✓ ohne Nx-Cache, wie in der Baseline
- audit.html: Score 0 → 5, 35 geschlossen, 47 neu (alle low oder info); Teilscore Code & Laufzeit 4 → 54,5, Projekt-Harness 58,5 → 50,5 (die neuen Doku-Findings)

## Tokenverbrauch

Zwei Zählungen, weil das Arbeitsverzeichnis des ersten Abschnitts mit einem Neustart der Maschine verloren ging; die erste Tabelle ist vorher gesichert worden. Was der Abschluss selbst kostet, steht in keiner der beiden.

Bis Paket 9 (Stand 2026-09-19 19:40):

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             5      24.9M     186.9k  stage: Output- und Pass-Nodes invalidieren, R…
  2             4      15.7M     127.1k  map2d: Tile-Ermittlung, Bezugssystem und Visi…
  3             6      17.2M     172.8k  texture: Katalog- und Loader-Eingaben absiche…
  4             4      17.1M     155.5k  vertex-objects: Pool-Kopplung, Index-Stride u…
  8             4       4.3M      51.2k  stage: Nachtrag — Warnung und TSDoc zu geteil…
  9             4      11.6M     100.7k  texture: Nachtrag — eine abgewiesene TileSet-…
  Steuer        1       4.1M      18.1k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       28      95.0M     812.3k

  Ausgabe je Modell: claude-opus-5 700.9k · claude-sonnet-5 111.4k
```

Ab Paket 5 (Stand 2026-09-19 23:11):

```
  Paket  Prozesse    Eingabe    Ausgabe
  5             4      14.9M     152.9k  display und controls: Layout-Mathe, Resize-Zi…
  6             4       8.5M      87.9k  utils und sprites: Dependencies, Zweierpotenz…
  7             4       7.5M     126.1k  Build-Skripte und Lookbook
  10            5      13.4M     125.4k  controls: Nachtrag — den Cursor mit dem Pan z…
  11            4       2.8M      26.2k  utils: Nachtrag — unpick übernimmt einen eige…
  12            6      14.8M     159.4k  stage: Projektionen und fitIntoRectangle weis…
  13            4       7.3M      66.1k  map2d: Visibility-Helfer ohne globales DOM, R…
  14            4      13.4M     117.0k  texture: gebrochenes Padding, geleerte Animat…
  15            4       6.4M      46.8k  vertex-objects: VertexObjectBuffer prüft eine…
  16            4       6.7M      62.7k  display und controls: erstes panView-Update u…
  17            4       3.8M      43.6k  Build-Skripte: makePackageJson schneidet nur …
  18            4       6.6M      65.7k  stage: Nachtrag — eine Stage2D ohne View träg…
  19            4       7.7M      82.7k  stage: ParallaxProjection weist eine ungültig…
  Steuer        1       7.6M      21.6k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       56     121.4M       1.2M

  Ausgabe je Modell: claude-opus-5 919.4k · claude-sonnet-5 264.7k
```

Zusammen: 84 Prozesse, 216,4M Eingabe, rund 2,0M Ausgabe (claude-opus-5 1.620k · claude-sonnet-5 376k).

## Semver-Empfehlung
minor (unter 1.0 breaking): `@spearwolf/twopoint5d` 0.21.2 → 0.22.0. Bestimmend: `new VertexObjectDescriptor()`, `TileSet` und weitere Konstruktoren werfen jetzt für Eingaben, die sie vorher stillschweigend angenommen haben (siehe CHANGELOG, `Unreleased` › Changed).
Keine Anhebung vorgenommen.
