# Audit Filter Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ambiguous audit-log text searches with one compact row of reliable structured filters, including name-or-ID operator search.

**Architecture:** Studio owns the compact filter state and serializes only explicit query parameters. The observability service owns the compatible `actor` predicate, applying it after source records are retrieved so adapters do not need to support a name-search API.

**Tech Stack:** React, TypeScript, Ant Design, Vitest; Go, `net/http`, Go unit tests.

---

### Task 1: Prove the Studio request contract

**Files:**
- Modify: `src/modules/bkn-trace/services/observability.service.test.ts`
- Modify: `src/modules/bkn-trace/services/observability.service.ts`

**Step 1:** Add a failing request test showing that `actor` is serialized and `q` is absent from an audit-filter request.

**Step 2:** Run the focused Vitest file and verify the new assertion fails.

**Step 3:** Add the `actorQuery` request property and serialize it as `actor`.

**Step 4:** Re-run the focused test and verify it passes.

### Task 2: Prove the backend operator predicate

**Files:**
- Modify: `bkn-trace/agent-observability/src/domain/service/logsvc/service_test.go`
- Modify: `bkn-trace/agent-observability/src/domain/service/logsvc/service.go`
- Modify: `bkn-trace/agent-observability/src/domain/valueobject/observabilityvo/log.go`
- Modify: `bkn-trace/agent-observability/src/driveradapter/api/httphandler/log_handler.go`
- Modify: `bkn-trace/agent-observability/src/drivenadapter/httpaccess/bknsafeaudit/client.go`

**Step 1:** Add failing tests for exact actor ID and case-insensitive actor-name matching.

**Step 2:** Run the focused Go tests and verify the actor-name case fails.

**Step 3:** Project the actor-name snapshot, parse `actor`, and add the post-retrieval predicate.

**Step 4:** Re-run the focused Go tests and verify them green.

### Task 3: Simplify the Studio filters

**Files:**
- Modify: `src/modules/bkn-trace/scenes/ObservabilityLogsScene.tsx`
- Modify: `src/modules/bkn-trace/scenes/ObservabilityWorkspaceScenes.test.tsx`
- Modify: `src/modules/bkn-trace/scenes/ObservabilityWorkspace.module.css`

**Step 1:** Add a failing scene test for the retained one-row filter controls and absence of the generic search control.

**Step 2:** Run the focused scene test and verify it fails.

**Step 3:** Replace generic search/category/service controls with time range, module/resource, outcome, and direct operator input; serialize only those filters.

**Step 4:** Re-run the focused scene test and verify it passes.

### Task 4: Verify and submit

**Files:**
- Modify: `docs/plans/2026-08-22-audit-filter-layout-design.md`

**Step 1:** Run the focused Studio and Go tests, then the required repository quality checks.

**Step 2:** Mark the design implemented and commit Studio and Foundry changes separately.

**Step 3:** Push both branches, open linked PRs with complete templates, request review, and post progress on #504.
