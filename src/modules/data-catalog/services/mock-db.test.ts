/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

import { isIncrementalField, isPrimaryKeyField } from "@/modules/data-catalog/lib/build-guards";
import { resourceQueryBlockReason } from "@/modules/data-catalog/lib/resource-query-availability";
import { fixedFilterSourceBlockReason } from "@/modules/data-catalog/lib/view-query-source";
import {
  filterValidationError,
  parseFilterCondition,
  parseFilterTree,
  hasUnsupportedFilterNodes,
} from "@/modules/data-catalog/lib/filter-tree";

import {
  mockBuildTasks,
  mockDiscoveringCatalogs,
  mockDiscoverRecords,
  mockResources,
  mockStartScan,
  withMockFilterability,
} from "./mock-db";

describe("data catalog discover-status mocks", () => {
  it("provides effective filterability for every seeded resource field", () => {
    for (const resource of mockResources) {
      for (const field of resource.schema) {
        expect(typeof field.filterable, `${resource.id}.${field.name}`).toBe("boolean");
      }
    }

    const resource = mockResources.find((item) => item.id === "res-index-config-demo");
    expect(resource).toBeDefined();
    for (const field of resource!.schema) {
      expect(field.filterable, field.type).toBe(
        !["binary", "json", "other", "ip"].includes(field.type),
      );
    }
  });

  it("provides compatible, partially incompatible and root-group filter demos with real source bindings", () => {
    const source = mockResources.find((item) => item.id === "res-filter-orders")!;
    for (const [id, incompatible] of [
      ["res-filter-compatible-view", false],
      ["res-filter-incompatible-view", true],
      ["res-filter-incompatible-root-view", true],
    ] as const) {
      const view = mockResources.find((item) => item.id === id)!;
      expect(view.logicalViewDefinition?.sourceResourceId).toBe(source.id);
      expect(view.schema.map((field) => [field.originalName, field.type])).toEqual(
        source.schema.map((field) => [field.originalName, field.type]),
      );
      const tree = parseFilterTree(view.logicalViewDefinition?.filterCondition);
      expect(hasUnsupportedFilterNodes(tree)).toBe(incompatible);
      expect(filterValidationError(tree, source.schema)).toBe(
        incompatible ? "unsupportedCondition" : null,
      );
      if (id === "res-filter-incompatible-view") {
        expect(tree.children[0]).toMatchObject({ kind: "rule", operation: "not_null" });
        expect(tree.children[3]).toMatchObject({
          kind: "group",
          operation: "or",
          children: [
            { kind: "rule" },
            { kind: "unsupported", reason: "legacyCondition" },
            { kind: "unsupported", reason: "unsupportedOperation" },
          ],
        });
      }
    }
  });

  it("defaults IP filtering to false while preserving explicit flags without changing the input", () => {
    const schema = [
      { name: "missing", type: "ip" },
      { name: "disabled", type: "ip", filterable: false },
      { name: "historical", type: "ip", filterable: true },
    ];
    const before = structuredClone(schema);

    expect(withMockFilterability(schema).map((field) => field.filterable)).toEqual([
      false,
      false,
      true,
    ]);
    expect(schema).toEqual(before);
  });

  it("grants delete on ordinary resource categories and keeps restricted examples read-only", () => {
    const restrictedIds = new Set([
      "res-permission-limited-orders",
      "res-summary-only-orders",
      "adp_bkn_concept_dataset",
    ]);
    for (const resource of mockResources) {
      if (restrictedIds.has(resource.id)) {
        expect(resource.operations).not.toContain("delete");
      } else {
        expect(resource.operations).toContain("delete");
      }
    }

    const missing = mockResources.find((item) => item.id === "res-source-missing");
    expect(missing).toMatchObject({
      lastDiscoverStatus: "missing",
    });
    expect(missing?.operations).toContain("delete");
    expect(missing && resourceQueryBlockReason(missing)).toBe("missing");

    const staleMissing = mockResources.find((item) => item.id === "res-stale-source-missing");
    expect(staleMissing).toMatchObject({
      status: "stale",
      lastDiscoverStatus: "missing",
    });
    expect(staleMissing?.operations).toContain("delete");
  });

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
      "integer",
      "unsigned integer",
      "float",
      "decimal",
      "string",
      "text",
      "date",
      "time",
      "datetime",
      "timestamp",
      "ip",
      "boolean",
      "binary",
      "json",
      "point",
      "shape",
      "vector",
      "other",
    ]);

    expect(
      mockResources.flatMap((resource) =>
        resource.schema
          .filter((field) => !canonicalTypes.has(field.type))
          .map((field) => `${resource.id}.${field.name}: ${field.type}`),
      ),
    ).toEqual([]);
  });

  it("provides source display names for the editable derived view", () => {
    const source = mockResources.find((item) => item.id === "res-orders");
    const view = mockResources.find((item) => item.id === "res-high-value-orders-view");

    expect(view?.logicalViewDefinition?.sourceResourceId).toBe(source?.id);
    for (const field of view?.schema ?? []) {
      const sourceField = source?.schema.find((item) => item.originalName === field.originalName);
      expect(sourceField?.displayName).toBeTruthy();
      expect(sourceField?.displayName).not.toBe(sourceField?.name);
    }
  });

  it("provides a 20-field index configuration demo with supported and fallback source types", () => {
    const resource = mockResources.find((item) => item.id === "res-index-config-demo");
    expect(resource?.schema).toHaveLength(20);
    expect(new Set(resource?.schema.map((field) => field.type))).toEqual(
      new Set([
        "integer",
        "unsigned integer",
        "float",
        "decimal",
        "string",
        "text",
        "date",
        "time",
        "datetime",
        "timestamp",
        "ip",
        "boolean",
        "binary",
        "json",
        "other",
      ]),
    );
    expect(resource?.sourceMetadata).toEqual({
      foreignKeyCount: 1,
      indexCount: 3,
      objectType: "table",
      originalDescription: "覆盖多类型字段、复合主键和增量同步游标的源端测试表。",
      originalName: "crm_core.index_config_demo",
      primaryKeys: ["tenant_id", "record_id"],
    });
  });

  it("provides source metadata for physical resources but not datasets", () => {
    for (const resource of mockResources) {
      if (resource.category === "dataset") {
        expect(resource.sourceMetadata).toBeUndefined();
        continue;
      }

      if (resource.category === "logical_view") {
        continue;
      }

      expect(resource.sourceMetadata?.objectType).toBe("table");
      expect(resource.sourceMetadata?.originalName).toBe(resource.sourceIdentifier);
      expect(typeof resource.sourceMetadata?.foreignKeyCount).toBe("number");
      expect(typeof resource.sourceMetadata?.indexCount).toBe("number");
      expect(typeof resource.sourceMetadata?.originalDescription).toBe("string");
    }
  });

  it("provides a derived view with valid source bindings and a nested fixed filter", () => {
    const view = mockResources.find((item) => item.id === "res-high-value-orders-view");
    const source = mockResources.find(
      (item) => item.id === view?.logicalViewDefinition?.sourceResourceId,
    );

    expect(view).toMatchObject({
      catalogId: "cat-001",
      category: "logical_view",
      enabled: true,
      logicalType: "derived",
      operations: ["view_detail", "query_data", "delete"],
      status: "active",
      sourceIdentifier: "res-high-value-orders-view",
      sourceMetadata: {
        sourceCategory: "table",
        objectType: "table",
        originalName: "crm_core.orders",
      },
    });
    expect(view?.sourceMetadata).toEqual({
      sourceCategory: source?.category,
      objectType: "table",
      originalName: "crm_core.orders",
    });
    expect(view?.lastDiscoverStatus).toBeUndefined();
    expect(source?.category).toBe("table");
    expect(view?.schema).toHaveLength(4);
    for (const field of view?.schema ?? []) {
      const sourceField = source?.schema.find((item) => item.name === field.originalName);
      expect(sourceField?.type).toBe(field.type);
      expect(field.displayName).toBeTruthy();
    }
    const filter = parseFilterCondition(view?.logicalViewDefinition?.filterCondition);
    expect(filter).not.toBeNull();
    expect(
      filter?.children.some((child) => child.kind === "group" && child.operation === "or"),
    ).toBe(true);
    expect(filterValidationError(filter!, source?.schema ?? [])).toBeNull();
  });

  it.each([
    { id: "res-query-source-switch-view", indexed: true, sourceBlock: null },
    { id: "res-query-source-fulltext-view", indexed: true, sourceBlock: "indexRequired" },
    { id: "res-query-source-no-index-view", indexed: false, sourceBlock: null },
  ])("provides usable bindings and channel metadata for $id", ({ id, indexed, sourceBlock }) => {
    const view = mockResources.find((item) => item.id === id)!;
    expect(view).toBeDefined();
    const source = mockResources.find(
      (item) => item.id === view.logicalViewDefinition?.sourceResourceId,
    )!;
    expect(source).toBeDefined();
    expect(resourceQueryBlockReason(view)).toBeNull();
    expect(resourceQueryBlockReason(source)).toBeNull();
    expect(view).toMatchObject({
      category: "logical_view",
      logicalType: "derived",
      sourceMetadata: { sourceCategory: "table" },
    });
    expect(source.localIndexStatus).toBe(indexed ? "available" : "unavailable");
    expect(Boolean(source.localIndexName)).toBe(indexed);
    for (const field of view.schema) {
      const sourceField = source.schema.find((item) => item.originalName === field.originalName);
      expect(sourceField?.type).toBe(field.type);
    }
    expect(view.schema.some((field) => field.originalName === "eligible")).toBe(false);
    const filter = parseFilterCondition(
      view.logicalViewDefinition?.filterCondition,
      indexed ? "local_index" : "source",
    );
    expect(filter).not.toBeNull();
    expect(
      filterValidationError(filter!, source.schema, indexed ? "local_index" : "source"),
    ).toBeNull();
    expect(fixedFilterSourceBlockReason(view.logicalViewDefinition?.filterCondition)).toBe(
      sourceBlock,
    );
  });

  it("provides a non-dataset resource with view-detail-only permissions", () => {
    const resource = mockResources.find((item) => item.id === "res-permission-limited-orders");

    expect(resource).toMatchObject({
      catalogId: "cat-008",
      category: "table",
      name: "view_detail_only_orders",
      operations: ["view_detail"],
    });
  });

  it.each(["res-permission-limited-orders", "res-summary-only-orders"])(
    "provides all feature types for the view-detail-only Resource %s",
    (resourceId) => {
      const resource = mockResources.find((item) => item.id === resourceId);
      const featureTypes = resource?.schema.flatMap(
        (field) => field.features?.map((feature) => feature.featureType) ?? [],
      );

      expect(featureTypes).toEqual(expect.arrayContaining(["keyword", "fulltext", "vector"]));
    },
  );

  it("provides a visible Resource for the summary-only Catalog mock", () => {
    const resource = mockResources.find((item) => item.id === "res-summary-only-orders");

    expect(resource).toMatchObject({
      catalogId: "cat-009",
      category: "table",
      name: "summary_only_orders",
      operations: ["view_detail"],
    });
  });

  it("provides a disabled resource while its catalog remains enabled", () => {
    const resource = mockResources.find((item) => item.id === "res-discovery-unchanged");

    expect(resource).toMatchObject({
      catalogId: "cat-001",
      enabled: false,
      lastDiscoverStatus: "unchanged",
    });
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
      const invalidKeys = [
        ...task.primaryKeyFields
          .filter((name) => {
            const field = fieldsByName.get(name);
            return !field || !isPrimaryKeyField(field);
          })
          .map((name) => `${task.id}.primaryKeyFields.${name}`),
        ...task.incrementalFields
          .filter((name) => {
            const field = fieldsByName.get(name);
            return !field || !isIncrementalField(field);
          })
          .map((name) => `${task.id}.incrementalFields.${name}`),
      ];
      expect(invalidKeys).toEqual([]);
    }
  });

  it("completes build-task catalog and resource references", () => {
    expect(mockBuildTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          catalogId: "cat-001",
          catalogName: "customer_master",
          resourceId: "res-customers",
          resourceName: "customers",
        }),
      ]),
    );
  });

  it("includes a completed batch task with no source rows", () => {
    expect(mockBuildTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "bt-empty-01",
          status: "completed",
          syncedCount: 0,
          totalCount: 0,
        }),
      ]),
    );
  });

  it("includes a partially progressed cancelled batch task", () => {
    expect(mockBuildTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "bt-cancelled-01",
          status: "cancelled",
          syncedCount: 24_030,
          totalCount: 96_120,
        }),
      ]),
    );
  });

  it("covers every Vega build-task status", () => {
    expect(new Set(mockBuildTasks.map((task) => task.status))).toEqual(
      new Set(["pending", "running", "stopping", "stopped", "completed", "failed", "cancelled"]),
    );
  });

  it("provides one resource for every discover status in customer_master", () => {
    const expectedStatuses = ["error", "missing", "new", "restored", "unchanged", "updated"];
    const resources = mockResources.filter(
      (resource) =>
        resource.catalogId === "cat-001" &&
        expectedStatuses.includes(resource.lastDiscoverStatus ?? ""),
    );

    expect([...new Set(resources.map((resource) => resource.lastDiscoverStatus))].sort()).toEqual(
      [...expectedStatuses].sort(),
    );

    const errorResources = resources.filter((resource) => resource.lastDiscoverStatus === "error");
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
