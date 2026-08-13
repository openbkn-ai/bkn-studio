/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPtcToolkit } from "./toolkit.service";

const TOOLKIT = {
  version: "sha256:abc",
  digest: "签名清单",
  stub: "# stub",
  sandbox_mcp_url: "http://agent-retrieval:30779/api/agent-retrieval/v1/mcp/",
};

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response });
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchPtcToolkit", () => {
  // env.base 是 window.location.origin，不含 API 前缀。早期版本直接拼
  // "/mcp/toolkit"，请求打到了 http://localhost:8000/mcp/toolkit 上。
  it("请求路径带上网关前缀", async () => {
    const spy = mockFetch({ json: () => Promise.resolve(TOOLKIT) });

    await fetchPtcToolkit("http://localhost:8000", "tok");

    expect(spy).toHaveBeenCalledWith(
      "http://localhost:8000/api/agent-retrieval/v1/mcp/toolkit",
      expect.objectContaining({ headers: { Authorization: "Bearer tok" } }),
    );
  });

  it("同一 (base, token) 只请求一次", async () => {
    const spy = mockFetch({ json: () => Promise.resolve(TOOLKIT) });

    const base = "http://localhost:8000";
    await Promise.all([fetchPtcToolkit(base, "t2"), fetchPtcToolkit(base, "t2")]);
    await fetchPtcToolkit(base, "t2");

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // 失败不留缓存，否则一次网络抖动会把整个会话钉死在错误上。
  it("失败后可重试", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve("nope") })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(TOOLKIT) });
    vi.stubGlobal("fetch", spy);

    await expect(fetchPtcToolkit("http://h", "t3")).rejects.toThrow(/404/);
    await expect(fetchPtcToolkit("http://h", "t3")).resolves.toMatchObject({ version: "sha256:abc" });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("字段缺失时报错而不是返回半份工具包", async () => {
    mockFetch({ json: () => Promise.resolve({ version: "v", digest: "d" }) });

    await expect(fetchPtcToolkit("http://h", "t4")).rejects.toThrow(/缺少必需字段/);
  });
});
