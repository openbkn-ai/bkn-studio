# 模型资源模块迁移需求规格（spec）

## 1. 背景与目标

将 legacy 微前端 `kowell-dip/web/apps/model-manager` 中**模型资源**相关的四个页面迁移到 `bkn-studio` 的 `model-resources` 模块，挂载于壳层左侧菜单「模型资源」下，保持用户可见能力与主流程不丢失，实现层按 `bkn-studio` 模块规范重建。

**Legacy 源码根目录：** `D:\kowell\kowell-dip\web\apps\model-manager\src`

**目标项目模块：** `D:\openbkn\bkn-studio\src\modules\model-resources`

**不在本次范围：**

- 提示词（`pages/Prompt`）
- `plugins/ModelUsage` 插件页
- Legacy 中已注释/未接线的 `StatisticDrawer`（行内统计抽屉，当前 UI 无法打开）

---

## 2. 目标路由与菜单映射

| 菜单（中文） | Nav `key` | 目标路由 | Legacy 路由 |
|-------------|-----------|----------|-------------|
| 模型管理 | `model-resource-management` | `/model-resources/models` | `/mf-model-manager/model/list2` |
| 配额管理 | `quota-management` | `/model-resources/quotas` | `/mf-model-manager/model/quota` |
| 默认模型 | `default-model` | `/model-resources/default-model` | `/mf-model-manager/model/default` |
| 模型统计 | `model-statistics` | `/model-resources/statistics` | `/mf-model-manager/model/statistics` |

> 注意：系统管理下已有占位项 `model-management`，与「模型资源 → 模型管理」的 `model-resource-management` 为不同菜单项，迁移时不得混用 key 或路由。

---

## 3. 页面与能力清单

### 3.1 模型管理（ModelManagement）

**页面结构：** 页标题 + Tabs（大模型 / 小模型）

**大模型：** 名称/类型筛选、排序、分页、多选批量删除；列含模型信息、文档、上下文、参数量、审计字段；非 admin 展示 quota 列。行操作：查看/编辑/删除/测试/监控/API 指南。新建编辑弹窗含完整 LLM 配置字段，保存前须测试通过；admin 可见 quota 开关。

**小模型：** embedding/reranker 列表与 CRUD；adapter 开关 + Monaco Python 代码；权限门控新建/编辑/删除；授权管理（PermConfig）。API 指南抽屉。

### 3.2 配额管理（ModelQuota）

主表：名称/API 模型筛选、排序、分页。行操作：**限额设置**（LimitModal：计费类型、tokens、单价、预估金额）、**分配用户额度**（UserQuotaModal：用户搜索、分配、超额校验、批量保存）。

### 3.3 默认模型（ModelDefault）

标题+副标题+表格；搜索、分页、排序；非默认行可「设置为默认」，当前默认行显示勾选标识。

### 3.4 模型统计（ModelStatistics）

模型+日期筛选；Summary 四 KPI + Token 趋势；耗时双线图；速率与 QPS 双图。默认筛选昨天至今天。

---

## 4. 后端依赖映射

**主服务：** `/api/mf-model-manager/v1`

| 能力 | 路径 | 页面 |
|------|------|------|
| 大模型 CRUD/测试/默认 | `/llm/*` | 模型管理、默认模型 |
| 小模型 CRUD/测试 | `/small-model/*` | 模型管理 |
| 监控/统计 | `/llm/monitor/list`, `/llm/monitor/overview` | 监控抽屉、统计 |
| 配额 | `/model-quota/*`, `/user-quota/*` | 配额管理 |

**跨服务：** `/api/authorization/v1/resource-operation`、用户管理、应用账号 API（配额分配）。

**bkn-studio 现状：** 无 model-manager 客户端，需新建 service 层。

---

## 5. 无损失边界与可协商降级

**Must Keep：** 四菜单可达、双 Tab 模型管理、配额双弹窗、默认设置、统计四块图表、保存前测试、配额校验。

**可协商：** StatisticDrawer、PermConfig 二期、legacy 弱 loading 在迁移中改进。

---

## 6. 验收清单

- [ ] 四二级菜单可跳转，menuKey 高亮正确
- [ ] 模型管理双 Tab 全流程
- [ ] 配额限额+用户分配闭环
- [ ] 默认模型设置
- [ ] 统计筛选与图表
- [ ] Mock 可本地开发
- [ ] 中英文 locale
