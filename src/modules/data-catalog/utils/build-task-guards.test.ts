/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";
import { describe, expect, it } from "vitest";

import {
  isActiveBuildTask,
  isBuildStartRejected,
} from "@/modules/data-catalog/utils/build-task-guards";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

function task(status: BuildTask["status"]): BuildTask {
  return {
    id: "t1",
    resourceId: "r1",
    mode: "batch",
    status,
    embeddingFields: [],
    primaryKeyFields: [],
    incrementalFields: [],
    embeddingModel: "",
    modelDimensions: 0,
    fulltextFields: [],
    fulltextAnalyzer: "",
    totalCount: 0,
    syncedCount: 0,
    createTime: 0,
    finishTime: null,
    lastProgressTime: null,
    startTime: null,
    error: null,
  };
}

describe("build-task-guards", () => {
  it("treats pending/running/listening/stopping as active", () => {
    expect(isActiveBuildTask(task("pending"))).toBe(true);
    expect(isActiveBuildTask(task("running"))).toBe(true);
    expect(isActiveBuildTask(task("running"))).toBe(true);
    expect(isActiveBuildTask(task("stopped"))).toBe(false);
    expect(isActiveBuildTask(task("stopping"))).toBe(true);
    expect(isActiveBuildTask(task("cancelled"))).toBe(false);
    expect(isActiveBuildTask(task("completed"))).toBe(false);
    expect(isActiveBuildTask(null)).toBe(false);
  });

  it("detects start rejection HTTP statuses", () => {
    const make = (status: number) =>
      new axios.AxiosError(
        "rejected",
        undefined,
        undefined,
        undefined,
        {
          status,
          statusText: "x",
          headers: {},
          config: {} as never,
          data: {},
        },
      );

    expect(isBuildStartRejected(make(400))).toBe(true);
    expect(isBuildStartRejected(make(409))).toBe(true);
    expect(isBuildStartRejected(make(422))).toBe(true);
    expect(isBuildStartRejected(make(500))).toBe(false);
    expect(isBuildStartRejected(new Error("plain"))).toBe(false);
  });
});
