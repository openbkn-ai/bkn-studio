/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  addOperationToGrant,
  normalizeRoleOperations,
  removeOperationFromGrant,
} from "@/modules/system-admin/utils/resource-grant-operations";
import type { ResourceGrant } from "@/modules/system-admin/types/admin";

function resolveRoleGrantId(wholeType: boolean, draftId: string) {
  return wholeType ? "*" : draftId.trim();
}

const catalogGrant: ResourceGrant = {
  resource: { type: "catalog", id: "*" },
  operations: ["view_detail", "query"],
};

describe("ResourceGrantEditor operation changes", () => {
  it("clears the stale wildcard when switching from all resources to a specific scope", () => {
    let draftId = "*";
    let wholeType = true;

    wholeType = false;
    draftId = "";

    expect(resolveRoleGrantId(wholeType, draftId)).toBe("");
    expect(resolveRoleGrantId(true, draftId)).toBe("*");
  });

  it("resolves a concrete resource id when all-resources scope is disabled", () => {
    const wholeType = false;
    const draftId = "  catalog-1  ";

    expect(resolveRoleGrantId(wholeType, draftId)).toBe("catalog-1");
  });

  it("adds an operation to the existing resource grant without replacing other operations", () => {
    expect(addOperationToGrant([catalogGrant], catalogGrant, "create")).toEqual([
      { ...catalogGrant, operations: ["view_detail", "query", "create"] },
    ]);
  });

  it("adds and protects the view prerequisite used by permission management", () => {
    expect(normalizeRoleOperations("catalog", ["modify"])).toEqual(["view_detail", "modify"]);

    const dependentGrant: ResourceGrant = {
      resource: { type: "catalog", id: "catalog-1" },
      operations: ["view_detail", "modify"],
    };
    expect(removeOperationFromGrant([dependentGrant], dependentGrant, "view_detail")).toEqual([
      dependentGrant,
    ]);
  });

  it("removes only the selected operation", () => {
    expect(removeOperationFromGrant([catalogGrant], catalogGrant, "query")).toEqual([
      { ...catalogGrant, operations: ["view_detail"] },
    ]);
  });

  it("removes the entire grant after its last operation is removed", () => {
    const singleOperationGrant = { ...catalogGrant, operations: ["query"] };

    expect(removeOperationFromGrant([singleOperationGrant], singleOperationGrant, "query")).toEqual([]);
  });
});
