# Execution Factory 实战能力 — 待实现需求清单

> 对应执行计划：[REAL_WORLD_SCENARIO_PLAN.md](./REAL_WORLD_SCENARIO_PLAN.md)
> 状态图例：⬜ 待实现 · 🟡 进行中 · ✅ 已完成

---

## Phase 0 — 测试数据清理（P0）

| ID | 状态 | 缺失能力 | 功能需求（验收标准） |
|----|------|----------|----------------------|
| P0-1 | ✅ | PowerShell 批量清理脚本 | `scripts/cleanup-e2e-assets.ps1` 分页列出并删除匹配 `at_e2e_*` / `e2e_*` / `demo_*` / `quick_api_*` 的算子、工具箱、MCP、Skill；支持 `-DryRun` |
| P0-2 | ✅ | Playwright/Node 可复用清理 | `helpers/cleanup-all.ts` 提供 `cleanupAllE2eAssets()`，E2E `beforeAll` 与 CLI `npm run cleanup:e2e` 共用；支持 `dryRun` |
| P0-CLEAN | ✅ | 清理 E2E 用例 | `P0-CLEAN` spec 验证清理后列表无测试前缀资源（或仅剩内置资源） |

---

## 基础设施（INFRA）

| ID | 状态 | 缺失能力 | 功能需求（验收标准） |
|----|------|----------|----------------------|
| INFRA-1 | ✅ | Docker 日志桥接 | `ef-log-bridge:8095` 暴露 `GET /health`、`GET /logs/{container}?tail=&level=`；白名单容器可读；挂载 `docker.sock` |
| INFRA-2 | ✅ | 本地 MCP Mock | `ef-mcp-mock:8096` SSE 端点 `/sse`；工具 `echo`、`get_time`；operator-integration 容器内可通过 `http://ef-mcp-mock:8096/sse` 注册 |
| INFRA-3 | ✅ | uapis 离线代理 | `ef-oss-mock` 增加 `GET /proxy/uapis/weather` 返回固定天气 JSON，供 CI 无网环境 RW-03 |

---

## 实战场景 API（RW-01..07）

| ID | 状态 | 缺失能力 | 功能需求（验收标准） |
|----|------|----------|----------------------|
| RW-01 | ✅ | Docker 错误日志工具 | 通过 OpenAPI/cURL 创建工具 → `debug` 返回日志行且 `count ≥ 1`；依赖 `ef-log-bridge` |
| RW-02 | ✅ | ADP 导出再导入 | 发布工具箱 → 导出 → clone 导入 → 克隆工具箱首个工具 `debug` 成功（status 2xx） |
| RW-03 | ✅ | 公网/离线天气 API | 在线：`E2E_ALLOW_NETWORK=1` 时 uapis 调试含 `city`/`weather`；离线：oss-mock 代理路径调试成功 |
| RW-04 | ✅ | OpenAPI 3.0 批量导入 | 使用 `fixtures/uapis-weather-mini.json` 批量导入 ≥1 工具；抽样 `debug` 通过 |
| RW-05 | ✅ | 高德 MCP | `E2E_AMAP_MCP_SSE_URL` 配置时：parse SSE → 注册 → 首个工具 proxy 调试；CI 默认 skip |
| RW-06 | ✅ | 本地 MCP 注册 | parse `ef-mcp-mock` → 注册 SSE MCP → `echo` 工具 debug 返回输入消息 |
| RW-07 | ✅ | Skill zip 全链路 | zip 注册 → 读 `SKILL.md`/`refs/guide.md` → 更新包 → 发布 → history ≥1 |

---

## 实战场景 UI（RW-UI-01..07）

