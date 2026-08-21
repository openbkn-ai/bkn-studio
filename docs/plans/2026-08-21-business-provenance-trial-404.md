# Business Provenance Trial 404 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent an unlicensed Business Provenance page from mounting its live query scene and generating an expected backend 404.

**Architecture:** `RequireEdition` intentionally mounts locked children for visual previews, but mounted React effects still run. Add an opt-in prop that suppresses child mounting only in the locked state. Set it only on the Business Provenance route; every existing use keeps preview behavior by default.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library.

---

### Task 1: Prove the locked rendering policy can suppress child mounting

**Files:**
- Modify: `src/framework/entitlement/RequireEdition.test.tsx`
- Modify: `src/framework/entitlement/RequireEdition.tsx`

**Step 1: Write the failing test**

Add a Community/trial entitlement test rendering:

```tsx
<RequireEdition capability={CAPABILITIES.BUSINESS_PROVENANCE} minEdition="enterprise" mountLockedContent={false}>
  <p>protected</p>
</RequireEdition>
```

Assert that the upgrade title is visible and `protected` is absent.

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run src/framework/entitlement/RequireEdition.test.tsx`

Expected: FAIL because the locked path still renders the child.

**Step 3: Write minimal implementation**

Add `mountLockedContent?: boolean` to `RequireEditionProps`, defaulting to `true`. In the locked result, render the inert preview wrapper only when it is true:

```tsx
{mountLockedContent ? <div aria-hidden className="console-upgrade-locked-content" inert>{children}</div> : null}
```

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest --run src/framework/entitlement/RequireEdition.test.tsx`

Expected: PASS; existing preview tests remain unchanged.

### Task 2: Apply the non-mount policy to Business Provenance only

**Files:**
- Modify: `src/modules/bkn-trace/routes.tsx`
- Test: `src/modules/bkn-trace/routes.test.tsx` (or the focused route test closest to this route)

**Step 1: Write the failing route regression test**

Inspect the Business Provenance route element and assert it passes `mountLockedContent={false}` to its `RequireEdition` boundary. Task 1 proves that this flag prevents child mounting; this route-level assertion prevents the opt-in from being accidentally removed.

**Step 2: Run test to verify it fails**

Run the focused route test. Expected: FAIL because the route has not yet opted out of the locked preview.

**Step 3: Write minimal implementation**

Pass `mountLockedContent={false}` to the Business Provenance route's existing `RequireEdition`; do not alter other routes or entitlement predicates.

**Step 4: Run focused tests**

Run both focused entitlement and route tests. Expected: PASS.

### Task 3: Verify without expanding scope

**Files:** no production changes beyond Tasks 1–2.

**Step 1:** Run `node scripts/check-license-headers.mjs`.

**Step 2:** Run `pnpm exec eslint . --config eslint.config.typechecked.js --max-warnings 0`.

**Step 3:** Run `pnpm exec vitest --run`.

**Step 4:** Run `pnpm exec tsc -b --pretty false` and `pnpm exec vite build`.

**Step 5:** Run `pnpm audit --prod`.

**Step 6:** Commit only the focused source, test, and design/plan files with `fix(observability): avoid trial provenance requests`.
