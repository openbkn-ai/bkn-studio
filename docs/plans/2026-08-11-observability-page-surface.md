# Observability Page Surface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为业务溯源和 Trace 分析增加与日志检索一致、且内部层级清晰的白色页面底板。

**Architecture:** 在两个场景的根节点增加独立 `pageSurface` 样式契约，并由各自 CSS Module 实现相同的底板视觉。保留原有 `page`/`workspace` 布局类，不抽取组件、不改变业务状态或交互。

**Tech Stack:** React 19、TypeScript、CSS Modules、Vitest、Testing Library

---

### Task 1: 锁定页面底板结构

**Files:**
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`
- Modify: `src/modules/bkn-trace/trace-analysis/TraceAnalysisScene.test.tsx`

**Step 1: Write the failing test**

分别断言业务溯源根 `main` 与 Trace 分析根 `section` 包含 `pageSurface` CSS Module 类。

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest --run src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx src/modules/bkn-trace/trace-analysis/TraceAnalysisScene.test.tsx`

Expected: FAIL，根容器尚未包含 `pageSurface`。

### Task 2: 实现统一白色底板

**Files:**
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.tsx`
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css`
- Modify: `src/modules/bkn-trace/trace-analysis/TraceAnalysisScene.tsx`
- Modify: `src/modules/bkn-trace/trace-analysis/TraceAnalysisScene.module.css`

**Step 1: Write minimal implementation**

- 根节点组合原布局类与 `pageSurface`。
- `pageSurface` 使用 `background: #fff`、`border: 1px solid #e2e7ef`、`min-height: 100%`、`min-width: 0`、`padding: 24px`、`box-sizing: border-box`。
- 业务溯源移除根层灰色背景和重复内边距，并保留内部卡片边界。
- 在 900px/760px 以下把根内边距收紧至 16px。

**Step 2: Run focused tests**

Run: `pnpm exec vitest --run src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx src/modules/bkn-trace/trace-analysis/TraceAnalysisScene.test.tsx`

Expected: PASS。

### Task 3: 验证与本地部署

**Files:**
- Modify after behavior confirmation: relevant active BKN Trace implementation record

**Step 1: Run static verification**

Run: `node scripts/check-license-headers.mjs`

Run: `pnpm exec eslint src/modules/bkn-trace/business-provenance src/modules/bkn-trace/trace-analysis --config eslint.config.typechecked.js --max-warnings 0`

Run: `pnpm exec tsc -b --pretty false`

**Step 2: Build production assets**

Run: `VITE_USE_MOCK=false pnpm exec vite build`

Expected: exit 0。

**Step 3: Update local Studio deployment**

构建新的 Studio 本地镜像、加载到现有 `bkn-dev` 集群并等待 rollout 完成；不启动额外的宿主机 Nginx。

**Step 4: Review before commit**

展示 working-tree diff 与验证结果。按仓库规则，在用户评审批准前不提交、不推送。

