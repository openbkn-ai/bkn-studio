# 新版业务溯源分析设计（已归档）

> **状态：已归档。** 评审后确认该能力不是与旧模块并列的 V2，而是 BKN Trace 业务溯源的根本性重构。本文仅保留高保真交互验证记录；正式产品、采集、存储、投影与页面切换方案以 `bkn-docs/docs/foundry/bkn-trace/design/issue-tbd-0.1.4-business-provenance-refactor-design.md` 为准。

## 1. 目标与边界

在 Studio 左侧“可观测”导航下新增独立模块 **新版业务溯源分析**，与现有“业务溯源分析”并列。新版模块使用独立目录、路由、导航项和页面状态，不替换、不重构现有模块。

新版模块回答四个业务问题：

- **When**：一次业务会话、交互和调用何时发生，分别耗时多久；
- **Who / What**：哪个 Agent 调用了哪个业务知识网络，以及其中的对象、关系、行动、指标或逻辑；
- **How**：通过哪个接口、使用什么条件或 SQL 完成调用；
- **Result / Why**：调用返回了什么事实，这些事实如何支持最终结论，以及链路中有哪些可优化问题。

0.1.4 同时交付确定性业务溯源与 AI 优化建议。最小分析、复制、下载和 AI 输入单位统一为 **当前交互轮次 Markdown**：先生成不经过润色的轮次事实记录，再将同一份 Markdown 提交给平台固定配置的“业务溯源优化 BKN Agent”。不新增 MCP 入参，不改造 Trace 采集协议，不自动修改任何 BKN、MCP、SDK 或 Agent 配置。

## 2. 模块隔离

| 项目 | 设计 |
| --- | --- |
| 菜单名称 | 新版业务溯源分析 |
| 模块目录 | `src/modules/business-provenance-v2/` |
| 路由 | `/observability/business-provenance-v2` |
| 导航层级 | 与现有“业务溯源分析”并列 |
| 能力门控 | 复用现有 `BUSINESS_PROVENANCE` Enterprise capability |
| 旧模块影响 | 不修改旧页面、旧交互和旧展示解析逻辑 |

允许的共享只有现有只读服务能力、基础 UI 组件和 entitlement；新版业务解析器及其视图逻辑归新模块所有。

新版模块必须嵌入现有 OpenBKN Studio 页面框架，不创建独立应用外壳。顶部品牌、面包屑、管理员入口、左侧白色导航、内容区边界、筛选控件和列表密度沿用现有系统；仅在“可观测性”下新增企业版菜单“新版业务溯源分析”。

## 3. 信息架构

新版模块采用三层业务层级、两层页面结构。

### 3.1 一级：业务会话列表

进入模块后默认展示业务会话列表，而不是直接进入分析视图。每行代表一段 Conversation，展示：

- Agent / 应用；
- 开始时间与总耗时；
- 交互轮数与业务调用次数；
- 涉及的业务知识网络；
- 首个问题摘要与最终结果摘要；
- 状态与证据完整性。

列表支持现有业务溯源接口已经具备的时间、Agent、状态、知识网络和关键词筛选。选择一行后，以 `conversation_id` 进入会话分析；返回操作回到列表并保留筛选条件。

0.1.4 直接参考老版业务溯源的“业务会话”列表，复用两层筛选区、“开始时间、用户问题、交互轮次、业务结果、Agent、状态、证据完整性、耗时”八列、视觉密度和分页。新版模块不保留老版页面顶部的“业务会话 / 交互轮次 / OpenBKN 调用”三个 Tab；进入模块即为业务会话列表，选择 Conversation 后进入分析工作区。

### 3.2 二级页面：单个业务会话工作区

会话分析页头固定展示：

- Agent；
- Conversation ID；
- 开始/结束时间与总耗时；
- 交互轮数、调用次数；
- 涉及的知识网络；
- 完整性与异常状态。

会话工作区左侧提供可收缩的纵向 Interaction 轮次列表。每轮展示轮次编号、开始时间、耗时、调用次数、状态和问题摘要；列表支持关键词搜索和独立滚动，可承载几十轮而不横向溢出。收缩后只保留轮次编号和状态，切换轮次不离开页面，也不改变 Conversation。

