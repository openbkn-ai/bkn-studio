/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { runningIdsFromError } from "@/framework/safety/delete-guard";

function axios409(data: unknown): AxiosError {
  const error = new AxiosError("conflict");
  error.response = {
    config: { headers: new AxiosHeaders() },
    data,
    headers: {},
    status: 409,
    statusText: "Conflict",
  };
  return error;
}

describe("runningIdsFromError — 409 HasRunningExecution 识别", () => {
  it("409 带 running_ids → 返回该数组", () => {
    expect(runningIdsFromError(axios409({ running_ids: ["t1", "t2"] }))).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("409 无 running_ids → 返回空数组(仍判定为运行中冲突)", () => {
    expect(runningIdsFromError(axios409({}))).toEqual([]);
  });

  it("非 409 的 axios 错误 → null", () => {
    const error = new AxiosError("server error");
    error.response = {
      config: { headers: new AxiosHeaders() },
      data: {},
      headers: {},
      status: 500,
      statusText: "Internal Server Error",
    };
    expect(runningIdsFromError(error)).toBeNull();
  });

  it("普通 Error → null", () => {
    expect(runningIdsFromError(new Error("boom"))).toBeNull();
  });
});
