/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";
import { buildMcpToolGroups, toolDisplayOf } from "@/modules/knowledge-network/services/mcp-tool-display";

const tool = (name: string, extra: Partial<McpToolDef> = {}): McpToolDef => ({ name, ...extra });

const serverTools: McpToolDef[] = [
  tool("get_kn_detail", { title: "Network Structure", group: "discovery", groupTitle: "Network and Schema", order: 120 }),
  tool("run_sql", { title: "SQL Query", group: "query", groupTitle: "Instance Queries", order: 240 }),
  tool("bkn_start_interaction", { title: "Start Interaction", group: "lifecycle", groupTitle: "Session Lifecycle", order: 10 }),
  tool("query_object_instance", { title: "Instance Query", group: "query", groupTitle: "Instance Queries", order: 210 }),
  tool("list_knowledge_networks", { title: "Knowledge Network List", group: "discovery", groupTitle: "Network and Schema", order: 110 }),
];

const groupsOf = (tools: McpToolDef[]) => buildMcpToolGroups(tools, (item) => toolDisplayOf(item.name, item));

describe("toolDisplayOf", () => {
  it("takes the display name and group straight from tools/list instead of the local table", () => {
    const display = toolDisplayOf("run_sql", tool("run_sql", { title: "SQL Query", group: "query", groupTitle: "Instance Queries", order: 240 }));

    expect(display).toMatchObject({ name: "SQL Query", groupKey: "query", groupLabel: "Instance Queries", order: 240, fromServer: true });
  });

  it("falls back to the local catalog when the server sends no display metadata", () => {
    // Old servers only send name/description, so fallback metadata must still render the catalog.
    const display = toolDisplayOf("run_sql", tool("run_sql"));

    expect(display).toMatchObject({ name: "SQL Data Query", groupKey: "data", groupLabel: "Data Resources and SQL", fromServer: false });
  });

  it("keeps the localized title even when the server omits the group metadata", () => {
    const display = toolDisplayOf("run_sql", tool("run_sql", { title: "Run SQL" }));

    expect(display).toMatchObject({ name: "Run SQL", groupKey: "data", fromServer: false });
  });

  it("keeps the lifecycle / execution / skill tools in their own groups when the server sends no metadata", () => {
    // The fallback catalog is the full display source for old servers.
    expect(toolDisplayOf("bkn_get_operation")).toMatchObject({ groupKey: "lifecycle", name: "View Operation Status" });
    expect(toolDisplayOf("bkn_get_receipt")).toMatchObject({ groupKey: "lifecycle", name: "View Call Receipt" });
    expect(toolDisplayOf("list_action_execution")).toMatchObject({ groupKey: "logic", name: "Action Execution History" });
    expect(toolDisplayOf("query_metric")).toMatchObject({ groupKey: "logic", name: "Metric Data Query" });
    expect(toolDisplayOf("read_skill_file")).toMatchObject({ groupKey: "skill", name: "Read Skill File" });
    expect(toolDisplayOf("execute_skill")).toMatchObject({ groupKey: "skill", name: "Execute Skill" });
  });

  it("keeps an unknown bkn_ tool in the lifecycle group instead of the knowledge-network group", () => {
    expect(toolDisplayOf("bkn_archive_interaction")).toMatchObject({ groupKey: "lifecycle", name: "Session Lifecycle Tool" });
    // Platform tools without interaction/conversation still rely on the bkn_ prefix.
    expect(toolDisplayOf("bkn_causality")).toMatchObject({ groupKey: "lifecycle" });
    expect(toolDisplayOf("bkn_some_future_trace_tool")).toMatchObject({ groupKey: "lifecycle" });
  });

  it("falls back to the tool name for a tool no side knows", () => {
    expect(toolDisplayOf("brand_new_capability").name).toBe("MCP Capability");
    expect(toolDisplayOf("brand_new_capability", tool("brand_new_capability", { title: "Brand New Capability" })).name).toBe("Brand New Capability");
  });
});

describe("buildMcpToolGroups", () => {
  it("orders groups and tools by the server order", () => {
    const groups = groupsOf(serverTools);

    expect(groups.map((group) => group.label)).toEqual(["Session Lifecycle", "Network and Schema", "Instance Queries"]);
    expect(groups[1].items.map(({ item }) => item.name)).toEqual(["list_knowledge_networks", "get_kn_detail"]);
    expect(groups[2].items.map(({ item }) => item.name)).toEqual(["query_object_instance", "run_sql"]);
  });

  it("keeps tools without display metadata at the tail instead of dropping them", () => {
    // Server tools_meta may only cover core tools; unlisted tools still appear.
    const groups = groupsOf([...serverTools, tool("bkn_context"), tool("unlisted_tool")]);

    const lifecycle = groups.find((group) => group.key === "lifecycle");
    expect(lifecycle?.items.map(({ item }) => item.name)).toEqual(["bkn_start_interaction", "bkn_context"]);
    // Server-declared groups sort before pure fallback groups.
    expect(groups[groups.length - 1].key).toBe("other");
    expect(groups[groups.length - 1].items.map(({ item }) => item.name)).toEqual(["unlisted_tool"]);
  });

  it("prefers the server group title when a fallback tool lands in the same group", () => {
    const groups = groupsOf([tool("bkn_context"), ...serverTools]);

    expect(groups.find((group) => group.key === "lifecycle")?.label).toBe("Session Lifecycle");
  });

  it("reproduces the local catalog order when nothing carries server metadata", () => {
    const groups = groupsOf([tool("run_sql"), tool("get_kn_detail"), tool("search_schema"), tool("list_resources")]);

    expect(groups.map((group) => group.key)).toEqual(["network", "model", "data"]);
    expect(groups[2].items.map(({ item }) => item.name)).toEqual(["list_resources", "run_sql"]);
  });
});
