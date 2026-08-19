/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { ensureMockTicker, mockBuildTasks, mockResources } from "./mock-db";

describe("data catalog discover-status mocks", () => {
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

  it("does not advance the resource version when a build task completes", () => {
    vi.useFakeTimers();

    const task = mockBuildTasks.find((item) => item.id === "bt-orders-01");
    const resource = mockResources.find((item) => item.id === "res-orders");
    expect(task).toBeDefined();
    expect(resource).toBeDefined();

    if (!task || !resource) {
      return;
    }

    const originalTask = { ...task };
    const originalExpectedUpdateTime = resource.expectedUpdateTime;
    const originalUpdateTime = resource.updateTime;

    try {
      task.status = "running";
      task.syncedCount = task.totalCount - 1;
      ensureMockTicker();
      vi.advanceTimersByTime(1100);

      expect(task.status).toBe("succeeded");
      expect(resource.expectedUpdateTime).toBe(originalExpectedUpdateTime);
      expect(resource.updateTime).toBe(originalUpdateTime);
    } finally {
      Object.assign(task, originalTask);
      vi.useRealTimers();
    }
  });
});
