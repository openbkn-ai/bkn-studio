# 知识网络图探索任务清单

## T1. 依赖与骨架

- [x] `pnpm add @antv/g6@5.1.1`（精确版本）
- [x] `locales/{zh-CN,en-US}/graph-explorer.ts` 并接入 index
- [x] `routes/lazy-pages.tsx` 增加 `GraphExplorerPage`
- [x] `routes/standalone-routes.tsx` 增加 `/knowledge-network/workspace/:networkId/graph-explorer`
- [x] `pages/GraphExplorerPage.tsx`（套 `KnowledgeNetworkResourceConfigStandalonePage`）
- [x] `WorkspaceOverviewSection.tsx` 头部增加「图探索」按钮，`window.open` 新标签

## T2. 服务层

- [x] `services/graph-explorer.service.ts`：`GNode / GEdge` 类型
- [x] `buildInstanceId`、`pickDisplay`、`identityCondition`
- [x] `fromSearchInstance`、`fromQueryObjectInstance`、`fromExploreSubgraph`
- [x] `mergeGraph`、`shortestChainTo`
- [x] `searchInstances`、`queryInstances`、`expandNeighbors`、`findPath`、`loadObjectTypes`（走 `McpSession`）
- [x] `services/graph-explorer.service.test.ts`

## T3. 缓存层

- [x] `utils/graph-explorer-cache.ts`：`readCache / writeCache / clearCache`，版本校验，配额降级
- [x] `utils/graph-explorer-cache.test.ts`

## T4. 画布

- [x] `scenes/graph-explorer/GraphCanvas.tsx`：初始化、增量同步、销毁
- [x] 布局切换与「重新排列」、固定节点复位
- [x] 节点形状切换、对象类配色
- [x] 右键菜单（出边 / 入边 / 双向 / 起点 / 终点 / 移除 / 固定）
- [x] 单击回调、双击双向展开
- [x] 局部撒点
- [x] 路径高亮 / 取消高亮
- [x] 位置回读（拖拽结束、布局完成）

## T5. 面板与工具栏

- [x] `SearchPanel.tsx`：语义搜索 Tab
- [x] `SearchPanel.tsx`：条件查询 Tab（对象类下拉、条件行、算子按类型）
- [x] `ExplorerToolbar.tsx`：布局、形状、标签属性、适配、清空、清缓存
- [x] `NodeDrawer.tsx`

## T6. 页面壳

- [x] `scenes/graph-explorer/GraphExplorerPage.tsx`：lifecycle、状态、缓存恢复提示、上限、错误提示

## T7. 质量门

- [x] `pnpm license:fix` 新文件头
- [x] `pnpm lint:types`
- [x] `pnpm test -- --run`
- [x] `pnpm build` 并核对 G6 独立 chunk
- [x] `pnpm i18n:check`

## T8. 实机验证（spec §11.2）

> 2026-09-10：测试服 14.103.77.23 的 OpenSearch 因 `java.lang.OutOfMemoryError: Java heap space`（堆 1536m）持续 CrashLoopBackOff，改在开发 VM（10.211.55.4，`release/0.1.4-yf` 后端线，知识网络「延锋知识库（simple）」）完成实机验证：`tests/e2e/specs/knowledge-network/graph-explorer.verify.spec.ts` 七步全部通过（`1 passed (48.8s)`），起点为「问界M7 2024款1.5T智驾四驱Pro版6座」（车型配置），出边 0、入边 4、双向 4 条边，路径在 1 跳找到（3 跳双向被 ontology-query 500 拒绝后自动收窄）。

- [x] 按钮开新标签
- [x] 语义搜索加入画布
- [x] 条件查询同一实例 id 收敛
- [x] 出边 / 入边 / 双向展开
- [x] 路径查找与不连通提示
- [x] 布局 / 形状 / 刷新恢复
- [x] 清缓存

## T9. PR

- [ ] 英文标题正文，目标 `release/0.1.4-yf`，附验证记录
- [ ] `gh pr checks` 全绿
