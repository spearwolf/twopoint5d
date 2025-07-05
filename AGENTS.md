# Agent Project Context: `twopoint5d`

Dieses Dokument bietet eine umfassende Übersicht über das `twopoint5d`-Projekt, um die KI-gestützte Entwicklung zu beschleunigen. Es dient als primäre Wissensquelle für jeden Agenten, der an diesem Projekt arbeitet.

## 1. Projektübersicht

`twopoint5d` ist eine TypeScript-Bibliothek für 2.5D-Rendering in HTML5 Canvas, die auf **three.js** aufbaut. Der Begriff "2.5D" bezieht sich hier auf das Rendern von 2D-Grafiken (wie Sprites oder Billboards) in einer 3D-Umgebung, um einen Tiefeneffekt zu erzeugen.

Die Bibliothek ist **kein** Framework, das three.js kapselt, sondern eine Sammlung von Werkzeugen und Klassen, die innerhalb eines bestehenden three.js-Projekts verwendet werden können, um spezifische 2.5D-Funktionen hinzuzufügen.

Das Projekt ist als **Monorepo** mit **NX** und **pnpm Workspaces** strukturiert.

Ignoriere alle anderen Dateien im Repository, die in den .gitignore-Dateien ausgeschlossen sind. Konzentriere dich ausschließlich auf die Dateien im `packages/`- und `apps/`-Verzeichnis.

Ignore den kompletten Ordner apps/handbook/docs/.vitepress/cache und lese niemals daraus Files ein.

---

## 2. Entwicklungs-Workflow & Wichtige Befehle

Alle Befehle sollten vom Projekt-Root-Verzeichnis ausgeführt werden. Die Top-Level-Skripte in der root `package.json` sind zu bevorzugen, da sie den gesamten Workspace abdecken.

-   **Installation:**
    ```bash
    pnpm install
    ```
    Installiert alle Abhängigkeiten für alle Pakete und Anwendungen im Monorepo.

-   **Code-Qualität:**
    ```bash
    pnpm lint
    ```
    Führt ESLint für den gesamten Workspace aus, um Stil- und Qualitätsfehler zu finden.

-   **Bauen (Building):**
    ```bash
    pnpm build
    ```
    Kompiliert alle Pakete und Anwendungen (`twopoint5d`, `lookbook`, `handbook`). Um nur ein Paket zu bauen, verwende `nx build <projektname>` (z.B. `nx build twopoint5d`).

-   **Testen:**
    ```bash
    pnpm test
    ```
    Führt **alle** Tests im Workspace aus. Dies umfasst:
    -   **Unit-Tests** (`vitest`) im `twopoint5d`-Paket.
    -   **Browser-Tests** (`@web/test-runner`) im `twopoint5d-testing`-Paket.

-   **Demo-Anwendungen starten:**
    -   **Lookbook (visuelles Schaufenster):**
        ```bash
        pnpm lookbook
        ```
        Startet die Astro-basierte Demo-App, die unter `http://localhost:4321` verfügbar ist.
    -   **Handbook (Dokumentation):**
        ```bash
        pnpm handbook
        ```
        Startet die VitePress-basierte Dokumentationsseite, die unter `http://localhost:5173` verfügbar ist.

-   **Kompletter Validierungs-Zyklus (CI):**
    ```bash
    pnpm run ci
    ```
    Simuliert den Continuous-Integration-Prozess: saubere Installation, Linting, Build und alle Tests. **Dies ist der empfohlene Befehl vor jedem Commit.**

---

## 3. Paket-Struktur des Monorepos

-   `packages/twopoint5d`: **Die Kernbibliothek.** Enthält die gesamte Logik, Klassen und Shader. Hier findet die meiste Entwicklungsarbeit statt.
-   `packages/twopoint5d-testing`: Ein separates Paket für **Browser-basierte Integrationstests**. Diese Tests stellen sicher, dass die visuellen Komponenten im echten Browser korrekt funktionieren.
-   `apps/lookbook`: Eine **Demo-Anwendung** (erstellt mit Astro), die als visuelles Schaufenster für die Features der Bibliothek dient. Ideal, um Änderungen live zu testen und zu demonstrieren.
-   `apps/handbook`: Eine **VitePress-basierte Web-Anwendung**, die die offizielle Dokumentation und das Handbuch der Bibliothek enthält. Die Dokumentationen sind im Verzeichnis `apps/handbook/docs/` als Markdown-formatierte Files zu finden.

