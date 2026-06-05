# 知识网络迁移需求说明

## 1. 目标

在 `bkn-studio` 中建设 `knowledge-network` 模块，迁移旧 `vega` 中知识网络相关能力，并接管左侧一级菜单“领域知识网络”。

本次迁移不是单页迁移，而是一个完整业务域迁移。迁移目标分两层：

- 业务层：旧 `vega` 中知识网络的页面结构、主链路、关键操作不能静默丢失。
- 工程层：实现必须遵守当前 `bkn-studio` 的模块化架构，不能复制旧组件体系和旧请求封装。

## 2. 迁移边界

### 2.1 必须保留

- 页面结构
- 主工作区导航结构
- 主操作链路
- 关键字段
- 关键弹窗、抽屉、步骤页
- 空态、错误态、加载态
- 关键页面之间的跳转关系

### 2.2 允许变化

- 代码组织方式
- 组件实现方式
- service/DTO 映射方式
- 权限实现方式

### 2.3 当前明确忽略

- 旧 `vega` 的鉴权、权限显隐、权限码判断
- 旧 `web-library` 组件体系
- 旧项目的 qiankun / OEM / 全局私有运行时分支

## 3. 参考来源

### 3.1 旧前端入口

- 路由入口：`D:\kowell\kowell-dip\web\apps\vega\src\pages\router.tsx`
- 知识网络列表：`D:\kowell\kowell-dip\web\apps\vega\src\pages\KnowledgeNetwork`
- 主工作区：`D:\kowell\kowell-dip\web\apps\vega\src\pages\KnowledgeNetworkMain`
- 预览：`D:\kowell\kowell-dip\web\apps\vega\src\pages\KnowledgeNetworkPreview`
- 概念分组：`D:\kowell\kowell-dip\web\apps\vega\src\pages\ConceptGroup`
- 对象类：`D:\kowell\kowell-dip\web\apps\vega\src\pages\Object`、`ObjectCreateAndEdit`、`ObjectIndexSetting`
- 关系类：`D:\kowell\kowell-dip\web\apps\vega\src\pages\Edge`、`EdgeCreateAndEdit`
- 行动类：`D:\kowell\kowell-dip\web\apps\vega\src\pages\Action`、`ActionCreateAndEdit`
- 指标：`D:\kowell\kowell-dip\web\apps\vega\src\pages\Metric`
- 任务：`D:\kowell\kowell-dip\web\apps\vega\src\pages\Task`

### 3.2 旧前端服务

- `D:\kowell\kowell-dip\web\apps\vega\src\services\knowledgeNetwork`
- `D:\kowell\kowell-dip\web\apps\vega\src\services\conceptGroup`
- `D:\kowell\kowell-dip\web\apps\vega\src\services\object`
- `D:\kowell\kowell-dip\web\apps\vega\src\services\edge`
- `D:\kowell\kowell-dip\web\apps\vega\src\services\action`
- `D:\kowell\kowell-dip\web\apps\vega\src\services\metric`
- `D:\kowell\kowell-dip\web\apps\vega\src\services\task`
- `D:\kowell\kowell-dip\web\apps\vega\src\services\ontologyQuery`

### 3.3 当前后端基线

- `D:\kowell\kowell-core\kowell-core\adp\bkn\bkn-backend\server`
- `D:\kowell\kowell-core\kowell-core\adp\bkn\ontology-query\server`

已知主要资源：

- `knowledge-networks`
- `concept-groups`
- `object-types`
- `relation-types`
- `action-types`
- `metrics`
- `jobs`
- 预览查询相关 `ontology-query`

## 4. 页面级迁移范围

### 4.1 顶层页面组

- 知识网络列表
- 知识网络创建/编辑
- 知识网络导入
- 知识网络主工作区
- 概览
- 预览
- 概念分组
- 对象类
- 关系类
- 行动类
- 指标
- 任务

### 4.2 旧路由映射基线

- `/ontology`：知识网络列表
- `/ontology/main/*`：知识网络主工作区
- `/ontology/concept-group/detail/:id`：概念分组详情
- `/ontology/object/create|edit|detail|settting/:id`
- `/ontology/edge/create|edit|detail/:id`
- `/ontology/action/create|edit|detail/:knId/:atId`
- `/ontology/metric/create|edit|detail/:metricId`

## 5. 迁移清单

详细清单见：

- [migration-matrix.md](D:/openbkn/bkn-studio/specs/knowledge-network-migration/migration-matrix.md)

## 6. 样式与交互基线

详细基线见：

- [visual-baseline.md](D:/openbkn/bkn-studio/specs/knowledge-network-migration/visual-baseline.md)

## 7. 当前差异与剩余工作

详细差异见：

- [gap-report.md](D:/openbkn/bkn-studio/specs/knowledge-network-migration/gap-report.md)

## 8. 当前结论

当前 `knowledge-network` 已经完成：

- 一级菜单接管
- 知识网络列表
- 工作区壳
- 概览
- 预览基础壳
- 概念分组主链路
- 对象类第一阶段
- 关系类第一阶段
- 行动类第一阶段

但还没有完成：

- 指标
- 任务
- 对象类详情 / 索引设置
- 关系类详情 / 完整映射规则
- 行动类详情 / 执行映射 / 计划 / 日志
- 一轮严格的 UI 对齐收口

所以接下来的执行原则是：

1. 先按页面矩阵和视觉基线补齐第一阶段差异。
2. 再继续进入指标和任务。