真正的分析单位是当前选中的 Interaction。当前轮次提供两个互补视图：

1. **时间链视图**：解释本轮调用按什么顺序发生、每次做了什么、怎么调用、返回什么；
2. **知识网络视图**：解释本轮触达了知识网络中的哪些对象，以及这些对象在真实 BKN 关系中如何连接。

两个视图共享右侧调用详情浮层，切换视图或轮次时关闭旧详情。

工作区保持上一轮高保真原型的主体层次：左侧轮次列表、中间当前轮次摘要与双视图、右侧事实详情。调用详情默认关闭；用户点击事实后，以固定在视口右侧垂直中部的浮层显示，避免挤压时间链和知识网络主体。

### 3.3 当前交互轮次摘要卡

两个视图上方共享一张可收缩摘要卡。

收缩状态只保留：轮次、输入摘要、Agent、开始时间、耗时、调用次数、状态。

展开状态展示：

- 本轮完整输入；
- 本轮完整输出；
- Agent；
- 开始/结束时间与耗时；
- 调用次数；
- 涉及的业务知识网络；
- 状态与证据完整性；
- `复制 Markdown`、`下载 Markdown`、`交给 BKN Agent 分析`。

摘要卡回答“这一轮是什么”；下方视图回答“这一轮是怎么完成的”。时间链首尾只显示简短的“本轮输入”和“Agent 输出”节点，完整文本以摘要卡为准，避免重复大段内容。

### 3.4 页面状态与交互连续性

页面只维护五个必要状态：会话列表筛选、当前 Conversation、当前 Interaction、当前视图、当前选中事实。右侧详情面板和 BKN Agent 抽屉属于当前事实的展示状态，不创建新的分析层级。

```text
conversation list
→ conversation_id
→ interaction_id
→ timeline | knowledge_network
→ selected fact
```

- 返回会话列表时保留筛选条件；
- 切换 Interaction 时清空上一轮选中事实，默认选择本轮第一个 Operation；
- 切换视图时若同一对象可确定性对应，则保持对象选择，否则回到知识网络根节点或第一个 Operation；
- 收起摘要卡不改变当前 Interaction；
- 打开或关闭 BKN Agent 抽屉不改变当前视图、滚动位置和选中事实；
- URL 最小状态为 `conversation_id` 和 `interaction_id`，允许刷新后回到同一轮次；视图和面板开合只保留在页面内。

## 4. 确定性业务溯源解析器

解析器不生成无依据的自然语言，而是分三层处理。

### 4.1 Trace 事实层（Observed）

直接来自现有 Trace 和 Artifact：

- Conversation / Interaction / Request / Operation 标识和时间；
- 工具名、状态、耗时；
- Query Artifact 中的 SQL、资源和输入；
- Data Result Artifact 中的 `row_count`、`truncated` 等结果事实；
- Interaction Result Artifact 中的最终回答。

### 4.2 BKN 确定性映射层（Resolved）

使用现有知识网络定义完成：

```text
Query Artifact.resource_id
→ ObjectType.data_source.id
→ ObjectType
→ 相邻 RelationType
→ 相邻 ObjectType
```

资源映射到对象属于确定性解析；相邻关系若没有被 Trace 调用，只能标为“知识网络上下文”，不能标为实际使用。

### 4.3 链路解释层（Derived）

仅允许由明确规则形成的解释。例如：

```text
第一次：采购订单，material_number = X，row_count = 0
第二次：同一对象，名称或编号 LIKE X，row_count = 0
→ 扩大匹配范围后仍未找到采购订单
```

派生解释必须保留其输入 Operation，并可回到 SQL 和结果 Artifact。无法确定性证明时显示原始事实，不生成解释。

## 5. 时间链视图

时间链只展示当前 Interaction：

```text
用户问题
→ 调用之外的时间间隔
→ 业务调用 1
→ 业务调用 2
→ …
→ Agent 最终输出
```

“调用之外的时间间隔”不能标为“Agent 思考时间”，因为 Trace 没有直接观测该语义。

每次调用的卡片只展示四项核心信息：

