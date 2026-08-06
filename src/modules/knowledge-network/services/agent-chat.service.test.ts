/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 工具循环的错误路径。收尾兜底（跑满步数没出正文时补一刀）在本轮已经出错时必须让路：
 * 否则同一个错误会被报两遍（流里一次、await result.response reject 再一次），
 * 还要白打一次正忙的网关 —— 客户反馈的截图里就是两条一模一样的报错。
 */

import { describe, expect, it, vi } from "vitest";

import {
  buildAgentTools,
  DEFAULT_AGENT_CONFIG,
  formatToolResultLimits,
  runAgentChat,
  type AgentChunk,
} from "@/modules/knowledge-network/services/agent-chat.service";
import {
  isPlatformManagedTool,
  LIFECYCLE_TOOL_NAMES,
} from "@/modules/knowledge-network/services/bkn-lifecycle.service";
import {
  CONTEXT_LOADER_OPS,
  type McpSession,
} from "@/modules/knowledge-network/services/context-loader.service";

type AiModule = typeof import("ai");

const { streamText } = vi.hoisted(() => ({ streamText: vi.fn() }));

vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<AiModule>()), streamText }));

/** 一次 streamText 调用的替身：吐出给定的 fullStream 事件，response 按需 reject。 */
function stubStream(parts: unknown[], responseRejection?: Error) {
  const fullStream = (function* () {
    for (const part of parts) yield part;
  })();
  if (responseRejection === undefined) return { fullStream, response: Promise.resolve({ messages: [] }) };
  const response = Promise.reject(responseRejection);
  // 守卫生效时没人 await 它——这正是本用例要断言的，但 vitest 会把它算成 unhandled rejection。
  response.catch(() => undefined);
  return { fullStream, response };
}

async function run(onChunk: (chunk: AgentChunk) => void, system = "sys"): Promise<void> {
  await runAgentChat({
    env: { base: "https://example.test", token: "t", knId: "kn_1" },
    modelName: "test-model",
    system,
    history: [{ role: "user", content: "在途项目有几个?" }],
    tools: {},
    config: DEFAULT_AGENT_CONFIG,
    tokenProvider: { getToken: () => "t", refresh: () => Promise.resolve("t") },
    onChunk,
  });
}

describe("buildAgentTools", () => {
  const session: McpSession = {
    callTool: () => Promise.resolve({ ok: true, latencyMs: 0, isError: false, text: "", structured: undefined }),
  };

  const build = (names: string[]) =>
    buildAgentTools(
      names.map((name) => ({ name })),
      { base: "https://example.test", token: "t", knId: "kn_1" },
      "kn_1",
      DEFAULT_AGENT_CONFIG,
      { getToken: () => "t", refresh: () => Promise.resolve("t") },
      { session },
    );

  it("平台侧工具不进模型工具集", () => {
    // tools/list 会把平台工具和业务工具一起返回；模型看见就会自己去调，
    // 结果是另开一条交互撞上前端已开的那条，或者被 permission_denied 挡下白烧步数。
    const tools = build([
      "run_sql",
      "bkn_start_interaction",
      "bkn_finish_interaction",
      "bkn_create_conversation",
      "search_schema",
    ]);

    expect(Object.keys(tools).sort()).toEqual(["run_sql", "search_schema"]);
    for (const name of LIFECYCLE_TOOL_NAMES) expect(tools[name]).toBeUndefined();
  });

  it("按前缀过滤，后端新增的溯源工具不用改代码也挡得住", () => {
    // 平台侧工具集会随后端演进（#618 期间一度扩到十余个溯源工具，之后又裁回两个）。
    // 列名单必漏，漏了模型就会去调，所以这里钉住的是前缀规则而不是具体名字。
    const tools = build([
      "bkn_causality",
      "bkn_get_operation",
      "bkn_get_receipt",
      "bkn_retry_operation",
      "bkn_some_future_trace_tool",
      "query_object_instance",
    ]);

    expect(Object.keys(tools)).toEqual(["query_object_instance"]);
  });
});

