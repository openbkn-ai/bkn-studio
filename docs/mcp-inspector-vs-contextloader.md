# ContextLoader 调试台 vs. MCP Inspector —— 差异分析与借鉴方案

> 背景：当前知识网络「立即体验」里的 ContextLoader 调试台（`src/modules/knowledge-network/scenes/ExperienceScene.tsx`）是自研的 agent-retrieval REST/MCP 调试界面。问题：能否参考或直接复用官方 [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector)？
>
> 结论先行：**不要整体嵌入**（它是「Web UI + Node 代理」两件套、无可 import 的组件包、且强依赖一个我们并不需要的代理进程，还会丢掉我们所有领域便利）。**应当借鉴**它的两个核心能力——`tools/list` 自动发现 + `inputSchema` 驱动表单；并可选加一个「本地 Inspector 外链」给高级用户兜底。

---

## 1. 两者定位

| | ContextLoader 调试台（我们） | MCP Inspector（官方） |
|---|---|---|
| 本质 | Studio 内嵌的一个**领域专用**页面 | 独立**通用**调试工具（`npx` 启动） |
| 目标 | 针对 agent-retrieval、锁定某个 kn 的 REST+MCP 联调 | 任意 MCP server 的通用检查 |
| 形态 | SPA 里的一个 React 路由 | Web UI（React）+ Node 代理服务器 |
| 部署 | 随 Studio 一起，无额外进程 | 需本地跑 `npx`，起代理 + UI 两个东西 |

一句话：它是「万能但啥都不懂你」，我们是「只懂 agent-retrieval 但很懂」。

---

## 2. 架构差异（关键）

**MCP Inspector**：
```
浏览器 UI  ──HTTP──>  本地 Node 代理(MCPP)  ──stdio/SSE/HTTP──>  MCP server
```
代理（MCPP）同时是 MCP 客户端 + HTTP 服务器。它存在的两个主因：
1. **stdio 传输**：浏览器没法直接起子进程跑本地 MCP server，必须代理。
2. **跨域**：浏览器直连远端 MCP server 会撞 CORS，代理绕过。

**我们**：
```
浏览器  ──HTTP（同源，经网关）──>  agent-retrieval MCP
```
我们**已经浏览器直连 streamable HTTP**（同源经网关，无跨域），并且自己实现了完整的 MCP 会话握手：`initialize → 取响应头 mcp-session-id → notifications/initialized → tools/call`（见 `context-loader.service.ts` 的 `sendRequest`）。

> 含义：Inspector 最核心的「代理层」对我们是**纯粹的多余成本**。我们要嵌入它，等于为了一个我们不需要的中间层，去托管/运维一个额外的 Node 进程。

---

## 3. 功能对比

| 能力 | 我们 | Inspector | 备注 |
|---|---|---|---|
| 工具列表来源 | **硬编码** `CONTEXT_LOADER_OPS`（9 个工具） | **`tools/list` 自动发现** | 我们会「漂移」——本次修的 path/filters/response_format 三个 bug 全是硬编码与后端不同步导致 |
| 参数表单 | 手写 JSON 请求体 + 少量 query 控件 | **按每个工具 `inputSchema` 自动生成表单** | Inspector 的核心优势 |
| 工具调用 | ✅ | ✅ | |
| REST ↔ MCP 一一对照 | ✅（同一接口两种调用） | ❌（只有 MCP） | **我们独有** |
| kn_id 锁定 + 注入 | ✅（跟随当前网络） | ❌（无领域概念） | **我们独有** |
| 数据浏览器（schema + 样本行 + 一键填入） | ✅ | ❌ | **我们独有** |
| 鉴权 | OAuth 实时会话 token **+** AppKey(`bak_`) 选择器 | 仅手填 Bearer / 自定义头，**无 OAuth** | 我们更贴合网关 |
| 真实网关地址 + cURL | ✅ | 部分 | |
| TOON 渲染 | ✅（抽 `content[].text`，TOON 纯文本 + 角标） | 展示 text，但无领域优化 | |
| Resources 浏览/读取 | ❌ | ✅ | agent-retrieval 当前似乎只暴露 tools，价值有限 |
| Prompts + Sampling | ❌ | ✅ | 同上 |
| Roots / Ping / 通知日志面板 | ❌ | ✅ | 通用协议能力 |
| 请求历史 | ❌ | ✅ | 可借鉴 |
| CLI / CI 模式 | ❌ | ✅（`--method tools/call --tool-arg k=v`） | 脚本化测试可借鉴 |
| 多传输（stdio/SSE/HTTP） | 仅 HTTP | 三种 | 我们只需 HTTP |
| 协议握手健壮性 | 自研、能用 | 官方、久经考验 | |
| 安全（localhost 绑定/会话 token/Origin 校验/DNS rebinding） | 不适用（同源内嵌） | ✅ | 是它作为「独立进程」必须的，对我们不相关 |

---

## 4. 能否「直接复用 / 嵌入」？—— 不建议

逐条阻碍：

1. **没有可 import 的组件包**。npm 上只有 CLI/应用（`@modelcontextprotocol/inspector`），不是 React 组件库。没法 `import { ToolsTab } from ...` 拼进我们的页面。
2. **强依赖 Node 代理进程**。浏览器 UI 必须连它的代理才能工作。要在我们的托管环境用，就得：多部署一个 Node 服务、`HOST=0.0.0.0` 暴露、配 `MCP_PROXY_AUTH_TOKEN`、配 `ALLOWED_ORIGINS` 防 DNS rebinding……凭空多一个安全面，而这一切只为一个**我们不需要的代理层**。
3. **无 OAuth**。它只支持手填 Bearer，对接不了我们网关的 Hydra 会话 token 流；只能让用户贴 AppKey。
4. **通用 = 不懂领域**。嵌进来会立刻丢掉：kn_id 锁定、REST↔MCP 对照、数据浏览器填入、AppKey 选择器、TOON 优化。要补回这些就等于 **fork 一整个 app 并长期维护**，成本远高于自研。

