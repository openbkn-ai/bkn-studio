/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { App } from "@modelcontextprotocol/ext-apps";

type MetricContext = { conversation_id: string; interaction_id: string };
type ToolCaller = Pick<App, "callServerTool">;

function toolError(result: { content?: Array<{ type: string; text?: string }> }): Error {
  return new Error(result.content?.find((item) => item.type === "text")?.text ?? "MCP tool failed");
}

/** A UI click happens after the agent's interaction may already be closed. */
export async function withMetricInteraction<T>(
  app: ToolCaller,
  question: string,
  run: (context: MetricContext) => Promise<T>,
  answer: (result: T) => string,
): Promise<T> {
  const started = await app.callServerTool({
    name: "bkn_start_interaction",
    arguments: {
      agent_name: "openbkn-object-metric-mcp-app",
      conversation_mode: "new",
      question,
    },
  });
  if (started.isError) throw toolError(started);
  const state = started.structuredContent as Partial<MetricContext> | undefined;
  if (!state?.conversation_id || !state.interaction_id) {
    throw new Error("bkn_start_interaction did not return interaction IDs");
  }

  let outcome: "completed" | "failed" = "failed";
  let finalAnswer = "";
  try {
    const result = await run({
      conversation_id: state.conversation_id,
      interaction_id: state.interaction_id,
    });
    finalAnswer = answer(result);
    outcome = "completed";
    return result;
  } finally {
    // A trace artifact outage must not hide an already completed metric query.
    try {
      await app.callServerTool({
        name: "bkn_finish_interaction",
        arguments: {
          interaction_id: state.interaction_id,
          outcome,
          ...(outcome === "completed"
            ? { answer: finalAnswer }
            : { reason: "metric UI action failed" }),
        },
      });
    } catch {
      // The business result or error above remains the user-facing outcome.
    }
  }
}
