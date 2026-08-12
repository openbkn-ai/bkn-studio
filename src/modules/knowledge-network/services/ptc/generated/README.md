# 生成物，请勿手工编辑

真源在 bkn-foundry：`adp/context-loader/agent-retrieval/scripts/gen_sandbox_tools.py`

| 文件 | 用途 |
|---|---|
| `_tools.py` | 沙箱内的 BKN 能力 stub，随每次执行内联进脚本 |

工具说明（函数签名列表）**不在这里**——它由 `../tool-digest.ts` 在运行时从
MCP `tools/list` 渲染，与服务端实际注册的工具天然一致，不存在副本漂移。

`_tools.py` 是唯一还需要同步的产物：schema 变更后须在 bkn-foundry 重跑 codegen
并同步过来。后续烤进沙箱基础镜像后，此目录即可删除。