---

## 4. Architektur und Struktur der `twopoint5d` Bibliothek

Die Quellcode-Dateien der `twopoint5d` Bibliothek befinden sich im Verzeichnis `packages/twopoint5d/src`. Die Architektur ist modular aufgebaut und auf hohe Performance durch direkte GPU-Kommunikation ausgelegt.

### 4.1. Kernkonzepte

-   **Vertex Objects (VO):** Das zentrale Performance-Feature. Statt mit tausenden von `three.js`-Objekten zu arbeiten, die hohe CPU-Kosten verursachen, fasst `twopoint5d` die Daten für ähnliche Objekte (z.B. Sprites) in großen `BufferGeometry`-Instanzen zusammen. Die `vertex-objects`-Abstraktion bietet eine einfache, objektorientierte API (`VO`-Klassen), um einzelne Objekte in diesen Buffern zu manipulieren. Änderungen werden effizient und gebündelt an die GPU übertragen. Dieses Konzept minimiert den JavaScript-Overhead und maximiert den Durchsatz.
-   **Display & Stage:** `Display` ist ein Wrapper um den `three.js`-Renderer und die `canvas`-Erstellung. Er managt den Render-Loop, die Größe des Viewports und die Zeit (Delta-Time). Eine `Stage` ist eine 2D-Szene mit einer spezifischen Projektion (orthographisch oder perspektivisch), in die Objekte wie Sprites platziert werden. Mehrere Stages können in einem `StageRenderer` kombiniert werden, um komplexe Szenen mit unterschiedlichen Parallaxen-Ebenen zu erzeugen.
-   **Texture Management:** Das `texture`-Modul bietet Werkzeuge zum Laden und Verwalten von Texturen. `TextureAtlas` und `TileSet` sind Schlüsselklassen, um Sprites aus Spritesheets zu extrahieren. Der `TextureStore` ist ein zentraler Cache, der das Laden, die Wiederverwendung und die Konfiguration von Texturen im gesamten Projekt vereinfacht.

### 4.2. Modul-Struktur (`packages/twopoint5d/src`)

-   `vertex-objects/`: **(Basis-Schicht)**
    -   **Zweck:** Low-Level-Abstraktion für die direkte Verwaltung von GPU-Daten.
    -   **Wichtige Klassen:**
        -   `VertexObjectDescriptor`: Beschreibt die Struktur eines Vertex-Objekts (Attribute, Datentypen, Puffer-Layout).
        -   `VertexObjectPool`: Verwaltet einen Pool von Vertex-Objekten und die dazugehörigen TypedArrays.
        -   `VOBufferGeometry`, `InstancedVOBufferGeometry`: `three.js`-Geometrien, die die Daten aus dem `VertexObjectPool` für das Rendering bereitstellen.
    -   **Zusammenhang:** Dies ist das Fundament, auf dem die `sprites` aufbauen. Änderungen hier haben weitreichende Auswirkungen.

-   `sprites/`: **(Rendering-Schicht)**
    -   **Zweck:** Stellt konkrete, wiederverwendbare Rendering-Komponenten bereit.
    -   **Wichtige Klassen:**
        -   `TexturedSprites`: Für statische Sprites aus einem Texture-Atlas.
        -   `AnimatedSprites`: Für Sprites mit Frame-basierter Animation.
        -   `TileSprites`: Optimiert für das Darstellen von großen, kachelbasierten Karten.
        -   `*Material`: Jede Sprite-Art hat ihr eigenes `ShaderMaterial`, das die Logik für das Rendering (z.B. Textur-Lookups, Animationen) im Vertex- und Fragment-Shader enthält.
    -   **Zusammenhang:** Baut direkt auf `vertex-objects` auf. Nutzt `TextureAtlas` aus dem `texture`-Modul.

-   `display/`: **(Setup- & Loop-Schicht)**
    -   **Zweck:** Vereinfacht das Setup der Szene und den Render-Loop.
    -   **Wichtige Klassen:**
        -   `Display`: Hauptklasse, die den `three.js`-Renderer, das Canvas und den `requestAnimationFrame`-Loop kapselt. Stellt Events wie `onRenderFrame` bereit.
        -   `Chronometer`: Zeitmessung (Totalzeit, Delta-Time).
        -   `FrameLoop`: Steuert die Framerate.
    -   **Zusammenhang:** Bildet den Rahmen, in dem `Stage` und `StageRenderer` operieren.

