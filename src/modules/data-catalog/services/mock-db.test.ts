/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { mockBuildTasks, mockResources } from "./mock-db";

describe("data catalog discover-status mocks", () => {
  it("completes build-task catalog and resource references", () => {
    expect(mockBuildTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        catalogId: "cat-001",
        catalogName: "customer_master",
        resourceId: "res-customers",
        resourceName: "customers",
      }),
    ]));
  });

  it("includes a completed batch task with no source rows", () => {
    expect(mockBuildTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "bt-empty-01",
        status: "completed",
        syncedCount: 0,
        totalCount: 0,
      }),
    ]));
  });

  it("includes a partially progressed cancelled batch task", () => {
    expect(mockBuildTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "bt-cancelled-01",
        status: "cancelled",
        syncedCount: 24_030,
        totalCount: 96_120,
      }),
    ]));
  });

  it("covers every Vega build-task status", () => {
    expect(new Set(mockBuildTasks.map((task) => task.status))).toEqual(new Set([
      "pending",
      "running",
      "stopping",
      "stopped",
      "completed",
      "failed",
      "cancelled",
    ]));
  });

  it("provides one resource for every discover status in customer_master", () => {
    const expectedStatuses = [
      "error",
      "missing",
      "new",
      "restored",
      "unchanged",
      "updated",
    ];
    const resources = mockResources.filter(
      (resource) =>
        resource.catalogId === "cat-001" &&
        expectedStatuses.includes(resource.lastDiscoverStatus ?? ""),
    );

    expect([...new Set(resources.map((resource) => resource.lastDiscoverStatus))].sort()).toEqual(
      [...expectedStatuses].sort(),
    );

    const errorResources = resources.filter(
      (resource) => resource.lastDiscoverStatus === "error",
    );
    expect(errorResources.some((resource) => resource.schema.length === 0)).toBe(true);
    expect(errorResources.some((resource) => resource.schema.length > 0)).toBe(true);
  });

  it("keeps build-task mock data static", () => {
    vi.useFakeTimers();
    const task = mockBuildTasks.find((item) => item.id === "bt-orders-01");
    const resource = mockResources.find((item) => item.id === "res-orders");
    expect(task).toBeDefined();
    expect(resource).toBeDefined();

    if (!task || !resource) {
      return;
    }

    const originalExpectedUpdateTime = resource.expectedUpdateTime;
    const originalUpdateTime = resource.updateTime;

    const originalTask = { ...task };
    try {
      task.status = "running";
      task.syncedCount = task.totalCount - 1;
      vi.advanceTimersByTime(5_000);

      expect(task).toMatchObject({ status: "running", syncedCount: task.totalCount - 1 });
      expect(resource.expectedUpdateTime).toBe(originalExpectedUpdateTime);
      expect(resource.updateTime).toBe(originalUpdateTime);
    } finally {
      Object.assign(task, originalTask);
      vi.useRealTimers();
    }
  });
});