- 动作：如“按物料编号查询采购订单供应商”；
- 业务目标：知识网络与对象；
- 条件：如“物料编号 = 101-000015”；
- 结果：如“返回 0 条，没有匹配到采购订单”。

详情面板按以下顺序呈现，避免动作和结果重复：

1. 做了什么；
2. 业务目标；
3. 怎么调用；
4. 查询结果；
5. 复现查询；
6. 技术信息。

调用详情默认关闭。点击任意时间链调用卡或知识网络节点时打开右侧详情；用户可以手动关闭，关闭后点击任意事实会再次打开。详情以右侧浮层在视口垂直中部出现，并随页面滚动保持居中，不再与触发卡片的位置绑定。切换 Interaction 或切换视图时关闭详情，避免保留上一上下文。

按钮、标签和正文沿用 Studio 的紧凑字号与间距：普通按钮约 12px、正文 12–13px、辅助信息 10–11px；不使用大字号、大圆角和过宽内边距制造新的视觉体系。

## 6. 知识网络视图

知识网络视图只展示当前 Interaction，采用渐进式四列展开，避免大而杂的自由图：

```text
业务知识网络 → 本次触达对象 → 真实关系 → 相邻对象
```

状态只分三类：

- **本次已触达**：直接查询对象，或访问资源可确定性映射到对象；
- **知识网络上下文**：BKN 中真实存在，但本次 Trace 未记录调用的关系或相邻对象；
- **探索候选**：`search_schema` 返回但后续没有实际触达的内容，默认折叠。

知识网络视图不能把 Schema 候选当作依据，也不能把相邻关系描述为 Agent 已经遍历。

四列不是一次性铺开：进入视图时只明确展示业务知识网络和本轮触达对象；用户选择一个触达对象后，才展示与该对象直接相关的 BKN 关系和相邻对象。对象详情同时列出确定性定位到该对象的真实调用，可继续打开调用详情查看接口、条件、资源与 SQL。除此之外不增加自由图、自动布局或推测路径。

## 7. 交互轮次 Markdown 事实协议

Markdown 是当前 Interaction 的事实记录，也是复制、下载和提交 BKN Agent 的唯一输入，不是面向汇报的润色报告。三种操作必须使用同一个生成函数和完全相同的字符串；不得在提交 Agent 前另行摘要、改写或拼接其他轮次。

### 7.1 排序与表达规则

- 严格按 `started_at` 升序排列 Operation；
- 时间使用带时区的完整时间，并同时保留耗时；
- 页面按 Studio 当前时区展示本地时间，Markdown 保留 Trace 原始 ISO 8601 时间；不得把 UTC 时间直接改写为本地偏移；
- 原样保留用户输入、Agent 输出、工具名、输入参数、SQL、结果规模和错误；
- 不把调用之外的间隔写成“思考时间”；
- 不把 `search_schema` 候选写成实际依据；
- 不把 BKN 相邻关系写成 Agent 已调用关系；
- 不把最终回答反推成单次 Operation 结果；
- Trace 事实、BKN 映射和确定性派生解释分区展示；
- 每个 Interaction、Operation 和派生解释使用稳定引用编号，例如 `I1`、`I1-O3`、`I1-D1`。

### 7.2 最小 Markdown 结构

````markdown
# 业务溯源交互轮次 I1

## 轮次元数据
- Conversation ID: ...
- Interaction ID: ...
- Agent: ...
- Started At: ...
- Completed At: ...
- Duration: ...
- Status: ...
- Evidence Completeness: ...
- Knowledge Networks: ...

## 本轮输入（原文）
...

## 调用时间链

### I1-O1
- Started At: ...
- Completed At: ...
- Duration: ...
- Tool: run_sql
- Status: completed
- Knowledge Network: ...
- Resolved Object: 采购订单
- Resolution: resource binding

#### 输入（原始事实）
- Resource ID: ...
- SQL:
  ```sql
  ...
  ```

#### 输出（原始事实）
- Row Count: 0
- Truncated: false
- Error: none

## 确定性链路解释
- I1-D1: 扩大匹配范围后仍未找到采购订单
  - Evidence: I1-O3, I1-O4
  - Rule: same_object + broader_condition + zero_rows

## 本轮输出（原文）
...

## 缺失与降级
- ...
````

