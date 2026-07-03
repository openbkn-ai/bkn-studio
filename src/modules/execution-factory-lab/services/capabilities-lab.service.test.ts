/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: {
    post: postMock,
  },
}));

import { executePython } from "@/modules/execution-factory-lab/services/capabilities-lab.service";

describe("capabilities-lab.service", () => {
  beforeEach(() => {
    postMock.mockReset();
    vi.spyOn(Date, "now").mockReturnValue(1_783_000_000_000);
    postMock.mockResolvedValue({
      data: {
        output: { ok: true },
        stdout: "done",
        duration_ms: 15,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes function debug business context to the real sandbox execution API", async () => {
    await executePython({
      code: "def handler(event):\n    return event",
      event: { city: "beijing" },
      capabilityName: "天气归一化函数",
    });

    expect(postMock).toHaveBeenCalledWith(
      "/capabilities-lab/v1/function/execute",
      {
        code: "def handler(event):\n    return event",
        event: { city: "beijing" },
        timeout: undefined,
        source: "function_debug",
        task_id: "function_debug_1783000000000",
        capability_id: undefined,
        capability_name: "天气归一化函数",
        user_id: "266c6a42-6131-4d62-8f39-853e7093701c",
        user_name: "Local Admin",
      },
      expect.objectContaining({
        headers: { "x-business-domain": "bd_public" },
        skipErrorToast: true,
        timeout: 60_000,
      }),
    );
  });
});
