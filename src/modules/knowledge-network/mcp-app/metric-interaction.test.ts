/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { App } from "@modelcontextprotocol/ext-apps";
import { describe, expect, it, vi } from "vitest";

import { withMetricInteraction } from "./metric-interaction";

describe("withMetricInteraction", () => {
  it("starts a fresh interaction for a later UI click and finishes it", async () => {
    const callServerTool = vi.fn(({ name }: { name: string }) =>
      Promise.resolve(
        name === "bkn_start_interaction"
          ? {
              structuredContent: {
                conversation_id: "new-conversation",
                interaction_id: "new-turn",
              },
            }
          : { structuredContent: {} },
      ),
    );
    const client = { callServerTool } as unknown as Pick<App, "callServerTool">;
    const query = vi.fn((context: { conversation_id: string; interaction_id: string }) => {
      expect(context).toEqual({ conversation_id: "new-conversation", interaction_id: "new-turn" });
      return Promise.resolve(5);
    });

    await expect(
      withMetricInteraction(client, "Next metric page", query, (rows) => `${rows} rows`),
    ).resolves.toBe(5);
    expect(callServerTool).toHaveBeenNthCalledWith(1, {
      name: "bkn_start_interaction",
      arguments: {
        agent_name: "openbkn-object-metric-mcp-app",
        conversation_mode: "new",
        question: "Next metric page",
      },
    });
    expect(callServerTool).toHaveBeenNthCalledWith(2, {
      name: "bkn_finish_interaction",
      arguments: { interaction_id: "new-turn", outcome: "completed", answer: "5 rows" },
    });
  });

  it("finishes a failed UI action without hiding the business error", async () => {
    const callServerTool = vi.fn(({ name }: { name: string }) => {
      if (name === "bkn_start_interaction") {
        return Promise.resolve({
          structuredContent: { conversation_id: "new-conversation", interaction_id: "new-turn" },
        });
      }
      return Promise.reject(new Error("trace write unavailable"));
    });
    const client = { callServerTool } as unknown as Pick<App, "callServerTool">;

    await expect(
      withMetricInteraction(
        client,
        "Drill into metric",
        () => Promise.reject(new Error("metric query failed")),
        () => "done",
      ),
    ).rejects.toThrow("metric query failed");
    expect(callServerTool).toHaveBeenNthCalledWith(2, {
      name: "bkn_finish_interaction",
      arguments: {
        interaction_id: "new-turn",
        outcome: "failed",
        reason: "metric UI action failed",
      },
    });
  });
});
