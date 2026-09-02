/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  addOperationToGrant,
  removeOperationFromGrant,
} from "@/modules/system-admin/utils/resource-grant-operations";
import type { ResourceGrant } from "@/modules/system-admin/types/admin";

const catalogGrant: ResourceGrant = {
  resource: { type: "catalog", id: "*" },
  operations: ["view_detail", "query"],
};

describe("ResourceGrantEditor operation changes", () => {
  it("adds an operation to the existing resource grant without replacing other operations", () => {
    expect(addOperationToGrant([catalogGrant], catalogGrant, "create")).toEqual([
      { ...catalogGrant, operations: ["view_detail", "query", "create"] },
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
