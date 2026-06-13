# Execution Factory E2E Test Matrix

Comprehensive end-to-end coverage for **Capability UX v2** (`capabilityUxV2=true` by default).
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

Playwright init script (`helpers/execution-unit-ui.ts`) forces `capabilityUxV2=true` and API proxy `/api` unless a spec opts into legacy via `ensureLegacyE2eRuntime`.

---

## UX v2 entry points (what tests target)

| User action | V2 UI | Legacy (flag off) |
|-------------|-------|-------------------|
| Primary tabs | 工具集 / MCP 服务 / Skill 包 | + 算子 tab in main nav |
| Create | **添加能力** wizard (contextual) | 新建工具箱 / 新建 MCP / … |
| Operator dev | `?activeTab=operator` deep link → **新建算子** | Same tab in main nav |
| Import | **导入** → OpenAPI \| **备份文件** | ADP terminology removed |
| Export | Card menu / detail **导出** (backup for impex) | unchanged API |
| Version | Operator **版本历史**; Skill **发布历史** | same |

---

## Matrix

| ID | Tab / Page | Feature path | Spec | Status |
|----|------------|--------------|------|--------|
| CAP-V2-01..09 | 执行能力管理 | V2 shell, wizard, operator deep link, import backup tab, OpenAPI IO preview | `e2e-capability-v2.spec.ts` | auto |
| QA-01..07 | 工具集 | Quick add API + publish + export + list + debug + IO preview | `e2e-quick-api.spec.ts` | auto |
| UI-toolbox/mcp/skill | 主 Tab | Tab load + 添加能力直达配置 | `e2e-ui-tabs.spec.ts` | auto |
| UI-operator-advanced | 算子开发 | Deep link + 新建算子 legacy wizard | `e2e-ui-tabs.spec.ts` | auto |
| UI-legacy-toolbox | 工具箱 | Legacy UX (`capabilityUxV2=false`) | `e2e-ui-tabs.spec.ts` | auto |
| UI-catalog | 全部执行单元 | Catalog page load | `e2e-ui-tabs.spec.ts` | auto |
| AT-01..03 | 算子开发 | List / wizard create / API publish status | `operator.at.spec.ts` | auto |
| IMPEX-UI-01..05 | 算子/工具集/MCP | UI backup import/export + roundtrip | `e2e-impex-ui.spec.ts` | auto |
| VER-UI-01..04 | 算子/Skill | Version history drawers + republish + export/import clone | `e2e-version-ui.spec.ts` | auto |
| CAT-UI-01 | 全部执行单元 | Market install (impex-backed) | `e2e-version-ui.spec.ts` | auto |
| UI-COV-* | 全模块 | List / wizard / detail drawer → detail page / routes | `e2e-ui-coverage.spec.ts` | auto |
| UI-MCP-SK-DTL | MCP / Skill | 详情页：工具 schema + 调试 / Skill 正文 + 文件预览 | `e2e-ui-coverage.spec.ts` (UI-COV-024/027/028) | auto |
| SK-05 | Skill API | 管理态 files/read 读取包内文件 | `e2e-skill.spec.ts` | auto |
| UX-003..034 | 回归 | Drawer, export, wizard, redirects | `e2e-ux-regression.spec.ts` | auto |
| OP/TB/MCP/SK/FN/VER/IMPEX/CAT | API层 | Backend flows (non-UI) | `e2e-*.spec.ts` | auto |

### IMPEX-UI (backup file = 导出产物)

| ID | Scenario |
|----|----------|
| IMPEX-UI-01 | Operator backup **新建** import via UI |
| IMPEX-UI-02 | Operator export from card menu |
| IMPEX-UI-03 | Toolbox export from card menu |
| IMPEX-UI-04 | MCP export from card menu |
| IMPEX-UI-05 | Published toolbox export → UI import clone |

### VER-UI (version + impex)

| ID | Scenario |
|----|----------|
| VER-UI-01 | Operator publish → **版本历史** drawer |
| VER-UI-02 | Skill publish → **发布历史** drawer |
| VER-UI-03 | Operator republish → ≥2 history entries (API + UI) |
| VER-UI-04 | Published operator export + UI import clone |
| CAT-UI-01 | Catalog introduce/sync uses impex export+import |

---

## Helpers (`helpers/execution-unit-ui.ts`)

| Helper | Purpose |
|--------|---------|
| `ensureE2eRuntime` / `gotoE2ePage` | V2 flag + API proxy |
| `gotoUnitsTab` / `openAdvancedOperatorTab` | Tab navigation (operator via `?activeTab=operator`) |
| `openAddCapabilityWizard` | **添加能力** on toolbox/mcp/skill |
| `openCreateWizard` | **新建算子** legacy wizard on operator tab |
| `fillAndSubmitQuickAddApi` | cURL quick-add with category wait + IO preview assert |
| `expectOpenApiOperationsIoPreview` | Collapse IO preview after OpenAPI paste |
| `openImportModal` / `openImportOpenApiPanel` / `importBackupFileViaUi` | **导入** → OpenAPI \| 备份文件 |
| `debugToolFromToolsPage` | IO panel or list-item **调试** + run debug |
| `exportFromCardMenu` | Card **导出** + toast |
| `openOperatorVersionHistoryDrawer` | Version history from detail |
| `openSkillReleaseHistoryDrawer` | Skill release history |

---

## Manual-only / deferred

| Feature | Reason |
|---------|--------|
| Flow 编排算子 | Backend/UI stub |
| MCP SSE custom server | External MCP at `:8080/sse` |
| ef-log-bridge | `:8095` — Docker logs for RW-01 |
| ef-mcp-mock | `:8096/sse` — local MCP for RW-06 |

### Realworld scenarios (`e2e-realworld*.spec.ts`)

| ID | Feature | Spec | Status |
|----|---------|------|--------|
| P0-CLEAN | Bulk delete `at_e2e_*` assets | `e2e-cleanup.spec.ts` | New |
| RW-01..08 | API realworld flows (+ RW-08 openapi bundle) | `e2e-realworld.spec.ts` | Done |
| RW-UI-01..08 | UI realworld flows (+ RW-UI-08 operator sync bundle) | `e2e-realworld-ui.spec.ts` | Done |
| RW-X-01..02 | Lifecycle edit/publish/debug | `e2e-realworld.spec.ts` | New |

```bash
npm run test:realworld      # cleanup + API + UI
npm run test:realworld:api
npm run cleanup:e2e
```
| Skill backup impex UI | Import is zip/content wizard only |
