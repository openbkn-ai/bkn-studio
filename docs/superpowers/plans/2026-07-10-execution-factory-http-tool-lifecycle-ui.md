# Execution Factory HTTP Tool Lifecycle UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align HTTP API tool edit/view experience with the guided create experience so the same tool keeps a stable lifecycle UI.

**Architecture:** Add a focused shared section component for HTTP tool lifecycle layout and use it in the existing tool detail scene. Keep data loading, saving, debug, and route contracts unchanged.

**Tech Stack:** React, TypeScript, Ant Design, Vitest, Testing Library, Vite.

---

### Task 1: Add Shared HTTP Tool Lifecycle Layout

**Files:**
- Create: `src/modules/execution-factory/components/HttpToolLifecyclePanel.tsx`
- Create: `src/modules/execution-factory/components/HttpToolLifecyclePanel.module.css`
- Create: `src/modules/execution-factory/components/HttpToolLifecyclePanel.test.tsx`

- [ ] **Step 1: Write failing test**

Create a component test that renders basic fields, IO preview before advanced configuration, and the OpenAPI advanced section.

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
node_modules\.bin\vitest.cmd run src/modules/execution-factory/components/HttpToolLifecyclePanel.test.tsx
```

Expected: fail because the component does not exist.

- [ ] **Step 3: Implement the component**

The component accepts React nodes for business fields, IO preview, and advanced configuration. It owns only layout and copy, not data mutation.

- [ ] **Step 4: Run test and verify pass**

Run the same Vitest command. Expected: pass.

### Task 2: Use The Layout In Tool Detail Scene

**Files:**
- Modify: `src/modules/execution-factory/scenes/ToolDetailScene.tsx`
- Modify: `src/modules/execution-factory/locales/en-US.ts`
- Modify: `src/modules/execution-factory/locales/zh-CN.ts`

- [ ] **Step 1: Move business fields into lifecycle summary**

Keep `name`, `description`, and `useRule` as the first section.

- [ ] **Step 2: Move IO preview before advanced configuration**

Render `ToolIoPanel` before raw OpenAPI/global parameters.

- [ ] **Step 3: Place raw OpenAPI/global parameters in advanced configuration**

For OpenAPI tools, show raw OpenAPI inside an advanced collapsible section. For function tools, show function definition in the same advanced section.

- [ ] **Step 4: Preserve debug and save behavior**

Do not change `updateTool`, `ToolDebugModal`, or navigation logic.

### Task 3: Verify

**Files:**
- Test: `src/modules/execution-factory/components/HttpToolLifecyclePanel.test.tsx`
- Existing tests: quick API creation and IO utilities

- [ ] **Step 1: Run targeted tests**

```powershell
node_modules\.bin\vitest.cmd run src/modules/execution-factory/components/HttpToolLifecyclePanel.test.tsx src/modules/execution-factory/components/create-menu/CapabilityCreatedNextSteps.test.tsx src/modules/execution-factory/utils/tool-io.test.ts
```

- [ ] **Step 2: Start local service**

Use the existing local Vite service if running. Otherwise start it with:

```powershell
pnpm dev --host 127.0.0.1
```

- [ ] **Step 3: Manual verification URL**

Open:

```text
http://127.0.0.1:5173/studio/execution-factory/units?activeTab=toolbox
```

Verify HTTP API create -> save -> edit keeps the same business-first structure.

