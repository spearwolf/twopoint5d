# Remediation-Report — @spearwolf/twopoint5d (Vertex Objects), 2026-09-23

Quelle: ./audit.html vom 2026-09-22 · Branch: main · Commits: `3deb43eb..3835f95d`
Scope-Regel: alles, was im Modul `packages/twopoint5d/src/vertex-objects/` oder in dessen Tests liegt (Specs im Modul und die `vertex-objects-*`-Suiten in `packages/twopoint5d-testing/test/`), jede Severity inklusive info, dazu BUG-101 samt seinem map2d-Anteil — gilt auch für Befunde, die erst im Lauf auffallen

## Lauf

- Ziel: das Modul `vertex-objects` ohne offene Issues und Bugs, als stabile Basis für
  neue Entwicklungen.
- 3 Pakete geplant, 4 gefahren — davon 0 Folgepakete, 1 aus der Befund-Queue
- 19 Findings geschlossen, 0 entfielen als gegenstandslos, 4 Commits
- Blockiert: keines
- Im Lauf mit behoben: 6 Nebenbefunde (Typen von `VertexObjects#geometry`,
  `TileSprites#geometry` und `#material`, die Rückgabe von `createVertexObject()`, zwei
  TSDoc-Stellen im Pool) und 2 Reviewer-Befunde aus Paket 3
- Ins Audit zurück: 2 Nebenbefunde außerhalb der Scope-Regel (Truthiness-Prüfung in
  `Map2DTileRenderer`, Typen von `AnimatedSprites`) und 1 kleiner Reviewer-Befund
  (doppelter Satz im TSDoc von `TileSprites`); davon 0 mit offener Architekturfrage
- Verify am Ende: `pnpm run ci` exit=0 · `pnpm nx run-many -t test --projects=tag:browser
  --skipNxCache` exit=0. Die Baseline war grün, `test:browser` darin aus dem Nx-Cache;
  am Ende lief die Browser-Suite cache-frei und grün.
- audit.html: Score 64 → 66 (Code 64 → 67), 19 geschlossen, 3 neu

## Was der Lauf geändert hat

- **Pool-Erschöpfung.** `IMapTileFactory#createTile()` antwortet `undefined` nur noch für
  »kein Tile an dieser Koordinate«. Ein voller `TileSpritesGeometry`-Pool antwortet mit
  `noTileCapacity`. Der `Map2DTileRenderer` warnt dann einmal und fragt das Tile erneut an,
  sobald ein Slot frei wird. Bei vollem Pool bleiben keine Löcher mehr in der Karte stehen.
- **Pool-Verträge.** `voInitialize` läuft genau einmal pro Slot, den `createVO()` vergibt.
  Der Buffer eines Pools, der `voPrototype` eines Descriptors und die Layout-Maps eines
  Buffers sind von außen nur lesbar.
- **Eingaben und Zustand.** `toAttributeArrays()` und `copyWithin()` weisen Indizes
  außerhalb des Buffers ab. Ein Attribut ohne `size` und ohne `components` wirft. Nach
  `dispose()` ist `update()` einer Geometrie ein No-op, und `attachInstancedPool()` wirft.
- **Per-Frame-Pfad.** Die generierten Getter schreiben in ein übergebenes Zielarray, und
  Setter mit bis zu vier Werten haben feste Parameter; Sprites und Tile-Factory allokieren
  pro Frame nichts mehr. `toBuffersData({copy: true})` liefert echte Kopien.
- **Typen.** `VertexObjects` und `TileSprites` sind generisch über die Geometrie und sagen
  ohne Geometrie-Argument, was three dort tatsächlich hält.

## Übergabe

Der Workaround in `packages/twopoint5d-testing/test/vertex-objects-gpu-upload.test.js`
umgeht einen three-Fehler (r185, WebGLBackend: `getArrayBufferAsync()` liefert für ein
`InterleavedBufferAttribute` einen leeren Buffer). Upstream gibt es dazu kein Issue. Ein
Kanarientest schlägt an, sobald three den Fehler behebt. Ein Issue-Entwurf steht in
`paket-3.md` dieses Laufs (`git show <Archiv-Commit>^:docs/remediation/paket-3.md`,
Abschnitt »Übergabe an den Abschluss«). Anlegen kann es nur der Maintainer.

## Tokenverbrauch

Stand 2026-09-23 09:38, gezählt aus den Reportdateien in `/tmp/claude-1000/-home-spw-spaceland-twopoint5d/0d0399b5-d123-4279-a37c-2edeed6afc51/scratchpad`.
Die Schleife schreibt diesen Abschnitt bei jedem Ausgang neu; er zählt, was
bis dahin verbraucht wurde. Was der Abschluss selbst noch kostet, steht nicht
darin — er läuft danach.

```
  Paket  Prozesse    Eingabe    Ausgabe
  1             6      23.0M     176.3k  Pool-Verträge: Erschöpfung, Erzeugungs-Hook u…
  2             6      70.9M     225.5k  Buffer und Descriptor: Prüfungen, schreibgesc…
  3             4      27.9M     151.8k  Accessoren ohne Allokation, Specs und Doku-Li…
  4             6      22.7M     169.8k  Drain: Typen der Mesh-Geometrie, createVertex…
  Steuer        1       3.7M      20.7k  Plan, Start, Abschluss — die Session daneben
  ------ -------- ---------- ----------
  gesamt       23     148.3M     744.2k

  Ausgabe je Modell: claude-opus-5-5 496.7k · claude-sonnet-5 247.5k
```
## Semver-Empfehlung

minor (unter 1.0.0 = breaking): `@spearwolf/twopoint5d` 0.21.2 → 0.22.0.
`IMapTileFactory#createTile()` erweitert seinen Rückgabetyp um `typeof noTileCapacity`.
Fremde Factories und Renderer, die diesen Vertrag implementieren oder konsumieren, müssen
den neuen Fall behandeln. Keine Anhebung vorgenommen.
