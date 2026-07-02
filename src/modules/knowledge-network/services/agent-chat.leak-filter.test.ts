/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createLeakFilter, type AgentChunk } from "./agent-chat.service";

/** 按给定切片喂入并 flush，返回收到的 chunks。 */
function run(deltas: string[]): AgentChunk[] {
  const chunks: AgentChunk[] = [];
  const filter = createLeakFilter((c) => chunks.push(c));
  for (const d of deltas) filter.feed(d);
  filter.flush();
  return chunks;
}

function textOf(chunks: AgentChunk[]): string {
  return chunks
    .filter((c): c is Extract<AgentChunk, { type: "text" }> => c.type === "text")
    .map((c) => c.delta)
    .join("");
}

function reasoningOf(chunks: AgentChunk[]): string {
  return chunks
    .filter((c): c is Extract<AgentChunk, { type: "reasoning" }> => c.type === "reasoning")
    .map((c) => c.delta)
    .join("");
}

describe("createLeakFilter", () => {
  it("普通文本原样透传", () => {
    const chunks = run(["你好", "，世界 <b>不是标记</b>"]);
    expect(textOf(chunks)).toBe("你好，世界 <b>不是标记</b>");
    expect(chunks.every((c) => c.type === "text")).toBe(true);
  });

  it("think 块改道到 reasoning，标签本身被吃掉（跨 delta 撕裂也能拼上）", () => {
    const chunks = run(["前文<thi", "nk>我在思", "考</th", "ink>后文"]);
    expect(textOf(chunks)).toBe("前文后文");
    expect(reasoningOf(chunks)).toBe("我在思考");
  });

  it("落单的 </think> 直接丢弃", () => {
    const chunks = run(["结论 A", "</think>", " 结论 B"]);
    expect(textOf(chunks)).toBe("结论 A 结论 B");
  });

  it("泄漏的 <function=…> 块变成失败工具卡，不进正文", () => {
    const chunks = run([
      "我来查询。",
      "<function=run_sql>\n<parameter=sql>\nSELECT 1\n</parameter>\n</fun",
      "ction>",
      "完毕。",
    ]);
    expect(textOf(chunks)).toBe("我来查询。完毕。");
    const call = chunks.find((c) => c.type === "tool-call");
    expect(call && call.type === "tool-call" ? call.name : null).toBe("run_sql");
    const err = chunks.find((c) => c.type === "tool-error");
    expect(err && err.type === "tool-error" ? err.error : "").toContain("tool-call parser");
  });

  it("hermes 风格 <tool_call>{json}</tool_call> 也能拦截并解析工具名", () => {
    const chunks = run(['<tool_call>{"name": "search_schema", "arguments": {}}</tool_call>']);
    expect(textOf(chunks)).toBe("");
    const call = chunks.find((c) => c.type === "tool-call");
    expect(call && call.type === "tool-call" ? call.name : null).toBe("search_schema");
  });

  it("流在调用块中途断掉时 flush 兜底上报", () => {
    const chunks = run(["<function=describe_resource>\n<parameter=resource_id>\nabc"]);
    const call = chunks.find((c) => c.type === "tool-call");
    expect(call && call.type === "tool-call" ? call.name : null).toBe("describe_resource");
    expect(chunks.some((c) => c.type === "tool-error")).toBe(true);
  });

  it("结尾疑似半个标签会被 flush 补发，不吞字", () => {
    const chunks = run(["价格 <100 且 <fun 不是完整标记"]);
    expect(textOf(chunks)).toBe("价格 <100 且 <fun 不是完整标记");
  });
});
