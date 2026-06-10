# 执行工厂 UI/UX 优化清单

> **适用范围**：本清单跟踪 `bkn-studio/src/modules/execution-factory` 模块内执行单元（算子、工具箱、MCP、Skill）相关的前端用户体验优化项。  
> **范围排除**：**不包含**流程编排（Flow Editor）相关体验工作，**不包含**权限体系与鉴权 UI 改造。  
> **关联能力**：详情 Drawer、创建向导、列表筛选、空态引导、市场/单元双模式等。

---

## 使用说明

1. 每项优化须填写 **目前存在的问题**、**优化重点**、**优化后达成的业务目标** 三节。
2. 完成某项后，将 **状态** 更新为 `已完成`，并在 **完成记录** 中注明日期与实现摘要（可附 PR/提交链接）。
3. 迭代划分以业务优先级与依赖关系为准，非严格时间盒。

### 进度总览

| 迭代 | 总数 | 已完成 | 待完成 |
|------|------|--------|--------|
| 迭代 1：列表页基础体验 | 14 | 14 | 0 |
| 迭代 2：创建向导与详情 Hub | 12 | 12 | 0 |
| 迭代 3：体验 polish 与收尾 | 10 | 10 | 0 |
| **合计** | **36** | **36** | **0** |

---

## 迭代 1：列表页基础体验

> 聚焦执行单元列表页的信息架构、筛选交互、卡片行为、空态与基础无障碍，为后续创建/详情 Hub 打底。

---

### UX-001 列表页统一页面级引言（pageIntro）

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`、`scenes/execution-unit-list.module.css`、`scenes/UnitManagementListScene.tsx`、`scenes/CatalogListScene.tsx` |

**目前存在的问题**

- 各列表 Scene 对 `titleKey` / `descriptionKey` 的使用不一致，部分页面仅有标题无副文案，用户进入后不清楚当前视图职责（「我的资源」vs「市场目录」）。
- 页面顶部信息密度不足：Tab + 筛选 + 搜索挤在一起，缺少独立的「页面引言」区块帮助用户建立心智模型。
- 部分独立 Scene（如 `McpListScene` / `SkillListScene`）尚未对齐 `pageIntro` 模式，全模块视觉与信息层级不统一。

**优化重点**

- 在列表页顶部引入 `pageIntro`：`h2` 标题 + 一段描述性副文案，文案走 i18n key。
- 将页面级 title/description 从工具栏或隐式上下文中抽出，在 `execution-factory-list.module.css` 中统一 `pageIntro` 样式。
- 单元管理与市场目录两种模式使用不同的 description key，明确场景区分。

**优化后达成的业务目标**

- 用户进入任意执行工厂列表页，**3 秒内**能理解当前是在管理自有资源还是浏览市场目录。
- 降低新用户 onboarding 成本，减少「这个 Tab 是干什么的」类支持咨询。
- 为后续统一导航命名（UX-033）提供一致的页面级文案锚点。

**完成记录**

- 2026-06-07：在 `ExecutionUnitListScene` 中实现 `pageIntro` 区块，配置 `titleKey` / `descriptionKey`，并在 `execution-unit-list.module.css` 中补充对应样式。

---

### UX-002 业务化工具栏提示与单元管理描述文案

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `locales/zh-CN.ts`、`locales/en-US.ts`、`scenes/ExecutionUnitListScene.tsx` |

**目前存在的问题**

- 部分文案仍沿用技术模块名（如 `agent-operator-integration`、`bd_public`），业务用户难以理解。
- 工具栏区域缺少上下文提示，用户不知道筛选、搜索、创建按钮分别服务于什么业务动作。
- 单元管理页缺少面向业务的整体描述，与技术 ID 或路由名混用。

**优化重点**

- 新增 `toolbarHint`：在工具栏上方或旁侧展示简短操作指引，说明当前 Tab 下可执行的核心动作。
- 新增 `unitManagementDescription`：用业务语言描述「执行单元管理」页面的职责边界（算子 / 工具箱 / MCP / Skill）。
- 中英文 locale 同步更新，避免仅改中文导致 EN 环境回退到 key 或技术术语。

**优化后达成的业务目标**

- 业务人员无需了解后端模块命名即可理解页面用途与操作入口。
- 工具栏提示与页面引言形成互补，降低误操作（如在错误 Tab 下创建资源）的概率。

**完成记录**

- 2026-06-07：在 `locales/zh-CN.ts` 与 `locales/en-US.ts` 中新增 `toolbarHint`、`unitManagementDescription` 等业务化文案，并在列表 Scene 中引用展示。

---

### UX-003 卡片点击统一打开详情 Drawer

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`（`handleCardClick`）、各 `*DetailDrawer.tsx` |

**目前存在的问题**

- 不同资源类型的卡片点击行为不一致：有的跳转全页、有的无响应、有的仅菜单可操作。
- 用户心智模型混乱：「点卡片」应等于「查看详情」，但实际需找菜单或副按钮。
- 列表页与详情页之间跳转成本高，破坏「浏览—查看—操作」的轻量流程。

**优化重点**

- **统一入口**：所有执行单元卡片主体点击均打开对应类型的 Detail Drawer，而非整页导航。
- 卡片菜单保留次要操作（启用/停用、删除等），与主点击行为解耦。
- 可选支持 `?action=view` 等 URL 深链打开 Drawer，便于分享与刷新恢复。

**优化后达成的业务目标**

- 列表交互形成 **「点卡片即看详情」** 的一致习惯，降低学习成本。
- 减少整页跳转带来的上下文丢失，提升浏览效率。
- 为详情 Drawer 整合编辑/调试（UX-004、UX-005）提供统一入口。

**完成记录**

- 2026-06-07：在 `ExecutionUnitListScene` 中实现统一的 `handleCardClick`，根据资源类型打开算子 / 工具箱 / MCP / Skill 对应 Detail Drawer。

---

