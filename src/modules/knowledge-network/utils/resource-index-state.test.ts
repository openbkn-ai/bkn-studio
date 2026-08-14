/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";
import {
  formatResourceIndexStateLabel,
  hasServingResourceIndex,
} from "@/modules/knowledge-network/utils/resource-index-state";

function buildTask(
  status: BuildTask["status"],
  overrides: Partial<BuildTask> = {},
): BuildTask {
  return {
    id: "task-1",
    resourceId: "res-1",
    mode: "batch",
    status,
    embeddingFields: [],
    buildKeyFields: [],
    embeddingModel: "",
    embeddingDegraded: false,
    modelDimensions: 0,
    fulltextFields: [],
    fulltextAnalyzer: "",
    totalCount: 10,
    syncedCount: status === "succeeded" ? 10 : 0,
    vectorizedCount: status === "succeeded" ? 10 : 0,
    indexUsable: status === "succeeded",
    failureDetail: "",
    createTime: 1,
    finishTime: null,
    lastProgressTime: null,
    startTime: null,
    error: null,
    ...overrides,
  };
}

const succeededTask = buildTask("succeeded", { id: "task-2", createTime: 2 });
const failedTask = buildTask("failed", { id: "task-3", createTime: 3 });

describe("hasServingResourceIndex", () => {
  it("returns true when a succeeded build exists", () => {
    expect(hasServingResourceIndex([failedTask, succeededTask])).toBe(true);
  });

  it("returns false when there are no serving tasks", () => {
    expect(hasServingResourceIndex([])).toBe(false);
    expect(hasServingResourceIndex([failedTask])).toBe(false);
  });
});

describe("formatResourceIndexStateLabel", () => {
  it("uses data-catalog index state labels", () => {
    const t = ((key: string) => key) as never;
    expect(formatResourceIndexStateLabel([succeededTask], t)).toBe("dataCatalog.indexState.built");
    expect(formatResourceIndexStateLabel([], t)).toBe("dataCatalog.indexState.none");
  });
});
