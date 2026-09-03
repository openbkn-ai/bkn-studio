/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import {
  isIncrementalField,
  isPrimaryKeyField,
} from "@/modules/data-catalog/lib/build-guards";

import {
  mockBuildTasks,
  mockDiscoveringCatalogs,
  mockDiscoverRecords,
  mockResources,
  mockStartScan,
} from "./mock-db";

describe("data catalog discover-status mocks", () => {
  it("populates every Property field required by the resource contract", () => {
    for (const resource of mockResources) {
      for (const field of resource.schema) {
        expect(typeof field.name).toBe("string");
        expect(typeof field.displayName).toBe("string");
        expect(typeof field.type).toBe("string");
        expect(typeof field.description).toBe("string");
        expect(typeof field.originalName).toBe("string");
        expect(typeof field.originalType).toBe("string");
        expect(typeof field.originalDescription).toBe("string");
      }
    }
  });

  it("uses only Vega canonical field types", () => {
    const canonicalTypes = new Set([
      "integer", "unsigned integer", "float", "decimal", "string", "text",
      "date", "time", "datetime", "timestamp", "ip", "boolean", "binary",
      "json", "point", "shape", "vector", "other",
    ]);

    expect(
      mockResources.flatMap((resource) =>
        resource.schema
          .filter((field) => !canonicalTypes.has(field.type))
          .map((field) => `${resource.id}.${field.name}: ${field.type}`),
      ),
    ).toEqual([]);
  });

  it("provides a 20-field index configuration demo with representative source types", () => {
    const resource = mockResources.find((item) => item.id === "res-index-config-demo");
    expect(resource?.schema).toHaveLength(20);
    expect(new Set(resource?.schema.map((field) => field.type))).toEqual(new Set([
      "integer", "unsigned integer", "float", "decimal", "string", "text",
      "date", "time", "datetime", "timestamp", "ip", "boolean", "binary",
      "json", "point", "shape",
    ]));
  });

  it("keeps mock task key fields compatible with their resource schema", () => {
    const resourcesById = new Map(mockResources.map((resource) => [resource.id, resource]));

    for (const task of mockBuildTasks) {
      const resource = resourcesById.get(task.resourceId);
      expect(resource).toBeDefined();
      if (!resource) {
        continue;
      }
      const fieldsByName = new Map(resource.schema.map((field) => [field.name, field]));
      expect(task.primaryKeyFields.every((name) => isPrimaryKeyField(fieldsByName.get(name)!))).toBe(true);
      expect(task.incrementalFields.every((name) => isIncrementalField(fieldsByName.get(name)!))).toBe(true);
    }
  });

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

  it("finishes an interactively triggered catalog scan without leaving the catalog locked", () => {
    const catalogId = "catalog-interactive-scan-test";

    try {
      mockStartScan(catalogId);

      expect(mockDiscoveringCatalogs.has(catalogId)).toBe(false);
      expect(mockDiscoverRecords.get(catalogId)?.[0]).toMatchObject({
        foundResources: 0,
        newResources: 0,
        status: "succeeded",
      });
    } finally {
      mockDiscoverRecords.delete(catalogId);
      mockDiscoveringCatalogs.delete(catalogId);
    }
  });
});
