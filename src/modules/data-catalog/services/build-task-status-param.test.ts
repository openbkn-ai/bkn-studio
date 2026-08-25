/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { backendStatusParams } from "@/modules/data-catalog/services/build-task.service";

// Locks the frontend-normalized-state to backend-enum mapping; the real backend cannot be verified locally, so this protects the contract.
describe("backendStatusParams — 前端状态 → 后端重复查询参数", () => {
  it("区分 stopping 和可恢复的 stopped", () => {
    expect(backendStatusParams(["stopping"])).toEqual(["stopping"]);
    expect(backendStatusParams(["stopped"])).toEqual(["stopped"]);
  });

  it("映射前端归一化状态", () => {
    expect(backendStatusParams(["pending"])).toEqual(["pending"]);
    expect(backendStatusParams(["running"])).toEqual(["running"]);
    expect(backendStatusParams(["completed"])).toEqual(["completed"]);
    expect(backendStatusParams(["failed"])).toEqual(["failed"]);
    expect(backendStatusParams(["cancelled"])).toEqual(["cancelled"]);
  });

  it("listening 也映射到后端 running,与 running 去重", () => {
    expect(backendStatusParams(["running", "running"])).toEqual(["running"]);
  });

  it("多状态展开并去重", () => {
    expect(backendStatusParams(["running", "stopping", "stopped", "failed"])).toEqual([
      "running",
      "stopping",
      "stopped",
      "failed",
    ]);
  });
});
