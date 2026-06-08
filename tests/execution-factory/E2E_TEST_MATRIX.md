# Execution Factory E2E Test Matrix

Comprehensive end-to-end coverage for `/execution-factory` tabs and creation paths.
Automated specs live in `tests/e2e/specs/execution-factory/`.

## Prerequisites

- `ef-studio` on `:5173` with `VITE_USE_MOCK=false`
- `agent-operator-integration` on `:9000`
- `sandbox-control-plane` on `:8000` (function execute / AI generate)
- `ef-mf-model-mock` on `:9898` (AI generate)

```powershell
cd execution-factory-dev
docker compose up -d
docker compose -f docker-compose.sandbox.yml up -d
```

## Run

```bash
cd bkn-studio/bkn-studio/tests/e2e
npm install
npm run install:browsers
npm run test:full
```

From repo root: `corepack pnpm test:execution-factory:e2e:full`

---

## Matrix

| ID | Tab / Page | Feature path | Spec | Status |
|----|------------|--------------|------|--------|
| UI-operator | 算子 | Tab load + 新建算子 overlay | `e2e-ui-tabs.spec.ts` | auto |
| UI-toolbox | 工具箱 | Tab load + 新建工具箱 overlay | `e2e-ui-tabs.spec.ts` | auto |
| UI-mcp | MCP | Tab load + 新建 MCP drawer | `e2e-ui-tabs.spec.ts` | auto |
| UI-skill | Skill | Tab load + 导入 Skill modal | `e2e-ui-tabs.spec.ts` | auto |
| UI-catalog | 全部执行单元 | Catalog page load | `e2e-ui-tabs.spec.ts` | auto |
| UI-operator-form | 注册算子 | Function metadata form + definition sections | `e2e-ui-tabs.spec.ts` | auto |
| UI-operator-wizard | 注册算子 | Create wizard step 1 type selection | `e2e-ui-tabs.spec.ts` | auto |
| AT-01..03 | 算子 | UI list / wizard create / API publish | `operator.at.spec.ts` | auto |
| OP-01 | 算子 | OpenAPI register (API) | `e2e-operator.spec.ts` | auto |
| OP-02 | 算子 | Function register + sandbox execute | `e2e-operator.spec.ts` | auto |
| OP-03 | 算子 | Publish + market verify | `e2e-operator.spec.ts` | auto |
| OP-04 | 算子 | ADP impex export/import copy | `e2e-operator.spec.ts` | auto |
| OP-05 | 算子 | Debug OpenAPI operator | `e2e-operator.spec.ts` | auto |
| OP-UI | 算子 | UI OpenAPI wizard create | `operator.at.spec.ts` AT-02 | auto |
| TB-01 | 工具箱 | Create toolbox (OpenAPI JSON) | `e2e-toolbox.spec.ts` | auto |
| TB-02 | 工具箱 | Add tool to toolbox | `e2e-toolbox.spec.ts` | auto |
| TB-03 | 工具箱 | Publish + market verify | `e2e-toolbox.spec.ts` | auto |
| TB-04 | 工具箱 | ADP impex export/import | `e2e-toolbox.spec.ts` | auto |
| TB-05 | 工具箱 | Batch OpenAPI tool import | `e2e-toolbox.spec.ts` | auto |
| TB-UI | 工具箱 | Tools page export + function tool create drawer | `e2e-ux-regression.spec.ts` UX-026/027 | auto |
| MCP-01 | MCP | tool_imported create | `e2e-mcp.spec.ts` | auto |
| MCP-02 | MCP | Publish + market | `e2e-mcp.spec.ts` | auto |
| MCP-03 | MCP | ADP impex export/import | `e2e-mcp.spec.ts` | auto |
| MCP-SSE | MCP | Custom SSE + parse/sse | manual (needs MCP server) | deferred |
| SK-01 | Skill | SKILL.md upload | `e2e-skill.spec.ts` | auto |
| SK-02 | Skill | Content preview API | `e2e-skill.spec.ts` | auto |
| SK-03 | Skill | Publish + market | `e2e-skill.spec.ts` | auto |
| SK-04 | Skill | Zip package upload | `e2e-skill.spec.ts` | auto |
| FN-01 | 函数 | Sandbox execute | `e2e-function.spec.ts` | auto |
| FN-02 | 函数 | Python template | `e2e-function.spec.ts` | auto |
| FN-03 | 函数 | AI prompt fetch | `e2e-function.spec.ts` | auto |
| FN-04 | 函数 | AI code generate | `e2e-function.spec.ts` | auto |
| CAT-01 | 全部执行单元 | Install via impex copy | `e2e-catalog.spec.ts` | auto |
| CAT-02 | 全部执行单元 | Catalog UI lists published item | `e2e-catalog.spec.ts` | auto |
| CAT-03 | 全部执行单元 | Catalog install via impex create | `e2e-catalog.spec.ts` | auto |
| CAT-UI-01 | 全部执行单元 | Catalog install from market UI | `e2e-version-ui.spec.ts` | auto |
| IMPEX-01 | 算子 | ADP import create mode | `e2e-impex.spec.ts` | auto |
| IMPEX-02 | 算子 | ADP import upsert mode | `e2e-impex.spec.ts` | auto |
| IMPEX-03 | 工具箱 | ADP import create mode | `e2e-impex.spec.ts` | auto |
| IMPEX-04 | MCP | ADP import create mode | `e2e-impex.spec.ts` | auto |
| IMPEX-UI-01 | 算子 | UI ADP import | `e2e-impex-ui.spec.ts` | auto |
| IMPEX-UI-02 | 算子 | UI ADP export download | `e2e-impex-ui.spec.ts` | auto |
| IMPEX-UI-03 | 工具箱 | UI ADP export from card menu | `e2e-impex-ui.spec.ts` | auto |
| VER-01 | 算子 | Publish creates version history | `e2e-version.spec.ts` | auto |
| VER-02 | 算子 | Edit + republish adds history | `e2e-version.spec.ts` | auto |
| VER-03 | 算子 | Unpublish / offline status | `e2e-version.spec.ts` | auto |
| VER-04 | 工具箱/MCP | Publish / unpublish / offline | `e2e-version.spec.ts` | auto |
| VER-05 | Skill | Publish history + republish draft | `e2e-version.spec.ts` | auto |
| VER-UI-01 | 算子 | Version history drawer | `e2e-version-ui.spec.ts` | auto |
| VER-UI-02 | Skill | Release history drawer | `e2e-version-ui.spec.ts` | auto |
| UX-003 | 算子 | Card opens detail drawer | `e2e-ux-regression.spec.ts` | auto |
| UX-017 | 算子 | Wizard 函数选择 → 注册表单 | `e2e-ux-regression.spec.ts` | auto |
| UX-018 | 算子 | Function form inputs/logic/outputs order | `e2e-ux-regression.spec.ts` | auto |
| UX-019 | 算子 | Wizard OpenAPI 选择 → 注册表单 | `e2e-ux-regression.spec.ts` | auto |
| UX-021 | Skill | Catalog introduce action | `e2e-ux-regression.spec.ts` | auto |
| UX-024 | 工具箱 | Drawer inline edit (no navigate away) | `e2e-ux-regression.spec.ts` | auto |
| UX-025 | 工具箱 | Drawer export ADP download | `e2e-ux-regression.spec.ts` | auto |
| UX-026 | 工具箱 | Tools page header export | `e2e-ux-regression.spec.ts` | auto |
| UX-027 | 工具箱 | Function toolbox tool create fields | `e2e-ux-regression.spec.ts` | auto |
| UX-028 | 创建向导 | Step 2 content per tab | `e2e-ux-regression.spec.ts` | auto |
| UX-034 | 路由 | Legacy create deep link redirect | `e2e-ux-regression.spec.ts` | auto |
| UI-COV-* | 全模块 | 列表/向导/详情/菜单/路由全面 UI 覆盖 | `e2e-ui-coverage.spec.ts` | auto |

