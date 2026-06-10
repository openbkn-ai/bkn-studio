# Execution Factory Test Sources

## Canonical vs mirror

| Role | Path |
| --- | --- |
| **Canonical** (Agent AT + openbkn-smoke) | `bkn-foundry/bkn-foundry/adp/execution-factory/tests/` |
| **Canonical** (HTTP/CLI/Go) | `bkn-foundry/.../operator-integration/server/tests/` |
| **Mirror** (this directory) | `bkn-studio/bkn-studio/tests/execution-factory/` |

Prefer foundry paths for backend pytest and HTTP tests to avoid drift.

## Source mapping

| Layer | Original path (local clone) | OpenBKN canonical | This mirror |
| --- | --- | --- | --- |
| KWeaver ADP Agent AT | `keweaver/adp/execution-factory/tests` | `bkn-foundry/.../tests/` | `agent-at/` |
| Backend smoke | `operator-integration/server/tests` | `bkn-foundry/.../server/tests/` | `http/`, `fixtures/`, `tool/` |
| DIP operator-web UI | `keweaver/web/apps/operator-web` | ? | `operator-web-ui/` |
| bkn-studio frontend mock | `src/modules/execution-factory/services/*.test.ts` | vitest in module | same |

## Coverage by bkn-studio feature

| bkn-studio area | Agent AT module | HTTP/CLI |
| --- | --- | --- |
| Operator CRUD/publish/debug | `api/operator/` | `operator.http` |
| Toolbox & tools | `api/tool/` | `toolbox.http` |
| MCP list/debug/proxy | `api/mcp/` | `mcp.http` |
| Impex install/export | `api/impex/` | ? |
| Function execute/AI | `api/function/` | `function-ai.http` |
| Skill metadata/history | ? (not in Agent AT yet) | `skill.http` |
| Permissions / domain | `api/permission/`, `api/domain/` | ? |

## Recommended run order

1. `pnpm test:execution-factory` ? no backend required
2. Foundry `openbkn-smoke` ? token + running backend
3. REST Client on `http/*.http` ? requires `agent-operator-integration`
4. Full Agent AT pytest ? KWeaver auth + DB (foundry path)
5. DIP `operator-web` jest ? original keweaver repo
