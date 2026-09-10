# 知识网络图探索（Graph Explorer）设计说明

- 日期：2026-09-09
- 目标分支：`release/0.1.4-yf`（仅此分支，不回合 `main`）
- 所属模块：`src/modules/knowledge-network`
- 后端依赖：context-loader（agent-retrieval）MCP 工具面，`release/0.1.4-yf` 已有能力，无需后端改动

## 1. 背景

Studio 目前只能以表格形式浏览知识网络实例（Data Browser），或以本体图查看对象类与关系类的定义（OntologyGraphView）。用户无法从一个具体实例出发，沿关系逐跳展开、观察实例之间的连接。本需求提供一个面向实例的图探索页面：用自然语言或过滤条件找到起点实例，在画布上展开邻居、追踪路径，并把探索结果留在本地。

## 2. 目标

1. 从知识网络工作台一键打开独立的图探索页面（新标签页）。
2. 两种入口找起点：自然语言语义搜索、按对象类的条件查询。
3. 对画布上任一节点展开邻居，可选出边、入边或双向。
4. 在两个节点之间查找路径（3 跳以内）。
5. 复用 AntV G6 的绘图与交互能力：布局切换、节点形状切换、按对象类配色、缩放适配。
6. 节点标签有确定的取值链，并允许按对象类指定标签属性。
7. 画布状态保存在浏览器本地，重开页面可恢复。

## 3. 非目标

- Cypher 只用于选点与取子图：后端子集的 RETURN 只能返回属性、不支持变长关系，路径查找仍走 `explore_subgraph`。
- 不做真正的最短路径算法：后端 openCypher 子集明确不支持变长关系（bkn-backend `logics/cypher/analyze.go:221`），ontology-query 也没有最短路接口。本期用 `explore_subgraph` 的 3 跳探索在客户端筛出最短链。
- 不展示边属性：ontology-query 返回的 `Relation` 只有 `relation_type_id / relation_type_name / source_object_id / target_object_id`（`interfaces/knowledge_network.go:133-138`），没有 `properties`。边标签固定为关系类名。
- 不做多人共享或服务端保存；缓存只在本地。
- 不改 context-loader、ontology-query 任何接口。

## 4. 入口与路由

### 4.1 入口按钮

`src/modules/knowledge-network/scenes/workspace/WorkspaceOverviewSection.tsx` 头部按钮组（现有「授权」「编辑」旁）增加「图探索」按钮：

```ts
window.open(`/knowledge-network/workspace/${networkId}/graph-explorer`, "_blank", "noopener,noreferrer");
```

与 `src/app/shell/TopBar.tsx:157` 现有 `window.open` 写法一致。路径用 react-router 的 `useHref()` 生成，由它带上路由 basename，不手拼 `/studio`。

### 4.2 路由

在 `src/modules/knowledge-network/routes/standalone-routes.tsx` 追加：

```text
/knowledge-network/workspace/:networkId/graph-explorer
```

- 走 `createKnowledgeNetworkRoute`，`titleKey: knowledgeNetwork.graphExplorer.title`。
- 页面组件在 `routes/lazy-pages.tsx` 中懒加载，`@antv/g6` 随该 chunk 加载，不进入首屏包。
- 页面在 Studio 顶栏之下渲染，不套工作台侧栏（不走 `workspaceSectionPage`），画布占满剩余宽度。

## 5. 文件布局

```text
src/modules/knowledge-network/
  scenes/graph-explorer/
    GraphExplorerPage.tsx        页面壳：lifecycle 初始化、左栏 + 画布 + 抽屉的组合、缓存恢复
    GraphCanvas.tsx              G6 封装：数据同步、右键菜单、事件回调、布局/形状切换
    SearchPanel.tsx              左栏：语义搜索 / 条件查询 两个 Tab，结果列表与「加入画布」
    NodeDrawer.tsx               右侧抽屉：节点全部属性
    ExplorerToolbar.tsx          顶栏：布局、形状、标签属性、路径模式、适配、清空、清缓存
  services/
    graph-explorer.service.ts    工具调用封装与响应映射（纯函数为主）
  utils/
    graph-explorer-cache.ts      localStorage 读写、版本迁移、配额降级
  locales/{zh-CN,en-US}/graph-explorer.ts
```

