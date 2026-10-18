/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getShared,
  listShared,
  narrow,
  rollbackSharedPrompt,
  selectableTools,
} from "@/modules/knowledge-network/services/bkn-agent-settings.service";

const tokenProvider = { getToken: () => "t", refresh: () => Promise.resolve("t") };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bkn-agent settings", () => {
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
    await rollbackSharedPrompt({ ...params, agentId: "business_provenance_optimizer", version: 2 });

    const urls = fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(urls).toEqual([
      "https://h/api/bkn-agent/v1/admin/agents",
      "https://h/api/bkn-agent/v1/admin/agents/catalog-semantic-understanding",
      "https://h/api/bkn-agent/v1/admin/agents/business_provenance_optimizer/prompt/rollback",
    ]);
  });
});
