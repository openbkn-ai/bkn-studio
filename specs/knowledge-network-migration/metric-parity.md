# 指标 Vega 对齐（V3-5）

对照：`D:\kowell\kowell-dip\web\apps\vega\src\pages\Metric`

## M-0 列表

- [x] 列：名称、操作、指标类型、作用域、标签、修改者、更新时间（无作用域引用列）
- [x] 工具栏：搜索、标签筛选、排序、刷新、新建/删除
- [x] 行菜单：查看 / 编辑 / 删除

## M-1 创建/编辑

- [x] 基础信息：名称、作用域、单位类型/单位、标签、描述
- [x] 计算公式：聚合属性/方式、分组、排序、Having
- [x] 时间维度 + 分析维度
- [x] 原子指标（与 Vega 一致，derived/composite 暂禁）

## M-2 详情

- [x] 摘要卡 + 指标信息 Tab（公式字段只读展示）
- [x] 数据查询 Tab（内嵌查询面板）

## M-3 数据查询

- [x] 模式：即时值 / 趋势 / 占比
- [x] 时间范围、结果上限、填充空值
- [x] 简易条形图 + 表格结果

## M-4 服务与 Mock

- [x] `calculation_formula` 完整读写
- [x] Mock 样例 `metric-risk-hit-rate` 含公式
- [x] `metricsTotal` 统计同步

## 验收路径

```
/knowledge-network/workspace/kn-domain-risk/metrics/metric-risk-hit-rate/detail
/knowledge-network/workspace/kn-domain-risk/metrics/create
```
