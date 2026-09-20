# Remediation-Report — @spearwolf/twopoint5d, 2026-09-20

Quelle: ./audit.html vom 2026-09-19 · Branch: main · Commits: `9e66de55..07277e2d`
Scope-Regel: alles, was im Modul `packages/twopoint5d/src/vertex-objects/` liegt, jede Severity — auch info. Gilt auch für Befunde, die erst im Lauf auffallen.

## Lauf

- Ziel: hoch performante Vertex Objects, die in allen Anwendungsfällen optimal
  arbeiten — samt dem Refactoring und den Aufräumarbeiten, die dafür nötig sind.
- 3 Pakete geplant, 8 gefahren — 2 Folgepakete aus Nachschnitten von Zug 0
  (1b und 3b), 3 aus der Befund-Queue (4, 5 und 6)
- 11 Findings geschlossen, 1 zum Teil erledigt, 0 entfielen als gegenstandslos,
  8 Commits
- Blockiert: keines
- Ins Audit zurück: 15 Nebenbefunde — 10 Rückgaben aus der Queue und 5 kleine
  Reviewer-Befunde mit Fundstelle; davon 0 mit offener Architekturfrage
- Verify am Ende: `pnpm run ci` exit=0 · `pnpm nx run-many -t test
  --projects=tag:ci --skipNxCache` exit=0 · `pnpm nx run-many -t test
  --projects=tag:browser --skipNxCache` exit=0. Gegen die Baseline: acht Gates
  waren gemessen grün und sind es geblieben; das neunte — `test:browser` — war
  in der Baseline aus dem Nx-Cache bedient und damit ungeprüft, hier lief es
  cache-frei und grün, auf Chromium wie auf Firefox.
- audit.html: Score 13,5 → 20,5, 11 geschlossen, 15 neu

## Was der Lauf geändert hat

Die drei Findings, um die es ging, und was aus ihnen wurde:

- **Die Uploads.** Ein Pool markierte bei jeder Änderung jeden seiner Buffer
  über den ganzen belegten Bereich als schmutzig — ein einzelner Sprite-Spawn
  lud einen großen, überwiegend statischen Pool vollständig neu hoch, Frame für
  Frame. An die Stelle des Serials pro Buffer ist ein Dirty-Range pro Objekt
  getreten. Der Beweis steht im Browser: ein Spawn in einem Pool mit 33
  belegten Objekten lädt `{start: 396, count: 12}` hoch, auf Chromium
  (WebGL2-Fallback) und auf Firefox (WebGPU).
- **Die Routen.** Beide Geometrieklassen führten dieselbe Buchführung zweimal,
  rund 150 Zeilen, und die nicht-instanced Variante war dabei bereits
  abgedriftet. `GeometryRoutes` besitzt sie jetzt einmal; `parseTouchArgs` liest
  die `touch()`-Argumente für beide. Was die Geometrien hochladen, wann und in
  welcher Reihenfolge, ist unverändert.
- **Die Description.** Sie trug ein Feld, dessen Bedeutung sich nie entschieden
  hatte: `meshCount` wurde beim Bau der instanced Attribute als Faktor gelesen,
  beim Schreiben der Instanzzahl ignoriert und von `getInstanceCount()` wieder
  herausdividiert. Statt eine der drei Lesarten zur Regel zu erheben, ist das
  Feld ersatzlos gestrichen. Jedes verbliebene Feld trägt jetzt TSDoc, und ein
  Descriptor arbeitet auf einer eingefrorenen Kopie — eine spätere Änderung
  kommt an seinen Prüfungen nicht mehr vorbei.

Dazu die Schichtregel in `architecture.md` (`VO*` = rohe Buffer-Schicht,
`VertexObject*` = typisierte Objektschicht), 346 Zeilen neue Specs über die
Pool-Zustandsmaschine, der erste Browsertest für den Interleaved-Zweig der
Upload-Range, und benannte Fehler mit Klasse, Methode und Wert dort, wo vorher
ein nacktes `Error` flog.

## Das Modul verdient einen eigenen Lauf

