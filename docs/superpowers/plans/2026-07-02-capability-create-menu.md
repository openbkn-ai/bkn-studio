# Capability Create Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified capability creation dropdown for Execution Factory capability library entries.

**Architecture:** A pure menu model defines grouped creation options. `CreateMenu` renders that model and opens the existing wizard/modal flows. `ExecutionUnitListScene` reuses `CreateMenu` for toolbar and empty-state CTAs.

**Tech Stack:** React 19, TypeScript, Ant Design, i18next, Vitest.

---

### Task 1: Menu Model

**Files:**
- Create: `src/modules/execution-factory/utils/capability-create-menu.ts`
- Test: `src/modules/execution-factory/utils/capability-create-menu.test.ts`

- [ ] Write failing tests for group order, item actions, shared model, and ADP target resolution.
- [ ] Run `pnpm vitest run src/modules/execution-factory/utils/capability-create-menu.test.ts` and confirm failure.
- [ ] Implement the pure menu helper and ADP target resolver.
- [ ] Run the same Vitest command and confirm pass.

### Task 2: UI Integration

**Files:**
- Modify: `src/modules/execution-factory/components/create-menu/CreateMenu.tsx`
- Modify: `src/modules/execution-factory/components/create-menu/AddCapabilityWizard.tsx`
- Modify: `src/modules/execution-factory/scenes/ExecutionUnitListScene.tsx`
- Modify: `src/modules/execution-factory/components/create-menu/create-menu.module.css`

- [ ] Render the shared menu with Ant Design `Dropdown`.
- [ ] Add a locked initial-mode path to `AddCapabilityWizard` so menu selections open the target flow directly.
- [ ] Replace the empty-state standalone button with `CreateMenu` in empty-state mode.
- [ ] Keep legacy UX behavior unchanged when capability UX v2 is disabled.

### Task 3: Locales and Verification

**Files:**
- Modify: `src/modules/execution-factory/locales/zh-CN.ts`
- Modify: `src/modules/execution-factory/locales/en-US.ts`

- [ ] Add group labels and ADP menu labels.
- [ ] Run focused Vitest.
- [ ] Run `pnpm test:execution-factory -- --run`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] Review `git diff --check`, commit, and prepare PR notes.
