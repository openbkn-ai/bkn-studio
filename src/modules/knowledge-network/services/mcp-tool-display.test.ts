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
  tool("get_kn_detail", { title: "网络结构", group: "discovery", groupTitle: "网络与 Schema", order: 120 }),
  tool("run_sql", { title: "SQL 查询", group: "query", groupTitle: "实例查询", order: 240 }),
  tool("bkn_start_interaction", { title: "开始交互", group: "lifecycle", groupTitle: "会话生命周期", order: 10 }),
  tool("query_object_instance", { title: "实例查询", group: "query", groupTitle: "实例查询", order: 210 }),
  tool("list_knowledge_networks", { title: "知识网络列表", group: "discovery", groupTitle: "网络与 Schema", order: 110 }),
];

const groupsOf = (tools: McpToolDef[]) => buildMcpToolGroups(tools, (item) => toolDisplayOf(item.name, item));

describe("toolDisplayOf", () => {
  it("takes the display name and group straight from tools/list instead of the local table", () => {
    const display = toolDisplayOf("run_sql", tool("run_sql", { title: "SQL 查询", group: "query", groupTitle: "实例查询", order: 240 }));

    expect(display).toMatchObject({ name: "SQL 查询", groupKey: "query", groupLabel: "实例查询", order: 240, fromServer: true });
  });

  it("falls back to the local catalog when the server sends no display metadata", () => {
    // 老版本服务端只发 name/description：展示名与分组必须还能出来，否则侧栏退化成一列裸工具名。
    const display = toolDisplayOf("run_sql", tool("run_sql"));

    expect(display).toMatchObject({ name: "SQL 数据查询", groupKey: "data", groupLabel: "数据资源与 SQL 查询", fromServer: false });
  });

  it("keeps the localized title even when the server omits the group metadata", () => {
    const display = toolDisplayOf("run_sql", tool("run_sql", { title: "Run SQL" }));

    expect(display).toMatchObject({ name: "Run SQL", groupKey: "data", fromServer: false });
  });

  it("keeps the lifecycle / execution / skill tools in their own groups when the server sends no metadata", () => {
    // 老服务端下这张兜底表就是目录的全部依据，漏一个工具它就掉进「其他能力」。
    expect(toolDisplayOf("bkn_get_operation")).toMatchObject({ groupKey: "lifecycle", name: "查看操作状态" });
    expect(toolDisplayOf("bkn_get_receipt")).toMatchObject({ groupKey: "lifecycle", name: "查看调用回执" });
    expect(toolDisplayOf("list_action_execution")).toMatchObject({ groupKey: "logic", name: "行动执行记录" });
    expect(toolDisplayOf("query_metric")).toMatchObject({ groupKey: "logic", name: "指标数据查询" });
    expect(toolDisplayOf("read_skill_file")).toMatchObject({ groupKey: "skill", name: "读取技能文件" });
    // 兜底表漏了它就掉进 guessLocal，显示成跟 find_skills 一模一样的"技能与动态工具"。
    expect(toolDisplayOf("execute_skill")).toMatchObject({ groupKey: "skill", name: "执行技能" });
  });

  it("keeps an unknown bkn_ tool in the lifecycle group instead of the knowledge-network group", () => {
    expect(toolDisplayOf("bkn_archive_interaction")).toMatchObject({ groupKey: "lifecycle", name: "会话生命周期工具" });
    // 名字里没有 interaction / conversation 的平台工具靠前缀兜住：`bkn_xxx` 自带子串
    // `kn`，少了前缀判就会掉进「知识网络信息」。后端的平台工具面一直在变，兜底表滞后
    // 于后端正是这层兜底存在的理由。
    expect(toolDisplayOf("bkn_causality")).toMatchObject({ groupKey: "lifecycle" });
    expect(toolDisplayOf("bkn_some_future_trace_tool")).toMatchObject({ groupKey: "lifecycle" });
  });

  it("falls back to the tool name for a tool no side knows", () => {
    expect(toolDisplayOf("brand_new_capability").name).toBe("MCP 能力");
    expect(toolDisplayOf("brand_new_capability", tool("brand_new_capability", { title: "全新能力" })).name).toBe("全新能力");
  });
});

describe("buildMcpToolGroups", () => {
  it("orders groups and tools by the server order", () => {
    const groups = groupsOf(serverTools);

    expect(groups.map((group) => group.label)).toEqual(["会话生命周期", "网络与 Schema", "实例查询"]);
    expect(groups[1].items.map(({ item }) => item.name)).toEqual(["list_knowledge_networks", "get_kn_detail"]);
    expect(groups[2].items.map(({ item }) => item.name)).toEqual(["query_object_instance", "run_sql"]);
  });

  it("keeps tools without display metadata at the tail instead of dropping them", () => {
    // 服务端 tools_meta 只声明了核心工具，其余工具不带 _meta，它们仍要出现在目录里。
    const groups = groupsOf([...serverTools, tool("bkn_context"), tool("unlisted_tool")]);

    const lifecycle = groups.find((group) => group.key === "lifecycle");
    expect(lifecycle?.items.map(({ item }) => item.name)).toEqual(["bkn_start_interaction", "bkn_context"]);
    // 服务端声明过的分组排在纯兜底分组之前。
    expect(groups[groups.length - 1].key).toBe("other");
    expect(groups[groups.length - 1].items.map(({ item }) => item.name)).toEqual(["unlisted_tool"]);
  });

  it("prefers the server group title when a fallback tool lands in the same group", () => {
    const groups = groupsOf([tool("bkn_context"), ...serverTools]);

    expect(groups.find((group) => group.key === "lifecycle")?.label).toBe("会话生命周期");
  });

  it("reproduces the local catalog order when nothing carries server metadata", () => {
    const groups = groupsOf([tool("run_sql"), tool("get_kn_detail"), tool("search_schema"), tool("list_resources")]);

    expect(groups.map((group) => group.key)).toEqual(["network", "model", "data"]);
    expect(groups[2].items.map(({ item }) => item.name)).toEqual(["list_resources", "run_sql"]);
  });
});
