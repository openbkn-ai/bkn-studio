/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { indexStateOf } from "@/modules/data-catalog/lib/index-state";
import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";

function buildTask(
  status: BuildTask["status"],
  overrides: Partial<BuildTask> = {},
): BuildTask {
  return {
    buildKeyFields: [],
    createdAt: 1,
    createTime: "-",
    embeddingDegraded: false,
    embeddingFields: [],
    embeddingModel: "",
    error: null,
    failureDetail: "",
    finishTime: null,
    fulltextAnalyzer: "",
    fulltextFields: [],
    id: "task-1",
    indexUsable: status === "succeeded",
    lastEventAt: null,
    mode: "batch",
    modelDimensions: 0,
    resourceId: "resource-1",
    status,
    syncedCount: status === "succeeded" ? 10 : 0,
    totalCount: 10,
    vectorizedCount: status === "succeeded" ? 10 : 0,
    ...overrides,
  };
}

describe("indexStateOf · stopping and cancelled tasks", () => {
  it("keeps a stopping task in the active build bucket", () => {
    expect(indexStateOf([buildTask("stopping")]).key).toBe("building");

    const previous = buildTask("succeeded", { createdAt: 1, id: "completed" });
    const stopping = buildTask("stopping", { createdAt: 2, id: "stopping" });
    expect(indexStateOf([previous, stopping]).key).toBe("rebuilding");
  });

  it("does not treat a cancelled pending task as a failed index", () => {
    expect(indexStateOf([buildTask("cancelled")]).key).toBe("none");

    const previous = buildTask("succeeded", { createdAt: 1, id: "completed" });
    const cancelled = buildTask("cancelled", { createdAt: 2, id: "cancelled" });
    expect(indexStateOf([previous, cancelled]).key).toBe("built");
  });
});
