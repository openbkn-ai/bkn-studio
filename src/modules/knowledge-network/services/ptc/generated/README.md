# 生成物，请勿手工编辑

真源在 bkn-foundry：`adp/context-loader/agent-retrieval/scripts/gen_sandbox_tools.py`
输入是同仓的 MCP schema（`server/driveradapters/mcp/schemas/`）。

| 文件 | 用途 |
|---|---|
| `tool_digest.md` | `run_code` 工具的 description，模型唯一看得到的东西 |
| `_tools.py` | 沙箱内的 BKN 能力 stub，随每次执行内联进脚本 |

schema 变更后需在 bkn-foundry 重跑 codegen 并把产物同步过来。
`_tools.py` 后续会烤进沙箱基础镜像，届时此处只保留 digest。
