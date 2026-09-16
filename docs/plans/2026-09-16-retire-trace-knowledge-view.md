# Retire Trace Knowledge View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the redundant knowledge-network view from Business Provenance while preserving all Trace facts and the remaining three views.

**Architecture:** This is a Studio-only information-architecture deletion. The component will retain its interaction projection and operation-detail path, but remove the `knowledge` view state and all UI derived exclusively for its network/element rollup. Documentation records that the underlying projection remains intentionally available.

**Tech Stack:** React, TypeScript, Ant Design, Vitest, CSS modules, Markdown design documentation.

---

### Task 1: Specify the three-view workspace

**Files:**
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx:80-102, 365-370`

**Step 1: Write the failing test**

Change the view-switch test to require exactly 时间链视图、证据链、执行链路 and to require that 知识网络视图 is absent. Replace the legacy knowledge-view navigation assertion with an assertion that a timeline operation still opens its normal call detail.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run --maxWorkers=50% src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`

Expected: FAIL because the knowledge-network tab still renders.

**Step 3: Do not alter production code in this task.**

**Step 4: Commit the red test only after the production task succeeds.**

### Task 2: Delete the view-only implementation

**Files:**
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.tsx:35-36, 313-334, 355-358, 451-455, 578-611`
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css`
- Modify: `src/modules/bkn-trace/locales/zh-CN.ts`
- Modify: `src/modules/bkn-trace/locales/en-US.ts`

**Step 1: Keep the failing test from Task 1.**

**Step 2: Write the minimal implementation**

Remove `knowledge` from `View`, delete `KnowledgeSelection`, `knowledgeGroups`, the related memo/state/reset code, the segmented option, the knowledge canvas branch and the knowledge inspector. Remove CSS and locale keys referenced only by those deleted elements. Keep all projection fields, operation detail fields, evidence/execution panels and the timeline loading condition.

**Step 3: Run test to verify it passes**

Run: `pnpm exec vitest --run --maxWorkers=50% src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`

Expected: PASS with the workspace exposing only the three retained views.

**Step 4: Commit**

```bash
git add src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.tsx src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css src/modules/bkn-trace/locales/zh-CN.ts src/modules/bkn-trace/locales/en-US.ts
git commit -m "refactor(trace): retire knowledge network view"
```

### Task 3: Align BKN Trace design and implementation plan

**Files:**
- Modify: `bkn-docs/docs/foundry/bkn-trace/design/OpenBKN 0.1.5 证据链与执行链设计.md`
- Modify: `bkn-docs/docs/foundry/bkn-trace/design/OpenBKN 0.1.5 证据链与执行链实施计划.md`

**Step 1: Record the retired view boundary**

State that the Studio interaction workspace retains only timeline, evidence and execution views; the historical knowledge rollup is retired because it repeats call detail and evidence semantics. State explicitly that Trace projections and BKN references remain unchanged.

**Step 2: Validate documentation**

Run: `git diff --check`

Expected: PASS.

**Step 3: Commit documentation in its own repository branch.**

### Task 4: Verify release readiness

**Files:**
- Verify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`

**Step 1: Run the required local checks**

```bash
node scripts/check-license-headers.mjs
pnpm exec eslint . --config eslint.config.typechecked.js --max-warnings 0
pnpm exec vitest --run --maxWorkers=50% src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx
pnpm exec tsc -b --pretty false
pnpm exec vite build
pnpm audit --prod
```

**Step 2: Inspect the diff**

Run: `git diff origin/main...HEAD --check`

Expected: PASS; only view-specific UI, tests, styles, locales and design records change.

**Step 3: Submit separate Studio and documentation PRs for review. Do not merge or deploy.**
