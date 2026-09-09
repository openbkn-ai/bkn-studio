import { describe, expect, it } from "vitest";

import { CONTEXT_LOADER_OPS, mcpOpsFrom } from "./context-loader.service";

const tool = (name: string) => ({ name, description: name, inputSchema: { type: "object" as const, properties: {} } });

describe("mcpOpsFrom", () => {
  // The panel labels this list "loaded N services". Answering with a compiled-in constant made a
  // stale build indistinguishable from a real surface: it advertised find_skills after that tool
  // was retired, and hid every tool added since the constant was last edited.
  it("has no list until tools/list answers", () => {
    expect(mcpOpsFrom(null)).toEqual([]);
  });

  it("lists exactly what the deployment reports", () => {
    const ops = mcpOpsFrom([tool("search_capabilities"), tool("some_tool_only_this_deploy_has")]);
    expect(ops.map((op) => op.id)).toEqual(["search_capabilities", "some_tool_only_this_deploy_has"]);
  });

  it("does not add a local op the deployment did not report", () => {
    const ops = mcpOpsFrom([tool("run_sql")]);
    expect(ops).toHaveLength(1);
    expect(ops.some((op) => op.id === "query_object_instance")).toBe(false);
  });

  it("uses the curated op for a reported tool and synthesizes the rest", () => {
    const curated = CONTEXT_LOADER_OPS.find((op) => op.id === "run_sql");
    expect(curated).toBeDefined();
    const ops = mcpOpsFrom([tool("run_sql"), tool("not_in_catalog")]);
    expect(ops[0]).toBe(curated);
    expect(ops[1].id).toBe("not_in_catalog");
  });

  // The retired tool must not come back through the curated catalogue (#1401).
  it("carries no entry for the retired recall tools", () => {
    expect(CONTEXT_LOADER_OPS.some((op) => op.id === "find_skills" || op.id === "search_tools")).toBe(false);
    expect(CONTEXT_LOADER_OPS.some((op) => op.id === "search_capabilities")).toBe(true);
  });
});
