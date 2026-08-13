/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { http } from "@/framework/request/http";

import { buildPtcTools } from "./run-code.tool";
import type { PtcToolkit } from "./toolkit.service";

const TOOLKIT: PtcToolkit = {
  version: "sha256:abc",
  digest: "## 可用函数\n\n```python\nlist_knowledge_networks() -> {entries}\n```",
  stub: "STUB_SOURCE_MARKER\n",
  sandbox_mcp_url: "http://agent-retrieval:30779/api/agent-retrieval/v1/mcp/",
};

function build(overrides: Partial<Parameters<typeof buildPtcTools>[0]> = {}) {
  return buildPtcTools({
    toolkit: TOOLKIT,
    bknContext: () => ({ conversation_id: "conv_1", interaction_id: "int_1" }),
    tokenProvider: { getToken: () => "tok", refresh: () => Promise.resolve("tok2") },
    knId: "worldcup_vega_catalog_bkn",
    ...overrides,
  });
}

type ExecuteFn = (input: unknown) => Promise<string>;

function executeOf(tools: ReturnType<typeof buildPtcTools>): ExecuteFn {
  const run = tools.run_code as { execute?: ExecuteFn };
  if (!run.execute) throw new Error("run_code 缺少 execute");
  return run.execute;
}

afterEach(() => vi.restoreAllMocks());

describe("buildPtcTools", () => {
  it("只暴露 run_code 一个工具", () => {
    expect(Object.keys(build())).toEqual(["run_code"]);
  });

  // http 客户端的 baseURL 已经是 /api；早期版本又拼了一次，请求落到
  // /api/api/agent-operator-integration/v1/function/execute 上，返回 404。
  it("执行工厂路径不带重复的 /api", async () => {
    const post = vi.spyOn(http, "post").mockResolvedValue({ data: { stdout: "ok", exit_code: 0 } } as never);

    await executeOf(build())({ code: "print(1)" });

    const [url] = post.mock.calls[0];
    expect(url).toBe("/agent-operator-integration/v1/function/execute");
    expect(url).not.toContain("/api/api");
  });

  // 常规模式由 effectiveToolArgs 补 kn_id，PTC 模式没有这层注入；不给出真实值
  // 模型就会自己编一个。
  it("把当前 kn_id 写进工具描述", () => {
    const run = build().run_code as { description?: string };
    expect(run.description).toContain("worldcup_vega_catalog_bkn");
  });

  it("stub 与模型代码一起下发，凭据和会话上下文走 event", async () => {
    const post = vi.spyOn(http, "post").mockResolvedValue({ data: { stdout: "ok", exit_code: 0 } } as never);

    await executeOf(build())({ code: "print(1)" });

    const body = post.mock.calls[0][1] as { code: string; event: Record<string, unknown> };
    expect(body.code).toContain("STUB_SOURCE_MARKER");
    // 沙箱按 Lambda 规范执行，入口必须是单参数 handler，且模型代码要缩进进去。
    expect(body.code).toContain("def handler(event):");
    expect(body.code).toContain("    print(1)");
    expect(body.event).toMatchObject({
      mcp: TOOLKIT.sandbox_mcp_url,
      token: "tok",
      bkn: { conversation_id: "conv_1", interaction_id: "int_1" },
    });
  });

  // traceback 里的服务端报文是模型自行修正的唯一依据，吞掉就只能盲目重试。
  it("失败时把 stderr 一并回传", async () => {
    vi.spyOn(http, "post").mockResolvedValue({
      data: { stdout: "部分输出", stderr: "ToolError: 字段不存在", exit_code: 1 },
    } as never);

    const result = await executeOf(build())({ code: "print(1)" });

    expect(result).toContain("exit_code=1");
    expect(result).toContain("部分输出");
    expect(result).toContain("ToolError: 字段不存在");
  });

  // 沙箱里的 401 浏览器看不见，不会触发 http 客户端的自动续期；漏了这一步，
  // 令牌过期后脚本里所有工具会齐刷刷报 401 且永不恢复。
  it("沙箱报 401 时代为续期并提示可重跑", async () => {
    vi.spyOn(http, "post").mockResolvedValue({
      data: { stdout: "", stderr: "HTTP Error 401: Unauthorized", exit_code: 1 },
    } as never);
    const refresh = vi.fn().mockResolvedValue("fresh-token");

    const result = await executeOf(
      build({ tokenProvider: { getToken: () => "stale", refresh } }),
    )({ code: "print(1)" });

    expect(refresh).toHaveBeenCalledOnce();
    expect(result).toContain("已自动续期");
  });

  it("每次执行都取当前令牌，不用构造时的快照", async () => {
    const post = vi.spyOn(http, "post").mockResolvedValue({ data: { stdout: "ok", exit_code: 0 } } as never);
    let current = "t1";

    const tools = build({ tokenProvider: { getToken: () => current, refresh: () => Promise.resolve(current) } });
    await executeOf(tools)({ code: "print(1)" });
    current = "t2";
    await executeOf(tools)({ code: "print(2)" });

    const tokens = post.mock.calls.map((c) => (c[1] as { event: { token: string } }).event.token);
    expect(tokens).toEqual(["t1", "t2"]);
  });

  it("空代码直接拒绝，不白跑一次沙箱", async () => {
    const post = vi.spyOn(http, "post");

    expect(await executeOf(build())({ code: "   " })).toContain("code 为空");
    expect(post).not.toHaveBeenCalled();
  });
});
