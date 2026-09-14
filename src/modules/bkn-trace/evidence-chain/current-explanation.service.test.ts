/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, expect, it, vi } from "vitest";
const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock("@/framework/request/http", () => ({ http: { get, post } }));
import { generateCurrentExplanation, readCurrentExplanation } from "./current-explanation.service";
beforeEach(() => { get.mockReset(); post.mockReset(); });
it("reads without generating and submits no version parameters", async () => {
  const value = { data: { schema_version: "1", interaction_id: "i", status: "not_generated" } };
  get.mockResolvedValue(value); post.mockResolvedValue(value);
  await readCurrentExplanation("i"); expect(post).not.toHaveBeenCalled();
  await generateCurrentExplanation("i");
  expect(post).toHaveBeenCalledWith("/agent-observability/v1/business-provenance/interactions/i/explanations", {}, { skipErrorToast: true });
});
it("rejects another interaction and unsupported response versions", async () => {
  for (const data of [{ schema_version: "2", interaction_id: "i", status: "not_generated" }, { schema_version: "1", interaction_id: "other", status: "not_generated" }]) {
    get.mockResolvedValue({ data }); await expect(readCurrentExplanation("i")).rejects.toThrow();
  }
});
it("accepts independent support and attribution states from the internal projection", async () => {
  get.mockResolvedValue({ data: {
    schema_version: "1", interaction_id: "i", status: "ready", generated_at: "2026-09-13T00:00:00Z",
    view: {
      interactionId: "i", status: "completed", evidenceStatus: "complete",
      claims: [{ id: "c", label: "Count", status: "located", supportStatus: "partial", attributionStatus: "reconstructed", nodeIds: ["u"] }],
      execution: { nodes: [{ id: "op", label: "Query", kind: "query", status: "recorded_result" }], edges: [] },
      evidence: { nodes: [{ id: "u", label: "Semantic query", kind: "query", status: "partial" }], edges: [] },
    },
  } });
  await expect(readCurrentExplanation("i")).resolves.toMatchObject({ status: "ready", view: { evidenceStatus: "complete", claims: [{ supportStatus: "partial", attributionStatus: "reconstructed" }] } });
});

it("rejects unknown semantic state values", async () => {
  get.mockResolvedValue({ data: {
    schema_version: "1", interaction_id: "i", status: "ready", generated_at: "2026-09-13T00:00:00Z",
    view: {
      interactionId: "i", status: "completed",
      claims: [{ id: "c", label: "Count", status: "located", supportStatus: "certain", attributionStatus: "reconstructed", nodeIds: [] }],
      execution: { nodes: [], edges: [] }, evidence: { nodes: [], edges: [] },
    },
  } });
  await expect(readCurrentExplanation("i")).rejects.toThrow("invalid conclusion");
});

it("rejects malformed question requirement coverage", async () => {
  get.mockResolvedValue({ data: {
    schema_version: "1", interaction_id: "i", status: "ready", generated_at: "2026-09-13T00:00:00Z",
    view: {
      interactionId: "i", status: "completed",
      requirements: [{ id: "r", label: "库存是多少", status: "certain", claimIds: ["c"] }],
      claims: [{ id: "c", label: "当前库存为 2 个", status: "located", supportStatus: "supported", attributionStatus: "reconstructed", nodeIds: ["u"], requirementIds: ["r"] }],
      execution: { nodes: [], edges: [] }, evidence: { nodes: [{ id: "u", label: "库存查询", kind: "query" }], edges: [] },
    },
  } });
  await expect(readCurrentExplanation("i")).rejects.toThrow("invalid question requirement");
});
