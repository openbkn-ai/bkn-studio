# Business Provenance Search Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make business provenance search filters reliable across conversation, interaction, and request views, while removing the redundant business-domain control.

**Architecture:** Studio owns the visible controls and query serialization. Foundry owns the summary-level filter semantics after requests are aggregated into conversations and interactions. The same canonical status values and keyword matching rules will be applied at every list level so the result table, URL, and API stay aligned.

**Tech Stack:** React, TypeScript, Ant Design, Vitest; Go, MariaDB/OpenSearch-backed BKN Trace summaries, Go tests.

---

### Task 1: Prove the Studio query contract

**Files:**
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.tsx`

**Step 1: Write failing UI and service tests**

Assert that the business provenance filter bar has no business-domain control, selecting the user-facing running status sends `active`, and a keyword is included in the conversation request. Assert no `business_domain` query parameter is serialized for this page.

**Step 2: Run focused tests to verify failure**

Run: `pnpm exec vitest --run src/modules/bkn-trace/scenes/BknTraceRunsScene.test.tsx src/modules/bkn-trace/services/trace.service.test.ts`

Expected: FAIL because the current page renders business domain and sends `running`.

**Step 3: Implement the smallest Studio change**

Remove business-domain state and input from `BusinessProvenanceScene`. Keep `active` as the select value and use the existing localized running label.

**Step 4: Run the focused tests**

Run the command from Step 2.

Expected: PASS.

### Task 2: Make aggregate filters use the same contract

**Files:**
- Modify: `bkn-trace/agent-observability/src/domain/service/evidencesvc/summary_service_test.go`
- Modify: `bkn-trace/agent-observability/src/domain/service/evidencesvc/summary.go`

**Step 1: Write failing service regressions**

Add focused tests showing that conversations and interactions can be filtered by canonical `active` status, and that a keyword matching a question, result, conversation ID, or agent yields the containing aggregate at each list level.

**Step 2: Run focused Go tests to verify failure**

Run: `go test ./bkn-trace/agent-observability/src/domain/service/evidencesvc -run 'TestList(Conversations|Interactions).*Filter' -count=1`

Expected: FAIL on the missing aggregate keyword behavior.

**Step 3: Implement one shared aggregate predicate**

Replace the conversation-only status/evidence predicate with aggregate predicates that evaluate status, evidence completeness, identity, domain/scope, knowledge network, time window, and a case-insensitive keyword haystack. Preserve the existing rule that interaction round numbering is calculated before keyword filtering.

**Step 4: Run focused Go tests**

Run the command from Step 2.

Expected: PASS.

### Task 3: Verify integration and ship reviewable commits

**Files:**
- Modify: `docs/plans/2026-08-20-trace-provenance-search-filters.md`
- Modify only the files from Tasks 1 and 2.

**Step 1: Run required repository checks**

Studio: `node scripts/check-license-headers.mjs`, `pnpm exec eslint . --config eslint.config.typechecked.js --max-warnings 0`, `pnpm exec vitest --run`, `pnpm exec tsc -b --pretty false`, `pnpm exec vite build`, and `pnpm audit --prod`.

Foundry: run the focused package suite followed by the service/module validation prescribed by the repository instructions.

**Step 2: Inspect the diff and request review**

Use `git diff --check`, inspect both repository diffs, and request code review against the original main commits.

**Step 3: Commit separately by repository**

Commit Foundry with `fix(trace): align business provenance summary filters` and Studio with `fix(trace): refine provenance search filters`.

**Step 4: Create two linked PRs**

Explain that the Studio PR depends on the Foundry aggregate keyword fix; include test evidence and the documented status contract.
