# 执行工厂（实验版）— 产品与实现规划

## 目标

在**不修改**现有 `execution-factory` / `operator-integration` 代码的前提下，验证「能力优先」信息架构是否更易用。

## 设计原则

| 层级 | 用户可见概念 | 技术映射（降级复用） |
|------|-------------|---------------------|
| 能力层 | HTTP / MCP / Skill（主列表） | tool / mcp / skill |
| 治理层 | 分组（侧栏筛选，默认自动） | toolbox |
| 编排层 | 「用于流程编排」开关 / 事后启用 | openapi-bundle → operator |

## 实现状态

### Phase 1 — MVP ✅

- [x] 后端 BFF：`capabilities-lab` 独立服务
  - `GET /capabilities` — HTTP 能力列表
  - `GET /capabilities/:id` — 能力详情
  - `GET /groups` — 分组列表
  - `POST /capabilities/http` — 添加 HTTP 能力（自动分组 + 可选编排同步）
- [x] 前端：扁平能力卡片 + HTTP 创建向导（无工具集步骤）
- [x] E2E：`LAB-API-01` ~ `LAB-API-03`，`LAB-UI-01`

### Phase 2 — 统一列表与详情 ✅

- [x] MCP / Skill 纳入统一扁平列表（`kind=all|http|mcp|skill`）
- [x] 能力详情 Tab：概览、调试、版本、编排血缘
- [x] HTTP / MCP 调试代理
- [x] Skill 版本列表与回滚发布
- [x] HTTP 编排算子版本历史（已启用编排时）

### Phase 3 — 发布与导入 ✅

- [x] 能力发布：`POST /capabilities/:id/publish`
- [x] 分组发布：`POST /groups/:group_id/publish`
- [x] OpenAPI 批量导入：`POST /capabilities/http/import`
- [x] 创建后启用编排：`POST /capabilities/:id/orchestration/enable`
- [x] 列表分页与类型筛选
- [x] E2E：`LAB-API-04` ~ `LAB-API-09`

### Phase A — 能力全生命周期（进行中 ✅ 核心 API）

- [x] `PATCH /capabilities/:id` — HTTP 元数据更新
- [x] `DELETE /capabilities/:id` — 删除 HTTP / MCP / Skill
- [x] `POST /capabilities/mcp` — 注册 MCP
- [x] `POST /capabilities/skill` — 导入 Skill（multipart）
- [x] MCP / Skill 发布与下线
- [x] 前端：MCP 注册、Skill 导入、详情删除/下线/HTTP 编辑
- [x] E2E：`LAB-API-10` ~ `LAB-API-12`

详见 [PRODUCTION.md](./PRODUCTION.md)。

### 不在本实验范围

- 修改旧版 `execution-factory` / `operator-integration`
- MCP / Skill **创建**向导（仅列表 + 详情只读）
- 市场 / IMPEX / 函数型工具

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/capabilities` | 统一能力列表（kind/keyword/group_id/page） |
| GET | `/capabilities/:id` | 能力详情 |
| POST | `/capabilities/http` | 创建 HTTP 能力 |
| POST | `/capabilities/http/import` | OpenAPI 批量导入 |
| POST | `/capabilities/:id/debug` | 调试 |
| GET | `/capabilities/:id/versions` | 版本历史 |
| POST | `/capabilities/:id/versions/republish` | Skill 版本回滚 |
| POST | `/capabilities/:id/publish` | 发布能力 |
| GET | `/capabilities/:id/orchestration` | 编排详情 |
| POST | `/capabilities/:id/orchestration/enable` | 事后启用编排 |
| GET | `/groups` | 分组列表 |
| POST | `/groups/:group_id/publish` | 发布分组 |

## E2E 测试矩阵

| ID | 范围 | 说明 |
|----|------|------|
| LAB-API-01 | API | health |
| LAB-API-02 | API | 自动分组创建 HTTP |
| LAB-API-03 | API | 创建时同步编排 |
| LAB-API-04 | API | kind=all 分页 |
| LAB-API-05 | API | 详情 + HTTP 调试 |
| LAB-API-06 | API | 能力与分组发布 |
| LAB-API-07 | API | 事后启用编排 |
| LAB-API-08 | API | 编排版本列表 |
| LAB-API-09 | API | OpenAPI 批量导入 |
| LAB-UI-01 | UI | 菜单导航 + 创建 HTTP |

## 目录

```
bknstudio/.../modules/execution-factory-lab/     # 前端实验模块
bknfoundry/.../execution-factory/capabilities-lab/  # 后端 BFF
execution-factory-dev/                           # docker + nginx 路由
```

## 回滚策略

实验失败时删除上述三个路径下的 lab 专用文件，并移除 app 壳层中的注册项即可。
