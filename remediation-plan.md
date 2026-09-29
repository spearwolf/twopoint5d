# Remediation-Plan — twopoint5d

Quelle: ./audit.html vom 2026-09-29 · Branch: main · erstellt: 2026-09-29
Baseline: `pnpm run ci` ✓
Arbeitsverzeichnis: /private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/463e3d2c-0682-4a9d-890c-15c352bad82e/scratchpad (Diffs und Verify-Logs, außerhalb der Versionierung)
Paketdetails: docs/remediation/paket-<N>.md — je Paket eine Datei, angelegt von dessen Zug 0
Scope: 6 Findings (2 high, 3 medium, 1 low) — BUG-113, BUG-121, BUG-122, BUG-115, TEST-042 (Teil), TEST-004 (Teil) · ausgenommen: alle übrigen Findings, info, acknowledged
Scope-Regel: alles ab medium, jede Kategorie — gilt für Befunde, die erst im Lauf auffallen; darunter geht ins Audit
Kaltstarts: 1 Paket × mindestens 3 Agenten ≈ 3, je Nachrunde zwei mehr · 6 Findings je Paket
Stand (2026-09-29): Lauf abgeschlossen · Paket 1 committet (e2026856) · nichts blockiert · Befund-Queue leer, beide Einträge ins Audit gebucht · Report: docs/remediation/20260929-stage-controls-remediation-report.md

Diese Datei führt einen Lauf des Skills `js-ts-audit-remediation` und hält
seinen Stand. Wer hier weiterarbeitet: diesen Skill laden, die eingetragenen
Hashes gegen `git log --oneline` halten, beim obersten Paket ohne `[x]`
einsteigen. Der Lauf ist erst fertig, wenn auch »Offene Befunde« leer ist.
Statusmarken: `[ ]` offen · `[~]` Detailplan steht, Umsetzung läuft · `[x]`
erledigt · `[r]` committet, Review wird nachgezogen · `[!]` geparkt, Stand im Stash.

## Entscheidungen
- Scope vom Nutzer gewählt: BUG-113, BUG-121, BUG-122, BUG-115 samt den Testlücken dahinter, als ein Paket (2026-09-29)
- Befunde, die im Lauf auffallen: ab medium in diesem Lauf beheben, jede Kategorie; darunter als neues Finding ins Audit (2026-09-29)
- PanControl2D ignoriert Tastendrücke mit Ctrl/Meta/Alt und solche aus editierbaren Zielen (`input`, `textarea`, `select`, `contenteditable`) immer, ohne neue Option; `keyup` gibt weiterhin jede passende Taste frei. Die Verhaltensänderung steht im CHANGELOG (2026-09-29)
- Der Mode-E-Pixel-Test aus TEST-042 bleibt draußen und mit BUG-114 offen; aus TEST-042 kommen nur der Zwei-Frame-Test für das verschachtelte Plain-Kind und der Test für das verlorene `keyup` in den Lauf. Aus TEST-004 kommt nur die `PanControl2D.spec.ts` (Optionen, Fokusverlust, Tastenfilter); Touch/Zwei-Pointer/`pointercancel` in der Browser-Suite bleiben offen (2026-09-29)

## Konventionen
Gelten für jede Zeile, die in diesem Lauf entsteht — Code, Kommentare,
Dokumentation, CHANGELOG, Migrations-Hinweise, Commit-Messages:
- Inline-Kommentare sind erwünscht, wo sie erklären, *warum* etwas so ist.
- Keine Finding-IDs, auch nicht in der Commit-Message. Sie gehören diesem einen
  Audit, sind danach tot, und die Commit-Message überdauert den Lauf. Sie leben
  in diesem Plan und sonst nirgends; die Verbindung zwischen Finding und Commit
  trägt das Feld `Hash:` unter dem Paket — in genau der Richtung, in der jemand
  sie später sucht. Eine Commit-Message sagt in eigenen Worten, was sie ändert.
