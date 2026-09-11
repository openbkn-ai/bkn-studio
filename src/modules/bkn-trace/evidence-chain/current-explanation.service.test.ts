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
