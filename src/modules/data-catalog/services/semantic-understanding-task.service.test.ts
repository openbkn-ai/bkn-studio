/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { mockResources } from "./mock-db";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

import {
  applySemanticUnderstandingTask,
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

describe("createResourceSemanticUnderstandingTask", () => {
  it.each(["en-US", "zh-CN"] as const)("sends selected output language %s", async (language) => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockResolvedValue({ data: { id: "task-1" } });
    const { createResourceSemanticUnderstandingTask: createTask } =
      await import("@/modules/data-catalog/services/semantic-understanding-task.service");
    await createTask({ resourceId: "resource-1", applyMode: "dry_run", language });
    expect(postMock).toHaveBeenLastCalledWith(
      "/vega-backend/v1/semantic-understanding-tasks",
      expect.objectContaining({ language }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the selected sample row limit to Vega", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockResolvedValue({ data: { id: "task-1" } });
    const { createResourceSemanticUnderstandingTask: createTask } =
      await import("@/modules/data-catalog/services/semantic-understanding-task.service");

    await createTask({
      applyMode: "dry_run",
      includeSampleRows: true,
      resourceId: "resource-1",
      sampleMaxRows: 20,
    });

    expect(postMock).toHaveBeenCalledWith("/vega-backend/v1/semantic-understanding-tasks", {
      apply_mode: "dry_run",
      confidence_threshold: undefined,
      include_sample_rows: true,
      resource_id: "resource-1",
      sample_policy: { masked: false, max_rows: 20 },
      scope: "resource",
    });
  });

  it.each([1, 20])("sends valid sample row boundaries to Vega: %s", async (sampleMaxRows) => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockClear();
    postMock.mockResolvedValue({ data: { id: "task-1" } });
    const { createResourceSemanticUnderstandingTask: createTask } =
      await import("@/modules/data-catalog/services/semantic-understanding-task.service");

    await createTask({
      applyMode: "dry_run",
      includeSampleRows: true,
      resourceId: "resource-1",
      sampleMaxRows,
    });

    expect(postMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sample_policy: { masked: false, max_rows: sampleMaxRows },
      }),
    );
  });

  it.each([0, 21, 30, -1, 1.5])(
    "rejects invalid sample row limits before sending a request: %s",
    async (sampleMaxRows) => {
      vi.resetModules();
      vi.stubEnv("VITE_USE_MOCK", "false");
      postMock.mockClear();
      const { createResourceSemanticUnderstandingTask: createTask } =
        await import("@/modules/data-catalog/services/semantic-understanding-task.service");

      await expect(
        createTask({
          applyMode: "dry_run",
          includeSampleRows: true,
          resourceId: "resource-1",
          sampleMaxRows,
        }),
      ).rejects.toThrow("sampleMaxRows must be an integer between 1 and 20");
      expect(postMock).not.toHaveBeenCalled();
    },
  );
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
    expect(
      buildSemanticUnderstandingTaskListParams(1, 10, {
        applied: true,
        applyMode: "force",
        catalogId: "catalog-1",
        direction: "asc",
        resourceId: "resource-1",
        scope: "resource",
        statuses: ["completed", "failed"],
      }),
    ).toEqual({
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

    expect(new Set(list.items.map((task) => task.status))).toEqual(
      new Set(["pending", "running", "completed", "failed", "cancelled"]),
    );
  });

  it("includes a completed dry-run task whose result has not been applied", async () => {
    const list = await listSemanticUnderstandingTasks(
      { applied: false, statuses: ["completed"] },
      { limit: 20, offset: 0 },
    );

    expect(list.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          applyMode: "dry_run",
          applied: false,
          id: "semantic-task-006",
          status: "completed",
        }),
      ]),
    );
  });

  it("serves the same mock task to the list and detail query", async () => {
    const list = await listSemanticUnderstandingTasks({}, { limit: 20, offset: 0 });
    const task = list.items.find((item) => item.id === "semantic-task-001");
    const detail = await getSemanticUnderstandingTask("semantic-task-001");

    expect(task).toMatchObject({ resourceId: "res-customers", status: "completed" });
    expect(detail?.id).toBe("semantic-task-001");
    expect(typeof detail?.resultJson).toBe("string");
    expect(typeof detail?.applyDetailJson).toBe("string");
    expect(JSON.parse(detail?.confidenceDetailJson ?? "{}")).toMatchObject({
      warning_details: [
        {
          code: "sample_omitted_by_policy",
          params: { field_name: "attachment_blob", field_type: "binary" },
        },
      ],
    });
  });
});

describe("semantic-understanding task list", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("preserves Vega's filtered total count for pagination", async () => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockResolvedValue({ data: { entries: [], total_count: 36 } });
    const { listSemanticUnderstandingTasks: listWithAPI } =
      await import("@/modules/data-catalog/services/semantic-understanding-task.service");

    const result = await listWithAPI({ statuses: ["completed"] }, { limit: 20, offset: 0 });

    expect(result).toEqual({ items: [], total: 36 });
  });

  it("forwards the local error-toast suppression option", async () => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
    const { listSemanticUnderstandingTasks: listWithAPI } =
      await import("@/modules/data-catalog/services/semantic-understanding-task.service");

    await listWithAPI({}, { limit: 10, offset: 0 }, { skipErrorToast: true });

    expect(getMock).toHaveBeenCalledWith(
      "/vega-backend/v1/semantic-understanding-tasks",
      expect.objectContaining({ skipErrorToast: true }),
    );
  });
});

