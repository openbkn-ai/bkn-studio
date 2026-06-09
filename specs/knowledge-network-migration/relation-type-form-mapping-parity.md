# 关系类两步表单 + 映射页 Parity 清单（V3-2）

> 范围：**仅**关系类创建/编辑两步表单、独立映射配置页，及其依赖的类型 / service / mock。  
> 不在本切片：关系类列表页（已完成）、详情页深化（RT-8 可选）、导入。

参考源：`D:\kowell\kowell-dip\web\apps\vega\src\pages\EdgeCreateAndEdit\`  
详情参考（可选）：`Edge\Detail\index.tsx`

目标入口：

| 场景 | 路由 |
| --- | --- |
| 新建 | `/knowledge-network/workspace/:networkId/relation-types/create` |
| 编辑 | `/knowledge-network/workspace/:networkId/relation-types/:relationTypeId/edit` |
| 映射配置 | `/knowledge-network/workspace/:networkId/relation-types/:relationTypeId/mapping` |

---

## 1. 迁移边界（No-Loss）

### 必须保留

- 两步步骤条：基础信息 → 关系映射
- 映射方式切换：直接映射 / 视图映射
- 映射方式切换时的示意图预览区
- 直接映射：对象类行 + 多行属性映射表（增删改、清空对象时重置属性）
- 视图映射：起点 / 数据视图 / 终点三列表格 + 数据视图选择器 + 双端属性映射
- 创建 / 编辑保存后返回列表；编辑时回填完整映射
- 独立映射页：仅编辑映射规则，保存后返回列表或详情

### 允许差异

- Vega 基础信息无「颜色」字段 → bkn-studio 保留颜色（与列表卡片一致，不删）
- 预览区可用 CSS 组件 `RelationMappingPreview` 替代静态 SVG（视觉等价即可）
- 对象类下拉可复用 `ResourceIconSelect` 渲染逻辑，不必 1:1 复制 `ObjectIcon` 组件

### 明确不在本切片

- 关系类 JSON 导入
- 详情页完整 Config 表格（见 RT-8，可选后置）
- 列表页（V3-2 列表已完成）

---

## 2. 文件映射

| Vega 源文件 | bkn-studio 目标 | 当前状态 |
| --- | --- | --- |
| `EdgeCreateAndEdit/index.tsx` | `scenes/RelationTypeFormScene.tsx` | partial — 步骤编排已有，缺完整映射能力与离开保护 |
| `BasicInformation/index.tsx` | Step 1 内联 Form | partial — 字段基本齐，缺与 Vega 一致的宽度/布局微调 |
| `Mapping/index.tsx` | `RelationTypeMappingEditor.tsx`（外壳） | partial — 有 Radio + 占位 preview，缺模式切换重置 |
| `Mapping/MappingRules/index.tsx` | `RelationTypeDirectMappingRules.tsx`（待拆） | partial — 逻辑在 Editor 内，缺 FieldSelect 风格 |
| `Mapping/MappingRulesDataView/index.tsx` | `RelationTypeDataViewMappingRules.tsx`（待建） | todo — 仅 Alert 占位 |
| `Edge/Detail/index.tsx`（Config 区） | `scenes/RelationTypeDetailScene.tsx` | partial — 可选 RT-8 |
| — | `scenes/RelationTypeMappingScene.tsx` | partial — 壳 + Editor，待去占位文案 |
| — | `components/relation-type/RelationMappingPreview.tsx` | done — 未接入 Step 2 |
| — | `pages/RelationTypeCreatePage.tsx` 等 | done — 薄包装 |

---

## 3. 当前基线与差距

### 已有

- `ResourceFormStepsShell` 两步编排（prev / next / save）
- Step 1：名称 / ID / 颜色 / 标签 / 描述 + 校验
- Step 2：`RelationTypeMappingEditor` 直接映射表格（对象行 + 属性行 + 增删）
- 独立映射页路由与保存链路
- Mock：`mockRelationTypeMappings` 持久化 direct 属性映射
- 编辑模式加载 detail 并回填 Step 1 + Step 2

### 主要差距

| 区域 | 差距 |
| --- | --- |
| Step 2 预览 | 仅文字 label，未使用 `RelationMappingPreview` 或 Vega 示意图 |
| 映射模式切换 | 切换 direct / data-view 时未重置 `mappingRules` 为对应初始结构 |
| 视图映射 | 无三列表格、无数据视图选择、无 `source_mapping_rules` / `target_mapping_rules` |
| 属性选择器 | 普通 `Select`，无字段类型图标 / displayName 展示（Vega `FieldSelect`） |
| 对象类选择 | 纯文本 option，无 icon + color |
| 类型模型 | `RelationTypeMappingConfig` 仅 direct 结构，缺 data-view 字段 |
| Service | create/update HTTP body 未发送 `mapping_rules` / data-view 嵌套规则 |
| Detail 回读 | 真实 API 路径 `propertyMappings` 恒为空数组 |
| 表单体验 | 缺 `beforeunload`、步骤条 `doneStep` 回退同步、映射页去 placeholder |
| i18n | `relationTypeDataViewMappingHint` / `relationTypeMappingPending` 仍为占位文案 |

---

## 4. 功能需求明细

### Step 1 — 基础信息（RT-1）

对照 `BasicInformation/index.tsx`

- [ ] 表单宽度 ~600px，居中，与对象类 Step 1 一致
- [ ] 字段：名称（必填，≤40）、ID（pattern，编辑禁用）、标签（校验规则对齐）、描述（≤1000）
- [ ] 颜色字段保留（bkn-studio 增强，非 Vega 原字段）
- [ ] 下一步：校验通过后写入 `basicValue`，更新 info bar 标题（编辑模式）

### Step 2 — 关系映射外壳（RT-2）

对照 `Mapping/index.tsx`

- [ ] 表单项「关系关联」：`Radio.Group` direct / data-view
- [ ] 切换模式时重置为对应初始值（direct 与 data-view 结构互斥）
- [ ] 预览区高度 ~160px，背景 `#f5f8ff`，展示 `RelationMappingPreview`（随已选对象类 / 映射条数变化）
- [ ] Step 2 info bar：关系名、映射方式、属性映射条数（direct 模式）

