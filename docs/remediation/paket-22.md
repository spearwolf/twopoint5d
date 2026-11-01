# Paket 22 — DisplayFullscreen: TSDoc von `isArmed` in den Change-Props nachziehen

Gehört zu `./remediation-plan.md`. Dort stehen Marke, Hash und der Stand des
Laufs, hier die Einzelheiten dieses Pakets. Bei Widerspruch gilt der Plan.

- Findings: — (Nachtrag zu Paket 18: dessen `Folgen:`-Zeile, im Zug 0 von Paket 19 als Symptom eingeordnet)
- Folge von: Paket 18
- Ziel: Das TSDoc von `DisplayFullscreenChangeProps.isArmed` sagt, was Getter, Proposal §3.2 und Guide seit Paket 18 sagen: nie `true`, solange das Ziel im Fullscreen ist — wer ihn auch betreten hat, nativ oder pseudo — oder unter einem darauf gestapelten Element liegt.
- Modell: günstigste Stufe (haiku)
- Effort: low
- Dateien: `packages/twopoint5d/src/display/types.ts` — nur diese eine Datei
- Vorgehen:
  1. In `packages/twopoint5d/src/display/types.ts`, im `interface DisplayFullscreenChangeProps`
     (`:67-76`), steht über `isArmed: boolean;` (`:73`) an `:72` genau diese Zeile:

     ```ts
       /** `onLandscape` waits for a tap to enter fullscreen. */
     ```

     Ersetze sie durch genau diese vier Zeilen (zwei Leerzeichen Einzug vor `/**`, drei vor
     jedem `*`, Gedankenstriche als `—` U+2014 wie im Getter):

     ```ts
       /**
        * `onLandscape` waits for a tap on the target to enter fullscreen, see
        * {@link DisplayFullscreen.isArmed}. Never `true` while the target is in fullscreen — whoever
        * entered it, native or pseudo — or lies under an element stacked on it.
        */
     ```

     `isArmed: boolean;` darunter bleibt, wie es ist.
  2. Kein neuer Import: `import type {DisplayFullscreen} from './DisplayFullscreen.js';` steht
     schon an `:4` und dient bereits dem `{@link DisplayFullscreen}` an `:29`.
  3. Nicht anfassen: die Props `display`, `isActive`, `mode` (bleiben ohne TSDoc, siehe
     Anmerkungen), `element` (`:74`), den Getter `isArmed` in `src/display/DisplayFullscreen.ts:447-456`,
     `docs/proposals/display-fullscreen.md` (§3.2 `:146`, §3.3 `:221`), `docs/display.md` (`:505-506`,
     Tabelle `:660`), `CHANGELOG.md`. Kein Spec, kein Browser-Test.
  4. Kein Regressionstest: reine Doku-Änderung ohne Verhalten; der Beleg ist das grüne Gate
     (`lint`, `typecheck`, `checkPkgTypes` sehen den Kommentar im `.d.ts`).
  5. Vor dem Verlassen der Datei `types.ts` ganz lesen (217 Zeilen) und melden, was darin falsch
     ist und nicht zu diesem Paket gehört.
- Verify: `pnpm run ci`
- Commit: `docs(twopoint5d): say in the props of a fullscreen change that isArmed is never true while the target is in fullscreen`
- Verlauf:
  - 2026-11-01 Zug 0: Detailplan steht · Folge aus Paket 18 unverändert an
    `packages/twopoint5d/src/display/types.ts:72` (Datei zuletzt in 7cbe35c6 geändert, vor dem
    Lauf; `src/display/` seit 1a8ec51e unberührt) · Wortlaut der Geschwister geprüft: Getter
    `DisplayFullscreen.ts:447-450`, Proposal `display-fullscreen.md:146`, Guide `docs/display.md:505-506`
    und `:660` tragen die Zusage · offene Folgen: keine weiteren (Paket 19 »keine offenen«) ·
    »Offene Befunde«: `DisplayFullscreen.ts:907ff.` (`onLandscape` neben fremdem Fullscreen) und
    `docs/display.md:510-511` (`#declined` nur für den eigenen Fullscreen) teilen die Ursache
    nicht, bleiben liegen; `src/` (handgesetzte Anführungszeichen, `→ Rückfrage`) ebenso
  - 2026-11-01 Zug 1: Implementierer beauftragt (haiku, low), Report `paket-22.impl-0.json`
  - 2026-11-01 Zug 2: FERTIG_MIT_VORBEHALT (CHANGELOG — in Zug 0 bewusst ausgeschlossen), geändert `packages/twopoint5d/src/display/types.ts`, Arbeitsbaum schmutzig, Verify exit=0 (`paket-22.verify.log`)
  - 2026-11-01 Zug 3: Reviewer (sonnet, low) — erfüllt, keine kritischen/wichtigen, 1 klein; Diff `paket-22.diff`
  - 2026-11-01 Zug 5: Commit 8379ebe7, 0 Runden

## Abgleich

**Folge aus Paket 18 · `packages/twopoint5d/src/display/types.ts:72`** — unverändert. Dort steht
`/** \`onLandscape\` waits for a tap to enter fullscreen. */` über `isArmed: boolean;`. Die
Change-Props tragen den Wert, den der Getter zum Zeitpunkt der Auslieferung liefert
(`DisplayFullscreen.ts:1023-1032`, `#emitIfChanged()` → `this.#host.emit({…, isArmed, …})`), also gilt die
Zusage des Getters wörtlich auch hier. Die übrigen drei Stellen, die sie beschreiben:

