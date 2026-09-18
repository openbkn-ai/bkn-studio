/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import i18n from "@/app/locales/i18n";
import {
  grantableOperationsForType,
  mockAuthorizationRegistry,
  normalizeAuthorizationRegistry,
} from "@/modules/system-admin/services/authorization-registry.service";
import { useAuthorizationRegistry } from "@/modules/system-admin/hooks/use-authorization-registry";

describe("authorization registry contract", () => {
  it("preserves explicit parent fallback and same-resource requirements", () => {
    const catalog = normalizeAuthorizationRegistry({
      resource_types: [
        {
          id: "object_type",
          name: "Object Type",
          parent_type: "knowledge_network",
          operations: [
            {
              id: "view_detail",
              name: "View Detail",
              description: "Read this object type.",
              parent_operation: "view_detail",
              requires: [],
            },
            { id: "query_data", name: "Query Data", parent_operation: "query_data", requires: [] },
            { id: "modify", name: "Modify", parent_operation: "modify", requires: ["view_detail"] },
          ],
        },
      ],
    });

    expect(catalog.resourceTypes).toEqual([
      {
        id: "object_type",
        name: "Object Type",
        parentType: "knowledge_network",
        operations: [
          {
            id: "view_detail",
            name: "View Detail",
            description: "Read this object type.",
            grantable: true,
            parentOperation: "view_detail",
            requires: [],
          },
          {
            id: "query_data",
            name: "Query Data",
            grantable: true,
            parentOperation: "query_data",
            requires: [],
          },
          {
            id: "modify",
            name: "Modify",
            grantable: true,
            parentOperation: "modify",
            requires: ["view_detail"],
          },
        ],
      },
    ]);
  });

  it("defaults legacy operations to grantable and hides explicitly read-only operations", () => {
    const catalog = normalizeAuthorizationRegistry({
      resource_types: [
        {
          id: "catalog",
          operations: [{ id: "view_detail" }, { id: "view_summary", grantable: false }],
        },
      ],
    });

    expect(catalog.resourceTypes[0]?.operations).toEqual([
      {
        id: "view_detail",
        name: "view_detail",
        grantable: true,
        parentOperation: undefined,
        requires: [],
      },
      {
        id: "view_summary",
        name: "view_summary",
        grantable: false,
        parentOperation: undefined,
        requires: [],
      },
    ]);
    expect(grantableOperationsForType(catalog, "catalog").map((operation) => operation.id)).toEqual(
      ["view_detail"],
    );
  });

  it("does not invent requirements for independent operations", () => {
    const catalog = normalizeAuthorizationRegistry({
      resource_types: [
        {
          id: "resource",
          name: "Data Resource",
          operations: [{ id: "query_data", name: "Query Data" }],
        },
      ],
    });

    expect(catalog.resourceTypes[0]?.operations[0]?.requires).toEqual([]);
  });

  it("rejects an empty or internally incomplete registry", () => {
    expect(() => normalizeAuthorizationRegistry({})).toThrow(/does not contain any resource types/);
    expect(() =>
      normalizeAuthorizationRegistry({
        resource_types: [
          {
            id: "catalog",
            operations: [{ id: "resource_manage", requires: ["view_detail"] }],
          },
        ],
      }),
    ).toThrow(/unknown requirement/);
  });

  it("keeps the function resource type in the mock registry", () => {
    const functionType = mockAuthorizationRegistry().resourceTypes.find(
      (resourceType) => resourceType.id === "function",
    );

    expect(functionType?.operations.map((operation) => operation.id)).toEqual(
      expect.arrayContaining(["view", "modify", "execute"]),
    );
    expect(
      functionType?.operations.find((operation) => operation.id === "modify")?.requires,
    ).toEqual(["view"]);
  });

  it("uses localized catalog operation descriptions and labels", async () => {
    await act(() => i18n.changeLanguage("en-US"));
    const { result } = renderHook(() => useAuthorizationRegistry());

    await waitFor(() => expect(result.current.catalog).toBeDefined());
    expect(
      result.current.operationsForType("catalog").find((item) => item.key === "data_write"),
    ).toMatchObject({
      description:
        "Write or delete dataset documents only; MariaDB/MySQL and other physical-table data is not supported. When a data resource in the catalog is not explicitly granted data-write permission, access falls back to the data catalog data-write permission. Also requires the data catalog view permission.",
      label: "Write",
    });
    expect(
      result.current.operationsForType("agent").find((item) => item.key === "use"),
    ).toMatchObject({ description: "Use the data agent.", label: "Use" });

    await act(() => i18n.changeLanguage("zh-CN"));
    await waitFor(() =>
      expect(
        result.current.operationsForType("catalog").find((item) => item.key === "data_write"),
      ).toMatchObject({
        description:
          "仅可写入或删除数据集文档，不支持操作 MariaDB/MySQL 等物理表数据。当目录下数据资源未显式授予写入权限时，可回退到数据目录的写入权限。需要同时具有查看数据目录权限。",
        label: "写入",
      }),
    );
  });

  it("provides a type-specific localized description for every mock operation", async () => {
    const registry = mockAuthorizationRegistry();

    for (const language of ["en-US", "zh-CN"]) {
      await act(() => i18n.changeLanguage(language));
      for (const resourceType of registry.resourceTypes) {
        for (const operation of resourceType.operations) {
          expect(
            i18n.exists(
              `systemAdmin.resourceCatalog.operationDescriptions.${resourceType.id}.${operation.id}`,
            ),
          ).toBe(true);
        }
      }
    }
  });

  it("updates registry labels after the interface language changes", async () => {
    await act(() => i18n.changeLanguage("en-US"));
    const { result } = renderHook(() => useAuthorizationRegistry());

    await waitFor(() => expect(result.current.catalog).toBeDefined());
    const catalog = result.current.catalog!;
    const resourceType = catalog.resourceTypes.find((item) =>
      item.operations.some((operation) =>
        i18n.exists(`systemAdmin.resourceCatalog.operations.${operation.id}`),
      ),
    );
    const operation = resourceType?.operations.find((item) =>
      i18n.exists(`systemAdmin.resourceCatalog.operations.${item.id}`),
    );
    expect(resourceType).toBeDefined();
    expect(operation).toBeDefined();
    if (!resourceType || !operation) throw new Error("expected a translated registry operation");
    const labelKey = i18n.exists(
      `systemAdmin.resourceCatalog.operations.${resourceType.id}.${operation.id}`,
    )
      ? `systemAdmin.resourceCatalog.operations.${resourceType.id}.${operation.id}`
      : `systemAdmin.resourceCatalog.operations.${operation.id}`;

    const before = result.current
      .operationsForType(resourceType.id)
      .find((item) => item.key === operation.id)?.label;

    await act(() => i18n.changeLanguage("zh-CN"));

    await waitFor(() =>
      expect(
        result.current.operationsForType(resourceType.id).find((item) => item.key === operation.id)
          ?.label,
      ).toBe(i18n.t(labelKey)),
    );
    expect(before).not.toBe(i18n.t(labelKey));
  });
});
