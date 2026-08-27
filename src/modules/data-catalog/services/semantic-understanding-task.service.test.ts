/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  buildSemanticUnderstandingTaskListParams,
  getSemanticUnderstandingTask,
  listSemanticUnderstandingTasks,
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
      start_time: 120,
      finish_time: 200,
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
      startTime: 120,
      finishTime: 200,
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
      status: "completed",
    });
  });

  it("maps backend completed and cancelled states", () => {
    const base = {
      agent_id: "semantic-agent",
      applied: false,
      apply_mode: "dry_run" as const,
      catalog_id: "catalog-1",
      confidence: 0,
      confidence_threshold: 0.8,
      create_time: 100,
      creator: { id: "user-1", name: "User", type: "user" },
      id: "task-1",
      scope: "catalog" as const,
      start_time: 120,
      finish_time: 200,
    };

    expect(mapSemanticUnderstandingTaskSummary({ ...base, status: "completed" }).status).toBe(
      "succeeded",
    );
    expect(mapSemanticUnderstandingTaskSummary({ ...base, status: "cancelled" }).status).toBe(
      "cancelled",
    );
  });
});

describe("semantic-understanding mock tasks", () => {
  it("serves the same mock task to the list and detail query", async () => {
    const list = await listSemanticUnderstandingTasks({}, { limit: 20, offset: 0 });
    const task = list.items.find((item) => item.id === "semantic-task-001");
    const detail = await getSemanticUnderstandingTask("semantic-task-001");

    expect(task).toMatchObject({ resourceId: "res-001", status: "succeeded" });
    expect(detail?.id).toBe("semantic-task-001");
    expect(typeof detail?.resultJson).toBe("string");
    expect(typeof detail?.applyDetailJson).toBe("string");
  });
});