- Getter `DisplayFullscreen.ts:447-450`: »Never `true` while the target is in fullscreen — whoever
  entered it, native or pseudo — or lies under an element stacked on it.«
- Proposal `docs/proposals/display-fullscreen.md:146` (§3.2): »never while the target is in
  fullscreen«.
- Guide `docs/display.md:505-506`: »Once the target is in fullscreen, whoever put it there,
  `isArmed` is `false`«; Tabelle `:660`: »never while in fullscreen«.

## Entscheidungen dieses Zugs

- **Wortlaut des Getters, nicht der Kurzform aus Proposal und Guide.** Die Props sind das, was
  ein Listener beim Destrukturieren (`({isArmed}) => …`, `docs/display.md:496`) im Editor sieht;
  der Getter ist die vollständigste der drei Fassungen und nennt auch das gestapelte Element. Die
  Zeile »A page can show a hint by it.« und »`false` after dispose« des Getters bleiben dort —
  das Ziel verlangt die Zusage, nicht eine Kopie des ganzen Getter-Texts.
- **`{@link DisplayFullscreen.isArmed}` dazu.** Präzedenz in derselben Datei (`:29`, `:13-24`),
  der Typ-Import steht schon; der Leser kommt vom Prop zum Getter mit dem Rest der Zusagen.
- **`isActive`, `mode`, `display` bleiben ohne TSDoc.** Kein Nebenbefund: die Props-Interfaces
  dieser Datei dokumentieren nur Felder, deren Bedeutung der Name nicht trägt
  (`DisplayEventProps` `:6-26` dokumentiert allein `deltaTime` und `rawDeltaTime`), und Paket 18
  hat die Semantik von `isActive`/`mode` nicht geändert. Die Prüffrage für ein Symptom — wäre der
  Eintrag nie entstanden, hätte Paket 18 seine Ursache zu Ende behoben? — verneint beide.
- **Kein CHANGELOG-Eintrag.** Fullscreen ist unveröffentlicht und steht nur unter `[Unreleased]`
  (`CHANGELOG.md:8`); die `Added`-Zeilen `:28` und `:30` nennen `isArmed`, ohne der Zusage zu
  widersprechen.
- **Commit-Typ `docs`.** Kein Verhalten ändert sich, nur das TSDoc im ausgelieferten `.d.ts`;
  Präzedenz 46528b84 (`docs(twopoint5d): …`).
- **Modell günstigste Stufe, Effort low.** Transkription: eine Datei, benannte Zeile, exakter
  Ersatztext. Höherer Effort erhöhte nur die Neigung, die Geschwister-Props mitzudokumentieren.

## Triage »Offene Befunde« (Zug 0)

Der Plan fragt beim Paket, ob einer der beiden Nebenbefunde derselben Datei aus Paket 18 die
Ursache teilt. Keiner tut es:

- `DisplayFullscreen.ts:907`/`:938-940`/`:352`/`:282-291` (`onLandscape` fragt an bzw. schaltet
  scharf, während ein fremdes Element im Fullscreen liegt, das das Ziel nicht trägt) — Ursache ist
  die Regel in `#holdsTarget()`/`#turned()`, welcher fremde Fullscreen sperrt; das ist Verhalten,
  nicht die Doku der Props. Bleibt `→ Scope` in der Queue. Ändert die Drain-Runde dort die Regel
  für das Scharfschalten, ändert sie die Zusage von `isArmed` — dann gehört das neue TSDoc der
  Change-Props aus diesem Paket zu den Stellen, die sie nachzieht (Vermerk am Queue-Eintrag).
- `docs/display.md:510-511` mit `DisplayFullscreen.ts:806-810`/`:922-928` (`#declined` nur für den
  Fullscreen von `onLandscape`) — Ursache ist der Zustand `#declined` bzw. ein zu weiter Guide-Satz,
  nicht `isArmed` in den Props. Bleibt `→ Scope`.
- `packages/twopoint5d/src/` (handgesetzte `"${…}"`, `→ Rückfrage`) — andere Datei, andere Ursache.

## Findings im Volltext

Keine Audit-Findings. Die Folge im Wortlaut der `Folgen:`-Zeile von Paket 18:

**Folge von Paket 18 · `packages/twopoint5d/src/display/types.ts:72`** — TSDoc von
`DisplayFullscreenChangeProps.isArmed` (»`onLandscape` waits for a tap to enter fullscreen.«) trägt
den Zusatz »never while the target is in fullscreen« nicht, den Getter, Proposal §3.2 und Guide
jetzt nennen; nicht falsch, aber unvollständig gegenüber den Geschwistern. Im Zug 0 von Paket 19
(2026-11-01) als Symptom von Paket 18 eingeordnet: die Semantik ist geändert, eine der vier
Stellen, die sie beschreiben, nicht nachgezogen.

## Review

- Folge aus Paket 18 · `packages/twopoint5d/src/display/types.ts:72-76` — behoben; deckt sich mit dem Getter `DisplayFullscreen.ts:447-452`.
- Klein: Prop und Getter tragen jetzt fast denselben Text; ändert die Drain-Runde die Zusage, ziehen beide mit (am `→ Scope`-Eintrag zu `onLandscape` neben fremdem Fullscreen schon vermerkt).
- Implementierer: `types.ts` ganz gelesen, keine Nebenbefunde.