### Step 2 — 直接映射规则（RT-3）

对照 `MappingRules/index.tsx`

- [ ] 表格列：行类型（对象类 / 数据属性）、起点、终点、操作
- [ ] 对象类行：`Select` 带 icon + 名称；变更时清空该行以下属性映射
- [ ] 属性行：`FieldSelect` 风格（类型图标 + displayName），依赖已选对象类的 `dataProperties`
- [ ] 底部 Link 按钮「新增数据属性」
- [ ] 删除：对象行清空两端对象；属性行末行清空字段，多行则删行
- [ ] 校验：至少一条完整属性映射（两端对象 + 至少一对属性）

### Step 2 — 视图映射规则（RT-4）

对照 `MappingRulesDataView/index.tsx`

- [ ] 三列表格：起点、数据视图、终点
- [ ] 对象行：起点/终点对象类 Select（同 RT-3）；数据视图列点击打开 `ObjectTypeDataViewSelectModal`（复用对象类已有组件）
- [ ] 属性行：起点属性、数据视图双字段（source/target）、终点属性
- [ ] 切换数据视图时清空视图侧属性映射
- [ ] 增删行逻辑与 Vega 对称（`source_mapping_rules` + `target_mapping_rules` 同步增减）
- [ ] 校验：对象类 + 数据视图 ID + 至少一条完整映射

### 表单编排（RT-5）

对照 `EdgeCreateAndEdit/index.tsx`

- [ ] 创建：Step 0 next → Step 1；Step 1 save → create API → 回列表
- [ ] 编辑：加载 detail 回填；`doneStep` 允许点击已完成步骤；步骤切换时同步表单状态
- [ ] 返回：未保存确认弹窗（已有，需覆盖 Step 2 映射变更）
- [ ] `beforeunload` 离开提示（对齐对象类）
- [ ] 保存 payload 经 `normalizeRelationTypeMappingValues` + `toBackendRelationTypePayload`

### 独立映射页（RT-6）

