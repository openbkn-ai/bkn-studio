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
  DEFAULT_AGENT_CONFIG,
  runAgentChat,
  type AgentChunk,
} from "@/modules/knowledge-network/services/agent-chat.service";

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

async function run(onChunk: (chunk: AgentChunk) => void): Promise<void> {
  await runAgentChat({
    env: { base: "https://example.test", token: "t", knId: "kn_1" },
    modelName: "test-model",
    system: "sys",
    history: [{ role: "user", content: "在途项目有几个?" }],
    tools: {},
    config: DEFAULT_AGENT_CONFIG,
    tokenProvider: { getToken: () => "t", refresh: () => Promise.resolve("t") },
    onChunk,
  });
}

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
