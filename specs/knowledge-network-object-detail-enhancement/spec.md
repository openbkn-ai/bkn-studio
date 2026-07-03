# Issue 39 需求分析与规格说明

## 基本信息

- 来源: `openbkn-ai/bkn-studio` Issue #39
- 标题: `enhancement(knowledge-network): 业务对象详情页增强 — 数据视图、预览检索、SQL Skill、关系探索`
- 目标页面: `src/modules/knowledge-network/scenes/ObjectTypeDetailScene.tsx`

## 背景

当前业务对象详情页只覆盖两类信息:

1. 对象基础信息
2. 数据属性 / 逻辑属性列表

这意味着对象类型虽然已经完成建模，用户仍然无法在对象详情内部完成以下关键动作:

- 确认对象绑定到了哪个数据资源
- 查看对象底层资源的实际样本数据
- 基于对象做数据检索
- 沿关系类型探索关联对象路径
- 将查询和探索能力沉淀为可复用能力

Issue 39 的核心不是单独再加一个 Tab，而是把对象详情页从“建模结果查看页”提升成“对象工作台”。

## 当前现状

### 前端现状

对象详情页当前实现位于:

- `src/modules/knowledge-network/scenes/ObjectTypeDetailScene.tsx`

当前能力:

- 展示对象名称、描述、标签、索引状态、概念组数量
- 展示数据属性表
- 展示逻辑属性表
- 支持对象编辑、索引配置、删除

当前缺口:

- 未展示 `detail.dataSource`
- 未展示关联 catalog / resource
- 未集成资源预览
- 未聚合对象相关关系类型
- 未提供 SQL 检索或 Skill 保存入口

### 已有可复用能力

#### 1. 对象详情已返回数据源

- 类型: `src/modules/knowledge-network/types/object-type.ts`
- 关键类型:
  - `ObjectTypeDetail`
  - `ObjectTypeDataSource`

说明:

- `ObjectTypeDetail` 已包含可选字段 `dataSource?: ObjectTypeDataSource`
- 说明对象详情 API 已经具备“对象绑定资源”的最小语义

#### 2. 已有资源列表 / 资源预览服务

- `src/modules/knowledge-network/services/object-type-resource.service.ts`

已有方法:

- `queryObjectTypeResources`
- `listObjectTypeResources`
- `getObjectTypeResourcePreview`
- `listObjectTypeResourceFields`

说明:

- 资源预览基础能力已经存在
- 当前缺少的是在对象详情页内的整合和交互封装

#### 3. Skill 注册体系已存在

可用模块:

- `src/modules/execution-factory`
- `src/modules/execution-factory-lab`

现状判断:

- 平台已经具备 Skill 导入 / 编辑 / 详情 / 发布体系
- 但“从知识网络对象详情生成 Skill”的桥接流程尚未建立

#### 4. 逻辑属性体系已存在

相关实现:

- `ObjectTypeLogicAttributeEditor`
- `ObjectTypeLogicAttributeEditDrawer`
- `ObjectTypeLogicProperty`

说明:

- “保存为 Logic”不需要新造一套对象模型
- 应复用现有逻辑属性编辑和保存语义

## 需求范围

本需求覆盖对象详情页增强，范围分为四个层次。

### A. 数据视图层

在对象详情页展示当前对象关联的数据资源信息。

最小交付:

- 展示对象当前绑定的数据资源
- 显示 catalog / resource 标识
- 提供跳转到数据目录资源详情页

扩展交付:

- 支持展示主/辅数据源
- 支持一个对象映射多个数据视图

说明:

当前 `ObjectTypeDetail.dataSource` 仅能表达单资源绑定，若要支持多视图，需要补充后端或聚合接口。

### B. 数据预览层

在对象详情页直接预览关联资源样本数据。

最小交付:

- 支持展示字段列
- 支持展示样本行
- 支持关键字搜索 / 前端过滤

约束:

- 预览需尊重 catalog 权限
- 预览需受采样数量限制

### C. SQL 检索与 Skill 沉淀层

在数据预览基础上，为对象详情提供“面向资源的查询工作台”。

最小交付:

- 输入 SQL
- 执行 SQL
- 展示结果
- 命名保存