Markdown 不增加“优秀/较差”“可能是因为”等主观包装。无法提供原始字段时明确写入“未记录”，不补写推测。

## 8. 专用 BKN Agent 优化分析

详细执行合同见归档目录外仍有效的 [业务溯源优化 BKN Agent 设计](../../specs/2026-08-08-business-provenance-optimizer-agent-design.md)。本节只保留与当时新版业务溯源页面的集成边界。

平台固定配置一个专用 **业务溯源优化 BKN Agent**。它是应用层诊断 Agent，不是业务执行 Agent。一次分析只对应一个源 Interaction，不继承其他分析上下文，不修改 BKN、Skill、MCP、SDK 或源 Agent。

### 8.1 BKN Agent 组成与输入

运行载体使用 Foundry 的平台内置 `bkn-agent`，不使用已废弃的 Decision Agent，也不在 Studio 前端运行模型循环。初版只包含一个固定 task Agent、一个诊断 Skill，并直接复用现有 Context Loader：

```text
business_provenance_optimizer（bkn-agent / task）
├── analyze_interaction_provenance Skill
└── Context Loader
```

`bkn-agent` 当前没有固定 BKN 挂载字段。0.1.4 将证据边界、异常信号、核验路径、问题归属规则、建议字段要求和拒绝输出规则沉淀在专用诊断 Skill；源 BKN 通过 Context Loader 按需查询，不新增“优化知识网络”作为前置依赖。

Studio 不直接访问仅集群内部可用的 `bkn-agent`。调用链为：

```text
Studio
→ agent-observability 业务溯源代理
→ POST /api/bkn-agent/v1/invoke/business_provenance_optimizer
→ Context Loader / 核验工具
→ 结构化结果
→ Studio 渲染建议 Markdown
```

代理向 `bkn-agent` 传入的 `message` 必须是复制和下载使用的同一份当前交互轮次 Markdown；同时传入固定 JSON Schema 作为 `response_format`。针对本轮实际调用过的接口，代理只读装配对应的 API / MCP 工具输入输出 Schema、生产者模块和当前 Trace / Artifact 合同版本，作为核验上下文，不改写业务 Markdown。`bkn-agent` 完成工具循环后生成经过 Schema 校验的结构化结果，Studio 再确定性渲染为可读 Markdown。

诊断请求的业务标识为：

```json
{
  "source_conversation_id": "conv_...",
  "source_interaction_id": "int_...",
  "interaction_markdown": "当前交互轮次 Markdown 原文"
}
```

提交 Agent 前不得摘要、改写或拼接其他 Interaction。每次分析只使用当前 Markdown、本轮实际调用接口的版本化合同、本次源 BKN 元数据核验结果和诊断 Skill 中的稳定规则。

### 8.2 双证据与只读核验

Agent 使用两类严格分离的证据：

- **源证据**：当前 Interaction Markdown，编号如 `I1-O3`；
- **核验证据**：源 BKN 只读查询，以及本轮实际调用接口的 API / MCP Schema、生产者信息和 Trace / Artifact 合同，编号如 `V-BKN-2`、`V-MCP-1`、`V-SDK-1`。

Context Loader 复用业务知识网络“智能问答”已验证的渐进式 Schema 读取链路。诊断 Skill 限定本任务只使用以下现有元数据工具：

```text
search_schema
get_kn_detail
get_object_types
get_relation_types
find_skills
list_skills
get_skill_content
read_skill_file
```

其中 BKN 工具核验对象、属性、关系、指标、行动、逻辑、资源绑定和字段映射；Skill 工具核验相关任务说明、所需对象关系与输出合同。0.1.4 不修改 `bkn-agent` 工具装载机制，也不新增核验工具箱；诊断 Skill 明确不得调用业务实例查询、`query_metric`、`run_sql`、行动执行或 Skill 执行。

0.1.4 不新增 MCP 业务入参或 Trace 协议。代理只读取平台已有的 MCP Tool Schema、API 契约和 Trace 2.2 Artifact 合同，并且只装配本轮调用过的接口。若某个版本化合同无法取得，对应类别输出 `not_evaluable`。这样可以继续向 API、MCP、SDK 定位事实缺口，又不建设通用源码分析系统。

