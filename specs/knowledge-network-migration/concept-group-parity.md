# 概念分组 Vega 对齐（V3-4）

对照：`D:\kowell\kowell-dip\web\apps\vega\src\pages\ConceptGroup`

## CG-1 详情页

- [x] 摘要卡：名称、描述、标签、ID、修改者、更新时间
- [x] 「分组详情」区块 + 对象/关系/行动 Tab
- [x] 各 Tab 独立搜索 + 标签筛选 + 分页

## CG-2 成员列

- [x] 对象 Tab：名称（含图标）、标签
- [x] 关系 Tab：名称、源对象类、目标对象类、标签
- [x] 行动 Tab：名称、行动类型、绑定对象类、标签

## CG-3 对象类成员管理

- [x] 添加对象类弹窗（搜索、分页、跨页多选、已选列表）
- [x] 批量移除对象类
- [x] Mock：`conceptGroupIds` 持久化 + `syncMockConceptGroups`

## CG-4 导入

- [x] Mock 导入冲突检测（ID/名称）+ overwrite/ignore
- [x] `JsonResourceImportButton` 识别 `KnowledgeNetworkImportConflictError`

## 验收路径

```
/knowledge-network/workspace/kn-domain-risk/concept-groups/cg-risk-core/detail
```
