# Remediation-Report — twopoint5d (Stages & Render-Pipeline), 2026-09-30

Quelle: ./audit.html vom 2026-09-29 · Branch: main · Commits: 676eefa7..51e8b330
Scope-Regel: alles, was unter `packages/twopoint5d/src/stage/**` liegt oder das Verhalten der Stages und der Render-Pipeline betrifft, jede Severity einschließlich info und Optimierungspotenzial, jede Kategorie — gilt auch für Befunde, die erst im Lauf auffallen. Ziel: die Domain ist nach dem Lauf backlog-frei.

## Lauf
- Ziel: die Feature-Domain »Stages & Render-Pipeline« vollständig abarbeiten, Optimierungspotenzial und neu auffallende Befunde eingeschlossen.
- 6 Pakete geplant, 15 gefahren — Paket 6 hat seine Detailplanung in vier Teile geschnitten (6, 6b, 6c, 6d), dazu 6 Pakete aus der Befund-Queue und den kleinen Befunden der Reviewer (7–12), drei davon Folgepakete dieses Laufs.
- 44 Findings geschlossen (38 der Komponente `stage`, fünf Stage-Findings ohne Komponentenzuordnung, eines durch den ersten Commit gegenstandslos), 14 Nebenbefunde und 32 Folgen des Laufs im selben Lauf behoben, 15 Commits.
- Neue öffentliche Oberfläche: `StageRenderTargetPool` (gemeinsames internes Target gleich großer Renderer im Pipeline-Modus), `createBloomOutputNodeBuilder()` als fertiger `buildOutputNode`, `On*`-Konstanten mit Payload-Typ für die Events von Stage2D, StageRenderer, Canvas2DStage und PanControl2D, `IProjection#getScaleFactor()` und `ParallaxProjection#getParallaxFactor()`; dazu die Lookbook-Demo `stage-projections`.
- Blockiert: keines.
- Ins Audit zurück: 5 Befunde — 3 kleine Reviewer-Befunde aus dem letzten Paket (TSDoc von `StageRenderer#add()`, zwei fehlende Assertions in `StageRenderer.spec.ts`, alle info), dazu außerhalb der Domain die Lage der Klassen-TSDoc von `Display` und eine offene Verhaltensfrage an PanControl2D (hören Listener nach `dispose()` weiter?). Die dritte Drain-Runde lief gegen die Regel des Skills, weil das Sprintziel eine issue-freie Domain war; danach wurde abgeschnitten, damit der Lauf endet. Die Domain hat einen eigenen kurzen Lauf für diese drei Punkte nicht nötig — sie passen in den nächsten Durchgang über `stage`.
- Verify am Ende: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser), wie die Baseline.
- audit.html: Score 78 → 85 (Code 89 → 99), 44 geschlossen, 5 neu.

## Tokenverbrauch

Stand 2026-09-30 00:32, gezählt aus den Reportdateien in `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/4315597f-d231-47b0-abdc-4c175c925e0c/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             6      30.8M     251.4k  Modus C und verschachtelte Kinder: Clears, Ou…
  2             4      15.6M     110.9k  Stage2D im Frame-Pfad: Szenenwechsel, needsUp…
  3             6      44.1M     275.5k  StageRenderer und seine Stages: Beziehung, Tr…
  4             4      14.4M     126.7k  Canvas2DStage: Texturlebenszyklus und Frame-T…
  5             4      11.8M      94.8k  Projektions-API: getViewRect als Objekt, getZ…
  6             4      14.1M      98.1k  Testlücken der Stage-Schicht schließen
  6b            6      14.5M     149.6k  StageRenderer entwirren: Modusauswahl, Render…
  6c            4      15.5M     136.3k  RenderTarget-Pool für gleich dimensionierte R…
  6d            6      19.1M     161.7k  Fertige buildOutputNode-Builder für die gängi…
  7             5      16.1M     103.8k  Drain: Stage-Schicht — leere Stage-Liste beim…
  8             4      14.6M     100.0k  Drain: Event-Konstanten für Stages und PanCon…
  9             4      11.1M      82.0k  Drain: Folgen des Laufs in Stage-Code, Doku u…
  10            4      15.6M      95.1k  Drain: Zeilenumbrüche nach den Umbauten des L…
  11            4       8.4M      75.2k  Drain: Reste aus Paket 9 — verschachtelter Ag…
  12            4      12.4M     128.5k  Drain: StageRenderer#dispose() läuft hinter e…
  Steuer        1      14.4M      54.2k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       70     272.4M       2.0M

  Ausgabe je Modell: claude-opus-5-5 1.8M · claude-sonnet-5-5 198.3k
```

## Semver-Empfehlung
minor (unter 1.0.0 hebt breaking Minor): 0.21.2 → 0.22.0. `IProjection#getViewRect()` liefert ein benanntes Objekt statt eines Tuples, und `getZoom()` ist durch `getScaleFactor()`/`getParallaxFactor()` ersetzt — fremde Projektionen und Aufrufer müssen nachziehen (Migration Guide unter [Unreleased]).
Keine Anhebung vorgenommen.