核验证据不能反向证明源 Agent 实际使用过某个对象或关系。Agent 的核验调用形成独立 Trace，不污染源 Interaction。

### 8.3 严格诊断流程

```text
读取当前轮次事实
→ 识别可验证异常
→ 定向查询相关元数据
→ 判定主要问题归属
→ 生成最小修改建议
→ 校验证据和输出结构
```

只识别可以从事实计算或直接观察的信号，例如重复调用、相同条件重试、查询范围扩大、Schema 反复探索、调用失败或结果 Artifact 缺失。异常只触发定向核验，不直接等于问题结论。

一个问题只设一个主要归属：

- BKN 已有正确能力但 Agent 未使用，不归因到 BKN；
- MCP 没有返回已有 BKN 描述，归因到 MCP；
- Trace 未记录调用错误字段，归因到 SDK / Trace；
- 工具信息完整但 Agent 重复错误调用，归因到 Agent 或相关 Skill。

### 8.4 建议门禁与粒度

四类建议分别覆盖：

- **BKN**：对象、关系、属性、描述、数据绑定、指标、行动与逻辑；
- **MCP**：具体工具、参数、说明、返回字段与错误合同；
- **SDK**：具体 Span / Artifact、采集阶段和缺失字段；
- **Agent**：具体 Agent / Skill、提示词段落或工具选择规则。

不要求凑齐四类建议。类别状态只允许：

- `change_required`：证据完整，存在具体修改建议；
- `no_change`：完成相关核验，未发现需要修改；
- `not_evaluable`：缺少必要信息，无法判断。

每条建议必须包含：类别、精确修改位置、问题结论、具体修改内容、源证据、核验证据和验收用例。禁止输出“优化 Schema”“完善关系”“改进提示词”“增强错误处理”等无法直接进入修改任务的泛化建议。

以下任一情况成立时不得输出建议：

- 没有源证据或核验证据；
- 无法定位修改目标；
- 无法给出具体修改内容；
- 证据编号不存在；
- 只能形成可能性判断。

信息不足时输出 `not_evaluable` 和缺失项，不输出“待验证建议”。

### 8.5 可读 Markdown 输出

用户最终获得的是可阅读、复制和下载的 Markdown，不展示内部结构化数据。固定结构为：

````markdown
# 业务溯源优化建议

- 源 Interaction：int_...
- 分析时间：...
- 源 BKN 版本：...
- 优化 Agent 版本：...

## 分类结论

- BKN：需要修改
- MCP：无需修改
- SDK：无法判断
- Agent：需要修改

## 修改建议

### REC-BKN-01

- 类别：BKN
- 修改位置：HD供应链业务知识网络_v3 / 采购订单 / description
- 问题：采购订单对象描述未说明按物料编号查询采购记录的路径
- 证据：I1-O1、I1-O3、I1-O4、V-BKN-2
- 修改方式：替换

#### 建议内容

```text
建议修改后的完整文本
```

- 验收：相同问题下，Agent 首次检索后直接采用正确对象与属性。

## 无需修改

- MCP：已核验本轮调用工具定义，未发现需要修改的问题。

## 无法判断

- SDK：未取得当前 SDK Trace 采集合同。
````

不增加评分、置信度、趋势、长篇摘要或通用最佳实践。同一问题只输出一条建议。

### 8.6 失败、版本与结果隔离

- Markdown 无效时停止分析；
- 元数据查询失败时，相关类别不得生成建议；
- Agent 返回无效结构或伪造证据时，拒绝对应建议；
- 全部建议无效时显示“本次分析没有产生有效建议”，不展示原始模型文本；
- Agent 失败不影响源 Markdown 的复制和下载。

每次分析记录：源 Interaction ID、源 Markdown 哈希、源 BKN 版本、BKN Agent 版本、诊断 Skill 版本和分析时间。分析结果是独立记录，只关联源 Interaction，不写入源 Trace。

### 8.7 结果交互

点击“交给 BKN Agent 分析”后打开独立宽抽屉。`bkn-agent /invoke` 当前不返回内部阶段进度，因此分析中只显示真实的“正在分析”，不伪造“校验事实 → 核验元数据 → 生成建议”阶段。完成后渲染建议 Markdown，并提供复制、下载和重新分析。关闭后保留原时间链或知识网络的位置。0.1.4 只展示当前 Interaction 最近一次有效分析，不建设复杂历史版本页面。