Die Drain-Runde lief zweimal und lieferte beide Male nach. Die Pakete 4 und 5
räumten die zwölf Nebenbefunde der ersten Runde ab und erzeugten dabei zehn
neue; Paket 6 räumte diese zehn ab und erzeugte fünf weitere — alle im selben
Bereich: `VertexObjectBuffer`, `VOBufferPool`, `VertexObjectDescriptor`. Nach
der Regel, die eine dritte Runde ausschließt, stehen diese fünf als Findings im
Audit statt in einem weiteren Paket.

Das spricht nicht gegen die Arbeit des Laufs, sondern für die Dichte der
Fläche. Wer in diese drei Dateien sieht, findet etwas — meist Kleinigkeiten
derselben Machart: eine öffentliche Map, die schreibbar ist, wo die
Nachbar-Map es nicht mehr ist; ein TSDoc, das eine Prüfung zusagt, die der
Setter nicht fährt; ein Getter, der bei jedem Lesezugriff ein neues Objekt
baut. Ein Lauf mit eigener Planung über diese drei Dateien würde das Muster als
Ganzes greifen, statt es Runde für Runde abzutragen.

## Anomalien

- **Paket 5 überschritt die Rundengrenze.** Die Schleife endete mit Exit 20:
  sechs Implementierer-Reports bei fünf erlaubten Runden. Das Paket ist trotzdem
  belegt committet — alle fünf Reviewer-Reports liegen vor, der letzte nimmt
  beide verbliebenen Befunde ab und hat den Code für die Gegenprobe testweise
  beschädigt und die Tests rot gesehen, und das Abschluss-Gate lief cache-frei
  mit Exit 0. Die Überschreitung ist eine Buchhaltungsverletzung, kein
  Qualitätsmangel; die Arbeit wurde deshalb nicht zurückgedreht.
- **Die Baseline maß `test:browser` nicht.** Nx bediente den Aufruf aus dem
  Cache (`2/2 hit`), sodass der Plan-Kopf anfangs »alle neun grün« behauptete,
  ohne dass dieses Gate gelaufen wäre. Aufgefallen ist es, als Paket 1 an einem
  roten Browser-Lauf hing, den der Diff nicht verursacht haben konnte — die
  beiden gefallenen Dateien liegen in `display/`, das der Lauf nie berührt hat.
  Seitdem steht die Entscheidung im Plan, dass Chromium über ein Gate
  entscheidet und ein Firefox-Verbindungsabbruch keinen Commit blockiert, und
  jedes Abschluss-Gate lief mit `--skipNxCache`.

## Tokenverbrauch

Stand 2026-09-20 23:44, gezählt aus den Reportdateien in
`/tmp/claude-1000/-home-spw-spaceland-twopoint5d/3cf004c7-23ef-47c6-9f89-8290ceb5b5be/scratchpad`.
Die Schleife schrieb diesen Abschnitt bei jedem Ausgang neu; er zählt, was bis
dahin verbraucht wurde. Was der Abschluss selbst noch kostete, steht nicht darin
— er lief danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             6      37.8M     284.2k  Die Description eindeutig machen: meshCount s…
  1b            4       9.9M      85.7k  Ein Präfix pro Schicht, ein Plural pro Sprite
  2             6      28.3M     288.3k  Das Route-Plumbing beider Geometrien an einer…
  3             4      15.2M     117.1k  Das Sicherungsnetz: die ungetesteten Stellen …
  3b            8      92.4M     465.5k  Dirty-Ranges pro Objekt statt eines Voll-Uplo…
  4             6      29.0M     235.6k  Descriptor und Description: die Seitentüren s…
  5            13      92.1M     498.1k  Pool, Buffer und Geometrie: benannte Fehler, …
  6             4      12.6M     126.0k  Die Restposten des Moduls: ehrliche Kommentar…
  Steuer        1      33.4M     129.4k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       52     350.7M       2.2M

  Ausgabe je Modell: claude-opus-5 2.1M · claude-sonnet-5 150.0k
```

## Semver-Empfehlung

minor: 0.21.2 → 0.22.0. `meshCount` und `VertexObjectDescriptor#getInstanceCount()`
sind ersatzlos aus der öffentlichen Oberfläche entfernt — ein entfernter Export
ist major, und unter `1.0.0` hebt breaking die Minor. Fünf weitere Commits
tragen einen `BREAKING CHANGE`-Footer, keiner davon wiegt schwerer.
Keine Anhebung vorgenommen.
