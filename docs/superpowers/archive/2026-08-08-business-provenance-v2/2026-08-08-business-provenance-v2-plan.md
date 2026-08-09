# 新版业务溯源分析 Implementation Plan（已归档）

> **状态：停止执行。** “新增独立 V2、旧模块保持不变”的实施路径已被取代。正式计划迁移到 `bkn-docs/docs/foundry/bkn-trace/design/issue-tbd-0.1.4-business-provenance-refactor-plan.md`；本文只保留已完成的原型验证记录，不得继续作为生产实现清单。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变现有业务溯源模块的前提下，新增以业务会话列表为入口、以当前 Interaction Markdown 为最小分析单位、展示时间链和知识网络并调用专用 BKN Agent 生成优化建议的独立模块。

**Architecture:** 新模块位于 `src/modules/business-provenance-v2/`，通过独立 manifest、导航、路由和场景实现隔离。会话工作区选择一个 Interaction 后驱动摘要卡、时间链、知识网络和 Markdown 生成；同一份 Markdown 可复制、下载或提交给平台固定的专用 BKN Agent。

**Tech Stack:** React, TypeScript, Ant Design, CSS Modules, Vitest, Testing Library.

---

### Task 0: 冻结高保真原型与交互基线

**Files:**
- Prototype: `public/business-provenance-v2-prototype.html`
- Test: `src/modules/business-provenance-v2/prototype/standalone-prototype.test.ts`
- Design: `docs/superpowers/specs/2026-08-08-business-provenance-v2-design.md`

- [x] 在现有 OpenBKN Studio 页面框架内完成独立模块高保真原型。
- [x] 会话列表参考老版“业务会话”页面，复用筛选、八列结构、视觉密度和分页；不保留三个 Tab。
- [x] 使用真实会话 `conv_73fc12a00ac46933c3d8015616a1b1b3` 的两个 Interaction 和当前 Trace 可确认的调用事实；缺失的非 SQL 输入原文明确标记为未记录。
- [x] 冻结时间链、知识网络、右侧调用详情和 BKN Agent 抽屉的核心交互。
- [x] BKN Agent 原型覆盖未提交、分析中、严格结果和失败四种状态；失败时保留当前轮次 Markdown 复制与下载。
- [x] 调用详情默认关闭，点击事实后在视口右侧垂直居中打开；随页面滚动保持居中，关闭后可再次点击打开。
- [x] 知识网络只按“网络 → 触达对象 → 相关 BKN 关系 → 相邻对象”逐步展开，对象可回到真实调用。
- [x] 原型测试通过；正式实现不得在开发阶段自行增加信息层级或改变事实边界。

---

### Task 1: 建立独立模块与路由

**Files:**
- Create: `src/modules/business-provenance-v2/module.manifest.ts`
- Create: `src/modules/business-provenance-v2/navigation.tsx`
- Create: `src/modules/business-provenance-v2/routes.tsx`
- Create: `src/modules/business-provenance-v2/pages/BusinessProvenanceV2Page.tsx`
- Test: `src/modules/business-provenance-v2/routes.test.tsx`
- Modify: runtime module and shell contribution registries

- [ ] 先写失败测试，断言新增菜单和 `/observability/business-provenance-v2` 路由存在。
- [ ] 断言旧“业务溯源分析”菜单和路由保持不变。
- [ ] 实现独立模块注册并复用 Enterprise `BUSINESS_PROVENANCE` capability。
- [ ] 运行路由与导航测试。

### Task 2: 实现业务会话列表入口

**Files:**
- Create: `src/modules/business-provenance-v2/services/business-provenance-v2.service.ts`
- Create: `src/modules/business-provenance-v2/scenes/BusinessConversationListScene.tsx`
- Create: `src/modules/business-provenance-v2/scenes/BusinessProvenanceV2Scene.module.css`
- Test: `src/modules/business-provenance-v2/scenes/BusinessConversationListScene.test.tsx`

- [ ] 先写失败测试，覆盖真实会话字段、筛选和选择行为。
- [ ] 用现有 Conversation Summary 接口实现列表。
- [ ] 复用老版业务会话列表的分页参数、分页器和返回列表时的页码状态。
- [ ] 不实现“业务会话 / 交互轮次 / OpenBKN 调用”三个 Tab，新版模块默认且仅以业务会话列表为一级入口。
- [ ] 选择会话后写入 `conversation_id`，返回时保留筛选状态。
- [ ] 验证加载、空状态、失败状态和部分完整状态。

### Task 3: 实现确定性业务溯源解析器

**Files:**
- Create: `src/modules/business-provenance-v2/model/provenance.types.ts`
- Create: `src/modules/business-provenance-v2/model/provenance.parser.ts`
- Test: `src/modules/business-provenance-v2/model/provenance.parser.test.ts`

