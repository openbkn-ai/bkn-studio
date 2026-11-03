# Agent GitHub workflow

Rules for agents that pick up or create Issues, open PRs, branch, or commit. The rules every task needs stay in [AGENTS.md](../../AGENTS.md).

## Issues

- **Only pick up Issues labeled `agent-ready`** (acceptance criteria complete + independently doable) that are unassigned. Self-assign to lock.
- **Acceptance criteria**: a human approves them (label `ac-approved`) before an Issue becomes `agent-ready`. You may _draft_ them for human approval.
- **Issue templates**: Before creating an Issue, select the matching template under [`.github/ISSUE_TEMPLATE/`](../../.github/ISSUE_TEMPLATE/) and preserve its structure when filling in all applicable sections.
- **Stuck / off-track / tests won't pass** → comment the blocker, return the Issue to triage, clear your assignee, label `needs-human`.

## Pull requests

- **PR template**: Before creating or updating a PR, read and fully complete [`.github/pull_request_template.md`](../../.github/pull_request_template.md). Do not delete required sections; mark non-applicable items explicitly with a brief reason.
- **Open PRs with `Closes #<issue>`** and write back progress as Issue/PR comments. Label your PRs `by-agent`.

## Risky operations

For the risky operations listed in [AGENTS.md](../../AGENTS.md): do **not** execute. Post the three-part confirmation (what / blast radius / rollback), apply label `awaiting-confirmation`, and wait for an Owner to apply `owner-confirmed`.

## Commits & branches

- Conventional Commits: `type(scope): subject` (`feat` / `fix` / `chore` / `refactor` / `docs` / `test`; scope = service name).
- Branch from the Issue's "Create a branch"; one PR per Issue, kept small.
- Branch names must use a valid type prefix and at most two path segments after it: `<type>/<description>`, `<type>/<issue-number>-<description>`, or `<type>/<module>/<description>`; segments start with lowercase letters or digits and may contain `-`, `.`, or `_`.