`GraphCanvas` 只接收 `nodes / edges / settings` 与回调，不直接调用服务；服务层不依赖 React。两者可以各自单测。

## 6. 数据层

### 6.1 调用方式

全部业务调用复用现有服务：

- `createMcpSession(env, auth)`（`services/context-loader.service.ts:1087`）
- `createBknLifecycle(...)` + `withManagedTurn(lifecycle, question, run)`（`services/bkn-lifecycle.service.ts`）

与 `scenes/DataBrowserPanel.tsx` 相同：每次用户动作包一个 managed turn，`bkn_start_interaction` / `bkn_finish_interaction` 与 `bkn_context` 注入由 `withManagedTurn` 完成。conversation 存储 key 使用本页独立的 `localConversationStore("bkn-studio.graph-explorer.conversation.<kn_id>")`，不与 Data Browser 共用。

### 6.2 工具与载荷

| 场景 | 工具 | 关键参数 | 用到的返回 |
| --- | --- | --- | --- |
| 语义搜索 | `search_instance` | `kn_id, query, max_instances_per_type=20` | `nodes[]{object_type_id, object_type_name, instance_name, unique_identities, properties}`、`object_types[]`、`message` |
| 对象类清单 | `get_kn_detail` | `kn_id, detail_level=summary` | 对象类 id / name（下拉） |
| 对象类定义 | `get_object_types` | `kn_id, ids=[ot_id]` | `primary_keys`、`display_key`、`properties[]{name, type}` |
| 条件查询 | `query_object_instance` | `kn_id, ot_id, condition, limit=50` | `datas[]`（含 `_instance_id / _instance_identity / _display`）、`total_count` |
| 展开邻居 | `explore_subgraph` | `kn_id, source_object_type_id, direction, path_length=1, condition, limit=1` | `objects`、`isolated_objects`、`relation_paths` |
| 查找路径 | `explore_subgraph` | 同上，`path_length=3, direction=bidirectional` | `relation_paths`（客户端筛选） |

`direction` 取值对应关系：出边 = `forward`，入边 = `backward`，双向 = `bidirectional`。

展开邻居时 `condition` 由源节点的主键构成：

```json
{ "operation": "and", "sub_conditions": [ { "field": "<pk1>", "operation": "==", "value": <v1> }, ... ] }
```

单主键时直接用单个 `==` 条件，不包 `and`。

### 6.3 统一图模型

```ts
type GNode = {
  id: string;            // 见 6.4
  otId: string;
  otName: string;
  identity: Record<string, unknown>;   // 主键 -> 值
  display: string;                     // 见 6.5
  props: Record<string, unknown>;      // 全部属性（含 _ 前缀系统字段）
};
type GEdge = {
  id: string;            // `${source}|${relTypeId}|${target}`
  source: string;
  target: string;
  relTypeId: string;
  relTypeName: string;
};
```

三条入口的响应都映射到这两个类型，映射函数为纯函数：

- `fromSearchInstance(resp) -> GNode[]`
- `fromQueryObjectInstance(otMeta, resp) -> GNode[]`
- `fromExploreSubgraph(resp) -> { nodes: GNode[]; edges: GEdge[]; isolated: GNode[] }`

`relation_paths[].relations[]` 中每条 relation 展开成一条 `GEdge`；同一 `GEdge.id` 只保留一条。

### 6.4 节点 id

节点 id 必须让三条入口找到的同一实例落到同一个画布节点。

- `query_object_instance` 与 `explore_subgraph` 的行自带 `_instance_id`，直接使用。
- `search_instance` 的节点若 `properties._instance_id` 存在则使用；否则按服务端规则复刻（ontology-query `logics/common.go:251` `GetObjectID`）：

```text
<ot_id> + "-" + 主键值按对象类 primary_keys 顺序用 "_" 连接；缺失的主键写 "__NULL__"
```