- [ ] 去掉 placeholder 文案与 `placeholderCard` 占位样式
- [ ] 标题 = 关系类名称；副标题 = 映射维护说明
- [ ] Editor 与表单 Step 2 共用组件（`mappingModeField` 可编辑）
- [ ] 保存：仅更新映射相关字段，保留 name/color/tags/description
- [ ] 返回：回到详情或列表（与 Vega 一致 goBack 行为，当前回列表可接受）

### 类型与 Service（RT-7）

- [ ] 扩展 `relation-type.ts`：
  - `RelationTypeDirectMappingRules`
  - `RelationTypeDataViewMappingRules`（`backingDataSourceId`, `sourceMappingRules`, `targetMappingRules`）
  - `RelationTypeDetail` 含完整映射
- [ ] `BackendRelationType` + mapper 回读 `mapping_rules`
- [ ] `toBackendRelationTypePayload` / `fromBackendRelationTypeDetail`
- [ ] Mock：`persistMockRelationTypeDataViewMappings` 或统一 mapping store
- [ ] HTTP create/update 发送 Vega 对齐 body（含 `branch: main`、`type`、`mapping_rules`）

### 详情 Config 区（RT-8，可选后置）

对照 `Edge/Detail/index.tsx`

- [ ] 摘要卡 + Config 段表格（对象行只读 + 属性行 FieldItem 风格）
- [ ] direct / data-view 两套列定义
- [ ] 「映射配置」按钮跳转独立映射页

### 视觉与 i18n（RT-9）

- [ ] 移除占位 i18n key 或改为正式文案
- [ ] 表格 `size="small"`、 bordered，列宽对齐 Vega（direct ~415+415，data-view ~215+400+215）
- [ ] 映射页 / 表单 Step 2 内容区 max-width ~1000px 居中

---

## 5. 后端依赖

| 能力 | Vega / 预期 API | 当前 bkn-studio |
| --- | --- | --- |
| 对象类列表（含 data_properties） | `object.objectGet` | `listKnowledgeNetworkObjectTypes` + detail |
| 数据视图详情/字段 | `dataView.getDataViewDetail` | 对象类模块已有 data-view API，复用 |
| 创建关系类 | `edge.createEdge` | POST relation-types，**缺 mapping_rules** |
| 更新关系类 | `edge.updateEdge` | PUT relation-types，**缺 mapping_rules** |
| 关系类详情 | `edge.getEdgeDetail` | GET relation-types，**缺 mapping_rules 映射** |

---

## 6. 任务拆分（执行顺序）

粒度原则：**每个任务可独立验收、可单独提交**，单任务改动文件 ≤ 5 个为宜。

### RT-0 基线确认（0.5d）

- [ ] **RT-0-1** 跑通三条路由（create / edit / mapping），记录当前 UI 截图基线
- [ ] **RT-0-2** 确认 mock 与真实 API 开关下各自行为差异，写入本文件「当前基线」

### RT-1 Step 1 基础信息（0.5d）

- [ ] **RT-1-1** 表单布局宽度与 label 对齐 object-type Step 1
- [ ] **RT-1-2** 校验规则与 Vega 对齐（ID pattern、标签、描述长度）
- [ ] **RT-1-3** 编辑模式 title 随名称更新；验收：create/edit Step 1

### RT-2 映射外壳 + 预览（1d）

- [ ] **RT-2-1** 抽取 `RelationTypeMappingShell`（Radio + Preview + children slot） ✅
- [ ] **RT-2-2** 接入 `RelationMappingPreview`，绑定 source/target 对象与 mapping 条数 ✅
- [ ] **RT-2-3** 实现 mappingMode 切换重置逻辑（direct ↔ data-view 初始结构） ✅
- [ ] **RT-2-4** 验收：切换模式后表格结构正确、预览区有内容

### RT-3 直接映射编辑器（1.5d）

- [ ] **RT-3-1** 拆出 `RelationTypeDirectMappingRules.tsx`（从 Editor 迁出表格逻辑） ✅
- [ ] **RT-3-2** 对象类 Select 选项增加 icon + color（复用 shared 组件） ✅
- [ ] **RT-3-3** 属性 Select 改为 FieldSelect 风格（复用 `FieldTypeIcon`） ✅
- [ ] **RT-3-4** 增删改与校验逻辑对齐 Vega；单元测试 optional ✅
- [ ] **RT-3-5** 验收：direct 模式完整 CRUD 映射 + mock 持久化

