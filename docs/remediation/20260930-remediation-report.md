# Remediation-Report — twopoint5d, 2026-09-30

Quelle: ./audit.html vom 2026-09-26 (nachgeführt bis 2026-09-30) · Branch: main · Commits: 5738b5e5..dcd53a3b
Scope-Regel: alles, jede Severity einschließlich info, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen. Ziel des Laufs ist ein Backlog ohne offenes Finding.

## Lauf
- Ziel: das Backlog des Audits vollständig abarbeiten, einschließlich Optimierungspotenzial, und alles mitnehmen, was dabei neu auffällt.
- 9 Pakete geplant, 13 gefahren — davon 2 Folgepakete (StageRenderer-Host-Buchung aus Paket 6, Reviewer-Folgen der Pakete 7, 9, 10 und 12), 2 aus der Befund-Queue
- 66 Findings geschlossen, 0 entfielen als gegenstandslos, 13 Commits
- Im selben Lauf behoben: 23 Nebenbefunde, 11 Reviewer-Befunde der Stufe »wichtig« auf die eigenen Diffs, dazu alle kleinen Folgen
- Blockiert: keines
- Ins Audit zurück: 1 Nebenbefund, mit offener API-Frage — die Option `coordsTarget` von `PanControl2D` beeinflusst den Pan nicht; ein Fix entfernt eine (noch unveröffentlichte) öffentliche Option und berührt die Entscheidung vom 2026-09-19, Pointer gegen ein festes Element zu messen
- Entscheidungen: TypeScript 6 (TS 7 durch typescript-eslint gesperrt), three-Peer bleibt `~0.185`, `printSceneGraphToConsole` in die Lookbook, `PanControl2D` nach `dispose()` still, kein Release-Schnitt
- Verify am Ende: `pnpm run ci` exit 0 (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser) — wie die Baseline
- audit.html: Score 85 → 100, 66 geschlossen, 1 neu

## Tokenverbrauch

Stand 2026-09-30 15:29, gezählt aus den Reportdateien in `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/98a3387a-9269-4464-9499-260d6dfbefca/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             6      16.4M     146.1k  TypeScript 6, tsconfig und Paket-Manifest
  2             6      20.5M     210.0k  Lint- und Typecheck-Gates schärfen
  3             6      22.5M     219.1k  CI- und Deploy-Workflows, Nx-Cache-Server
  4             4      15.7M     157.5k  Gate- und Publish-Skripte
  5             8      26.8M     241.0k  PanControl2D: Lebenszyklus, Hot Path und Tests
  6             4       9.3M      91.7k  Stage und Display: TSDoc und Umzugs-Tests
  7             5      49.9M     246.4k  Lookbook: Einstieg, Suche, Demo-Boilerplate
  8             6      24.4M     200.5k  Library- und Repo-Dokumentation
  9             4      13.8M      94.6k  CHANGELOG
  10            4       9.1M      83.2k  StageRenderer: jeden Host-Handle buchen, soba…
  11            4      10.1M      59.3k  Lookbook-Nachlese: rainbow-line 2, Metadaten …
  12            5      18.1M     120.5k  Nachlese: StageRenderer-Host-Fehler, Doku, De…
  13            4      11.6M      83.7k  Folgen-Nachlese: First-Sprite-Demo, Suche, St…
  Steuer        1      11.4M      42.6k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       67     259.6M       2.0M

  Ausgabe je Modell: claude-opus-5-5 1.6M · claude-sonnet-5-5 413.5k
```

## Semver-Empfehlung
minor (unter 1.0.0, breaking): 0.21.2 → 0.22.0. `printSceneGraphToConsole` ist aus dem öffentlichen Export von `@spearwolf/twopoint5d` entfernt; der `[Unreleased]`-Block trägt darüber hinaus weitere Breaking Changes früherer Läufe.
Keine Anhebung vorgenommen.