describe("applySemanticUnderstandingTask", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("posts the selected strategy and preserves the original dry-run result", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockResolvedValue({
      data: {
        id: "task/1",
        scope: "resource",
        catalog_id: "catalog-1",
        resource_id: "resource-1",
        agent_id: "semantic-agent",
        apply_mode: "dry_run",
        status: "completed",
        applied: true,
        confidence: 0.9,
        confidence_threshold: 0.75,
        create_time: 1,
        creator: { id: "user-1", type: "user" },
        input: "",
        result_json: "saved-result",
        apply_detail_json: '{"apply_mode":"force"}',
      },
    });
    const { applySemanticUnderstandingTask: applyTask } =
      await import("./semantic-understanding-task.service");
    const task = await applyTask("task/1", "force");
    expect(postMock).toHaveBeenLastCalledWith(
      "/vega-backend/v1/semantic-understanding-tasks/task%2F1/apply",
      { apply_mode: "force" },
      { skipErrorToast: true },
    );
    expect(task).toMatchObject({
      applyMode: "dry_run",
      applied: true,
      resultJson: "saved-result",
      input: "",
    });
  });

  it("applies saved mock suggestions to the resource without replacing task output", async () => {
    const resource = mockResources.find((item) => item.id === "res-customers")!;
    const original = structuredClone(resource);
    const task = await createResourceSemanticUnderstandingTask({
      resourceId: resource.id,
      applyMode: "dry_run",
    });
    const savedTask = (await getSemanticUnderstandingTask(task.id))!;
    const input = savedTask.input,
      result = savedTask.resultJson;
    try {
      const applied = await applySemanticUnderstandingTask(task.id, "force");
      expect(applied).toMatchObject({
        applyMode: "dry_run",
        applied: true,
        input,
        resultJson: result,
      });
      expect(resource.schema[0].description).not.toBe(original.schema[0].description);
      expect(JSON.parse(applied.applyDetailJson!)).toMatchObject({ apply_mode: "force" });
      const snapshot = JSON.stringify(resource);
      await applySemanticUnderstandingTask(task.id, "force");
      expect(JSON.stringify(resource)).toBe(snapshot);
    } finally {
      Object.assign(resource, original);
      await deleteSemanticUnderstandingTask(task.id);
    }
  });

  it("rejects a mock schema change including attributes without mutating metadata", async () => {
    const resource = mockResources.find((item) => item.id === "res-customers")!;
    const original = structuredClone(resource);
    const task = await createResourceSemanticUnderstandingTask({
      resourceId: resource.id,
      applyMode: "dry_run",
    });
    try {
      resource.schema[0].attributes = { precision: 42 };
      const snapshot = JSON.stringify(resource);
      await expect(applySemanticUnderstandingTask(task.id, "force")).rejects.toMatchObject({
        response: { status: 409 },
      });
      expect(JSON.stringify(resource)).toBe(snapshot);
      expect((await getSemanticUnderstandingTask(task.id))?.applied).toBe(false);
    } finally {
      Object.assign(resource, original);
      await deleteSemanticUnderstandingTask(task.id);
    }
  });
});

describe("saved mock semantic application boundaries", () => {
  it("accepts absent legacy attributes when current attributes are empty", async () => {
    const resource = mockResources.find((item) => item.id === "res-customers")!;
    const original = structuredClone(resource);
    resource.schema = resource.schema.map((field) => ({ ...field, attributes: undefined }));
    const task = await createResourceSemanticUnderstandingTask({
      resourceId: resource.id,
      applyMode: "dry_run",
    });
    try {
      resource.schema = resource.schema.map((field) => ({ ...field, attributes: {} }));
      const applied = await applySemanticUnderstandingTask(task.id, "force");
      expect(applied.applied).toBe(true);
      expect(applied.applyMode).toBe("dry_run");
    } finally {
      Object.assign(resource, original);
      await deleteSemanticUnderstandingTask(task.id);
    }
  });

  it("cannot force a below-threshold result or mutate the original threshold", async () => {
    const resource = mockResources.find((item) => item.id === "res-customers")!;
    const task = await createResourceSemanticUnderstandingTask({
      resourceId: resource.id,
      applyMode: "dry_run",
      confidenceThreshold: 0.95,
    });
    const before = JSON.stringify(resource);
    try {
      await expect(applySemanticUnderstandingTask(task.id, "force")).rejects.toMatchObject({
        response: { status: 409 },
      });
      expect(JSON.stringify(resource)).toBe(before);
      expect((await getSemanticUnderstandingTask(task.id))?.confidenceThreshold).toBe(0.95);
    } finally {
      await deleteSemanticUnderstandingTask(task.id);
    }
  });

  it("completes no-change application and does not replay it with another strategy", async () => {
    const resource = mockResources.find((item) => item.id === "res-customers")!;
    const original = structuredClone(resource);
    const task = await createResourceSemanticUnderstandingTask({
      resourceId: resource.id,
      applyMode: "dry_run",
    });
    try {
      resource.schema = resource.schema.map((field) => ({
        ...field,
        description: "Custom business description",
        displayName: "Custom name",
      }));
      const before = JSON.stringify(resource);
      const unchanged = await applySemanticUnderstandingTask(task.id, "fill_empty");
      expect(unchanged.applied).toBe(true);
      expect(JSON.parse(unchanged.applyDetailJson!)).toMatchObject({
        reason: "no_resource_changes",
        apply_mode: "fill_empty",
      });
      expect(JSON.stringify(resource)).toBe(before);
      const repeated = await applySemanticUnderstandingTask(task.id, "force");
      expect(repeated).toEqual(unchanged);
      expect(repeated.applyMode).toBe("dry_run");
      expect(JSON.stringify(resource)).toBe(before);
      expect((await getSemanticUnderstandingTask(task.id))?.applied).toBe(true);
    } finally {
      Object.assign(resource, original);
      await deleteSemanticUnderstandingTask(task.id);
    }
  });
});
