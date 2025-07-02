# Gemini Project Context: twopoint5d

Dieses Dokument gibt eine Übersicht über das `twopoint5d`-Projekt, um die KI-gestützte Entwicklung zu unterstützen.

## 1. Projektübersicht

`twopoint5d` ist eine TypeScript-Bibliothek für 2.5D-Rendering in HTML5 Canvas. Das Projekt ist als Monorepo mit [NX](https://nx.dev/) und [pnpm](https://pnpm.io/) Workspaces aufgebaut.

### Paket-Struktur

-   `packages/twopoint5d`: Die Kernbibliothek. Enthält die Hauptlogik und die dazugehörigen Unit-Tests (mit `vitest`).
-   `packages/twopoint5d-testing`: Ein separates Paket für Browser-basierte Integrations- und End-to-End-Tests (mit `@web/test-runner`).
-   `apps/lookbook`: Eine Demo-Anwendung (erstellt mit [Astro](https://astro.build/)), die als visuelles Schaufenster für die Features der Bibliothek dient.
-   `docs`: Enthält loose Dokumentation und unsortierte Anleitungen für die Verwendung der `twopoint5d` Bibliothek.

## 2. Wichtige Technologien

-   **Sprache:** TypeScript
-   **Paketmanager:** pnpm (mit Workspaces und `catalog:`)
-   **Monorepo-Tool:** NX
-   **Unit-Tests:** Vitest
-   **Integrations-Tests:** Web Test Runner (`@web/test-runner`)
-   **Linting:** ESLint
-   **Formatierung:** Prettier
-   **Demo-App:** Astro

## 3. Entwicklungs-Workflow

Alle Befehle sollten vom Projekt-Root-Verzeichnis ausgeführt werden. Bevorzuge immer die Top-Level-Skripte aus der root `package.json`, da sie den gesamten Workspace abdecken.

### Installation

Um alle Abhängigkeiten zu installieren, führe folgenden Befehl aus:

```bash
pnpm install
```

### Code-Analyse & Formatierung

Um den Code auf Stil- und Qualitätsfehler zu überprüfen:

```bash
# Führt ESLint für den gesamten Workspace aus
pnpm lint
```

### Bauen (Building)

Der folgende Befehl baut alle Pakete und Anwendungen im Workspace:

```bash
# Baut alle Projekte (twopoint5d, lookbook, etc.)
pnpm build
```

Um nur ein bestimmtes Paket zu bauen, kann `nx` verwendet werden:
`nx build twopoint5d`

### Testen

Die Test-Strategie ist zweigeteilt:

1.  **Unit-Tests:** Liegen direkt bei den Modulen in `packages/twopoint5d/src` und verwenden `vitest`.
2.  **Browser-Tests:** Befinden sich in `packages/twopoint5d-testing` und verwenden `@web/test-runner`, um das Verhalten im echten Browser zu prüfen.

Um **alle** Tests auszuführen, nutze das Haupt-Skript:

```bash
# Führt alle Tests im Workspace aus (Unit und Browser)
pnpm test
```

Um Tests gezielt auszuführen:
`nx test twopoint5d` (führt vitest-Tests aus)
`nx test twopoint5d-testing` (führt web-test-runner-Tests aus)

### Demo-Anwendung starten

Die `lookbook`-App dient zur visuellen Demonstration der Bibliotheks-Features.

```bash
# Startet den Astro-Dev-Server für die Demo-App
pnpm lookbook
```

Die Anwendung ist dann unter `http://localhost:4321` verfügbar.

### Kompletter Validierungs-Zyklus

Das `ci`-Skript simuliert den Workflow, der in der Continuous Integration läuft. Es ist der beste Weg, um vor einem Commit sicherzustellen, dass alles funktioniert.

```bash
# Führt eine saubere Installation, Linting, Build und alle Tests aus
pnpm run ci
```

## 4. Coding Conventions

-   Bitte halte dich an den bestehenden Code-Stil.
-   Der Code ist in TypeScript geschrieben und sollte stark typisiert sein.
-   Alle öffentlichen APIs sollten mit TSDoc-Kommentaren dokumentiert werden.
-   Wesentliche Änderungen sollten durch Tests abgedeckt sein (Unit-Tests für Logik, Browser-Tests für visuelles Verhalten).
-   Commit-Nachrichten sollten dem [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) Standard folgen.

## 5. Veröffentlichung (Publishing)

Die Veröffentlichung auf npm wird durch benutzerdefinierte Skripte im `scripts/`-Verzeichnis gesteuert. Führe diese Skripte nicht ohne explizite Anweisung aus.
