# Execution Factory API 映射

DIP 执行工厂前端迁移至 `bkn-studio` 时，页面效果可参考 DIP，接口语义以 openbkn `operator-integration` OpenAPI 为准。

## 服务基线

| 项 | 值 |
| --- | --- |
| 后端服务 | `agent-operator-integration` |
| Public API 前缀 | `/api/agent-operator-integration/v1` |
| OpenAPI 目录 | `bkn-foundry/adp/execution-factory/operator-integration/docs/apis/` |
| 必需请求头 | `Authorization: Bearer <token>`、`x-business-domain: <id>` |

## 菜单与页面对应

| bkn-studio 菜单 | 路由 | DIP 参考页 | openbkn API |
| --- | --- | --- | --- |
| 执行单元管理 | `/execution-factory/units` | 算子/工具箱管理主工作区 | `GET /operator/info/list`、`GET /tool-box/list` |
| 注册算子 | `/execution-factory/units/new` | 算子注册表单 | `POST /operator/register` |
| 编辑算子 | `/execution-factory/units/:operatorId/edit` | 算子编辑表单 | `POST /operator/info` |
| 注册工具箱 | `/execution-factory/toolboxes/new` | 工具箱注册表单 | `POST /tool-box` |
| 编辑工具箱 | `/execution-factory/toolboxes/:boxId/edit` | 工具箱编辑表单 | `POST /tool-box/{box_id}` |
| 全部执行单元 | `/execution-factory/catalog` | 市场/全量浏览 | `GET /operator/market`、`GET /tool-box/market` |

## 算子（Operator）

| 场景 | HTTP | 路径 |
| --- | --- | --- |
| 列表 | GET | `/operator/info/list` |
| 详情 | GET | `/operator/info/{operator_id}` |
| 注册 | POST | `/operator/register` |
| 编辑 | POST | `/operator/info` |
| 状态变更 | POST | `/operator/status` |
| 删除 | POST | `/operator/delete` |
| 调试 | POST | `/operator/debug` |
| 市场列表 | GET | `/operator/market` |
| 市场详情 | GET | `/operator/market/{operator_id}` |

## 工具箱（Toolbox）

| 场景 | HTTP | 路径 |
| --- | --- | --- |
| 列表 | GET | `/tool-box/list` |
| 详情 | GET | `/tool-box/{box_id}` |
| 创建 | POST | `/tool-box` |
| 编辑 | POST | `/tool-box/{box_id}` |
| 状态变更 | POST | `/tool-box/{box_id}/status` |
| 删除 | DELETE | `/tool-box/{box_id}` |
| 市场列表 | GET | `/tool-box/market` |
| 市场详情 | GET | `/tool-box/market/{box_id}` |

## 工具箱内工具（Tool）

| 场景 | HTTP | 路径 |
| --- | --- | --- |
| 列表 | GET | `/tool-box/{box_id}/tools/list` |
| 详情 | GET | `/tool-box/{box_id}/tool/{tool_id}` |
| 创建 | POST | `/tool-box/{box_id}/tool` |
| 编辑 | POST | `/tool-box/{box_id}/tool/{tool_id}` |
| 状态变更 | POST | `/tool-box/{box_id}/tools/status` |
| 批量删除 | POST | `/tool-box/{box_id}/tools/batch-delete` |
| 调试 | POST | `/tool-box/{box_id}/tool/{tool_id}/debug` |
| 算子转工具 | POST | `/operator/convert/tool` |

| bkn-studio 路由 | 说明 |
| --- | --- |
| `/execution-factory/toolboxes/:boxId/tools` | 工具箱内工具管理 |

## 市场安装（Impex）

| 场景 | HTTP | 路径 |
| --- | --- | --- |
| 导出 | GET | `/impex/export/{type}/{id}` |
| 导入 | POST | `/impex/import/{type}` |

`type` 支持 `operator`、`toolbox`、`mcp`；导入 `mode` 为 `create` 或 `upsert`。

## MCP

| 场景 | HTTP | 路径 |
| --- | --- | --- |
| 列表 | GET | `/mcp/list` |
| 注册 | POST | `/mcp` |
| 状态变更 | POST | `/mcp/{mcp_id}/status` |
| 删除 | DELETE | `/mcp/{mcp_id}` |
| 市场列表 | GET | `/mcp/market/list` |

| bkn-studio 路由 | 说明 |
| --- | --- |
| `/execution-factory/mcp` | MCP 管理列表 |
| `/execution-factory/mcp/new` | 注册 MCP |

## Skill

| 场景 | HTTP | 路径 |
| --- | --- | --- |
| 列表 | GET | `/skills` |
| 详情 | GET | `/skills/{skill_id}` |
| 注册 | POST | `/skills` |
| 状态变更 | PUT | `/skills/{skill_id}/status` |
| 删除 | DELETE | `/skills/{skill_id}` |
| 市场列表 | GET | `/skills/market` |
| 市场详情 | GET | `/skills/market/{skill_id}` |
| 管理态 SKILL.md / 文件清单 | GET | `/skills/{skill_id}/management/content` |
| 管理态指定文件读取 | POST | `/skills/{skill_id}/management/files/read` |
| 管理态包下载 | GET | `/skills/{skill_id}/management/download` |
| 发布历史 | GET | `/skills/{skill_id}/history` |

管理态读接口语义见 `bkn-foundry/adp/execution-factory/operator-integration/docs/product/prd/skill_content_management_read.md`。

| bkn-studio 路由 | 说明 |
| --- | --- |
| `/execution-factory/skills` | Skill 管理列表（重定向至 units?activeTab=skill） |
| `/execution-factory/skills/:skillId` | Skill 详情页：SKILL.md 正文 + 包内文件预览 |
| `/execution-factory/skills/:skillId/edit` | 编辑 Skill 元数据 / 替换包 |

### Skill 文件预览（前端）

1. `GET /skills/{skill_id}/management/content?response_mode=content` — 拉取 SKILL.md 正文与 `files[]` 清单（含 `rel_path` / `mime_type` / `size`）。
2. 用户选中包内文件后，调用 `POST /skills/{skill_id}/management/files/read?response_mode=content`，请求体 `{ "rel_path": "..." }`。
   - **文本预览（Studio 默认）**：`response_mode=content` 时后端从 OSS 下载并返回内联 `content`，`url` 为空；避免浏览器直连 Docker 内部预签名 URL。
   - **下载链接 / 二进制**：缺省 `response_mode=url` 返回 OSS 预签名 `url`；浏览器无法访问内部主机名时可经 API 网关 `/oss-workspace/` 反代（见 `execution-factory-dev/nginx/api-cors.conf`）或 Vite 代理（`vite.config.ts` 中 `VITE_OSS_PROXY_TARGET`）。
3. 文本类文件（markdown / json / yaml / py 等）展示 `content`；二进制文件展示下载链接。

对应 service：`skill.service.ts` 中 `getSkillManagementContent`、`readSkillManagementFile`、`previewSkillManagementFile`；OSS URL 重写（仅二进制下载兜底）见 `utils/skill-file-preview.ts` 中 `resolveSkillFileFetchUrl`。

后端语义扩展见 `skill_content_management_read.md` FR-3（`response_mode` 与 `GetManagementContent` 一致）。

## 不迁移的 DIP 接口

- DIP 私有 BFF 路径（若与上表 Public API 不一致）
- DIP 页面专属聚合接口
- DIP 旧权限判断与 axios 封装
