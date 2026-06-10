import { ExecutionUnitTabRedirect } from "@/modules/execution-factory/pages/ExecutionUnitTabRedirect";

/** @deprecated Use `ExecutionUnitListScene` via `/execution-factory/units?activeTab=mcp` instead. */
export function McpListPage() {
  return <ExecutionUnitTabRedirect activeTab="mcp" migrationFrom="legacy-mcp-list" />;
}
