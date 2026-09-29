/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: {
    get: getMock,
    post: postMock,
  },
}));

import {
  executePython,
  getOrchestrationDetail,
} from "@/modules/execution-factory-lab/services/capabilities-lab.service";

describe("capabilities-lab.service", () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
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

  it("does not add legacy scope context to the sandbox execution API", async () => {
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
      {
        skipErrorToast: true,
        timeout: 60_000,
      },
    );
  });

  it("maps orchestration operator and audit user names from the business API", async () => {
    getMock.mockResolvedValueOnce({
      data: {
        enabled: true,
        operator_id: "operator-a",
        operator_name: "Inventory Operator",
        audit: {
          create_user: "user-a",
          create_user_name: "Alice",
          update_user: "user-b",
          update_user_name: "Bob",
        },
      },
    });

    await expect(getOrchestrationDetail("capability-a")).resolves.toMatchObject({
      enabled: true,
      operatorId: "operator-a",
      operatorName: "Inventory Operator",
      audit: {
        createUser: "user-a",
        createUserName: "Alice",
        updateUser: "user-b",
        updateUserName: "Bob",
      },
    });
    expect(getMock).toHaveBeenCalledWith(
      "/capabilities-lab/v1/capabilities/capability-a/orchestration",
      {},
    );
  });
});