完整交付:

- 保存为 Skill
- 记录关联对象、资源、输入参数和查询元数据

说明:

该能力依赖后端是否提供 SQL 执行接口，以及 Skill 注册是否允许以内容或结构化元数据创建。

### D. 关系探索与 Logic / Skill 沉淀层

在对象详情页聚合当前对象参与的关系类型，并支持路径探索。

最小交付:

- 列出当前对象为 source / target 的关系类型
- 展示起点、终点、映射模式、关联资源

完整交付:

- 多跳路径探索
- 保存探索结果为 Skill
- 或沉淀为 Logic

## 非目标

本需求不应在第一阶段直接包含:

- 全量图数据库式探索器重构
- 复杂 SQL IDE 能力
- 通用 BI 查询器
- 全新的 Logic 运行时模型

第一阶段应以“对象详情工作台增强”为边界，优先复用现有能力。

## 推荐实施策略

建议按三阶段推进，而不是一次做完四块。

### Phase 1: 对象 -> 资源 -> 预览

目标:

- 先完成对象详情与资源的闭环

交付:

- 关联数据视图区块
- 数据样本预览区块
- 前端搜索/过滤

价值:

- 风险最低
- 立即解决“对象无法看到实际数据”的核心问题

### Phase 2: 对象 -> 关系 -> 路径探索

目标:

- 在对象详情中补全关系语义

交付:

- 当前对象相关关系列表
- 基础路径探索器

价值:

- 建立“对象不是孤立表”的使用心智

### Phase 3: 沉淀为 Skill / Logic

目标:

- 让对象详情成为可复用能力的生产入口

交付:

- SQL 结果保存为 Skill
- 关系探索保存为 Skill / Logic

价值:

- 与执行工厂、Agent 体系打通

## 数据与接口分析

### 当前已满足

- 对象详情可拿到 `dataSource`
- 可对具体资源做预览
- 可读取对象逻辑属性
- 可进入 Skill 体系

### 当前不足

- 最近没有“对象详情专属的关联资源聚合接口”
- `ObjectTypeDetail` 无多数据视图表达
- 无对象详情可直接调用的 SQL 检索接口
- 无“从对象详情保存为 Skill”的明确接口契约
- 无对象详情可直接使用的关系探索 API / DTO

## 前端设计建议

对象详情页建议从当前两段结构扩展为四个业务区块:

1. 对象摘要
2. 关联数据视图
3. 数据预览 / SQL 检索
4. 关系探索 / Logic 沉淀

推荐布局:

- 页面顶部保留对象摘要
- 下方使用直角业务分区卡片
- 不建议再用纯 Tab 把所有能力压缩到一个容器内
- 数据预览与 SQL 检索应相邻，形成“看数据 -> 写查询”的连续体验

## 风险与依赖

### 前端风险

- 对象详情页复杂度显著上升
- 若全部塞进一个场景文件，会快速失控

建议:

- 拆分为独立子面板组件

### 后端依赖

- SQL 执行接口
- Skill 注册接口契约
- 关系探索接口
- 多数据视图表达能力

### 权限依赖

- catalog 资源预览权限
- SQL 执行权限
- Skill 创建权限
- Logic 编辑权限

## 验收口径整理

### 第一阶段验收

- [ ] 对象详情页可见关联数据视图信息
- [ ] 可跳转到数据目录对应资源详情
- [ ] 可在页内预览样本数据
- [ ] 支持关键字过滤样本数据

### 第二阶段验收

- [ ] 可看到该对象参与的关系类型
- [ ] 可查看起点/终点/映射方式/关联资源
- [ ] 可基于对象执行基础路径探索

### 第三阶段验收

- [ ] 可执行 SQL 检索
- [ ] 可预览 SQL 结果
- [ ] 可将 SQL 检索保存为 Skill
- [ ] 可将关系探索结果保存为 Skill 或 Logic

## 结论

Issue 39 不是一个单点 UI 调整，而是对象详情页能力升级项目。

最合理的落地路径是:

1. 先做资源与预览闭环
2. 再做关系探索
3. 最后接 Skill / Logic 沉淀

这样可以最大化复用当前代码，同时把后端依赖控制在可推进范围内。
