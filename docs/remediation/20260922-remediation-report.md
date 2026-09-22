# Remediation-Report — @spearwolf/twopoint5d, 2026-09-22

Quelle: ./audit.html vom 2026-09-21 · Branch: main · Commits: 19890c54..7ec25649
Scope-Regel: Nebenbefunde aus dem Projekt-Setup (Harness-Domäne: Build, Config, Tooling, Tests und Test-Helfer, Lookbook, Skripte) werden in diesem Lauf behoben, jede Severity; Befunde im Library-Code gehen als neues Finding ins Audit. Folgen dieses Laufs werden immer behoben.

## Lauf

- Ziel: das Projekt-Setup eindeutig und prüfbar machen — Workspace-Name, Compiler-Strenge,
  Cache-Inputs und Paket-Skripte auf der einen Seite, Browser-Teardowns, Regressionsnetz der
  Vertex-Buffer, Test-Stubs und die Beschreibung der Lookbook-Demos auf der anderen.
- 2 Pakete geplant, 2 gefahren — 0 Folgepakete, 0 aus der Befund-Queue; je 1 Runde
- 11 Findings geschlossen, davon 1 als gegenstandslos (der Teardown-Helfer, den es betraf,
  existierte nicht mehr); 2 Commits
- Blockiert: keines
- Ins Audit zurück: 1 Nebenbefund im Library-Code (`Display.ts`: das Warten auf die GPU-Queue
  beim Freigeben des Renderers hat keine Frist), dazu 1 kleiner Reviewer-Befund (Reihenfolge
  einer Option in `tsconfig.json`); keiner mit offener Architekturfrage
- Die beiden Browsertests zum Pipeline- und Projektionswechsel sind einmal rot gesehen: je eine
  Mutation am abgesicherten Fix macht sie in Chromium und Firefox rot
- Verify am Ende: `pnpm run ci` ✓ — wie die Baseline
- audit.html: Score 63 → 64, 11 geschlossen, 2 neu
- CHANGELOG: kein Eintrag — die veröffentlichte Oberfläche von `@spearwolf/twopoint5d` ist
  unverändert, der Lauf berührt nur Tooling, Tests und das Lookbook

## Tokenverbrauch

Stand 2026-09-22 17:47, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/5ff55df3-1e69-4969-a8e1-082491304971/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             4      10.0M      87.5k  Workspace-Konfiguration und Build-Skripte sch…
  2             4      25.1M     123.3k  Test-Harness und Lookbook-Beschreibungen vere…
  Steuer        1       1.6M      10.2k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt        9      36.7M     221.0k

  Ausgabe je Modell: claude-opus-5 157.9k · claude-sonnet-5 63.0k
```

## Semver-Empfehlung

`@spearwolf/twopoint5d`: keine Anhebung nötig (patch höchstens): 0.21.2 → 0.21.2. Kein Export,
kein Typ und kein Laufzeitverhalten des Pakets hat sich geändert; `noImplicitReturns` fand
keine Fundstelle im Library-Code. Keine Anhebung vorgenommen.
