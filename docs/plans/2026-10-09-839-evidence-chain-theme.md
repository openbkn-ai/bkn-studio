# Issue 839 证据链主题与标题修复计划

> 按 executing-plans 流程在当前隔离工作区执行，完成后展示 diff；未经用户确认不提交。

**Goal:** 修复证据链浅/深主题表面与标题不一致。

**Architecture:** 已获用户确认：使用现有语义主题令牌，统一阅读区和 evidenceOnly 工具栏标题样式。范围仅限 BusinessProvenance016、CurrentExplanationPanel 的样式及直接相关测试；不改全局主题、API、数据逻辑或布局。与新增深色覆盖规则相比，直接替换硬编码避免两套样式；无需新增全局令牌。

**Tech Stack:** React、CSS Modules、Vitest。

- [x] 基线：运行 BusinessProvenance016.test.tsx 和 CurrentExplanationPanel.test.tsx。
- [x] 回归：增加共享 h2 标题、全屏退出/卸载滚动恢复，以及局部主题样式契约测试；确认修复前失败。
- [x] 实现：替换上述两个 CSS 文件的固定表面/边框/状态色，并统一两处标题 class。
- [x] 验证：相关测试、格式、lint、类型和构建；浏览器检查浅/深阅读/图谱/全屏/窄屏和文本对比度。

执行命令：`pnpm exec vitest --run --maxWorkers=50% src/modules/bkn-trace/evidence-chain/BusinessProvenance016.test.tsx src/modules/bkn-trace/evidence-chain/CurrentExplanationPanel.test.tsx src/modules/bkn-trace/evidence-chain/evidence-chain-theme.test.ts`；`pnpm exec eslint . --config eslint.config.typechecked.js --max-warnings 0`；`pnpm exec tsc -b --pretty false`；`pnpm exec vite build`。

验证记录：基线 24 个测试通过；新增测试在修复前因标题和固定颜色失败，修复后 28 个测试通过。真实 Chromium 通过浅/深主题 × 阅读/图谱 × 嵌入/全屏 × evidenceOnly/完整入口 16 组检查，示例可见文字对比度均不低于 4.5:1。两处标题的 computed style 均为 18px、700 字重、25.2px 行高、4px 0 3px 外边距。390px 窄屏无页面横向溢出，退出全屏恢复 body 滚动。临时预览文件未保留。

局限：浏览器使用组件测试的确定性示例数据，不包含实际后端联调或所有业务数据。全局主题和业务行为未改动。

评审修正：三个代码块使用语义边框，避免浅色主题下与周围白色表面混合；step 节点描边恢复为原灰度对应的 tertiary 令牌。新增四个样式回归用例在修复前失败。