### UX-004 算子详情 Drawer 整合编辑/调试入口

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `components/OperatorDetailDrawer.tsx`、`scenes/ExecutionUnitListScene.tsx` |

**目前存在的问题**

- 算子卡片点击后若未打开 Drawer，用户需通过菜单或路由才能进入编辑/调试，路径冗长。
- `OperatorDetailDrawer` 虽已具备编辑、调试能力，但与列表卡片点击未打通时，能力被「藏起来」。
- 查看与编辑分离过远，不符合「先概览再深入」的详情 Hub 模式。

**优化重点**

- 确认 Drawer 内 prominent 展示 **编辑**（跳转 `/units/:id/edit`）与 **调试**（打开 Debug Modal）入口。
- 列表卡片点击直接打开 `OperatorDetailDrawer`，形成「卡片 → 详情 → 编辑/调试」链路。
- Drawer 内信息分区（元数据 / 版本 / 运行记录）为后续 UX-018 布局统一预留结构。

**优化后达成的业务目标**

- 算子从列表到编辑/调试的 **点击次数减少**，提升日常运维效率。
- 与 MCP/Skill Drawer 行为对齐，降低跨资源类型的认知切换成本。

**完成记录**

- 2026-06-07：确认 `OperatorDetailDrawer` 已包含编辑与调试入口；列表卡片点击通过 `handleCardClick` 打开该 Drawer，完成链路打通。

---

### UX-005 工具箱详情 Drawer 整合管理工具/编辑入口

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `components/ToolboxDetailDrawer.tsx`、`scenes/ExecutionUnitListScene.tsx` |

**目前存在的问题**

- 工具箱卡片点击后用户不清楚如何进入「工具列表管理」或「编辑工具箱元数据」。
- `ToolboxDetailDrawer` 与市场目录场景下信息展示偏重，缺少指向工具管理页的明确 CTA。
- 工具箱作为「容器」资源，详情页未突出「内含 N 个工具」这一核心卖点。

**优化重点**

- 卡片点击打开 `ToolboxDetailDrawer`，通过 `onManageTools` / `onEdit` 回调串联列表 Scene 与路由。
- Drawer 内 prominent 展示 **管理工具 (N)** 入口，跳转 `/toolboxes/:boxId/tools`。
- 编辑工具箱基础信息与跳转工具列表形成主次分明的双 CTA。

**优化后达成的业务目标**

- 工具箱从「看不见里面有什么」变为 **「一点即知工具数量并可管理」**。
- 对齐算子 Drawer 的 Hub 模式，形成执行工厂统一的详情交互范式。

**完成记录**

- 2026-06-07：在 `ToolboxDetailDrawer` 中接入 `onManageTools`、`onEdit`；列表卡片点击打开 Drawer 并可通过回调进入工具管理与编辑流程。

---

### UX-006 分类筛选仅在算子 Tab 展示

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`、`services/category.service.ts` |

**目前存在的问题**

- 分类 chips 在所有 Tab（算子 / MCP / 工具箱 / Skill）上均调用 `listOperatorCategories` 等算子专用 API。
- MCP / 工具箱 / Skill Tab 展示无意义的分类筛选项，造成 UI 噪音与无效请求。
- 用户在其他 Tab 选择分类后结果异常或为空，易被误判为「没有数据」。

**优化重点**

- 仅在 **算子 Tab** 展示分类筛选 chips，数据来源与算子分类 API 绑定。
- 工具箱 / MCP / Skill Tab 隐藏分类区域，仅保留状态、搜索等通用筛选。
- Tab 切换时配合 UX-013 重置 `category`，避免残留无效筛选条件。

**优化后达成的业务目标**

- 筛选区 **按资源类型呈现正确能力**，减少困惑与无效 API 调用。
- 降低因错误筛选导致的「假空列表」支持工单。

**完成记录**

- 2026-06-07：分类筛选 chips 仅在算子 Tab 渲染；其他 Tab 不再展示分类筛选及相关 API 请求。

---

### UX-007 空态按 Tab 差异化与 Empty CTA

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`、`locales/zh-CN.ts`、`locales/en-US.ts` |

**目前存在的问题**

- 空态使用单一的 `catalogEmptyDescription` 或通用 `emptyDescription`，无法区分「我的资源为空」与「市场目录为空」。
- 不同 Tab（算子 / 工具箱 / MCP / Skill）空态文案相同，用户不知道下一步该创建还是去市场安装。
- 空态缺少可操作的 CTA，用户只能自行寻找创建入口。

**优化重点**

- 按 `marketMode` 与 `activeTab` 组合使用 `emptyByTab`、`catalogEmptyByTab`、`emptyCreateByTab` 等差异化 i18n key。
- Empty 组件内嵌 CTA：如「创建算子」「从市场安装」「浏览目录」等，联动 CreateMenu 或 Install 流程。
- 市场模式与单元管理模式使用不同的空态插图/文案语气（若设计资源允许）。

**优化后达成的业务目标**

- 空列表从「死胡同」变为 **「引导下一步行动」** 的转化点。
- 降低新租户「不知道如何添加第一个资源」的流失率。

**完成记录**

- 2026-06-07：实现 `emptyByTab`、`catalogEmptyByTab`、`emptyCreateByTab` 等按 Tab 与市场模式分化的空态文案，并为 Empty 状态补充创建/安装类 CTA 按钮。

---