> 判断：嵌入是「高成本、低契合、还增安全面」。否决。

---

## 5. 能否「iframe / 外链」？—— 可做兜底，但不无缝

可行性：
- Inspector 支持用 query 参数预指向：`?transport=streamable-http&serverUrl=<我们的 MCP URL>`。
- 也有 **CLI 模式**可脚本化：`--method tools/call --tool-name <name> --tool-arg k=v --header "Authorization: Bearer bak_..."`。

限制：
- **仍要本地 `npx` 起代理**，不是浏览器内零安装。
- **请求头（AppKey）不能用 query 注入**（安全），得用户在 UI 里贴，或 CLI `--header`。
- **无 OAuth** → 必须用 AppKey(`bak_`)。

最便宜的落地：在我们已有的「接入 MCP」指南弹窗（`McpSetupModal`）里加一块「用 MCP Inspector 本地调试」——给一行 `npx @modelcontextprotocol/inspector`、预填我们的 MCP URL、提示贴 AppKey。工作量 ~0.5 天，零风险。给想要 resources/prompts/通用能力的高级用户兜底。

---

## 6. 能否「参考借鉴」？—— 强烈推荐（ROI 最高）

MIT 协议，可抄代码（带署名）。按价值排序：

### P1（最值）：`tools/list` 自动发现 + `inputSchema` 驱动表单
- **解决根因**：我们的工具是硬编码 `CONTEXT_LOADER_OPS`，必然随后端漂移。本次会话修的三个 bug（`get_logic_properties_values` 路径错、`filters` 糖衣缺、三个工具缺 `response_format`）**全是漂移产物**。
- **做法**：MCP 模式下从 server 拉 `tools/list`，按每个工具返回的 `inputSchema`（JSON Schema）自动渲染参数表单。表单库可用 `@rjsf/antd`（react-jsonschema-form 的 antd 主题）或手写一个轻量 schema→表单。
- **保留我们的领域层**：kn_id 注入、AppKey/OAuth、数据浏览器填入、TOON 渲染，全部叠在自动表单之上。
- **REST 侧**：REST 无 `tools/list`，但按规格「REST 路径 = MCP 工具名」可由工具名直接推导路径；参数 schema 复用 MCP 的 `inputSchema`。即「一次发现，REST/MCP 共用」。
- **前置校验**：先确认后端 `tools/list` 返回的 `inputSchema` 质量（字段、必填、枚举、描述是否齐全）。若后端 schema 不全，先推动后端补，或保留硬编码做「精选 + 兜底」。
- **工作量**：~2–4 天（含表单组件、schema 适配、与现有 body 编辑器并存的开关）。
- **风险**：中。后端 schema 质量是关键变量；建议「自动发现 + 可切回手写 JSON」双模式过渡。

### P2（按需）：通用协议面板
- Resources 浏览 / Prompts / 通知日志面板 / Ping / 请求历史。
- **前提**：agent-retrieval MCP 是否真暴露 resources/prompts。**当前看起来只有 tools**，所以 resources/prompts 面板**现在价值很低**，先不做。
- 「请求历史」与「通知日志面板」是低成本、通用有用的，可单独挑出来做。

### P3（可选）：借协议/SSE/会话处理代码
- 我们自研握手已能用；官方实现更久经考验（重连、SSE 分块、能力协商）。优先级低，除非遇到稳定性问题。

---

## 7. 推荐路线

```
P0  Inspector 本地外链（setup 指南加一块）      ~0.5d   零风险   兜底高级用户          —— 可选，随手
P1  tools/list 自动发现 + inputSchema 表单       ~2–4d   中风险   永久消除硬编码漂移    —— 主推
P2  请求历史 / 通知日志面板                       ~1d     低风险   通用易用提升          —— 按需
   （Resources/Prompts 面板：后端暴露后再说，当前略）
P3  借协议处理代码                                —       低       仅在稳定性出问题时
不做  整体嵌入 / fork inspector                   高       高       否决
```

我的建议：**P1 为主线**（它把我们这次踩的「漂移坑」从根上堵死），**P0 顺手做**（便宜的兜底），P2 按需，P3/嵌入不做。

---

## 8. 待拍板的问题（醒来看）

1. **P1 是否立项**？这是最有价值的重构——但需要先验证后端 `tools/list` 的 `inputSchema` 质量。要不要我先写个小脚本/页面拉一次 `tools/list` 看 schema 全不全，再决定？
2. **P0 外链**：做还是跳过？（半天，纯加分）
3. **表单库选型**：`@rjsf/antd`（省事、体积大）vs 手写轻量 schema 表单（可控、贴合现有样式）。倾向后者，和现有 JSON 编辑器并存。
4. **过渡策略**：自动发现上线后，硬编码 `CONTEXT_LOADER_OPS` 是删掉，还是降级为「精选排序 + summary 文案 + 兜底」？倾向保留为「文案/排序层」，参数 schema 走自动发现。

---

*附：本次会话已把 ContextLoader 对齐 agent-retrieval 规格（MCP TOON 可调、REST 路径修正、filters 糖衣、response_format 全工具、TOON 文本渲染、响应字节数人类可读）。本文针对的是「下一步要不要引入 Inspector / 自动发现」的方向性决策。*