| ID | 状态 | 缺失能力 | 功能需求（验收标准） |
|----|------|----------|----------------------|
| RW-UI-01 | ✅ | Quick-add 日志工具 | 向导创建 log-bridge 工具 → 工具页调试 modal 成功 |
| RW-UI-02 | ✅ | 备份导入 + 调试 | IMPEX-UI-05 扩展：导入克隆后 `debugToolFromToolsPage` 断言通过 |
| RW-UI-03 | ✅ | 公网 curl UI | 离线：Quick-add oss-mock 天气 + debug；在线：`E2E_ALLOW_NETWORK=1` 时 uapis |
| RW-UI-04 | ✅ | OpenAPI 粘贴提交 | 导入 OpenAPI 粘贴 fixture → IO 预览 → **开始导入** → 列表可见工具 |
| RW-UI-05 | ✅ | 高德 MCP UI | SSE 注册向导 → 详情 proxy 调试（需 `E2E_AMAP_MCP_SSE_URL`） |
| RW-UI-06 | ✅ | 本地 MCP UI | SSE 注册 → 列表可见 → 详情页 `echo` 调试 |
| RW-UI-07 | ✅ | Skill 上传/预览/更新 | 详情预览文件 + 卡片菜单更新包 |

---

## OpenAPI 能力包（中期合并管理）

| ID | 状态 | 能力 | 功能需求（验收标准） |
|----|------|------|----------------------|
| BUNDLE-01 | ✅ | 后端 `POST /capabilities/openapi-bundle` | 算子注册 → 发布 → `convert` 工具；返回 `links[]` 血缘 |
| BUNDLE-02 | ✅ | 前端同步发布走 bundle | `operatorSync.enabled` 时 Quick-add / OpenAPI 导入调用 bundle API |
| BUNDLE-03 | ✅ | E2E RW-08 / RW-UI-08 | API bundle 调试 + UI 勾选同步发布全链路 |

---

## 横切生命周期（RW-X）

| ID | 状态 | 缺失能力 | 功能需求（验收标准） |
|----|------|----------|----------------------|
| RW-X-01 | ✅ | 工具箱 edit + v2 | 编辑描述 → 发布 → history/状态为 published → 再 debug |
| RW-X-02 | ✅ | MCP edit + v2 | 编辑 MCP 描述 → 发布 → 再 debug |
| RW-X-03 | ✅ | Skill republish | 更新包 → 再发布 → `getSkillHistory` count 增加 |

---

## E2E 增强（现有 spec 缺口）

| 现有 ID | 状态 | 增强内容 |
|---------|------|----------|
| CAP-V2 OpenAPI submit | ✅ | RW-UI-04 覆盖提交落库 |
| IMPEX-UI-05 debug | ✅ | RW-UI-02 覆盖 |
| UI-COV-010 MCP 完整注册 | ✅ | RW-UI-06 覆盖 |
| VER-UI Skill republish | ✅ | RW-X-03 / RW-UI-07 覆盖 |

---

## 环境变量

| 变量 | 默认值 | 用途 |
|------|--------|------|
| `E2E_LOG_BRIDGE_URL` | `http://127.0.0.1:8095` | 宿主机探活；容器内用 `http://ef-log-bridge:8095` |
| `E2E_LOCAL_MCP_SSE_URL` | `http://127.0.0.1:8096/sse` | 宿主机探活；容器内用 `http://ef-mcp-mock:8096/sse` |
| `E2E_AMAP_MCP_SSE_URL` | （空） | 高德 MCP，勿提交密钥 |
| `E2E_ALLOW_NETWORK` | `0` | `1` 启用 RW-03/RW-05 在线用例 |

---

## 执行顺序

```
P0 清理 → INFRA 服务 → RW-01 → RW-02 → RW-04 / RW-06 → RW-03 / RW-07 → RW-05（可选）→ RW-X → E2E 全量验证
```

## 验证命令

```powershell
cd d:\workspace\openbkn\execution-factory-dev
docker compose up -d

cd d:\workspace\openbkn\bknstudio\bkn-studio\tests\e2e
npm install
npm run cleanup:e2e
npm run test:realworld
```
