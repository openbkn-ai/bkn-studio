# 知识网络迁移任务

> 执行策略（2026-06-05 起）：**按页垂直对齐**，从入口层到工作区子页逐页验收。  
> 每一页完成标准：**结构 → 交互 → 视觉 → API → migration-matrix 标记「视觉完成」**。

## T0 基线与文档（持续）

- T0-1：维护 [migration-matrix.md](./migration-matrix.md)
- T0-2：维护 [visual-baseline.md](./visual-baseline.md)
- T0-3：维护 [gap-report.md](./gap-report.md)
- T0-4：每个切片结束后回写矩阵与差异报告

## T1 已完成：模块骨架（归档）

- T1-1：`knowledge-network` 模块骨架
- T1-2：接管一级菜单「领域知识网络」
- T1-3：默认入口切换到 `knowledge-network`
- T1-4：`locales / navigation / routes / module.manifest / index`
- T1-5：知识网络列表骨架
- T1-6：工作区壳骨架
- T1-7：概念分组 / 对象类 / 关系类 / 行动类 / 指标 / 任务骨架与基础 CRUD
- T1-8：JSON 导入、统一 toolbar/drawer 样式
- T1-9：对象类索引设置（功能版）

---

## V1 入口层垂直对齐（当前阶段）

### V1-1 知识网络列表页 ← **已完成**

对照 vega：`KnowledgeNetwork/index.tsx`、`KnowledgeNetWorkCard`、`CreateAndEditForm`

- [x] **结构**：标题区、工具栏左右分区、卡片网格、分页
- [x] **交互**：搜索 / 标签 / 排序 / 刷新、创建 / 编辑 / 导入 / 导出 / 删除、点击进入工作区
- [x] **视觉**：卡片 hover/间距/页脚信息格式、空态（无数据 / 无搜索结果）、加载态
- [x] **表单**：创建 / 编辑弹窗字段与 vega 对齐（颜色选择器、标签校验、ID 规则；AI 创建除外）
- [x] **验收**：migration-matrix 列表页标记「视觉完成」

### V1-2 工作区壳 ← **已完成**

对照 vega：`KnowledgeNetworkMain`

- [x] 返回区 + 标题区 + 左侧二级导航 + 内容区层级
- [x] 导航顺序、分组标题、计数徽章（含 9999+）与选中态
- [x] 资源子页统一 24px 内容区承载
- [x] 验收：migration-matrix 工作区壳标记「视觉完成」

---

## V2 工作区 Landing 垂直对齐

### V2-1 概览 ← **已完成**

对照 vega：`KnowledgeNetworkMain/Overview`

- [x] 信息头卡片（名称 / 编辑 / 备注 / 修改者 / 更新时间）
- [x] 三列统计卡（对象 / 关系 / 行动 + 新建入口）
- [x] 最近修改对象类表格（名称 / 标签 / 修改者 / 更新时间）
- [x] 布局与样式对齐 vega（#f5f8ff 背景、4px 卡片、统计条底部操作）

### V2-2 预览 ← **暂缓**

对照 vega：`KnowledgeNetworkPreview`

- [ ] G6 或等价图谱预览、节点/边交互、空态

---

## V3 工作区资源页垂直对齐（按依赖顺序）

每页均含：列表 + 创建/编辑 + 详情 + 子配置页（如有）

### V3-1 对象类 ← **已完成**

对照 vega：`Object`、`ObjectCreateAndEdit`、`ObjectIndexSetting`

- [x] 列表页整页对齐（Table / 工具栏 / 批量删除 / 分页 / 空态）
- [x] 多步创建 / 编辑（基础信息 / 数据属性 / 逻辑属性）
- [x] 详情页（摘要 + 属性分段表格）
- [x] 索引设置页视觉微调（功能已有）

### V3-2 关系类 ← **已完成**

对照 vega：`Edge`、`EdgeCreateAndEdit`、`Edge/Detail`  
子规格：[relation-type-form-mapping-parity.md](./relation-type-form-mapping-parity.md)

- [x] 列表页整页对齐（Table / 源目标筛选 / 批量删除 / 分页）
- [x] 两步式创建 / 编辑 + direct / data-view 映射规则
- [x] 独立映射配置页
- [x] 详情 Config 只读表格（对象 icon + FieldTypeIcon）

**Wave D — 收口**

- [x] RT-8 详情 Config 区只读表格（direct / data-view）
- [x] RT-9 更新 migration-matrix / gap-report
- [x] RT-9-4 `npm run lint` / `npm run test -- --run` / `npm run build`（T8）

### V3-3 行动类

子规格：[`action-type-form-execution-parity.md`](./action-type-form-execution-parity.md)

对照 vega：`Action`、`ActionCreateAndEdit`、`Action/Detail`（Overview + TaskManagement）

- [x] 列表页主链路（CRUD、筛选、分页）
- [x] **Wave A** Step 1 扩展（condition / affect）+ Step 2 参数 FieldSelect 表
- [x] **Wave B** Service mapper + 表单/执行页保存闭环
- [x] **Wave C** 详情 Overview + TaskManagement + 立即执行
- [x] **Wave D** 工具目录 service 抽象 + 文档/i18n 收口（真实 `/tools/catalog` 待后端）

#### AT 任务明细

- [ ] AT-0 基线确认（可选）
- [x] AT-1 ~ AT-7
- [x] AT-9 migration-matrix / gap-report / i18n / tsc 验收
- [ ] AT-8 列表视觉微调（可选，非阻塞）

### V3-4 概念分组

对照 vega：`ConceptGroup`（见 `concept-group-parity.md`）

- [x] 详情深化：摘要元信息、Tab 列差异、搜索/标签/分页
- [x] 对象类添加/移除弹窗与服务 API
- [x] Mock 导入冲突 + overwrite/ignore

### V3-5 指标

对照 vega：`Metric`（见 `metric-parity.md`）

- [x] 创建/编辑：计算公式 + 单位 + 时间/分析维度
- [x] 详情：信息 Tab + 数据查询 Tab
- [x] 数据查询：即时值 / 趋势 / 占比

### V3-6 任务

对照 vega：`Task`

- [ ] 列表 + 创建 + 详情 + 执行管理对齐

---

## T8 联调与整体验收

- [x] T8-1：按 migration-matrix 逐页核对「视觉完成」（V1–V3-3 主链路 `done` 项已对齐）
- [x] T8-2：按 visual-baseline 核对层级与空态（已知 partial 项见 gap-report）
- [x] T8-3：更新 gap-report，清除过时描述
- [x] T8-4：`npm run lint`（0 errors，28 warnings 为既有 react-refresh / exhaustive-deps）
- [x] T8-5：`npm run test -- --run`（4/4 passed）
- [x] T8-6：`npm run build`（tsc + vite 通过）

---

## 当前最高优先级

**V3-6** 任务
