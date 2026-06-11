import type { ExecutionUnitTab } from "@/modules/execution-factory/components/execution-unit/types";

/** Tabs that share the operator-integration category taxonomy in list filters. */
export function supportsCategoryFilter(tab: ExecutionUnitTab): boolean {
  return tab === "operator" || tab === "toolbox" || tab === "mcp" || tab === "skill";
}
