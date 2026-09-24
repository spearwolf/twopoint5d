# Remediation-Report — twopoint5d (Display-Pause und Dispose), 2026-09-24

Quelle: ./audit.html vom 2026-09-21 (nachgeführt 2026-09-24) · Branch: main · Commits: 412f4a66..c983e745
Scope-Regel: jeder Befund in der Domäne »Display & Frame-Loop« — `packages/twopoint5d/src/display/` samt zugehöriger Tests und Doku —, jede Severity einschließlich info; gilt auch für Befunde, die erst im Lauf auffallen. Alles außerhalb geht als neues Finding ins Audit.

## Lauf
- Ziel: die Domäne »Display & Frame-Loop« ohne offene Befunde, einschließlich aller Folgen der eigenen Änderungen.
- 1 Paket geplant, 6 gefahren — davon 3 Folgepakete (3, 5, 6: Doku- und Kommentarschärfungen aus kleinen Reviewer-Befunden), 2 aus der Befund-Queue (2: `dispose()` räumt trotz werfender Pause- oder Dispose-Listener vollständig ab, und `start()` rejected nach `dispose()` laut TSDoc; 4: ein Display, das vor dem ersten `start()` pausiert, hält auch die rAF-Schleife von three an)
- 2 Findings geschlossen (die rAF-Schleife von three ruht während der Pause; ein gescheiterter Start verliert beim Rollback keinen Fehler, sondern rejected mit `AggregateError`), 5 vorbestehende Nebenbefunde mit behoben, 6 Commits
- Die rAF-Schleife wird über das private `renderer._animation` von three 0.185 angehalten, per Duck-Typing abgesichert; ein Browser-Test in `display-lifecycle.test.js` schlägt an, sobald ein three-Update diese Interna ändert
- Blockiert: keines
- Ins Audit zurück: 0 Nebenbefunde
- Verify am Ende: `pnpm run ci` ✓ (clean, lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts, test:coverage, test:browser) — wie die Baseline
- audit.html: Score 69 → 69, 2 geschlossen, 0 neu; die Domäne »Display & Frame-Loop« hat keine offenen Findings mehr

## Tokenverbrauch
Stand 2026-09-24 22:41, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0816cb6e-4ba4-4ccc-a542-5f198874d89d/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             4      16.5M     136.6k  Display-Pause: three-Schleife anhalten und Ro…
  2             4       7.3M      67.7k  Display-Dispose: Aufräumen trotz werfender Li…
  3             4       4.6M      46.4k  Display-Doku: Formulierungen aus den Paketen …
  4             4       7.4M      82.5k  Display-Pause vor dem ersten Start: three-Sch…
  5             7       5.7M      60.5k  Display-Doku: TSDoc von pause nennt die Grenz…
  6             4       2.5M      28.2k  Display-Doku: »goes on the renderer« eindeuti…
  Steuer        1       5.2M      25.4k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       28      49.1M     447.4k

  Ausgabe je Modell: claude-opus-5-5 399.8k · claude-sonnet-5 42.3k · claude-haiku-4-5-20251001 5.2k
```

## Semver-Empfehlung
minor (unter 1.0.0 breaking): `@spearwolf/twopoint5d` 0.21.2 → 0.22.0. Ein pausiertes `Display` hält die Animation-Loop seines Renderers an, sodass ein Callback, den ein Aufrufer auf demselben Renderer per `setAnimationLoop()` betreibt, während der Pause keine Frames mehr bekommt.
Keine Anhebung vorgenommen.
