# Issue 39 实施方案

## 目标

将对象详情页从“属性说明页”升级为“对象工作台”，支持:

- 关联数据视图展示
- 数据样本预览
- SQL 检索入口
- 关系探索入口
- Skill / Logic 沉淀能力

## 方案拆解

### Phase 1: 对象详情页接入数据视图与预览

#### 前端范围

- 改造 `ObjectTypeDetailScene`
- 新增对象详情资源面板组件
- 新增对象详情数据预览面板组件

建议新增组件:

- `ObjectTypeBoundResourcesPanel`
- `ObjectTypeDataPreviewPanel`

#### 服务层范围

优先复用:

- `getObjectTypeResourcePreview`
- `listObjectTypeResources`

必要时补充:

- 面向对象详情的“关联资源聚合接口”

#### 关键设计

- 如果 `detail.dataSource` 只有一个资源，直接展示主资源卡片
- 如果后端未来支持多资源，前端面板可自然升级为资源列表
- 数据预览默认显示前 20 条样本
- 搜索先走前端过滤，避免第一阶段引入新后端接口

### Phase 2: SQL 检索工作台

#### 前端范围

新增组件:

- `ObjectTypeSqlWorkbenchPanel`

能力:

- SQL 输入区
- 参数说明区
- 结果表格
- 保存入口

#### 后端依赖

需要明确以下接口之一:

- 直接面向 resource 的 SQL 执行接口
- 或复用 Vega / catalog 查询接口

#### 关键设计

- SQL 检索只面向当前对象绑定资源
- 默认预置对象关联资源名，降低误操作
- 第一阶段不做完整 SQL 编辑器生态，只做业务可用的查询面板

### Phase 3: 关系探索面板

#### 前端范围

新增组件:

- `ObjectTypeRelationExplorerPanel`

能力:

- 当前对象参与关系列表
- 按 source / target 分组
- 路径步骤视图

#### 服务层依赖

若当前已有关系类型列表足够，可先前端过滤:

- 拉取 relation type 列表
- 过滤出 sourceObjectTypeId / targetObjectTypeId 命中的记录

若要支持多跳路径探索，需要新接口。

### Phase 4: Skill / Logic 沉淀

#### Skill 保存

优先桥接:

- 执行工厂现有 Skill 注册能力

需要设计:

- Skill 名称
- 分类
- 内容模板
- 关联对象 / 资源元数据

#### Logic 保存

优先复用:

- `ObjectTypeLogicProperty` 结构
- 逻辑属性编辑保存链路

## 页面结构建议

对象详情页建议重构为以下顺序:

1. 对象摘要
2. 数据属性 / 逻辑属性
3. 关联数据视图
4. 数据样本预览
5. SQL 检索工作台
6. 关系探索

说明:

- 属性编辑仍保留在页面中部
- 数据与关系能力放在其后，更符合“先看对象定义，再看对象运行数据”的顺序

## 组件边界

建议避免把所有逻辑继续堆在 `ObjectTypeDetailScene.tsx`。

推荐拆分:

- `ObjectTypeDetailScene`
  - 负责路由、对象详情加载、顶层布局
- `ObjectTypePropertyPanel`
  - 负责数据/逻辑属性现有区块
- `ObjectTypeBoundResourcesPanel`
  - 负责绑定资源信息与跳转
- `ObjectTypeDataPreviewPanel`
  - 负责样本数据与过滤
- `ObjectTypeSqlWorkbenchPanel`
  - 负责 SQL 检索
- `ObjectTypeRelationExplorerPanel`
  - 负责关系与路径探索

## API 演进建议

### 优先可复用

- `getKnowledgeNetworkObjectTypeDetail`
- `getObjectTypeResourcePreview`
- `listKnowledgeNetworkRelationTypes`

### 需要新契约或后端确认

1. 多数据视图接口
2. SQL 执行接口
3. 从对象详情保存为 Skill 的接口协议
4. 路径探索接口

## 实施优先级

### P0

- 关联数据视图
- 数据视图预览

### P1

- SQL 检索工作台

### P2

- 关系探索与路径沉淀
- 保存为 Skill / Logic

## 验证策略

### UI 验证

- 对象已绑定资源
- 对象未绑定资源
- 资源预览为空
- 逻辑属性与数据属性切换不回归
- 多标签、多字段、长表格布局稳定

### 服务验证

- 资源预览接口失败时有降级提示
- catalog 权限不足时有明确反馈
- SQL 执行失败时有错误提示

### 集成验证

- 从对象详情跳转到数据目录资源详情
- 从对象详情发起 Skill 保存
- 保存后的 Skill 可在执行工厂中看到