-   `stage/`: **(Szenen- & Projektions-Schicht)**
    -   **Zweck:** Definiert den 2D-Raum und die Kamera-Projektion.
    -   **Wichtige Klassen:**
        -   `Stage2D`: Eine 2D-Szene, die eine `IProjection` verwendet, um eine `three.js`-Kamera zu konfigurieren.
        -   `StageRenderer`: Kann mehrere `Stage2D`-Instanzen verwalten und in einer bestimmten Reihenfolge rendern (z.B. für Vordergrund, Hintergrund).
        -   `OrthographicProjection`, `ParallaxProjection`: Definieren, wie die 2D-Koordinaten der Stage auf den 3D-Raum abgebildet werden.
    -   **Zusammenhang:** `StageRenderer` wird typischerweise an ein `Display`-Objekt angehängt. In einer `Stage2D` werden dann die `sprites` platziert.

-   `texture/`: **(Asset-Management-Schicht)**
    -   **Zweck:** Laden, Parsen und Verwalten von Texturen und Sprite-Definitionen.
    -   **Wichtige Klassen:**
        -   `TextureAtlas`: Repräsentiert ein Spritesheet und enthält Koordinaten (`TextureCoords`) für einzelne Frames.
        -   `TileSet`: Spezialisierter Atlas für Kacheln gleicher Größe.
        -   `TextureStore`: Zentraler Service zum Laden und Cachen von Textur-Ressourcen (Bilder, JSON-Atlanten).
        -   `FrameBasedAnimations`: Definiert Animationen als eine Sequenz von Frames aus einem `TextureAtlas`.
    -   **Zusammenhang:** Wird von den `sprites` genutzt, um die richtigen Texturausschnitte darzustellen.

-   `tiled-maps/`: **(Anwendungslogik-Schicht)**
    -   **Zweck:** Laden und Anzeigen von Karten, die mit dem "Tiled Map Editor" erstellt wurden.
    -   **Wichtige Klassen:**
        -   `Map2DLayer`: Repräsentiert eine Ebene einer Kachelkarte.
        -   `CameraBasedVisibility`: Eine Logik, die bestimmt, welche Kacheln basierend auf der Kameraposition sichtbar sind (Frustum Culling).
        -   `RepeatingTilesProvider`: Datenquelle für sich wiederholende Kachelmuster.
    -   **Zusammenhang:** Nutzt `TileSprites` zum Rendern und `CameraBasedVisibility` zur Optimierung.

-   `controls/`: **(Interaktions-Schicht)**
    -   **Zweck:** Bietet wiederverwendbare UI-Steuerungen.
    -   **Wichtige Klassen:**
        -   `PanControl2D`: Ermöglicht das Verschieben der Ansicht mit Maus und Tastatur.
    -   **Zusammenhang:** Kann verwendet werden, um die Kamera oder die Position von Objekten in einer `Stage2D` zu steuern.

-   `utils/`:
    -   **Zweck:** Allgemeine Hilfsfunktionen und -klassen, die in der gesamten Bibliothek verwendet werden (z.B. `findNextPowerOf2`, `Dependencies`).

---

## 5. Wichtige Technologien

-   **Sprache:** TypeScript
-   **Paketmanager:** pnpm (mit Workspaces und `catalog:`)
-   **Monorepo-Tool:** NX
-   **Unit-Tests:** Vitest
-   **Integrations-Tests:** Web Test Runner (`@web/test-runner`)
-   **Linting:** ESLint
-   **Formatierung:** Prettier
-   **Demo-App:** Astro
-   **Handbook-App:** Vitepress und Markdown

---

## 6. Coding Conventions

-   Bitte halte dich an den bestehenden Code-Stil.
-   Der Code ist in TypeScript geschrieben und sollte stark typisiert sein.
-   Alle öffentlichen APIs sollten mit TSDoc-Kommentaren dokumentiert werden.
-   Wesentliche Änderungen sollten durch Tests abgedeckt sein (Unit-Tests für Logik, Browser-Tests für visuelles Verhalten).
-   Commit-Nachrichten sollten dem [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) Standard folgen.

---

## 7. Veröffentlichung (Publishing)

Die Veröffentlichung auf npm wird durch benutzerdefinierte Skripte im `scripts/`-Verzeichnis gesteuert. Führe diese Skripte nicht ohne explizite Anweisung aus.
