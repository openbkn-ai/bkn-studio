# Observability Menu Order Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Place the Observability top-level navigation group directly after Model Management and before System Management.

**Architecture:** Base navigation and top-level module contributions are assembled separately. Add a small `afterKey` contribution anchor so BKN Trace can be inserted after the base `model-resources` item; preserve its navigation object, routes, permissions, and children. A focused navigation-unit test records the required relative order.

**Tech Stack:** React 19, TypeScript, Vitest, pnpm.

---

### Task 1: Define the menu-order contract

**Files:**
- Modify: `src/app/shell/console-navigation.test.ts`

**Step 1: Write the failing test**

Add a test that maps `consoleNavigation` to keys and asserts the index order:

```ts
expect(keys.indexOf("model-resources")).toBeLessThan(keys.indexOf("observability"));
expect(keys.indexOf("observability")).toBeLessThan(keys.indexOf("system-management"));
```

**Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run src/app/shell/console-navigation.test.ts`

Expected: FAIL because `observability` currently follows the system-management group.

### Task 2: Anchor the existing navigation contribution

**Files:**
- Modify: `src/app/shell/console-navigation.tsx`
- Modify: `src/app/shell/navigation/types.ts`
- Modify: `src/modules/bkn-trace/navigation.tsx`
- Test: `src/app/shell/console-navigation.test.ts`

**Step 1: Write minimal implementation**

Add `afterKey?: string` to `ConsoleNavContribution`. Make the navigation builder insert ungrouped contributions with `afterKey` immediately after the matching base item, then declare `afterKey: "model-resources"` on `bknTraceNavigation`. Do not change its routes, child entries, or permission behavior.

**Step 2: Run the focused test to verify it passes**

Run: `pnpm vitest run src/app/shell/console-navigation.test.ts`

Expected: PASS, including existing permission-filter tests.

### Task 3: Verify the affected frontend quality gates

**Files:**
- Verify: `src/app/shell/console-navigation.tsx`
- Verify: `src/app/shell/console-navigation.test.ts`

**Step 1: Run lint and type checks**

Run: `pnpm exec eslint src/app/shell/console-navigation.tsx src/app/shell/console-navigation.test.ts --config eslint.config.typechecked.js --max-warnings 0 && pnpm exec tsc -b --pretty false`

Expected: PASS with no warnings or type errors.

**Step 2: Run the production build**

Run: `pnpm exec vite build`

Expected: PASS.

**Step 3: Present the diff for review**

Do not commit, push, or create a pull request until human review approval, per `AGENTS.md`.
