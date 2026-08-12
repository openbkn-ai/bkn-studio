/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock, post: postMock },
}));

import {
  createBuildTask,
  mapBuildTask,
  snapshotFieldsOf,
} from "@/modules/data-catalog/services/build-task.service";

describe("snapshotFieldsOf", () => {
  it("retains the effective analyzer for every fulltext field", () => {
    const snapshot = snapshotFieldsOf({
      id: "task-1",
      index_config: {
        features: {
          coupon_code: { fulltext: { analyzer: "standard" } },
          status: { fulltext: { analyzer: "hanlp_index" } },
        },
      },
    });

    expect(snapshot.fulltextAnalyzer).toBe("standard");
    expect(snapshot.fulltextAnalyzers).toEqual({
      coupon_code: "standard",
      status: "hanlp_index",
    });
  });

  it("uses standard for fulltext fields without an analyzer in the snapshot", () => {
    const snapshot = snapshotFieldsOf({
      id: "task-1",
      index_config: {
        features: {
          title: { fulltext: {} },
          status: { fulltext: { config: { analyzer: "hanlp_index" } } },
        },
      },
    });

    expect(snapshot.fulltextAnalyzer).toBe("standard");
    expect(snapshot.fulltextAnalyzers).toEqual({
      title: "standard",
      status: "hanlp_index",
    });
  });
});

describe("mapBuildTask", () => {
  it("retains the persisted batch execute type", () => {
    const task = mapBuildTask({
      id: "task-1",
      mode: "batch",
      execute_type: "incremental",
    });

    expect(task.executeType).toBe("incremental");
  });

  it("does not assign an execution type to streaming tasks", () => {
    const task = mapBuildTask({ id: "task-1", mode: "streaming" });

    expect(task.executeType).toBeUndefined();
  });

  it("keeps stopping distinct and preserves cancelled", () => {
    expect(mapBuildTask({ id: "task-1", status: "stopping" }).status).toBe("stopping");
    expect(mapBuildTask({ id: "task-2", status: "stopped" }).status).toBe("paused");
    expect(mapBuildTask({ id: "task-3", status: "cancelled" }).status).toBe("cancelled");
  });
});

describe("createBuildTask", () => {
  it("retains the selected incremental type in mock mode", async () => {
    const task = await createBuildTask({
      executeType: "incremental",
      mode: "batch",
      resourceId: "mock-incremental-task-resource",
    });

    expect(task.executeType).toBe("incremental");
  });

  describe("when using the API", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.stubEnv("VITE_USE_MOCK", "false");
      getMock.mockReset();
      postMock.mockReset();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("rejects when the created task cannot be retrieved", async () => {
      postMock.mockResolvedValue({ data: { id: "task-1" } });
      getMock.mockResolvedValue({ data: null });
      const { createBuildTask: createWithAPI } = await import(
        "@/modules/data-catalog/services/build-task.service"
      );

      await expect(
        createWithAPI({ mode: "batch", resourceId: "resource-1" }),
      ).rejects.toThrow("Created build task task-1 could not be retrieved");
    });

    it("sends repeated backend status parameters without active", async () => {
      getMock.mockResolvedValue({ data: { entries: [], total_count: 0 } });
      const { listBuildTaskPage } = await import(
        "@/modules/data-catalog/services/build-task.service"
      );

      await listBuildTaskPage({
        page: 1,
        pageSize: 20,
        statuses: ["stopping", "paused", "cancelled"],
      });

      expect(getMock).toHaveBeenCalledOnce();
      expect(getMock.mock.calls[0]?.[0]).toBe("/vega-backend/v1/build-tasks");
      const config = getMock.mock.calls[0]?.[1] as {
        params: Record<string, unknown>;
        paramsSerializer: { indexes: null };
      };
      expect(config.params.status).toEqual(["stopping", "stopped", "cancelled"]);
      expect(config.paramsSerializer).toEqual({ indexes: null });
      expect(config.params).not.toHaveProperty("active");
    });
  });
});