- [ ] 先写失败测试，覆盖 Trace 事实、资源到对象映射和上下文关系分类。
- [ ] 固定解析顺序为“MCP / SDK Trace 采集事实 → Operation → BKN 映射 → 链路解释”；不得从 BKN 或最终回答反向补写 Trace。
- [ ] 封装现有 `GET /interactions/{interaction_id}/business-graph`，并按 Artifact ref 读取现有 Artifact API；不新增 Foundry 聚合接口。
- [ ] Summary 只承载列表、身份、排序、关联和完整性；每个业务结论必须保留 `event_id / artifact_ref / operation_id` 中至少一种可回读引用。
- [ ] 覆盖 Query Artifact SQL 与 Data Result Artifact `row_count` 拼接。
- [ ] Foundry / 调用生产者为 `search_schema`、`query_object_instance` 等读取工具补充规范化完整入参的 Query Artifact；不修改 MCP 入参。
- [ ] 历史调用或生产者没有输入 Artifact 时输出“输入原文未记录”，不得根据最终回答补写条件。
- [ ] 覆盖“精确查询 0 条 → 扩大查询 0 条”的链路解释。
- [ ] Data Result Artifact 只使用规模、截断和结构化错误；不得将最终回答中的数值反推成单次调用结果。
- [ ] 资源通过 `ObjectType.dataSource.id` 精确映射对象；关系通过 `sourceObjectTypeId / targetObjectTypeId` 连接。
- [ ] 确保缺少 Artifact 时不生成无依据结论。
- [ ] 实现最小纯函数解析器并运行测试。

### Task 4: 实现交互轮次导航、摘要卡与时间链视图

**Files:**
- Create: `src/modules/business-provenance-v2/scenes/ConversationAnalysisScene.tsx`
- Create: `src/modules/business-provenance-v2/components/InteractionNavigator.tsx`
- Create: `src/modules/business-provenance-v2/components/InteractionSummaryCard.tsx`
- Create: `src/modules/business-provenance-v2/components/ProvenanceTimelineView.tsx`
- Create: `src/modules/business-provenance-v2/components/ProvenanceDetailPanel.tsx`
- Test: `src/modules/business-provenance-v2/scenes/ConversationAnalysisScene.test.tsx`

- [ ] 先写失败测试，覆盖 Interaction 选择、摘要卡收缩、调用顺序、耗时、条件和结果。
- [ ] 实现会话工作区内的 Interaction 导航。
- [ ] 实现包含完整输入、输出、时间、Agent、调用次数和状态的可收缩摘要卡。
- [ ] 实现当前 Interaction 的问题—调用—回答时间链。
- [ ] 区分“做了什么”“怎么调用”“查询结果”。
- [ ] 支持完整 SQL 和技术信息折叠展示。
- [ ] 右侧调用详情默认关闭；点击调用后以视口垂直居中的浮层打开，页面滚动时保持居中。
- [ ] 用户可关闭详情；关闭后点击任意调用或知识网络事实可再次打开。切换 Interaction 或视图时关闭旧详情。

### Task 5: 实现知识网络视图

**Files:**
- Create: `src/modules/business-provenance-v2/components/ProvenanceKnowledgeNetworkView.tsx`
- Modify: `src/modules/business-provenance-v2/scenes/ConversationAnalysisScene.tsx`
- Test: `src/modules/business-provenance-v2/scenes/ConversationAnalysisScene.test.tsx`

- [ ] 先写失败测试，覆盖网络—触达对象—关系—相邻对象展开。
- [ ] 明确区分已触达、网络上下文和探索候选。
- [ ] 验证 Schema 候选默认折叠且不作为依据。
- [ ] 初始只展示业务知识网络和本轮触达对象；选择对象后才展示相关关系与相邻对象。
- [ ] 关系端点按 `sourceObjectTypeId / targetObjectTypeId` 匹配，不得用名称字符串包含生成相邻对象。
- [ ] 对象详情列出确定性定位到该对象的真实调用，并可继续打开接口、条件、资源、结果和 SQL 详情。
- [ ] 未被 Trace 触达的关系与相邻对象只标记为知识网络上下文，不描述为 Agent 已遍历。

### Task 6: 生成交互轮次 Markdown

**Files:**
- Create: `src/modules/business-provenance-v2/export/interaction-markdown.ts`
- Create: `src/modules/business-provenance-v2/export/interaction-markdown.test.ts`
- Create: `src/modules/business-provenance-v2/components/InteractionExportActions.tsx`

- [ ] 先写失败测试，断言 Operation 严格按时间排序并具有稳定证据编号。
- [ ] 覆盖轮次输入输出、已记录的调用输入、原始 SQL、结果规模、错误、BKN 映射和派生解释分区；调用输入缺失时只输出“未记录”。
- [ ] 断言缺失字段输出“未记录”，不从最终回答反推单次调用结果。
- [ ] 实现单一 Markdown 生成函数。
- [ ] 复制与下载操作必须消费该函数返回的同一个字符串。
- [ ] 提交 Agent 前不得摘要、改写或拼接其他 Interaction 内容。
- [ ] 使用真实 Interaction `int_41d61bc56f7e5488171fa395ba73f58b` 验证内容。

### Task 7: 对接专用业务溯源优化 BKN Agent

**Design:** `docs/superpowers/specs/2026-08-08-business-provenance-optimizer-agent-design.md`

