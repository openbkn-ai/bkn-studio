# 知识网络图探索任务清单

## T1. 依赖与骨架

- [ ] `pnpm add @antv/g6@5.1.1`（精确版本）
- [ ] `locales/{zh-CN,en-US}/graph-explorer.ts` 并接入 index
- [ ] `routes/lazy-pages.tsx` 增加 `GraphExplorerPage`
- [ ] `routes/standalone-routes.tsx` 增加 `/knowledge-network/workspace/:networkId/graph-explorer`
- [ ] `pages/GraphExplorerPage.tsx`（套 `KnowledgeNetworkResourceConfigStandalonePage`）
- [ ] `WorkspaceOverviewSection.tsx` 头部增加「图探索」按钮，`window.open` 新标签

## T2. 服务层

- [ ] `services/graph-explorer.service.ts`：`GNode / GEdge` 类型
- [ ] `buildInstanceId`、`pickDisplay`、`identityCondition`
- [ ] `fromSearchInstance`、`fromQueryObjectInstance`、`fromExploreSubgraph`
- [ ] `mergeGraph`、`shortestChainTo`
- [ ] `searchInstances`、`queryInstances`、`expandNeighbors`、`findPath`、`loadObjectTypes`（走 `McpSession`）
- [ ] `services/graph-explorer.service.test.ts`

## T3. 缓存层

- [ ] `utils/graph-explorer-cache.ts`：`readCache / writeCache / clearCache`，版本校验，配额降级
- [ ] `utils/graph-explorer-cache.test.ts`

## T4. 画布

- [ ] `scenes/graph-explorer/GraphCanvas.tsx`：初始化、增量同步、销毁
- [ ] 布局切换与「重新排列」、固定节点复位
- [ ] 节点形状切换、对象类配色
- [ ] 右键菜单（出边 / 入边 / 双向 / 起点 / 终点 / 移除 / 固定）
- [ ] 单击回调、双击双向展开
- [ ] 局部撒点
- [ ] 路径高亮 / 取消高亮
- [ ] 位置回读（拖拽结束、布局完成）

## T5. 面板与工具栏

- [ ] `SearchPanel.tsx`：语义搜索 Tab
- [ ] `SearchPanel.tsx`：条件查询 Tab（对象类下拉、条件行、算子按类型）
- [ ] `ExplorerToolbar.tsx`：布局、形状、标签属性、适配、清空、清缓存
- [ ] `NodeDrawer.tsx`

## T6. 页面壳

- [ ] `scenes/graph-explorer/GraphExplorerPage.tsx`：lifecycle、状态、缓存恢复提示、上限、错误提示

## T7. 质量门

- [ ] `pnpm license:fix` 新文件头
- [ ] `pnpm lint:types`
- [ ] `pnpm test -- --run`
- [ ] `pnpm build` 并核对 G6 独立 chunk
- [ ] `pnpm i18n:check`

## T8. 实机验证（spec §11.2）

- [ ] 按钮开新标签
- [ ] 语义搜索加入画布
- [ ] 条件查询同一实例 id 收敛
- [ ] 出边 / 入边 / 双向展开
- [ ] 路径查找与不连通提示
- [ ] 布局 / 形状 / 刷新恢复
- [ ] 清缓存

## T9. PR

- [ ] 英文标题正文，目标 `release/0.1.4-yf`，附验证记录
- [ ] `gh pr checks` 全绿
