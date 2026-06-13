# Execution Factory UI Parity Checklist

Reference: [kweaver-dip operator-web](https://github.com/kweaver-ai/kweaver-dip/tree/main/web/apps/operator-web)  
Target: `bkn-studio/src/modules/execution-factory`  
Backend: `bkn-foundry/adp/execution-factory/operator-integration`

**Legend:** `[x]` aligned · `[ ]` gap · `[~]` partial / stub

---

## Navigation & Shell

| ID | Item | Ref | Local | Status |
|----|------|-----|-------|--------|
| EF-NAV-001 | 执行单元管理 single entry (tabs inside) | OperatorList | `/execution-factory/units` | [x] |
| EF-NAV-002 | 全部执行单元 catalog | PluginMarket | `/execution-factory/catalog` | [x] |
| EF-NAV-003 | No standalone MCP/Skill sidebar | — | removed | [x] |
| EF-NAV-004 | Legacy `/mcp` `/skills` redirect to units tab | — | ExecutionUnitTabRedirect | [x] |

---

## List Scene (OperatorList / PluginMarket)

| ID | Item | Ref | Local | Status |
|----|------|-----|-------|--------|
| EF-LST-001 | Tabs: 工具集 / MCP 服务 / Skill 包 (+ 算子开发入口) | ✓ | ExecutionUnitListScene | [x] |
| EF-LST-002 | Category chip filter (all resource tabs) | ✓ | category.service | [x] |
| EF-LST-003 | Publish status filter (mgmt mode) | ✓ | Select | [x] |
| EF-LST-004 | Keyword search + reload | ✓ | usePageState | [x] |
| EF-LST-005 | Infinite scroll (page_size=20) | ✓ | IntersectionObserver | [x] |
| EF-LST-006 | Card grid + metadata badges | ✓ | ExecutionUnitCard | [x] |
| EF-LST-007 | CreateMenu primary + import | ✓ | CreateMenu | [x] |
| EF-LST-008 | Catalog Install button | ✓ | InstallFromCatalogModal | [x] |

---

## Card Menu Actions

| ID | Tab | Action | API | Status |
|----|-----|--------|-----|--------|
| EF-MNU-001 | operator | 编辑 | navigate edit | [x] |
| EF-MNU-002 | operator | 查看 | detail drawer | [x] |
| EF-MNU-003 | operator | 导出 | `GET /impex/export/operator/{id}` | [x] |
| EF-MNU-004 | operator | 发布/取消/下线/删除 | status + delete APIs | [x] |
| EF-MNU-005 | toolbox | 编辑 (metadata) | toolbox form PUT | [x] |
| EF-MNU-006 | toolbox | 导出 | `GET /impex/export/toolbox/{id}` | [x] |
| EF-MNU-007 | toolbox | Card click → tools | tools scene | [x] |
| EF-MNU-008 | mcp | 查看 | McpDetailDrawer | [x] |
| EF-MNU-009 | mcp | 编辑 | `PUT /mcp/{id}` | [x] |
| EF-MNU-010 | mcp | 导出 | `GET /impex/export/mcp/{id}` | [x] |
| EF-MNU-011 | skill | 查看 | SkillDetailDrawer | [x] |
| EF-MNU-012 | skill | 编辑 (metadata) | skill edit route | [x] |
| EF-MNU-013 | skill | 下载 | `GET /skills/{id}/management/download` | [x] |
| EF-MNU-014 | skill | 更新包 | `PUT /skills/{id}/package` | [x] |
| EF-MNU-015 | all | Post-publish 授权 | componentsPermConfig | [~] 暂不实现 |
| EF-MNU-016 | all | Per-action dynamic auth | postResourceOperation | [~] 暂不实现 |

---

## Create / Import Flows

| ID | Flow | Status |
|----|------|--------|
| EF-CRT-001 | Create operator modal | [x] |
| EF-CRT-002 | Create toolbox modal → tools | [x] |
| EF-CRT-003 | Create MCP drawer (custom + tool_imported) | [x] |
| EF-CRT-004 | Import skill zip / skill.md | [x] |
| EF-CRT-005 | ImportResourceModal (operator/toolbox/mcp impex) | [x] |
| EF-CRT-006 | OpenAPI toolbox import distinct UX | [x] |
| EF-CRT-007 | Import failure detail + template download | [x] |
| EF-CRT-008 | Unified category on create (toolbox/mcp/skill/quick-api/import) | ✓ | CapabilityCategoryFields | [x] |

---

## Detail / Edit Scenes

| ID | Scene | Ref | Status |
|----|-------|-----|--------|
| EF-DTL-001 | Operator flow IDE / 编排 | OperatorFlowPanel | [~] 暂不实现 |
| EF-DTL-002 | Operator run / logs | OperatorHistoryDrawer + debug | [x] |
| EF-DTL-003 | Toolbox tools batch enable/disable/delete | ToolboxToolsScene | [x] |
| EF-DTL-004 | Tool detail IDE route | ToolDetailScene | [x] |
| EF-DTL-005 | MCP detail + proxy debug | McpDetailDrawer headers | [x] |
| EF-DTL-006 | Skill edit metadata | SkillFormScene | [x] |
| EF-DTL-007 | Skill history drawer | SkillHistoryDrawer | [x] |

---

## API Coverage (frontend services)

| ID | Service | Missing / partial |
|----|---------|-------------------|
| EF-API-001 | impex.service | blob file download helper | [x] |
| EF-API-002 | mcp.service | `updateMcp`, `getMcpDetail` | [x] |
| EF-API-003 | skill.service | `downloadSkillPackage` | [x] |
| EF-API-004 | operator.service | flow/run APIs | P1 |
| EF-API-005 | permission | real perm config API | P2 |

---

## Sprint: P0 补齐 (this iteration)

- [x] **EF-MNU-003/006/010** Card export → `downloadComponentExport`
- [x] **EF-MNU-009** MCP edit drawer → `updateMcp` + `getMcpDetail`
- [x] **EF-MNU-013/014** Skill download + update package modal
- [x] **EF-MNU-005** Toolbox card menu edit → metadata form route

## Sprint: IDE depth (IO / execute control / logs)

- [x] **EF-IDE-001** Operator `operator_execute_control` form + API wiring
- [x] **EF-IDE-002** Tool IO panel from `metadata.api_spec` (ToolboxToolsScene + ToolDetailScene)
- [x] **EF-IDE-003** Function operator/tool inputs & outputs editor
- [x] **EF-IDE-004** Tool `global_parameters` edit + API wiring
- [x] **EF-IDE-005** Run/log panel: version history + session debug logs

---

## Verification

```bash
cd bkn-studio/bkn-studio
corepack pnpm test:execution-factory
```

Manual: `/execution-factory/units` — each tab card menu export/edit/download; MCP edit saves via PUT.
