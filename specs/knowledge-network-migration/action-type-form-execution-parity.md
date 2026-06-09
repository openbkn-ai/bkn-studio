# 行动类两步表单 + 执行配置 + 详情 Parity 清单（V3-3）

> 范围：**行动类**创建/编辑两步表单、独立执行配置页、详情 Overview / TaskManagement，及其依赖的类型 / service / mock。  
> 不在本切片：行动类 JSON 导入（后续）、运行策略第三步（Vega 当前已注释，本切片仅预留字段与详情只读展示）。

参考源：

| Vega 路径 | 用途 |
| --- | --- |
| `D:\kowell\kowell-dip\web\apps\vega\src\pages\ActionCreateAndEdit\` | 两步创建/编辑 |
| `D:\kowell\kowell-dip\web\apps\vega\src\pages\Action\index.tsx` | 列表 |
| `D:\kowell\kowell-dip\web\apps\vega\src\pages\Action\Detail\index.tsx` | 详情壳（Overview + TaskManagement） |
| `D:\kowell\kowell-dip\web\apps\vega\src\pages\Action\Detail\Overview\index.tsx` | 概览 |
| `D:\kowell\kowell-dip\web\apps\vega\src\pages\Action\Detail\TaskManagement\index.tsx` | 执行日志 |

目标入口：

| 场景 | 路由 |
| --- | --- |
| 列表 | `/knowledge-network/workspace/:networkId/action-types` |
| 新建 | `/knowledge-network/workspace/:networkId/action-types/create` |
| 编辑 | `/knowledge-network/workspace/:networkId/action-types/:actionTypeId/edit` |
| 详情 | `/knowledge-network/workspace/:networkId/action-types/:actionTypeId/detail` |
| 执行配置 | `/knowledge-network/workspace/:networkId/action-types/:actionTypeId/execution` |

---

## 1. 迁移边界（No-Loss）

### 必须保留

- 两步步骤条：基础信息 → 执行映射（与 Vega 当前一致；RunStrategy 第三步在 Vega 已注释，不作为阻塞项）
- Step 1：名称 / ID / 标签 / 颜色 / 描述 / 行动类型 / 绑定对象类 / **触发条件** / **影响对象类 + 影响说明**
- Step 2：**工具或 MCP 执行来源** + **参数映射表**（工具参数 ↔ 绑定对象属性）
- 创建 / 编辑保存后返回列表（或详情，与 V3-2 关系类映射页对齐时可改回详情）
- 独立执行配置页：与表单 Step 2 共用 Editor，保存后数据一致
- 详情壳：侧栏 **概览** + **任务管理**；头部 **立即执行** 按钮
- 概览：基础信息、触发条件只读、绑定/影响对象、工具信息、参数映射只读表、调度计划只读（有则展示）
- 任务管理：执行日志列表、状态/触发方式筛选、关键词搜索、分页、详情抽屉、取消执行

### 允许差异

- bkn-studio 保留 `notify` 行动类型（后端 `NOTIFY` 已支持；Vega UI 仅 add/modify/delete 三项）
- 颜色字段保留（与列表卡片一致）
- 工具选择器：若项目尚无 `AddToolModal` / tool 模块，Wave B 先用「来源名称 + 类型」+ mock 工具元数据，Wave E 再接入真实工具箱 / MCP API
- 触发条件：优先复用或移植 `DataFilterNew`；若短期不可行，Wave A 用结构化 condition 占位 + mock 持久化，Wave C 再换完整筛选 UI

### 明确不在本切片

- 行动类 JSON 导入流程深化（列表已有 `JsonResourceImportButton` 骨架）
- Vega 已注释的 RunStrategy **编辑步骤**（字段与详情只读展示可预留）
- 全局任务模块（V3-6）— 本切片仅行动类详情下的 TaskManagement

---

## 2. 文件映射

| Vega 源文件 | bkn-studio 目标 | 当前状态 |
| --- | --- | --- |
| `ActionCreateAndEdit/index.tsx` | `scenes/ActionTypeFormScene.tsx` | partial — 两步编排已有，缺 condition/affect、beforeunload、保存后导航 |
| `BasicInformation/index.tsx` | Step 1 内联 Form | partial — 缺触发条件、影响对象 |
| `Mapping/index.tsx` | `ActionTypeExecutionEditor.tsx` | partial — 简化为 sourceType/sourceName + 普通属性 Select |
| `Mapping/ActionSource/index.tsx` | `ActionTypeSourcePicker.tsx`（待建） | todo |
| `components/ToolParamsTable` | `ActionTypeParameterMappingTable.tsx`（待建） | todo — 需工具参数 schema 驱动 |
| `Action/Detail/index.tsx` | `scenes/ActionTypeDetailScene.tsx` | partial — 单页摘要，无 Overview/Task 子路由 |
| `Action/Detail/Overview/index.tsx` | `ActionTypeOverviewPanel.tsx`（待建） | todo |
| `Action/Detail/TaskManagement/index.tsx` | `ActionTypeTaskManagementPanel.tsx`（待建） | todo |
| — | `scenes/ActionTypeExecutionScene.tsx` | partial — 壳 + Editor，placeholder 样式未去 |
| — | `components/action-type/ActionTypeListPanel.tsx` | done — 列表主链路可用 |
| — | `pages/ActionType*Page.tsx` | done — 薄包装 |

---

## 3. 当前基线与差距

### 已有

- `ResourceFormStepsShell` 两步编排（prev / next / save）
- Step 1：名称 / ID / 颜色 / 标签 / 描述 / 行动类型 / 绑定对象类 + 校验
- Step 2：`ActionTypeExecutionEditor` — sourceType、sourceName、参数名 + 对象属性 Select
- 独立执行配置页路由与保存链路（mock 持久化 `mockActionTypeExecutionConfigs`）
- 详情页：基础摘要 + 执行参数只读表 + 跳转编辑/执行配置/删除
- Mock 样例：`kn-domain-risk` / `at-risk-block`
- 列表：筛选、排序、分页、批量删除、创建/编辑/详情/执行入口

### 主要差距

| 区域 | 差距 |
| --- | --- |
| Step 1 触发条件 | 无 `condition` 字段与 DataFilter UI |
| Step 1 影响对象 | 无 `affect.objectTypeId` / `affect.comment` |
| Step 2 执行来源 | 文本 Input 代替工具箱 / MCP 选择器（`ActionSource`） |
| Step 2 参数表 | 手动增删行，非工具参数 schema 驱动；属性 Select 无 FieldTypeIcon |
| 类型模型 | `ActionTypeExecutionConfig` 过简；缺 `actionSource`、`condition`、`affect`、`schedule` |
| Service | create/update HTTP body **未发送** `action_source`、`parameters`、`condition`、`affect` |
| Detail 回读 | API 路径 `executionConfig` 为默认空配置 |
| 详情结构 | 无 Overview / TaskManagement 分 tab；无「立即执行」 |
| 任务管理 | 无执行日志 API / 列表 / 抽屉 / 取消 |
| 表单体验 | 缺 `beforeunload`、保存后宜跳详情（对齐 V3-2 RT-6） |
| i18n | `actionTypeExecutionPending` 等仍为占位文案 |

---

## 4. 功能需求明细

### Step 1 — 基础信息（AT-1）

对照 `BasicInformation/index.tsx`

- [ ] 表单宽度 ~900px（或与本模块 object/relation Step 1 统一），vertical layout
- [ ] 字段：名称（必填，≤40）、ID（pattern，编辑禁用）、标签（≤5、≤40/项）、颜色、描述（≤1000）
- [ ] 行动类型 Select（create/update/delete/notify → backend ADD/UPDATE/DELETE/NOTIFY）
- [ ] 绑定对象类：带 icon + color 的 ObjectType Select（复用 `RelationTypeObjectTypeSelect` 模式）
- [ ] 触发条件：`condition` — DataFilter 或等价组件；绑定对象变更时清空 condition
- [ ] 影响对象类 Select（可选）+ 影响说明 TextArea（≤255）
- [ ] 下一步：校验通过后写入 `basicValue`，Step 2 info bar 展示行动名 / 类型 / 绑定对象

### Step 2 — 执行映射（AT-2）

对照 `Mapping/index.tsx` + `ActionSource` + `ToolParamsTable`

- [ ] 执行来源：`ActionTypeSourcePicker` — 打开工具选择 Modal（或 interim 手动录入 box_id/tool_id/mcp_id）
- [ ] 切换 / 清空来源时重置 `parameters` 为工具 schema 默认行
- [ ] 参数映射表：列 = 工具参数名（只读或可编辑）、对象属性（FieldSelect 风格）、操作
- [ ] 校验：已选执行来源 + 至少一条完整参数映射
- [ ] Step 2 info bar：行动名、绑定对象、有效参数条数（已有，需对齐新模型）

### 表单编排（AT-3）

对照 `ActionCreateAndEdit/index.tsx`

- [ ] 创建：Step 0 next → Step 1；Step 1 save → create API → 回列表或详情
- [ ] 编辑：加载 detail 回填 Step 1 + Step 2；`doneStep` 允许点击已完成步骤
- [ ] `beforeunload` + 返回确认覆盖 Step 2 变更
- [ ] 保存 payload 经 `normalizeActionTypeFormValues` + `toBackendActionTypePayload`

### 独立执行配置页（AT-4）

- [ ] 去掉 `placeholderCard` 与 pending 占位文案
- [ ] 与 Form Step 2 共用 `ActionTypeExecutionEditor`（或拆出的 Shell + 子组件）
- [ ] 保存：仅更新 execution 相关字段，保留 Step 1 字段
- [ ] 保存后导航：建议跳转 **详情**（对齐 V3-2 关系类映射页）

### 类型与 Service（AT-5）

- [ ] 扩展 `action-type.ts`：
  - `ActionTypeCondition`（与 backend / Vega 对齐）
  - `ActionTypeAffect`（`objectTypeId?`, `comment?`）
  - `ActionTypeActionSource`（`type`, `boxId?`, `toolId?`, `mcpId?`, `toolName?` 等）
  - `ActionTypeExecutionParameter`（`name`, `sourcePropertyName`, 可选 `required` / tool schema 元数据）
  - `ActionTypeSchedule`（`type`, `expression` — 只读回读为主）
  - `ActionTypeDetail` 含完整上述字段
- [ ] `BackendActionType` + `action-type.mapper.ts`：`toBackendActionTypeCreateEntry`、`toBackendActionTypeUpdatePayload`、`mapActionTypeDetailFromBackend`
- [ ] Mock：`persistMockActionTypeDetailExtras`（condition / affect / actionSource）或统一 detail store
- [ ] HTTP create/update 发送 Vega 对齐 body（含 `branch: main`、`action_source`、`parameters`、`condition`、`affect`）

### 详情 — Overview（AT-6）

对照 `Action/Detail/Overview/index.tsx`

- [ ] 详情壳：侧栏导航 Overview | TaskManagement；当前路由或 query 切换
- [ ] 基础信息 Descriptions（名称、ID、标签、颜色、描述、行动类型、更新人/时间）
- [ ] 触发条件只读（DataFilter 只读或 JSON 摘要）
- [ ] 绑定对象类 / 影响对象类 ObjectCell 展示
- [ ] 工具 / MCP 信息卡（名称、描述；需 tool API 或 mock）
- [ ] 参数映射只读表（FieldTypeIcon + displayName）
- [ ] 调度计划只读（有 schedule 则格式化展示，无则 `--`）
- [ ] 头部操作：编辑、执行配置、删除、**立即执行**

### 详情 — TaskManagement（AT-7）

对照 `Action/Detail/TaskManagement/index.tsx`

- [ ] 执行日志表格：状态、触发方式、开始/结束时间、耗时、操作人、结果摘要
- [ ] 筛选：状态、触发方式（manual / schedule / event）、关键词
- [ ] 分页；空态 / 无搜索结果态
- [ ] 行操作：查看详情抽屉；running/pending 可取消
- [ ] Service：`listActionTypeExecutionLogs`、`getActionTypeExecutionLogDetail`、`cancelActionTypeExecution`（mock 优先）
- [ ] 「立即执行」调用 `executeActionTypeNow` 后刷新 TaskManagement

### 列表对齐（AT-8，可选）

对照 `Action/index.tsx`

- [ ] 列、筛选、操作菜单与 Vega 视觉对齐（当前 functional done，按需微调）
- [ ] 行内「执行」快捷入口（若 Vega 有）

### 文档与验收（AT-9）

- [ ] 更新 `migration-matrix.md` 行动类 create/edit/execution/detail 状态
- [ ] 更新 `gap-report.md`
- [ ] 移除占位 i18n；`tsc -b` + 手工走查

---

## 5. 后端依赖

| 能力 | Vega / 预期 API | 当前 bkn-studio |
| --- | --- | --- |
| 对象类列表（含 data_properties） | `object.objectGet` | `listKnowledgeNetworkObjectTypes` + detail ✅ |
| 工具箱 / MCP 详情 | `tool.getToolBoxDetail` / `getMcpTools` | ❌ 无 tool 模块 |
| 创建行动类 | `action.createActionType` | POST action-types，**缺 action_source/parameters/condition/affect** |
| 更新行动类 | `action.editActionType` | PUT action-types，**同上** |
| 行动类详情 | `action.getActionTypeDetail` | GET action-types，**缺 execution 字段映射** |
| 执行日志 | `action.queryActionLogs` | ❌ 未实现 |
| 立即执行 | `action.executeAction` | ❌ 未实现 |
| 取消执行 | `action.cancelExecution` | ❌ 未实现 |

---

## 6. 任务拆分（执行顺序）

粒度原则：每个任务可独立验收，单任务改动文件 ≤ 8 个为宜。

### AT-0 基线确认（0.5d）

- [ ] **AT-0-1** 跑通 create / edit / execution / detail 四条路由，截图基线
- [ ] **AT-0-2** 确认 mock 与 API 开关下行为差异

### AT-1 Step 1 扩展（1d）

- [x] **AT-1-1** 扩展 types：`ActionTypeCondition`、`ActionTypeAffect`
- [x] **AT-1-2** Step 1 增加影响对象 + 影响说明；对象 Select 带 icon
- [x] **AT-1-3** 触发条件 UI（DataFilter 或 interim 条件编辑器 + mock 持久化）
- [x] **AT-1-4** 绑定对象变更时清空 condition
- [x] **AT-1-5** 验收：create/edit Step 1 字段保存至 mock

### AT-2 执行映射编辑器（1.5d）

- [x] **AT-2-1** 新建 `execution-utils.ts`（default / normalize / validate）
- [x] **AT-2-2** `ActionTypeSourcePicker`（interim：手动 + mock 工具元数据；或接入 AddToolModal）
- [x] **AT-2-3** `ActionTypeParameterMappingTable` — FieldTypeIcon 属性 Select（复用 `RelationTypePropertySelect`）
- [x] **AT-2-4** 重构 `ActionTypeExecutionEditor` 为 Shell + Source + Table
- [x] **AT-2-5** 验收：Step 2 完整 CRUD 参数映射

### AT-3 表单编排（0.5d）

- [x] **AT-3-1** `ActionTypeFormScene` 接入扩展 Step 1 + 新 Editor
- [x] **AT-3-2** 编辑回填 condition / affect / execution；`doneStep` / 步骤点击
- [x] **AT-3-3** `beforeunload` + 返回确认
- [x] **AT-3-4** 验收：create/edit 全流程 mock 保存

### AT-4 独立执行配置页（0.5d）

- [x] **AT-4-1** 去 placeholder；共用 Editor
- [x] **AT-4-2** 保存后跳转详情
- [x] **AT-4-3** 验收：detail → execution → 修改 → 保存 → edit 回填一致

### AT-5 Service / Mock（1d）

- [x] **AT-5-1** 新建 `services/mappers/action-type.mapper.ts`
- [x] **AT-5-2** 扩展 `BackendActionType`；create/update body 含完整字段
- [x] **AT-5-3** `getKnowledgeNetworkActionTypeDetail` mock + API 回读
- [x] **AT-5-4** mock seed 补全 `at-risk-block`（condition + action_source + parameters）
- [x] **AT-5-5** 验收：`tsc -b` + mock 数据一致

### AT-6 详情 Overview（1d）

- [x] **AT-6-1** 详情壳 + 侧栏 Overview / TaskManagement
- [x] **AT-6-2** `ActionTypeOverviewPanel` 只读区块
- [x] **AT-6-3** 头部「立即执行」按钮（可先 mock toast + 日志 seed）
- [x] **AT-6-4** 验收：详情展示与 edit 数据一致

### AT-7 详情 TaskManagement（1.5d）

- [x] **AT-7-1** mock 执行日志 store + list/detail/cancel/execute service
- [x] **AT-7-2** `ActionTypeTaskManagementPanel` 表格 + 筛选 + 抽屉
- [x] **AT-7-3** 立即执行后列表刷新
- [x] **AT-7-4** 验收：mock 下执行 → 日志可见 → 取消

### AT-8 列表微调（可选，0.5d）

- [ ] **AT-8-1** 列宽 / 空态 / 操作菜单与 Vega 对齐

### AT-9 文档收口（0.5d）

- [x] **AT-9-1** 更新 migration-matrix / gap-report / tasks.md
- [x] **AT-9-2** 移除占位 i18n
- [x] **AT-9-3** `tsc -b` + 手工验收路径

---

## 7. 验收路径

```
# 新建 — 两步表单
/knowledge-network/workspace/kn-domain-risk/action-types/create
  → Step 1 填基础信息 + 条件 + 影响 → Step 2 选工具 + 参数映射 → 保存

