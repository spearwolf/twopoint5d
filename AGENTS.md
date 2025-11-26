# Agent Project Context: `twopoint5d`

This document provides a comprehensive overview of the `twopoint5d` project to accelerate AI-assisted development. It serves as the primary knowledge source for any agent working on this project.

## 1. Project Overview

`twopoint5d` is a TypeScript library for 2.5D rendering in HTML5 Canvas, built on **three.js**. "2.5D" refers to rendering 2D graphics (sprites, billboards) in a 3D environment to create depth.

It is **not** a framework wrapping three.js, but a toolkit to add specific 2.5D features to existing three.js projects.

Structure: **Monorepo** with **NX** and **pnpm Workspaces**.

**CRITICAL:**
- Ignore all files excluded by `.gitignore`.
- Focus ONLY on `packages/` and `apps/`.
- **NEVER** read files from `apps/handbook/docs/.vitepress/cache`.

---

## 2. Workflow & Key Commands

Run all commands from the project root.

-   **Install:** `pnpm install`
-   **Lint:** `pnpm lint` (ESLint for workspace)
-   **Build:** `pnpm build` (All packages/apps). Single: `nx build <project>` (e.g., `twopoint5d`).
-   **Test:** `pnpm test` (Runs all: `vitest` unit tests & `@web/test-runner` browser tests).
-   **Start Demos:**
    -   `pnpm lookbook` (Astro demo app @ `http://localhost:4321`)
    -   `pnpm handbook` (VitePress docs @ `http://localhost:5173`)
-   **CI Check:** `pnpm run ci` (Clean install, lint, build, test). **Run before committing.**

---

## 3. Monorepo Structure

-   `packages/twopoint5d`: **Core Library.** Logic, classes, shaders. Main dev work here.
-   `packages/twopoint5d-testing`: **Browser Integration Tests.** Ensures visual correctness.
-   `apps/lookbook`: **Demo App (Astro).** Visual showcase for testing changes live.
-   `apps/handbook`: **Documentation (VitePress).** Docs are in `apps/handbook/docs/` (Markdown).

---

## 4. Architecture (`packages/twopoint5d/src`)

Modular architecture designed for high performance via direct GPU communication.

### 4.1. Core Concepts
-   **Vertex Objects (VO):** Performance core. Batches data for similar objects (sprites) into single `BufferGeometry` instances to minimize CPU overhead.
-   **Display & Stage:** `Display` wraps three.js renderer/loop. `Stage` is a 2D scene with projection. `StageRenderer` composes multiple stages.
-   **Texture Management:** `TextureAtlas`/`TileSet` manage spritesheets. `TextureStore` caches resources.

### 4.2. Module Structure
-   `vertex-objects/`: **Low-level.** Manages GPU data, `VertexObjectPool`, `VOBufferGeometry`. Foundation layer.
-   `sprites/`: **Rendering.** `TexturedSprites`, `AnimatedSprites`, `TileSprites`. Uses specific `ShaderMaterial`s.
-   `display/`: **Loop.** `Display` (renderer), `Chronometer` (time), `FrameLoop`.
-   `stage/`: **Scene.** `Stage2D`, `StageRenderer`, Projections (`Orthographic`, `Parallax`).
-   `texture/`: **Assets.** `TextureAtlas`, `TileSet`, `TextureStore`.
-   `tiled-maps/`: **Tiled Integration.** `Map2DLayer`, `CameraBasedVisibility` (culling).
-   `controls/`: **Input.** `PanControl2D`.
-   `utils/`: **Helpers.**

---

## 5. Tech Stack

-   **Lang:** TypeScript
-   **Pkg Mgr:** pnpm (workspaces)
-   **Repo:** NX
-   **Tests:** Vitest (Unit), @web/test-runner (Integration)
-   **Lint/Format:** ESLint, Prettier
-   **Apps:** Astro (Lookbook), VitePress (Handbook)

---

## 6. Conventions

-   **Style:** Follow existing TypeScript style. Strong typing.
-   **Docs:** TSDoc for public APIs.
-   **Tests:** Unit tests for logic, Browser tests for visuals.
-   **Commits:** [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

---

## 7. Publishing

Controlled by scripts in `scripts/`. **Do not run without explicit instruction.**

## 8. Documentation Guidelines

-   **Language:** English.
-   **Format:** Markdown.
-   **Style:** Simple, clear, technical.

## 9. Development Workflow

-   When testing `packages/twopoint5d`, consider adding integration tests to `twopoint5d-testing`.
