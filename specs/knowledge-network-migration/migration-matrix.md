# 知识网络页面迁移矩阵

## 说明

状态定义：

- `done`：结构和主链路已迁入
- `partial`：只完成第一阶段骨架或部分动作
- `todo`：尚未迁入

## 页面矩阵

| 旧页面/能力 | 旧入口 | 当前新入口 | 必须保留 | 当前状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 知识网络列表 | `/ontology` | `/knowledge-network` | 列表、搜索、标签、创建、编辑、删除、导入 | `done` | V1-1 视觉完成（AI 创建除外） |
| 知识网络创建/编辑 | 列表弹窗 | 列表弹窗 | 表单、颜色、标签、描述 | `done` | 颜色选择器 / 标签校验 / ID 规则已对齐 |
| 知识网络导入 | 列表弹窗 | 列表入口 | 导入链路 | `done` | JSON 导入 + 冲突处理 |
| 主工作区壳 | `/ontology/main/*` | `/knowledge-network/workspace/:id/*` | 顶部返回、标题、左侧二级导航、内容承载 | `done` | V1-2 视觉完成 |
| 概览 | 工作区概览 | `/workspace/:id/overview` | 统计卡、最近修改列表 | `done` | V2-1 视觉完成 |
| 预览 | 工作区预览 | `/workspace/:id/preview` | 图谱预览区 | `partial` | 只有基础图谱承载 |
| 概念分组列表 | 工作区概念分组 | `/workspace/:id/concept-groups` | 列表、创建、编辑、删除、详情入口 | `done` | 导入冲突 + mock 持久化 |
| 概念分组详情 | `/ontology/concept-group/detail/:id` | `/workspace/:id/concept-groups/:id/detail` | 基本信息、对象/关系/行动成员、添加/移除对象类 | `done` | 见 concept-group-parity.md |
| 对象类列表 | 工作区对象类 | `/workspace/:id/object-types` | 列表、创建、编辑、删除 | `partial` | V3-1 列表 + 多步表单 + 详情页视觉完成 |
| 对象类创建/编辑 | `/ontology/object/create\|edit` | `/workspace/:id/object-types/create\|edit` | 三步表单 | `partial` | Step 2 画布 + Step 3 逻辑属性抽屉已对齐 Vega 主链路，React Flow 节点拖拽仍简化 |
| 对象类详情 | `/ontology/object/detail/:id` | `/workspace/:id/object-types/:id/detail` | 摘要 + 属性 + 操作 | `partial` | 详情页已落地，数据预览区仍缺 |
| 对象类索引设置 | `/ontology/object/settting/:id` | `/workspace/:id/object-types/:id/index-settings` | 索引设置 | `done` | V3-1 视觉完成 |
| 关系类列表 | 工作区关系类 | `/workspace/:id/relation-types` | 列表、创建、编辑、删除 | `done` | V3-2 列表页 Table 视觉完成 |
| 关系类详情 | `/ontology/edge/detail/:id` | `/workspace/:id/relation-types/:id/detail` | 详情信息、源/目标对象、映射信息 | `done` | V3-2 Config 表格 + 映射入口 |
| 关系类创建/编辑 | `/ontology/edge/create\|edit/:id` | `/workspace/:id/relation-types/create\|edit` | 两步式建模 + direct/data-view 映射 | `done` | V3-2 视觉完成（见 relation-type-form-mapping-parity.md） |
| 关系类映射配置 | 详情/编辑入口 | `/workspace/:id/relation-types/:id/mapping` | 独立映射维护 | `done` | V3-2 与 Step 2 共用 Editor |
| 行动类列表 | 工作区行动类 | `/workspace/:id/action-types` | 列表、创建、编辑、删除 | `done` | 详情链路已落地 |
| 行动类详情 | `/ontology/action/detail/:knId/:atId` | `/workspace/:id/action-types/:id/detail` | Overview + TaskManagement、立即执行 | `done` | 调度只读待工具/计划 API |
| 行动类创建/编辑 | `/ontology/action/create\|edit/:id` | `/workspace/:id/action-types/create\|edit` | 两步表单 + 条件/影响 + 执行映射 | `done` | 工具目录 mock；`/tools/catalog` 待后端 |
| 行动类执行配置 | 编辑 Step 2 / 详情入口 | `/workspace/:id/action-types/:id/execution` | 独立执行映射维护 | `done` | 与 Step 2 共用 Editor |
| 指标列表 | 工作区指标 | `/workspace/:id/metrics` | 列表、创建、编辑、详情 | `done` | 见 metric-parity.md |
| 指标创建/编辑 | `/ontology/metric/create\|edit` | `/workspace/:id/metrics/create\|edit` | 基础信息 + 计算公式 | `done` | 原子指标；复杂过滤待补 |
| 指标详情/查询 | 详情 Tab | `/workspace/:id/metrics/:id/detail` | 信息 + 数据查询 Tab | `done` | 无 ECharts，CSS 条形图 |
| 任务列表 | 工作区任务 | 未落 | 列表、创建、详情 | `todo` | 第二阶段 |

## 当前执行结论

V3-2 关系类、**V3-3 行动类**、**V3-4 概念分组**、**V3-5 指标**已完成主链路。  
下一刀：**V3-6** 任务。