高保真原型同时覆盖 Agent 的未提交、正在分析和结果三种状态。由于原型没有实际调用 BKN Agent，结果态必须显著标注“模拟诊断结果”；它可以使用真实 Interaction 事实和已知 BKN 映射验证信息结构，但不能冒充生产诊断结论。

## 9. 数据读取路径

业务溯源解析必须从 MCP、SDK 实际写入的 Trace 记录开始，而不是从页面文案、BKN Schema 或最终回答开始。固定顺序为：

```text
MCP / SDK Trace 采集事实
→ 单次 Operation 事实
→ 源 BKN 确定性映射
→ 跨 Operation 链路解释
→ BKN Agent 优化建议
```

第一手资源包括 Operation 生命周期、Span 时间与状态、Evidence Event、Query / Data Result / Action Artifact、错误、业务引用和生产者信息。先按 `interaction_id / operation_id / trace_id / artifact_ref` 拼出每次调用，再使用源 BKN 元数据按 ID 定位对象、属性、关系、行动、指标或逻辑，最后才允许比较前后调用形成链路解释。

`ConversationSummary`、`InteractionSummary`、`RequestSummary` 和 business graph 是 Trace 的稳定读取投影，用于列表、身份、排序、关联和完整性提示；它们不是新的业务事实来源，`controlled_summary` 等归纳文案不能替代 Artifact 原文。出现冲突时以有明确 `event_id / artifact_ref / operation_id` 的采集事实为准；Trace 没有记录的内容保持缺失，BKN 只负责映射和解释，不能反向补写调用输入或结果。

0.1.4 复用现有查询接口完成投影，不新增聚合接口：

```text
业务会话列表
→ GET /business-provenance/conversations

选择会话
→ GET /business-provenance/interactions?conversation_id=...
→ 选择当前 Interaction
→ GET /business-provenance/interactions/{interaction_id}
→ GET /interactions/{interaction_id}/business-graph
→ GET evidence chain / evidence artifact by trace, request and artifact refs
→ GET BKN object-types / relation-types / object detail
→ deterministic provenance parser
```

Artifact 只在选中 Interaction 后按引用读取；技术内容和完整 SQL 只在展开详情时呈现。Foundry 已有 Interaction business graph，但当前 Studio `trace.service.ts` 尚未封装该接口，新模块只增加前端服务适配。初版不新增 Foundry 聚合接口；若真实会话产生明显的 N+1 性能问题，再单独评估批量读取。

### 9.1 界面字段与事实来源

| 界面信息 | 已验证来源 | 当前可用性 | 处理规则 |
| --- | --- | --- | --- |
| 会话列表、分页 | `ConversationSummaryPage.entries / total / page / page_size` | 直接可用 | 只做摘要和计数，不解析 Artifact |
| 轮次列表 | `InteractionListSummary` | 直接可用 | 按 `started_at` 展示，保留分页 |
| 轮次完整输入、输出 | `InteractionSummary.question_artifact_ref / result_artifact_ref` → Artifact `content` | 直接可用 | Artifact 缺失时退回 preview 并明确为摘要 |
| 调用工具、时间、耗时、状态 | MCP / SDK Trace 生命周期与 Span 的稳定投影：`InteractionSummary.requests[]` 中的 `operation_id / tool_name / started_at / completed_at / duration_ms / status` | 直接可用 | 保留 trace / operation 关联，严格按时间排序；间隔只写“调用之外间隔” |
| `run_sql` SQL 与资源 | Query Artifact `content.sql / resource_ids`，按 `operation_id` 归并 | 直接可用 | SQL 原样展示，可复现；不另写推测性输入 |
| `run_sql` 结果规模与失败 | Data Result Artifact `row_count / truncated / status / error_stage / error_code / error_summary` | 直接可用 | 不保存、展示或反推原始结果行 |
| 非 SQL 查询的原始入参 | 当前 Operation 只有 `normalized_input_hash`；`search_schema`、`query_object_instance` 等没有输入 Artifact | **缺失** | 页面和 Markdown 写“输入原文未记录”，不得根据回答或调用名称补写条件 |
| `search_schema` 探索候选 | `retrieval.completed.source_refs / candidate_count`，结合所属 `operation_id` 与 `tool_name` | 直接可用 | 全部标为探索候选，后续未命中的不作为业务依据 |
| 直接触达的 BKN 元素 | Interaction business graph 的 `operation_business_edges` 与 resolved display | 直接可用 | 按 `operation_id` 关联；候选调用与业务调用分开分类 |
| 数据资源映射对象 | Query Artifact `resource_ids[]` → ObjectType `dataSource.id` | 需确定性关联 | 只允许同一知识网络内 ID 精确相等；零个或多个命中均不猜测 |
| 属性与字段映射 | Object detail `dataProperties[].name / mappedField` | 直接可用 | 用于解释业务属性与物理字段，不反向推断调用条件 |
| 真实关系与相邻对象 | RelationType `sourceObjectTypeId / targetObjectTypeId` | 直接可用 | 使用对象 ID 连接，不按名称包含匹配；只标“知识网络上下文” |
| Agent 建议 | 专用 BKN Agent 结构化结果 | 对接后可用 | 通过证据门禁后确定性渲染 Markdown |

