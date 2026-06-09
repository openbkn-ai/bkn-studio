# 对象类新建 / 编辑 Parity 清单

参考源：`D:\kowell\kowell-dip\web\apps\vega\src\pages\ObjectCreateAndEdit\`

目标：`bkn-studio` → `ObjectTypeFormScene` + 子组件

## 文件映射

| Vega 源文件 | bkn-studio 目标 | 状态 |
| --- | --- | --- |
| `index.tsx` | `scenes/ObjectTypeFormScene.tsx` | done |
| `BasicInformation/index.tsx` | Step 1 内联 Form | done |
| `DataAttribute/index.tsx` | `ObjectTypeDataAttributeEditor.tsx` | done（React Flow 节点拖拽为已知差异） |
| `DataAttribute/AddDataAttribute/` | `ObjectTypeDataAttributeFormDrawer.tsx` | done |
| `DataAttribute/PickAttribute/` | `ObjectTypeDataAttributePickModal.tsx` | done |
| `LogicAttribute/index.tsx` | `ObjectTypeLogicAttributeEditor.tsx` | done |
| `LogicAttribute/EditDrawer/` | `ObjectTypeLogicAttributeEditDrawer.tsx` | done |

## Step 1 基础信息

- [x] 名称 / ID / 图标 / 颜色 / 标签 / 概念分组 / 描述
- [x] 表单校验与下一步

## Step 2 数据属性

- [x] info bar（主键 / 标题键 / 增量键）
- [x] 数据视图 panel + 选视图 / 更换 / 清空
- [x] 对象类属性 panel + 手动新建 / 同步字段 / 清空
- [x] 选视图自动映射、点击连线、智能匹配连线
- [x] 行 hover 主键 / 标题 / 增量 / 删除
- [x] 点击数据行打开编辑抽屉
- [x] 画布缩放 / 平移 / 连线层
- [x] Pick 弹窗（类型图标 + 右侧清空 + 左选右移）
- [x] 搜索无结果空态、非法属性名提示
- [x] `validateFields` / `getDataProperties` ref
- [ ] React Flow 节点自由拖拽（固定 panel，可接受）

## Step 3 逻辑属性

- [x] info bar + 标题提示
- [x] 搜索 / 新建 / 批量删除 / 行点击编辑
- [x] 绑定资源列 + EditDrawer（指标 / 算子 / 参数）
- [x] 与数据属性重名校验
- [x] `validateFields` ref

## 步骤编排

- [x] Step 按钮 prev/next/save 与 ref 校验
- [x] 步骤条仅可点击已完成步骤（`doneStep`）
- [x] 回退时同步 step 数据
- [x] `beforeunload` 离开提示

## Mock / 持久化

- [x] 数据视图 API mock
- [x] 指标 / 算子 API mock
- [x] 创建 / 编辑持久化 dataSource + 属性

## 保存 payload（切片 8）

- [x] `create` / `update` 发送完整 Vega 对齐 body：`data_properties`、`logic_properties`、`data_source`、`primary_keys`、`display_key`、`incremental_key`、`concept_groups`、`branch: main`
- [x] `toBackendDataProperty` 含 `comment`、`mapped_field`、`original_name`、`index_config`
- [x] `toBackendLogicProperty` 含 `data_source`、`parameters`（`value_from` 等）
- [x] `getKnowledgeNetworkObjectTypeDetail` 回读 `logic_properties`、`data_source`、`mapped_field`

## 已知可接受差异

- 画布用固定 panel + SVG 连线，非 React Flow 可拖拽节点
- 算子 OpenAPI 参数解析：mock 用 `inputParameters`；真实 API 需后续补 parser

## 验收路径

`/knowledge-network/workspace/kn-domain-risk/object-types/create`
