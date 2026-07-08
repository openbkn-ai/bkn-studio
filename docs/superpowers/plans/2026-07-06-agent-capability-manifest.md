# Agent Capability Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first production-safe slice of issue #47 by adding a read-only Agent-readable Capability Manifest layer for Execution Factory resources.

**Architecture:** Keep existing Toolbox, Tool, MCP, Skill, and Operator models unchanged. Add a normalized manifest type and pure mapping helpers under `src/modules/execution-factory/`, then render an additive Agent readiness panel in the existing Tool and MCP detail views.

**Tech Stack:** React, TypeScript, Ant Design, CSS Modules, Vitest, pnpm.

---

## Files

- Create: `src/modules/execution-factory/types/capability-manifest.ts`
- Create: `src/modules/execution-factory/utils/capability-manifest.ts`
- Create: `src/modules/execution-factory/utils/capability-manifest.test.ts`
- Create: `src/modules/execution-factory/components/CapabilityAgentReadinessPanel.tsx`
- Create: `src/modules/execution-factory/components/CapabilityAgentReadinessPanel.module.css`
- Modify: `src/modules/execution-factory/scenes/ToolboxToolsScene.tsx`
- Modify: `src/modules/execution-factory/scenes/McpDetailScene.tsx`
- Modify: `docs/superpowers/specs/2026-07-06-agent-capability-manifest-design.md`

## Task 1: Add Manifest Mapping Tests

- [ ] Write tests for Tool, MCP tool, Skill, and Operator source records.
- [ ] Run `pnpm vitest run src/modules/execution-factory/utils/capability-manifest.test.ts` and confirm failure because the helper does not exist.

## Task 2: Implement Manifest Types And Mapping Helpers

- [ ] Add normalized manifest types.
- [ ] Implement `buildToolCapabilityManifest`.
- [ ] Implement `buildMcpToolCapabilityManifest`.
- [ ] Implement `buildSkillCapabilityManifest`.
- [ ] Implement `buildOperatorCapabilityManifest`.
- [ ] Implement `getCapabilityReadiness`.
- [ ] Run manifest tests and confirm pass.

## Task 3: Add Read-Only Agent Readiness Panel

- [ ] Add `CapabilityAgentReadinessPanel`.
- [ ] Render intent, source type, test status, side effect, risk level, Agent visibility, invoke policy, input count, output count, and missing semantic guidance.
- [ ] Add focused styles with CSS Modules.

## Task 4: Integrate Panel Into Tool And MCP Detail Views

- [ ] In `ToolboxToolsScene`, build a Tool manifest from the selected tool detail and render the panel above the input/output panel.
- [ ] In `McpDetailScene`, build an MCP tool manifest from the selected MCP tool and render the panel above the JSON schema panel.
- [ ] Keep existing debug, edit, import, export, and publish flows unchanged.

## Task 5: Verify

- [ ] Run `pnpm vitest run src/modules/execution-factory/utils/capability-manifest.test.ts`.
- [ ] Run `pnpm test:execution-factory -- --run`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.

## Scope Notes

This implementation intentionally does not add backend persistence or editable semantic metadata. That belongs to the next issue slice after the read-only manifest and UI placement are validated.

