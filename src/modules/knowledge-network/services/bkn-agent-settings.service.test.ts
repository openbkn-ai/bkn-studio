/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSharedPrompt,
  getShared,
  listShared,
  narrow,
  activateVersion,
  selectableTools,
  publishSharedPrompt,
  saveSharedPromptTranslation,
} from "@/modules/knowledge-network/services/bkn-agent-settings.service";
import { BknAgentExecutionError } from "./bkn-agent-execution.service";

const tokenProvider = { getToken: () => "t", refresh: () => Promise.resolve("t") };

function requestBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") throw new Error("Expected a JSON string request body");
  return JSON.parse(init.body) as unknown;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("bkn-agent settings", () => {
  it("maintains one version translation separately from original publication", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ prompt: { current_version: 7 } }))),
      );
    vi.stubGlobal("fetch", fetchMock);
    await saveSharedPromptTranslation({
      base: "https://h",
      tokenProvider,
      agentId: "studio_smart_qa",
      locale: "en-US",
      version: 7,
      language: "en-US",
      source_language: "zh-CN",
      source_content_sha256: "a".repeat(64),
      content: "English translation",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://h/api/bkn-agent/v1/admin/agents/studio_smart_qa/prompt/versions/7/translations/en-US",
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PUT");
    expect(requestBody(fetchMock.mock.calls[0][1])).toEqual({
      content: "English translation",
      source_language: "zh-CN",
      source_content_sha256: "a".repeat(64),
    });
    await publishSharedPrompt({
      base: "https://h",
      tokenProvider,
      agentId: "studio_smart_qa",
      version: 8,
      content: "English original",
      source_language: "en-US",
    });
    expect(requestBody(fetchMock.mock.calls[1][1])).toEqual({
      content: "English original",
      version: 8,
      source_language: "en-US",
    });
  });

  it("sends the captured language on localized admin reads", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ prompt: { content: "English" } })));
    vi.stubGlobal("fetch", fetchMock);
    await getSharedPrompt({
      base: "https://h",
      tokenProvider,
      agentId: "studio_smart_qa",
      locale: "en-US",
    });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Accept-Language")).toBe("en-US");
  });
  it("reuses the requested Prompt version after a committed response is lost", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("Gateway timeout", { status: 504 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "BknAgent.Prompt.VersionConflict",
            description: "Version exists",
          }),
          { status: 409 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = publishSharedPrompt({
      base: "https://h",
      tokenProvider,
      agentId: "studio_smart_qa",
      content: "Edited",
      version: 12,
    }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeInstanceOf(BknAgentExecutionError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe("https://h/api/bkn-agent/v1/admin/agents/studio_smart_qa/prompt/versions");
      expect(init?.method).toBe("POST");
      expect(requestBody(init)).toEqual({ content: "Edited", version: 12 });
    }
  });

  it("keeps the target version unchanged through repeated network failures", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const result = publishSharedPrompt({
      base: "https://h",
      tokenProvider,
      agentId: "studio_smart_qa",
      content: "Edited",
      version: 12,
    }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, init]) => requestBody(init))).toEqual(
      Array(3).fill({ content: "Edited", version: 12 }),
    );
  });

  it("narrows like the server: tools intersect and limits take the minimum", () => {
    const upper = {
      limits: { max_turns: 40, timeout_s: 300, max_tool_calls: null },
      allowed_tools: ["a", "b", "c"],
    };
    expect(
      narrow(upper, { allowed_tools: ["b", "x"], limits: { max_turns: 60, timeout_s: 60 } }),
    ).toEqual({
      limits: { max_turns: 40, timeout_s: 60, max_tool_calls: null },
      allowed_tools: ["b"],
    });
    // An unset layer follows the layer above.
    expect(narrow(upper, {})).toEqual(upper);
    expect(narrow(upper, null)).toBe(upper);
  });

  it("offers only tools the public surface can run", () => {
    expect(
      selectableTools(["bkn_start_interaction", "run_code", "search_schema", "run_cypher"]),
    ).toEqual(["search_schema", "run_cypher"]);
  });

  it("addresses admin calls to the chosen built-in Agent", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const params = { base: "https://h", tokenProvider };

    await listShared(params);
    await getShared({ ...params, agentId: "catalog-semantic-understanding" });
    await activateVersion({ ...params, agentId: "business_provenance_optimizer", version: 2 });

    const urls = fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls).toEqual([
      "https://h/api/bkn-agent/v1/admin/agents",
      "https://h/api/bkn-agent/v1/admin/agents/catalog-semantic-understanding",
      "https://h/api/bkn-agent/v1/admin/agents/business_provenance_optimizer/versions/2/activate",
    ]);
  });
});
