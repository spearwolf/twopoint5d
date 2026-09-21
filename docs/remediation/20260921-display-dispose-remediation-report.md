# Remediation-Report — twopoint5d, 2026-09-21

Quelle: ./audit.html vom 2026-09-21 · Branch: main · Commits: 049ba431..88019d0c
Scope-Regel: alles, was den Abbau von Display/Renderer und die Freigabe seiner Ressourcen
betrifft (display, Dispose von vertex-objects, die zugehörigen Browser-Tests) — gilt auch für
Befunde, die erst im Lauf auffallen; alles andere geht als neues Finding ins Audit

## Lauf
- Ziel: `Display#dispose()` gibt Renderer, GPU-Device und Canvas in jedem Zustand sauber frei —
  während des Init, nach einem gescheiterten Init, mit Arbeit auf der GPU —, und das
  Heap-Wachstum über Aufbau-/Abbau-Runden ist erklärt.
- 1 Paket geplant, 4 gefahren: Zug 0 hat das Heap-Wachstum in ein eigenes Paket geschnitten,
  2 weitere Pakete kamen aus der Befund-Queue (Drain-Runden 1 und 2)
- 3 Findings geschlossen, keines entfiel als gegenstandslos, 4 Commits
- Blockiert: keines. Paket 3 stand nach der Bremsregel einmal auf blockiert (ein fehlender
  Testfall); auf Entscheidung des Nutzers wurde der Stash angewendet und das Paket fortgesetzt
- Ins Audit zurück: 7 Nebenbefunde und 1 induzierter Befund, keiner mit offener
  Architekturfrage. Der Nebenbefund aus Paket 4 (Listener eines gescheiterten WebGL-Inits)
  kam in der dritten Drain-Runde; der Dispose-Pfad von `Display` liefert seitdem pro Paket
  neue Randfälle nach, und ein eigener Lauf für diesen Bereich lohnt eher als eine vierte Runde
- Verify am Ende: `pnpm run ci` exit=0 (clean, lint, build, typecheck, checkPkgTypes,
  checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser) — wie die Baseline
- audit.html: Score 63 → 63 (Code 63 → 64), 3 geschlossen, 8 neu
- Offen für den Nutzer: das Drain vor der Freigabe des WebGPU-Device auf echter Hardware mit
  Firefox 155+ prüfen und den Fehler (zerstörtes Device stoppt jeden
  `requestAnimationFrame` der Seite) bei Mozilla melden. Belegt ist er nur headless mit
  Software-Rendering

## Tokenverbrauch
Stand 2026-09-21 22:59, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0c5913dd-6536-4b42-94b0-31ab542295ab/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             4      16.4M     128.5k  Display-Abbau: Renderer erst nach Init und Dr…
  2             6      14.9M     207.9k  Heap-Zuwachs der Aufbau-/Abbau-Runden klären
  3             8      27.5M     211.9k  Display-Abbau: Canvas wiederverwendbar halten…
  4             4      10.4M     107.1k  Display-Abbau: Canvas-Übernahme nach Timeout …
  Steuer        1       4.1M      22.8k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       23      73.2M     678.2k

  Ausgabe je Modell: claude-opus-5 623.7k · claude-sonnet-5 54.5k
```

## Semver-Empfehlung
patch: @spearwolf/twopoint5d 0.21.2 → 0.21.3 — für die Änderungen dieses Laufs allein:
`Display#dispose()` behält Signatur und Exporte und gibt den Renderer nach Init und
GPU-Drain frei. Der Abschnitt `[Unreleased]` des CHANGELOG sammelt aus früheren Läufen
bereits Änderungen, die unter 1.0.0 ein Minor verlangen; für das Release gilt die höchste
Stufe dort. Keine Anhebung vorgenommen.