### 9.2 当前事实缺口与最小补齐

当前 `run_sql` 已通过 Query Artifact 保存完整 SQL 和资源 ID，但其他读取工具通常只留下 `normalized_input_hash`。这不能满足“怎么调用、可复现”的目标，也是 0.1.4 正式实现前唯一需要 Foundry 补齐的核心事实。

最小方案复用现有 Artifact 机制：读取类工具由调用生产者写入 `query` Artifact，内容为该次工具的规范化完整入参，并通过 `operation_id` 与调用关联；行动类工具继续使用 `action_input` Artifact。不得把原始入参塞入 Summary，也不增加 MCP 工具参数。没有输入 Artifact 的历史调用保持“输入原文未记录”。

Data Result Artifact 只保存结果规模、截断和结构化错误，不复制原始业务数据行。调用卡不能把最终回答中的数值反推为单次调用结果；完整业务数值只可作为 Interaction 最终输出原文展示。

### 9.3 当前轮次投影合同

解析器接收一个 Interaction 对应的 Trace 结构记录、Evidence / Artifact 和源 BKN 定义，按“Trace → Operation → BKN → 链路解释”的顺序输出一个页面和 Markdown 共用的只读投影：

```ts
interface InteractionProvenanceProjection {
  interaction: InteractionFact;
  operations: OperationFact[];          // 严格按 started_at 排序
  touchedEntities: ResolvedEntity[];    // 仅直接记录或资源绑定命中
  contextRelations: ContextRelation[];  // 源 BKN 真实存在，但非调用事实
  schemaCandidates: SchemaCandidate[];  // 探索候选，默认折叠
  derivedFacts: DerivedFact[];           // 包含 rule 与 evidenceRefs
  missingFacts: MissingFact[];
}
```

时间链、知识网络视图和 Markdown 不得各自重复解析；三者必须消费同一个投影，避免同一事实出现三种口径。BKN Agent 只接收由该投影生成的 Markdown，不读取页面展示文案。

## 10. 空状态与失败状态

- 无会话：说明当前筛选范围内没有业务会话；
- 会话完整但某次调用无结果：显示 `row_count = 0` 对应的业务表达；
- Artifact 缺失：显示“结果事实未记录”，不得根据最终回答反推单次调用结果；
- BKN 映射失败：保留资源和 SQL，标记“尚未定位到业务对象”；
- 会话部分完整：展示已有链路并明确缺失范围；
- 调用失败：展示原始错误、失败阶段和可诊断字段；
- Markdown 生成缺少字段：保留完整结构并在对应位置写“未记录”；
- BKN Agent 不可用：保留复制和下载能力，显示分析失败原因，不降级为 Studio 直接调用模型；
- BKN Agent 核验信息不足：相关类别显示“无法判断”和具体缺失项，不生成推测建议；
- BKN Agent 建议未通过证据或结构校验：拒绝该建议，不展示原始模型文本。

