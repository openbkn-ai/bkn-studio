/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildSemanticUnderstandingTaskListParams,
  mapSemanticUnderstandingTaskSummary,
} from "@/modules/data-catalog/services/semantic-understanding-task.service";

describe("mapSemanticUnderstandingTaskSummary", () => {
  it("maps the list contract without inventing fallback values", () => {
    const summary = mapSemanticUnderstandingTaskSummary({
      agent_id: "semantic-agent",
      applied: false,
      apply_mode: "dry_run",
      catalog_id: "catalog-1",
      confidence: 0,
      confidence_threshold: 0.8,
      create_time: 100,
      creator: { id: "user-1", name: "User", type: "user" },
      id: "task-1",
      scope: "catalog",
      status: "running",
      update_time: 200,
    });

    expect(summary).toMatchObject({
      agentId: "semantic-agent",
      applied: false,
      applyMode: "dry_run",
      catalogId: "catalog-1",
      confidence: 0,
      confidenceThreshold: 0.8,
      createTime: 100,
      creator: { id: "user-1", name: "User", type: "user" },
      id: "task-1",
      scope: "catalog",
      status: "running",
      updateTime: 200,
    });
  });
});

describe("buildSemanticUnderstandingTaskListParams", () => {
  it("defaults to creation time descending and computes the page offset", () => {
    expect(buildSemanticUnderstandingTaskListParams(3, 20, {})).toMatchObject({
      direction: "desc",
      limit: 20,
      offset: 40,
      sort: "create_time",
    });
  });

  it("preserves explicit filters and direction", () => {
    expect(buildSemanticUnderstandingTaskListParams(1, 10, {
      applied: true,
      applyMode: "force",
      catalogId: "catalog-1",
      direction: "asc",
      resourceId: "resource-1",
      scope: "resource",
      status: "succeeded",
    })).toEqual({
      applied: true,
      apply_mode: "force",
      catalog_id: "catalog-1",
      direction: "asc",
      limit: 10,
      offset: 0,
      resource_id: "resource-1",
      scope: "resource",
      sort: "create_time",
      status: "succeeded",
    });
  });
});
