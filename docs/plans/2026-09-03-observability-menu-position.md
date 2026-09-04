# Observability Menu Position Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Observability below General Business Knowledge Network and above Model Resources.

**Architecture:** `ConsoleNavContribution.afterKey` inserts a top-level module
after a base navigation item. Updating the BKN Trace contribution's anchor is
sufficient; a focused unit test protects the resulting top-level order.

**Tech Stack:** TypeScript, React, Vitest.

---

### Task 1: Capture the required menu order

**Files:**
- Modify: `src/app/shell/console-navigation.test.ts`

**Step 1: Write the failing test**

Change the menu-order test to require:

```ts
expect(navigationKeys.indexOf("general-business-knowledge-network")).toBeLessThan(
  navigationKeys.indexOf("observability"),
);
expect(navigationKeys.indexOf("observability")).toBeLessThan(
  navigationKeys.indexOf("model-resources"),
);
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/shell/console-navigation.test.ts`

Expected: the current `afterKey: "model-resources"` places Observability after
Model Resources, so the new assertion fails.

### Task 2: Move the navigation contribution

**Files:**
- Modify: `src/modules/bkn-trace/navigation.tsx`
- Test: `src/app/shell/console-navigation.test.ts`

**Step 1: Write minimal implementation**

Set the contribution anchor to:

```ts
afterKey: "general-business-knowledge-network",
```

**Step 2: Run test to verify it passes**

Run: `pnpm vitest run src/app/shell/console-navigation.test.ts`

Expected: all focused navigation tests pass.

### Task 3: Verify and commit

**Files:**
- Modify: `docs/plans/2026-09-03-observability-menu-position-design.md`
- Modify: `docs/plans/2026-09-03-observability-menu-position.md`
- Modify: `src/app/shell/console-navigation.test.ts`
- Modify: `src/modules/bkn-trace/navigation.tsx`

**Step 1: Run targeted verification**

Run:

```bash
pnpm vitest run src/app/shell/console-navigation.test.ts
pnpm exec eslint src/app/shell/console-navigation.test.ts src/modules/bkn-trace/navigation.tsx --config eslint.config.typechecked.js --max-warnings 0
pnpm exec tsc -b --pretty false
pnpm exec vite build
```

**Step 2: Commit**

```bash
git add docs/plans/2026-09-03-observability-menu-position-design.md \
  docs/plans/2026-09-03-observability-menu-position.md \
  src/app/shell/console-navigation.test.ts \
  src/modules/bkn-trace/navigation.tsx
git commit -m "fix(navigation): position observability before models"
```