**Files:**
- Create (Foundry): business-provenance optimizer proxy port, adapter and handler under `bkn-trace/agent-observability/src/`
- Test (Foundry): focused proxy handler and adapter tests
- Create: `src/modules/business-provenance-v2/services/provenance-optimizer-agent.service.ts`
- Create: `src/modules/business-provenance-v2/model/provenance-recommendation.types.ts`
- Create: `src/modules/business-provenance-v2/model/provenance-recommendation.validator.ts`
- Create: `src/modules/business-provenance-v2/export/recommendation-markdown.ts`
- Create: `src/modules/business-provenance-v2/components/ProvenanceRecommendations.tsx`
- Create: `src/modules/business-provenance-v2/components/ProvenanceRecommendationsDrawer.tsx`
- Test: `src/modules/business-provenance-v2/model/provenance-recommendation.validator.test.ts`
- Test: `src/modules/business-provenance-v2/export/recommendation-markdown.test.ts`
- Test: `src/modules/business-provenance-v2/components/ProvenanceRecommendationsDrawer.test.tsx`

- [ ] 先写失败测试，断言提交给 Agent 的内容与复制/下载 Markdown 完全一致。
- [ ] 将固定 Agent 配置为 `business_provenance_optimizer`、`mode=task`、`status=published`，挂载专用诊断 Skill。
- [ ] 不创建强制性的“优化知识网络”；稳定诊断规则进入专用 Skill，源 BKN 通过 Context Loader 查询。
- [ ] 通过平台配置读取固定 BKN Agent 身份，不允许用户任意切换。
- [ ] 在 agent-observability 增加最小业务溯源代理，内部调用 `/api/bkn-agent/v1/invoke/business_provenance_optimizer`，透传最终用户 Authorization 和必要身份上下文。
- [ ] 定义单个 Interaction 对应一次独立分析的输入合同，不继承历史分析上下文。
- [ ] 复用现有 Context Loader；诊断 Skill 只允许使用 Schema、BKN 和 Skill 元数据工具，不调用实例查询、指标取数、`run_sql`、行动或 Skill 执行。
- [ ] 代理只读装配本轮实际调用接口的 API / MCP Schema、生产者模块和 Trace / Artifact 合同；不新增 MCP 业务入参或 Trace 协议。
- [ ] 对缺失事实按“接口接收 → 合同表达 → 生产者写入 → 读取返回 → Studio 解析”逐层归因；合同无法取得时才输出 `not_evaluable`。
- [ ] 代理使用 `response_format` 要求严格结构化输出，Studio 确定性渲染建议 Markdown。
- [ ] 定义 `change_required`、`no_change`、`not_evaluable` 三种类别状态。
- [ ] 先写失败测试，拒绝缺少精确修改位置、具体修改内容、源证据、核验证据或验收用例的建议。
- [ ] 先写失败测试，拒绝不存在的证据编号、泛化建议和可能性建议。
- [ ] 实现最小建议校验器；四类不要求都有建议。
- [ ] 生成固定格式的可读建议 Markdown，不包含评分、置信度、趋势或通用最佳实践。
- [ ] 实现独立宽抽屉；分析中只显示“正在分析”，不伪造 `bkn-agent /invoke` 未提供的阶段进度。
- [ ] 实现只读分析，不提供自动应用或写回入口；分析 Trace 不污染源 Interaction。
- [ ] 记录源 Markdown 哈希、源 BKN、BKN Agent 和诊断 Skill 版本。
- [ ] BKN Agent 调用失败时保留复制/下载能力并展示明确错误。
- [ ] 元数据查询失败时将相关类别标为 `not_evaluable`，不得生成建议。
- [ ] 全部建议无效时只显示“本次分析没有产生有效建议”，不展示原始模型文本。

### Task 8: 集成与回归验证

- [ ] 运行新版模块全部测试。
- [ ] 运行现有 `bkn-trace` 模块测试，确认旧模块无行为变化。
- [ ] 运行 TypeScript、type-aware ESLint、License 和 Vite build。
- [ ] 使用真实会话 `conv_73fc12a00ac46933c3d8015616a1b1b3` 验证两个视图。
- [ ] 验证调用详情在滚动前后保持视口垂直居中，并覆盖关闭、再次打开及切换上下文自动关闭。
- [ ] 验证知识网络初始不铺开关系；选择“采购订单”后只展示精确关联的供应商、物料请购单及对应真实调用。
- [ ] 验证每轮摘要卡、Markdown 复制、下载和 BKN Agent 输入一致性。
- [ ] 验证四类建议及证据引用。
- [ ] 验证 BKN 已有能力但 Agent 未使用时不会错误归因到 BKN。
- [ ] 验证无问题类别输出 `no_change`，信息不足类别输出 `not_evaluable`。
- [ ] 验证模糊建议、伪造证据和无修改位置建议被拒绝。
- [ ] 验证最终建议 Markdown 可读、可复制、可下载且内容一致。
- [ ] 验证无 Artifact、映射失败、调用失败和部分完整场景。
- [ ] 评审后再决定提交、PR 与部署，不自动替换旧模块。
