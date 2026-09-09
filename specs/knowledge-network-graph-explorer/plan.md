# 知识网络图探索实施方案

对应需求：[spec.md](./spec.md)。分支 `feat/graph-explorer-014-yf`，基于 `release/0.1.4-yf`，PR 目标分支同为 `release/0.1.4-yf`。

## 1. 实施顺序

按依赖关系从底向上，每一步都能独立跑测试：

1. **依赖与骨架**：安装 `@antv/g6@5.1.1`（`npm view @antv/g6 versions` 核实：5.2.x / 5.3.x 只在 `time` 字段留有记录、`versions` 中不存在，5.1.1 为可安装的最新 5.x）；建目录、locale 键、路由、懒加载页面、概览页按钮。此时页面能打开、只有空画布。
2. **服务层（纯函数）**：`graph-explorer.service.ts` 的类型、三条入口映射、节点 id 复刻、标签链、主键条件构造、路径筛选、合并去重；单测先写。
3. **缓存层**：`graph-explorer-cache.ts` 读写、版本校验、配额降级；单测。
4. **画布**：`GraphCanvas.tsx` 封装 G6：数据同步、布局与形状切换、右键菜单、点击/双击事件、局部撒点、固定位置、路径高亮。
5. **左栏与工具栏**：`SearchPanel.tsx`（语义 / 条件两 Tab）、`ExplorerToolbar.tsx`、`NodeDrawer.tsx`。
6. **页面壳**：`GraphExplorerPage.tsx` 组合以上，接 lifecycle、缓存恢复、上限、错误提示。
7. **质量门**：`pnpm check`（license 头、类型检查、单测、构建）、`pnpm i18n:check`。
8. **实机验证**：以 vite dev 代理到测试服（14.103.77.23）用 Studio 登录态跑 spec §11.2 七条。
9. **开 PR**：标题、正文英文；附实机验证记录。

## 2. 关键实现决策

### 2.1 服务层调用

- 复用 `createMcpSession(env, auth)` 与 `createBknLifecycle(lifecycleEnv(base, knId), auth, { agentName: "bkn-agent-graph-explorer", conversationStore: memoryConversationStore() })`。
- 所有工具调用带 `response_format: "json"`，优先读 `result.structured`，回退 `parsePrecisionSafeJSON(result.text)`，与 `fetchKnDetail` 同一套读法。
- `env.base` 取 `window.location.origin`（同源，dev 走 vite 代理），与 `ExperienceScene` 一致。
- token 供给：`runtimeConfig.auth.tokenManager.getAccessToken()` / `refreshAccessToken()`。

### 2.2 节点 id 与合并

- `GNode.id` 优先取行内 `_instance_id`；缺失时用 `buildInstanceId(otId, primaryKeys, identity)` 复刻服务端规则。
- 页面持有 `Map<string, GNode>` 与 `Map<string, GEdge>`，所有加入操作先合并再交给画布；画布只做增量 `addNodeData / addEdgeData / removeNodeData`。

### 2.3 G6 用法

- `new Graph({ container, node: { type, style: { labelText, fill } }, edge: { style: { labelText, endArrow: true } }, layout: { type }, behaviors: ["drag-canvas", "zoom-canvas", "drag-element"], plugins: [contextmenu] })`。
- 局部撒点：新节点初始 `style.x/y` 取源节点坐标加半径 120 的圆周随机偏移，不触发全局 `layout()`。
- 「重新排列」：`graph.setLayout({ type })` 后 `graph.layout()`；固定节点在布局完成后用 `translateElementTo` 复位。
- 形状切换：`graph.setNode({ type })` 后 `graph.draw()`。
- 路径高亮：路径上节点与边 `setElementState(id, "highlight")`，其他元素 `"inactive"`。
- 配色：模块内 12 色序列，首 8 色沿用 `OntologyGraphView.GROUP_COLORS`，按对象类首次出现顺序分配并随 settings 持久化，保证刷新后颜色稳定。

### 2.4 缓存

- 写入时机：nodes / edges / positions / settings 任一变化后 debounce 500 ms；positions 在 `drag-element` 结束与布局完成时从 `graph.getNodeData()` 读回。
- 读取：`version !== 1` 只取 settings；解析失败视为无缓存。

## 3. 风险与对策

| 风险 | 对策 |
|---|---|
| `search_instance` 节点无 `_instance_id`，且 `unique_identities` 键序与 `primary_keys` 不一致 | 用 `get_object_types` 的 `primary_keys` 定序；实机验证第 3 条专门核 id 收敛 |
| G6 5 的 `dagre` 布局名在不同小版本间有 `dagre` / `antv-dagre` 两种 | 安装后以 `node_modules/@antv/g6` 的类型声明为准，不凭记忆 |
| 测试服 lifecycle（agent-observability）状态不稳定 | 页面按 `lifecycle.unsupported()` 降级提示；验证前先用 Data Browser 确认 lifecycle 可用 |
| worktree 无 `node_modules` | 在 worktree 内 `pnpm install --frozen-lockfile` 后再加依赖 |