### UI-COV 覆盖范围（`e2e-ui-coverage.spec.ts`）

| ID | 区域 | 覆盖点 |
|----|------|--------|
| UI-COV-001..005 | 列表壳层 | pageIntro、toolbarHint、分类/状态筛选、搜索 |
| UI-COV-010..014 | 创建向导 | 类型切换、无编排入口、函数算子 UI 创建、表单锚点、OpenAPI 三来源、导入弹窗 |
| UI-COV-020..027 | 卡片/详情 | 四类资源详情 Drawer、算子编辑/调试/发布、MCP/Skill 菜单 |
| UI-COV-030a..c | 路由迁移 | toolboxes/new、mcp/new、mcp 旧入口 |
| UI-COV-031 | 工具页 | 面包屑层级 |
| UI-COV-040..041 | 端到端 | OpenAPI/工具箱完整新建路径 |

---

## UX checklist mapping

See `specs/execution-factory/ux-optimization-checklist.md` for UX-001..UX-036 scope. Automated guard cases:

| UX ID | Spec |
|-------|------|
| UX-003 | `e2e-ux-regression.spec.ts` |
| UX-017..019 | `e2e-ux-regression.spec.ts` |
| UX-021 | `e2e-ux-regression.spec.ts` |
| UX-024..028 | `e2e-ux-regression.spec.ts` |
| UX-034 | `e2e-ux-regression.spec.ts` |
| UX-036 | matrix + `e2e-ui-tabs.spec.ts` + `e2e-ux-regression.spec.ts` |

---

## Manual-only / deferred

| Feature | Reason |
|---------|--------|
| Flow 编排算子 | Backend/UI stub ("coming soon") |
| MCP SSE custom server | Requires external MCP at `:8080/sse` |
| Post-publish permission modal | Stub implementation |
| Toolbox OpenAPI file upload UI | Covered by API path TB-01/TB-02/TB-05 |

---

## Helpers

| File | Purpose |
|------|---------|
| `helpers/common.ts` | API base URL, headers, backend health |
| `helpers/operator.ts` | Operator CRUD, impex, debug |
| `helpers/execution-unit-ui.ts` | Wizard steps, cards, function form assertions |
| `helpers/toolbox.ts` | Toolbox + tool CRUD, impex |
| `helpers/mcp.ts` | MCP tool_imported flows |
| `helpers/skill.ts` | Skill upload, publish |
| `helpers/impex.ts` | ADP clone/create payloads for impex |
| `helpers/function.ts` | Sandbox execute, AI generate |
