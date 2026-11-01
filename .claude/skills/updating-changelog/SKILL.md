---
name: updating-changelog
description: Use when adding entries to any CHANGELOG.md in this repo, when the user mentions "changelog", or before/after committing user-facing changes. Enforces Keep a Changelog 1.1.0 layout, the immutability of released sections, and the migration-guide check for public-API changes.
---

# Updating CHANGELOG.md

## Overview

This repo follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and [SemVer](https://semver.org/spec/v2.0.0.html). All new entries land in an `[Unreleased]` section at the top of the file. Released sections are **history** and are never edited.

## The Iron Rules

1. **New entries go ONLY into `[Unreleased]`** at the top of the file (immediately under the header preamble).
2. **Released version sections are immutable.** Never edit, reword, reorder, or remove entries under any `## [x.y.z] - YYYY-MM-DD` heading. Not for typos. Not for clarifications. The past stays the past — corrections go into the next `[Unreleased]` entry instead.
3. **Every new entry sits inside a typed subsection** (`### Added`, `### Changed`, …). No bare bullet at the top of `[Unreleased]`.
4. **Evaluate migration impact** for every entry that touches a public API. If migration steps are needed, add or extend `### Migration Guide` inside `[Unreleased]`.

## Allowed Subsections (Keep a Changelog 1.1.0)

Use only these, in this order, and only the ones that apply:

| Subsection       | When to use                                                                 |
|------------------|-----------------------------------------------------------------------------|
| `### Added`      | New features, new public API, new exports                                   |
| `### Changed`    | Changes to existing functionality (behavior, signatures, defaults, perf)    |
| `### Deprecated` | Soon-to-be-removed features still present and working                       |
| `### Removed`    | Features removed in this release                                            |
| `### Fixed`      | Bug fixes                                                                   |
| `### Security`   | Vulnerability fixes / security-relevant hardening                           |
| `### Migration Guide` | Steps consumers must take when upgrading (see below)                   |

`### Migration Guide` is repo-specific (not in keepachangelog) and goes **last** inside `[Unreleased]`.

## Workflow

1. **Open the relevant `CHANGELOG.md`.** This repo currently has one: `packages/twopoint5d/CHANGELOG.md`. Confirm the change you are documenting belongs to that package.
2. **Locate `## [Unreleased]`.** If it does not exist, create it directly under the file's header preamble and above the most recent released version.
3. **Pick the subsection.** Match the change to exactly one of the categories above. If the change is genuinely two things (e.g. fixed a bug *and* added a new method), write two entries in their respective subsections.
4. **Write the entry.** One bullet per discrete change. Precise, present-tense imperative or noun phrase. Mention the affected symbol in backticks. Skip implementation chatter unless it is the point (perf entries may include the algorithmic detail).
5. **Migration check.** Ask: "Does a consumer of `@spearwolf/twopoint5d` need to change their code to upgrade past this?" If yes → add a `### Migration Guide` block (see below).
6. **Do not touch released sections.** Verify your diff only modifies the `[Unreleased]` block.

## Entry style

- **Subject in backticks:** `` `ClassName#method()` ``, `` `module/file.ts` ``, `` `optionName` ``.
- **One bullet per discrete change.** A bullet is one Markdown line, however long: it names the symbol, the user-visible effect and the edge cases a consumer meets (defaults, what is refused and with which error, what `dispose()` does). Several changes are several bullets, not one paragraph.
- **Precise.** State the user-visible effect, not the patch. "`AABB2#isInsideAABB()` tests its corners with x and y in their places" beats "tweaked logic in AABB2".
- **Breaking changes** end their bullet with `(**BREAKING**). See the Migration Guide` and get a `####` block there.
- **Guide pointers.** Where a guide in `packages/twopoint5d/docs/` covers the change, name the section, as in ``(see "Stage masks" in `docs/stages.md`)``. The guide section changes in the same commit.
- **No PR/issue links** unless they add real context (e.g. an upstream three.js bug).
- **No emoji**, no headings inside bullets.
- **Plural / multi-package commits:** add one entry per affected package CHANGELOG.

### Verb prefixes that match the existing style

`add`, `change`, `deprecate`, `remove`, `upgrade`, `perf` open most entries under `Added`, `Changed`, `Deprecated` and `Removed`. Two other forms are just as common and fine:

- an entry under `### Fixed` states the behaviour as it is after the fix, with the symbol as subject — "`ChunkQuadTreeNode#subdivide()` splits a node whose chunks only one axis separates …" — rather than "fix …";
- a refusal or a read-only change states the rule — "`StageItem` is read-only: …", "`new FeatureSprites()` refuses a `material` built for a pass …".

## Migration Guide

Add a `### Migration Guide` block **inside `[Unreleased]`** when any of these are true:

- A public export from `packages/twopoint5d/src/**/public-api.ts` changed signature, semantics, or was removed/renamed.
- A default value changed in a way that alters runtime behavior.
- A peer-dep range was tightened in a way that forces consumers to upgrade.
- A previously-allowed call pattern now throws or warns.

Format:

```markdown
### Migration Guide

#### `ClassName#method()` signature change

**Before**

```ts
foo.bar(opts);
```

**After**

```ts
foo.bar(opts, { strict: true });
```

`strict` defaults to `false`; pass `true` to restore the previous behavior.
```

One H4 (`####`) per discrete migration. Show **Before / After** code blocks. Keep it copy-pasteable.

If no migration is needed, do **not** add the section. Empty migration guides are noise.

## Canonical layout

```markdown
# CHANGELOG

All notable changes to [@spearwolf/twopoint5d](...) will be documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- new `Foo#bar()` returning `Baz` for streaming use cases

### Changed
- `Stage2D#projection` now defaults to `Orthographic` (was `Parallax`)

### Fixed
- `Display#OnDisplayResize` no longer double-emits on the first frame

### Migration Guide

#### `Stage2D` default projection

**Before**

```ts
const stage = new Stage2D(); // → ParallaxProjection
```

**After**

```ts
const stage = new Stage2D(); // → OrthographicProjection
const stage = new Stage2D({projection: new ParallaxProjection(...)}); // opt back in
```

## [0.19.0] - 2026-02-27

- upgrade dependencies to `three@0.183.1`

## [0.18.5] - 2026-01-12
...
```

## Code blocks

A `ts` block in a changelog is an excerpt and nothing checks it. A block that stands on its own carries `ts check`, and `pnpm typecheck` compiles it — but only inside `## [Unreleased]`; once the section is released, its blocks are history and stay as they are (see "Code blocks in Markdown" in `AGENTS.md`).

## Cutting a release

Only on an explicit instruction. A release is one commit, `chore: release twopoint5d vX.Y.Z`, that touches two files:

1. `packages/twopoint5d/CHANGELOG.md`: insert `## [X.Y.Z] - YYYY-MM-DD` directly under `## [Unreleased]`, so the existing subsections move into the release and `## [Unreleased]` stays as an empty heading. Under the new heading, above `### Added`, write one paragraph that says what the release brings and that the Migration Guide at its end walks through every break (see `## [0.24.0]`).
2. `packages/twopoint5d/package.json`: `version` to `X.Y.Z`.

Before the commit, `pnpm run ci` passes. The push to `main` is the publication: the Deploy workflow runs after CI, publishes the version if npm does not list it yet and writes the tag `vX.Y.Z` — so the push waits for the maintainer. Never run `pnpm publishNpmPkg` yourself.

## Common mistakes

| Mistake | Fix |
|---|---|
| Adding a bullet under a released `## [x.y.z]` heading | Move to `[Unreleased]` |
| Editing wording of a released entry to "fix a typo" | Don't. Add a `### Fixed` entry in `[Unreleased]` documenting the correction if it matters |
| Bare bullet directly under `## [Unreleased]` | Wrap in a `### <Category>` subsection |
| Putting a perf change under `### Fixed` | Use `### Changed` (perf is not a bug fix unless it fixes correctness) |
| Adding `### Migration Guide` for an internal-only change | Remove it — internal refactors don't need migration steps |
| Linking to a CHANGELOG section by line number / commit | Link by version anchor (`[0.19.0]`) or symbol name |
| One giant multi-paragraph bullet | Split into one bullet per discrete change |
| Reordering subsections | Keep the canonical order: Added → Changed → Deprecated → Removed → Fixed → Security → Migration Guide |

## Red flags — STOP

- About to edit a section under `## [x.y.z] - YYYY-MM-DD` → **stop**, the past is immutable.
- About to delete or reword an existing `[Unreleased]` bullet you didn't write this session → **ask first**.
- Tempted to add a date to `[Unreleased]` or a new `## [x.y.z]` block without being asked for a release → **don't**. Releases follow "Cutting a release" above, on an explicit instruction only.
