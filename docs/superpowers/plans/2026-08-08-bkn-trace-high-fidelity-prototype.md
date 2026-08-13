# BKN Trace High-Fidelity Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an isolated high-fidelity BKN Trace prototype with timeline and knowledge-network views using the real conversation `conv_73fc12a00ac46933c3d8015616a1b1b3`.

**Architecture:** Add a hidden prototype route and a self-contained prototype module. Use a typed real-data fixture, pure projection utilities, a shared selection model, and one collapsible detail panel. Do not change Foundry APIs or the production business-provenance scene.

**Tech Stack:** React, TypeScript, Ant Design, CSS Modules, Vitest, Testing Library, Vite.

---

### Task 1: Model the real conversation snapshot

**Files:**
- Create: `src/modules/bkn-trace/prototype/bkn-trace-prototype.types.ts`
- Create: `src/modules/bkn-trace/prototype/bkn-trace-prototype.fixture.ts`
- Create: `src/modules/bkn-trace/prototype/bkn-trace-prototype.projection.ts`
- Test: `src/modules/bkn-trace/prototype/bkn-trace-prototype.projection.test.ts`

- [ ] Write a failing test asserting that the fixture contains 2 interactions and 9 chronological operations.
- [ ] Add assertions for deterministic resource-to-object mappings: inventory, purchase order, purchase request, BOM, and material.
- [ ] Add assertions that relations are classified as network context unless explicitly observed by Trace.
- [ ] Run `pnpm exec vitest --run src/modules/bkn-trace/prototype/bkn-trace-prototype.projection.test.ts` and verify failure.
- [ ] Implement the minimal types, fixture, and pure projection functions.
- [ ] Run the same test and verify pass.

### Task 2: Build the shared workspace and detail panel

**Files:**
- Create: `src/modules/bkn-trace/prototype/BknTracePrototypeScene.tsx`
- Create: `src/modules/bkn-trace/prototype/BknTracePrototypeScene.module.css`
- Create: `src/modules/bkn-trace/prototype/BknTracePrototypeScene.test.tsx`

- [ ] Write a failing component test for the view switch, selected item, and detail-panel collapse state.
- [ ] Run `pnpm exec vitest --run src/modules/bkn-trace/prototype/BknTracePrototypeScene.test.tsx` and verify failure.
- [ ] Implement the page header, `时间链视图 / 知识网络视图` switch, shared selection state, and collapsible right panel.
- [ ] Render business-first detail sections in this order: what, target, how, result, reproduce, technical details.
- [ ] Run the component test and verify pass.

### Task 3: Implement the timeline view

**Files:**
- Create: `src/modules/bkn-trace/prototype/TraceTimelineView.tsx`
- Modify: `src/modules/bkn-trace/prototype/BknTracePrototypeScene.module.css`
- Test: `src/modules/bkn-trace/prototype/BknTracePrototypeScene.test.tsx`

- [ ] Add a failing test that renders both interaction questions, actual duration labels, and all 9 operations.
- [ ] Add a failing test that selecting the inventory SQL displays `物料编码 = 101-000015` and the reproducible SQL in the detail panel.
- [ ] Implement interaction grouping, relative-time gaps, operation nodes, and answer endpoints.
- [ ] Use business labels for operation types and keep request IDs out of the primary view.
- [ ] Run the scene test and verify pass.

### Task 4: Implement progressive knowledge-network expansion

**Files:**
- Create: `src/modules/bkn-trace/prototype/TraceKnowledgeNetworkView.tsx`
- Modify: `src/modules/bkn-trace/prototype/BknTracePrototypeScene.module.css`
- Test: `src/modules/bkn-trace/prototype/BknTracePrototypeScene.test.tsx`

- [ ] Add a failing test for network -> observed objects -> relations -> adjacent objects expansion.
- [ ] Assert that `采购订单关联供应商` is labelled as network context, not observed use.
- [ ] Assert that the 28 `search_schema` results remain behind an exploration-candidate control.
- [ ] Implement the four-column progressive layout with observed/context/candidate visual states.
- [ ] Synchronize graph selection with the shared detail panel.
- [ ] Run the scene test and verify pass.

### Task 5: Add the hidden prototype route

**Files:**
- Create: `src/modules/bkn-trace/pages/BknTracePrototypePage.tsx`
- Modify: `src/modules/bkn-trace/routes.tsx`
- Test: `src/modules/bkn-trace/pages/ObservabilityAccessPages.test.tsx`

- [ ] Add a failing route/page test for `/observability/business-provenance/prototype`.
- [ ] Add the page behind the existing business-provenance capability boundary.
- [ ] Add a direct route without a console-navigation item.
- [ ] Run the page and route tests and verify pass.

### Task 6: Verify the high-fidelity prototype

**Files:**
- Test: `src/modules/bkn-trace/prototype/*.test.tsx`
- Test: `src/modules/bkn-trace/pages/ObservabilityAccessPages.test.tsx`

- [ ] Run targeted tests:

```bash
pnpm exec vitest --run \
  src/modules/bkn-trace/prototype/bkn-trace-prototype.projection.test.ts \
  src/modules/bkn-trace/prototype/BknTracePrototypeScene.test.tsx \
  src/modules/bkn-trace/pages/ObservabilityAccessPages.test.tsx
```

- [ ] Run `pnpm exec tsc -b --pretty false`.
- [ ] Run `pnpm exec eslint src/modules/bkn-trace --config eslint.config.typechecked.js --max-warnings 0`.
- [ ] Run `pnpm exec vite build`.
- [ ] Open `http://localhost/studio/observability/business-provenance/prototype`.
- [ ] Verify both modes at desktop width and one narrower viewport.
- [ ] Verify panel collapse, selection retention, progressive relation expansion, and raw-SQL disclosure.
- [ ] Present screenshots and the working-tree diff for review; do not commit, deploy, or replace the production page before approval.
