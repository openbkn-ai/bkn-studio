# Sandbox Runtime UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only `沙箱运行时管理` UI and connect it to real Sandbox Runtime APIs.

**Architecture:** `bkn-foundry` exposes optional business troubleshooting fields in the #116 management API. `bkn-studio` adds a lab route, navigation item, service client, mapper tests, page scene, table, filters, and detail drawer that consume those APIs without frontend mock data.

**Tech Stack:** Go 1.24.11 in `bkn-foundry`; React 19, TypeScript, Ant Design, Vitest, Vite in `bkn-studio`.

---

### Task 1: Backend Optional Troubleshooting Fields

**Files:**
- Modify: `adp/execution-factory/operator-integration/server/logics/sandbox/management.go`
- Modify: `adp/execution-factory/operator-integration/server/logics/sandbox/management_test.go`
- Modify: `adp/execution-factory/operator-integration/docs/apis/api_private/sandbox.yaml`

- [ ] Add failing Go tests proving session summaries extract `task_id`, `capability_id`, `capability_name`, `user_id`, and `user_name` from session env vars.
- [ ] Run `GOTOOLCHAIN=go1.24.11 go test ./server/logics/sandbox -run TestSandboxManagementService -count=1 -v` and confirm failure.
- [ ] Add optional fields to response structs and extraction helper.
- [ ] Update private API YAML schemas.
- [ ] Re-run focused Go tests.

### Task 2: Studio API Client and Model Tests

**Files:**
- Create: `src/modules/execution-factory-lab/types/sandbox-runtime.ts`
- Create: `src/modules/execution-factory-lab/services/sandbox-runtime.service.ts`
- Create: `src/modules/execution-factory-lab/services/sandbox-runtime.service.test.ts`

- [ ] Add failing Vitest tests for resource formatting, status derivation, query params, and detail mapping.
- [ ] Run `pnpm vitest run src/modules/execution-factory-lab/services/sandbox-runtime.service.test.ts`.
- [ ] Implement the real API client using `http` and `/api/agent-operator-integration/internal-v1/sandbox`.
- [ ] Re-run focused Vitest.

### Task 3: Navigation and Route

**Files:**
- Modify: `src/modules/execution-factory-lab/navigation.tsx`
- Modify: `src/modules/execution-factory-lab/routes.tsx`
- Modify: `src/modules/execution-factory-lab/module.manifest.ts`
- Modify: `src/modules/execution-factory-lab/permissions.ts`
- Modify: `src/app/locales/resources/shell/zh-CN.ts`
- Modify: `src/app/locales/resources/shell/en-US.ts`
- Create: `src/modules/execution-factory-lab/pages/SandboxRuntimePage.tsx`

- [ ] Add `execution-factory-lab:sandbox-runtime:view`.
- [ ] Add nav item `沙箱运行时管理`.
- [ ] Add route `/execution-factory-lab/sandbox-runtime`.
- [ ] Ensure route metadata uses the new page title/description keys.

### Task 4: Sandbox Runtime Scene

**Files:**
- Create: `src/modules/execution-factory-lab/scenes/SandboxRuntimeScene.tsx`
- Create: `src/modules/execution-factory-lab/scenes/sandbox-runtime.module.css`
- Modify: `src/modules/execution-factory-lab/locales/zh-CN.ts`
- Modify: `src/modules/execution-factory-lab/locales/en-US.ts`

- [ ] Build the page shell, status cards, filters, session table, and drawer.
- [ ] Use real API loading states and error handling.
- [ ] Add search and filters without fake rows.
- [ ] Make detail drawer fetch `/sessions/{id}` when opened.

### Task 5: Verification and Demo

**Files:**
- Update tests only if needed.

- [ ] Run backend focused Go tests.
- [ ] Run frontend focused Vitest and `pnpm test -- --run`.
- [ ] Run `pnpm build`.
- [ ] Start backend/frontend services.
- [ ] Generate real sandbox sessions through Function/Skill/operator execution or backend-provided real seed path.
- [ ] Capture screenshot proving the UI shows non-empty real API data.
- [ ] Commit, push, and open PR(s).