# 编辑回填
/knowledge-network/workspace/kn-domain-risk/action-types/at-risk-block/edit
  → 两步数据正确 → 修改 → 保存

# 独立执行配置
/knowledge-network/workspace/kn-domain-risk/action-types/at-risk-block/execution
  → 修改参数 → 保存 → detail/edit 一致

# 详情 Overview + 立即执行
/knowledge-network/workspace/kn-domain-risk/action-types/at-risk-block/detail
  → 概览字段完整 → 立即执行 → 切 TaskManagement 见新日志

# 任务管理
同上 detail → TaskManagement → 筛选 / 详情抽屉 / 取消
```

---

## 8. 推荐实施波次

| 波次 | 任务 | 产出 |
| --- | --- | --- |
| **Wave A** | AT-1 + AT-2（interim source） | Step 1 扩展 + 参数 FieldSelect 表 |
| **Wave B** | AT-5 + AT-3 + AT-4 | create/edit/execution 保存闭环 |
| **Wave C** | AT-6 + AT-7 | 详情 Overview + TaskManagement + 立即执行 |
| **Wave D** | AT-2（工具目录 service + 手动录入 fallback）+ AT-9 | 工具选择器抽象 + 文档/i18n 收口（真实 `/tools/catalog` 待后端） |

> **Wave D** 已交付 `action-type-tool.service.ts`（mock 目录 + `GET /bkn-backend/v1/tools/catalog` 空回退）；完整 AddToolModal / MCP 接入仍待 tool 模块或后端就绪。AT-8 列表视觉微调为可选。

---

## 9. 与主 tasks.md 的关系

本文件是 **V3-3 子规格**；`tasks.md` 中 V3-3 勾选以本文件 AT-* 任务为准。  
行动类列表页 baseline 已完成，AT-8 为可选视觉 polish。
