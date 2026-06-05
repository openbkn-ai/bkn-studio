# 知识网络页面迁移矩阵

## 说明

状态定义：

- `done`：结构和主链路已迁入
- `partial`：只完成第一阶段骨架或部分动作
- `todo`：尚未迁入

## 页面矩阵

| 旧页面/能力 | 旧入口 | 当前新入口 | 必须保留 | 当前状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 知识网络列表 | `/ontology` | `/knowledge-network` | 列表、搜索、标签、创建、编辑、删除、导入入口 | `done` | 结构已落，仍需视觉收口 |
| 知识网络创建/编辑 | 列表弹窗 | 列表弹窗 | 表单、颜色、标签、描述 | `done` | AI 创建模式未做 |
| 知识网络导入 | 列表弹窗 | 列表占位入口 | 导入链路 | `partial` | 现在是占位提示 |
| 主工作区壳 | `/ontology/main/*` | `/knowledge-network/workspace/:id/*` | 顶部返回、标题、左侧二级导航、内容承载 | `done` | 视觉仍需对齐 |
| 概览 | 工作区概览 | `/workspace/:id/overview` | 统计卡、最近修改列表 | `done` | 明细还可继续贴近旧页 |
| 预览 | 工作区预览 | `/workspace/:id/preview` | 图谱预览区 | `partial` | 只有基础图谱承载 |
| 概念分组列表 | 工作区概念分组 | `/workspace/:id/concept-groups` | 列表、创建、编辑、删除、详情入口 | `done` | 导入仍是占位 |
| 概念分组详情 | `/ontology/concept-group/detail/:id` | 当前抽屉详情 | 基本信息、对象/关系/行动成员 | `partial` | 已有承载，仍缺更深操作 |
| 对象类列表 | 工作区对象类 | `/workspace/:id/object-types` | 列表、创建、编辑、删除 | `done` | 详情链路已落地 |
| 对象类详情 | `/ontology/object/detail/:id` | 当前抽屉详情 | 详情信息、关联信息 | `done` | 已有详情承载，后续再补索引设置入口 |
| 对象类索引设置 | `/ontology/object/settting/:id` | 未落 | 索引设置入口与页面 | `todo` | 当前只保留后续计划 |
| 关系类列表 | 工作区关系类 | `/workspace/:id/relation-types` | 列表、创建、编辑、删除 | `done` | 详情链路已落地 |
| 关系类详情 | `/ontology/edge/detail/:id` | 当前抽屉详情 | 详情信息、源/目标对象、映射信息 | `done` | 已有详情承载，后续再补完整映射入口 |
| 关系类创建/编辑高级映射 | `/ontology/edge/create|edit/:id` | 当前弹窗简化版 | 两步式建模 | `partial` | 现仅保留基础字段 |
| 行动类列表 | 工作区行动类 | `/workspace/:id/action-types` | 列表、创建、编辑、删除 | `done` | 详情链路已落地 |
| 行动类详情 | `/ontology/action/detail/:knId/:atId` | 当前抽屉详情 | 概览、任务子页 | `done` | 已有详情承载，后续再补执行配置入口 |
| 行动类创建/编辑高级映射 | `/ontology/action/create|edit/:id` | 当前弹窗简化版 | 绑定对象、动作类型、执行映射 | `partial` | 现仅保留基础字段 |
| 指标列表 | 工作区指标 | 未落 | 列表、创建、编辑、详情 | `todo` | 第二阶段 |
| 任务列表 | 工作区任务 | 未落 | 列表、创建、详情 | `todo` | 第二阶段 |

## 当前执行结论

接下来不得直接跳到 `Metric` 或 `Task`，必须先补：

1. 知识网络列表页工具栏与分页对齐
2. 第一轮统一样式收口
3. 对象类索引设置入口占位
4. 关系类映射配置入口占位
5. 行动类执行配置入口占位
