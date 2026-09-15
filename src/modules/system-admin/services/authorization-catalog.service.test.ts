/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  normalizeAuthorizationCatalog,
} from "@/modules/system-admin/services/authorization-catalog.service";

describe("authorization catalog contract", () => {
  it("preserves explicit parent fallback and same-resource requirements", () => {
    const catalog = normalizeAuthorizationCatalog({
      resource_types: [{
        id: "object_type",
        name: "Object Type",
        parent_type: "knowledge_network",
        operations: [
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
        { id: "query_data", name: "Query Data", parentOperation: "query_data", requires: [] },
        { id: "modify", name: "Modify", parentOperation: "modify", requires: ["view_detail"] },
      ],
    }]);
  });

  it("does not invent requirements for independent operations", () => {
    const catalog = normalizeAuthorizationCatalog({
      resource_types: [{
        id: "resource",
        name: "Data Resource",
        operations: [{ id: "query_data", name: "Query Data" }],
      }],
    });

    expect(catalog.resourceTypes[0]?.operations[0]?.requires).toEqual([]);
  });
});