describe("本地 op 目录与后端工具面", () => {
  it("本地 op 全是业务工具，一个都不会被平台前缀规则吃掉", () => {
    // 这是前缀过滤的安全边界：真误伤了业务工具，模型会静默失去那个能力。
    const eaten = CONTEXT_LOADER_OPS.filter((op) => isPlatformManagedTool(op.id));

    expect(eaten).toEqual([]);
  });

  it("op id 不重复", () => {
    const ids = CONTEXT_LOADER_OPS.map((op) => op.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  // 这里**不**断言本地表与后端 tools/list 完全一致：Agent 的工具集是运行时从
  // tools/list 读的，本地表只喂勾选器分组和调试台示例（MCP 模式还有 synthesizeOp
  // 兜底）。把它钉死等于后端一加工具我们 CI 就红，而实际什么都没坏。允许滞后。
});

describe("formatToolResultLimits", () => {
  it("报的是当前 config 的真实上限，schema 类不跟数据类混为一谈", () => {
    const text = formatToolResultLimits(DEFAULT_AGENT_CONFIG);

    expect(text).toContain(String(DEFAULT_AGENT_CONFIG.dataToolCap));
    expect(text).toContain(String(DEFAULT_AGENT_CONFIG.schemaToolCap));
  });

  it("跟着调参走：用户改了上限，提示词里的数字也变", () => {
    expect(formatToolResultLimits({ ...DEFAULT_AGENT_CONFIG, dataToolCap: 1234 })).toContain("1234");
  });

  it("两个上限都关掉时不拼这一段", () => {
    expect(formatToolResultLimits({ ...DEFAULT_AGENT_CONFIG, dataToolCap: 0, schemaToolCap: 0 })).toBe("");
  });
});

describe("runAgentChat 错误路径", () => {
  it("流里报错后不再跑收尾兜底，同一个错误只报一次", async () => {
    // response 也 reject：没有 errored 守卫时，await result.response 会把同一个错误再抛进 catch。
    const failure = new Error("network error");
    streamText.mockReset();
    streamText.mockReturnValueOnce(stubStream([{ type: "error", error: failure }], failure));

    const chunks: AgentChunk[] = [];
    await run((chunk) => chunks.push(chunk));

    const errors = chunks.filter((c) => c.type === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ error: "与模型服务的连接中断，请重试", retryable: true });
    // 只调了一次模型：收尾兜底没有对着已经出错的网关再打一枪。
    expect(streamText).toHaveBeenCalledTimes(1);
    expect(chunks.at(-1)).toEqual({ type: "finish" });
  });

  it("没出错但也没出正文时，收尾兜底照常补一刀", async () => {
    streamText.mockReset();
    streamText.mockReturnValueOnce(stubStream([{ type: "tool-call", toolCallId: "c1", toolName: "run_sql", input: {} }]));
    streamText.mockReturnValueOnce(stubStream([{ type: "text-delta", text: "共 3 个。" }]));

    const chunks: AgentChunk[] = [];
    await run((chunk) => chunks.push(chunk));

    expect(streamText).toHaveBeenCalledTimes(2);
    expect(chunks.filter((c) => c.type === "error")).toHaveLength(0);
    expect(chunks.filter((c) => c.type === "text").map((c) => c.delta).join("")).toBe("共 3 个。");
  });

  it("提示词给了 answer 契约时，标签外的推敲不进正文；没给则原样透传", async () => {
    const deltas = [
      { type: "text-delta", text: "我现在写最终答案。" },
      { type: "text-delta", text: "<answer>共 3 个。</answer>" },
    ];

    streamText.mockReset();
    streamText.mockReturnValueOnce(stubStream(deltas));
    const withContract: AgentChunk[] = [];
    await run((chunk) => withContract.push(chunk), "回答请包在 <answer> 与 </answer> 之间");

    streamText.mockReset();
    streamText.mockReturnValueOnce(stubStream(deltas));
    const without: AgentChunk[] = [];
    await run((chunk) => without.push(chunk), "sys");

    const textOf = (chunks: AgentChunk[]) =>
      chunks.filter((c) => c.type === "text").map((c) => c.delta).join("");
    const reasoningOf = (chunks: AgentChunk[]) =>
      chunks.filter((c) => c.type === "reasoning").map((c) => c.delta).join("");

    expect(textOf(withContract)).toBe("共 3 个。");
    expect(reasoningOf(withContract)).toBe("我现在写最终答案。");
    // 契约没写进提示词就不改道：用户改过提示词时，正文不该憋到 flush 才出现。
    // 标签本身仍然当噪音吃掉——裸标签不该出现在答案里，跟 <think> 一个待遇。
    expect(textOf(without)).toBe("我现在写最终答案。共 3 个。");
    expect(reasoningOf(without)).toBe("");
  });

  it("模型工厂忙态的原始报文不会糊到用户脸上", async () => {
    const busy = {
      code: "ModelFactory.ModelController.Model.Error",
      description: '{"code":50508,"message":"System is too busy now. Please try again later.","data":null}',
      solution: "请检查配置信息",
    };
    const { TypeValidationError } = await vi.importActual<AiModule>("ai");
    const failure = new TypeValidationError({ value: busy, cause: new Error("invalid_union") });
    streamText.mockReset();
    streamText.mockReturnValueOnce(stubStream([{ type: "error", error: failure }], failure));

    const chunks: AgentChunk[] = [];
    await run((chunk) => chunks.push(chunk));

    const error = chunks.find((c) => c.type === "error");
    expect(error?.error).toBe("模型服务繁忙，请稍后重试（50508）");
    expect(error?.detail).toContain("ModelFactory.ModelController.Model.Error");
  });
});
