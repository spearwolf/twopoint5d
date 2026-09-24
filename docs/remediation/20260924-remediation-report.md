# Remediation-Report — twopoint5d (Display & Frame-Loop), 2026-09-24

Quelle: ./audit.html vom 2026-09-23 · Branch: main · Commits: 6a4bcacf..bd80d232
Scope-Regel: alles, was `packages/twopoint5d/src/display/**` betrifft, samt dessen Tests, Doku, CHANGELOG-Einträgen und den Display-Demos der Lookbook, jede Severity einschließlich info — gilt auch für Befunde, die erst im Lauf auffallen. Ziel ist eine stabile, issue-freie Display-Basis.

## Lauf
- Ziel: die Display- und Frame-Loop-Schicht ohne offene Befunde — Lifecycle, Resize, Canvas-Ownership, Stylesheets, Renderer-Freigabe und öffentliche API.
- 4 Pakete geplant, 9 gefahren — davon 1 Folgepaket (1b, Test-Helfer), 1 Paket für einen im Lauf gefundenen, vorbestehenden Defekt (5: Firefox/WebGPU bekam nach `renderer.dispose()` auf einem Canvas im Dokument keinen `requestAnimationFrame` mehr), 3 aus der Befund-Queue (6, 7, 8)
- 30 Findings geschlossen, 3 teilweise (nur der Display-Anteil; der Rest liegt in Stage, Sprites und PanControl2D), 9 Commits
- Blockiert: keines
- Ins Audit zurück: 6 Nebenbefunde außerhalb der Display-Fläche oder mit offener Designfrage (werfender `OnDisplayStart`-Listener), dazu 2 Restgrenzen der Fixes (rAF-Tick von three während der Pause, 2000-ms-Frist bei verborgener Seite)
- Verify am Ende: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser) — wie die Baseline
- audit.html: Score 66 → 69, 30 geschlossen, 8 neu

## Tokenverbrauch
Stand 2026-09-24 14:52, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/a354229b-228b-496c-9c2e-82b9e47afc5f/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             8      35.1M     289.3k  Lifecycle und Frame-Loop: start/stop/pause, E…
  1b            4      12.1M      90.9k  Gemeinsame Test-Helfer der Browser-Suite
  2             7      35.5M     230.6k  Resize-Pipeline und Canvas-Ownership
  3             6      49.2M     336.5k  Stylesheets und Renderer-Ressourcen
  4             4      22.6M     161.3k  Öffentliche Display-API, Typen, Doku und Demos
  5             5      21.6M     170.8k  Die Freigabe eines WebGPU-Renderers lässt den…
  6             6      24.3M     175.7k  Offene Befunde der Display-Domäne: Chronomete…
  7             4       5.7M      57.1k  Restbefunde der Display-Domäne: Test-Hygiene …
  8             4      15.0M     104.3k  Letzte Reviewer-Befunde der Display-Domäne: I…
  Steuer        1      10.6M      42.8k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       49     231.7M       1.7M

  Ausgabe je Modell: claude-opus-5-5 1.6M · claude-sonnet-5 55.5k
```

## Semver-Empfehlung
minor (unter 1.0.0 für breaking): @spearwolf/twopoint5d 0.21.2 → 0.22.0. Bestimmend: das Display-Modul exportiert `postFixID`, `OnRAF`, `ISetAnimationLoop` und `globalStylesID` nicht mehr, und `Display#renderer`, `#frameLoop`, `#frameNo` sowie die Zustandsfelder von `FrameLoop` sind nur noch lesbar.
Keine Anhebung vorgenommen.