主键顺序来自 `get_object_types` 的 `primary_keys`。对象类定义按 `ot_id` 在页面内存中缓存，一次会话只取一次。

### 6.5 节点标签

取值链（首个非空生效）：

1. `_display`
2. `display_name`
3. `name`
4. `id`
5. 第一个不以 `_` 开头且值非空的属性
6. 节点 id

用户可在工具栏按对象类选择一个属性作为标签；选定后覆盖上面的链，选择结果随 settings 持久化。

### 6.6 查找路径

- 用户在右键菜单指定起点 A、终点 B。
- 调 `explore_subgraph(A, path_length=3, bidirectional, limit=1)`；若下游拒绝（例如路径穿到没有已发布数据源的对象类时 ontology-query 返回 500），依次收窄到 `path_length=2`、`1` 重试，全部失败才报错。
- 客户端遍历 `relation_paths`，取 `relations` 链中能到达 B 的最短一条（任一 relation 的 `source_object_id` 或 `target_object_id` 为 B 即视为到达，截断到该 relation）。
- 路径上的节点与边加入画布并高亮；无结果时提示「3 跳内不连通」。

## 7. 交互

### 7.1 左栏

- Tab「语义搜索」：可选的对象类多选（限定 `search_instance` 的 `object_types`，不选则全网）+「高级参数」（`exclude_object_types` / `concept_groups` / `max_instances_per_type` / `max_object_types`）+「召回融合（RRF）」面板（`enable_rrf_fusion` / `enable_knn_instance_retrieval` / `rrf_k` / `knn_weight` / `initial_candidate_count` / `min_direct_relevance` / `instance_rerank_mode`，每项带悬停说明）+ 输入框 + 回车；结果列出标签与对象类名；单条「加入画布」，或勾选后批量加入。空结果时展示后端 `message`。融合参数不在 `search_instance` 请求体里，任一偏离默认即改走 REST `/kn/kn_search` 并显式传 `only_schema:false`（该接口默认只回 schema），其余仍走 `search_instance`；面板底部提示当前走哪条。
- Tab「条件查询」：对象类下拉 → 属性 / 算子 / 值 的条件行（可加多行，`and` 组合）→ 查询；算子按属性类型给出（`== != > >= < <= like in`），不涉及索引算子。结果同上。
- Tab「Cypher」：只写 `MATCH … [WHERE …]`（标签用对象类 id 或名称，关系带方向、只写一个关系类 id），页面按每个节点变量的主键自动补 `RETURN DISTINCT … LIMIT 200`，调 bkn-backend `POST /knowledge-networks/{kn_id}/cypher-queries`（REST，无需 `bkn_context`），把行还原为节点与边，再用 `query_object_instance` 按主键 `in` 批量回查补齐属性；可单个或「全部加入（含边）」。子集限制（RETURN 只能是属性、无变长关系）沿用后端契约。顶部「AI 生成」框：把本网络的对象类（含属性）与关系类（带方向）连同问题发给模型工厂默认大模型，要求只输出 MATCH/WHERE 片段；结果剥去代码块、解释与多余 RETURN，节点内联属性映射 `{a: 'x'}` 改写为 WHERE，填入编辑器供用户修改后运行；多个模型可切换。
- Tab「浏览」（自由探索）：对象类下拉 → 「列出实例」不带条件分页列出（每页 50，「加载更多」按 `offset` 翻页），供用户自己挑起点；同一 Tab 提供「按主键定位」：输入主键值（复合主键按主键顺序逗号分隔）→ `query_object_instance` 精确匹配。 同一 Tab 还有「按 ID 列表取子图」：粘贴多个实例 ID（`<对象类 id>-<主键值>`，即节点抽屉里的实例 ID；或先选对象类再贴裸主键值），页面按对象类分组用 `query_object_instance`（`pk in [...]`，每批 50）取实例，再对每条两端对象类都在集合内的关系类调 `query_instance_subgraph`（路径两端各带 `pk in` 条件），只保留两端都在集合内的边；单条关系类失败只记进历史不中断。
- 对象类与属性下拉同时按显示名与 id 过滤。

### 7.2 画布

