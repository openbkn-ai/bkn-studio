/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { createLeakFilter, type AgentChunk, type LeakFilterOptions } from "./agent-chat.service";

/** 按给定切片喂入并 flush，返回收到的 chunks。 */
function run(deltas: string[], options: LeakFilterOptions = {}): AgentChunk[] {
  const chunks: AgentChunk[] = [];
  const filter = createLeakFilter((c) => chunks.push(c), options);
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

  it("没开 answer 契约时 <answer> 标签不改变行为（用户改过提示词的情况）", () => {
    const chunks = run(["普通答案"]);
    expect(textOf(chunks)).toBe("普通答案");
    expect(reasoningOf(chunks)).toBe("");
  });
});

/** 推理裸奔进正文的兜底：靠提示词立起 <answer> 边界，标签外一律当思考。 */
describe("createLeakFilter · answer 契约", () => {
  const opts: LeakFilterOptions = { expectAnswerTag: true };

  it("标签内才是正文，标签外的推敲改道到思考区", () => {
    const chunks = run(
      ["我选择3。现在我写最终答案。", "<answer>", "**结论**：共 3 个在途项目。", "</answer>", "我输出完了。"],
      opts,
    );
    expect(textOf(chunks)).toBe("**结论**：共 3 个在途项目。");
    expect(reasoningOf(chunks)).toBe("我选择3。现在我写最终答案。我输出完了。");
  });

  it("标签跨 delta 撕裂也能拼上", () => {
    const chunks = run(["推敲<ans", "wer>正式答案</ans", "wer>尾巴"], opts);
    expect(textOf(chunks)).toBe("正式答案");
    expect(reasoningOf(chunks)).toBe("推敲尾巴");
  });

  it("模型完全不守约（从没吐 <answer>）时把改道内容回放成正文，不能一轮没答案", () => {
    const chunks = run(["模型直接给了答案没打标签。"], opts);
    expect(textOf(chunks)).toBe("模型直接给了答案没打标签。");
    // 思考区里会重复一份，但它默认折叠，可接受。
    expect(reasoningOf(chunks)).toBe("模型直接给了答案没打标签。");
  });

  it("出过 <answer> 就不再回放，避免正文重复一遍", () => {
    const chunks = run(["推敲", "<answer>答案", "</answer>"], opts);
    expect(textOf(chunks)).toBe("答案");
  });

  it("<think> 与 answer 契约并存时各走各的", () => {
    const chunks = run(["<think>内部思考</think>", "过渡推敲", "<answer>答案</answer>"], opts);
    expect(textOf(chunks)).toBe("答案");
    expect(reasoningOf(chunks)).toBe("内部思考过渡推敲");
  });
});
