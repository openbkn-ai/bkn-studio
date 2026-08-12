/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { McpToolDef } from "@/modules/knowledge-network/services/context-loader.service";

import { renderToolDigest } from "./tool-digest";

/** 取自开发环境 tools/list 的真实片段，字段与线上一致。 */
const TOOLS: McpToolDef[] = [
  {
    name: "list_knowledge_networks",
    title: "知识网络列表",
    group: "discovery",
    groupTitle: "网络与 Schema",
    order: 100,
    inputSchema: {
      type: "object",
      properties: {
        response_format: { type: "string", default: "toon" },
        limit: { type: "integer" },
      },
    },
    outputSchema: { type: "object", properties: { entries: {}, total_count: {} } },
  },
  {
    name: "query_object_instance",
    title: "实例查询",
    group: "query",
    groupTitle: "实例查询",
    order: 210,
    inputSchema: {
      type: "object",
      properties: {
        kn_id: { type: "string" },
        ot_id: { type: "string" },
        response_format: { type: "string", default: "toon" },
        condition: { type: "object" },
        limit: { type: "integer" },
      },
      required: ["kn_id", "ot_id"],
    },
    outputSchema: {
      type: "object",
      properties: { datas: {}, total_count: {}, search_after: {} },
    },
  },
  {
    name: "run_sql",
    title: "SQL 查询",
    group: "query",
    groupTitle: "实例查询",
    order: 240,
    inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
    outputSchema: { type: "object", properties: { columns: {}, entries: {} } },
  },
  // 生命周期工具由本轮 AgentTurnScope 接管，不应出现在说明里。
  {
    name: "bkn_start_interaction",
    title: "开始交互",
    group: "lifecycle",
    groupTitle: "会话生命周期",
    order: 10,
    inputSchema: { type: "object", properties: { question: { type: "string" } } },
  },
];

describe("renderToolDigest", () => {
  const digest = renderToolDigest(TOOLS);

  it("必填参数在前，可选参数带默认值", () => {
    expect(digest).toContain("query_object_instance(kn_id: str, ot_id: str,");
    expect(digest).toContain("limit: int = None");
  });

  it("response_format 默认覆盖为 json —— 代码模式要可下标结构而非 toon 文本", () => {
    expect(digest).toContain("response_format: str = 'json'");
    expect(digest).not.toContain("response_format: str = 'toon'");
  });

  it("渲染返回键 —— 键名不统一，模型猜不出来", () => {
    expect(digest).toContain("-> {entries, total_count}");
    expect(digest).toContain("-> {datas, total_count, search_after}");
  });

  it("排除生命周期工具", () => {
    expect(digest).not.toContain("bkn_start_interaction");
  });

  it("按 _meta 分组", () => {
    expect(digest).toContain("### 网络与 Schema");
    expect(digest).toContain("### 实例查询");
  });

  it("run_sql 带占位符示例 —— 实测中模型不看 docstring 就写 SQL 必错", () => {
    expect(digest).toContain("{{.<resource_id>}}");
  });

  it("代码块成对闭合", () => {
    // 真正的不变量是围栏成对，而不是某个具体数量——加一组工具就会多两个。
    // 早期版本每组只开不闭，模型看到的是一整块糊在一起的代码。
    const fences = digest.split("```").length - 1;
    expect(fences % 2).toBe(0);
    expect(fences).toBeGreaterThanOrEqual(2 * 2); // 至少两个分组各一块
  });

  it("分组按 order 排 —— 先发现网络，再查实例", () => {
    expect(digest.indexOf("### 网络与 Schema")).toBeLessThan(digest.indexOf("### 实例查询"));
  });
});
