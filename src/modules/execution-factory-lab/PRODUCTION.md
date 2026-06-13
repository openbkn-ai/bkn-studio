# 执行工厂（实验版）→ 生产化路线图

## 当前基线（Phase 1–3 ✅）

- 统一能力列表（HTTP / MCP / Skill）、分页与筛选
- HTTP 创建（cURL）、OpenAPI 批量导入
- 详情 Tab：概览 / 调试 / 版本 / 编排
- 发布、分组发布、事后启用编排
- 10 条 E2E 冒烟

---

## Phase A — 能力全生命周期（✅）

**目标**：在「能力优先」架构下补齐 CRUD，仍不碰旧版 `execution-factory` 代码。

| PR | 范围 | 状态 |
|----|------|------|
| **A1–A5** | 删除/更新 HTTP、MCP/Skill 注册与发布、前端抽屉与详情、E2E LAB-API-10..12 | ✅ |

---

## Phase B — 可上线架构（✅）

| PR | 内容 | 状态 |
|----|------|------|
| B1 | 列表按 kind 后端分页 | ✅ |
| B2 | 编排 `source_id` 血缘 | ✅ |
| B3 | 权限 + PermissionGate | ✅ |
| B4 | BFF 中间件与统一错误码 | ✅ |
| B5 | 部署清单 `DEPLOY-LAB.md` | ✅ |

---

## Phase C — 企业级能力（✅）

| PR | 内容 | 状态 |
|----|------|------|
| C1 | IMPEX 导入导出（.adp） | ✅ |
| C2 | 执行单元目录 / 市场安装 | ✅ |
| C3 | 函数型能力与 Python 调试 | ✅ |
| C4 | Skill 文件树 / MCP SSE 向导 | ✅ |
| C5 | Feature flag 灰度 / 可观测性 | ✅ |

---

## Phase D — 能力差距补齐（✅）

| PR | 内容 | 状态 |
|----|------|------|
| D1 | zh-CN 文案、发布状态筛选、`GET /categories` | ✅ |
| D2 | MCP 元数据更新、`GET .../mcp/tools` | ✅ |
| D3 | Skill 元数据/换包/下载/content 导入 | ✅ |
| D4 | HTTP OpenAPI / Function 深度编辑 | ✅ |
| D5 | Catalog upsert 安装模式 | ✅ |
| D6 | Skill 导出（package JSON） | ✅ |
| D7 | E2E LAB-API-23..34（35/35 全绿） | ✅ |

---

## Phase E — 心路修复（Iteration 4，✅ 前端已完成）

> 详细条目见 [REPAIR-PLAN.md](./REPAIR-PLAN.md)。

| 子阶段 | 优先级 | 主题 | 关键项 |
|--------|--------|------|--------|
| **E4-1** | P0 | 敢保存敢发布 | 权限反馈一致、状态 i18n、编辑数据完整、OpenAPI 批量结果、危险操作确认 |
| **E4-2** | P1 | 知道下一步 | StatusStepper、创建后跳调试、筛选/Tab 说明、MCP 向导、导入入口统一 |
| **E4-3** | P2 | 信任实验版 | 双轨说明、侧栏 Lab 标识、筛选全量记忆、骨架屏、市场溯源 |
| **E4-4** | P3 | 团队管得住 | 细分创建/编辑权限、列表 view 门禁、BFF RBAC（可选） |

**建议首 PR**：E4-1a（R1.1 + R1.2 + R1.5），用户感知最强、改动面可控。

---

## 迁移策略

1. **双轨运行**：`execution-factory-lab` 与 `execution-factory` 并存，实验 badge 保留至 Phase B 结束。
2. **数据零迁移**：BFF 仅代理 OI，底层仍为 toolbox / mcp / skill。
3. **切换条件**：Phase A E2E 全绿 + Phase B 权限/分页上线 + 产品 sign-off → 菜单替换与 lab 目录 rename。