- Kein Rückblick auf den Vorzustand: kein »früher«, kein »statt bisher«, kein
  »im Zuge des Audits umgestellt«. Der Test: Ergibt der Satz für jemanden Sinn,
  der den Vorzustand nie gesehen hat? Dann bleibt er. Braucht er ihn, gehört er
  in die Commit-Message — die Historie ist bereits konserviert.
- Nutzersichtbare Änderungen kommen in `packages/twopoint5d/CHANGELOG.md` unter
  `Unreleased` (Skill `updating-changelog`); Commit-Messages folgen dem Stil von
  `git log` (Conventional Commits, Englisch).

## Vorbestehende Fehler
- keine

## Offene Befunde
Nebenbefunde aus den Paketen: was auch ohne diesen Lauf falsch war. Jeder
Eintrag wird beschlossen, bevor der Lauf endet — Paket oder Rückgabe ins Audit.
Ein leerer Abschnitt ist Abschlussbedingung, kein Zufall. Das Urteil am Ende
der Zeile misst den Eintrag an der Scope-Regel oben: `→ Scope`, `→ Audit`,
`→ Rückfrage`.

- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:560` — `#clearForInternalRT()` leert das interne RT von Mode C mit der aktuellen Clear-Farbe des Renderers bei Alpha 0, während `src/stage/README.md:204–206` »transparent black« verspricht; bei `renderer.alpha === false` bleibt deren RGB im Target stehen · Paket 1 (Zug 0), vorbestehend · low → Audit (gebucht als BUG-129)
- [x] `packages/twopoint5d/src/stage/StageRenderer.ts:567–576` — `#clearForInternalRT()` ruft bei `clear = true` nur `#applyClear()`; mit `clearColorBuffer` oder `clearDepthBuffer` auf `false` bleibt Farbe bzw. Depth des Vorframes im internen RT von Mode C stehen, während `src/stage/README.md:204–206` »always cleared … so frame content does not accumulate« verspricht · Paket 1 (Zug 2), vorbestehend · low → Audit (gebucht als BUG-130)

## Pakete

### [x] 1. Verschachteltes Kind-RT leeren, Pan-Tasten bei Fokusverlust und Eingaben zähmen, getForward als Richtung
- Findings: BUG-113 (high), BUG-121 (high), BUG-122 (medium), BUG-115 (medium), TEST-042 (medium, Teil: Zwei-Frame-Test verschachteltes Plain-Kind, verlorenes keyup), TEST-004 (low, Teil: `PanControl2D.spec.ts`)
- Ziel: Ein verschachtelter StageRenderer ohne Pipeline zeigt pro Frame nur den aktuellen Inhalt, PanControl2D bewegt die Ansicht nur mit tatsächlich gehaltenen Tasten außerhalb von Eingabefeldern, und `ProjectionPlane.getForward()` liefert für jede Ebene die Richtung — jeweils mit Tests, die ohne den Fix rot sind.
- Bereich: `packages/twopoint5d/src/stage/` (StageRenderer, ProjectionPlane), `packages/twopoint5d/src/controls/` (PanControl2D), `packages/twopoint5d-testing/test/`
- Hängt ab von: —
- Detail: docs/remediation/paket-1.md
- Hash: e2026856
- Ergebnis: 0 Runden · BUG-113, BUG-121, BUG-122, BUG-115 behoben, TEST-042 und TEST-004 im zugeteilten Teil erfüllt · Regressionstests, vor dem Fix rot: `a nested StageRenderer without clear gets its pass target cleared to transparent black on every frame` (StageRenderer.spec.ts), Browser `a nested StageRenderer without a pipeline shows only the content of the current frame` (stage-pipeline.test.js), `lets go of a held key when the window loses focus` / `…when the visibility of the page changes` und die Tastenfilter-Tests (PanControl2D.spec.ts, 12 rot), `getForward() > custom plane off the origin (constant = 1|5)` (ProjectionPlane.spec.ts) · klein: 2 Befunde in der Paketdatei
- Nebenbefunde: → Queue
- Folgen: keine