- 节点右键菜单：展开出边 / 展开入边 / 双向展开 / 设为路径起点 / 设为路径终点 / 从画布移除 / 固定位置（切换）。已是起点或终点的节点，对应菜单项变为「取消起点」/「取消终点」；已固定的节点显示「取消固定」。
- 双击节点 = 双向展开。
- 单击节点 → 右侧抽屉列出全部属性；单击空白关闭抽屉。
- 展开结果与已有节点、边按 id 合并；新节点围绕源节点按同心环撒开（每环按约 70px 间距算容量，满则外扩一环，并沿角度向外避让已有节点），不改动其他节点位置；工具栏「重新排列」才全局重新布局。布局参数 `nodeSize 64 / nodeSpacing 24` 防标签重叠。
- 工具栏「节点名」「边名」开关控制标签显隐，随设置持久化。
- 多选与批量移除：Shift+点击或 Shift+框选进入 `selected` 状态（Shift 按住时 `drag-canvas` 让位给 `brush-select`，否则框画不出来），拖动其中一个即整体移动；工具栏「移除所选」或 Delete/Backspace 移除全部选中节点。空白处拖动平移画布、滚轮缩放。
- 撤销：每次加入、移除、清空前记录一份画布快照（节点、边、位置），工具栏「撤销」或 Ctrl/⌘+Z 回退一步，最多保留 30 步；撤销走 `replaceAll` 整体重建，缺位置的节点补一次布局。
- 执行历史：每次工具调用记录种类、标题、输入参数、后端原始返回（超过 10 万字符截断）、成功与否、耗时；抽屉内可复制输入/输出，展开与路径条目可「重跑」。仅存于当前页面内存，最多 100 条。
- 导出图片：`graph.toDataURL({ mode: "overall", type: "image/png" })` 导出整图为 PNG 下载。
- 按概念组分组：开关打开后，按 `get_kn_detail` 的 `concept_groups[].object_type_ids` 为每个概念组建一个 combo，节点归入首个包含其对象类的组，布局切为 `combo-combined`；关闭恢复原布局。随设置持久化，网络无概念组时不显示该开关。
- 左栏可收起/展开（工具栏最左按钮），状态随设置持久化。
- 边标签为关系类名，箭头 source → target。
- 按对象类自动配色，同一对象类同色；配色表优先取 Studio 现有主题色板；若无可复用色板，则在 `GraphCanvas` 内置 12 色序列，按对象类首次出现顺序分配。

### 7.3 工具栏

- 路径区：起点 / 终点标签可关闭（清除该端点）；只要选了任一端点或存在高亮，就显示「取消路径」按钮，一键清起点、终点与高亮。
- 布局：`force`（默认）/ `dagre` / `radial` / `circular` / `grid`，切换后立即重排。
- 节点形状：`circle`（默认）/ `rect` / `diamond` / `ellipse` / `hexagon` / `star`，全局生效。
- 节点名 / 边名开关：分别隐藏或显示节点标签与边标签，随 settings 持久化（`showNodeLabels` / `showEdgeLabels`，默认开）。
- 标签属性：按对象类选择，见 6.5。
- 适配视口（只在内容溢出时缩放，之后居中；单节点不会被放大到满屏）、清空画布、清除本地缓存（同时丢弃尚未落盘的防抖写入）。

### 7.4 上限

画布节点上限 500。超限的一批不会被拒绝：先把还能放的节点放上去，边随节点自然过滤，toast 说明有多少个没放上；移除节点后再展开可继续。阈值为常量，不做配置项。

## 8. 本地缓存

- key：`bkn-studio.graph-explorer.<kn_id>`
- 内容：

```ts
{
  version: 1,
  nodes: GNode[],
  edges: GEdge[],
  positions: Record<string, { x: number; y: number; fixed?: boolean }>,
  settings: { layout, shape, labelByOt: Record<string, string>, colorByOt: Record<string, number>, showNodeLabels: boolean, showEdgeLabels: boolean }
}
```