### RT-4 视图映射编辑器（2d）

- [ ] **RT-4-1** 扩展 types：`RelationTypeDataViewMappingRules` 等
- [ ] **RT-4-2** 新建 `RelationTypeDataViewMappingRules.tsx` 三列表格
- [ ] **RT-4-3** 接入 `ObjectTypeDataViewSelectModal` 选择 backing data view
- [ ] **RT-4-4** 数据视图字段 options 加载（复用 object-type data-view fields API）
- [ ] **RT-4-5** 增删行、校验、与 Editor 集成
- [ ] **RT-4-6** 验收：data-view 模式完整流程（mock）

### RT-5 表单编排收尾（1d）

- [ ] **RT-5-1** `RelationTypeFormScene` 接入 MappingShell + 分模式 Editor
- [ ] **RT-5-2** 编辑回填 data-view 映射；`doneStep` / 步骤点击同步
- [ ] **RT-5-3** `beforeunload` + 返回确认覆盖映射变更
- [ ] **RT-5-4** 验收：create/edit 全流程 save 后列表可见正确映射模式

### RT-6 独立映射页（0.5d）

- [ ] **RT-6-1** 去掉 placeholder 样式与 copy
- [ ] **RT-6-2** 与 Form Step 2 共用 Editor；保存逻辑复用 normalize + update
- [ ] **RT-6-3** 验收：从详情进入 mapping → 修改 → 保存 → 再进 edit 可回填

### RT-7 Service / Mock 对齐（1d）

- [ ] **RT-7-1** `toBackendRelationTypePayload` + mapper 扩展
- [ ] **RT-7-2** create/update HTTP body 含 mapping_rules（direct + data-view）
- [ ] **RT-7-3** `getKnowledgeNetworkRelationTypeDetail` 回读完整映射（mock + API）
- [ ] **RT-7-4** mock seed 数据补 1 条 data-view 样例
- [ ] **RT-7-5** 验收：`tsc -b` + mock 下 create/edit/mapping 数据一致

### RT-8 详情 Config 区（可选，1d）

- [ ] **RT-8-1** 详情页 Config 表格只读展示（direct）
- [ ] **RT-8-2** 详情页 Config 表格只读展示（data-view）
- [ ] **RT-8-3** 验收：详情与 edit 数据一致

### RT-9 文档与总验收（0.5d）

- [ ] **RT-9-1** 更新 `migration-matrix.md` 关系类 create/edit/mapping 为「视觉完成」
- [ ] **RT-9-2** 更新 `gap-report.md` 清除关系类占位描述
- [ ] **RT-9-3** 更新 `tasks.md` V3-2 勾选状态
- [ ] **RT-9-4** `pnpm lint` + `tsc -b` + 手工走查三条验收路径

---

## 7. 验收路径

```
# 直接映射 — 新建
/knowledge-network/workspace/kn-domain-risk/relation-types/create
  → Step 1 填基础信息 → Step 2 选 direct → 配置对象+属性 → 保存

# 直接映射 — 编辑回填
/knowledge-network/workspace/kn-domain-risk/relation-types/{id}/edit
  → 两步数据正确 → 修改映射 → 保存

# 视图映射 — 新建（RT-4 完成后）
同上，选择 data-view，选数据视图，配置三列映射

# 独立映射页
/knowledge-network/workspace/kn-domain-risk/relation-types/{id}/mapping
  → 修改 → 保存 → detail/edit 一致
```

---

## 8. 推荐实施波次

| 波次 | 任务 | 产出 |
| --- | --- | --- |
| **Wave A** | RT-1 + RT-2 + RT-3 | 直接映射主链路可用，预览区上线 |
| **Wave B** | RT-7（direct 部分）+ RT-5 + RT-6 | create/edit/mapping 保存闭环 |
| **Wave C** | RT-4 + RT-7（data-view 部分） | 视图映射完整 |
| **Wave D** | RT-8 + RT-9 | 详情对齐 + 文档收口 |

---

## 9. 与主 tasks.md 的关系

本文件是 **V3-2 子规格**；`tasks.md` 中 V3-2 勾选以本文件 RT-* 任务为准。  
V3-2 列表页已完成，不在此重复。
