/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Error paths for the tool loop. The completion fallback, which makes one last call when all
 * steps finish without text, must yield when this turn has already failed. Otherwise the same
 * error is reported twice (once from the stream and once when await result.response rejects) and
 * makes an unnecessary request to a busy gateway, producing two identical customer-visible errors.
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

/** Stand-in for one streamText call: emits provided fullStream events and optionally rejects response. */
function stubStream(parts: unknown[], responseRejection?: Error) {
  const fullStream = (function* () {
    for (const part of parts) yield part;
  })();
  if (responseRejection === undefined) return { fullStream, response: Promise.resolve({ messages: [] }) };
  const response = Promise.reject(responseRejection);
  // When the guard works, nobody awaits it. That is what this case asserts, but Vitest otherwise treats it as an unhandled rejection.
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

  it("平台侧工具照常进模型工具集——生命周期由前端接管执行，不是从工具表里拿掉", () => {
    // The earlier approach filtered all bkn_* tools, leaving the model unable to finish this
    // interaction round. Now the tools remain and execution is bound to the frontend turn (see buildAgentTools).
    const tools = build([
      "run_sql",
      "bkn_start_interaction",
      "bkn_finish_interaction",
      "search_schema",
    ]);

    expect(Object.keys(tools).sort()).toEqual([
      "bkn_finish_interaction",
      "bkn_start_interaction",
      "run_sql",
      "search_schema",
    ]);
    for (const name of LIFECYCLE_TOOL_NAMES) expect(tools[name]).toBeDefined();
  });

  it("没接管实现的平台工具直通后端，不因为前缀被吃掉", () => {
    // Platform tools evolve with the backend; during #618 they briefly grew to more than ten
    // lineage tools before shrinking to two. Interception covers only the two that compete with
    // the frontend for ownership; lineage read tools have no conflict and remain available to the model.
    const tools = build([
      "bkn_causality",
      "bkn_get_operation",
      "bkn_get_receipt",
      "bkn_retry_operation",
      "bkn_some_future_trace_tool",
      "query_object_instance",
    ]);

    expect(Object.keys(tools)).toHaveLength(6);
    expect(tools.bkn_some_future_trace_tool).toBeDefined();
  });
});

describe("本地 op 目录与后端工具面", () => {
  it("本地 op 全是业务工具，一个都不会被平台前缀规则吃掉", () => {
    // This is the safety boundary for prefix filtering: accidentally filtering a business tool silently removes that capability from the model.
    const eaten = CONTEXT_LOADER_OPS.filter((op) => isPlatformManagedTool(op.id));

    expect(eaten).toEqual([]);
  });

  it("op id 不重复", () => {
    const ids = CONTEXT_LOADER_OPS.map((op) => op.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  // Do not assert that the local table exactly matches backend tools/list. The Agent reads its
  // tool set at runtime; the local table only supplies picker grouping and debug-console examples
  // (with synthesizeOp fallback in MCP mode). Exact equality would fail CI whenever the backend
  // adds a tool even though behavior remains correct, so controlled lag is acceptable.
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
    // response also rejects; without the errored guard, await result.response throws the same error into catch again.
    const failure = new Error("network error");
    streamText.mockReset();
    streamText.mockReturnValueOnce(stubStream([{ type: "error", error: failure }], failure));

    const chunks: AgentChunk[] = [];
    await run((chunk) => chunks.push(chunk));

    const errors = chunks.filter((c) => c.type === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ error: "与模型服务的连接中断，请重试", retryable: true });
    // The model is called only once: the completion fallback does not hit a gateway that already failed.
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
    // Do not switch paths when the contract is absent from the prompt: for user-edited prompts,
    // body text should not wait until flush. Still discard tags as noise; bare tags do not belong
    // in answers, just as <think> does not.
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
