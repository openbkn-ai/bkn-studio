# Mandatory local pre-commit checks

Read by agents before **every** commit; [AGENTS.md](../../AGENTS.md) points here.

Before **every** commit, run the repository formatter first, review its changes, and then run the following local quality checks. Formatting is mandatory for every commit; do not rely on `format:check` or remote CI to discover files that still need formatting. Remote CI runs the repository-wide suite; the local Vitest command must target only test files directly affected by the change. Do not commit if any command fails or emits warnings where CI requires zero warnings:

```bash
pnpm run format
node scripts/check-license-headers.mjs
pnpm run format:check
pnpm exec eslint . --config eslint.config.typechecked.js --max-warnings 0
pnpm exec vitest --run --maxWorkers=50% path/to/affected.test.tsx
pnpm exec tsc -b --pretty false
pnpm exec vite build
pnpm audit --prod
```

For frontend tests, run only the modules or test files directly affected by the change and use `--maxWorkers=50%` by default. Repository-wide Vitest runs belong to remote CI and must not be run locally unless the requester explicitly asks for them. Every required check must finish with an observable successful exit code before committing. Starting a command, seeing partial output, a truncated log, or a terminal session that detaches before reporting completion is not evidence that the check passed. When the terminal cannot retain a long-running command's result, use an observable log and process/exit-status workflow; do not commit until the successful result is confirmed.

For changes under `src/modules/execution-factory/**`, also run `pnpm test:execution-factory`, matching the path-scoped CI workflow. Report every command run and any CI-only check that was not practical to run locally.
