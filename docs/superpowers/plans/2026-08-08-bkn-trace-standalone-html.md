# BKN Trace Standalone HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a self-contained BKN Trace prototype HTML file that works without Studio or backend APIs.

**Architecture:** Add one static HTML artifact under `public/` with inline styles, inline data, and inline interaction code. Add a focused Vitest contract test that guards the real-data and zero-network constraints.

**Tech Stack:** HTML, CSS, browser JavaScript, Vitest.

---

### Task 1: Define the standalone contract

**Files:**
- Create: `src/modules/bkn-trace/prototype/BknTraceStandaloneHtml.test.ts`

- [x] Write a failing test that requires the standalone file.
- [x] Assert the real conversation ID, two view controls, and nine embedded operations.
- [x] Assert there is no `fetch`, `XMLHttpRequest`, WebSocket, or `/api/` reference.
- [x] Run the test and verify that it fails because the HTML does not exist.

### Task 2: Implement the single-file prototype

**Files:**
- Create: `public/bkn-trace-prototype.html`

- [x] Add inline layout and responsive styling.
- [x] Embed the two real interactions and nine operations.
- [x] Implement timeline selection and the collapsible shared detail panel.
- [x] Implement progressive knowledge-network object, relation, and adjacent-object selection.
- [x] Keep 28 Schema results behind an exploration-candidate control.
- [x] Omit unknown technical identifiers.
- [x] Run the contract test and verify that it passes.

### Task 3: Verify independent access

- [x] Run the standalone contract test.
- [x] Run the license checker.
- [x] Request the file through the isolated Vite server and verify HTTP 200.
- [x] Verify that the HTML contains no external resource or API dependency.
- [x] Present the direct URL and local file link for review; do not commit or deploy.
