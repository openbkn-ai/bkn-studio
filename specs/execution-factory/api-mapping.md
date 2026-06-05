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
| 状态变更 | PUT | `/skills/{skill_id}/status` |
| 删除 | DELETE | `/skills/{skill_id}` |
| 市场列表 | GET | `/skills/market` |

| bkn-studio 路由 | 说明 |
| --- | --- |
| `/execution-factory/skills` | Skill 管理列表 |

## 不迁移的 DIP 接口

- DIP 私有 BFF 路径（若与上表 Public API 不一致）
- DIP 页面专属聚合接口
- DIP 旧权限判断与 axios 封装