- 画布任一变化后 debounce 500 ms 写入。
- 打开页面若存在缓存：恢复并提示「已恢复上次画布」，提示条带「清除」按钮。
- 写入抛出配额异常时：改为只写 `settings`，并提示画布未能保存。
- `version` 不匹配时丢弃 nodes/edges，仅保留可识别的 settings。

## 9. 错误处理

| 情形 | 表现 |
| --- | --- |
| lifecycle 不可用（`feature_not_installed` / `trace_core_unavailable`） | 页面顶部 alert，搜索与展开按钮禁用；判定沿用 `lifecycle.unsupported()` |
| 展开后只有 `isolated_objects` | toast「该节点在此方向没有邻居」；不视为错误 |
| `explore_subgraph` / `search_instance` 返回业务错误 | toast 展示错误：Context Loader 的错误信封里 `details` 还嵌着下游信封，解出最内层的 `description` 与 `solution`（如「调用依赖服务异常：数据资源不存在（请检查数据资源ID）」），不吐原始 JSON；画布不变 |
| 401 | 沿用 `createMcpSession` 现有 `auth.refresh()` 重试 |
| 节点主键缺失导致无法构造 id | 该节点不加入画布，toast 说明对象类缺少主键 |

## 10. 依赖

- 新增 `@antv/g6` 5.x。安装前用 `npm view @antv/g6 versions` 核实最新 5.x 并钉死精确版本（2026-09-09 核实：`versions` 列表中最新 5.x 为 5.1.1；`time` 字段里的 5.2.1 / 5.3.1 已不可安装）。
- 不新增其他依赖。

## 11. 测试

### 11.1 单元测试（vitest）

- `graph-explorer.service.test.ts`
  - 三条入口的映射：给定固定响应，得到确定的 `GNode[] / GEdge[]`。
  - 节点 id 复刻：与 `_instance_id` 相同实例得到相同 id；多主键顺序、缺失主键 `__NULL__`。
  - 标签取值链：六级逐级回退；用户指定属性优先。
  - 查找路径筛选：多条 `relation_paths` 中取最短可达链；不可达返回 `null`。
  - 展开合并：重复节点与边不重复加入。
- `graph-explorer-cache.test.ts`
  - 序列化 / 反序列化往返一致；`version` 不匹配时丢弃 nodes/edges 保留 settings；配额异常降级。

### 11.2 实机验证（开 PR 前必做）

在测试服（14.103.77.23）或 yf 环境，以 Studio 登录态：

1. 打开工作台概览 → 点「图探索」→ 新标签页打开且路径正确。
2. 语义搜索一个已知实例 → 加入画布。
3. 条件查询同一实例 → 加入画布 → 画布仍只有一个该节点（id 收敛）。
4. 右键分别做出边 / 入边 / 双向展开，核对与 `explore_subgraph` 原始返回的节点数一致。
5. 指定起点终点查找路径 → 高亮；换一对不相连的节点 → 提示 3 跳内不连通。
6. 切换布局与形状；刷新页面 → 画布、位置、设置恢复。
7. 清除缓存 → 刷新为空画布。

## 12. 验收清单与失败条件

验收通过需同时满足：

- [ ] 路由、按钮、懒加载 chunk 就位；首屏包体积不因 G6 增长（`vite build` 输出核对）。
- [ ] 三条入口均通过 `withManagedTurn` 调用，网络面板可见 `bkn_start_interaction` / `bkn_finish_interaction`。
- [ ] 同一实例经不同入口加入画布只出现一次。
- [ ] 出边 / 入边 / 双向展开结果与后端返回一致。
- [ ] 路径查找可用且不可达有明确提示。
- [ ] 刷新后画布恢复；清除缓存后为空。
- [ ] `pnpm check` 全绿（license 头、类型检查、单测、构建）。
- [ ] i18n 中英文键齐全，`pnpm i18n:check` 通过。

出现以下任一情况判定失败：

- 任一工具调用绕过 `withManagedTurn` 直接发 `tools/call`。
- 节点 id 在不同入口不一致，画布出现同一实例的重复节点。
- 手写图形绘制或布局算法替代 G6 内置能力。
- 修改 context-loader 或 ontology-query。
- 改动落到 `main` 或其他分支。
