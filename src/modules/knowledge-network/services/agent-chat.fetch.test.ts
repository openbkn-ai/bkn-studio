/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * 模型工厂网关的鉴权 fetch。这一层的退避重试风险最高：判错了要么白打正忙的网关，
 * 要么把流式响应整段缓冲下来、把每一次正常对话的打字效果毁掉。
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { makeAuthedFetch } from "@/modules/knowledge-network/services/agent-chat.service";

const provider = { getToken: () => "t", refresh: () => Promise.resolve("t") };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** 永不结束的流式响应：谁要是想把它读完，这个用例就会超时。 */
function neverEndingStream(contentType: string | null): Response {
  const stream = new ReadableStream<Uint8Array>({ start: () => undefined });
  return new Response(stream, {
    status: 200,
    headers: contentType ? { "content-type": contentType } : {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("makeAuthedFetch 退避重试", () => {
  it("200 裹着可重试业务码时重试，拿到成功响应就停", async () => {
    const busy = { code: "X", description: '{"code":50508,"message":"System is too busy now."}' };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(200, busy))
      .mockResolvedValueOnce(jsonResponse(200, { choices: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await makeAuthedFetch(provider)("https://example.test/v1/chat/completions", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toEqual({ choices: [] });
  });

  it("重试次数有上限，不会一直打正忙的网关", async () => {
    const busy = { code: "X", description: '{"code":50508,"message":"System is too busy now."}' };
    // 每次都要给新的 Response：body 只能被消费一次，复用同一个会让第二发的 clone() 直接抛。
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(jsonResponse(200, busy)));
    vi.stubGlobal("fetch", fetchMock);

    await makeAuthedFetch(provider)("https://example.test/v1/chat/completions", { method: "POST" });

    // RETRY_DELAYS_MS 两档 → 首发 + 2 次重试。
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("用户点停止后立刻让路，不再补发", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => {
      controller.abort();
      return Promise.resolve(jsonResponse(503, { error: { message: "unavailable" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await makeAuthedFetch(provider)("https://example.test/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("流式响应不读 body —— 读了会把整段缓冲住，正常对话的打字效果就没了", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(neverEndingStream("text/event-stream"));
    vi.stubGlobal("fetch", fetchMock);

    // 这里但凡去 peek body，promise 就永远不 resolve，用例直接超时。
    const response = await makeAuthedFetch(provider)("https://example.test/v1/chat/completions", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("网关漏标 content-type 时也不读 body（正向匹配 application/json 才 peek）", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(neverEndingStream(null));
    vi.stubGlobal("fetch", fetchMock);

    const response = await makeAuthedFetch(provider)("https://example.test/v1/chat/completions", { method: "POST" });

    expect(response.status).toBe(200);
  });

  it("401 刷新一次 token 后重发", async () => {
    const refresh = vi.fn(() => Promise.resolve("fresh"));
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(200, { choices: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await makeAuthedFetch({ getToken: () => "stale", refresh })(
      "https://example.test/v1/chat/completions",
      { method: "POST" },
    );

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    const retried = fetchMock.mock.calls[1][1] as RequestInit;
    expect(new Headers(retried.headers).get("Authorization")).toBe("Bearer fresh");
  });
});
