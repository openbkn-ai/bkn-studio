# 业务溯源分析字号收敛 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将业务溯源分析详情收敛为 18px 会话标题、16px 轮次和调用卡标题、14px 其余内容的紧凑字号体系。

**Architecture:** 保持现有 JSX 结构和 CSS module 命名不变，只修改分析详情专属选择器。列表页、接口、交互以及辅助信息的 12px 字号不在范围内。

**Tech Stack:** React、TypeScript、Ant Design、CSS Modules、Vitest。

---

### Task 1: 锁定分析详情的字号契约

**Files:**
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`
- Test: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`

**Step 1: Write the failing test**

在加载一个会话与交互详情后，断言会话标题、轮次标题、调用卡标题和输入/输出正文对应的 CSS class 存在，防止未来把详情文本改回不受控的 Typography 标题默认值。

**Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`

Expected: FAIL，直到测试覆盖正确的详情节点。

**Step 3: Write minimal implementation**

只为已有节点保留/补充 CSS class，不新增组件或数据状态。

**Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx`

Expected: PASS。

### Task 2: 收敛分析详情 CSS

**Files:**
- Modify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css:10-11`

**Step 1: Apply the approved scale**

- `.conversationHeading h1` 设为 `18px`。
- `.roundSidebarTitle h3` 与 `.operationCard h3` 设为 `16px`。
- `.roundList strong`、`.interactionSummary h2`、`.sourceTexts p`、`.operationCard p` 设为 `14px`。
- 保留辅助信息和 `small` 的 12px 或现有更小字号。

**Step 2: Verify the compiled UI**

Run: `pnpm exec vite build`

Expected: build exits 0。

### Task 3: Visual verification and commit

**Files:**
- Verify: `src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css`

**Step 1: Inspect localhost**

打开一条业务会话的分析详情，确认会话标题为 18px、轮次与调用卡标题为 16px、正文为 14px。

**Step 2: Check diff**

Run: `git diff --check`

Expected: exits 0。

**Step 3: Commit**

```bash
git add src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.module.css src/modules/bkn-trace/business-provenance/BusinessProvenanceScene.test.tsx
git commit -m "fix(observability): compact provenance analysis typography"
```
