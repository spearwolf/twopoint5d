# Remediation-Report — @spearwolf/twopoint5d, 2026-09-21

Quelle: ./audit.html vom 2026-09-19 (nachgeführt 2026-09-20) · Branch: main · Commits: 42a88429..320dd067
Scope-Regel: alles, was CI, Build, Nx/pnpm-Cache, Test-Harness, Lint-/Typecheck-Gate, Dependencies oder die Publish-Pipeline betrifft, jede Severity — gilt auch für Befunde, die erst im Lauf auffallen; der Rest geht als neues Finding ins Audit

## Lauf

- Ziel: Projekt-Harness und Build-Stabilität — CI hält den Nx-Cache über Läufe, baut und lädt
  nichts doppelt, veröffentlicht genau den geprüften Commit, und das Gate misst, was es
  behauptet.
- 5 Pakete geplant (4 plus eine Teilung in Zug 0: 3b), 10 gefahren — davon 5 aus der
  Befund-Queue in drei Drain-Runden (5, 6, 7, 8, 9); Paket 7 nahm eine Folge aus Paket 4 auf,
  Paket 9 eine Folge aus Paket 1
- 18 Findings geschlossen, 0 entfielen als gegenstandslos, dazu die zwei offenen Fragen des
  Audits beantwortet und der Cache-Auftrag erledigt; 10 Commits
- Blockiert: keines
- Ins Audit zurück: 3 Nebenbefunde aus der Queue, davon 2 mit Ursache in der Bibliothek statt
  im Harness (linearer Heap-Zuwachs der Testseite; `Display.dispose()` zerstört das Device, während
  auf Firefox 155/WebGPU noch Arbeit läuft), und der dritte nach der Regel ab der dritten
  Drain-Runde; dazu 15 kleine Befunde der Reviewer. Die Skripte unter `scripts/` haben in drei
  Runden nachgeliefert — sie verdienen einen eigenen Lauf, wenn sie wieder anfallen.
- Cache in CI: Diagnose vor dem Lauf war eindeutig — kein Nx-Cache überlebte einen CI-Lauf
  (`Cache: 0/2 hit` bei jedem Build), Deploy baute ein zweites Mal, die Scripts ein drittes und
  viertes Mal, Browser wurden doppelt geladen. Jetzt trägt `actions/cache` den Nx-Cache über
  einen lokalen Cache-Server (`scripts/ci/nxCacheServer.mjs`) von Lauf zu Lauf, die Inputs sind
  lokal belegt (Treffer, Miss am Input, Treffer an Nicht-Inputs). Den Beleg in CI liefert erst
  der erste Lauf nach dem Push.
- Offene Fragen: OIDC — 0.21.2 ist von `GitHub Actions <npm-oidc-no-reply@github.com>` mit
  SLSA-Provenance veröffentlicht, der Trusted Publisher ist eingerichtet. Backend — lokal
  Chromium → WebGL2, Firefox → WebGPU; die Suite loggt `[renderer-backend]` je Browser, der
  CI-Wert steht im ersten Log nach dem Push.
- Verify am Ende: `pnpm run ci` ✓ exit=0 mit `NX_SKIP_NX_CACHE=true` (62 s, alle Targets frisch)
  — gleiche Breite wie die Baseline, `test:ci` ersetzt durch `test:coverage`, `typecheck` umfasst
  jetzt Browsertests und markierte Doku-Snippets; Baseline war ebenfalls grün.
- audit.html: Score 20,5 → 28,5 (Code & Laufzeit 67 → 64,5, Projekt-Harness 53,5 → 64),
  18 geschlossen, 18 neu, 142 Findings im Backlog.

## Tokenverbrauch

Stand 2026-09-21 13:51, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0ec96af6-3174-4c1b-82ff-efaa7423bfa6/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             6      25.2M     256.3k  CI-Pipeline: Nx-Cache über Läufe, keine Doppe…
  2             5      17.2M     154.2k  Dependencies: Audit-Gate, Update-Bot, Lookboo…
  3             6      20.4M     170.7k  Test-Harness: Coverage-Target, echte Schwelle…
  3b            5      28.8M     217.2k  Typecheck: Browsertests und markierte Doku-Sn…
  4             4      12.4M     116.7k  Publish-Skripte und Paketinhalt
  5             4       7.7M      81.2k  Drain: Deploy-Checkout, Repo-Hygiene und Lock…
  6             4      13.9M     120.8k  Drain: Browser-Suite auf Firefox 155/WebGPU u…
  7             6       9.4M     135.3k  Drain: Fehlerpfade der Publish- und Manifest-…
  8             6      12.5M     127.1k  Drain: letzte Fehlerpfade der Skripte und Umb…
  9             4       3.6M      44.1k  Drain: Cache-Server-Test ohne geteilten Pfad …
  Steuer        1       9.8M      42.4k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       51     160.8M       1.5M

  Ausgabe je Modell: claude-opus-5 1.1M · claude-sonnet-5 365.4k
```

## Semver-Empfehlung

patch: 0.21.2 → 0.21.3 für diesen Lauf allein. Das veröffentlichte Paket verliert nur seine
Declaration- und Source-Maps, die ins Leere zeigten; API, Peers und Engines bleiben gleich.
Unter `## [Unreleased]` stehen aus früheren Läufen Breaking Changes, das nächste Release als
Ganzes ist deshalb mindestens 0.22.0. Keine Anhebung vorgenommen.