## 11. 0.1.4 验收标准

- 左侧新增独立“新版业务溯源分析”菜单，旧模块保持可用且行为不变；
- 默认展示真实业务会话列表；
- 业务会话列表复用老版筛选、八列结构和分页，但不展示“业务会话 / 交互轮次 / OpenBKN 调用”三个 Tab；
- 选择会话后进入会话工作区，并可切换 Interaction 轮次；
- 时间链和知识网络视图只分析当前选中的 Interaction；
- 两个视图顶部共享可收缩轮次摘要卡，包含完整输入、完整输出、时间、Agent、调用次数和状态；
- 时间链可展示当前 Interaction 的真实调用事实、已记录的 SQL / 输入条件、结果规模与最终回答；输入 Artifact 缺失时明确显示未记录；
- 调用详情默认关闭，打开后在视口右侧垂直居中并随页面滚动保持居中；可关闭、再次打开，切换上下文时不保留旧详情；
- 知识网络视图初始只展示网络和确定性触达对象，选择对象后才逐步展示精确关联的 BKN 关系与相邻对象；
- 知识网络对象详情能够回到确定性定位该对象的真实调用，关系端点不得通过模糊字符串包含推测；
- 未触达的真实关系与相邻对象必须标为知识网络上下文；
- `search_schema` 候选不作为实际依据；
- `row_count = 0` 可表达为“返回 0 条”，链路比较可表达“扩大范围后仍未找到”；
- 每条解释可以回到 Operation、Query Artifact 和 Data Result Artifact；
- 当前 Interaction 可以复制和下载完整 Markdown；
- Markdown 严格按时间排序；只原样呈现 Artifact 已记录的调用输入、SQL、结果规模和错误，缺失输入明确写“输入原文未记录”，不使用误导 Agent 的润色叙述；
- 复制、下载和提交 BKN Agent 使用完全相同的 Markdown；
- 平台固定的“业务溯源优化 BKN Agent”可使用当前 Interaction Markdown 和源元数据只读核验，输出 BKN、MCP、SDK 和 Agent 四类建议；
- 每条建议包含精确修改位置、具体修改内容、源证据、核验证据和验收用例；
- 没有证据、无法定位或只能形成可能性判断时不输出建议；
- 类别可明确为需要修改、无需修改或无法判断，不强制凑齐四类建议；
- 最终结果为严格、简短、可复制和下载的 Markdown；
- BKN Agent 分析只读，不自动修改 BKN、MCP、SDK 或 Agent；
- 不新增 MCP 参数，不影响旧业务溯源模块；
- 增加解析器、会话列表、两个视图和路由隔离的测试。

## 12. 后续边界

不进入 0.1.4：

- 任意图布局、缩放、小地图；
- 写回或修改知识网络；
- 新 Trace 采集协议；
- 旧业务溯源页面迁移或下线。

## 13. 高保真设计验证

独立高保真原型为 `public/business-provenance-v2-prototype.html`，使用真实会话 `conv_73fc12a00ac46933c3d8015616a1b1b3` 的两轮 Interaction 和可由当前 Trace 确认的调用事实；非 SQL 输入原文缺失时直接展示缺失，不补写模拟条件。原型覆盖：

- 独立左侧菜单与业务会话列表入口，复用老版筛选、八列结构和分页但去掉三个 Tab；
- Conversation 工作区与 Interaction 轮次切换；
- 可收缩、可搜索、可滚动的纵向轮次列表，用两轮真实数据验证交互，不虚构几十轮业务事实；
- 可收缩轮次摘要卡；
- 仅针对当前轮次的时间链和知识网络视图；
- 两视图共享随页面滚动保持在视口垂直中部的右侧调用详情浮层；
- 当前轮次 Markdown 的复制、下载和 Agent 提交入口；
- Agent 未提交、正在分析、严格结果和失败四种状态；模拟状态明确标识。结果包含分类结论、精确建议、源证据、核验证据、验收、复制、下载和重新分析；失败时保留当前轮次事实 Markdown 的复制与下载。

原型用于验证信息架构、事实边界和交互连续性，不直接复用为生产代码。生产实现仍按独立模块、统一投影和现有 API 数据路径落地。
