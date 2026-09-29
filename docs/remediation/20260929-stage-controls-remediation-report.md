# Remediation-Report — @spearwolf/twopoint5d (Stage und Input-Controls), 2026-09-29

Quelle: ./audit.html vom 2026-09-29 · Branch: main · Commits: `e2026856`
Scope-Regel: alles ab medium, jede Kategorie — gilt für Befunde, die erst im Lauf auffallen;
darunter geht ins Audit

## Lauf

- Ziel: Ein verschachtelter `StageRenderer` ohne Pipeline zeigt pro Frame nur den aktuellen
  Inhalt, `PanControl2D` bewegt die Ansicht nur mit tatsächlich gehaltenen Tasten außerhalb
  von Eingabefeldern, und `ProjectionPlane.getForward()` liefert für jede Ebene die
  Richtung — jeweils mit Tests, die ohne den Fix rot sind.
- 1 Paket geplant, 1 gefahren — davon 0 Folgepakete, 0 aus der Befund-Queue
- 4 Findings geschlossen, 2 Testlücken-Findings im zugeteilten Teil erfüllt und mit dem
  verbleibenden Rest im Audit nachgeführt (Pixel-Test für Mode E; Touch, zweiter Pointer,
  `pointercancel`), 0 entfielen als gegenstandslos, 1 Commit, 0 Nachrunden
- Blockiert: keines
- Ins Audit zurück: 2 Nebenbefunde unter der Scope-Regel (das interne RenderTarget von
  Mode C wird nicht zu echtem transparentem Schwarz geleert und bei abgeschaltetem
  Buffer-Clear nur teilweise), 3 kleine Reviewer-Befunde (ein Inline-Kommentar in
  `PanControl2D#unsubscribe()`, ein redundanter Shadow-Root-Test, der zweite Clear pro
  Frame für ein verschachteltes Kind mit eigenem `clear`); davon 0 mit offener
  Architekturfrage
- Verify am Ende: `pnpm run ci` exit=0 · `pnpm nx run-many -t test --projects=tag:browser
  --skipNxCache` exit=0. Die Baseline war grün; die Browser-Suite lief am Ende cache-frei.
- audit.html: Score 75 → 78 (Code 84 → 89), 4 geschlossen, 5 neu

## Was der Lauf geändert hat

- **Verschachtelter StageRenderer.** Der komponierende Parent leert das Pass-Target jedes
  Kindes vor dem Vorab-Rendern zu transparentem Schwarz, Farbe und Depth. Ein Kind mit
  `clear` leert danach mit seiner eigenen Farbe. Bewegte Sprites ziehen keine Schlieren
  mehr, und alte Depth-Werte verdecken keine neue Geometrie. Das Audit hatte den Clear »wie
  in Mode C« empfohlen; der Lauf leert bewusst immer zu echtem Schwarz, weil die
  `RootRenderPipeline` Pass-Knoten addiert und eine Renderer-Clear-Farbe sonst je Kind
  mitkäme.
- **PanControl2D.** Verliert das Fenster den Fokus oder wird die Seite versteckt, lässt der
  Control jede gehaltene Taste los. Tasten mit Ctrl, Meta oder Alt und Tasten, die in ein
  `input`, `textarea`, `select` oder `contenteditable` gehen (auch in einem offenen Shadow
  Root), lösen kein Panning aus; eine Option dafür gibt es nicht. Neu ist
  `PanControl2D.spec.ts` für Fokusverlust, Tastenfilter und Optionen.
- **ProjectionPlane.** `getForward()` gibt die negierte Normale zurück, damit stimmen
  `getRight()` und `getPoint()` auch für Ebenen abseits des Ursprungs.

## Tokenverbrauch

Stand 2026-09-29 14:26, gezählt aus den Reportdateien in `/private/tmp/claude-501/-Users-spw-spaceland-twopoint5d/463e3d2c-0682-4a9d-890c-15c352bad82e/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             5      20.1M     150.1k  Verschachteltes Kind-RT leeren, Pan-Tasten be…
  Steuer        1       2.2M      14.4k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt        6      22.3M     164.4k

  Ausgabe je Modell: claude-opus-5-5 164.4k
```

## Semver-Empfehlung

minor: 0.21.2 → 0.22.0. Bestimmend ist das geänderte Default-Verhalten von `PanControl2D`:
Tasten mit Ctrl, Meta oder Alt und Tasten aus editierbaren Elementen lösen kein Panning mehr
aus. Unter 1.0.0 hebt ein Bruch die Minor-Stufe. Der `Unreleased`-Block trägt ohnehin schon
Breaking Changes, die dieselbe Stufe verlangen. Keine Anhebung vorgenommen.
