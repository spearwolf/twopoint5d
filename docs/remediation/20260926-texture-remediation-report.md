# Remediation-Report — twopoint5d (Feature texture), 2026-09-26

Quelle: ./audit.html vom 2026-09-21 (nachgeführt 2026-09-25) · Branch: main · Commits: dff733ff..9ec5944e
Scope-Regel: die Feature-Domain texture vollständig, jede Severity einschließlich info und Optimierungspotenzial — `packages/twopoint5d/src/texture/**`, seine Specs, seine Doku und die Stellen in Lookbook und Browser-Tests, die texture benutzen. Gilt auch für Befunde, die erst im Lauf auffallen; Nebenbefunde außerhalb dieser Domain gehen als neues Finding ins Audit.

## Lauf
- Ziel: eine Feature-Domain texture ohne offene Findings als stabile Basis für die Weiterentwicklung
- 6 Pakete geplant, 12 gefahren — davon 2 aus der Teilung zu großer Pakete (rotierte Frames in den Konsumenten; Lookbook auf den Store), 2 Nachträge für Folgen früherer Pakete, 2 aus der Drain-Runde (Befund-Queue; kleine Reviewer-Befunde des Laufs)
- 34 Findings geschlossen (31 aus dem Backlog, 3 bisher zurückgestellte Umbenennungen), keines entfiel als gegenstandslos, 12 Commits
- Entscheidungen: TextureStore/TextureResource ist der einzige Lade-Weg, die vier Callback-Loader sind deprecated und das Lookbook lädt nur noch über den Store; relative URLs in Katalog- und Atlas-JSON gelten relativ zur JSON-Datei; TexturePacker »JSON Array« und rotierte Frames werden bis in Sprites und TileSprites unterstützt; neue Methodennamen (`activate()`, `loadAsync()`, `getAsync()`, `anisotropy`) mit deprecated Aliasen der alten
- Blockiert: keines
- Ins Audit zurück: 6 Nebenbefunde, 4 davon neu (2 schon im Backlog), 2 davon mit offener Frage zur Grenze texture/sprites — Duration 0 im AnimatedSpritesMaterial und die Lage getrimmter Frames in den Sprite-Konsumenten (die Daten liefert texture jetzt mit); dazu 1 kleiner Doku-Hinweis zum CHANGELOG aus dem letzten Paket
- Verify am Ende: `pnpm run ci` ✓ (Baseline ✓)
- audit.html: Score 73 → 78 (Code 77 → 85), 34 geschlossen, 5 neu; Fix-Bilanz: 23 selbst verursachte Befunde im Lauf behoben, 1 offen, 29 vorbestehende Nebenbefunde entdeckt

## Tokenverbrauch
Stand 2026-09-26 14:20, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0b6aa1e7-f4dd-40ca-8a4b-c96b3bffeabf/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             4      16.9M     123.7k  Sicherungsnetz: texture-Specs ordnen und die …
  2             6      27.1M     279.4k  TextureStore: Bild-Cache, Zustellung und Fehl…
  3             6      44.0M     319.9k  Katalog- und Atlasdaten validieren, relative …
  4             6      22.2M     189.3k  TextureCoords und Atlas-Format: rotierte Fram…
  5             4      14.3M     153.2k  TextureResource: Shape im Konstruktor, load()…
  6             4      34.3M     228.2k  API-Linie des Moduls: sprechende Namen, Abort…
  7             4       5.9M      54.2k  Nachtrag zu Paket 1: Meldungen von FrameBased…
  8             4      13.5M     135.4k  Nachtrag zu Paket 2: Fehler-Records nur für e…
  9             7      46.1M     256.3k  Rotierte Frames in den Konsumenten: Sprites, …
  10            4      16.5M     110.2k  Lookbook auf den Store: jede Demo lädt über T…
  11            6      24.7M     165.5k  Nachtrag aus der Befund-Queue: Resttexte, Feh…
  12            6      29.5M     164.7k  Nachtrag aus der Fix-Bilanz: die kleinen Revi…
  Steuer        1      12.8M      47.2k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       62     307.8M       2.2M

  Ausgabe je Modell: claude-opus-5-5 2.0M · claude-sonnet-5 228.8k
```

## Semver-Empfehlung
minor (unter 1.0.0 für breaking): 0.21.2 → 0.22.0. `TextureResource.refCount` ist nur noch lesbar, und `TextureStore#getAsync()`/`get()` rejectet bei einem Ladefehler, statt unbegrenzt zu warten — Code, der `refCount` schreibt oder auf das Hängen baut, bricht.
Keine Anhebung vorgenommen.