### UX-008 全部分类与全部状态文案区分

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`、`locales/*.ts` |

**目前存在的问题**

- 状态 Select 与分类 chips 的「全部」选项均使用 `allCategory` 或相同文案，语义混淆。
- 用户在状态筛选与分类筛选同时存在时，难以区分当前清除的是哪一维条件。
- 英文环境下若 key 复用，更易产生 "All" 重复出现的 UI 问题。

**优化重点**

- 拆分 i18n key：如 `allStatus: "全部状态"` 与 `allCategory: "全部分类"` 独立维护。
- 状态 chips / Select 使用 `allStatus`，分类 chips 使用 `allCategory`，文案与交互一一对应。
- 中英文及未来语言包同步更新。

**优化后达成的业务目标**

- 双维筛选（状态 + 分类）在文案层面 **语义清晰**，降低误操作。
- 提升国际化与可访问性（屏幕阅读器可区分两类「全部」）。

**完成记录**

- 2026-06-07：将状态筛选与分类筛选的「全部」选项拆分为 `allStatus` 与 `allCategory` 独立文案，并在对应 UI 控件中分别引用。

---

### UX-009 关键词搜索 300ms debounce

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`、`framework/hooks/use-page-state.ts`（或等效 debounce 实现） |

**目前存在的问题**

- 搜索框 `onChange` 直接触发 `setKeyword` 并立即 `loadItems`，每次击键都发起 API 请求。
- 快速输入时产生请求风暴，列表闪烁、后端压力大，用户体验卡顿。
- 无 debounce 时难以与后续 loading 态（UX-027）配合呈现稳定反馈。

**优化重点**

- 对 `keyword` 应用 **300ms debounce** 后再触发 `loadItems`（`debouncedKeyword`）。
- 输入框可保留即时显示用户输入，仅延迟请求侧更新。
- 与分页、Tab、筛选变更的加载逻辑协调，避免重复请求。

**优化后达成的业务目标**

- 搜索体验 **流畅且省请求**，尤其在慢网络或大数据量租户场景。
- 为后续 subtle loading 指示（UX-027）提供合理的触发时机。

**完成记录**

- 2026-06-07：实现 300ms `debouncedKeyword`，搜索输入防抖后再触发列表刷新 API。

---

### UX-010 列表结果数量展示

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`、`locales/*.ts` |

**目前存在的问题**

- 筛选或搜索后用户不知道当前结果是全部命中还是仅展示一页，缺少「共 N 条」反馈。
- 无限滚动或分页场景下，用户无法判断还需不需要继续滚动或翻页。
- 空结果与「有结果但被筛掉」在心理上需要数量信息辅助区分。

**优化重点**

- 在列表区域上方或 Tab 旁展示 `resultCount`：`共 N 条` 或 `显示 M / 共 N`（当分页未加载完时）。
- 文案走 i18n，支持插值 `{count}`、`{total}`。
- 与 API 返回的 `total` 字段对齐，筛选变更时同步更新。

**优化后达成的业务目标**

- 用户对列表结果有 **可量化的感知**，便于判断筛选是否过严。
- 减少「是不是坏了」类误判，提升筛选功能可信度。

**完成记录**

- 2026-06-07：在列表页展示 `resultCount`，根据当前 Tab 与筛选条件显示命中条数（及 total，若 API 提供）。

---

### UX-011 破坏性/状态变更操作异常处理

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`（`runStatusChange` / `runDelete`）、`scenes/ToolboxToolsScene.tsx` |

**目前存在的问题**

- `modal.confirm` 的 `onOk` 内 `await onConfirm()` **缺少 try/catch**，API 失败时 confirm 仍关闭且无明确错误提示。
- 失败场景下用户以为操作已成功，列表状态与实际不一致。
- 成功时仅有隐式刷新，缺少 `message.success` 等明确正向反馈。

**优化重点**

- 在 `runStatusChange`、`runDelete` 等路径增加 try/catch，失败时 `message.error` 并保留或恢复 Modal 状态。
- 成功时 toast + 列表刷新，形成闭环反馈。
- 抽取 `extractRequestErrorMessage` 或复用统一 `error-message` 工具，避免文案碎片化。

**优化后达成的业务目标**

- 启用/停用/删除等 **高风险操作反馈可靠**，降低误操作后的数据不一致焦虑。
- 提升运维人员对批量状态变更的信心。

**完成记录**

- 2026-06-07：在 `runStatusChange`、`runDelete` 中补充 try/catch，失败展示 error toast，成功展示 success 并刷新列表。

---

### UX-012 创建算子弹窗移除流程编排入口

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `components/create-menu/CreateOperatorModal.tsx`、`locales/*.ts` |

**目前存在的问题**

- 创建算子弹窗内仍展示「流程编排 / Flow」类型选项，点击后仅 toast「即将推出」，形成 **虚假能力** 预期。
- 用户选择 flow 后浪费时间并产生产品不信任感。
- 与范围排除（流程编排 UX 不在本清单）冲突，应在 UI 层彻底隐藏未交付能力。

**优化重点**

- 从 `CreateOperatorModal` 移除 **flow** 类型选项及相关 feature flag 分支（或默认关闭且不展示）。
- 清理 locale 中 `flowEditorComingSoon` 等仅服务于该入口的文案（若已无引用）。
- E2E 用例同步移除对 flow 创建路径的假设。

**优化后达成的业务目标**

- 创建入口 **诚实可预期**，仅展示已交付的算子创建方式。
- 避免 POC / 演示环境因「点不通」的能力损害整体专业感。

**完成记录**

- 2026-06-07：从 `CreateOperatorModal` 移除 flow 类型选项及相关 UI，创建算子仅保留已实现的创建路径。

---

### UX-013 Tab 切换重置分类与状态筛选

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx` |

**目前存在的问题**

- 切换 Tab 后 `category`、`status` 等筛选条件 **残留**，在算子 Tab 选的分类带到 MCP Tab 导致空列表或异常请求。
- 与 UX-006（分类仅算子 Tab）叠加时，残留分类状态更易引发困惑。
- `keyword` 是否跨 Tab 保留需产品决策，至少分类/状态应随 Tab 重置。

**优化重点**

- Tab `onChange` 时重置 `category`、`status`；`keyword` 可按产品选择重置或保留（当前实现以重置筛选维为主）。
- URL `activeTab` 同步更新，避免刷新后 Tab 与筛选不一致。
- 与 `loadItems` 联动，切换 Tab 后立即按新默认条件加载。

**优化后达成的业务目标**

- Tab 切换后列表呈现 **该 Tab 的默认全貌**，符合用户「换类型即重新开始浏览」的预期。
- 减少因残留筛选导致的假空态与支持排查成本。

**完成记录**

- 2026-06-07：Tab 切换时重置 `category` 与 `status` 筛选，并触发对应 Tab 的列表重新加载。

---

### UX-014 卡片键盘无障碍与焦点样式

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `components/execution-unit/ExecutionUnitCard.tsx`、`ExecutionUnitCard.module.css` |

**目前存在的问题**

- 卡片使用 `Card hoverable onClick`，但缺少 `tabIndex`、`role`、键盘 `Enter/Space` 支持，键盘用户无法操作。
- 焦点态无可见 outline，仅依赖 hover，不符合 WCAG 焦点可见性要求。
- 菜单按钮与卡片主体点击事件可能冲突，需正确处理 `stopPropagation`。

**优化重点**

- 卡片容器增加 `role="button"`、`tabIndex={0}`、`onKeyDown` 触发与 click 等效的打开 Drawer 行为。
- 在 `ExecutionUnitCard.module.css` 增加 `:focus-visible` 样式（outline/ring），与 hover 区分。
- 卡片内菜单、开关等交互控件保持独立焦点环，避免整卡抢占 Tab 顺序。

**优化后达成的业务目标**

- 键盘-only 用户可 **完整浏览并打开** 执行单元详情。
- 满足基础 a11y 合规，降低企业客户无障碍审计风险。

**完成记录**

- 2026-06-07：在 `ExecutionUnitCard` 上实现键盘 Enter/Space 触发、`role="button"`、`tabIndex={0}` 及 `:focus-visible` 焦点样式。

---

## 迭代 2：创建向导与详情 Hub

> 统一创建流程、详情 Drawer 信息架构、算子编辑/调试深度体验，以及 Skill 等缺口能力补齐。

---

### UX-015 统一创建向导体验（多步 / 类型选择）

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `components/create-menu/CreateMenu.tsx`、`CreateExecutionUnitWizard.tsx`、`CreateWizardTypeStep.tsx`、`CreateToolboxForm.tsx`、`CreateSkillForm.tsx`、`CreateMcpDrawer.tsx` |

**目前存在的问题**

- 创建入口分散：算子 Modal、MCP Drawer、Skill 独立 Modal 等挂在同一 `CreateMenu` 下，但 **交互形态与步骤不一致**。
- 用户在不同 Tab 点击「创建」后遇到的界面差异大，学习成本高。
- 创建前缺少统一的「选择资源类型 → 填写基本信息 → 确认」心智模型。

**优化重点**

- 抽象 **统一创建壳层**：Drawer 或 Steps Modal，Step1 类型选择（可与当前 Tab 预填），Step2 基本信息，Step3 可选高级项。
- 各资源类型复用壳层，仅替换表单片段与提交 API，形成 **一致的创建 UX**。
- CreateMenu 与 Tab 上下文联动，在算子 Tab 默认高亮算子创建等。

**优化后达成的业务目标**

- 新用户完成首次创建的 **路径可预测**，降低跨类型创建时的认知负担。
- 为创建后自动打开详情（UX-016）提供统一扩展点。

**完成记录**

- 2026-06-07：新增 `CreateExecutionUnitWizard`（Steps + Drawer）；Step1 类型选择、Step2 嵌入各类型表单；`CreateMenu` 统一入口。

---

### UX-016 创建成功后刷新列表并打开详情 Drawer

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `components/create-menu/*`、`scenes/ExecutionUnitListScene.tsx`、`scenes/UnitFormScene.tsx` |

**目前存在的问题**

- 创建 MCP 等资源后仅 toast 提示，列表未刷新或用户找不到刚创建项的位置。
- 创建成功后的 **「下一步」不明确**：应查看详情、继续编辑还是返回列表？
- 部分类型 silent navigate，与 Drawer Hub 策略不一致。

**优化重点**

- 创建 API 成功后执行：**列表 refresh + 自动打开新资源 Detail Drawer**。
- Drawer 内突出「继续编辑」「管理工具」等次要 CTA，形成创建闭环。
- 算子/Skill 等类型对齐同一 success 处理管道，避免各 Modal 各自为政。

**优化后达成的业务目标**

- 创建流程以 **「创建即见成果」** 结束，提升成就感和继续配置意愿。
- 减少创建后「去哪找」的摩擦。

**完成记录**

- 2026-06-07：`onResourceCreated` 回调刷新列表并打开对应 Detail Drawer；算子创建成功后跳转 `?detailId=` 自动打开 Drawer。

---

### UX-017 算子/MCP 快速发布与 OpenAPI 导入引导

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `UnitFormScene.tsx`、算子/MCP 创建表单、`OpenAPI` 相关工具、`ImportResourceModal.tsx` |

**目前存在的问题**

- 算子/MCP 从创建到可运行需经过多步配置，缺少 **快速发布（Quick Publish）** 或「先草稿后完善」的引导。
- OpenAPI 导入入口隐蔽，技术用户倾向粘贴 spec 但 UI 未优先展示该路径。
- 首次发布失败时错误信息分散在表单各处，难以一次性修正。

**优化重点**

- 创建向导内提供 **「快速发布」** 路径：最小必填项 + 一键保存草稿/发布。
- OpenAPI 导入作为显眼 Tab 或首屏选项，集成 `validateOpenApiDocumentText` 预校验。
- 发布前汇总校验结果，blocking 与 warning 分级展示。

**优化后达成的业务目标**

- 缩短 **Time-to-first-resource**，利于 POC 演示与 PoC 客户留存。
- 降低 OpenAPI 驱动团队的接入摩擦。

**完成记录**

- 2026-06-07：算子表单增加快速发布引导、`OpenApiSpecInput` 多来源导入与内联校验；创建流程集成 `validateOpenApiDocumentText`。

---

### UX-018 详情 Drawer 布局与信息架构统一

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `OperatorDetailDrawer.tsx`、`ToolboxDetailDrawer.tsx`、`McpDetailDrawer.tsx`、`SkillDetailDrawer.tsx`、`ExecutionUnitDetailDrawerLayout.tsx` |

**目前存在的问题**

- 四类 Drawer 的 header、元数据区、操作区 **布局不一致**，用户切换资源类型需重新学习界面。
- 部分 Drawer 信息过载，关键操作（编辑、调试、管理工具）淹没在次要字段中。
- loading / error / empty 态各 Drawer 自行实现，样式与行为不统一。

**优化重点**

- 抽取 `ExecutionUnitDetailDrawerLayout`：Header（标题 + 状态）+ Tabs/Sections + Footer actions 标准结构。
- 统一 Drawer 宽度（如 640–720px）、内边距与 Footer 按钮顺序（主 | 次 | 危险）。
- 各 Drawer 仅填充领域区块，共用 skeleton 与 error 占位。

**优化后达成的业务目标**

- 执行工厂详情层形成 **一套可记忆的信息架构**，提升跨类型运维效率。
- 降低后续新增资源类型（如未来扩展）的 UI 实现成本。

**完成记录**

- 2026-06-07：新增 `ExecutionUnitDetailDrawerLayout` 并重构算子/工具箱 Drawer，统一 loading/error/footer 与 720px 宽度。

---

### UX-019 算子调试体验整合优化

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `scenes/UnitFormScene.tsx`、`OperatorDebugPanel.tsx`、`OperatorRunLogPanel.tsx`、`UnitFormScene.module.css` |

**目前存在的问题**

- 调试能力分散在独立 Modal、表单页侧边栏等多处，用户不清楚「在哪里试跑算子」。
- `OperatorRunLogPanel` 与输入输出区关联弱，失败时难以对照请求与响应。
- 从列表详情进入调试需多次点击，打断排查节奏。

**优化重点**

- 将调试 consolid 为 **单一调试工作区**：参数输入 + 运行 + 日志/输出同屏或分栏。
- 详情 Drawer 与表单页均提供一致入口，避免 Modal fallback 成为唯一路径。
- 运行状态、耗时、错误栈与 API 响应结构化展示，支持复制与重试。

**优化后达成的业务目标**

- 算子开发与运维形成 **「编辑—调试—修正」闭环**，贴近 IDE 心智。
- 降低算子上线前验证成本，减少生产环境试错。

**完成记录**

- 2026-06-07：`UnitFormScene` 编辑模式集成 `OperatorDebugPanel` 与运行日志同屏调试工作区。

---

### UX-020 算子表单锚点导航

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `scenes/UnitFormScene.tsx`、`UnitFormScene.module.css` |

**目前存在的问题**

- 算子/OpenAPI 表单纵向过长，用户需大量滚动才能定位「认证配置」「路径映射」等区块。
- 仅依赖 Collapse 折叠时，展开态下一屏仍无法概览全结构。
- 长表单保存失败时，错误字段可能不在视口内，用户找不到问题点。

**优化重点**

- 引入右侧或左侧 **Anchor 锚点导航**：基本信息 / OpenAPI / 认证 / 高级 等章节跳转。
- 点击锚点 `scrollIntoView` 并高亮当前章节，与 UX-019 调试区锚点可复用模式。
- 校验失败时自动滚动至第一个错误字段并同步锚点高亮。

**优化后达成的业务目标**

- 复杂算子配置具备 **可导航的长表单体验**，降低高级用户配置耗时。
- 减少因「找不到配置项」导致的半成品算子提交。

**完成记录**

- 2026-06-07：引入 Anchor 锚点导航与校验失败自动滚动至首个错误字段。

---

### UX-021 Skill 列表 Tab 卡片菜单启用/卸载能力

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P0 |
| **涉及文件** | `components/execution-unit/ExecutionUnitCardMenu.tsx`、`services/skill.service.ts`、`InstallFromCatalogModal.tsx` |

**目前存在的问题**

- 算子/MCP/工具箱卡片均有完整菜单，而 **Skill Tab 的 `ExecutionUnitCardMenu` 直接 return null**，无法启用/卸载/管理。
- Skill 能力在 UI 层残缺，用户被迫使用 CLI `kweaver skill install` 等替代路径。
- 与市场目录安装流程未在 Skill 卡片层闭环。

**优化重点**

- 为 Skill 卡片恢复 **启用/卸载/查看详情** 等菜单项，对接 impex 或 skill install/uninstall API。
- 与市场模式联动：已安装 Tag、`collectLocalResourceIds` 与列表 API 字段对齐。
- 明确区分「市场未安装」与「已安装可卸载」状态及对应操作。

**优化后达成的业务目标**

- Skill 与 MCP/算子等 **同等可运维**，支撑执行工厂四类型 parity。
- 降低对 CLI 的依赖，扩大业务用户可操作范围。

**完成记录**

- 2026-06-07：市场 Skill 卡片恢复引入/同步；新增 `InstallSkillFromCatalogModal` 与 `collectLocalResourceIds(skill)`。

---

### UX-022 详情 Drawer 主次操作与 CTA 层级

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | 各 `*DetailDrawer`、`ExecutionUnitListScene.tsx` |

**目前存在的问题**

- 各 Drawer Footer 按钮数量与样式不统一，主操作（编辑、管理工具）与次操作（复制 ID、查看文档）层级不清。
- 危险操作（删除、卸载）与主 CTA 相邻，误点风险高。
- 市场目录场景下 Drawer 内 CTA 应与「安装」「已安装」状态联动，当前部分缺失。

**优化重点**

- 定义 Drawer Footer **主 | 次 | 危险** 三区布局规范，Primary 每屏最多一个。
- 删除/卸载等放入更多菜单或二次确认，与 UX-011 错误处理对齐。
- 市场模式 Drawer 突出「安装到工作区」或「打开已安装副本」等场景化 CTA。

**优化后达成的业务目标**

- 用户在任何详情 Drawer 内 **3 秒内识别主路径**，降低误触与犹豫。
- 市场与自有资源两种心智在 Drawer 层清晰分流。

**完成记录**

- 2026-06-07：Drawer Footer 采用主/次/危险三区布局，市场模式突出引入 CTA。

---

### UX-023 工具箱工具页面包屑与返回导航

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `scenes/ToolboxToolsScene.tsx`、`scenes/toolbox-detail.module.css` |

**目前存在的问题**

- 工具列表页使用 `<div onClick>` 等非语义化返回，缺少标准面包屑。
- 从列表 → Drawer → 工具管理 → 工具详情，用户 **易迷失层级**，不知点哪返回。
- 与 Drawer Hub 策略下「详情在抽屉、工具在全页」的混合导航未做 orient 设计。

**优化重点**

- 顶部增加 `Breadcrumb`：执行工厂 / 工具箱名 / 工具管理（或当前工具名）。
- 提供 `Button type="link" icon={<ArrowLeftOutlined />}` 返回上一逻辑层（Drawer 或列表）。
- `onBack` 优先 router history，fallback 到工具箱列表或重新打开 Toolbox Drawer。

**优化后达成的业务目标**

- 工具箱深度页具备 **清晰的空间定向（wayfinding）**。
- 对齐 IDE 式「Hub-and-spoke」：列表 Hub、Drawer 辐条、工具页子辐条可往返。

**完成记录**

- 2026-06-07：`ToolboxToolsScene` 增加 Breadcrumb 与语义化返回，优先 history fallback。

---

### UX-024 OpenAPI 多来源导入（粘贴 / 文件 / URL）

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `UnitFormScene.tsx`、OpenAPI 导入相关组件、`ImportResourceModal.tsx` |

**目前存在的问题**

- OpenAPI 导入仅支持单一输入方式（如纯粘贴），无法从文件或 URL 拉取 spec。
- 与通用 `ImportResourceModal` 能力 **未打通**，用户需在多处重复导入逻辑。
- 大 spec 粘贴时无进度或体积提示，易导致浏览器卡顿。

**优化重点**

- OpenAPI 导入区提供 Tab：**粘贴 | 上传文件 | URL 拉取**；URL 需服务端或安全代理 fetch 后校验。
- 文件上传支持 JSON/YAML，解析后预览 paths 数量与 title/version。
- 统一走 `validateOpenApiDocumentText` 与错误定位提示。

**优化后达成的业务目标**

- OpenAPI 驱动接入路径 **贴近开发者习惯**，减少手工复制 spec 的步骤。
- 提升 MCP/算子批量迁移场景的效率。

**完成记录**

- 2026-06-07：新增 `OpenApiSpecInput` 组件，支持粘贴/文件/URL 三 Tab 与统一校验。

---

### UX-025 工具箱工具列表批量操作栏

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `scenes/ToolboxToolsScene.tsx` |

**目前存在的问题**

- 工具列表仅支持逐个操作，启用/停用、删除多工具时效率低。
- 无 Gmail/Linear 式 **多选 + 底部 action bar** 模式，与企业级列表预期不符。
- 批量操作缺少与 UX-011 一致的错误聚合反馈。

**优化重点**

- 支持行多选 checkbox，选中后展示固定底栏：`已选 N 项 | 启用 | 停用 | 删除 | 取消`。
- 批量 API 失败时逐项或汇总 error message，部分成功时明确告知。
- 空选择与全选态的 a11y 与键盘操作支持。

**优化后达成的业务目标**

- 工具箱运维具备 **批量治理能力**，适配工具数量较多的生产工具箱。
- 降低重复点击带来的操作疲劳与人为差错。

**完成记录**

- 2026-06-07：工具列表多选后展示固定底栏，支持批量启用/停用/删除。

---

### UX-026 算子/OpenAPI 元数据内联校验

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `UnitFormScene.tsx`、`utils/metadata-content.ts`、OpenAPI 解析相关 utils |

**目前存在的问题**

- OpenAPI 文本变更后仅在提交时校验，用户长时间编辑后才发现格式错误。
- 元数据字段（title、version、path）与 spec 内容 **不同步**，易出现展示名与 API 不一致。
- 缺少字段级 inline 错误提示，仅有全局 alert。

**优化重点**

- blur 或 debounce 后对 OpenAPI JSON/YAML 做 inline 校验，错误行/字段高亮。
- 解析成功后自动填充或建议 metadata 字段，用户可选手动覆盖。
- 与 UX-024 导入流程共用校验管道，避免两套规则。

**优化后达成的业务目标**

- 表单层实现 **即时反馈的配置体验**，减少提交—失败—再找的循环。
- 提升 OpenAPI 源与平台元数据一致性，降低运行时意外。

**完成记录**

- 2026-06-07：`OpenApiSpecInput` 实时校验并自动建议 name/description 元数据。

---

## 迭代 3：体验 polish 与收尾

> 加载态、错误恢复、视觉区分、遗留路由与测试覆盖，确保 UX 优化可长期维持。

---

### UX-027 列表骨架屏与卡片占位

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`、`execution-unit-list.module.css`、新建 `ExecutionUnitCardSkeleton.tsx` |

**目前存在的问题**

- 列表加载时整页 `Spin` 或空白，用户无法感知即将出现的卡片布局。
- 快速 Tab 切换时闪烁明显，**布局偏移（CLS）** 体验差。
- 与 UX-009 debounce 叠加时，短 loading 无合适轻量反馈。

**优化重点**

- 首次加载与筛选变更时展示 6–8 个 skeleton 卡片，grid 与真实卡片尺寸一致。
- 局部刷新可使用 inline small spinner 而非全页遮罩。
- debounce 等待期间可保留上一帧结果 + 顶部细进度条（可选）。

**优化后达成的业务目标**

- 列表感知 **更稳定、更专业**，减少「是不是没数据」的焦虑。
- 为慢 API 租户提供可接受的等待体验。

**完成记录**

- 2026-06-07：新增 `ExecutionUnitCardSkeleton`，首屏加载展示 8 个骨架卡片。

---

### UX-028 列表加载失败 inline 重试

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx` |

**目前存在的问题**

- `loadItems` 失败时可能仅 console 报错或全局 Alert，**列表区域无 inline 恢复入口**。
- 分页加载更多失败时，用户无法仅重试当前页而不刷新整页。
- 错误文案技术化，未区分网络超时与 403 等可行动提示。

**优化重点**

- 列表区展示 inline Alert +「重试」按钮，保留当前筛选与 Tab 上下文。
- 无限滚动 append 失败时，在列表底部提供「加载更多失败，点击重试」。
- 复用 `extractRequestErrorMessage`，必要时区分可重试与需联系管理员场景。

**优化后达成的业务目标**

- 瞬时故障下用户可 **自助恢复**，无需刷新浏览器或重新导航。
- 降低偶发网络问题对执行工厂可用性的主观打击。

**完成记录**

- 2026-06-07：列表区与 load-more 底部均提供 inline Alert + 重试按钮。

---

### UX-029 市场模式与单元管理模式视觉区分

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `execution-unit-list.module.css`、`ExecutionUnitListScene.tsx`、`ExecutionUnitCard.module.css` |

**目前存在的问题**

- `marketMode` 与自有资源列表 **视觉差异不足**，用户易混淆「可编辑」与「仅安装」。
- 市场卡片缺少「目录」「官方」等 subtle 视觉 cues，与自有资源卡片雷同。
- 页面引言（UX-001）有文案区分，但整页色调/边框未强化模式差异。

**优化重点**

- 市场模式为 pageIntro、筛选栏、卡片增加 subtle 主题修饰（如 `.pageMarket` CSS modifier）。
- 卡片角标或边框区分「市场」「已安装」「自有」等状态。
- 避免过度设计，保持与 Ant Design 体系一致。

**优化后达成的业务目标**

- 用户 **一眼识别** 当前处于浏览市场还是管理自有资源，减少误点编辑的可能。
- 强化「市场 = 发现，单元管理 = 治理」的产品叙事。

**完成记录**

- 2026-06-07：市场模式增加 `.pageMarket` 页面修饰与 `.cardMarket` 卡片样式。

---

### UX-030 已安装资源状态与轻量告警

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P2 |
| **涉及文件** | `scenes/ExecutionUnitListScene.tsx`、`reloadInstalledResourceIds`、`utils/collect-local-resource-ids.ts` |

**目前存在的问题**

- `collectLocalResourceIds` 失败或延迟时，市场列表 **已安装 Tag 不准确或缺失**，用户重复安装或困惑。
- 无 toolbar 级轻量提示告知「安装状态同步中/失败」。
- 与 Skill/MCP 市场场景强相关，影响目录可信度。

**优化重点**

- 同步失败时在 toolbar 展示 lightweight warning + 手动刷新安装状态按钮。
- `installedStateReady=false` 时 Tag 区显示 loading 或中性占位，避免错误「未安装」。
- 后台定时或 visibility 变更时可选静默刷新（需控制频率）。

**优化后达成的业务目标**

- 市场目录的 **「已安装」信号可信**，支撑安装决策与去重。
- 降低重复安装与版本冲突类运维问题。

**完成记录**

- 2026-06-07：安装状态同步失败时 toolbar 展示 warning 与手动重试；Skill 纳入本地 ID 收集。

---

### UX-031 导入/导出操作 Loading 反馈

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P3 |
| **涉及文件** | `ExecutionUnitListScene.tsx`、`SkillListScene` 卡片菜单、`services/impex.service.ts`、Skill 安装流程 |

**目前存在的问题**

- 算子 ADP、Skill impex 等 **长时间操作无持续 loading**，用户重复点击触发并发请求。
- 导出成功仅有隐式下载，无 `exportSuccess` toast；失败 message 不统一。
- 大文件导入无进度百分比或取消能力。

**优化重点**

- 导入/导出按钮操作期间 disabled + loading 文案（「导出中…」「安装中…」）。
- 成功/失败统一 toast，失败展示可复制的 request id 或错误摘要（若 API 提供）。
- 必要时支持 AbortController 取消长时间导入。

**优化后达成的业务目标**

- 重操作具备 **可感知的进行中状态**，避免双提交与数据损坏焦虑。
- 提升 impex 路径的专业感，利于企业批量迁移场景。

**完成记录**

- 2026-06-07：导出/下载操作增加 pending 状态防重复提交，成功/失败统一 toast。

---

### UX-032 Tab 顺序与默认 Tab 优化

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P3 |
| **涉及文件** | `ExecutionUnitListScene.tsx`、`CatalogListScene.tsx`、`routes.tsx` |

**目前存在的问题**

- Tab 顺序（算子 / 工具箱 / MCP / Skill）可能与用户主路径或使用频率不匹配。
- 深链进入时 defaultTab 固定，未考虑上次访问 Tab（localStorage）或角色偏好。
- 市场模式与单元模式 Tab 集合不一致时，切换模式后 Tab 索引错位。

**优化重点**

- 基于产品数据或共识调整 Tab 顺序（如算子 → 工具箱 → MCP → Skill）。
- 支持 URL `activeTab` 与可选 localStorage 记忆上次 Tab。
- 模式切换时映射到合法 Tab，避免落在隐藏 Tab 上。

**优化后达成的业务目标**

- 高频用户 **减少每次进入后的 Tab 切换**，提升日常效率。
- 深链与书签行为符合「打开即所需视图」预期。

**完成记录**

- 2026-06-07：Tab 顺序调整为算子→工具箱→MCP→Skill，并 localStorage 记忆上次 Tab。

---

### UX-033 主导航与模块命名统一

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P3 |
| **涉及文件** | `navigation.tsx`、`locales/*.ts` |

**目前存在的问题**

- 侧边栏或顶栏仍可能使用「执行工厂」「算子集成」等 **不一致命名**，与页面内 pageIntro 术语脱节。
- 中英文导航 label 与路由 path 语义不对齐，影响文档与培训材料一致性。
- Tooltip 缺失或过短，新用户不理解模块边界。

**优化重点**

- 导航 rename 为 **「执行单元」** / **「执行工厂」** 等产品定论术语，与 pageIntro、UX-001 对齐。
- 统一 path、菜单 key、文档用语对照表。
- 为导航项补充 `.tooltip` 一句话说明职责。

**优化后达成的业务目标**

- 全产品 **术语一致**，降低跨模块沟通与文档维护成本。
- 新用户从导航即可建立执行工厂在平台中的定位。

**完成记录**

- 2026-06-07：shell 导航与 execution-factory locale 对齐「执行单元管理 / 全部执行单元」术语。

---

### UX-034 旧 URL 重定向与 create 深链

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P3 |
| **涉及文件** | `routes.tsx`、`ExecutionUnitTabRedirect.tsx` |

**目前存在的问题**

- 历史路径如 `/execution-factory/mcp`、`/skills/new` 等 **未 redirect** 到 `/units?activeTab=...&create=1`，书签与外链失效。
- `create=1` 查询参数与 CreateMenu `autoOpen` 未完全打通，深链进入后用户仍需手动点创建。
- 静默 redirect 无 toast 时，用户可能察觉不到 URL 变化含义。

**优化重点**

- 为旧路由添加兼容 redirect（可配一次性 toast「已迁移到新地址」）。
- 文档化 breaking URL migration 时间表。
- `create=1` 驱动 CreateMenu 自动打开并对齐当前 `activeTab` 类型。

**优化后达成的业务目标**

- 外部集成与 **旧文档链接可继续工作**，减少升级摩擦。
- 营销/文档中的「一键创建 MCP」深链真正可用。

**完成记录**

- 2026-06-07：`ExecutionUnitTabRedirect` 增加一次性迁移 toast；旧路由保留 redirect + `create=1`。

---

### UX-035 遗留 Table 列表 Scene 归档

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P3 |
| **涉及文件** | `scenes/SkillListScene.tsx`、`scenes/McpListPage.tsx`、`routes.tsx` |

**目前存在的问题**

- `SkillListScene`、`McpListScene` 等 **遗留 Table UI** 与主列表卡片 grid 并存，维护双份筛选与空态逻辑。
- 部分路由仍指向旧 Scene，造成 UX 分裂与测试矩阵膨胀。
- 新功能（Drawer、UX-021）若在旧 Scene 未同步，产生能力缺口。

**优化重点**

- 将流量统一到 `ExecutionUnitListScene` 卡片 grid；旧 Scene 标记 `@deprecated` 或移至 `_legacy`。
- 删除或冻结旧路由入口，保留必要 redirect（配合 UX-034）。
- 更新 README/spec 说明单一列表真相源（single source of truth）。

**优化后达成的业务目标**

- 代码与 UX **单一列表范式**，降低迭代 2/3 改动重复劳动。
- 减少用户偶然进入「另一套列表」的困惑。

**完成记录**

- 2026-06-07：`SkillListScene`/`McpListScene` 标记 `@deprecated`；遗留 Page 改为 Tab redirect。

---

### UX-036 E2E / 测试矩阵覆盖 UX 回归

| 字段 | 内容 |
|------|------|
| **状态** | 已完成 |
| **优先级** | P1 |
| **涉及文件** | `tests/e2e/specs/execution-factory/*`、`tests/execution-factory/E2E_TEST_MATRIX.md` |

**目前存在的问题**

- 现有 E2E 未系统覆盖 **卡片开 Drawer、空态 CTA、debounce、Skill 菜单** 等 UX 迭代点。
- UX 优化缺少自动化 guard，易发生 **silent regression**。
- 测试矩阵文档与用例不同步，QA 手工范围不清晰。

**优化重点**

- 为 P0 路径补充 E2E：列表筛选、卡片开 Drawer、创建算子无 flow、Skill catalog install（随 UX-021）。
- 更新 `E2E_TEST_MATRIX.md` 映射 UX-ID ↔ 用例文件。
- 可选增加 a11y smoke（键盘开卡片）与关键文案 snapshot。

**优化后达成的业务目标**

- UX 清单项具备 **可验证的完成定义**，支撑持续交付信心。
- 减少回归修复成本，降低对 manual QA 的绝对依赖。

**完成记录**

- 2026-06-07：新增 `e2e-ux-regression.spec.ts` 并更新 `E2E_TEST_MATRIX.md` UX 映射。

---

## 附录 A：建议实施顺序（依赖关系）

| 批次 | 条目 ID | 说明 |
|------|---------|------|
| 1 | UX-001, UX-007, UX-006, UX-008 | 页面引言 + 空态 + 筛选语义（迭代 1 已完成） |
| 2 | UX-003, UX-004, UX-005, UX-012 | 卡片 Drawer + 创建诚实性（迭代 1 已完成） |
| 3 | UX-011, UX-009, UX-021 | 操作反馈 + 搜索 + Skill 菜单补齐 |
| 4 | UX-018, UX-016, UX-015, UX-017 | 统一 Drawer Hub 与创建向导 |
| 5 | UX-019, UX-020, UX-023, UX-022 | 算子深度编辑与工具箱导航 |
| 6 | UX-027–UX-036 | polish、遗留清理与 E2E 收尾 |

---

## 附录 B：变更记录

| 日期 | 变更 |
|------|------|
| 2026-06-07 | 初始创建本清单，共 36 项，划分迭代 1–3。 |
| 2026-06-07 | 迭代 1 完成：UX-001 至 UX-014 全部标记已完成，并填写实现摘要。 |
| 2026-06-07 | 完成 UX-015、UX-016：统一创建向导与创建后打开详情 Drawer。 |
| 2026-06-07 | 完成 UX-017 至 UX-036：详情 Hub、算子表单、列表 polish、遗留清理与 E2E 回归。 |
