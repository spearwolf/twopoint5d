# CLAUDE.md

[`AGENTS.md`](AGENTS.md) in the repo root is the agent context for this repository, and
it is short. **Read it before your first edit** — it carries the commands, the project
layout and the rules that are not visible in the code. Gemini reads the same file via
`.gemini/settings.json`; keep repo-wide guidance there rather than here.

Two things hold even if you read nothing else:

- `pnpm run ci` is the pre-commit gate.
- Never run `pnpm publishNpmPkg` or `scripts/publishNpmPkg.mjs` without an explicit
  instruction.
