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
  mockAuthorizationRegistry,
  normalizeAuthorizationRegistry,
} from "@/modules/system-admin/services/authorization-registry.service";
import { useAuthorizationRegistry } from "@/modules/system-admin/hooks/use-authorization-registry";

describe("authorization registry contract", () => {
  it("preserves explicit parent fallback and same-resource requirements", () => {
    const catalog = normalizeAuthorizationRegistry({
      resource_types: [{
        id: "object_type",
        name: "Object Type",
        parent_type: "knowledge_network",
        operations: [
          { id: "view_detail", name: "View Detail", parent_operation: "view_detail", requires: [] },
          { id: "query_data", name: "Query Data", parent_operation: "query_data", requires: [] },
          { id: "modify", name: "Modify", parent_operation: "modify", requires: ["view_detail"] },
        ],
      }],
    });

    expect(catalog.resourceTypes).toEqual([{
      id: "object_type",
      name: "Object Type",
      parentType: "knowledge_network",
      operations: [
        { id: "view_detail", name: "View Detail", parentOperation: "view_detail", requires: [] },
        { id: "query_data", name: "Query Data", parentOperation: "query_data", requires: [] },
        { id: "modify", name: "Modify", parentOperation: "modify", requires: ["view_detail"] },
      ],
    }]);
  });

  it("does not invent requirements for independent operations", () => {
    const catalog = normalizeAuthorizationRegistry({
      resource_types: [{
        id: "resource",
        name: "Data Resource",
        operations: [{ id: "query_data", name: "Query Data" }],
      }],
    });

    expect(catalog.resourceTypes[0]?.operations[0]?.requires).toEqual([]);
  });

  it("rejects an empty or internally incomplete registry", () => {
    expect(() => normalizeAuthorizationRegistry({})).toThrow(/does not contain any resource types/);
    expect(() => normalizeAuthorizationRegistry({
      resource_types: [{
        id: "catalog",
        operations: [{ id: "resource_manage", requires: ["view_detail"] }],
      }],
    })).toThrow(/unknown requirement/);
  });

  it("keeps the function resource type in the mock registry", () => {
    const functionType = mockAuthorizationRegistry().resourceTypes.find(
      (resourceType) => resourceType.id === "function",
    );

    expect(functionType?.operations.map((operation) => operation.id)).toEqual(
      expect.arrayContaining(["view", "modify", "execute"]),
    );
    expect(functionType?.operations.find((operation) => operation.id === "modify")?.requires)
      .toEqual(["view"]);
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

    const before = result.current.operationsForType(resourceType.id)
      .find((item) => item.key === operation.id)?.label;

    await act(() => i18n.changeLanguage("zh-CN"));

    await waitFor(() => expect(result.current.operationsForType(resourceType.id)
      .find((item) => item.key === operation.id)?.label)
      .toBe(i18n.t(`systemAdmin.resourceCatalog.operations.${operation.id}`)));
    expect(before).not.toBe(i18n.t(`systemAdmin.resourceCatalog.operations.${operation.id}`));
  });
});
