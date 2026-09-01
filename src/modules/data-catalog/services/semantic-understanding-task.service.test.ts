/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

import {
  buildSemanticUnderstandingTaskListParams,
  createResourceSemanticUnderstandingTask,
  deleteSemanticUnderstandingTask,
  getSemanticUnderstandingTask,
  listSemanticUnderstandingTasks,
  mapSemanticUnderstandingTaskSummary,
} from "@/modules/data-catalog/services/semantic-understanding-task.service";

describe("semantic-understanding task mocks", () => {
  it("creates a completed task with resource and catalog metadata", async () => {
    const task = await createResourceSemanticUnderstandingTask({
      applyMode: "fill_empty",
      resourceId: "res-customers",
    });

    try {
      expect(task).toMatchObject({
        applied: true,
        catalogId: "cat-001",
        catalogName: "customer_master",
        resourceId: "res-customers",
        resourceName: "customers",
        status: "completed",
      });
    } finally {
      await deleteSemanticUnderstandingTask(task.id);
    }
  });
});

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
      statuses: ["completed", "failed"],
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
      status: ["completed", "failed"],
    });
  });

  it("preserves backend completed and cancelled states", () => {
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
      "completed",
    );
    expect(mapSemanticUnderstandingTaskSummary({ ...base, status: "cancelled" }).status).toBe(
      "cancelled",
    );
  });
});

describe("semantic-understanding mock tasks", () => {
  it("covers every Vega semantic-understanding task status", async () => {
    const list = await listSemanticUnderstandingTasks({}, { limit: 20, offset: 0 });

    expect(new Set(list.items.map((task) => task.status))).toEqual(new Set([
      "pending",
      "running",
      "completed",
      "failed",
      "cancelled",
    ]));
  });

  it("includes a completed dry-run task whose result has not been applied", async () => {
    const list = await listSemanticUnderstandingTasks(
      { applied: false, statuses: ["completed"] },
      { limit: 20, offset: 0 },
    );

    expect(list.items).toEqual([
      expect.objectContaining({
        applyMode: "dry_run",
        applied: false,
        id: "semantic-task-006",
        status: "completed",
      }),
    ]);
  });

  it("serves the same mock task to the list and detail query", async () => {
    const list = await listSemanticUnderstandingTasks({}, { limit: 20, offset: 0 });
    const task = list.items.find((item) => item.id === "semantic-task-001");
    const detail = await getSemanticUnderstandingTask("semantic-task-001");

    expect(task).toMatchObject({ resourceId: "res-customers", status: "completed" });
    expect(detail?.id).toBe("semantic-task-001");
    expect(typeof detail?.resultJson).toBe("string");
    expect(typeof detail?.applyDetailJson).toBe("string");
  });
});

describe("resource semantic-understanding task history", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("walks every backend page instead of truncating the history at 100 rows", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    const backendTask = (id: string, createTime: number) => ({
      agent_id: "semantic-agent",
      applied: true,
      apply_mode: "fill_empty",
      catalog_id: "catalog-1",
      confidence: 0.9,
      confidence_threshold: 0.75,
      create_time: createTime,
      creator: { id: "user-1", name: "User", type: "user" },
      id,
      resource_id: "resource-1",
      scope: "resource",
      status: "completed",
    });
    getMock
      .mockResolvedValueOnce({
        data: { entries: [backendTask("newer", 200)], total_count: 101 },
      })
      .mockResolvedValueOnce({
        data: { entries: [backendTask("older", 100)], total_count: 101 },
      });
    const { listResourceSemanticUnderstandingTasks } = await import(
      "@/modules/data-catalog/services/semantic-understanding-task.service"
    );

    const tasks = await listResourceSemanticUnderstandingTasks("resource-1");

    expect(tasks.map((task) => task.id)).toEqual(["newer", "older"]);
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock.mock.calls.map((call) => call[1]?.params.offset)).toEqual([0, 100]);
  });
});
