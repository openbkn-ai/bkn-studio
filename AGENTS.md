# AGENTS.md

Entry point for AI agents (Claude Code / Codex / others) working in this repo. Before working in any subdirectory, locate and read every `AGENTS.md` from the repository root through that target directory; rules in the more specific (deeper) file take precedence.

## Rules for every task

- **Review before external writes**: Unless the requester explicitly directs otherwise, after making and verifying code changes, present the working-tree diff for review first. Do **not** commit, push, create or update a PR, or post Issue/PR comments before the requester approves.
- **Language**: Communicate with users in Chinese by default. Use another language only when the requester explicitly asks for it or the artifact itself requires it.
- **Clarify material ambiguity**: Before editing, ask for direction when an ambiguity would materially change scope, behavior, risk, or the intended solution; otherwise proceed with a stated, reasonable assumption.
- **Bug regression coverage**: For bug fixes, add or update a focused regression test that demonstrates the reported failure whenever it is practical.
- **Verification handoff**: After implementing a change, report relevant edge cases and any remaining test-coverage gaps along with the commands run.
- **Local tests**: Run only the test files directly affected by the change, e.g. `pnpm exec vitest --run --maxWorkers=50% path/to/affected.test.tsx`. Do not run the repository-wide Vitest suite locally unless the requester explicitly asks; remote CI runs it.
- **Risky operations** (deploy, delete/modify data, schema migration, prod config, secrets/permissions, major dependency bumps, cross-service breaking changes): do **not** execute. Follow the confirmation process in [docs/agents/github-workflow.md](docs/agents/github-workflow.md#risky-operations).
- **You may never** merge a PR, approve a PR yourself, bypass or skip CI, or act without the risky-operation confirmation. Merging is human-only. The sole approval exception is the automated review workflow ([`automation-claude-review.yml`](.github/workflows/automation-claude-review.yml)); its approval is a signal that never merges.

## Read when it applies

- Before **every** commit: [docs/agents/pre-commit-checks.md](docs/agents/pre-commit-checks.md) (mandatory checks).
- Picking up or creating an Issue, opening a PR, branching, committing: [docs/agents/github-workflow.md](docs/agents/github-workflow.md).
- Changing code under `src/` (module boundaries, routes, menus, permissions): [ARCHITECTURE.md](ARCHITECTURE.md), [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md).
- Composing agents or changing a module's public capabilities: [AGENT_COMPOSITION_CHARTER.md](AGENT_COMPOSITION_CHARTER.md).
- Team collaboration and review norms: [CONTRIBUTING.md](CONTRIBUTING.md).
